# Security policy

## Scope

This policy covers the `dsh-omv` plugin, its DSH host/client integration, the local HTTP bridge, and the workspace evidence-handling code in this repository.

The workbench is designed for local, evidence-first research. Treat `.omv/` files, session logs, reproduction output, and exported snapshots as potentially sensitive research data.

## Reporting a vulnerability

Please report security issues privately through the repository's **Security → Advisories** area when private vulnerability reporting is available. If that channel is unavailable, contact the maintainer [@bx33661](https://github.com/bx33661) directly and include:

- affected version or commit;
- a short impact statement;
- reproducible steps or a minimal fixture;
- the smallest relevant log or code location.

Please do not publish credentials, private project paths, customer data, or a complete exploit in a public issue. Redact tokens and sensitive workspace contents from screenshots and `.omv` exports.

## Handling guidance

The default API mode is loopback-only. Keep `allowRemoteAccess: false` unless a trusted, separately authenticated network boundary is in place. Security fixes should include a regression test and a concise changelog entry when practical.
