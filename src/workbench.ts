import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  EVIDENCE_ECOSYSTEMS,
  archiveFinding,
  createFindingTemplate,
  doctorFinding,
  initCampaign,
  initReproArtifacts,
  initWorkspace,
  listArchivedFindings,
  listFindingWorkflow,
  promoteFinding,
  readWorkspaceActivity,
  restoreFinding,
  reviewFinding,
  seedCampaign,
  showCampaign,
  showFinding,
  validateFinding,
  workspaceStatus,
  type CampaignDepth,
  type CampaignLocalReproduction,
  type CampaignMode,
  type CampaignOutput,
  type EvidenceEcosystem,
  type EvidenceResearcherGoal,
  type EvidenceStatus,
} from 'oh-my-vul'
import { parse as parseYaml, parseDocument } from 'yaml'
import type {
  ActionRequest,
  CampaignDispatch,
  CampaignPayload,
  DashboardPayload,
  FindingPayload,
  WorkbenchFindingSummary,
  OmvWorkbenchConfig,
  RadarPayload,
  SearchHit,
  WorkspaceExportPayload,
  WorkspaceChangeEvent,
  WorkspaceIssue,
  CampaignIssue,
  WorkspaceQualityIssue,
  WorkspaceQualityPayload,
  ReviewQueueItem,
  ReportQueueItem,
  ReviewRecord,
  DedupSummary,
  ReportPack,
  ReviewStatus,
  DedupStatus,
  DisclosurePlan,
  WorkflowIntent,
  HealthCheck,
  HealthPayload,
} from './contracts.js'
import { WORKBENCH_PROTOCOL_VERSION } from './contracts.js'
import { OmvWorkflowService, deriveAuditStage } from './workflow.js'
import { OmvWorkspaceWatcher } from './watch.js'
import { radarQueueItem, readRadar, refreshRadar, updateRadarQueue } from './radar.js'
import { CampaignRunner, type LaneEvidenceState } from './runner.js'
import { ReproductionService } from './reproduction.js'
import { buildEvidenceGraph, evaluateQualityGate } from './evidence-graph.js'

import { inspectCampaigns, normalizeCampaignEcosystem, repairCampaign } from './campaigns.js'
import { CollaborationService } from './collaboration.js'
import { DedupService, type DedupCandidate } from './dedup.js'
import { ReportingService } from './reporting.js'
import { assessEvidence } from './assessment.js'
import { buildWorkspaceQuality, evidenceQueueRank, readFindingWorkflowsSafe, reportQueueItem, reportQueueRank, reviewQueueItem, reviewQueueRank } from './workbench/quality.js'

const MUTATIONS = new Set([
  'workspace.init',
  'finding.create',
  'finding.repro',
  'finding.promote',
  'finding.archive',
  'finding.restore',
  'campaign.create',
  'campaign.repair',
  'campaign.seed',
  'campaign.start',
  'campaign.run.create',
  'campaign.run.claim',
  'campaign.run.bind',
  'campaign.run.lane.update',
  'campaign.run.control',
  'campaign.run.reconcile',
  'radar.refresh',
  'radar.queue.update',
  'radar.queue.convert',
  'repro.run.start',
  'repro.run.finish',
  'session.link',
  'session.unlink',
  'workflow.start',
  'review.update',
  'review.note.add',
  'dedup.scan',
  'dedup.update',
  'report.prepare',
  'disclosure.schedule',
])

export class OmvWorkbench {
  readonly config: OmvWorkbenchConfig
  readonly workflow: OmvWorkflowService
  readonly runner: CampaignRunner
  readonly reproduction: ReproductionService
  readonly collaboration: CollaborationService
  readonly dedup: DedupService
  readonly reporting: ReportingService
  private readonly watcher: OmvWorkspaceWatcher

  constructor(config: OmvWorkbenchConfig) {
    this.config = { ...config, projectRoot: resolve(config.projectRoot) }
    this.workflow = new OmvWorkflowService(this.config.projectRoot)
    this.runner = new CampaignRunner(this.config.projectRoot)
    this.reproduction = new ReproductionService(this.config.projectRoot)
    this.collaboration = new CollaborationService(this.config.projectRoot)
    this.dedup = new DedupService(this.config.projectRoot)
    this.reporting = new ReportingService(this.config.projectRoot)
    this.watcher = new OmvWorkspaceWatcher(this.config.projectRoot, this.config.watchDebounceMs)
  }

