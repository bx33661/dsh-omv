import type {
  ArchivedFindingSummary,
  CampaignSummary,
  ShowCampaignResult,
  FindingDetail,
  FindingDoctorResult,
  FindingReview,
  FindingWorkflowSummary,
  WorkspaceActivityEntry,
  WorkspaceStatus,
} from 'oh-my-vul'

export const WORKBENCH_PROTOCOL_VERSION = '2' as const
export const WORKBENCH_COMPATIBLE_PROTOCOL_VERSIONS = ['1', '2'] as const

export interface OmvWorkbenchConfig {
  apiPrefix: string
  projectRoot: string
  allowMutations: boolean
  allowRemoteAccess: boolean
  activityLimit: number
  refreshIntervalMs: number
  campaignConcurrency: number
  /** Debounce window for the workspace event stream. */
  watchDebounceMs: number
  /** Heartbeat cadence for long-lived workspace event streams. */
  eventHeartbeatMs: number
  /** Maximum JSON mutation body accepted by the HTTP bridge. */
  httpBodyLimitBytes: number
  /** Enable PoC generation and validation features. */
  pocEnabled: boolean
  /** Allow PoC containers to access the network. */
  pocAllowNetwork: boolean
  /** Allowed Docker images for PoC execution. */
  pocDockerImages: string[]
  /** Maximum PoC execution time in milliseconds. */
  pocTimeoutMs: number
  /** Memory limit for PoC containers in MB. */
  pocMemoryMb: number
  /** CPU limit for PoC containers. */
  pocCpuLimit: number
  /** Process limit for PoC containers. */
  pocPidLimit: number
  /** Maximum PoC script size in bytes. */
  pocMaxScriptBytes: number
  /** Maximum PoC output size in bytes. */
  pocMaxOutputBytes: number
}

export interface DashboardMetrics {
  active: number
  confirmed: number
  candidates: number
  blocked: number
  archived: number
  campaigns: number
  averageReadiness: number
  reportReady: number
  investigating: number
  reproducing: number
  disclosed: number
  activeRuns: number
  activeReproductions: number
  evidenceMaturity: Record<EvidenceMaturity, number>
}

export type AuditStage =
  | 'candidate'
  | 'investigating'
  | 'reproducing'
  | 'confirmed'
  | 'report_ready'
  | 'disclosed'
  | 'blocked'
  | 'archived'

export type WorkflowIntent = 'audit' | 'repro' | 'dedup' | 'critic' | 'report' | 'disclose'

export interface FindingSessionLink {
  findingId: string
  sessionId: string
  linkedAt: string
  updatedAt: string
  lastIntent?: WorkflowIntent
}

export interface EvidenceDiff {
  beforeHash: string
  afterHash: string
  changedAt: string
  action: string
  patch: string
  additions: number
  deletions: number
}

export interface WorkflowEvent {
  id: string
  findingId: string
  action: string
  timestamp: string
  sessionId?: string
  intent?: WorkflowIntent
  diff?: EvidenceDiff
}

export interface WorkbenchFindingSummary extends FindingWorkflowSummary {
  stage: AuditStage
  assessment: EvidenceAssessment
  sessionLink?: FindingSessionLink
}

export interface DashboardPayload {
  protocolVersion: typeof WORKBENCH_PROTOCOL_VERSION
  generatedAt: string
  workspace: WorkspaceStatus
  config: OmvWorkbenchConfig
  metrics: DashboardMetrics
  findings: WorkbenchFindingSummary[]
  /** Files that need attention while the rest of the dashboard remains usable. */
  workspaceIssues: WorkspaceIssue[]
  archived: ArchivedFindingSummary[]
  campaigns: CampaignSummary[]
  campaignIssues: CampaignIssue[]
  activity: WorkspaceActivityEntry[]
  /** Evidence-quality queue and operational blockers for the entire workspace. */
  quality: WorkspaceQualityPayload
  /** Reproduction runs across the current workspace. */
  reproductionRuns: ReproductionRun[]
}

export interface WorkspaceIssue {
  id: string
  kind: 'finding' | 'campaign' | 'workspace'
  path: string
  message: string
  recoverable: boolean
}

export type DedupStatus = 'unknown' | 'clear' | 'possible_duplicate' | 'duplicate' | 'not_applicable'

export interface DedupMatch {
  id: string
  findingId: string
  targetFindingId?: string
  source: 'local' | 'advisory'
  title: string
  score: number
  reasons: string[]
  status: 'open' | 'dismissed' | 'confirmed'
  createdAt: string
}

