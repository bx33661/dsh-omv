import { watch, type FSWatcher } from 'node:fs'
import { relative, resolve } from 'node:path'
import type { WorkspaceChangeEvent } from './contracts.js'

type Listener = (event: WorkspaceChangeEvent) => void

/** Lazy, reference-counted watcher used by the HTTP event stream. */
export class OmvWorkspaceWatcher {
  private readonly listeners = new Set<Listener>()
  private readonly paths = new Set<string>()
  private watcher: FSWatcher | undefined
  private timer: NodeJS.Timeout | undefined
  private revision = 0

  constructor(private readonly projectRoot: string, private readonly debounceMs: number) {}

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    this.ensureWatching()
    return () => {
      this.listeners.delete(listener)
      if (this.listeners.size === 0) this.close()
    }
  }

  close(): void {
    this.watcher?.close()
    this.watcher = undefined
    if (this.timer !== undefined) clearTimeout(this.timer)
    this.timer = undefined
    this.paths.clear()
  }

  private ensureWatching(): void {
    if (this.watcher !== undefined) return
    this.watcher = watch(this.projectRoot, { recursive: true }, (_event, filename) => {
      if (filename === null) return
      const path = filename.toString().replaceAll('\\', '/')
      if (path !== '.omv' && !path.startsWith('.omv/')) return
      this.paths.add(path)
      this.schedule()
    })
    this.watcher.on('error', () => {
      // A later subscriber retries after close; polling remains the client fallback.
      this.close()
    })
  }

  private schedule(): void {
    if (this.timer !== undefined) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = undefined
      const paths = [...this.paths].sort()
      this.paths.clear()
      if (paths.length === 0) return
      const event: WorkspaceChangeEvent = {
        revision: ++this.revision,
        generatedAt: new Date().toISOString(),
        projectRoot: resolve(this.projectRoot),
        paths: paths.map(path => relative(this.projectRoot, resolve(this.projectRoot, path)).replaceAll('\\', '/')),
      }
      for (const listener of this.listeners) {
        try { listener(event) } catch { /* isolate browser stream listeners */ }
      }
    }, this.debounceMs)
    this.timer.unref()
  }
}
