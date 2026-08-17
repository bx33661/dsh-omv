import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ActionRequest, ApiFailure, ApiSuccess } from './contracts.js'
import { WORKBENCH_COMPATIBLE_PROTOCOL_VERSIONS, WORKBENCH_PROTOCOL_VERSION } from './contracts.js'
import type { OmvWorkbench } from './workbench.js'

export interface WebServerLike {
  register(route: {
    kind: 'exact' | 'prefix'
    path: string
    handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
  }): () => void
  tapIndex(transform: (html: string) => string): () => void
}

export type WorkbenchResolver = (projectRoot: string | undefined) => OmvWorkbench | Promise<OmvWorkbench>

export function registerWorkbenchHttp(
  webServer: WebServerLike,
  workbench: OmvWorkbench,
  resolveWorkbench: WorkbenchResolver = () => workbench,
): () => void {
  const prefix = workbench.config.apiPrefix
  const unregisterRoute = webServer.register({
    kind: 'prefix',
    path: prefix,
    handler: async (req, res) => {
      try {
        await routeRequest(req, res, workbench, resolveWorkbench)
      } catch (error) {
        sendJson(res, statusForError(error), failure(error))
      }
    },
  })
  const unregisterIndex = webServer.tapIndex(html => injectWorkbenchBootstrap(html, workbench.config))
  return () => {
    unregisterRoute()
    unregisterIndex()
  }
}

