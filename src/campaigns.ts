import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  CAMPAIGN_ECOSYSTEMS,
  showCampaign,
  validateCampaign,
  type Campaign,
  type CampaignEcosystem,
  type CampaignSummary,
} from 'oh-my-vul'
import { parse as parseYaml, parseDocument } from 'yaml'
import type { CampaignIssue } from './contracts.js'

const ECOSYSTEM_ALIASES: Readonly<Record<string, CampaignEcosystem>> = {
  gem: 'ruby',
  gems: 'ruby',
  rubygem: 'ruby',
  rubygems: 'ruby',
  pip: 'python',
  pypi: 'python',
  cargo: 'rust',
  crate: 'rust',
  crates: 'rust',
  'crates.io': 'rust',
  golang: 'go',
  gomod: 'go',
  maven: 'java',
  gradle: 'java',
  composer: 'php',
  packagist: 'php',
  nuget: 'csharp',
  dotnet: 'csharp',
  'c#': 'csharp',
  pub: 'dart',
  hex: 'elixir',
  cpan: 'perl',
  cran: 'r',
  luarocks: 'lua',
  swiftpm: 'swift',
  spm: 'swift',
}

const CANONICAL_ECOSYSTEMS = new Set<string>(CAMPAIGN_ECOSYSTEMS)

export interface CampaignInspection {
  campaigns: CampaignSummary[]
  issues: CampaignIssue[]
}

export interface CampaignRepairResult {
  id: string
  yamlPath: string
  runbookPath: string
  changes: string[]
  campaign: Campaign
}

export function normalizeCampaignEcosystem(value: string | undefined): CampaignEcosystem {
  const normalized = value?.trim().toLowerCase() || 'unknown'
  if (CANONICAL_ECOSYSTEMS.has(normalized)) return normalized as CampaignEcosystem
  const alias = ECOSYSTEM_ALIASES[normalized]
  if (alias !== undefined) return alias
  throw new Error(`target.ecosystem must be one of: ${CAMPAIGN_ECOSYSTEMS.join(', ')}`)
}

/** Keep malformed Campaign files local instead of failing the whole workbench dashboard. */
export async function inspectCampaigns(projectRoot: string): Promise<CampaignInspection> {
  const dir = join(projectRoot, '.omv', 'campaigns')
  if (!existsSync(dir)) return { campaigns: [], issues: [] }

  const files = (await readdir(dir, { withFileTypes: true }))
    .filter(entry => entry.isFile() && isCampaignSource(entry.name))
    .map(entry => entry.name)
    .sort()
  const ids = [...new Set(files.map(file => file.replace(/\.ya?ml$/i, '')))]
  const campaigns: CampaignSummary[] = []
  const issues: CampaignIssue[] = []

  for (const id of ids) {
    const path = campaignSourcePath(dir, id, files)
    try {
      const detail = await showCampaign(id, projectRoot)
      campaigns.push({
        id: detail.campaign.id,
        title: detail.campaign.title,
        status: detail.campaign.status,
        target: detail.campaign.target.name,
        version: detail.campaign.target.version,
        laneCount: detail.campaign.lanes.length,
        nextAction: detail.nextAction,
      })
    } catch (error) {
      const analysis = await analyzeRepair(path, id)
      issues.push({
        id,
        path,
        message: errorMessage(error),
        repairable: analysis.repairable,
        changes: analysis.changes,
      })
    }
  }

  campaigns.sort((left, right) => left.id.localeCompare(right.id))
  issues.sort((left, right) => left.id.localeCompare(right.id))
  return { campaigns, issues }
}

/** Repairs deterministic compatibility fields: registry aliases and the derived title. */
export async function repairCampaign(id: string, projectRoot: string): Promise<CampaignRepairResult> {
  const dir = join(projectRoot, '.omv', 'campaigns')
  const files = await campaignFiles(dir)
  const yamlPath = campaignSourcePath(dir, id, files)
  if (!existsSync(yamlPath)) throw new Error(`${yamlPath} does not exist`)

  const raw = await readFile(yamlPath, 'utf8')
  const document = parseDocument(raw)
  if (document.errors.length > 0) throw new Error(`${yamlPath}: Campaign YAML parse error: ${document.errors[0]!.message}`)
  const normalized = normalizeRepairableCampaign(document.toJS(), id)
  if (normalized.changes.length === 0) {
    const campaign = validateCampaign(normalized.value)
    return { id, yamlPath, runbookPath: join(dir, `${id}.md`), changes: [], campaign }
  }

  document.setIn(['target', 'ecosystem'], normalized.value.target.ecosystem)
  document.set('title', normalized.value.title)
  document.set('updated_at', new Date().toISOString())
  const campaign = validateCampaign(document.toJS())
  const temporaryPath = `${yamlPath}.repair-${process.pid}-${Date.now()}`
  await writeFile(temporaryPath, document.toString({ lineWidth: 0 }), 'utf8')
  await rename(temporaryPath, yamlPath)

  const runbookPath = join(dir, `${id}.md`)
  await syncRunbookMetadata(runbookPath, campaign)
  return { id, yamlPath, runbookPath, changes: normalized.changes, campaign }
}

