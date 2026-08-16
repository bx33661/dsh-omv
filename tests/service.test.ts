import { Context } from '@deepseek-ai/cordis'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { OmvService } from '../src/service.js'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('native OMV Cordis service', () => {
  it('provides a stable service and caches scoped workbenches', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-omv-service-'))
    const other = await mkdtemp(join(tmpdir(), 'dsh-omv-service-scoped-'))
    roots.push(root, other)
    const service = new OmvService(new Context(), {
      projectRoot: root,
      apiPrefix: '/api/dsh-omv',
      allowMutations: true,
      allowRemoteAccess: false,
      activityLimit: 20,
      refreshIntervalMs: 0,
      campaignConcurrency: 3,
      radarIntervalMs: 0,
      watchDebounceMs: 90,
      eventHeartbeatMs: 20_000,
      httpBodyLimitBytes: 256 * 1024,
    })
    expect(service.workbench.config.projectRoot).toBe(root)
    expect(service.scoped(other)).toBe(service.scoped(other))
    service.close()
  })
})
