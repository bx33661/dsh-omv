import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative, sep } from 'node:path'
import { promisify } from 'node:util'
import type { PocArtifact, PocDraft, PocProvenance, PocRun, PocStatus, OmvWorkbenchConfig } from './contracts.js'

const execFileAsync = promisify(execFile)

export interface CommandRunner {
  run(command: string, args: string[], options: { timeout: number; signal?: AbortSignal }): Promise<{ stdout: string; stderr: string; exitCode: number }>
}

export interface PocExecutionOptions {
  id?: string
  signal?: AbortSignal
  runDirectory?: string
  sourceDirectory?: string
}

export interface PocExecutor {
  validate(draft: PocDraft, config: OmvWorkbenchConfig): { ok: boolean; errors: string[]; warnings: string[] }
  execute(draft: PocDraft, config: OmvWorkbenchConfig, runner: CommandRunner, options?: PocExecutionOptions): Promise<PocRun>
}

export class DockerPocExecutor implements PocExecutor {
  validate(draft: PocDraft, config: OmvWorkbenchConfig): { ok: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = []
    const warnings: string[] = []
    if (!draft.script || draft.script.trim() === '') errors.push('script cannot be empty')
    if (Buffer.byteLength(draft.script, 'utf8') > config.pocMaxScriptBytes) errors.push(`script exceeds maximum size of ${config.pocMaxScriptBytes} bytes`)
    if (!['python', 'bash', 'curl'].includes(draft.language)) errors.push(`unsupported language: ${draft.language}`)
    const imageReference = imageReferenceFor(draft)
    if (!config.pocDockerImages.includes(draft.image) && !config.pocDockerImages.includes(imageReference)) errors.push(`image ${imageReference} is not in the allowlist`)
    if (draft.imageDigest === undefined) warnings.push('image is tag-based; pin an image digest before submitting a report')
    if (draft.requiresNetwork && !config.pocAllowNetwork) errors.push('PoC requires network but network access is disabled')
    if (draft.script.includes('/var/run/docker.sock')) errors.push('mounting docker.sock is forbidden')
    if (draft.script.includes('--privileged')) errors.push('privileged containers are forbidden')
    if (draft.script.includes('--network host')) errors.push('host network is forbidden')
    const expectedEntrypoint = draft.language === 'python' ? 'python3 /workspace/poc.py' : 'bash /workspace/poc.sh'
    if (!draft.commandArgs.join(' ').includes(expectedEntrypoint)) warnings.push(`command should use fixed entrypoint: ${expectedEntrypoint}`)
    return { ok: errors.length === 0, errors, warnings }
  }

