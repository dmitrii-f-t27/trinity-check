import {t,locale} from './i18n.mjs';
// Motion layer. Presentation only: verdicts shown on the scan stage come from
// the same t27 WASM report the results table renders (app.mjs dispatches them).
import {verdict,statusText,filename} from './report-view.mjs';

const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const EASE_OUT = 'cubic-bezier(.23,1,.32,1)', EASE_IN_OUT = 'cubic-bezier(.77,0,.175,1)';
const root = document.documentElement;
const el = (tag, cls, text) => {const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n;};
const wait = ms => new Promise(r => setTimeout(r, reduce.matches ? 0 : ms));
const int = n => Number(n).toLocaleString(locale);
const gb = n => new Intl.NumberFormat(locale, {style: 'unit', unit: 'gigabyte', maximumFractionDigits: 2}).format(Number(n) / 1e9);

// Translucent header: a shadow appears only once content runs under it.
const onScroll = () => root.toggleAttribute('data-scrolled', scrollY > 4);
addEventListener('scroll', onScroll, {passive: true}); onScroll();

// Scroll reveals, fired once. Elements are hidden only after this runs.
root.classList.add('js-reveal');
const seen = new IntersectionObserver(entries => {
  for (const e of entries) if (e.isIntersecting) {e.target.setAttribute('data-visible', ''); seen.unobserve(e.target); e.target.dispatchEvent(new Event('reveal'));}
}, {rootMargin: '0px 0px -12% 0px'});
function reveal(selector, group = false) {
  for (const n of document.querySelectorAll(selector)) {n.setAttribute(group ? 'data-reveal-group' : 'data-reveal', ''); seen.observe(n);}
}
reveal('.plain-guide'); reveal('.use-cases > h2'); reveal('.use-cases dl', true); reveal('.scope'); reveal('.privacy');
reveal('.audience'); reveal('.audit-section > h2'); reveal('.audit-section > p'); reveal('.deliverables', true);
reveal('.evidence-list', true); reveal('.download-row'); reveal('.sample-note');
document.querySelectorAll('.use-cases dt').forEach((dt, i) => dt.dataset.n = String(i + 1).padStart(2, '0'));
for (const n of document.querySelectorAll('.timeline,.budget')) seen.observe(n);

// Mode switch: a single indicator slides to the pressed tab.
const modes = document.querySelector('.mode-switch');
if (modes) {
  const bar = el('span', 'mode-indicator'); bar.setAttribute('aria-hidden', 'true'); modes.append(bar); modes.classList.add('has-indicator');
  const place = () => {
    const on = modes.querySelector('[aria-pressed=true]'); if (!on) return;
    bar.style.transform = `translateX(${on.offsetLeft}px) scaleX(${on.offsetWidth})`;
  };
  new MutationObserver(place).observe(modes, {attributes: true, subtree: true, attributeFilter: ['aria-pressed']});
  new ResizeObserver(place).observe(modes); place();
}

// Number ticker for evidence values ("16,777,216 / 5,946,648,928").
function countUp(node) {
  const text = node.textContent, nums = [...text.matchAll(/\d[\d,]*/g)];
  if (!nums.length || reduce.matches) return;
  const start = performance.now(), dur = 900;
  const frame = now => {
    const p = Math.min(1, (now - start) / dur), k = 1 - Math.pow(1 - p, 3);
    let i = 0;
    node.textContent = text.replace(/\d[\d,]*/g, m => {const v = Number(m.replace(/,/g, '')); i++; return Math.round(v * k).toLocaleString('en-US');});
    if (p < 1) requestAnimationFrame(frame); else node.textContent = text;
  };
  requestAnimationFrame(frame);
}
const evidence = document.querySelector('.evidence-list');
evidence?.addEventListener('reveal', () => {
  for (const dd of evidence.querySelectorAll('dd')) if (/^[\d,\s/]+$/.test(dd.textContent.trim())) countUp(dd);
}, {once: true});

// Read budget on the checker page: 256 MiB drawn against a whole model file.
const privacy = document.querySelector('.privacy');
if (privacy) {
  const sample = 5946648928, limit = 256 * 1048576;
  const p = privacy.querySelector('p'), body = el('div', 'privacy-body'); p.replaceWith(body); body.append(p);
  const budget = el('div', 'budget'); budget.setAttribute('aria-hidden', 'true');
  const bar = el('div', 'budget-bar'), fill = el('span'); bar.append(fill); fill.style.setProperty('--share', String(limit / sample));
  const legend = el('div', 'budget-legend');
  legend.append(el('span', '', t('Лимит чтения: 256 MiB')), el('span', '', t`Весь файл примера Bonsai: ${gb(sample)}`));
  budget.append(bar, legend); body.append(budget); seen.observe(budget);
}

