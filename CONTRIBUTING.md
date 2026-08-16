# Contributing to dsh-omv

Thanks for contributing to the DSH-native vulnerability audit workbench.

## Development setup

Requirements:

- Node.js 22 or newer;
- npm 10 or newer;
- a local DeepSeek Harness installation for end-to-end UI checks.

From the repository root:

```bash
npm ci
npm run check
```

`npm run check` runs production and test type checks, the Vitest suite, both host/client builds, and a package dry run. Tests live under [`tests/`](./tests); production code lives under [`src/`](./src).

## Design guidelines

- Prefer native DSH seams over parallel plugin UI or state stores.
- Keep evidence provenance visible: source, sink, guard, reproducer, observed result, and next action should remain traceable.
- Reuse DSH alias colors, typography, backgrounds, borders, and interaction patterns.
- Keep long-running work resumable and cancellation-aware.
- Avoid putting real tokens, private repository data, or generated `.omv/` state into commits.

## Pull requests

A focused pull request should include:

- a short problem statement and user-facing outcome;
- tests for changed behavior;
- screenshots or a short capture for UI changes;
- documentation or protocol notes for public surface changes;
- confirmation that `npm run check` passes.

Use a conventional commit subject such as `feat:`, `fix:`, `docs:`, `refactor:`, or `chore:`. Keep unrelated cleanup in a separate pull request.
