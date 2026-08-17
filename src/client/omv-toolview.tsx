import { useState } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type { ToolCallBlock } from '@deepseek-ai/dsh-client-runtime/client'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import {
  Button,
  DisclosureRow,
  IconInspectOutline12,
  StateDot,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { Icon } from './ui.js'
import { OMV_TOOL_NAMES, type IconName } from './types.js'

type OmvToolViewProps = ToolCallViewProps

const ACTION_LABELS: Readonly<Record<string, string>> = {
  omv_workspace_overview: '读取审计态势',
  omv_workspace_health: '检查基座状态',
  omv_runtime_status: '读取运行时状态',
  omv_finding_inspect: '读取 Finding',
  omv_finding_validate: '校验 Evidence',
  omv_finding_create: '创建候选 Finding',
  omv_workflow_link: '关联审计会话',
  omv_finding_repro_init: '准备复现材料',
  omv_finding_promote: '更新 Finding 状态',
  omv_workflow_history: '读取工作流历史',
  omv_campaign_inspect: '读取 Campaign',
  omv_campaign_repair: '修复 Campaign',
  omv_campaign_seed: '初始化 Campaign',
  omv_campaign_surfaces: '提出攻击面',
  omv_workspace_search: '搜索 OMV 工作区',
  omv_campaign_run_inspect: '读取 Campaign Run',
  omv_campaign_lane_update: '提交 Lane 结果',
  omv_evidence_graph: '读取 Evidence Graph',
  omv_quality_gate: '检查报告门禁',
  omv_quality_overview: '读取证据质量',
  omv_dedup_scan: '扫描去重情报',
  omv_repro_run_start: '开始复现 Run',
  omv_repro_run_finish: '完成复现 Run',
  omv_poc_generate: '生成 PoC',
  omv_poc_draft_save: '保存 PoC 草稿',
  omv_poc_draft_approve: '批准 PoC 草稿',
  omv_poc_run: '运行 PoC',
  omv_poc_run_inspect: '读取 PoC Run',
  omv_poc_evidence_adopt: '采纳 PoC 证据',
}

const ACTION_ICONS: Readonly<Record<string, IconName>> = {
  omv_workspace_overview: 'grid',
  omv_workspace_health: 'pulse',
  omv_runtime_status: 'activity',
  omv_finding_inspect: 'finding',
  omv_finding_validate: 'check',
  omv_finding_create: 'plus',
  omv_workflow_link: 'chevron',
  omv_finding_repro_init: 'terminal',
  omv_finding_promote: 'arrowUp',
  omv_workflow_history: 'clock',
  omv_campaign_inspect: 'campaign',
  omv_campaign_repair: 'refresh',
  omv_campaign_seed: 'plus',
  omv_campaign_surfaces: 'search',
  omv_workspace_search: 'search',
  omv_campaign_run_inspect: 'eye',
  omv_campaign_lane_update: 'check',
  omv_evidence_graph: 'activity',
  omv_quality_gate: 'shield',
  omv_quality_overview: 'grid',
  omv_dedup_scan: 'search',
  omv_repro_run_start: 'terminal',
  omv_repro_run_finish: 'check',
  omv_poc_generate: 'plus',
  omv_poc_draft_save: 'file',
  omv_poc_draft_approve: 'check',
  omv_poc_run: 'terminal',
  omv_poc_run_inspect: 'eye',
  omv_poc_evidence_adopt: 'arrowUp',
}

const ARGUMENT_KEYS: Readonly<Record<string, readonly string[]>> = {
  omv_finding_inspect: ['id'],
  omv_finding_validate: ['id'],
  omv_finding_create: ['id'],
  omv_workflow_link: ['id'],
  omv_finding_repro_init: ['id'],
  omv_finding_promote: ['id', 'status'],
  omv_workflow_history: ['id'],
  omv_campaign_inspect: ['id'],
  omv_campaign_repair: ['id'],
  omv_campaign_seed: ['id'],
  omv_campaign_surfaces: ['id'],
  omv_workspace_search: ['query'],
  omv_campaign_run_inspect: ['runId'],
  omv_campaign_lane_update: ['laneId', 'runId', 'status'],
  omv_evidence_graph: ['id'],
  omv_quality_gate: ['id'],
  omv_dedup_scan: ['id'],
  omv_repro_run_start: ['id'],
  omv_repro_run_finish: ['runId'],
  omv_poc_generate: ['id'],
  omv_poc_draft_save: ['id'],
  omv_poc_draft_approve: ['id'],
  omv_poc_run: ['id'],
  omv_poc_run_inspect: ['runId'],
  omv_poc_evidence_adopt: ['id', 'runId'],
}

function argsRaw(block: ToolCallBlock): string {
  return 'kind' in block ? block.call?.argsRaw ?? '' : block.argsRaw
}

function parsedArgs(block: ToolCallBlock): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(argsRaw(block))
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? value as Record<string, unknown>
      : undefined
  } catch {
    return undefined
  }
}

function salientArgument(toolName: string, block: ToolCallBlock): string | undefined {
  const args = parsedArgs(block)
  if (args === undefined) return undefined
  for (const key of ARGUMENT_KEYS[toolName] ?? []) {
    const value = args[key]
    if (typeof value === 'string' && value !== '') return `${key}=${value}`
  }
  return undefined
}

