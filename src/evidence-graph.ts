import type { FindingDetail } from 'oh-my-vul'
import type {
  EvidenceCheckState,
  EvidenceGraph,
  EvidenceGraphAnalysis,
  EvidenceGraphEdge,
  EvidenceGraphNode,
  QualityGateCheck,
  QualityGateResult,
  ReproductionRun,
  WorkflowEvent,
} from './contracts.js'
import { assessEvidence } from './assessment.js'
import { parseCodeRef } from './code-ref.js'

const EVIDENCE_PATHS = [
  ['source', 'evidence.source'],
  ['sink', 'evidence.sink'],
  ['guard', 'evidence.guard'],
  ['reproducer', 'evidence.reproducer'],
  ['observation', 'evidence.observed_result'],
] as const

export function buildEvidenceGraph(input: {
  detail: FindingDetail
  evidence: Record<string, unknown>
  rawEvidence: string
  history: WorkflowEvent[]
  reproductionRuns: ReproductionRun[]
}): EvidenceGraph {
  const rootId = `finding:${input.detail.id}`
  const nodes: EvidenceGraphNode[] = [{
    id: rootId,
    kind: 'finding',
    label: input.detail.id,
    value: `${input.detail.package} · ${input.detail.vulnerability}`,
    state: input.detail.status === 'confirmed' ? 'verified' : 'known',
    path: input.detail.path,
  }]
  const edges: EvidenceGraphEdge[] = []
  const claimId = `${rootId}:claim`
  const claimLine = lineOf(input.rawEvidence, 'vulnerability.class')
  nodes.push({ id: claimId, kind: 'claim', label: 'Vulnerability claim', value: input.detail.vulnerability, state: input.detail.status === 'confirmed' ? 'verified' : 'known', path: 'vulnerability.class', ...(claimLine === undefined ? {} : { line: claimLine }) })
  edges.push({ from: rootId, to: claimId, relation: 'describes' })

  for (const [kind, path] of EVIDENCE_PATHS) {
    const raw = valueAt(input.evidence, path)
    const value = display(raw)
    const nodeId = `${rootId}:${kind}`
    const line = lineOf(input.rawEvidence, path)
    const codeRef = parseCodeRef(raw)
    nodes.push({
      id: nodeId,
      kind,
      label: labelFor(kind),
      value,
      state: known(raw) ? kind === 'observation' && input.detail.status === 'confirmed' ? 'verified' : 'known' : 'unknown',
      path,
      ...(line === undefined ? {} : { line }),
      ...(codeRef === undefined ? {} : { codeRef }),
    })
  }
  edges.push(
    { from: `${rootId}:source`, to: `${rootId}:sink`, relation: 'flows_to' },
    { from: `${rootId}:sink`, to: `${rootId}:guard`, relation: 'guarded_by' },
    { from: claimId, to: `${rootId}:reproducer`, relation: 'reproduced_by' },
    { from: `${rootId}:reproducer`, to: `${rootId}:observation`, relation: 'observed_as' },
  )

  const sessionIds = new Set(input.history.flatMap(event => event.sessionId === undefined ? [] : [event.sessionId]))
  for (const sessionId of sessionIds) {
    const event = input.history.find(item => item.sessionId === sessionId)
    const nodeId = `session:${sessionId}`
    nodes.push({ id: nodeId, kind: 'session', label: 'DSH Session', value: sessionId, state: 'verified', sessionId, ...(event === undefined ? {} : { timestamp: event.timestamp }) })
    edges.push({ from: claimId, to: nodeId, relation: 'produced_in' })
  }

  const evidenceArtifacts = valueAt(input.evidence, 'evidence.repro_artifacts')
  const artifacts = [
    ...(Array.isArray(evidenceArtifacts) ? evidenceArtifacts.filter((item): item is string => typeof item === 'string') : []),
    ...input.reproductionRuns.flatMap(run => run.artifacts),
  ]
  for (const artifact of [...new Set(artifacts)]) {
    const nodeId = `artifact:${artifact}`
    nodes.push({ id: nodeId, kind: 'artifact', label: 'Reproduction artifact', value: artifact, state: 'known', path: artifact })
    edges.push({ from: `${rootId}:reproducer`, to: nodeId, relation: 'attached_as' })
  }
  return { findingId: input.detail.id, generatedAt: new Date().toISOString(), nodes, edges }
}

