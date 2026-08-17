import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import { resolve } from 'node:path'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-commands'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type {} from '@deepseek-ai/dsh-workspace'
import type {} from '@deepseek-ai/dsh-settings'
import type { ToolExecution, ToolExecutionResult } from '@deepseek-ai/dsh-tools'
import { registerOmvCommands } from './commands.js'
import { registerWorkbenchHttp, type WebServerLike } from './http.js'
import './events.js'
import { inspectDshRuntime } from './runtime.js'
import { OmvService } from './service.js'
import { DEFAULT_OMV_SETTINGS, OMV_SETTINGS_NAMESPACE } from './settings.js'
import { OmvSettingsSchema } from './settings-schema.js'
import { registerOmvTools } from './tools.js'

export const name = 'dsh-omv'
export const inject = ['webServer', 'tools', 'commands', 'systemPrompt', 'workspaceRegistry']
/** Advertise the service before apply runs so dependent plugins can wait on it. */
export const provide = ['omv']

export interface Config {
  /** Project containing the private .omv workspace. Relative paths resolve from the DSH launch directory. */
  projectRoot?: string
  /** Same-origin HTTP prefix used by the browser workbench. */
  apiPrefix?: string
  /** Enables workbench buttons and tools that modify .omv artifacts. */
  allowMutations?: boolean
  /** Allows HTTP workbench access from non-loopback clients. */
  allowRemoteAccess?: boolean
  /** Maximum recent activity rows returned to the browser. */
  activityLimit?: number
  /** Browser dashboard refresh cadence in milliseconds; zero disables polling. */
  refreshIntervalMs?: number
  /** Default maximum number of concurrently running Campaign lane sessions. */
  campaignConcurrency?: number
  /** Debounce window for workspace change events. */
  watchDebounceMs?: number
  /** SSE heartbeat cadence. */
  eventHeartbeatMs?: number
  /** Maximum JSON mutation body in bytes. */
  httpBodyLimitBytes?: number
  /** Enable PoC generation and validation features. */
  pocEnabled?: boolean
  /** Allow PoC containers to access the network. */
  pocAllowNetwork?: boolean
  /** Allowed Docker images for PoC execution. */
  pocDockerImages?: string[]
  /** Maximum PoC execution time in milliseconds. */
  pocTimeoutMs?: number
  /** Memory limit for PoC containers in MB. */
  pocMemoryMb?: number
  /** CPU limit for PoC containers. */
  pocCpuLimit?: number
  /** Process limit for PoC containers. */
  pocPidLimit?: number
  /** Maximum PoC script size in bytes. */
  pocMaxScriptBytes?: number
  /** Maximum PoC output size in bytes. */
  pocMaxOutputBytes?: number
}

export const Config: Schema<Config> = Schema.object({
  projectRoot: Schema.string().pattern(/\S/u).default('.'),
  apiPrefix: Schema.string().pattern(/^\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/u).default('/api/dsh-omv'),
  allowMutations: Schema.boolean().default(true),
  allowRemoteAccess: Schema.boolean().default(false),
  activityLimit: Schema.number().step(1).min(1).default(60),
  refreshIntervalMs: Schema.number().step(1).min(0).default(15_000),
  campaignConcurrency: Schema.number().step(1).min(1).max(8).default(3),
  watchDebounceMs: Schema.number().step(1).min(0).max(10_000).default(90),
  eventHeartbeatMs: Schema.number().step(1).min(1).max(300_000).default(20_000),
  httpBodyLimitBytes: Schema.number().step(1).min(4_096).max(16 * 1024 * 1024).default(256 * 1024),
  pocEnabled: Schema.boolean().default(true),
  pocAllowNetwork: Schema.boolean().default(false),
  pocDockerImages: Schema.array(Schema.string()).min(1).default(['python:3.12-slim']),
  pocTimeoutMs: Schema.number().step(1).min(1_000).max(600_000).default(30_000),
  pocMemoryMb: Schema.number().step(1).min(64).max(2048).default(256),
  pocCpuLimit: Schema.number().min(0.1).max(4).default(1),
  pocPidLimit: Schema.number().step(1).min(16).max(512).default(128),
  pocMaxScriptBytes: Schema.number().step(1).min(1_024).max(1024 * 1024).default(128 * 1024),
  pocMaxOutputBytes: Schema.number().step(1).min(1_024).max(1024 * 1024).default(64 * 1024),
})

