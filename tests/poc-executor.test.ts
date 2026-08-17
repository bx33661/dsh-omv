import { describe, expect, it } from 'vitest'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { DockerPocExecutor } from '../src/poc-executor.js'
import type { CommandRunner } from '../src/poc-executor.js'
import type { PocDraft, OmvWorkbenchConfig } from '../src/contracts.js'

function validDraft(): PocDraft {
  return {
    id: 'draft-1',
    findingId: 'test-1',
    templateId: 'ssrf-python',
    language: 'python',
    script: 'import sys\nprint("test")',
    commandArgs: ['python3', '/workspace/poc.py'],
    image: 'python:3.12-slim',
    requiresNetwork: false,
    validation: { ok: true, errors: [], warnings: [] },
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function validConfig(): OmvWorkbenchConfig {
  return {
    apiPrefix: '/api/dsh-omv',
    projectRoot: '/tmp/test',
    allowMutations: true,
    allowRemoteAccess: false,
    activityLimit: 60,
    refreshIntervalMs: 15000,
    campaignConcurrency: 3,
    watchDebounceMs: 90,
    eventHeartbeatMs: 20000,
    httpBodyLimitBytes: 256 * 1024,
    pocEnabled: true,
    pocAllowNetwork: false,
    pocDockerImages: ['python:3.12-slim'],
    pocTimeoutMs: 30000,
    pocMemoryMb: 256,
    pocCpuLimit: 1,
    pocPidLimit: 128,
    pocMaxScriptBytes: 128 * 1024,
    pocMaxOutputBytes: 64 * 1024,
  }
}

describe('PoC Executor validation', () => {
  const executor = new DockerPocExecutor()

  it('rejects empty scripts', () => {
    const draft = validDraft()
    draft.script = ''
    const result = executor.validate(draft, validConfig())
    expect(result.ok).toBe(false)
    expect(result.errors).toContain('script cannot be empty')
  })

  it('rejects scripts exceeding size limit', () => {
    const draft = validDraft()
    draft.script = 'x'.repeat(200 * 1024)
    const result = executor.validate(draft, validConfig())
    expect(result.ok).toBe(false)
    expect(result.errors.some(e => e.includes('exceeds maximum size'))).toBe(true)
  })

  it('rejects unsupported languages', () => {
    const draft = validDraft()
    draft.language = 'ruby' as any
    const result = executor.validate(draft, validConfig())
    expect(result.ok).toBe(false)
    expect(result.errors.some(e => e.includes('unsupported language'))).toBe(true)
  })

  it('rejects images not in allowlist', () => {
    const draft = validDraft()
    draft.image = 'malicious:latest'
    const result = executor.validate(draft, validConfig())
    expect(result.ok).toBe(false)
    expect(result.errors.some(e => e.includes('not in the allowlist'))).toBe(true)
  })

  it('rejects network-requiring PoCs when network is disabled', () => {
    const draft = validDraft()
    draft.requiresNetwork = true
    const result = executor.validate(draft, validConfig())
    expect(result.ok).toBe(false)
    expect(result.errors.some(e => e.includes('network access is disabled'))).toBe(true)
  })

  it('rejects scripts attempting to mount docker.sock', () => {
    const draft = validDraft()
    draft.script = 'mount /var/run/docker.sock'
    const result = executor.validate(draft, validConfig())
    expect(result.ok).toBe(false)
    expect(result.errors.some(e => e.includes('docker.sock'))).toBe(true)
  })

  it('rejects privileged flag', () => {
    const draft = validDraft()
    draft.script = 'docker run --privileged'
    const result = executor.validate(draft, validConfig())
    expect(result.ok).toBe(false)
    expect(result.errors.some(e => e.includes('privileged'))).toBe(true)
  })

  it('rejects host network', () => {
    const draft = validDraft()
    draft.script = 'docker run --network host'
    const result = executor.validate(draft, validConfig())
    expect(result.ok).toBe(false)
    expect(result.errors.some(e => e.includes('host network'))).toBe(true)
  })

  it('accepts valid draft', () => {
    const result = executor.validate(validDraft(), validConfig())
    expect(result.ok).toBe(true)
    expect(result.errors).toHaveLength(0)
  })
})

describe('PoC Executor execution', () => {
  const executor = new DockerPocExecutor()

  it('returns blocked status when Docker is unavailable', async () => {
    const draft = validDraft()
    const config = validConfig()
    const fakeRunner: CommandRunner = {
      async run() {
        throw new Error('docker: command not found')
      },
    }
    const run = await executor.execute(draft, config, fakeRunner)
    expect(run.status).toBe('blocked')
    expect(run.stderr).toContain('Docker is not available')
  })

  it('returns failed status on timeout', async () => {
    const draft = validDraft()
    const config = validConfig()
    const fakeRunner: CommandRunner = {
      async run() {
        throw new Error('execution timeout')
      },
    }
    const run = await executor.execute(draft, config, fakeRunner)
    expect(run.status).toBe('failed')
    expect(run.stderr).toContain('timeout')
  })

  it('returns failed status on non-zero exit', async () => {
    const draft = validDraft()
    const config = validConfig()
    const fakeRunner: CommandRunner = {
      async run() {
        return { stdout: '', stderr: 'error', exitCode: 1 }
      },
    }
    const run = await executor.execute(draft, config, fakeRunner)
    expect(run.status).toBe('failed')
    expect(run.exitCode).toBe(1)
  })

  it('returns passed status when result JSON indicates success', async () => {
    const draft = validDraft()
    const config = validConfig()
    const runDirectory = await mkdtemp(join(tmpdir(), 'omv-poc-test-'))
    const fakeRunner: CommandRunner = {
      async run() {
        await writeFile(join(runDirectory, 'output', 'result.json'), '{"status":"passed","observedResult":"SSRF confirmed"}')
        return {
          stdout: 'legacy stdout must not be parsed',
          stderr: '',
          exitCode: 0,
        }
      },
    }
    const run = await executor.execute(draft, config, fakeRunner, { runDirectory })
    expect(run.status).toBe('passed')
    expect(run.observedResult).toBe('SSRF confirmed')
  })

  it('returns needs_review when exit is zero but no result JSON', async () => {
    const draft = validDraft()
    const config = validConfig()
    const fakeRunner: CommandRunner = {
      async run() {
        return { stdout: 'some output', stderr: '', exitCode: 0 }
      },
    }
    const run = await executor.execute(draft, config, fakeRunner)
    expect(run.status).toBe('needs_review')
  })

  it('enforces safety profile in run result', async () => {
    const draft = validDraft()
    const config = validConfig()
    const fakeRunner: CommandRunner = {
      async run() {
        return { stdout: '{"status": "passed"}', stderr: '', exitCode: 0 }
      },
    }
    const run = await executor.execute(draft, config, fakeRunner)
    expect(run.safetyProfile.network).toBe('none')
    expect(run.safetyProfile.readOnly).toBe(true)
    expect(run.safetyProfile.capsDropped).toBe(true)
    expect(run.safetyProfile.pidLimit).toBe(128)
  })

  it('blocks execution when validation fails', async () => {
    const draft = validDraft()
    draft.script = ''
    const config = validConfig()
    const fakeRunner: CommandRunner = {
      async run() {
        throw new Error('should not be called')
      },
    }
    const run = await executor.execute(draft, config, fakeRunner)
    expect(run.status).toBe('blocked')
  })
})
