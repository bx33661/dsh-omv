import type { ISessions, SettingsScope, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type {
  DashboardPayload,
  EvidenceAssessment,
  EvidenceCheckState,
  WorkflowIntent,
} from '../contracts.js'
import type { OmvSettings, OmvSettingsTab } from '../settings.js'

export type Tab = OmvSettingsTab
export type Dialog = 'finding' | 'campaign' | null

/** Public product name. Keep the package id (`dsh-omv`) stable for upgrades. */
export const OMV_DISPLAY_NAME = 'OMV 审计台'

export interface WorkspaceSurfaceInjected {
  projectRoot: string
  sessions: ISessions
  settings: SettingsScope<OmvSettings>
  /** Opens the configured landing workspace, useful when a session points elsewhere. */
  openWorkbench?: (() => Promise<void>) | undefined
  /** Opens a local path through DSH's native workspace service. */
  openPath?: ((path: string) => Promise<void>) | undefined
}

export interface LauncherInjected {
  openWorkbench: () => Promise<void>
}

export interface SettingsInjected {
  projectRoot: string
  openWorkbench: () => Promise<void>
  openPath: (path: string) => Promise<void>
  settings: SettingsScope<OmvSettings>
}

export const OMV_COMMANDS = ['omv', 'omv-health', 'omv-runtime', 'omv-finding', 'omv-validate', 'omv-init', 'omv-new', 'omv-link', 'omv-repro', 'omv-promote', 'omv-run', 'omv-campaign', 'omv-campaign-repair', 'omv-campaign-seed', 'omv-campaign-surfaces', 'omv-search', 'omv-campaign-run', 'omv-campaign-lane', 'omv-quality', 'omv-dedup'] as const

/** Wire tools that belong to the OMV capability domain and get its native chat card. */
export const OMV_TOOL_NAMES = [
  'omv_workspace_overview', 'omv_workspace_health', 'omv_runtime_status',
  'omv_finding_inspect', 'omv_finding_validate', 'omv_finding_create',
  'omv_workflow_link', 'omv_finding_repro_init', 'omv_finding_promote',
  'omv_workflow_history', 'omv_campaign_inspect', 'omv_campaign_repair',
  'omv_campaign_seed', 'omv_campaign_surfaces', 'omv_workspace_search',
  'omv_campaign_run_inspect', 'omv_campaign_lane_update', 'omv_evidence_graph',
  'omv_quality_gate', 'omv_quality_overview', 'omv_dedup_scan',
  'omv_repro_run_start', 'omv_repro_run_finish', 'omv_poc_generate',
  'omv_poc_draft_save', 'omv_poc_draft_approve', 'omv_poc_run',
  'omv_poc_run_inspect', 'omv_poc_evidence_adopt',
] as const

export type IconName = 'shield' | 'grid' | 'finding' | 'campaign' | 'pulse' | 'refresh' | 'close' | 'plus' | 'check' | 'alert' | 'chevron' | 'search' | 'terminal' | 'arrowUp' | 'inbox' | 'folder' | 'file' | 'maximize' | 'minimize' | 'archive' | 'activity' | 'clock' | 'eye'

export type { DashboardPayload, EvidenceAssessment, EvidenceCheckState, SessionId, WorkflowIntent }
