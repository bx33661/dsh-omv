import type { ComponentType, CSSProperties, ReactNode } from 'react'
import {
  Modal as NativeModal,
  StateDot,
  type IconProps,
  type StateDotState,
} from '@deepseek-ai/dsh-client-ui-primitives'
import {
  IconArchiveOutline20,
  IconBrowseOutline16,
  IconCheckOutline16,
  IconChevronRightOutline14,
  IconCloseOutline16,
  IconCodeOutline16,
  IconFolderOpen16,
  IconFullscreenOutline16,
  IconGoalOutline16,
  IconLoadingOutline16,
  IconPlusOutline16,
  IconRefreshOutline16,
  IconSearchOutline16,
  IconWarningOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import {
  siDart,
  siDotnet,
  siElixir,
  siGo,
  siGithub,
  siLua,
  siNpm,
  siOpenjdk,
  siPerl,
  siPhp,
  siPython,
  siR,
  siRuby,
  siRust,
  siSwift,
} from 'simple-icons'
import type { SimpleIcon } from 'simple-icons'
import type { EvidenceAssessment } from '../contracts.js'
import { formatCodeRef, parseCodeRef } from '../code-ref.js'
import type { IconName } from './types.js'
import {
  confidenceLabel,
  displayValue,
  maturityLabel,
  statusColor,
  statusLabel,
} from './runtime.js'

export function Hero({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  return <div className="omv-hero"><div><p className="omv-eyebrow">{eyebrow}</p><h2>{title}</h2><p>{description}</p></div>{actions !== undefined && <div className="omv-hero-actions">{actions}</div>}</div>
}

export function Metric({ label, value, foot, icon, color }: { label: string; value: ReactNode; foot: ReactNode; icon: IconName; color: string }) {
  return <article className="omv-metric" style={{ '--metric-color': color } as CSSProperties}><div className="omv-metric-head"><span>{label}</span><i className="omv-metric-icon"><Icon name={icon} size={13} /></i></div><strong>{value}</strong><div className="omv-metric-foot">{foot}</div></article>
}

export function Maturity({ assessment, compact = false }: { assessment: EvidenceAssessment; compact?: boolean }) {
  const icon: IconName = assessment.maturity === 'verified' ? 'check' : assessment.maturity === 'supported' ? 'shield' : assessment.maturity === 'contested' ? 'alert' : 'pulse'
  return <div className="omv-maturity" data-maturity={assessment.maturity} title={assessment.summary}><i><Icon name={icon} size={compact ? 10 : 11} /></i><span>{maturityLabel(assessment.maturity)}</span>{!compact && <b>{confidenceLabel(assessment.confidence)}</b>}</div>
}

export function Status({ value }: { value: string }) {
  const color = statusColor(value)
  return <span className="omv-status" style={{ '--status': color } as CSSProperties} aria-label={`状态：${statusLabel(value)}`}><StateDot state={statusDotState(value)} />{statusLabel(value)}</span>
}

export function EvidenceStatusLogo({ maturity }: { maturity: EvidenceAssessment['maturity'] }) {
  const label = maturity === 'verified' ? '已验证' : maturityLabel(maturity)
  return <span className="omv-evidence-status-logo" data-maturity={maturity} role="img" aria-label={`证据状态：${label}`} title={`证据状态：${label}`}><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="28" className="omv-evidence-logo-ring" /><circle cx="32" cy="32" r="22" className="omv-evidence-logo-disc" /><path d="M32 17.5 45 23v9.1c0 8.4-5.1 14.5-13 17.2-7.9-2.7-13-8.8-13-17.2V23l13-5.5Z" className="omv-evidence-logo-shield" /><path d="m25.5 32.5 4.2 4.2 8.8-9.1" className="omv-evidence-logo-check" /><path d="m48.5 12.5.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6Z" className="omv-evidence-logo-spark" /></svg></span>
}

export function DedupSourceLogo({ source, searched }: { source: string; searched: boolean }) {
  const labels: Record<string, string> = {
    nvd_searched: 'NVD',
    ghsa_searched: 'GitHub Advisory Database',
    ecosystem_db_searched: '生态数据库',
    issues_searched: 'Issues 与 Pull Requests',
    commits_searched: '代码提交记录',
    blogs_searched: 'Web 与博客',
  }
  const label = labels[source] ?? '外部来源'
  const common = { className: 'omv-dedup-source-mark', viewBox: '0 0 24 24', 'aria-hidden': true }
  let mark: ReactNode
  switch (source) {
    case 'nvd_searched':
      mark = <svg {...common}><path d="M12 3.2 19 6v5.2c0 4.1-2.6 7.4-7 9.6-4.4-2.2-7-5.5-7-9.6V6l7-2.8Z" /><path d="M9.2 10h5.6M9.2 13.2h5.6" /><path d="M8.8 16.2h6.4" /></svg>
      break
    case 'ghsa_searched':
      mark = <svg {...common} viewBox="0 0 24 24"><path fill="currentColor" stroke="none" d={siGithub.path} /></svg>
      break
    case 'ecosystem_db_searched':
      mark = <svg {...common}><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" /><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></svg>
      break
    case 'issues_searched':
      mark = <svg {...common}><path d="M7 6h10a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H9l-4 3v-11a3 3 0 0 1 2-2.8" /><path d="M8 11h8M8 14h5" /></svg>
      break
    case 'commits_searched':
      mark = <svg {...common}><circle cx="6" cy="6" r="2.2" /><circle cx="18" cy="12" r="2.2" /><circle cx="6" cy="18" r="2.2" /><path d="M8.2 6h3.2c2.2 0 2.2 6 4.4 6M8.2 18h3.2c2.2 0 2.2-6 4.4-6" /></svg>
      break
    case 'blogs_searched':
      mark = <svg {...common}><circle cx="12" cy="12" r="8.5" /><path d="M3.8 12h16.4M12 3.5c2.2 2.4 3.4 5.2 3.4 8.5s-1.2 6.1-3.4 8.5c-2.2-2.4-3.4-5.2-3.4-8.5S9.8 5.9 12 3.5Z" /></svg>
      break
    default:
      mark = <svg {...common}><circle cx="12" cy="12" r="8.5" /><path d="M8 12h8" /></svg>
  }
  return <span className="omv-dedup-source-logo" data-source={source} data-searched={searched || undefined} role="img" aria-label={`${label}：${searched ? '已检索' : '未检索'}`} title={`${label} · ${searched ? '已检索' : '未检索'}`}>{mark}</span>
}

export function PriorityIssueLogo({ severity }: { severity: string }) {
  const kind = severity === 'blocker' || severity === 'error' ? 'blocker' : severity === 'warning' ? 'warning' : 'info'
  const label = kind === 'blocker' ? '阻塞事项' : kind === 'warning' ? '提醒事项' : '建议事项'
  const common = { className: 'omv-priority-issue-mark', viewBox: '0 0 24 24', 'aria-hidden': true }
  const mark = kind === 'blocker'
    ? <svg {...common}><path d="m12 3.4 7.2 4.2v8.8L12 20.6l-7.2-4.2V7.6L12 3.4Z" /><path d="M12 7.7v5.5M12 16.7h.01" /></svg>
    : kind === 'warning'
      ? <svg {...common}><circle cx="12" cy="12" r="8.4" /><path d="M12 7.5v5l3.2 2" /></svg>
      : <svg {...common}><circle cx="12" cy="12" r="8.4" /><path d="M12 10.8v5M12 7.5h.01" /></svg>
  return <span className="omv-priority-issue-logo" data-severity={kind} role="img" aria-label={label} title={label}>{mark}</span>
}

function statusDotState(value: string): StateDotState {
  if (['confirmed', 'report_ready', 'passed', 'completed', 'verified', 'supported', 'selected', 'clear', 'approved'].includes(value)) return 'done'
  if (['blocked', 'failed', 'error', 'missing', 'contested', 'rejected'].includes(value)) return 'error'
  if (['candidate', 'investigating', 'reproducing', 'running', 'queued', 'pending', 'awaiting_evidence', 'partial', 'open', 'needs_review'].includes(value)) return 'ongoing'
  return 'warning'
}

export function EcosystemAvatar({ ecosystem, size = 'md' }: { ecosystem: string; size?: 'md' | 'lg' }) {
  const normalized = ecosystem.trim().toLowerCase()
  const label = normalized === '' ? '未知生态' : `${normalized} 生态`
  return <span className="omv-eco-avatar" data-size={size} data-ecosystem={normalized || 'unknown'} role="img" aria-label={label} title={label}><EcosystemLogo ecosystem={normalized} fallback={ecosystem.charAt(0).toUpperCase()} /></span>
}

const ECOSYSTEM_ICONS: Readonly<Record<string, SimpleIcon>> = {
  npm: siNpm,
  python: siPython,
  pypi: siPython,
  pip: siPython,
  go: siGo,
  rust: siRust,
  cargo: siRust,
  java: siOpenjdk,
  ruby: siRuby,
  php: siPhp,
  csharp: siDotnet,
  'c#': siDotnet,
  swift: siSwift,
  dart: siDart,
  elixir: siElixir,
  perl: siPerl,
  r: siR,
  lua: siLua,
}

function EcosystemLogo({ ecosystem, fallback }: { ecosystem: string; fallback: string }) {
  const icon = ECOSYSTEM_ICONS[ecosystem]
  if (icon !== undefined) {
    return <svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><path d={icon.path} fill={`#${icon.hex}`} /></svg>
  }
  return <LegacyEcosystemLogo ecosystem={ecosystem} fallback={fallback} />
}

function LegacyEcosystemLogo({ ecosystem, fallback }: { ecosystem: string; fallback: string }) {
  switch (ecosystem) {
    case 'npm': return <svg viewBox="0 0 44 20" aria-hidden="true"><path fill="currentColor" d="M1 1h42v18H22v-3h-7v3H1z" /><path fill="var(--eco-cutout, #fff)" d="M7 5v10h4V8h3v7h4V5zm16 0v10h4V8h3v7h4V5z" /></svg>
    case 'python': case 'pypi': case 'pip': return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#3776ab" d="M12 2c-4.4 0-4.8 2-4.8 4.5V9h5v1H5.5C2.8 10 2 11.9 2 14s.8 4 3.5 4h2.1v-3c0-2.5 1.5-4 4-4h4.9V6.5C16.5 3.8 15.1 2 12 2m-2.7 2.2h2.3v1.4H9.3z"/><path fill="#ffd343" d="M12 22c4.4 0 4.8-2 4.8-4.5V15h-5v-1h6.7c2.7 0 3.5-1.9 3.5-4s-.8-4-3.5-4h-2.1v3c0 2.5-1.5 4-4 4H7.5v4.5c0 2.7 1.4 4.5 4.5 4.5m2.7-2.2h-2.3v-1.4h2.3z"/></svg>
    case 'go': return <svg viewBox="0 0 40 24" aria-hidden="true"><path fill="#00add8" d="M2 13.5c4.2-7.2 10.5-10.8 18.7-10.8 5.8 0 10.3 1.7 13.6 5.1l-2.1 2.2c-2.8-2.5-6.3-3.8-10.5-3.8-6.1 0-11 2.5-14.8 7.4z"/><text x="11" y="20" fill="#00add8" fontSize="13" fontWeight="800" fontFamily="Arial, sans-serif">go</text></svg>
    case 'rust': case 'cargo': return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#dea584" d="m12 2 2 1.1 2.3-.2 1.1 2 2 1.1-.2 2.3 1.1 2-1.1 2 .2 2.3-2 1.1-1.1 2-2.3-.2-2 1.1-2-1.1-2.3.2-1.1-2-2-1.1.2-2.3-1.1-2 1.1-2-.2-2.3 2-1.1 1.1-2 2.3.2z"/><path fill="#fff" d="M8 8.2h8v1.7h-2.8v5.8h-2.4V9.9H8z"/></svg>
    case 'java': return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#e76f00" d="M8 16.3c-1.6.6-2.4 1.3-2.4 2 0 1.4 3 2.5 6.7 2.5s6.7-1.1 6.7-2.5c0-.7-.8-1.4-2.4-2 .5.5.8 1 .8 1.5 0 1.2-2.3 2.1-5.1 2.1s-5.1-.9-5.1-2.1c0-.5.3-1 .8-1.5"/><path fill="#5382a1" d="M8.7 12.6c-1.2.4-1.8 1-1.8 1.6 0 1 2.3 1.8 5.1 1.8s5.1-.8 5.1-1.8c0-.6-.6-1.2-1.8-1.6.3.3.5.6.5.9 0 .8-1.7 1.4-3.8 1.4s-3.8-.6-3.8-1.4c0-.3.2-.6.5-.9"/><path fill="#e76f00" d="M12 3c1.8 1.3-1.2 2.1.5 3.4 1.3 1-1.1 1.9-.2 3.2 1.1-1.9 3.1-2.8 1.2-4.2C12.2 4.5 13.4 3.8 12 3"/><path fill="#5382a1" d="M15.3 2.2c2.3 2-.5 3.2.2 4.4.6 1.1 2.1 1.5 1.4 3.4 2.1-2.2-.3-3.8.5-5.1.7-1.2-.3-2.1-2.1-2.7"/></svg>
    case 'ruby': return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#cc342d" d="M4 3.5h9.8L21 9.9 12.6 21 3 15.5z"/><path fill="#fff" opacity=".86" d="m6.1 5.4 5.8.1-1.5 5.4zm7.8.2 3.8 4.2-5.3 1.1zm-3 6.4 5.2-1.1-3.8 5z"/></svg>
    case 'php': return <svg viewBox="0 0 42 24" aria-hidden="true"><ellipse cx="21" cy="12" rx="19" ry="9" fill="#777bb3"/><text x="7" y="16" fill="#fff" fontSize="10" fontWeight="700" fontFamily="Arial, sans-serif">php</text></svg>
    case 'csharp': case 'c#': return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#68217a" d="M12 2.3 21 7v10l-9 4.7L3 17V7z"/><text x="6.2" y="15.7" fill="#fff" fontSize="10" fontWeight="800" fontFamily="Arial, sans-serif">C#</text></svg>
    case 'swift': return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#f05138" d="M20.8 15.4c.7-3.4-.8-7.2-4.2-10.4 1.1 2.1 1.5 4 1.2 5.7C15.1 8.7 11.2 6.1 6.6 4.4c3.2 2.6 5.5 5 6.7 7.1-2.8-.8-5.6-2.4-8.4-4.8 2.1 3.3 4.6 5.8 7.6 7.5-2.3.8-5 .5-8-.9 3.5 3.7 7.3 5.1 11.4 4.1 1.4 1 2.2 1.7 2.4 2.1 1.1-.9 2-2.3 2.5-4.1"/></svg>
    case 'dart': return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#0175c2" d="M4 4h10.4L21 10.6V21H10.4L4 14.6z"/><path fill="#29b6f6" d="M4 4h6.4L21 14.6V21h-6.4L4 14.6z"/><path fill="#fff" d="m12.3 7.1 4.2 4.2-3.1.2 1.3 3-5-4.6 3-.2z"/></svg>
    case 'elixir': return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#6e4a7e" d="M12 2c1.9 3.3 6.4 7.1 6.4 12.2A6.4 6.4 0 1 1 5.6 14.2C5.6 9.1 10.1 5.3 12 2"/><circle cx="9.5" cy="14" r="1" fill="#f4b942"/><circle cx="12" cy="16" r="1" fill="#f4b942"/><circle cx="14.5" cy="13.5" r="1" fill="#f4b942"/></svg>
    case 'perl': return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="#39457f"/><text x="7.2" y="16" fill="#fff" fontSize="11" fontWeight="800" fontFamily="Georgia, serif">P</text></svg>
    case 'r': return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="#276dc3"/><text x="6.8" y="16" fill="#fff" fontSize="12" fontWeight="800" fontFamily="Arial, sans-serif">R</text></svg>
    case 'lua': return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="#000080"/><circle cx="15.5" cy="8.5" r="5" fill="var(--eco-bg, #fff)"/><path fill="#fff" d="M6 15.7h2.1l1.1-2.3 1.1 2.3h2.1l-2.1-3.6 2-3.3h-2l-1.1 2-1-2H6l2 3.3z"/></svg>
    default: return <span aria-hidden="true">{fallback || '?'}</span>
  }
}

export function Section({ title, meta, children }: { title: string; meta: string; children: ReactNode }) {
  return <section className="omv-section"><div className="omv-section-title"><h3>{title}</h3><span>{meta}</span></div>{children}</section>
}

export function ChainCard({ label, value, onOpen }: { label: string; value: unknown; onOpen?: (path: string) => void }) {
  const ref = parseCodeRef(value)
  const openable = ref !== undefined && onOpen !== undefined
  const body = ref === undefined
    ? <code>{displayValue(value)}</code>
    : <><code>{formatCodeRef(ref)}</code>{ref.note !== '' && <small>{ref.note}</small>}</>
  if (!openable) return <div className="omv-chain-card"><span>{label}</span>{body}</div>
  return (
    <button type="button" className="omv-chain-card" data-openable="true" onClick={() => onOpen(ref.path)} title={`打开 ${formatCodeRef(ref)}`}>
      <span>{label}</span>
      {body}
      <em><Icon name="file" size={11} />打开源码</em>
    </button>
  )
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <NativeModal open onClose={onClose} title={title} closeLabel="关闭">{children}</NativeModal>
}

export function Field({ label, full = false, children }: { label: string; full?: boolean; children: ReactNode }) {
  return <div className={`omv-field${full ? ' omv-field-full' : ''}`}><label>{label}</label>{children}</div>
}

export function Empty({ label, description, action, compact = false }: { label: string; description?: string; action?: ReactNode; compact?: boolean }) {
  return <div className="omv-empty" style={compact ? { minHeight: 90 } : undefined}><div><Icon name="inbox" size={24} /><strong>{label}</strong>{description !== undefined && <span>{description}</span>}{action !== undefined && <div className="omv-empty-action">{action}</div>}</div></div>
}

export function Loading({ label = '同步 OMV 工作区…' }: { label?: string }) {
  return <div className="omv-loading" role="status" aria-live="polite"><div><IconLoadingOutline16 size={20} />{label}</div></div>
}


const NATIVE_ICONS: Partial<Record<IconName, ComponentType<IconProps>>> = {
  refresh: IconRefreshOutline16,
  close: IconCloseOutline16,
  plus: IconPlusOutline16,
  check: IconCheckOutline16,
  alert: IconWarningOutline16,
  chevron: IconChevronRightOutline14,
  search: IconSearchOutline16,
  terminal: IconCodeOutline16,
  campaign: IconGoalOutline16,
  folder: IconFolderOpen16,
  maximize: IconFullscreenOutline16,
  archive: IconArchiveOutline20,
  eye: IconBrowseOutline16,
}

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  const NativeIcon = NATIVE_ICONS[name]
  if (NativeIcon !== undefined) return <NativeIcon size={size} />
  const paths: Record<IconName, ReactNode> = {
    shield: <><path d="M12 3 5 6v5c0 4.5 2.7 7.7 7 9 4.3-1.3 7-4.5 7-9V6l-7-3Z" /><path d="m9.4 11.7 1.7 1.7 3.8-4" /></>,
    grid: <><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></>,
    finding: <><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4M11 8v3M11 14h.01"/></>,
    campaign: <><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 4v2M12 18v2M4 12h2M18 12h2"/></>,
    pulse: <path d="M3 12h4l2-6 4 12 2-6h6"/>,
    refresh: <><path d="M20 7v5h-5"/><path d="M19 12a7 7 0 1 0-2 5"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    plus: <path d="M12 5v14M5 12h14"/>,
    check: <path d="m5 12 4 4L19 6"/>,
    alert: <><path d="M12 4 3 20h18L12 4Z"/><path d="M12 9v5M12 17h.01"/></>,
    chevron: <path d="m9 6 6 6-6 6"/>,
    search: <><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></>,
    terminal: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3M13 15h4"/></>,
    arrowUp: <><path d="m12 19V5M6 11l6-6 6 6"/></>,
    inbox: <><path d="M4 5h16v14H4z"/><path d="M4 14h5l2 2h2l2-2h5"/></>,
    folder: <><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z"/><path d="M3 9h18"/></>,
    file: <><path d="M7 3.5h7l5 5V20a1.5 1.5 0 0 1-1.5 1.5h-10.5A1.5 1.5 0 0 1 5.5 20V5A1.5 1.5 0 0 1 7 3.5Z"/><path d="M14 3.5V9h5"/></>,
    copy: <><rect x="8" y="8" width="11" height="11" rx="1.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-10A1.5 1.5 0 0 0 3 5.5v10A1.5 1.5 0 0 0 4.5 17H8"/></>,
    maximize: <><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M21 16v5h-5"/><path d="m3 3 5 5M21 3l-5 5M3 21l5-5M21 21l-5-5"/></>,
    minimize: <><path d="M8 3v5H3M16 3v5h5M8 21v-5H3M21 16h-5v5"/></>,
    archive: <><path d="M4 7.5h16v12H4z"/><path d="M3 4.5h18v3H3zM9 12h6"/></>,
    activity: <><path d="M3 12h4l2-6 4 12 2-6h6"/><circle cx="3" cy="12" r="1" fill="currentColor" stroke="none"/></>,
    clock: <><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/></>,
    eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.6"/></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{paths[name]}</svg>
}
