// src/arxiv/parser.ts
// Parses the Atom XML returned by the arXiv API into structured papers.
// Ported from the original pi-research extension; whitespace normalization
// fixed (the original collapsed literal "\n"/"\s" instead of real whitespace).

export interface ArxivPaper {
  id: string;
  title: string;
  authors: string[];
  published: string;
  updated: string;
  summary: string;
  categories: string[];
  absUrl: string;
  pdfUrl: string;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

export function parseArxivXml(xml: string): ArxivPaper[] {
  const papers: ArxivPaper[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
  let match: RegExpExecArray | null;

  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1];

    const getTag = (tag: string): string => {
      const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
      const m = entry.match(regex);
      return m ? decodeEntities(m[1].trim().replace(/\s+/g, ' ')) : '';
    };

    const rawId = getTag('id')
      .replace('http://arxiv.org/abs/', '')
      .replace('https://arxiv.org/abs/', '');
    const id = rawId.split('v')[0];
    const title = getTag('title');
    const authors = (entry.match(/<author>[\s\S]*?<name>(.*?)<\/name>[\s\S]*?<\/author>/gi) || [])
      .map((a) =>
        decodeEntities(
          a
            .replace(/<author>[\s\S]*?<name>/i, '')
            .replace(/<\/name>[\s\S]*?<\/author>/i, '')
            .trim(),
        ),
      );
    const published = getTag('published').slice(0, 10);
    const updated = getTag('updated').slice(0, 10);
    const summary = getTag('summary');
    const categories = (entry.match(/<category[^>]*term="([^"]+)"/gi) || []).map(
      (c) => c.match(/term="([^"]+)"/)?.[1] || '',
    );
    const absUrl = `https://arxiv.org/abs/${id}`;
    const pdfUrl = `https://arxiv.org/pdf/${id}`;

    papers.push({ id, title, authors, published, updated, summary, categories, absUrl, pdfUrl });
  }

  return papers;
}
