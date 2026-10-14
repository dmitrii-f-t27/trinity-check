# trinity-check-ci v0.1.0 (draft release notes)

Status: draft. Not published; no tag or release exists yet. Fill the release SHA only after
publication.

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
  - uses: actions/checkout@<PIN_FULL_SHA>
  - uses: dmitrii-f-t27/trinity-check/trinity-check-ci@<RELEASE_SHA>   # replace with the published 40-character SHA
    with:
      files: |
        models/model.gguf
      runtimes: llama.cpp
```

## Verification status at the time of writing

Offline test suite: 48/48 pass and smoke exits 0/1/2 on Node v24.13.0, run by Codex before the
report-path safety fix. Regression tests for that fix, Node 20 and 22, and CI on GitHub are pending.
Update this section with real results and links before publishing.

## Known limitations

- Split-model completeness across files is not evaluated.
- Hard links are detected only for the report-versus-input guard.
- No live Hugging Face test is part of the suite.
