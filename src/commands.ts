import type { Context } from '@deepseek-ai/cordis'
import type { CommandInvocation, CommandResult } from '@deepseek-ai/dsh-commands'
import type { DshRuntimeSnapshot } from './runtime.js'
import type { OmvWorkbench } from './workbench.js'

/** Register durable, discoverable DSH slash commands for the OMV workflow. */
export function registerOmvCommands(ctx: Context, workbench: OmvWorkbench, runtimeSnapshot?: () => DshRuntimeSnapshot): void {
  ctx.commands.register({
    name: 'omv',
    description: '查看当前 DSH 工作区的漏洞审计态势与下一步动作',
    handler: invocation => run(invocation, workbench, async scoped => {
      const dashboard = await scoped.dashboard()
      const { metrics } = dashboard
      const queue = dashboard.findings.slice(0, 5)
        .map(item => `- ${item.id} · ${item.status} · ${item.assessment.maturity}/${item.assessment.confidence} · ${item.nextAction}`)
        .join('\n')
      return [
        `OMV 工作区：${dashboard.config.projectRoot}`,
        `活跃 ${metrics.active} · 已确认 ${metrics.confirmed} · 阻塞 ${metrics.blocked} · 报告就绪 ${metrics.reportReady}`,
        queue === '' ? '当前没有活跃发现。' : `优先队列：\n${queue}`,
      ].join('\n')
    }),
  })

  ctx.commands.register({
    name: 'omv-health',
    description: '检查 OMV 工作区、Campaign、工作流和持久化运行时状态',
    handler: invocation => run(invocation, workbench, async scoped => JSON.stringify(await scoped.health(), null, 2)),
  })

  if (runtimeSnapshot !== undefined) {
    ctx.commands.register({
      name: 'omv-runtime',
      description: '读取 DSH Cordis 插件生命周期、依赖和 PENDING/FAILED 状态',
      handler: () => ({ kind: 'success', text: JSON.stringify(runtimeSnapshot(), null, 2) }),
    })
  }

  ctx.commands.register({
    name: 'omv-finding',
    description: '读取一条 Evidence.v1 发现及其证据链和审计结论',
    input: { hint: '<finding-id>' },
    handler: invocation => run(invocation, workbench, async scoped => {
      const id = requiredInput(invocation.rawInput, 'finding id')
      const finding = await scoped.finding(id)
      const { detail, doctor, review } = finding
      return [
        `${detail.id} · ${detail.status} · ${finding.assessment.maturity}/${finding.assessment.confidence}`,
        `${detail.package} · ${detail.ecosystem} · ${detail.vulnerability}`,
        `证据判断：${finding.assessment.summary}`,
        `审计结论：${review?.summary ?? detail.verdict.exploitability}`,
        `校验问题：${doctor?.issues.length ?? 0}`,
        `下一步：${detail.nextAction}`,
      ].join('\n')
    }),
  })

  ctx.commands.register({
    name: 'omv-validate',
    description: '校验一条 Evidence.v1 并返回 Schema 问题和精确缺口',
    input: { hint: '<finding-id>' },
    handler: invocation => run(invocation, workbench, async scoped => {
      const id = requiredInput(invocation.rawInput, 'finding id')
      const result = await scoped.action({ action: 'finding.validate', id })
      return `Evidence.v1 校验完成：${id}\n${JSON.stringify(result, null, 2)}`
    }),
  })

  ctx.commands.register({
    name: 'omv-init',
    description: '在当前 DSH 工作区初始化 .omv 研究目录',
    handler: invocation => run(invocation, workbench, async scoped => {
      const result = await scoped.action({ action: 'workspace.init', sessionId: invocation.agent.session.header.id })
      return `OMV 工作区已初始化：${scoped.config.projectRoot}\n${JSON.stringify(result, null, 2)}`
    }),
  })

  ctx.commands.register({
    name: 'omv-new',
    description: '在当前 DSH 工作区创建 Evidence.v1 候选模板',
    input: { hint: '<id> [product ecosystem vulnerability-class]' },
    handler: invocation => run(invocation, workbench, async scoped => {
      const [id, product, ecosystem, vulnerabilityClass] = words(invocation.rawInput)
      if (id === undefined) throw new Error('finding id is required')
      const seeded = product !== undefined || ecosystem !== undefined || vulnerabilityClass !== undefined
      if (seeded && (product === undefined || ecosystem === undefined || vulnerabilityClass === undefined)) {
        throw new Error('seeded creation requires product, ecosystem, and vulnerability-class together')
      }
      const result = await scoped.action({
        action: 'finding.create',
        id,
        sessionId: invocation.agent.session.header.id,
        ...(seeded ? { product, ecosystem, vulnerabilityClass, researcherGoal: 'triage' as const } : {}),
      })
      return `候选漏洞已创建：${id}\n${JSON.stringify(result, null, 2)}`
    }),
  })

  ctx.commands.register({
    name: 'omv-link',
    description: '将当前 DSH 会话绑定到一条 OMV Finding',
    input: { hint: '<finding-id>' },
    handler: invocation => run(invocation, workbench, async scoped => {
      const id = requiredInput(invocation.rawInput, 'finding id')
      const link = await scoped.action({
        action: 'session.link',
        id,
        sessionId: invocation.agent.session.header.id,
      })
      return `当前会话已关联：${id}\n${JSON.stringify(link, null, 2)}`
    }),
  })

  ctx.commands.register({
    name: 'omv-repro',
    description: '初始化 Finding 的本地复现材料并关联当前会话',
    input: { hint: '<finding-id>' },
    handler: invocation => run(invocation, workbench, async scoped => {
      const id = requiredInput(invocation.rawInput, 'finding id')
      await scoped.action({ action: 'session.link', id, sessionId: invocation.agent.session.header.id, intent: 'repro' })
      const result = await scoped.action({ action: 'finding.repro', id, sessionId: invocation.agent.session.header.id })
      return `复现材料已准备：${id}\n${JSON.stringify(result, null, 2)}`
    }),
  })

  ctx.commands.register({
    name: 'omv-promote',
    description: '更新 Finding 的 Evidence 状态',
    input: { hint: '<finding-id> <candidate|confirmed|blocked>' },
    handler: invocation => run(invocation, workbench, async scoped => {
      const [id, status] = words(invocation.rawInput)
      if (id === undefined) throw new Error('finding id is required')
      if (status !== 'candidate' && status !== 'confirmed' && status !== 'blocked') {
        throw new Error('status must be candidate, confirmed, or blocked')
      }
      const result = await scoped.action({
        action: 'finding.promote',
        id,
        status,
        sessionId: invocation.agent.session.header.id,
      })
      return `Finding 状态已更新：${id} → ${status}\n${JSON.stringify(result, null, 2)}`
    }),
  })

  ctx.commands.register({
    name: 'omv-run',
    description: '登记审计工作流并生成可直接发送给 Agent 的任务上下文',
    input: { hint: '<finding-id> <audit|repro|dedup|critic|report|disclose>' },
    handler: invocation => run(invocation, workbench, async scoped => {
      const [id, intent] = words(invocation.rawInput)
      if (id === undefined) throw new Error('finding id is required')
      if (!isIntent(intent)) throw new Error('intent must be audit, repro, dedup, critic, report, or disclose')
      const result = await scoped.action({
        action: 'workflow.start',
        id,
        intent,
        sessionId: invocation.agent.session.header.id,
      }) as { label: string; prompt: string }
      return `${result.label}：${id}\n\n${result.prompt}`
    }),
  })

  ctx.commands.register({
    name: 'omv-campaign',
    description: '读取 Campaign.v1、并行 lane 与当前 DSH 编排历史',
    input: { hint: '<campaign-id>' },
    handler: invocation => run(invocation, workbench, async scoped => {
      const id = requiredInput(invocation.rawInput, 'campaign id')
      const detail = await scoped.campaign(id)
      return [
        `${detail.campaign.title} · ${detail.campaign.status} · ${detail.campaign.budget.depth}`,
        `${detail.campaign.target.name} ${detail.campaign.target.version} · ${detail.campaign.lanes.length} lanes`,
        `关联会话：${detail.sessionLink?.sessionId ?? 'none'}`,
        `下一步：${detail.nextAction}`,
      ].join('\n')
    }),
  })

  ctx.commands.register({
    name: 'omv-campaign-repair',
    description: '修复 Campaign 的生态别名、派生标题和 runbook 元数据',
    input: { hint: '<campaign-id>' },
    handler: invocation => run(invocation, workbench, async scoped => {
      const id = requiredInput(invocation.rawInput, 'campaign id')
      const result = await scoped.action({ action: 'campaign.repair', id, sessionId: invocation.agent.session.header.id })
      return `Campaign 配置已修复：${id}\n${JSON.stringify(result, null, 2)}`
    }),
  })

  ctx.commands.register({
    name: 'omv-campaign-seed',
    description: '按 Campaign lanes 初始化 Evidence.v1 候选集合',
    input: { hint: '<campaign-id>' },
    handler: invocation => run(invocation, workbench, async scoped => {
      const id = requiredInput(invocation.rawInput, 'campaign id')
      const result = await scoped.action({ action: 'campaign.seed', id, sessionId: invocation.agent.session.header.id })
      return `Campaign lanes 已初始化：${id}\n${JSON.stringify(result, null, 2)}`
    }),
  })

  ctx.commands.register({
    name: 'omv-radar',
    description: '查看当前工作区的 Radar 观察项与最近被动情报信号',
    handler: invocation => run(invocation, workbench, async scoped => {
      const radar = await scoped.radar()
      return [
        `Radar：${radar.watch.length} 个观察项 · ${radar.events.length} 条事件`,
        `Watchlist：${radar.watchlistExists ? radar.watchlistPath : 'missing'}`,
        ...radar.events.slice(0, 8).map(event => `- ${event.ecosystem}:${event.package ?? event.keyword ?? 'unknown'} · ${event.type} · ${event.title}`),
      ].join('\n')
    }),
  })

  ctx.commands.register({
    name: 'omv-search',
    description: '跨 Finding、Campaign、Radar 和活动记录搜索 OMV 工作区',
    input: { hint: '<query>' },
    handler: invocation => run(invocation, workbench, async scoped => {
      const query = requiredInput(invocation.rawInput, 'query')
      const results = await scoped.search(query)
      return results.length === 0 ? `没有匹配：${query}` : results.slice(0, 20).map(result => `- [${result.kind}] ${result.title} · ${result.description}`).join('\n')
    }),
  })

  ctx.commands.register({
    name: 'omv-campaign-run',
    description: '创建或恢复可持久化的 Campaign Runner 执行',
    input: { hint: '<campaign-id> [concurrency]' },
    handler: invocation => run(invocation, workbench, async scoped => {
      const [id, rawConcurrency] = words(invocation.rawInput)
      if (id === undefined) throw new Error('campaign id is required')
      const concurrency = rawConcurrency === undefined ? 3 : Number(rawConcurrency)
      const result = await scoped.action({ action: 'campaign.run.create', id, concurrency, sessionId: invocation.agent.session.header.id }) as { id: string; lanes: unknown[]; status: string }
      return `Campaign Run：${result.id} · ${result.status} · ${result.lanes.length} lanes\n在漏洞审计 → 战役中打开该 Run，DSH 将按并发宽度创建独立 Lane 会话。`
    }),
  })

  ctx.commands.register({
    name: 'omv-campaign-lane',
    description: '提交 Campaign Runner 中一条 Lane 的执行结果',
    input: { hint: '<run-id> <lane-id> <completed|failed|blocked|awaiting_evidence> [summary]' },
    handler: invocation => run(invocation, workbench, async scoped => {
      const [runId, laneId, status, ...summaryParts] = words(invocation.rawInput)
      if (runId === undefined || laneId === undefined || !isLaneStatus(status)) throw new Error('run id, lane id, and a valid lane status are required')
      const result = await scoped.action({
        action: 'campaign.run.lane.update', runId, laneId, laneStatus: status,
        sessionId: invocation.agent.session.header.id,
        summary: summaryParts.join(' ') || `Lane ${laneId} marked ${status}`,
      }) as { status: string }
      return `Lane 已更新：${runId}/${laneId} → ${status}\nRun：${result.status}`
    }),
  })

  ctx.commands.register({
    name: 'omv-quality',
    description: '检查 Finding 的报告质量门禁和必需阻塞项',
    input: { hint: '<finding-id>' },
    handler: invocation => run(invocation, workbench, async scoped => {
      const id = requiredInput(invocation.rawInput, 'finding id')
      const gate = (await scoped.finding(id)).qualityGate
      return [
        `${id} · ${gate.readyForReport ? '报告条件满足' : gate.summary}`,
        ...gate.checks.map(check => `- ${check.passed ? '✓' : check.state === 'partial' ? '◐' : '○'} ${check.label} · ${check.detail}${check.blocking ? ' · 提交条件' : ''}`),
      ].join('\n')
    }),
  })

  ctx.commands.register({
    name: 'omv-radar-candidate',
    description: '将 Radar 队列信号转成 Evidence.v1 Candidate',
    input: { hint: '<queue-id> [finding-id]' },
    handler: invocation => run(invocation, workbench, async scoped => {
      const [queueId, findingId] = words(invocation.rawInput)
      if (queueId === undefined) throw new Error('radar queue id is required')
      const result = await scoped.action({ action: 'radar.queue.convert', id: queueId, ...(findingId === undefined ? {} : { findingId }) }) as { findingId: string }
      return `Radar Candidate 已创建：${result.findingId}`
    }),
  })

  ctx.commands.register({
    name: 'omv-dedup',
    description: '扫描并记录 Finding 的本地与 Radar 去重结论',
    input: { hint: '<finding-id> [scan|clear|duplicate|unknown]' },
    handler: invocation => run(invocation, workbench, async scoped => {
      const [id, operation = 'scan'] = words(invocation.rawInput)
      if (id === undefined) throw new Error('finding id is required')
      if (operation === 'scan') {
        const result = await scoped.action({ action: 'dedup.scan', id, sessionId: invocation.agent.session.header.id })
        return `去重扫描完成：${id}\n${JSON.stringify(result, null, 2)}`
      }
      if (operation !== 'clear' && operation !== 'duplicate' && operation !== 'unknown') throw new Error('operation must be scan, clear, duplicate, or unknown')
      const result = await scoped.action({ action: 'dedup.update', id, dedupStatus: operation === 'clear' ? 'clear' : operation === 'duplicate' ? 'duplicate' : 'unknown', sessionId: invocation.agent.session.header.id })
      return `去重结论已更新：${id} → ${operation}\n${JSON.stringify(result, null, 2)}`
    }),
  })

  ctx.commands.register({
    name: 'omv-review',
    description: '更新 Finding 评审状态并查看协作意见',
    input: { hint: '<finding-id> [unreviewed|in_review|changes_requested|approved|rejected] [assignee]' },
    handler: invocation => run(invocation, workbench, async scoped => {
      const [id, status, assignee] = words(invocation.rawInput)
      if (id === undefined) throw new Error('finding id is required')
      if (status === undefined) return JSON.stringify(await scoped.action({ action: 'review.inspect', id }), null, 2)
      if (!isReviewStatus(status)) throw new Error('status must be unreviewed, in_review, changes_requested, approved, or rejected')
      const result = await scoped.action({ action: 'review.update', id, reviewStatus: status, ...(assignee === undefined ? {} : { assignee }), sessionId: invocation.agent.session.header.id })
      return `评审状态已更新：${id} → ${status}\n${JSON.stringify(result, null, 2)}`
    }),
  })

  ctx.commands.register({
    name: 'omv-report',
    description: '检查或生成 Finding 的报告材料与 provenance',
    input: { hint: '<finding-id> [inspect|prepare]' },
    handler: invocation => run(invocation, workbench, async scoped => {
      const [id, operation = 'inspect'] = words(invocation.rawInput)
      if (id === undefined) throw new Error('finding id is required')
      const action = operation === 'prepare' ? 'report.prepare' : operation === 'inspect' ? 'report.inspect' : undefined
      if (action === undefined) throw new Error('operation must be inspect or prepare')
      const result = await scoped.action({ action, id, sessionId: invocation.agent.session.header.id })
      return `${operation === 'prepare' ? '报告材料已生成' : '报告材料状态'}：${id}\n${JSON.stringify(result, null, 2)}`
    }),
  })

  ctx.commands.register({
    name: 'omv-disclose',
    description: '为 Finding 建立可追踪的披露时间线',
    input: { hint: '<finding-id> <YYYY-MM-DD> [vendor|cna|public|internal]' },
    handler: invocation => run(invocation, workbench, async scoped => {
      const [id, date, channel = 'internal'] = words(invocation.rawInput)
      if (id === undefined || date === undefined) throw new Error('finding id and disclosure date are required')
      if (!isDisclosureChannel(channel)) throw new Error('channel must be vendor, cna, public, or internal')
      const result = await scoped.action({ action: 'disclosure.schedule', id, disclosureDate: date, disclosureChannel: channel, sessionId: invocation.agent.session.header.id })
      return `披露时间线已排期：${id} · ${date} · ${channel}\n${JSON.stringify(result, null, 2)}`
    }),
  })
}

