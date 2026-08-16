import type { ClientContext, ISessions, IWorkspaces, JobView, SessionId, SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import type { CommandRowProps, ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-tool/client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  ActionRequest,
  CampaignLaneDispatch,
  CampaignPayload,
  CampaignRun,
  DashboardPayload,
  DedupStatus,
  FindingPayload,
  WorkflowDispatch,
  WorkflowIntent,
  WorkspaceChangeEvent,
  WorkspaceExportPayload,
} from '../contracts.js'
import {
  DEFAULT_OMV_SETTINGS,
  OMV_LOCAL_TAB_KEY,
  OMV_SETTINGS_NAMESPACE,
  OMV_TABS,
  isOmvSettingsTab,
  type OmvSettings,
  type OmvSettingsTab,
} from '../settings.js'
import { ensureWorkbenchStyles } from './styles.js'
import { OMV_COMMANDS, OMV_DISPLAY_NAME } from './types.js'
import type { Dialog, IconName, LauncherInjected, SettingsInjected, Tab, WorkspaceSurfaceInjected } from './types.js'
import { api, apiUrl, configuredRoot, decodeSettings, firstLine, formatTime, localDefaultTab, messageOf, normalizePath, persistDefaultTab, relativeTime, sessionRoot } from './runtime.js'
import {
  CampaignDetail, CommandPalette, Findings, Campaigns, FindingDetail, NewCampaignDialog, NewFindingDialog, WorkbenchErrorState,
  Overview, QualityPage, ReproductionPage, SearchPage,
} from './pages.js'
import { Icon, Loading } from './ui.js'

export const inject = ['slots', 'sessions', 'workspaces', 'settingsScope']

export function apply(ctx: ClientContext): void {
  ensureWorkbenchStyles()
  const root = configuredRoot()
  const sessions = ctx.get('sessions') as unknown as ISessions
  const workspaces = ctx.get('workspaces') as unknown as IWorkspaces
  const settings = ctx.settingsScope.bind<OmvSettings>({
    namespace: OMV_SETTINGS_NAMESPACE,
    decode: decodeSettings,
  })
  const openWorkbench = async (): Promise<void> => {
    const snapshot = workspaces.list.getSnapshot()
    let workspace = snapshot.items.find(item => item.path === root)
    workspace ??= await workspaces.create({ path: root })
    const sessionId = await workspaces.connectWorkspace(workspace.workspaceId)
    sessions.open(sessionId)
  }

  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'dsh-omv-workspace',
    order: 40,
    label: OMV_DISPLAY_NAME,
    inject: (): LauncherInjected => ({ openWorkbench }),
  }, NativeWorkspaceLauncher))

  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'omv-audit',
    order: 20,
    label: OMV_DISPLAY_NAME,
    inject: (sessionId: SessionId): WorkspaceSurfaceInjected => ({
      projectRoot: sessionRoot(sessions, sessionId),
      sessions,
      settings,
      openWorkbench,
      openPath: path => workspaces.openPath(path),
    }),
  }, AuditWorkbenchView))

  ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
    name: 'conversation.session.header.actions',
    id: 'omv-status',
    order: 35,
    inject: (sessionId: SessionId): WorkspaceSurfaceInjected => ({
      projectRoot: sessionRoot(sessions, sessionId),
      sessions,
      settings,
      openWorkbench,
      openPath: path => workspaces.openPath(path),
    }),
  }, AuditHeaderAction))

  ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
    name: 'conversation.composer.dock',
    id: 'omv-context',
    order: 30,
    inject: (sessionId: SessionId): WorkspaceSurfaceInjected => ({
      projectRoot: sessionRoot(sessions, sessionId),
      sessions,
      settings,
      openWorkbench,
      openPath: path => workspaces.openPath(path),
    }),
  }, AuditContextDock))

  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
    name: 'conversation.input.dock',
    id: 'omv-workspace-ready',
    order: 35,
    inject: (sessionId: SessionId): WorkspaceSurfaceInjected => ({
      projectRoot: sessionRoot(sessions, sessionId),
      sessions,
      settings,
    }),
  }, AuditBlankWorkspaceDock))

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'omv-audit',
    order: 18,
    label: OMV_DISPLAY_NAME,
    inject: (): SettingsInjected => ({
      projectRoot: root,
      openWorkbench,
      openPath: path => workspaces.openPath(path),
      settings,
    }),
  }, AuditSettingsSection))

  ctx.slots.inject('conversation.chat.commandview', function* () {
    for (const command of OMV_COMMANDS) {
      yield ctx.slots.register({
        name: 'conversation.chat.commandview',
        key: command,
      }, OmvCommandRow)
    }
  })
}


