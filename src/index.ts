#!/usr/bin/env node
// src/index.ts
// arxiv entrypoint. Pure Commander — `setup`, `init`, `uninstall`, `doctor`,
// `download`, `search` (default). All search flags live in src/cli/options.ts
// and are wired into the `search` subcommand.

import { Command } from 'commander';
import pc from 'picocolors';
import { runSetup } from './commands/setup.js';
import { runSearch } from './commands/search.js';
import { runDownload } from './commands/download.js';
import { runConvert } from './commands/convert.js';
import { runDoctor } from './commands/doctor.js';
import { runInit } from './commands/init.js';
import { runUninstall } from './commands/uninstall.js';
import { applySearchOptions, optsToConfig, SEARCH_OPTIONS } from './cli/options.js';
import { VERSION } from './utils/version.js';

const KNOWN_COMMANDS = new Set([
  'setup', 'init', 'uninstall', 'doctor', 'search', 'download', 'convert', 'help',
]);

function printRootHelp(): void {
  process.stdout.write(`
arxiv ${VERSION} — arXiv Search CLI

Usage:
  arxiv [search] <query> [options]   Search arXiv papers (default command)
  arxiv download <id> [--out dir]    Download a paper PDF by arXiv ID
  arxiv convert <file> [--out dir]   Convert a PDF/doc to markdown via docling
  arxiv setup                        Provision data dir + check API reachability
  arxiv init [options]               Wire arxiv into the current project
  arxiv uninstall [options]          Reverse of init
  arxiv doctor                       Health check (data dir, history, API)
  arxiv --version / --help

Commands:
  search      Query the official arXiv API, return structured JSON/text
  download    Fetch a paper PDF by arXiv ID (--convert chains markdown conversion)
  convert     Convert a local PDF to markdown (auto-installs docling if missing)
  setup       One-time data dir provisioning (arXiv is public — no API key)
  init        Detects CLAUDE.md / AGENTS.md / GEMINI.md and installs skills
  uninstall   Removes the rules section and arxiv-* skills
  doctor      Health check

Init options (interactive by default; pass -y for non-interactive):
  --scope <local|global|both>   Where to install skills
  --method <symlink|copy>       Installation method (symlink default)
  --update                      Re-sync existing skills without asking
  --show-all                    Show every supported agent (not just detected)
  --force                       Overwrite even if an arxiv section is present
  -y, --yes                     Non-interactive (detected agents, local, symlink)

Uninstall options:
  --agent <id>                  Force a specific agent
  --scope <local|global|both>   Where to remove from (default: local)

Search options (use after a query, or with the 'search' subcommand):
`);
  const pad = Math.max(...SEARCH_OPTIONS.map((o) => o.flags.length)) + 2;
  for (const o of SEARCH_OPTIONS) {
    const def = o.defaultValue !== undefined && !o.collect && !o.flags.startsWith('--no-') && o.flags.includes('<')
      ? pc.dim(`  (default: ${String(o.defaultValue)})`)
      : '';
    process.stdout.write(`  ${o.flags.padEnd(pad)}${o.description}${def}\n`);
  }
  process.stdout.write(`\nExamples:\n`);
  process.stdout.write(`  arxiv "machine learning transformers"\n`);
  process.stdout.write(`  arxiv "diffusion models" --category cs.CV --sort-by submitted-date\n`);
  process.stdout.write(`  arxiv --author "Yann LeCun" --max-results 20\n`);
  process.stdout.write(`  arxiv download 2401.12345\n`);
  process.stdout.write(`\n`);
}

