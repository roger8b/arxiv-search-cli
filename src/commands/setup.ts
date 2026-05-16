// src/commands/setup.ts
// One-time setup. The arXiv API is public and needs no credentials, so this
// just provisions the user data directory (history lives there) and confirms
// network reachability.

import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import { ARXIV_HOME, DEFAULT_CONFIG } from '../config/index.js';
import { fetchText } from '../arxiv/client.js';

export interface SetupOpts {
  skipCheck?: boolean;
}

export async function runSetup(opts: SetupOpts = {}): Promise<number> {
  console.error(pc.cyan('▸ arxiv setup'));
  console.error(`  data dir: ${ARXIV_HOME}`);
  console.error(`  history:  ${DEFAULT_CONFIG.historyFile}`);
  console.error(pc.dim('  (arXiv is a public API — no API key or login required)'));
  console.error('');

  try {
    fs.mkdirSync(ARXIV_HOME, { recursive: true });
    fs.mkdirSync(path.dirname(DEFAULT_CONFIG.historyFile), { recursive: true });
  } catch (err: unknown) {
    console.error(pc.red(`✗ could not create data dir: ${err instanceof Error ? err.message : String(err)}`));
    return 1;
  }
  console.error(pc.green(`✓ data dir ready`));

  if (!opts.skipCheck) {
    try {
      await fetchText(
        `${DEFAULT_CONFIG.apiBase}?search_query=all:test&max_results=1`,
        { timeoutMs: 10000 },
      );
      console.error(pc.green('✓ arXiv API reachable'));
    } catch (err: unknown) {
      console.error(pc.yellow(`! arXiv API check failed: ${err instanceof Error ? err.message : String(err)}`));
      console.error(pc.dim('  (you can still retry searches later)'));
    }
  }

  console.error('');
  console.error(pc.green('✓ setup complete'));
  console.error('');
  console.error('  Try a search:');
  console.error('    arxiv "machine learning transformers"');
  console.error('');
  return 0;
}
