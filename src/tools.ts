import type { Context } from '@deepseek-ai/cordis'
import { defineTool, type ToolDefinition } from '@deepseek-ai/dsh-tools'
import type { DshRuntimeSnapshot } from './runtime.js'
import type { OmvWorkbench } from './workbench.js'

export function registerOmvTools(ctx: Context, workbench: OmvWorkbench, runtimeSnapshot?: () => DshRuntimeSnapshot): void {
  const register = (definition: ToolDefinition): void => {
    ctx.tools.register(withSignal(definition))
  }
  register(defineTool({
    name: 'omv_workspace_overview',
    description: 'Inspect the current oh-my-vul research workspace, including evidence readiness, campaigns, and prioritized next actions.',
    parameters: {},
    output: stringOutput(),
    async execute(_args, exec) {
      return pretty(await scoped(workbench, exec.agent?.session.header.cwd).dashboard())
    },
    presentCall: () => ({ card: 'generic', title: '读取 OMV 审计态势', kind: 'read' }),
    presentResult: (_args, result) => ({ card: 'generic', title: 'OMV 审计态势', content: result.content }),
    isConcurrencySafe: () => true,
  }))

  register(defineTool({
    name: 'omv_workspace_health',
    description: 'Check OMV runtime health, workspace stores, Campaign validation, and DSH lifecycle components.',
    parameters: {},
    output: stringOutput(),
    async execute(_args, exec) {
      return pretty(await scoped(workbench, exec.agent?.session.header.cwd).health())
    },
    presentCall: () => ({ card: 'generic', title: '检查 OMV 基座状态', kind: 'read' }),
    presentResult: (_args, result) => ({ card: 'generic', title: 'OMV 基座状态', content: result.content }),
    isConcurrencySafe: () => true,
  }))

  if (runtimeSnapshot !== undefined) {
    register(defineTool({
      name: 'omv_runtime_status',
      description: 'Inspect DSH Cordis plugin fibers, dependencies, and PENDING or FAILED lifecycle states when an OMV capability is missing.',
      parameters: {},
      output: stringOutput(),
      async execute() {
        return pretty(runtimeSnapshot())
      },
      presentCall: () => ({ card: 'generic', title: '读取 DSH 生命周期', kind: 'read' }),
      presentResult: (_args, result) => ({ card: 'generic', title: 'DSH 生命周期', content: result.content }),
      isConcurrencySafe: () => true,
    }))
  }

  register(defineTool({
    name: 'omv_finding_inspect',
    description: 'Inspect one OMV finding with its evidence chain, validation, doctor review, blockers, and next action.',
    parameters: {
      id: { type: 'string', required: true, description: 'The finding id.' },
    },
    output: stringOutput(),
    async execute(args, exec) {
      return pretty(await scoped(workbench, exec.agent?.session.header.cwd).finding(args.id))
    },
    presentCall: args => ({ card: 'generic', title: `读取发现 ${args.id}`, kind: 'read', rawInput: args.id, locations: [findingLocation(args.id)] }),
    presentResult: (args, result) => ({ card: 'generic', title: `发现 ${args.id}`, content: result.content }),
    isConcurrencySafe: () => true,
  }))

  register(defineTool({
    name: 'omv_finding_validate',
    description: 'Validate one OMV Evidence.v1 finding and return exact schema errors and warnings. Use omv_quality_gate for contextual maturity and report conditions.',
    parameters: {
      id: { type: 'string', required: true, description: 'The finding id.' },
    },
    output: stringOutput(),
    async execute(args, exec) {
      return pretty(await scoped(workbench, exec.agent?.session.header.cwd)
        .action({ action: 'finding.validate', id: args.id }))
    },
    presentCall: args => ({ card: 'generic', title: `校验 Evidence ${args.id}`, kind: 'execute', rawInput: args.id, locations: [findingLocation(args.id)] }),
    presentResult: (args, result) => ({ card: 'generic', title: `Evidence 校验完成 · ${args.id}`, content: result.content }),
    isConcurrencySafe: () => true,
  }))

  register(defineTool({
    name: 'omv_finding_create',
    description: 'Create a candidate OMV Evidence.v1 finding template, optionally prefilled with package and vulnerability metadata.',
    parameters: {
      id: { type: 'string', required: true, description: 'Safe finding id.' },
      product: { type: 'string', description: 'Package or product name.' },
      ecosystem: { type: 'string', description: 'Package ecosystem such as npm, python, go, or rust.' },
      vulnerabilityClass: { type: 'string', description: 'Vulnerability class such as ssrf or path-traversal.' },
      researcherGoal: { type: 'string', description: 'One of VulDB, CVE, advisory, or triage.' },
    },
    output: stringOutput(),
    async execute(args, exec) {
      return pretty(await scoped(workbench, exec.agent?.session.header.cwd).action({
        action: 'finding.create',
        id: args.id,
        ...(args.product === undefined ? {} : { product: args.product }),
        ...(args.ecosystem === undefined ? {} : { ecosystem: args.ecosystem }),
        ...(args.vulnerabilityClass === undefined ? {} : { vulnerabilityClass: args.vulnerabilityClass }),
        ...(args.researcherGoal === undefined ? {} : { researcherGoal: researcherGoal(args.researcherGoal) }),
      }))
    },
    presentCall: args => ({
      card: 'generic',
      title: `创建候选发现 ${args.id}`,
      kind: 'edit',
      rawInput: args,
      locations: [findingLocation(args.id)],
    }),
    presentResult: (args, result) => ({ card: 'generic', title: `候选发现已创建 · ${args.id}`, content: result.content }),
  }))

  register(defineTool({
    name: 'omv_workflow_link',
    description: 'Bind the current DSH session to one OMV finding so later audit work is resumable from the workbench.',
    parameters: {
      id: { type: 'string', required: true, description: 'The finding id.' },
      intent: { type: 'string', description: 'Optional workflow intent: audit, repro, dedup, critic, report, or disclose.' },
    },
    output: stringOutput(),
    async execute(args, exec) {
      const agent = exec.agent
      if (agent === undefined) throw new Error('omv_workflow_link requires a DSH Agent session')
      return pretty(await scoped(workbench, agent.session.header.cwd).action({
        action: 'session.link',
        id: args.id,
        sessionId: agent.session.header.id,
        ...(args.intent === undefined ? {} : { intent: workflowIntent(args.intent) }),
      }))
    },
    presentCall: args => ({ card: 'generic', title: `关联审计会话 · ${args.id}`, kind: 'edit', rawInput: args }),
    presentResult: (args, result) => ({ card: 'generic', title: `审计会话已关联 · ${args.id}`, content: result.content }),
  }))

  register(defineTool({
    name: 'omv_finding_repro_init',
    description: 'Initialize durable local reproduction artifacts for one OMV finding before running a reproducer.',
    parameters: {
      id: { type: 'string', required: true, description: 'The finding id.' },
    },
    output: stringOutput(),
    async execute(args, exec) {
      const scopedWorkbench = scoped(workbench, exec.agent?.session.header.cwd)
      const sessionId = exec.agent?.session.header.id
      return pretty(await scopedWorkbench.action({
        action: 'finding.repro',
        id: args.id,
        ...(sessionId === undefined ? {} : { sessionId }),
      }))
    },
    presentCall: args => ({ card: 'generic', title: `初始化复现材料 · ${args.id}`, kind: 'edit', rawInput: args.id, locations: [findingLocation(args.id)] }),
    presentResult: (args, result) => ({ card: 'generic', title: `复现材料已准备 · ${args.id}`, content: result.content }),
  }))

  register(defineTool({
    name: 'omv_finding_promote',
    description: 'Promote an OMV finding to candidate, confirmed, or blocked after evidence validation.',
    parameters: {
      id: { type: 'string', required: true, description: 'The finding id.' },
      status: { type: 'string', required: true, description: 'candidate, confirmed, or blocked.' },
    },
    output: stringOutput(),
    async execute(args, exec) {
      const status = evidenceStatus(args.status)
      const sessionId = exec.agent?.session.header.id
      return pretty(await scoped(workbench, exec.agent?.session.header.cwd).action({
        action: 'finding.promote',
        id: args.id,
        status,
        ...(sessionId === undefined ? {} : { sessionId }),
      }))
    },
    presentCall: args => ({ card: 'generic', title: `更新 Finding 状态 · ${args.id}`, kind: 'edit', rawInput: args, locations: [findingLocation(args.id)] }),
    presentResult: (args, result) => ({ card: 'generic', title: `Finding 状态已更新 · ${args.id}`, content: result.content }),
  }))

  register(defineTool({
    name: 'omv_workflow_history',
    description: 'Read the DSH session links, workflow transitions, and last Evidence diff for one OMV finding.',
    parameters: {
      id: { type: 'string', required: true, description: 'The finding id.' },
    },
    output: stringOutput(),
    async execute(args, exec) {
      const finding = await scoped(workbench, exec.agent?.session.header.cwd).finding(args.id)
      return pretty({
        id: args.id,
        stage: finding.stage,
        sessionLink: finding.sessionLink,
        lastDiff: finding.lastDiff,
        history: finding.history,
      })
    },
    presentCall: args => ({ card: 'generic', title: `读取工作流历史 · ${args.id}`, kind: 'read', rawInput: args.id, locations: [findingLocation(args.id), { path: '.omv/.dsh/workflow-events.jsonl' }] }),
    presentResult: (args, result) => ({ card: 'generic', title: `工作流历史 · ${args.id}`, content: result.content }),
    isConcurrencySafe: () => true,
  }))

  register(defineTool({
    name: 'omv_campaign_inspect',
    description: 'Inspect one OMV Campaign.v1 including its target, audit lanes, runbook, linked DSH session, and orchestration history.',
    parameters: { id: { type: 'string', required: true, description: 'The campaign id.' } },
    output: stringOutput(),
    async execute(args, exec) {
      return pretty(await scoped(workbench, exec.agent?.session.header.cwd).campaign(args.id))
    },
    presentCall: args => ({ card: 'generic', title: `读取 Campaign · ${args.id}`, kind: 'read', rawInput: args.id, locations: [campaignLocation(args.id)] }),
    presentResult: (args, result) => ({ card: 'generic', title: `Campaign · ${args.id}`, content: result.content }),
    isConcurrencySafe: () => true,
  }))

  register(defineTool({
    name: 'omv_campaign_repair',
    description: 'Repair deterministic Campaign compatibility fields such as registry ecosystem aliases and derived title metadata.',
    parameters: { id: { type: 'string', required: true, description: 'Campaign id.' } },
    output: stringOutput(),
    async execute(args, exec) {
      return pretty(await scoped(workbench, exec.agent?.session.header.cwd).action({
        action: 'campaign.repair', id: args.id, ...(exec.agent === undefined ? {} : { sessionId: exec.agent.session.header.id }),
      }))
    },
    presentCall: args => ({ card: 'generic', title: `修复 Campaign · ${args.id}`, kind: 'edit', rawInput: args.id, locations: [campaignLocation(args.id)] }),
    presentResult: (args, result) => ({ card: 'generic', title: `Campaign 已修复 · ${args.id}`, content: result.content }),
  }))

  register(defineTool({
    name: 'omv_campaign_seed',
    description: 'Create the candidate Evidence.v1 findings declared by every lane in an OMV Campaign.',
    parameters: { id: { type: 'string', required: true, description: 'The campaign id.' } },
    output: stringOutput(),
    async execute(args, exec) {
      const sessionId = exec.agent?.session.header.id
      return pretty(await scoped(workbench, exec.agent?.session.header.cwd).action({
        action: 'campaign.seed', id: args.id, ...(sessionId === undefined ? {} : { sessionId }),
      }))
    },
    presentCall: args => ({ card: 'generic', title: `初始化 Campaign lanes · ${args.id}`, kind: 'edit', rawInput: args.id, locations: [campaignLocation(args.id)] }),
    presentResult: (args, result) => ({ card: 'generic', title: `Campaign lanes 已初始化 · ${args.id}`, content: result.content }),
  }))

  register(defineTool({
    name: 'omv_radar_overview',
    description: 'Read the current OMV passive-intelligence watchlist and recent Radar events.',
    parameters: {},
    output: stringOutput(),
    async execute(_args, exec) {
      return pretty(await scoped(workbench, exec.agent?.session.header.cwd).radar())
    },
    presentCall: () => ({ card: 'generic', title: '读取 OMV Radar', kind: 'read' }),
    presentResult: (_args, result) => ({ card: 'generic', title: 'OMV Radar', content: result.content }),
    isConcurrencySafe: () => true,
  }))

  register(defineTool({
    name: 'omv_workspace_search',
    description: 'Search across OMV Evidence files, archived findings, campaigns, Radar events, and workspace activity.',
    parameters: { query: { type: 'string', required: true, description: 'Literal search phrase.' } },
    output: stringOutput(),
    async execute(args, exec) {
      return pretty(await scoped(workbench, exec.agent?.session.header.cwd).search(args.query))
    },
    presentCall: args => ({ card: 'generic', title: `搜索 OMV · ${args.query}`, kind: 'read', rawInput: args.query }),
    presentResult: (args, result) => ({ card: 'generic', title: `OMV 搜索结果 · ${args.query}`, content: result.content }),
    isConcurrencySafe: () => true,
  }))

  register(defineTool({
    name: 'omv_campaign_run_inspect',
    description: 'Inspect a durable Campaign Runner execution, its lane/session states, retries, and event history.',
    parameters: { runId: { type: 'string', required: true, description: 'Campaign run id.' } },
    output: stringOutput(),
    async execute(args, exec) {
      const runner = scoped(workbench, exec.agent?.session.header.cwd).runner
      return pretty({ run: await runner.get(args.runId), history: await runner.history(args.runId) })
    },
    presentCall: args => ({ card: 'generic', title: `读取 Campaign Run · ${args.runId}`, kind: 'read', rawInput: args.runId, locations: [{ path: '.omv/.dsh/campaign-runs.json' }, { path: '.omv/.dsh/campaign-run-events.jsonl' }] }),
    presentResult: (args, result) => ({ card: 'generic', title: `Campaign Run · ${args.runId}`, content: result.content }),
    isConcurrencySafe: () => true,
  }))

  register(defineTool({
    name: 'omv_campaign_lane_update',
    description: 'Commit the current Campaign lane outcome. Every lane Agent must call this before it finishes.',
    parameters: {
      runId: { type: 'string', required: true, description: 'Campaign run id.' },
      laneId: { type: 'string', required: true, description: 'Campaign lane id.' },
      status: { type: 'string', required: true, description: 'completed, failed, blocked, or awaiting_evidence.' },
      summary: { type: 'string', required: true, description: 'Concise evidence-backed outcome or blocking reason.' },
    },
    output: stringOutput(),
    async execute(args, exec) {
      const agent = exec.agent
      if (agent === undefined) throw new Error('omv_campaign_lane_update requires a DSH Agent session')
      return pretty(await scoped(workbench, agent.session.header.cwd).action({
        action: 'campaign.run.lane.update',
        runId: args.runId,
        laneId: args.laneId,
        laneStatus: laneUpdateStatus(args.status),
        summary: args.summary,
        sessionId: agent.session.header.id,
      }))
    },
    presentCall: args => ({ card: 'generic', title: `提交 Lane 结果 · ${args.laneId}`, kind: 'edit', rawInput: args, locations: [{ path: '.omv/.dsh/campaign-runs.json' }, { path: '.omv/.dsh/campaign-run-events.jsonl' }] }),
    presentResult: (args, result) => ({ card: 'generic', title: `Lane 已更新 · ${args.laneId}`, content: result.content }),
  }))

  register(defineTool({
    name: 'omv_evidence_graph',
    description: 'Read the provenance-aware Evidence graph for one finding, including claim, source, sink, guard, reproducer, observations, sessions, and artifacts.',
    parameters: { id: { type: 'string', required: true, description: 'Finding id.' } },
    output: stringOutput(),
    async execute(args, exec) { return pretty((await scoped(workbench, exec.agent?.session.header.cwd).finding(args.id)).graph) },
    presentCall: args => ({ card: 'generic', title: `读取 Evidence Graph · ${args.id}`, kind: 'read', rawInput: args.id, locations: [findingLocation(args.id)] }),
    presentResult: (args, result) => ({ card: 'generic', title: `Evidence Graph · ${args.id}`, content: result.content }),
    isConcurrencySafe: () => true,
  }))

  register(defineTool({
    name: 'omv_quality_gate',
    description: 'Evaluate contextual evidence maturity and report conditions without treating research progress as one hard completion percentage.',
    parameters: { id: { type: 'string', required: true, description: 'Finding id.' } },
    output: stringOutput(),
    async execute(args, exec) { return pretty((await scoped(workbench, exec.agent?.session.header.cwd).finding(args.id)).qualityGate) },
    presentCall: args => ({ card: 'generic', title: `检查报告门禁 · ${args.id}`, kind: 'read', rawInput: args.id, locations: [findingLocation(args.id)] }),
    presentResult: (args, result) => ({ card: 'generic', title: `报告门禁 · ${args.id}`, content: result.content }),
    isConcurrencySafe: () => true,
  }))

  register(defineTool({
    name: 'omv_quality_overview',
    description: 'Read the workspace quality center queues, non-gating signal, and actionable evidence issues.',
    parameters: {},
    output: stringOutput(),
    async execute(_args, exec) { return pretty(await scoped(workbench, exec.agent?.session.header.cwd).action({ action: 'workspace.quality' })) },
    presentCall: () => ({ card: 'generic', title: '读取证据质量中心', kind: 'read' }),
    presentResult: (_args, result) => ({ card: 'generic', title: '证据质量中心', content: result.content }),
    isConcurrencySafe: () => true,
  }))

  register(defineTool({
    name: 'omv_dedup_scan',
    description: 'Scan a finding against local findings and passive Radar titles, then persist a dedup summary.',
    parameters: { id: { type: 'string', required: true, description: 'Finding id.' } },
    output: stringOutput(),
    async execute(args, exec) {
      const sessionId = exec.agent?.session.header.id
      return pretty(await scoped(workbench, exec.agent?.session.header.cwd).action({ action: 'dedup.scan', id: args.id, ...(sessionId === undefined ? {} : { sessionId }) }))
    },
    presentCall: args => ({ card: 'generic', title: `扫描去重情报 · ${args.id}`, kind: 'edit', rawInput: args.id, locations: [findingLocation(args.id), { path: '.omv/.dsh/dedup.json' }] }),
    presentResult: (args, result) => ({ card: 'generic', title: `去重扫描完成 · ${args.id}`, content: result.content }),
  }))

  register(defineTool({
    name: 'omv_review_update',
    description: 'Update a finding review status and optional assignee, keeping collaboration state durable.',
    parameters: {
      id: { type: 'string', required: true, description: 'Finding id.' },
      status: { type: 'string', required: true, description: 'unreviewed, in_review, changes_requested, approved, or rejected.' },
      assignee: { type: 'string', description: 'Optional reviewer or owner.' },
    },
    output: stringOutput(),
    async execute(args, exec) {
      const sessionId = exec.agent?.session.header.id
      return pretty(await scoped(workbench, exec.agent?.session.header.cwd).action({ action: 'review.update', id: args.id, reviewStatus: reviewStatus(args.status), ...(args.assignee === undefined ? {} : { assignee: args.assignee }), ...(sessionId === undefined ? {} : { sessionId }) }))
    },
    presentCall: args => ({ card: 'generic', title: `更新协作评审 · ${args.id}`, kind: 'edit', rawInput: args, locations: [findingLocation(args.id), { path: '.omv/.dsh/reviews.json' }] }),
    presentResult: (args, result) => ({ card: 'generic', title: `协作评审已更新 · ${args.id}`, content: result.content }),
  }))

  register(defineTool({
    name: 'omv_review_note',
    description: 'Append a durable review note to a finding for later audit and report context.',
    parameters: {
      id: { type: 'string', required: true, description: 'Finding id.' },
      body: { type: 'string', required: true, description: 'Review note body.' },
      author: { type: 'string', description: 'Optional author label.' },
    },
    output: stringOutput(),
    async execute(args, exec) {
      const sessionId = exec.agent?.session.header.id
      return pretty(await scoped(workbench, exec.agent?.session.header.cwd).action({ action: 'review.note.add', id: args.id, body: args.body, ...(args.author === undefined ? {} : { author: args.author }), ...(sessionId === undefined ? {} : { sessionId }) }))
    },
    presentCall: args => ({ card: 'generic', title: `记录评审意见 · ${args.id}`, kind: 'edit', rawInput: args, locations: [findingLocation(args.id), { path: '.omv/.dsh/reviews.json' }] }),
    presentResult: (args, result) => ({ card: 'generic', title: `评审意见已记录 · ${args.id}`, content: result.content }),
  }))

  register(defineTool({
    name: 'omv_report_prepare',
    description: 'Generate or refresh a report draft and provenance pack for a finding.',
    parameters: { id: { type: 'string', required: true, description: 'Finding id.' } },
    output: stringOutput(),
    async execute(args, exec) {
      const sessionId = exec.agent?.session.header.id
      return pretty(await scoped(workbench, exec.agent?.session.header.cwd).action({ action: 'report.prepare', id: args.id, ...(sessionId === undefined ? {} : { sessionId }) }))
    },
    presentCall: args => ({ card: 'generic', title: `准备报告材料 · ${args.id}`, kind: 'edit', rawInput: args.id, locations: [findingLocation(args.id), { path: `.omv/reports/${args.id}` }] }),
    presentResult: (args, result) => ({ card: 'generic', title: `报告材料已准备 · ${args.id}`, content: result.content }),
  }))

  register(defineTool({
    name: 'omv_disclosure_schedule',
    description: 'Schedule a vendor, CNA, public, or internal disclosure checkpoint for a finding.',
    parameters: {
      id: { type: 'string', required: true, description: 'Finding id.' },
      date: { type: 'string', required: true, description: 'Due date in YYYY-MM-DD format.' },
      channel: { type: 'string', required: true, description: 'vendor, cna, public, or internal.' },
      recipient: { type: 'string', description: 'Optional recipient or tracking destination.' },
      notes: { type: 'string', description: 'Optional timeline notes.' },
    },
    output: stringOutput(),
    async execute(args, exec) {
      const sessionId = exec.agent?.session.header.id
      return pretty(await scoped(workbench, exec.agent?.session.header.cwd).action({ action: 'disclosure.schedule', id: args.id, disclosureDate: args.date, disclosureChannel: disclosureChannel(args.channel), ...(args.recipient === undefined ? {} : { target: args.recipient }), ...(args.notes === undefined ? {} : { body: args.notes }), ...(sessionId === undefined ? {} : { sessionId }) }))
    },
    presentCall: args => ({ card: 'generic', title: `排期披露节点 · ${args.id}`, kind: 'edit', rawInput: args, locations: [{ path: '.omv/.dsh/disclosures.json' }] }),
    presentResult: (args, result) => ({ card: 'generic', title: `披露节点已排期 · ${args.id}`, content: result.content }),
  }))

  register(defineTool({
    name: 'omv_repro_run_start',
    description: 'Start a durable reproduction attempt and correlate it with the current DSH session.',
    parameters: {
      id: { type: 'string', required: true, description: 'Finding id.' },
      command: { type: 'string', description: 'Exact local reproduction command or script path.' },
      artifacts: { type: 'string', description: 'Comma-separated artifact paths expected from the run.' },
    },
    output: stringOutput(),
    async execute(args, exec) {
      const sessionId = exec.agent?.session.header.id
      return pretty(await scoped(workbench, exec.agent?.session.header.cwd).action({
        action: 'repro.run.start', id: args.id,
        ...(sessionId === undefined ? {} : { sessionId }),
        ...(args.command === undefined ? {} : { command: args.command }),
        ...(args.artifacts === undefined ? {} : { artifacts: csv(args.artifacts) }),
      }))
    },
    presentCall: args => ({ card: 'generic', title: `开始复现 Run · ${args.id}`, kind: 'edit', rawInput: args, locations: [findingLocation(args.id), { path: '.omv/.dsh/reproduction-runs.json' }] }),
    presentResult: (args, result) => ({ card: 'generic', title: `复现 Run 已创建 · ${args.id}`, content: result.content }),
  }))

  register(defineTool({
    name: 'omv_repro_run_finish',
    description: 'Finish a durable reproduction attempt with its observed status, exit code, output, and artifacts.',
    parameters: {
      runId: { type: 'string', required: true, description: 'Reproduction run id.' },
      status: { type: 'string', required: true, description: 'passed, failed, or blocked.' },
      exitCode: { type: 'number', description: 'Observed process exit code.' },
      output: { type: 'string', description: 'Concise observed stdout/stderr.' },
      artifacts: { type: 'string', description: 'Comma-separated artifact paths produced by the run.' },
    },
    output: stringOutput(),
    async execute(args, exec) {
      const sessionId = exec.agent?.session.header.id
      return pretty(await scoped(workbench, exec.agent?.session.header.cwd).action({
        action: 'repro.run.finish', runId: args.runId, reproStatus: reproFinishStatus(args.status),
        ...(sessionId === undefined ? {} : { sessionId }),
        ...(args.exitCode === undefined ? {} : { exitCode: args.exitCode }),
        ...(args.output === undefined ? {} : { outputText: args.output }),
        ...(args.artifacts === undefined ? {} : { artifacts: csv(args.artifacts) }),
      }))
    },
    presentCall: args => ({ card: 'generic', title: `完成复现 Run · ${args.runId}`, kind: 'edit', rawInput: args, locations: [{ path: '.omv/.dsh/reproduction-runs.json' }] }),
    presentResult: (args, result) => ({ card: 'generic', title: `复现 Run 已完成 · ${args.runId}`, content: result.content }),
  }))

  register(defineTool({
    name: 'omv_radar_candidate',
    description: 'Convert a reviewed Radar queue signal into a new Evidence.v1 candidate finding.',
    parameters: {
      queueId: { type: 'string', required: true, description: 'Radar queue item id.' },
      findingId: { type: 'string', description: 'Optional explicit finding id.' },
    },
    output: stringOutput(),
    async execute(args, exec) {
      return pretty(await scoped(workbench, exec.agent?.session.header.cwd).action({
        action: 'radar.queue.convert', id: args.queueId,
        ...(args.findingId === undefined ? {} : { findingId: args.findingId }),
      }))
    },
    presentCall: args => ({ card: 'generic', title: `Radar → Candidate · ${args.queueId}`, kind: 'edit', rawInput: args }),
    presentResult: (args, result) => ({ card: 'generic', title: `Radar Candidate 已创建 · ${args.queueId}`, content: result.content }),
  }))
}

