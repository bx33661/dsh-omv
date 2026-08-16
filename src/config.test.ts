import { describe, expect, it } from 'vitest'
import { Config } from './index.js'

describe('dsh-omv Cordis config', () => {
  it('materializes deployment defaults for the complete patch row', () => {
    expect(Config({})).toMatchObject({
      apiPrefix: '/api/dsh-omv',
      activityLimit: 60,
      refreshIntervalMs: 15_000,
      campaignConcurrency: 3,
      watchDebounceMs: 90,
      eventHeartbeatMs: 20_000,
      httpBodyLimitBytes: 256 * 1024,
    })
  })

  it('rejects invalid tunables at schema resolution time', () => {
    expect(() => Config({ watchDebounceMs: -1 })).toThrow(/watchDebounceMs/)
    expect(() => Config({ httpBodyLimitBytes: 100 })).toThrow(/httpBodyLimitBytes/)
    expect(() => Config({ campaignConcurrency: 9 })).toThrow(/campaignConcurrency/)
    expect(() => Config({ apiPrefix: 'api/dsh-omv' })).toThrow(/apiPrefix/)
  })
})
