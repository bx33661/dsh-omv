import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import type { JobView, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type {
  ActionRequest,
  AuditStage,
  CampaignPayload,
  CampaignRun,
  DashboardPayload,
  DedupStatus,
  DisclosurePlan,
  EvidenceAssessment,
  EvidenceCheckState,
  FindingPayload,
  RadarPayload,
  ReportQueueItem,
  ReviewQueueItem,
  ReviewStatus,
  SearchHit,
  WorkflowIntent,
  WorkspaceQualityPayload,
} from '../contracts.js'
import { OMV_TABS } from '../settings.js'
import type { Tab, IconName } from './types.js'
import {
  activityColor,
  activityLabel,
  api,
  campaignLabel,
  checkStateIcon,
  confidenceLabel,
  disclosureChannelLabel,
  firstLine,
  formatTime,
  messageOf,
  maturityLabel,
  phaseLabel,
  primaryIntent,
  qualitySignalLabel,
  qualitySignalTone,
  relativeTime,
  normalizePath,
  statusLabel,
  workflowLabel,
  valueAt,
} from './runtime.js'
import {
  ChainCard,
  Empty,
  Field,
  Hero,
  Icon,
  Legend,
  Loading,
  Maturity,
  Metric,
  Modal,
  Posture,
  Score,
  Section,
  Status,
} from './ui.js'

export function CommandPalette({ tab, onTab, onNewFinding, onNewCampaign, onClose }: { tab: Tab; onTab: (tab: Tab) => void; onNewFinding: () => void; onNewCampaign: () => void; onClose: () => void }) {
  const labels: Record<Tab, string> = { overview: '总览', findings: '漏洞', quality: '质量', reproduction: '复现', campaigns: '战役', radar: '雷达', review: '评审', reports: '交付', activity: '轨迹', search: '搜索' }
  const actions: Array<{ label: string; hint: string; run: () => void }> = [
    ...OMV_TABS.map((item, index) => ({ label: `打开${labels[item]}`, hint: index === 9 ? '0' : String(index + 1), run: () => onTab(item) })),
    { label: '新建候选漏洞', hint: 'Finding', run: onNewFinding },
    { label: '新建审计战役', hint: 'Campaign', run: onNewCampaign },
  ]
  const [query, setQuery] = useState('')
  const filtered = actions.filter(action => `${action.label} ${action.hint}`.toLowerCase().includes(query.trim().toLowerCase()))
  return <div className="omv-modal-backdrop" role="presentation" onMouseDown={onClose}><div className="omv-command-palette" role="dialog" aria-modal="true" aria-label="OMV 命令面板" onMouseDown={event => event.stopPropagation()}><div className="omv-command-palette-head"><Icon name="search" size={14} /><input autoFocus className="omv-input" value={query} placeholder="搜索视图或动作…" onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') onClose(); if (event.key === 'Enter' && filtered[0] !== undefined) filtered[0].run() }} /><kbd>ESC</kbd></div><ul>{filtered.map(action => <li key={`${action.label}-${action.hint}`}><button type="button" className={labels[tab] !== undefined && action.label === `打开${labels[tab]}` ? 'omv-command-palette-item active' : 'omv-command-palette-item'} onClick={action.run}><span>{action.label}</span><kbd>{action.hint}</kbd></button></li>)}</ul>{filtered.length === 0 && <Empty label="没有匹配动作" compact />}</div></div>
}

export function WorkbenchErrorState({ error, projectRoot, configuredRoot: root, onRetry, onOpenConfigured, onOpenPath }: {
  error: string
  projectRoot: string
  configuredRoot: string
  onRetry: () => void
  onOpenConfigured: (() => Promise<void>) | undefined
  onOpenPath: (() => void) | undefined
}) {
  const pointsElsewhere = root !== '.' && normalizePath(projectRoot) !== normalizePath(root)
  return (
    <section className="omv-error-state" role="alert">
      <div className="omv-error-icon"><Icon name="alert" size={19} /></div>
      <p className="omv-eyebrow">工作区同步</p>
      <h2>暂时无法读取这个审计工作区</h2>
      <p className="omv-error-lead">DSH 会话仍然可用；先修复当前工作区数据或切换到默认工作区，再继续审计。</p>
      <div className="omv-error-paths">
        <div><span>当前会话</span><code title={projectRoot}>{projectRoot}</code></div>
        {pointsElsewhere && <div><span>默认工作区</span><code title={root}>{root}</code></div>}
      </div>
      <div className="omv-error-actions">
        <button type="button" className="omv-primary" onClick={onRetry}><Icon name="refresh" size={13} />重试同步</button>
        {pointsElsewhere && onOpenConfigured !== undefined && <button type="button" className="omv-secondary" onClick={() => { void onOpenConfigured() }}><Icon name="grid" size={13} />打开默认工作区</button>}
        {onOpenPath !== undefined && <button type="button" className="omv-secondary" onClick={onOpenPath}><Icon name="folder" size={13} />打开 .omv</button>}
      </div>
      <details className="omv-error-details"><summary>查看诊断信息</summary><pre>{error}</pre></details>
    </section>
  )
}

export function Overview({ data, jobs, onRetryJob, onTab, onFinding, onNew, onOpenConfigured }: {
  data: DashboardPayload
  jobs: readonly JobView[]
  onRetryJob: (job: JobView) => void
  onTab: (tab: Tab) => void
  onFinding: (id: string) => void
  onNew: () => void
  onOpenConfigured?: (() => Promise<void>) | undefined
}) {
  const { metrics } = data
  const queue = data.findings.slice(0, 6)
  return (
    <>
      <Hero
        eyebrow="工作区概览"
        title="风险态势"
        description="查看候选漏洞、证据成熟度和下一步审计动作。"
        actions={<><button type="button" className="omv-secondary" onClick={() => onTab('campaigns')}><Icon name="radar" size={13} />查看战役</button><button type="button" className="omv-primary" onClick={onNew}><Icon name="plus" size={13} />新建候选</button></>}
      />
      {data.workspaceIssues.length > 0 && <WorkspaceIssuesNotice issues={data.workspaceIssues} onTab={onTab} onOpenConfigured={onOpenConfigured} />}
      {data.campaignIssues.length > 0 && <button type="button" className="omv-campaign-notice" onClick={() => onTab('campaigns')}><Icon name="alert" size={13} /><span><strong>{data.campaignIssues.length} 份 Campaign 配置需要处理</strong><small>其余审计数据已正常加载</small></span><Icon name="chevron" size={13} /></button>}
      <div className="omv-metrics">
        <Metric label="活跃发现" value={metrics.active} foot={<><b>{metrics.candidates}</b> 条仍在审计</>} icon="finding" color="#7188ff" />
        <Metric label="已确认" value={metrics.confirmed} foot={<><b>{metrics.reportReady}</b> 条已满足报告条件</>} icon="check" color="#3dd68c" />
        <Metric label="已验证证据" value={metrics.evidenceMaturity.verified} foot={<><b>{metrics.evidenceMaturity.supported}</b> 条已有相互支撑证据</>} icon="gauge" color="#39c6d4" />
        <Metric label="阻塞项目" value={metrics.blocked} foot={<><b>{metrics.archived}</b> 条已归档</>} icon="alert" color="#ff6075" />
      </div>
      <div className="omv-grid">
        <section className="omv-panel">
          <div className="omv-panel-head"><div><h3>优先审计队列</h3><p>按证据成熟度、未决问题和下一步动作排序</p></div><button type="button" className="omv-secondary" onClick={() => onTab('findings')}>全部发现</button></div>
          {queue.length === 0 ? <Empty label="当前工作区还没有候选漏洞" description="从一个候选开始，Evidence.v1 会保留每一步研究上下文。" action={<button type="button" className="omv-secondary" onClick={onNew}><Icon name="plus" size={12} />创建候选</button>} /> : (
            <ul className="omv-queue">
              {queue.map(finding => (
                <li key={finding.id} className="omv-queue-row" role="button" tabIndex={0} aria-label={`打开 ${finding.id}`} onClick={() => onFinding(finding.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onFinding(finding.id) } }}>
                  <div className="omv-finding-name"><strong>{finding.id}</strong><span>{finding.package} · {finding.vulnerability}</span></div>
                  <code className="omv-next">{finding.nextAction}</code>
                  <Maturity assessment={finding.assessment} compact />
                  <Icon name="chevron" size={14} />
                </li>
              ))}
            </ul>
          )}
        </section>
        <div className="omv-side-stack"><Posture data={data} /><NativeJobs jobs={jobs} onRetry={onRetryJob} /></div>
      </div>
    </>
  )
}

export function NativeJobs({ jobs, onRetry }: { jobs: readonly JobView[]; onRetry: (job: JobView) => void }) {
  const visible = jobs.slice(-6).reverse()
  return <section className="omv-panel"><div className="omv-panel-head"><div><h3>DSH 后台任务</h3><p>当前会话的原生 Jobs</p></div></div>{visible.length === 0 ? <Empty label="当前会话没有后台任务" compact /> : <ul className="omv-native-jobs">{visible.map(job => <li key={job.id}><i data-state={job.status} /><div><strong>{job.label}</strong><span>{job.kind} · {job.status}{job.detail === undefined ? '' : ` · ${job.detail}`}</span></div>{job.status === 'failed' || job.status === 'killed' ? <button type="button" className="omv-secondary" onClick={() => onRetry(job)}>重试</button> : <code>{job.id}</code>}</li>)}</ul>}</section>
}