function NativeWorkspaceLauncher({ wide, openWorkbench }: { wide: boolean } & LauncherInjected) {
  const [dashboard, setDashboard] = useState<DashboardPayload>()
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let active = true
    void api<DashboardPayload>('/dashboard', undefined, configuredRoot())
      .then(data => { if (active) setDashboard(data) })
      .catch(() => {})
    return () => { active = false }
  }, [])
  return (
    <button
      type="button"
      className="omv-launcher"
      aria-label={`打开 ${OMV_DISPLAY_NAME}`}
      title="在 DSH 工作区中打开 OMV 审计台"
      disabled={busy}
      onClick={() => {
        setBusy(true)
        void openWorkbench().finally(() => { setBusy(false) })
      }}
    >
      <Icon name="shield" size={17} />
      {wide && <span className="omv-launcher-label">{OMV_DISPLAY_NAME}</span>}
      {wide && (dashboard?.metrics.blocked ?? 0) > 0 && <span className="omv-launcher-badge">{dashboard?.metrics.blocked}</span>}
    </button>
  )
}

function AuditWorkbenchView({ projectRoot, sessionId, sessions, settings, openWorkbench, openPath, useSessions }: ConvViewProps & WorkspaceSurfaceInjected) {
  const jobs = useSessions(state => state.jobsBySession[sessionId] ?? [])
  return <WorkbenchSurface projectRoot={projectRoot} sessionId={sessionId} sessions={sessions} settings={settings} openWorkbench={openWorkbench} openPath={openPath} jobs={jobs} />
}

function AuditHeaderAction({ projectRoot }: WorkspaceSurfaceInjected) {
  const [metrics, setMetrics] = useState<DashboardPayload['metrics']>()
  const [busy, setBusy] = useState(false)
  const refresh = useCallback(async () => {
    setBusy(true)
    try {
      setMetrics((await api<DashboardPayload>('/dashboard', undefined, projectRoot)).metrics)
      window.dispatchEvent(new CustomEvent('dsh-omv:refresh', { detail: { projectRoot } }))
    } finally {
      setBusy(false)
    }
  }, [projectRoot])
  useEffect(() => { void refresh() }, [refresh])
  return (
    <button
      type="button"
      className="omv-header-action"
      data-alert={(metrics?.blocked ?? 0) > 0 || undefined}
      title={`OMV：${metrics?.active ?? 0} 条活跃发现；点击刷新`}
      aria-label="刷新 OMV 审计台状态"
      disabled={busy}
      onClick={() => { void refresh() }}
    >
      <Icon name="shield" size={14} />
      {(metrics?.active ?? 0) > 0 && <span>{metrics?.active}</span>}
    </button>
  )
}

function AuditContextDock({ projectRoot }: WorkspaceSurfaceInjected) {
  const [dashboard, setDashboard] = useState<DashboardPayload>()
  useEffect(() => {
    let active = true
    void api<DashboardPayload>('/dashboard', undefined, projectRoot)
      .then(data => { if (active) setDashboard(data) })
      .catch(() => {})
    return () => { active = false }
  }, [projectRoot])
  if (dashboard === undefined || dashboard.metrics.active === 0) return null
  return (
    <div className="omv-context-dock" title={projectRoot}>
      <Icon name="shield" size={11} />
      <span>OMV</span>
      <i />
      <span>{dashboard.metrics.active} 活跃</span>
      <span>{dashboard.metrics.confirmed} 已确认</span>
      {dashboard.metrics.blocked > 0 && <b>{dashboard.metrics.blocked} 阻塞</b>}
    </div>
  )
}

function AuditBlankWorkspaceDock({ session, projectRoot }: {
  session: { blank: boolean }
} & WorkspaceSurfaceInjected) {
  const [dashboard, setDashboard] = useState<DashboardPayload>()
  useEffect(() => {
    if (!session.blank) return
    let active = true
    void api<DashboardPayload>('/dashboard', undefined, projectRoot)
      .then(data => { if (active) setDashboard(data) })
      .catch(() => {})
    return () => { active = false }
  }, [projectRoot, session.blank])
  if (!session.blank || dashboard === undefined) return null
  return (
    <div className="omv-blank-dock" title={projectRoot}>
      <Icon name="shield" size={13} />
      <span>OMV 审计台已连接</span>
      <i />
      <b>{dashboard.metrics.active} 条活跃发现</b>
      <span>使用 /omv，或发送首条消息后切换到“OMV 审计台”视图</span>
    </div>
  )
}

