import type { Context } from '@deepseek-ai/cordis'

export interface DshRuntimeFiber {
  uid: number | null
  name: string
  state: DshRuntimeState
  dependencies: string[]
}

export interface DshRuntimeEntry {
  name: string
  fibers: DshRuntimeFiber[]
}

export type DshRuntimeState = 'PENDING' | 'LOADING' | 'ACTIVE' | 'FAILED' | 'DISPOSED' | 'UNLOADING' | `UNKNOWN(${number})`

export interface DshRuntimeSnapshot {
  currentFiber: DshRuntimeFiber
  runtimes: DshRuntimeEntry[]
  pending: number
  failed: number
}

/** Read-only Cordis lifecycle diagnostics for missing-service and HMR issues. */
export function inspectDshRuntime(ctx: Context): DshRuntimeSnapshot {
  const runtimes = [...ctx.registry.values()].map(runtime => ({
    name: runtime.name ?? (runtime.callback.name || '(anonymous)'),
    fibers: [...runtime.fibers].map(fiber => ({
      uid: fiber.uid,
      name: fiber.name,
      state: stateName(fiber.state),
      dependencies: Object.keys(fiber.inject),
    })),
  }))
  const currentFiber = {
    uid: ctx.fiber.uid,
    name: ctx.fiber.name,
    state: stateName(ctx.fiber.state),
    dependencies: Object.keys(ctx.fiber.inject),
  }
  const fibers = runtimes.flatMap(runtime => runtime.fibers)
  return {
    currentFiber,
    runtimes,
    pending: fibers.filter(fiber => fiber.state === 'PENDING').length,
    failed: fibers.filter(fiber => fiber.state === 'FAILED').length,
  }
}

function stateName(value: number): DshRuntimeState {
  if (value === 0) return 'PENDING'
  if (value === 1) return 'LOADING'
  if (value === 2) return 'ACTIVE'
  if (value === 3) return 'FAILED'
  if (value === 4) return 'DISPOSED'
  if (value === 5) return 'UNLOADING'
  return `UNKNOWN(${value})`
}
