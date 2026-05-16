// tests/options.test.ts
// Exercises the Commander-driven search subcommand: option parsing into a
// Config, --no-history, defaults, capping, and rejected input.

import { describe, it, expect } from 'vitest';
import { Command } from 'commander';
import { applySearchOptions, optsToConfig } from '../src/cli/options.js';
import type { Config } from '../src/config/index.js';

function parse(args: string[]): { positional: string | undefined; config: Config } {
  let positional: string | undefined;
  let captured: Record<string, unknown> = {};
  const program = new Command();
  program.exitOverride();
  const cmd = program.command('search [query]').action((q, opts) => {
    positional = q;
    captured = opts;
  });
  applySearchOptions(cmd);
  program.parse(['node', 'arxiv', 'search', ...args], { from: 'node' });
  return { positional, config: optsToConfig(positional, captured) };
}

describe('search options → Config', () => {
  it('accepts a positional query', () => {
    expect(parse(['hello world']).config.searchQuery).toBe('hello world');
  });

  it('accepts --query / -q', () => {
    expect(parse(['-q', 'foo']).config.searchQuery).toBe('foo');
    expect(parse(['--query', 'bar']).config.searchQuery).toBe('bar');
  });

  it('parses --author and --category', () => {
    const { config } = parse(['x', '--author', 'Hinton', '--category', 'cs.LG']);
    expect(config.author).toBe('Hinton');
    expect(config.category).toBe('cs.LG');
  });

  it('defaults maxResults to 5 and sortBy to relevance', () => {
    const { config } = parse(['x']);
    expect(config.maxResults).toBe(5);
    expect(config.sortBy).toBe('relevance');
    expect(config.format).toBe('json');
  });

  it('parses and caps --max-results at 50', () => {
    expect(parse(['x', '--max-results', '12']).config.maxResults).toBe(12);
    expect(parse(['x', '--max-results', '999']).config.maxResults).toBe(50);
  });

  it('accepts valid --sort-by and --format', () => {
    expect(parse(['x', '--sort-by', 'submitted-date']).config.sortBy).toBe('submitted-date');
    expect(parse(['x', '--format', 'ndjson']).config.format).toBe('ndjson');
    expect(parse(['x', '--format', 'text']).config.format).toBe('text');
  });

  it('--no-history sets noHistory', () => {
    expect(parse(['x', '--no-history']).config.noHistory).toBe(true);
    expect(parse(['x']).config.noHistory).toBe(false);
  });

  it('--use-cache and --cache-ttl', () => {
    const { config } = parse(['x', '--use-cache', '--cache-ttl', '60']);
    expect(config.useCache).toBe(true);
    expect(config.cacheTtlSeconds).toBe(60);
  });

  it('rejects invalid --sort-by', () => {
    expect(() => parse(['x', '--sort-by', 'bogus'])).toThrow(/Invalid --sort-by/);
  });

  it('rejects invalid --format', () => {
    expect(() => parse(['x', '--format', 'xml'])).toThrow(/Invalid --format/);
  });

  it('rejects non-positive --max-results', () => {
    expect(() => parse(['x', '--max-results', '0'])).toThrow(/--max-results/);
  });
});
