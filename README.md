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
