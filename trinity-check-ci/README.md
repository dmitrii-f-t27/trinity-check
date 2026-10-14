# trinity-check-ci

A fail-closed CI gate for GGUF header and metadata. It runs the same t27-generated
`formats.wasm` parser that the Trinity Check website uses (SHA-256 verified before it
runs) and exits 0 only if every requested file is fully checked and every selected runtime
profile accepts it.

Interface contract: [docs/specs/trinity-check-ci.md](../docs/specs/trinity-check-ci.md).
Issue: https://github.com/dmitrii-f-t27/trinity-check/issues/1

## What it checks, and what it does not

Checks: the beginning of a GGUF file (header, metadata keys, tensor records), up to 256 MiB,
as the four pinned runtime profiles (llama.cpp, PrismML, bitnet.cpp, mortar.cpp) would read it.

Does not check, and its output never claims: weight integrity or a whole-file hash,
precision loss in weights, safety, licensing, quality, performance, or that inference
will succeed. One part of a split model is never accepted. The profiles are pinned
revisions, not the latest of each runtime. Details: `provenance.txt` in the repository root.

## CLI

Requires Node 20 or later. No dependencies.

```
node trinity-check-ci/src/cli.mjs --runtime llama.cpp,bitnet.cpp models/model.gguf
node trinity-check-ci/src/cli.mjs https://huggingface.co/ORG/REPO/resolve/COMMIT_OR_BRANCH/model.gguf
```

- `--runtime`: `llama.cpp`, `prismml`, `bitnet.cpp`, `mortar.cpp`, or `all`. If you omit it,
  all four profiles must accept (documented default, recorded as `default-all` in the report).
  Name the runtimes you actually ship.
- `--report <path>`: JSON report, default `trinity-check-report.json`. It must end in `.json`,
  be inside the root and must not be, or link to, any input file (path, symlink and hard-link
  aliases are refused with exit 2 before anything is deleted). An existing file at that path is
  replaced only if it is an earlier trinity-check-ci report; symlinks and other files are refused.
- `--root <dir>`: local files and the report must resolve inside it (default: the current
  directory). Symlinks are followed only when the final target is inside the root.
- `--json`: print the report to stdout instead of the concise text.

Exit codes: `0` all accepted; `1` findings (rejected, caveat, unknown, split part, empty file);
`2` usage, IO, network, parser-hash or internal failure. There is no option to allow empty,
unknown or caveat results and none to always pass.

The report is written on every run with a valid report path, including failures, and an
earlier report at that path is deleted before the check starts (only after the path checks
above pass). `result.filesRequested` is the number of inputs asked for and
`result.filesEvaluated` the number actually checked.
The Action runs on `node24`, which GitHub's metadata-syntax documentation lists.

## GitHub Action

Pin the Action to a full commit SHA. The immutable reference below is the tested code
commit `692d1e171c4ef5916c2b34e6113fb8d32c6ceb2e`. GitHub CI passed all 5 jobs (Node 20, 22 and 24
tests with CLI smoke, local Action smoke, and a consumer smoke that runs the Action from this
repository at that commit):
https://github.com/dmitrii-f-t27/trinity-check/actions/runs/38654418753

```yaml
permissions:
  contents: read

jobs:
  gguf-header:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803 # v6
      - uses: dmitrii-f-t27/trinity-check/trinity-check-ci@692d1e171c4ef5916c2b34e6113fb8d32c6ceb2e # tested code commit
        with:
          files: |
            models/model.gguf
          runtimes: llama.cpp
```

Inputs: `files` (newline separated), `runtimes` (default `all`), `report-path`, `summary`.
Outputs: `passed`, `exit-code`, `report-path`, `files-requested`, `files-accepted`.
Inputs are read as data from environment variables; the Action has no shell step.

## Report

`schemaVersion` 1, deterministic key order, no timestamps. u64 values are decimal strings.
Each file lists, per selected profile, the raw parser rows (`walk`, `model`) and the
normalized `decision`: `accepted`, `caveat`, `rejected`, `unknown` or `part-only`.
A local check has no immutable revision; a Hugging Face check reports the pinned commit.
`prefixSha256` is the hash of the bytes that were read, not of the file.

## Tests

```
node --test
node trinity-check-ci/testkit/smoke.mjs
```

All tests are offline: the real WASM runs on tiny GGUF fixtures written by
`testkit/fixtures.mjs`, and HTTP is a mocked `fetch`.
