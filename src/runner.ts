import { randomUUID } from 'node:crypto'
import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { Campaign, CampaignLane } from 'oh-my-vul'
import type {
  AuditStage,
  CampaignLaneDispatch,
  CampaignLaneStatus,
  CampaignRun,
  CampaignRunEvent,
  EvidenceMaturity,
} from './contracts.js'

const STORE_VERSION = 1
const MAX_CONCURRENCY = 8

interface CampaignRunStore {
  schemaVersion: 1
  updatedAt: string
  runs: Record<string, CampaignRun>
}

export interface LaneEvidenceState {
  findingId: string
  stage: AuditStage
  maturity: EvidenceMaturity
}

/**
 * Durable Campaign execution state. DSH owns the actual sessions; this store
 * owns lane admission, correlation, recovery and evidence-driven completion.
 */
export class CampaignRunner {
  readonly projectRoot: string
  private writeTail: Promise<void> = Promise.resolve()
  private recovery: Promise<void> | undefined

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot
  }

  async list(campaignId?: string): Promise<CampaignRun[]> {
    await this.ensureRecovered()
    const store = await this.readStore()
    return Object.values(store.runs)
      .filter(run => campaignId === undefined || run.campaignId === campaignId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  }

  async get(runId: string): Promise<CampaignRun> {
    await this.ensureRecovered()
    const run = (await this.readStore()).runs[required(runId, 'run id')]
    if (run === undefined) throw new Error(`campaign run not found: ${runId}`)
    return run
  }

  async create(campaign: Campaign, parentSessionId: string, concurrency = 3): Promise<CampaignRun> {
    await this.ensureRecovered()
    const parent = required(parentSessionId, 'parent session id')
    const width = boundedConcurrency(concurrency)
    const run = await this.serial(async () => {
      const store = await this.readStore()
      const existing = Object.values(store.runs).find(item => item.campaignId === campaign.id && (item.status === 'queued' || item.status === 'running' || item.status === 'paused'))
      if (existing !== undefined) return existing
      const now = new Date().toISOString()
      const id = `run-${compactTime(now)}-${randomUUID().slice(0, 8)}`
      const created: CampaignRun = {
        schemaVersion: STORE_VERSION,
        id,
        campaignId: campaign.id,
        parentSessionId: parent,
        status: 'queued',
        concurrency: width,
        createdAt: now,
        updatedAt: now,
        lanes: campaign.lanes.map(lane => laneRecord(campaign, lane, id, now)),
      }
      store.runs[id] = created
      store.updatedAt = now
      await this.writeStore(store)
      return created
    })
    await this.event(run, 'run.create', undefined, parent, `${run.lanes.length} lanes · concurrency ${run.concurrency}`)
    return run
  }

  async claim(runId: string): Promise<CampaignLaneDispatch[]> {
    await this.ensureRecovered()
    const claimed = await this.serial(async () => {
      const store = await this.readStore()
      const run = requireRun(store, runId)
      if (run.status === 'paused' || run.status === 'cancelled' || run.status === 'completed' || run.status === 'needs_attention' || run.status === 'failed') return []
      const active = run.lanes.filter(lane => lane.status === 'dispatching' || lane.status === 'running').length
      const available = Math.max(0, run.concurrency - active)
      const now = new Date().toISOString()
      const lanes = run.lanes.filter(lane => lane.status === 'queued').slice(0, available)
      for (const lane of lanes) {
        lane.status = 'dispatching'
        lane.attempts += 1
        lane.updatedAt = now
      }
      if (lanes.length > 0) {
        run.status = 'running'
        run.startedAt ??= now
        run.updatedAt = now
        store.updatedAt = now
        await this.writeStore(store)
      }
      return lanes.map(lane => dispatchOf(run, lane))
    })
    await Promise.all(claimed.map(dispatch => this.eventById(dispatch.runId, dispatch.campaignId, 'lane.claim', dispatch.laneId, undefined, `attempt ${dispatch.attempt}`)))
    return claimed
  }

  async bind(runId: string, laneId: string, sessionId: string): Promise<CampaignRun> {
    await this.ensureRecovered()
    const session = required(sessionId, 'session id')
    const run = await this.serial(async () => {
      const store = await this.readStore()
      const current = requireRun(store, runId)
      const lane = requireLane(current, laneId)
      if (lane.status !== 'dispatching' && lane.status !== 'running') throw new Error(`lane ${laneId} is not awaiting a DSH session`)
      const now = new Date().toISOString()
      lane.status = 'running'
      lane.sessionId = session
      lane.startedAt ??= now
      lane.updatedAt = now
      current.status = 'running'
      current.startedAt ??= now
      current.updatedAt = now
      store.updatedAt = now
      await this.writeStore(store)
      return current
    })
    await this.event(run, 'lane.bind', laneId, session)
    return run
  }

  async updateLane(input: {
    runId: string
    laneId: string
    status: Extract<CampaignLaneStatus, 'completed' | 'failed' | 'blocked' | 'awaiting_evidence'>
    sessionId?: string
    summary?: string
  }): Promise<CampaignRun> {
    await this.ensureRecovered()
    const run = await this.serial(async () => {
      const store = await this.readStore()
      const current = requireRun(store, input.runId)
      const lane = requireLane(current, input.laneId)
      const now = new Date().toISOString()
      lane.status = input.status
      lane.updatedAt = now
      lane.finishedAt = now
      if (input.sessionId !== undefined) lane.sessionId = required(input.sessionId, 'session id')
      if (input.summary !== undefined && input.summary.trim() !== '') lane.summary = input.summary.trim()
      if (input.status === 'failed') lane.lastError = input.summary?.trim() || 'lane failed without a summary'
      updateRunStatus(current, now)
      store.updatedAt = now
      await this.writeStore(store)
      return current
    })
    await this.event(run, `lane.${input.status}`, input.laneId, input.sessionId, input.summary)
    return run
  }

  async control(runId: string, control: 'pause' | 'resume' | 'cancel' | 'retry', laneId?: string): Promise<CampaignRun> {
    await this.ensureRecovered()
    const run = await this.serial(async () => {
      const store = await this.readStore()
      const current = requireRun(store, runId)
      const now = new Date().toISOString()
      if (control === 'pause') {
        if (current.status === 'running' || current.status === 'queued') current.status = 'paused'
      } else if (control === 'resume') {
        if (current.status === 'paused') current.status = current.lanes.some(lane => lane.status === 'running' || lane.status === 'dispatching') ? 'running' : 'queued'
      } else if (control === 'cancel') {
        current.status = 'cancelled'
        current.finishedAt = now
        for (const lane of current.lanes) {
          if (lane.status === 'queued' || lane.status === 'dispatching' || lane.status === 'running' || lane.status === 'awaiting_evidence') {
            lane.status = 'cancelled'
            lane.updatedAt = now
            lane.finishedAt = now
          }
        }
      } else {
        const targets = laneId === undefined ? current.lanes.filter(retryable) : [requireLane(current, laneId)]
        if (targets.length === 0) throw new Error('campaign run has no retryable lane')
        for (const lane of targets) {
          if (!retryable(lane)) throw new Error(`lane ${lane.laneId} is not retryable from ${lane.status}`)
          lane.status = 'queued'
          lane.updatedAt = now
          delete lane.sessionId
          delete lane.startedAt
          delete lane.finishedAt
          delete lane.lastError
        }
        current.status = 'queued'
        delete current.finishedAt
      }
      current.updatedAt = now
      store.updatedAt = now
      await this.writeStore(store)
      return current
    })
    await this.event(run, `run.${control}`, laneId)
    return run
  }

  async reconcile(runId: string, states: readonly LaneEvidenceState[]): Promise<CampaignRun> {
    await this.ensureRecovered()
    const byFinding = new Map(states.map(state => [state.findingId, state]))
    const changed: { laneId: string; status: CampaignLaneStatus; detail: string }[] = []
    const run = await this.serial(async () => {
      const store = await this.readStore()
      const current = requireRun(store, runId)
      const now = new Date().toISOString()
      for (const lane of current.lanes) {
        const state = byFinding.get(lane.findingId)
        if (state === undefined) continue
        if (state.stage === 'report_ready' || state.stage === 'disclosed') {
          if (lane.status !== 'completed') {
            lane.status = 'completed'
            lane.summary = `Evidence reached ${state.stage} with ${state.maturity} maturity`
            lane.finishedAt = now
            lane.updatedAt = now
            changed.push({ laneId: lane.laneId, status: lane.status, detail: lane.summary })
          }
        } else if (state.stage === 'blocked' && lane.status !== 'blocked') {
          lane.status = 'blocked'
          lane.summary = `Evidence is blocked with ${state.maturity} maturity`
          lane.finishedAt = now
          lane.updatedAt = now
          changed.push({ laneId: lane.laneId, status: lane.status, detail: lane.summary })
        }
      }
      if (changed.length > 0) {
        updateRunStatus(current, now)
        store.updatedAt = now
        await this.writeStore(store)
      }
      return current
    })
    await Promise.all(changed.map(change => this.event(run, `lane.${change.status}`, change.laneId, undefined, change.detail)))
    return run
  }

  async history(runId: string, limit = 100): Promise<CampaignRunEvent[]> {
    let raw: string
    try { raw = await readFile(this.eventsPath(), 'utf8') } catch (error) {
      if (isNotFound(error)) return []
      throw error
    }
    const events: CampaignRunEvent[] = []
    for (const line of raw.split(/\r?\n/u)) {
      if (line.trim() === '') continue
      try {
        const value = JSON.parse(line) as CampaignRunEvent
        if (value.runId === runId && typeof value.id === 'string') events.push(value)
      } catch { /* preserve valid rows before a partial tail */ }
    }
    return events.slice(-Math.max(1, limit)).reverse()
  }

  private async ensureRecovered(): Promise<void> {
    this.recovery ??= this.serial(async () => {
      const store = await this.readStore()
      const now = new Date().toISOString()
      let changed = false
      for (const run of Object.values(store.runs)) {
        for (const lane of run.lanes) {
          if (lane.status !== 'dispatching') continue
          lane.status = 'queued'
          lane.updatedAt = now
          lane.lastError = 'dispatch interrupted before DSH session binding; recovered for retry'
          changed = true
        }
        if (changed && run.status === 'running' && !run.lanes.some(lane => lane.status === 'running')) run.status = 'queued'
        if (changed) run.updatedAt = now
      }
      if (changed) {
        store.updatedAt = now
        await this.writeStore(store)
      }
    })
    await this.recovery
  }

  private async readStore(): Promise<CampaignRunStore> {
    try {
      const value = JSON.parse(await readFile(this.storePath(), 'utf8')) as unknown
      if (!isStore(value)) throw new Error(`invalid Campaign Runner store: ${this.storePath()}`)
      return value
    } catch (error) {
      if (!isNotFound(error)) throw error
      return { schemaVersion: STORE_VERSION, updatedAt: new Date(0).toISOString(), runs: {} }
    }
  }

  private async writeStore(store: CampaignRunStore): Promise<void> {
    const path = this.storePath()
    await mkdir(dirname(path), { recursive: true })
    const temporary = `${path}.${randomUUID()}.tmp`
    await writeFile(temporary, `${JSON.stringify(store, null, 2)}\n`, 'utf8')
    await rename(temporary, path)
  }

  private async event(run: CampaignRun, action: string, laneId?: string, sessionId?: string, detail?: string): Promise<void> {
    await this.eventById(run.id, run.campaignId, action, laneId, sessionId, detail)
  }

  private async eventById(runId: string, campaignId: string, action: string, laneId?: string, sessionId?: string, detail?: string): Promise<void> {
    const event: CampaignRunEvent = {
      id: randomUUID(), runId, campaignId, action, timestamp: new Date().toISOString(),
      ...(laneId === undefined ? {} : { laneId }),
      ...(sessionId === undefined ? {} : { sessionId }),
      ...(detail === undefined || detail.trim() === '' ? {} : { detail: detail.trim() }),
    }
    await this.serial(async () => {
      await mkdir(dirname(this.eventsPath()), { recursive: true })
      await appendFile(this.eventsPath(), `${JSON.stringify(event)}\n`, 'utf8')
    })
  }

  private storePath(): string { return join(this.projectRoot, '.omv', '.dsh', 'campaign-runs.json') }
  private eventsPath(): string { return join(this.projectRoot, '.omv', '.dsh', 'campaign-run-events.jsonl') }

  private async serial<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.writeTail.then(operation, operation)
    this.writeTail = run.then(() => undefined, () => undefined)
    return run
  }
}

