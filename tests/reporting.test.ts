import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createFindingTemplate } from 'oh-my-vul'
import { ReportingService } from '../src/reporting.js'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('ReportingService', () => {
  it('surfaces a missing pack until the omv-report workflow writes artifacts', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-omv-report-'))
    roots.push(root)
    await createFindingTemplate('report-finding', { projectRoot: root, seed: { researcherGoal: 'triage', product: 'report-package', ecosystem: 'npm', vulnerabilityClass: 'ssrf' } })
    const service = new ReportingService(root)
    await expect(service.inspect('report-finding')).resolves.toMatchObject({
      status: 'missing',
      artifacts: [],
      reportsDir: join(root, '.omv', 'reports', 'report-finding'),
    })
    await expect(service.inspect('missing-finding')).resolves.toMatchObject({ status: 'missing', artifacts: [] })
  })
})
