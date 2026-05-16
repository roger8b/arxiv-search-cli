// src/commands/init.ts
// `arxiv init` — interactive (or --yes) project wiring.
//
// Detects every supported agent on the machine, lets the user pick which ones
// to wire, installs arxiv-* skills at the chosen scope (local / global / both)
// using symlink or copy, writes a marker-delimited section to each agent's
// rule file (CLAUDE.md, AGENTS.md, GEMINI.md, .clinerules,
// .cursor/rules/arxiv.mdc, etc.), and records a `.arxiv.json` manifest in the
// project root.

import path from 'node:path';
import fs from 'fs-extra';
import pc from 'picocolors';
import { checkbox, select } from '@inquirer/prompts';
import { AGENTS, type AgentConfig, type AgentId, detectInstalledAgents } from '../utils/agents.js';
import { templatesDir } from '../utils/templates-dir.js';

export interface InitOpts {
  cwd?: string;
  force?: boolean;
  yes?: boolean;
  scope?: 'local' | 'global' | 'both';
  method?: 'symlink' | 'copy';
  showAll?: boolean;
  update?: boolean;
}

type Scope = 'local' | 'global' | 'both';
type Method = 'symlink' | 'copy';
type ExistingAction = 'keep' | 'update' | 'remove' | 'ask-each';

function isScope(v: unknown): v is Scope {
  return v === 'local' || v === 'global' || v === 'both';
}

function isMethod(v: unknown): v is Method {
  return v === 'symlink' || v === 'copy';
}

const ARXIV_START = '<!-- arxiv-start -->';
const ARXIV_END = '<!-- arxiv-end -->';
const SKILL_PREFIX = 'arxiv-';

// ── content generators ──────────────────────────────────────────────────────

function boilerplate(agentId: string): string {
  const def = AGENTS[agentId];
  const skillsDir = def?.skillsDir ?? '.agents/skills';
  const globalSkillsDir = def?.globalSkillsDir ?? '~/.claude/skills';
  return `${ARXIV_START}
# arxiv — arXiv Search CLI

The user has \`arxiv\` installed — a CLI that queries the official arXiv API and returns structured paper metadata (title, authors, abstract, categories, links). Prefer \`arxiv\` over generic WebSearch / WebFetch when researching academic papers, citations, or scholarly topics.

**Skills:**
- Local: \`${skillsDir}/${SKILL_PREFIX}*/SKILL.md\`
- Global: \`${globalSkillsDir}/${SKILL_PREFIX}*/SKILL.md\`

| To … | Use … |
|------|-------|
| Search papers | \`arxiv "<query>"\` |
| Filter by category | \`arxiv "<query>" --category cs.AI\` |
| Filter by author | \`arxiv "<query>" --author "Yann LeCun"\` |
| Most recent first | \`arxiv "<query>" --sort-by submitted-date\` |
| Download a PDF | \`arxiv download <arxiv-id>\` |
| Reuse cached query | \`arxiv "<query>" --use-cache\` |
| Health check | \`arxiv doctor\` |
| Full options | \`arxiv --help\` |

## Hard rules

- Never edit \`~/.arxiv/history/searches.jsonl\` by hand — append-only; \`--use-cache\` depends on its ordering.
- Exit code 3 = no results (not an error). Broaden the query instead of retrying verbatim.
- \`--max-results\` is capped at 50 (arXiv API limit per request).
${ARXIV_END}
`;
}

function cursorRule(): string {
  return `---
description: arxiv — arXiv Search CLI; prefer for academic paper research
alwaysApply: true
---

${ARXIV_START}
The user has \`arxiv\` installed. It queries the official arXiv API and returns structured paper metadata. Prefer \`arxiv\` over WebSearch / WebFetch for academic papers, citations, or scholarly topics.

- All paper searches go through the \`arxiv\` CLI. Run \`arxiv --help\`.
- Load skills from \`.agents/skills/${SKILL_PREFIX}*/SKILL.md\` when triggers apply.
- Never edit \`~/.arxiv/history/searches.jsonl\` directly.
${ARXIV_END}
`;
}

