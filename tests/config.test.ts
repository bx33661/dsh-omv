import { describe, expect, it } from 'vitest'
import { Config } from '../src/index.js'

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
      pocEnabled: true,
      pocAllowNetwork: false,
      pocDockerImages: ['python:3.12-slim'],
      pocTimeoutMs: 30_000,
      pocMemoryMb: 256,
      pocCpuLimit: 1,
      pocPidLimit: 128,
      pocMaxScriptBytes: 128 * 1024,
      pocMaxOutputBytes: 64 * 1024,
    })
  })

  it('rejects invalid tunables at schema resolution time', () => {
    expect(() => Config({ watchDebounceMs: -1 })).toThrow(/watchDebounceMs/)
    expect(() => Config({ httpBodyLimitBytes: 100 })).toThrow(/httpBodyLimitBytes/)
    expect(() => Config({ campaignConcurrency: 9 })).toThrow(/campaignConcurrency/)
    expect(() => Config({ apiPrefix: 'api/dsh-omv' })).toThrow(/apiPrefix/)
    expect(() => Config({ pocDockerImages: [] })).toThrow(/pocDockerImages/)
    expect(() => Config({ pocTimeoutMs: 0 })).toThrow(/pocTimeoutMs/)
    expect(() => Config({ pocMemoryMb: 0 })).toThrow(/pocMemoryMb/)
    expect(() => Config({ pocPidLimit: 0 })).toThrow(/pocPidLimit/)
  })
})
