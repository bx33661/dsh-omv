# Evidence Graph 与 PoC 验证框架设计

## 目标

在现有 `dsh-omv` 垂直架构中增加两个能力：

1. 将现有 `EvidenceGraph` 渲染为可交互的、可定位 CodeRef 的证据图谱，并支持 DOT/Mermaid 导出。
2. 根据 Finding 的漏洞类型和证据生成结构化 PoC 请求，由 DSH Agent 补全脚本，再使用受限 Docker 执行并把可信的复现结果回写到 Evidence。

本设计不改变 `oh-my-vul` 的 Evidence.v1 权威 schema，不在 Host 内绑定 LLM 供应商，不在 Docker 不可用时执行宿主机脚本。

## 已确认的设计决策

- 图谱采用混合布局：默认突出 `source → sink → guard`，同时可展开 claim、reproducer、observation、session、artifact 等上下文节点。
- 图谱分析首版使用确定性规则，不使用 LLM，保证同一 Evidence 得到可重复结果。
- 图谱 Client 使用 Cytoscape.js，默认使用稳定的层次布局；实例在 React cleanup 时销毁。
- PoC 生成采用“确定性模板 + Agent 生成请求”：Host 只负责提取上下文、选择模板、校验脚本和执行。
- PoC 执行首版只实现本机 Docker Provider；未来可替换为远程 Docker Provider，但不在本轮实现 SSH/远程执行。
- Docker 是唯一自动执行后端。Docker 不可用、镜像缺失或安全条件不满足时，状态为 `blocked`。
- 宿主机执行永远不是自动 fallback；如未来增加本地执行，必须是单独的显式配置和独立 Provider。
- Docker 默认无网络；需要网络的 PoC 必须由配置显式允许，否则直接 `blocked`。
- Docker 进程必须通过参数数组调用，禁止 shell 字符串拼接。
- 只有带有结构化结果文件且结果为 `passed` 的 PoC，才可以回写 `observed_result` 和 `repro_artifacts`。
- 不新增未经 `oh-my-vul` schema 支持的 `reproduction_confirmed` 字段；复用现有 `ReproductionRun` 与 Evidence 字段。

## 当前上下文

当前项目已经具备：

- `src/evidence-graph.ts`：从 Finding Evidence、Workflow history 和 ReproductionRun 构建节点和边。
- `src/code-ref.ts`：从 Evidence 文本或结构化对象提取 `path`、`line`、`endLine`、`note`。
- `src/workbench.ts`：聚合读模型和所有 Action 路由。
- `src/client/pages.tsx`：Finding 详情中的静态证据图谱区域。
- `src/client/index.tsx`：DSH slot、API、会话和路径打开能力。
- `src/tools.ts`：原生 DSH Tool 注册和 Tool presentation。
- `src/contracts.ts`：Host/Client 共享协议类型。
- `src/reproduction.ts`：结构化复现 Run 持久化。
- `src/workbench.ts::writeReproductionEvidence()`：成功复现结果的 Evidence 回写入口。

Evidence Graph 的当前节点种类为：

```text
finding / claim / source / sink / guard /
reproducer / observation / session / artifact
```

## Evidence Graph 设计

### 数据合同

保持现有 `EvidenceGraph` 的 `nodes` 和 `edges` 字段不变，在协议 v2 中增加可选的派生分析对象：

```ts
interface EvidenceGraphAnalysis {
  primaryPath: string[]
  highlightedNodes: string[]
  highlightedEdges: string[]
  missingGuards: string[]
  disconnectedNodes: string[]
}
```

`EvidenceGraph` 增加：

```ts
analysis?: EvidenceGraphAnalysis
```

节点增加可选 `codeRef`，其类型复用 `CodeRef`：

```ts
codeRef?: CodeRef
```

`codeRef` 由 `buildEvidenceGraph()` 在生成节点时调用 `parseCodeRef()` 得到；它是 Evidence 的投影，不是第二份事实来源。

