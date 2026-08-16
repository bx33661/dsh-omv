import type { FindingDetail } from 'oh-my-vul'
import type {
  EvidenceAssessment,
  EvidenceCheckState,
  EvidenceDimension,
  EvidenceMaturity,
  ReproductionRun,
} from './contracts.js'

/**
 * Evidence maturity is deliberately separate from the legacy Evidence.v1 score.
 * It describes how a claim is supported and verified instead of treating every
 * populated field as interchangeable percentage points.
 */
export function assessEvidence(
  detail: FindingDetail,
  evidence: Record<string, unknown>,
  reproductionRuns: readonly ReproductionRun[] = [],
): EvidenceAssessment {
  const passedReproduction = reproductionRuns.some(run => run.status === 'passed')
  const activeReproduction = reproductionRuns.some(run => run.status === 'running')
  const failedReproduction = reproductionRuns.some(run => run.status === 'failed' || run.status === 'blocked')
  const source = knownAt(evidence, 'evidence.source')
  const sink = knownAt(evidence, 'evidence.sink')
  const guard = knownAt(evidence, 'evidence.guard')
  const reproducer = knownAt(evidence, 'evidence.reproducer') && valueAt(evidence, 'evidence.reproducer') !== 'none'
  const observation = knownAt(evidence, 'evidence.observed_result')
  const reproductionArtifacts = stringListAt(evidence, 'evidence.repro_artifacts').length > 0
  const tested = knownAt(evidence, 'versions.tested')
  const affected = knownAt(evidence, 'versions.affected_range')
  const exploitability = stringAt(evidence, 'verdict.exploitability')
  const declaredConfidence = stringAt(evidence, 'verdict.confidence')
  const verdictReason = knownAt(evidence, 'verdict.reason')
  const reportGoal = ['CVE', 'VulDB', 'advisory'].includes(stringAt(evidence, 'researcher_goal'))

  const chainKnown = [source, sink, guard].filter(Boolean).length
  const chainState = chainKnown === 3
    ? passedReproduction || (exploitability === 'proven' && declaredConfidence === 'high') ? 'verified' : 'supported'
    : chainKnown > 0 ? 'partial' : 'missing'
  const runtimeState = passedReproduction
    ? 'verified'
    : failedReproduction ? 'partial'
      : reproducer && observation && reproductionArtifacts && exploitability === 'proven' && declaredConfidence === 'high' ? 'verified'
        : reproducer && observation ? 'supported'
      : reproducer || observation || activeReproduction || failedReproduction ? 'partial' : 'missing'
  const scopeState = tested && affected ? 'supported' : tested || affected ? 'partial' : 'missing'
  const impactKnown = [knownValue(exploitability), knownValue(declaredConfidence), verdictReason].filter(Boolean).length
  const impactState = exploitability === 'proven' && declaredConfidence === 'high' && verdictReason
    ? 'verified'
    : impactKnown === 3 ? 'supported' : impactKnown > 0 ? 'partial' : 'missing'
  const dedupCount = ['dedup.nvd_searched', 'dedup.ghsa_searched', 'dedup.ecosystem_db_searched']
    .filter(path => valueAt(evidence, path) === true).length
  const cvss = knownAt(evidence, 'cvss.vector')
  const reportParts = [detail.validation.ok, dedupCount === 3, cvss].filter(Boolean).length
  const reportState: EvidenceCheckState = !reportGoal
    ? 'not_applicable'
    : reportParts === 3 ? 'supported' : reportParts > 0 ? 'partial' : 'missing'

  const dimensions: EvidenceDimension[] = [
    dimension(
      'claim_chain',
      '数据流证据',
      chainState,
      chainKnown === 3 ? 'source → sink → guard 已形成连续论证' : `已定位 ${chainKnown}/3 个关键环节`,
      chainKnown === 3 ? undefined : '继续追踪调用链并补齐缺失环节',
    ),
    dimension(
      'runtime_verification',
      '运行时验证',
      runtimeState,
      passedReproduction ? '结构化复现已通过' : runtimeState === 'verified' ? '复现步骤、观察结果和产物相互印证' : reproducer && observation ? '已有复现步骤和观察结果，可追加结构化校验' : activeReproduction ? '复现正在进行' : failedReproduction ? '已有复现未通过，需要解释差异' : reproducer || observation ? '复现步骤或观察结果尚未闭环' : '尚未记录复现证据',
      runtimeState === 'verified' ? undefined : '/omv-repro',
    ),
    dimension(
      'affected_scope',
      '影响范围',
      scopeState,
      tested && affected ? '测试版本和受影响范围均有依据' : tested || affected ? '测试版本与影响范围仅完成一侧' : '测试版本和影响范围均待确认',
      scopeState === 'supported' ? undefined : '验证边界版本并记录 affected_range',
    ),
    dimension(
      'impact_confidence',
      '结论可信度',
      impactState,
      impactKnown === 0 ? '尚未形成可审阅结论' : `${exploitability || 'unknown'} · ${declaredConfidence || 'unknown'}${verdictReason ? ' · 已记录理由' : ''}`,
      impactState === 'verified' || impactState === 'supported' ? undefined : '/omv-critic',
    ),
    dimension(
      'report_preparation',
      '提交材料',
      reportState,
      !reportGoal ? '当前研究目标不要求提前完成 CVE/VulDB 材料' : `Schema ${detail.validation.ok ? '通过' : '有误'} · 去重 ${dedupCount}/3 · CVSS ${cvss ? '已记录' : '待补'}`,
      reportState === 'supported' || reportState === 'not_applicable' ? undefined : '完成去重、CVSS 与 Schema 校验',
    ),
  ]

  const contested = detail.status === 'blocked' || exploitability === 'blocked' || exploitability === 'disproven'
  const maturity = deriveMaturity(dimensions, contested)
  const phase = derivePhase(detail, dimensions, activeReproduction)
  const confidence = deriveConfidence(maturity, declaredConfidence)
  const openQuestions = stringListAt(evidence, 'blockers')
  const suggestedActions = [...new Set(dimensions.flatMap(item => {
    if (item.nextAction === undefined) return []
    if (item.id === 'report_preparation' && detail.status !== 'confirmed' && maturity !== 'supported' && maturity !== 'verified') return []
    return [item.nextAction]
  }))]
  if (openQuestions.length > 0 && !suggestedActions.includes('/omv-critic')) suggestedActions.unshift('/omv-critic')
  const signal = maturitySignal(dimensions)

  return {
    findingId: detail.id,
    maturity,
    phase,
    confidence,
    signal,
    summary: assessmentSummary(maturity, dimensions, openQuestions),
    dimensions,
    openQuestions,
    suggestedActions,
  }
}

