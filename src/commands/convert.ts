// src/commands/convert.ts
// `arxiv convert <pdf>` — convert a local PDF (or other doc) to markdown via docling.
// Auto-installs docling on first use (with confirmation; `--yes` bypasses).

import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import { confirm } from '@inquirer/prompts';
import {
  detectDocling,
  expectedDoclingOutput,
  findCached,
  installCommand,
  installDocling,
  installHint,
  pickInstaller,
  recordConversion,
  runDocling,
} from '../utils/docling.js';

export interface ConvertOpts {
  out?: string;
  to?: string;
  imageMode?: 'embedded' | 'referenced' | 'placeholder';
  device?: string;
  force?: boolean;
  id?: string;
  yes?: boolean;
  noInstall?: boolean;
}

async function ensureDocling(opts: ConvertOpts): Promise<{ ok: boolean; bin: string; version?: string }> {
  let status = detectDocling();
  if (status.installed) return { ok: true, bin: status.bin, version: status.version };

  if (opts.noInstall) {
    console.error(pc.red(`[arxiv] ERROR: docling not found (${status.error || 'missing'})`));
    console.error(pc.yellow(`  install:  ${installHint()}`));
    return { ok: false, bin: status.bin };
  }

  const installer = pickInstaller();
  const cmd = installCommand(installer);
  console.error(pc.yellow(`[arxiv] docling not installed — will run: ${cmd.bin} ${cmd.args.join(' ')}`));

  let proceed = !!opts.yes;
  if (!proceed) {
    try {
      proceed = await confirm({ message: 'Install docling now?', default: true });
    } catch {
      proceed = false;
    }
  }
  if (!proceed) {
    console.error(pc.red('[arxiv] aborted — docling required for conversion'));
    return { ok: false, bin: status.bin };
  }

  const code = await installDocling(installer);
  if (code !== 0) {
    console.error(pc.red(`[arxiv] ERROR: install failed (exit ${code})`));
    console.error(pc.yellow(`  retry manually: ${installHint()}`));
    return { ok: false, bin: status.bin };
  }

  status = detectDocling();
  if (!status.installed) {
    console.error(pc.red('[arxiv] ERROR: docling still not on PATH after install'));
    console.error(pc.dim('  open a new shell or check your installer’s bin dir'));
    return { ok: false, bin: status.bin };
  }
  console.error(pc.green(`✓ docling installed${status.version ? ` (${status.version})` : ''}`));
  return { ok: true, bin: status.bin, version: status.version };
}

export async function runConvert(rawInput: string | undefined, opts: ConvertOpts = {}): Promise<number> {
  if (!rawInput || !rawInput.trim()) {
    console.error(pc.red('[arxiv] ERROR: input path required (e.g. `arxiv convert paper.pdf`)'));
    return 1;
  }
  const inputPath = path.resolve(rawInput);
  if (!fs.existsSync(inputPath)) {
    console.error(pc.red(`[arxiv] ERROR: file not found: ${inputPath}`));
    return 1;
  }

  const to = opts.to ?? 'md';
  const outDir = path.resolve(opts.out ?? path.dirname(inputPath));
  const expected = expectedDoclingOutput(inputPath, outDir, to);

  if (!opts.force) {
    const cached = findCached(inputPath);
    if (cached) {
      console.error(pc.dim(`▸ cached conversion: ${cached.md}`));
      process.stdout.write(cached.md + '\n');
      return 0;
    }
  }

  const ensured = await ensureDocling(opts);
  if (!ensured.ok) return 127;

  console.error(pc.cyan(`▸ arxiv convert ${path.basename(inputPath)}`));
  console.error(pc.dim(`  bin:    ${ensured.bin}${ensured.version ? ` (${ensured.version})` : ''}`));
  console.error(pc.dim(`  out:    ${expected}`));

  fs.mkdirSync(outDir, { recursive: true });

  const code = await runDocling(inputPath, {
    outDir,
    to,
    imageMode: opts.imageMode ?? 'referenced',
    device: opts.device,
  });

  if (code !== 0) {
    console.error(pc.red(`[arxiv] ERROR: docling exited with code ${code}`));
    return code;
  }

  if (!fs.existsSync(expected)) {
    console.error(pc.yellow(`[arxiv] WARN: expected output not found at ${expected}`));
    return 1;
  }

  recordConversion({
    id: opts.id,
    pdf: inputPath,
    md: expected,
    format: to,
    convertedAt: new Date().toISOString(),
  });

  console.error(pc.green(`✓ converted → ${expected}`));
  process.stdout.write(expected + '\n');
  return 0;
}