### 图谱分析

增加纯函数 `analyzeEvidenceGraph(graph)`：

1. 识别 `source`、`sink`、`guard` 节点。
2. 沿已有边和 relation 寻找主路径。
3. 将主路径节点和边加入 `highlightedNodes` / `highlightedEdges`。
4. Guard 不存在、Guard 值为 unknown 或 sink 到 guard 的关系不完整时，将 Guard 标记为 `missingGuards`。
5. 将不能从 Finding/Claim 连接到主路径的节点加入 `disconnectedNodes`。
6. 对 `reproducer → observation` 未闭环的情况保留节点，但由 Client 以 `unverified` 状态显示。

算法只使用当前图数据，不读取网络，不调用模型，不修改 Evidence。

### DOT 与 Mermaid 导出

增加两个纯函数：

```ts
exportEvidenceGraph(graph, 'dot'): string
exportEvidenceGraph(graph, 'mermaid'): string
```

要求：

- 节点 ID 映射为稳定且安全的导出标识符。
- 标签、换行、引号、反斜杠和 Mermaid 特殊字符必须转义。
- 导出使用与 UI 相同的节点和边，不重复实现一套图模型。
- 导出结果可以由 `finding.graph.export` Action 和 `omv_evidence_graph` Tool 获取。
- Client 可将导出内容下载为 `.dot` 或 `.mmd` 文件。

### Client 交互

新增 `src/client/graph-view.tsx`，职责仅包括图谱投影、Cytoscape 生命周期和交互，不负责读取 `.omv` 文件。

默认视图：

- 主画布使用 path-first 层次布局。
- `source → sink → guard` 作为关键路径。
- `claim`、`reproducer`、`observation`、`session`、`artifact` 作为可展开上下文。
- 缺失 Guard 使用警示色。
- 未验证 Observation 使用未完成状态。

交互：

- 点击节点显示节点类型、Evidence path、状态、CodeRef 和下一步。
- 有 CodeRef 时调用现有 `openPath(ref.path)`；DSH 当前只提供路径打开能力，行号在详情中显示。
- “只看关键路径”隐藏上下文节点。
- “显示上下文”恢复完整图谱。
- “适应画布”执行 Cytoscape fit。
- “导出 DOT”和“导出 Mermaid”使用 Host 返回的导出数据或同一纯函数生成下载内容。
- 提供语义化节点/边列表作为无障碍后备，不把 Canvas 作为唯一信息载体。
- React effect cleanup 显式调用 `cy.destroy()`。

Finding 详情中用 `EvidenceGraphView` 替换当前 `.omv-graph-flow` 静态区域，同时保留节点数和边数摘要。

## PoC 设计

### 生成边界

新增 `src/poc-generator.ts`，不直接调用 LLM。

输入为 Finding 详情、Evidence、CodeRef 和漏洞类型；输出为结构化 `PocGenerationRequest`：

```text
templateId
language: python | bash | curl
recommendedImage
requiresNetwork
context
generationPrompt
resultProtocol
safetyConstraints
```

首版模板覆盖常见类别：

- SSRF
- path traversal
- command injection
- XSS
- SQL/NoSQL injection
- XXE
- file upload

未覆盖的漏洞类型返回通用模板请求，并要求 Agent 进入 `needs_review` 路径，不自动声称可执行。

DSH Agent 使用请求生成脚本，再把脚本作为结构化参数传回 `omv_validate_poc`。Host 不绑定模型 API Key 或模型 SDK。

### Draft 与 Run

新增类型：

```text
PocDraft
├── id
├── findingId
├── templateId
├── language
├── script
├── commandArgs
├── image
├── requiresNetwork
├── validation
└── timestamps
```

其中 `validation` 固定为：

```text
validation
├── ok: boolean
├── errors: string[]
└── warnings: string[]
```

