import { useCallback, useEffect, useRef, useState } from 'react'
import type { ISessions, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { ActionRequest, CampaignLaneDispatch, CampaignRun, DashboardPayload } from '../contracts.js'
import { api, apiUrl, messageOf } from './runtime.js'
import { runActive, runNeedsPump } from './derive.js'

/**
 * Client hooks extracted from WorkbenchSurface so the component composes
 * behavior instead of owning it. All orchestration here survives detail-panel
 * visibility changes (campaign pumping no longer depends on an open modal).
 */

export interface DashboardState {
  dashboard: DashboardPayload | undefined
  loading: boolean
  error: string | undefined
  refreshError: string | undefined
  lastUpdated: string | undefined
  reload: () => Promise<void>
  refreshQuietly: () => Promise<void>
  /** Post-mutation refresh: waits out any stale in-flight poll, then always applies. */
  refreshForced: () => Promise<void>
}

const REFRESH_INTERVAL_MS = 15_000

/**
 * Dashboard loading with three refresh sources (initial, timer, SSE/action)
 * coalesced through a single in-flight promise, and identical payloads
 * (same generatedAt) skip setState to avoid full-tree re-renders.
 */
export function useDashboard(projectRoot: string): DashboardState {
  const [dashboard, setDashboard] = useState<DashboardPayload>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [refreshError, setRefreshError] = useState<string>()
  const [lastUpdated, setLastUpdated] = useState<string>()
  const dashboardRef = useRef<DashboardPayload>()
  const inFlight = useRef<Promise<void>>()

  const load = useCallback(async (quiet: boolean, force = false) => {
    if (!force && inFlight.current !== undefined) return inFlight.current
    const request = (async () => {
      // A forced refresh must not observe a snapshot taken before the mutation.
      if (force && inFlight.current !== undefined) await inFlight.current.catch(() => undefined)
      if (!quiet) setLoading(true)
      try {
        const next = await api<DashboardPayload>('/dashboard', undefined, projectRoot)
        const previous = dashboardRef.current
        if (force || previous === undefined || next.generatedAt !== previous.generatedAt) {
          dashboardRef.current = next
          setDashboard(next)
        }
        setError(undefined)
        setRefreshError(undefined)
        setLastUpdated(next.generatedAt)
      } catch (caught) {
        const message = messageOf(caught)
        if (quiet) setRefreshError(message)
        else setError(message)
      } finally {
        if (!quiet) setLoading(false)
        inFlight.current = undefined
      }
    })()
    inFlight.current = request
    return request
  }, [projectRoot])

  const reload = useCallback(() => load(false), [load])
  const refreshQuietly = useCallback(() => load(true), [load])
  const refreshForced = useCallback(() => load(true, true), [load])

  useEffect(() => { void reload() }, [reload])

  useEffect(() => {
    const interval = window.__DSH_OMV__?.refreshIntervalMs ?? REFRESH_INTERVAL_MS
    if (interval <= 0) return
    const id = window.setInterval(() => { void refreshQuietly() }, interval)
    return () => window.clearInterval(id)
  }, [refreshQuietly])

  return { dashboard, loading, error, refreshError, lastUpdated, reload, refreshQuietly, refreshForced }
}

export interface OmvEventsState {
  live: 'connecting' | 'live' | 'fallback'
}

/**
 * SSE subscription plus the cross-component refresh bus. Workspace events are
 * parsed defensively: a malformed frame downgrades to fallback instead of
 * throwing inside the listener.
 */
export function useOmvEvents(projectRoot: string, onWorkspaceChange: () => void): OmvEventsState {
  const [live, setLive] = useState<'connecting' | 'live' | 'fallback'>('connecting')
  const changeRef = useRef(onWorkspaceChange)
  useEffect(() => { changeRef.current = onWorkspaceChange }, [onWorkspaceChange])

  useEffect(() => {
    const onRefresh = (event: Event) => {
      const root = (event as CustomEvent<{ projectRoot?: string }>).detail?.projectRoot
      if (root === undefined || root === projectRoot) changeRef.current()
    }
    window.addEventListener('dsh-omv:refresh', onRefresh)
    return () => window.removeEventListener('dsh-omv:refresh', onRefresh)
  }, [projectRoot])

  useEffect(() => {
    if (typeof EventSource === 'undefined') {
      setLive('fallback')
      return
    }
    const source = new EventSource(apiUrl('/events', projectRoot))
    source.addEventListener('ready', () => setLive('live'))
    source.addEventListener('workspace', event => {
      setLive('live')
      try {
        JSON.parse((event as MessageEvent<string>).data)
        changeRef.current()
      } catch {
        setLive('fallback')
      }
    })
    source.onerror = () => setLive('fallback')
    return () => source.close()
  }, [projectRoot])

  return { live }
}

export interface ActionState {
  /** True while any action is in flight — coarse signal for aria-busy and global buttons. */
  anyBusy: boolean
  isBusy: (...keys: string[]) => boolean
  /** Runs the action under a key so only the originating control shows progress. */
  run: (key: string, task: () => Promise<void>) => Promise<void>
}

/** Per-action busy tracking replacing the single global freeze. */
export function useActionState(): ActionState {
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set())
  const isBusy = useCallback((...keys: string[]) => keys.some(key => pending.has(key)), [pending])
  const run = useCallback(async (key: string, task: () => Promise<void>) => {
    setPending(previous => new Set(previous).add(key))
    try {
      await task()
    } finally {
      setPending(previous => {
        const next = new Set(previous)
        next.delete(key)
        return next
      })
    }
  }, [])
  return { anyBusy: pending.size > 0, isBusy, run }
}