async function routeRequest(
  req: IncomingMessage,
  res: ServerResponse,
  configured: OmvWorkbench,
  resolveWorkbench: WorkbenchResolver,
): Promise<void> {
  requireAllowedClient(req, configured.config.allowRemoteAccess)
  requireTrustedHost(req, configured.config.allowRemoteAccess)
  const method = req.method ?? 'GET'
  const url = new URL(req.url ?? '/', 'http://dsh.local')
  const suffix = url.pathname.slice(configured.config.apiPrefix.length) || '/'
  const requestedRoot = url.searchParams.get('root')?.trim() || undefined
  const requestedProtocol = protocolFrom(url)
  let workbench: OmvWorkbench
  try {
    workbench = await resolveWorkbench(requestedRoot)
  } catch (error) {
    throw new RequestError(403, error instanceof Error ? error.message : 'requested DSH workspace is unavailable')
  }

  if ((method === 'GET' || method === 'HEAD') && (suffix === '/' || suffix === '/dashboard')) {
    sendJson(res, 200, success(versioned(await workbench.dashboard(), requestedProtocol)), method === 'HEAD')
    return
  }
  if (method === 'GET' && suffix === '/events') {
    streamEvents(req, res, workbench)
    return
  }
  if ((method === 'GET' || method === 'HEAD') && suffix === '/finding') {
    const id = url.searchParams.get('id')?.trim()
    if (!id) throw new RequestError(400, 'id query parameter is required')
    const archived = url.searchParams.get('archived') === 'true'
    sendJson(res, 200, success(versioned(await workbench.finding(id, archived), requestedProtocol)), method === 'HEAD')
    return
  }
  if ((method === 'GET' || method === 'HEAD') && suffix === '/campaign') {
    const id = url.searchParams.get('id')?.trim()
    if (!id) throw new RequestError(400, 'id query parameter is required')
    sendJson(res, 200, success(versioned(await workbench.campaign(id), requestedProtocol)), method === 'HEAD')
    return
  }
  if ((method === 'GET' || method === 'HEAD') && suffix === '/campaign-run') {
    const id = url.searchParams.get('id')?.trim()
    if (!id) throw new RequestError(400, 'id query parameter is required')
    sendJson(res, 200, success(versioned(await workbench.campaignRun(id), requestedProtocol)), method === 'HEAD')
    return
  }
  if ((method === 'GET' || method === 'HEAD') && suffix === '/quality') {
    sendJson(res, 200, success(versioned(await workbench.quality(), requestedProtocol)), method === 'HEAD')
    return
  }
  if ((method === 'GET' || method === 'HEAD') && suffix === '/reproductions') {
    sendJson(res, 200, success(versioned((await workbench.dashboard()).reproductionRuns, requestedProtocol)), method === 'HEAD')
    return
  }
  if ((method === 'GET' || method === 'HEAD') && suffix === '/poc') {
    const findingId = url.searchParams.get('findingId')?.trim()
    if (findingId === undefined || findingId === '') throw new RequestError(400, 'findingId query parameter is required')
    const [drafts, runs] = await Promise.all([workbench.poc.listDrafts(findingId), workbench.poc.listRuns(findingId)])
    sendJson(res, 200, success(versioned({ drafts, runs }, requestedProtocol)), method === 'HEAD')
    return
  }
  if ((method === 'GET' || method === 'HEAD') && suffix === '/poc-run') {
    const runId = url.searchParams.get('id')?.trim()
    if (runId === undefined || runId === '') throw new RequestError(400, 'id query parameter is required')
    sendJson(res, 200, success(versioned(await workbench.poc.inspectRun(runId), requestedProtocol)), method === 'HEAD')
    return
  }
  if ((method === 'GET' || method === 'HEAD') && suffix === '/dedup') {
    const id = url.searchParams.get('id')?.trim()
    if (!id) throw new RequestError(400, 'id query parameter is required')
    sendJson(res, 200, success(versioned(await workbench.dedupSummary(id), requestedProtocol)), method === 'HEAD')
    return
  }
  if ((method === 'GET' || method === 'HEAD') && suffix === '/search') {
    const query = url.searchParams.get('q')?.trim()
    if (!query) throw new RequestError(400, 'q query parameter is required')
    sendJson(res, 200, success(versioned(await workbench.search(query), requestedProtocol)), method === 'HEAD')
    return
  }
  if ((method === 'GET' || method === 'HEAD') && suffix === '/export') {
    sendJson(res, 200, success(versioned(await workbench.exportWorkspace(), requestedProtocol)), method === 'HEAD')
    return
  }
  if ((method === 'GET' || method === 'HEAD') && suffix === '/health') {
    sendJson(res, 200, success(await workbench.health()), method === 'HEAD')
    return
  }
  if ((method === 'GET' || method === 'HEAD') && suffix === '/protocol') {
    sendJson(res, 200, success({ current: WORKBENCH_PROTOCOL_VERSION, compatible: WORKBENCH_COMPATIBLE_PROTOCOL_VERSIONS }), method === 'HEAD')
    return
  }
  if (method === 'POST' && suffix === '/action') {
    requireSameOrigin(req)
    requireJson(req)
    const request = await readJsonBody(req, workbench.config.httpBodyLimitBytes)
    if (!isRecord(request) || typeof request.action !== 'string') {
      throw new RequestError(400, 'request body must contain an action')
    }
    const abortController = new AbortController()
    const abort = () => abortController.abort()
    req.once('aborted', abort)
    req.once('close', abort)
    let result: unknown
    try {
      result = await workbench.action(request as unknown as ActionRequest, { signal: abortController.signal })
    } finally {
      req.off('aborted', abort)
      req.off('close', abort)
    }
    sendJson(res, 200, success(versioned(result, requestedProtocol)))
    return
  }
  if (method !== 'GET' && method !== 'HEAD' && method !== 'POST') {
    res.setHeader('Allow', 'GET, HEAD, POST')
    throw new RequestError(405, `method ${method} is not supported`)
  }
  throw new RequestError(404, `unknown dsh-omv endpoint: ${suffix}`)
}

function streamEvents(req: IncomingMessage, res: ServerResponse, workbench: OmvWorkbench): void {
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders?.()
  res.write(`event: ready\ndata: ${JSON.stringify({ projectRoot: workbench.config.projectRoot })}\n\n`)
  const unsubscribe = workbench.subscribe(event => {
    if (!res.destroyed && !res.writableEnded) res.write(`event: workspace\ndata: ${JSON.stringify(event)}\n\n`)
  })
  const heartbeat = setInterval(() => {
    if (!res.destroyed && !res.writableEnded) res.write(': heartbeat\n\n')
  }, workbench.config.eventHeartbeatMs)
  heartbeat.unref()
  let closed = false
  const close = () => {
    if (closed) return
    closed = true
    clearInterval(heartbeat)
    unsubscribe()
    if (!res.writableEnded) res.end()
  }
  req.once('close', close)
  res.once('close', close)
}