  /**
   * Bind the same OMV capability set to another DSH workspace. This keeps
   * tools and commands session-native instead of pinning every conversation
   * to the plugin's configured landing workspace.
   */
  scoped(projectRoot: string): OmvWorkbench {
    const root = resolve(projectRoot)
    if (root === this.config.projectRoot) return this
    return new OmvWorkbench({ ...this.config, projectRoot: root })
  }

  async dashboard(): Promise<DashboardPayload> {
    const workspace = await workspaceStatus(this.config.projectRoot)
    const [{ findings: rawFindings, issues: workspaceIssues }, archived, campaignInspection, rawActivity, links, campaignRuns, reproductionRuns] = await Promise.all([
      readFindingWorkflowsSafe(this.config.projectRoot, workspace.findingsDir),
      listArchivedFindings(this.config.projectRoot),
      inspectCampaigns(this.config.projectRoot),
      readWorkspaceActivity(this.config.projectRoot),
      this.workflow.links(),
      this.runner.list(),
      this.reproduction.list(),
    ])
    const { campaigns, issues: campaignIssues } = campaignInspection
    const findings = await Promise.all(rawFindings.map(async finding => {
      const [evidence, validation] = await Promise.all([
        this.readEvidence(finding.path),
        validateFinding(finding.id, this.config.projectRoot),
      ])
      const sessionLink = links[finding.id]
      const findingReproductions = reproductionRuns.filter(run => run.findingId === finding.id)
      const detail = { ...finding, archived: false, validation }
      const assessment = assessEvidence(detail, evidence, findingReproductions)
      return {
        ...finding,
        stage: deriveAuditStage(detail, evidence),
        assessment,
        ...(sessionLink === undefined ? {} : { sessionLink }),
      }
    }))
    findings.sort((left, right) => evidenceQueueRank(left) - evidenceQueueRank(right) || right.assessment.openQuestions.length - left.assessment.openQuestions.length || left.id.localeCompare(right.id))
    const totalReadiness = findings.reduce((sum, finding) => sum + finding.readiness, 0)
    const averageReadiness = findings.length === 0 ? 0 : Math.round(totalReadiness / findings.length)
    const activity = rawActivity.slice(-this.config.activityLimit).reverse()
    const [reviewRecords, dedupSummaries, reportPacks, disclosures] = await Promise.all([
      this.collaboration.list(),
      this.dedup.list(),
      Promise.all(findings.map(finding => this.reporting.inspect(finding.id))),
      this.reporting.disclosureList(),
    ])
    const reviewByFinding = new Map(reviewRecords.map(record => [record.findingId, record]))
    const dedupByFinding = new Map(dedupSummaries.map(summary => [summary.findingId, summary]))
    const reportQueue = reportPacks.map((pack, index) => reportQueueItem(pack, findings[index]!)).sort((left, right) => reportQueueRank(left) - reportQueueRank(right))
    const reviews = findings.map(finding => reviewQueueItem(finding.id, reviewByFinding.get(finding.id))).sort((left, right) => reviewQueueRank(left) - reviewQueueRank(right))
    const quality = buildWorkspaceQuality({ workspaceIssues, campaignIssues, findings, reports: reportQueue, reviews, dedup: dedupByFinding })

    return {
      protocolVersion: WORKBENCH_PROTOCOL_VERSION,
      generatedAt: new Date().toISOString(),
      workspace,
      config: this.config,
      metrics: {
        active: findings.length,
        confirmed: findings.filter(finding => finding.status === 'confirmed').length,
        candidates: findings.filter(finding => finding.status === 'candidate').length,
        blocked: findings.filter(finding => finding.status === 'blocked').length,
        archived: archived.length,
        campaigns: campaigns.length,
        averageReadiness,
        reportReady: findings.filter(finding => finding.stage === 'report_ready').length,
        investigating: findings.filter(finding => finding.stage === 'investigating').length,
        reproducing: findings.filter(finding => finding.stage === 'reproducing').length,
        disclosed: findings.filter(finding => finding.stage === 'disclosed').length,
        activeRuns: campaignRuns.filter(run => run.status === 'queued' || run.status === 'running' || run.status === 'paused').length,
        activeReproductions: reproductionRuns.filter(run => run.status === 'running' || run.status === 'planned').length,
        evidenceMaturity: {
          unmapped: findings.filter(finding => finding.assessment.maturity === 'unmapped').length,
          developing: findings.filter(finding => finding.assessment.maturity === 'developing').length,
          supported: findings.filter(finding => finding.assessment.maturity === 'supported').length,
          verified: findings.filter(finding => finding.assessment.maturity === 'verified').length,
          contested: findings.filter(finding => finding.assessment.maturity === 'contested').length,
        },
      },
      findings,
      workspaceIssues,
      archived,
      campaigns,
      campaignIssues,
      activity,
      quality,
      reviews,
      reports: reportQueue,
      disclosures,
      reproductionRuns,
    }
  }