function scoped(workbench: OmvWorkbench, cwd: string | undefined): OmvWorkbench {
  return cwd === undefined ? workbench : workbench.scoped(cwd)
}

function stringOutput() {
  return {
    schema: { type: 'string' as const },
    render: (_args: unknown, value: string) => [{ type: 'text' as const, text: value }],
  }
}

function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

/** Central cancellation guard for every OMV tool body. */
function withSignal(definition: ToolDefinition): ToolDefinition {
  return {
    ...definition,
    async execute(args, exec) {
      exec.signal.throwIfAborted()
      const value = await definition.execute(args, exec)
      exec.signal.throwIfAborted()
      return value
    },
  }
}

function findingLocation(id: string): { path: string } {
  return { path: `.omv/findings/${id}.yaml` }
}

function campaignLocation(id: string): { path: string } {
  return { path: `.omv/campaigns/${id}.yaml` }
}

function evidenceStatus(value: string): 'candidate' | 'confirmed' | 'blocked' {
  if (value === 'candidate' || value === 'confirmed' || value === 'blocked') return value
  throw new Error('status must be candidate, confirmed, or blocked')
}

function researcherGoal(value: string): 'VulDB' | 'CVE' | 'advisory' | 'triage' {
  if (value === 'VulDB' || value === 'CVE' || value === 'advisory' || value === 'triage') return value
  throw new Error('researcherGoal must be one of: VulDB, CVE, advisory, triage')
}