function AuditSettingsSection({ close, projectRoot, openWorkbench, openPath, settings }: {
  close: () => void
} & SettingsInjected) {
  const [dashboard, setDashboard] = useState<DashboardPayload>()
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [, refreshSettings] = useState(0)
  useEffect(() => settings.subscribe(() => refreshSettings(value => value + 1)), [settings])
  const settingsSnapshot = settings.getSnapshot()
  const defaultTab = settingsSnapshot.value?.defaultTab ?? localDefaultTab() ?? DEFAULT_OMV_SETTINGS.defaultTab
  useEffect(() => {
    void api<DashboardPayload>('/dashboard', undefined, projectRoot)
      .then(setDashboard)
      .catch(caught => setError(messageOf(caught)))
  }, [projectRoot])
  const launch = async () => {
    setBusy(true)
    try {
      await openWorkbench()
      close()
    } finally {
      setBusy(false)
    }
  }
  const exportSnapshot = async () => {
    setBusy(true)
    try {
      const snapshot = await api<WorkspaceExportPayload>('/export', undefined, projectRoot)
      const blob = new Blob([`${JSON.stringify(snapshot, null, 2)}\n`], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `dsh-omv-export-${new Date().toISOString().replaceAll(':', '-')}.json`
      anchor.click()
      URL.revokeObjectURL(url)
    } finally { setBusy(false) }
  }
  return (
    <div className="omv-settings">
      <div className="omv-settings-title"><Icon name="shield" size={20} /><div><h2>{OMV_DISPLAY_NAME}</h2><p>DSH 原生 Evidence.v1 工作区</p></div></div>
      {error !== undefined && <div className="omv-error">{error}</div>}
      <section className="omv-settings-card">
        <div className="omv-settings-row"><span>默认工作区</span><code title={projectRoot}>{projectRoot}</code></div>
        <div className="omv-settings-row"><span>工作区状态</span><b>{dashboard === undefined ? '同步中' : dashboard.workspace.staleIndex ? '索引需刷新' : '正常'}</b></div>
        <div className="omv-settings-row"><span>写入动作</span><b>{dashboard?.config.allowMutations === false ? '关闭' : '开启'}</b></div>
        <div className="omv-settings-row"><span>当前发现</span><b>{dashboard?.metrics.active ?? '—'}</b></div>
        <div className="omv-settings-row"><span>Agent 能力</span><b>22 工具 · 19 命令</b></div>
        <div className="omv-settings-row"><span>默认视图</span><select className="omv-settings-select" value={defaultTab} onChange={event => { persistDefaultTab(settings, event.target.value as Tab) }}>
          <option value="overview">总览</option><option value="findings">漏洞</option><option value="quality">质量</option><option value="reproduction">复现</option><option value="campaigns">战役</option><option value="search">搜索</option>
        </select></div>
      </section>
      <div className="omv-settings-actions">
        <button type="button" className="omv-secondary" onClick={() => { void openPath(`${projectRoot}/.omv`) }}>打开 .omv</button>
        <button type="button" className="omv-secondary" disabled={busy} onClick={() => { void exportSnapshot() }}>导出快照</button>
        <button type="button" className="omv-primary" disabled={busy} onClick={() => { void launch() }}>进入审计工作区</button>
      </div>
      <p className="omv-settings-help">在任意 DSH 工作区中使用“OMV 审计台”会话视图；Agent 工具和 /omv 系列命令会自动绑定当前会话目录。</p>
    </div>
  )
}

function OmvCommandRow({ node }: CommandRowProps) {
  const state = node.outcome === null ? 'running' : node.outcome.kind
  const title = node.name === null ? 'omv' : `/${node.name}${node.args ?? ''}`
  const summary = node.outcome === null ? '正在执行 OMV 工作区动作…' : node.outcome.text ?? (state === 'success' ? '执行完成' : '执行失败')
  return (
    <div className="omv-command-row" data-state={state} title={summary}>
      <span className="omv-command-icon"><Icon name="shield" size={14} /></span>
      <code>{title}</code><i />
      <span>{firstLine(summary)}</span>
    </div>
  )
}

function WorkbenchSurface({ projectRoot, sessionId, sessions, settings, openWorkbench, openPath, jobs }: WorkspaceSurfaceInjected & { sessionId: SessionId; jobs: readonly JobView[] }) {
  const [tab, setTab] = useState<Tab>(() => settings.getSnapshot().value?.defaultTab ?? localDefaultTab() ?? DEFAULT_OMV_SETTINGS.defaultTab)
  const [dashboard, setDashboard] = useState<DashboardPayload>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [refreshError, setRefreshError] = useState<string>()
  const [lastUpdated, setLastUpdated] = useState<string>()
  const [detail, setDetail] = useState<FindingPayload>()
  const [campaignDetail, setCampaignDetail] = useState<CampaignPayload>()
  const [detailLoading, setDetailLoading] = useState(false)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ kind: 'ok' | 'error'; message: string }>()
  const [live, setLive] = useState<'connecting' | 'live' | 'fallback'>('connecting')
  const detailRef = useRef<FindingPayload>()
  const campaignDetailRef = useRef<CampaignPayload>()
  const pumpingRuns = useRef(new Set<string>())

  useEffect(() => settings.subscribe(() => {
    const next = settings.getSnapshot().value?.defaultTab
    if (next !== undefined) setTab(next)
  }), [settings])

  const selectTab = useCallback((next: Tab) => {
    setTab(next)
    persistDefaultTab(settings, next)
  }, [settings])

  const loadDashboard = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      const next = await api<DashboardPayload>('/dashboard', undefined, projectRoot)
      setDashboard(next)
      setError(undefined)
      setRefreshError(undefined)
      setLastUpdated(next.generatedAt)
    } catch (caught) {
      const message = messageOf(caught)
      if (quiet) setRefreshError(message)
      else setError(message)
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [projectRoot])

  useEffect(() => { void loadDashboard() }, [loadDashboard])
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandPaletteOpen(true)
        return
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target !== null && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return
      const index = event.key === '0' ? 10 : Number(event.key)
      if (Number.isInteger(index) && index >= 1 && index <= OMV_TABS.length) {
        event.preventDefault()
        const next = OMV_TABS[index - 1]
        if (next !== undefined) selectTab(next)
      } else if (event.key.toLowerCase() === 'r') {
        event.preventDefault()
        void loadDashboard()
      } else if (event.key === '/') {
        event.preventDefault()
        selectTab('search')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [loadDashboard, selectTab])
  useEffect(() => {
    const interval = window.__DSH_OMV__?.refreshIntervalMs ?? 15_000
    if (interval <= 0) return
    const id = window.setInterval(() => { void loadDashboard(true) }, interval)
    return () => window.clearInterval(id)
  }, [loadDashboard])
  useEffect(() => {
    const onRefresh = (event: Event) => {
      const root = (event as CustomEvent<{ projectRoot?: string }>).detail?.projectRoot
      if (root === undefined || root === projectRoot) void loadDashboard(true)
    }
    window.addEventListener('dsh-omv:refresh', onRefresh)
    return () => { window.removeEventListener('dsh-omv:refresh', onRefresh) }
  }, [loadDashboard, projectRoot])
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (dialog !== null) setDialog(null)
      else if (commandPaletteOpen) setCommandPaletteOpen(false)
      else if (detail !== undefined) setDetail(undefined)
      else if (campaignDetail !== undefined) setCampaignDetail(undefined)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => { window.removeEventListener('keydown', onKeyDown) }
  }, [campaignDetail, commandPaletteOpen, detail, dialog])
  useEffect(() => {
    if (toast === undefined) return
    const id = window.setTimeout(() => setToast(undefined), 3200)
    return () => window.clearTimeout(id)
  }, [toast])

  const showFinding = useCallback(async (id: string, archived = false) => {
    setDetail(undefined)
    setDetailLoading(true)
    try {
      const query = new URLSearchParams({ id, ...(archived ? { archived: 'true' } : {}) })
      setDetail(await api<FindingPayload>(`/finding?${query}`, undefined, projectRoot))
    } catch (caught) {
      setToast({ kind: 'error', message: messageOf(caught) })
    } finally {
      setDetailLoading(false)
    }
  }, [projectRoot])

  const showCampaign = useCallback(async (id: string) => {
    setCampaignDetail(undefined)
    setDetailLoading(true)
    try {
      setCampaignDetail(await api<CampaignPayload>(`/campaign?id=${encodeURIComponent(id)}`, undefined, projectRoot))
    } catch (caught) {
      setToast({ kind: 'error', message: messageOf(caught) })
    } finally {
      setDetailLoading(false)
    }
  }, [projectRoot])

  useEffect(() => { detailRef.current = detail }, [detail])
  useEffect(() => { campaignDetailRef.current = campaignDetail }, [campaignDetail])

  useEffect(() => {
    if (typeof EventSource === 'undefined') {
      setLive('fallback')
      return
    }
    const source = new EventSource(apiUrl('/events', projectRoot))
    source.addEventListener('ready', () => setLive('live'))
    source.addEventListener('workspace', event => {
      setLive('live')
      const change = JSON.parse((event as MessageEvent<string>).data) as WorkspaceChangeEvent
      window.dispatchEvent(new CustomEvent('dsh-omv:refresh', { detail: change }))
      void loadDashboard(true)
      const current = detailRef.current
      if (current !== undefined) void showFinding(current.detail.id, current.detail.archived)
      const currentCampaign = campaignDetailRef.current
      if (currentCampaign !== undefined) void showCampaign(currentCampaign.campaign.id)
    })
    source.onerror = () => setLive('fallback')
    return () => source.close()
  }, [loadDashboard, projectRoot, showFinding])

  const perform = useCallback(async (request: ActionRequest, successMessage: string) => {
    setBusy(true)
    try {
      await api('/action', { method: 'POST', body: JSON.stringify(request) }, projectRoot)
      setToast({ kind: 'ok', message: successMessage })
      await loadDashboard(true)
      if (request.id !== undefined && detail?.detail.id === request.id && request.action !== 'finding.archive') {
        await showFinding(request.id)
      }
      if (request.action === 'finding.archive') setDetail(undefined)
      return true
    } catch (caught) {
      setToast({ kind: 'error', message: messageOf(caught) })
      return false
    } finally {
      setBusy(false)
    }
  }, [detail?.detail.id, loadDashboard, projectRoot, showFinding])

  const startWorkflow = useCallback(async (intent: WorkflowIntent) => {
    const finding = detailRef.current
    if (finding === undefined) return
    setBusy(true)
    try {
      const dispatch = await api<WorkflowDispatch>('/action', {
        method: 'POST',
        body: JSON.stringify({ action: 'workflow.start', id: finding.detail.id, intent, sessionId } satisfies ActionRequest),
      }, projectRoot)
      const scope = sessions.scope(sessionId)
      const face = scope === undefined ? undefined : sessions.sessionOf(scope)
      if (face === undefined) throw new Error('当前 DSH 会话尚未就绪')
      const accepted = await face.prompt([{ type: 'text', text: dispatch.prompt }], 'queue')
      if (!accepted.ok) throw new Error(`${accepted.error.code}: ${accepted.error.message}`)
      setToast({ kind: 'ok', message: `${dispatch.label}已发送到当前会话；可切换到“对话”或“轨迹”查看执行` })
      await showFinding(finding.detail.id)
    } catch (caught) {
      setToast({ kind: 'error', message: messageOf(caught) })
    } finally {
      setBusy(false)
    }
  }, [projectRoot, sessionId, sessions, showFinding])

  const linkCurrentSession = useCallback(async () => {
    const finding = detailRef.current
    if (finding === undefined) return
    await perform({ action: 'session.link', id: finding.detail.id, sessionId }, '已关联当前 DSH 会话')
  }, [perform, sessionId])

  const openLinkedSession = useCallback((linkedSessionId: string) => {
    const id = linkedSessionId as SessionId
    if (sessions.list.getSnapshot().byId[id] === undefined) {
      setToast({ kind: 'error', message: '关联会话当前未加载，仍可从 DSH 左侧会话列表恢复' })
      return
    }
    sessions.open(id)
  }, [sessions])

  const pumpCampaignRun = useCallback(async (runId: string) => {
    if (pumpingRuns.current.has(runId)) return
    pumpingRuns.current.add(runId)
    try {
      const dispatches = await api<CampaignLaneDispatch[]>('/action', { method: 'POST', body: JSON.stringify({ action: 'campaign.run.claim', runId } satisfies ActionRequest) }, projectRoot)
      for (const dispatch of dispatches) {
        let childId: SessionId | undefined
        try {
          childId = await sessions.fork({ sessionId: dispatch.parentSessionId as SessionId, increaseTitle: true })
          const scope = sessions.scope(childId)
          const face = scope === undefined ? undefined : sessions.sessionOf(scope)
          if (face === undefined) throw new Error('新建 Lane 会话尚未就绪')
          await api<CampaignRun>('/action', { method: 'POST', body: JSON.stringify({ action: 'campaign.run.bind', runId, laneId: dispatch.laneId, sessionId: childId } satisfies ActionRequest) }, projectRoot)
          const renamed = await face.rename(`OMV · ${dispatch.campaignId}/${dispatch.laneId}`)
          if (!renamed.ok) throw new Error(`${renamed.error.code}: ${renamed.error.message}`)
          const accepted = await face.prompt([{ type: 'text', text: dispatch.prompt }], 'queue')
          if (!accepted.ok) throw new Error(`${accepted.error.code}: ${accepted.error.message}`)
        } catch (caught) {
          await api('/action', { method: 'POST', body: JSON.stringify({
            action: 'campaign.run.lane.update', runId, laneId: dispatch.laneId, laneStatus: 'failed',
            ...(childId === undefined ? {} : { sessionId: childId }), summary: messageOf(caught),
          } satisfies ActionRequest) }, projectRoot)
        }
      }
      const current = campaignDetailRef.current
      if (current !== undefined) await showCampaign(current.campaign.id)
    } finally { pumpingRuns.current.delete(runId) }
  }, [projectRoot, sessions, showCampaign])

  useEffect(() => {
    const run = campaignDetail?.runs.find(item => item.status === 'queued' || item.status === 'running')
    if (run === undefined || !run.lanes.some(lane => lane.status === 'queued')) return
    void pumpCampaignRun(run.id)
  }, [campaignDetail, pumpCampaignRun])

  useEffect(() => {
    const run = campaignDetail?.runs.find(item => item.status === 'queued' || item.status === 'running' || item.status === 'paused')
    if (run === undefined) return
    let active = true
    void api<CampaignRun>('/action', { method: 'POST', body: JSON.stringify({ action: 'campaign.run.reconcile', runId: run.id } satisfies ActionRequest) }, projectRoot)
      .then(reconciled => { if (active && reconciled.updatedAt !== run.updatedAt) void showCampaign(reconciled.campaignId) })
      .catch(() => {})
    return () => { active = false }
  }, [campaignDetail, projectRoot, showCampaign])

  const startCampaign = useCallback(async (campaignId: string) => {
    setBusy(true)
    try {
      await api('/action', { method: 'POST', body: JSON.stringify({ action: 'campaign.seed', id: campaignId, sessionId } satisfies ActionRequest) }, projectRoot)
      const run = await api<CampaignRun>('/action', { method: 'POST', body: JSON.stringify({ action: 'campaign.run.create', id: campaignId, sessionId, concurrency: dashboard?.config.campaignConcurrency ?? 3 } satisfies ActionRequest) }, projectRoot)
      setToast({ kind: 'ok', message: `Campaign Runner 已启动：${run.lanes.length} 条 Lane · 并发 ${run.concurrency}` })
      await loadDashboard(true)
      await showCampaign(campaignId)
      await pumpCampaignRun(run.id)
    } catch (caught) {
      setToast({ kind: 'error', message: messageOf(caught) })
    } finally {
      setBusy(false)
    }
  }, [dashboard?.config.campaignConcurrency, loadDashboard, projectRoot, pumpCampaignRun, sessionId, showCampaign])

  const controlCampaignRun = useCallback(async (runId: string, control: 'pause' | 'resume' | 'cancel' | 'retry', laneId?: string) => {
    setBusy(true)
    try {
      if (control === 'cancel') {
        const run = await api<CampaignRun>(`/campaign-run?id=${encodeURIComponent(runId)}`, undefined, projectRoot)
        for (const lane of run.lanes) {
          if (lane.sessionId === undefined || (lane.status !== 'running' && lane.status !== 'dispatching')) continue
          const scope = sessions.scope(lane.sessionId as SessionId)
          const face = scope === undefined ? undefined : sessions.sessionOf(scope)
          if (face !== undefined) await face.cancel()
        }
      }
      const run = await api<CampaignRun>('/action', { method: 'POST', body: JSON.stringify({ action: 'campaign.run.control', runId, control, ...(laneId === undefined ? {} : { laneId }) } satisfies ActionRequest) }, projectRoot)
      setToast({ kind: 'ok', message: `Campaign Run 已${control === 'pause' ? '暂停' : control === 'resume' ? '恢复' : control === 'cancel' ? '取消' : '加入重试队列'}` })
      const current = campaignDetailRef.current
      if (current !== undefined) await showCampaign(current.campaign.id)
      if (control === 'resume' || control === 'retry') await pumpCampaignRun(run.id)
    } catch (caught) { setToast({ kind: 'error', message: messageOf(caught) }) } finally { setBusy(false) }
  }, [projectRoot, pumpCampaignRun, sessions, showCampaign])

  const startReproduction = useCallback(async (findingId: string, command?: string) => {
    await perform({ action: 'repro.run.start', id: findingId, sessionId, ...(command === undefined || command.trim() === '' ? {} : { command }) }, '复现 Run 已启动')
  }, [perform, sessionId])

  const scanDedup = useCallback(async (findingId: string) => {
    await perform({ action: 'dedup.scan', id: findingId, sessionId }, '去重扫描已完成')
  }, [perform, sessionId])

  const updateDedup = useCallback(async (findingId: string, status: DedupStatus, matchId?: string) => {
    await perform({ action: 'dedup.update', id: findingId, dedupStatus: status, sessionId, ...(matchId === undefined ? {} : { matchId }) }, '去重结论已更新')
  }, [perform, sessionId])

  const retryJob = useCallback(async (job: JobView) => {
    setBusy(true)
    try {
      const scope = sessions.scope(sessionId)
      const face = scope === undefined ? undefined : sessions.sessionOf(scope)
      if (face === undefined) throw new Error('当前 DSH 会话尚未就绪')
      const prompt = `重试当前会话中失败的 DSH 后台任务 ${job.id}：${job.label}。先检查对话与轨迹里的失败原因和 detail（${job.detail ?? 'unknown'}），修正参数或前置条件后重新执行；保留原失败记录，不覆盖证据。`
      const accepted = await face.prompt([{ type: 'text', text: prompt }], 'queue')
      if (!accepted.ok) throw new Error(`${accepted.error.code}: ${accepted.error.message}`)
      setToast({ kind: 'ok', message: `重试请求已发送：${job.id}` })
    } catch (caught) {
      setToast({ kind: 'error', message: messageOf(caught) })
    } finally { setBusy(false) }
  }, [sessionId, sessions])

  const openConfigured = openWorkbench !== undefined && normalizePath(projectRoot) !== normalizePath(configuredRoot()) ? openWorkbench : undefined

  return (
    <div className="omv-native-view" aria-label={OMV_DISPLAY_NAME} aria-busy={busy}>
      <AuditToolbar
        tab={tab}
        dashboard={dashboard}
        busy={busy}
        live={live}
        jobs={jobs}
        lastUpdated={lastUpdated}
        refreshError={refreshError}
        onTab={selectTab}
        onRefresh={() => { void loadDashboard() }}
        onCommandPalette={() => setCommandPaletteOpen(true)}
      />
      <div className="omv-content">
        <main className="omv-content-inner" id="omv-workbench-panel" aria-live="polite">
          {loading && dashboard === undefined ? <Loading /> : error !== undefined && dashboard === undefined ? (
            <WorkbenchErrorState
              error={error}
              projectRoot={projectRoot}
              configuredRoot={configuredRoot()}
              onRetry={() => { void loadDashboard() }}
              onOpenConfigured={openWorkbench}
              onOpenPath={openPath === undefined ? undefined : () => { void openPath(`${projectRoot}/.omv`) }}
            />
          ) : dashboard !== undefined ? (
            <>
              {tab === 'overview' && <Overview data={dashboard} jobs={jobs} onRetryJob={job => { void retryJob(job) }} onTab={selectTab} onFinding={id => { void showFinding(id) }} onNew={() => setDialog('finding')} onOpenConfigured={openConfigured} />}
              {tab === 'findings' && <Findings data={dashboard} onFinding={(id, archived) => { void showFinding(id, archived) }} onNew={() => setDialog('finding')} onOpenConfigured={openConfigured} />}
              {tab === 'quality' && <QualityPage data={dashboard} onTab={selectTab} onFinding={id => { void showFinding(id) }} onOpenConfigured={openConfigured} />}
              {tab === 'reproduction' && <ReproductionPage data={dashboard} onFinding={id => { void showFinding(id) }} onStart={id => { void startReproduction(id) }} />}
              {tab === 'campaigns' && <Campaigns data={dashboard} busy={busy} onCampaign={id => { void showCampaign(id) }} onNew={() => setDialog('campaign')} onRepair={id => { void perform({ action: 'campaign.repair', id }, 'Campaign 配置已修复') }} />}
              {tab === 'search' && <SearchPage projectRoot={projectRoot} onFinding={(id, archived) => { void showFinding(id, archived) }} onCampaign={id => { void showCampaign(id) }} />}
            </>
          ) : null}
        </main>
      </div>
      {detailLoading && <div className="omv-detail-backdrop"><Loading label="读取 Evidence.v1…" /></div>}
      {detail !== undefined && <FindingDetail
        payload={detail}
        busy={busy}
        currentSessionId={sessionId}
        onClose={() => setDetail(undefined)}
        onAction={(request, message) => { void perform({ ...request, sessionId }, message) }}
        onWorkflow={intent => { void startWorkflow(intent) }}
        onLink={() => { void linkCurrentSession() }}
        onOpenSession={openLinkedSession}
        onStartReproduction={id => { void startReproduction(id) }}
        onScanDedup={id => { void scanDedup(id) }}
        onUpdateDedup={(id, status, matchId) => { void updateDedup(id, status, matchId) }}
      />}
      {campaignDetail !== undefined && <CampaignDetail payload={campaignDetail} busy={busy} currentSessionId={sessionId} onClose={() => setCampaignDetail(undefined)} onStart={() => { void startCampaign(campaignDetail.campaign.id) }} onControl={(runId, control, laneId) => { void controlCampaignRun(runId, control, laneId) }} onOpenSession={openLinkedSession} />}
      {dialog === 'finding' && <NewFindingDialog busy={busy} onClose={() => setDialog(null)} onSubmit={async request => { if (await perform(request, '候选漏洞已创建')) setDialog(null) }} />}
      {dialog === 'campaign' && <NewCampaignDialog busy={busy} onClose={() => setDialog(null)} onSubmit={async request => { if (await perform(request, '审计战役已创建')) setDialog(null) }} />}
      {commandPaletteOpen && <CommandPalette tab={tab} onTab={next => { selectTab(next); setCommandPaletteOpen(false) }} onNewFinding={() => { setDialog('finding'); setCommandPaletteOpen(false) }} onNewCampaign={() => { setDialog('campaign'); setCommandPaletteOpen(false) }} onClose={() => setCommandPaletteOpen(false)} />}
      {toast !== undefined && <div className="omv-toast" role={toast.kind === 'error' ? 'alert' : 'status'} data-kind={toast.kind === 'error' ? 'error' : undefined}><span>{toast.message}</span><button type="button" aria-label="关闭提示" onClick={() => setToast(undefined)}><Icon name="close" size={12} /></button></div>}
    </div>
  )
}


