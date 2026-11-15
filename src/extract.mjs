// Crude but honest article extraction: score block containers by paragraph text
// density, keep the winner's paragraphs. No external deps.
export function extractArticle(html) {
  const titleMatch = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
  const ogMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']{1,200})["']/i)
    || html.match(/<meta[^>]+content=["']([^"']{1,200})["'][^>]+property=["']og:title["']/i);
  let title = decodeEntities((ogMatch?.[1] || titleMatch?.[1] || 'Web article').trim());

  // strip scripts/styles/navs and boilerplate-ish tags
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(nav|header|footer|aside|form|iframe|svg|figure)[\s\S]*?<\/\1>/gi, ' ');

  // grab candidate containers: article/main/section/div
  const blocks = [];
  const re = /<(article|main|section|div)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = re.exec(cleaned)) !== null) {
    const paras = [...m[2].matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
      .map(p => stripTags(p[1]))
      .filter(t => t.length > 60);
    if (paras.length) blocks.push({ paras, score: paras.reduce((a, p) => a + p.length, 0) });
  }

  // fallback candidate: every <p> on the page (nested-div-proof)
  const allParas = [...cleaned.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map(p => stripTags(p[1]))
    .filter(t => t.length > 60);
  const allText = allParas.join('\n\n');

  let text = allText;
  if (blocks.length) {
    blocks.sort((a, b) => b.score - a.score);
    const best = blocks[0].paras.join('\n\n');
    // prefer the scored block only when it is not drastically smaller
    if (best.length >= allText.length * 0.6) text = best;
  }
  // drop citation brackets like [1] [citation needed]
  text = text.replace(/\[[^\]\n]{1,40}\]/g, '').replace(/[ \t]+/g, ' ');
  return { title, text: text.trim() };
}

export function stripTags(s) {
  return decodeEntities(
    s.replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

export function decodeEntities(s) {
  const map = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '-', ndash: '-', hellip: '...', lsquo: "'", rsquo: "'", ldquo: '"', rdquo: '"' };
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => map[name.toLowerCase()] ?? m);
}
