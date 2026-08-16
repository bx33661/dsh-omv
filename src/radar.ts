import { randomUUID } from 'node:crypto'
import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { join } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { WORKBENCH_PROTOCOL_VERSION, type RadarEvent, type RadarPayload, type RadarQueueItem, type RadarQueueStatus, type RadarWatchEntry } from './contracts.js'

export async function readRadar(projectRoot: string): Promise<RadarPayload> {
  const watchlistPath = join(projectRoot, '.omv', 'radar', 'watchlist.yaml')
  const eventsPath = join(projectRoot, '.omv', 'radar', 'events.jsonl')
  const watchText = await optionalRead(watchlistPath)
  const eventsText = await optionalRead(eventsPath)
  const queue = await readQueue(projectRoot)
  return {
    protocolVersion: WORKBENCH_PROTOCOL_VERSION,
    generatedAt: new Date().toISOString(),
    watchlistPath,
    eventsPath,
    watchlistExists: watchText !== undefined,
    watch: watchText === undefined ? [] : parseWatchlist(watchText),
    events: eventsText === undefined ? [] : parseEvents(eventsText).slice(-200).reverse(),
    queue,
  }
}

/** Append a deterministic local snapshot; deeper passive research is delegated to the DSH Agent workflow. */
export async function refreshRadar(projectRoot: string): Promise<RadarPayload> {
  const radar = await readRadar(projectRoot)
  if (!radar.watchlistExists) throw new Error(`${radar.watchlistPath} does not exist; create a watchlist before refreshing radar`)
  if (radar.watch.length === 0) throw new Error(`${radar.watchlistPath} must contain at least one watch entry`)
  const observedAt = new Date().toISOString()
  const events = radar.watch.map((entry, index): RadarEvent => {
    const subject = entry.package ?? entry.keyword ?? entry.vulnerability ?? 'watch entry'
    return {
      id: `watchlist-${Date.parse(observedAt)}-${index + 1}`,
      observedAt,
      source: 'watchlist',
      ecosystem: entry.ecosystem,
      ...(entry.package === undefined ? {} : { package: entry.package }),
      ...(entry.keyword === undefined ? {} : { keyword: entry.keyword }),
      type: 'watchlist',
      title: `Watchlist snapshot for ${entry.ecosystem}:${subject}`,
    }
  })
  await mkdir(join(projectRoot, '.omv', 'radar'), { recursive: true })
  await appendFile(radar.eventsPath, `${events.map(event => JSON.stringify(event)).join('\n')}\n`, 'utf8')
  await mergeQueue(projectRoot, events)
  return readRadar(projectRoot)
}

export async function updateRadarQueue(
  projectRoot: string,
  id: string,
  status: RadarQueueStatus,
  findingId?: string,
): Promise<RadarQueueItem> {
  const store = await readQueueStore(projectRoot)
  const item = store.items[id]
  if (item === undefined) throw new Error(`radar queue item not found: ${id}`)
  item.status = status
  item.updatedAt = new Date().toISOString()
  if (findingId !== undefined) item.findingId = findingId
  await writeQueueStore(projectRoot, store)
  return item
}

export async function radarQueueItem(projectRoot: string, id: string): Promise<RadarQueueItem> {
  const item = (await readQueueStore(projectRoot)).items[id]
  if (item === undefined) throw new Error(`radar queue item not found: ${id}`)
  return item
}

function parseWatchlist(text: string): RadarWatchEntry[] {
  const parsed = parseYaml(text) as unknown
  const values = isRecord(parsed) && Array.isArray(parsed.watch) ? parsed.watch : Array.isArray(parsed) ? parsed : []
  return values.filter(isRecord).map(value => ({
    ecosystem: stringValue(value.ecosystem) ?? 'unknown',
    ...(stringValue(value.package) === undefined ? {} : { package: stringValue(value.package)! }),
    ...(stringValue(value.keyword) === undefined ? {} : { keyword: stringValue(value.keyword)! }),
    ...(stringValue(value.vulnerability) === undefined ? {} : { vulnerability: stringValue(value.vulnerability)! }),
  }))
}

