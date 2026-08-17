import type { ClientContext, ISessions, IWorkspaces, JobView, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { CommandRowProps, ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-tool/client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  ActionRequest,
  CampaignPayload,
  CampaignRun,
  DashboardPayload,
  DedupStatus,
  FindingPayload,
  WorkflowDispatch,
  WorkflowIntent,
  WorkspaceExportPayload,
} from '../contracts.js'
import {
  DEFAULT_OMV_SETTINGS,
  OMV_SETTINGS_NAMESPACE,
  OMV_TABS,
  type OmvSettings,
} from '../settings.js'
import { ensureWorkbenchStyles } from './styles.js'
import { OMV_COMMANDS, OMV_DISPLAY_NAME } from './types.js'
import type { Dialog, IconName, LauncherInjected, SettingsInjected, Tab, WorkspaceSurfaceInjected } from './types.js'
import { resolveCodeRef } from '../code-ref.js'
import { api, configuredRoot, decodeSettings, firstLine, formatTime, localDefaultTab, messageOf, normalizePath, persistDefaultTab, relativeTime, sessionRoot } from './runtime.js'
import { shouldHandleShortcut } from './derive.js'
import { useActionState, useCampaignRunner, useDashboard, useOmvEvents } from './hooks.js'
import {
  CampaignDetail, CommandPalette, Findings, Campaigns, FindingDetail, NewCampaignDialog, NewFindingDialog, WorkbenchErrorState,
  Overview, ReproductionPage, SearchPage,
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
        <div className="omv-settings-row"><span>Agent 能力</span><b>23 工具 · 20 命令</b></div>
        <div className="omv-settings-row"><span>默认视图</span><select className="omv-settings-select" value={defaultTab} onChange={event => { persistDefaultTab(settings, event.target.value as Tab) }}>
          <option value="overview">总览</option><option value="findings">漏洞</option><option value="reproduction">复现</option><option value="campaigns">审计任务</option><option value="search">搜索</option>
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
  const [detail, setDetail] = useState<FindingPayload>()
  const [detailExpanded, setDetailExpanded] = useState(false)
  const [campaignDetail, setCampaignDetail] = useState<CampaignPayload>()
  const [campaignDetailExpanded, setCampaignDetailExpanded] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [toast, setToast] = useState<{ kind: 'ok' | 'error'; message: string }>()
  const detailRef = useRef<FindingPayload>()
  const campaignDetailRef = useRef<CampaignPayload>()
  const showCampaignRef = useRef<(id: string) => Promise<void>>(async () => {})
  const focusReturnRef = useRef<HTMLElement>()

  const { dashboard, loading, error, refreshError, lastUpdated, reload, refreshQuietly, refreshForced } = useDashboard(projectRoot)
  const { anyBusy, isBusy, run } = useActionState()

  useEffect(() => settings.subscribe(() => {
    const next = settings.getSnapshot().value?.defaultTab
    if (next !== undefined) setTab(next)
  }), [settings])

  const selectTab = useCallback((next: Tab) => {
    setTab(next)
    persistDefaultTab(settings, next)
  }, [settings])

  const captureOverlayFocus = useCallback(() => {
    const active = document.activeElement
    if (active instanceof HTMLElement && active !== document.body) focusReturnRef.current = active
  }, [])
  const restoreOverlayFocus = useCallback(() => {
    const target = focusReturnRef.current
    focusReturnRef.current = undefined
    window.requestAnimationFrame(() => {
      if (target !== undefined && document.contains(target)) target.focus()
    })
  }, [])
  const openDialog = useCallback((next: Exclude<Dialog, null>) => {
    if (!commandPaletteOpen && dialog === null) captureOverlayFocus()
    setDialog(next)
  }, [captureOverlayFocus, commandPaletteOpen, dialog])
  const openCommandPalette = useCallback(() => {
    captureOverlayFocus()
    setCommandPaletteOpen(true)
  }, [captureOverlayFocus])
  const closeCommandPalette = useCallback(() => {
    setCommandPaletteOpen(false)
    if (dialog === null) restoreOverlayFocus()
  }, [dialog, restoreOverlayFocus])
  const closeDialog = useCallback(() => {
    setDialog(null)
    restoreOverlayFocus()
  }, [restoreOverlayFocus])
  const closeFinding = useCallback(() => {
    setDetail(undefined)
    setDetailExpanded(false)
    restoreOverlayFocus()
  }, [restoreOverlayFocus])
  const closeCampaign = useCallback(() => {
    setCampaignDetail(undefined)
    setCampaignDetailExpanded(false)
    restoreOverlayFocus()
  }, [restoreOverlayFocus])

  useEffect(() => {
    if (toast === undefined) return
    const id = window.setTimeout(() => setToast(undefined), 3200)
    return () => window.clearTimeout(id)
  }, [toast])

  const showFinding = useCallback(async (id: string, archived = false) => {
    // Stale-while-revalidate: keep the visible panel until fresh data lands.
    captureOverlayFocus()
    setCampaignDetail(undefined)
    setCampaignDetailExpanded(false)
    if (detailRef.current === undefined) setDetailExpanded(false)
    setDetailLoading(true)
    try {
      const query = new URLSearchParams({ id, ...(archived ? { archived: 'true' } : {}) })
      setDetail(await api<FindingPayload>(`/finding?${query}`, undefined, projectRoot))
    } catch (caught) {
      setToast({ kind: 'error', message: messageOf(caught) })
    } finally {
      setDetailLoading(false)
    }
  }, [captureOverlayFocus, projectRoot])

  const showCampaign = useCallback(async (id: string) => {
    captureOverlayFocus()
    setDetail(undefined)
    setDetailExpanded(false)
    setCampaignDetailExpanded(false)
    setDetailLoading(true)
    try {
      setCampaignDetail(await api<CampaignPayload>(`/campaign?id=${encodeURIComponent(id)}`, undefined, projectRoot))
    } catch (caught) {
      setToast({ kind: 'error', message: messageOf(caught) })
    } finally {
      setDetailLoading(false)
    }
  }, [captureOverlayFocus, projectRoot])
  useEffect(() => { showCampaignRef.current = showCampaign }, [showCampaign])
  useEffect(() => { detailRef.current = detail }, [detail])
  useEffect(() => { campaignDetailRef.current = campaignDetail }, [campaignDetail])

  // Live updates refresh the dashboard and any visible detail panels together.
  const { live } = useOmvEvents(projectRoot, useCallback(() => {
    void refreshQuietly()
    const current = detailRef.current
    if (current !== undefined) void showFinding(current.detail.id, current.detail.archived)
    const currentCampaign = campaignDetailRef.current
    if (currentCampaign !== undefined) void showCampaignRef.current(currentCampaign.campaign.id)
  }, [refreshQuietly, showFinding]))

  // Campaign orchestration lives here, not in the detail panel: watched runs
  // keep pumping and reconciling after the panel closes.
  const campaignRunner = useCampaignRunner({
    projectRoot,
    sessions,
    onCampaignUpdated: campaignId => { void showCampaignRef.current(campaignId) },
    onToast: (kind, message) => setToast({ kind, message }),
    runAction: run,
  })
  useEffect(() => {
    const activeRun = campaignDetail?.runs.find(item => item.status === 'queued' || item.status === 'running' || item.status === 'paused')
    if (activeRun !== undefined) campaignRunner.watch(activeRun)
  }, [campaignDetail, campaignRunner])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        openCommandPalette()
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
      } else if (shouldHandleShortcut(event.target, event.key)) {
        if (event.key.toLowerCase() === 'r') {
          event.preventDefault()
          void reload()
        } else if (event.key === '/') {
          event.preventDefault()
          selectTab('search')
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [openCommandPalette, reload, selectTab])
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (dialog !== null) closeDialog()
      else if (commandPaletteOpen) closeCommandPalette()
      else if (detail !== undefined) closeFinding()
      else if (campaignDetail !== undefined) closeCampaign()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [campaignDetail, closeCampaign, closeCommandPalette, closeDialog, closeFinding, commandPaletteOpen, detail, dialog])

  const perform = useCallback(async (request: ActionRequest, successMessage: string) => {
    let ok = false
    await run(`action:${request.action}:${request.id ?? 'workspace'}`, async () => {
      try {
        await api('/action', { method: 'POST', body: JSON.stringify(request) }, projectRoot)
        setToast({ kind: 'ok', message: successMessage })
        await refreshForced()
        if (request.id !== undefined && detailRef.current?.detail.id === request.id && request.action !== 'finding.archive') {
          await showFinding(request.id)
        }
        if (request.action === 'finding.archive') closeFinding()
        const campaignId = campaignDetailRef.current?.campaign.id
        if (campaignId !== undefined && request.id === campaignId && request.action.startsWith('campaign.')) {
          await showCampaign(campaignId)
        }
        ok = true
      } catch (caught) {
        setToast({ kind: 'error', message: messageOf(caught) })
      }
    })
    return ok
  }, [closeFinding, projectRoot, refreshForced, run, showCampaign, showFinding])

  const startWorkflow = useCallback(async (intent: WorkflowIntent) => {
    const finding = detailRef.current
    if (finding === undefined) return
    await run(`workflow:${intent}:${finding.detail.id}`, async () => {
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
      }
    })
  }, [projectRoot, run, sessionId, sessions, showFinding])

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

  const startCampaign = useCallback(async (campaignId: string) => {
    await run(`campaign.start:${campaignId}`, async () => {
      try {
        await api('/action', { method: 'POST', body: JSON.stringify({ action: 'campaign.seed', id: campaignId, sessionId } satisfies ActionRequest) }, projectRoot)
        const created = await api<CampaignRun>('/action', { method: 'POST', body: JSON.stringify({ action: 'campaign.run.create', id: campaignId, sessionId, concurrency: dashboard?.config.campaignConcurrency ?? 3 } satisfies ActionRequest) }, projectRoot)
        campaignRunner.watch(created)
        setToast({ kind: 'ok', message: `审计任务已启动：${created.lanes.length} 条 Lane · 并发 ${created.concurrency}` })
        await refreshForced()
        await showCampaign(campaignId)
        await campaignRunner.pump(created.id)
      } catch (caught) {
        setToast({ kind: 'error', message: messageOf(caught) })
      }
    })
  }, [campaignRunner, dashboard?.config.campaignConcurrency, projectRoot, refreshForced, run, sessionId, showCampaign])

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
    await run(`job-retry:${job.id}`, async () => {
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
      }
    })
  }, [run, sessionId, sessions])

  const openWorkspacePath = useCallback((rel: string) => {
    if (openPath === undefined) {
      setToast({ kind: 'error', message: '当前宿主未提供打开文件能力' })
      return
    }
    void openPath(resolveCodeRef(projectRoot, { path: rel, note: '' })).catch(caught => {
      setToast({ kind: 'error', message: messageOf(caught) })
    })
  }, [openPath, projectRoot])

  const openConfigured = openWorkbench !== undefined && normalizePath(projectRoot) !== normalizePath(configuredRoot()) ? openWorkbench : undefined

  return (
    <div className="omv-native-view" aria-label={OMV_DISPLAY_NAME} aria-busy={anyBusy}>
      <AuditToolbar
        tab={tab}
        dashboard={dashboard}
        busy={anyBusy}
        live={live}
        jobs={jobs}
        lastUpdated={lastUpdated}
        refreshError={refreshError}
        onTab={selectTab}
        onRefresh={() => { void reload() }}
        onCommandPalette={() => setCommandPaletteOpen(true)}
      />
      <div className="omv-content">
        <main className="omv-content-inner" id="omv-workbench-panel">
          {loading && dashboard === undefined ? <Loading /> : error !== undefined && dashboard === undefined ? (
            <WorkbenchErrorState
              error={error}
              projectRoot={projectRoot}
              configuredRoot={configuredRoot()}
              onRetry={() => { void reload() }}
              onOpenConfigured={openWorkbench}
              onOpenPath={openPath === undefined ? undefined : () => { void openPath(`${projectRoot}/.omv`) }}
            />
          ) : dashboard !== undefined ? (
            <>
              {tab === 'overview' && <Overview data={dashboard} jobs={jobs} onRetryJob={job => { void retryJob(job) }} onTab={selectTab} onFinding={id => { void showFinding(id) }} onNew={() => openDialog('finding')} onOpenConfigured={openConfigured} />}
              {tab === 'findings' && <Findings data={dashboard} onFinding={(id, archived) => { void showFinding(id, archived) }} onNew={() => openDialog('finding')} onOpenConfigured={openConfigured} />}
              {tab === 'reproduction' && <ReproductionPage data={dashboard} onFinding={id => { void showFinding(id) }} onStart={id => { void startReproduction(id) }} onOpenSession={openLinkedSession} />}
              {tab === 'campaigns' && <Campaigns data={dashboard} busy={anyBusy} onCampaign={id => { void showCampaign(id) }} onNew={() => openDialog('campaign')} onRepair={id => { void perform({ action: 'campaign.repair', id }, 'Campaign 配置已修复') }} />}
              {tab === 'search' && <SearchPage projectRoot={projectRoot} onFinding={(id, archived) => { void showFinding(id, archived) }} onCampaign={id => { void showCampaign(id) }} />}
            </>
          ) : null}
        </main>
      </div>
      {detailLoading && detail === undefined && campaignDetail === undefined && <div className="omv-detail-backdrop"><Loading label="读取 Evidence.v1…" /></div>}
      {detail !== undefined && <FindingDetail
        payload={detail}
        busy={anyBusy}
        isBusy={isBusy}
        currentSessionId={sessionId}
        expanded={detailExpanded}
        onToggleExpand={() => setDetailExpanded(value => !value)}
        onClose={closeFinding}
        onAction={(request, message) => { void perform({ ...request, sessionId }, message) }}
        onWorkflow={intent => { void startWorkflow(intent) }}
        onLink={() => { void linkCurrentSession() }}
        onOpenSession={openLinkedSession}
        onOpenPath={openWorkspacePath}
        onStartReproduction={id => { void startReproduction(id) }}
        onScanDedup={id => { void scanDedup(id) }}
        onUpdateDedup={(id, status, matchId) => { void updateDedup(id, status, matchId) }}
      />}
      {campaignDetail !== undefined && <CampaignDetail payload={campaignDetail} busy={anyBusy} isBusy={isBusy} currentSessionId={sessionId} expanded={campaignDetailExpanded} onToggleExpand={() => setCampaignDetailExpanded(value => !value)} onClose={closeCampaign} onStart={() => { void startCampaign(campaignDetail.campaign.id) }} onControl={(runId, control, laneId) => { void campaignRunner.control(runId, control, laneId) }} onOpenSession={openLinkedSession} onFinding={id => { void showFinding(id) }} onAction={(request, message) => { void perform({ ...request, sessionId }, message) }} />}
      {dialog === 'finding' && <NewFindingDialog busy={anyBusy} onClose={closeDialog} onSubmit={async request => { if (await perform(request, '候选漏洞已创建')) closeDialog() }} />}
      {dialog === 'campaign' && <NewCampaignDialog busy={anyBusy} onClose={closeDialog} onSubmit={async request => { if (await perform(request, '审计任务已创建')) closeDialog() }} />}
      {commandPaletteOpen && <CommandPalette tab={tab} onTab={next => { selectTab(next); closeCommandPalette() }} onNewFinding={() => { setDialog('finding'); setCommandPaletteOpen(false) }} onNewCampaign={() => { setDialog('campaign'); setCommandPaletteOpen(false) }} onClose={closeCommandPalette} />}
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
    { id: 'reproduction', label: '复现', icon: 'pulse', count: dashboard?.metrics.activeReproductions },
    { id: 'campaigns', label: '审计任务', icon: 'campaign', count: dashboard?.metrics.campaigns },
    { id: 'search', label: '搜索', icon: 'search' },
  ]
  return (
    <div className="omv-native-toolbar">
      <nav className="omv-nav" aria-label={`${OMV_DISPLAY_NAME}视图`} aria-orientation="horizontal" role="tablist">
        {items.map((item, index) => {
          const shortcut = String(index + 1)
          return <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} aria-controls="omv-workbench-panel" aria-keyshortcuts={shortcut} title={`${item.label}（快捷键 ${shortcut}）`} className="omv-nav-button" data-active={tab === item.id} onClick={() => onTab(item.id)}><Icon name={item.icon} size={13} /><span>{item.label}</span>{item.count !== undefined && <b className="omv-nav-count">{item.count}</b>}</button>
        })}
      </nav>
      {jobs.some(job => job.status === 'running' || job.status === 'stopping') && <span className="omv-jobs-badge" title={jobs.map(job => `${job.id}: ${job.label} · ${job.status}`).join('\n')}><Icon name="pulse" size={11} />{jobs.filter(job => job.status === 'running' || job.status === 'stopping').length} 任务</span>}
      <span className="omv-live" data-state={live} title={live === 'live' ? '工作区文件变化将实时同步' : '实时连接恢复前使用定时刷新'}><i />{live === 'live' ? '实时' : live === 'connecting' ? '连接中' : '轮询'}</span>
      <code className="omv-workspace-path" title={dashboard?.config.projectRoot}>{dashboard?.config.projectRoot ?? '同步工作区…'}</code>
      <span className="omv-sync-meta" aria-live="polite" title={refreshError ?? (lastUpdated === undefined ? '等待首次同步' : `上次同步：${formatTime(lastUpdated)}`)}>{refreshError === undefined ? (lastUpdated === undefined ? '同步中' : `更新于 ${relativeTime(lastUpdated)}`) : '同步失败'}</span>
      <button type="button" className="omv-palette-button" onClick={onCommandPalette} title="打开命令面板（⌘K / Ctrl K）"><Icon name="search" size={12} /><span>命令</span><kbd>⌘K</kbd></button>
      <button type="button" className="omv-icon-button" aria-label={refreshError === undefined ? '刷新 OMV 工作区' : '重试同步 OMV 工作区'} disabled={busy} onClick={onRefresh}><Icon name="refresh" size={14} /></button>
    </div>
  )
}
