# Evidence Graph 与 Docker-first PoC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 `dsh-omv` 中交付可交互的 Evidence Graph、DOT/Mermaid 导出，以及 Agent 生成请求驱动的 Docker 隔离 PoC 生成与验证闭环。

**Architecture:** 保持 `oh-my-vul` Evidence.v1 为事实源，在 `evidence-graph.ts` 和新 PoC 服务中构建确定性的派生读写模型。Host 通过 `OmvWorkbench`、`/action`、Tools 和持久化 `.omv/.dsh` 状态提供能力，Client 通过 Cytoscape.js 渲染图谱；PoC 只允许受限 Docker 执行，Docker 不可用时返回 `blocked`，不执行宿主机 fallback。

**Tech Stack:** TypeScript strict、Vitest、React、Cytoscape.js、Node `execFile`、Docker CLI、现有 DSH Cordis/Tools/HTTP seams。

---

## 文件责任地图

### 新增

- `src/poc-generator.ts`：漏洞类型到 PoC 模板和 Agent 生成请求的确定性映射。
- `src/poc-executor.ts`：PoC Draft 校验、Docker 参数构建、Docker 执行和结构化结果解析。
- `src/poc-store.ts`：PoC Draft/Run JSON 与 JSONL 事件的串行持久化。
- `src/client/graph-view.tsx`：Cytoscape 实例生命周期、图谱交互、CodeRef 回调和导出下载。
- `src/client/graph-styles.ts`：Evidence Graph 专用 CSS，复用现有 DSH alias。
- `tests/evidence-graph.test.ts`：图分析、CodeRef、导出格式测试。
- `tests/poc-generator.test.ts`：模板选择和生成请求测试。
- `tests/poc-executor.test.ts`：静态校验、Docker 参数和结果状态测试。
- `tests/client-graph.test.ts`：Client 图元素投影和 PoC 状态投影测试。

### 修改

- `src/contracts.ts`：Graph analysis、PoC Draft/Run、Action 和配置类型。
- `src/evidence-graph.ts`：CodeRef 投影、主路径分析、DOT/Mermaid 导出。
- `src/workbench.ts`：Graph export、PoC generate/validate/inspect Action、PoC 持久化服务协调。
- `src/tools.ts`：`omv_generate_poc`、`omv_validate_poc`，扩展 `omv_evidence_graph`。
- `src/commands.ts`：增加 `/omv-poc` 摘要命令。
- `src/client/pages.tsx`：用 `EvidenceGraphView` 替换静态图谱并显示 PoC 状态。
- `src/client/index.tsx`：传递 Graph/PoC 回调和 Action 状态。
- `src/client/runtime.ts`：导出下载和 PoC 状态标签辅助函数。
- `src/client/types.ts`：Graph/PoC UI 回调类型和图谱筛选状态。
- `src/index.ts`：新增 PoC 配置 Schema 和默认值。
- `package.json` / `package-lock.json`：加入 `cytoscape` 依赖。
- `cordis.patch.yml`：复述新增配置默认值。
- `contracts/dsh-omv-api.v2.json`：更新 v2 additive payload 合同。
- `README.zh-CN.md` / `docs/architecture.md`：记录新工具、图谱和 PoC 安全边界。

---

### Task 1: 锁定共享合同和配置边界

**Files:**
- Modify: `src/contracts.ts`
- Modify: `src/index.ts`
- Modify: `cordis.patch.yml`
- Test: `tests/config.test.ts`

- [ ] **Step 1: Write the failing test**

在 `tests/config.test.ts` 增加 Given/When/Then 测试：默认配置包含 `pocEnabled: true`、`pocAllowNetwork: false`、有限的脚本/输出大小和 Docker 资源限制；越界值（`pocTimeoutMs <= 0`、`pocMemoryMb <= 0`、`pocPidLimit <= 0`、空镜像 allowlist）被拒绝。