export interface DedupSummary {
  findingId: string
  status: DedupStatus
  scannedAt?: string
  matches: DedupMatch[]
  sources: string[]
  nextAction: string
}

export type ReportPackStatus = 'missing' | 'draft' | 'ready' | 'stale'

export interface ReportPack {
  findingId: string
  status: ReportPackStatus
  reportsDir: string
  artifacts: string[]
  missing: string[]
  provenanceFresh?: boolean | null
  generatedAt?: string
  nextAction: string
}

/** Internal readiness signal consumed by the workspace quality center. */
export interface ReportQueueItem extends ReportPack {
  stage: AuditStage
  maturity: EvidenceMaturity
  package: string
}

export interface WorkspaceQualityIssue {
  id: string
  severity: 'blocker' | 'warning' | 'info'
  kind: 'finding' | 'campaign' | 'report' | 'dedup' | 'workspace'
  title: string
  detail: string
  path?: string
  findingId?: string
  nextAction: string
}

export interface WorkspaceQualityPayload {
  generatedAt: string
  score: number
  blockers: number
  warnings: number
  infos: number
  issues: WorkspaceQualityIssue[]
  queues: {
    needsEvidence: number
    needsReproduction: number
    needsDedup: number
    reportReady: number
  }
}

export type HealthStatus = 'ok' | 'degraded'

export interface HealthCheck {
  name: 'workspace' | 'findings' | 'campaigns' | 'workflow' | 'runner' | 'reproduction'
  status: HealthStatus
  detail?: string
}

export interface HealthPayload {
  protocolVersion: typeof WORKBENCH_PROTOCOL_VERSION
  generatedAt: string
  status: HealthStatus
  projectRoot: string
  checks: HealthCheck[]
}

export interface CampaignIssue {
  id: string
  path: string
  message: string
  repairable: boolean
  changes: string[]
}

export interface FindingPayload {
  protocolVersion: typeof WORKBENCH_PROTOCOL_VERSION
  generatedAt: string
  detail: FindingDetail
  evidence: Record<string, unknown>
  rawEvidence: string
  stage: AuditStage
  sessionLink?: FindingSessionLink
  history: WorkflowEvent[]
  lastDiff?: EvidenceDiff
  doctor?: FindingDoctorResult
  review?: FindingReview
  graph: EvidenceGraph
  assessment: EvidenceAssessment
  qualityGate: QualityGateResult
  reproductionRuns: ReproductionRun[]
  dedup: DedupSummary
}

export interface WorkflowDispatch {
  findingId: string
  sessionId: string
  intent: WorkflowIntent
  label: string
  prompt: string
  stage: AuditStage
  linked: FindingSessionLink
}

export interface WorkspaceChangeEvent {
  revision: number
  generatedAt: string
  projectRoot: string
  paths: string[]
}

export type SurfaceCardStatus = 'proposed' | 'selected' | 'skipped'

export interface AttackSurfaceCardView {
  id: string
  title: string
  pack: string
  vulnerabilityClass: string
  status: SurfaceCardStatus
  findingId: string
  sources: string[]
  sinks: string[]
  guards: string[]
  discoveryHints: string[]
  falsePositiveChecks: string[]
  why: string
}

/** Projection of `.omv/campaigns/<id>.surfaces.yaml`. A missing file is an empty card list. */
export interface CampaignSurfaces {
  path: string
  generatedAt?: string
  updatedAt?: string
  catalogVersion?: string
  cards: AttackSurfaceCardView[]
  proposed: number
  selected: number
  skipped: number
  nextAction: string
  issue?: string
}

export interface CampaignPayload extends ShowCampaignResult {
  protocolVersion: typeof WORKBENCH_PROTOCOL_VERSION
  generatedAt: string
  sessionLink?: FindingSessionLink
  history: WorkflowEvent[]
  runs: CampaignRun[]
  surfaces: CampaignSurfaces
}

export interface CampaignDispatch {
  campaignId: string
  sessionId: string
  prompt: string
  laneCount: number
  linked: FindingSessionLink
}

export type CampaignRunStatus = 'queued' | 'running' | 'paused' | 'completed' | 'needs_attention' | 'cancelled' | 'failed'
export type CampaignLaneStatus = 'queued' | 'dispatching' | 'running' | 'awaiting_evidence' | 'completed' | 'failed' | 'blocked' | 'cancelled'

