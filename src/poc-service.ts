import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { parseDocument } from 'yaml'
import type { FindingDetail } from 'oh-my-vul'
import type { OmvWorkbenchConfig, PocDraft, PocGenerationRequest, PocRun } from './contracts.js'
import { createPocGenerationRequest } from './poc-generator.js'
import { DockerPocExecutor, defaultCommandRunner, type CommandRunner } from './poc-executor.js'
import { PocStore } from './poc-store.js'

export class PocService {
  readonly store: PocStore
  readonly executor: DockerPocExecutor
  private readonly config: OmvWorkbenchConfig
  private readonly projectRoot: string

  constructor(config: OmvWorkbenchConfig) {
    this.config = config
    this.projectRoot = resolve(config.projectRoot)
    this.store = new PocStore(this.projectRoot)
    this.executor = new DockerPocExecutor()
  }

  async generate(detail: FindingDetail, evidence: Record<string, unknown>): Promise<{ request: PocGenerationRequest; draft: PocDraft }> {
    this.assertEnabled()
    const generated = createPocGenerationRequest({ detail, evidence })
    const configuredImage = this.config.pocDockerImages.find(image => image === generated.recommendedImage || image.startsWith(`${generated.recommendedImage}@`)) ?? this.config.pocDockerImages[0] ?? generated.recommendedImage
    const image = splitImage(configuredImage)
    const request: PocGenerationRequest = {
      ...generated,
      recommendedImage: image.name,
      safetyConstraints: {
        ...generated.safetyConstraints,
        maxScriptBytes: this.config.pocMaxScriptBytes,
        maxOutputBytes: this.config.pocMaxOutputBytes,
      },
    }
    const now = new Date().toISOString()
    const script = scaffold(request)
    const draft: PocDraft = {
      id: `poc-draft-${randomUUID()}`,
      findingId: detail.id,
      templateId: request.templateId,
      language: request.language,
      script,
      commandArgs: request.language === 'python' ? ['python3', '/workspace/poc.py'] : ['bash', '/workspace/poc.sh'],
      image: request.recommendedImage,
      ...(image.digest === undefined ? {} : { imageDigest: image.digest }),
      requiresNetwork: request.requiresNetwork,
      generationPrompt: request.generationPrompt,
      resultProtocol: request.resultProtocol,
      validation: { ok: false, errors: ['script is a review scaffold; replace it with a tested PoC'], warnings: [] },
      status: 'draft',
      scriptSha256: sha256(script),
      createdAt: now,
      updatedAt: now,
    }
    await this.store.saveDraft(draft)
    return { request, draft }
  }

