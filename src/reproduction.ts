import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { ReproductionRun, ReproductionRunStatus } from './contracts.js'

const STORE_VERSION = 1
const MAX_OUTPUT_BYTES = 64 * 1024

interface ReproductionStore {
  schemaVersion: 1
  updatedAt: string
  runs: Record<string, ReproductionRun>
}

/** Durable, append-preserving metadata for local reproduction attempts. */
export class ReproductionService {
  readonly projectRoot: string
  private writeTail: Promise<void> = Promise.resolve()

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot
  }

  async list(findingId?: string): Promise<ReproductionRun[]> {
    const store = await this.readStore()
    return Object.values(store.runs)
      .filter(run => findingId === undefined || run.findingId === findingId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  }

  async start(input: {
    findingId: string
    sessionId?: string
    command?: string
    environment?: Record<string, string>
    artifacts?: string[]
  }): Promise<ReproductionRun> {
    return this.serial(async () => {
      const store = await this.readStore()
      const now = new Date().toISOString()
      const id = `repro-${compactTime(now)}-${randomUUID().slice(0, 8)}`
      const run: ReproductionRun = {
        id,
        findingId: required(input.findingId, 'finding id'),
        status: 'running',
        artifacts: normalizedArtifacts(input.artifacts),
        createdAt: now,
        updatedAt: now,
        ...(input.sessionId === undefined ? {} : { sessionId: required(input.sessionId, 'session id') }),
        ...(blank(input.command) ? {} : { command: input.command!.trim() }),
        ...(input.environment === undefined ? {} : { environment: normalizedEnvironment(input.environment) }),
      }
      store.runs[id] = run
      store.updatedAt = now
      await this.writeStore(store)
      return run
    })
  }

  async finish(input: {
    runId: string
    status: Extract<ReproductionRunStatus, 'passed' | 'failed' | 'blocked'>
    sessionId?: string
    exitCode?: number
    output?: string
    artifacts?: string[]
  }): Promise<ReproductionRun> {
    return this.serial(async () => {
      const store = await this.readStore()
      const id = required(input.runId, 'reproduction run id')
      const run = store.runs[id]
      if (run === undefined) throw new Error(`reproduction run not found: ${id}`)
      const now = new Date().toISOString()
      run.status = input.status
      run.updatedAt = now
      run.finishedAt = now
      if (input.sessionId !== undefined) run.sessionId = required(input.sessionId, 'session id')
      if (input.exitCode !== undefined) {
        if (!Number.isInteger(input.exitCode)) throw new Error('exit code must be an integer')
        run.exitCode = input.exitCode
      }
      if (input.output !== undefined) run.output = truncateUtf8(input.output, MAX_OUTPUT_BYTES)
      if (input.artifacts !== undefined) run.artifacts = [...new Set([...run.artifacts, ...normalizedArtifacts(input.artifacts)])]
      store.updatedAt = now
      await this.writeStore(store)
      return run
    })
  }

  private async readStore(): Promise<ReproductionStore> {
    try {
      const value = JSON.parse(await readFile(this.storePath(), 'utf8')) as unknown
      if (!isStore(value)) throw new Error(`invalid reproduction store: ${this.storePath()}`)
      return value
    } catch (error) {
      if (!isNotFound(error)) throw error
      return { schemaVersion: STORE_VERSION, updatedAt: new Date(0).toISOString(), runs: {} }
    }
  }

  private async writeStore(store: ReproductionStore): Promise<void> {
    const path = this.storePath()
    await mkdir(dirname(path), { recursive: true })
    const temporary = `${path}.${randomUUID()}.tmp`
    await writeFile(temporary, `${JSON.stringify(store, null, 2)}\n`, 'utf8')
    await rename(temporary, path)
  }

  private storePath(): string { return join(this.projectRoot, '.omv', '.dsh', 'reproduction-runs.json') }

  private async serial<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.writeTail.then(operation, operation)
    this.writeTail = run.then(() => undefined, () => undefined)
    return run
  }
}

function normalizedEnvironment(value: Record<string, string>): Record<string, string> {
  const output: Record<string, string> = {}
  for (const [key, item] of Object.entries(value)) {
    const name = key.trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(name)) throw new Error(`invalid environment variable name: ${key}`)
    output[name] = String(item)
  }
  return output
}

function normalizedArtifacts(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map(value => value.trim()).filter(Boolean))]
}

function truncateUtf8(value: string, limit: number): string {
  const buffer = Buffer.from(value, 'utf8')
  return buffer.length <= limit ? value : `${buffer.subarray(0, limit).toString('utf8')}\n… output truncated`
}

function blank(value: string | undefined): boolean { return value === undefined || value.trim() === '' }
function required(value: string, name: string): string { const result = value.trim(); if (result === '') throw new Error(`${name} is required`); return result }
function compactTime(value: string): string { return value.replace(/[-:TZ.]/gu, '').slice(0, 14) }
function isNotFound(error: unknown): boolean { return error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT' }
function isStore(value: unknown): value is ReproductionStore {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return record.schemaVersion === STORE_VERSION && typeof record.updatedAt === 'string' && record.runs !== null && typeof record.runs === 'object' && !Array.isArray(record.runs)
}
