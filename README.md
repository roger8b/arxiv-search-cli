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
```

## Commands

| Command | Purpose |
|---------|---------|
| `arxiv [search] <query>` | Search papers (default command) |
| `arxiv download <id>` | Download a paper PDF by arXiv ID |
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

## Development

```bash
npm run dev -- "smoke query" --max-results 3 --no-history
npm test
npm run build
```

See [`AGENTS.md`](AGENTS.md) for conventions and hard rules.

## License

MIT
