// Anonymous usage counts for the owner's /stats page (served by server.js on Railway).
// Sends no cookies, no file URLs, no identifiers. Static mirrors (GitHub Pages,
// Hugging Face) have no endpoint, so nothing is sent there. Open the site with
// ?qa=1 once to mark this browser's own test runs; ?qa=0 clears the mark.
const host = location.hostname;
const enabled = !/(\.github\.io|\.hf\.space|huggingface\.co)$/.test(host) && location.protocol !== 'file:';
let qa = false;
try {
  const flag = new URL(location.href).searchParams.get('qa');
  if (flag === '1') localStorage.setItem('tc-qa', '1');
  if (flag === '0') localStorage.removeItem('tc-qa');
  qa = localStorage.getItem('tc-qa') === '1';
} catch {}

function send(t, extra = {}) {
  if (!enabled) return;
  const body = JSON.stringify({ t, p: location.pathname.replace(/\/index\.html$/, '/'), l: document.documentElement.lang, q: qa ? 1 : undefined, ...extra });
  try {
    if (!navigator.sendBeacon?.('/api/event', new Blob([body], { type: 'application/json' })))
      fetch('/api/event', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {});
  } catch {}
}

let ref;
try { const r = document.referrer && new URL(document.referrer); if (r && r.hostname !== host) ref = r.hostname.replace(/^www\./, ''); } catch {}
// i18n sets <html lang> during module evaluation; send after it has run.
setTimeout(() => send('view', { r: ref }), 0);

addEventListener('tc:start', () => send('check_start'));
addEventListener('tc:done', () => send('check_done'));
addEventListener('tc:error', () => send('check_error'));
document.addEventListener('click', e => {
  const a = e.target.closest?.('a,button');
  if (!a) return;
  if (a.matches('[data-pay-link]')) send('pay_click');
  else if (a.matches('[data-tip-copy], .tip-copy')) send('tip_copy');
  else if (a.matches('a[href*="type=audit"]')) send('audit_click');
});