  async health(): Promise<HealthPayload> {
    const checks = await Promise.all([
      this.healthCheck('workspace', () => workspaceStatus(this.config.projectRoot)),
      this.healthCheck('findings', async () => {
        await listFindingWorkflow(this.config.projectRoot)
        await listArchivedFindings(this.config.projectRoot)
      }),
      this.healthCheck('campaigns', async () => {
        const inspection = await inspectCampaigns(this.config.projectRoot)
        if (inspection.issues.length > 0) throw new Error(`${inspection.issues.length} Campaign 配置需要处理`)
      }),
      this.healthCheck('workflow', () => this.workflow.links()),
      this.healthCheck('runner', () => this.runner.list()),
      this.healthCheck('reproduction', () => this.reproduction.list()),
    ])
    return {
      protocolVersion: WORKBENCH_PROTOCOL_VERSION,
      generatedAt: new Date().toISOString(),
      status: checks.some(check => check.status === 'degraded') ? 'degraded' : 'ok',
      projectRoot: this.config.projectRoot,
      checks,
    }
  }

  async finding(id: string, archived = false): Promise<FindingPayload> {
    const detail = await showFinding(id, this.config.projectRoot, { archived })
    const raw = await readFile(detail.path, 'utf8')
    const parsed = parseYaml(raw)
    const evidence = isRecord(parsed) ? parsed : {}
    const [links, history, reproductionRuns, collaboration, dedup, reportPack, disclosures] = await Promise.all([
      this.workflow.links(),
      this.workflow.history(detail.id),
      this.reproduction.list(detail.id),
      this.collaboration.get(detail.id),
      this.dedup.get(detail.id),
      this.reporting.inspect(detail.id),
      this.reporting.disclosureList(detail.id),
    ])
    const sessionLink = links[detail.id]
    const lastDiff = history.find(event => event.diff !== undefined)?.diff
    if (archived) {
      const assessment = assessEvidence(detail, evidence, reproductionRuns)
      const qualityGate = evaluateQualityGate(detail, evidence, reproductionRuns)
      return {
        protocolVersion: WORKBENCH_PROTOCOL_VERSION,
        generatedAt: new Date().toISOString(),
        detail,
        evidence,
        rawEvidence: raw,
        stage: 'archived',
        history,
        reproductionRuns,
        assessment,
        qualityGate,
        graph: buildEvidenceGraph({ detail, evidence, rawEvidence: raw, history, reproductionRuns }),
        dedup,
        collaboration,
        reportPack,
        disclosures,
        ...(sessionLink === undefined ? {} : { sessionLink }),
        ...(lastDiff === undefined ? {} : { lastDiff }),
      }
    }
    const [doctor, review] = await Promise.all([
      doctorFinding(id, this.config.projectRoot),
      reviewFinding(id, this.config.projectRoot),
    ])
    const assessment = assessEvidence(detail, evidence, reproductionRuns)
    const qualityGate = evaluateQualityGate(detail, evidence, reproductionRuns)
    return {
      protocolVersion: WORKBENCH_PROTOCOL_VERSION,
      generatedAt: new Date().toISOString(),
      detail,
      evidence,
      rawEvidence: raw,
      stage: deriveAuditStage(detail, evidence, review),
      history,
      doctor,
      review,
      reproductionRuns,
      assessment,
      qualityGate,
      graph: buildEvidenceGraph({ detail, evidence, rawEvidence: raw, history, reproductionRuns }),
      dedup,
      collaboration,
      reportPack,
      disclosures,
      ...(sessionLink === undefined ? {} : { sessionLink }),
      ...(lastDiff === undefined ? {} : { lastDiff }),
    }
  }

  async campaign(id: string): Promise<CampaignPayload> {
    const detail = await showCampaign(id, this.config.projectRoot)
    const subject = `campaign:${detail.campaign.id}`
    const [links, history, runs] = await Promise.all([this.workflow.links(), this.workflow.history(subject), this.runner.list(detail.campaign.id)])
    const sessionLink = links[subject]
    return {
      ...detail,
      protocolVersion: WORKBENCH_PROTOCOL_VERSION,
      generatedAt: new Date().toISOString(),
      history,
      runs,
      ...(sessionLink === undefined ? {} : { sessionLink }),
    }
  }

  async campaignRun(id: string) {
    return this.runner.get(id)
  }

  async radar(): Promise<RadarPayload> {
    return readRadar(this.config.projectRoot)
  }