export function Findings({ data, onFinding, onNew, onOpenConfigured }: {
  data: DashboardPayload
  onFinding: (id: string, archived?: boolean) => void
  onNew: () => void
  onOpenConfigured?: (() => Promise<void>) | undefined
}) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('active')
  const active = useMemo(() => data.findings.filter(finding => {
    const matchesStatus = status === 'active' || finding.status === status || finding.stage === status
    const haystack = `${finding.id} ${finding.package} ${finding.vulnerability} ${finding.ecosystem}`.toLowerCase()
    return matchesStatus && haystack.includes(query.toLowerCase())
  }), [data.findings, query, status])
  const archived = useMemo(() => data.archived.filter(finding => {
    const haystack = `${finding.id} ${finding.package} ${finding.vulnerability}`.toLowerCase()
    return haystack.includes(query.toLowerCase())
  }), [data.archived, query])
  return (
    <>
      <Hero eyebrow="Evidence.v1" title="漏洞发现" description="追踪候选、确认、阻塞和归档状态。" actions={<button type="button" className="omv-primary" onClick={onNew}><Icon name="plus" size={13} />新建候选</button>} />
      {data.workspaceIssues.length > 0 && <WorkspaceIssuesNotice issues={data.workspaceIssues} onOpenConfigured={onOpenConfigured} />}
      <div className="omv-toolbar">
        <div className="omv-search"><Icon name="search" size={14} /><input className="omv-input" value={query} placeholder="搜索 ID、包名、漏洞类型…" onChange={event => setQuery(event.target.value)} /></div>
        <select className="omv-select" style={{ width: 128 }} value={status} onChange={event => setStatus(event.target.value)}>
          <option value="active">全部活跃</option><option value="candidate">候选</option><option value="investigating">调查中</option><option value="reproducing">复现中</option><option value="confirmed">已确认</option><option value="report_ready">可提交</option><option value="disclosed">已披露</option><option value="blocked">阻塞</option><option value="archived">已归档</option>
        </select>
      </div>
      <div className="omv-table-wrap">
        <table className="omv-table">
          <thead><tr><th style={{ width: '25%' }}>发现</th><th style={{ width: '14%' }}>阶段</th><th style={{ width: '11%' }}>生态</th><th style={{ width: '17%' }}>证据状态</th><th>下一步</th></tr></thead>
          <tbody>
            {status !== 'archived' && active.map(finding => (
              <tr key={finding.id} tabIndex={0} role="link" aria-label={`打开 ${finding.id}`} onClick={() => onFinding(finding.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onFinding(finding.id) } }}>
                <td><div className="omv-finding-name"><strong>{finding.id}</strong><span>{finding.package} · {finding.vulnerability}</span></div></td>
                <td><Status value={finding.stage} /></td><td>{finding.ecosystem}</td><td><Maturity assessment={finding.assessment} /></td><td className="omv-cell-mono">{finding.nextAction}</td>
              </tr>
            ))}
            {status === 'archived' && archived.map(finding => (
              <tr key={finding.id} tabIndex={0} role="link" aria-label={`打开 ${finding.id}`} onClick={() => onFinding(finding.id, true)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onFinding(finding.id, true) } }}>
                <td><div className="omv-finding-name"><strong>{finding.id}</strong><span>{finding.package} · {finding.vulnerability}</span></div></td>
                <td><Status value="archived" /></td><td>{finding.ecosystem}</td><td><span className="omv-muted-copy">已归档</span></td><td className="omv-cell-mono">{finding.archiveReason}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {((status === 'archived' ? archived.length : active.length) === 0) && <Empty label="没有匹配的漏洞发现" description={query === '' && status === 'active' ? '工作区中还没有活跃发现。' : '试试清空关键词或切换状态筛选。'} action={(query !== '' || status !== 'active') ? <button type="button" className="omv-secondary" onClick={() => { setQuery(''); setStatus('active') }}>清除筛选</button> : <button type="button" className="omv-primary" onClick={onNew}><Icon name="plus" size={12} />新建候选</button>} />}
      </div>
    </>
  )
}

export function WorkspaceIssuesNotice({ issues, onTab, onOpenConfigured }: { issues: DashboardPayload['workspaceIssues']; onTab?: (tab: Tab) => void; onOpenConfigured?: (() => Promise<void>) | undefined }) {
  const findingIssues = issues.filter(issue => issue.kind === 'finding')
  const label = findingIssues.length === 1 ? '1 个 Evidence 文件未加载' : `${findingIssues.length} 个 Evidence 文件未加载`
  return <section className="omv-data-notice" role="status"><Icon name="alert" size={14} /><div><strong>{label}</strong><span>其余审计数据仍可使用；修复 YAML 后点击右上角刷新即可恢复。</span><details><summary>查看文件</summary><ul>{findingIssues.slice(0, 6).map(issue => <li key={issue.id}><code>{issue.id}</code><span>{firstLine(issue.message)}</span></li>)}</ul></details></div><div className="omv-data-notice-actions">{onOpenConfigured !== undefined && <button type="button" className="omv-secondary" onClick={() => { void onOpenConfigured() }}>默认工作区</button>}{onTab !== undefined && <button type="button" className="omv-secondary" onClick={() => onTab('findings')}>查看台账</button>}</div></section>
}

export function Campaigns({ data, busy, onNew, onCampaign, onRepair }: { data: DashboardPayload; busy: boolean; onNew: () => void; onCampaign: (id: string) => void; onRepair: (id: string) => void }) {
  return (
    <>
      <Hero eyebrow="Campaign.v1" title="审计战役" description="管理目标、范围、漏洞类型与研究 runbook。" actions={<button type="button" className="omv-primary" onClick={onNew}><Icon name="plus" size={13} />新建战役</button>} />
      {data.campaignIssues.length > 0 && <section className="omv-panel omv-campaign-issues"><div className="omv-panel-head"><div><h3>配置诊断</h3><p>异常文件已隔离，不影响其他战役和漏洞数据</p></div><Status value="needs_attention" /></div><ul>{data.campaignIssues.map(issue => <li key={issue.path}><i /><div><strong>{issue.id}</strong><span>{issue.changes.length > 0 ? issue.changes.join(' · ') : issue.message}</span><code>{issue.path}</code></div>{issue.repairable && <button type="button" className="omv-secondary" disabled={busy} onClick={() => onRepair(issue.id)}>修复配置</button>}</li>)}</ul></section>}
      {data.campaigns.length === 0 ? <div className="omv-panel"><Empty label="还没有审计战役" description="把一个目标和漏洞类型组合成可恢复的研究计划。" action={<button type="button" className="omv-primary" onClick={onNew}><Icon name="plus" size={12} />创建战役</button>} /></div> : (
        <div className="omv-campaigns">
          {data.campaigns.map(campaign => (
            <article className="omv-campaign" key={campaign.id} role="button" tabIndex={0} onClick={() => onCampaign(campaign.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onCampaign(campaign.id) } }}>
              <div className="omv-campaign-top"><span className="omv-campaign-icon"><Icon name="radar" size={16} /></span><Status value={campaign.status} /></div>
              <h3>{campaign.title}</h3><p>{campaign.target} · {campaign.version}</p>
              <div className="omv-campaign-foot"><span>{campaign.laneCount} 条审计 Lane</span><code>{campaign.id}</code></div>
            </article>
          ))}
        </div>
      )}
    </>
  )
}

export function CampaignGraph({ lanes, run }: { lanes: CampaignPayload['campaign']['lanes']; run: CampaignRun | undefined }) {
  const laneById = new Map((run?.lanes ?? []).map(lane => [lane.laneId, lane]))
  return <div className="omv-campaign-graph" aria-label="Campaign Lane 图谱"><div className="omv-campaign-graph-start"><Icon name="radar" size={13} /><span>目标</span></div><div className="omv-campaign-graph-line" />{lanes.map((lane, index) => { const current = laneById.get(lane.id); return <div className="omv-campaign-graph-lane" key={lane.id}><div className="omv-campaign-graph-edge" /><article data-state={current?.status ?? 'queued'}><span>{String(index + 1).padStart(2, '0')}</span><strong>{lane.title}</strong><small>{current?.status === undefined ? '待运行' : statusLabel(current.status)}</small><code>{lane.finding_id}</code></article></div> })}</div>
}