function laneRecord(campaign: Campaign, lane: CampaignLane, runId: string, now: string): CampaignRun['lanes'][number] {
  return {
    laneId: lane.id,
    title: lane.title,
    vulnerabilityClass: lane.vulnerability_class,
    findingId: lane.finding_id,
    status: 'queued',
    attempts: 0,
    prompt: lanePrompt(campaign, lane, runId),
    createdAt: now,
    updatedAt: now,
  }
}

function lanePrompt(campaign: Campaign, lane: CampaignLane, runId: string): string {
  return [
    `你正在执行 OMV Campaign ${campaign.id} 的独立 Lane ${lane.id}。`,
    `Run ID：${runId}；Finding：${lane.finding_id}；漏洞类型：${lane.vulnerability_class}。`,
    `目标：${campaign.target.name} ${campaign.target.version}；源码：${campaign.target.source}；深度：${campaign.budget.depth}。`,
    '先调用 omv_campaign_run_inspect 与 omv_finding_inspect，只处理当前 Lane；沿 source → sink → guard 建立行级证据，必要时使用 omv_repro_run_start / omv_repro_run_finish 记录复现。',
    '每次修改 Evidence 后调用 omv_finding_validate，并调用 omv_quality_gate 检查报告门禁。',
    `结束前必须调用 omv_campaign_lane_update，参数 runId=${runId}、laneId=${lane.id}，明确 completed、blocked、failed 或 awaiting_evidence，并写入简短总结。`,
  ].join('\n')
}