  async saveDraft(input: { findingId: string; draftId?: string; script: string; commandArgs?: string[]; language?: PocDraft['language']; templateId?: string; image?: string; requiresNetwork?: boolean }): Promise<PocDraft> {
    this.assertEnabled()
    const existing = input.draftId === undefined ? undefined : await this.store.findDraft(input.draftId)
    if (existing !== undefined && existing.findingId !== input.findingId) throw new Error('draft does not belong to finding')
    const now = new Date().toISOString()
    const language = input.language ?? existing?.language ?? 'python'
    const selectedImage = splitImage(input.image ?? existing?.image ?? this.config.pocDockerImages[0]!)
    const draft: PocDraft = {
      id: existing?.id ?? `poc-draft-${randomUUID()}`,
      findingId: input.findingId,
      templateId: input.templateId ?? existing?.templateId ?? 'generic',
      language,
      script: input.script,
      commandArgs: input.commandArgs ?? (input.language === undefined ? existing?.commandArgs : undefined) ?? entrypoint(language),
      image: selectedImage.name,
      ...(selectedImage.digest === undefined ? (existing?.imageDigest === undefined ? {} : { imageDigest: existing.imageDigest }) : { imageDigest: selectedImage.digest }),
      requiresNetwork: input.requiresNetwork ?? existing?.requiresNetwork ?? false,
      ...(existing?.generationPrompt === undefined ? {} : { generationPrompt: existing.generationPrompt }),
      ...(existing?.resultProtocol === undefined ? {} : { resultProtocol: existing.resultProtocol }),
      validation: { ok: false, errors: [], warnings: [] },
      status: 'draft',
      scriptSha256: sha256(input.script),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    draft.validation = this.executor.validate(draft, this.config)
    await this.store.saveDraft(draft)
    return draft
  }

  async validateDraft(draftId: string): Promise<PocDraft> {
    const draft = await this.requireDraft(draftId)
    const validation = this.executor.validate(draft, this.config)
    const next = { ...draft, validation, updatedAt: new Date().toISOString() }
    await this.store.saveDraft(next)
    return next
  }

  async approveDraft(draftId: string, approvedBy?: string): Promise<PocDraft> {
    const draft = await this.validateDraft(draftId)
    if (!draft.validation.ok) throw new Error(`draft cannot be approved: ${draft.validation.errors.join('; ')}`)
    const next: PocDraft = { ...draft, status: 'approved', ...(approvedBy === undefined ? {} : { approvedBy }), approvedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    await this.store.saveDraft(next)
    return next
  }

  async runDraft(draftId: string, options: { signal?: AbortSignal; sourceDir?: string } = {}, runner: CommandRunner = defaultCommandRunner): Promise<PocRun> {
    this.assertEnabled()
    const draft = await this.requireDraft(draftId)
    if (draft.status !== 'approved') throw new Error('draft must be explicitly approved before execution')
    if (!draft.validation.ok) throw new Error('draft validation must pass before execution')
    const executableDraft = runner === defaultCommandRunner ? await this.pinImageDigest(draft, options.signal) : draft
    const runId = `poc-run-${randomUUID()}`
    const runDirectory = join(this.projectRoot, '.omv', '.dsh', 'poc-runs', runId)
    await mkdir(runDirectory, { recursive: true })
    const sourceDirectory = options.sourceDir === undefined ? undefined : this.safeSourceDirectory(options.sourceDir)
    const run = await this.executor.execute(executableDraft, this.config, runner, { id: runId, runDirectory, ...(options.signal === undefined ? {} : { signal: options.signal }), ...(sourceDirectory === undefined ? {} : { sourceDirectory }) })
    await this.store.saveRun(run)
    return run
  }

  async inspectRun(runId: string): Promise<PocRun> {
    const run = await this.store.findRun(runId)
    if (run === undefined) throw new Error(`PoC run not found: ${runId}`)
    return run
  }

  async adoptEvidence(runId: string): Promise<{ run: PocRun; before: string; after: string }> {
    const run = await this.inspectRun(runId)
    if (run.status !== 'passed') throw new Error('only a passed PoC run can be adopted')
    const draft = await this.requireDraft(run.draftId)
    if (draft.status !== 'approved') throw new Error('the draft must remain approved before evidence adoption')
    const detailPath = await this.findingPath(run.findingId)
    const before = await readFile(detailPath, 'utf8')
    const document = parseDocument(before)
    if (document.errors.length > 0) throw new Error(`cannot update invalid Evidence YAML: ${document.errors[0]?.message ?? detailPath}`)
    document.setIn(['evidence', 'reproducer'], `PoC ${draft.id} executed in isolated Docker container; run ${run.id}`)
    if (run.observedResult !== undefined) document.setIn(['evidence', 'observed_result'], run.observedResult)
    if (run.artifacts.length > 0) document.setIn(['evidence', 'repro_artifacts'], [...new Set([...stringsAt(document.getIn(['evidence', 'repro_artifacts'])), ...run.artifacts])])
    document.setIn(['evidence', 'poc_provenance'], run.provenance ?? { run_id: run.id, status: run.status })
    const after = document.toString()
    if (after !== before) await writeFile(detailPath, after, 'utf8')
    return { run, before, after }
  }

  async listDrafts(findingId?: string): Promise<PocDraft[]> {
    const drafts = await this.store.loadDrafts()
    return findingId === undefined ? drafts : drafts.filter(draft => draft.findingId === findingId)
  }

  async listRuns(findingId?: string): Promise<PocRun[]> {
    const runs = await this.store.loadRuns()
    return findingId === undefined ? runs : runs.filter(run => run.findingId === findingId)
  }

  private async requireDraft(draftId: string): Promise<PocDraft> {
    const draft = await this.store.findDraft(draftId)
    if (draft === undefined) throw new Error(`PoC draft not found: ${draftId}`)
    return draft
  }

  private async findingPath(findingId: string): Promise<string> {
    const findingsRoot = join(this.projectRoot, '.omv', 'findings')
    const path = join(findingsRoot, `${findingId}.yaml`)
    try { await readFile(path, 'utf8'); return path } catch { throw new Error(`finding not found: ${findingId}`) }
  }

  private safeSourceDirectory(sourceDir: string): string {
    const candidate = resolve(this.projectRoot, sourceDir)
    const prefix = this.projectRoot.endsWith(sep) ? this.projectRoot : `${this.projectRoot}${sep}`
    if (candidate !== this.projectRoot && !candidate.startsWith(prefix)) throw new Error('sourceDir must be inside the project root')
    return candidate
  }

  private async pinImageDigest(draft: PocDraft, signal?: AbortSignal): Promise<PocDraft> {
    if (draft.imageDigest !== undefined) return draft
    const result = await defaultCommandRunner.run('docker', ['image', 'inspect', draft.image, '--format', '{{index .RepoDigests 0}}'], { timeout: this.config.pocTimeoutMs, ...(signal === undefined ? {} : { signal }) })
    const digest = result.stdout.match(/@sha256:[a-f0-9]{64}/u)?.[0]?.slice(1)
    if (digest === undefined) throw new Error(`cannot pin Docker image digest for ${draft.image}; pull the allowlisted image locally or save an explicit digest`)
    const pinned = { ...draft, imageDigest: digest, updatedAt: new Date().toISOString() }
    await this.store.saveDraft(pinned)
    return pinned
  }

  private assertEnabled(): void {
    if (!this.config.pocEnabled) throw new Error('PoC features are disabled by plugin configuration')
  }
}

function scaffold(request: PocGenerationRequest): string {
  if (request.language === 'python') return `#!/usr/bin/env python3\nimport json\nfrom pathlib import Path\n\n# Review this scaffold against the Evidence.v1 source -> sink -> guard chain.\nresult = {"status": "needs_review", "observedResult": "replace with an observed result", "artifacts": []}\nPath("/output/result.json").write_text(json.dumps(result), encoding="utf-8")\n`
  return `#!/usr/bin/env bash\nset -euo pipefail\n# Review this scaffold against the Evidence.v1 source -> sink -> guard chain.\nprintf '%s' '{"status":"needs_review","observedResult":"replace with an observed result","artifacts":[]}' > /output/result.json\n`
}

function stringsAt(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function entrypoint(language: PocDraft['language']): string[] {
  return language === 'python' ? ['python3', '/workspace/poc.py'] : ['bash', '/workspace/poc.sh']
}

function splitImage(value: string): { name: string; digest?: string } {
  const match = value.match(/^(.*)@(sha256:[a-f0-9]{64})$/u)
  return match === null ? { name: value } : { name: match[1]!, digest: match[2]! }
}
