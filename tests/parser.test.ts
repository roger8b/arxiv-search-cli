// tests/parser.test.ts
// Atom XML → ArxivPaper[] parsing, including whitespace + entity handling.

import { describe, it, expect } from 'vitest';
import { parseArxivXml } from '../src/arxiv/parser.js';

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2401.12345v2</id>
    <title>Attention   Is
    All You Need &amp; More</title>
    <published>2024-01-23T10:00:00Z</published>
    <updated>2024-01-25T12:00:00Z</updated>
    <summary>A study of
    transformers &lt;deep&gt;.</summary>
    <author><name>Alice Smith</name></author>
    <author><name>Bob Jones</name></author>
    <category term="cs.LG" />
    <category term="cs.AI" />
  </entry>
</feed>`;

describe('parseArxivXml', () => {
  it('extracts a paper with normalized whitespace and decoded entities', () => {
    const papers = parseArxivXml(SAMPLE);
    expect(papers).toHaveLength(1);
    const p = papers[0];
    expect(p.id).toBe('2401.12345');
    expect(p.title).toBe('Attention Is All You Need & More');
    expect(p.summary).toBe('A study of transformers <deep>.');
    expect(p.authors).toEqual(['Alice Smith', 'Bob Jones']);
    expect(p.published).toBe('2024-01-23');
    expect(p.updated).toBe('2024-01-25');
    expect(p.categories).toEqual(['cs.LG', 'cs.AI']);
    expect(p.absUrl).toBe('https://arxiv.org/abs/2401.12345');
    expect(p.pdfUrl).toBe('https://arxiv.org/pdf/2401.12345');
  });

  it('returns an empty array when there are no entries', () => {
    expect(parseArxivXml('<feed></feed>')).toEqual([]);
  });
});
