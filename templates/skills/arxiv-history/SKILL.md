---
name: arxiv-history
description: Use this skill when the user wants to review past arXiv searches or reuse a cached result for an identical query to skip the API call. Trigger phrases include "what papers did we search", "history of my arxiv searches", "same query again use cache", "without re-querying arxiv", "show my recent paper searches".
---

# arxiv-history

`arxiv` appends every successful search to `~/.arxiv/history/searches.jsonl` (one JSON entry per line). The history is the source of truth for **cache hits** — reusing an identical query (same query + author + category) without calling the arXiv API.

## When to use

- User asks what papers / topics they searched recently.
- User repeats an identical query and wants the cached result (faster, no API call).
- User wants to grep / pipe prior results without re-querying.

## Cache: reuse a previous query

```bash
arxiv "exact same query" --use-cache --cache-ttl 3600
```

If a matching entry (same query, `--author`, `--category`) exists within `--cache-ttl` seconds, the result is returned without hitting the arXiv API. The cache key is the combination of all three — changing any of them is a cache miss.

## Read history directly

The history is plain JSONL — safe to grep / pipe through `jq`:

```bash
# Last 20 queries
tail -n 20 ~/.arxiv/history/searches.jsonl | jq -r .query

# All paper IDs ever returned for queries containing "transformer"
grep -i "transformer" ~/.arxiv/history/searches.jsonl | jq -r '.papers[].id'

# Searches from the last hour
jq -c "select(.ts > \"$(date -u -v -1H +%Y-%m-%dT%H:%M:%SZ)\")" ~/.arxiv/history/searches.jsonl

# Every paper title from category-filtered searches
jq -r 'select(.category != "") | .papers[].title' ~/.arxiv/history/searches.jsonl
```

## Disable history

```bash
arxiv "sensitive one-off query" --no-history
```

## Hard rules

- **Never edit `searches.jsonl` by hand.** It's append-only; reordering or rewriting entries breaks `--use-cache` (last-write-wins scan from the end).
- **Use `--no-history` only for one-off / sensitive queries.** Otherwise leave it on — it makes repeat lookups free.
