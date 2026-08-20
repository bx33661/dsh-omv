# OMV Audit Desk (`dsh-omv`)

An evidence-first vulnerability audit workbench for [DeepSeek Harness](https://deepseek-harness.github.io/deepseek-harness/develop/basic/), powered by the public `oh-my-vul` API.

[![CI](https://github.com/bx33661/dsh-omv/actions/workflows/ci.yml/badge.svg)](https://github.com/bx33661/dsh-omv/actions/workflows/ci.yml)
[![Node.js 22+](https://img.shields.io/badge/node.js-22%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-2563eb.svg)](./LICENSE)

[中文文档](./README.zh-CN.md) · [Architecture](./ARCHITECTURE.md) · [DSH integration guide](./DSH-INTEGRATION.md)

<p align="center">
  <img src="./omv-audit-desk-overview.png" alt="OMV Audit Desk full workbench overview" width="960">
</p>
<p align="center"><sub>Full audit desk overview: workspace summary, findings, reproduction, evidence graph, and PoC lab.</sub></p>

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
- Closed-loop PoC laboratory: editable drafts, explicit approval, Docker isolation, `/output/result.json`, artifact hashes, provenance, and manual Evidence adoption
- Dedicated quality center, reproduction lab, dedup intelligence, report-readiness signals, and Campaign Graph
- DSH-native visual system that uses the host background layers, borders, typography, and alias colors directly, with calm hierarchy, sticky workbench chrome, and responsive mobile breakpoints
- Campaign outcomes distinguish completed work from blocked lanes that still need attention
- Campaign compatibility diagnostics isolate malformed YAML, normalize common registry aliases, and repair derived metadata from the workbench
- Workspace-wide search, recent activity feed, and native DSH Job status with contextual repair-and-retry
- SSE workspace synchronization with polling fallback
- Recent workspace activity surfaced on the overview page
- Candidate creation, validation, reproduction scaffolding, promotion, and restore actions
- 29 model tools covering workspace quality, DSH lifecycle diagnostics, Finding, workflow, Campaign Runtime, evidence provenance, reproduction, PoC isolation, dedup, and search
- 19 durable `/omv*` commands, including `omv-dedup` and the Campaign Runtime set
- Automatic binding to the current DSH session workspace
- Native tool presentation, including an OMV-keyed `tool.call.toolview` card with expandable arguments/results and trajectory inspection, plus an evidence-first Agent system-prompt section
- Central cooperative cancellation guards on every native OMV tool invocation
- Native `omv` Cordis service for other plugins, lifecycle diagnostics via `omv_runtime_status`, and typed `dsh-omv/tool-result` events
- User preference persistence: uses the native `dsh-omv` settings namespace when the Host exposes it, with a browser-local fallback on DSH rc.6; deployment knobs remain in Cordis Config
- Protocol v2 payloads, additive `?protocol=1` compatibility, and complete workspace export

## Install

There are two separate installation steps: `npm install` prepares this checkout's dependencies and build output; `dsh plugin --profile web add ...` installs the plugin into the DSH Web profile. Choose one of the following modes.

### Source development (recommended for UI work)

Use a local link when you need hot reload. The link points the profile at this checkout, while `npm run dev` watches `src/` and lets DSH client-HMR refresh the open page.

```bash
cd /path/to/dsh-omv
npm install
dsh plugin --profile web add link:.
npm run dev
dsh --profile web
```

Keep `npm run dev` running while editing. React component state may reset according to DSH HMR behavior; this is not full page-state persistence. If the profile previously used a regular local install, switch it explicitly:

```bash
dsh plugin --profile web remove dsh-omv
dsh plugin --profile web add link:.
```

### Stable local install

Use this mode when you want to run a fixed checkout without hot reload. After source changes, rebuild and add the local package again.

```bash
cd /path/to/dsh-omv
npm install
npm run build
dsh plugin --profile web add .
dsh --profile web
```

### Packed install

Use a tarball to transfer or install a specific build on another machine. `npm pack` prints a versioned filename; use the actual filename it prints. A tarball does not provide source hot reload.

```bash
cd /path/to/dsh-omv
npm install
npm pack --silent
dsh plugin --profile web add ./dsh-omv-<version>.tgz
dsh --profile web
```

Local checkouts and already-built tarballs do not need an extra pnpm `allowBuilds` entry. Update an installed package with `dsh plugin --profile web update dsh-omv`, or remove it with `dsh plugin --profile web remove dsh-omv`.

The **Vulnerability audit** entry opens or reuses the configured DSH Workspace. Every session then exposes a **Vulnerability audit** tab beside Chat and Trajectory. Verify the profile after installation with:

```bash
dsh --profile web --dump-config
```

The output should include the `dsh-omv` configuration layer. If source changes do not appear, confirm that the profile uses `link:.` and that `npm run dev` is still running.

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
    watchDebounceMs: 90
    eventHeartbeatMs: 20000
    httpBodyLimitBytes: 262144
```

Relative `projectRoot` values resolve from the directory where DSH starts. A patch replaces the complete `config` value, so retain every field you still need.

## Security model

- By default the API is loopback-only: the client address must be `127.0.0.1`/`::1` and the `Host` header must be `localhost`/`127.0.0.1`/`[::1]`. The Host check blocks browser DNS-rebinding pages from reading `/export` or forging `/action` mutations.
- **`allowRemoteAccess: true` disables both guards, and the whole API (including every mutation action) has no authentication.** Only enable it on a trusted network, behind your own auth proxy or network isolation.
- Local access through a non-loopback hostname (for example a custom hosts domain) also requires `allowRemoteAccess: true` to pass the Host check.

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
The implementation-to-guide checklist and follow-up iterations live in [DSH-INTEGRATION.md](./DSH-INTEGRATION.md).

## License

MIT


## Project structure

The source is split across the DSH host entry, client pages, UI primitives, runtime adapters, and shared contracts; all tests live under `tests/`. See [`ARCHITECTURE.md`](./ARCHITECTURE.md). The repository keeps the full audit desk overview at [`omv-audit-desk-overview.png`](./omv-audit-desk-overview.png); build archives, local `.omv` data, continuation state, and internal planning notes are ignored.