export function CampaignDetail({ payload, busy, currentSessionId, onClose, onStart, onControl, onOpenSession }: {
  payload: CampaignPayload
  busy: boolean
  currentSessionId: SessionId
  onClose: () => void
  onStart: () => void
  onControl: (runId: string, control: 'pause' | 'resume' | 'cancel' | 'retry', laneId?: string) => void
  onOpenSession: (sessionId: string) => void
}) {
  const { campaign } = payload
  const run = payload.runs[0]
  const activeRun = run !== undefined && (run.status === 'running' || run.status === 'queued' || run.status === 'paused')
  const linkedElsewhere = payload.sessionLink !== undefined && payload.sessionLink.sessionId !== currentSessionId
  const completed = run?.lanes.filter(lane => lane.status === 'completed').length ?? 0
  const attention = run?.lanes.filter(lane => lane.status === 'blocked' || lane.status === 'failed' || lane.status === 'awaiting_evidence').length ?? 0
  const resolved = run?.lanes.filter(lane => lane.status === 'completed' || lane.status === 'blocked' || lane.status === 'failed' || lane.status === 'cancelled').length ?? 0
  const total = run?.lanes.length ?? campaign.lanes.length
  const completedWidth = total === 0 ? 0 : Math.round(completed / total * 100)
  const attentionWidth = total === 0 ? 0 : Math.round(attention / total * 100)
  return <>
    <div className="omv-detail-backdrop" onClick={onClose} />
    <aside className="omv-detail">
      <div className="omv-detail-head"><div className="omv-detail-head-copy"><h2>{campaign.title}</h2><p>{campaign.target.name} · {campaign.target.version} · {campaign.target.ecosystem}</p></div><Status value={run?.status ?? campaign.status} /><button type="button" className="omv-icon-button" aria-label="关闭详情" onClick={onClose}><Icon name="close" size={15} /></button></div>
      <div className="omv-detail-body">
        <div className="omv-campaign-summary"><div><span>审计深度</span><strong>{campaignLabel(campaign.budget.depth)}</strong></div><div><span>范围模式</span><strong>{campaignLabel(campaign.scope.mode)}</strong></div><div><span>输出目标</span><strong>{campaignLabel(campaign.goal.output)}</strong></div><div><span>Lane 状态</span><strong>{run === undefined ? `${total} 待启动` : `${completed} 完成 · ${attention} 待处理`}</strong></div></div>
        <div className="omv-detail-actions"><button type="button" className="omv-primary" disabled={busy || activeRun} onClick={onStart}><Icon name="radar" size={12} />{run === undefined ? 'Seed 并运行 Campaign' : activeRun ? run.status === 'paused' ? 'Run 已暂停' : 'Run 运行中' : '创建新一轮 Run'}</button>{linkedElsewhere && <button type="button" className="omv-secondary" onClick={() => onOpenSession(payload.sessionLink!.sessionId)}>打开关联会话</button>}</div>
        {run !== undefined && <Section title="战役运行器" meta={`${statusLabel(run.status)} · 并发 ${run.concurrency}`}>
          <div className="omv-run-head"><div><strong>{run.id}</strong><span>{formatTime(run.updatedAt)} · {completed} 完成 · {attention} 待处理 · {resolved}/{total} 已收敛</span></div><div>{run.status === 'running' || run.status === 'queued' ? <button type="button" className="omv-secondary" disabled={busy} onClick={() => onControl(run.id, 'pause')}>暂停</button> : run.status === 'paused' ? <button type="button" className="omv-secondary" disabled={busy} onClick={() => onControl(run.id, 'resume')}>恢复</button> : null}{activeRun && <button type="button" className="omv-secondary" disabled={busy} onClick={() => onControl(run.id, 'cancel')}>取消</button>}</div></div>
          <div className="omv-run-progress"><i data-kind="completed" style={{ width: `${completedWidth}%` }} /><i data-kind="attention" style={{ left: `${completedWidth}%`, width: `${attentionWidth}%` }} /></div>
          <ul className="omv-run-lanes">{run.lanes.map(lane => <li key={lane.laneId}><i data-state={lane.status} /><div><strong>{lane.title}</strong><span>{lane.findingId} · 尝试 {lane.attempts} 次{lane.summary === undefined ? '' : ` · ${lane.summary}`}</span></div><Status value={lane.status} />{lane.sessionId !== undefined && <button type="button" className="omv-secondary" onClick={() => onOpenSession(lane.sessionId!)}>会话</button>}{(lane.status === 'failed' || lane.status === 'blocked' || lane.status === 'awaiting_evidence' || lane.status === 'cancelled') && <button type="button" className="omv-secondary" disabled={busy} onClick={() => onControl(run.id, 'retry', lane.laneId)}>重试</button>}</li>)}</ul>
        </Section>}
        <Section title="审计 Lane 定义" meta="每条 Lane 一个 DSH 会话"><CampaignGraph lanes={campaign.lanes} run={run} /><ul className="omv-lanes">{campaign.lanes.map(lane => <li key={lane.id}><i /><div><strong>{lane.title}</strong><span>{lane.vulnerability_class}</span></div><code>{lane.finding_id}</code></li>)}</ul></Section>
        <Section title="运行手册" meta={payload.runbookExists ? '就绪' : '缺失'}><div className="omv-path-block"><code>{payload.runbookPath}</code><span>{payload.nextAction}</span></div></Section>
        <Section title="编排历史" meta={`${payload.history.length} 条事件`}>{payload.history.length === 0 ? <Empty label="该 Campaign 尚未在 DSH 中运行" compact /> : <ul className="omv-history">{payload.history.map(event => <li key={event.id}><i style={{ background: activityColor(event.action) }} /><div><strong>{activityLabel(event.action)}</strong><span>{formatTime(event.timestamp)} · {event.sessionId ?? '未知会话'}</span></div></li>)}</ul>}</Section>
      </div>
    </aside>
  </>
}

export function Radar({ projectRoot, busy, onBusy, onToast, onResearch }: {
  projectRoot: string
  busy: boolean
  onBusy: (busy: boolean) => void
  onToast: (toast: { kind: 'ok' | 'error'; message: string }) => void
  onResearch: () => void
}) {
  const [radar, setRadar] = useState<RadarPayload>()
  const [error, setError] = useState<string>()
  const load = useCallback(async () => {
    try {
      setRadar(await api<RadarPayload>('/radar', undefined, projectRoot))
      setError(undefined)
    } catch (caught) {
      setError(messageOf(caught))
      throw caught
    }
  }, [projectRoot])
  useEffect(() => { void load().catch(() => undefined) }, [load])
  const refresh = async () => {
    onBusy(true)
    try {
      setRadar(await api<RadarPayload>('/action', { method: 'POST', body: JSON.stringify({ action: 'radar.refresh' } satisfies ActionRequest) }, projectRoot))
      onToast({ kind: 'ok', message: 'Radar 观察项快照已更新' })
    } catch (error) {
      onToast({ kind: 'error', message: messageOf(error) })
    } finally { onBusy(false) }
  }
  const convert = async (queueId: string) => {
    onBusy(true)
    try {
      const result = await api<{ findingId: string }>('/action', { method: 'POST', body: JSON.stringify({ action: 'radar.queue.convert', id: queueId } satisfies ActionRequest) }, projectRoot)
      onToast({ kind: 'ok', message: `Radar Candidate 已创建：${result.findingId}` })
      await load()
    } catch (error) { onToast({ kind: 'error', message: messageOf(error) }) } finally { onBusy(false) }
  }
  return <><Hero eyebrow="被动情报" title="研究雷达" description="跟踪观察项、公开公告、版本变化和疑似修复信号。" actions={<><button type="button" className="omv-secondary" disabled={busy} onClick={() => { void refresh() }}><Icon name="refresh" size={12} />同步观察项</button><button type="button" className="omv-primary" disabled={busy || radar?.watchlistExists !== true} onClick={onResearch}><Icon name="radar" size={12} />Agent 被动调研</button></>} />{radar === undefined && error !== undefined ? <section className="omv-panel"><Empty label="Radar 暂时无法读取" description={error} action={<button type="button" className="omv-secondary" onClick={() => { void load().catch(() => undefined) }}><Icon name="refresh" size={12} />重试</button>} /></section> : radar === undefined ? <Loading /> : !radar.watchlistExists ? <section className="omv-panel"><Empty label={`创建 ${radar.watchlistPath} 后开始`} description="watchlist.yaml 只记录观察对象，不会主动探测目标。" /></section> : <><div className="omv-radar-grid"><section className="omv-panel"><div className="omv-panel-head"><div><h3>观察列表</h3><p>{radar.watch.length} 个目标</p></div></div><ul className="omv-watchlist">{radar.watch.map((item, index) => <li key={`${item.ecosystem}-${item.package ?? item.keyword}-${index}`}><Icon name="radar" size={13} /><div><strong>{item.package ?? item.keyword ?? 'unknown'}</strong><span>{item.ecosystem} · {item.vulnerability ?? '通用动态'}</span></div></li>)}</ul></section><section className="omv-panel"><div className="omv-panel-head"><div><h3>最近信号</h3><p>{radar.events.length} 条事件</p></div></div>{radar.events.length === 0 ? <Empty label="尚无 Radar 事件" compact /> : <ul className="omv-radar-events">{radar.events.slice(0, 40).map(event => <li key={event.id}><Status value={event.type} /><div><strong>{event.title}</strong><span>{event.source} · {formatTime(event.observedAt)}</span></div>{event.severity !== undefined && <b>{event.severity}</b>}</li>)}</ul>}</section></div><section className="omv-panel omv-radar-queue"><div className="omv-panel-head"><div><h3>审计候选队列</h3><p>{radar.queue.filter(item => item.status === 'new' || item.status === 'reviewing').length} 个待处理信号</p></div></div>{radar.queue.length === 0 ? <Empty label="同步或调研后，值得复核的信号会进入这里" compact /> : <ul>{radar.queue.slice(0, 30).map(item => <li key={item.id}><Score value={item.score} /><div><strong>{item.eventId}</strong><span>{item.reason}</span></div><Status value={item.status} />{item.status !== 'candidate' && item.status !== 'ignored' && <button type="button" className="omv-secondary" disabled={busy} onClick={() => { void convert(item.id) }}>创建候选</button>}{item.findingId !== undefined && <code>{item.findingId}</code>}</li>)}</ul>}</section></>}</>
}

export function SearchPage({ projectRoot, onFinding, onCampaign }: {
  projectRoot: string
  onFinding: (id: string, archived?: boolean) => void
  onCampaign: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchHit[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string>()
  const [retryNonce, setRetryNonce] = useState(0)
  useEffect(() => {
    const value = query.trim()
    if (value === '') { setResults([]); setError(undefined); return }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setSearching(true)
      void api<SearchHit[]>(`/search?q=${encodeURIComponent(value)}`, { signal: controller.signal }, projectRoot).then(results => { setResults(results); setError(undefined) }).catch(error => {
        if ((error as Error).name !== 'AbortError') { setResults([]); setError(messageOf(error)) }
      }).finally(() => setSearching(false))
    }, 180)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [projectRoot, query, retryNonce])
  return <><Hero eyebrow="工作区索引" title="全局检索" description="跨 Evidence、Campaign、Radar 和活动记录检索。" /><div className="omv-search omv-global-search"><Icon name="search" size={15} /><input aria-label="搜索 OMV 工作区" autoFocus className="omv-input" value={query} placeholder="输入 Finding、包名、证据、Campaign 或 Radar 信号…" onChange={event => setQuery(event.target.value)} />{query !== '' && <button type="button" className="omv-search-clear" aria-label="清除搜索" onClick={() => setQuery('')}><Icon name="close" size={13} /></button>}</div><section className="omv-panel omv-search-results"><div className="omv-results-meta">{query.trim() === '' ? '输入关键词开始检索' : searching ? '正在搜索…' : error !== undefined ? '检索失败' : `${results.length} 个匹配结果`}</div>{searching ? <Loading label="检索 OMV 工作区…" /> : error !== undefined ? <Empty label="检索暂时失败" description={error} action={<button type="button" className="omv-secondary" onClick={() => setRetryNonce(value => value + 1)}><Icon name="refresh" size={12} />重试</button>} /> : query.trim() === '' ? <Empty label="输入关键词开始检索" description="支持 Finding ID、包名、漏洞类型、Campaign 和 Radar 事件。" /> : results.length === 0 ? <Empty label="没有匹配结果" description="换一个关键词，或检查当前会话连接的工作区。" /> : <ul>{results.map(result => { const actionable = result.kind === 'finding' || result.kind === 'campaign'; const open = () => { if (result.kind === 'finding') onFinding(result.id, result.archived); else if (result.kind === 'campaign') onCampaign(result.id) }; return <li key={`${result.kind}-${result.id}`} {...(actionable ? { tabIndex: 0, role: 'button' as const, 'aria-label': `打开 ${result.title}`, onKeyDown: (event: React.KeyboardEvent) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open() } } } : {})} onClick={actionable ? open : undefined} data-actionable={actionable}><Status value={result.kind} /><div><strong>{result.title}</strong><span>{result.description}</span></div><b>{result.score}</b></li> })}</ul>}</section></>
}

