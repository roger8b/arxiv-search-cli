// src/search/index.ts
// Search orchestration: builds the arXiv query URL, fetches, parses, emits.
// Receives a fully resolved Config — option parsing happens in
// src/cli/options.ts via Commander.

import { Config } from '../config/index.js';
import { buildQueryUrl } from '../arxiv/query.js';
import { fetchText } from '../arxiv/client.js';
import { parseArxivXml } from '../arxiv/parser.js';
import { createPayload, emitSearchResult } from '../emitter/index.js';
import { appendHistory } from '../history/index.js';

function log(message: string): void {
  process.stderr.write(`[arxiv] ${message}\n`);
}

export async function performSearch(config: Config): Promise<number> {
  let url: string;
  try {
    url = buildQueryUrl({
      query: config.searchQuery || undefined,
      author: config.author || undefined,
      category: config.category || undefined,
      maxResults: config.maxResults,
      sortBy: config.sortBy,
      apiBase: config.apiBase,
    });
  } catch (err: unknown) {
    log(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }

  log(`querying arXiv: ${url}`);

  let xml: string;
  try {
    xml = await fetchText(url);
  } catch (err: unknown) {
    log(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }

  const papers = parseArxivXml(xml);

  if (papers.length === 0) {
    log('no papers found');
    const payload = createPayload('no-results', config, []);
    emitSearchResult(config, payload);
    appendHistory(config, payload);
    return 3;
  }

  log(`found ${papers.length} paper(s)`);
  const payload = createPayload('ok', config, papers);
  emitSearchResult(config, payload);
  appendHistory(config, payload);
  return 0;
}
