import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DedupService, type DedupCandidate } from '../src/dedup.js'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('DedupService', () => {
  it('ranks local overlaps and lets a reviewer confirm a match', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-omv-dedup-'))
    roots.push(root)
    const service = new DedupService(root)
    const candidates: DedupCandidate[] = [
      { id: 'finding-a', package: 'same-package', ecosystem: 'npm', vulnerability: 'ssrf', path: 'a.yaml' },
      { id: 'finding-b', package: 'same-package', ecosystem: 'npm', vulnerability: 'ssrf', path: 'b.yaml' },
      { id: 'finding-c', package: 'other-package', ecosystem: 'python', vulnerability: 'xss', path: 'c.yaml' },
    ]
    const summary = await service.scan('finding-a', candidates)
    expect(summary.status).toBe('possible_duplicate')
    expect(summary.matches[0]).toMatchObject({ targetFindingId: 'finding-b', source: 'local', status: 'open' })
    const confirmed = await service.update('finding-a', 'duplicate', summary.matches[0]!.id)
    expect(confirmed).toMatchObject({ status: 'duplicate', matches: [{ status: 'confirmed' }] })
  })

  it('keeps same-package findings with distinct vulnerability classes out of possible_duplicate', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-omv-dedup-lanes-'))
    roots.push(root)
    const service = new DedupService(root)
    const summary = await service.scan('finding-a', [
      { id: 'finding-a', package: 'same-package', ecosystem: 'npm', vulnerability: 'ssrf', path: 'a.yaml' },
      { id: 'finding-b', package: 'same-package', ecosystem: 'npm', vulnerability: 'path-traversal', path: 'b.yaml' },
    ])
    // Same package alone is related work, not a duplicate claim.
    expect(summary.status).toBe('clear')
    expect(summary.matches.some(match => match.targetFindingId === 'finding-b')).toBe(true)
    expect(summary.matches.every(match => !match.reasons.includes('漏洞类型词项重合'))).toBe(true)
  })

  it('records a clear result when no meaningful overlap exists', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-omv-dedup-clear-'))
    roots.push(root)
    const service = new DedupService(root)
    const summary = await service.scan('finding-a', [
      { id: 'finding-a', package: 'alpha', ecosystem: 'npm', vulnerability: 'ssrf', path: 'a.yaml' },
      { id: 'finding-b', package: 'beta', ecosystem: 'python', vulnerability: 'xss', path: 'b.yaml' },
    ])
    expect(summary).toMatchObject({ status: 'clear', matches: [] })
  })
})