export function apply(ctx: Context, config: Config = {}): void {
  const resolved = {
    projectRoot: config.projectRoot ?? '.',
    apiPrefix: normalizeApiPrefix(config.apiPrefix ?? '/api/dsh-omv'),
    allowMutations: config.allowMutations ?? true,
    allowRemoteAccess: config.allowRemoteAccess ?? false,
    activityLimit: positiveInteger(config.activityLimit ?? 60, 'activityLimit'),
    refreshIntervalMs: nonNegativeInteger(config.refreshIntervalMs ?? 15_000, 'refreshIntervalMs'),
    campaignConcurrency: boundedInteger(config.campaignConcurrency ?? 3, 1, 8, 'campaignConcurrency'),
    watchDebounceMs: boundedInteger(config.watchDebounceMs ?? 90, 0, 10_000, 'watchDebounceMs'),
    eventHeartbeatMs: boundedInteger(config.eventHeartbeatMs ?? 20_000, 1, 300_000, 'eventHeartbeatMs'),
    httpBodyLimitBytes: boundedInteger(config.httpBodyLimitBytes ?? 256 * 1024, 4_096, 16 * 1024 * 1024, 'httpBodyLimitBytes'),
    pocEnabled: config.pocEnabled ?? true,
    pocAllowNetwork: config.pocAllowNetwork ?? false,
    pocDockerImages: config.pocDockerImages ?? ['python:3.12-slim'],
    pocTimeoutMs: boundedInteger(config.pocTimeoutMs ?? 30_000, 1_000, 600_000, 'pocTimeoutMs'),
    pocMemoryMb: boundedInteger(config.pocMemoryMb ?? 256, 64, 2048, 'pocMemoryMb'),
    pocCpuLimit: config.pocCpuLimit ?? 1,
    pocPidLimit: boundedInteger(config.pocPidLimit ?? 128, 16, 512, 'pocPidLimit'),
    pocMaxScriptBytes: boundedInteger(config.pocMaxScriptBytes ?? 128 * 1024, 1_024, 1024 * 1024, 'pocMaxScriptBytes'),
    pocMaxOutputBytes: boundedInteger(config.pocMaxOutputBytes ?? 64 * 1024, 1_024, 1024 * 1024, 'pocMaxOutputBytes'),
  }
  const omv = new OmvService(ctx, resolved)
  const workbench = omv.workbench
  registerUserSettings(ctx)
  const unregisterHttp = registerWorkbenchHttp(ctx.webServer as unknown as WebServerLike, workbench, async projectRoot => {
    if (projectRoot === undefined || resolve(projectRoot) === workbench.config.projectRoot) return workbench
    const workspace = await ctx.workspaceRegistry.resolveByPath(projectRoot)
    if (workspace === undefined) throw new Error('requested root is not a registered DSH workspace')
    return omv.scoped(workspace.path)
  })
  ctx.effect(() => () => {
    unregisterHttp()
    omv.close()
  }, 'dsh-omv: workspace watchers')
  registerOmvTools(ctx, workbench, () => inspectDshRuntime(ctx))
  registerOmvCommands(ctx, workbench, () => inspectDshRuntime(ctx))
  ctx.on('tools/result', (exec: Readonly<ToolExecution>, result: Readonly<ToolExecutionResult>) => {
    if (!exec.name.startsWith('omv_')) return
    ctx.emit('dsh-omv/tool-result', {
      name: exec.name,
      callId: String(exec.callId),
      ok: !result.isError,
      ...(exec.agent?.session.header.id === undefined ? {} : { sessionId: exec.agent.session.header.id }),
      ...(exec.agent?.session.header.cwd === undefined ? {} : { projectRoot: resolve(exec.agent.session.header.cwd) }),
    })
  })
  ctx.effect(() => ctx.systemPrompt.section({
    name: 'dsh-omv:workflow',
    order: 150,
    text: [
      'The current DSH workspace has an evidence-first vulnerability audit capability.',
      'Use omv_workspace_overview to orient, omv_finding_inspect before changing a finding,',
      'omv_workflow_link when one finding becomes the session focus, omv_finding_repro_init before reproduction,',
      'omv_finding_validate after evidence edits, and omv_finding_create only for a new candidate.',
      'For campaign work inspect the Campaign, propose attack-surface cards with omv_campaign_surfaces, select or skip cards, then seed only selected cards before delegating one card per subagent; do not seed generic lanes when a surfaces file exists.',
      'Campaign Runner lanes are durable DSH sessions: inspect them with omv_campaign_run_inspect and always commit an outcome with omv_campaign_lane_update before a lane ends.',
      'Use omv_evidence_graph and omv_quality_gate to verify provenance and report readiness; bracket every local reproduction with omv_repro_run_start and omv_repro_run_finish.',
      'For isolated PoC work use omv_poc_generate, edit and save the draft with omv_poc_draft_save, validate and explicitly approve with omv_poc_draft_approve, then run with omv_poc_run. Inspect result.json and provenance with omv_poc_run_inspect; never treat a passed run as a confirmed vulnerability until a human calls omv_poc_evidence_adopt.',
      'Use omv_quality_overview to triage the workspace queue and omv_dedup_scan before submission; report drafts and disclosure timelines belong to the omv-report and omv-disclose Agent workflows.',
      'If a DSH capability appears missing or a plugin is waiting, use omv_runtime_status to inspect Cordis Fiber dependencies before retrying.',
      'Treat Evidence.v1 source -> sink -> guard and observed reproduction as the canonical audit state.',
      'Keep unknown evidence explicit; describe maturity by evidence dimensions and report exact next actions instead of treating a single score as completion.',
    ].join(' '),
  }), 'dsh-omv: system prompt')
}