export function QualityPage({ data, onTab, onFinding, onOpenConfigured }: {
  data: DashboardPayload
  onTab: (tab: Tab) => void
  onFinding: (id: string) => void
  onOpenConfigured?: (() => Promise<void>) | undefined
}) {
  const quality = data.quality
  const queues = [
    { id: 'evidence', label: '补齐证据', value: quality.queues.needsEvidence, tab: 'findings' as Tab, detail: '论证链仍有缺口的发现' },
    { id: 'repro', label: '待复现', value: quality.queues.needsReproduction, tab: 'reproduction' as Tab, detail: '需要运行时验证的发现' },
    { id: 'review', label: '待评审', value: quality.queues.needsReview, tab: 'review' as Tab, detail: '等待协作者确认的发现' },
    { id: 'dedup', label: '待去重', value: quality.queues.needsDedup, tab: 'findings' as Tab, detail: '尚未完成情报比对的发现' },
    { id: 'report', label: '可交付', value: quality.queues.reportReady, tab: 'reports' as Tab, detail: '报告材料已接近齐备' },
  ]
  return <>
    <Hero eyebrow="证据运营" title="质量中心" description="用证据向量和可操作队列看清下一步，不把研究过程压扁成一个僵硬百分比。" actions={<><button type="button" className="omv-secondary" onClick={() => onTab('findings')}><Icon name="finding" size={12} />查看全部发现</button>{onOpenConfigured !== undefined && <button type="button" className="omv-secondary" onClick={() => { void onOpenConfigured() }}><Icon name="grid" size={12} />打开默认工作区</button>}</>} />
    <div className="omv-quality-hero">
      <div className="omv-quality-score" data-state={qualitySignalTone(quality)}><span>质量信号 <b>{quality.score}/100</b></span><strong>{qualitySignalLabel(quality)}</strong><small>按阻塞、提醒和建议聚合，用来排序下一步，不替代 Finding 的证据成熟度。</small><div className="omv-quality-signal-track" aria-label={`质量信号 ${quality.score}/100`}><i style={{ width: `${Math.max(0, Math.min(100, quality.score))}%` }} /></div></div>
      <div className="omv-quality-counts"><div><b>{quality.blockers}</b><span>阻塞</span></div><div><b>{quality.warnings}</b><span>提醒</span></div><div><b>{quality.infos}</b><span>建议</span></div></div>
      <div className="omv-quality-summary">{quality.issues.length === 0 ? '当前工作区没有待处理质量事项。' : `当前有 ${quality.issues.length} 项质量事项，按优先级从上到下处理即可。`}</div>
    </div>
    <section className="omv-quality-queues"><div className="omv-panel-head"><div><h3>操作队列</h3><p>每个数字都能直接跳到对应工作台</p></div></div><div className="omv-quality-queue-grid">{queues.map(queue => <button key={queue.id} type="button" className="omv-quality-queue" onClick={() => onTab(queue.tab)}><span>{queue.label}</span><strong>{queue.value}</strong><small>{queue.detail}</small><Icon name="chevron" size={12} /></button>)}</div></section>
    <section className="omv-panel omv-quality-issues"><div className="omv-panel-head"><div><h3>质量事项</h3><p>工作区问题、发现缺口和交付风险统一收口</p></div><span className="omv-panel-meta">更新于 {relativeTime(quality.generatedAt)}</span></div>{quality.issues.length === 0 ? <Empty label="质量状态清爽" description="新的证据变化会自动进入这里。" compact /> : <ul>{quality.issues.map(issue => <li key={issue.id} className="omv-quality-issue" data-severity={issue.severity} onClick={() => issue.findingId !== undefined && onFinding(issue.findingId)} role={issue.findingId === undefined ? undefined : 'button'} tabIndex={issue.findingId === undefined ? undefined : 0} onKeyDown={event => { if (issue.findingId !== undefined && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onFinding(issue.findingId) } }}><i /><div><strong>{issue.title}</strong><span>{issue.detail}</span>{issue.path !== undefined && <code>{issue.path}</code>}<small>下一步：{issue.nextAction}</small></div><Status value={issue.severity} /></li>)}</ul>}</section>
  </>
}

export function ReproductionPage({ data, onFinding, onStart }: {
  data: DashboardPayload
  onFinding: (id: string) => void
  onStart: (id: string) => void
}) {
  const runs = data.reproductionRuns
  const active = runs.filter(run => run.status === 'running').length
  const needs = data.findings.filter(finding => finding.assessment.dimensions.some(dimension => dimension.id === 'runtime_verification' && dimension.state !== 'verified' && dimension.state !== 'not_applicable')).length
  return <>
    <Hero eyebrow="运行时证据" title="复现实验室" description="把命令、环境、输出和 artifact 作为结构化 Run 留在 Finding 旁边，复现结果会回写证据链。" actions={<span className="omv-hero-status"><i data-state={active > 0 ? 'live' : 'idle'} />{active > 0 ? `${active} 个 Run 正在执行` : '当前没有运行中的 Run'}</span>} />
    <div className="omv-metrics omv-repro-metrics"><Metric label="运行总数" value={runs.length} foot={<><b>{runs.filter(run => run.status === 'passed').length}</b> 次已通过</>} icon="pulse" color="#39c6d4" /><Metric label="待验证发现" value={needs} foot="可从下方直接开始复现" icon="finding" color="#f3b85b" /><Metric label="失败 / 阻塞" value={runs.filter(run => run.status === 'failed' || run.status === 'blocked').length} foot="保留现场，继续补充环境" icon="alert" color="#ff6075" /><Metric label="通过率" value={runs.length === 0 ? '—' : `${Math.round(runs.filter(run => run.status === 'passed').length / runs.length * 100)}%`} foot="按 Run 计算" icon="check" color="#3dd68c" /></div>
    <section className="omv-panel omv-repro-board"><div className="omv-panel-head"><div><h3>实验队列</h3><p>每个 Run 都可回到对应 Finding 查看完整上下文</p></div></div>{runs.length === 0 ? <Empty label="还没有复现 Run" description="从 Finding 详情或待验证列表开始一个结构化复现。" compact /> : <ul>{runs.map(run => <li key={run.id} className="omv-repro-card"><div className="omv-repro-card-head"><Status value={run.status} /><code>{run.id}</code><button type="button" className="omv-link-button" onClick={() => onFinding(run.findingId)}>{run.findingId}<Icon name="chevron" size={11} /></button></div><strong>{run.command ?? '等待命令'}</strong><p>{run.environment === undefined ? '环境尚未记录' : Object.entries(run.environment).map(([key, value]) => `${key}=${value}`).join(' · ')}</p>{run.output !== undefined && <pre>{run.output}</pre>}<div className="omv-repro-card-foot"><span>{formatTime(run.updatedAt)}{run.exitCode === undefined ? '' : ` · exit ${run.exitCode}`} · {run.artifacts.length} artifacts</span>{run.status === 'planned' && <button type="button" className="omv-secondary" onClick={() => onStart(run.findingId)}>开始运行</button>}{run.status === 'failed' || run.status === 'blocked' ? <button type="button" className="omv-secondary" onClick={() => onStart(run.findingId)}>重新开始</button> : null}</div></li>)}</ul>}</section>
  </>
}

