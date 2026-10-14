# Evidence matrix (plan)

Purpose: before any external statement, list each claim, the evidence that exists in this
repository or its upstream, and what is still missing. Fill the "status" column only from a
real check. This table is a starting point, not proof.

Status values: SUPPORTED (a file or test you can point to, run today), PARTIAL, MISSING, N/A.

| # | Claim we may want to make | Evidence that exists now | Status | Missing before it can be used externally |
| --- | --- | --- | --- | --- |
| 1 | The browser check and the CI gate use one parser | `formats.wasm` SHA-256 in `provenance.txt`; `trinity-check-ci/test/parity.test.mjs` compares the pinned hash with the file, `provenance.txt` and `app.mjs` | SUPPORTED for commit 692d1e171c4ef5916c2b34e6113fb8d32c6ceb2e: local 59/59 and GitHub CI run https://github.com/dmitrii-f-t27/trinity-check/actions/runs/38654418753 (5 jobs passed) | Re-run on any later commit |
| 2 | The parser output is reproducible from source | `provenance.txt` records upstream commit and compiler commit; a rebuild on 2026-10-01 was byte-identical | PARTIAL | A fresh independent rebuild on a clean machine, recorded with tool versions |
| 3 | The CI gate fails closed | Offline tests for rejected, truncated, split, caveat, unknown, empty, bad runtime, wrong parser hash, oversized header, HTTP 200 instead of 206, network failure, stale report | PARTIAL until the tests are run | Test run output on the release SHA |
| 4 | Scope is header and metadata only | Spec section 2, report `scope` and `limitations` fields | SUPPORTED by documents | Nothing; do not widen the claim |
| 5 | Real public models are accepted or rejected as expected | None collected in this task | MISSING | A list of real public GGUF URLs with pinned commits, the report for each, and a human check of a sample of the verdicts against the runtime's own behavior |
| 6 | Runtime profiles match real runtime behavior | Upstream spec cites runtime commits; per-runtime mapping is not independently re-verified (`provenance.txt` says so) | PARTIAL | Independent check of each profile against the runtime at its pinned revision, for a set of real files |
| 7 | Any customer wants or pays for this | None | MISSING | See customer-validation.md |
| 8 | Ternary hardware benefit | None for this tool; unrelated to header checks | N/A | See fpga-benchmark-prerequisites.md |
| 9 | Weight integrity, bf16 loss detection, safety, quality, speed | Not provided by this tool | N/A: never claim | Out of scope |

Rules for using this matrix:

1. A claim may appear in outreach, a page or a grant text only if its row is SUPPORTED and
   the evidence is reproducible by someone else from a link.
2. Do not add a row to SUPPORTED because a file exists; a test must have been run, with the
   output saved, on a named commit.
3. Never fill rows 5 to 7 with illustrative data. Empty is the honest value.
4. Keep customer names and private details out of this public repository.
