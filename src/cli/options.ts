// src/cli/options.ts
// Single source of truth for `arxiv search` flags. Used by Commander to wire
// the search subcommand and by the root help to print the same options.

import { Command } from 'commander';
import {
  Config,
  DEFAULT_CONFIG,
  MAX_RESULTS_CAP,
  type SortBy,
  type Format,
} from '../config/index.js';

export interface SearchOptionDef {
  flags: string;
  description: string;
  defaultValue?: unknown;
  collect?: boolean;
}

export const SEARCH_OPTIONS: SearchOptionDef[] = [
  { flags: '-q, --query <text>', description: 'Search query (title/abstract/all fields)' },
  { flags: '--author <name>', description: 'Filter by author name (e.g. "Geoffrey Hinton")' },
  { flags: '--category <cat>', description: 'arXiv category (e.g. cs.AI, cs.LG, stat.ML)' },
  { flags: '--max-results <n>', description: `Maximum results (max ${MAX_RESULTS_CAP})`, defaultValue: DEFAULT_CONFIG.maxResults },
  { flags: '--sort-by <relevance|submitted-date|updated-date>', description: 'Sort order', defaultValue: DEFAULT_CONFIG.sortBy },
  { flags: '--format <json|ndjson|text>', description: 'Output format', defaultValue: DEFAULT_CONFIG.format },
  { flags: '--api-base <url>', description: 'arXiv API base URL', defaultValue: DEFAULT_CONFIG.apiBase },
  { flags: '--history-file <path>', description: 'Append-only JSONL of all searches', defaultValue: DEFAULT_CONFIG.historyFile },
  { flags: '--no-history', description: 'Disable history append' },
  { flags: '--use-cache', description: 'Reuse history entry for same query within TTL' },
  { flags: '--cache-ttl <seconds>', description: 'Cache TTL when --use-cache', defaultValue: DEFAULT_CONFIG.cacheTtlSeconds },
];

export function applySearchOptions(cmd: Command): Command {
  for (const opt of SEARCH_OPTIONS) {
    if (opt.defaultValue !== undefined) {
      cmd.option(opt.flags, opt.description, String(opt.defaultValue));
    } else {
      cmd.option(opt.flags, opt.description);
    }
  }
  return cmd;
}

const SORT_VALUES: SortBy[] = ['relevance', 'submitted-date', 'updated-date'];
const FORMAT_VALUES: Format[] = ['json', 'ndjson', 'text'];

// Commander returns string for value-bearing options because we pass string
// defaults. Coerce to the Config shape.
export function optsToConfig(
  positionalQuery: string | undefined,
  opts: Record<string, unknown>,
): Config {
  const query = (opts.query as string | undefined) ?? positionalQuery ?? '';
  const author = String(opts.author ?? '');
  const category = String(opts.category ?? '');

  let maxResults = parsePositiveInt(opts.maxResults, DEFAULT_CONFIG.maxResults, '--max-results');
  if (maxResults > MAX_RESULTS_CAP) maxResults = MAX_RESULTS_CAP;

  const sortBy = String(opts.sortBy ?? DEFAULT_CONFIG.sortBy) as SortBy;
  if (!SORT_VALUES.includes(sortBy)) {
    throw new Error(`Invalid --sort-by value: ${sortBy} (expected ${SORT_VALUES.join(' | ')})`);
  }

  const format = String(opts.format ?? DEFAULT_CONFIG.format) as Format;
  if (!FORMAT_VALUES.includes(format)) {
    throw new Error(`Invalid --format value: ${format} (expected ${FORMAT_VALUES.join(' | ')})`);
  }

  return {
    searchQuery: query,
    author,
    category,
    maxResults,
    sortBy,
    format,
    apiBase: String(opts.apiBase ?? DEFAULT_CONFIG.apiBase),
    historyFile: String(opts.historyFile ?? DEFAULT_CONFIG.historyFile),
    // commander turns --no-history into history:false
    noHistory: opts.history === false,
    useCache: Boolean(opts.useCache),
    cacheTtlSeconds: parseNumber(opts.cacheTtl, DEFAULT_CONFIG.cacheTtlSeconds, '--cache-ttl'),
  };
}

function parseNumber(value: unknown, fallback: number, label: string): number {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`Invalid ${label} value: ${value}`);
  return n;
}

function parsePositiveInt(value: unknown, fallback: number, label: string): number {
  const n = parseNumber(value, fallback, label);
  if (n <= 0) throw new Error(`Invalid ${label} value: ${value} (must be > 0)`);
  return Math.floor(n);
}
