import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import type { JobView, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type {
  ActionRequest,
  CampaignPayload,
  DashboardPayload,
  DedupStatus,
  FindingPayload,
  SearchHit,
  WorkflowIntent,
} from '../contracts.js'
import { OMV_TABS } from '../settings.js'
import { dedupComplete, dedupExistingCve, dedupSources, findingIdError } from './derive.js'
import { EvidenceFlowCanvas } from './flow-canvas.js'
import { CampaignWarRoom } from './war-room.js'
import type { Tab, IconName } from './types.js'
import {
  activityColor,
  activityLabel,
  api,
  campaignLabel,
  checkStateIcon,
  confidenceLabel,
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
  DedupSourceLogo,
  EcoChip,
  EcosystemAvatar,
  Empty,
  EvidenceStatusLogo,
  Field,
  Hero,
  Icon,
  Loading,
  Maturity,
  Metric,
  Modal,
  PriorityIssueLogo,
  Section,
  Status,
} from './ui.js'

export function CommandPalette({ tab, onTab, onNewFinding, onNewCampaign, onClose }: { tab: Tab; onTab: (tab: Tab) => void; onNewFinding: () => void; onNewCampaign: () => void; onClose: () => void }) {
  const labels: Record<Tab, string> = { overview: '总览', findings: '漏洞', reproduction: '复现', campaigns: '审计任务', search: '搜索' }
  const actions: Array<{ label: string; hint: string; run: () => void }> = [
    ...OMV_TABS.map((item, index) => ({ label: `打开${labels[item]}`, hint: String(index + 1), run: () => onTab(item) })),
    { label: '新建候选漏洞', hint: 'Finding', run: onNewFinding },
    { label: '新建审计任务', hint: 'Campaign', run: onNewCampaign },
  ]
  const [query, setQuery] = useState('')
  const filtered = actions.filter(action => `${action.label} ${action.hint}`.toLowerCase().includes(query.trim().toLowerCase()))
  const [activeIndex, setActiveIndex] = useState(0)
  useEffect(() => setActiveIndex(0), [query])
  const runActive = () => filtered[Math.min(activeIndex, Math.max(0, filtered.length - 1))]?.run()
  const moveActive = (offset: number) => {
    if (filtered.length === 0) return
    setActiveIndex(index => (index + offset + filtered.length) % filtered.length)
  }
  return (
    <div className="omv-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="omv-command-palette" role="dialog" aria-modal="true" aria-label="OMV 命令面板" onMouseDown={event => event.stopPropagation()}>
        <div className="omv-command-palette-head">
          <Icon name="search" size={14} />
          <input
            autoFocus
            aria-label="搜索命令"
            className="omv-input"
            value={query}
            placeholder="搜索视图或动作…"
            onChange={event => setQuery(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Escape') onClose()
              else if (event.key === 'ArrowDown') { event.preventDefault(); moveActive(1) }
              else if (event.key === 'ArrowUp') { event.preventDefault(); moveActive(-1) }
              else if (event.key === 'Home') { event.preventDefault(); setActiveIndex(0) }
              else if (event.key === 'End') { event.preventDefault(); setActiveIndex(Math.max(0, filtered.length - 1)) }
              else if (event.key === 'Enter') runActive()
            }}
          />
          <kbd>↑↓</kbd><kbd>ESC</kbd>
        </div>
        <ul>
          {filtered.map((action, index) => {
            const isCurrent = labels[tab] !== undefined && action.label === `打开${labels[tab]}`
            const isActive = index === activeIndex
            return <li key={`${action.label}-${action.hint}`}>
              <button type="button" className={`omv-command-palette-item${isCurrent ? ' active' : ''}`} data-active={isActive || undefined} aria-current={isCurrent || undefined} onMouseEnter={() => setActiveIndex(index)} onClick={action.run}>
                <span>{action.label}</span><kbd>{action.hint}</kbd>
              </button>
            </li>
          })}
        </ul>
        {filtered.length === 0 && <Empty label="没有匹配动作" compact />}
      </div>
    </div>
  )
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
  const queue = data.findings.slice(0, 5)
  return (
    <div className="omv-overview">
      <Hero
        eyebrow="工作区概览"
        title="风险态势"
        description="查看候选漏洞、证据成熟度和下一步审计动作。"
        actions={<><button type="button" className="omv-secondary" onClick={() => onTab('campaigns')}><Icon name="campaign" size={13} />查看审计任务</button><button type="button" className="omv-primary" onClick={onNew}><Icon name="plus" size={13} />新建候选</button></>}
      />
      {data.workspaceIssues.length > 0 && <WorkspaceIssuesNotice issues={data.workspaceIssues} onTab={onTab} onOpenConfigured={onOpenConfigured} />}
      {data.campaignIssues.length > 0 && <button type="button" className="omv-campaign-notice" onClick={() => onTab('campaigns')}><Icon name="alert" size={13} /><span><strong>{data.campaignIssues.length} 份 Campaign 配置需要处理</strong><small>其余审计数据已正常加载</small></span><Icon name="chevron" size={13} /></button>}
      <div className="omv-overview-stats">
        <Stat label="活跃发现" value={metrics.active} detail={`${metrics.candidates} 条仍在审计`} tone="blue" icon="finding" />
        <Stat label="已确认" value={metrics.confirmed} detail={`${metrics.reportReady} 条报告就绪`} tone="green" icon="check" />
        <Stat label="复现中" value={metrics.reproducing} detail={`${metrics.activeReproductions} 个运行中`} tone="teal" icon="pulse" />
        <Stat label="阻塞项目" value={metrics.blocked} detail={metrics.blocked > 0 ? '需要优先介入' : '当前无阻塞'} tone="red" icon="alert" />
        <div className="omv-overview-sync"><span className="omv-live-dot" />最后同步<span>{formatTime(data.generatedAt)}</span></div>
      </div>
      <OverviewQuality data={data} onTab={onTab} onFinding={onFinding} onOpenConfigured={onOpenConfigured} />
      <div className="omv-overview-main">
        <section className="omv-panel omv-action-panel">
          <div className="omv-panel-head"><div><p className="omv-panel-kicker">下一步动作</p><h3>优先审计队列</h3><p>按证据缺口、阻塞状态和推进价值排序</p></div><button type="button" className="omv-secondary" onClick={() => onTab('findings')}>全部发现</button></div>
          {queue.length === 0 ? <Empty label="当前工作区还没有候选漏洞" description="从一个候选开始，Evidence.v1 会保留每一步研究上下文。" action={<button type="button" className="omv-secondary" onClick={onNew}><Icon name="plus" size={12} />创建候选</button>} /> : (
            <ul className="omv-queue">
              {queue.map(finding => (
                <li key={finding.id} className="omv-queue-row" role="button" tabIndex={0} aria-label={`打开 ${finding.id}`} onClick={() => onFinding(finding.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onFinding(finding.id) } }}>
                  <div className="omv-finding-name"><EcosystemAvatar ecosystem={finding.ecosystem} /><div><strong>{finding.id}</strong><span>{finding.package} · {finding.vulnerability}</span></div></div>
                  <div className="omv-queue-action"><span>下一步</span><code className="omv-next">{finding.nextAction}</code></div>
                  <Maturity assessment={finding.assessment} compact />
                  <Icon name="chevron" size={14} />
                </li>
              ))}
            </ul>
          )}
        </section>
        <div className="omv-overview-rail"><EvidenceChart metrics={metrics} /><StageChart metrics={metrics} /></div>
      </div>
      <div className="omv-overview-bottom"><RecentActivity data={data} /><NativeJobs jobs={jobs} onRetry={onRetryJob} /></div>
    </div>
  )
}

