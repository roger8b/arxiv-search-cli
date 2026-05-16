# Claude Code — arxiv

Working on the `arxiv` source tree. The canonical rules are in [`AGENTS.md`](AGENTS.md); this file adds Claude-Code-specific guidance.

## Read first

- [`AGENTS.md`](AGENTS.md) — structure, conventions, paths, hard rules.
- [`README.md`](README.md) — user-facing CLI surface (commands, flags, exit codes).

## Claude-specific

### Use the dev script, not the built bin, while iterating

```bash
npm run dev -- <args>            # tsx, no build step
```

Only rebuild (`npm run build`) before committing or before running `arxiv ...` against the installed bin.

### Tests are cheap — run them before every commit

```bash
npm test
```

Network is mocked (`vi.spyOn(globalThis, 'fetch')`); the suite finishes in <1s. If you touched `src/cli/options.ts` or any command, also add a test case.

### When adding a new search flag

Touch these four files in this order, or the change will leak:

1. `src/config/index.ts` — add field to `Config` + default
2. `src/cli/options.ts` — add to `SEARCH_OPTIONS` + map in `optsToConfig`
3. `tests/options.test.ts` — add a case
4. `README.md` — document under "Daily use" if user-facing

### When asked to add an agent (init target)

Edit `src/utils/agents.ts`, add a `{ name, displayName, ruleFile, skillsDir, … }` entry. `runInit` and `runUninstall` pick it up automatically.

### Skill templates

`templates/skills/arxiv-*/SKILL.md` are copied verbatim into projects by `arxiv init`. Treat them as user-facing docs. The frontmatter `description` controls when an LLM picks the skill — keep it specific and include both trigger and anti-trigger phrasing.

### Do NOT

- Add `console.log` for diagnostics — use `process.stderr.write` with the `[arxiv]` prefix, or `pc.<color>` via `console.error`.
- Hit the real arXiv API in tests — mock `globalThis.fetch`.
- Colorize stdout — it is the JSON / NDJSON / text payload.

### Data paths

User data lives under `~/.arxiv/`. Treat `history/searches.jsonl` as user state — append-only, never rewrite by hand.
