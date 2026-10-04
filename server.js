// Trinity Check server for Railway: serves the static site, keeps an anonymous
// event log and shows owner-only statistics at /stats. No dependencies.
// Privacy: no cookies, no IP addresses or user agents are stored, never the file URL.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, '.data');
const LOG = path.join(DATA_DIR, 'events.jsonl');
const STATS_PASSWORD = process.env.STATS_PASSWORD || '';
fs.mkdirSync(DATA_DIR, { recursive: true });

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.wasm': 'application/wasm', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.woff2': 'font/woff2'
};
const PLAIN = new Set(['LICENSE', 'NOTICE']);
const SECURITY = {
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()', 'Strict-Transport-Security': 'max-age=31536000'
};

function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
  if (rel.endsWith('/')) rel += 'index.html';
  const ext = path.extname(rel);
  const base = path.basename(rel);
  // Only site assets: hidden paths, server code and package files are never served.
  if (rel.split('/').some(p => p.startsWith('.')) || !(TYPES[ext] || PLAIN.has(base)) || base === 'DESIGN.md' || base === 'package.json') return notFound(res);
  const fp = path.normalize(path.join(ROOT, rel));
  if (!fp.startsWith(ROOT + path.sep)) return notFound(res);
  fs.stat(fp, (err, st) => {
    if (err || !st.isFile()) return notFound(res);
    const immutable = url.searchParams.has('v') || ext === '.woff2';
    res.writeHead(200, { ...SECURITY, 'Content-Type': TYPES[ext] || 'text/plain; charset=utf-8', 'Content-Length': st.size,
      'Cache-Control': ext === '.html' ? 'no-cache' : immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=3600' });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(fp).pipe(res);
  });
}
function notFound(res) {
  res.writeHead(404, { ...SECURITY, 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
}

// ---- events -------------------------------------------------------------
const EVENT_TYPES = new Set(['view', 'check_start', 'check_done', 'check_error', 'audit_click', 'pay_click', 'tip_copy']);
const LANGS = new Set(['ru', 'en', 'es', 'pt-BR', 'zh-CN', 'ja']);
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|headless|lighthouse/i;
const hits = new Map(); // in-memory rate limit per hashed client, cleared every minute
setInterval(() => hits.clear(), 60_000).unref();

function clean(s, max) { return typeof s === 'string' ? s.replace(/[^\w.\-/]/g, '').slice(0, max) : undefined; }

function recordEvent(req, res) {
  let body = '';
  req.on('data', c => { body += c; if (body.length > 2048) req.destroy(); });
  req.on('end', () => {
    res.writeHead(204, SECURITY); res.end();
    const ua = req.headers['user-agent'] || '';
    if (BOT.test(ua)) return;
    const key = crypto.createHash('sha256').update((req.headers['x-forwarded-for'] || req.socket.remoteAddress || '') + ua).digest('hex').slice(0, 16);
    const n = (hits.get(key) || 0) + 1; hits.set(key, n);
    if (n > 120) return;
    let e; try { e = JSON.parse(body); } catch { return; }
    if (!e || !EVENT_TYPES.has(e.t)) return;
    const rec = {
      ts: new Date().toISOString(), t: e.t,
      p: clean(e.p, 40) || '/', l: LANGS.has(e.l) ? e.l : undefined,
      r: clean(e.r, 60) || undefined,
      d: /Mobi|Android|iPhone|iPad/i.test(ua) ? 'mobile' : 'desktop',
      n: Number.isInteger(e.n) && e.n > 0 && e.n < 100 ? e.n : undefined,
      q: e.q === 1 ? 1 : undefined
    };
    fs.appendFile(LOG, JSON.stringify(rec) + '\n', () => {});
  });
}

// ---- stats --------------------------------------------------------------
function authorized(req) {
  if (!STATS_PASSWORD) return false;
  const h = req.headers.authorization || '';
  if (!h.startsWith('Basic ')) return false;
  const pass = Buffer.from(h.slice(6), 'base64').toString().split(':').slice(1).join(':');
  const a = Buffer.from(pass), b = Buffer.from(STATS_PASSWORD);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function aggregate() {
  const now = Date.now(), day = 86_400_000;
  const lines = fs.existsSync(LOG) ? fs.readFileSync(LOG, 'utf8').split('\n').filter(Boolean) : [];
  const windows = { '24h': 1, '7d': 7, '30d': 30 };
  const totals = {}, qa = {};
  for (const w of Object.keys(windows)) { totals[w] = {}; qa[w] = 0; }
  const byDay = {}, refs = {}, langs = {}, devices = {}, pages = {};
  for (const line of lines) {
    let e; try { e = JSON.parse(line); } catch { continue; }
    const age = (now - Date.parse(e.ts)) / day;
    for (const [w, d] of Object.entries(windows)) if (age <= d) { if (e.q) qa[w]++; else totals[w][e.t] = (totals[w][e.t] || 0) + 1; }
    if (e.q || age > 30) continue;
    const k = e.ts.slice(0, 10); byDay[k] = byDay[k] || {}; byDay[k][e.t] = (byDay[k][e.t] || 0) + 1;
    if (e.t === 'view') {
      refs[e.r || '(direct)'] = (refs[e.r || '(direct)'] || 0) + 1;
      langs[e.l || '?'] = (langs[e.l || '?'] || 0) + 1;
      devices[e.d] = (devices[e.d] || 0) + 1;
      pages[e.p] = (pages[e.p] || 0) + 1;
    }
  }
  return { generated: new Date().toISOString(), events: lines.length, totals, qa, byDay, refs, langs, devices, pages };
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function table(title, obj) {
  const rows = Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 15);
  return `<section><h2>${title}</h2><table>${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td class=n>${v}</td></tr>`).join('') || '<tr><td>—</td></tr>'}</table></section>`;
}
function statsPage(s) {
  const L = { view: 'Просмотры', check_start: 'Проверок начато', check_done: 'Проверок завершено', check_error: 'Ошибок проверки', audit_click: 'Клик «Заказать аудит»', pay_click: 'Клик «Оплатить»', tip_copy: 'Скопирован кошелёк' };
  const card = w => `<div class=card><h3>${w}</h3>${Object.keys(L).map(t => `<p><span>${L[t]}</span><b>${s.totals[w][t] || 0}</b></p>`).join('')}<p class=qa><span>Тестовые (QA)</span><b>${s.qa[w]}</b></p></div>`;
  const days = Object.keys(s.byDay).sort().reverse();
  return `<!doctype html><html lang=ru><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><meta name=robots content=noindex><title>Trinity Check — статистика</title>
<style>body{font:15px/1.5 system-ui,sans-serif;margin:0;background:#f6f8f7;color:#14201c}main{max-width:1000px;margin:auto;padding:32px 20px}h1{font-size:28px;margin:0 0 4px}.muted{color:#56645f;font-size:13px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin:24px 0}.card,section{background:#fff;border:1px solid #dbe3df;border-radius:10px;padding:16px 18px}.card h3{margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:#136653}.card p{display:flex;justify-content:space-between;margin:4px 0}.card b,.n{font-variant-numeric:tabular-nums}.qa{color:#56645f;border-top:1px solid #dbe3df;padding-top:6px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}h2{font-size:15px;margin:0 0 8px}table{width:100%;border-collapse:collapse}td{padding:4px 0;border-bottom:1px solid #eef3f0;overflow-wrap:anywhere}.n{text-align:right;padding-left:12px}.days{overflow-x:auto;margin-top:14px}.days th,.days td{padding:4px 8px;text-align:right;white-space:nowrap}.days th:first-child,.days td:first-child{text-align:left}</style></head>
<body><main><h1>Trinity Check — статистика</h1><p class=muted>Анонимно: без cookie, IP и адресов файлов. Числа — события из браузеров, не уникальные люди. Тестовые запуски (открыть сайт с <code>?qa=1</code>) считаются отдельно. Обновлено ${esc(s.generated)} · событий в журнале: ${s.events} · <a href="/stats.json">JSON</a></p>
<div class=cards>${['24h', '7d', '30d'].map(card).join('')}</div>
<div class=grid>${table('Откуда пришли (30 дней)', s.refs)}${table('Языки', s.langs)}${table('Устройства', s.devices)}${table('Страницы', s.pages)}</div>
<section class=days><h2>По дням (30 дней)</h2><table><tr><th>Дата</th>${Object.values(L).map(x => `<th>${x}</th>`).join('')}</tr>${days.map(d => `<tr><td>${d}</td>${Object.keys(L).map(t => `<td>${s.byDay[d][t] || 0}</td>`).join('')}</tr>`).join('')}</table></section>
</main></body></html>`;
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/event' && req.method === 'POST') return recordEvent(req, res);
  if (url.pathname === '/healthz') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok'); }
  if (url.pathname === '/stats' || url.pathname === '/stats.json') {
    if (!authorized(req)) { res.writeHead(401, { ...SECURITY, 'WWW-Authenticate': 'Basic realm="Trinity Check stats", charset="UTF-8"' }); return res.end('Authorization required'); }
    const s = aggregate();
    const json = url.pathname.endsWith('.json');
    res.writeHead(200, { ...SECURITY, 'Content-Type': json ? 'application/json; charset=utf-8' : 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
    return res.end(json ? JSON.stringify(s, null, 1) : statsPage(s));
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, SECURITY); return res.end(); }
  serveStatic(req, res, url);
}).listen(PORT, () => console.log(`trinity-check listening on ${PORT}, data in ${DATA_DIR}`));
