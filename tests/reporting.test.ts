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
  it('creates a durable draft, provenance pack, and disclosure checkpoint', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-omv-report-'))
    roots.push(root)
    await createFindingTemplate('report-finding', { projectRoot: root, seed: { researcherGoal: 'triage', product: 'report-package', ecosystem: 'npm', vulnerabilityClass: 'ssrf' } })
    const service = new ReportingService(root)
    await expect(service.inspect('report-finding')).resolves.toMatchObject({ status: 'missing', artifacts: [] })
    const prepared = await service.prepare('report-finding')
    expect(prepared.artifacts.some(path => path.endsWith('dsh-omv-draft.md'))).toBe(true)
    expect(prepared.status === 'ready' || prepared.status === 'stale').toBe(true)
    const plan = await service.schedule({ findingId: 'report-finding', channel: 'internal', dueAt: '2030-01-02', notes: '先完成内部复核' })
    expect(plan).toMatchObject({ findingId: 'report-finding', channel: 'internal', status: 'planned' })
    await expect(service.disclosureList('report-finding')).resolves.toEqual([expect.objectContaining({ id: plan.id })])
  })
})
