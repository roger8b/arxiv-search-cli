// src/arxiv/client.ts
// Thin HTTP layer over the public arXiv API. Uses the global fetch (Node 18+).
// No auth — arXiv is public.

const USER_AGENT = 'arxiv-cli/0.1 (+https://github.com/roger8b/arxiv-search-cli)';

export interface FetchOptions {
  timeoutMs?: number;
}

export async function fetchText(url: string, opts: FetchOptions = {}): Promise<string> {
  const timeoutMs = opts.timeoutMs ?? 20000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`arXiv API returned HTTP ${res.status} for ${url}`);
    }
    return await res.text();
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`arXiv request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchBinary(url: string, opts: FetchOptions = {}): Promise<Buffer> {
  const timeoutMs = opts.timeoutMs ?? 60000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`arXiv returned HTTP ${res.status} for ${url}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`arXiv download timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
