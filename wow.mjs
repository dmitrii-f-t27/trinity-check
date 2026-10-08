// Trinity Check wow layer: preloader, ternary field behind the hero, scroll progress,
// spotlight cards. Pure decoration: nothing here reads or changes the check logic.
const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover:hover) and (pointer:fine)').matches;

// 1. Preloader: once per browser session, on the home page only.
(() => {
  if (reduce) return;
  let seen = false;
  try { seen = sessionStorage.getItem('tc-pre') === '1'; sessionStorage.setItem('tc-pre', '1'); } catch {}
  if (seen || !document.querySelector('.intro')) return;
  const pre = document.createElement('div');
  pre.className = 'wow-pre';
  pre.setAttribute('aria-hidden', 'true');
  pre.innerHTML = '<i></i><i></i><b>TRINITY<span>CHECK</span><em></em></b>';
  document.body.append(pre);
  root.classList.add('wow-lock');
  const t0 = performance.now(), dur = 900;
  const tick = (t) => {
    const p = Math.min(1, (t - t0) / dur);
    pre.style.setProperty('--p', p.toFixed(3));
    if (p < 1) requestAnimationFrame(tick);
    else {
      pre.classList.add('go');
      root.classList.remove('wow-lock');
      setTimeout(() => pre.remove(), 1900);
    }
  };
  requestAnimationFrame(tick);
  setTimeout(() => { root.classList.remove('wow-lock'); pre.classList.add('go'); }, 4000); // never trap the page
})();

// 2. Scroll progress.
(() => {
  const bar = document.createElement('div');
  bar.className = 'wow-progress';
  bar.setAttribute('aria-hidden', 'true');
  document.body.append(bar);
  let raf = 0;
  const upd = () => {
    raf = 0;
    const h = root.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${h > 0 ? Math.min(1, scrollY / h) : 0})`;
  };
  addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(upd); }, { passive: true });
  upd();
})();

// 3. Runtime names under the hero (proper names, no translation needed).
(() => {
  const facts = document.querySelector('.intro .facts');
  if (!facts || document.querySelector('.runtime-strip')) return;
  const ul = document.createElement('ul');
  ul.className = 'runtime-strip';
  ul.setAttribute('aria-label', 'llama.cpp, PrismML, bitnet.cpp, mortar.cpp');
  for (const n of ['llama.cpp', 'PrismML', 'bitnet.cpp', 'mortar.cpp']) {
    const li = document.createElement('li');
    li.textContent = n;
    li.setAttribute('aria-hidden', 'true');
    ul.append(li);
  }
  facts.after(ul);
})();

// 4. Ternary field: a lattice of balanced trits (-, 0, +) that drifts on a slow wave
//    and lights up near the pointer. Drawn with rectangles and arcs, 30 fps, paused
//    when off screen or in a background tab.
(() => {
  const host = document.body;
  const cv = document.createElement('canvas');
  cv.className = 'wow-field';
  cv.setAttribute('aria-hidden', 'true');
  host.prepend(cv);
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  const STEP = innerWidth < 700 ? 30 : 36;
  let W = 0, H = 0, dpr = 1, cols = 0, rows = 0, run = false, last = 0;
  const ptr = { x: -9999, y: -9999, a: 0 };
  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    const r = cv.getBoundingClientRect();
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(W / STEP) + 1; rows = Math.ceil(H / STEP) + 1;
    draw(performance.now());
  };
  const trit = (i, j, t) => {
    const v = Math.sin(i * 0.31 + t * 0.00042) + Math.cos(j * 0.27 - t * 0.00035) + Math.sin((i + j) * 0.12 + t * 0.0002);
    return v > 0.8 ? 1 : v < -0.8 ? -1 : 0;
  };
  const draw = (t) => {
    ctx.clearRect(0, 0, W, H);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const x = i * STEP + STEP / 2, y = j * STEP + STEP / 2;
        const dx = x - ptr.x, dy = y - ptr.y, d = Math.sqrt(dx * dx + dy * dy);
        const near = Math.max(0, 1 - d / 190) * ptr.a;
        let s = trit(i, j, t);
        if (near > 0.55) s = 1; else if (near > 0.3 && s < 1) s = 0;
        const base = s === 0 ? 0.2 : 0.34;
        const a = Math.min(1, base + near * 0.95);
        ctx.fillStyle = `rgba(95,212,168,${a.toFixed(3)})`;
        if (s === 0) { ctx.beginPath(); ctx.arc(x, y, 1.5 + near * 1.5, 0, 6.2832); ctx.fill(); }
        else if (s < 0) ctx.fillRect(x - 4, y - 0.75, 8, 1.5);
        else { ctx.fillRect(x - 4, y - 0.75, 8, 1.5); ctx.fillRect(x - 0.75, y - 4, 1.5, 8); }
      }
    }
  };
  const loop = (t) => {
    if (!run) return;
    if (t - last > 33) { last = t; ptr.a += ((ptr.x > -999 ? 1 : 0) - ptr.a) * 0.12; draw(t); }
    requestAnimationFrame(loop);
  };
  const start = () => { if (!run && !reduce && !document.hidden) { run = true; requestAnimationFrame(loop); } };
  const stop = () => { run = false; };
  new IntersectionObserver((e) => (e[0].isIntersecting ? start() : stop())).observe(cv);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  if (fine) {
    addEventListener('pointermove', (e) => { const r = cv.getBoundingClientRect(); ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top; }, { passive: true });
    document.addEventListener('pointerleave', () => { ptr.x = ptr.y = -9999; });
  }
  addEventListener('resize', resize);
  resize();
})();

// 5. Spotlight cards follow the pointer.
(() => {
  if (!fine) return;
  const sel = '.use-cases dl>div,.offer,.deliverables li,.run';
  document.addEventListener('pointermove', (e) => {
    const el = e.target.closest?.(sel);
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, { passive: true });
})();