```ts
it('uses conservative Docker PoC defaults', () => {
  const config = Config({})
  expect(config.pocEnabled).toBe(true)
  expect(config.pocAllowNetwork).toBe(false)
  expect(config.pocDockerImages.length).toBeGreaterThan(0)
})
```

- [ ] **Step 2: Run the focused test and verify the expected failure**

Run: `npm test -- tests/config.test.ts`

Expected: FAIL because the new config fields do not exist.

- [ ] **Step 3: Implement the minimum contract**

Add readonly config fields and discriminated unions for `EvidenceGraphAnalysis`, `PocStatus`, `PocDraft`, `PocRun`, `PocGenerationRequest`, and PoC Action payloads. Extend `Config`/`Config` Schema with conservative defaults and bounds. Keep all new graph fields additive.

- [ ] **Step 4: Run focused tests and typecheck**

Run: `npm test -- tests/config.test.ts && npm run typecheck`

Expected: PASS and no new TypeScript errors.

- [ ] **Step 5: Run the full pre-change regression suite**

Run: `npm test`

Expected: Existing tests pass before feature-specific work begins.

---

### Task 2: Add deterministic Evidence Graph analysis and CodeRef projection

**Files:**
- Modify: `src/evidence-graph.ts`
- Modify: `src/contracts.ts`
- Create: `tests/evidence-graph.test.ts`

- [ ] **Step 1: Write failing analysis tests**

Add a local `buildFixtureGraph()` helper in `tests/evidence-graph.test.ts` with `source → sink → guard`, a missing guard case, a reproducer without observation, and an unrelated artifact. Assert only the machine contract: primary path IDs, highlighted edge IDs, missing guard IDs, disconnected IDs, and parsed `codeRef` fields.

```ts
it('marks the source-to-sink-to-guard chain as the critical path', () => {
  const graph = buildFixtureGraph()
  const result = analyzeEvidenceGraph(graph)
  expect(result.primaryPath).toEqual(['finding:f-1:source', 'finding:f-1:sink', 'finding:f-1:guard'])
  expect(result.missingGuards).toEqual([])
})
```

- [ ] **Step 2: Run the new test and verify it fails for missing exports**

Run: `npm test -- tests/evidence-graph.test.ts`

Expected: FAIL because `analyzeEvidenceGraph` and the new graph fields are not implemented.

- [ ] **Step 3: Implement the minimal pure functions**

Add `analyzeEvidenceGraph(graph)` using existing node IDs and edge relations. Add `codeRef?: CodeRef` to graph nodes and call `parseCodeRef` during graph construction. Do not read files, call a model, or mutate Evidence in the analysis function.

- [ ] **Step 4: Run graph tests and typecheck**

