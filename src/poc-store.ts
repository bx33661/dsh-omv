import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import type { PocDraft, PocRun } from './contracts.js'

export class PocStore {
  private readonly dshDir: string
  private mutationQueue: Promise<void> = Promise.resolve()

  constructor(projectRoot: string) {
    this.dshDir = join(projectRoot, '.omv', '.dsh')
  }

  async ensureDirectory(): Promise<void> {
    await mkdir(this.dshDir, { recursive: true })
  }

  async saveDraft(draft: PocDraft): Promise<void> {
    await this.enqueue(async () => {
      await this.ensureDirectory()
      const draftsPath = join(this.dshDir, 'poc-drafts.json')
      const drafts = await this.loadDrafts()
      const index = drafts.findIndex(d => d.id === draft.id)
      if (index >= 0) drafts[index] = draft
      else drafts.push(draft)
      await this.writeAtomic(draftsPath, JSON.stringify(drafts, null, 2))
    })
  }

  async loadDrafts(): Promise<PocDraft[]> {
    const draftsPath = join(this.dshDir, 'poc-drafts.json')
    try {
      const content = await readFile(draftsPath, 'utf8')
      const parsed: unknown = JSON.parse(content)
      if (!Array.isArray(parsed)) return []
      return parsed.filter(isRecord).map(value => ({
        ...value,
        status: value.status === 'approved' || value.status === 'rejected' || value.status === 'stale' ? value.status : 'draft',
        validation: isRecord(value.validation) ? value.validation : { ok: false, errors: ['legacy draft requires validation'], warnings: [] },
      })) as unknown as PocDraft[]
    } catch {
      return []
    }
  }

  async saveRun(run: PocRun): Promise<void> {
    await this.enqueue(async () => {
      await this.ensureDirectory()
      const runsPath = join(this.dshDir, 'poc-runs.json')
      const runs = await this.loadRuns()
      const index = runs.findIndex(r => r.id === run.id)
      if (index >= 0) runs[index] = run
      else runs.push(run)
      await this.writeAtomic(runsPath, JSON.stringify(runs, null, 2))
    })
  }

  async loadRuns(): Promise<PocRun[]> {
    const runsPath = join(this.dshDir, 'poc-runs.json')
    try {
      const content = await readFile(runsPath, 'utf8')
      return JSON.parse(content) as PocRun[]
    } catch {
      return []
    }
  }

  async findDraft(id: string): Promise<PocDraft | undefined> {
    const drafts = await this.loadDrafts()
    return drafts.find(d => d.id === id)
  }

  async findRun(id: string): Promise<PocRun | undefined> {
    const runs = await this.loadRuns()
    return runs.find(r => r.id === id)
  }

  async findRunsByFinding(findingId: string): Promise<PocRun[]> {
    const runs = await this.loadRuns()
    return runs.filter(r => r.findingId === findingId)
  }

  async findDraftsByFinding(findingId: string): Promise<PocDraft[]> {
    const drafts = await this.loadDrafts()
    return drafts.filter(draft => draft.findingId === findingId)
  }

  private async writeAtomic(path: string, content: string): Promise<void> {
    const tempPath = `${path}.${randomUUID()}.tmp`
    await writeFile(tempPath, content, 'utf8')
    await rename(tempPath, path)
  }

  private enqueue(operation: () => Promise<void>): Promise<void> {
    const next = this.mutationQueue.then(operation, operation)
    this.mutationQueue = next.catch(() => undefined)
    return next
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
