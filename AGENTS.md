# Agent guide — arxiv

This file is the canonical instruction set for any AI coding agent (Codex, Claude Code, Gemini CLI, Cursor, etc.) working on the `arxiv` source tree. `CLAUDE.md` re-exports this file with Claude-Code-specific overrides.

## What this project is

`arxiv` is a TypeScript ESM CLI distributed as a global `arxiv` bin (package `arxiv-search-cli`). It queries the official arXiv API over HTTP, parses the Atom XML into structured papers, and emits JSON / NDJSON / text. It also downloads paper PDFs, keeps a persistent search history (`~/.arxiv/history/searches.jsonl`) with a `--use-cache` shortcut, and wires itself into AI coding agents as installable skills.

```
src/
├── cli/             # Commander option definitions (options.ts)
├── commands/        # one file per subcommand (search, download, setup, doctor, init, uninstall)
├── arxiv/           # client (HTTP), query (URL builder), parser (XML → papers)
├── search/          # search orchestration (performSearch)
├── history/         # JSONL append + cache lookup
├── emitter/         # output payload shaping (json / ndjson / text)
├── config/          # env + defaults
├── utils/           # version, agents registry, templates-dir
└── index.ts         # Commander root + dispatcher
templates/skills/    # arxiv-* skills copied by `arxiv init`
tests/               # vitest
```

## Conventions

### Language / module system

- TypeScript `strict: true`, `target: ES2022`, `module: NodeNext`.
- All relative imports end in `.js` (ESM): `import { x } from "./foo.js"`.
- Node built-ins use the `node:` prefix: `import path from "node:path"`.
- Named exports only. No default exports in `src/`.

### Imports order

1. Node built-ins
2. Third-party (`commander`, `picocolors`, `fs-extra`)
3. `../cli/…`, `../config/…`, `../utils/…`
4. Local relative

### Command handlers

- Live in `src/commands/<name>.ts` and export a single `run<Name>(...) => Promise<number>`.
- Return the exit code; never call `process.exit` directly.
- Set `process.exitCode` only in `src/index.ts` after `await` of the handler.
- Use `picocolors` for **stderr**; never colorize **stdout** (it is the machine payload).
- Log diagnostics to stderr with the `[arxiv]` prefix. Reserve stdout for JSON / NDJSON / text output.

### CLI flags

- Every search flag is defined exactly once, in `src/cli/options.ts` (`SEARCH_OPTIONS`).
- Adding a flag: update `SEARCH_OPTIONS` + `optsToConfig` + `Config` interface + a test in `tests/options.test.ts`.

### Paths

- User data lives under `ARXIV_HOME` (default `~/.arxiv`): `history/searches.jsonl`. Never assume the install dir is writable for user data.
- Always resolve user-provided paths absolutely; never hard-code home.

### Error handling

- Throw `Error` with a clear message in pure utilities; commands catch and translate to exit codes (1 = error, 3 = no results).
- Never swallow errors silently — log to stderr with `[arxiv]` prefix.

## Tests

- **Vitest** in `tests/`, file pattern `<topic>.test.ts`. ESM-native — import from `src/` with `.js` suffix.
- Use `mkdtempSync(path.join(os.tmpdir(), 'arxiv-…-'))` for any test that touches the filesystem; clean up with `fs.rmSync(dir, { recursive: true, force: true })` in `afterEach`.
- Mock the network with `vi.spyOn(globalThis, 'fetch')` — never hit the real arXiv API in tests.
- A new flag in `src/cli/options.ts` requires a corresponding case in `tests/options.test.ts`.
- Run: `npm test`. CI matrix: Node 20 and 22.

## Build / release

- `npm run build` → `dist/` (tsc).
- `npm install` triggers `prepare` which runs `build` — required because the `bin` points to `dist/index.js`.
- `npm test` runs vitest once (CI mode).
- `npm run dev -- <args>` runs `tsx src/index.ts` for fast iteration.

## Commits / PRs

- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`, `ci:`. Scope optional.
- Always co-author trailer when AI-assisted: `Co-Authored-By: Claude … <noreply@anthropic.com>`.
- Branches: `feat/<topic>`, `fix/<topic>`, `chore/<topic>`.
- Never commit `dist/`, `node_modules/`, `coverage/`, or anything under `~/.arxiv/`.

## Hard rules

- Never edit `~/.arxiv/history/searches.jsonl` by hand; it is append-only and `--use-cache` depends on its ordering.
- Never call `process.exit` from inside a command handler — return the code.
- Never colorize stdout. Stdout is the machine payload.
- Exit code 3 = no results; it is a normal outcome, not a failure to retry blindly.

## Useful commands while developing

```bash
npm run dev -- --help                          # tsx-driven help, no rebuild
npm run dev -- "transformers" --max-results 3 --no-history
npm test
arxiv doctor                                   # against the installed copy
```