  async quality(): Promise<WorkspaceQualityPayload> {
    return (await this.dashboard()).quality
  }

  async review(findingId: string): Promise<ReviewRecord> {
    await showFinding(findingId, this.config.projectRoot)
    return this.collaboration.get(findingId)
  }

  async dedupSummary(findingId: string): Promise<DedupSummary> {
    await showFinding(findingId, this.config.projectRoot)
    return this.dedup.get(findingId)
  }

  async reportPack(findingId: string): Promise<ReportPack> {
    await showFinding(findingId, this.config.projectRoot)
    return this.reporting.inspect(findingId)
  }

  async disclosures(findingId?: string): Promise<DisclosurePlan[]> {
    return this.reporting.disclosureList(findingId)
  }

  async search(query: string): Promise<SearchHit[]> {
    const needle = query.trim().toLowerCase()
    if (needle === '') return []
    const [dashboard, radar] = await Promise.all([this.dashboard(), this.radar()])
    const hits: SearchHit[] = []
    for (const finding of dashboard.findings) {
      const rawEvidence = await readFile(finding.path, 'utf8')
      const haystack = `${finding.id} ${finding.package} ${finding.ecosystem} ${finding.vulnerability} ${finding.nextAction} ${rawEvidence}`.toLowerCase()
      if (haystack.includes(needle)) hits.push({ kind: 'finding', id: finding.id, title: `${finding.id} · ${finding.package}`, description: `${finding.stage} · ${finding.vulnerability}`, score: searchScore(haystack, needle) })
    }
    for (const finding of dashboard.archived) {
      const haystack = `${finding.id} ${finding.package} ${finding.ecosystem} ${finding.vulnerability} ${finding.archiveReason}`.toLowerCase()
      if (haystack.includes(needle)) hits.push({ kind: 'finding', id: finding.id, title: `${finding.id} · ${finding.package}`, description: `archived · ${finding.archiveReason}`, score: searchScore(haystack, needle), archived: true })
    }
    for (const campaign of dashboard.campaigns) {
      const haystack = `${campaign.id} ${campaign.title} ${campaign.target} ${campaign.version} ${campaign.nextAction}`.toLowerCase()
      if (haystack.includes(needle)) hits.push({ kind: 'campaign', id: campaign.id, title: campaign.title, description: `${campaign.target} · ${campaign.laneCount} lanes`, score: searchScore(haystack, needle) })
    }
    dashboard.activity.forEach((entry, index) => {
      const haystack = JSON.stringify(entry).toLowerCase()
      if (haystack.includes(needle)) hits.push({ kind: 'activity', id: `${entry.timestamp}-${index}`, title: entry.action, description: `${entry.id ?? ''} · ${entry.timestamp}`, score: searchScore(haystack, needle) })
    })
    radar.events.forEach(event => {
      const haystack = `${event.id} ${event.ecosystem} ${event.package ?? ''} ${event.keyword ?? ''} ${event.title} ${event.severity ?? ''}`.toLowerCase()
      if (haystack.includes(needle)) hits.push({ kind: 'radar', id: event.id, title: event.title, description: `${event.ecosystem} · ${event.source}`, score: searchScore(haystack, needle) })
    })
    return hits.sort((left, right) => right.score - left.score || left.title.localeCompare(right.title)).slice(0, 80)
  }

  async exportWorkspace(): Promise<WorkspaceExportPayload> {
    const dashboard = await this.dashboard()
    const [findings, campaigns, radar, campaignRuns, reproductionRuns] = await Promise.all([
      Promise.all([
        ...dashboard.findings.map(finding => this.finding(finding.id)),
        ...dashboard.archived.map(finding => this.finding(finding.id, true)),
      ]),
      Promise.all(dashboard.campaigns.map(campaign => this.campaign(campaign.id))),
      this.radar(),
      this.runner.list(),
      this.reproduction.list(),
    ])
    return {
      protocolVersion: WORKBENCH_PROTOCOL_VERSION,
      exportedAt: new Date().toISOString(),
      projectRoot: this.config.projectRoot,
      dashboard,
      findings,
      campaigns,
      radar,
      campaignRuns,
      reproductionRuns,
    }
  }

