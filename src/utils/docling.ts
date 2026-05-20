// src/utils/docling.ts
// Detects the docling CLI, optionally auto-installs it, runs conversions,
// and maintains a JSONL conversion cache under ARXIV_HOME/cache.

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ARXIV_HOME } from '../config/index.js';

export const DOCLING_BIN = process.env.ARXIV_DOCLING_BIN || 'docling';
export const CONVERSIONS_CACHE = path.join(ARXIV_HOME, 'cache', 'conversions.jsonl');

export type Installer = 'uv' | 'pipx' | 'pip';

export interface ConversionRecord {
  id?: string;
  pdf: string;
  md: string;
  format: string;
  convertedAt: string;
}

export interface DoclingStatus {
  installed: boolean;
  bin: string;
  version?: string;
  error?: string;
}

function findOnPath(cmd: string): string | undefined {
  if (cmd.includes(path.sep)) return fs.existsSync(cmd) ? cmd : undefined;
  const dirs = (process.env.PATH || '').split(path.delimiter);
  const exts = os.platform() === 'win32' ? (process.env.PATHEXT || '.EXE').split(';') : [''];
  for (const dir of dirs) {
    if (!dir) continue;
    for (const ext of exts) {
      const candidate = path.join(dir, cmd + ext);
      try {
        if (fs.statSync(candidate).isFile()) return candidate;
      } catch {
        // not found
      }
    }
  }
  return undefined;
}

export function detectDocling(): DoclingStatus {
  const resolved = findOnPath(DOCLING_BIN);
  if (!resolved) return { installed: false, bin: DOCLING_BIN, error: 'not found on PATH' };
  const res = spawnSync(resolved, ['--version'], { encoding: 'utf8', timeout: 8000 });
  if (res.error || res.status !== 0) {
    return { installed: true, bin: resolved, version: 'unknown' };
  }
  const version = (res.stdout || '').trim().split('\n')[0];
  return { installed: true, bin: resolved, version };
}

export function pickInstaller(): Installer {
  if (findOnPath('uv')) return 'uv';
  if (findOnPath('pipx')) return 'pipx';
  return 'pip';
}

export function installCommand(installer: Installer = pickInstaller()): { bin: string; args: string[] } {
  switch (installer) {
    case 'uv':   return { bin: 'uv',   args: ['tool', 'install', 'docling'] };
    case 'pipx': return { bin: 'pipx', args: ['install', 'docling'] };
    case 'pip':  return { bin: 'pip',  args: ['install', 'docling'] };
  }
}

export function installHint(): string {
  const cmd = installCommand();
  return `${cmd.bin} ${cmd.args.join(' ')}`;
}

export function installDocling(installer: Installer = pickInstaller()): Promise<number> {
  const { bin, args } = installCommand(installer);
  return new Promise((resolve) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'inherit', 'inherit'] });
    child.on('error', (err) => {
      process.stderr.write(`[arxiv] install spawn failed: ${err.message}\n`);
      resolve(127);
    });
    child.on('close', (code) => resolve(code ?? 1));
  });
}

export interface RunDoclingOpts {
  outDir: string;
  to?: string;                      // md | json | html | text | doctags
  imageMode?: 'embedded' | 'referenced' | 'placeholder';
  device?: string;                  // cpu | cuda | mps | auto
  extra?: string[];
}

export function runDocling(input: string, opts: RunDoclingOpts): Promise<number> {
  const args = [input, '--output', opts.outDir];
  if (opts.to) args.push('--to', opts.to);
  if (opts.imageMode) args.push('--image-export-mode', opts.imageMode);
  if (opts.device) args.push('--device', opts.device);
  if (opts.extra && opts.extra.length) args.push(...opts.extra);

  return new Promise((resolve) => {
    const child = spawn(DOCLING_BIN, args, { stdio: ['ignore', 'inherit', 'inherit'] });
    child.on('error', (err) => {
      process.stderr.write(`[arxiv] docling spawn failed: ${err.message}\n`);
      resolve(127);
    });
    child.on('close', (code) => resolve(code ?? 1));
  });
}

// docling writes <outDir>/<basename>.<ext>
export function expectedDoclingOutput(input: string, outDir: string, to: string): string {
  const base = path.basename(input, path.extname(input));
  const ext = to === 'md' ? 'md' : to === 'text' ? 'txt' : to;
  return path.join(outDir, `${base}.${ext}`);
}

export function recordConversion(rec: ConversionRecord): void {
  try {
    fs.mkdirSync(path.dirname(CONVERSIONS_CACHE), { recursive: true });
    fs.appendFileSync(CONVERSIONS_CACHE, JSON.stringify(rec) + '\n');
  } catch (e) {
    process.stderr.write(`[arxiv] WARN: could not write conversion cache: ${(e as Error).message}\n`);
  }
}

export function findCached(input: string): ConversionRecord | undefined {
  if (!fs.existsSync(CONVERSIONS_CACHE)) return undefined;
  try {
    const lines = fs.readFileSync(CONVERSIONS_CACHE, 'utf8').split('\n').filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      const rec = JSON.parse(lines[i]) as ConversionRecord;
      if (rec.pdf === input && fs.existsSync(rec.md)) return rec;
    }
  } catch {
    // ignore corrupt entries
  }
  return undefined;
}