export function evaluateQualityGate(
  detail: FindingDetail,
  evidence: Record<string, unknown>,
  reproductionRuns: readonly ReproductionRun[] = [],
): QualityGateResult {
  const assessment = assessEvidence(detail, evidence, reproductionRuns)
  const byDimension = new Map(assessment.dimensions.map(item => [item.id, item]))
  const gateActive = detail.status === 'confirmed'
  const reportGoal = ['CVE', 'VulDB', 'advisory'].includes(display(valueAt(evidence, 'researcher_goal')))
  const dedupCount = ['dedup.nvd_searched', 'dedup.ghsa_searched', 'dedup.ecosystem_db_searched']
    .filter(path => valueAt(evidence, path) === true).length
  const chain = byDimension.get('claim_chain')!
  const runtime = byDimension.get('runtime_verification')!
  const scope = byDimension.get('affected_scope')!
  const impact = byDimension.get('impact_confidence')!
  const openQuestions = assessment.openQuestions
  const checks: QualityGateCheck[] = [
    check('status', '研究结论已确认', detail.status === 'confirmed' ? 'verified' : detail.status === 'blocked' ? 'missing' : 'partial', false, detail.status === 'confirmed' ? 'Finding 已确认' : `当前为 ${detail.status}；候选阶段只给出建议，不触发硬门禁`, '明确 verdict 后再决定是否提升状态'),
    check('validation', 'Evidence Schema', detail.validation.ok ? 'verified' : 'missing', gateActive, detail.validation.ok ? 'Evidence.v1 校验通过' : `${detail.validation.errors.length} 个 Schema 错误`, '修复 Evidence.v1 校验错误'),
    check('claim-chain', chain.label, chain.state, gateActive, chain.detail, chain.nextAction),
    check('runtime-verification', runtime.label, runtime.state, gateActive, runtime.detail, runtime.nextAction),
    check('affected-scope', scope.label, scope.state, gateActive, scope.detail, scope.nextAction),
    check('impact-confidence', impact.label, impact.state, gateActive, impact.detail, impact.nextAction),
    check('open-questions', '显式边界问题', openQuestions.length === 0 ? 'verified' : 'partial', gateActive && openQuestions.length > 0, openQuestions.length === 0 ? '没有未决 blockers' : `${openQuestions.length} 个问题仍需判断，不会被折算成惩罚分`, '/omv-critic'),
    check('dedup', '公开披露去重', dedupCount === 3 ? 'verified' : dedupCount > 0 ? 'partial' : 'missing', gateActive && reportGoal, `已检查 ${dedupCount}/3 个被动来源`, '/omv-dedup'),
    check('cvss', 'CVSS 表达', known(valueAt(evidence, 'cvss.vector')) ? 'supported' : 'missing', gateActive && reportGoal, display(valueAt(evidence, 'cvss.vector')), '补充与已验证影响一致的 CVSS'),
  ]
  const blockers = checks.filter(item => item.blocking && !item.passed).map(item => item.label)
  const advisories = checks.filter(item => !item.blocking && !item.passed).map(item => item.label)
  const readyForReport = gateActive && blockers.length === 0
  return {
    findingId: detail.id,
    score: assessment.signal,
    readyForReport,
    checks,
    blockers,
    advisories,
    summary: readyForReport
      ? '核心论证已确认，提交所需条件已满足。'
      : gateActive
        ? `${blockers.length} 个提交条件仍需处理；它们不再反向扣减证据成熟度。`
        : '当前仍是研究阶段：门禁仅提示缺口，不把候选强行判作“未完成”。',
  }
}

function check(id: string, label: string, state: EvidenceCheckState, blocking: boolean, detail: string, nextAction?: string): QualityGateCheck {
  const passed = state === 'supported' || state === 'verified' || state === 'not_applicable'
  return {
    id,
    label,
    state,
    blocking,
    passed,
    severity: blocking ? 'required' : 'recommended',
    detail,
    ...(nextAction === undefined || passed ? {} : { nextAction }),
  }
}

function lineOf(raw: string, path: string): number | undefined {
  const key = path.split('.').at(-1)
  if (key === undefined) return undefined
  const lines = raw.split(/\r?\n/u)
  const pattern = new RegExp(`^\\s*${escapeRegExp(key)}\\s*:`)
  const index = lines.findIndex(line => pattern.test(line))
  return index < 0 ? undefined : index + 1
}

function valueAt(root: Record<string, unknown>, path: string): unknown {
  let value: unknown = root
  for (const key of path.split('.')) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined
    value = (value as Record<string, unknown>)[key]
  }
  return value
}

function known(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '' && value !== 'unknown' && (!Array.isArray(value) || value.length > 0)
}

