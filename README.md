# Raili (MVP)

Deterministic CLI workflow orchestrator for AI-assisted development with pluggable agent and script execution.

This repository contains the Raili MVP core: a thin CLI that validates a `.raili/` configuration directory and registries.

Prerequisites
- Node.js (12+ recommended)
- npm

Install dev dependencies

```bash
npm install
```

Build

```bash
npm run build
```

Run tests

```bash
npm test
```

Try the CLI

After building, you can run the CLI from the `dist` output:

Initialize a project (creates `.raili/` with template files):

```bash
node dist/cli.js init
```

Validate registries (will fail fast if `.raili/` or registries are missing/invalid):

```bash
node dist/cli.js run
```

During development you can run the TypeScript entry directly with `ts-node` (dev dependency):

```bash
npx ts-node src/cli.ts init
npx ts-node src/cli.ts run
```

Installing globally during development:

```bash
npm run build
npm install -g .
```

Notes
- `raili init` will fail if `.raili/` already exists to avoid accidental overwrites.
- `raili run` currently only validates and returns parsed registries (MVP). No agents or scripts are executed by the core.

Contributing / Next steps
- Implement the deterministic state machine (xstate) and a thin engine that orchestrates transitions.
- Implement handler registries and mockable handler implementations.

License: UNLICENSED