// ── file helpers ────────────────────────────────────────────────────────────

async function writeRuleFile(
  file: string,
  content: string,
  appendOk: boolean,
  force: boolean,
): Promise<'wrote' | 'appended' | 'skipped'> {
  await fs.ensureDir(path.dirname(file));

  if (!fs.existsSync(file)) {
    await fs.writeFile(file, content);
    return 'wrote';
  }

  const existing = await fs.readFile(file, 'utf8');

  if (existing.includes(ARXIV_START)) {
    if (!force) return 'skipped';
    const replaced = existing.replace(
      new RegExp(`${ARXIV_START}[\\s\\S]*?${ARXIV_END}\\n?`, 'm'),
      content,
    );
    await fs.writeFile(file, replaced);
    return 'wrote';
  }

  if (appendOk) {
    await fs.appendFile(file, '\n' + content);
    return 'appended';
  }

  if (force) {
    await fs.writeFile(file, content);
    return 'wrote';
  }

  return 'skipped';
}

// ── skills helpers ──────────────────────────────────────────────────────────

async function detectSkillsAt(dir: string): Promise<{ count: number; isSymlink: boolean }> {
  if (!fs.existsSync(dir)) return { count: 0, isSymlink: false };
  let count = 0;
  let isSymlink = false;
  try {
    const entries = await fs.readdir(dir);
    for (const e of entries) {
      const p = path.join(dir, e);
      if (e.startsWith(SKILL_PREFIX) && fs.existsSync(path.join(p, 'SKILL.md'))) count++;
    }
    const arxivEntry = entries.find((e) => e.startsWith(SKILL_PREFIX));
    if (arxivEntry) isSymlink = fs.lstatSync(path.join(dir, arxivEntry)).isSymbolicLink();
  } catch { /* ignore */ }
  return { count, isSymlink };
}

async function installSkills(
  destDir: string,
  srcDir: string,
  method: Method,
  force: boolean,
): Promise<number> {
  await fs.ensureDir(destDir);
  const entries = await fs.readdir(srcDir);
  let installed = 0;

  for (const e of entries) {
    if (!e.startsWith(SKILL_PREFIX)) continue;
    const from = path.join(srcDir, e);
    const to = path.join(destDir, e);

    let entryExists = false;
    try { fs.lstatSync(to); entryExists = true; } catch { /* truly absent */ }

    if (entryExists && !force) continue;
    if (entryExists) { try { await fs.remove(to); } catch { /* ignore */ } }

    if (method === 'symlink') {
      try {
        await fs.ensureSymlink(from, to, 'dir');
      } catch {
        await fs.copy(from, to, { overwrite: true });
      }
    } else {
      await fs.copy(from, to, { overwrite: true });
    }
    installed++;
  }
  return installed;
}

async function removeArxivSkills(dir: string): Promise<number> {
  if (!fs.existsSync(dir)) return 0;
  let removed = 0;
  const entries = await fs.readdir(dir);
  for (const e of entries) {
    if (!e.startsWith(SKILL_PREFIX)) continue;
    await fs.remove(path.join(dir, e));
    removed++;
  }
  return removed;
}

function resolveSkillsDestForAgent(target: string, def: AgentConfig, scope: Scope): string[] {
  const dests: string[] = [];
  if (scope === 'local' || scope === 'both') dests.push(path.join(target, def.skillsDir));
  if (scope === 'global' || scope === 'both') dests.push(def.globalSkillsDir);
  return dests;
}

// ── main command ────────────────────────────────────────────────────────────

