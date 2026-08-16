import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { PocDraft, PocRun } from './contracts.js'

export class PocStore {
  private readonly dshDir: string

  constructor(projectRoot: string) {
    this.dshDir = join(projectRoot, '.omv', '.dsh')
  }

  async ensureDirectory(): Promise<void> {
    await mkdir(this.dshDir, { recursive: true })
  }

  async saveDraft(draft: PocDraft): Promise<void> {
    await this.ensureDirectory()
    const draftsPath = join(this.dshDir, 'poc-drafts.json')
    const drafts = await this.loadDrafts()
    const index = drafts.findIndex(d => d.id === draft.id)
    if (index >= 0) {
      drafts[index] = draft
    } else {
      drafts.push(draft)
    }
    await this.writeAtomic(draftsPath, JSON.stringify(drafts, null, 2))
  }

  async loadDrafts(): Promise<PocDraft[]> {
    const draftsPath = join(this.dshDir, 'poc-drafts.json')
    try {
      const content = await readFile(draftsPath, 'utf8')
      return JSON.parse(content) as PocDraft[]
    } catch {
      return []
    }
  }

  async saveRun(run: PocRun): Promise<void> {
    await this.ensureDirectory()
    const runsPath = join(this.dshDir, 'poc-runs.json')
    const runs = await this.loadRuns()
    const index = runs.findIndex(r => r.id === run.id)
    if (index >= 0) {
      runs[index] = run
    } else {
      runs.push(run)
    }
    await this.writeAtomic(runsPath, JSON.stringify(runs, null, 2))
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

  private async writeAtomic(path: string, content: string): Promise<void> {
    const tempPath = `${path}.tmp`
    await writeFile(tempPath, content, 'utf8')
    await writeFile(path, content, 'utf8')
  }
}