function AuditToolbar({ tab, dashboard, busy, live, jobs, lastUpdated, refreshError, onTab, onRefresh, onCommandPalette }: {
  tab: Tab
  dashboard: DashboardPayload | undefined
  busy: boolean
  live: 'connecting' | 'live' | 'fallback'
  jobs: readonly JobView[]
  lastUpdated: string | undefined
  refreshError: string | undefined
  onTab: (tab: Tab) => void
  onRefresh: () => void
  onCommandPalette: () => void
}) {
  const items: { id: Tab; label: string; icon: IconName; count?: number | undefined }[] = [
    { id: 'overview', label: '总览', icon: 'grid' },
    { id: 'findings', label: '漏洞', icon: 'finding', count: dashboard?.metrics.active },
    { id: 'quality', label: '质量', icon: 'gauge', count: dashboard?.quality.issues.length },
    { id: 'reproduction', label: '复现', icon: 'pulse', count: dashboard?.metrics.activeReproductions },
    { id: 'campaigns', label: '战役', icon: 'radar', count: dashboard?.metrics.campaigns },
    { id: 'search', label: '搜索', icon: 'search' },
  ]
  return (
    <div className="omv-native-toolbar">
      <nav className="omv-nav" aria-label={`${OMV_DISPLAY_NAME}视图`} role="tablist">
        {items.map((item, index) => {
          const shortcut = index === 9 ? '0' : String(index + 1)
          return <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} aria-controls="omv-workbench-panel" aria-keyshortcuts={shortcut} title={`${item.label}（快捷键 ${shortcut}）`} className="omv-nav-button" data-active={tab === item.id} onClick={() => onTab(item.id)}><Icon name={item.icon} size={13} /><span>{item.label}</span>{item.count !== undefined && <b className="omv-nav-count">{item.count}</b>}</button>
        })}
      </nav>
      {jobs.some(job => job.status === 'running' || job.status === 'stopping') && <span className="omv-jobs-badge" title={jobs.map(job => `${job.id}: ${job.label} · ${job.status}`).join('\n')}><Icon name="pulse" size={11} />{jobs.filter(job => job.status === 'running' || job.status === 'stopping').length} 任务</span>}
      <span className="omv-live" data-state={live} title={live === 'live' ? '工作区文件变化将实时同步' : '实时连接恢复前使用定时刷新'}><i />{live === 'live' ? '实时' : live === 'connecting' ? '连接中' : '轮询'}</span>
      <code className="omv-workspace-path" title={dashboard?.config.projectRoot}>{dashboard?.config.projectRoot ?? '同步工作区…'}</code>
      <span className="omv-sync-meta" title={refreshError ?? (lastUpdated === undefined ? '等待首次同步' : `上次同步：${formatTime(lastUpdated)}`)}>{refreshError === undefined ? (lastUpdated === undefined ? '同步中' : `更新于 ${relativeTime(lastUpdated)}`) : '同步失败'}</span>
      <button type="button" className="omv-palette-button" onClick={onCommandPalette} title="打开命令面板（⌘K / Ctrl K）"><Icon name="search" size={12} /><span>命令</span><kbd>⌘K</kbd></button>
      <button type="button" className="omv-icon-button" aria-label={refreshError === undefined ? '刷新 OMV 工作区' : '重试同步 OMV 工作区'} disabled={busy} onClick={onRefresh}><Icon name="refresh" size={14} /></button>
    </div>
  )
}
