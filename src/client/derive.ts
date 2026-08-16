import type { CampaignRun } from '../contracts.js'

/**
 * Pure client-side derivations. Kept free of React so they can be unit tested
 * in plain node (the client has no DOM test harness).
 */

/** Evidence.v1 dedup search flags, in methodology order: advisory databases then public discussion. */
export const DEDUP_SOURCES = [
  { key: 'nvd_searched', label: 'NVD', group: 'advisory' },
  { key: 'ghsa_searched', label: 'GHSA', group: 'advisory' },
  { key: 'ecosystem_db_searched', label: '生态库', group: 'advisory' },
  { key: 'issues_searched', label: 'Issues / PRs', group: 'discussion' },
  { key: 'commits_searched', label: 'Commits', group: 'discussion' },
  { key: 'blogs_searched', label: 'Web / 博客', group: 'discussion' },
] as const

export interface DedupSourceState {
  key: string
  label: string
  group: 'advisory' | 'discussion'
  searched: boolean
}

export function valueAtPath(root: Record<string, unknown> | undefined, path: string): unknown {
  let current: unknown = root
  for (const part of path.split('.')) {
    if (current === null || current === undefined || typeof current !== 'object' || Array.isArray(current)) return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

/** Read the six Evidence.v1 dedup booleans; unreported older findings read as not-searched. */
export function dedupSources(evidence: Record<string, unknown> | undefined): DedupSourceState[] {
  return DEDUP_SOURCES.map(source => ({
    ...source,
    searched: valueAtPath(evidence, `dedup.${source.key}`) === true,
  }))
}

/** All advisory + discussion sources searched — the contract's novelty precondition. */
export function dedupComplete(evidence: Record<string, unknown> | undefined): boolean {
  return dedupSources(evidence).every(source => source.searched)
}

export function dedupExistingCve(evidence: Record<string, unknown> | undefined): string {
  const value = valueAtPath(evidence, 'dedup.existing_cve')
  if (value === undefined || value === null || value === '') return 'unknown'
  return String(value)
}

/** Finding ids become file names and CLI args; keep them to registry-style slugs. */
export function findingIdError(id: string): string | undefined {
  const value = id.trim()
  if (value === '') return '需要填写发现 ID'
  if (value !== id) return 'ID 首尾不能有空格'
  if (!/^[a-z0-9][a-z0-9-]*$/u.test(value)) return '仅小写字母、数字与连字符，例如 npm-package-ssrf'
  if (value.length > 80) return 'ID 过长（≤80 字符）'
  return undefined
}

const INTERACTIVE_SELECTOR = 'button, a, input, select, textarea, summary, [contenteditable], [role="button"], [role="option"], [role="tab"]'

/**
 * Letter shortcuts (r, /) must not fire while the user is focused on an
 * interactive element — otherwise pressing r on a focused button refreshes the
 * workspace mid-click. Digit shortcuts (1-9, 0) are safe everywhere.
 */
export function shouldHandleShortcut(target: EventTarget | null, key: string): boolean {
  if (typeof key === 'string' && /^[0-9]$/u.test(key)) return true
  if (target === null || typeof (target as Element).closest !== 'function') return true
  return (target as Element).closest(INTERACTIVE_SELECTOR) === null
}

/** A run needs a lane pump while any lane is still queued. Terminal runs never do. */
export function runNeedsPump(run: CampaignRun | undefined): boolean {
  if (run === undefined) return false
  if (run.status !== 'running' && run.status !== 'queued' && run.status !== 'paused') return false
  return run.lanes.some(lane => lane.status === 'queued')
}

/** Watch a run for reconciliation while it can still make progress. */
export function runActive(run: Pick<CampaignRun, 'status'>): boolean {
  return run.status === 'running' || run.status === 'queued' || run.status === 'paused'
}
