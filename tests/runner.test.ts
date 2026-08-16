import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { OmvWorkbench } from '../src/workbench.js'
import { CampaignRunner } from '../src/runner.js'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture(): Promise<OmvWorkbench> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-omv-runner-'))
  roots.push(root)
  return new OmvWorkbench({
    projectRoot: root,
    apiPrefix: '/api/dsh-omv',
    allowMutations: true,
    allowRemoteAccess: false,
    activityLimit: 20,
    refreshIntervalMs: 0,
    campaignConcurrency: 3,
    watchDebounceMs: 10,
    eventHeartbeatMs: 20_000,
    httpBodyLimitBytes: 256 * 1024,
  })
}

async function createRun(workbench: OmvWorkbench, id: string, concurrency: number) {
  await workbench.action({ action: 'campaign.create', id, target: `${id}-package`, ecosystem: 'npm', vulnerabilities: ['ssrf'] })
  await workbench.action({ action: 'campaign.seed', id })
  return workbench.action({ action: 'campaign.run.create', id, sessionId: `session-${id}`, concurrency }) as Promise<{ id: string }>
}

async function mutateStore(root: string, runId: string, mutate: (run: Record<string, unknown>) => void): Promise<void> {
  const path = join(root, '.omv', '.dsh', 'campaign-runs.json')
  const store = JSON.parse(await readFile(path, 'utf8')) as { runs: Record<string, Record<string, unknown>> }
  mutate(store.runs[runId]!)
  await writeFile(path, `${JSON.stringify(store, null, 2)}\n`, 'utf8')
}

describe('CampaignRunner', () => {
  it('converges a run stuck in queued after all lanes reached a terminal state', async () => {
    const workbench = await fixture()
    const run = await createRun(workbench, 'stuck-campaign', 1)
    const now = new Date().toISOString()
    await mutateStore(workbench.config.projectRoot, run.id, stalled => {
      for (const lane of stalled.lanes as Record<string, unknown>[]) {
        lane.status = 'completed'
        lane.updatedAt = now
        lane.finishedAt = now
      }
      stalled.status = 'queued'
    })
    const runner = new CampaignRunner(workbench.config.projectRoot)
    await expect(runner.claim(run.id)).resolves.toEqual([])
    await expect(runner.get(run.id)).resolves.toMatchObject({ status: 'completed' })
  })

  it('never overwrites cancelled or failed lanes when reconciling evidence', async () => {
    const workbench = await fixture()
    const run = await createRun(workbench, 'terminal-campaign', 1)
    const runner = new CampaignRunner(workbench.config.projectRoot)
    await runner.claim(run.id)
    const cancelled = await runner.control(run.id, 'cancel')
    const lane = cancelled.lanes[0]!
    const reconciled = await runner.reconcile(run.id, [{ findingId: lane.findingId, stage: 'report_ready', maturity: 'verified' }])
    expect(reconciled.lanes[0]).toMatchObject({ status: 'cancelled' })
    expect(reconciled.status).toBe('cancelled')

    const failedRun = await createRun(workbench, 'failed-lane-campaign', 1)
    await runner.claim(failedRun.id)
    const laneId = (await runner.get(failedRun.id)).lanes[0]!.laneId
    const failed = await runner.updateLane({ runId: failedRun.id, laneId, status: 'failed', summary: 'setup failed' })
    const reconciledFailed = await runner.reconcile(failedRun.id, [{ findingId: failed.lanes[0]!.findingId, stage: 'report_ready', maturity: 'verified' }])
    expect(reconciledFailed.lanes[0]).toMatchObject({ status: 'failed' })
  })

  it('completes transitional lanes from evidence state', async () => {
    const workbench = await fixture()
    const run = await createRun(workbench, 'live-campaign', 1)
    const runner = new CampaignRunner(workbench.config.projectRoot)
    const dispatches = await runner.claim(run.id)
    const lane = dispatches[0]!
    const reconciled = await runner.reconcile(run.id, [{ findingId: lane.findingId, stage: 'report_ready', maturity: 'verified' }])
    expect(reconciled.lanes[0]).toMatchObject({ status: 'completed' })
    expect(reconciled.status).toBe('completed')
  })

  it('scopes dispatch recovery per run instead of resetting healthy siblings', async () => {
    const workbench = await fixture()
    const recoverable = await createRun(workbench, 'recover-campaign', 1)
    const bystander = await createRun(workbench, 'bystander-campaign', 1)
    const runner = new CampaignRunner(workbench.config.projectRoot)
    await runner.claim(recoverable.id)
    await runner.claim(bystander.id)
    // The bystander is mid-flight: bound to a session and awaiting evidence, but its run status was left running.
    const bystanderLane = (await runner.get(bystander.id)).lanes[0]!
    await runner.bind(bystander.id, bystanderLane.laneId, 'session-bystander')
    await runner.updateLane({ runId: bystander.id, laneId: bystanderLane.laneId, status: 'awaiting_evidence', summary: 'blocked on env' })
    await mutateStore(workbench.config.projectRoot, bystander.id, stalled => { stalled.status = 'running' })

    const recovered = await new CampaignRunner(workbench.config.projectRoot).get(recoverable.id)
    expect(recovered.status).toBe('queued')
    expect(recovered.lanes[0]).toMatchObject({ status: 'queued', attempts: 1 })
    const untouched = await new CampaignRunner(workbench.config.projectRoot).get(bystander.id)
    expect(untouched.status).toBe('running')
    expect(untouched.lanes[0]).toMatchObject({ status: 'awaiting_evidence' })
  })

  it('honours a newly requested concurrency while reusing a queued run', async () => {
    const workbench = await fixture()
    const first = await createRun(workbench, 'width-campaign', 2)
    const reused = await workbench.action({ action: 'campaign.run.create', id: 'width-campaign', sessionId: 'session-width', concurrency: 5 }) as { id: string; concurrency: number }
    expect(reused.id).toBe(first.id)
    expect(reused.concurrency).toBe(5)

    const runner = new CampaignRunner(workbench.config.projectRoot)
    await runner.claim(first.id)
    const running = await workbench.action({ action: 'campaign.run.create', id: 'width-campaign', sessionId: 'session-width', concurrency: 4 }) as { concurrency: number }
    expect(running.concurrency).toBe(5)
  })
})
