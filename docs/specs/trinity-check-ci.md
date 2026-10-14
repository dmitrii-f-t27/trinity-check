# trinity-check-ci: interface specification

Issue: https://github.com/dmitrii-f-t27/trinity-check/issues/1
Status: first release, written before the code. Version of this contract: schemaVersion 1.

## 1. Purpose

A local CLI and a reusable GitHub Action that run the existing Trinity Check
GGUF header/metadata check in CI and fail the job unless every requested file
is fully checked inside the scope below and every selected runtime profile
accepts it.

The parser is the same `formats.wasm` that the website ships. Nothing in this
tool decides whether a GGUF header is valid.

## 2. Scope and limits (also repeated in every report)

In scope: the beginning of a GGUF file (header, key/value metadata, tensor
records), up to the parser limit (`inspector.limit`, 256 MiB = 268435456 bytes),
read as the selected runtime profiles' GGUF reader and model loader would read it.

Out of scope, never claimed by this tool, its output, or its documentation:

- weight integrity or any whole-file digest (the tool never hashes the whole file);
- detection of precision loss (for example bf16 loss) in weights;
- safety, licensing, or quality of the model;
- performance, or that inference will succeed;
- freshness of the runtimes: the four profiles are pinned revisions inside the
  parser (see `provenance.txt`), not "latest";
- completeness of a split model. A split part is reported as `part-only` and
  is never green.

## 3. Business-logic boundary (task-chain stage 4)

| Piece | Where the logic lives | Generated from .t27? |
| --- | --- | --- |
| GGUF walk, runtime verdicts, status codes | `formats.wasm`, built from upstream `t27/live.t27` at trinity-memory commit 096efbd01142ebafbeb2c7cd364e9f6e57bf41f6 (compiler gHashTag/t27 bff21b85b206a0dd367876343e56dcd8312d81ba) | Yes, unchanged |
| Moving bytes in (HF ranges) | existing `header-fetch.mjs` `readHeader` | No (existing IO binding) |
| Moving bytes in (local file) | `trinity-check-ci/src/local-file.mjs`: bounded prefix reads, same growth loop as `readHeader` | No: IO adapter |
| Numeric `result` to a stable decision code | new `verdict-core.mjs`, extracted without behavior change from `verdict()` in `report-view.mjs`; the browser now calls it too | No: presentation mapping that already existed in JS |
| Gate: "every file, every selected profile is `accepted`" | `trinity-check-ci/src/check.mjs` | No: conjunction over decision codes |
| Option parsing, report/summary/outputs, containment | `trinity-check-ci/src/*` | No: config and IO adapters |

No new `.t27` spec is created and the `.t27` parser is not changed, because this
work adds no parsing or verdict rule. It only (a) feeds bytes to the parser,
(b) maps its numeric answer with the mapping the browser already used,
(c) requires all answers to be "accepted". The generation exemption applies
only to these adapters. If a future change needs a new rule about GGUF content
(for example split-model completeness across files), it must go to upstream
`t27/live.t27` first, not into JavaScript here.

Known pre-existing JavaScript heuristic that is reused, not extended: whether
a file is a split part is decided from its file name with the pattern
`-NNNNN-of-NNNNN.gguf` (previously inline in `header-fetch.mjs`, now exported
as `isSplitName` from `verdict-core.mjs` and used by both). Flagged for a
possible upstream t27 rule.

## 4. Decision codes

