import { describe, expect, it } from 'vitest'
import { DEFAULT_OMV_SETTINGS, isOmvSettingsTab, OMV_SETTINGS_NAMESPACE, type OmvSettings } from '../src/settings.js'
import { OmvSettingsSchema } from '../src/settings-schema.js'

describe('native OMV user settings contract', () => {
  it('keeps the preference namespace separate from deployment config', () => {
    expect(OMV_SETTINGS_NAMESPACE).toBe('dsh-omv')
    expect(OmvSettingsSchema({} as OmvSettings)).toEqual(DEFAULT_OMV_SETTINGS)
  })

  it('accepts only known audit surfaces', () => {
    expect(isOmvSettingsTab('campaigns')).toBe(true)
    expect(isOmvSettingsTab('not-a-tab')).toBe(false)
  })
})