function requireAllowedClient(req: IncomingMessage, allowRemoteAccess: boolean): void {
  if (allowRemoteAccess) return
  const address = req.socket.remoteAddress ?? ''
  if (address === '127.0.0.1' || address === '::1' || address.startsWith('::ffff:127.')) return
  throw new RequestError(403, 'remote workbench access is disabled')
}

/**
 * DNS-rebinding guard: the socket may be loopback while the browser targets a
 * rebound foreign hostname. Loopback-only deployments must present a loopback
 * Host header, otherwise a remote page could read `/export` or POST mutations
 * as if it were same-origin.
 */
function requireTrustedHost(req: IncomingMessage, allowRemoteAccess: boolean): void {
  if (allowRemoteAccess) return
  const host = req.headers.host
  if (host === undefined || host.trim() === '') throw new RequestError(403, 'missing host header')
  let hostname: string
  try {
    hostname = new URL(`http://${host}`).hostname.toLowerCase()
  } catch {
    throw new RequestError(403, 'invalid host header')
  }
  if (hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '::1' && hostname !== '[::1]') {
    throw new RequestError(403, `untrusted host header for loopback-only workbench: ${host}`)
  }
}

function requireSameOrigin(req: IncomingMessage): void {
  const fetchSite = req.headers['sec-fetch-site']
  if (fetchSite !== undefined && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    throw new RequestError(403, 'cross-origin mutation request rejected')
  }
  const origin = req.headers.origin
  const host = req.headers.host
  if (origin === undefined || host === undefined) return
  try {
    if (new URL(origin).host !== host) throw new RequestError(403, 'cross-origin mutation request rejected')
  } catch (error) {
    if (error instanceof RequestError) throw error
    throw new RequestError(403, 'invalid origin header')
  }
}

function injectWorkbenchBootstrap(html: string, config: OmvWorkbench['config']): string {
  const marker = 'data-dsh-omv-bootstrap'
  if (html.includes(marker)) return html
  const payload = JSON.stringify({
    apiPrefix: config.apiPrefix,
    projectRoot: config.projectRoot,
    refreshIntervalMs: config.refreshIntervalMs,
  }).replaceAll('<', '\\u003c')
  const script = `<script ${marker}>window.__DSH_OMV__=${payload}</script>`
  return html.includes('</head>') ? html.replace('</head>', `${script}</head>`) : `${script}${html}`
}

function requireJson(req: IncomingMessage): void {
  const contentType = req.headers['content-type'] ?? ''
  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw new RequestError(415, 'content-type must be application/json')
  }
}

async function readJsonBody(req: IncomingMessage, maxBytes: number): Promise<unknown> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += buffer.length
    if (total > maxBytes) throw new RequestError(413, 'request body is too large')
    chunks.push(buffer)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
  } catch {
    throw new RequestError(400, 'request body is not valid JSON')
  }
}

function sendJson(res: ServerResponse, status: number, value: unknown, head = false): void {
  if (res.headersSent) return
  const body = JSON.stringify(value)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.end(head ? undefined : body)
}

function success<T>(data: T): ApiSuccess<T> {
  return { ok: true, data }
}

function protocolFrom(url: URL): '1' | '2' {
  const value = url.searchParams.get('protocol')
  if (value === null || value === '' || value === '2') return '2'
  if (value === '1') return '1'
  throw new RequestError(406, `unsupported dsh-omv protocol: ${value}`)
}

function versioned<T>(data: T, protocol: '1' | '2'): T {
  if (protocol === '2') return data
  return rewriteProtocol(data) as T
}

function rewriteProtocol(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(rewriteProtocol)
  if (!isRecord(value)) return value
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, key === 'protocolVersion' ? '1' : rewriteProtocol(item)]))
}

function failure(error: unknown): ApiFailure {
  return {
    ok: false,
    error: {
      code: error instanceof RequestError ? `HTTP_${error.status}` : 'OMV_WORKBENCH_ERROR',
      message: error instanceof Error ? error.message : String(error),
    },
  }
}

function statusForError(error: unknown): number {
  return error instanceof RequestError ? error.status : 500
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

class RequestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}