function presentationTitle(block: ToolCallBlock): string | undefined {
  const view = 'kind' in block ? block.resultView ?? block.callView : block.callView
  return view?.title
}

function settledContent(block: ToolCallBlock): string | undefined {
  if (!('kind' in block)) return undefined
  if (block.isError) return block.error === undefined ? 'error' : `${block.error.name}: ${block.error.code}`
  if (block.content.length === 0) return 'No output'
  const parts = block.content.map(content => content.type === 'text'
    ? content.text
    : JSON.stringify(content, null, 2))
  return parts.join('\n') || 'No output'
}

function resultText(block: ToolCallBlock): string | undefined {
  const text = settledContent(block)
  return text === undefined ? undefined : firstLine(text)
}

function firstLine(value: string): string {
  const line = value.split(/\r?\n/u, 1)[0] ?? value
  return line.length > 180 ? `${line.slice(0, 177)}…` : line
}

function fullResultText(block: ToolCallBlock): string | undefined {
  return settledContent(block)
}

/** UI state derived from the immutable running-or-settled tool block. */
export function toolState(block: ToolCallBlock): 'running' | 'ok' | 'error' | 'stopped' {
  if (!('kind' in block)) return 'running'
  if (block.error?.code === 'interrupted') return 'stopped'
  return block.isError ? 'error' : 'ok'
}

function stateLabel(state: ReturnType<typeof toolState>): string {
  return state === 'running' ? '运行中'
    : state === 'error' ? '失败'
      : state === 'stopped' ? '已中断' : '已完成'
}

/** Compact, replay-safe values used by the OMV Tool card. */
export interface OmvToolCardModel {
  readonly state: ReturnType<typeof toolState>
  readonly title: string
  readonly preview?: string
  readonly output?: string
  readonly args: string
}

/**
 * Derive the OMV card from the tool block only; no workspace or network reads
 * are allowed because the same projection runs during session replay.
 * @param toolName - wire name of the OMV tool.
 * @param block - frozen running or settled tool block.
 * @returns render-ready card fields.
 */
export function deriveOmvToolCard(toolName: string, block: ToolCallBlock): OmvToolCardModel {
  const args = argsRaw(block)
  const preview = resultText(block) ?? salientArgument(toolName, block)
  const output = fullResultText(block)
  return {
    state: toolState(block),
    title: presentationTitle(block) ?? ACTION_LABELS[toolName] ?? 'OMV 工具',
    ...(preview === undefined ? {} : { preview }),
    ...(output === undefined ? {} : { output }),
    args,
  }
}

/** Compact OMV-specific Tool card rendered through the official Tool view slot. */
export function OmvToolRow({ toolName, block, inspect }: OmvToolViewProps) {
  const [expanded, setExpanded] = useState(false)
  const model = deriveOmvToolCard(toolName, block)
  const { state, title, preview, output, args } = model
  const argument = salientArgument(toolName, block)
  const expandable = args !== '' || output !== undefined
  const toggle = () => { if (expandable) setExpanded(value => !value) }
  const leading = state === 'error'
    ? <StateDot state="error" />
    : state === 'stopped'
      ? <StateDot state="warning" />
      : <Icon name="shield" size={14} />
  return (
    <div className="omv-tool-card" data-omv-tool={toolName} data-state={state}>
      <DisclosureRow
        icon={leading}
        title="OMV"
        open={expanded && expandable}
        expandable={expandable}
        expandOnRowClick
        keepContentWhenOpen
        onToggle={toggle}
        rowClassName="omv-tool-card-row"
        leadingClassName="omv-tool-card-leading"
        collapsedContent={(
          <>
            <span className="omv-tool-card-brand">OMV</span>
            <span className="omv-tool-card-action"><Icon name={ACTION_ICONS[toolName] ?? 'activity'} size={13} />{title}</span>
            {preview !== undefined && <span className="omv-tool-card-preview">{preview}</span>}
            <span className="omv-tool-card-state"><StateDot state={state === 'running' ? 'ongoing' : state === 'error' ? 'error' : state === 'stopped' ? 'warning' : 'done'} />{stateLabel(state)}</span>
          </>
        )}
      >
        <div className="omv-tool-card-body">
          {argument !== undefined && <div className="omv-tool-card-argument">{argument}</div>}
          {args !== '' && <pre>{args}</pre>}
          {output !== undefined && <div className="omv-tool-card-output">{output}</div>}
          {inspect !== undefined && (
            <Button variant="outline" size="sm" className="omv-tool-card-inspect" icon={<IconInspectOutline12 />} onClick={event => { event.stopPropagation(); inspect() }}>
              在轨迹中定位
            </Button>
          )}
        </div>
      </DisclosureRow>
    </div>
  )
}

/** Register one OMV row for each OMV wire tool; slot disposal follows the plugin fiber. */
export function registerOmvToolViews(ctx: Context): void {
  ctx.slots.inject('tool.call.toolview', function* () {
    for (const key of OMV_TOOL_NAMES) {
      yield ctx.slots.register({ name: 'tool.call.toolview', key }, OmvToolRow)
    }
  })
}
