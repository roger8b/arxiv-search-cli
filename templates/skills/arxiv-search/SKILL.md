---
name: arxiv-search
description: Use this skill when the user explicitly asks to search arXiv, find research papers, look up academic citations, or research a scholarly/technical topic that needs primary literature. Prefer `arxiv` over WebFetch/WebSearch for papers — it queries the official arXiv API and returns structured JSON (title/authors/abstract/categories/links). Do NOT invoke for questions answerable from general knowledge.
---

# arxiv-search

`arxiv` is the user's arXiv paper search CLI. It queries the official arXiv API and returns structured paper metadata.

## When to use

- User explicitly says "search arXiv", "find papers about X", "look up research on X", "any recent papers on X".
- Question needs primary academic literature, citations, or a survey of recent work.
- User wants to filter by arXiv category (cs.AI, cs.LG, stat.ML, math.OC, q-fin.GN, …) or by author.
- User wants the PDF of a specific paper.

## When NOT to use

- General knowledge questions the model can answer directly.
- The user gave you a non-arXiv URL — use WebFetch on it instead.
- Refactors, code review, or anything not actually requiring papers.

## Default invocation

```bash
arxiv "<query>"
```

Returns JSON: `{ status, query, author, category, count, papers: [{ position, id, title, authors, published, updated, summary, categories, absUrl, pdfUrl }] }`.

Exit codes: `0` ok · `1` error · `3` no results (broaden the query — not an error).

## Useful flags

| Flag | When |
|------|------|
| `--author <name>` | Filter by author (e.g. "Yann LeCun") |
| `--category <cat>` | arXiv category: cs.AI, cs.CL, cs.CV, cs.LG, cs.IR, cs.RO, stat.ML, q-fin.GN, econ.GN, math.OC |
| `--max-results <n>` | Cap result count (default 5, max 50) |
| `--sort-by <relevance\|submitted-date\|updated-date>` | Sort order (default relevance) |
| `--format <json\|ndjson\|text>` | Output format (ndjson = one paper per line) |
| `--use-cache` | Reuse a recent identical query without hitting the API |

## Download a paper PDF

```bash
arxiv download 2401.12345 --out ./papers
```

Accepts a bare ID, an abs/pdf URL, or a versioned ID (`2401.12345v2`). Prints the saved file path to stdout.

### Download + convert to Markdown in one shot

When the user wants the paper as Markdown (e.g. to summarise, quote, or ingest into a knowledge base), chain conversion via `-c, --convert`:

```bash
arxiv download 2305.16291 --out ./papers -c --device mps -y
```

Backed by [`docling`](https://github.com/docling-project/docling). The CLI auto-installs docling on first use (`-y` skips the prompt). For converting an existing PDF, see the **arxiv-convert** skill.

## Quick recipes

```bash
# Plain search
arxiv "diffusion models" --max-results 10

# Most recent first, filtered by category
arxiv "reinforcement learning" --category cs.LG --sort-by submitted-date

# Author-filtered, machine-readable
arxiv --author "Geoffrey Hinton" --max-results 20 --format ndjson

# Reuse a recent query (no API call)
arxiv "transformers" --use-cache

# Download + convert to Markdown (Apple Silicon GPU)
arxiv download 2305.16291 --out ./papers -c --device mps -y

# Health check when something feels off
arxiv doctor
```

## Hard rules

- **Never edit `~/.arxiv/history/searches.jsonl` by hand** — append-only; `--use-cache` depends on its ordering.
- **Exit code 3 = no results, not a failure.** Broaden or rephrase the query instead of retrying it verbatim.
- `--max-results` above 50 is silently capped (arXiv API per-request limit).
