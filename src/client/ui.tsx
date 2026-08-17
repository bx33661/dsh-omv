import type { CSSProperties, ReactNode } from 'react'
import type { DashboardPayload, EvidenceAssessment } from '../contracts.js'
import { formatCodeRef, parseCodeRef } from '../code-ref.js'
import type { IconName } from './types.js'
import {
  checkStateIcon,
  confidenceLabel,
  displayValue,
  maturityLabel,
  scoreColor,
  statusColor,
  statusLabel,
} from './runtime.js'

export function Hero({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  return <div className="omv-hero"><div><p className="omv-eyebrow">{eyebrow}</p><h2>{title}</h2><p>{description}</p></div>{actions !== undefined && <div className="omv-hero-actions">{actions}</div>}</div>
}

export function Metric({ label, value, foot, icon, color }: { label: string; value: ReactNode; foot: ReactNode; icon: IconName; color: string }) {
  return <article className="omv-metric" style={{ '--metric-color': color } as CSSProperties}><div className="omv-metric-head"><span>{label}</span><i className="omv-metric-icon"><Icon name={icon} size={13} /></i></div><strong>{value}</strong><div className="omv-metric-foot">{foot}</div></article>
}

export function Posture({ data }: { data: DashboardPayload }) {
  const maturity = data.metrics.evidenceMaturity
  const needsWork = maturity.unmapped + maturity.developing + maturity.contested
  return <section className="omv-panel"><div className="omv-panel-head"><div><h3>证据态势</h3><p>按论证成熟度分布，不再求平均分</p></div></div><div className="omv-posture"><div className="omv-posture-score"><strong>{maturity.verified + maturity.supported}</strong><span>条发现已有支撑性证据</span></div><div className="omv-legend"><Legend color="var(--dsw-alias-state-success-primary, #329568)" label="已经验证" value={maturity.verified} /><Legend color="var(--dsw-alias-state-business-primary, #4d6bfe)" label="证据支撑" value={maturity.supported} /><Legend color="var(--dsw-alias-state-warn-primary, #b7791f)" label="正在成形" value={maturity.developing} /><Legend color="var(--dsw-alias-label-tertiary, #8b8f98)" label="尚未映射" value={maturity.unmapped} /><Legend color="var(--dsw-alias-state-error-primary, #d44c4c)" label="存在争议" value={maturity.contested} /></div><div className="omv-alert">{needsWork > 0 ? `${needsWork} 条发现需要补证或澄清边界；候选状态不会因报告材料未齐被判作低完成度。` : '当前活跃发现均已形成支撑性证据。'}</div></div></section>
}

export function Legend({ color, label, value }: { color: string; label: string; value: number }) {
  return <div className="omv-legend-row"><i style={{ '--legend': color } as CSSProperties} /><span>{label}</span><b>{value}</b></div>
}

export function Score({ value }: { value: number }) {
  const color = scoreColor(value)
  return <div className="omv-score"><span className="omv-score-track"><i style={{ width: `${Math.max(0, Math.min(100, value))}%`, '--score-color': color } as CSSProperties} /></span><b>{value}%</b></div>
}

export function Maturity({ assessment, compact = false }: { assessment: EvidenceAssessment; compact?: boolean }) {
  return <div className="omv-maturity" data-maturity={assessment.maturity} title={assessment.summary}><i /><span>{maturityLabel(assessment.maturity)}</span>{!compact && <b>{confidenceLabel(assessment.confidence)}</b>}</div>
}

export function Status({ value }: { value: string }) {
  const color = statusColor(value)
  return <span className="omv-status" style={{ '--status': color } as CSSProperties} aria-label={`状态：${statusLabel(value)}`}>{statusLabel(value)}</span>
}

export function EcosystemAvatar({ ecosystem, size = 'md' }: { ecosystem: string; size?: 'md' | 'lg' }) {
  return <span className="omv-eco-avatar" data-size={size} aria-hidden="true">{ecosystem.charAt(0).toUpperCase()}</span>
}

export function EcoChip({ ecosystem }: { ecosystem: string }) {
  return <span className="omv-eco-chip">{ecosystem}</span>
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
  const titleId = `omv-modal-${title.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}`
  return <div className="omv-modal-backdrop" role="presentation" onMouseDown={onClose}><div className="omv-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} onMouseDown={event => event.stopPropagation()}><div className="omv-modal-head"><h2 id={titleId}>{title}</h2><button type="button" className="omv-icon-button" aria-label="关闭" onClick={onClose}><Icon name="close" size={15} /></button></div>{children}</div></div>
}

export function Field({ label, full = false, children }: { label: string; full?: boolean; children: ReactNode }) {
  return <div className={`omv-field${full ? ' omv-field-full' : ''}`}><label>{label}</label>{children}</div>
}

export function Empty({ label, description, action, compact = false }: { label: string; description?: string; action?: ReactNode; compact?: boolean }) {
  return <div className="omv-empty" style={compact ? { minHeight: 90 } : undefined}><div><Icon name="inbox" size={24} /><strong>{label}</strong>{description !== undefined && <span>{description}</span>}{action !== undefined && <div className="omv-empty-action">{action}</div>}</div></div>
}

export function Loading({ label = '同步 OMV 工作区…' }: { label?: string }) {
  return <div className="omv-loading" role="status" aria-live="polite"><div><div className="omv-spinner" />{label}</div></div>
}


export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
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
    gauge: <><path d="M4 15a8 8 0 1 1 16 0"/><path d="m12 15 4-6"/><path d="M6 19h12"/></>,
    alert: <><path d="M12 4 3 20h18L12 4Z"/><path d="M12 9v5M12 17h.01"/></>,
    chevron: <path d="m9 6 6 6-6 6"/>,
    search: <><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></>,
    terminal: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3M13 15h4"/></>,
    arrowUp: <><path d="m12 19V5M6 11l6-6 6 6"/></>,
    inbox: <><path d="M4 5h16v14H4z"/><path d="M4 14h5l2 2h2l2-2h5"/></>,
    folder: <><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z"/><path d="M3 9h18"/></>,
    file: <><path d="M7 3.5h7l5 5V20a1.5 1.5 0 0 1-1.5 1.5h-10.5A1.5 1.5 0 0 1 5.5 20V5A1.5 1.5 0 0 1 7 3.5Z"/><path d="M14 3.5V9h5"/></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{paths[name]}</svg>
}
