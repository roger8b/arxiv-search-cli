---
name: arxiv-convert
description: Use this skill when the user wants to turn a downloaded paper (or any local PDF / DOCX / HTML / image) into LLM-ready Markdown — phrases like "convert this PDF to markdown", "make this paper readable", "extract text from this paper", "save as markdown for the brain", or right after `arxiv download` when the user wants to read or ingest the result. Backed by `docling`. Do NOT invoke for raw text extraction the model can do trivially from short PDFs, or when the user only wants the PDF saved.
---

# arxiv-convert

`arxiv convert <file>` turns a local PDF (or DOCX / HTML / image) into Markdown using the [`docling`](https://github.com/docling-project/docling) CLI. Markdown is the best feedstock for LLM pipelines — structure, tables, equations and figure references survive intact.

## When to use

- User says "convert to markdown", "extract this paper", "make it readable for an LLM", "ingest this paper".
- Immediately after `arxiv download` when the user wants to read, summarize, or ingest the paper into a knowledge base.
- Any local PDF the user wants in Markdown — does not need to be from arXiv.

## When NOT to use

- User only wants the PDF saved (use `arxiv download` alone).
- File is already Markdown / plain text.
- Tiny PDFs whose text the model can lift directly from `Read` — docling cold-start is ~5s plus ~30s/page.

## Default invocation

```bash
arxiv convert ./papers/2305.16291.pdf
```

Outputs `<basename>.md` next to the input (and a `<basename>_artifacts/` folder with figures, by default). Prints the resulting Markdown path to stdout.

Exit codes: `0` ok · `1` error (bad input, validation, missing output) · `127` docling missing and auto-install refused / failed.

## Useful flags

| Flag | When |
|------|------|
| `--out <dir>` | Output directory (default: input's directory) |
| `--to <md\|json\|html\|text\|doctags>` | Output format (default `md`) |
| `--image-mode <embedded\|referenced\|placeholder>` | How to handle images (default `referenced` — separate files, best for brain ingestion) |
| `--device <cpu\|cuda\|mps\|auto>` | Compute device. On Apple Silicon, pass `mps` for ~3× speedup |
| `--force` | Re-run even when a cached conversion exists |
| `-y, --yes` | Skip the install confirmation prompt |
| `--no-install` | Refuse to auto-install docling |

## Chain conversion with download

```bash
arxiv download 2305.16291 --out ./papers --convert --device mps -y
```

The `-c, --convert`, `--to`, `--device`, `--no-install`, `-y` flags are also accepted on `arxiv download` and run conversion right after the PDF lands. If conversion fails, the PDF is still preserved.

## Auto-install

If `docling` is missing, the command:

1. Picks an installer (`uv` > `pipx` > `pip`).
2. Shows the exact command and asks for confirmation. Use `-y` to skip the prompt, `--no-install` to refuse.
3. Installs, re-detects, and continues with the conversion.

Override the binary path via `ARXIV_DOCLING_BIN=/path/to/docling`.

## Conversion cache

Successful conversions are appended to `~/.arxiv/cache/conversions.jsonl`:

```json
{"id":"2305.16291","pdf":"/abs/path/paper.pdf","md":"/abs/path/paper.md","format":"md","convertedAt":"2026-05-20T01:31:42.123Z"}
```

Re-running `arxiv convert` on the same input returns the cached path without re-invoking docling. Pass `--force` to bypass the cache.

## Quick recipes

```bash
# Convert an existing PDF (lookup once, then cached)
arxiv convert ./papers/2305.16291.pdf

# Download + convert in one shot, GPU-accelerated on Apple Silicon
arxiv download 2305.16291 --out ./papers -c --device mps -y

# Force a fresh conversion (ignore cache) into a different folder
arxiv convert paper.pdf --out ./md --force

# Get JSON output instead of Markdown
arxiv convert paper.pdf --to json

# Check docling status
arxiv doctor
```

## Hard rules

- **Do not edit `~/.arxiv/cache/conversions.jsonl` by hand** — append-only; the cache scan reads it newest-first.
- **Do not paste raw PDF text** into the conversation when the file is large — convert first, then `Read` the Markdown.
- **Use `--device mps`** on Apple Silicon; the default CPU path is much slower.
- **First run on a new machine triggers a model download** (~1.5 GB of layout/OCR weights). Expect a long first conversion.
- **`docling` install adds Python + PyTorch deps** (~500 MB). Tell the user before triggering `-y` non-interactively in CI / shared environments.
