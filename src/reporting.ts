import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { checkReportArtifacts, createReportProvenance, listReportFiles, showFinding } from 'oh-my-vul'
import type { DisclosurePlan, ReportPack } from './contracts.js'

const STORE_VERSION = 1

interface DisclosureStore {
  schemaVersion: 1
  updatedAt: string
  plans: Record<string, DisclosurePlan[]>
}

/** Report artifacts, provenance manifests and disclosure timelines in one local service. */
export class ReportingService {
  readonly projectRoot: string

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot
  }

  async inspect(findingId: string): Promise<ReportPack> {
    const id = required(findingId, 'finding id')
    try {
      const result = await checkReportArtifacts(id, this.projectRoot)
      const status = result.errors.length > 0
        ? result.reportArtifactPaths.length === 0 ? 'missing' : 'stale'
        : result.reportArtifactPaths.length === 0 ? 'missing' : result.provenanceFresh === false ? 'stale' : 'ready'
      return {
        findingId: id,
        status,
        reportsDir: result.reportsDir,
        artifacts: result.reportArtifactPaths,
        missing: [...result.errors, ...result.warnings],
        ...(result.provenanceFresh === null || result.provenanceFresh === undefined ? {} : { provenanceFresh: result.provenanceFresh }),
        nextAction: status === 'missing' ? '生成报告草稿' : status === 'stale' ? '刷新报告来源与 provenance' : '检查报告并进入披露流程',
      }
    } catch (error) {
      return {
        findingId: id,
        status: 'missing',
        reportsDir: join(this.projectRoot, '.omv', 'reports', id),
        artifacts: [],
        missing: [error instanceof Error ? error.message : String(error)],
        nextAction: '生成报告草稿',
      }
    }
  }

  async prepare(findingId: string): Promise<ReportPack> {
    const id = required(findingId, 'finding id')
    const detail = await showFinding(id, this.projectRoot)
    const rawEvidence = await readFile(detail.path, 'utf8')
    const reportsDir = join(this.projectRoot, '.omv', 'reports', id)
    await mkdir(reportsDir, { recursive: true })
    const draftPath = join(reportsDir, 'dsh-omv-draft.md')
    const draft = buildDraft(detail, rawEvidence)
    await writeFile(draftPath, draft, 'utf8')
    await createReportProvenance(id, this.projectRoot, { force: true })
    return this.inspect(id)
  }

  async files(findingId: string): Promise<string[]> {
    return listReportFiles(required(findingId, 'finding id'), this.projectRoot)
  }

  async disclosureList(findingId?: string): Promise<DisclosurePlan[]> {
    const store = await this.readDisclosureStore()
    return Object.values(store.plans).flat().filter(plan => findingId === undefined || plan.findingId === findingId).sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  }

  async schedule(input: { findingId: string; channel: DisclosurePlan['channel']; dueAt: string; recipient?: string; notes?: string }): Promise<DisclosurePlan> {
    const id = required(input.findingId, 'finding id')
    const dueAt = required(input.dueAt, 'disclosure date')
    if (Number.isNaN(new Date(dueAt).getTime())) throw new Error('disclosure date must be an ISO date')
    const store = await this.readDisclosureStore()
    const now = new Date().toISOString()
    const plan: DisclosurePlan = {
      id: `disclosure-${randomUUID().slice(0, 12)}`,
      findingId: id,
      channel: input.channel,
      status: 'planned',
      dueAt: new Date(dueAt).toISOString(),
      createdAt: now,
      updatedAt: now,
      ...(input.recipient?.trim() === undefined || input.recipient.trim() === '' ? {} : { recipient: input.recipient.trim() }),
      ...(input.notes?.trim() === undefined || input.notes.trim() === '' ? {} : { notes: input.notes.trim() }),
    }
    store.plans[id] = [...(store.plans[id] ?? []), plan]
    store.updatedAt = now
    await this.writeDisclosureStore(store)
    return plan
  }

  private async readDisclosureStore(): Promise<DisclosureStore> {
    try {
      const value = JSON.parse(await readFile(this.disclosurePath(), 'utf8')) as unknown
      if (!isStore(value)) throw new Error(`invalid disclosure store: ${this.disclosurePath()}`)
      return value
    } catch (error) {
      if (!isNotFound(error)) throw error
      return { schemaVersion: STORE_VERSION, updatedAt: new Date(0).toISOString(), plans: {} }
    }
  }

  private async writeDisclosureStore(store: DisclosureStore): Promise<void> {
    const path = this.disclosurePath()
    await mkdir(dirname(path), { recursive: true })
    const temporary = `${path}.${randomUUID()}.tmp`
    await writeFile(temporary, `${JSON.stringify(store, null, 2)}\n`, 'utf8')
    await rename(temporary, path)
  }

  private disclosurePath(): string {
    return join(this.projectRoot, '.omv', '.dsh', 'disclosures.json')
  }
}

function buildDraft(detail: Awaited<ReturnType<typeof showFinding>>, rawEvidence: string): string {
  return [
    `# ${detail.id} — vulnerability research report`,
    '',
    `- Package: ${detail.package}`,
    `- Ecosystem: ${detail.ecosystem}`,
    `- Vulnerability: ${detail.vulnerability}`,
    `- Status: ${detail.status}`,
    `- Generated by: dsh-omv report workspace`,
    '',
    '## Executive summary',
    '',
    detail.verdict.reason || 'Add a concise, evidence-backed summary before disclosure.',
    '',
    '## Evidence.v1 snapshot',
    '',
    '```yaml',
    rawEvidence.trim(),
    '```',
    '',
    '## Reproduction and impact',
    '',
    'Document the exact command, observed result, affected versions, and attacker impact.',
    '',
    '## Disclosure checklist',
    '',
    '- [ ] Validate Evidence.v1',
    '- [ ] Review deduplication results',
    '- [ ] Attach reproduction artifacts',
    '- [ ] Confirm affected version range',
    '- [ ] Choose disclosure channel and deadline',
    '',
  ].join('\n')
}

function required(value: string, label: string): string {
  const normalized = value.trim()
  if (normalized === '') throw new Error(`${label} is required`)
  return normalized
}

function isStore(value: unknown): value is DisclosureStore {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const candidate = value as Partial<DisclosureStore>
  return candidate.schemaVersion === STORE_VERSION && typeof candidate.updatedAt === 'string' && candidate.plans !== undefined && typeof candidate.plans === 'object'
}

function isNotFound(error: unknown): boolean {
  return error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT'
}
