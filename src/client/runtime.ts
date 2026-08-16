import type {
  ApiResponse,
  AuditStage,
  DashboardPayload,
  EvidenceAssessment,
  EvidenceCheckState,
  WorkflowIntent,
} from '../contracts.js'
import type { ISessions, SettingsScope, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { DEFAULT_OMV_SETTINGS, OMV_LOCAL_TAB_KEY, isOmvSettingsTab, type OmvSettings, type OmvSettingsTab } from '../settings.js'
import type { IconName } from './types.js'

declare global {
  interface Window {
    __DSH_OMV__?: {
      apiPrefix?: string
      projectRoot?: string
      refreshIntervalMs?: number
    }
  }
}

export function configuredRoot(): string {
  return window.__DSH_OMV__?.projectRoot ?? '.'
}

export function decodeSettings(value: unknown): OmvSettings | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined
  const defaultTab = (value as { defaultTab?: unknown }).defaultTab
  return isOmvSettingsTab(defaultTab) ? { defaultTab } : DEFAULT_OMV_SETTINGS
}

export function localDefaultTab(): OmvSettingsTab | undefined {
  try {
    const value = window.localStorage.getItem(OMV_LOCAL_TAB_KEY)
    return isOmvSettingsTab(value) ? value : undefined
  } catch {
    return undefined
  }
}

export function persistDefaultTab(settings: SettingsScope<OmvSettings>, tab: OmvSettingsTab): void {
  try { window.localStorage.setItem(OMV_LOCAL_TAB_KEY, tab) } catch { /* private browsing can disable storage */ }
  const snapshot = settings.getSnapshot()
  if (snapshot.status !== 'ready' || !snapshot.writable) return
  void settings.set('defaultTab', tab).catch(() => undefined)
}

export function sessionRoot(sessions: ISessions, sessionId: SessionId): string {
  return sessions.list.getSnapshot().byId[sessionId]?.cwd ?? configuredRoot()
}

export async function api<T = unknown>(path: string, init?: RequestInit, projectRoot?: string): Promise<T> {
  const url = new URL(apiUrl(path, projectRoot))
  const response = await fetch(url, {
    ...init,
    cache: 'no-store',
    headers: { ...(init?.body === undefined ? {} : { 'Content-Type': 'application/json' }), ...init?.headers },
  })
  const raw = await response.text()
  let payload: ApiResponse<T> | undefined
  try { payload = JSON.parse(raw) as ApiResponse<T> } catch {
    throw new Error(`工作区服务返回了无效响应（HTTP ${response.status}）`)
  }
  if (!response.ok || !payload.ok) {
    throw new Error(payload.ok ? `HTTP ${response.status}` : payload.error.message)
  }
  return payload.data
}

export function apiUrl(path: string, projectRoot?: string): string {
  const prefix = window.__DSH_OMV__?.apiPrefix ?? '/api/dsh-omv'
  const url = new URL(`${prefix}${path}`, window.location.origin)
  if (projectRoot !== undefined) url.searchParams.set('root', projectRoot)
  return url.toString()
}