function parseEvents(text: string): RadarEvent[] {
  const events: RadarEvent[] = []
  for (const line of text.split(/\r?\n/u)) {
    if (line.trim() === '') continue
    try {
      const value = JSON.parse(line) as unknown
      if (!isRecord(value)) continue
      events.push({
        id: stringValue(value.id) ?? '',
        observedAt: stringValue(value.observedAt) ?? '',
        source: stringValue(value.source) ?? 'unknown',
        ecosystem: stringValue(value.ecosystem) ?? 'unknown',
        ...(stringValue(value.package) === undefined ? {} : { package: stringValue(value.package)! }),
        ...(stringValue(value.keyword) === undefined ? {} : { keyword: stringValue(value.keyword)! }),
        type: stringValue(value.type) ?? 'watchlist',
        title: stringValue(value.title) ?? 'untitled radar event',
        ...(stringValue(value.url) === undefined ? {} : { url: stringValue(value.url)! }),
        ...(stringValue(value.severity) === undefined ? {} : { severity: stringValue(value.severity)! }),
        ...(stringValue(value.publishedAt) === undefined ? {} : { publishedAt: stringValue(value.publishedAt)! }),
      })
    } catch {
      // Ignore malformed manually edited JSONL rows.
    }
  }
  return events
}

async function optionalRead(path: string): Promise<string | undefined> {
  try { return await readFile(path, 'utf8') } catch (error) {
    if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
}

interface RadarQueueStore {
  schemaVersion: 1
  updatedAt: string
  items: Record<string, RadarQueueItem>
}

async function readQueue(projectRoot: string): Promise<RadarQueueItem[]> {
  return Object.values((await readQueueStore(projectRoot)).items).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

async function mergeQueue(projectRoot: string, events: readonly RadarEvent[]): Promise<void> {
  const store = await readQueueStore(projectRoot)
  const now = new Date().toISOString()
  const existingEventIds = new Set(Object.values(store.items).map(item => item.eventId))
  for (const event of events) {
    if (existingEventIds.has(event.id)) continue
    const score = radarScore(event)
    const item: RadarQueueItem = {
      id: `radar-${randomUUID().slice(0, 10)}`,
      eventId: event.id,
      status: 'new',
      score,
      reason: score >= 70 ? 'Security advisory or high-severity signal deserves immediate audit' : score >= 50 ? 'Package change intersects a watched vulnerability class' : 'Watchlist signal requires triage',
      createdAt: now,
      updatedAt: now,
    }
    store.items[item.id] = item
  }
  store.updatedAt = now
  await writeQueueStore(projectRoot, store)
}

async function readQueueStore(projectRoot: string): Promise<RadarQueueStore> {
  const path = queuePath(projectRoot)
  try {
    const value = JSON.parse(await readFile(path, 'utf8')) as unknown
    if (!isRecord(value) || value.schemaVersion !== 1 || !isRecord(value.items)) throw new Error(`invalid Radar queue store: ${path}`)
    return value as unknown as RadarQueueStore
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT')) throw error
    return { schemaVersion: 1, updatedAt: new Date(0).toISOString(), items: {} }
  }
}

async function writeQueueStore(projectRoot: string, store: RadarQueueStore): Promise<void> {
  const path = queuePath(projectRoot)
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.${randomUUID()}.tmp`
  await writeFile(temporary, `${JSON.stringify(store, null, 2)}\n`, 'utf8')
  await rename(temporary, path)
}

function queuePath(projectRoot: string): string { return join(projectRoot, '.omv', '.dsh', 'radar-queue.json') }

function radarScore(event: RadarEvent): number {
  const type = event.type.toLowerCase()
  const severity = event.severity?.toLowerCase()
  if (severity === 'critical' || type.includes('advisory')) return 90
  if (severity === 'high' || type.includes('security') || type.includes('suspected-fix')) return 75
  if (event.url !== undefined || event.title.toLowerCase().includes('vulnerab')) return 55
  return 35
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