  async action(request: ActionRequest): Promise<unknown> {
    if (!request.action) throw new Error('action is required')
    if (MUTATIONS.has(request.action) && !this.config.allowMutations) {
      throw new Error('workspace mutations are disabled by plugin configuration')
    }
    const before = request.id === undefined ? undefined : await this.tryReadFinding(request.id)
    let result: unknown
    switch (request.action) {
      case 'workspace.init':
        return initWorkspace(this.config.projectRoot, { gitignore: true })
      case 'finding.create': {
        const id = requiredString(request.id, 'id')
        const seed = completeSeed(request)
        result = await createFindingTemplate(id, {
          projectRoot: this.config.projectRoot,
          ...(seed === undefined ? {} : { seed }),
        })
        break
      }
      case 'finding.validate':
        return validateFinding(requiredString(request.id, 'id'), this.config.projectRoot)
      case 'finding.doctor':
        return doctorFinding(requiredString(request.id, 'id'), this.config.projectRoot)
      case 'workspace.quality':
        return this.quality()
      case 'finding.dedup':
        return this.dedupSummary(requiredString(request.id, 'id'))
      case 'report.inspect':
        return this.reportPack(requiredString(request.id, 'id'))
      case 'review.inspect':
        return this.review(requiredString(request.id, 'id'))
      case 'finding.repro':
        result = await initReproArtifacts(requiredString(request.id, 'id'), this.config.projectRoot)
        break
      case 'finding.promote':
        result = await promoteFinding(
          requiredString(request.id, 'id'),
          requiredStatus(request.status),
          this.config.projectRoot,
        )
        break
      case 'finding.archive':
        result = await archiveFinding(
          requiredString(request.id, 'id'),
          requiredString(request.reason, 'reason'),
          this.config.projectRoot,
        )
        break
      case 'finding.restore':
        result = await restoreFinding(requiredString(request.id, 'id'), this.config.projectRoot)
        break
      case 'campaign.create':
        return initCampaign({
          ...(request.id === undefined ? {} : { id: request.id }),
          target: requiredString(request.target, 'target'),
          version: request.version ?? 'unknown',
          source: request.source ?? 'unknown',
          ecosystem: normalizeCampaignEcosystem(request.ecosystem),
          mode: (request.mode ?? 'passive') as CampaignMode,
          output: (request.output ?? 'research-notes') as CampaignOutput,
          depth: (request.depth ?? 'standard') as CampaignDepth,
          localReproduction: (request.localReproduction ?? 'unknown') as CampaignLocalReproduction,
          vulnerabilities: request.vulnerabilities ?? [],
        }, { projectRoot: this.config.projectRoot })
      case 'campaign.repair':
        return repairCampaign(requiredString(request.id, 'id'), this.config.projectRoot)
      case 'campaign.seed':
        return seedCampaign(requiredString(request.id, 'id'), this.config.projectRoot)
      case 'campaign.start': {
        const detail = await showCampaign(requiredString(request.id, 'id'), this.config.projectRoot)
        const sessionId = requiredString(request.sessionId, 'sessionId')
        const subject = `campaign:${detail.campaign.id}`
        const linked = await this.workflow.linkFinding(subject, sessionId)
        await this.workflow.record({ findingId: subject, action: 'campaign.start', sessionId })
        return {
          campaignId: detail.campaign.id,
          sessionId,
          laneCount: detail.campaign.lanes.length,
          linked,
          prompt: campaignPrompt(detail),
        } satisfies CampaignDispatch
      }
      case 'campaign.run.create': {
        const detail = await showCampaign(requiredString(request.id, 'id'), this.config.projectRoot)
        const sessionId = requiredString(request.sessionId, 'sessionId')
        const run = await this.runner.create(detail.campaign, sessionId, request.concurrency ?? this.config.campaignConcurrency)
        await this.workflow.linkFinding(`campaign:${detail.campaign.id}`, sessionId)
        await this.workflow.record({ findingId: `campaign:${detail.campaign.id}`, action: 'campaign.run.create', sessionId })
        return run
      }
      case 'campaign.run.claim':
        return this.runner.claim(requiredString(request.runId, 'runId'))
      case 'campaign.run.bind':
        return this.runner.bind(requiredString(request.runId, 'runId'), requiredString(request.laneId, 'laneId'), requiredString(request.sessionId, 'sessionId'))
      case 'campaign.run.lane.update':
        return this.runner.updateLane({
          runId: requiredString(request.runId, 'runId'),
          laneId: requiredString(request.laneId, 'laneId'),
          status: requiredLaneUpdateStatus(request.laneStatus),
          ...(request.sessionId === undefined ? {} : { sessionId: request.sessionId }),
          ...(request.summary === undefined ? {} : { summary: request.summary }),
        })
      case 'campaign.run.control':
        return this.runner.control(requiredString(request.runId, 'runId'), requiredRunControl(request.control), request.laneId)
      case 'campaign.run.reconcile': {
        const run = await this.runner.get(requiredString(request.runId, 'runId'))
        return this.runner.reconcile(run.id, await this.laneEvidenceStates(run.lanes.map(lane => lane.findingId)))
      }
      case 'radar.refresh':
        return refreshRadar(this.config.projectRoot)
      case 'radar.queue.update':
        return updateRadarQueue(this.config.projectRoot, requiredString(request.id, 'id'), requiredRadarStatus(request.radarStatus))
      case 'radar.queue.convert': {
        const queue = await radarQueueItem(this.config.projectRoot, requiredString(request.id, 'id'))
        const radar = await this.radar()
        const event = radar.events.find(item => item.id === queue.eventId)
        if (event === undefined) throw new Error(`radar event not found: ${queue.eventId}`)
        const findingId = request.findingId?.trim() || radarFindingId(event)
        const created = await createFindingTemplate(findingId, {
          projectRoot: this.config.projectRoot,
          seed: {
            researcherGoal: 'triage',
            product: event.package ?? event.keyword ?? event.title,
            ecosystem: radarEvidenceEcosystem(event.ecosystem),
            vulnerabilityClass: event.type === 'watchlist' ? 'security-change' : event.type,
          },
        })
        await updateRadarQueue(this.config.projectRoot, queue.id, 'candidate', findingId)
        return { queueId: queue.id, event, findingId, created }
      }
      case 'repro.run.start': {
        const id = requiredString(request.id, 'id')
        await showFinding(id, this.config.projectRoot)
        await initReproArtifacts(id, this.config.projectRoot)
        const run = await this.reproduction.start({
          findingId: id,
          ...(request.sessionId === undefined ? {} : { sessionId: request.sessionId }),
          ...(request.command === undefined ? {} : { command: request.command }),
          ...(request.environment === undefined ? {} : { environment: request.environment }),
          ...(request.artifacts === undefined ? {} : { artifacts: request.artifacts }),
        })
        await this.workflow.record({ findingId: id, action: 'repro.run.start', ...(request.sessionId === undefined ? {} : { sessionId: request.sessionId }) })
        return run
      }
      case 'repro.run.finish': {
        const run = await this.reproduction.finish({
          runId: requiredString(request.runId, 'runId'),
          status: requiredReproFinishStatus(request.reproStatus),
          ...(request.sessionId === undefined ? {} : { sessionId: request.sessionId }),
          ...(request.exitCode === undefined ? {} : { exitCode: request.exitCode }),
          ...(request.outputText === undefined ? {} : { output: request.outputText }),
          ...(request.artifacts === undefined ? {} : { artifacts: request.artifacts }),
        })
        const evidenceChange = run.status === 'passed' ? await this.writeReproductionEvidence(run.findingId, run.output, run.artifacts) : undefined
        await this.workflow.record({
          findingId: run.findingId, action: `repro.run.${run.status}`,
          ...(request.sessionId === undefined ? {} : { sessionId: request.sessionId }),
          ...(evidenceChange === undefined ? {} : evidenceChange),
        })
        return run
      }
      case 'session.link': {
        const id = requiredString(request.id, 'id')
        await showFinding(id, this.config.projectRoot)
        return this.workflow.linkFinding(id, requiredString(request.sessionId, 'sessionId'), request.intent)
      }
      case 'session.unlink':
        return { removed: await this.workflow.unlinkFinding(requiredString(request.id, 'id')) }
      case 'workflow.start': {
        const id = requiredString(request.id, 'id')
        const intent = requiredIntent(request.intent)
        const payload = await this.finding(id)
        return this.workflow.start(payload.detail, payload.evidence, intent, requiredString(request.sessionId, 'sessionId'))
      }
      case 'review.update': {
        const id = requiredString(request.id, 'id')
        await showFinding(id, this.config.projectRoot)
        result = await this.collaboration.update({
          findingId: id,
          ...(request.reviewStatus === undefined ? {} : { status: request.reviewStatus }),
          ...(request.assignee === undefined ? {} : { assignee: request.assignee }),
          ...(request.sessionId === undefined ? {} : { reviewer: request.sessionId }),
        })
        break
      }
      case 'review.note.add': {
        const id = requiredString(request.id, 'id')
        await showFinding(id, this.config.projectRoot)
        result = await this.collaboration.addNote({ findingId: id, author: request.author ?? request.sessionId ?? 'dsh-reviewer', body: requiredString(request.body, 'body') })
        break
      }
      case 'dedup.scan': {
        const id = requiredString(request.id, 'id')
        const dashboard = await this.dashboard()
        const candidates: DedupCandidate[] = dashboard.findings.map(finding => ({ id: finding.id, package: finding.package, ecosystem: finding.ecosystem, vulnerability: finding.vulnerability, path: finding.path }))
        const radar = await this.radar()
        result = await this.dedup.scan(id, candidates, radar.events.map(event => event.title))
        break
      }
      case 'dedup.update': {
        result = await this.dedup.update(requiredString(request.id, 'id'), requiredDedupStatus(request.dedupStatus), request.matchId)
        break
      }
      case 'report.prepare': {
        const id = requiredString(request.id, 'id')
        result = await this.reporting.prepare(id)
        break
      }
      case 'disclosure.schedule': {
        const id = requiredString(request.id, 'id')
        await showFinding(id, this.config.projectRoot)
        result = await this.reporting.schedule({
          findingId: id,
          channel: request.disclosureChannel ?? 'internal',
          dueAt: requiredString(request.disclosureDate, 'disclosureDate'),
          ...(request.target === undefined ? {} : { recipient: request.target }),
          ...(request.body === undefined ? {} : { notes: request.body }),
        })
        break
      }
      default:
        throw new Error(`unknown action: ${String(request.action)}`)
    }
    const id = requiredString(request.id, 'id')
    const after = await this.tryReadFinding(id)
    await this.workflow.record({
      findingId: id,
      action: request.action,
      ...(request.sessionId === undefined ? {} : { sessionId: request.sessionId }),
      ...(before === undefined ? {} : { before }),
      ...(after === undefined ? {} : { after }),
    })
    return result
  }