export function ReviewPage({ data, busy, onFinding, onUpdate, onNote }: {
  data: DashboardPayload
  busy: boolean
  onFinding: (id: string) => void
  onUpdate: (id: string, status: ReviewStatus, assignee?: string) => void
  onNote: (id: string, body: string) => void
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [assigneeDrafts, setAssigneeDrafts] = useState<Record<string, string>>({})
  const records = data.reviews
  useEffect(() => setAssigneeDrafts(current => {
    const next = { ...current }
    for (const item of records) if (!(item.findingId in next)) next[item.findingId] = item.assignee ?? ''
    return next
  }), [records])
  const saveAssignee = (item: ReviewQueueItem) => {
    const next = (assigneeDrafts[item.findingId] ?? '').trim()
    const previous = (item.assignee ?? '').trim()
    if (next !== previous) onUpdate(item.findingId, item.status, next === '' ? undefined : next)
  }
  return <>
    <Hero eyebrow="多人协作" title="协作评审" description="为每个发现保留状态、负责人和可追踪意见，让批评与确认都回到 Evidence 上。" actions={<span className="omv-hero-status"><i data-state={records.some(item => item.status === 'changes_requested') ? 'warn' : 'idle'} />{records.filter(item => item.status === 'unreviewed' || item.status === 'changes_requested').length} 项待跟进</span>} />
    <section className="omv-panel omv-review-board"><div className="omv-panel-head"><div><h3>评审队列</h3><p>{records.length} 条记录 · 状态即时更新，负责人输入在保存后写入工作区</p></div></div>{records.length === 0 ? <Empty label="还没有评审记录" description="打开一个 Finding 后即可开始评审。" compact /> : <ul>{records.map(item => { const assignee = assigneeDrafts[item.findingId] ?? item.assignee ?? ''; const assigneeDirty = assignee.trim() !== (item.assignee ?? '').trim(); return <li key={item.findingId} className="omv-review-card"><div className="omv-review-card-head"><button type="button" className="omv-link-button" onClick={() => onFinding(item.findingId)}>{item.findingId}<Icon name="chevron" size={11} /></button><Status value={item.status} /></div><div className="omv-review-controls"><select className="omv-select" disabled={busy} value={item.status} aria-label={`${item.findingId} 评审状态`} onChange={event => onUpdate(item.findingId, event.target.value as ReviewStatus, item.assignee)}>{(['unreviewed', 'in_review', 'changes_requested', 'approved', 'rejected'] as const).map(status => <option key={status} value={status}>{statusLabel(status)}</option>)}</select><input className="omv-input" disabled={busy} aria-label={`${item.findingId} 负责人`} value={assignee} placeholder="分配负责人" onChange={event => setAssigneeDrafts(current => ({ ...current, [item.findingId]: event.target.value }))} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); saveAssignee(item) } }} /><button type="button" className="omv-secondary omv-review-save" disabled={busy || !assigneeDirty} onClick={() => saveAssignee(item)}>保存</button></div>{item.latestNote !== undefined && <p className="omv-review-note-preview">“{item.latestNote}”</p>}<div className="omv-review-note"><input className="omv-input" disabled={busy} value={drafts[item.findingId] ?? ''} placeholder="写一条评审意见…" onChange={event => setDrafts(current => ({ ...current, [item.findingId]: event.target.value }))} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); const body = (drafts[item.findingId] ?? '').trim(); if (body !== '') { onNote(item.findingId, body); setDrafts(current => ({ ...current, [item.findingId]: '' })) } } }} /><button type="button" className="omv-secondary" disabled={busy || (drafts[item.findingId] ?? '').trim() === ''} onClick={() => { const body = (drafts[item.findingId] ?? '').trim(); if (body !== '') { onNote(item.findingId, body); setDrafts(current => ({ ...current, [item.findingId]: '' })) } }}>记录意见</button></div><small className="omv-review-next">{item.nextAction} · {item.noteCount} 条意见 · {formatTime(item.updatedAt)}</small></li> })}</ul>}</section>
  </>
}

export function ReportsPage({ data, onFinding, onPrepare, onSchedule }: {
  data: DashboardPayload
  onFinding: (id: string) => void
  onPrepare: (id: string) => void
  onSchedule: (id: string, date: string, channel: DisclosurePlan['channel'], recipient?: string, notes?: string) => void
}) {
  const [dates, setDates] = useState<Record<string, string>>({})
  const [channels, setChannels] = useState<Record<string, DisclosurePlan['channel']>>({})
  const [recipients, setRecipients] = useState<Record<string, string>>({})
  const defaultDate = () => new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)
  return <>
    <Hero eyebrow="交付流水线" title="报告与披露" description="从报告材料检查、草稿生成到披露排期，一次看清每个 Finding 的交付状态。" actions={<span className="omv-hero-status"><i data-state={data.reports.some(item => item.status === 'ready') ? 'live' : 'idle'} />{data.reports.filter(item => item.status === 'ready').length} 个可交付</span>} />
    <section className="omv-panel omv-report-board"><div className="omv-panel-head"><div><h3>交付队列</h3><p>报告草稿位于 .omv/reports/&lt;finding-id&gt;，provenance 与文件状态会一起检查</p></div></div>{data.reports.length === 0 ? <Empty label="还没有报告队列" description="创建 Finding 后，这里会显示材料状态。" compact /> : <ul>{data.reports.map(item => { const plans = data.disclosures.filter(plan => plan.findingId === item.findingId); const latestPlan = plans[0]; return <li key={item.findingId} className="omv-report-card"><div className="omv-report-card-head"><button type="button" className="omv-link-button" onClick={() => onFinding(item.findingId)}>{item.findingId}<Icon name="chevron" size={11} /></button><Status value={item.status} /><span>{item.package} · {maturityLabel(item.maturity)}</span></div><p>{item.nextAction}</p><div className="omv-report-artifacts">{item.artifacts.length === 0 ? <span>尚无交付 artifact</span> : item.artifacts.map(path => <code key={path}>{path}</code>)}{item.missing.map(path => <code key={`missing-${path}`} data-missing="true">缺失 · {path}</code>)}</div>{latestPlan !== undefined && <div className="omv-disclosure-plan"><Status value={latestPlan.status} /><span>下次披露：{latestPlan.dueAt.slice(0, 10)} · {disclosureChannelLabel(latestPlan.channel)}{latestPlan.recipient === undefined ? '' : ` · ${latestPlan.recipient}`}</span></div>}<div className="omv-report-actions"><button type="button" className="omv-secondary" onClick={() => onPrepare(item.findingId)}>{item.status === 'missing' ? '生成报告草稿' : '刷新报告材料'}</button><div className="omv-disclosure-inline"><input className="omv-input" type="date" aria-label={`${item.findingId} 披露日期`} value={dates[item.findingId] ?? ''} onChange={event => setDates(current => ({ ...current, [item.findingId]: event.target.value }))} /><select className="omv-select" aria-label={`${item.findingId} 披露渠道`} value={channels[item.findingId] ?? 'internal'} onChange={event => setChannels(current => ({ ...current, [item.findingId]: event.target.value as DisclosurePlan['channel'] }))}><option value="internal">内部</option><option value="vendor">厂商</option><option value="cna">CNA</option><option value="public">公开</option></select><input className="omv-input" aria-label={`${item.findingId} 披露对象`} value={recipients[item.findingId] ?? ''} placeholder="对象（可选）" onChange={event => setRecipients(current => ({ ...current, [item.findingId]: event.target.value }))} /><button type="button" className="omv-secondary" onClick={() => onSchedule(item.findingId, dates[item.findingId] ?? defaultDate(), channels[item.findingId] ?? 'internal', recipients[item.findingId])}>排期</button></div></div></li> })}</ul>}</section>
  </>
}

type TraceMode = 'duration' | 'turns' | 'calls'
type TraceKind = 'tool' | 'assistant' | 'context' | 'system'
type TraceActivity = DashboardPayload['activity'][number]

interface TraceBucket {
  label: string
  entries: TraceActivity[]
  value: number
  byKind: Record<TraceKind, number>
}

