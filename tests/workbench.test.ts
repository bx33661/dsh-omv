import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { OmvWorkbench } from '../src/workbench.js'
import { CampaignRunner } from '../src/runner.js'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture(allowMutations = true): Promise<OmvWorkbench> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-omv-'))
  roots.push(root)
  return new OmvWorkbench({
    projectRoot: root,
    apiPrefix: '/api/dsh-omv',
    allowMutations,
    allowRemoteAccess: false,
    activityLimit: 20,
    refreshIntervalMs: 0,
    campaignConcurrency: 3,
    radarIntervalMs: 0,
    watchDebounceMs: 10,
    eventHeartbeatMs: 20_000,
    httpBodyLimitBytes: 256 * 1024,
  })
}

describe('OmvWorkbench', () => {
  it('projects an empty local workspace into dashboard metrics', async () => {
    const workbench = await fixture()
    const dashboard = await workbench.dashboard()
    expect(dashboard.metrics).toMatchObject({ active: 0, archived: 0, campaigns: 0, averageReadiness: 0, evidenceMaturity: { unmapped: 0, developing: 0, supported: 0, verified: 0, contested: 0 } })
    expect(dashboard.workspace.root).toBe(join(workbench.config.projectRoot, '.omv'))
  })

  it('creates and reads a seeded Evidence.v1 candidate', async () => {
    const workbench = await fixture()
    await workbench.action({
      action: 'finding.create',
      id: 'demo-package-ssrf',
      product: 'demo-package',
      ecosystem: 'npm',
      vulnerabilityClass: 'ssrf',
      researcherGoal: 'triage',
    })
    const dashboard = await workbench.dashboard()
    expect(dashboard.findings).toHaveLength(1)
    expect(dashboard.findings[0]).toMatchObject({ id: 'demo-package-ssrf', status: 'candidate', ecosystem: 'npm' })

    const finding = await workbench.finding('demo-package-ssrf')
    expect(finding.detail.id).toBe('demo-package-ssrf')
    expect(finding.evidence).toMatchObject({ status: 'candidate' })
    expect(finding.doctor?.id).toBe('demo-package-ssrf')
    expect(finding.assessment).toMatchObject({ maturity: 'unmapped', phase: 'discovery', confidence: 'unrated' })
  })

  it('enforces the mutation switch while retaining read actions', async () => {
    const workbench = await fixture(false)
    await expect(workbench.action({ action: 'workspace.init' })).rejects.toThrow('mutations are disabled')
    await expect(workbench.dashboard()).resolves.toMatchObject({ metrics: { active: 0 } })
  })

  it('reports component health without collapsing on a Campaign configuration issue', async () => {
    const workbench = await fixture()
    await expect(workbench.health()).resolves.toMatchObject({ status: 'ok', checks: expect.arrayContaining([
      { name: 'workspace', status: 'ok' },
      { name: 'campaigns', status: 'ok' },
    ]) })
    await workbench.action({ action: 'campaign.create', id: 'health-campaign', target: 'health-target', version: '1.0.0', ecosystem: 'ruby', vulnerabilities: ['xss'] })
    const path = join(workbench.config.projectRoot, '.omv', 'campaigns', 'health-campaign.yaml')
    const valid = await readFile(path, 'utf8')
    await writeFile(path, valid.replace('ecosystem: ruby', 'ecosystem: rubygems'), 'utf8')
    await expect(workbench.health()).resolves.toMatchObject({ status: 'degraded', checks: expect.arrayContaining([
      { name: 'campaigns', status: 'degraded', detail: '1 Campaign 配置需要处理' },
    ]) })
  })

  it('rebinds capabilities to a DSH session workspace without mutating the configured root', async () => {
    const workbench = await fixture()
    const otherRoot = await mkdtemp(join(tmpdir(), 'dsh-omv-scoped-'))
    roots.push(otherRoot)
    const scoped = workbench.scoped(otherRoot)
    expect(scoped).not.toBe(workbench)
    expect(scoped.config.projectRoot).toBe(otherRoot)
    expect(workbench.config.projectRoot).not.toBe(otherRoot)
    await expect(scoped.dashboard()).resolves.toMatchObject({ metrics: { active: 0 } })
  })

  it('persists Finding-session links and starts a resumable Agent workflow', async () => {
    const workbench = await fixture()
    await workbench.action({
      action: 'finding.create',
      id: 'linked-finding',
      product: 'linked-package',
      ecosystem: 'npm',
      vulnerabilityClass: 'ssrf',
      researcherGoal: 'triage',
    })
    const dispatch = await workbench.action({
      action: 'workflow.start',
      id: 'linked-finding',
      intent: 'audit',
      sessionId: 'session-audit-1',
    }) as { prompt: string; linked: { sessionId: string } }
    expect(dispatch.prompt).toContain('source → sink → guard')
    expect(dispatch.linked.sessionId).toBe('session-audit-1')

    const payload = await workbench.finding('linked-finding')
    expect(payload.sessionLink).toMatchObject({ sessionId: 'session-audit-1', lastIntent: 'audit' })
    expect(payload.history[0]).toMatchObject({ action: 'workflow.start', intent: 'audit' })
    const stored = JSON.parse(await readFile(join(workbench.config.projectRoot, '.omv', '.dsh', 'session-links.json'), 'utf8')) as { schemaVersion: number }
    expect(stored.schemaVersion).toBe(1)
  })

  it('derives an investigating stage and records an Evidence diff after a mutation', async () => {
    const workbench = await fixture()
    await workbench.action({
      action: 'finding.create',
      id: 'diff-finding',
      product: 'diff-package',
      ecosystem: 'npm',
      vulnerabilityClass: 'path-traversal',
      researcherGoal: 'triage',
    })
    const before = await workbench.finding('diff-finding')
    const updated = before.rawEvidence.replace('source: unknown', 'source: src/input.ts:10 request path')
    await writeFile(before.detail.path, updated, 'utf8')
    await workbench.action({ action: 'finding.repro', id: 'diff-finding', sessionId: 'session-diff' })

    const after = await workbench.finding('diff-finding')
    expect(after.stage === 'investigating' || after.stage === 'reproducing').toBe(true)
    expect(after.lastDiff).toMatchObject({ action: 'finding.repro' })
    expect(after.lastDiff?.patch).toContain('+')
  })

  it('orders the audit queue by evidence maturity instead of the legacy readiness priority', async () => {
    const workbench = await fixture()
    await workbench.action({ action: 'finding.create', id: 'empty-candidate', product: 'empty', ecosystem: 'npm', vulnerabilityClass: 'ssrf', researcherGoal: 'CVE' })
    await workbench.action({ action: 'finding.create', id: 'supported-candidate', product: 'supported', ecosystem: 'npm', vulnerabilityClass: 'ssrf', researcherGoal: 'CVE' })
    const supported = await workbench.finding('supported-candidate')
    const enriched = supported.rawEvidence
      .replace('source: unknown', 'source: src/input.ts:10 request URL')
      .replace('sink: unknown', 'sink: src/connect.ts:40 network request')
      .replace('guard: unknown', 'guard: src/check.ts:20 incomplete allowlist')
      .replace('reproducer: unknown', 'reproducer: ./commands.sh')
      .replace('observed_result: unknown', 'observed_result: request reached local fixture')
      .replace('exploitability: unknown', 'exploitability: plausible')
      .replace('confidence: unknown', 'confidence: medium')
      .replace('reason: ""', 'reason: evidence chain and local observation agree')
    await writeFile(supported.detail.path, enriched, 'utf8')
    const dashboard = await workbench.dashboard()
    expect(dashboard.findings.map(item => item.id)).toEqual(['supported-candidate', 'empty-candidate'])
    expect(dashboard.findings[0]?.assessment.maturity).toBe('supported')
    expect(dashboard.findings[1]?.assessment.maturity).toBe('unmapped')
  })

  it('keeps the dashboard usable when one Evidence file is malformed', async () => {
    const workbench = await fixture()
    await workbench.action({ action: 'finding.create', id: 'healthy-finding', product: 'healthy', ecosystem: 'npm', vulnerabilityClass: 'ssrf', researcherGoal: 'triage' })
    await workbench.action({ action: 'finding.create', id: 'broken-finding', product: 'broken', ecosystem: 'npm', vulnerabilityClass: 'xss', researcherGoal: 'triage' })
    const broken = await workbench.finding('broken-finding')
    await writeFile(broken.detail.path, `${broken.rawEvidence}\nprovenance:\n  duplicate: true\n`, 'utf8')

    const dashboard = await workbench.dashboard()
    expect(dashboard.findings.map(item => item.id)).toContain('healthy-finding')
    expect(dashboard.findings.map(item => item.id)).not.toContain('broken-finding')
    expect(dashboard.workspaceIssues).toEqual([expect.objectContaining({ id: 'broken-finding', kind: 'finding', recoverable: false })])
  })

  it('emits debounced workspace changes to live subscribers', async () => {
    const workbench = await fixture()
    await workbench.action({ action: 'workspace.init' })
    const event = new Promise<{ paths: string[] }>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('watch event timed out')), 3_000)
      const unsubscribe = workbench.subscribe(change => {
        clearTimeout(timeout)
        unsubscribe()
        resolve(change)
      })
    })
    await writeFile(join(workbench.config.projectRoot, '.omv', 'watch-proof.txt'), 'changed', 'utf8')
    await expect(event).resolves.toMatchObject({ paths: expect.arrayContaining([expect.stringContaining('.omv')]) })
    workbench.close()
  })

  it('seeds and dispatches a Campaign through a linked DSH session', async () => {
    const workbench = await fixture()
    const created = await workbench.action({
      action: 'campaign.create',
      id: 'demo-campaign',
      target: 'demo-package',
      ecosystem: 'npm',
      vulnerabilities: ['ssrf', 'path-traversal'],
      depth: 'deep',
    }) as { campaign: { id: string } }
    expect(created.campaign.id).toBe('demo-campaign')
    const seeded = await workbench.action({ action: 'campaign.seed', id: 'demo-campaign' }) as { created: unknown[] }
    expect(seeded.created.length).toBeGreaterThan(0)
    const dispatch = await workbench.action({ action: 'campaign.start', id: 'demo-campaign', sessionId: 'session-campaign' }) as { laneCount: number; prompt: string }
    expect(dispatch.laneCount).toBe(2)
    expect(dispatch.prompt).toContain('DSH 子 Agent')
    const payload = await workbench.campaign('demo-campaign')
    expect(payload.sessionLink?.sessionId).toBe('session-campaign')
    expect(payload.history[0]?.action).toBe('campaign.start')
  })

  it('normalizes package-registry ecosystem aliases when creating a Campaign', async () => {
    const workbench = await fixture()
    const created = await workbench.action({
      action: 'campaign.create',
      id: 'ruby-alias-campaign',
      target: 'demo/reverse_markdown',
      version: '3.0.2',
      ecosystem: 'rubygems',
      vulnerabilities: ['xss'],
    }) as { campaign: { title: string; target: { ecosystem: string } } }
    expect(created.campaign).toMatchObject({
      title: 'demo/reverse_markdown 3.0.2 research campaign',
      target: { ecosystem: 'ruby' },
    })
  })

  it('isolates an invalid Campaign and repairs deterministic compatibility fields', async () => {
    const workbench = await fixture()
    await workbench.action({ action: 'campaign.create', id: 'healthy-campaign', target: 'healthy', ecosystem: 'npm', vulnerabilities: ['ssrf'] })
    await workbench.action({ action: 'campaign.create', id: 'legacy-campaign', target: 'demo/reverse_markdown', version: '3.0.2', ecosystem: 'ruby', vulnerabilities: ['xss'] })
    const path = join(workbench.config.projectRoot, '.omv', 'campaigns', 'legacy-campaign.yaml')
    const valid = await readFile(path, 'utf8')
    await writeFile(path, valid
      .replace('title: demo/reverse_markdown 3.0.2 research campaign', 'title: demo/reverse_markdown research campaign')
      .replace('ecosystem: ruby', 'ecosystem: rubygems'), 'utf8')

    const degraded = await workbench.dashboard()
    expect(degraded.campaigns.map(campaign => campaign.id)).toEqual(['healthy-campaign'])
    expect(degraded.campaignIssues).toEqual([expect.objectContaining({ id: 'legacy-campaign', repairable: true })])
    expect(degraded.campaignIssues[0]?.changes).toEqual(expect.arrayContaining([
      'target.ecosystem: rubygems → ruby',
      'title: demo/reverse_markdown research campaign → demo/reverse_markdown 3.0.2 research campaign',
    ]))

    await workbench.action({ action: 'campaign.repair', id: 'legacy-campaign' })
    const repaired = await workbench.dashboard()
    expect(repaired.campaignIssues).toEqual([])
    expect(repaired.campaigns.map(campaign => campaign.id)).toEqual(['healthy-campaign', 'legacy-campaign'])
    await expect(workbench.campaign('legacy-campaign')).resolves.toMatchObject({
      campaign: { title: 'demo/reverse_markdown 3.0.2 research campaign', target: { ecosystem: 'ruby' } },
    })
  })

  it('refreshes Radar state and includes it in global search', async () => {
    const workbench = await fixture()
    const radarDir = join(workbench.config.projectRoot, '.omv', 'radar')
    await mkdir(radarDir, { recursive: true })
    await writeFile(join(radarDir, 'watchlist.yaml'), 'watch:\n  - ecosystem: npm\n    package: demo-radar-package\n    vulnerability: ssrf\n', 'utf8')
    const radar = await workbench.action({ action: 'radar.refresh' }) as { events: unknown[] }
    expect(radar.events).toHaveLength(1)
    const results = await workbench.search('demo-radar-package')
    expect(results.some(result => result.kind === 'radar')).toBe(true)
  })

  it('runs Campaign lanes with bounded claims, DSH session binding, retry, and durable completion', async () => {
    const workbench = await fixture()
    await workbench.action({
      action: 'campaign.create', id: 'runtime-campaign', target: 'runtime-package', ecosystem: 'npm',
      vulnerabilities: ['ssrf', 'traversal', 'injection'], depth: 'deep',
    })
    await workbench.action({ action: 'campaign.seed', id: 'runtime-campaign' })
    const run = await workbench.action({ action: 'campaign.run.create', id: 'runtime-campaign', sessionId: 'session-parent', concurrency: 2 }) as { id: string; status: string }
    expect(run.status).toBe('queued')
    const first = await workbench.action({ action: 'campaign.run.claim', runId: run.id }) as { laneId: string }[]
    expect(first).toHaveLength(2)
    await workbench.action({ action: 'campaign.run.bind', runId: run.id, laneId: first[0]!.laneId, sessionId: 'session-lane-1' })
    await workbench.action({ action: 'campaign.run.lane.update', runId: run.id, laneId: first[0]!.laneId, laneStatus: 'completed', sessionId: 'session-lane-1', summary: 'evidence confirmed' })
    await workbench.action({ action: 'campaign.run.lane.update', runId: run.id, laneId: first[1]!.laneId, laneStatus: 'failed', summary: 'dependency setup failed' })
    await workbench.action({ action: 'campaign.run.control', runId: run.id, control: 'retry', laneId: first[1]!.laneId })
    const second = await workbench.action({ action: 'campaign.run.claim', runId: run.id }) as { laneId: string; attempt: number }[]
    expect(second).toHaveLength(2)
    expect(second.some(item => item.laneId === first[1]!.laneId && item.attempt === 2)).toBe(true)
    for (const lane of second) await workbench.action({ action: 'campaign.run.lane.update', runId: run.id, laneId: lane.laneId, laneStatus: 'completed', summary: 'lane resolved' })
    await expect(workbench.campaignRun(run.id)).resolves.toMatchObject({ status: 'completed', parentSessionId: 'session-parent' })
    const detail = await workbench.campaign('runtime-campaign')
    expect(detail.runs[0]).toMatchObject({ id: run.id, status: 'completed' })
  })

  it('recovers a claimed lane when the host restarts before a DSH session is bound', async () => {
    const workbench = await fixture()
    await workbench.action({ action: 'campaign.create', id: 'recovery-campaign', target: 'recover-me', ecosystem: 'npm', vulnerabilities: ['ssrf'] })
    const run = await workbench.action({ action: 'campaign.run.create', id: 'recovery-campaign', sessionId: 'session-parent', concurrency: 1 }) as { id: string }
    await workbench.action({ action: 'campaign.run.claim', runId: run.id })
    const recovered = await new CampaignRunner(workbench.config.projectRoot).get(run.id)
    expect(recovered.status).toBe('queued')
    expect(recovered.lanes[0]).toMatchObject({ status: 'queued', attempts: 1 })
    expect(recovered.lanes[0]?.lastError).toContain('recovered for retry')
  })

  it('keeps blocked Campaign lanes distinct from completed work', async () => {
    const workbench = await fixture()
    await workbench.action({ action: 'campaign.create', id: 'attention-campaign', target: 'attention-package', ecosystem: 'npm', vulnerabilities: ['ssrf', 'traversal'] })
    const run = await workbench.action({ action: 'campaign.run.create', id: 'attention-campaign', sessionId: 'session-parent', concurrency: 2 }) as { id: string }
    const lanes = await workbench.action({ action: 'campaign.run.claim', runId: run.id }) as { laneId: string }[]
    await workbench.action({ action: 'campaign.run.lane.update', runId: run.id, laneId: lanes[0]!.laneId, laneStatus: 'completed', summary: 'evidence closed' })
    await workbench.action({ action: 'campaign.run.lane.update', runId: run.id, laneId: lanes[1]!.laneId, laneStatus: 'blocked', summary: 'needs environment evidence' })
    await expect(workbench.campaignRun(run.id)).resolves.toMatchObject({ status: 'needs_attention' })
  })

  it('projects Evidence Graph and quality gates, and records structured reproduction attempts', async () => {
    const workbench = await fixture()
    await workbench.action({ action: 'finding.create', id: 'graph-finding', product: 'graph-package', ecosystem: 'npm', vulnerabilityClass: 'ssrf', researcherGoal: 'triage' })
    const initial = await workbench.finding('graph-finding')
    expect(initial.graph.nodes.some(node => node.kind === 'source' && node.state === 'unknown')).toBe(true)
    expect(initial.qualityGate.readyForReport).toBe(false)
    expect(initial.qualityGate.blockers).toEqual([])
    expect(initial.qualityGate.advisories).toContain('数据流证据')
    expect(initial.assessment).toMatchObject({ maturity: 'unmapped', phase: 'discovery' })

    const repro = await workbench.action({ action: 'repro.run.start', id: 'graph-finding', sessionId: 'session-repro', command: './commands.sh', artifacts: ['.omv/repro/graph-finding/observed.txt'] }) as { id: string; status: string }
    expect(repro.status).toBe('running')
    await workbench.action({ action: 'repro.run.finish', runId: repro.id, sessionId: 'session-repro', reproStatus: 'passed', exitCode: 0, outputText: 'observed vulnerable behavior' })
    const updated = await workbench.finding('graph-finding')
    expect(updated.reproductionRuns[0]).toMatchObject({ id: repro.id, status: 'passed', exitCode: 0 })
    expect(updated.evidence).toMatchObject({ evidence: { observed_result: 'observed vulnerable behavior' } })
    expect(updated.graph.nodes.some(node => node.kind === 'artifact')).toBe(true)
    expect(updated.assessment.dimensions.find(item => item.id === 'runtime_verification')).toMatchObject({ state: 'verified' })
  })

  it('queues Radar signals and converts one into a tracked Candidate', async () => {
    const workbench = await fixture()
    const radarDir = join(workbench.config.projectRoot, '.omv', 'radar')
    await mkdir(radarDir, { recursive: true })
    await writeFile(join(radarDir, 'watchlist.yaml'), 'watch:\n  - ecosystem: npm\n    package: queue-package\n    vulnerability: command-injection\n', 'utf8')
    const radar = await workbench.action({ action: 'radar.refresh' }) as { queue: { id: string; status: string }[] }
    expect(radar.queue[0]).toMatchObject({ status: 'new' })
    const converted = await workbench.action({ action: 'radar.queue.convert', id: radar.queue[0]!.id, findingId: 'radar-queue-finding' }) as { findingId: string }
    expect(converted.findingId).toBe('radar-queue-finding')
    const dashboard = await workbench.dashboard()
    expect(dashboard.findings.some(finding => finding.id === 'radar-queue-finding')).toBe(true)
    expect((await workbench.radar()).queue[0]).toMatchObject({ status: 'candidate', findingId: 'radar-queue-finding' })
  })

  it('unifies quality, dedup, review, report, disclosure, and reproduction actions', async () => {
    const workbench = await fixture()
    await workbench.action({ action: 'finding.create', id: 'workflow-finding', product: 'workflow-package', ecosystem: 'npm', vulnerabilityClass: 'ssrf', researcherGoal: 'triage' })
    const initial = await workbench.dashboard()
    expect(initial.quality.queues.needsReview).toBeGreaterThan(0)
    expect(initial.reviews[0]).toMatchObject({ findingId: 'workflow-finding', status: 'unreviewed' })
    expect(initial.reports[0]).toMatchObject({ findingId: 'workflow-finding', status: 'missing' })
    const dedup = await workbench.action({ action: 'dedup.scan', id: 'workflow-finding', sessionId: 'session-quality' }) as { status: string }
    expect(dedup.status).toBe('clear')
    const review = await workbench.action({ action: 'review.update', id: 'workflow-finding', reviewStatus: 'in_review', assignee: 'reviewer-a', sessionId: 'session-quality' }) as { status: string; assignee: string }
    expect(review).toMatchObject({ status: 'in_review', assignee: 'reviewer-a' })
    const noted = await workbench.action({ action: 'review.note.add', id: 'workflow-finding', author: 'reviewer-a', body: '请补充运行时观测。' }) as { notes: unknown[] }
    expect(noted.notes).toHaveLength(1)
    const run = await workbench.action({ action: 'repro.run.start', id: 'workflow-finding', sessionId: 'session-quality', command: './repro.sh' }) as { id: string; status: string }
    expect(run.status).toBe('running')
    const report = await workbench.action({ action: 'report.prepare', id: 'workflow-finding', sessionId: 'session-quality' }) as { status: string; artifacts: string[] }
    expect(report.artifacts.some(path => path.endsWith('dsh-omv-draft.md'))).toBe(true)
    const disclosure = await workbench.action({ action: 'disclosure.schedule', id: 'workflow-finding', disclosureDate: '2030-01-02', disclosureChannel: 'internal', sessionId: 'session-quality' }) as { status: string; channel: string }
    expect(disclosure).toMatchObject({ status: 'planned', channel: 'internal' })
    const final = await workbench.dashboard()
    expect(final.reproductionRuns).toHaveLength(1)
    expect(final.quality.issues.some(issue => issue.kind === 'review' && issue.findingId === 'workflow-finding')).toBe(false)
    await expect(workbench.disclosures('workflow-finding')).resolves.toEqual([expect.objectContaining({ channel: 'internal' })])
  })
})