function dispatchOf(run: CampaignRun, lane: CampaignRun['lanes'][number]): CampaignLaneDispatch {
  return {
    runId: run.id,
    campaignId: run.campaignId,
    parentSessionId: run.parentSessionId,
    laneId: lane.laneId,
    findingId: lane.findingId,
    title: lane.title,
    prompt: lane.prompt,
    attempt: lane.attempts,
  }
}

function updateRunStatus(run: CampaignRun, now: string): void {
  const terminal = run.lanes.every(lane => lane.status === 'completed' || lane.status === 'blocked' || lane.status === 'failed' || lane.status === 'cancelled')
  if (terminal) {
    run.status = run.lanes.some(lane => lane.status === 'failed')
      ? 'failed'
      : run.lanes.some(lane => lane.status === 'cancelled')
        ? 'cancelled'
        : run.lanes.some(lane => lane.status === 'blocked')
          ? 'needs_attention'
          : 'completed'
    run.finishedAt = now
  } else if (run.status !== 'paused') {
    run.status = run.lanes.some(lane => lane.status === 'running' || lane.status === 'dispatching') ? 'running' : 'queued'
    delete run.finishedAt
  }
  run.updatedAt = now
}

function retryable(lane: CampaignRun['lanes'][number]): boolean {
  return lane.status === 'failed' || lane.status === 'blocked' || lane.status === 'cancelled' || lane.status === 'awaiting_evidence'
}

