// tests/init.test.ts
// runInit / runUninstall happy paths with a pinned fake HOME and temp project.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';

const realHome = process.env.HOME;
const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'arxiv-home-'));
process.env.HOME = fakeHome;
process.env.ARXIV_HOME = path.join(fakeHome, '.arxiv');

const { runInit } = await import('../src/commands/init.js');
const { runUninstall } = await import('../src/commands/uninstall.js');

let project: string;

beforeEach(() => {
  project = fs.mkdtempSync(path.join(os.tmpdir(), 'arxiv-init-'));
});

afterEach(() => {
  fs.rmSync(project, { recursive: true, force: true });
});

afterAll(() => {
  fs.rmSync(fakeHome, { recursive: true, force: true });
  if (realHome !== undefined) process.env.HOME = realHome;
});

describe('runInit (--yes)', () => {
  it('writes CLAUDE.md, skills, and .arxiv.json locally', async () => {
    const code = await runInit({ cwd: project, yes: true, scope: 'local', method: 'copy' });
    expect(code).toBe(0);

    const ruleFile = path.join(project, 'CLAUDE.md');
    expect(fs.existsSync(ruleFile)).toBe(true);
    expect(fs.readFileSync(ruleFile, 'utf8')).toContain('<!-- arxiv-start -->');

    const manifest = path.join(project, '.arxiv.json');
    expect(fs.existsSync(manifest)).toBe(true);

    const skills = path.join(project, '.claude', 'skills');
    expect(fs.existsSync(path.join(skills, 'arxiv-search', 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(skills, 'arxiv-history', 'SKILL.md'))).toBe(true);
  });

  it('runUninstall removes skills, rule section, and manifest', async () => {
    await runInit({ cwd: project, yes: true, scope: 'local', method: 'copy' });
    const code = await runUninstall({ cwd: project, scope: 'local' });
    expect(code).toBe(0);

    expect(fs.existsSync(path.join(project, '.arxiv.json'))).toBe(false);
    const rule = fs.readFileSync(path.join(project, 'CLAUDE.md'), 'utf8');
    expect(rule).not.toContain('<!-- arxiv-start -->');
    expect(fs.existsSync(path.join(project, '.claude', 'skills', 'arxiv-search'))).toBe(false);
  });
});