async function run(
  invocation: CommandInvocation,
  base: OmvWorkbench,
  operation: (workbench: OmvWorkbench) => Promise<string>,
): Promise<CommandResult> {
  const cwd = invocation.agent.session.header.cwd
  const scoped = cwd === undefined ? base : base.scoped(cwd)
  try {
    return { kind: 'success', text: await operation(scoped) }
  } catch (error) {
    return { kind: 'error', text: error instanceof Error ? error.message : String(error) }
  }
}

function requiredInput(raw: string, field: string): string {
  const value = raw.trim()
  if (value === '') throw new Error(`${field} is required`)
  return value
}

function words(raw: string): string[] {
  return raw.trim().split(/\s+/u).filter(Boolean)
}

function isIntent(value: string | undefined): value is 'audit' | 'repro' | 'dedup' | 'critic' | 'report' | 'disclose' {
  return value === 'audit' || value === 'repro' || value === 'dedup' || value === 'critic' || value === 'report' || value === 'disclose'
}

function isLaneStatus(value: string | undefined): value is 'completed' | 'failed' | 'blocked' | 'awaiting_evidence' {
  return value === 'completed' || value === 'failed' || value === 'blocked' || value === 'awaiting_evidence'
}

function isReviewStatus(value: string | undefined): value is 'unreviewed' | 'in_review' | 'changes_requested' | 'approved' | 'rejected' {
  return value === 'unreviewed' || value === 'in_review' || value === 'changes_requested' || value === 'approved' || value === 'rejected'
}

function isDisclosureChannel(value: string | undefined): value is 'vendor' | 'cna' | 'public' | 'internal' {
  return value === 'vendor' || value === 'cna' || value === 'public' || value === 'internal'
}