function requireRun(store: CampaignRunStore, runId: string): CampaignRun {
  const id = required(runId, 'run id')
  const run = store.runs[id]
  if (run === undefined) throw new Error(`campaign run not found: ${id}`)
  return run
}

function requireLane(run: CampaignRun, laneId: string): CampaignRun['lanes'][number] {
  const id = required(laneId, 'lane id')
  const lane = run.lanes.find(item => item.laneId === id)
  if (lane === undefined) throw new Error(`campaign lane not found: ${run.id}/${id}`)
  return lane
}

function boundedConcurrency(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > MAX_CONCURRENCY) throw new Error(`concurrency must be an integer between 1 and ${MAX_CONCURRENCY}`)
  return value
}

function compactTime(value: string): string {
  return value.replace(/[-:TZ.]/gu, '').slice(0, 14)
}

function required(value: string, name: string): string {
  const normalized = value.trim()
  if (normalized === '') throw new Error(`${name} is required`)
  return normalized
}

function isStore(value: unknown): value is CampaignRunStore {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return record.schemaVersion === STORE_VERSION && typeof record.updatedAt === 'string' && record.runs !== null && typeof record.runs === 'object' && !Array.isArray(record.runs)
}

function isNotFound(error: unknown): boolean {
  return error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT'
}