  subscribe(listener: (event: WorkspaceChangeEvent) => void): () => void {
    return this.watcher.subscribe(listener)
  }

  close(): void {
    this.watcher.close()
  }

  private async healthCheck(name: HealthCheck['name'], operation: () => Promise<unknown>): Promise<HealthCheck> {
    try {
      await operation()
      return { name, status: 'ok' }
    } catch (error) {
      return { name, status: 'degraded', detail: error instanceof Error ? error.message : String(error) }
    }
  }

  private async readEvidence(path: string): Promise<Record<string, unknown>> {
    const parsed = parseYaml(await readFile(path, 'utf8'))
    return isRecord(parsed) ? parsed : {}
  }

  private async tryReadFinding(id: string): Promise<string | undefined> {
    try {
      return await readFile((await showFinding(id, this.config.projectRoot)).path, 'utf8')
    } catch {
      try {
        return await readFile((await showFinding(id, this.config.projectRoot, { archived: true })).path, 'utf8')
      } catch {
        return undefined
      }
    }
  }

  private async laneEvidenceStates(findingIds: readonly string[]): Promise<LaneEvidenceState[]> {
    const states = await Promise.all(findingIds.map(async findingId => {
      try {
        const finding = await this.finding(findingId)
        return { findingId, stage: finding.stage, maturity: finding.assessment.maturity } satisfies LaneEvidenceState
      } catch { return undefined }
    }))
    return states.filter((state): state is LaneEvidenceState => state !== undefined)
  }

