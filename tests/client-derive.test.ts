import { describe, expect, it } from 'vitest'
import {
  dedupComplete,
  dedupExistingCve,
  dedupSources,
  findingIdError,
  runActive,
  runNeedsPump,
  shouldHandleShortcut,
} from '../src/client/derive.js'
import type { CampaignRun } from '../src/contracts.js'

const sixSourceEvidence = {
  dedup: {
    nvd_searched: true,
    ghsa_searched: true,
    ecosystem_db_searched: true,
    issues_searched: true,
    commits_searched: true,
    blogs_searched: true,
    existing_cve: 'none',
  },
}

describe('six-source dedup derivation', () => {
  it('reads the six Evidence.v1 dedup flags in methodology order', () => {
    const sources = dedupSources(sixSourceEvidence)
    expect(sources.map(source => source.key)).toEqual([
      'nvd_searched', 'ghsa_searched', 'ecosystem_db_searched',
      'issues_searched', 'commits_searched', 'blogs_searched',
    ])
    expect(sources.every(source => source.searched)).toBe(true)
    expect(sources.filter(source => source.group === 'discussion')).toHaveLength(3)
  })

  it('treats legacy three-source findings and missing dedup blocks as incomplete', () => {
    const legacy = { dedup: { nvd_searched: true, ghsa_searched: true, ecosystem_db_searched: true } }
    expect(dedupComplete(legacy)).toBe(false)
    expect(dedupComplete(undefined)).toBe(false)
    expect(dedupSources(undefined).every(source => !source.searched)).toBe(true)
  })

  it('marks discussion sources missing while advisory sources pass', () => {
    const partial = {
      dedup: {
        nvd_searched: true, ghsa_searched: true, ecosystem_db_searched: true,
        issues_searched: false, commits_searched: false, blogs_searched: false,
      },
    }
    const sources = dedupSources(partial)
    expect(sources.filter(source => source.group === 'advisory').every(source => source.searched)).toBe(true)
    expect(sources.filter(source => source.group === 'discussion').every(source => !source.searched)).toBe(true)
    expect(dedupComplete(partial)).toBe(false)
  })

  it('reports the recorded existing CVE or falls back to unknown', () => {
    expect(dedupExistingCve(sixSourceEvidence)).toBe('none')
    expect(dedupExistingCve({ dedup: { existing_cve: 'CVE-2025-1234' } })).toBe('CVE-2025-1234')
    expect(dedupExistingCve(undefined)).toBe('unknown')
    expect(dedupExistingCve({ dedup: {} })).toBe('unknown')
  })
})

describe('finding id validation', () => {
  it('accepts registry-style slugs', () => {
    expect(findingIdError('npm-package-ssrf')).toBeUndefined()
    expect(findingIdError('a')).toBeUndefined()
    expect(findingIdError('lib2-path-traversal-2')).toBeUndefined()
  })

  it('rejects empty, padded, and non-slug ids', () => {
    expect(findingIdError('')).toBeDefined()
    expect(findingIdError('  spaced  ')).toBeDefined()
    expect(findingIdError('Upper-Case')).toBeDefined()
    expect(findingIdError('under_score')).toBeDefined()
    expect(findingIdError('-leading')).toBeDefined()
    expect(findingIdError('a'.repeat(81))).toBeDefined()
  })
})

describe('shortcut guard', () => {
  const buttonLike = { closest: (selector: string) => (selector.includes('button') ? {} : null) }
  const plain = { closest: () => null }

  it('allows digit shortcuts on interactive elements', () => {
    expect(shouldHandleShortcut(buttonLike as unknown as EventTarget, '3')).toBe(true)
  })

  it('blocks letter shortcuts on interactive elements', () => {
    expect(shouldHandleShortcut(buttonLike as unknown as EventTarget, 'r')).toBe(false)
    expect(shouldHandleShortcut(buttonLike as unknown as EventTarget, '/')).toBe(false)
  })

  it('allows letter shortcuts on plain targets and non-element targets', () => {
    expect(shouldHandleShortcut(plain as unknown as EventTarget, 'r')).toBe(true)
    expect(shouldHandleShortcut(null, '/')).toBe(true)
  })
})

describe('campaign pump predicates', () => {
  const run = (status: CampaignRun['status'], laneStatus: string): CampaignRun => ({
    schemaVersion: 1,
    id: 'run-1',
    campaignId: 'camp-1',
    parentSessionId: 's',
    status,
    concurrency: 3,
    createdAt: '2026-08-16T00:00:00Z',
    updatedAt: '2026-08-16T00:00:00Z',
    lanes: [{ laneId: 'lane-1', status: laneStatus } as CampaignRun['lanes'][number]],
  })

  it('pumps only active runs with queued lanes', () => {
    expect(runNeedsPump(run('running', 'queued'))).toBe(true)
    expect(runNeedsPump(run('running', 'completed'))).toBe(false)
    expect(runNeedsPump(run('cancelled', 'queued'))).toBe(false)
    expect(runNeedsPump(undefined)).toBe(false)
  })

  it('watches queued, running, and paused runs only', () => {
    expect(runActive({ status: 'queued' })).toBe(true)
    expect(runActive({ status: 'running' })).toBe(true)
    expect(runActive({ status: 'paused' })).toBe(true)
    expect(runActive({ status: 'completed' })).toBe(false)
    expect(runActive({ status: 'failed' })).toBe(false)
  })
})
