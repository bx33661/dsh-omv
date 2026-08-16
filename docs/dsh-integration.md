# DSH 原生融合审计记录

本文把 [DSH 插件开发指南](https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/) 与 [Reference 架构目录](https://deepseek-harness.github.io/deepseek-harness/reference/) 的约定映射到 `dsh-omv` 当前实现，作为后续迭代的基座清单。

本轮重点核对了 [能力 Seams](https://deepseek-harness.github.io/deepseek-harness/reference/capability-seams)、[Tool 执行](https://deepseek-harness.github.io/deepseek-harness/reference/subsystems/tools)、[HTTP 服务器](https://deepseek-harness.github.io/deepseek-harness/reference/subsystems/web-server)、[客户端模块](https://deepseek-harness.github.io/deepseek-harness/reference/subsystems/client-modules)、[用户设置](https://deepseek-harness.github.io/deepseek-harness/reference/subsystems/settings) 与 [命令](https://deepseek-harness.github.io/deepseek-harness/reference/subsystems/commands)。

## 已落地

| 官方约定 | 实现 | 验证 |
| --- | --- | --- |
| `apply(ctx)` + `inject` 声明依赖 | `src/index.ts` 注入 WebServer、Tools、Commands、SystemPrompt、WorkspaceRegistry | `dsh --profile web --dump-config` + 启动健康检查 |
| 通过 `ctx` 注册并自动清理 | HTTP disposer、Tool/Command/Prompt/Slot 注册均在 Cordis fiber 内；外部 watcher、Runner scope 由 `ctx.effect` 收口 | DSH 启停后端口关闭、SSE 订阅释放 |
| Schemastery 配置与严格边界 | `activityLimit`、轮询、并发、watch debounce、SSE heartbeat、HTTP body 上限均是可覆盖字段；schema 直接拒绝越界值 | `src/config.test.ts` |
| Service 形态 | `OmvService` 以 `ctx.omv` 提供 workspace-scoped workbench；其他插件可 `inject: ['omv']` | `src/service.test.ts` |
| Fiber 生命周期诊断 | `inspectDshRuntime`、`omv_runtime_status`、`/omv-runtime` 展示 PENDING/FAILED、依赖与 fiber | `src/runtime.test.ts` |
| Tool canonical output | 所有 Tool 声明 `output.schema` + `render`，并统一做 AbortSignal 分发前后检查 | 28 个原生 Tool 注册、`npm run check` |
| Tool UI presentation | 原生 generic card + `kind` + Finding/Campaign/Runner 文件 `locations`，可被 DSH UI follow-along | `src/tools.ts` presenters |
| Typed events | `tools/result` → `dsh-omv/tool-result`，供其他插件接入审计遥测 | `src/events.ts` |
| User settings seam | `dsh-omv` namespace stores only the last audit surface when the Host exposes custom namespaces; DSH rc.6 currently falls back to browser-local preference. Cordis Config remains the deployment contract | `src/settings.ts`, `src/settings-schema.ts`, client `settingsScope` + local fallback |
| Bundle/profile 分层 | 包含 `dsh.bundle.patch`、稳定 `id: dsh-omv`，profile 层完整复述 config | `cordis.patch.yml`、profile dump |
| 客户端工作区韧性 | 当前会话目录与默认目录分开显示；单个损坏 Evidence 文件会进入 `workspaceIssues`，不再拖垮整个仪表盘 | `src/workbench.ts`、`src/client/index.tsx` |
| 原生交互可达性 | `role=tab`、快捷键 `1–9`/`0`/`/`/`R`、`⌘K/Ctrl-K` 命令面板、对话框语义、可关闭 Toast、加载与错误 `aria-live` | `src/client/index.tsx`、`src/client/styles.ts` |
| 最近变更 | 总览页复用 `DashboardPayload.activity` 展示最新证据写入与工作流动作；DSH `JobView` 任务状态在总览与工具栏呈现 | `src/client/pages.tsx` |
| DSH 原生视觉系统 | 宿主 alias 色板、图标导航、吸顶工作台 chrome、证据卡片层级、详情抽屉与移动端断点；通过父级滚动容器约束避免工作台内容撑高会话页 | `src/client/index.tsx`、`src/client/styles.ts` |
| 同步反馈 | SSE 实时状态、最近同步时间、断线轮询、静默刷新失败提示和显式重试 | `src/client/index.tsx` |
| 研究闭环 | 质量中心、复现实验室、Campaign Graph、去重与报告材料状态均复用 `ActionRequest`、HTTP 和原生 Tool/Command；报告草稿与披露时间线由 omv-report / omv-disclose Agent 工作流产出 | `src/workbench.ts`, `src/dedup.ts`, `src/reporting.ts` |

## 下一阶段的原生融合方向

1. **Definition / Provider / Consumer 拆包**：把 `OmvService` 的稳定请求/结果类型单独抽成 `dsh-omv-contracts`，便于替换本地 Provider 或远程 Provider。
2. **工具域卡片**：为 Finding、Campaign Lane、Reproduction Run 注册 keyed `tool.call.toolview`，把当前 generic card 升级为证据状态、Diff、Run 状态的原生卡片；模型输出协议保持不变。
3. **事件→遥测桥**：在 `dsh-omv/tool-result` 之上增加耗时、取消原因和 workspace scope 的匿名聚合，并提供 opt-in exporter，不把敏感 Evidence 写进日志。
4. **HMR 场景测试**：在本地 patch 中修改 `config`，验证旧 HTTP/SSE/Watcher/Service scope 完整卸载后只保留一个新实例。

## 维护规则

- 新增部署可调参数先进入 `Config` 和 `cordis.patch.yml`，再进入代码；不要新增隐式常量。
- 新增资源优先使用 `ctx.on`、`ctx.effect`、`ctx.tools.register`、`ctx.slots.register`，不要保存脱离 fiber 的全局监听器。
- 文件变更 Tool 必须提供 `locations`；修改类 Tool 默认保持 exclusive，不声明 `isConcurrencySafe`。
- Evidence 仍以 `.omv` 文件和 `oh-my-vul` schema 为权威，UI 只投影状态，不复制一套评分真相。