function OverviewQuality({ data, onTab, onFinding, onOpenConfigured }: {
  data: DashboardPayload
  onTab: (tab: Tab) => void
  onFinding: (id: string) => void
  onOpenConfigured?: (() => Promise<void>) | undefined
}) {
  const quality = data.quality
  const queues = [
    { id: 'evidence', label: '补齐证据', value: quality.queues.needsEvidence, tab: 'findings' as Tab, detail: '论证链仍有缺口' },
    { id: 'repro', label: '待复现', value: quality.queues.needsReproduction, tab: 'reproduction' as Tab, detail: '需要运行时验证' },
    { id: 'dedup', label: '待去重', value: quality.queues.needsDedup, tab: 'findings' as Tab, detail: '尚未完成情报比对' },
    { id: 'report', label: '报告就绪', value: quality.queues.reportReady, tab: 'findings' as Tab, detail: '材料接近齐备' },
  ]
  const issues = quality.issues.slice(0, 4)
  return <section className="omv-panel omv-overview-quality">
    <div className="omv-overview-quality-head">
      <div><p className="omv-panel-kicker">证据运营</p><h3>质量信号</h3><p>把阻塞、提醒和下一步动作放回工作流，而不是单独维护一页。</p></div>
      <div className="omv-overview-quality-score" data-state={qualitySignalTone(quality)}><strong>{quality.score}</strong><span>{qualitySignalLabel(quality)}</span><small>{quality.blockers} 阻塞 · {quality.warnings} 提醒 · {quality.infos} 建议</small></div>
    </div>
    <div className="omv-overview-quality-queues">{queues.map(queue => <button key={queue.id} type="button" className="omv-overview-quality-queue" onClick={() => onTab(queue.tab)}><span>{queue.label}</span><strong>{queue.value}</strong><small>{queue.detail}</small><Icon name="chevron" size={11} /></button>)}</div>
    {issues.length > 0 ? <div className="omv-overview-quality-issues"><div className="omv-overview-quality-issues-head"><span>优先处理</span>{quality.issues.length > issues.length && <small>还有 {quality.issues.length - issues.length} 项</small>}{onOpenConfigured !== undefined && <button type="button" className="omv-link-button" onClick={() => { void onOpenConfigured() }}>打开默认工作区</button>}</div><ul>{issues.map(issue => <li key={issue.id} className="omv-quality-issue" data-severity={issue.severity} onClick={() => issue.findingId !== undefined && onFinding(issue.findingId)} role={issue.findingId === undefined ? undefined : 'button'} tabIndex={issue.findingId === undefined ? undefined : 0} onKeyDown={event => { if (issue.findingId !== undefined && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onFinding(issue.findingId) } }}><PriorityIssueLogo severity={issue.severity} /><div><strong>{issue.title}</strong><span>{issue.detail}</span><small>下一步：{issue.nextAction}</small></div><Status value={issue.severity} /></li>)}</ul></div> : <div className="omv-overview-quality-clear"><Icon name="check" size={13} />当前没有待处理质量事项</div>}
  </section>
}

function Stat({ label, value, detail, tone, icon }: { label: string; value: number; detail: string; tone: string; icon: IconName }) {
  return <div className={`omv-overview-stat omv-tone-${tone}`}><div className="omv-overview-stat-head"><span>{label}</span><i><Icon name={icon} size={12} /></i></div><strong>{value}</strong><small>{detail}</small></div>
}

function EvidenceChart({ metrics }: { metrics: DashboardPayload['metrics'] }) {
  const items = [
    ['已验证', metrics.evidenceMaturity.verified, 'green', 'check'],
    ['证据支撑', metrics.evidenceMaturity.supported, 'teal', 'shield'],
    ['正在推进', metrics.evidenceMaturity.developing, 'orange', 'pulse'],
    ['尚未映射', metrics.evidenceMaturity.unmapped, 'muted', 'finding'],
    ['存在争议', metrics.evidenceMaturity.contested, 'red', 'alert'],
  ] as const
  const total = Math.max(1, metrics.active)
  return <section className="omv-panel omv-chart-panel"><div className="omv-panel-head"><div><p className="omv-panel-kicker">证据状态</p><h3>证据成熟度</h3><p>发现从候选到可提交的推进状态</p></div><strong className="omv-chart-total">{metrics.evidenceMaturity.verified + metrics.evidenceMaturity.supported}<small>已形成支撑</small></strong></div><div className="omv-evidence-bars">{items.map(([label, value, tone, icon]) => <div className="omv-evidence-row" key={label}><div><span><Icon name={icon} size={11} />{label}</span><b>{value}</b></div><i className={`omv-bar-${tone}`} style={{ width: `${Math.round(value / total * 100)}%` }} /></div>)}</div></section>
}

function StageChart({ metrics }: { metrics: DashboardPayload['metrics'] }) {
  const stages = [['候选', metrics.candidates, 'blue', 'finding'], ['调查中', metrics.investigating, 'teal', 'eye'], ['复现中', metrics.reproducing, 'orange', 'pulse'], ['已确认', metrics.confirmed, 'green', 'check'], ['报告就绪', metrics.reportReady, 'purple', 'file']] as const
  const max = Math.max(1, ...stages.map(([, value]) => value))
  return <section className="omv-panel omv-chart-panel"><div className="omv-panel-head"><div><p className="omv-panel-kicker">工作流阶段</p><h3>审计阶段</h3><p>当前活跃发现的工作流分布</p></div></div><div className="omv-stage-chart">{stages.map(([label, value, tone, icon]) => <div className="omv-stage-col" key={label}><div className={`omv-stage-value omv-stage-${tone}`} style={{ height: `${Math.max(8, value / max * 100)}%` }}><b>{value}</b></div><span><Icon name={icon} size={10} />{label}</span></div>)}</div></section>
}

export function NativeJobs({ jobs, onRetry }: { jobs: readonly JobView[]; onRetry: (job: JobView) => void }) {
  const visible = jobs.slice(-6).reverse()
  return <section className="omv-panel"><div className="omv-panel-head"><div><h3>DSH 后台任务</h3><p>当前会话的原生 Jobs</p></div></div>{visible.length === 0 ? <Empty label="当前会话没有后台任务" compact /> : <ul className="omv-native-jobs">{visible.map(job => { const icon: IconName = job.status === 'running' || job.status === 'stopping' ? 'pulse' : job.status === 'completed' ? 'check' : job.status === 'failed' || job.status === 'killed' ? 'alert' : 'clock'; return <li key={job.id}><i data-state={job.status}><Icon name={icon} size={11} /></i><div><strong>{job.label}</strong><span>{job.kind} · {job.status}{job.detail === undefined ? '' : ` · ${job.detail}`}</span></div>{job.status === 'failed' || job.status === 'killed' ? <button type="button" className="omv-secondary" onClick={() => onRetry(job)}><Icon name="refresh" size={11} />重试</button> : <code>{job.id}</code>}</li> })}</ul>}</section>
}

