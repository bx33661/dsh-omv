import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CollaborationService } from '../src/collaboration.js'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('CollaborationService', () => {
  it('persists review status, assignees, notes, and note resolution', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-omv-review-'))
    roots.push(root)
    const service = new CollaborationService(root)
    expect(await service.get('finding-a')).toMatchObject({ findingId: 'finding-a', status: 'unreviewed', notes: [] })
    const updated = await service.update({ findingId: 'finding-a', status: 'in_review', assignee: 'reviewer-a', reviewer: 'session-1' })
    expect(updated).toMatchObject({ findingId: 'finding-a', status: 'in_review', assignee: 'reviewer-a', reviewers: ['session-1'] })
    const withNote = await service.addNote({ findingId: 'finding-a', author: 'reviewer-a', body: '请补充运行时观测。' })
    expect(withNote.notes).toHaveLength(1)
    expect(withNote.status).toBe('in_review')
    const noteId = withNote.notes[0]!.id
    const resolved = await service.resolveNote('finding-a', noteId)
    expect(resolved.notes[0]?.resolvedAt).toEqual(expect.any(String))
    const persisted = JSON.parse(await readFile(join(root, '.omv', '.dsh', 'reviews.json'), 'utf8')) as { records: Record<string, { notes: unknown[] }> }
    expect(persisted.records['finding-a']?.notes).toHaveLength(1)
  })
})