export function TracePage({ data, jobs }: { data: DashboardPayload; jobs: readonly JobView[] }) {
  const [mode, setMode] = useState<TraceMode>('duration')
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<TraceKind | 'all'>('all')
  const events = useMemo(() => data.activity.slice().sort(compareTraceEntries).slice(0, 240), [data.activity])
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return events.filter(entry => {
      if (kind !== 'all' && traceKind(entry.action) !== kind) return false
      if (needle === '') return true
      return [entry.action, entry.id, entry.status, entry.reason, entry.path, entry.from, entry.to]
        .filter((value): value is string => typeof value === 'string')
        .join(' ')
        .toLowerCase()
        .includes(needle)
    })
  }, [events, kind, query])
  const buckets = useMemo(() => buildTraceBuckets(filtered, mode), [filtered, mode])
  const maxValue = Math.max(1, ...buckets.map(bucket => bucket.value))
  const activeJobs = jobs.filter(job => job.status === 'running' || job.status === 'stopping')
  const latest = latestTraceEntry(events)
  const latestVisible = latestTraceEntry(filtered)
  const findingChanges = events.filter(entry => entry.action.startsWith('finding.')).length
  const laneTotals = useMemo(() => {
    const totals: Record<TraceKind, number> = { tool: 0, assistant: 0, context: 0, system: 0 }
    for (const entry of filtered) totals[traceKind(entry.action)] += 1
    return totals
  }, [filtered])
  const displayedEvents = filtered.slice(0, 120)
  const eventRange = filtered.length > displayedEvents.length ? `${displayedEvents.length} / ${filtered.length}` : `${filtered.length} / ${events.length}`
  const laneDefinitions: Array<{ kind: TraceKind; label: string }> = [
    { kind: 'context', label: 'Evidence' },
    { kind: 'assistant', label: 'Workflow' },
    { kind: 'tool', label: 'Tools' },
  ]

  return <>
    <Hero
      eyebrow="DSH 轨迹"
      title="审计轨迹"
      description="把证据变化、工作流和原生任务放到同一条时间线上，像看 DSH 原生 Trace 一样追踪每一步。"
      actions={<span className="omv-hero-status"><i data-state={activeJobs.length > 0 ? 'live' : 'idle'} />{events.length} 条事件 · {activeJobs.length} 个任务</span>}
    />
    <section className="omv-trace-controls" aria-label="轨迹筛选">
      <div className="omv-trace-segmented" role="tablist" aria-label="轨迹视图">
        {(['duration', 'turns', 'calls'] as const).map(item => <button key={item} type="button" role="tab" aria-controls="omv-trace-chart" aria-selected={mode === item} data-active={mode === item} onClick={() => setMode(item)}><span>{traceModeLabel(item)}</span><small>{item === 'duration' ? '密度' : item === 'turns' ? '回合' : '调用'}</small></button>)}
      </div>
      <label className="omv-trace-search"><Icon name="search" size={14} /><input value={query} aria-label="搜索轨迹" placeholder="搜索动作、Finding、原因…" onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') setQuery('') }} />{query !== '' && <button type="button" aria-label="清除搜索" onClick={() => setQuery('')}><Icon name="close" size={12} /></button>}</label>
      <label className="omv-trace-filter"><span>筛选</span><select aria-label="筛选轨迹类型" value={kind} onChange={event => setKind(event.target.value as TraceKind | 'all')}><option value="all">全部事件</option><option value="tool">工具调用</option><option value="assistant">工作流</option><option value="context">上下文</option><option value="system">系统</option></select></label>
    </section>

    <section className="omv-trace-layout">
      <article className="omv-panel omv-trace-chart-panel" id="omv-trace-chart" data-empty={filtered.length === 0 ? 'true' : undefined}>
        <div className="omv-panel-head omv-trace-chart-head"><div><h3>Event density</h3><p>{traceModeLabel(mode)} · {filtered.length} 条可见事件</p></div><span>{latestVisible === undefined ? '当前筛选无事件' : `最近 ${relativeTime(latestVisible.timestamp)}`}</span></div>
        <div className="omv-trace-plot" data-empty={filtered.length === 0 ? 'true' : undefined} role="img" aria-label={`轨迹${traceModeLabel(mode)}密度图`}>
          <div className="omv-trace-y-axis"><span>高</span><span>中</span><span>低</span></div>
          <div className="omv-trace-bars">{buckets.map((bucket, index) => <span key={`${mode}-${bucket.label}-${index}`} className="omv-trace-bar" style={{ '--trace-height': `${bucket.value === 0 ? 3 : Math.max(8, (bucket.value / maxValue) * 100)}%`, '--trace-delay': `${index * 18}ms` } as CSSProperties} title={`${bucket.label} · ${bucket.value === 0 ? '无事件' : `${bucket.value} ${traceModeLabel(mode)}`}`}><i /></span>)}</div>
          {filtered.length === 0 && <div className="omv-trace-chart-empty"><Icon name="search" size={15} /><span>当前筛选没有时间线事件</span></div>}
        </div>
        <div className="omv-trace-axis" aria-hidden>{buckets.map((bucket, index) => <span key={`${bucket.label}-axis-${index}`}>{index % 4 === 0 ? bucket.label : ''}</span>)}</div>
        <div className="omv-trace-lanes" aria-label="轨迹来源分布">{laneDefinitions.map(lane => <div className="omv-trace-lane" key={lane.kind}><span>{lane.label}<b>{laneTotals[lane.kind]}</b></span><div className="omv-trace-lane-track">{buckets.map((bucket, index) => <i key={`${lane.kind}-${index}`} data-kind={lane.kind} className="omv-trace-lane-cell" style={{ '--trace-intensity': `${bucket.byKind[lane.kind] === 0 ? 0.08 : Math.min(1, .22 + bucket.byKind[lane.kind] / Math.max(1, bucket.entries.length))}` } as CSSProperties} title={`${lane.label} · ${bucket.label} · ${bucket.byKind[lane.kind]} 条`} />)}</div></div>)}</div>
      </article>
      <div className="omv-trace-stats" aria-label="轨迹摘要">
        <Metric label="事件总数" value={events.length} foot={filtered.length === events.length ? '当前工作区活动流' : `筛选后 ${filtered.length} 条`} icon="pulse" color="var(--omv-blue)" />
        <Metric label="活跃任务" value={activeJobs.length} foot={jobs.length === 0 ? '没有后台任务' : `${jobs.length} 个任务已接入`} icon="radar" color="var(--omv-green)" />
        <Metric label="Finding 变化" value={findingChanges} foot="证据状态写入" icon="finding" color="var(--omv-orange)" />
        <Metric label="最近更新" value={latest === undefined ? '—' : relativeTime(latest.timestamp)} foot={latest === undefined ? '等待同步' : formatTime(latest.timestamp)} icon="refresh" color="var(--omv-purple)" />
      </div>
    </section>

    {jobs.length > 0 && <section className="omv-panel omv-trace-jobs"><div className="omv-panel-head"><div><h3>Native tasks</h3><p>当前 DSH 会话中的后台任务，与轨迹事件共享刷新节奏。</p></div><span>{activeJobs.length > 0 ? `${activeJobs.length} 个运行中` : '全部已收敛'}</span></div><div className="omv-trace-job-grid">{jobs.slice(0, 6).map(job => <article className="omv-trace-job" data-state={job.status} key={job.id}><div><i /><strong>{job.label}</strong></div><code>{job.id}</code><span>{statusLabel(job.status)}{job.detail === undefined ? '' : ` · ${firstLine(job.detail)}`}</span></article>)}</div></section>}

    <section className="omv-panel omv-trace-stream"><div className="omv-panel-head"><div><h3>事件流</h3><p>按时间顺序保留证据写入、工作流动作和工具调用的可检索记录。</p></div><span>{eventRange}</span></div>{filtered.length === 0 ? <Empty label="没有匹配的轨迹事件" description="调整搜索关键词或筛选条件后重试。" compact /> : <ol className="omv-trace-events">{displayedEvents.map((entry, index) => { const eventKind = traceKind(entry.action); return <li className="omv-trace-event" data-kind={eventKind} aria-label={`${traceKindLabel(eventKind)} ${activityLabel(entry.action)}${entry.id === undefined ? '' : ` · ${entry.id}`}`} style={{ '--trace-delay': `${Math.min(index, 24) * 24}ms` } as CSSProperties} key={`${entry.timestamp}-${entry.action}-${entry.id ?? 'workspace'}-${index}`}><div className="omv-trace-event-rail"><i data-kind={eventKind} /><span /></div><div className="omv-trace-event-main"><div className="omv-trace-event-title"><span className="omv-trace-badge" data-kind={eventKind}>{traceKindLabel(eventKind)}</span><strong>{activityLabel(entry.action)}{entry.id === undefined ? '' : ` · ${entry.id}`}</strong></div><p className="omv-trace-event-detail"><code>{traceEventDetail(entry)}</code><time title={formatTime(entry.timestamp)}>{relativeTime(entry.timestamp)}</time></p></div></li> })}</ol>}</section>
  </>
}

export function traceKind(action: string): TraceKind {
  const value = action.toLowerCase()
  if (/(repro|radar|threatmap|report|submission)/u.test(value)) return 'tool'
  if (/(workspace|source)/u.test(value)) return 'context'
  if (/(finding|campaign|dedup|verification)/u.test(value)) return 'assistant'
  return 'system'
}

export function traceKindLabel(kind: TraceKind): string {
  return kind === 'tool' ? 'TOOL' : kind === 'assistant' ? 'WORKFLOW' : kind === 'context' ? 'CONTEXT' : 'SYSTEM'
}

export function traceModeLabel(mode: TraceMode): string {
  return mode === 'duration' ? 'Duration' : mode === 'turns' ? 'Turns' : 'Calls'
}

export function traceEventDetail(entry: TraceActivity): string {
  const details = [entry.status, entry.reason, entry.path, entry.from === undefined || entry.to === undefined ? undefined : `${entry.from} → ${entry.to}`]
  return details.filter((value): value is string => typeof value === 'string' && value.trim() !== '').join(' · ') || '工作区活动已记录'
}

export function latestTraceEntry(entries: readonly TraceActivity[]): TraceActivity | undefined {
  return entries.reduce<TraceActivity | undefined>((latest, entry) => {
    if (latest === undefined) return entry
    const currentTime = Date.parse(entry.timestamp)
    const latestTime = Date.parse(latest.timestamp)
    return Number.isFinite(currentTime) && (!Number.isFinite(latestTime) || currentTime > latestTime) ? entry : latest
  }, undefined)
}

export function compareTraceEntries(left: TraceActivity, right: TraceActivity): number {
  const leftTime = Date.parse(left.timestamp)
  const rightTime = Date.parse(right.timestamp)
  if (!Number.isFinite(leftTime) && !Number.isFinite(rightTime)) return 0
  if (!Number.isFinite(leftTime)) return 1
  if (!Number.isFinite(rightTime)) return -1
  return rightTime - leftTime
}

export function buildTraceBuckets(entries: readonly TraceActivity[], mode: TraceMode): TraceBucket[] {
  const count = 24
  const validTimes = entries.map(entry => Date.parse(entry.timestamp)).filter(Number.isFinite)
  const start = validTimes.length === 0 ? Date.now() - 86_400_000 : Math.min(...validTimes)
  const observedSpan = validTimes.length < 2 ? 0 : Math.max(...validTimes) - start
  // Keep the plot focused on the observed trace window. A full-day minimum made
  // a short, active session collapse into two bars at the far left.
  const span = validTimes.length < 2 ? 3_600_000 : Math.max(900_000, observedSpan)
  const buckets = Array.from({ length: count }, (_, index): TraceBucket => ({
    label: new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(new Date(start + (span * index) / (count - 1))),
    entries: [],
    value: 0,
    byKind: { tool: 0, assistant: 0, context: 0, system: 0 },
  }))
  entries.forEach((entry, index) => {
    const timestamp = Date.parse(entry.timestamp)
    const position = Number.isFinite(timestamp) ? Math.round(((timestamp - start) / span) * (count - 1)) : Math.round((index / Math.max(1, entries.length - 1)) * (count - 1))
    const bucket = buckets[Math.max(0, Math.min(count - 1, position))]
    if (bucket === undefined) return
    bucket.entries.push(entry)
    bucket.byKind[traceKind(entry.action)] += 1
  })
  return buckets.map(bucket => {
    const turns = bucket.entries.filter(entry => traceKind(entry.action) !== 'tool').length
    const calls = bucket.byKind.tool
    bucket.value = mode === 'duration' ? bucket.entries.length : mode === 'turns' ? turns : calls
    return bucket
  })
}

