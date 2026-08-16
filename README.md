# OMV Audit Desk (`dsh-omv`)

An evidence-first vulnerability audit workbench for [DeepSeek Harness](https://deepseek-harness.github.io/deepseek-harness/develop/basic/), powered by the public `oh-my-vul` API.

`OMV Audit Desk` is the product name; `dsh-omv` remains the package id for upgrade compatibility. It is a dual-face, native DSH bundle:

- a Node plugin joins DSH web-server, tool, command, system-prompt, and workspace-registry services;
- a browser client contributes a conversation view, session status, composer context, command rows, settings section, and workspace launcher;
- `cordis.patch.yml` installs both faces into a DSH Web profile.

## Features

- Evidence-maturity dashboard with five contextual dimensions instead of a single completion percentage
- Candidate, confirmed, blocked, and archived finding ledger
- `source → sink → guard` evidence-chain inspection
- Derived Audit Loop stages, persistent Finding-to-Session links, workflow history, and Evidence diffs
- One-click Agent workflows for audit, reproduction, deduplication, adversarial review, reporting, and disclosure
- Doctor issues, review verdicts, open questions, and exact next actions without circular score deductions
- Durable Campaign Runner with bounded concurrency, one native DSH forked session per lane, pause/resume/cancel/retry, and restart recovery
- Provenance-aware Evidence Graph, stage-aware report conditions, and structured reproduction runs
- Dedicated quality center, reproduction lab, dedup intelligence, collaborative review queue, report/disclosure center, and Campaign Graph
- DSH-native visual system that uses the host background layers, borders, typography, and alias colors directly, with calm hierarchy, sticky workbench chrome, and responsive mobile breakpoints
- Campaign outcomes distinguish completed work from blocked lanes that still need attention
- Campaign compatibility diagnostics isolate malformed YAML, normalize common registry aliases, and repair derived metadata from the workbench
- Passive Radar watchlists/events, triage queue and Candidate conversion, workspace-wide search, and native DSH Job status with contextual repair-and-retry
- SSE workspace synchronization with polling fallback
- Native Trace workspace with Duration / Turns / Calls density modes, Evidence / Workflow / Tools lanes, searchable event stream, and reduced-motion-friendly animations
- Candidate creation, validation, reproduction scaffolding, promotion, and restore actions
- 28 model tools covering workspace quality, DSH lifecycle diagnostics, Finding, workflow, Campaign Runtime, evidence provenance, reproduction, dedup, review, reporting, Radar, and search
- 23 durable `/omv*` commands, including `omv-dedup`, `omv-review`, `omv-report`, and `omv-disclose`
- Automatic binding to the current DSH session workspace
- Native tool presentation and an evidence-first Agent system-prompt section
- Central cooperative cancellation guards on every native OMV tool invocation
- Native `omv` Cordis service for other plugins, lifecycle diagnostics via `omv_runtime_status`, and typed `dsh-omv/tool-result` events
- User preference persistence: uses the native `dsh-omv` settings namespace when the Host exposes it, with a browser-local fallback on DSH rc.6; deployment knobs remain in Cordis Config
- Protocol v2 payloads, additive `?protocol=1` compatibility, and complete workspace export

## Install

```bash
npm install
npm run check
dsh plugin --profile web add .
dsh --profile web
```

The **Vulnerability audit** entry opens or reuses the configured DSH Workspace. Every session then exposes a **Vulnerability audit** tab beside Chat and Trajectory.

## Configure

Override the row in `$DSH_HOME/profiles/web/cordis.patch.yml`:

```yaml
- id: dsh-omv
  config:
    projectRoot: '/absolute/path/to/repository'
    apiPrefix: '/api/dsh-omv'
    allowMutations: true
    allowRemoteAccess: false
    activityLimit: 60
    refreshIntervalMs: 15000
    campaignConcurrency: 3
    radarIntervalMs: 0
    watchDebounceMs: 90
    eventHeartbeatMs: 20000
    httpBodyLimitBytes: 262144
```

Relative `projectRoot` values resolve from the directory where DSH starts. A patch replaces the complete `config` value, so retain every field you still need.

Other plugins can consume the host capability without depending on the HTTP bridge:

```ts
import type { Context } from '@deepseek-ai/cordis'

export const inject = ['omv']
export function apply(ctx: Context) {
  ctx.on('dsh-omv/tool-result', event => {
    console.log(event.name, event.ok ? 'ok' : 'failed')
  })
  void ctx.omv.workbench.health()
}
```

See [README.zh-CN.md](./README.zh-CN.md) for architecture, API, packaging, and configuration details.
The implementation-to-guide checklist and follow-up iterations live in [docs/dsh-integration.md](./docs/dsh-integration.md).

## License

MIT


## Project structure

The source is split across the DSH host entry, client pages, UI primitives, runtime adapters, and shared contracts. See [`docs/architecture.md`](./docs/architecture.md). The repository keeps one curated workbench preview at [`docs/assets/workbench-overview.png`](./docs/assets/workbench-overview.png); build archives, local `.omv` data, and test captures are ignored.
