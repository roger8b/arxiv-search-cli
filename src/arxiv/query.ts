// src/arxiv/query.ts
// Builds arXiv API query URLs and normalizes arXiv IDs.

import type { SortBy } from '../config/index.js';

export interface QueryParams {
  query?: string;
  author?: string;
  category?: string;
  maxResults: number;
  sortBy: SortBy;
  apiBase: string;
}

const SORT_MAP: Record<SortBy, string> = {
  relevance: 'relevance',
  'submitted-date': 'submittedDate',
  'updated-date': 'lastUpdatedDate',
};

export function buildQueryUrl(params: QueryParams): string {
  const { query, author, category, maxResults, sortBy, apiBase } = params;

  if (!query && !author && !category) {
    throw new Error('Provide at least one of: query, author, or category');
  }

  const terms: string[] = [];
  if (query) terms.push(`all:${encodeURIComponent(query)}`);
  if (author) terms.push(`au:${encodeURIComponent(author)}`);
  if (category) terms.push(`cat:${encodeURIComponent(category)}`);

  const searchQuery = terms.join('+AND+');
  const sort = SORT_MAP[sortBy] ?? 'relevance';

  return (
    `${apiBase}?search_query=${searchQuery}` +
    `&max_results=${maxResults}` +
    `&sortBy=${sort}` +
    `&sortOrder=descending`
  );
}

// Strips a URL prefix and version suffix from a user-supplied arXiv ID.
// "https://arxiv.org/abs/2401.12345v2" -> "2401.12345"
export function normalizeArxivId(raw: string): string {
  const trimmed = raw.trim();
  const withoutPrefix = trimmed
    .replace(/^https?:\/\/arxiv\.org\/(abs|pdf)\//i, '')
    .replace(/\.pdf$/i, '');
  return withoutPrefix.split('v')[0];
}
