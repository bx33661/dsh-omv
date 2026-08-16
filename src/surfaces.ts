import { createRequire } from 'node:module'
import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { stringify as stringifyYaml } from 'yaml'
import type { CampaignLane } from 'oh-my-vul'
import type { AttackSurfaceCardView, CampaignSurfaces, SurfaceCardStatus } from './contracts.js'

interface UpstreamCard {
  id: string
  title: string
  pack: string
  vulnerability_class: string
  status: SurfaceCardStatus
  finding_id: string
  sources: string[]
  sinks: string[]
  guards: string[]
  discovery_hints: string[]
  false_positive_checks: string[]
  why: string
}

interface UpstreamList {
  schema_version: '1'
  campaign_id: string
  generated_at: string
  updated_at: string
  catalog_version: string
  cards: UpstreamCard[]
}

interface UpstreamSurfaces {
  proposeSurfaces(id: string, projectRoot?: string, options?: { force?: boolean }): Promise<{
    campaignId: string
    path: string
    list: UpstreamList
    created: boolean
    overwritten: boolean
    nextAction: string
  }>
  showSurfaces(id: string, projectRoot?: string): Promise<{
    campaignId: string
    path: string
    list: UpstreamList | null
    nextAction: string
  }>
}

let cached: Promise<UpstreamSurfaces> | undefined

function loadSurfaces(): Promise<UpstreamSurfaces> {
  cached ??= (async () => {
    const require = createRequire(import.meta.url)
    const root = dirname(require.resolve('oh-my-vul/package.json'))
    return import(pathToFileURL(join(root, 'dist/cli/surfaces.js')).href) as Promise<UpstreamSurfaces>
  })()
  return cached
}

/** Propose AttackSurfaceList.v1 cards from the shared oh-my-vul catalog. */
export async function proposeCampaignSurfaces(id: string, projectRoot: string, force = false): Promise<CampaignSurfaces> {
  const result = await (await loadSurfaces()).proposeSurfaces(id, projectRoot, { force })
  return projectSurfaces(result)
}

/** Read the campaign sidecar. A missing file is an empty projection, not an error. */
export async function showCampaignSurfaces(id: string, projectRoot: string): Promise<CampaignSurfaces> {
  try {
    return projectSurfaces(await (await loadSurfaces()).showSurfaces(id, projectRoot))
  } catch (error) {
    return {
      path: `.omv/campaigns/${id}.surfaces.yaml`,
      cards: [],
      proposed: 0,
      selected: 0,
      skipped: 0,
      nextAction: `修复 ${id} 的 AttackSurfaceList YAML 后重新提出攻击面`,
      issue: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Incrementally mark cards selected or skipped. Unlike CLI `select --cards`,
 * unspecified cards keep their current status so a hypothesis can die cheaply.
 */
export async function updateCampaignSurfaceCards(
  id: string,
  projectRoot: string,
  updates: ReadonlyArray<{ cardId: string; status: SurfaceCardStatus }>,
): Promise<CampaignSurfaces> {
  if (updates.length === 0) throw new Error('at least one surface card id is required')
  const current = await (await loadSurfaces()).showSurfaces(id, projectRoot)
  if (current.list === null) {
    throw new Error(`${current.path} does not exist; propose attack-surface cards first`)
  }
  const known = new Set(current.list.cards.map(card => card.id))
  for (const update of updates) {
    if (!known.has(update.cardId)) throw new Error(`unknown surface card id: ${update.cardId}`)
  }
  const byId = new Map(updates.map(update => [update.cardId, update.status]))
  const next: UpstreamList = {
    ...current.list,
    updated_at: new Date().toISOString(),
    cards: current.list.cards.map(card => {
      const status = byId.get(card.id)
      return status === undefined ? card : { ...card, status }
    }),
  }
  await writeFile(current.path, stringifyYaml(next), 'utf8')
  const selected = next.cards.filter(card => card.status === 'selected').map(card => card.id)
  return projectSurfaces({
    path: current.path,
    list: next,
    nextAction: selected.length > 0
      ? `omv campaign seed ${id}`
      : `omv campaign surfaces select ${id} --cards <id,id>`,
  })
}

/** Runner/seed lanes come from selected cards once a surfaces file exists. */
export function runLanesFromSurfaces(lanes: readonly CampaignLane[], surfaces: CampaignSurfaces): CampaignLane[] {
  if (surfaces.cards.length === 0) return [...lanes]
  if (surfaces.selected === 0) {
    throw new Error(`${surfaces.path || 'AttackSurfaceList'} has no selected cards; select at least one attack-surface card first`)
  }
  return surfaces.cards.filter(card => card.status === 'selected').map(card => ({
    id: card.id,
    title: card.title,
    vulnerability_class: card.vulnerabilityClass,
    finding_id: card.findingId,
  }))
}

function projectSurfaces(input: { path: string; list: UpstreamList | null; nextAction: string }): CampaignSurfaces {
  const cards = (input.list?.cards ?? []).map(toCardView)
  return {
    path: input.path,
    ...(input.list === undefined || input.list === null ? {} : {
      generatedAt: input.list.generated_at,
      updatedAt: input.list.updated_at,
      catalogVersion: input.list.catalog_version,
    }),
    cards,
    proposed: cards.filter(card => card.status === 'proposed').length,
    selected: cards.filter(card => card.status === 'selected').length,
    skipped: cards.filter(card => card.status === 'skipped').length,
    nextAction: input.nextAction,
  }
}

function toCardView(card: UpstreamCard): AttackSurfaceCardView {
  return {
    id: card.id,
    title: card.title,
    pack: card.pack,
    vulnerabilityClass: card.vulnerability_class,
    status: card.status,
    findingId: card.finding_id,
    sources: card.sources,
    sinks: card.sinks,
    guards: card.guards,
    discoveryHints: card.discovery_hints,
    falsePositiveChecks: card.false_positive_checks,
    why: card.why,
  }
}