export interface CampaignRunLane {
  laneId: string
  title: string
  vulnerabilityClass: string
  findingId: string
  status: CampaignLaneStatus
  attempts: number
  prompt: string
  createdAt: string
  updatedAt: string
  sessionId?: string
  startedAt?: string
  finishedAt?: string
  summary?: string
  lastError?: string
}

export interface CampaignRun {
  schemaVersion: 1
  id: string
  campaignId: string
  parentSessionId: string
  status: CampaignRunStatus
  concurrency: number
  createdAt: string
  updatedAt: string
  startedAt?: string
  finishedAt?: string
  lanes: CampaignRunLane[]
}

export interface CampaignLaneDispatch {
  runId: string
  campaignId: string
  parentSessionId: string
  laneId: string
  findingId: string
  title: string
  prompt: string
  attempt: number
}

export interface CampaignRunEvent {
  id: string
  runId: string
  campaignId: string
  action: string
  timestamp: string
  laneId?: string
  sessionId?: string
  detail?: string
}

export type EvidenceGraphNodeKind = 'finding' | 'claim' | 'source' | 'sink' | 'guard' | 'reproducer' | 'observation' | 'session' | 'artifact'

export interface EvidenceGraphNode {
  id: string
  kind: EvidenceGraphNodeKind
  label: string
  value: string
  state: 'known' | 'unknown' | 'verified'
  path?: string
  line?: number
  sessionId?: string
  timestamp?: string
  codeRef?: CodeRef
}

export interface CodeRef {
  path: string
  line?: number
  endLine?: number
  note: string
}

export interface EvidenceGraphEdge {
  from: string
  to: string
  relation: 'describes' | 'flows_to' | 'guarded_by' | 'reproduced_by' | 'observed_as' | 'produced_in' | 'attached_as'
}

export interface EvidenceGraphAnalysis {
  primaryPath: string[]
  highlightedNodes: string[]
  highlightedEdges: string[]
  missingGuards: string[]
  disconnectedNodes: string[]
}

export interface EvidenceGraph {
  findingId: string
  generatedAt: string
  nodes: EvidenceGraphNode[]
  edges: EvidenceGraphEdge[]
  analysis?: EvidenceGraphAnalysis
}

export interface QualityGateCheck {
  id: string
  label: string
  passed: boolean
  severity: 'required' | 'recommended'
  detail: string
  state: EvidenceCheckState
  blocking: boolean
  nextAction?: string
}

export interface QualityGateResult {
  findingId: string
  /** Compatibility signal. This measures evidence support, not percent complete. */
  score: number
  readyForReport: boolean
  checks: QualityGateCheck[]
  blockers: string[]
  advisories: string[]
  summary: string
}

export type EvidenceCheckState = 'missing' | 'partial' | 'supported' | 'verified' | 'not_applicable'
export type EvidenceMaturity = 'unmapped' | 'developing' | 'supported' | 'verified' | 'contested'
export type EvidencePhase = 'discovery' | 'analysis' | 'verification' | 'reporting'

export interface EvidenceDimension {
  id: 'claim_chain' | 'runtime_verification' | 'affected_scope' | 'impact_confidence' | 'report_preparation'
  label: string
  state: EvidenceCheckState
  detail: string
  nextAction?: string
}

export interface EvidenceAssessment {
  findingId: string
  maturity: EvidenceMaturity
  phase: EvidencePhase
  confidence: 'unrated' | 'low' | 'medium' | 'high'
  /** A non-gating signal used for ordering and diagnostics. */
  signal: number
  summary: string
  dimensions: EvidenceDimension[]
  openQuestions: string[]
  suggestedActions: string[]
}

export type ReproductionRunStatus = 'running' | 'passed' | 'failed' | 'blocked'

export interface ReproductionRun {
  id: string
  findingId: string
  sessionId?: string
  status: ReproductionRunStatus
  command?: string
  environment?: Record<string, string>
  exitCode?: number
  output?: string
  artifacts: string[]
  createdAt: string
  updatedAt: string
  finishedAt?: string
}

export interface SearchHit {
  kind: 'finding' | 'campaign' | 'activity'
  id: string
  title: string
  description: string
  score: number
  archived?: boolean
}

export interface WorkspaceExportPayload {
  protocolVersion: typeof WORKBENCH_PROTOCOL_VERSION
  exportedAt: string
  projectRoot: string
  dashboard: DashboardPayload
  findings: FindingPayload[]
  campaigns: CampaignPayload[]
  campaignRuns: CampaignRun[]
  reproductionRuns: ReproductionRun[]
}