  async execute(draft: PocDraft, config: OmvWorkbenchConfig, runner: CommandRunner, options: PocExecutionOptions = {}): Promise<PocRun> {
    const validation = this.validate(draft, config)
    if (!validation.ok) return createBlockedRun(draft, config, validation.errors.join('; '))
    const runId = options.id ?? `poc-run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const runDirectory = options.runDirectory ?? await mkdtemp(join(tmpdir(), 'omv-poc-'))
    const outputDirectory = join(runDirectory, 'output')
    await mkdir(outputDirectory, { recursive: true })
    const scriptName = draft.language === 'python' ? 'poc.py' : 'poc.sh'
    const scriptPath = join(runDirectory, scriptName)
    await writeFile(scriptPath, draft.script, { encoding: 'utf8', mode: 0o700 })
    const startedAt = new Date().toISOString()
    const dockerArgs = this.buildDockerArgs(draft, config, { scriptPath, outputDirectory, ...(options.sourceDirectory === undefined ? {} : { sourceDirectory: options.sourceDirectory }) })
    const provenance: PocProvenance = {
      image: draft.image,
      ...(draft.imageDigest === undefined ? {} : { imageDigest: draft.imageDigest }),
      command: dockerArgs,
      mounts: [
        { source: scriptPath, target: `/workspace/${scriptName}`, readOnly: true },
        { source: outputDirectory, target: '/output', readOnly: false },
        ...(options.sourceDirectory === undefined ? [] : [{ source: options.sourceDirectory, target: '/source', readOnly: true }]),
      ],
      scriptSha256: sha256(draft.script),
      startedAt,
    }
    try {
      const result = await runner.run('docker', dockerArgs, { timeout: config.pocTimeoutMs, ...(options.signal === undefined ? {} : { signal: options.signal }) })
      const resultDocument = await readResultDocument(outputDirectory, config.pocMaxOutputBytes)
      const artifactRecords = await collectArtifacts(outputDirectory, config.pocMaxOutputBytes)
      const resultArtifact = artifactRecords.find(artifact => artifact.path === 'result.json')
      const finishedAt = new Date().toISOString()
      const run: PocRun = {
        id: runId, draftId: draft.id, findingId: draft.findingId, backend: 'docker', status: this.parseStatus(result.exitCode, resultDocument),
        exitCode: result.exitCode, stdout: result.stdout.slice(0, config.pocMaxOutputBytes), stderr: result.stderr.slice(0, config.pocMaxOutputBytes),
        artifacts: artifactRecords.map(artifact => artifact.path), artifactRecords,
        ...(resultDocument === undefined ? {} : { result: resultDocument, ...(typeof resultDocument.observedResult === 'string' ? { observedResult: resultDocument.observedResult } : {}) }),
        safetyProfile: safetyProfile(draft, config), provenance: { ...provenance, ...(resultArtifact === undefined ? {} : { resultSha256: resultArtifact.sha256 }), finishedAt },
        createdAt: startedAt, updatedAt: finishedAt, startedAt, finishedAt,
      }
      return run
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('docker: command not found')) return createBlockedRun(draft, config, 'Docker is not available')
      const message = error instanceof Error && error.name === 'AbortError' ? 'execution aborted' : error instanceof Error && error.message.includes('timeout') ? 'execution timeout' : error instanceof Error && error.message.includes('docker: command not found') ? 'Docker is not available' : error instanceof Error ? error.message : String(error)
      return createFailedRun(draft, config, message, startedAt, runId, provenance)
    }
  }

  private buildDockerArgs(draft: PocDraft, config: OmvWorkbenchConfig, paths: { scriptPath: string; outputDirectory: string; sourceDirectory?: string }): string[] {
    const network = draft.requiresNetwork && config.pocAllowNetwork ? 'bridge' : 'none'
    const scriptName = draft.language === 'python' ? 'poc.py' : 'poc.sh'
    return [
      'run', '--rm', '--pull=never', `--network=${network}`, '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges',
      `--pids-limit=${config.pocPidLimit}`, `--memory=${config.pocMemoryMb}m`, `--cpus=${config.pocCpuLimit}`, '--tmpfs=/tmp:rw,noexec,nosuid,nodev,size=16m',
      '--mount', `type=bind,src=${paths.scriptPath},dst=/workspace/${scriptName},readonly`, '--mount', `type=bind,src=${paths.outputDirectory},dst=/output`,
      ...(paths.sourceDirectory === undefined ? [] : ['--mount', `type=bind,src=${paths.sourceDirectory},dst=/source,readonly`]), imageReferenceFor(draft), ...draft.commandArgs,
    ]
  }

  private parseStatus(exitCode: number, result: Record<string, unknown> | undefined): PocStatus {
    if (exitCode !== 0) return 'failed'
    if (result?.status === 'passed') return 'passed'
    if (result?.status === 'failed') return 'failed'
    if (result?.status === 'blocked') return 'blocked'
    return 'needs_review'
  }
}

function imageReferenceFor(draft: PocDraft): string {
  return draft.imageDigest === undefined ? draft.image : `${draft.image}@${draft.imageDigest}`
}

function safetyProfile(draft: PocDraft, config: OmvWorkbenchConfig): PocRun['safetyProfile'] {
  return { network: draft.requiresNetwork && config.pocAllowNetwork ? 'bridge' : 'none', readOnly: true, capsDropped: true, pidLimit: config.pocPidLimit, memoryMb: config.pocMemoryMb, cpuLimit: config.pocCpuLimit }
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}

async function readResultDocument(outputDirectory: string, maxBytes: number): Promise<Record<string, unknown> | undefined> {
  try {
    const path = join(outputDirectory, 'result.json')
    const info = await stat(path)
    if (!info.isFile() || info.size > maxBytes) return undefined
    const parsed: unknown = JSON.parse(await readFile(path, 'utf8'))
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : undefined
  } catch { return undefined }
}

async function collectArtifacts(outputDirectory: string, maxBytes: number): Promise<PocArtifact[]> {
  const records: PocArtifact[] = []
  let total = 0
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = join(directory, entry.name)
      if (entry.isSymbolicLink()) continue
      if (entry.isDirectory()) { await visit(absolute); continue }
      if (!entry.isFile()) continue
      const info = await stat(absolute)
      total += info.size
      if (total > maxBytes) throw new Error(`PoC output exceeds maximum size of ${maxBytes} bytes`)
      records.push({ path: relative(outputDirectory, absolute).split(sep).join('/'), sha256: sha256(await readFile(absolute)), size: info.size })
    }
  }
  await visit(outputDirectory)
  return records
}

function createBlockedRun(draft: PocDraft, config: OmvWorkbenchConfig, reason: string): PocRun {
  const now = new Date().toISOString()
  return { id: `poc-run-${Date.now()}`, draftId: draft.id, findingId: draft.findingId, backend: 'docker', status: 'blocked', artifacts: [], stderr: reason, safetyProfile: safetyProfile(draft, config), createdAt: now, updatedAt: now }
}

function createFailedRun(draft: PocDraft, config: OmvWorkbenchConfig, reason: string, startedAt: string, id: string, provenance: PocProvenance): PocRun {
  const finishedAt = new Date().toISOString()
  return { id, draftId: draft.id, findingId: draft.findingId, backend: 'docker', status: 'failed', artifacts: [], stderr: reason, safetyProfile: safetyProfile(draft, config), provenance: { ...provenance, finishedAt }, createdAt: startedAt, updatedAt: finishedAt, startedAt, finishedAt }
}

export const defaultCommandRunner: CommandRunner = {
  async run(command: string, args: string[], options: { timeout: number; signal?: AbortSignal }): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    try {
      const { stdout, stderr } = await execFileAsync(command, args, { timeout: options.timeout, maxBuffer: 1024 * 1024, signal: options.signal })
      return { stdout, stderr, exitCode: 0 }
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') throw new Error(`${command}: command not found`)
      if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') throw error
      if (error && typeof error === 'object' && 'killed' in error && error.killed) throw new Error('execution timeout')
      const stdout = error && typeof error === 'object' && 'stdout' in error ? String(error.stdout) : ''
      const stderr = error && typeof error === 'object' && 'stderr' in error ? String(error.stderr) : ''
      const exitCode = error && typeof error === 'object' && 'code' in error && typeof error.code === 'number' ? error.code : 1
      return { stdout, stderr, exitCode }
    }
  },
}
