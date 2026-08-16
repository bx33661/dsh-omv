import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { PocDraft, PocRun, PocStatus, OmvWorkbenchConfig } from './contracts.js'

const execFileAsync = promisify(execFile)

export interface CommandRunner {
  run(command: string, args: string[], options: { timeout: number; signal?: AbortSignal }): Promise<{
    stdout: string
    stderr: string
    exitCode: number
  }>
}

export interface PocExecutor {
  validate(draft: PocDraft, config: OmvWorkbenchConfig): { ok: boolean; errors: string[]; warnings: string[] }
  execute(draft: PocDraft, config: OmvWorkbenchConfig, runner: CommandRunner): Promise<PocRun>
}

export class DockerPocExecutor implements PocExecutor {
  validate(draft: PocDraft, config: OmvWorkbenchConfig): { ok: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = []
    const warnings: string[] = []

    if (!draft.script || draft.script.trim() === '') {
      errors.push('script cannot be empty')
    }

    if (draft.script.length > config.pocMaxScriptBytes) {
      errors.push(`script exceeds maximum size of ${config.pocMaxScriptBytes} bytes`)
    }

    if (!['python', 'bash', 'curl'].includes(draft.language)) {
      errors.push(`unsupported language: ${draft.language}`)
    }

    if (!config.pocDockerImages.includes(draft.image)) {
      errors.push(`image ${draft.image} is not in the allowlist`)
    }

    if (draft.requiresNetwork && !config.pocAllowNetwork) {
      errors.push('PoC requires network but network access is disabled')
    }

    // Security checks
    if (draft.script.includes('/var/run/docker.sock')) {
      errors.push('mounting docker.sock is forbidden')
    }

    if (draft.script.includes('--privileged')) {
      errors.push('privileged containers are forbidden')
    }

    if (draft.script.includes('--network host')) {
      errors.push('host network is forbidden')
    }

    const validEntrypoints = {
      python: 'python3 /workspace/poc.py',
      bash: 'bash /workspace/poc.sh',
      curl: 'bash /workspace/poc.sh',
    }

    const expectedEntrypoint = validEntrypoints[draft.language]
    if (!draft.commandArgs.join(' ').includes(expectedEntrypoint)) {
      warnings.push(`command should use fixed entrypoint: ${expectedEntrypoint}`)
    }

    return { ok: errors.length === 0, errors, warnings }
  }

