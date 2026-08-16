import { Service, type Context } from '@deepseek-ai/cordis'
import { resolve } from 'node:path'
import type { OmvWorkbenchConfig } from './contracts.js'
import { OmvWorkbench } from './workbench.js'

/** Native Cordis service for the OMV capability set. */
export class OmvService extends Service {
  readonly config: OmvWorkbenchConfig
  readonly workbench: OmvWorkbench
  private readonly workbenches = new Map<string, OmvWorkbench>()

  constructor(ctx: Context, config: OmvWorkbenchConfig) {
    super(ctx, 'omv')
    this.workbench = new OmvWorkbench(config)
    this.config = this.workbench.config
    this.workbenches.set(this.config.projectRoot, this.workbench)
  }

  /** Resolve a workspace-scoped OMV facade under the same plugin lifecycle. */
  scoped(projectRoot: string): OmvWorkbench {
    const root = resolve(projectRoot)
    const existing = this.workbenches.get(root)
    if (existing !== undefined) return existing
    const workbench = this.workbench.scoped(root)
    this.workbenches.set(root, workbench)
    return workbench
  }

  close(): void {
    for (const workbench of this.workbenches.values()) workbench.close()
    this.workbenches.clear()
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Evidence-first OMV workbench service. */
    omv: OmvService
  }
}
