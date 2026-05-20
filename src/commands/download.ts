// src/commands/download.ts
// `arxiv download <id>` — fetch a paper PDF by arXiv ID and save it locally.

import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import { fetchBinary } from '../arxiv/client.js';
import { normalizeArxivId } from '../arxiv/query.js';
import { runConvert } from './convert.js';

export interface DownloadOpts {
  out?: string;
  convert?: boolean;
  to?: string;
  device?: string;
  yes?: boolean;
  noInstall?: boolean;
}

export async function runDownload(rawId: string | undefined, opts: DownloadOpts = {}): Promise<number> {
  if (!rawId || !rawId.trim()) {
    console.error(pc.red('[arxiv] ERROR: arXiv ID required (e.g. `arxiv download 2401.12345`)'));
    return 1;
  }

  const id = normalizeArxivId(rawId);
  const url = `https://arxiv.org/pdf/${id}`;
  const outDir = path.resolve(opts.out ?? '.');
  const outFile = path.join(outDir, `${id.replace(/\//g, '_')}.pdf`);

  console.error(pc.cyan(`▸ arxiv download ${id}`));
  console.error(pc.dim(`  url: ${url}`));
  console.error(pc.dim(`  out: ${outFile}`));

  let data: Buffer;
  try {
    data = await fetchBinary(url);
  } catch (err: unknown) {
    console.error(pc.red(`[arxiv] ERROR: ${err instanceof Error ? err.message : String(err)}`));
    return 1;
  }

  if (data.length === 0) {
    console.error(pc.red('[arxiv] ERROR: empty response — check the arXiv ID'));
    return 1;
  }

  try {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outFile, data);
  } catch (err: unknown) {
    console.error(pc.red(`[arxiv] ERROR: write failed: ${err instanceof Error ? err.message : String(err)}`));
    return 1;
  }

  console.error(pc.green(`✓ saved ${(data.length / 1024).toFixed(0)} KB`));
  process.stdout.write(outFile + '\n');

  if (opts.convert) {
    const code = await runConvert(outFile, {
      out: outDir,
      to: opts.to,
      device: opts.device,
      yes: opts.yes,
      noInstall: opts.noInstall,
      id,
    });
    if (code !== 0) {
      console.error(pc.yellow('[arxiv] WARN: PDF saved but conversion failed'));
      return 0;
    }
  }

  return 0;
}
