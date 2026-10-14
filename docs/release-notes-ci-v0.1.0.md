# trinity-check-ci v0.1.0 (draft release notes)

Status: draft. The release tag is pending until GitHub CI is green. Until then the immutable
reference is the tested code commit `692d1e171c4ef5916c2b34e6113fb8d32c6ceb2e`. There is no
Marketplace listing.

## What it is

A fail-closed CI gate for GGUF header and metadata: a CLI and a GitHub Action built on the same
`formats.wasm` parser as the Trinity Check website. It exits 0 only when every requested file was
fully checked and every selected runtime profile (llama.cpp, PrismML, bitnet.cpp, mortar.cpp) accepts it.

## Highlights

- Local `.gguf` files (bounded prefix read, at most 256 MiB, never the whole file) and public
  Hugging Face URLs with a pinned commit.
- Parser SHA-256 is checked before the parser runs.
- Exit 0 accepted; 1 findings (rejected, caveat, unknown, split part, empty file); 2 usage, IO,
  network, parser-hash or internal failure. No allow-empty, allow-unknown or always-pass option.
- Deterministic JSON report (schemaVersion 1) with raw parser rows, normalized decisions, parser
  provenance and scope. Always written for a valid report path; an older report is removed first.
- Report path safety: `.json`, inside the root, never an alias of an input, never replaces a file
  that is not an earlier report.
- Action: `node24`, no shell step, inputs read as data, outputs `passed`, `exit-code`,
  `report-path`, `files-requested`, `files-accepted`.

## Limits

Header and metadata only. It does not check weights, does not hash whole files, does not detect
precision loss, and says nothing about safety, licensing, quality, performance or whether inference
will succeed. Profiles are pinned revisions, not the latest runtime versions. One part of a split model
is never accepted. A local check has no immutable revision.

## Using the Action

```yaml
permissions:
  contents: read
steps:
  - uses: actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803 # v6
  - uses: dmitrii-f-t27/trinity-check/trinity-check-ci@692d1e171c4ef5916c2b34e6113fb8d32c6ceb2e # tested code commit
    with:
      files: |
        models/model.gguf
      runtimes: llama.cpp
```

A sample report for a synthetic test fixture is in `docs/examples/minimal-header-report.json`
(see `docs/examples/README.md`).

## Verification status

Passed locally on Node v24.13.0, run by Codex after the final changes: `node --test` 59/59,
`testkit/smoke.mjs` exits 0, 1 and 2 as expected, `git diff --check` clean.
Pending: Node 20 and 22, and all GitHub CI jobs (tests, local Action smoke, consumer smoke).
Update this section with the CI run link before publishing.

## Known limitations

- Split-model completeness across files is not evaluated.
- Hard links are detected only for the report-versus-input guard.
- No live Hugging Face test is part of the suite; network tests use a mocked `fetch`.