export function valueAt(root: Record<string, unknown>, path: string): unknown {
  let current: unknown = root
  for (const part of path.split('.')) {
    if (current === null || typeof current !== 'object' || Array.isArray(current)) return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

export function displayValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return 'unknown'
  if (typeof value === 'string') return value
  try { return JSON.stringify(value) } catch { return String(value) }
}

export function maturityLabel(value: EvidenceAssessment['maturity']): string {
  return ({ unmapped: '尚未映射', developing: '正在成形', supported: '证据支撑', verified: '已经验证', contested: '存在争议' })[value]
}

export function phaseLabel(value: EvidenceAssessment['phase']): string {
  return ({ discovery: '发现阶段', analysis: '分析阶段', verification: '验证阶段', reporting: '报告阶段' })[value]
}

export function confidenceLabel(value: EvidenceAssessment['confidence']): string {
  return ({ unrated: '未评级', low: '较低', medium: '中等', high: '较高' })[value]
}

export function checkStateIcon(value: EvidenceCheckState): IconName {
  return value === 'verified' || value === 'supported' || value === 'not_applicable' ? 'check' : 'alert'
}

export function scoreColor(value: number): string {
  if (value >= 75) return 'var(--dsw-alias-state-success-primary, #329568)'
  if (value >= 50) return 'var(--dsw-static-blue-400, #4d6bfe)'
  if (value >= 25) return 'var(--dsw-alias-state-warn-primary, #b7791f)'
  return 'var(--dsw-alias-state-error-primary, #d44c4c)'
}

export function statusColor(value: string): string {
  if (value === 'confirmed' || value === 'report_ready' || value === 'disclosed' || value === 'active' || value === 'completed' || value === 'passed' || value === 'verified' || value === 'supported' || value === 'clear' || value === 'ready' || value === 'selected') return 'var(--dsw-alias-state-success-primary, #329568)'
  if (value === 'candidate' || value === 'investigating' || value === 'running' || value === 'stopping' || value === 'dispatching' || value === 'reviewing' || value === 'draft' || value === 'proposed') return 'var(--dsw-static-blue-400, #4d6bfe)'
  if (value === 'reproducing' || value === 'queued' || value === 'pending' || value === 'paused' || value === 'awaiting_evidence' || value === 'partial' || value === 'needs_attention' || value === 'possible_duplicate' || value === 'stale' || value === 'warning' || value === 'info') return 'var(--dsw-alias-state-warn-primary, #b7791f)'
  if (value === 'blocked' || value === 'failed' || value === 'cancelled' || value === 'duplicate' || value === 'blocker') return 'var(--dsw-alias-state-error-primary, #d44c4c)'
  return 'var(--dsw-alias-label-tertiary, #8b8f98)'
}

export function qualitySignalLabel(quality: DashboardPayload['quality']): string {
  if (quality.blockers > 0) return '有阻塞'
  if (quality.warnings > 0) return '需关注'
  if (quality.infos > 0) return '可完善'
  return '稳定'
}

export function qualitySignalTone(quality: DashboardPayload['quality']): 'blocker' | 'warning' | 'info' | 'clear' {
  if (quality.blockers > 0) return 'blocker'
  if (quality.warnings > 0) return 'warning'
  if (quality.infos > 0) return 'info'
  return 'clear'
}

const STATUS_LABELS: Record<string, string> = {
  candidate: '候选', investigating: '调查中', reproducing: '复现中',
  confirmed: '已确认', report_ready: '可提交', disclosed: '已披露',
  blocked: '阻塞', archived: '已归档', active: '活跃',
  queued: '排队中', dispatching: '调度中', running: '运行中', stopping: '停止中', pending: '等待中',
  paused: '已暂停', completed: '已完成', cancelled: '已取消',
  needs_attention: '需要处理',
  failed: '失败', awaiting_evidence: '待证据',
  passed: '通过',
  finding: '发现', campaign: '战役', activity: '活动',
  ready: '就绪', missing: '缺失', draft: '草稿', stale: '需刷新', partial: '部分支撑', supported: '已有支撑', verified: '已经验证', not_applicable: '暂不适用',
  unknown: '未知', clear: '已排除', possible_duplicate: '疑似重复', duplicate: '重复',
  blocker: '阻塞', warning: '提醒', info: '建议',
  proposed: '待选用', selected: '已选用', skipped: '已跳过',
}

export function statusLabel(value: string): string {
  return STATUS_LABELS[value] ?? value.replaceAll('_', ' ').replace(/\b\w/gu, char => char.toUpperCase())
}

const CAMPAIGN_LABELS: Record<string, string> = {
  quick: '快速', standard: '标准', deep: '深入',
  whitebox: '白盒', graybox: '灰盒', 'local-lab': '本地实验', passive: '被动', mixed: '混合',
  'course-report': '课程报告', cve: 'CVE', vuldb: 'VulDB', 'internal-report': '内部报告', 'research-notes': '研究笔记',
}

export function campaignLabel(value: string): string {
  return CAMPAIGN_LABELS[value] ?? value
}

export function primaryIntent(stage: AuditStage): WorkflowIntent {
  if (stage === 'candidate' || stage === 'investigating' || stage === 'archived') return 'audit'
  if (stage === 'reproducing') return 'repro'
  if (stage === 'confirmed') return 'dedup'
  if (stage === 'report_ready') return 'report'
  if (stage === 'disclosed') return 'disclose'
  return 'critic'
}

export function workflowLabel(intent: WorkflowIntent): string {
  const labels: Record<WorkflowIntent, string> = {
    audit: '开始深审',
    repro: '启动复现',
    dedup: '去重检查',
    critic: '对抗审阅',
    report: '生成报告',
    disclose: '准备披露',
  }
  return labels[intent]
}

export function activityColor(action: string): string {
  if (action.includes('archive') || action.includes('delete')) return 'var(--dsw-alias-state-error-primary, #d44c4c)'
  if (action.includes('promote') || action.includes('restore')) return 'var(--dsw-alias-state-success-primary, #329568)'
  return 'var(--dsw-static-blue-400, #4d6bfe)'
}

export function activityLabel(action: string): string {
  return action.split('.').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

export function formatTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export function relativeTime(value: string): string {
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return '刚刚'
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000))
  if (seconds < 10) return '刚刚'
  if (seconds < 60) return `${seconds} 秒前`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  return formatTime(value)
}

export function normalizePath(value: string): string {
  return value.replaceAll('\\', '/').replace(/\/+$/u, '') || '/'
}

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function firstLine(value: string): string {
  return value.split(/\r?\n/u, 1)[0] ?? value
}