export function RecentActivity({ data }: { data: DashboardPayload }) {
  const entries = data.activity.slice(0, 8)
  return <section className="omv-panel"><div className="omv-panel-head"><div><h3>最近变更</h3><p>证据写入与工作流动作</p></div></div>{entries.length === 0 ? <Empty label="暂无活动记录" compact /> : <ul className="omv-history">{entries.map((entry, index) => <li key={`${entry.timestamp}-${entry.action}-${entry.id ?? 'workspace'}-${index}`}><i style={{ color: activityColor(entry.action) }}><Icon name="activity" size={11} /></i><div><strong>{activityLabel(entry.action)}</strong><span>{entry.id ?? '工作区'} · {relativeTime(entry.timestamp)}</span></div></li>)}</ul>}</section>
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
    <div className="omv-findings-page">
      <Hero eyebrow="Evidence.v1" title="漏洞发现" description="追踪候选、确认、阻塞和归档状态。" actions={<button type="button" className="omv-primary" onClick={onNew}><Icon name="plus" size={13} />新建候选</button>} />
      {data.workspaceIssues.length > 0 && <WorkspaceIssuesNotice issues={data.workspaceIssues} onOpenConfigured={onOpenConfigured} />}
      <div className="omv-findings-summary" aria-label="漏洞统计">
        <div><strong>{data.findings.length}</strong><span>活跃发现</span></div>
        <div><strong>{data.findings.filter(finding => finding.status === 'confirmed' || finding.stage === 'report_ready').length}</strong><span>已确认 / 可提交</span></div>
        <div><strong>{data.findings.filter(finding => finding.stage === 'blocked').length}</strong><span>需要处理</span></div>
        <div><strong>{data.archived.length}</strong><span>已归档</span></div>
      </div>
      <div className="omv-toolbar">
        <div className="omv-search"><Icon name="search" size={14} /><input className="omv-input" value={query} placeholder="搜索 ID、包名、漏洞类型…" onChange={event => setQuery(event.target.value)} /></div>
        <select className="omv-select" style={{ width: 128 }} value={status} onChange={event => setStatus(event.target.value)}>
          <option value="active">全部活跃</option><option value="candidate">候选</option><option value="investigating">调查中</option><option value="reproducing">复现中</option><option value="confirmed">已确认</option><option value="report_ready">可提交</option><option value="disclosed">已披露</option><option value="blocked">阻塞</option><option value="archived">已归档</option>
        </select>
      </div>
      <div className="omv-list-wrap">
        <div className="omv-list-head" role="row"><span>发现</span><span>阶段</span><span>生态</span><span>证据状态</span><span>下一步</span></div>
        {((status === 'archived' ? archived.length : active.length) === 0) ? (
          <Empty label="没有匹配的漏洞发现" description={query === '' && status === 'active' ? '工作区中还没有活跃发现。' : '试试清空关键词或切换状态筛选。'} action={(query !== '' || status !== 'active') ? <button type="button" className="omv-secondary" onClick={() => { setQuery(''); setStatus('active') }}>清除筛选</button> : <button type="button" className="omv-primary" onClick={onNew}><Icon name="plus" size={12} />新建候选</button>} />
        ) : (
          <ul className="omv-finding-list">
            {status !== 'archived' && active.map(finding => (
              <li key={finding.id} className="omv-finding-row" data-stage={finding.stage} role="link" tabIndex={0} aria-label={`打开 ${finding.id}`} onClick={() => onFinding(finding.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onFinding(finding.id) } }}>
                <div className="omv-finding-name"><EcosystemAvatar ecosystem={finding.ecosystem} size="lg" /><div><strong>{finding.id}</strong><span>{finding.package} · {finding.vulnerability}</span></div></div>
                <Status value={finding.stage} />
                <EcoChip ecosystem={finding.ecosystem} />
                <Maturity assessment={finding.assessment} />
                <code className="omv-cell-mono" title={finding.nextAction}>{finding.nextAction}</code>
              </li>
            ))}
            {status === 'archived' && archived.map(finding => (
              <li key={finding.id} className="omv-finding-row" role="link" tabIndex={0} aria-label={`打开 ${finding.id}`} onClick={() => onFinding(finding.id, true)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onFinding(finding.id, true) } }}>
                <div className="omv-finding-name"><EcosystemAvatar ecosystem={finding.ecosystem} size="lg" /><div><strong>{finding.id}</strong><span>{finding.package} · {finding.vulnerability}</span></div></div>
                <Status value="archived" />
                <EcoChip ecosystem={finding.ecosystem} />
                <span className="omv-muted-copy">已归档</span>
                <code className="omv-cell-mono" title={finding.archiveReason}>{finding.archiveReason}</code>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export function WorkspaceIssuesNotice({ issues, onTab, onOpenConfigured }: { issues: DashboardPayload['workspaceIssues']; onTab?: (tab: Tab) => void; onOpenConfigured?: (() => Promise<void>) | undefined }) {
  const findingIssues = issues.filter(issue => issue.kind === 'finding')
  const label = findingIssues.length === 1 ? '1 个 Evidence 文件未加载' : `${findingIssues.length} 个 Evidence 文件未加载`
  return <section className="omv-data-notice" role="status"><Icon name="alert" size={14} /><div><strong>{label}</strong><span>其余审计数据仍可使用；修复 YAML 后点击右上角刷新即可恢复。</span><details><summary>查看文件</summary><ul>{findingIssues.slice(0, 6).map(issue => <li key={issue.id}><code>{issue.id}</code><span>{firstLine(issue.message)}</span></li>)}</ul></details></div><div className="omv-data-notice-actions">{onOpenConfigured !== undefined && <button type="button" className="omv-secondary" onClick={() => { void onOpenConfigured() }}>默认工作区</button>}{onTab !== undefined && <button type="button" className="omv-secondary" onClick={() => onTab('findings')}>查看台账</button>}</div></section>
}

export function Campaigns({ data, busy, onNew, onCampaign, onRepair }: { data: DashboardPayload; busy: boolean; onNew: () => void; onCampaign: (id: string) => void; onRepair: (id: string) => void }) {
  const [query, setQuery] = useState('')
  const laneCount = data.campaigns.reduce((total, campaign) => total + campaign.laneCount, 0)
  const normalizedQuery = query.trim().toLowerCase()
  const filteredCampaigns = data.campaigns.filter(campaign => `${campaign.title} ${campaign.target} ${campaign.version} ${campaign.id}`.toLowerCase().includes(normalizedQuery))
  return (
    <div className="omv-campaigns-page">
      <header className="omv-workbench-header">
        <div>
          <div className="omv-workbench-title"><h2>审计任务</h2><code>Campaign.v1</code></div>
          <p><b>{data.campaigns.length}</b> 个任务 · <b>{laneCount}</b> 条 Lane · <b>{data.campaigns.filter(campaign => campaign.nextAction !== '').length}</b> 个待推进{data.campaignIssues.length > 0 && <span className="omv-page-context-warning"><i />{data.campaignIssues.length} 项配置待处理</span>}</p>
        </div>
        <button type="button" className="omv-primary" onClick={onNew}><Icon name="plus" size={13} />新建任务</button>
      </header>
      {data.campaignIssues.length > 0 && <section className="omv-panel omv-campaign-issues"><div className="omv-panel-head"><div><h3>配置诊断</h3><p>异常文件已隔离，不影响其他审计任务和漏洞数据</p></div><Status value="needs_attention" /></div><ul>{data.campaignIssues.map(issue => <li key={issue.path}><i><Icon name="alert" size={11} /></i><div><strong>{issue.id}</strong><span>{issue.changes.length > 0 ? issue.changes.join(' · ') : issue.message}</span><code>{issue.path}</code></div>{issue.repairable && <button type="button" className="omv-secondary" disabled={busy} onClick={() => onRepair(issue.id)}><Icon name="refresh" size={11} />修复配置</button>}</li>)}</ul></section>}
      {data.campaigns.length === 0 ? <div className="omv-panel"><Empty label="还没有审计任务" description="把一个目标和漏洞类型组合成可恢复的研究计划。" action={<button type="button" className="omv-primary" onClick={onNew}><Icon name="plus" size={12} />创建审计任务</button>} /></div> : <>
        <div className="omv-index-toolbar"><div className="omv-campaign-search"><Icon name="search" size={13} /><input aria-label="搜索审计任务" className="omv-input" value={query} placeholder="搜索任务、目标或 ID" onChange={event => setQuery(event.target.value)} />{query !== '' && <button type="button" aria-label="清除搜索" onClick={() => setQuery('')}><Icon name="close" size={12} /></button>}</div><span className="omv-index-count">{filteredCampaigns.length} / {data.campaigns.length}</span></div>
        {filteredCampaigns.length === 0 ? <div className="omv-panel"><Empty label="没有匹配的任务" description="试试目标名称、版本号或任务 ID。" compact /></div> : <div className="omv-campaigns omv-campaign-list">
          <div className="omv-campaign-list-head" aria-hidden="true"><span>任务</span><span>状态</span><span>下一步</span><span>规模</span><span /></div>
          {filteredCampaigns.map(campaign => (
            <article className="omv-campaign" data-status={campaign.status} key={campaign.id} role="button" tabIndex={0} onClick={() => onCampaign(campaign.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onCampaign(campaign.id) } }}>
              <div className="omv-campaign-main"><span className="omv-campaign-icon"><Icon name="folder" size={15} /></span><div><h3>{campaign.title}</h3><p>{campaign.target} · {campaign.version} · <code>{campaign.id}</code></p></div></div>
              <Status value={campaign.status} />
              <div className="omv-campaign-next"><span>下一步</span><strong>{campaign.nextAction || '暂无'}</strong></div>
              <div className="omv-campaign-foot"><span>{campaign.laneCount} Lane</span></div>
              <Icon name="chevron" size={13} />
            </article>
          ))}
        </div>}
      </>}
    </div>
  )
}

export function CampaignDetail({ payload, busy, isBusy, currentSessionId, expanded, onToggleExpand, onClose, onStart, onControl, onOpenSession, onFinding, onAction }: {
  payload: CampaignPayload
  busy: boolean
  isBusy?: (...keys: string[]) => boolean
  currentSessionId: SessionId
  expanded: boolean
  onToggleExpand: () => void
  onClose: () => void
  onStart: () => void
  onControl: (runId: string, control: 'pause' | 'resume' | 'cancel' | 'retry', laneId?: string) => void
  onOpenSession: (sessionId: string) => void
  onFinding?: (findingId: string) => void
  onAction: (request: ActionRequest, message: string) => void
}) {
  const rowBusy = isBusy ?? (() => busy)
  const { campaign, surfaces } = payload
  const run = payload.runs[0]
  const activeRun = run !== undefined && (run.status === 'running' || run.status === 'queued' || run.status === 'paused')
  const linkedElsewhere = payload.sessionLink !== undefined && payload.sessionLink.sessionId !== currentSessionId
  const hasCards = surfaces.cards.length > 0
  const selectedCards = surfaces.cards.filter(card => card.status === 'selected')
  const graphLanes = selectedCards.length > 0
    ? selectedCards.map(card => ({ id: card.id, title: card.title, vulnerability_class: card.vulnerabilityClass, finding_id: card.findingId }))
    : campaign.lanes
  const runLaneById = new Map((run?.lanes ?? []).map(lane => [lane.laneId, lane]))
  const warLanes = graphLanes.map(lane => {
    const current = runLaneById.get(lane.id)
    return {
      id: lane.id,
      title: lane.title,
      detail: lane.vulnerability_class,
      status: current?.status ?? 'pending',
      attempts: current?.attempts ?? 0,
      summary: current?.summary,
      sessionId: current?.sessionId,
      findingId: current?.findingId ?? lane.finding_id,
    }
  })
  const completed = run?.lanes.filter(lane => lane.status === 'completed').length ?? 0
  const attention = run?.lanes.filter(lane => lane.status === 'blocked' || lane.status === 'failed' || lane.status === 'awaiting_evidence').length ?? 0
  const resolved = run?.lanes.filter(lane => lane.status === 'completed' || lane.status === 'blocked' || lane.status === 'failed' || lane.status === 'cancelled').length ?? 0
  const total = run?.lanes.length ?? graphLanes.length
  const completedWidth = total === 0 ? 0 : Math.round(completed / total * 100)
  const attentionWidth = total === 0 ? 0 : Math.round(attention / total * 100)
  const pendingWidth = Math.max(0, 100 - completedWidth - attentionWidth)
  const selectionBlocked = hasCards && surfaces.selected === 0
  const startLabel = !hasCards ? '提出攻击面' : activeRun ? run?.status === 'paused' ? 'Run 已暂停' : 'Run 运行中' : run === undefined ? '开始首轮 Run' : '创建新一轮 Run'
  const startDisabled = busy || activeRun || selectionBlocked
  const startHint = selectionBlocked ? '先在下方选用 2–3 张攻击面卡片，再启动 Run。' : undefined
  const start = () => {
    if (!hasCards) onAction({ action: 'campaign.surfaces.propose', id: campaign.id }, '已提出攻击面卡片')
    else onStart()
  }
  return <>
    <div className="omv-detail-backdrop" onClick={onClose} />
    <aside className="omv-detail omv-campaign-detail" data-expanded={expanded || undefined} role={expanded ? 'dialog' : undefined} aria-modal={expanded || undefined} aria-label={`${campaign.title} 详情`}>
      <div className="omv-detail-head"><div className="omv-detail-head-copy"><h2>{campaign.title}</h2><p>{campaign.target.name} · {campaign.target.version} · {campaign.target.ecosystem}</p></div><Status value={run?.status ?? campaign.status} /><button type="button" className="omv-icon-button omv-detail-expand" aria-label={expanded ? '还原半屏详情' : '放大详情'} aria-expanded={expanded} title={expanded ? '还原半屏详情' : '放大详情'} onClick={onToggleExpand}><Icon name={expanded ? 'minimize' : 'maximize'} size={15} /></button><button type="button" className="omv-icon-button" autoFocus aria-label="关闭详情" onClick={onClose}><Icon name="close" size={15} /></button></div>
      <div className="omv-detail-body">
        <div className="omv-campaign-summary"><div><span>审计深度</span><strong>{campaignLabel(campaign.budget.depth)}</strong></div><div><span>范围模式</span><strong>{campaignLabel(campaign.scope.mode)}</strong></div><div><span>输出目标</span><strong>{campaignLabel(campaign.goal.output)}</strong></div><div><span>攻击面</span><strong>{hasCards ? `${surfaces.selected} 选用 · ${surfaces.skipped} 跳过` : '尚未提出'}</strong></div></div>
        <div className="omv-detail-actions">
          <button type="button" className="omv-primary" disabled={startDisabled} title={startHint} onClick={start}><Icon name="campaign" size={12} />{startLabel}</button>
          {hasCards && <button type="button" className="omv-secondary" disabled={busy} onClick={() => onAction({ action: 'campaign.surfaces.propose', id: campaign.id, force: true }, '已重新提出攻击面卡片')}>重新提出</button>}
          {linkedElsewhere && <button type="button" className="omv-secondary" onClick={() => onOpenSession(payload.sessionLink!.sessionId)}>打开关联会话</button>}
        </div>
        {startHint !== undefined && <p className="omv-hint-line" role="note">{startHint}</p>}
        <Section title="攻击面卡片" meta={hasCards ? `${surfaces.selected} 选用 · ${surfaces.proposed} 待定 · ${surfaces.skipped} 跳过` : '开题'}>
          {surfaces.issue !== undefined && <p className="omv-surface-issue">{surfaces.issue}</p>}
          {!hasCards ? <Empty label="还没有攻击面卡片" description="先提出卡片，再选用 2–3 张未证实假说。选用不等于存在漏洞。" compact /> : (
            <ul className="omv-surface-cards">{surfaces.cards.map(card => (
              <li key={card.id} className="omv-surface-card" data-status={card.status}>
                <div className="omv-surface-card-head">
                  <div><span className="omv-surface-kicker">{card.vulnerabilityClass} · {card.pack}</span><strong>{card.title}</strong></div>
                  <Status value={card.status} />
                </div>
                <p>{card.why}</p>
                <div className="omv-surface-lists"><div><span>Sources</span><small>{card.sources.join(' · ')}</small></div><div><span>Sinks</span><small>{card.sinks.join(' · ')}</small></div><div><span>Guards</span><small>{card.guards.join(' · ')}</small></div></div>
                <small className="omv-surface-fp">证伪检查：{card.falsePositiveChecks.join(' · ')}</small>
                <div className="omv-surface-actions">
                  <code>{card.findingId}</code>
                  <button type="button" className="omv-secondary" disabled={busy || card.status === 'selected'} onClick={() => onAction({ action: 'campaign.surfaces.select', id: campaign.id, cardIds: [card.id] }, `已选用 ${card.id}`)}>选用</button>
                  <button type="button" className="omv-secondary" disabled={busy || card.status === 'skipped'} onClick={() => onAction({ action: 'campaign.surfaces.skip', id: campaign.id, cardIds: [card.id] }, `已跳过 ${card.id}`)}>跳过</button>
                </div>
              </li>
            ))}</ul>
          )}
        </Section>
        <Section title="执行地图" meta={run === undefined ? `${graphLanes.length} 条 Lane · 待启动` : `${statusLabel(run.status)} · 并发 ${run.concurrency} · ${resolved}/${total} 已收敛`}>
          {run !== undefined && (
            <>
              <div className="omv-run-head"><div><strong>{run.id}</strong><span>{formatTime(run.updatedAt)} · {completed} 完成 · {attention} 待处理 · {total - completed - attention} 未收敛</span></div><div>{run.status === 'running' || run.status === 'queued' ? <button type="button" className="omv-secondary" disabled={rowBusy(`campaign.run:${run.id}:pause:all`)} onClick={() => onControl(run.id, 'pause')}>暂停</button> : run.status === 'paused' ? <button type="button" className="omv-secondary" disabled={rowBusy(`campaign.run:${run.id}:resume:all`)} onClick={() => onControl(run.id, 'resume')}>恢复</button> : null}{activeRun && <button type="button" className="omv-secondary" disabled={rowBusy(`campaign.run:${run.id}:cancel:all`)} onClick={() => onControl(run.id, 'cancel')}>取消</button>}</div></div>
              <div className="omv-run-progress"><i data-kind="completed" style={{ width: `${completedWidth}%` }} /><i data-kind="attention" style={{ left: `${completedWidth}%`, width: `${attentionWidth}%` }} /><i data-kind="pending" style={{ left: `${completedWidth + attentionWidth}%`, width: `${pendingWidth}%` }} /></div>
            </>
          )}
          <CampaignWarRoom
            target={`${campaign.target.name} ${campaign.target.version}`}
            ecosystem={campaign.target.ecosystem}
            lanes={warLanes}
            onControl={onControl}
            onOpenSession={onOpenSession}
            {...(onFinding === undefined ? {} : { onFinding })}
          />
        </Section>
        <Section title="运行手册" meta={payload.runbookExists ? '就绪' : '缺失'}><div className="omv-path-block"><code>{payload.runbookPath}</code><span>{payload.nextAction}</span></div></Section>
        <Section title="编排历史" meta={`${payload.history.length} 条事件`}>{payload.history.length === 0 ? <Empty label="该审计任务尚未在 DSH 中运行" compact /> : <ul className="omv-history">{payload.history.map(event => <li key={event.id}><i style={{ color: activityColor(event.action) }}><Icon name="activity" size={11} /></i><div><strong>{activityLabel(event.action)}</strong><span>{formatTime(event.timestamp)} · {event.sessionId ?? '未知会话'}</span></div></li>)}</ul>}</Section>
      </div>
    </aside>
  </>
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
  const counts = useMemo(() => {
    const summary = { finding: 0, campaign: 0, activity: 0 }
    for (const result of results) summary[result.kind] += 1
    return summary
  }, [results])
  return <div className="omv-search-page">
    <header className="omv-workbench-header">
      <div>
        <div className="omv-workbench-title"><h2>搜索</h2><span>工作区索引</span></div>
        <p>Evidence · 审计任务 · 活动记录</p>
      </div>
    </header>
    <div className="omv-search-toolbar">
      <div className="omv-search omv-global-search" aria-busy={searching} data-searching={searching || undefined}>
        <Icon name="search" size={15} />
        <input aria-label="搜索 OMV 工作区" autoFocus className="omv-input" value={query} placeholder="搜索 Finding、包名、证据或任务" onChange={event => setQuery(event.target.value)} />
        {query !== '' && <button type="button" className="omv-search-clear" aria-label="清除搜索" onClick={() => setQuery('')}><Icon name="close" size={13} /></button>}
        {searching && <span className="omv-search-progress" aria-hidden="true" />}
      </div>
    </div>
    <section className="omv-panel omv-search-results">
      <div className="omv-results-meta">
        {query.trim() === '' ? '等待输入' : searching ? '搜索中…' : error !== undefined ? '搜索失败' : <><b>{results.length}</b> 个结果{results.length > 0 && <span>发现 {counts.finding} · 任务 {counts.campaign} · 活动 {counts.activity}</span>}</>}
      </div>
      {searching ? <Loading label="搜索工作区…" /> : error !== undefined ? (
        <Empty label="搜索失败" description={error} action={<button type="button" className="omv-secondary" onClick={() => setRetryNonce(value => value + 1)}><Icon name="refresh" size={12} />重试</button>} />
      ) : query.trim() === '' ? (
        <Empty label="搜索工作区" description="输入 Finding、包名、漏洞类型、任务或活动关键词。" />
      ) : results.length === 0 ? (
        <Empty label="没有匹配结果" description="换一个关键词，或检查当前会话连接的工作区。" />
      ) : (
        <ul>
          {results.map(result => {
            const actionable = result.kind === 'finding' || result.kind === 'campaign'
            const open = () => {
              if (result.kind === 'finding') onFinding(result.id, result.archived)
              else if (result.kind === 'campaign') onCampaign(result.id)
            }
            return (
              <li
                key={`${result.kind}-${result.id}`}
                {...(actionable ? {
                  tabIndex: 0,
                  role: 'button' as const,
                  'aria-label': `打开 ${result.title}`,
                  onKeyDown: (event: React.KeyboardEvent) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open() } },
                } : {})}
                onClick={actionable ? open : undefined}
                data-actionable={actionable}
              >
                <span className="omv-search-kind" data-kind={result.kind}><Icon name={result.kind === 'finding' ? 'finding' : result.kind === 'campaign' ? 'campaign' : 'activity'} size={14} /><small>{result.kind === 'finding' ? '发现' : result.kind === 'campaign' ? '任务' : '活动'}</small></span>
                <div><strong>{result.title}</strong><span>{result.description}</span></div>
                {actionable && <Icon name="chevron" size={12} />}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  </div>
}

export function ReproductionPage({ data, onFinding, onStart, onOpenSession }: {
  data: DashboardPayload
  onFinding: (id: string) => void
  onStart: (id: string) => void
  onOpenSession?: (sessionId: string) => void
}) {
  const [filter, setFilter] = useState<'all' | 'running' | 'passed' | 'attention'>('all')
  const runs = data.reproductionRuns
  const active = runs.filter(run => run.status === 'running').length
  const passedRuns = runs.filter(run => run.status === 'passed')
  const attentionRuns = runs.filter(run => run.status === 'failed' || run.status === 'blocked')
  const pendingCandidates = data.findings.filter(finding => finding.assessment.dimensions.some(dimension => dimension.id === 'runtime_verification' && dimension.state !== 'verified' && dimension.state !== 'not_applicable'))
  const needs = pendingCandidates.length
  const filteredRuns = runs.filter(run => filter === 'all' || filter === run.status || (filter === 'attention' && (run.status === 'failed' || run.status === 'blocked')))
  const pendingFindings = pendingCandidates.slice(0, 8)
  const filterItems = [
    { id: 'all' as const, label: '全部', count: runs.length },
    { id: 'running' as const, label: '运行中', count: active },
    { id: 'passed' as const, label: '已通过', count: passedRuns.length },
    { id: 'attention' as const, label: '需处理', count: attentionRuns.length },
  ]
  return <div className="omv-reproduction-page">
    <Hero eyebrow="运行时证据" title="复现实验室" description="把命令、环境、输出和 artifact 作为结构化 Run 留在 Finding 旁边，复现结果会回写证据链。" actions={<span className="omv-hero-status"><i data-state={active > 0 ? 'live' : 'idle'} />{active > 0 ? `${active} 个 Run 正在执行` : '当前没有运行中的 Run'}</span>} />
    <div className="omv-page-context omv-repro-context"><span><b>{runs.length}</b> 次运行</span><span><b>{active}</b> 运行中</span><span><b>{passedRuns.length}</b> 已通过</span><span className={attentionRuns.length > 0 ? 'omv-page-context-warning' : undefined}><i /> <b>{attentionRuns.length}</b> 需处理</span><span><b>{needs}</b> 个发现待验证</span></div>
    <div className="omv-metrics omv-repro-metrics"><Metric label="运行总数" value={runs.length} foot={<><b>{passedRuns.length}</b> 次已通过</>} icon="pulse" color="var(--omv-teal)" /><Metric label="待验证发现" value={needs} foot="可从下方直接开始复现" icon="finding" color="var(--omv-orange)" /><Metric label="失败 / 阻塞" value={attentionRuns.length} foot="保留现场，继续补充环境" icon="alert" color="var(--omv-red)" /><Metric label="通过率" value={runs.length === 0 ? '—' : `${Math.round(passedRuns.length / runs.length * 100)}%`} foot="按 Run 计算" icon="check" color="var(--omv-green)" /></div>
    <div className="omv-repro-layout">
      <section className="omv-panel omv-repro-board"><div className="omv-panel-head"><div><p className="omv-panel-kicker">RUN HISTORY</p><h3>实验队列</h3><p>每个 Run 都可回到对应 Finding 查看完整上下文</p></div><div className="omv-repro-filters" role="tablist" aria-label="筛选复现运行">{filterItems.map(item => <button key={item.id} type="button" role="tab" aria-selected={filter === item.id} data-active={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}<b>{item.count}</b></button>)}</div></div>{filteredRuns.length === 0 ? <Empty label={runs.length === 0 ? '还没有复现 Run' : '没有匹配的运行'} description={runs.length === 0 ? '从右侧待验证发现或 Finding 详情开始一个结构化复现。' : '切换状态筛选，查看其他实验运行。'} compact /> : <ul>{filteredRuns.map(run => <li key={run.id} className="omv-repro-card"><div className="omv-repro-card-head"><Status value={run.status} /><button type="button" className="omv-link-button" onClick={() => onFinding(run.findingId)}>{run.findingId}<Icon name="chevron" size={11} /></button><code>{run.id}</code></div><strong>{run.command ?? '等待命令'}</strong><div className="omv-repro-facts"><span><small>环境</small>{run.environment === undefined ? '尚未记录' : Object.entries(run.environment).map(([key, value]) => `${key}=${value}`).join(' · ')}</span><span><small>结果</small>{run.exitCode === undefined ? '未结束' : `exit ${run.exitCode}`}</span><span><small>附件</small>{run.artifacts.length} 个 artifact</span></div>{run.output !== undefined && <pre>{run.output}</pre>}<div className="omv-repro-card-foot"><span>{formatTime(run.updatedAt)} · {run.status === 'running' ? '等待运行结果' : run.finishedAt === undefined ? '已更新' : `完成于 ${formatTime(run.finishedAt)}`}</span><div>{run.sessionId !== undefined && onOpenSession !== undefined && <button type="button" className="omv-link-button" onClick={() => onOpenSession(run.sessionId!)}><Icon name="terminal" size={11} />会话</button>}{run.status === 'failed' || run.status === 'blocked' ? <button type="button" className="omv-secondary" onClick={() => onStart(run.findingId)}>重新开始</button> : null}</div></div></li>)}</ul>}</section>
      <section className="omv-panel omv-repro-pending"><div className="omv-panel-head"><div><p className="omv-panel-kicker">NEXT TO VERIFY</p><h3>待验证发现</h3><p>从这里直接启动下一次复现</p></div><strong>{needs}</strong></div>{pendingFindings.length === 0 ? <Empty label="所有发现都已完成运行时验证" description="新的候选出现后会自动进入这里。" compact /> : <ul>{pendingFindings.map(finding => <li key={finding.id}><button type="button" className="omv-repro-pending-row" onClick={() => onFinding(finding.id)}><EcosystemAvatar ecosystem={finding.ecosystem} /><span><strong>{finding.id}</strong><small>{finding.package} · {finding.vulnerability}</small></span><Maturity assessment={finding.assessment} compact /><Icon name="chevron" size={12} /></button><div className="omv-repro-pending-action"><span>{finding.nextAction}</span><button type="button" className="omv-primary" onClick={() => onStart(finding.id)}>开始复现</button></div></li>)}</ul>}{pendingFindings.length < needs && <div className="omv-section-footer"><button type="button" className="omv-link-button" onClick={() => onFinding(pendingFindings[0]?.id ?? '')}>查看其余 {needs - pendingFindings.length} 个发现</button></div>}</section>
    </div>
  </div>
}

export function FindingDetail({ payload, busy, expanded, onToggleExpand, isBusy, currentSessionId, onClose, onAction, onWorkflow, onLink, onOpenSession, onOpenPath, onStartReproduction, onScanDedup, onUpdateDedup }: {
  payload: FindingPayload
  busy: boolean
  expanded: boolean
  onToggleExpand: () => void
  isBusy?: (...keys: string[]) => boolean
  currentSessionId: SessionId
  onClose: () => void
  onAction: (request: ActionRequest, message: string) => void
  onWorkflow: (intent: WorkflowIntent) => void
  onLink: () => void
  onOpenSession: (sessionId: string) => void
  onOpenPath?: (path: string) => void
  onStartReproduction: (findingId: string) => void
  onScanDedup: (findingId: string) => void
  onUpdateDedup: (findingId: string, status: DedupStatus, matchId?: string) => void
}) {
  const { detail, evidence, doctor, review, dedup } = payload
  const issues = doctor?.issues ?? []
  const source = valueAt(evidence, 'evidence.source')
  const sink = valueAt(evidence, 'evidence.sink')
  const guard = valueAt(evidence, 'evidence.guard')
  const sources = dedupSources(evidence)
  const sixSourceComplete = dedupComplete(evidence)
  const existingCve = dedupExistingCve(evidence)
  const rowBusy = isBusy ?? (() => busy)
  const mainIntent = primaryIntent(payload.stage)
  const linkIsCurrent = payload.sessionLink?.sessionId === currentSessionId
  return (
    <>
      <div className="omv-detail-backdrop" onClick={onClose} />
      <aside className="omv-detail omv-finding-detail" data-expanded={expanded || undefined} role={expanded ? 'dialog' : undefined} aria-modal={expanded || undefined} aria-label={`${detail.id} 详情`}>
        <div className="omv-detail-head"><div className="omv-detail-head-copy"><h2>{detail.id}</h2><p>{detail.package} · {detail.ecosystem} · {detail.vulnerability}</p></div><Status value={payload.stage} /><button type="button" className="omv-icon-button omv-detail-expand" aria-label={expanded ? '还原半屏详情' : '放大详情'} aria-expanded={expanded} title={expanded ? '还原半屏详情' : '放大详情'} onClick={onToggleExpand}><Icon name={expanded ? 'minimize' : 'maximize'} size={15} /></button><button type="button" className="omv-icon-button" autoFocus aria-label="关闭详情" onClick={onClose}><Icon name="close" size={15} /></button></div>
        <div className="omv-detail-body">
          <div className="omv-detail-summary">
            <div className="omv-maturity-hero" data-maturity={payload.assessment.maturity}><EvidenceStatusLogo maturity={payload.assessment.maturity} /><div className="omv-maturity-copy"><small>证据状态</small><strong>{maturityLabel(payload.assessment.maturity)}</strong><span>{phaseLabel(payload.assessment.phase)}</span></div></div>
            <div className="omv-summary-copy">
              <h3>{review?.summary ?? (detail.archived ? '发现已归档' : '证据评审')}</h3>
              <p>{payload.assessment.summary} 当前判定 {detail.verdict.exploitability}，综合置信度 {confidenceLabel(payload.assessment.confidence)}。</p>
              {!detail.archived && <div className="omv-next-chip" title="下一步动作"><span>下一步</span><code>{detail.nextAction}</code></div>}
              {!detail.archived && <div className="omv-detail-actions"><button type="button" className="omv-primary" disabled={busy} onClick={() => onWorkflow(mainIntent)}><Icon name="pulse" size={12} />{workflowLabel(mainIntent)}</button><button type="button" className="omv-secondary" disabled={busy} onClick={() => onAction({ action: 'finding.validate', id: detail.id }, 'Evidence.v1 校验完成')}><Icon name="check" size={12} />校验</button>{detail.status === 'candidate' && <button type="button" className="omv-secondary" disabled={busy} onClick={() => onAction({ action: 'finding.promote', id: detail.id, status: 'confirmed' }, '状态已提升为 confirmed')}><Icon name="arrowUp" size={12} />确认发现</button>}</div>}
            </div>
          </div>
          <Section title="DSH 会话" meta={payload.sessionLink === undefined ? '尚未关联' : formatTime(payload.sessionLink.updatedAt)}>
            <div className="omv-session-link" data-linked={payload.sessionLink !== undefined}>
              <i className="omv-session-link-icon"><Icon name="terminal" size={16} /></i>
              <div><strong>{payload.sessionLink === undefined ? '当前发现还没有调查会话' : linkIsCurrent ? '已绑定当前会话' : '已绑定其他调查会话'}</strong><code>{payload.sessionLink?.sessionId ?? currentSessionId}</code>{payload.sessionLink?.lastIntent !== undefined && <span>最近工作流：{workflowLabel(payload.sessionLink.lastIntent)}</span>}</div>
              <div>{payload.sessionLink !== undefined && !linkIsCurrent && <button type="button" className="omv-secondary" onClick={() => onOpenSession(payload.sessionLink!.sessionId)}>打开会话</button>}{!linkIsCurrent && <button type="button" className="omv-secondary" disabled={busy} onClick={onLink}>关联当前会话</button>}</div>
            </div>
          </Section>
          {!detail.archived && <Section title="审计工作流" meta={statusLabel(payload.stage)}><div className="omv-workflow-actions">{(['audit', 'repro', 'dedup', 'critic', 'report', 'disclose'] as const).map(intent => <button key={intent} type="button" className={intent === mainIntent ? 'omv-primary' : 'omv-secondary'} disabled={busy} onClick={() => onWorkflow(intent)}>{workflowLabel(intent)}</button>)}</div></Section>}
          <Section title="证据成熟度" meta={`${maturityLabel(payload.assessment.maturity)} · ${confidenceLabel(payload.assessment.confidence)}置信度`}>
            <ul className="omv-assessment-dimensions">{payload.assessment.dimensions.map(dimension => <li key={dimension.id} data-state={dimension.state}><i><Icon name={checkStateIcon(dimension.state)} size={11} /></i><div><strong>{dimension.label}</strong><span>{dimension.detail}</span>{dimension.nextAction !== undefined && <code>{dimension.nextAction}</code>}</div><Status value={dimension.state} /></li>)}</ul>
          </Section>
          <Section title="证据链" meta="来源 → 汇聚 → 防护">
            <div className="omv-chain">
              <ChainCard label="来源" value={source} {...(onOpenPath === undefined ? {} : { onOpen: onOpenPath })} />
              <span className="omv-chain-arrow"><Icon name="chevron" size={12} /></span>
              <ChainCard label="汇聚" value={sink} {...(onOpenPath === undefined ? {} : { onOpen: onOpenPath })} />
              <span className="omv-chain-arrow"><Icon name="chevron" size={12} /></span>
              <ChainCard label="防护" value={guard} {...(onOpenPath === undefined ? {} : { onOpen: onOpenPath })} />
            </div>
          </Section>
          <Section title="提交条件" meta={payload.qualityGate.readyForReport ? '条件满足' : detail.status === 'confirmed' ? `${payload.qualityGate.blockers.length} 项待处理` : '研究阶段 · 暂不硬拦截'}>
            <div className="omv-gate-summary">{payload.qualityGate.summary}</div>
            <ul className="omv-gate-checks">{payload.qualityGate.checks.map(check => <li key={check.id} data-state={check.state} data-blocking={check.blocking || undefined}><i><Icon name={checkStateIcon(check.state)} size={12} /></i><div><strong>{check.label}</strong><span>{check.detail}{check.nextAction === undefined ? '' : ` · ${check.nextAction}`}</span></div><small>{check.blocking ? '提交条件' : '研究建议'}</small></li>)}</ul>
          </Section>
          <Section title="证据图谱" meta={`攻击路径 · ${payload.graph.nodes.length} 节点 · ${payload.graph.edges.length} 边`}>
            <EvidenceFlowCanvas graph={payload.graph} {...(onOpenPath === undefined ? {} : { onOpenPath })} />
          </Section>
          <Section title="复现运行" meta={`${payload.reproductionRuns.length} 次尝试`}>
            {payload.reproductionRuns.length === 0 ? <div className="omv-inline-empty"><Empty label="尚无结构化复现 Run；使用复现工作流开始" compact /><button type="button" className="omv-secondary" disabled={busy || detail.archived} onClick={() => onStartReproduction(detail.id)}>开始复现</button></div> : <><ul className="omv-repro-runs">{payload.reproductionRuns.map(run => <li key={run.id}><Status value={run.status} /><div><strong>{run.command ?? run.id}</strong><span>{formatTime(run.updatedAt)}{run.exitCode === undefined ? '' : ` · exit ${run.exitCode}`} · {run.artifacts.length} artifacts</span></div>{run.sessionId !== undefined && <button type="button" className="omv-secondary" onClick={() => onOpenSession(run.sessionId!)}>会话</button>}</li>)}</ul><div className="omv-section-footer"><button type="button" className="omv-secondary" disabled={busy || detail.archived} onClick={() => onStartReproduction(detail.id)}>再开一个 Run</button></div></>}
          </Section>
          <Section title="去重情报" meta={`${dedup.status === 'unknown' ? '尚未扫描' : dedup.status} · ${dedup.matches.length} 个匹配`}>
            <div className="omv-dedup-head"><div><strong>{dedup.nextAction}</strong><span>{dedup.scannedAt === undefined ? '扫描本地 Finding，建立可追溯比对。' : `最近扫描：${formatTime(dedup.scannedAt)} · 来源：${dedup.sources.join('、') || '本地'}`}</span></div><button type="button" className="omv-secondary" disabled={busy || detail.archived} onClick={() => onScanDedup(detail.id)}>{dedup.scannedAt === undefined ? '开始扫描' : '重新扫描'}</button></div>
            <div className="omv-dedup-sources" data-complete={sixSourceComplete || undefined}>
              <div className="omv-dedup-sources-head">
                <span>六源新颖性核查</span>
                <b>{sixSourceComplete ? '六源齐全' : `${sources.filter(item => item.searched).length}/6`}</b>
                <small>advisory 库干净 ≠ 新颖；公开讨论源（Issues/PRs、Commits、Web）披露即重复。</small>
              </div>
              <ul>
                {sources.map(item => (
                  <li key={item.key} data-searched={item.searched || undefined} data-group={item.group}>
                    <DedupSourceLogo source={item.key} searched={item.searched} />
                    <span>{item.label}</span>
                    <em>{item.searched ? '已检索' : '未检索'}</em>
                  </li>
                ))}
              </ul>
              <div className="omv-dedup-cve">existing_cve：<code>{existingCve}</code>{existingCve !== 'none' && existingCve !== 'unknown' && <b>疑似已有披露</b>}</div>
            </div>
            {dedup.matches.length > 0 && <ul className="omv-dedup-list">{dedup.matches.map(match => <li key={match.id}><div><strong>{match.title}</strong><span>{match.reasons.join(' · ')}</span><code>{match.source} · 相似度 {match.score}%{match.targetFindingId === undefined ? '' : ` · ${match.targetFindingId}`}</code></div><div className="omv-dedup-actions"><Status value={match.status} />{match.status === 'open' && <><button type="button" className="omv-secondary" disabled={rowBusy(`action:dedup.update:${detail.id}`)} onClick={() => onUpdateDedup(detail.id, 'duplicate', match.id)}>确认重复</button><button type="button" className="omv-secondary" disabled={rowBusy(`action:dedup.update:${detail.id}`)} onClick={() => onUpdateDedup(detail.id, 'clear', match.id)}>排除</button></>}</div></li>)}</ul>}
          </Section>
          <Section title="评审问题" meta={`${issues.length} 项`}>
            {issues.length === 0 ? <Empty label="当前没有校验问题" compact /> : <ul className="omv-issues">{issues.slice(0, 16).map((issue, index) => <li className="omv-issue" key={`${issue.id}-${index}`}><i className="omv-issue-dot" style={{ '--issue': issue.severity === 'error' ? '#ff6075' : issue.severity === 'warning' ? '#f3b85b' : '#7188ff' } as CSSProperties} /><div><strong>{issue.message}</strong><code>{issue.nextAction}</code></div></li>)}</ul>}
          </Section>
          <Section title="证据变更" meta={payload.lastDiff === undefined ? '尚无插件变更' : `${payload.lastDiff.additions}+ / ${payload.lastDiff.deletions}-`}>
            {payload.lastDiff === undefined ? <Empty label="工作流产生 Evidence 变更后会在这里展示" compact /> : <div className="omv-diff"><div><span>{payload.lastDiff.action}</span><code>{payload.lastDiff.beforeHash} → {payload.lastDiff.afterHash}</code></div><pre>{payload.lastDiff.patch}</pre></div>}
          </Section>
          <Section title="工作流历史" meta={`${payload.history.length} 条事件`}>
            {payload.history.length === 0 ? <Empty label="当前发现还没有 DSH 工作流记录" compact /> : <ul className="omv-history">{payload.history.slice(0, 12).map(event => <li key={event.id}><i style={{ color: activityColor(event.action) }}><Icon name="activity" size={11} /></i><div><strong>{event.intent === undefined ? activityLabel(event.action) : workflowLabel(event.intent)}</strong><span>{formatTime(event.timestamp)}{event.sessionId === undefined ? '' : ` · ${event.sessionId}`}</span></div>{event.diff !== undefined && <b>{event.diff.additions}+ / {event.diff.deletions}-</b>}</li>)}</ul>}
          </Section>
          {detail.archived && <div className="omv-detail-actions"><button type="button" className="omv-secondary" disabled={busy} onClick={() => onAction({ action: 'finding.restore', id: detail.id }, '漏洞发现已恢复')}><Icon name="refresh" size={12} />恢复到活跃队列</button></div>}
        </div>
      </aside>
    </>
  )
}

export function NewFindingDialog({ busy, onClose, onSubmit }: { busy: boolean; onClose: () => void; onSubmit: (request: ActionRequest) => void }) {
  const [id, setId] = useState('')
  const [product, setProduct] = useState('')
  const [ecosystem, setEcosystem] = useState('npm')
  const [vulnerabilityClass, setVulnerabilityClass] = useState('')
  const [goal, setGoal] = useState<'triage' | 'CVE' | 'VulDB' | 'advisory'>('triage')
  const [touched, setTouched] = useState(false)
  const idIssue = touched ? findingIdError(id) : undefined
  const submit = (event: FormEvent) => {
    event.preventDefault()
    setTouched(true)
    if (findingIdError(id) !== undefined || product.trim() === '' || vulnerabilityClass.trim() === '') return
    onSubmit({ action: 'finding.create', id: id.trim(), product: product.trim(), ecosystem, vulnerabilityClass: vulnerabilityClass.trim(), researcherGoal: goal })
  }
  return <Modal title="新建候选漏洞" onClose={onClose}><form className="omv-form" onSubmit={submit} noValidate><div className="omv-form-grid">
    <Field label="发现 ID" full>
      <input autoFocus required className="omv-input" value={id} placeholder="npm-package-ssrf" aria-invalid={idIssue !== undefined || undefined} onChange={event => setId(event.target.value)} onBlur={() => setTouched(true)} />
      {idIssue !== undefined && <span className="omv-field-error" role="alert">{idIssue}</span>}
    </Field>
    <Field label="包 / 产品"><input required className="omv-input" value={product} placeholder="package-name" onChange={event => setProduct(event.target.value)} /></Field>
    <Field label="生态"><select className="omv-select" value={ecosystem} onChange={event => setEcosystem(event.target.value)}>{['npm','python','go','rust','java','ruby','php','csharp','swift','dart','elixir','perl','r','lua'].map(value => <option key={value}>{value}</option>)}</select></Field>
    <Field label="漏洞类型"><input required className="omv-input" value={vulnerabilityClass} placeholder="ssrf / path-traversal" onChange={event => setVulnerabilityClass(event.target.value)} /></Field>
    <Field label="研究目标"><select className="omv-select" value={goal} onChange={event => setGoal(event.target.value as typeof goal)}><option value="triage">分流</option><option value="CVE">CVE</option><option value="VulDB">VulDB</option><option value="advisory">安全通告</option></select></Field>
  </div><p className="omv-form-note">将创建候选状态的 Evidence.v1 模板；所有未知字段会显式保留为 unknown。</p><div className="omv-form-actions"><button type="button" className="omv-secondary" onClick={onClose}>取消</button><button type="submit" className="omv-primary" disabled={busy || idIssue !== undefined}>创建候选</button></div></form></Modal>
}

export function NewCampaignDialog({ busy, onClose, onSubmit }: { busy: boolean; onClose: () => void; onSubmit: (request: ActionRequest) => void }) {
  const [target, setTarget] = useState('')
  const [ecosystem, setEcosystem] = useState('npm')
  const [classes, setClasses] = useState('ssrf, path-traversal')
  const [depth, setDepth] = useState<'quick' | 'standard' | 'deep'>('standard')
  const [touched, setTouched] = useState(false)
  const targetIssue = touched && target.trim() === '' ? '需要填写研究目标' : undefined
  const submit = (event: FormEvent) => {
    event.preventDefault()
    setTouched(true)
    if (target.trim() === '') return
    onSubmit({ action: 'campaign.create', target: target.trim(), ecosystem, vulnerabilities: classes.split(',').map(value => value.trim()).filter(Boolean), depth, mode: 'passive', output: 'research-notes', localReproduction: 'unknown' })
  }
  return <Modal title="新建审计任务" onClose={onClose}><form className="omv-form" onSubmit={submit} noValidate><div className="omv-form-grid">
    <Field label="研究目标" full>
      <input autoFocus required className="omv-input" value={target} placeholder="package or repository" aria-invalid={targetIssue !== undefined || undefined} onChange={event => setTarget(event.target.value)} onBlur={() => setTouched(true)} />
      {targetIssue !== undefined && <span className="omv-field-error" role="alert">{targetIssue}</span>}
    </Field>
    <Field label="生态"><select className="omv-select" value={ecosystem} onChange={event => setEcosystem(event.target.value)}>{['unknown','npm','python','go','rust','java','ruby','php','csharp','swift','dart','elixir','perl','r','lua'].map(value => <option key={value} value={value}>{value === 'unknown' ? '未知' : value}</option>)}</select></Field>
    <Field label="深度"><select className="omv-select" value={depth} onChange={event => setDepth(event.target.value as typeof depth)}><option value="quick">快速</option><option value="standard">标准</option><option value="deep">深入</option></select></Field>
    <Field label="漏洞类型（逗号分隔）" full><input required className="omv-input" value={classes} onChange={event => setClasses(event.target.value)} /></Field>
  </div><p className="omv-form-note">生成 Campaign.v1 与 runbook。创建后先提出攻击面卡片，选用 2–3 张未证实假说再开始执行。</p><div className="omv-form-actions"><button type="button" className="omv-secondary" onClick={onClose}>取消</button><button type="submit" className="omv-primary" disabled={busy || targetIssue !== undefined}>创建审计任务</button></div></form></Modal>
}
