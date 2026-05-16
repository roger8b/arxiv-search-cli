// src/emitter/index.ts
// Output emitter with format support: json (pretty), ndjson (one paper per
// line), text (human-readable). stdout = machine payload, never colorized.

import { Config } from '../config/index.js';
import { ArxivPaper } from '../arxiv/parser.js';

export type SearchStatus = 'ok' | 'no-results';

export interface SearchResultPayload {
  status: SearchStatus;
  query: string;
  author: string;
  category: string;
  count: number;
  source: 'arxiv';
  papers: Array<ArxivPaper & { position: number }>;
}

export function createPayload(
  status: SearchStatus,
  config: Pick<Config, 'searchQuery' | 'author' | 'category'>,
  papers: ArxivPaper[],
): SearchResultPayload {
  return {
    status,
    query: config.searchQuery,
    author: config.author,
    category: config.category,
    count: papers.length,
    source: 'arxiv',
    papers: papers.map((p, index) => ({ position: index + 1, ...p })),
  };
}

function renderText(payload: SearchResultPayload): string {
  if (payload.papers.length === 0) {
    return 'No papers found. Try a different query or broader search.\n';
  }
  const lines: string[] = [];
  lines.push(`Found ${payload.count} paper(s):\n`);
  for (const p of payload.papers) {
    const moreAuthors = p.authors.length > 3 ? ` +${p.authors.length - 3} more` : '';
    lines.push(`${p.position}. ${p.title}`);
    lines.push(`   ID: ${p.id} | Published: ${p.published} | Updated: ${p.updated}`);
    lines.push(`   Authors: ${p.authors.slice(0, 3).join(', ')}${moreAuthors}`);
    lines.push(`   Categories: ${p.categories.slice(0, 3).join(', ')}`);
    lines.push(
      `   Abstract: ${p.summary.slice(0, 300)}${p.summary.length > 300 ? '...' : ''}`,
    );
    lines.push(`   Links: ${p.absUrl} | ${p.pdfUrl}`);
    lines.push('');
  }
  return lines.join('\n') + '\n';
}

export function emitSearchResult(config: Config, payload: SearchResultPayload): void {
  if (config.format === 'text') {
    process.stdout.write(renderText(payload));
    return;
  }
  if (config.format === 'ndjson') {
    for (const paper of payload.papers) {
      process.stdout.write(JSON.stringify(paper) + '\n');
    }
    return;
  }
  process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
}
