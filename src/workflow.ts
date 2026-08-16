import { createHash, randomUUID } from 'node:crypto'
import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { FindingDetail, FindingReview } from 'oh-my-vul'
import type {
  AuditStage,
  EvidenceDiff,
  FindingSessionLink,
  WorkflowDispatch,
  WorkflowEvent,
  WorkflowIntent,
} from './contracts.js'
import { evaluateQualityGate } from './evidence-graph.js'
import { assessEvidence } from './assessment.js'

const STORE_VERSION = 1
const HISTORY_LIMIT = 80
const MAX_PATCH_BYTES = 32 * 1024

interface SessionLinkStore {
  schemaVersion: number
  updatedAt: string
  links: Record<string, FindingSessionLink>
}

/**
 * Persistent application layer shared by the browser, slash commands and
 * Agent tools. Evidence files remain authoritative; this store only owns DSH
 * session links and an append-only record of workflow transitions.
 */
export class OmvWorkflowService {
  readonly projectRoot: string
  private writeTail: Promise<void> = Promise.resolve()

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot
  }

  async links(): Promise<Record<string, FindingSessionLink>> {
    const store = await this.readLinkStore()
    return { ...store.links }
  }

  async linkFinding(findingId: string, sessionId: string, intent?: WorkflowIntent): Promise<FindingSessionLink> {
    const id = required(findingId, 'finding id')
    const session = required(sessionId, 'session id')
    return this.serial(async () => {
      const store = await this.readLinkStore()
      const now = new Date().toISOString()
      const previous = store.links[id]
      const link: FindingSessionLink = {
        findingId: id,
        sessionId: session,
        linkedAt: previous?.linkedAt ?? now,
        updatedAt: now,
        ...(intent === undefined ? previous?.lastIntent === undefined ? {} : { lastIntent: previous.lastIntent } : { lastIntent: intent }),
      }
      store.links[id] = link
      store.updatedAt = now
      await this.writeLinkStore(store)
      return link
    })
  }

  async unlinkFinding(findingId: string): Promise<boolean> {
    const id = required(findingId, 'finding id')
    return this.serial(async () => {
      const store = await this.readLinkStore()
      if (store.links[id] === undefined) return false
      delete store.links[id]
      store.updatedAt = new Date().toISOString()
      await this.writeLinkStore(store)
      return true
    })
  }

  async start(
    finding: FindingDetail,
    evidence: Record<string, unknown>,
    intent: WorkflowIntent,
    sessionId: string,
  ): Promise<WorkflowDispatch> {
    const stage = deriveAuditStage(finding, evidence)
    const linked = await this.linkFinding(finding.id, sessionId, intent)
    await this.record({ findingId: finding.id, action: 'workflow.start', sessionId, intent })
    const spec = workflowSpec(intent, finding)
    return {
      findingId: finding.id,
      sessionId,
      intent,
      label: spec.label,
      prompt: spec.prompt,
      stage,
      linked,
    }
  }

  async record(input: {
    findingId: string
    action: string
    sessionId?: string
    intent?: WorkflowIntent
    before?: string
    after?: string
  }): Promise<WorkflowEvent> {
    const timestamp = new Date().toISOString()
    const diff = input.before === undefined || input.after === undefined || input.before === input.after
      ? undefined
      : evidenceDiff(input.before, input.after, input.action, timestamp)
    const event: WorkflowEvent = {
      id: randomUUID(),
      findingId: input.findingId,
      action: input.action,
      timestamp,
      ...(input.sessionId === undefined ? {} : { sessionId: input.sessionId }),
      ...(input.intent === undefined ? {} : { intent: input.intent }),
      ...(diff === undefined ? {} : { diff }),
    }
    await this.serial(async () => {
      await mkdir(dirname(this.eventsPath()), { recursive: true })
      await appendFile(this.eventsPath(), `${JSON.stringify(event)}\n`, 'utf8')
    })
    return event
  }

  async history(findingId: string, limit = HISTORY_LIMIT): Promise<WorkflowEvent[]> {
    let raw: string
    try {
      raw = await readFile(this.eventsPath(), 'utf8')
    } catch (error) {
      if (isNotFound(error)) return []
      throw error
    }
    const rows: WorkflowEvent[] = []
    for (const line of raw.split(/\r?\n/u)) {
      if (line.trim() === '') continue
      try {
        const parsed = JSON.parse(line) as unknown
        if (isWorkflowEvent(parsed) && parsed.findingId === findingId) rows.push(parsed)
      } catch {
        // A partial final JSONL row is ignored; prior durable rows stay usable.
      }
    }
    return rows.slice(-Math.max(1, limit)).reverse()
  }

  private async readLinkStore(): Promise<SessionLinkStore> {
    try {
      const parsed = JSON.parse(await readFile(this.linksPath(), 'utf8')) as unknown
      if (!isLinkStore(parsed)) throw new Error(`invalid DSH session-link store: ${this.linksPath()}`)
      return parsed
    } catch (error) {
      if (!isNotFound(error)) throw error
      return { schemaVersion: STORE_VERSION, updatedAt: new Date(0).toISOString(), links: {} }
    }
  }

  private async writeLinkStore(store: SessionLinkStore): Promise<void> {
    const path = this.linksPath()
    await mkdir(dirname(path), { recursive: true })
    const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`
    await writeFile(temporary, `${JSON.stringify(store, null, 2)}\n`, 'utf8')
    await rename(temporary, path)
  }

  private linksPath(): string {
    return join(this.projectRoot, '.omv', '.dsh', 'session-links.json')
  }

  private eventsPath(): string {
    return join(this.projectRoot, '.omv', '.dsh', 'workflow-events.jsonl')
  }

  private async serial<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.writeTail.then(operation, operation)
    this.writeTail = run.then(() => undefined, () => undefined)
    return run
  }
}

export function deriveAuditStage(
  finding: FindingDetail,
  evidence: Record<string, unknown>,
  review?: FindingReview,
): AuditStage {
  if (finding.archived) return 'archived'
  if (finding.status === 'blocked' || review?.verdict === 'blocked') return 'blocked'
  if (truthyAt(evidence, 'disclosure.vendor_contacted')) return 'disclosed'
  if (finding.status === 'confirmed' && (evaluateQualityGate(finding, evidence).readyForReport || review?.reportReady === true)) return 'report_ready'
  if (finding.status === 'confirmed') return 'confirmed'
  const reproducer = knownAt(evidence, 'evidence.reproducer')
  const observed = knownAt(evidence, 'evidence.observed_result')
  if (reproducer && !observed) return 'reproducing'
  if (assessEvidence(finding, evidence).maturity !== 'unmapped') return 'investigating'
  return 'candidate'
}

export function suggestedIntent(stage: AuditStage): WorkflowIntent {
  switch (stage) {
    case 'candidate':
    case 'investigating': return 'audit'
    case 'reproducing': return 'repro'
    case 'confirmed': return 'dedup'
    case 'report_ready': return 'report'
    case 'disclosed': return 'disclose'
    case 'blocked': return 'critic'
    case 'archived': return 'audit'
  }
}

function workflowSpec(intent: WorkflowIntent, finding: FindingDetail): { label: string; prompt: string } {
  const id = finding.id
  const common = `当前工作区中的 OMV Finding 是 ${id}。先调用 omv_finding_inspect 读取现有 Evidence.v1；所有结论必须写明文件和行级证据；完成任何 Evidence 修改后调用 omv_finding_validate。`
  switch (intent) {
    case 'audit':
      return { label: '开始深审', prompt: `${common}\n执行深度审计：沿 source → sink → guard 追踪完整数据流，识别可达性、边界条件和缺失证据；直接更新 .omv/findings/${id}.yaml，并总结证实或证伪结果与下一步。` }
    case 'repro':
      return { label: '启动复现', prompt: `${common}\n执行本地复现：先调用 omv_finding_repro_init，检查已有 reproducer 与 artifacts，运行最小可重复步骤，把实际输出写入 observed_result 和 .omv/repro/${id}/，最后重新校验。` }
    case 'dedup':
      return { label: '去重检查', prompt: `${common}\n执行公开披露去重：针对包名、受影响组件、漏洞类型和关键函数查询 NVD、GHSA、OSV 及生态公告，记录查询式、命中和判断到 dedup 字段；区分相同根因、相似症状和无关结果。` }
    case 'critic':
      return { label: '对抗审阅', prompt: `${common}\n执行提交前对抗审阅：从 CNA/维护者视角寻找可达性、版本范围、复现、影响、CVSS、去重和报告材料中的拒绝理由，按严重程度列出阻塞项并修补能直接验证的缺口。` }
    case 'report':
      return { label: '生成报告', prompt: `${common}\n生成提交材料：确认 finding 为 confirmed 且证据达到提交阈值，在 .omv/reports/${id}/ 生成自包含漏洞报告、复现说明和 provenance；不得把 unknown 推测为事实。` }
    case 'disclose':
      return { label: '准备披露', prompt: `${common}\n准备披露流程：检查报告和去重结果，生成维护者初始联系邮件、跟进节点与披露时间线，更新 disclosure 字段，并明确仍需人工确认的联系人或日期。` }
  }
}

function evidenceDiff(before: string, after: string, action: string, changedAt: string): EvidenceDiff {
  const oldLines = before.replace(/\r\n/gu, '\n').split('\n')
  const newLines = after.replace(/\r\n/gu, '\n').split('\n')
  let prefix = 0
  while (prefix < oldLines.length && prefix < newLines.length && oldLines[prefix] === newLines[prefix]) prefix += 1
  let suffix = 0
  while (
    suffix < oldLines.length - prefix
    && suffix < newLines.length - prefix
    && oldLines[oldLines.length - 1 - suffix] === newLines[newLines.length - 1 - suffix]
  ) suffix += 1
  const removed = oldLines.slice(prefix, oldLines.length - suffix)
  const added = newLines.slice(prefix, newLines.length - suffix)
  const header = `@@ -${prefix + 1},${removed.length} +${prefix + 1},${added.length} @@`
  const body = [header, ...removed.map(line => `-${line}`), ...added.map(line => `+${line}`)].join('\n')
  return {
    beforeHash: digest(before),
    afterHash: digest(after),
    changedAt,
    action,
    patch: Buffer.byteLength(body, 'utf8') > MAX_PATCH_BYTES ? `${body.slice(0, MAX_PATCH_BYTES)}\n… diff truncated` : body,
    additions: added.length,
    deletions: removed.length,
  }
}

function valueAt(root: Record<string, unknown>, path: string): unknown {
  let value: unknown = root
  for (const key of path.split('.')) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined
    value = (value as Record<string, unknown>)[key]
  }
  return value
}

function knownAt(root: Record<string, unknown>, path: string): boolean {
  const value = valueAt(root, path)
  return value !== undefined && value !== null && value !== '' && value !== 'unknown'
}

function truthyAt(root: Record<string, unknown>, path: string): boolean {
  return valueAt(root, path) === true
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16)
}

function required(value: string, name: string): string {
  const normalized = value.trim()
  if (normalized === '') throw new Error(`${name} is required`)
  return normalized
}

function isNotFound(error: unknown): boolean {
  return error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT'
}

function isLinkStore(value: unknown): value is SessionLinkStore {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return record.schemaVersion === STORE_VERSION
    && typeof record.updatedAt === 'string'
    && record.links !== null
    && typeof record.links === 'object'
    && !Array.isArray(record.links)
}

function isWorkflowEvent(value: unknown): value is WorkflowEvent {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return typeof record.id === 'string'
    && typeof record.findingId === 'string'
    && typeof record.action === 'string'
    && typeof record.timestamp === 'string'
}