```text
PocRun
├── id
├── draftId
├── findingId
├── backend: docker
├── status: queued | running | passed | failed | blocked | needs_review
├── exitCode?
├── stdout?
├── stderr?
├── artifacts
├── observedResult?
├── safetyProfile
└── timestamps
```

持久化文件：

```text
.omv/.dsh/poc-drafts.json
.omv/.dsh/poc-runs.json
.omv/.dsh/poc-run-events.jsonl
```

所有写入使用现有服务的串行写入和临时文件 rename 模式。

### 脚本校验

`omv_validate_poc` 在执行前校验：

- Finding 存在且未归档。
- language 在 `python | bash | curl` 中。
- script 非空且大小受限。
- image 通过配置的 allowlist。
- command 只能是语言对应的固定入口：
  - Python：`python3 /workspace/poc.py`
  - Bash：`bash /workspace/poc.sh`
  - Curl：`bash /workspace/poc.sh`
- 不允许 `docker.sock`、privileged、host network、宿主机绝对路径或任意宿主机命令。
- 不允许通过参数覆盖受控安全配置。

### Docker Provider

新增 `src/poc-executor.ts`，定义 `PocExecutor` 接口和本机 `DockerPocExecutor` 实现。

通过 `execFile('docker', args, options)` 执行，不使用 shell。

默认 Docker 参数：

```text
--rm
--network none
--read-only
--cap-drop ALL
--security-opt no-new-privileges
--pids-limit 128
--memory 256m
--cpus 1
--tmpfs /tmp:rw,noexec,nosuid,nodev,size=16m
```

脚本使用只读 bind mount，输出使用临时可写挂载；执行超时由 Node AbortSignal/timeout 和 Docker 进程终止共同控制。

需要网络的 PoC：

- `requiresNetwork` 为 true 且配置未显式允许时立即 `blocked`。
- 本轮不默认启用网络、不使用 host network。
- 网络 allowlist 和远程 Docker Provider 留给后续独立设计。

Docker CLI 不存在、镜像不可用、参数不满足安全策略或执行超时，都生成明确的 `blocked`/`failed` Run，不执行宿主机 fallback。

### 结果协议与 Evidence 回写

容器通过输出目录写入结构化结果：

```json
{
  "status": "passed | failed | blocked | needs_review",
  "observedResult": "...",
  "artifacts": ["..."]
}
```

规则：

- Docker 进程非零退出且没有可用结果：`failed`。
- 进程零退出但没有结构化结果：`needs_review`。
- 结构化结果为 `passed`：Run 为 `passed`，调用现有 `writeReproductionEvidence()` 回写 `evidence.observed_result` 和 `evidence.repro_artifacts`。
- `failed`、`blocked`、`needs_review` 不回写确认性 Evidence。
- 所有结果仍记录到 `ReproductionRun`，保留失败现场和人工复核入口。

## Host/API/Tool 集成

### `contracts.ts`

增加：

- `EvidenceGraphAnalysis`
- `PocGenerationRequest`
- `PocDraft`
- `PocRun`
- `PocStatus`
- PoC Action request/result 类型

### `workbench.ts`

增加 Action：

- `finding.graph.export`
- `poc.generate`
- `poc.validate`
- `poc.run.inspect`

所有 mutation 继续受 `allowMutations` 控制；读操作不写入 Evidence。

### `tools.ts`

增加：

- `omv_generate_poc`
- `omv_validate_poc`

扩展 `omv_evidence_graph` 返回分析结果，并支持导出格式参数。文件修改类 Tool 继续提供 locations 和 exclusive 语义。

### `commands.ts`

增加 `/omv-poc` 摘要命令，显示 Finding 的 Draft/Run 状态和下一步；脚本全文只通过 Tool 或详情 UI 查看，避免命令输出失控。

### `http.ts`

继续复用 `/action`、`/finding` 和协议 v2，不新增执行专用端口。所有响应使用现有 `{ ok, data }` 包装。

### `src/client`

