import { join } from 'node:path'
import { checkReportArtifacts } from 'oh-my-vul'
import type { ReportPack } from './contracts.js'

/**
 * Read-only report artifact status for the quality center. Draft generation,
 * provenance refresh and disclosure timelines belong to the omv-report /
 * omv-disclose Agent workflows, which write the same .omv/reports files this
 * service inspects.
 */
export class ReportingService {
  readonly projectRoot: string

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot
  }

  async inspect(findingId: string): Promise<ReportPack> {
    const id = required(findingId, 'finding id')
    try {
      const result = await checkReportArtifacts(id, this.projectRoot)
      const status = result.errors.length > 0
        ? result.reportArtifactPaths.length === 0 ? 'missing' : 'stale'
        : result.reportArtifactPaths.length === 0 ? 'missing' : result.provenanceFresh === false ? 'stale' : 'ready'
      return {
        findingId: id,
        status,
        reportsDir: result.reportsDir,
        artifacts: result.reportArtifactPaths,
        missing: [...result.errors, ...result.warnings],
        ...(result.provenanceFresh === null || result.provenanceFresh === undefined ? {} : { provenanceFresh: result.provenanceFresh }),
        nextAction: status === 'missing' ? '由 omv-report 工作流生成报告材料' : status === 'stale' ? '刷新报告来源与 provenance' : '报告材料已就绪',
      }
    } catch (error) {
      return {
        findingId: id,
        status: 'missing',
        reportsDir: join(this.projectRoot, '.omv', 'reports', id),
        artifacts: [],
        missing: [error instanceof Error ? error.message : String(error)],
        nextAction: '由 omv-report 工作流生成报告材料',
      }
    }
  }
}

function required(value: string, label: string): string {
  const normalized = value.trim()
  if (normalized === '') throw new Error(`${label} is required`)
  return normalized
}
