import type { FindingDetail } from 'oh-my-vul'
import type { PocGenerationRequest, PocLanguage } from './contracts.js'

interface TemplateDefinition {
  id: string
  vulnerabilityClass: string
  language: PocLanguage
  image: string
  requiresNetwork: boolean
  generationPrompt: string
  resultProtocol: string
}

const TEMPLATES: TemplateDefinition[] = [
  {
    id: 'ssrf-python',
    vulnerabilityClass: 'ssrf',
    language: 'python',
    image: 'python:3.12-slim',
    requiresNetwork: true,
    generationPrompt: 'Generate a Python script that demonstrates SSRF by making an HTTP request to an internal service. The script should output "PASSED" if the internal service responds, "FAILED" otherwise. Write result to /output/result.json with fields: status, observedResult, artifacts.',
    resultProtocol: 'JSON file at /output/result.json with {status: "passed"|"failed"|"needs_review", observedResult: string, artifacts: string[]}',
  },
  {
    id: 'path-traversal-python',
    vulnerabilityClass: 'path_traversal',
    language: 'python',
    image: 'python:3.12-slim',
    requiresNetwork: false,
    generationPrompt: 'Generate a Python script that demonstrates path traversal by reading a file outside the intended directory. Output "PASSED" if sensitive file is accessible, "FAILED" otherwise. Write result to /output/result.json.',
    resultProtocol: 'JSON file at /output/result.json',
  },
  {
    id: 'command-injection-bash',
    vulnerabilityClass: 'command_injection',
    language: 'bash',
    image: 'python:3.12-slim',
    requiresNetwork: false,
    generationPrompt: 'Generate a bash script that demonstrates command injection by executing an unintended command. Output "PASSED" if arbitrary command executes, "FAILED" otherwise. Write result to /output/result.json.',
    resultProtocol: 'JSON file at /output/result.json',
  },
  {
    id: 'xss-python',
    vulnerabilityClass: 'xss',
    language: 'python',
    image: 'python:3.12-slim',
    requiresNetwork: false,
    generationPrompt: 'Generate a Python script that demonstrates XSS by injecting script tags into HTML output. Output "PASSED" if script tag appears unescaped, "FAILED" otherwise. Write result to /output/result.json.',
    resultProtocol: 'JSON file at /output/result.json',
  },
  {
    id: 'sql-injection-python',
    vulnerabilityClass: 'sql_injection',
    language: 'python',
    image: 'python:3.12-slim',
    requiresNetwork: false,
    generationPrompt: 'Generate a Python script that demonstrates SQL injection by manipulating a SQL query. Output "PASSED" if injection succeeds, "FAILED" otherwise. Write result to /output/result.json.',
    resultProtocol: 'JSON file at /output/result.json',
  },
  {
    id: 'xxe-python',
    vulnerabilityClass: 'xxe',
    language: 'python',
    image: 'python:3.12-slim',
    requiresNetwork: false,
    generationPrompt: 'Generate a Python script that demonstrates XXE by parsing XML with external entity. Output "PASSED" if external entity is resolved, "FAILED" otherwise. Write result to /output/result.json.',
    resultProtocol: 'JSON file at /output/result.json',
  },
  {
    id: 'file-upload-python',
    vulnerabilityClass: 'unrestricted_file_upload',
    language: 'python',
    image: 'python:3.12-slim',
    requiresNetwork: false,
    generationPrompt: 'Generate a Python script that demonstrates unrestricted file upload by uploading a malicious file. Output "PASSED" if upload succeeds, "FAILED" otherwise. Write result to /output/result.json.',
    resultProtocol: 'JSON file at /output/result.json',
  },
]

export function createPocGenerationRequest(input: {
  detail: FindingDetail
  evidence: Record<string, unknown>
}): PocGenerationRequest {
  const vulnClass = input.detail.vulnerability.toLowerCase().replace(/\s+/g, '_')
  const template = TEMPLATES.find(t => t.vulnerabilityClass === vulnClass) ?? {
    id: 'generic',
    vulnerabilityClass: vulnClass,
    language: 'python' as PocLanguage,
    image: 'python:3.12-slim',
    requiresNetwork: false,
    generationPrompt: 'Generate a PoC script for this vulnerability. This is an unsupported vulnerability class - manual review required.',
    resultProtocol: 'JSON file at /output/result.json',
  }

  const context = {
    findingId: input.detail.id,
    package: input.detail.package,
    vulnerability: input.detail.vulnerability,
    source: input.evidence['evidence.source'] ?? 'unknown',
    sink: input.evidence['evidence.sink'] ?? 'unknown',
    guard: input.evidence['evidence.guard'] ?? 'unknown',
  }

  return {
    templateId: template.id,
    language: template.language,
    recommendedImage: template.image,
    requiresNetwork: template.requiresNetwork,
    context,
    generationPrompt: template.generationPrompt,
    resultProtocol: template.resultProtocol,
    safetyConstraints: {
      allowHostNetwork: false,
      allowPrivileged: false,
      allowDockerSocket: false,
      maxScriptBytes: 128 * 1024,
      maxOutputBytes: 64 * 1024,
    },
  }
}
