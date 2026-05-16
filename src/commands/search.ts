// src/commands/search.ts
// Search command: applies the --use-cache shortcut, then runs performSearch.
// Receives a fully resolved Config — option parsing happens in
// src/cli/options.ts via Commander.

import { performSearch } from '../search/index.js';
import { Config } from '../config/index.js';
import { lookupHistory } from '../history/index.js';
import { createPayload, emitSearchResult } from '../emitter/index.js';

export async function runSearch(config: Config): Promise<number> {
  if (!config.searchQuery && !config.author && !config.category) {
    process.stderr.write(
      '[arxiv] ERROR: provide a query, --author, or --category\n',
    );
    return 1;
  }

  if (config.useCache) {
    const hit = lookupHistory(config, config.cacheTtlSeconds);
    if (hit) {
      process.stderr.write(
        `[arxiv] cache hit for "${config.searchQuery || config.author || config.category}" (${hit.ts})\n`,
      );
      const payload = createPayload('ok', config, hit.papers);
      emitSearchResult(config, payload);
      return 0;
    }
  }

  try {
    return await performSearch(config);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    process.stderr.write(`[arxiv] ERROR: ${message}\n`);
    return 1;
  }
}
