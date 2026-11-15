#!/usr/bin/env node
// PocketPack - turn any web article or pasted text into a single-file offline study pack.
// Zero dependencies. Node 18+.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractArticle } from './src/extract.mjs';
import { buildPack } from './src/pack.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = process.env.PORT || 4174;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

function send(res, code, body, type = 'text/plain', headers = {}) {
  res.writeHead(code, { 'content-type': type, ...headers });
  res.end(body);
}

async function handlePack(req, res) {
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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname === '/api/health') return send(res, 200, JSON.stringify({ ok: true }), 'application/json');
  if (url.pathname === '/api/pack' && req.method === 'POST') return handlePack(req, res);
  // static
  let p = url.pathname === '/' ? '/index.html' : url.pathname;
  if (p.includes('..')) return send(res, 400, 'nope');
  try {
    const data = await readFile(join(ROOT, 'public', p));
    send(res, 200, data, MIME[extname(p)] || 'application/octet-stream');
  } catch {
    send(res, 404, 'not found');
  }
});

server.listen(PORT, () => {
  console.log(`PocketPack running at http://localhost:${PORT}`);
});
