// tests/convert.test.ts
// Convert command — path validation, cache lookup, auto-install path, success record.

import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runConvert } from '../src/commands/convert.js';
import * as docling from '../src/utils/docling.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'arxiv-convert-'));

describe('runConvert', () => {
  afterEach(() => vi.restoreAllMocks());

  it('errors when no path given', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const code = await runConvert(undefined);
    expect(code).toBe(1);
    expect(err).toHaveBeenCalled();
  });

  it('errors when file missing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const code = await runConvert('/nope/missing.pdf');
    expect(code).toBe(1);
  });

  it('returns 127 with install hint when docling absent and --no-install', async () => {
    const dir = tmp();
    const pdf = path.join(dir, 'paper.pdf');
    fs.writeFileSync(pdf, 'fake');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(docling, 'detectDocling').mockReturnValue({ installed: false, bin: 'docling', error: 'not found' });
    vi.spyOn(docling, 'installHint').mockReturnValue('pipx install docling');
    const code = await runConvert(pdf, { noInstall: true });
    expect(code).toBe(127);
  });

  it('returns cached path without invoking docling', async () => {
    const dir = tmp();
    const pdf = path.join(dir, 'paper.pdf');
    const md = path.join(dir, 'paper.md');
    fs.writeFileSync(pdf, 'fake');
    fs.writeFileSync(md, '# cached');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const out = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(docling, 'detectDocling').mockReturnValue({ installed: true, bin: 'docling', version: '1.0.0' });
    vi.spyOn(docling, 'findCached').mockReturnValue({
      pdf, md, format: 'md', convertedAt: new Date().toISOString(),
    });
    const runSpy = vi.spyOn(docling, 'runDocling');
    const code = await runConvert(pdf);
    expect(code).toBe(0);
    expect(runSpy).not.toHaveBeenCalled();
    expect(out).toHaveBeenCalledWith(md + '\n');
  });

  it('auto-installs docling when missing and -y given', async () => {
    const dir = tmp();
    const pdf = path.join(dir, 'paper.pdf');
    fs.writeFileSync(pdf, 'fake');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const detectSpy = vi.spyOn(docling, 'detectDocling')
      .mockReturnValueOnce({ installed: false, bin: 'docling', error: 'missing' })
      .mockReturnValueOnce({ installed: true, bin: '/usr/local/bin/docling', version: '1.0.0' });
    vi.spyOn(docling, 'pickInstaller').mockReturnValue('pipx');
    vi.spyOn(docling, 'installCommand').mockReturnValue({ bin: 'pipx', args: ['install', 'docling'] });
    const installSpy = vi.spyOn(docling, 'installDocling').mockResolvedValue(0);
    vi.spyOn(docling, 'findCached').mockReturnValue(undefined);
    const expected = path.join(dir, 'paper.md');
    vi.spyOn(docling, 'expectedDoclingOutput').mockReturnValue(expected);
    vi.spyOn(docling, 'runDocling').mockImplementation(async () => {
      fs.writeFileSync(expected, '# out');
      return 0;
    });
    vi.spyOn(docling, 'recordConversion').mockImplementation(() => {});
    const code = await runConvert(pdf, { yes: true, out: dir });
    expect(code).toBe(0);
    expect(installSpy).toHaveBeenCalledWith('pipx');
    expect(detectSpy).toHaveBeenCalledTimes(2);
  });

  it('records conversion on success', async () => {
    const dir = tmp();
    const pdf = path.join(dir, 'paper.pdf');
    fs.writeFileSync(pdf, 'fake');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(docling, 'detectDocling').mockReturnValue({ installed: true, bin: 'docling' });
    vi.spyOn(docling, 'findCached').mockReturnValue(undefined);
    const expected = path.join(dir, 'paper.md');
    vi.spyOn(docling, 'expectedDoclingOutput').mockReturnValue(expected);
    vi.spyOn(docling, 'runDocling').mockImplementation(async () => {
      fs.writeFileSync(expected, '# out');
      return 0;
    });
    const rec = vi.spyOn(docling, 'recordConversion').mockImplementation(() => {});
    const code = await runConvert(pdf, { out: dir });
    expect(code).toBe(0);
    expect(rec).toHaveBeenCalledWith(expect.objectContaining({ pdf, md: expected, format: 'md' }));
  });
});