export function FindingDetail({ payload, busy, currentSessionId, onClose, onAction, onWorkflow, onLink, onOpenSession, onStartReproduction, onScanDedup, onUpdateDedup, onUpdateReview, onAddReviewNote, onPrepareReport, onScheduleDisclosure }: {
  payload: FindingPayload
  busy: boolean
  currentSessionId: SessionId
  onClose: () => void
  onAction: (request: ActionRequest, message: string) => void
  onWorkflow: (intent: WorkflowIntent) => void
  onLink: () => void
  onOpenSession: (sessionId: string) => void
  onStartReproduction: (findingId: string) => void
  onScanDedup: (findingId: string) => void
  onUpdateDedup: (findingId: string, status: DedupStatus, matchId?: string) => void
  onUpdateReview: (findingId: string, status: ReviewStatus, assignee?: string) => void
  onAddReviewNote: (findingId: string, body: string) => void
  onPrepareReport: (findingId: string) => void
  onScheduleDisclosure: (findingId: string, date: string, channel: DisclosurePlan['channel']) => void
}) {
  const { detail, evidence, doctor, review, collaboration, dedup, reportPack } = payload
  const issues = doctor?.issues ?? []
  const source = valueAt(evidence, 'evidence.source')
  const sink = valueAt(evidence, 'evidence.sink')
  const guard = valueAt(evidence, 'evidence.guard')
  const mainIntent = primaryIntent(payload.stage)
  const linkIsCurrent = payload.sessionLink?.sessionId === currentSessionId
  return (
    <>
      <div className="omv-detail-backdrop" onClick={onClose} />
      <aside className="omv-detail">
        <div className="omv-detail-head"><div className="omv-detail-head-copy"><h2>{detail.id}</h2><p>{detail.package} · {detail.ecosystem} · {detail.vulnerability}</p></div><Status value={payload.stage} /><button type="button" className="omv-icon-button" aria-label="关闭详情" onClick={onClose}><Icon name="close" size={15} /></button></div>
        <div className="omv-detail-body">
          <div className="omv-detail-summary">
            <div className="omv-maturity-hero" data-maturity={payload.assessment.maturity}><i><Icon name="shield" size={17} /></i><strong>{maturityLabel(payload.assessment.maturity)}</strong><small>{phaseLabel(payload.assessment.phase)}</small></div>
            <div className="omv-summary-copy"><h3>{review?.summary ?? (detail.archived ? '发现已归档' : '证据评审')}</h3><p>{payload.assessment.summary} 当前判定 {detail.verdict.exploitability}，综合置信度 {confidenceLabel(payload.assessment.confidence)}。</p>
              {!detail.archived && <div className="omv-detail-actions"><button type="button" className="omv-primary" disabled={busy} onClick={() => onWorkflow(mainIntent)}><Icon name="pulse" size={12} />{workflowLabel(mainIntent)}</button><button type="button" className="omv-secondary" disabled={busy} onClick={() => onAction({ action: 'finding.validate', id: detail.id }, 'Evidence.v1 校验完成')}><Icon name="check" size={12} />校验</button>{detail.status === 'candidate' && <button type="button" className="omv-secondary" disabled={busy} onClick={() => onAction({ action: 'finding.promote', id: detail.id, status: 'confirmed' }, '状态已提升为 confirmed')}><Icon name="arrowUp" size={12} />确认发现</button>}</div>}
            </div>
          </div>
          <Section title="DSH 会话" meta={payload.sessionLink === undefined ? '尚未关联' : formatTime(payload.sessionLink.updatedAt)}>
            <div className="omv-session-link">
              <div><strong>{payload.sessionLink === undefined ? '当前发现还没有调查会话' : linkIsCurrent ? '已绑定当前会话' : '已绑定其他调查会话'}</strong><code>{payload.sessionLink?.sessionId ?? currentSessionId}</code>{payload.sessionLink?.lastIntent !== undefined && <span>最近工作流：{workflowLabel(payload.sessionLink.lastIntent)}</span>}</div>
              <div>{payload.sessionLink !== undefined && !linkIsCurrent && <button type="button" className="omv-secondary" onClick={() => onOpenSession(payload.sessionLink!.sessionId)}>打开会话</button>}{!linkIsCurrent && <button type="button" className="omv-secondary" disabled={busy} onClick={onLink}>关联当前会话</button>}</div>
            </div>
          </Section>
          {!detail.archived && <Section title="审计工作流" meta={statusLabel(payload.stage)}><div className="omv-workflow-actions">{(['audit', 'repro', 'dedup', 'critic', 'report', 'disclose'] as const).map(intent => <button key={intent} type="button" className={intent === mainIntent ? 'omv-primary' : 'omv-secondary'} disabled={busy} onClick={() => onWorkflow(intent)}>{workflowLabel(intent)}</button>)}</div></Section>}
          <Section title="证据成熟度" meta={`${maturityLabel(payload.assessment.maturity)} · ${confidenceLabel(payload.assessment.confidence)}置信度`}>
            <ul className="omv-assessment-dimensions">{payload.assessment.dimensions.map(dimension => <li key={dimension.id} data-state={dimension.state}><i /><div><strong>{dimension.label}</strong><span>{dimension.detail}</span>{dimension.nextAction !== undefined && <code>{dimension.nextAction}</code>}</div><Status value={dimension.state} /></li>)}</ul>
          </Section>
          <Section title="证据链" meta="来源 → 汇聚 → 防护">
            <div className="omv-chain"><ChainCard label="来源" value={source} /><span className="omv-chain-arrow"><Icon name="chevron" size={12} /></span><ChainCard label="汇聚" value={sink} /><span className="omv-chain-arrow"><Icon name="chevron" size={12} /></span><ChainCard label="防护" value={guard} /></div>
          </Section>
          <Section title="提交条件" meta={payload.qualityGate.readyForReport ? '条件满足' : detail.status === 'confirmed' ? `${payload.qualityGate.blockers.length} 项待处理` : '研究阶段 · 暂不硬拦截'}>
            <div className="omv-gate-summary">{payload.qualityGate.summary}</div>
            <ul className="omv-gate-checks">{payload.qualityGate.checks.map(check => <li key={check.id} data-state={check.state} data-blocking={check.blocking || undefined}><i><Icon name={checkStateIcon(check.state)} size={12} /></i><div><strong>{check.label}</strong><span>{check.detail}{check.nextAction === undefined ? '' : ` · ${check.nextAction}`}</span></div><small>{check.blocking ? '提交条件' : '研究建议'}</small></li>)}</ul>
          </Section>
          <Section title="证据图谱" meta={`${payload.graph.nodes.length} 节点 · ${payload.graph.edges.length} 边`}>
            <div className="omv-graph-flow">{payload.graph.nodes.filter(node => node.kind !== 'finding' && node.kind !== 'session' && node.kind !== 'artifact').map(node => <article key={node.id} data-state={node.state}><span>{node.kind}</span><strong>{node.label}</strong><code>{node.value}</code>{node.line !== undefined && <small>line {node.line}</small>}</article>)}</div>
          </Section>
          <Section title="复现运行" meta={`${payload.reproductionRuns.length} 次尝试`}>
            {payload.reproductionRuns.length === 0 ? <div className="omv-inline-empty"><Empty label="尚无结构化复现 Run；使用复现工作流开始" compact /><button type="button" className="omv-secondary" disabled={busy || detail.archived} onClick={() => onStartReproduction(detail.id)}>开始复现</button></div> : <><ul className="omv-repro-runs">{payload.reproductionRuns.map(run => <li key={run.id}><Status value={run.status} /><div><strong>{run.command ?? run.id}</strong><span>{formatTime(run.updatedAt)}{run.exitCode === undefined ? '' : ` · exit ${run.exitCode}`} · {run.artifacts.length} artifacts</span></div>{run.sessionId !== undefined && <button type="button" className="omv-secondary" onClick={() => onOpenSession(run.sessionId!)}>会话</button>}</li>)}</ul><div className="omv-section-footer"><button type="button" className="omv-secondary" disabled={busy || detail.archived} onClick={() => onStartReproduction(detail.id)}>再开一个 Run</button></div></>}
          </Section>
          <Section title="去重情报" meta={`${dedup.status === 'unknown' ? '尚未扫描' : dedup.status} · ${dedup.matches.length} 个匹配`}>
            <div className="omv-dedup-head"><div><strong>{dedup.nextAction}</strong><span>{dedup.scannedAt === undefined ? '扫描本地 Finding 与 Radar 信号，建立可追溯比对。' : `最近扫描：${formatTime(dedup.scannedAt)} · 来源：${dedup.sources.join('、') || '本地'}`}</span></div><button type="button" className="omv-secondary" disabled={busy || detail.archived} onClick={() => onScanDedup(detail.id)}>{dedup.scannedAt === undefined ? '开始扫描' : '重新扫描'}</button></div>
            {dedup.matches.length > 0 && <ul className="omv-dedup-list">{dedup.matches.map(match => <li key={match.id}><div><strong>{match.title}</strong><span>{match.reasons.join(' · ')}</span><code>{match.source} · 相似度 {match.score}%{match.targetFindingId === undefined ? '' : ` · ${match.targetFindingId}`}</code></div><div className="omv-dedup-actions"><Status value={match.status} />{match.status === 'open' && <><button type="button" className="omv-secondary" disabled={busy} onClick={() => onUpdateDedup(detail.id, 'duplicate', match.id)}>确认重复</button><button type="button" className="omv-secondary" disabled={busy} onClick={() => onUpdateDedup(detail.id, 'clear', match.id)}>排除</button></>}</div></li>)}</ul>}
          </Section>
          <Section title="协作评审" meta={statusLabel(collaboration.status)}>
            <div className="omv-review-detail-head"><div><strong>{collaboration.assignee === undefined ? '尚未分配负责人' : `负责人：${collaboration.assignee}`}</strong><span>{collaboration.notes.length} 条意见 · 更新于 {formatTime(collaboration.updatedAt)}</span></div><select className="omv-select" value={collaboration.status} disabled={busy || detail.archived} onChange={event => onUpdateReview(detail.id, event.target.value as ReviewStatus, collaboration.assignee)}>{(['unreviewed', 'in_review', 'changes_requested', 'approved', 'rejected'] as const).map(status => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></div>
            {collaboration.notes.length > 0 && <ul className="omv-review-notes">{collaboration.notes.slice(-6).map(note => <li key={note.id}><div><strong>{note.author}</strong><span>{formatTime(note.createdAt)}</span></div><p>{note.body}</p></li>)}</ul>}
            <ReviewNoteComposer disabled={busy || detail.archived} onSubmit={body => onAddReviewNote(detail.id, body)} />
          </Section>
          <Section title="报告与披露" meta={statusLabel(reportPack.status)}>
            <div className="omv-report-detail-head"><div><strong>{reportPack.nextAction}</strong><span>{reportPack.artifacts.length} 个 artifact · {reportPack.missing.length} 项缺失{reportPack.provenanceFresh === true ? ' · provenance 新鲜' : ''}</span></div><button type="button" className="omv-secondary" disabled={busy || detail.archived} onClick={() => onPrepareReport(detail.id)}>{reportPack.status === 'missing' ? '生成草稿' : '刷新材料'}</button></div>
            {(reportPack.artifacts.length > 0 || reportPack.missing.length > 0) && <ul className="omv-report-detail-files">{reportPack.artifacts.map(path => <li key={path}><Icon name="check" size={11} /><code>{path}</code></li>)}{reportPack.missing.map(path => <li data-missing="true" key={`missing-${path}`}><Icon name="alert" size={11} /><code>{path}</code></li>)}</ul>}
            <DisclosureQuickSchedule disabled={busy || detail.archived} onSubmit={(date, channel) => onScheduleDisclosure(detail.id, date, channel)} />
          </Section>
          {payload.disclosures.length > 0 && <Section title="披露时间线" meta={`${payload.disclosures.length} 个节点`}><ul className="omv-disclosure-history">{payload.disclosures.map(plan => <li key={plan.id}><Status value={plan.status} /><div><strong>{disclosureChannelLabel(plan.channel)} · {plan.dueAt.slice(0, 10)}</strong><span>{plan.recipient ?? '未指定对象'} · 创建于 {formatTime(plan.createdAt)}</span>{plan.notes !== undefined && <p>{plan.notes}</p>}</div></li>)}</ul></Section>}
          <Section title="评审问题" meta={`${issues.length} 项`}>
            {issues.length === 0 ? <Empty label="当前没有校验问题" compact /> : <ul className="omv-issues">{issues.slice(0, 16).map((issue, index) => <li className="omv-issue" key={`${issue.id}-${index}`}><i className="omv-issue-dot" style={{ '--issue': issue.severity === 'error' ? '#ff6075' : issue.severity === 'warning' ? '#f3b85b' : '#7188ff' } as CSSProperties} /><div><strong>{issue.message}</strong><code>{issue.nextAction}</code></div></li>)}</ul>}
          </Section>
          <Section title="证据变更" meta={payload.lastDiff === undefined ? '尚无插件变更' : `${payload.lastDiff.additions}+ / ${payload.lastDiff.deletions}-`}>
            {payload.lastDiff === undefined ? <Empty label="工作流产生 Evidence 变更后会在这里展示" compact /> : <div className="omv-diff"><div><span>{payload.lastDiff.action}</span><code>{payload.lastDiff.beforeHash} → {payload.lastDiff.afterHash}</code></div><pre>{payload.lastDiff.patch}</pre></div>}
          </Section>
          <Section title="工作流历史" meta={`${payload.history.length} 条事件`}>
            {payload.history.length === 0 ? <Empty label="当前发现还没有 DSH 工作流记录" compact /> : <ul className="omv-history">{payload.history.slice(0, 12).map(event => <li key={event.id}><i style={{ background: activityColor(event.action) }} /><div><strong>{event.intent === undefined ? activityLabel(event.action) : workflowLabel(event.intent)}</strong><span>{formatTime(event.timestamp)}{event.sessionId === undefined ? '' : ` · ${event.sessionId}`}</span></div>{event.diff !== undefined && <b>{event.diff.additions}+ / {event.diff.deletions}-</b>}</li>)}</ul>}
          </Section>
          <Section title="下一步动作" meta={review?.verdict ?? detail.status}><div style={{ padding: 12 }}><code className="omv-next" style={{ display: 'block', whiteSpace: 'normal' }}>{detail.nextAction}</code></div></Section>
          {detail.archived && <div className="omv-detail-actions"><button type="button" className="omv-secondary" disabled={busy} onClick={() => onAction({ action: 'finding.restore', id: detail.id }, '漏洞发现已恢复')}><Icon name="refresh" size={12} />恢复到活跃队列</button></div>}
        </div>
      </aside>
    </>
  )
}

export function ReviewNoteComposer({ disabled, onSubmit }: { disabled: boolean; onSubmit: (body: string) => void }) {
  const [body, setBody] = useState('')
  const submit = () => { const value = body.trim(); if (value === '') return; onSubmit(value); setBody('') }
  return <div className="omv-review-composer"><textarea className="omv-textarea" value={body} disabled={disabled} placeholder="记录证据疑问、复现建议或报告修改意见…" onChange={event => setBody(event.target.value)} /><button type="button" className="omv-secondary" disabled={disabled || body.trim() === ''} onClick={submit}>添加意见</button></div>
}

export function DisclosureQuickSchedule({ disabled, onSubmit }: { disabled: boolean; onSubmit: (date: string, channel: DisclosurePlan['channel']) => void }) {
  const [date, setDate] = useState(() => new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10))
  const [channel, setChannel] = useState<DisclosurePlan['channel']>('internal')
  return <div className="omv-disclosure-quick"><div><span>下一次披露节点</span><strong>排期会写入本地时间线</strong></div><input className="omv-input" type="date" value={date} disabled={disabled} onChange={event => setDate(event.target.value)} /><select className="omv-select" value={channel} disabled={disabled} onChange={event => setChannel(event.target.value as DisclosurePlan['channel'])}><option value="internal">内部</option><option value="vendor">厂商</option><option value="cna">CNA</option><option value="public">公开</option></select><button type="button" className="omv-secondary" disabled={disabled || date === ''} onClick={() => onSubmit(date, channel)}>排期</button></div>
}

export function NewFindingDialog({ busy, onClose, onSubmit }: { busy: boolean; onClose: () => void; onSubmit: (request: ActionRequest) => void }) {
  const [id, setId] = useState('')
  const [product, setProduct] = useState('')
  const [ecosystem, setEcosystem] = useState('npm')
  const [vulnerabilityClass, setVulnerabilityClass] = useState('')
  const [goal, setGoal] = useState<'triage' | 'CVE' | 'VulDB' | 'advisory'>('triage')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit({ action: 'finding.create', id, product, ecosystem, vulnerabilityClass, researcherGoal: goal })
  }
  return <Modal title="新建候选漏洞" onClose={onClose}><form className="omv-form" onSubmit={submit}><div className="omv-form-grid">
    <Field label="发现 ID" full><input autoFocus required className="omv-input" value={id} placeholder="npm-package-ssrf" onChange={event => setId(event.target.value)} /></Field>
    <Field label="包 / 产品"><input required className="omv-input" value={product} placeholder="package-name" onChange={event => setProduct(event.target.value)} /></Field>
    <Field label="生态"><select className="omv-select" value={ecosystem} onChange={event => setEcosystem(event.target.value)}>{['npm','python','go','rust','java','ruby','php','csharp','swift','dart','elixir','perl','r','lua'].map(value => <option key={value}>{value}</option>)}</select></Field>
    <Field label="漏洞类型"><input required className="omv-input" value={vulnerabilityClass} placeholder="ssrf / path-traversal" onChange={event => setVulnerabilityClass(event.target.value)} /></Field>
    <Field label="研究目标"><select className="omv-select" value={goal} onChange={event => setGoal(event.target.value as typeof goal)}><option value="triage">分流</option><option value="CVE">CVE</option><option value="VulDB">VulDB</option><option value="advisory">安全通告</option></select></Field>
  </div><p className="omv-form-note">将创建候选状态的 Evidence.v1 模板；所有未知字段会显式保留为 unknown。</p><div className="omv-form-actions"><button type="button" className="omv-secondary" onClick={onClose}>取消</button><button type="submit" className="omv-primary" disabled={busy}>创建候选</button></div></form></Modal>
}

