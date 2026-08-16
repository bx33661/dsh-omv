import { describe, expect, it } from 'vitest'
import { createPocGenerationRequest } from '../src/poc-generator.js'
import type { FindingDetail } from 'oh-my-vul'

function findingWithClass(vulnerabilityClass: string): { detail: FindingDetail; evidence: Record<string, unknown> } {
  return {
    detail: {
      id: 'test-1',
      package: 'test-package',
      ecosystem: 'npm',
      vulnerability: vulnerabilityClass,
      status: 'candidate',
      path: '.omv/findings/test-1.yaml',
      validation: { ok: true, errors: [], warnings: [] },
      archived: false,
      nextAction: undefined,
      action: undefined,
      missingFields: [],
      openQuestions: [],
      coverageChecks: [],
      reproductionRuns: [],
      observations: [],
      maturity: { phase: 'discovery', signal: 0, dimensions: [] },
      attachedSessions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      blockers: [],
      priority: 'medium',
      priorityReason: undefined,
      readiness: { ready: false, blockers: [], issues: [] },
      target: 'test-target',
      version: '1.0.0',
      cwe: undefined,
      cvss: undefined,
      evidenceScore: 0,
      submissionScore: 0,
      verdict: undefined,
      reproArtifacts: [],
    } as unknown as FindingDetail,
    evidence: {
      'evidence.source': 'req.query.url',
      'evidence.sink': 'fetch(url)',
      'evidence.guard': 'unknown',
    },
  }
}

describe('PoC Generator', () => {
  it('creates an SSRF generation request without executing anything', () => {
    const request = createPocGenerationRequest(findingWithClass('ssrf'))
    expect(request.templateId).toBe('ssrf-python')
    expect(request.language).toBe('python')
    expect(request.requiresNetwork).toBe(true)
    expect(request.safetyConstraints.allowHostNetwork).toBe(false)
    expect(request.safetyConstraints.allowPrivileged).toBe(false)
    expect(request.safetyConstraints.allowDockerSocket).toBe(false)
  })

  it('creates a path traversal generation request', () => {
    const request = createPocGenerationRequest(findingWithClass('path_traversal'))
    expect(request.templateId).toBe('path-traversal-python')
    expect(request.language).toBe('python')
    expect(request.requiresNetwork).toBe(false)
  })

  it('creates a command injection generation request', () => {
    const request = createPocGenerationRequest(findingWithClass('command_injection'))
    expect(request.templateId).toBe('command-injection-bash')
    expect(request.language).toBe('bash')
    expect(request.requiresNetwork).toBe(false)
  })

  it('creates an XSS generation request', () => {
    const request = createPocGenerationRequest(findingWithClass('xss'))
    expect(request.templateId).toBe('xss-python')
    expect(request.language).toBe('python')
  })

  it('creates a SQL injection generation request', () => {
    const request = createPocGenerationRequest(findingWithClass('sql_injection'))
    expect(request.templateId).toBe('sql-injection-python')
    expect(request.language).toBe('python')
  })

  it('creates an XXE generation request', () => {
    const request = createPocGenerationRequest(findingWithClass('xxe'))
    expect(request.templateId).toBe('xxe-python')
    expect(request.language).toBe('python')
  })

  it('creates a file upload generation request', () => {
    const request = createPocGenerationRequest(findingWithClass('unrestricted_file_upload'))
    expect(request.templateId).toBe('file-upload-python')
    expect(request.language).toBe('python')
  })

  it('returns generic template for unsupported vulnerability class', () => {
    const request = createPocGenerationRequest(findingWithClass('unknown_vuln_type'))
    expect(request.templateId).toBe('generic')
    expect(request.language).toBe('python')
    expect(request.generationPrompt).toContain('manual review required')
  })

  it('includes finding context in the request', () => {
    const request = createPocGenerationRequest(findingWithClass('ssrf'))
    expect(request.context).toMatchObject({
      findingId: 'test-1',
      package: 'test-package',
      vulnerability: 'ssrf',
      source: 'req.query.url',
      sink: 'fetch(url)',
      guard: 'unknown',
    })
  })

  it('enforces size limits in safety constraints', () => {
    const request = createPocGenerationRequest(findingWithClass('ssrf'))
    expect(request.safetyConstraints.maxScriptBytes).toBe(128 * 1024)
    expect(request.safetyConstraints.maxOutputBytes).toBe(64 * 1024)
  })
})
