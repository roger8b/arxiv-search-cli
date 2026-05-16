// src/config/index.ts
// Main configuration for arxiv-cli.

import os from 'node:os';
import { join } from 'node:path';

export type SortBy = 'relevance' | 'submitted-date' | 'updated-date';
export type Format = 'json' | 'ndjson' | 'text';

export interface Config {
  searchQuery: string;
  author: string;
  category: string;
  maxResults: number;
  sortBy: SortBy;
  format: Format;
  apiBase: string;
  historyFile: string;
  noHistory: boolean;
  useCache: boolean;
  cacheTtlSeconds: number;
}

// User data root. History lives here (not in the install dir), so reinstall
// via install.sh --local never destroys user state.
export const ARXIV_HOME = process.env.ARXIV_HOME || join(os.homedir(), '.arxiv');

const API_BASE = process.env.ARXIV_API_BASE || 'https://export.arxiv.org/api/query';
const HISTORY_FILE = process.env.ARXIV_HISTORY_FILE || join(ARXIV_HOME, 'history', 'searches.jsonl');

export const DEFAULT_CONFIG: Config = {
  searchQuery: process.env.ARXIV_QUERY || '',
  author: '',
  category: '',
  maxResults: Number(process.env.ARXIV_MAX_RESULTS || 5),
  sortBy: 'relevance',
  format: 'json',
  apiBase: API_BASE,
  historyFile: HISTORY_FILE,
  noHistory: process.env.ARXIV_NO_HISTORY === 'true',
  useCache: process.env.ARXIV_USE_CACHE === 'true',
  cacheTtlSeconds: Number(process.env.ARXIV_CACHE_TTL || 3600),
};

export const MAX_RESULTS_CAP = 50;

export { API_BASE, HISTORY_FILE };
