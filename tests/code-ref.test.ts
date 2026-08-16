import { describe, expect, it } from 'vitest'
import { formatCodeRef, parseCodeRef, resolveCodeRef } from '../src/code-ref.js'

describe('parseCodeRef', () => {
  it('reads the common Evidence.v1 prose form', () => {
    expect(parseCodeRef('src/input.ts:10 request URL')).toEqual({
      path: 'src/input.ts',
      line: 10,
      note: 'request URL',
    })
  })

  it('accepts hash and range locators', () => {
    expect(parseCodeRef('lib/render.js#L18-L24 sanitizer bypass')).toMatchObject({ path: 'lib/render.js', line: 18, endLine: 24, note: 'sanitizer bypass' })
    expect(parseCodeRef('pkg/path.py:20-22')).toMatchObject({ path: 'pkg/path.py', line: 20, endLine: 22 })
  })

  it('reads structured fields and ignores unknown placeholders', () => {
    expect(parseCodeRef({ path: 'src/check.ts', line: 20, note: 'incomplete allowlist' })).toEqual({
      path: 'src/check.ts',
      line: 20,
      note: 'incomplete allowlist',
    })
    expect(parseCodeRef('unknown')).toBeUndefined()
    expect(parseCodeRef('none')).toBeUndefined()
    expect(parseCodeRef('https://example.com/app.js:12')).toBeUndefined()
    expect(parseCodeRef('request reached local fixture')).toBeUndefined()
  })

  it('resolves relative paths against the workspace root', () => {
    expect(resolveCodeRef('/tmp/repo', { path: 'src/a.ts', note: '' })).toBe('/tmp/repo/src/a.ts')
    expect(formatCodeRef({ path: 'src/a.ts', line: 4, endLine: 8, note: '' })).toBe('src/a.ts:4-8')
  })
})
