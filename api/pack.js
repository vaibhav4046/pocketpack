// Vercel serverless version of the /api/pack endpoint (zero deps).
import { extractArticle } from '../src/extract.mjs';
import { buildPack } from '../src/pack.mjs';

function send(res, code, body, type = 'text/plain', headers = {}) {
  res.writeHead(code, { 'content-type': type, ...headers });
  res.end(body);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, JSON.stringify({ error: 'POST only.' }), 'application/json');
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 2_000_000) return send(res, 413, JSON.stringify({ error: 'Input too large (2 MB max).' }), 'application/json');
  }
  let input;
  try { input = JSON.parse(body); } catch { return send(res, 400, JSON.stringify({ error: 'Bad JSON.' }), 'application/json'); }
  const source = (input.source || '').trim();
  if (!source) return send(res, 400, JSON.stringify({ error: 'Nothing to pack. Paste a URL or some text.' }), 'application/json');

  let title = 'Pasted text', text = '', fromUrl = null;
  if (/^https?:\/\//i.test(source)) {
    fromUrl = source;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15000);
      const r = await fetch(source, {
        signal: ctrl.signal,
        headers: { 'user-agent': 'PocketPack/1.0 (+offline study pack generator)' },
        redirect: 'follow',
      });
      clearTimeout(t);
      if (!r.ok) return send(res, 502, JSON.stringify({ error: `Could not fetch that page (HTTP ${r.status}). Paste the text instead.` }), 'application/json');
      const html = await r.text();
      const got = extractArticle(html);
      if (!got.text || got.text.length < 200) return send(res, 422, JSON.stringify({ error: 'Could not find enough article text on that page. Paste the text instead.' }), 'application/json');
      title = got.title; text = got.text;
    } catch (e) {
      return send(res, 502, JSON.stringify({ error: `Fetch failed (${e.name === 'AbortError' ? 'timed out after 15s' : e.message}). Paste the text instead.` }), 'application/json');
    }
  } else {
    text = source;
    const firstLine = source.split('\n').find(l => l.trim().length > 0) || 'Pasted text';
    title = firstLine.trim().slice(0, 90);
  }

  const pack = buildPack({ title, text, fromUrl });
  const fname = 'pocketpack-' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) + '.html';
  send(res, 200, pack.html, 'text/html', {
    'content-disposition': `attachment; filename="${fname}"`,
    'x-pack-title': encodeURIComponent(pack.title),
    'x-pack-stats': encodeURIComponent(JSON.stringify(pack.stats)),
  });
}