  async execute(draft: PocDraft, config: OmvWorkbenchConfig, runner: CommandRunner): Promise<PocRun> {
    const validation = this.validate(draft, config)
    if (!validation.ok) {
      return createBlockedRun(draft, validation.errors.join('; '))
    }

    const dockerArgs = this.buildDockerArgs(draft, config)
    const startedAt = new Date().toISOString()

    try {
      const result = await runner.run('docker', dockerArgs, {
        timeout: config.pocTimeoutMs,
      })

      const status = this.parseStatus(result.exitCode, result.stdout)
      const observedResult = this.extractObservedResult(result.stdout)

      const run: PocRun = {
        id: `run-${Date.now()}`,
        draftId: draft.id,
        findingId: draft.findingId,
        backend: 'docker',
        status,
        exitCode: result.exitCode,
        stdout: result.stdout.slice(0, config.pocMaxOutputBytes),
        stderr: result.stderr.slice(0, config.pocMaxOutputBytes),
        artifacts: [],
        safetyProfile: {
          network: draft.requiresNetwork && config.pocAllowNetwork ? 'bridge' : 'none',
          readOnly: true,
          capsDropped: true,
          pidLimit: config.pocPidLimit,
          memoryMb: config.pocMemoryMb,
          cpuLimit: config.pocCpuLimit,
        },
        createdAt: draft.createdAt,
        updatedAt: new Date().toISOString(),
        startedAt,
        finishedAt: new Date().toISOString(),
      }

      if (observedResult !== undefined) {
        run.observedResult = observedResult
      }

      return run
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('timeout')) {
        return createFailedRun(draft, 'execution timeout', startedAt)
      }
      if (error instanceof Error && error.message.includes('docker: command not found')) {
        return createBlockedRun(draft, 'Docker is not available')
      }
      return createFailedRun(draft, error instanceof Error ? error.message : String(error), startedAt)
    }
  }

  private buildDockerArgs(draft: PocDraft, config: OmvWorkbenchConfig): string[] {
    const network = draft.requiresNetwork && config.pocAllowNetwork ? 'bridge' : 'none'
    return [
      'run',
      '--rm',
      `--network=${network}`,
      '--read-only',
      '--cap-drop=ALL',
      '--security-opt=no-new-privileges',
      `--pids-limit=${config.pocPidLimit}`,
      `--memory=${config.pocMemoryMb}m`,
      `--cpus=${config.pocCpuLimit}`,
      '--tmpfs=/tmp:rw,noexec,nosuid,nodev,size=16m',
      draft.image,
      ...draft.commandArgs,
    ]
  }

  private parseStatus(exitCode: number, stdout: string): PocStatus {
    if (exitCode !== 0) return 'failed'

    try {
      const jsonMatch = stdout.match(/\{[\s\S]*"status"[\s\S]*\}/)
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0])
        if (result.status === 'passed') return 'passed'
        if (result.status === 'failed') return 'failed'
        if (result.status === 'blocked') return 'blocked'
      }
    } catch {
      // Fall through to needs_review
    }

    return 'needs_review'
  }

  private extractObservedResult(stdout: string): string | undefined {
    try {
      const jsonMatch = stdout.match(/\{[\s\S]*"observedResult"[\s\S]*\}/)
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0])
        return result.observedResult
      }
    } catch {
      return undefined
    }
    return undefined
  }
}

function createBlockedRun(draft: PocDraft, reason: string): PocRun {
  return {
    id: `run-${Date.now()}`,
    draftId: draft.id,
    findingId: draft.findingId,
    backend: 'docker',
    status: 'blocked',
    artifacts: [],
    stderr: reason,
    safetyProfile: {
      network: 'none',
      readOnly: true,
      capsDropped: true,
      pidLimit: 128,
      memoryMb: 256,
      cpuLimit: 1,
    },
    createdAt: draft.createdAt,
    updatedAt: new Date().toISOString(),
  }
}

function createFailedRun(draft: PocDraft, reason: string, startedAt: string): PocRun {
  return {
    id: `run-${Date.now()}`,
    draftId: draft.id,
    findingId: draft.findingId,
    backend: 'docker',
    status: 'failed',
    artifacts: [],
    stderr: reason,
    safetyProfile: {
      network: 'none',
      readOnly: true,
      capsDropped: true,
      pidLimit: 128,
      memoryMb: 256,
      cpuLimit: 1,
    },
    createdAt: draft.createdAt,
    updatedAt: new Date().toISOString(),
    startedAt,
    finishedAt: new Date().toISOString(),
  }
}

export const defaultCommandRunner: CommandRunner = {
  async run(command: string, args: string[], options: { timeout: number }): Promise<{
    stdout: string
    stderr: string
    exitCode: number
  }> {
    try {
      const { stdout, stderr } = await execFileAsync(command, args, {
        timeout: options.timeout,
        maxBuffer: 1024 * 1024,
      })
      return { stdout, stderr, exitCode: 0 }
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        throw new Error(`${command}: command not found`)
      }
      if (error && typeof error === 'object' && 'killed' in error && error.killed) {
        throw new Error('execution timeout')
      }
      const stdout = error && typeof error === 'object' && 'stdout' in error ? String(error.stdout) : ''
      const stderr = error && typeof error === 'object' && 'stderr' in error ? String(error.stderr) : ''
      const exitCode = error && typeof error === 'object' && 'code' in error ? Number(error.code) : 1
      return { stdout, stderr, exitCode }
    }
  },
}