async function dispatch(rawArgv: string[]): Promise<number> {
  const argv = [...rawArgv];
  const first = argv[2];

  if (first === '--help' || first === '-h' || first === 'help') {
    printRootHelp();
    return 0;
  }
  if (first === '--version' || first === '-v') {
    process.stdout.write(`arxiv ${VERSION}\n`);
    return 0;
  }

  // Implicit search: prepend 'search' so commander routes to that subcommand.
  if (first && !KNOWN_COMMANDS.has(first)) {
    argv.splice(2, 0, 'search');
  }

  const program = new Command();
  program
    .name('arxiv')
    .description('arXiv Search CLI — query papers via the official API, with history/cache.')
    .version(VERSION)
    .exitOverride((err) => {
      throw err;
    });

  program
    .command('setup')
    .description('Provision the data dir and verify arXiv API reachability')
    .option('--skip-check', 'Skip the network reachability check')
    .action(async (opts) => { process.exitCode = await runSetup(opts); });

  program
    .command('init')
    .description('Wire arxiv into the current project (skills + rule section, interactive)')
    .option('--scope <local|global|both>', 'Where to install skills (default: ask)')
    .option('--method <symlink|copy>', 'Skills installation method (default: ask; symlink recommended)')
    .option('--update', 'Re-sync existing skills without asking')
    .option('--show-all', 'Show every supported agent (default: only detected)')
    .option('--force', 'Overwrite even if an arxiv section is already present')
    .option('-y, --yes', 'Non-interactive (detected agents, local scope, symlink method)')
    .action(async (opts) => { process.exitCode = await runInit(opts); });

  program
    .command('uninstall')
    .description('Remove arxiv skills + rule section from the current project (or --scope global)')
    .option('--agent <id>', 'Force a specific agent id')
    .option('--scope <local|global|both>', 'Where to remove from (default: local)')
    .option('-y, --yes', 'Skip confirmations')
    .action(async (opts) => { process.exitCode = await runUninstall(opts); });

  program
    .command('doctor')
    .description('Health check: data dir, history, arXiv API')
    .action(async () => { process.exitCode = await runDoctor(); });

  program
    .command('download <id>')
    .description('Download a paper PDF by arXiv ID')
    .option('--out <dir>', 'Output directory (default: cwd)')
    .option('-c, --convert', 'After downloading, convert PDF to markdown via docling')
    .option('--to <md|json|html|text|doctags>', 'Convert output format (default: md)')
    .option('--device <cpu|cuda|mps|auto>', 'Docling compute device')
    .option('--no-install', 'Do not auto-install docling if missing')
    .option('-y, --yes', 'Skip install confirmation prompt')
    .action(async (id: string, opts: { out?: string; convert?: boolean; to?: string; device?: string; install?: boolean; yes?: boolean }) => {
      process.exitCode = await runDownload(id, { ...opts, noInstall: opts.install === false });
    });

  program
    .command('convert <input>')
    .description('Convert a local PDF/doc to markdown via docling')
    .option('--out <dir>', 'Output directory (default: file directory)')
    .option('--to <md|json|html|text|doctags>', 'Output format (default: md)')
    .option('--image-mode <embedded|referenced|placeholder>', 'How to handle images (default: referenced)')
    .option('--device <cpu|cuda|mps|auto>', 'Compute device')
    .option('--force', 'Re-run even if a cached conversion exists')
    .option('--no-install', 'Do not auto-install docling if missing')
    .option('-y, --yes', 'Skip install confirmation prompt')
    .action(async (input: string, opts: { out?: string; to?: string; imageMode?: 'embedded' | 'referenced' | 'placeholder'; device?: string; force?: boolean; install?: boolean; yes?: boolean }) => {
      process.exitCode = await runConvert(input, { ...opts, noInstall: opts.install === false });
    });

  const searchCmd = program
    .command('search [query]')
    .description('Search arXiv papers (default — same as `arxiv <query>`)');
  applySearchOptions(searchCmd);
  searchCmd.action(async (positionalQuery: string | undefined, opts: Record<string, unknown>) => {
    const config = optsToConfig(positionalQuery, opts);
    process.exitCode = await runSearch(config);
  });

  try {
    await program.parseAsync(argv);
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === 'commander.helpDisplayed' || code === 'commander.version') return 0;
    throw err;
  }
  return typeof process.exitCode === 'number' ? process.exitCode : 0;
}

dispatch(process.argv)
  .then((code) => { process.exitCode = code; })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    process.stderr.write(`[arxiv] ERROR: ${message}\n`);
    process.exit(1);
  });
