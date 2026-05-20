// src/commands/doctor.ts
// Health check: version, ARXIV_HOME writability, history file, arXiv API
// reachability. Exits non-zero only on a hard failure (data dir not writable).

import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import { ARXIV_HOME, DEFAULT_CONFIG } from '../config/index.js';
import { fetchText } from '../arxiv/client.js';
import { VERSION } from '../utils/version.js';
import { detectDocling, installHint } from '../utils/docling.js';

interface Check {
  label: string;
  ok: boolean;
  fatal: boolean;
  detail: string;
}

export async function runDoctor(): Promise<number> {
  const checks: Check[] = [];

  checks.push({ label: 'arxiv version', ok: true, fatal: false, detail: VERSION });

  // ARXIV_HOME writable (fatal — history depends on it)
  let homeOk = true;
  let homeDetail = ARXIV_HOME;
  try {
    fs.mkdirSync(ARXIV_HOME, { recursive: true });
    const probe = path.join(ARXIV_HOME, '.write-probe');
    fs.writeFileSync(probe, '');
    fs.unlinkSync(probe);
  } catch (e) {
    homeOk = false;
    homeDetail = `${ARXIV_HOME} (not writable: ${(e as Error).message})`;
  }
  checks.push({ label: 'ARXIV_HOME', ok: homeOk, fatal: true, detail: homeDetail });

  // History file
  const historyExists = fs.existsSync(DEFAULT_CONFIG.historyFile);
  let historyLines = 0;
  if (historyExists) {
    try {
      historyLines = fs
        .readFileSync(DEFAULT_CONFIG.historyFile, 'utf8')
        .split('\n')
        .filter(Boolean).length;
    } catch {
      // ignore
    }
  }
  checks.push({
    label: 'History',
    ok: true,
    fatal: false,
    detail: historyExists
      ? `${DEFAULT_CONFIG.historyFile} (${historyLines} entries)`
      : `${DEFAULT_CONFIG.historyFile} (empty)`,
  });

  // arXiv API reachability (non-fatal)
  let apiOk = true;
  let apiDetail = DEFAULT_CONFIG.apiBase;
  try {
    await fetchText(`${DEFAULT_CONFIG.apiBase}?search_query=all:test&max_results=1`, {
      timeoutMs: 10000,
    });
  } catch (e) {
    apiOk = false;
    apiDetail = `${DEFAULT_CONFIG.apiBase} (unreachable: ${(e as Error).message})`;
  }
  checks.push({ label: 'arXiv API', ok: apiOk, fatal: false, detail: apiDetail });

  // docling (optional — `arxiv convert` will offer to auto-install)
  const docling = detectDocling();
  checks.push({
    label: 'docling',
    ok: docling.installed,
    fatal: false,
    detail: docling.installed
      ? `${docling.bin}${docling.version ? ` (${docling.version})` : ''}`
      : `not installed — install: ${installHint()} (or run \`arxiv convert\` to auto-install)`,
  });

  console.error(pc.cyan('▸ arxiv doctor'));
  console.error('');
  let fatalFail = false;
  for (const c of checks) {
    const icon = c.ok ? pc.green('✓') : c.fatal ? pc.red('✗') : pc.yellow('!');
    if (!c.ok && c.fatal) fatalFail = true;
    console.error(`  ${icon} ${c.label.padEnd(16)} ${pc.dim(c.detail)}`);
  }
  console.error('');
  if (!fatalFail) {
    console.error(pc.green('All critical checks passed.'));
    return 0;
  }
  console.error(pc.red('A critical check failed — see details above.'));
  return 1;
}
