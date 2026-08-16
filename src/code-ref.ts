/** A local source location projected from Evidence prose. Not a second source of truth. */
export interface CodeRef {
  path: string
  line?: number
  endLine?: number
  note: string
}

const UNKNOWN = new Set(['', 'unknown', 'none', 'n/a', 'na', 'null', 'undefined'])
const FILE_REF = /(?:^|[\s('"[{])((?:[A-Za-z]:)?(?:\.{1,2}[\\/])?(?:[\w.@+-]+[\\/])*[\w.@+-]+\.[A-Za-z][A-Za-z0-9]*)(?::(\d+)(?:-(\d+)|:(\d+))?)?(?:#L(\d+)(?:-L?(\d+))?)?/

/** Extract the first workspace file:line mention from an Evidence field. */
export function parseCodeRef(value: unknown): CodeRef | undefined {
  if (value === null || value === undefined) return undefined
  if (isRecord(value)) {
    const path = stringField(value, 'path') ?? stringField(value, 'file') ?? stringField(value, 'locator')
    if (path === undefined || !looksLikePath(path)) return undefined
    const line = integerField(value, 'line') ?? integerField(value, 'startLine')
    const endLine = integerField(value, 'endLine') ?? integerField(value, 'end_line')
    const note = stringField(value, 'note') ?? stringField(value, 'detail') ?? ''
    return { path: normalizePath(path), ...(line === undefined ? {} : { line }), ...(endLine === undefined ? {} : { endLine }), note }
  }
  const text = typeof value === 'string' ? value.trim() : Array.isArray(value) ? value.filter(item => typeof item === 'string').join(' ') : ''
  if (UNKNOWN.has(text.toLowerCase()) || /^https?:\/\//iu.test(text)) return undefined
  const match = FILE_REF.exec(` ${text}`)
  if (match?.[1] === undefined || !looksLikePath(match[1])) return undefined
  const line = parseLine(match[2] ?? match[5])
  const endLine = parseLine(match[3] ?? match[6])
  const note = text.replace(match[1], '').replace(/^[:#L\d\s-]+/u, '').trim()
  return {
    path: normalizePath(match[1]),
    ...(line === undefined ? {} : { line }),
    ...(endLine === undefined ? {} : { endLine }),
    note,
  }
}

export function resolveCodeRef(projectRoot: string, ref: CodeRef): string {
  if (isAbsolutePath(ref.path)) return ref.path
  const root = projectRoot.replace(/[\\/]+$/u, '')
  return `${root}/${ref.path.replace(/^[\\/]+/u, '')}`
}

export function formatCodeRef(ref: CodeRef): string {
  if (ref.line === undefined) return ref.path
  if (ref.endLine === undefined || ref.endLine === ref.line) return `${ref.path}:${ref.line}`
  return `${ref.path}:${ref.line}-${ref.endLine}`
}

function looksLikePath(value: string): boolean {
  if (UNKNOWN.has(value.toLowerCase()) || value.includes('://')) return false
  return /(?:^|[\\/])[\w.@+-]+\.[A-Za-z][A-Za-z0-9]*$/u.test(value) && !value.includes('..\\..\\..')
}

function normalizePath(value: string): string {
  return value.replaceAll('\\', '/')
}

function isAbsolutePath(value: string): boolean {
  return value.startsWith('/') || /^[A-Za-z]:\//u.test(value)
}

function parseLine(value: string | undefined): number | undefined {
  if (value === undefined) return undefined
  const line = Number(value)
  return Number.isInteger(line) && line > 0 ? line : undefined
}

function integerField(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key]
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : parseLine(typeof value === 'string' ? value : undefined)
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