export async function runInit(opts: InitOpts = {}): Promise<number> {
  const target = path.resolve(opts.cwd ?? '.');
  if (opts.scope !== undefined && !isScope(opts.scope)) {
    console.error(pc.red(`invalid --scope: ${String(opts.scope)} (expected local | global | both)`));
    return 1;
  }
  if (opts.method !== undefined && !isMethod(opts.method)) {
    console.error(pc.red(`invalid --method: ${String(opts.method)} (expected symlink | copy)`));
    return 1;
  }
  if (!fs.existsSync(target)) {
    console.error(pc.red(`target not found: ${target}`));
    return 1;
  }

  console.log(pc.dim(`project: ${target}`));
  console.log();

  const detected = new Set(detectInstalledAgents());

  // Agents that already have arxiv-* skills installed (local or global).
  const alreadySetup = new Set<AgentId>();
  for (const [id, def] of Object.entries(AGENTS)) {
    const localCount = (await detectSkillsAt(path.join(target, def.skillsDir))).count;
    const globalCount = (await detectSkillsAt(def.globalSkillsDir)).count;
    if (localCount > 0 || globalCount > 0) alreadySetup.add(id);
  }

  // ── select agents ────────────────────────────────────────────────────────
  let selectedAgents: AgentId[];
  if (opts.yes) {
    if (alreadySetup.size > 0) selectedAgents = Array.from(alreadySetup);
    else if (detected.size > 0) selectedAgents = Array.from(detected);
    else selectedAgents = ['claude-code'];
  } else {
    const showAll = opts.showAll;
    const visible = Object.entries(AGENTS).filter(([id]) =>
      showAll || detected.has(id) || alreadySetup.has(id) || id === 'claude-code',
    );
    selectedAgents = await checkbox<AgentId>({
      message: showAll
        ? `Agents (${Object.keys(AGENTS).length} total — use space to toggle)`
        : `Detected agents (${detected.size} found, ${alreadySetup.size} with arxiv skills already set up)`,
      choices: visible.map(([id, def]) => {
        const tags: string[] = [];
        if (alreadySetup.has(id)) tags.push(pc.cyan('(arxiv set up)'));
        else if (detected.has(id)) tags.push(pc.green('(detected)'));
        return {
          name: tags.length ? `${def.displayName} ${tags.join(' ')}` : def.displayName,
          value: id,
          checked: alreadySetup.has(id),
        };
      }),
    });
  }

  if (selectedAgents.length === 0) {
    console.log(pc.yellow('no agents selected — nothing to do.'));
    return 0;
  }

  // ── scope ────────────────────────────────────────────────────────────────
  const scope: Scope = opts.scope ?? (
    opts.yes
      ? 'local'
      : await select<Scope>({
          message: 'Install skills where?',
          choices: [
            { name: 'Local   (inside project, per agent dir)', value: 'local' },
            { name: 'Global  (in each agent\'s home dir)', value: 'global' },
            { name: 'Both    (local + global)', value: 'both' },
          ],
        })
  );

  // ── method ───────────────────────────────────────────────────────────────
  const method: Method = opts.method ?? (
    opts.yes
      ? 'symlink'
      : await select<Method>({
          message: 'Skills installation method:',
          choices: [
            { name: 'Symlink  (recommended — auto-updates when CLI updates skills)', value: 'symlink' },
            { name: 'Copy     (static snapshot)', value: 'copy' },
          ],
        })
  );

  // ── compute unique skill destinations (dedup shared dirs) ────────────────
  const destToAgents = new Map<string, AgentId[]>();
  for (const id of selectedAgents) {
    const def = AGENTS[id];
    if (!def) continue;
    for (const dest of resolveSkillsDestForAgent(target, def, scope)) {
      const list = destToAgents.get(dest) ?? [];
      list.push(id);
      destToAgents.set(dest, list);
    }
  }

  // ── existing skills handling ─────────────────────────────────────────────
  const destsWithExisting: Array<{ dest: string; count: number; isSymlink: boolean }> = [];
  for (const dest of destToAgents.keys()) {
    const s = await detectSkillsAt(dest);
    if (s.count > 0) destsWithExisting.push({ dest, ...s });
  }

  let existingAction: ExistingAction = 'update';
  if (destsWithExisting.length > 0 && !opts.update && !opts.force) {
    if (opts.yes) {
      existingAction = 'update';
    } else {
      const total = destsWithExisting.reduce((s, d) => s + d.count, 0);
      existingAction = await select<ExistingAction>({
        message: `Found ${total} arxiv skill(s) across ${destsWithExisting.length} location(s). Action?`,
        choices: [
          { name: 'Update    (re-sync all from arxiv templates)', value: 'update' },
          { name: 'Keep      (don\'t touch existing)', value: 'keep' },
          { name: 'Remove    (wipe arxiv-* then reinstall)', value: 'remove' },
          { name: 'Ask each  (prompt per location)', value: 'ask-each' },
        ],
      });
    }
  } else if (opts.update) {
    existingAction = 'update';
  }

  const td = templatesDir();
  const srcSkillsDir = path.join(td, 'skills');
  if (!fs.existsSync(srcSkillsDir)) {
    console.error(pc.red(`skills templates not found at ${srcSkillsDir}. Reinstall the CLI.`));
    return 1;
  }

  // ── install skills per destination ───────────────────────────────────────
  console.log();
  for (const [dest, agentIds] of destToAgents) {
    const rel = path.relative(target, dest) || dest;
    const label = agentIds.length > 1
      ? `${rel} ${pc.dim(`(shared: ${agentIds.map((a) => AGENTS[a].displayName).join(', ')})`)}`
      : `${rel} ${pc.dim(`(${AGENTS[agentIds[0]].displayName})`)}`;
    console.log(pc.bold(label));

    let force = !!opts.force;
    let skipDest = false;
    const existing = destsWithExisting.find((d) => d.dest === dest);
    if (existing) {
      let action: ExistingAction = existingAction;
      if (action === 'ask-each') {
        action = await select<ExistingAction>({
          message: `  ${rel}: ${existing.count} arxiv skill(s) ${existing.isSymlink ? '(symlinked)' : '(copied)'}. Action?`,
          choices: [
            { name: 'Update', value: 'update' },
            { name: 'Keep', value: 'keep' },
            { name: 'Remove', value: 'remove' },
          ],
        });
      }
      if (action === 'keep') {
        console.log(pc.dim(`  keeping ${existing.count} existing skill(s)`));
        skipDest = true;
      } else if (action === 'remove') {
        const n = await removeArxivSkills(dest);
        console.log(pc.dim(`  removed ${n} arxiv skill(s)`));
        force = true;
      } else if (action === 'update') {
        force = true;
      }
    }

    if (!skipDest) {
      const n = await installSkills(dest, srcSkillsDir, method, force);
      const verb = method === 'symlink' ? 'symlinked' : 'copied';
      console.log(pc.green(`  ✓ ${n} skill(s) ${verb}`));
    }
  }

  // ── rule files per agent (dedup shared files like AGENTS.md) ─────────────
  console.log();
  const writtenRuleFiles = new Map<string, AgentId>();
  for (const agentId of selectedAgents) {
    const def = AGENTS[agentId];
    if (!def) continue;
    const ruleAbs = path.join(target, def.ruleFile);
    const content = def.ruleFormat === 'cursor' ? cursorRule() : boilerplate(agentId);

    if (writtenRuleFiles.has(def.ruleFile)) {
      console.log(pc.dim(`  shared rule file already written: ${def.ruleFile} (${AGENTS[writtenRuleFiles.get(def.ruleFile)!].displayName})`));
      continue;
    }
    writtenRuleFiles.set(def.ruleFile, agentId);
    const result = await writeRuleFile(ruleAbs, content, def.appendOk, !!opts.force);
    const rel = path.relative(target, ruleAbs);
    if (result === 'wrote') console.log(pc.green(`  ✓ wrote ${rel}`));
    else if (result === 'appended') console.log(pc.green(`  ✚ appended to ${rel}`));
    else console.log(pc.yellow(`  skip (already has arxiv section): ${rel}`));
  }

  // ── .arxiv.json manifest ─────────────────────────────────────────────────
  const configPath = path.join(target, '.arxiv.json');
  await fs.writeJson(
    configPath,
    {
      agents: selectedAgents,
      scope,
      method,
      version: 1,
      installed_at: new Date().toISOString(),
    },
    { spaces: 2 },
  );
  console.log(pc.green(`\n✓ wrote .arxiv.json`));

  console.log(pc.green(`\n✓ project wired to arxiv. Run \`arxiv doctor\` to verify.`));
  return 0;
}
