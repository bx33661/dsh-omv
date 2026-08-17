/** User-owned preference namespace; deployment knobs remain in Cordis Config. */
export const OMV_SETTINGS_NAMESPACE = 'dsh-omv'
/** Browser-only fallback key for DSH rc.6, whose Host API allowlist is fixed. */
export const OMV_LOCAL_TAB_KEY = 'dsh-omv.default-tab'

export const OMV_TABS = ['overview', 'findings', 'reproduction', 'campaigns', 'search'] as const
export type OmvSettingsTab = typeof OMV_TABS[number]

export interface OmvSettings {
  /** The first workbench surface shown when a session opens the OMV view. */
  defaultTab: OmvSettingsTab
}

export const DEFAULT_OMV_SETTINGS: OmvSettings = Object.freeze({ defaultTab: 'overview' })

export function isOmvSettingsTab(value: unknown): value is OmvSettingsTab {
  return typeof value === 'string' && (OMV_TABS as readonly string[]).includes(value)
}
