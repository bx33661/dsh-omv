import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { ReviewNote, ReviewRecord, ReviewStatus } from './contracts.js'

const STORE_VERSION = 1

interface ReviewStore {
  schemaVersion: 1
  updatedAt: string
  records: Record<string, ReviewRecord>
}

/** Durable local review state. DSH session ids are accepted as author identities. */
export class CollaborationService {
  readonly projectRoot: string
  private writeTail: Promise<void> = Promise.resolve()

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot
  }

  async list(findingId?: string): Promise<ReviewRecord[]> {
    const store = await this.readStore()
    return Object.values(store.records)
      .filter(record => findingId === undefined || record.findingId === findingId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  }

  async get(findingId: string): Promise<ReviewRecord> {
    const id = required(findingId, 'finding id')
    const existing = (await this.readStore()).records[id]
    return existing ?? emptyRecord(id)
  }

  async update(input: {
    findingId: string
    status?: ReviewStatus
    assignee?: string
    reviewer?: string
  }): Promise<ReviewRecord> {
    return this.serial(async () => {
      const store = await this.readStore()
      const id = required(input.findingId, 'finding id')
      const record = store.records[id] ?? emptyRecord(id)
      if (input.status !== undefined) record.status = input.status
      if (input.assignee !== undefined) {
        const value = input.assignee.trim()
        if (value === '') delete record.assignee
        else record.assignee = value
      }
      if (input.reviewer !== undefined && input.reviewer.trim() !== '') {
        record.reviewers = [...new Set([...record.reviewers, input.reviewer.trim()])]
      }
      record.updatedAt = new Date().toISOString()
      store.records[id] = record
      store.updatedAt = record.updatedAt
      await this.writeStore(store)
      return record
    })
  }

  async addNote(input: { findingId: string; author: string; body: string }): Promise<ReviewRecord> {
    return this.serial(async () => {
      const store = await this.readStore()
      const id = required(input.findingId, 'finding id')
      const body = required(input.body, 'review note')
      const author = required(input.author, 'review author')
      const record = store.records[id] ?? emptyRecord(id)
      const now = new Date().toISOString()
      const note: ReviewNote = {
        id: `note-${randomUUID().slice(0, 12)}`,
        findingId: id,
        author,
        body,
        createdAt: now,
        updatedAt: now,
      }
      record.notes = [...record.notes, note]
      if (record.status === 'unreviewed') record.status = 'in_review'
      record.updatedAt = now
      store.records[id] = record
      store.updatedAt = now
      await this.writeStore(store)
      return record
    })
  }

  async resolveNote(findingId: string, noteId: string): Promise<ReviewRecord> {
    return this.serial(async () => {
      const store = await this.readStore()
      const id = required(findingId, 'finding id')
      const record = store.records[id] ?? emptyRecord(id)
      const note = record.notes.find(item => item.id === noteId)
      if (note === undefined) throw new Error(`review note not found: ${noteId}`)
      const now = new Date().toISOString()
      if (note.resolvedAt === undefined) note.resolvedAt = now
      else delete note.resolvedAt
      note.updatedAt = now
      record.updatedAt = now
      store.records[id] = record
      store.updatedAt = now
      await this.writeStore(store)
      return record
    })
  }

  private async readStore(): Promise<ReviewStore> {
    try {
      const value = JSON.parse(await readFile(this.storePath(), 'utf8')) as unknown
      if (!isStore(value)) throw new Error(`invalid review store: ${this.storePath()}`)
      return value
    } catch (error) {
      if (!isNotFound(error)) throw error
      return { schemaVersion: STORE_VERSION, updatedAt: new Date(0).toISOString(), records: {} }
    }
  }

  private async writeStore(store: ReviewStore): Promise<void> {
    const path = this.storePath()
    await mkdir(dirname(path), { recursive: true })
    const temporary = `${path}.${randomUUID()}.tmp`
    await writeFile(temporary, `${JSON.stringify(store, null, 2)}\n`, 'utf8')
    await rename(temporary, path)
  }

  private storePath(): string {
    return join(this.projectRoot, '.omv', '.dsh', 'reviews.json')
  }

  private async serial<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.writeTail.then(operation, operation)
    this.writeTail = run.then(() => undefined, () => undefined)
    return run
  }
}

function emptyRecord(findingId: string): ReviewRecord {
  return { findingId, status: 'unreviewed', reviewers: [], notes: [], updatedAt: new Date(0).toISOString() }
}

function required(value: string, label: string): string {
  const normalized = value.trim()
  if (normalized === '') throw new Error(`${label} is required`)
  return normalized
}

function isStore(value: unknown): value is ReviewStore {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const candidate = value as Partial<ReviewStore>
  return candidate.schemaVersion === STORE_VERSION && typeof candidate.updatedAt === 'string' && candidate.records !== undefined && typeof candidate.records === 'object'
}

function isNotFound(error: unknown): boolean {
  return error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT'
}
