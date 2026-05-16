// src/commands/uninstall.ts
// Reverse of `arxiv init`. Walks every agent's project skillsDir (when scope
// includes "local") and globalSkillsDir (when scope includes "global"),
// removes all arxiv-* skills, and strips the marker-delimited section from
// every detected rule file. Also deletes `.arxiv.json` when removing locally.

import path from 'node:path';
import fs from 'fs-extra';
import pc from 'picocolors';
import { AGENTS, type AgentId, detectInstalledAgents } from '../utils/agents.js';

export interface UninstallOpts {
  cwd?: string;
  agent?: string;
  scope?: 'local' | 'global' | 'both';
  yes?: boolean;
}

type Scope = 'local' | 'global' | 'both';

function isScope(v: unknown): v is Scope {
  return v === 'local' || v === 'global' || v === 'both';
}

const ARXIV_START = '<!-- arxiv-start -->';
const ARXIV_END = '<!-- arxiv-end -->';
const SKILL_PREFIX = 'arxiv-';

export async function runUninstall(opts: UninstallOpts = {}): Promise<number> {
  const target = path.resolve(opts.cwd ?? '.');
  if (opts.scope !== undefined && !isScope(opts.scope)) {
    console.error(pc.red(`invalid --scope: ${String(opts.scope)} (expected local | global | both)`));
    return 1;
  }
  const scope: Scope = opts.scope ?? 'local';

  const agentIds = await resolveAgents(target, opts.agent, scope);
  if (agentIds.length === 0) {
    console.error(pc.yellow('! no arxiv installations found to remove'));
    return 0;
  }

  console.log(pc.dim(`project: ${target}`));
  console.log(pc.dim(`scope:   ${scope}`));
  console.log(pc.dim(`agents:  ${agentIds.map((id) => AGENTS[id]?.displayName ?? id).join(', ')}`));
  console.log();

  const cleanedRuleFiles = new Set<string>();

  for (const id of agentIds) {
    const def = AGENTS[id];
    if (!def) continue;

    const dests: string[] = [];
    if (scope === 'local' || scope === 'both') dests.push(path.join(target, def.skillsDir));
    if (scope === 'global' || scope === 'both') dests.push(def.globalSkillsDir);

    for (const dest of dests) {
      const removed = await removeArxivSkills(dest);
      if (removed > 0) {
        const rel = path.relative(target, dest);
        console.log(pc.green(`  ✓ removed ${removed} arxiv skill(s) from ${rel || dest}`));
      }
    }

    if (scope === 'local' || scope === 'both') {
      const rulePath = path.join(target, def.ruleFile);
      if (!cleanedRuleFiles.has(rulePath)) {
        cleanedRuleFiles.add(rulePath);
        if (await cleanRuleFile(rulePath)) {
          console.log(pc.green(`  ✓ cleaned ${path.relative(target, rulePath)}`));
        }
      }
    }
  }

  if (scope === 'local' || scope === 'both') {
    const configPath = path.join(target, '.arxiv.json');
    if (fs.existsSync(configPath)) {
      await fs.remove(configPath);
      console.log(pc.green('  ✓ removed .arxiv.json'));
    }
  }

  console.log(pc.green('\n✓ arxiv uninstalled.'));
  return 0;
}

async function resolveAgents(target: string, agentFlag: string | undefined, scope: Scope): Promise<AgentId[]> {
  if (agentFlag) {
    return AGENTS[agentFlag] ? [agentFlag] : [];
  }

  const ids = new Set<AgentId>();

  const configPath = path.join(target, '.arxiv.json');
  if (fs.existsSync(configPath)) {
    try {
      const manifest = await fs.readJson(configPath) as { agents?: AgentId[] };
      for (const a of manifest.agents ?? []) ids.add(a);
    } catch { /* ignore malformed */ }
  }

  if (scope === 'local' || scope === 'both') {
    for (const [id, def] of Object.entries(AGENTS)) {
      const rulePath = path.join(target, def.ruleFile);
      const skillsPath = path.join(target, def.skillsDir);
      if (fs.existsSync(rulePath) && fs.readFileSync(rulePath, 'utf8').includes(ARXIV_START)) ids.add(id);
      if (await hasArxivSkills(skillsPath)) ids.add(id);
    }
  }

  if (scope === 'global' || scope === 'both') {
    for (const id of detectInstalledAgents()) {
      const def = AGENTS[id];
      if (def && await hasArxivSkills(def.globalSkillsDir)) ids.add(id);
    }
  }

  return Array.from(ids);
}

async function hasArxivSkills(dir: string): Promise<boolean> {
  if (!fs.existsSync(dir)) return false;
  try {
    const entries = await fs.readdir(dir);
    return entries.some((e) => e.startsWith(SKILL_PREFIX));
  } catch { return false; }
}

async function removeArxivSkills(dir: string): Promise<number> {
  if (!fs.existsSync(dir)) return 0;
  let removed = 0;
  try {
    const entries = await fs.readdir(dir);
    for (const e of entries) {
      if (!e.startsWith(SKILL_PREFIX)) continue;
      await fs.remove(path.join(dir, e));
      removed++;
    }
  } catch { /* ignore */ }
  return removed;
}

async function cleanRuleFile(rulePath: string): Promise<boolean> {
  if (!fs.existsSync(rulePath)) return false;
  const content = await fs.readFile(rulePath, 'utf8');
  if (!content.includes(ARXIV_START)) return false;
  const stripped = content.replace(
    new RegExp(`\\n?${ARXIV_START}[\\s\\S]*?${ARXIV_END}\\n?`, 'm'),
    '',
  );
  await fs.writeFile(rulePath, stripped);
  return true;
}