function dimension(
  id: EvidenceDimension['id'],
  label: string,
  state: EvidenceCheckState,
  detail: string,
  nextAction?: string,
): EvidenceDimension {
  return { id, label, state, detail, ...(nextAction === undefined ? {} : { nextAction }) }
}

function deriveMaturity(dimensions: readonly EvidenceDimension[], contested: boolean): EvidenceMaturity {
  if (contested) return 'contested'
  const byId = new Map(dimensions.map(item => [item.id, item.state]))
  const chain = byId.get('claim_chain')
  const runtime = byId.get('runtime_verification')
  const impact = byId.get('impact_confidence')
  if ((chain === 'verified' || chain === 'supported') && runtime === 'verified' && (impact === 'verified' || impact === 'supported')) return 'verified'
  if ((chain === 'verified' || chain === 'supported') && (runtime === 'verified' || runtime === 'supported' || impact === 'verified' || impact === 'supported')) return 'supported'
  if (dimensions.some(item => item.id !== 'report_preparation' && item.state !== 'missing' && item.state !== 'not_applicable')) return 'developing'
  return 'unmapped'
}

function derivePhase(detail: FindingDetail, dimensions: readonly EvidenceDimension[], activeReproduction: boolean): EvidenceAssessment['phase'] {
  const byId = new Map(dimensions.map(item => [item.id, item.state]))
  if (detail.status === 'confirmed' && (byId.get('report_preparation') === 'supported' || byId.get('report_preparation') === 'not_applicable')) return 'reporting'
  if (activeReproduction || byId.get('runtime_verification') === 'partial' || byId.get('runtime_verification') === 'supported' || byId.get('runtime_verification') === 'verified') return 'verification'
  if (byId.get('claim_chain') !== 'missing') return 'analysis'
  return 'discovery'
}

function deriveConfidence(maturity: EvidenceMaturity, declared: string): EvidenceAssessment['confidence'] {
  if (maturity === 'unmapped') return 'unrated'
  if (maturity === 'contested' || maturity === 'developing') return 'low'
  if (maturity === 'verified' && declared === 'high') return 'high'
  return declared === 'low' ? 'low' : 'medium'
}

function maturitySignal(dimensions: readonly EvidenceDimension[]): number {
  const weights: Record<EvidenceDimension['id'], number> = {
    claim_chain: 30,
    runtime_verification: 26,
    affected_scope: 16,
    impact_confidence: 18,
    report_preparation: 10,
  }
  const values: Record<EvidenceCheckState, number> = { missing: 0, partial: 0.45, supported: 0.8, verified: 1, not_applicable: 0 }
  let earned = 0
  let possible = 0
  for (const item of dimensions) {
    if (item.state === 'not_applicable') continue
    const weight = weights[item.id]
    earned += weight * values[item.state]
    possible += weight
  }
  return possible === 0 ? 0 : Math.round(earned / possible * 100)
}

function assessmentSummary(maturity: EvidenceMaturity, dimensions: readonly EvidenceDimension[], openQuestions: readonly string[]): string {
  if (maturity === 'contested') return '现有证据指向受阻或证伪；保留研究记录，但不把它表现成低完成度。'
  const partial = dimensions.filter(item => item.state === 'partial' || item.state === 'missing').map(item => item.label)
  if (maturity === 'verified') return openQuestions.length === 0 ? '核心证据已经过运行时验证，可转入报告准备。' : `核心证据已经过验证，仍有 ${openQuestions.length} 个边界问题需要审阅。`
  if (maturity === 'supported') return openQuestions.length > 0 ? `主要论证已有支撑，仍有 ${openQuestions.length} 个边界问题需要判断。` : partial.length === 0 ? '证据已形成相互支撑的闭环。' : `主要论证已经成立，下一步聚焦${partial.slice(0, 2).join('、')}。`
  if (maturity === 'developing') return `证据正在成形，优先补齐${partial.slice(0, 2).join('、') || '关键论证'}。`
  return '尚未建立核心证据链，先从 source、sink 与 guard 开始定位。'
}

function valueAt(root: Record<string, unknown>, path: string): unknown {
  let value: unknown = root
  for (const key of path.split('.')) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined
    value = (value as Record<string, unknown>)[key]
  }
  return value
}

function knownAt(root: Record<string, unknown>, path: string): boolean { return known(valueAt(root, path)) }
function knownValue(value: unknown): boolean { return known(value) }

function known(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '' && value !== 'unknown' && (!Array.isArray(value) || value.length > 0)
}

function stringAt(root: Record<string, unknown>, path: string): string {
  const value = valueAt(root, path)
  return typeof value === 'string' && value !== 'unknown' ? value : ''
}

function stringListAt(root: Record<string, unknown>, path: string): string[] {
  const value = valueAt(root, path)
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim() !== '') : []
}