Per runtime profile, from the raw parser row (`verdict-core.mjs`, identical to
the browser's `verdict()`):

| Condition (checked in this order) | Code | Green? |
| --- | --- | --- |
| file is a split part (by name) | `part-only` | no |
| no model result, or `model.result < 0` | `unknown` | no |
| `model.result === 0` | `accepted` | yes |
| `model.result === 2` | `caveat` (accepted, but the runtime ignores a declared rotation) | no |
| anything else (for example 1) | `rejected` | no |

A file is green only if its status is `checked` and every selected profile is
`accepted`. A run is green only if it has at least one input and every input is green.

## 5. Inputs

### CLI

```
node trinity-check-ci/src/cli.mjs [options] <input>...
```

An input is either:

- a local path ending in `.gguf` (case-insensitive), or
- a URL containing `://`, which must be accepted by the existing `parseURL`: public
  HTTPS `huggingface.co` `/resolve/<revision>/...gguf`. No credentials are read or sent;
  a username, password, query string and fragment in the URL are redacted/dropped in output.

Options:

| Option | Meaning |
| --- | --- |
| `--runtime <list>` | Comma list and/or repeated. Names (case-insensitive): `llama.cpp`, `prismml`, `bitnet.cpp`, `mortar.cpp`, or `all`. Default when absent: `all` (all four profiles), documented and recorded in the report as `profileSelection: "default-all"`. Selecting a subset is recommended: name the runtimes you ship. |
| `--report <path>` | JSON report path, default `trinity-check-report.json`. Must end in `.json`, resolve inside the root and must not alias an input (section 6). |
| `--root <dir>` | Containment root for local inputs and the report, default the current directory. |
| `--json` | Print the full JSON report to stdout instead of the concise text. |
| `--help`, `--version` | Print and exit 0. |
| `--` | End of options. |

No glob expansion, no directory walking, no allow-empty / allow-unknown /
always-pass options. Duplicate inputs and unknown options are usage errors.

### Action (`trinity-check-ci/action.yml`)

| Input | Default | Meaning |
| --- | --- | --- |
| `files` | none, required | Newline-separated local paths (relative to the workspace) and/or HF URLs. Blank lines ignored. |
| `runtimes` | `all` | Same values as `--runtime`, comma or newline separated. |
| `report-path` | `trinity-check-report.json` | Inside the workspace. |
| `summary` | `true` | Append a Markdown summary to the job summary. |

Outputs: `passed` (`true`/`false`), `exit-code`, `report-path` (workspace-relative),
`files-requested`, `files-accepted`.

The Action reads inputs only from `INPUT_*` environment variables and passes them
as data. There is no shell step and no `${{ }}` interpolation of inputs into a
script. It runs on `node24` (see section 11). It needs `permissions: contents: read`
and no token.

## 6. Exit codes

| Code | Meaning |
| --- | --- |
| 0 | At least one input, all fully checked in scope, all selected profiles `accepted`. |
| 1 | Findings only: the parser answered for every input but at least one is not green (`rejected`, `caveat`, `unknown`, `part-only`), or a file is empty. |
| 2 | Anything that stops the check being complete: usage error, unreadable/missing file, path outside root, network or HTTP failure (including a server ignoring Range with HTTP 200), header larger than the limit, parser hash mismatch, internal error, report could not be written. Takes precedence over 1. |

Fail closed: any uncertainty is non-zero. The report is always written when the
report path is valid, including on failure, and a stale report from an earlier
run at that path is deleted before the check starts.

### Report path safety (applies to `--report` and `report-path`)

Checked in this order, and nothing is created, changed or deleted until all checks pass:

1. The path must end in `.json`, resolve inside the root, and not be a directory or a
   symbolic link. A report path that is invalid is exit 2 and touches nothing.
2. If a file already exists there, it must parse as JSON with `tool.name` equal to
   `trinity-check-ci` (an earlier report). Any other existing file is never replaced.
3. The report path must not alias any local input: the normalized path, the real path
   (symlinks, including an input that is a symlink to the report) and the device/inode
   (hard links) are compared. An alias is exit 2 with no report written (there is no safe
   place to write it), and neither the model file, the link nor its target is modified.
4. Only then is the directory created and the previous report removed, and the new report
   written through a temporary file and a rename.

An input is never a candidate for deletion: deletion only ever applies to an earlier report.

## 7. Local file rules

1. The input is resolved against the root; the real path (`realpath`) must be the
   root or inside it. Otherwise: error `outside-root` (exit 2).
2. Symlinks are followed only if their final target is inside the root. The
   report records `symlinkFollowed` for a symlinked final component. Hard links
   are not detected.
3. The target must be a regular file (not a directory, device, FIFO). It is opened
   read-only without following symlinks after `realpath`, and its device/inode must
   match the earlier `lstat`; mismatch is `file-changed` (exit 2).
4. Only a prefix is read: initial 262144 bytes, doubling or as requested by the
   parser, never more than `inspector.limit`. The whole file is never loaded.
   If the size changes during the read: `file-changed`.
5. Empty file: `status: "empty"`, not green (exit 1), parser not called.
6. A file whose header needs more than the limit: `header-limit` (exit 2).
7. The report holds the root-relative path only, never an absolute runner path.

## 8. HF rules

`readHeader` is used as is: bounded `Range` requests, HTTP 206 required, revision
pinned to a 40-hex commit (a branch name is resolved through the Hub API and the
resolved commit is reported), size and ETag consistency checks, 30 s timeout per request.
Any thrown error becomes `status: "error"`, code `fetch-failed`, exit 2. The
network is injectable (`fetcher`) so tests never touch the Internet.

## 9. JSON report (schemaVersion 1)

Deterministic: fixed key order, no timestamps, files in input order, profiles in
canonical order (llama.cpp, PrismML, bitnet.cpp, mortar.cpp). All u64 values from the
parser are decimal strings (no precision loss); small status integers are numbers.

```
{
  "schemaVersion": 1,
  "tool": {"name": "trinity-check-ci", "version": "<semver>"},
  "parser": {"file": "formats.wasm", "sha256": "<actual>", "expectedSha256": "<pinned>",
             "verified": true, "upstream": {...}, "compiler": {...},
             "headerLimitBytes": 268435456},
  "scope": "...", "limitations": ["..."],
  "profiles": [{"id": 1, "name": "llama.cpp"}],
  "profileSelection": "explicit" | "default-all",
  "policy": {"id": "all-selected-profiles-accepted", "description": "..."},
  "result": {"passed": false, "exitCode": 1, "reason": "...", "filesRequested": 2,
             "filesEvaluated": 2, "filesAccepted": 1, "filesNotAccepted": 1, "filesErrored": 0},
  "files": [{
     "index": 1, "input": "<redacted input>", "kind": "local" | "huggingface",
     "status": "checked" | "empty" | "error",
     "verdict": "accepted" | "not-accepted" | "empty" | "error",
     "location": {"path": "...", "symlinkFollowed": false}            // local
              | {"url": "<pinned url>", "revision": "<40 hex>"},      // huggingface
     "fileSize": "123", "bytesRead": 123, "prefixSha256": "<hex>" | null,
     "complete": true, "split": false,
     "profiles": [{"id": 1, "name": "llama.cpp", "decision": "accepted", "accepted": true,
                   "walk": {...raw WALK fields...}, "model": {...raw RUN fields, "result": 0} | null}],
     "error": null | {"code": "...", "message": "..."}
  }],
  "error": null | {"code": "...", "message": "..."}
}
```

`prefixSha256` is the SHA-256 of the prefix bytes that were read (local files only; null for
HF). It identifies what was inspected, not the file: `fullFileSha256` is deliberately absent.
A local check has no immutable revision; the report says so through
`location` without a `revision` field.

Parser status codes seen in `walk.status` / `model.status` (from upstream
`t27/live.t27`, same table as the browser): 0 OK; -55 header not fully read;
-63..-71 Hadamard rules; -72 tensor offsets; -73 GGUF magic; -74 GGUF version;
-75 byte order; -76 metadata key; -77 alignment; -78 tensor name; -79 tensor
shape; -80 tensor type; -81 row alignment; -82 file bounds; -83 architecture;
-84 inspection limit; -85 split metadata; -86 record count; -87 file ends inside
the header; -88 tied output Hadamard metadata; -89 tensor extra precision metadata.
`model.result`: 0 accepts, 1 refuses, 2 accepts but ignores rotation, negative: no verdict.

## 10. Error codes (tool level)

`usage`, `parser-hash-mismatch`, `parser-load-failed`, `not-found`, `outside-root`,
`not-regular-file`, `file-changed`, `io-error`, `header-limit`, `fetch-failed`,
`unsupported-input`, `internal`, `report-write-failed`.

## 11. Platform notes

- CLI baseline: Node >= 20 (global `fetch`, `node:test`). CI matrix: 20, 22, 24.
- Action runtime: `runs.using: node24`. Checked against the official GitHub
  Actions metadata syntax documentation
  (https://docs.github.com/en/actions/reference/workflows-and-actions/metadata-syntax),
  which lists `node24`; no fallback is needed.
- `filesRequested` is the number of inputs asked for; `filesEvaluated` is how many
  were actually evaluated (0 when the run stopped before checking, for example on a parser
  hash mismatch). A run with fewer evaluated than requested is never green.
- The Action uses files from the repository root (`formats.wasm`, `wasm-live.mjs`,
  `header-fetch.mjs`, `verdict-core.mjs`); a consumer's `uses:` downloads the whole
  repository at the pinned ref, so `../` paths resolve.

## 12. Acceptance (offline, `node --test`)

1. Minimal supported GGUF fixture passes the real WASM for all four profiles.
2. Rejected (bad magic, unknown architecture), truncated, split part, caveat/unknown
   policy, empty, invalid runtime name, wrong parser hash, header over the limit,
   HTTP 200 instead of 206, network failure: none exits 0.
3. Report always written, no stale success.
4. CLI and Action paths both covered, with real process spawns.
5. Browser `verdict()` and the shared decision code agree for every raw result.