async function analyzeRepair(path: string, id: string): Promise<{ repairable: boolean; changes: string[] }> {
  try {
    const normalized = normalizeRepairableCampaign(parseYaml(await readFile(path, 'utf8')), id)
    validateCampaign(normalized.value)
    return { repairable: normalized.changes.length > 0, changes: normalized.changes }
  } catch {
    return { repairable: false, changes: [] }
  }
}

function normalizeRepairableCampaign(value: unknown, expectedId: string): { value: Campaign; changes: string[] } {
  if (!isRecord(value) || !isRecord(value.target)) throw new Error('Campaign.v1 must contain a target mapping')
  if (value.id !== expectedId) throw new Error(`id must match filename id ${expectedId}`)

  const changes: string[] = []
  const target = { ...value.target }
  const currentEcosystem = text(target.ecosystem).toLowerCase()
  const ecosystem = normalizeCampaignEcosystem(currentEcosystem)
  if (currentEcosystem !== ecosystem) changes.push(`target.ecosystem: ${currentEcosystem || 'unknown'} → ${ecosystem}`)
  target.ecosystem = ecosystem

  const name = text(target.name)
  const version = text(target.version)
  const title = campaignTitle(name, version)
  if (value.title !== title) changes.push(`title: ${text(value.title)} → ${title}`)

  return { value: { ...value, title, target } as unknown as Campaign, changes }
}

async function syncRunbookMetadata(path: string, campaign: Campaign): Promise<void> {
  if (!existsSync(path)) return
  const current = await readFile(path, 'utf8')
  const nextActions = [
    '## Next actions',
    '',
    `1. Review the normalized campaign: \`omv campaign show ${campaign.id}\``,
    `2. Create candidate finding templates: \`omv campaign seed ${campaign.id}\``,
    '3. Audit each candidate separately before making any security claim.',
    '',
  ].join('\n')
  const next = current
    .replace(/^# .*$/m, `# ${escapeMarkdown(campaign.title)}`)
    .replace(/^- Target: .*$/m, `- Target: ${escapeMarkdown(campaign.target.name)}`)
    .replace(/^- Version: .*$/m, `- Version: ${escapeMarkdown(campaign.target.version)}`)
    .replace(/^- Source: .*$/m, `- Source: ${escapeMarkdown(campaign.target.source)}`)
    .replace(/^- Ecosystem: .*$/m, `- Ecosystem: ${campaign.target.ecosystem}`)
    .replace(/## Next actions[\s\S]*$/m, nextActions)
  if (next !== current) await writeFile(path, next.endsWith('\n') ? next : `${next}\n`, 'utf8')
}

async function campaignFiles(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir, { withFileTypes: true }))
      .filter(entry => entry.isFile() && isCampaignSource(entry.name))
      .map(entry => entry.name)
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      await mkdir(dir, { recursive: true })
      return []
    }
    throw error
  }
}

function campaignSourcePath(dir: string, id: string, files: readonly string[]): string {
  const yaml = `${id}.yaml`
  return join(dir, files.includes(yaml) ? yaml : `${id}.yml`)
}

function isCampaignSource(name: string): boolean {
  return /\.ya?ml$/i.test(name) && !/\.surfaces\.ya?ml$/i.test(name)
}

function campaignTitle(name: string, version: string): string {
  return `${name}${version === 'unknown' ? '' : ` ${version}`} research campaign`
}

function escapeMarkdown(value: string): string {
  return Array.from(value, character => {
    if (character === '\\') return '\\\\'
    return ['`', '*', '_', '[', ']', '<', '>', '#', '|'].includes(character) ? `\\${character}` : character
  }).join('')
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