export interface ApiSuccess<T> {
  ok: true
  data: T
}

export interface ApiFailure {
  ok: false
  error: {
    code: string
    message: string
  }
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure

export type MutationAction =
  | 'workspace.init'
  | 'finding.create'
  | 'finding.repro'
  | 'finding.promote'
  | 'finding.archive'
  | 'finding.restore'
  | 'campaign.create'
  | 'campaign.repair'
  | 'campaign.seed'
  | 'campaign.surfaces.propose'
  | 'campaign.surfaces.select'
  | 'campaign.surfaces.skip'
  | 'campaign.start'
  | 'campaign.run.create'
  | 'campaign.run.claim'
  | 'campaign.run.bind'
  | 'campaign.run.lane.update'
  | 'campaign.run.control'
  | 'campaign.run.reconcile'
  | 'repro.run.start'
  | 'repro.run.finish'
  | 'session.link'
  | 'session.unlink'
  | 'workflow.start'
  | 'dedup.scan'
  | 'dedup.update'
  | 'poc.generate'
  | 'poc.validate'

export type ReadAction =
  | 'finding.validate'
  | 'finding.doctor'
  | 'workspace.quality'
  | 'finding.dedup'
  | 'finding.graph.export'
  | 'poc.run.inspect'

export type PocLanguage = 'python' | 'bash' | 'curl'
export type PocStatus = 'queued' | 'running' | 'passed' | 'failed' | 'blocked' | 'needs_review'

export interface PocValidation {
  ok: boolean
  errors: string[]
  warnings: string[]
}

export interface PocGenerationRequest {
  templateId: string
  language: PocLanguage
  recommendedImage: string
  requiresNetwork: boolean
  context: Record<string, unknown>
  generationPrompt: string
  resultProtocol: string
  safetyConstraints: {
    allowHostNetwork: boolean
    allowPrivileged: boolean
    allowDockerSocket: boolean
    maxScriptBytes: number
    maxOutputBytes: number
  }
}

export interface PocDraft {
  id: string
  findingId: string
  templateId: string
  language: PocLanguage
  script: string
  commandArgs: string[]
  image: string
  requiresNetwork: boolean
  validation: PocValidation
  createdAt: string
  updatedAt: string
}

export interface PocRun {
  id: string
  draftId: string
  findingId: string
  backend: 'docker'
  status: PocStatus
  exitCode?: number
  stdout?: string
  stderr?: string
  artifacts: string[]
  observedResult?: string
  safetyProfile: {
    network: 'none' | 'bridge'
    readOnly: boolean
    capsDropped: boolean
    pidLimit: number
    memoryMb: number
    cpuLimit: number
  }
  createdAt: string
  updatedAt: string
  startedAt?: string
  finishedAt?: string
}

export interface ActionRequest {
  action: MutationAction | ReadAction
  id?: string
  sessionId?: string
  intent?: WorkflowIntent
  status?: 'candidate' | 'confirmed' | 'blocked'
  reason?: string
  researcherGoal?: 'VulDB' | 'CVE' | 'advisory' | 'triage'
  product?: string
  ecosystem?: string
  vulnerabilityClass?: string
  target?: string
  version?: string
  source?: string
  mode?: 'whitebox' | 'graybox' | 'local-lab' | 'passive' | 'mixed'
  output?: 'course-report' | 'cve' | 'vuldb' | 'internal-report' | 'research-notes'
  depth?: 'quick' | 'standard' | 'deep'
  localReproduction?: 'yes' | 'no' | 'unknown'
  vulnerabilities?: string[]
  cardIds?: string[]
  force?: boolean
  runId?: string
  laneId?: string
  concurrency?: number
  control?: 'pause' | 'resume' | 'cancel' | 'retry'
  laneStatus?: 'completed' | 'failed' | 'blocked' | 'awaiting_evidence'
  summary?: string
  command?: string
  environment?: Record<string, string>
  exitCode?: number
  outputText?: string
  artifacts?: string[]
  reproStatus?: ReproductionRunStatus
  findingId?: string
  dedupStatus?: DedupStatus
  matchId?: string
  exportFormat?: 'dot' | 'mermaid'
  draftId?: string
  script?: string
  language?: PocLanguage
  templateId?: string
  image?: string
  requiresNetwork?: boolean
}
