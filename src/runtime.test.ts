import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { inspectDshRuntime } from './runtime.js'

describe('Cordis runtime diagnostics', () => {
  it('uses the public registry and root fiber surfaces', () => {
    const snapshot = inspectDshRuntime(new Context())
    expect(snapshot.currentFiber.state).toBe('ACTIVE')
    expect(snapshot.pending).toBe(0)
    expect(snapshot.failed).toBe(0)
    expect(snapshot.runtimes).toEqual([])
  })
})
