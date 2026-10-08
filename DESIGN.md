# Trinity Check — DESIGN.md

The visual contract for this site. Any agent (Claude, Codex, others) changing a page reads this first.
Direction: an instrument, not a marketing page. Quiet light surfaces, one dark instrument panel, one green accent,
precise type. References: the restraint of Linear and Vercel, the data honesty of a lab report.

## Principles
1. **The instrument is the hero.** The dark scan panel ("How the file is read") is the strongest visual. Nothing competes with it.
2. **Facts, not adjectives.** Every claim on the page is checkable: byte counts, hashes, licence, runtime names. No invented logos, testimonials, counters or stock imagery.
3. **One accent.** Green `--accent` marks action and acceptance. Red is reserved for a runtime refusal, never for decoration.
4. **Calm motion.** Transform/opacity only, ease-out `cubic-bezier(.23,1,.32,1)`, under 700 ms, nothing loops except the live scan. `prefers-reduced-motion` turns it off.
5. **Six languages are equal.** Every new string exists in ru, en, es, pt-BR, zh-CN, ja. Layout must survive the longest one (usually ru or es).

## Type
| Role | Font | Size | Weight | Tracking |
|---|---|---|---|---|
| Display (h1) | Geist | clamp(34px, 4.6vw, 58px), line-height 1.05 | 600 | -0.035em |
| Section (h2) | Geist | 20px, line-height 1.3 | 600 | -0.01em |
| Body | Geist | 16px, line-height 1.6, max 68ch | 400 | 0 |
| Small / labels | Geist | 13–14px | 500 | 0 (uppercase kickers +0.08em) |
| Data, file names, hashes | Geist Mono | 13–14px | 500–600 | 0, `tabular-nums` |

- Fonts are self-hosted in `fonts/` (SIL OFL 1.1, `fonts/OFL-Geist.txt`). No Google Fonts or other third-party requests: the page promises that nothing leaves the browser except the file range request.
- CJK text falls back to the system (Hiragino Sans, PingFang SC, Noto Sans CJK).
- Headlines use `text-wrap: balance`, paragraphs `text-wrap: pretty`.

## Colour tokens (light)
| Token | Value | Use |
|---|---|---|
| `--bg` | `#f6f8f7` | page |
| `--surface` | `#ffffff` | panels, header |
| `--ink` | `#14201c` | text (green-tinted near-black, never pure #000) |
| `--muted` | `#56645f` | secondary text |
| `--border` | `#dbe3df` | hairlines |
| `--accent` | `#136653` | actions, links, accepted |
| `--accent-soft` | `#e6f2ec` | accepted chip, focus wash |
| `--refuse` | `#9c3530` | runtime refusal only |
| Stage | `--stage-bg #0d1d19`, `--stage-ink #e9f2ef`, `--stage-muted #93aba4`, `--stage-accept #5fd4a8`, `--stage-refuse #ff8f7f` | the instrument panel |

All greys come from one green-grey family. Shadows are tinted with the stage colour (`rgba(13,29,25,…)`), never neutral black.

## Space and shape
- 4 px grid. Section gaps 48–72 px on desktop, 32–40 px on phones. Bottom padding is optically a little larger than top.
- Container 1176 px max, 28 px gutters (16–20 px on phones). No horizontal scroll at 360 px.
- Radius: 6 px controls, 10 px panels, 12 px the stage, 999 px chips. Do not round everything the same.

## Components
- **Primary button:** solid accent, white text, 46 px min height, 600 weight. One primary per view.
- **Links in prose:** accent, underline offset 3 px.
- **Fact row** (under the hero): small mono/sans items separated by hairlines — licence, pinned parser hash, "no upload", Hugging Face Space. Only facts that a visitor can verify by clicking.
- **Verdict chips:** accepted = accent-soft/accent; refused = soft red/`--refuse`; neutral = grey.
- **Header:** brand left, nav, compact language select right. Feedback is a quiet text link, not a second button.

## Social preview
`og.png` (1200×630) and Open Graph/Twitter tags on every page. The card shows the product name, the one-line promise and the four runtime names — never a verdict about a real third-party model.

## Direction v2 — "wow" (2026-10-08, owner's request)
Supersedes the light-theme direction above where they conflict. The instrument is still the hero, but the page is now a dark
ternary instrument: all of it lives in `wow.css` + `wow.mjs` (loaded last on all six pages); the earlier files stay as the base.
- **Theme:** dark by default. Tokens: `--bg #050d0a`, `--surface #0b1813`, `--ink #eaf5f0`, `--muted #8fa49c`, `--accent #5fd4a8` (mint), `--accent-ink #04120c` (text on mint buttons), `--refuse #ff8f7f`. One accent, red only for a refusal.
- **Type:** Geist, h1 up to 80 px with a white→mint gradient, section h2 up to 52 px, mono kickers in uppercase with +0.16em tracking, the four runtime names as outlined display words.
- **Motion:** curtain preloader once per session (home only, skipped for reduced motion), a canvas lattice of balanced trits (−, 0, +) behind the hero that lights near the pointer (30 fps, paused off screen), scroll progress bar, spotlight cards that follow the pointer, a rotating conic border on the scan stage. Everything respects `prefers-reduced-motion`.
- **Still true:** facts only, no fake numbers or logos, six languages equal, no third-party requests (fonts self-hosted), nothing leaves the browser except the file range request.
- Do not put decoration over form fields or results: the tool must stay readable first.

## Don'ts
- No purple/blue AI gradients, emoji icons, stock photos, placeholder images. (Subtle glass panels are allowed since v2.)
- No "trusted by" logos, fake numbers, or performance/safety/quality claims about models.
- No new accent colours.
