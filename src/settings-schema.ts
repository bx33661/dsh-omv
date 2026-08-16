import Schema from '@deepseek-ai/schemastery'
import { OMV_TABS, type OmvSettings } from './settings.js'

/** Host-side schema for the optional dsh-settings provider. */
export const OmvSettingsSchema: Schema<OmvSettings> = Schema.object({
  defaultTab: Schema.union([...OMV_TABS]).default('overview'),
})
