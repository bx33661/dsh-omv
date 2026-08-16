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

export const OMV_COMMANDS = ['omv', 'omv-health', 'omv-runtime', 'omv-finding', 'omv-validate', 'omv-init', 'omv-new', 'omv-link', 'omv-repro', 'omv-promote', 'omv-run', 'omv-campaign', 'omv-campaign-repair', 'omv-campaign-seed', 'omv-search', 'omv-campaign-run', 'omv-campaign-lane', 'omv-quality', 'omv-dedup'] as const

export type IconName = 'shield' | 'grid' | 'finding' | 'radar' | 'pulse' | 'refresh' | 'close' | 'plus' | 'check' | 'gauge' | 'alert' | 'chevron' | 'search' | 'terminal' | 'arrowUp' | 'inbox' | 'folder'

export type { DashboardPayload, EvidenceAssessment, EvidenceCheckState, SessionId, WorkflowIntent }