Run: `npm test -- tests/evidence-graph.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Add edge-case tests**

Cover unknown Guard values, missing Guard node, disconnected context nodes, and an observation that is still `unknown`. Assert stable IDs and statuses rather than serialized prose.

- [ ] **Step 6: Run the focused suite again**

Run: `npm test -- tests/evidence-graph.test.ts`

Expected: PASS with all graph edge cases covered.

---

### Task 3: Add safe DOT and Mermaid exporters

**Files:**
- Modify: `src/evidence-graph.ts`
- Test: `tests/evidence-graph.test.ts`

- [ ] **Step 1: Write failing export tests**

Add a local `graphWithLabel(label: string)` fixture helper and assert DOT and Mermaid output contains every node/edge, uses stable IDs, and escapes quotes, newlines, backslashes, Mermaid brackets, and untrusted Evidence labels.

```ts
it('escapes untrusted graph labels in DOT output', () => {
  const output = exportEvidenceGraph(graphWithLabel('"\n'), 'dot')
  expect(output).toContain('\\"')
  expect(output).not.toContain('"\n')
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test -- tests/evidence-graph.test.ts`

Expected: FAIL because exporters do not exist.

- [ ] **Step 3: Implement both exporters**

Add `exportEvidenceGraph(graph, format)` with an exhaustive format switch. Use one shared node/edge projection; do not create a second graph representation. Keep output deterministic by preserving graph node/edge order.

- [ ] **Step 4: Verify graph tests and package typecheck**

Run: `npm test -- tests/evidence-graph.test.ts && npm run typecheck`

Expected: PASS.

---

### Task 4: Add the Agent-facing PoC generator

**Files:**
- Create: `src/poc-generator.ts`
- Create: `tests/poc-generator.test.ts`

- [ ] **Step 1: Write failing template-selection tests**

Add a local `findingWithClass(vulnerabilityClass: string)` fixture helper. Test SSRF, path traversal, command injection, XSS, SQL/NoSQL injection, XXE, file upload, and an unknown vulnerability class. Assert `templateId`, language, image, `requiresNetwork`, and machine-readable safety constraints.

```ts
it('creates an SSRF generation request without executing anything', () => {
  const request = createPocGenerationRequest(findingWithClass('ssrf'))
  expect(request.templateId).toBe('ssrf-python')
  expect(request.requiresNetwork).toBe(true)
  expect(request.safetyConstraints.allowHostNetwork).toBe(false)
})
```

- [ ] **Step 2: Run the new tests and verify the expected failure**

Run: `npm test -- tests/poc-generator.test.ts`

Expected: FAIL because the generator module does not exist.

- [ ] **Step 3: Implement deterministic generator output**

Add typed template definitions and `createPocGenerationRequest(input)`. Extract only structured Evidence/CodeRef context, cap prompt/context size, and return a `needs_review` safety note for unsupported classes. Do not import an LLM SDK or execute a script.

- [ ] **Step 4: Verify generator tests and typecheck**

Run: `npm test -- tests/poc-generator.test.ts && npm run typecheck`

Expected: PASS.

---

### Task 5: Implement PoC validation and Docker command construction

**Files:**
- Create: `src/poc-executor.ts`
- Create: `tests/poc-executor.test.ts`

- [ ] **Step 1: Write failing safety tests**

Add a local `validDraft()` fixture helper. Cover empty scripts, unsupported languages, absolute host paths, disallowed images, `docker.sock`, privileged flags, host network, network-required PoCs when network is disabled, and fixed language entrypoints.

```ts
it('rejects a request that attempts to mount docker.sock', () => {
  expect(() => validatePocDraft({ ...validDraft(), script: 'mount /var/run/docker.sock' })).toThrow()
})
```

- [ ] **Step 2: Run tests and verify the expected failure**

Run: `npm test -- tests/poc-executor.test.ts`

Expected: FAIL because the executor and validator do not exist.

- [ ] **Step 3: Implement typed validation and argument construction**

Define `CommandRunner`, `PocExecutor`, `validatePocDraft`, and `dockerArgsForDraft`. Use `execFile`-compatible argv arrays. Generate only:

```text
docker run --rm --network none --read-only --cap-drop ALL
  --security-opt no-new-privileges --pids-limit <limit>
  --memory <memory>m --cpus <cpu>
  --tmpfs /tmp:rw,noexec,nosuid,nodev,size=16m
```

Mount the script read-only and an isolated output directory read-write. Reject any caller-provided argument that could alter the safety profile.

- [ ] **Step 4: Verify safety tests and diagnostics**

Run: `npm test -- tests/poc-executor.test.ts && npm run typecheck`

Expected: PASS and no diagnostics on `src/poc-executor.ts`.

- [ ] **Step 5: Add command-runner result tests**

Use a narrow in-memory `CommandRunner` fake to prove Docker unavailable maps to `blocked`, timeout maps to `failed` with a timeout reason, non-zero exit maps to `failed`, and zero exit without a result file maps to `needs_review`.

- [ ] **Step 6: Verify the executor suite**

Run: `npm test -- tests/poc-executor.test.ts`

Expected: PASS without requiring Docker on the developer machine.

---

### Task 6: Add durable PoC Draft/Run persistence and Evidence feedback

**Files:**
- Modify: `src/workbench.ts`
- Create: `src/poc-store.ts`
- Modify: `tests/workbench.test.ts`
- Test: `tests/poc-executor.test.ts`

- [ ] **Step 1: Write failing Workbench Action tests**

Add a local `needsReviewRequest()` fixture helper. Test `poc.generate` creates a Draft, `poc.validate` stores a Run, and only a structured `passed` result updates `evidence.observed_result` and `evidence.repro_artifacts`.

```ts
it('does not write confirmation Evidence for a needs-review PoC', async () => {
  const result = await workbench.action(needsReviewRequest())
  expect(result.status).toBe('needs_review')
  expect((await workbench.finding('f-1')).evidence.evidence.observed_result).toBe('unknown')
})
```

- [ ] **Step 2: Run the focused integration test and verify failure**

Run: `npm test -- tests/workbench.test.ts`

Expected: FAIL because the PoC Action cases do not exist.

- [ ] **Step 3: Implement serial durable stores and Action cases**

Use `src/poc-store.ts` for `.omv/.dsh/poc-drafts.json`, `.omv/.dsh/poc-runs.json`, and `.omv/.dsh/poc-run-events.jsonl`; use temp-file rename and a serialized write tail. Route `poc.generate`, `poc.validate`, and `poc.run.inspect` through Workbench. On `passed`, call the existing reproduction Evidence writer instead of duplicating YAML mutation logic.

- [ ] **Step 4: Verify Workbench integration**

Run: `npm test -- tests/workbench.test.ts tests/poc-executor.test.ts && npm run typecheck`

Expected: PASS; failed, blocked, and needs_review runs retain logs without changing confirmation Evidence.

---

### Task 7: Expose graph analysis/export and PoC operations through Host seams

**Files:**
- Modify: `src/tools.ts`
- Modify: `src/commands.ts`
- Modify: `src/index.ts`
- Modify: `contracts/dsh-omv-api.v2.json`
- Test: `tests/http.test.ts`
- Test: `tests/service.test.ts`

- [ ] **Step 1: Write failing seam tests**

Assert `omv_evidence_graph` exposes analysis/export options, `omv_generate_poc` returns a generation request, `omv_validate_poc` returns a typed status, `/omv-poc` summarizes a Run, and protocol v2 includes additive graph/PoC fields while mutation gating still rejects writes when disabled.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm test -- tests/http.test.ts tests/service.test.ts`

Expected: FAIL because the new Tool/Command registrations and contract branches are absent.

- [ ] **Step 3: Implement the Host registrations**

Follow existing `defineTool` presentation, `withSignal` cancellation, `locations`, and exclusive mutation patterns. Add typed request parsing at the action boundary. Add the PoC config to `Config` and pass it into Workbench/Executor.

- [ ] **Step 4: Verify Host seams and complete typecheck**

Run: `npm test -- tests/http.test.ts tests/service.test.ts && npm run typecheck && npm run typecheck:tests`

Expected: PASS.

---

### Task 8: Add Cytoscape Graph View and replace the static Finding graph

**Files:**
- Create: `src/client/graph-view.tsx`
- Create: `src/client/graph-styles.ts`
- Modify: `src/client/pages.tsx`
- Modify: `src/client/index.tsx`
- Modify: `src/client/runtime.ts`
- Modify: `src/client/types.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Test: `tests/client-graph.test.ts`

- [ ] **Step 1: Write the failing component/projection tests**

Test the exported pure `graphElements()` projection for node/edge counts, critical-path classes, missing Guard classes, and CodeRef data. Keep Cytoscape DOM behavior, node clicks, semantic fallback, and export controls for the required real-browser Playwright QA because the current Vitest setup has no React DOM harness.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npm test -- tests/client-graph.test.ts`

Expected: FAIL because `EvidenceGraphView` does not exist.

- [ ] **Step 3: Add Cytoscape and implement the minimal view**

Use `useRef`/`useEffect` to initialize Cytoscape with graph elements and DSH token-based styles, run a path-first layout, bind node tap handlers, and call `destroy()` during cleanup. Keep context filtering and fit actions in the component; keep file download and label mapping in small helpers.

- [ ] **Step 4: Integrate into FindingDetail**

Replace `.omv-graph-flow` with `EvidenceGraphView`; pass `payload.graph`, `onOpenPath`, and graph export callbacks through existing page/Workbench state. Keep the existing static chain cards as the compact summary above the interactive graph.

- [ ] **Step 5: Verify TypeScript and build**

Run: `npm test -- tests/client-graph.test.ts && npm run typecheck && npm run build`

Expected: PASS and both Host and browser bundles build.

- [ ] **Step 6: Run real-browser visual QA**

Use Playwright against the built DSH Web surface at 375, 768, and 1280 widths. Verify node click, context toggle, missing Guard styling, fit, export download, keyboard access, and cleanup after switching Findings. Record any accepted visual debt in the review notes.

---

### Task 9: Add PoC status UI, docs, and compatibility contract

**Files:**
- Modify: `src/client/pages.tsx`
- Modify: `src/client/runtime.ts`
- Modify: `README.zh-CN.md`
- Modify: `docs/architecture.md`
- Modify: `cordis.patch.yml`
- Modify: `contracts/dsh-omv-api.v2.json`

- [ ] **Step 1: Write a failing UI contract test**

Assert a `blocked`/`needs_review` Run shows its reason and next action, while only `passed` shows the Evidence-written state.

- [ ] **Step 2: Run the test and verify failure**

Run: `npm test -- tests/client-graph.test.ts`

Expected: FAIL until the PoC status projection exists.

- [ ] **Step 3: Implement status projection and documentation**

Add state labels/colors using existing runtime helpers, show Draft/Run details in Finding detail, document Docker security defaults and no-host-fallback behavior, and keep patch config values synchronized with `Config` defaults. Update the v2 contract snapshot with additive fields only.

- [ ] **Step 4: Verify docs/config/test surfaces**

Run: `npm run typecheck && npm run typecheck:tests && npm test`

Expected: PASS.

---

### Task 10: Full verification and code-quality review

**Files:**
- Review: all changed files from Tasks 1–9

- [ ] **Step 1: Run the complete quality gate**

Run: `npm run check`

Expected: typecheck, test, build, and package dry-run all pass.

- [ ] **Step 2: Run diagnostics on every changed TypeScript/TSX file**

Use `lsp_diagnostics` on each changed source and test file. Expected: no errors introduced by this feature.

- [ ] **Step 3: Review safety invariants manually**

Confirm no new code uses `as any`, `@ts-ignore`, shell interpolation, `--privileged`, `--network host`, Docker socket mounts, or host fallback execution. Confirm no failed/blocked/needs_review result writes confirmation Evidence.

- [ ] **Step 4: Measure changed file size and split oversized files if needed**

Run: `awk '!/^[[:space:]]*$/ && !/^[[:space:]]*(\/\/|#|--)/' src/poc-generator.ts src/poc-executor.ts src/poc-store.ts src/client/graph-view.tsx src/client/graph-styles.ts tests/evidence-graph.test.ts tests/poc-generator.test.ts tests/poc-executor.test.ts | wc -l`. Keep each new focused module below the project’s 250 pure-LOC ceiling; do not expand the already-large page/style files with unrelated helpers.

- [ ] **Step 5: Inspect the final diff without committing**

Run: `git status --short && git diff --stat && git diff --check`

Expected: only the planned files and the untracked design/plan documents are present; no secrets, generated `.omv` state, screenshots, or build archives are included.

---

## Execution order and checkpoints

1. Tasks 1–3 establish contracts and pure graph behavior.
2. Tasks 4–6 establish PoC generation, safe execution, persistence, and Evidence feedback.
3. Task 7 exposes stable Host seams.
4. Tasks 8–9 add the Client surface and documentation.
5. Task 10 runs the full verification gate.

Every production change must follow red → green → refactor. Do not commit unless the user explicitly requests a commit; this plan intentionally leaves integration to the user.
