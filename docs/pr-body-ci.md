Closes #1

## Problem

Trinity Check inspects GGUF headers only in the browser. A team cannot gate a model release on it
in CI, and nothing fails a pipeline when a file is rejected, undecided, a split part or empty.

## Result

`trinity-check-ci/`: a local CLI and a reusable GitHub Action (`runs.using: node24`) that run the
existing `formats.wasm` (SHA-256 verified before use) on local `.gguf` files and public
Hugging Face URLs. Exit 0 only if at least one input was given, every input was fully checked and
every selected runtime profile decided `accepted`. Exit 1 for findings, exit 2 for usage, IO,
network, parser-hash or internal failures. A deterministic JSON report is written on every run
with a valid report path.

- Contract: `docs/specs/trinity-check-ci.md`. Usage: `trinity-check-ci/README.md`.
- No new parser or verdict logic. The numeric-result mapping already in `report-view.mjs` is
  extracted unchanged into `verdict-core.mjs` and shared; `header-fetch.mjs` now imports
  `isSplitName` from it instead of an inline regex. Browser labels and behavior are unchanged.
- Report path safety: `.json` only, inside the root, never a symlink, never an existing file that
  is not an earlier trinity-check-ci report, and never an alias (path, symlink, hard link) of an
  input. The checks run before anything is deleted. `result.filesRequested` is the number of inputs
  asked for and `result.filesEvaluated` how many were checked.
- Workflow `.github/workflows/trinity-check-ci.yml`: Node 20/22/24 tests and CLI smoke, plus a local
  Action smoke (green input, controlled rejected input). Actions are pinned by SHA
  (checkout v6, setup-node v6).
- Docs: `docs/BAZA-HANDOFF-RU.md` (integration notes for the technical page), `docs/rollout/`
  (plans only), release notes draft `docs/release-notes-ci-v0.1.0.md`.

## Scope

GGUF header and metadata only. Not checked and never claimed: weight integrity or a whole-file hash,
precision loss in weights, safety, licensing, quality, performance, or inference success.
Runtime profiles are pinned revisions, not latest. One split part is never accepted.
No `.t27` change: this work adds no parsing or verdict rule (see spec section 3).

## Verification

Performed by Codex before the report-path fix, on Node v24.13.0:
- `node --test trinity-check-ci/test/*.test.mjs`: 48/48 pass.
- `node trinity-check-ci/testkit/smoke.mjs`: exits 0, 1 and 2 as expected.
- `formats.wasm` SHA-256 matches `provenance.txt`.

Added after review, **not yet run**: regression tests in `test/report-guard.test.mjs` and new cases
in `test/core.test.mjs` (same path, absolute and `./` spellings, symlink and hard-link aliases of the
report path and of inputs, non-report `.json` files, wrong parser hash with one input).

## Not yet verified

- CI on this PR's last SHA: pending.
- Node 20 and 22 runs: not yet run.
- The Action on a GitHub runner: pending (the local Action smoke job).
- No live Hugging Face request has been made; network tests use a mocked `fetch`.
- No release, tag or Marketplace listing exists; the README Action example requires a pinned release SHA.