function display(value: unknown): string {
  if (!known(value)) return 'unknown'
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

function labelFor(kind: typeof EVIDENCE_PATHS[number][0]): string {
  if (kind === 'source') return 'Source'
  if (kind === 'sink') return 'Sink'
  if (kind === 'guard') return 'Guard'
  if (kind === 'reproducer') return 'Reproducer'
  return 'Observed result'
}

function escapeRegExp(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&') }

export function analyzeEvidenceGraph(graph: EvidenceGraph): EvidenceGraphAnalysis {
  const rootId = `finding:${graph.findingId}`
  const sourceId = `${rootId}:source`
  const sinkId = `${rootId}:sink`
  const guardId = `${rootId}:guard`

  const nodeById = new Map(graph.nodes.map(node => [node.id, node]))
  const edgesByFrom = new Map<string, EvidenceGraphEdge[]>()
  for (const edge of graph.edges) {
    if (!edgesByFrom.has(edge.from)) edgesByFrom.set(edge.from, [])
    edgesByFrom.get(edge.from)!.push(edge)
  }

  const primaryPath: string[] = []
  const highlightedNodes: string[] = []
  const highlightedEdges: string[] = []
  const missingGuards: string[] = []
  const disconnectedNodes: string[] = []

  // Build primary path: source → sink → guard
  const sourceNode = nodeById.get(sourceId)
  const sinkNode = nodeById.get(sinkId)
  const guardNode = nodeById.get(guardId)

  if (sourceNode !== undefined && sourceNode.state !== 'unknown') {
    primaryPath.push(sourceId)
    highlightedNodes.push(sourceId)
  }

  if (sinkNode !== undefined && sinkNode.state !== 'unknown') {
    primaryPath.push(sinkId)
    highlightedNodes.push(sinkId)
  }

  if (guardNode !== undefined) {
    if (guardNode.state === 'unknown' || guardNode.value === 'unknown' || guardNode.value === 'missing') {
      missingGuards.push(guardId)
    } else {
      primaryPath.push(guardId)
      highlightedNodes.push(guardId)
    }
  }

  // Highlight edges along the primary path
  for (const edge of graph.edges) {
    if ((edge.from === sourceId && edge.to === sinkId) ||
        (edge.from === sinkId && edge.to === guardId)) {
      highlightedEdges.push(`${edge.from}→${edge.to}`)
    }
  }

  // Find disconnected nodes: nodes not reachable from finding or claim
  const reachable = new Set<string>()
  const queue = [rootId, `${rootId}:claim`]
  while (queue.length > 0) {
    const current = queue.shift()!
    if (reachable.has(current)) continue
    reachable.add(current)
    const edges = edgesByFrom.get(current) ?? []
    for (const edge of edges) {
      if (!reachable.has(edge.to)) queue.push(edge.to)
    }
  }

  for (const node of graph.nodes) {
    if (!reachable.has(node.id) && node.kind !== 'finding' && node.kind !== 'claim') {
      disconnectedNodes.push(node.id)
    }
  }

  return {
    primaryPath,
    highlightedNodes,
    highlightedEdges,
    missingGuards,
    disconnectedNodes,
  }
}

export function exportEvidenceGraph(graph: EvidenceGraph, format: 'dot' | 'mermaid'): string {
  if (format === 'dot') return exportToDot(graph)
  if (format === 'mermaid') return exportToMermaid(graph)
  throw new Error(`unsupported export format: ${format}`)
}

function exportToDot(graph: EvidenceGraph): string {
  const lines: string[] = ['digraph EvidenceGraph {', '  rankdir=LR;', '  node [shape=box];', '']

  for (const node of graph.nodes) {
    const id = safeIdForDot(node.id)
    const label = escapeDotLabel(node.label)
    const shape = node.kind === 'finding' ? 'ellipse' : 'box'
    const style = node.state === 'unknown' ? 'dashed' : node.state === 'verified' ? 'bold' : 'solid'
    lines.push(`  ${id} [label="${label}", shape=${shape}, style=${style}];`)
  }

  lines.push('')

  for (const edge of graph.edges) {
    const from = safeIdForDot(edge.from)
    const to = safeIdForDot(edge.to)
    const label = escapeDotLabel(edge.relation.replace(/_/g, ' '))
    lines.push(`  ${from} -> ${to} [label="${label}"];`)
  }

  lines.push('}')
  return lines.join('\n')
}

function exportToMermaid(graph: EvidenceGraph): string {
  const lines: string[] = ['graph LR', '']

  for (const node of graph.nodes) {
    const id = safeIdForMermaid(node.id)
    const label = escapeMermaidLabel(node.label)
    const bracket = node.kind === 'finding' ? ['((', '))'] : node.state === 'unknown' ? ['[', ']'] : ['[', ']']
    lines.push(`  ${id}${bracket[0]}"${label}"${bracket[1]}`)
  }

  lines.push('')

  for (const edge of graph.edges) {
    const from = safeIdForMermaid(edge.from)
    const to = safeIdForMermaid(edge.to)
    const label = escapeMermaidLabel(edge.relation.replace(/_/g, ' '))
    lines.push(`  ${from} -->|"${label}"| ${to}`)
  }

  return lines.join('\n')
}

function safeIdForDot(id: string): string {
  return id.replace(/[^A-Za-z0-9_]/g, '_')
}

function safeIdForMermaid(id: string): string {
  return id.replace(/[^A-Za-z0-9_]/g, '_')
}

function escapeDotLabel(label: string): string {
  return label
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
}

function escapeMermaidLabel(label: string): string {
  return label
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\n/g, ' ')
    .replace(/\r/g, '')
}
