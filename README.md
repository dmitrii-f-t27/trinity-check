# Trinity Check

Static site: a browser-side GGUF header check (llama.cpp, PrismML and bitnet.cpp
profiles) and the manual Model Release Audit offer. No build step; GitHub Pages
serves the repository root.

- Parser: `formats.wasm` from [trinity-memory](https://github.com/dmitrii-f-t27/trinity-memory); its SHA-256 is in `provenance.txt`.
- Languages: ru, en, es, pt-BR, zh-CN, ja (`?lang=`).
- Payments: `commerce.mjs` -> `paymentLink` (a Stripe Payment Link). Empty keeps the pay block hidden.
  Stripe confirmation page: `<site>/thanks.html`.

The check reads only the beginning of a public file (up to 256 MiB) and never
runs the model. Licensed under Apache 2.0 (see `LICENSE`, `NOTICE`).

## CI gate: `trinity-check-ci/`

A local CLI and a reusable GitHub Action that run the same `formats.wasm` in CI and fail
unless every file is fully checked and every selected runtime profile accepts it.
Header and metadata only. Usage, the Action example (it needs a pinned release SHA before
use) and the report format: [trinity-check-ci/README.md](trinity-check-ci/README.md).
Contract: [docs/specs/trinity-check-ci.md](docs/specs/trinity-check-ci.md).
Handoff for the Ternara technical page: [docs/BAZA-HANDOFF-RU.md](docs/BAZA-HANDOFF-RU.md).
Next steps (plans only): [docs/rollout/](docs/rollout/README.md).

Tests: `node --test` (Node 20 or later, offline).