export interface CampaignRunnerOptions {
  projectRoot: string
  sessions: ISessions
  /** Refresh the visible detail panel after runs change; may be a no-op when closed. */
  onCampaignUpdated: (campaignId: string) => void
  onToast: (kind: 'ok' | 'error', message: string) => void
  runAction: (key: string, task: () => Promise<void>) => Promise<void>
}

export interface CampaignRunner {
  /** Start tracking a run (idempotent) so it keeps being pumped and reconciled even with the detail panel closed. */
  watch: (run: Pick<CampaignRun, 'id' | 'campaignId' | 'status'>) => void
  /** Dispatch queued lanes into forked DSH sessions now. */
  pump: (runId: string) => Promise<void>
  /** Pause / resume / cancel / retry, cancelling lane sessions on cancel. */
  control: (runId: string, control: 'pause' | 'resume' | 'cancel' | 'retry', laneId?: string) => Promise<void>
}

const RECONCILE_INTERVAL_MS = 5_000

/**
 * Campaign orchestration detached from view state. Watched runs live in a ref
 * (not component state), so closing the detail panel no longer stalls queued
 * lanes. A single interval reconciles every watched active run; the reconcile
 * result drives both lane pumping and detail refresh.
 */
export function useCampaignRunner(options: CampaignRunnerOptions): CampaignRunner {
  const { projectRoot, sessions, onCampaignUpdated, onToast, runAction } = options
  const watched = useRef(new Map<string, string>())
  const lastSeen = useRef(new Map<string, string>())
  const pumping = useRef(new Set<string>())
  const optionsRef = useRef({ projectRoot, sessions, onCampaignUpdated })
  useEffect(() => { optionsRef.current = { projectRoot, sessions, onCampaignUpdated } }, [projectRoot, sessions, onCampaignUpdated])

  const pump = useCallback(async (runId: string) => {
    if (pumping.current.has(runId)) return
    pumping.current.add(runId)
    const { projectRoot: root, sessions: faces, onCampaignUpdated: notify } = optionsRef.current
    try {
      const dispatches = await api<CampaignLaneDispatch[]>('/action', {
        method: 'POST',
        body: JSON.stringify({ action: 'campaign.run.claim', runId } satisfies ActionRequest),
      }, root)
      for (const dispatch of dispatches) {
        let childId: SessionId | undefined
        try {
          childId = await faces.fork({ sessionId: dispatch.parentSessionId as SessionId, increaseTitle: true })
          const scope = faces.scope(childId)
          const face = scope === undefined ? undefined : faces.sessionOf(scope)
          if (face === undefined) throw new Error('新建 Lane 会话尚未就绪')
          await api('/action', { method: 'POST', body: JSON.stringify({ action: 'campaign.run.bind', runId, laneId: dispatch.laneId, sessionId: childId } satisfies ActionRequest) }, root)
          const renamed = await face.rename(`OMV · ${dispatch.campaignId}/${dispatch.laneId}`)
          if (!renamed.ok) throw new Error(`${renamed.error.code}: ${renamed.error.message}`)
          const accepted = await face.prompt([{ type: 'text', text: dispatch.prompt }], 'queue')
          if (!accepted.ok) throw new Error(`${accepted.error.code}: ${accepted.error.message}`)
        } catch (caught) {
          await api('/action', { method: 'POST', body: JSON.stringify({
            action: 'campaign.run.lane.update', runId, laneId: dispatch.laneId, laneStatus: 'failed',
            ...(childId === undefined ? {} : { sessionId: childId }), summary: messageOf(caught),
          } satisfies ActionRequest) }, root)
        }
      }
      if (dispatches.length > 0) notify(runId)
    } finally {
      pumping.current.delete(runId)
    }
  }, [])

  const watch = useCallback((run: Pick<CampaignRun, 'id' | 'campaignId' | 'status'>) => {
    watched.current.set(run.id, run.campaignId)
  }, [])

  const control = useCallback(async (runId: string, controlAction: 'pause' | 'resume' | 'cancel' | 'retry', laneId?: string) => {
    await runAction(`campaign.run:${runId}:${controlAction}:${laneId ?? 'all'}`, async () => {
      try {
        if (controlAction === 'cancel') {
          const run = await api<CampaignRun>(`/campaign-run?id=${encodeURIComponent(runId)}`, undefined, projectRoot)
          for (const lane of run.lanes) {
            if (lane.sessionId === undefined || (lane.status !== 'running' && lane.status !== 'dispatching')) continue
            const scope = sessions.scope(lane.sessionId as SessionId)
            const face = scope === undefined ? undefined : sessions.sessionOf(scope)
            if (face !== undefined) await face.cancel()
          }
        }
        const run = await api<CampaignRun>('/action', { method: 'POST', body: JSON.stringify({ action: 'campaign.run.control', runId, control: controlAction, ...(laneId === undefined ? {} : { laneId }) } satisfies ActionRequest) }, projectRoot)
        watched.current.set(run.id, run.campaignId)
        onToast('ok', `Campaign Run 已${controlAction === 'pause' ? '暂停' : controlAction === 'resume' ? '恢复' : controlAction === 'cancel' ? '取消' : '加入重试队列'}`)
        onCampaignUpdated(run.campaignId)
        if (controlAction === 'resume' || controlAction === 'retry') await pump(run.id)
      } catch (caught) {
        onToast('error', messageOf(caught))
      }
    })
  }, [onCampaignUpdated, onToast, projectRoot, pump, runAction, sessions])

  useEffect(() => {
    const id = window.setInterval(() => {
      if (watched.current.size === 0) return
      const { projectRoot: root, onCampaignUpdated: notify } = optionsRef.current
      for (const [runId, campaignId] of watched.current) {
        void api<CampaignRun>('/action', { method: 'POST', body: JSON.stringify({ action: 'campaign.run.reconcile', runId } satisfies ActionRequest) }, root)
          .then(run => {
            const previous = lastSeen.current.get(run.id)
            lastSeen.current.set(run.id, run.updatedAt)
            if (runActive(run)) {
              if (previous !== undefined && previous !== run.updatedAt) notify(campaignId)
              if (runNeedsPump(run)) void pump(run.id)
              return
            }
            watched.current.delete(run.id)
            lastSeen.current.delete(run.id)
            notify(campaignId)
          })
          .catch(() => {})
      }
    }, RECONCILE_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [pump])

  return { watch, pump, control }
}

// ── Canvas viewport (shared by evidence flow + campaign war room) ────────────

export interface CanvasViewportState {
  k: number
  tx: number
  ty: number
}

export interface CanvasViewport {
  viewport: CanvasViewportState
  fit: () => void
  zoomBy: (factor: number) => void
  onWheel: (event: React.WheelEvent) => void
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void
  onPointerMove: (event: React.PointerEvent<HTMLElement>) => void
  onPointerUp: () => void
  onPointerCancel: () => void
}

const CANVAS_MIN_SCALE = 0.4
const CANVAS_MAX_SCALE = 2.2

function clampViewport(viewport: CanvasViewportState, viewWidth: number, viewHeight: number, contentWidth: number, contentHeight: number): CanvasViewportState {
  const margin = 12
  const scaledWidth = contentWidth * viewport.k
  const scaledHeight = contentHeight * viewport.k
  const tx = scaledWidth <= viewWidth - margin * 2
    ? (viewWidth - scaledWidth) / 2
    : Math.min(margin, Math.max(viewWidth - scaledWidth - margin, viewport.tx))
  const ty = scaledHeight <= viewHeight - margin * 2
    ? (viewHeight - scaledHeight) / 2
    : Math.min(margin, Math.max(viewHeight - scaledHeight - margin, viewport.ty))
  return { ...viewport, tx, ty }
}

/**
 * Fit-on-mount / fit-on-resize scale for an oversized SVG canvas plus cursor
 * anchored wheel zoom and drag panning. `resetKey` re-fits whenever the
 * underlying content identity changes (e.g. a new graph).
 */
export function useCanvasViewport(
  containerRef: React.RefObject<HTMLElement | null>,
  contentWidth: number,
  contentHeight: number,
  maxViewHeight = 320,
  resetKey?: string,
): CanvasViewport {
  const [viewport, setViewport] = useState<CanvasViewportState>({ k: 1, tx: 0, ty: 0 })
  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number } | undefined>(undefined)

  const fit = useCallback(() => {
    const width = containerRef.current?.clientWidth ?? 0
    if (width === 0) return
    const k = Math.min(1.08, Math.max(CANVAS_MIN_SCALE, (width - 24) / contentWidth))
    setViewport(clampViewport({ k, tx: 0, ty: 0 }, width, maxViewHeight, contentWidth, contentHeight))
  }, [containerRef, contentHeight, contentWidth, maxViewHeight])

  useEffect(() => { fit() }, [fit, resetKey])

  useEffect(() => {
    const element = containerRef.current
    if (element === null || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => { fit() })
    observer.observe(element)
    return () => observer.disconnect()
  }, [containerRef, fit])

  const zoomBy = useCallback((factor: number) => {
    setViewport(previous => {
      const k = Math.min(CANVAS_MAX_SCALE, Math.max(CANVAS_MIN_SCALE, previous.k * factor))
      const width = containerRef.current?.clientWidth ?? 0
      const cx = width / 2
      return clampViewport({ k, tx: cx - ((cx - previous.tx) / previous.k) * k, ty: previous.ty }, width, maxViewHeight, contentWidth, contentHeight)
    })
  }, [containerRef, contentHeight, contentWidth, maxViewHeight])

  const onWheel = useCallback((event: React.WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey && Math.abs(event.deltaY) < 2) return
    event.preventDefault()
    setViewport(previous => {
      const k = Math.min(CANVAS_MAX_SCALE, Math.max(CANVAS_MIN_SCALE, previous.k * (1 - event.deltaY * 0.0018)))
      const rect = containerRef.current?.getBoundingClientRect()
      const cx = event.clientX - (rect?.left ?? 0)
      const width = containerRef.current?.clientWidth ?? 0
      return clampViewport({ k, tx: cx - ((cx - previous.tx) / previous.k) * k, ty: previous.ty }, width, maxViewHeight, contentWidth, contentHeight)
    })
  }, [containerRef, contentHeight, contentWidth, maxViewHeight])

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    dragRef.current = { x: event.clientX, y: event.clientY, tx: viewport.tx, ty: viewport.ty }
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [viewport.tx, viewport.ty])

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    if (drag === undefined) return
    const width = containerRef.current?.clientWidth ?? 0
    setViewport(previous => clampViewport({ ...previous, tx: drag.tx + (event.clientX - drag.x), ty: drag.ty + (event.clientY - drag.y) }, width, maxViewHeight, contentWidth, contentHeight))
  }, [containerRef, contentHeight, contentWidth, maxViewHeight])

  const onPointerUp = useCallback(() => { dragRef.current = undefined }, [])
  const onPointerCancel = useCallback(() => { dragRef.current = undefined }, [])

  return { viewport, fit, zoomBy, onWheel, onPointerDown, onPointerMove, onPointerUp, onPointerCancel }
}
