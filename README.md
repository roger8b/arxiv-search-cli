# arxiv — arXiv Search CLI

Query the official [arXiv](https://arxiv.org) API from the terminal, get structured paper metadata (JSON / NDJSON / text), download PDFs, and reuse recent queries from a local history cache. Installable into AI coding agents as skills.

Part of the same family as `gscli` (Google Search CLI) — same architecture and conventions.

## Install

```bash
git clone https://github.com/roger8b/arxiv-search-cli ~/.arxiv-cli
cd ~/.arxiv-cli
bash install.sh --local .
```

Or from a checkout:

```bash
npm install
npm run build
npm link
```

Requires Node.js ≥ 18. The arXiv API is public — no API key or login.

## Quick start

```bash
arxiv "machine learning transformers"
arxiv "diffusion models" --category cs.CV --sort-by submitted-date
arxiv --author "Yann LeCun" --max-results 20
arxiv download 2401.12345 --out ./papers
arxiv download 2401.12345 --convert -y         # download + convert to markdown
arxiv convert ./papers/2401.12345.pdf          # convert an existing PDF
```

> `convert` uses [`docling`](https://github.com/docling-project/docling). If it
> is missing, the command offers to install it for you (`uv tool install docling`,
> `pipx install docling`, or `pip install docling` — whichever it finds). Use
> `-y` to skip the prompt, `--no-install` to refuse. Override the binary path
> via `ARXIV_DOCLING_BIN`. Conversions are cached in `~/.arxiv/cache/conversions.jsonl`.

## Commands

| Command | Purpose |
|---------|---------|
| `arxiv [search] <query>` | Search papers (default command) |
| `arxiv download <id>` | Download a paper PDF by arXiv ID (`--convert` chains markdown conversion) |
| `arxiv convert <file>` | Convert a local PDF/doc to markdown via `docling` |
| `arxiv setup` | Provision the data dir + check API reachability |
| `arxiv init` | Wire `arxiv` into the current project (agent skills) |
| `arxiv uninstall` | Reverse of `init` |
| `arxiv doctor` | Health check (data dir, history, API) |

## Daily use (search options)

| Flag | Default | Description |
|------|---------|-------------|
| `-q, --query <text>` | — | Search query (or pass as a positional arg) |
| `--author <name>` | — | Filter by author name |
| `--category <cat>` | — | arXiv category (cs.AI, cs.LG, stat.ML, …) |
| `--max-results <n>` | 5 | Max results (capped at 50) |
| `--sort-by <relevance\|submitted-date\|updated-date>` | relevance | Sort order |
| `--format <json\|ndjson\|text>` | json | Output format |
| `--api-base <url>` | export.arxiv.org/api/query | arXiv API base URL |
| `--history-file <path>` | ~/.arxiv/history/searches.jsonl | History JSONL path |
| `--no-history` | off | Disable history append |
| `--use-cache` | off | Reuse a recent identical query within TTL |
| `--cache-ttl <seconds>` | 3600 | Cache TTL when `--use-cache` |

At least one of query / `--author` / `--category` is required.

## Output

Default `json` payload:

```json
{
  "status": "ok",
  "query": "transformers",
  "author": "",
  "category": "",
  "count": 5,
  "source": "arxiv",
  "papers": [
    {
      "position": 1,
      "id": "2401.12345",
      "title": "…",
      "authors": ["…"],
      "published": "2024-01-23",
      "updated": "2024-01-25",
      "summary": "…",
      "categories": ["cs.LG"],
      "absUrl": "https://arxiv.org/abs/2401.12345",
      "pdfUrl": "https://arxiv.org/pdf/2401.12345"
    }
  ]
}
```

- `--format ndjson` — one paper JSON object per line (pipe-friendly).
- `--format text` — human-readable list.

stdout is the payload only; diagnostics go to stderr with an `[arxiv]` prefix.

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | OK |
| `1` | Error (bad input, network failure) |
| `3` | No results (broaden the query — not a failure) |

## History & cache

Every successful search is appended to `~/.arxiv/history/searches.jsonl`. `--use-cache` returns a prior result for an identical query (same query + author + category) within `--cache-ttl` seconds without calling the API. The file is plain JSONL — grep / `jq` friendly. Never edit it by hand.

## Convert (PDF → Markdown)

`arxiv convert <file>` turns a PDF (or other document) into Markdown using the [`docling`](https://github.com/docling-project/docling) CLI. Markdown is the ideal feedstock for LLM workflows — structure, equations, tables and figure references survive intact.

```bash
arxiv convert ./papers/2305.16291.pdf                    # → ./papers/2305.16291.md
arxiv convert paper.pdf --out ./md --device mps          # Apple Silicon GPU
arxiv convert paper.pdf --to html --image-mode embedded  # alt format
arxiv download 2305.16291 --out ./papers -c -y           # download + convert in one shot
```

### Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--out <dir>` | input dir | Output directory |
| `--to <md\|json\|html\|text\|doctags>` | `md` | Output format |
| `--image-mode <embedded\|referenced\|placeholder>` | `referenced` | How images are emitted |
| `--device <cpu\|cuda\|mps\|auto>` | docling default | Compute device |
| `--force` | off | Re-run even if a cached conversion exists |
| `--no-install` | off | Do not auto-install docling if missing |
| `-y, --yes` | off | Skip install confirmation prompt |

The exact same `-c, --convert`, `--to`, `--device`, `--no-install`, `-y` flags are also accepted on `arxiv download` and chain conversion right after the PDF lands.

### Auto-installing docling

If `docling` is missing, the command:

1. Detects your installer (`uv` > `pipx` > `pip`) and shows the exact command it will run.
2. Asks for confirmation (skip with `-y`, refuse with `--no-install`).
3. Installs, re-detects, and continues with the conversion.

Override the binary path via `ARXIV_DOCLING_BIN=/path/to/docling`.

### Conversion cache

Every successful conversion appends a record to `~/.arxiv/cache/conversions.jsonl`:

```json
{"id":"2305.16291","pdf":"/abs/path/paper.pdf","md":"/abs/path/paper.md","format":"md","convertedAt":"2026-05-20T01:31:42.123Z"}
```

Subsequent runs for the same input return the cached path without invoking docling. Pass `--force` to bypass.

## Development

```bash
npm run dev -- "smoke query" --max-results 3 --no-history
npm test
npm run build
```

See [`AGENTS.md`](AGENTS.md) for conventions and hard rules.

## License

MIT
