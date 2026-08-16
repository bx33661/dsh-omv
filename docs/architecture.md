# 项目结构

`dsh-omv` 是一个双面 DSH 插件：Node 主机侧负责把 `oh-my-vul` 工作区能力接入 Cordis；浏览器侧负责把审计台投影到 DSH 的原生会话、侧栏、设置和轨迹界面。

## 目录约定

```text
.
├── src/
│   ├── index.ts              # Host 入口：Cordis 注入、Service、HTTP、Tools、Commands
│   ├── contracts.ts          # Host/Client 共享的协议类型
│   ├── client/
│   │   ├── index.tsx         # Client 入口：DSH slots、会话状态与页面编排
│   │   ├── pages.tsx         # 总览、漏洞、战役、雷达、质量、复现、评审、报告、轨迹
│   │   ├── ui.tsx            # Hero、Metric、Status、Modal、Icon 等原子 UI
│   │   ├── runtime.ts        # HTTP/SSE 地址、响应解析、格式化与状态映射
│   │   ├── types.ts          # Client 注入对象、Tab、Icon 和命令常量
│   │   ├── styles.ts         # DSH alias 驱动的宿主视觉样式
│   │   └── styles/trace.ts   # 轨迹页图表与事件流动画样式
│   ├── workbench.ts          # 工作区聚合与动作路由
│   ├── workbench/quality.ts  # 队列排序与质量信号投影
│   └── *.ts                  # Workflow、Runner、Radar、Review、Dedup、Report 等领域服务
├── tests/                    # Vitest 单元/集成测试，和生产源码分离
├── contracts/                # 对外 API 合同快照
├── docs/                     # 集成指南、架构和界面资产
├── cordis.patch.yml          # DSH profile 安装补丁
└── package.json              # 双面插件 manifest 与构建入口
```

## 模块边界

### Host

- `src/index.ts` 只负责生命周期和 seam 注册，不承载业务规则。
- `src/workbench.ts` 负责聚合读模型、动作路由和 workspace scope。
- `src/workbench/quality.ts` 负责队列排序、质量信号和报告/评审投影，避免聚合入口承载派生规则。
- 每个长流程（Campaign、复现、协作、去重、报告）拥有独立 service，持久化仍由 `.omv` 和 `oh-my-vul` schema 负责。

### Client

- `client/index.tsx` 只保留 DSH 集成、刷新/事件状态、会话动作和页面选择。
- `client/pages.tsx` 只负责页面级投影；跨页面状态通过 props 回传到入口。
- `client/ui.tsx` 放置无业务副作用的展示组件，避免页面重复绘制相同的状态/空态/弹窗。
- `client/runtime.ts` 集中处理 API、时间、状态标签和颜色映射，页面不直接拼接 URL 或解析响应。
- `client/styles.ts` 只使用 DSH alias 背景、边框、字体和状态色；新增视觉规则应优先落在宿主 token 上。
- `tests/` 只引用 `../src` 的生产模块，Vitest 通过 `vitest.config.ts` 统一收集；`tsconfig.tests.json` 单独负责测试类型检查。

## 变更规则

1. 新增 DSH 能力先更新 `inject`、slot 或 host service，再添加页面按钮。
2. 新增 API 字段先进入 `contracts.ts` 与 `contracts/` 快照，再接入 Host/Client。
3. 页面组件保持数据驱动，不在组件内直接读取 `.omv` 文件。
4. 生成物（`lib/`、`*.tgz`、Playwright 日志、截图变体、本地 `.omv`）不进入 Git。
5. 提交前运行 `npm run check`；视觉调整至少用 DSH Web profile 验证一次。
