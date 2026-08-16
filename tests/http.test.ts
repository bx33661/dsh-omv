import { createServer, request, type IncomingMessage, type ServerResponse } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { registerWorkbenchHttp, type WebServerLike } from '../src/http.js'
import { OmvWorkbench } from '../src/workbench.js'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('workbench HTTP bridge', () => {
  it('serves health and injects the client bootstrap', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-omv-http-'))
    roots.push(root)
    const workbench = new OmvWorkbench({
      projectRoot: root,
      apiPrefix: '/api/dsh-omv',
      allowMutations: true,
      allowRemoteAccess: false,
      activityLimit: 10,
      refreshIntervalMs: 1234,
      campaignConcurrency: 3,
      watchDebounceMs: 10,
      eventHeartbeatMs: 200,
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
    let handler: ((req: IncomingMessage, res: ServerResponse) => void | Promise<void>) | undefined
    let transform: ((html: string) => string) | undefined
    let routeClosed = false
    let indexClosed = false
    const fake: WebServerLike = {
      register(route) { handler = route.handler; return () => { routeClosed = true } },
      tapIndex(next) { transform = next; return () => { indexClosed = true } },
    }
    let requestedRoot: string | undefined
    const unregister = registerWorkbenchHttp(fake, workbench, projectRoot => {
      requestedRoot = projectRoot
      return workbench
    })
    await workbench.action({ action: 'campaign.create', id: 'http-runtime', target: 'http-package', ecosystem: 'npm', vulnerabilities: ['ssrf'] })
    const campaignRun = await workbench.action({ action: 'campaign.run.create', id: 'http-runtime', sessionId: 'session-http', concurrency: 1 }) as { id: string }
    await workbench.action({ action: 'finding.create', id: 'http-finding', product: 'http-package', ecosystem: 'npm', vulnerabilityClass: 'ssrf', researcherGoal: 'triage' })
    expect(transform?.('<html><head></head></html>')).toContain(
      `window.__DSH_OMV__={"apiPrefix":"/api/dsh-omv","projectRoot":"${root}","refreshIntervalMs":1234}`,
    )

    const server = createServer((req, res) => { void handler?.(req, res) })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    try {
      const address = server.address()
      if (address === null || typeof address === 'string') throw new Error('test server did not bind a TCP port')
      const response = await fetch(`http://127.0.0.1:${address.port}/api/dsh-omv/health?root=${encodeURIComponent('/workspace/session')}`)
      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toMatchObject({ ok: true, data: { status: 'ok', projectRoot: root, checks: expect.arrayContaining([{ name: 'workspace', status: 'ok' }]) } })
      expect(requestedRoot).toBe('/workspace/session')

      const dashboardResponse = await fetch(`http://127.0.0.1:${address.port}/api/dsh-omv/dashboard`)
      await expect(dashboardResponse.json()).resolves.toMatchObject({ ok: true, data: { protocolVersion: '2', metrics: { activeRuns: 1 } } })

      const qualityResponse = await fetch(`http://127.0.0.1:${address.port}/api/dsh-omv/quality`)
      await expect(qualityResponse.json()).resolves.toMatchObject({ ok: true, data: { score: expect.any(Number), queues: expect.objectContaining({ needsDedup: expect.any(Number) }) } })
      for (const endpoint of ['dedup?id=http-finding', 'reproductions']) {
        const response = await fetch(`http://127.0.0.1:${address.port}/api/dsh-omv/${endpoint}`)
        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toMatchObject({ ok: true })
      }

      const compatibleResponse = await fetch(`http://127.0.0.1:${address.port}/api/dsh-omv/dashboard?protocol=1`)
      await expect(compatibleResponse.json()).resolves.toMatchObject({ ok: true, data: { protocolVersion: '1', metrics: { activeRuns: 1 } } })

      const protocolResponse = await fetch(`http://127.0.0.1:${address.port}/api/dsh-omv/protocol`)
      await expect(protocolResponse.json()).resolves.toMatchObject({ ok: true, data: { current: '2', compatible: ['1', '2'] } })

      const runResponse = await fetch(`http://127.0.0.1:${address.port}/api/dsh-omv/campaign-run?id=${campaignRun.id}`)
      expect(runResponse.status).toBe(200)
      await expect(runResponse.json()).resolves.toMatchObject({ ok: true, data: { id: campaignRun.id, status: 'queued', concurrency: 1 } })

      const searchResponse = await fetch(`http://127.0.0.1:${address.port}/api/dsh-omv/search?q=not-present`)
      expect(searchResponse.status).toBe(200)
      await expect(searchResponse.json()).resolves.toMatchObject({ ok: true, data: [] })

      // A loopback socket with a foreign Host header is the DNS-rebinding shape and must be rejected.
      const rebound = await new Promise<{ status: number; body: string }>((resolve, reject) => {
        const req = request({ host: '127.0.0.1', port: address.port, path: '/api/dsh-omv/export', headers: { host: 'attacker.example' } }, res => {
          let body = ''
          res.on('data', (chunk: Buffer) => { body += chunk.toString() })
          res.on('end', () => resolve({ status: res.statusCode ?? 0, body }))
        })
        req.on('error', reject)
        req.end()
      })
      expect(rebound.status).toBe(403)
      expect(rebound.body).toContain('untrusted host header')

      const controller = new AbortController()
      const eventsResponse = await fetch(`http://127.0.0.1:${address.port}/api/dsh-omv/events`, { signal: controller.signal })
      expect(eventsResponse.headers.get('content-type')).toContain('text/event-stream')
      const first = await eventsResponse.body?.getReader().read()
      expect(new TextDecoder().decode(first?.value)).toContain('event: ready')
      controller.abort()
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error === undefined ? resolve() : reject(error)))
      unregister()
      expect(routeClosed).toBe(true)
      expect(indexClosed).toBe(true)
    }
  })
})
