import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { CommandRunner } from '../src/poc-executor.js'
import { OmvWorkbench } from '../src/workbench.js'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture(): Promise<OmvWorkbench> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-omv-poc-'))
  roots.push(root)
  return new OmvWorkbench({
    projectRoot: root, apiPrefix: '/api/dsh-omv', allowMutations: true, allowRemoteAccess: false,
    activityLimit: 20, refreshIntervalMs: 0, campaignConcurrency: 3, watchDebounceMs: 10, eventHeartbeatMs: 20_000,
    httpBodyLimitBytes: 256 * 1024, pocEnabled: true, pocAllowNetwork: false, pocDockerImages: ['python:3.12-slim'],
    pocTimeoutMs: 30_000, pocMemoryMb: 256, pocCpuLimit: 1, pocPidLimit: 128, pocMaxScriptBytes: 128 * 1024, pocMaxOutputBytes: 64 * 1024,
  })
}

describe('PoC laboratory loop', () => {
  it('keeps approval and evidence adoption as explicit boundaries', async () => {
    const workbench = await fixture()
    await workbench.action({ action: 'finding.create', id: 'poc-finding', product: 'poc-package', ecosystem: 'npm', vulnerabilityClass: 'path_traversal', researcherGoal: 'triage' })
    const finding = await workbench.finding('poc-finding')
    const generated = await workbench.poc.generate(finding.detail, finding.evidence)
    const script = 'from pathlib import Path\nimport json\nPath("/output/result.json").write_text(json.dumps({"status":"passed","observedResult":"fixture reached","artifacts":[]}))\n'
    const saved = await workbench.poc.saveDraft({ findingId: 'poc-finding', draftId: generated.draft.id, script })
    await expect(workbench.poc.runDraft(saved.id)).rejects.toThrow('explicitly approved')
    const approved = await workbench.poc.approveDraft(saved.id, 'test-reviewer')
    expect(approved.status).toBe('approved')

    const runner: CommandRunner = {
      async run(_command, args, options) {
        expect(options.signal).toBeUndefined()
        const outputMount = args.find(value => value.endsWith('dst=/output'))
        if (outputMount === undefined) throw new Error('missing output mount')
        const source = outputMount.slice('type=bind,src='.length, -',dst=/output'.length)
        await writeFile(join(source, 'result.json'), JSON.stringify({ status: 'passed', observedResult: 'fixture reached', artifacts: [] }))
        return { stdout: 'stdout is intentionally not the protocol', stderr: '', exitCode: 0 }
      },
    }
    const run = await workbench.poc.runDraft(approved.id, {}, runner)
    expect(run.status).toBe('passed')
    expect(run.observedResult).toBe('fixture reached')
    expect(run.artifactRecords).toEqual([expect.objectContaining({ path: 'result.json', sha256: expect.any(String) })])
    expect(run.provenance?.mounts).toEqual(expect.arrayContaining([
      expect.objectContaining({ target: '/output', readOnly: false }),
      expect.objectContaining({ target: '/workspace/poc.py', readOnly: true }),
    ]))

    const adopted = await workbench.poc.adoptEvidence(run.id)
    expect(adopted.after).toContain('fixture reached')
    const updated = await workbench.finding('poc-finding')
    expect(updated.evidence).toMatchObject({ evidence: { observed_result: 'fixture reached' } })
    expect(await readFile(updated.detail.path, 'utf8')).toContain('poc_provenance')
  })
})