- Finding 详情嵌入 `EvidenceGraphView`。
- 增加 PoC Draft 和 Run 状态区。
- `passed` 才显示 Evidence 已回写。
- Docker unavailable、blocked、needs_review 都提供明确原因和人工下一步。

## 配置

新增配置字段只进入 `Config`、schema 和 `cordis.patch.yml`：

- `pocEnabled`
- `pocDockerImages`
- `pocTimeoutMs`
- `pocMemoryMb`
- `pocCpuLimit`
- `pocPidLimit`
- `pocAllowNetwork`
- `pocMaxScriptBytes`
- `pocMaxOutputBytes`

默认配置为 `pocEnabled: true`，但执行仍受 `allowMutations`、Docker 可用性和镜像 allowlist 共同约束；Docker 不可用时不会执行，网络关闭，镜像必须在 allowlist 中。

## 测试策略

### 单元测试

新增：

- `tests/evidence-graph.test.ts`
  - 主路径分析
  - 缺失 Guard
  - CodeRef 投影
  - DOT/Mermaid 转义
  - context/disconnected 标记
- `tests/poc-generator.test.ts`
  - vulnerability class 到模板
  - 未知类别进入人工确认路径
  - generation request 的安全约束
- `tests/poc-executor.test.ts`
  - 固定入口校验
  - Docker 参数构造
  - 禁止 host network、privileged、docker.sock
  - 超时和 Docker unavailable 状态
  - 结果 JSON 解析

### 集成测试

扩展 `tests/workbench.test.ts`：

- Graph analysis 出现在 Finding payload。
- graph export Action 返回正确格式。
- PoC Draft/Run 写入 `.omv/.dsh`。
- passed 回写 Evidence。
- failed/blocked/needs_review 不回写确认性 Evidence。

扩展 `tests/http.test.ts` 和 Tool 测试：

- protocol v2 additive 字段。
- mutation 开关。
- Docker blocked 错误结构。

Docker 本身不在普通 Vitest 测试中运行；Executor 使用注入的 `CommandRunner`，由参数级测试锁定安全边界，并单独提供可选真实 Docker smoke test。

### 浏览器与视觉验证

实现后使用真实 Chromium 验证：

- Finding 详情图谱渲染和节点点击。
- 缺失 Guard、关键路径、上下文筛选。
- Cytoscape cleanup 后切换 Finding 不残留旧图。
- DOT/Mermaid 下载。
- PoC 状态和失败提示。
- 375、768、1280 宽度。

## 兼容性与失败策略

- 现有 `EvidenceGraph.nodes/edges` 保持兼容。
- protocol v1 只返回旧图结构；新增分析只在 v2 返回。
- 没有 Docker 不影响 Dashboard、Finding 和图谱浏览。
- 没有 PoC Draft 不影响现有 Reproduction 页面。
- 单个损坏的 PoC JSON/结果文件不能拖垮整个 Dashboard，应按现有 workspace issue 模式隔离并显示诊断。
- 不把退出码 0、脚本生成成功或模型输出成功当作漏洞确认。
- 所有未知、阻塞和需人工确认状态必须显式保留。

## 文件变更清单

预计新增：

```text
src/poc-generator.ts
src/poc-executor.ts
src/client/graph-view.tsx
src/client/graph-styles.ts
tests/evidence-graph.test.ts
tests/poc-generator.test.ts
tests/poc-executor.test.ts
```

预计修改：

```text
src/contracts.ts
src/evidence-graph.ts
src/workbench.ts
src/tools.ts
src/commands.ts
src/client/pages.tsx
src/client/index.tsx
src/client/runtime.ts
src/client/types.ts
src/index.ts
package.json
package-lock.json
cordis.patch.yml
contracts/dsh-omv-api.v2.json
README.zh-CN.md
docs/architecture.md
```

本设计不包含：远程 SSH Docker Provider、自动网络 allowlist、宿主机脚本执行、直接 LLM SDK 集成、修改 `oh-my-vul` schema。
