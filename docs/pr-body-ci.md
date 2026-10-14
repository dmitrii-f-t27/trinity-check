Closes #1

## Problem

Trinity Check inspects GGUF headers only in the browser. A team cannot gate a model release on it
in CI, and nothing fails a pipeline when a file is rejected, undecided, a split part or empty.

## Result

`trinity-check-ci/`: a local CLI and a reusable GitHub Action (`runs.using: node24`) that run the
existing `formats.wasm` (SHA-256 verified before use) on local `.gguf` files and public
Hugging Face URLs.

- Exit 0 only if at least one input was given, every input was fully checked and every selected
  runtime profile decided `accepted`. Exit 1 for findings, exit 2 for usage, IO, network,
  parser-hash or internal failures.
- A deterministic JSON report (schemaVersion 1) is written on every run with a valid report path.
  `result.filesRequested` is the number of inputs asked for, `result.filesEvaluated` how many were checked.
- The report path must end in `.json`, stay inside the root, not be a symlink, not replace a file
  that is not an earlier report, and not alias an input (path, symlink or hard link). These checks
  run before anything is deleted.
- No new parser or verdict logic. The existing numeric-result mapping is shared through
  `verdict-core.mjs`; browser labels and behavior are unchanged.

Docs: `docs/specs/trinity-check-ci.md`, `trinity-check-ci/README.md`,
`docs/examples/` (sample report for a synthetic fixture), `docs/BAZA-HANDOFF-RU.md`,
`docs/rollout/` (plans only), `docs/release-notes-ci-v0.1.0.md` (draft).

## Scope

GGUF header and metadata only. Not checked and never claimed: weight integrity or a whole-file hash,
precision loss in weights, safety, licensing, quality, performance, or inference success.
Runtime profiles are pinned revisions, not latest. One split part is never accepted.
No `.t27` change: this work adds no parsing or verdict rule (spec section 3).

## CI

`.github/workflows/trinity-check-ci.yml`, read-only permissions, actions pinned by SHA:
- Node 20/22/24: `node --test` and the CLI smoke.
- Local Action smoke: accepted fixture and a controlled rejected fixture (expected exit 1).
- Consumer smoke: the Action downloaded from this repository at the immutable commit
  `692d1e171c4ef5916c2b34e6113fb8d32c6ceb2e`, on the same two fixtures.

## Verification

Done locally by Codex on Node v24.13.0: `node --test` 59/59 pass, `testkit/smoke.mjs` exits
0/1/2 as expected, `git diff --check` clean.

Pending: Node 20 and 22, and every GitHub CI job on this PR's last SHA.
Not done: a live Hugging Face request (network tests use a mocked `fetch`), a release tag.
The pinned commit above is a tested code commit, not a release; the tag follows a green CI.