/**
 * Register only user-owned preferences with the optional DSH settings seam.
 * Deployment/runtime knobs intentionally stay in Cordis Config and patch files.
 * `ctx.inject()` keeps headless profiles working when no settings provider is mounted.
 */
function registerUserSettings(ctx: Context): void {
  ctx.inject(['settings'], settingsCtx => {
    const settings = (settingsCtx as unknown as {
      settings: {
        register<T>(namespace: string, schema: Schema<T>, options?: { base?: Partial<T> }): {
          watch(listener: (next: T, previous: T) => void): () => void
        }
      }
    }).settings
    const scope = settings.register(OMV_SETTINGS_NAMESPACE, OmvSettingsSchema, { base: DEFAULT_OMV_SETTINGS })
    settingsCtx.effect(() => scope.watch(() => undefined), 'dsh-omv: settings observer')
  })
}

function normalizeApiPrefix(value: string): string {
  const prefix = value.trim()
  if (!prefix.startsWith('/') || prefix === '/' || prefix.endsWith('/')) {
    throw new Error('dsh-omv: apiPrefix must be an absolute path without a trailing slash')
  }
  if (!/^\/[A-Za-z0-9/_-]+$/.test(prefix)) {
    throw new Error('dsh-omv: apiPrefix contains unsupported characters')
  }
  return prefix
}

function positiveInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 1) throw new Error(`dsh-omv: ${field} must be a positive integer`)
  return value
}

function nonNegativeInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 0) throw new Error(`dsh-omv: ${field} must be a non-negative integer`)
  return value
}

function boundedInteger(value: number, min: number, max: number, field: string): number {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`dsh-omv: ${field} must be an integer between ${min} and ${max}`)
  return value
}

export type {
  ActionRequest,
  ApiFailure,
  ApiResponse,
  ApiSuccess,
  DashboardMetrics,
  DashboardPayload,
  HealthCheck,
  HealthPayload,
  FindingPayload,
  FindingSessionLink,
  CampaignPayload,
  CampaignSurfaces,
  AttackSurfaceCardView,
  SurfaceCardStatus,
  CampaignIssue,
  CampaignDispatch,
  CampaignRun,
  CampaignRunLane,
  CampaignRunEvent,
  CampaignLaneDispatch,
  CampaignRunStatus,
  CampaignLaneStatus,
  EvidenceGraph,
  EvidenceGraphNode,
  EvidenceGraphEdge,
  EvidenceGraphAnalysis,
  QualityGateResult,
  QualityGateCheck,
  EvidenceAssessment,
  EvidenceDimension,
  EvidenceCheckState,
  EvidenceMaturity,
  EvidencePhase,
  ReproductionRun,
  ReproductionRunStatus,
  SearchHit,
  OmvWorkbenchConfig,
  AuditStage,
  EvidenceDiff,
  WorkflowDispatch,
  WorkflowEvent,
  WorkflowIntent,
  WorkspaceChangeEvent,
  WorkspaceExportPayload,
  DedupStatus,
  DedupMatch,
  DedupSummary,
  ReportPackStatus,
  ReportPack,
  ReportQueueItem,
  WorkspaceQualityIssue,
  WorkspaceQualityPayload,
  PocLanguage,
  PocStatus,
  PocValidation,
  PocGenerationRequest,
  PocDraft,
  PocArtifact,
  PocProvenance,
  PocRun,
  CodeRef,
} from './contracts.js'
export { DEFAULT_OMV_SETTINGS, OMV_SETTINGS_NAMESPACE, OMV_TABS } from './settings.js'
export { OmvSettingsSchema } from './settings-schema.js'
export type { OmvSettings, OmvSettingsTab } from './settings.js'
export { OmvService } from './service.js'
export { inspectDshRuntime } from './runtime.js'
export type { DshRuntimeEntry, DshRuntimeFiber, DshRuntimeSnapshot, DshRuntimeState } from './runtime.js'
export type { OmvToolResultEvent } from './events.js'
export { WORKBENCH_PROTOCOL_VERSION, WORKBENCH_COMPATIBLE_PROTOCOL_VERSIONS } from './contracts.js'
export { OmvWorkbench } from './workbench.js'
export { OmvWorkflowService, deriveAuditStage, suggestedIntent } from './workflow.js'
export { CampaignRunner } from './runner.js'
export { ReproductionService } from './reproduction.js'
export { buildEvidenceGraph, evaluateQualityGate, analyzeEvidenceGraph, exportEvidenceGraph } from './evidence-graph.js'
export { assessEvidence } from './assessment.js'
export { parseCodeRef, resolveCodeRef, formatCodeRef } from './code-ref.js'
export { createPocGenerationRequest } from './poc-generator.js'
export { DockerPocExecutor, defaultCommandRunner } from './poc-executor.js'
export type { CommandRunner, PocExecutor } from './poc-executor.js'
export { PocStore } from './poc-store.js'