// Scan stage ----------------------------------------------------------------
// Demo data is the published sample report TC-SAMPLE-001 (Bonsai PTQ1_0).
const DEMO = {
  name: 'Ternary-Bonsai-2-27B-PTQ1_0.gguf', fileSize: 5946648928, bytes: 16777216, dataStart: 11120992,
  lanes: [['llama.cpp', 'refuse', -80], ['PrismML', 'accept', 0], ['bitnet.cpp', 'refuse', -80], ['mortar.cpp', 'refuse', -72]],
};
const REPLAY_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8a5 5 0 1 0 1.6-3.7M3 2.5v2.8h2.8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

class Stage {
  constructor(host) {
    this.host = host; this.run = 0; this.anims = [];
    host.classList.add('scan-stage'); host.setAttribute('aria-label', t('Как читается файл'));
    const top = el('div', 'stage-top');
    top.append(el('p', 'stage-kicker', t('Как читается файл')), this.badge = el('span', 'stage-badge'));
    this.file = el('p', 'stage-file');
    const whole = el('div'); const wholeLabel = el('p', 'stage-label');
    wholeLabel.append(el('span', '', t('Весь файл')), this.size = el('span'));
    this.bar = el('div', 'file-bar'); this.sliver = el('span', 'file-bar-read'); this.bar.append(this.sliver);
    whole.append(wholeLabel, this.bar);
    const zoom = el('div', 'zoom'); zoom.setAttribute('aria-hidden', 'true');
    zoom.innerHTML = '<svg viewBox="0 0 100 26" preserveAspectRatio="none"><path d="M0 0 L1.2 0 L100 26 L0 26 Z"/></svg>';
    const head = el('div'); const headLabel = el('p', 'stage-label');
    headLabel.append(el('span', '', t('Начало файла, прочитанное браузером')), this.limit = el('span', '', t('лимит 256 MiB')));
    this.strip = el('div', 'header-strip'); this.strip.setAttribute('aria-hidden', 'true');
    this.pad = el('span', 'seg seg-pad', t('веса'));
    this.strip.append(el('span', 'seg seg-magic', 'GGUF'), el('span', 'seg seg-ver', 'v3'), el('span', 'seg seg-meta', t('метаданные')), el('span', 'seg seg-tensors', t('тензоры')), this.pad);
    this.fill = el('span', 'scan-fill'); this.track = el('span', 'scan-track'); this.headMark = el('span', 'scan-head');
    Object.assign(this.track.style, {position: 'absolute', inset: '0', pointerEvents: 'none'}); this.track.append(this.headMark);
    this.strip.append(this.fill, this.track);
    head.append(headLabel, this.strip);
    this.bytes = el('p', 'stage-bytes'); this.bytes.setAttribute('aria-live', 'off');
    this.lanes = el('ol', 'lanes');
    const foot = el('div', 'stage-foot'); this.note = el('p');
    this.replay = el('button', 'stage-replay'); this.replay.type = 'button'; this.replay.innerHTML = REPLAY_ICON; this.replay.append(t('Повторить'));
    this.replay.addEventListener('click', () => this.demo());
    foot.append(this.note, this.replay);
    host.replaceChildren(top, this.file, whole, zoom, head, this.bytes, this.lanes, foot);
    this.setLanes(DEMO.lanes.map(([name]) => name));
    this.reset();
  }
  step(n) {for (let i = 1; i <= 6; i++) this.host.classList.toggle('s' + i, i <= n);}
  stop() {this.run++; for (const a of this.anims) a.cancel(); this.anims = []; this.host.removeAttribute('data-scanning');}
  animate(node, frames, opts) {
    const a = node.animate(frames, {fill: 'forwards', ...opts, duration: reduce.matches ? 0 : opts.duration});
    this.anims.push(a); return a.finished.catch(() => {});
  }
  setLanes(names) {
    this.lanes.replaceChildren(...names.map(name => {
      const li = el('li', 'lane'); li.append(el('b', '', name), el('span', 'lane-line'), el('span', 'verdict')); li.title = name; return li;
    }));
  }
  setVerdicts(list) {
    [...this.lanes.children].forEach((li, i) => {
      const v = list[i]; if (!v) return;
      const chip = li.querySelector('.verdict'); chip.className = `verdict ${v.kind}`; chip.textContent = v.text; chip.title = v.text;
      li.setAttribute('data-on', '');
    });
  }
  setSplit(dataStart, bytes) {
    const share = Math.min(.9, Math.max(.06, 1 - dataStart / bytes));
    this.pad.style.flex = `0 0 ${(share * 100).toFixed(1)}%`;
  }
  reset() {
    this.stop(); this.step(0); this.host.dataset.mode = 'demo';
    for (const li of this.lanes.children) li.removeAttribute('data-on');
    this.fill.getAnimations().forEach(a => a.cancel()); this.track.getAnimations().forEach(a => a.cancel());
    this.fill.style.transform = 'scaleX(0)'; this.track.style.transform = 'translateX(0)';
  }
  async demo() {
    if (this.live) return;
    this.reset(); const run = this.run;
    this.badge.textContent = t('Пример'); this.note.textContent = t('Данные образца отчёта TC-SAMPLE-001');
    this.file.textContent = DEMO.name; this.size.textContent = gb(DEMO.fileSize);
    this.sliver.style.setProperty('--read', (DEMO.bytes / DEMO.fileSize * 100) + '%');
    this.setLanes(DEMO.lanes.map(([name]) => name)); this.setSplit(DEMO.dataStart, DEMO.bytes);
    this.bytes.textContent = '';
    const ok = () => run === this.run;
    this.step(1); await wait(520); if (!ok()) return;
    this.step(2); await wait(260); if (!ok()) return;
    this.step(3); await wait(300); if (!ok()) return;
    this.step(4); await wait(360); if (!ok()) return;
    // The scan head sweeps the bytes the browser actually read; the counter
    // follows it to the real figure from the sample report.
    this.host.setAttribute('data-scanning', '');
    const sweep = {duration: 1500, easing: EASE_IN_OUT};
    this.ticker(DEMO.bytes, 1500, run);
    await Promise.all([
      this.animate(this.fill, [{transform: 'scaleX(0)'}, {transform: 'scaleX(1)'}], sweep),
      this.animate(this.track, [{transform: 'translateX(0)'}, {transform: 'translateX(calc(100% - 2px))'}], sweep),
    ]);
    if (!ok()) return;
    this.host.removeAttribute('data-scanning'); this.step(5);
    this.setVerdicts(DEMO.lanes.map(([, kind, status]) => ({kind, text: `${kind === 'accept' ? t('принят') : t('отклонён')}${status ? ' · ' + statusText(status) : ''}`})));
    this.step(6);
  }
  ticker(target, dur, run) {
    const total = int(DEMO.fileSize);
    if (reduce.matches) {this.bytes.textContent = t`Прочитано ${int(target)} байт из ${total}`; return;}
    const start = performance.now();
    const frame = now => {
      if (run !== this.run) return;
      const p = Math.min(1, (now - start) / dur), k = p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      this.bytes.textContent = t`Прочитано ${int(Math.round(target * k))} байт из ${total}`;
      if (p < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
  // Live mode mirrors the real check from app.mjs.
  start({url, index, total}) {
    this.reset(); this.live = true; this.host.dataset.mode = 'live';
    this.badge.textContent = total > 1 ? t`Файл ${index} из ${total}` : t('Идёт проверка');
    this.note.textContent = t('Вердикты — из проверяющего ядра в браузере');
    this.file.textContent = filename(url); this.size.textContent = '—';
    this.sliver.style.setProperty('--read', '0.3%'); this.pad.style.flex = '';
    this.replay.disabled = true; this.bytes.textContent = t('Читаем заголовок…');
    this.step(4); this.host.setAttribute('data-scanning', '');
    // Unknown length: the head travels the strip until the parser is satisfied.
    if (!reduce.matches) {
      const a = this.track.animate([{transform: 'translateX(0)'}, {transform: 'translateX(calc(100% - 2px))'}], {duration: 1100, easing: EASE_IN_OUT, iterations: Infinity, direction: 'alternate'});
      this.anims.push(a);
    }
  }
  progress(bytes) {this.bytes.textContent = t`Прочитано ${int(bytes)} байт…`;}
  done(report) {
    this.stop(); this.host.dataset.mode = 'live'; this.replay.disabled = false; this.live = false;
    const size = Number(report.fileSize), bytes = Number(report.bytes);
    this.badge.textContent = t('Ваш файл'); this.size.textContent = gb(size);
    this.sliver.style.setProperty('--read', Math.min(100, bytes / size * 100) + '%');
    const start = Number(report.rows?.[0]?.walk?.data_start || 0); if (start > 0 && start < bytes) this.setSplit(start, bytes);
    this.setLanes(report.rows.map(r => r.name));
    this.step(4);
    this.track.style.transform = 'translateX(calc(100% - 2px))';
    this.animate(this.fill, [{transform: 'scaleX(0)'}, {transform: 'scaleX(1)'}], {duration: 360, easing: EASE_OUT});
    this.bytes.textContent = t`Прочитано ${int(bytes)} байт из ${int(size)}`;
    this.step(6);
    requestAnimationFrame(() => this.setVerdicts(report.rows.map(row => {
      const v = verdict(row, report.split), status = row.model?.status ?? row.walk.reader;
      return {kind: v.kind, text: `${v.short}${status ? ' · ' + statusText(status) : ''}`};
    })));
  }
  fail(message) {
    this.stop(); this.live = false; this.replay.disabled = false; this.host.dataset.mode = 'error';
    this.badge.textContent = t('Ошибка'); this.bytes.textContent = message || '';
  }
}

const host = document.querySelector('[data-scan-stage]');
if (host) {
  const stage = new Stage(host);
  const view = new IntersectionObserver(([e]) => {if (e.isIntersecting) {view.disconnect(); stage.demo();}}, {threshold: .35});
  view.observe(host);
  addEventListener('tc:start', e => stage.start(e.detail));
  addEventListener('tc:progress', e => stage.progress(e.detail.bytes));
  addEventListener('tc:done', e => stage.done(e.detail.report));
  addEventListener('tc:error', e => stage.fail(e.detail.message));
}