  private async writeReproductionEvidence(findingId: string, output: string | undefined, artifacts: readonly string[]): Promise<{ before: string; after: string } | undefined> {
    if ((output === undefined || output.trim() === '') && artifacts.length === 0) return undefined
    const detail = await showFinding(findingId, this.config.projectRoot)
    const before = await readFile(detail.path, 'utf8')
    const document = parseDocument(before)
    if (document.errors.length > 0) throw new Error(`cannot update invalid Evidence YAML: ${document.errors[0]?.message ?? detail.path}`)
    if (output !== undefined && output.trim() !== '') document.setIn(['evidence', 'observed_result'], output.trim())
    if (artifacts.length > 0) {
      const existing = document.getIn(['evidence', 'repro_artifacts'])
      const values = Array.isArray(existing) ? existing.filter((value): value is string => typeof value === 'string') : []
      document.setIn(['evidence', 'repro_artifacts'], [...new Set([...values, ...artifacts])])
    }
    const after = document.toString()
    if (after === before) return undefined
    await writeFile(detail.path, after, 'utf8')
    return { before, after }
  }
}

function campaignPrompt(detail: Awaited<ReturnType<typeof showCampaign>>): string {
  const lanes = detail.campaign.lanes.map(lane => `- ${lane.id}: ${lane.vulnerability_class} → ${lane.finding_id}`).join('\n')
  return [
    `执行 OMV Campaign ${detail.campaign.id}（${detail.campaign.title}）。`,
    `目标：${detail.campaign.target.name} ${detail.campaign.target.version}；深度：${detail.campaign.budget.depth}。`,
    '先读取 Campaign YAML 与 runbook，并调用 omv_workspace_overview。按 lane 并行委派 DSH 子 Agent；每个子任务只负责一条 lane，输出 Evidence.v1 候选及 source → sink → guard 证据。',
    '汇总时逐条调用 omv_finding_validate；失败 lane 要记录阻塞原因与重试建议，不得用其他 lane 的结论代替。',
    `Lanes:\n${lanes}`,
  ].join('\n')
}

