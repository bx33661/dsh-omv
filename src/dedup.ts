import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { DedupMatch, DedupStatus, DedupSummary } from './contracts.js'

const STORE_VERSION = 1

interface DedupStore {
  schemaVersion: 1
  updatedAt: string
  summaries: Record<string, DedupSummary>
}

export interface DedupCandidate {
  id: string
  package: string
  ecosystem: string
  vulnerability: string
  path: string
}

const VULNERABILITY_OVERLAP_REASON = '漏洞类型词项重合'

/**
 * Local-first duplicate triage. External advisory adapters can add matches later.
 * A match alone is only "review this neighbour"; `possible_duplicate` additionally
 * requires the vulnerability class to overlap, so same-package campaigns with
 * distinct vulnerability lanes do not flag each other as duplicates.
 */
export class DedupService {
  readonly projectRoot: string
  private writeTail: Promise<void> = Promise.resolve()

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot
  }

  async list(findingId?: string): Promise<DedupSummary[]> {
    const store = await this.readStore()
    return Object.values(store.summaries)
      .filter(item => findingId === undefined || item.findingId === findingId)
      .sort((left, right) => (right.scannedAt ?? '').localeCompare(left.scannedAt ?? ''))
  }

  async get(findingId: string): Promise<DedupSummary> {
    const id = required(findingId, 'finding id')
    return (await this.readStore()).summaries[id] ?? emptySummary(id)
  }

  async scan(findingId: string, candidates: readonly DedupCandidate[], advisoryTitles: readonly string[] = []): Promise<DedupSummary> {
    return this.serial(async () => {
      const id = required(findingId, 'finding id')
      const target = candidates.find(candidate => candidate.id === id)
      if (target === undefined) throw new Error(`finding not found for dedup scan: ${id}`)
      const now = new Date().toISOString()
      const matches: DedupMatch[] = []
      for (const candidate of candidates) {
        if (candidate.id === target.id) continue
        const comparison = compare(target, candidate)
        if (comparison.score < 45) continue
        matches.push({
          id: `dedup-${randomUUID().slice(0, 12)}`,
          findingId: target.id,
          targetFindingId: candidate.id,
          source: 'local',
          title: `${candidate.id} · ${candidate.package}`,
          score: comparison.score,
          reasons: comparison.reasons,
          status: 'open',
          createdAt: now,
        })
      }
      for (const title of advisoryTitles) {
        const normalized = title.trim()
        if (normalized === '') continue
        const score = tokenOverlap(`${target.package} ${target.vulnerability}`, normalized) * 100
        if (score < 45) continue
        matches.push({
          id: `dedup-${randomUUID().slice(0, 12)}`,
          findingId: target.id,
          source: 'advisory',
          title: normalized,
          score: Math.round(score),
          reasons: ['Radar/公告标题与当前包或漏洞类型存在词项重合'],
          status: 'open',
          createdAt: now,
        })
      }
      const summary: DedupSummary = {
        findingId: target.id,
        status: matches.some(match => match.score >= 65 && (match.source !== 'local' || match.reasons.includes(VULNERABILITY_OVERLAP_REASON))) ? 'possible_duplicate' : 'clear',
        scannedAt: now,
        matches: matches.sort((left, right) => right.score - left.score),
        sources: ['local', ...(matches.some(match => match.source === 'advisory') ? ['advisory'] : [])],
        nextAction: matches.length === 0 ? '可记录为 dedup clean，并继续验证其他维度' : '逐条判断相似项，确认 duplicate 或 dismiss',
      }
      const store = await this.readStore()
      store.summaries[target.id] = summary
      store.updatedAt = now
      await this.writeStore(store)
      return summary
    })
  }

  async update(findingId: string, status: DedupStatus, matchId?: string): Promise<DedupSummary> {
    return this.serial(async () => {
      const id = required(findingId, 'finding id')
      const store = await this.readStore()
      const summary = store.summaries[id] ?? emptySummary(id)
      summary.status = status
      if (matchId !== undefined) {
        const match = summary.matches.find(item => item.id === matchId)
        if (match === undefined) throw new Error(`dedup match not found: ${matchId}`)
        match.status = status === 'duplicate' ? 'confirmed' : status === 'clear' ? 'dismissed' : 'open'
      }
      summary.nextAction = status === 'duplicate'
        ? '记录重复关系并合并研究上下文'
        : status === 'clear'
          ? '去重检查已完成，可继续影响范围和报告材料'
          : '继续检查公告、生态数据库和相邻 Finding'
      store.summaries[id] = summary
      store.updatedAt = new Date().toISOString()
      await this.writeStore(store)
      return summary
    })
  }

  private async readStore(): Promise<DedupStore> {
    try {
      const value = JSON.parse(await readFile(this.storePath(), 'utf8')) as unknown
      if (!isStore(value)) throw new Error(`invalid dedup store: ${this.storePath()}`)
      return value
    } catch (error) {
      if (!isNotFound(error)) throw error
      return { schemaVersion: STORE_VERSION, updatedAt: new Date(0).toISOString(), summaries: {} }
    }
  }

  private async writeStore(store: DedupStore): Promise<void> {
    const path = this.storePath()
    await mkdir(dirname(path), { recursive: true })
    const temporary = `${path}.${randomUUID()}.tmp`
    await writeFile(temporary, `${JSON.stringify(store, null, 2)}\n`, 'utf8')
    await rename(temporary, path)
  }

  private storePath(): string {
    return join(this.projectRoot, '.omv', '.dsh', 'dedup.json')
  }

  private async serial<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.writeTail.then(operation, operation)
    this.writeTail = run.then(() => undefined, () => undefined)
    return run
  }
}

function emptySummary(findingId: string): DedupSummary {
  return { findingId, status: 'unknown', matches: [], sources: [], nextAction: '运行去重扫描，检查本地 Finding 与公开情报' }
}

function compare(left: DedupCandidate, right: DedupCandidate): { score: number; reasons: string[] } {
  let score = 0
  const reasons: string[] = []
  if (left.package.trim().toLowerCase() === right.package.trim().toLowerCase()) {
    score += 55
    reasons.push('包名相同')
  } else if (tokenOverlap(left.package, right.package) > .4) {
    score += 25
    reasons.push('包名词项相近')
  }
  if (left.ecosystem.trim().toLowerCase() === right.ecosystem.trim().toLowerCase()) {
    score += 15
    reasons.push('生态相同')
  }
  const overlap = tokenOverlap(left.vulnerability, right.vulnerability)
  if (overlap > .2) {
    score += Math.round(overlap * 25)
    reasons.push(VULNERABILITY_OVERLAP_REASON)
  }
  return { score: Math.min(100, score), reasons }
}

function tokenOverlap(left: string, right: string): number {
  const leftTokens = new Set(tokens(left))
  const rightTokens = new Set(tokens(right))
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0
  let shared = 0
  for (const token of leftTokens) if (rightTokens.has(token)) shared += 1
  return shared / Math.max(leftTokens.size, rightTokens.size)
}

function tokens(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9一-鿿]+/u).filter(token => token.length >= 2)
}

function required(value: string, label: string): string {
  const normalized = value.trim()
  if (normalized === '') throw new Error(`${label} is required`)
  return normalized
}

function isStore(value: unknown): value is DedupStore {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const candidate = value as Partial<DedupStore>
  return candidate.schemaVersion === STORE_VERSION && typeof candidate.updatedAt === 'string' && candidate.summaries !== undefined && typeof candidate.summaries === 'object'
}

function isNotFound(error: unknown): boolean {
  return error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT'
}
