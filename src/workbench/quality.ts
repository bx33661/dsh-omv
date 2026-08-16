import { readdir, readFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { showFinding } from 'oh-my-vul'
import { parse as parseYaml } from 'yaml'
import { deriveAuditStage } from '../workflow.js'
import { assessEvidence } from '../assessment.js'
import type {
  CampaignIssue,
  DedupSummary,
  ReportPack,
  ReportQueueItem,
  ReviewQueueItem,
  ReviewRecord,
  WorkbenchFindingSummary,
  WorkspaceIssue,
  WorkspaceQualityIssue,
  WorkspaceQualityPayload,
} from '../contracts.js'

export async function readFindingWorkflowsSafe(projectRoot: string, findingsDir: string): Promise<{ findings: WorkbenchFindingSummary[]; issues: WorkspaceIssue[] }> {
  const entries = await readdir(findingsDir, { withFileTypes: true })
  const findings: WorkbenchFindingSummary[] = []
  const issues: WorkspaceIssue[] = []
  const files = entries
    .filter(entry => entry.isFile() && (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml')))
    .map(entry => entry.name)
    .sort()

  for (const file of files) {
    const path = join(findingsDir, file)
    const id = basename(file, extname(file))
    try {
      const detail = await showFinding(id, projectRoot)
      const evidence = await readFile(detail.path, 'utf8').then(raw => parseYaml(raw)).then(value => isRecord(value) ? value : {})
      const { archived: _archived, validation: _validation, ...summary } = detail
      const assessment = assessEvidence(detail, evidence, [])
      findings.push({
        ...summary,
        stage: deriveAuditStage(detail, evidence),
        assessment,
      })
    } catch (error) {
      issues.push({
        id,
        kind: 'finding',
        path,
        message: error instanceof Error ? error.message : String(error),
        recoverable: false,
      })
    }
  }

  findings.sort((left, right) => evidenceQueueRank(left) - evidenceQueueRank(right) || right.assessment.openQuestions.length - left.assessment.openQuestions.length || left.id.localeCompare(right.id))
  return { findings, issues }
}

export function evidenceQueueRank(finding: WorkbenchFindingSummary): number {
  if (finding.stage === 'report_ready') return 0
  if (finding.assessment.maturity === 'contested') return 1
  if (finding.assessment.maturity === 'verified') return 2
  if (finding.assessment.maturity === 'supported') return 3
  if (finding.assessment.maturity === 'developing') return 4
  return 5
}

export function reviewQueueItem(findingId: string, record: ReviewRecord | undefined): ReviewQueueItem {
  const status = record?.status ?? 'unreviewed'
  const latestNote = record?.notes.at(-1)?.body
  return {
    findingId,
    status,
    ...(record?.assignee === undefined ? {} : { assignee: record.assignee }),
    noteCount: record?.notes.length ?? 0,
    ...(latestNote === undefined ? {} : { latestNote }),
    updatedAt: record?.updatedAt ?? new Date(0).toISOString(),
    nextAction: status === 'approved' ? '评审已通过' : status === 'changes_requested' ? '处理评审意见并重新校验' : status === 'in_review' ? '等待 Reviewer 给出结论' : status === 'rejected' ? '记录驳回理由或归档研究' : '分配 Reviewer 并开始评审',
  }
}

export function reviewQueueRank(item: ReviewQueueItem): number {
  return item.status === 'changes_requested' ? 0 : item.status === 'unreviewed' ? 1 : item.status === 'in_review' ? 2 : item.status === 'rejected' ? 3 : 4
}

export function reportQueueItem(pack: ReportPack, finding: WorkbenchFindingSummary): ReportQueueItem {
  return { ...pack, stage: finding.stage, maturity: finding.assessment.maturity, package: finding.package }
}

export function reportQueueRank(item: ReportQueueItem): number {
  return item.status === 'missing' ? 0 : item.status === 'stale' ? 1 : item.stage === 'report_ready' ? 2 : 3
}

export function buildWorkspaceQuality(input: {
  workspaceIssues: readonly WorkspaceIssue[]
  campaignIssues: readonly CampaignIssue[]
  findings: readonly WorkbenchFindingSummary[]
  reports: readonly ReportQueueItem[]
  reviews: readonly ReviewQueueItem[]
  dedup: ReadonlyMap<string, DedupSummary>
}): WorkspaceQualityPayload {
  const issues: WorkspaceQualityIssue[] = []
  for (const issue of input.workspaceIssues) issues.push({ id: `workspace-${issue.id}`, severity: 'blocker', kind: 'workspace', title: `${issue.id} 文件未加载`, detail: issue.message, path: issue.path, nextAction: '修复 YAML 后刷新工作区' })
  for (const issue of input.campaignIssues) issues.push({ id: `campaign-${issue.id}`, severity: issue.repairable ? 'warning' : 'blocker', kind: 'campaign', title: `${issue.id} Campaign 配置需要处理`, detail: issue.message, path: issue.path, nextAction: issue.repairable ? `运行 /omv-campaign-repair ${issue.id}` : '检查 Campaign YAML 与生态字段' })
  for (const finding of input.findings) {
    if (finding.assessment.openQuestions.length > 0) issues.push({ id: `finding-${finding.id}-questions`, severity: 'warning', kind: 'finding', findingId: finding.id, title: `${finding.id} 存在未决问题`, detail: finding.assessment.openQuestions.slice(0, 2).join('；'), nextAction: finding.assessment.suggestedActions[0] ?? `/omv-audit ${finding.id}` })
    const dedup = input.dedup.get(finding.id)
    if (dedup === undefined || dedup.status === 'unknown') issues.push({ id: `dedup-${finding.id}`, severity: 'info', kind: 'dedup', findingId: finding.id, title: `${finding.id} 尚未完成去重`, detail: '本地 Finding 与被动情报还没有形成去重结论。', nextAction: `/omv-dedup ${finding.id}` })
    else if (dedup.status === 'possible_duplicate') issues.push({ id: `dedup-${finding.id}-possible`, severity: 'warning', kind: 'dedup', findingId: finding.id, title: `${finding.id} 有相似研究项`, detail: `${dedup.matches.length} 个相似项等待人工判断。`, nextAction: `/omv-dedup ${finding.id}` })
  }
  for (const report of input.reports) {
    if (report.status === 'missing' || report.status === 'stale') issues.push({ id: `report-${report.findingId}`, severity: report.stage === 'report_ready' ? 'blocker' : 'warning', kind: 'report', findingId: report.findingId, title: `${report.findingId} 报告包${report.status === 'missing' ? '缺失' : '需要刷新'}`, detail: report.missing[0] ?? report.nextAction, path: report.reportsDir, nextAction: `/omv-report ${report.findingId}` })
  }
  for (const review of input.reviews) {
    if (review.status === 'unreviewed' && input.findings.some(finding => finding.id === review.findingId && (finding.stage === 'confirmed' || finding.stage === 'report_ready'))) issues.push({ id: `review-${review.findingId}`, severity: 'warning', kind: 'review', findingId: review.findingId, title: `${review.findingId} 等待评审`, detail: '已具备较成熟证据，分配 Reviewer 后进入提交前检查。', nextAction: `/omv-review ${review.findingId}` })
  }
  const blockers = issues.filter(issue => issue.severity === 'blocker').length
  const warnings = issues.filter(issue => issue.severity === 'warning').length
  const infos = issues.filter(issue => issue.severity === 'info').length
  const queues = {
    needsEvidence: input.findings.filter(finding => finding.assessment.maturity === 'unmapped' || finding.assessment.maturity === 'developing').length,
    needsReproduction: input.findings.filter(finding => finding.assessment.dimensions.some(dimension => dimension.id === 'runtime_verification' && (dimension.state === 'missing' || dimension.state === 'partial'))).length,
    needsReview: input.reviews.filter(review => review.status === 'unreviewed' || review.status === 'changes_requested').length,
    needsDedup: input.findings.filter(finding => { const value = input.dedup.get(finding.id); return value === undefined || value.status === 'unknown' || value.status === 'possible_duplicate' }).length,
    reportReady: input.reports.filter(report => report.status === 'ready' && report.stage === 'report_ready').length,
  }
  const score = Math.max(0, Math.min(100, Math.round(100 - blockers * 12 - warnings * 4 - infos)))
  return { generatedAt: new Date().toISOString(), score, blockers, warnings, infos, issues: issues.slice(0, 120), queues }
}


function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