export function NewCampaignDialog({ busy, onClose, onSubmit }: { busy: boolean; onClose: () => void; onSubmit: (request: ActionRequest) => void }) {
  const [target, setTarget] = useState('')
  const [ecosystem, setEcosystem] = useState('npm')
  const [classes, setClasses] = useState('ssrf, path-traversal')
  const [depth, setDepth] = useState<'quick' | 'standard' | 'deep'>('standard')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit({ action: 'campaign.create', target, ecosystem, vulnerabilities: classes.split(',').map(value => value.trim()).filter(Boolean), depth, mode: 'passive', output: 'research-notes', localReproduction: 'unknown' })
  }
  return <Modal title="新建审计战役" onClose={onClose}><form className="omv-form" onSubmit={submit}><div className="omv-form-grid">
    <Field label="研究目标" full><input autoFocus required className="omv-input" value={target} placeholder="package or repository" onChange={event => setTarget(event.target.value)} /></Field>
    <Field label="生态"><select className="omv-select" value={ecosystem} onChange={event => setEcosystem(event.target.value)}>{['unknown','npm','python','go','rust','java','ruby','php','csharp','swift','dart','elixir','perl','r','lua'].map(value => <option key={value} value={value}>{value === 'unknown' ? '未知' : value}</option>)}</select></Field>
    <Field label="深度"><select className="omv-select" value={depth} onChange={event => setDepth(event.target.value as typeof depth)}><option value="quick">快速</option><option value="standard">标准</option><option value="deep">深入</option></select></Field>
    <Field label="漏洞类型（逗号分隔）" full><input required className="omv-input" value={classes} onChange={event => setClasses(event.target.value)} /></Field>
  </div><p className="omv-form-note">生成 Campaign.v1 与对应 runbook，后续可按 lane 初始化独立候选发现。</p><div className="omv-form-actions"><button type="button" className="omv-secondary" onClick={onClose}>取消</button><button type="submit" className="omv-primary" disabled={busy}>创建战役</button></div></form></Modal>
}