function searchScore(haystack: string, needle: string): number {
  if (haystack.startsWith(needle)) return 100
  const words = haystack.split(/\s+/u)
  if (words.some(word => word.startsWith(needle))) return 70
  return 40
}

function requiredString(value: string | undefined, name: string): string {
  const normalized = value?.trim()
  if (!normalized) throw new Error(`${name} is required`)
  return normalized
}

function requiredStatus(value: ActionRequest['status']): EvidenceStatus {
  if (value !== 'candidate' && value !== 'confirmed' && value !== 'blocked') {
    throw new Error('status must be candidate, confirmed, or blocked')
  }
  return value
}

function requiredIntent(value: WorkflowIntent | undefined): WorkflowIntent {
  if (value === 'audit' || value === 'repro' || value === 'dedup' || value === 'critic' || value === 'report' || value === 'disclose') return value
  throw new Error('intent must be audit, repro, dedup, critic, report, or disclose')
}

function requiredLaneUpdateStatus(value: ActionRequest['laneStatus']): 'completed' | 'failed' | 'blocked' | 'awaiting_evidence' {
  if (value === 'completed' || value === 'failed' || value === 'blocked' || value === 'awaiting_evidence') return value
  throw new Error('laneStatus must be completed, failed, blocked, or awaiting_evidence')
}

function requiredRunControl(value: ActionRequest['control']): 'pause' | 'resume' | 'cancel' | 'retry' {
  if (value === 'pause' || value === 'resume' || value === 'cancel' || value === 'retry') return value
  throw new Error('control must be pause, resume, cancel, or retry')
}

function requiredReproFinishStatus(value: ActionRequest['reproStatus']): 'passed' | 'failed' | 'blocked' {
  if (value === 'passed' || value === 'failed' || value === 'blocked') return value
  throw new Error('reproStatus must be passed, failed, or blocked')
}

function requiredRadarStatus(value: ActionRequest['radarStatus']): 'new' | 'reviewing' | 'candidate' | 'ignored' {
  if (value === 'new' || value === 'reviewing' || value === 'candidate' || value === 'ignored') return value
  throw new Error('radarStatus must be new, reviewing, candidate, or ignored')
}

function requiredDedupStatus(value: ActionRequest['dedupStatus']): DedupStatus {
  if (value === 'unknown' || value === 'clear' || value === 'possible_duplicate' || value === 'duplicate' || value === 'not_applicable') return value
  throw new Error('dedupStatus must be unknown, clear, possible_duplicate, duplicate, or not_applicable')
}

function radarFindingId(event: { ecosystem: string; package?: string; keyword?: string; id: string }): string {
  const raw = `radar-${event.ecosystem}-${event.package ?? event.keyword ?? event.id}`.toLowerCase()
  return raw.replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '').slice(0, 72)
}

function radarEvidenceEcosystem(value: string): EvidenceEcosystem {
  const normalized = value.toLowerCase()
  if (!(EVIDENCE_ECOSYSTEMS as readonly string[]).includes(normalized)) throw new Error(`Radar event ecosystem is not supported by Evidence.v1: ${value}`)
  return normalized as EvidenceEcosystem
}

function completeSeed(request: ActionRequest): {
  researcherGoal: EvidenceResearcherGoal
  product: string
  ecosystem: EvidenceEcosystem
  vulnerabilityClass: string
} | undefined {
  const present = [request.researcherGoal, request.product, request.ecosystem, request.vulnerabilityClass]
  if (present.every(value => value === undefined || value === '')) return undefined
  const ecosystem = requiredString(request.ecosystem, 'ecosystem')
  if (!(EVIDENCE_ECOSYSTEMS as readonly string[]).includes(ecosystem)) {
    throw new Error(`ecosystem must be one of: ${EVIDENCE_ECOSYSTEMS.join(', ')}`)
  }
  return {
    researcherGoal: (request.researcherGoal ?? 'triage') as EvidenceResearcherGoal,
    product: requiredString(request.product, 'product'),
    ecosystem: ecosystem as EvidenceEcosystem,
    vulnerabilityClass: requiredString(request.vulnerabilityClass, 'vulnerabilityClass'),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