function workflowIntent(value: string): 'audit' | 'repro' | 'dedup' | 'critic' | 'report' | 'disclose' {
  if (value === 'audit' || value === 'repro' || value === 'dedup' || value === 'critic' || value === 'report' || value === 'disclose') return value
  throw new Error('intent must be audit, repro, dedup, critic, report, or disclose')
}

function laneUpdateStatus(value: string): 'completed' | 'failed' | 'blocked' | 'awaiting_evidence' {
  if (value === 'completed' || value === 'failed' || value === 'blocked' || value === 'awaiting_evidence') return value
  throw new Error('status must be completed, failed, blocked, or awaiting_evidence')
}

function reproFinishStatus(value: string): 'passed' | 'failed' | 'blocked' {
  if (value === 'passed' || value === 'failed' || value === 'blocked') return value
  throw new Error('status must be passed, failed, or blocked')
}

function reviewStatus(value: string): 'unreviewed' | 'in_review' | 'changes_requested' | 'approved' | 'rejected' {
  if (value === 'unreviewed' || value === 'in_review' || value === 'changes_requested' || value === 'approved' || value === 'rejected') return value
  throw new Error('status must be unreviewed, in_review, changes_requested, approved, or rejected')
}

function disclosureChannel(value: string): 'vendor' | 'cna' | 'public' | 'internal' {
  if (value === 'vendor' || value === 'cna' || value === 'public' || value === 'internal') return value
  throw new Error('channel must be vendor, cna, public, or internal')
}

function csv(value: string): string[] { return value.split(/[,\n]/u).map(item => item.trim()).filter(Boolean) }
