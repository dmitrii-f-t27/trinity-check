Closes #1

## What this adds

`trinity-check-ci/`: a local CLI and a reusable GitHub Action (`node24`) that run the existing
`formats.wasm` (SHA-256 verified before use) on local `.gguf` files and public Hugging Face URLs,
and fail unless every file is fully checked and every selected runtime profile accepts it.

- Exit 0 all accepted; 1 findings (rejected, caveat, unknown, split part, empty); 2 usage, IO,
  network, parser-hash or internal failure. No bypass options.
- Deterministic JSON report (schemaVersion 1), written on every run with a valid report path.
- The report path must end in `.json`, stay inside the root and never alias an input; checks run
  before anything is deleted.
- No new parser or verdict logic and no `.t27` change; the existing result mapping is shared via
  `verdict-core.mjs` with unchanged browser behavior.

Scope: GGUF header and metadata only. Not weights, safety, quality, performance or inference success.

Docs: `docs/specs/trinity-check-ci.md`, `trinity-check-ci/README.md`, `docs/examples/`,
`docs/release-notes-ci-v0.1.0.md`, `docs/rollout/` (plans only).

## Verified

- Local, Node v24.13.0: `node --test` 59/59, smoke exits 0/1/2, `git diff --check` clean.
- GitHub CI, all 5 jobs passed (Node 20/22/24 tests and CLI smoke, local Action smoke, external
  consumer smoke at `692d1e171c4ef5916c2b34e6113fb8d32c6ceb2e`):
  https://github.com/dmitrii-f-t27/trinity-check/actions/runs/38654418753

Manual live smoke (not part of the offline suite, whose network tests use a mocked `fetch`): the CLI
with `--runtime PrismML` on the public Hugging Face file
`prism-ml/Ternary-Bonsai-2-27B-gguf` at immutable commit `b072e1d3b35a0a630cece372c2127528e0994386`
(`Ternary-Bonsai-2-27B-PTQ1_0.gguf`): exit 0, accepted, 16777216 bytes (16 MiB) read of a
5946648928-byte file. The real report is `docs/examples/bonsai-prismml-header-report.json`.
Scope is header and metadata only: this says nothing about weights, quality, performance or inference.
