// tests/query.test.ts
// URL builder + arXiv ID normalization.

import { describe, it, expect } from 'vitest';
import { buildQueryUrl, normalizeArxivId } from '../src/arxiv/query.js';

const API = 'https://export.arxiv.org/api/query';

describe('buildQueryUrl', () => {
  it('builds an all: query', () => {
    const url = buildQueryUrl({ query: 'neural nets', maxResults: 5, sortBy: 'relevance', apiBase: API });
    expect(url).toContain('search_query=all:neural%20nets');
    expect(url).toContain('max_results=5');
    expect(url).toContain('sortBy=relevance');
    expect(url).toContain('sortOrder=descending');
  });

  it('combines query + author + category with +AND+', () => {
    const url = buildQueryUrl({
      query: 'rl', author: 'Sutton', category: 'cs.LG',
      maxResults: 10, sortBy: 'submitted-date', apiBase: API,
    });
    expect(url).toContain('all:rl+AND+au:Sutton+AND+cat:cs.LG');
  });

  it('maps sortBy to the arXiv API vocabulary', () => {
    expect(buildQueryUrl({ query: 'a', maxResults: 1, sortBy: 'submitted-date', apiBase: API }))
      .toContain('sortBy=submittedDate');
    expect(buildQueryUrl({ query: 'a', maxResults: 1, sortBy: 'updated-date', apiBase: API }))
      .toContain('sortBy=lastUpdatedDate');
  });

  it('throws when no search terms are given', () => {
    expect(() => buildQueryUrl({ maxResults: 5, sortBy: 'relevance', apiBase: API }))
      .toThrow(/at least one of/);
  });
});

describe('normalizeArxivId', () => {
  it('strips abs/pdf URL prefixes', () => {
    expect(normalizeArxivId('https://arxiv.org/abs/2401.12345')).toBe('2401.12345');
    expect(normalizeArxivId('http://arxiv.org/pdf/2401.12345')).toBe('2401.12345');
  });

  it('strips version suffix and .pdf', () => {
    expect(normalizeArxivId('2401.12345v3')).toBe('2401.12345');
    expect(normalizeArxivId('https://arxiv.org/pdf/2401.12345v2.pdf')).toBe('2401.12345');
  });

  it('passes through a bare id', () => {
    expect(normalizeArxivId('  2401.12345 ')).toBe('2401.12345');
  });
});
