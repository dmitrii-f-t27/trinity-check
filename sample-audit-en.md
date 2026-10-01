# Model Release Audit — demonstration report

**Report:** TC-SAMPLE-001  
**Prepared:** 2026-09-30  
**Evidence captured:** 2026-09-30T17:27:47.725Z  
**Status:** Findings documented; release execution approval NOT established.

This is a sample deliverable based on one public file. No paid client engagement, publisher endorsement or completed full release audit is implied.

## Executive decision

Do not use this inspection alone to claim general llama.cpp, PrismML or bitnet.cpp runtime compatibility. The packaged checker accepts the PrismML metadata profile and rejects the tensor type for its llama.cpp and bitnet.cpp profiles. Actual execution has not been tested.

Recommended next action: narrow the compatibility wording to the observed checker result, establish checker-to-source/runtime traceability, then run a separate load/inference smoke test on each intended runtime before a release sign-off.

## Scope and inventory

- Artifact: `Ternary-Bonsai-2-27B-PTQ1_0.gguf`
- Repository: https://huggingface.co/prism-ml/Ternary-Bonsai-2-27B-gguf
- Pinned revision: `b072e1d3b35a0a630cece372c2127528e0994386`
- Exact file: https://huggingface.co/prism-ml/Ternary-Bonsai-2-27B-gguf/resolve/b072e1d3b35a0a630cece372c2127528e0994386/Ternary-Bonsai-2-27B-PTQ1_0.gguf
- File size reported by the inspection: 5,946,648,928 bytes.
- Bytes read: 16,777,216 (= 16 MiB, with 1 MiB = 1,048,576 bytes).
- Scope: one file, GGUF header and metadata. No complete release inventory was examined. The report's `split` field is false for this inspected file.
- No evaluation of all weights, output quality, speed, security or licensing was performed.

## Evidence chain

- Raw JSON: [sample-bonsai-evidence.json](sample-bonsai-evidence.json).
- Tool provenance: [provenance.txt](provenance.txt).
- Parser SHA-256: `2a3d397991ab3fd6aa29ea2b9ad153ece90aa6fe6acf4410392fb90d6ecf1452`.
- UI source used for capture: `0366b7bdd373a8961fdbe5555f9598a417dbb044`.
- The source commit of the deployed parser and exact per-runtime revision mapping have not been independently established. A binary hash identifies the tested artifact; it does not fill that gap.

## Observed results

| Checker profile | Header walk status | Metadata status | Ternary matching / encountered | Interpretation |
|---|---:|---:|---:|---|
| llama.cpp | -80 | -80 | 0 / 0 | Tensor-type rejection; zero is not proof that the file has no ternary tensors. |
| PrismML | 0 | 0 | 402 / 402 | Metadata accepted by this checker profile. |
| bitnet.cpp | -80 | -80 | 0 / 0 | Tensor-type rejection; execution not tested. |

Additional header observations in JSON: GGUF version 3; 49 metadata keys; 851 tensor descriptors; 32-byte alignment; data start at byte 11,120,992. These are parser observations, not a full-file integrity assessment. `complete: true` means this header inspection completed, not that the model was fully validated.

## Findings

### F-01 — Compatibility claim needs qualification

**Priority:** High for a release claiming broad runtime support.  
**Evidence:** JSON rows 1 and 3 return status -80, while row 2 returns status 0.  
**Implication:** The same artifact receives different metadata decisions across these checker profiles. This does not establish behavior of latest upstream runtimes.  
**Action:** State the exact tested runtime build and test procedure in release notes. Do not translate a metadata acceptance badge into an inference claim.  
**Closure evidence:** A pinned runtime build, documented command and captured successful load/inference log for each advertised runtime.

### F-02 — Checker source provenance is incomplete

**Priority:** High for reproducible release approval.  
**Evidence:** `provenance.txt` explicitly states that the parser's source commit has not been independently established.  
**Implication:** Another reviewer can identify the binary hash but cannot yet reconstruct its full source/runtime provenance from this report.  
**Action:** Establish source commit, build recipe and runtime revision mapping; reproduce the binary or document any reproducibility differences.  
**Closure evidence:** Source references, build commands and a matching hash or an explained reproducible-build comparison.

### F-03 — Runtime and full-release checks remain open

**Priority:** Required before claiming deployment readiness.  
**Evidence:** Only a bounded prefix of one file was read; there are no execution logs in this audit.  
**Action:** Agree a complete release manifest, inspect all required parts, and separately test loading and a minimal inference on the intended runtime/hardware.  
**Closure evidence:** File manifest, complete test coverage, exact runtime/hardware versions, commands and logs.  
**Scope note:** This additional work is not represented as already delivered by this sample.

## Reproduce the observed header result

1. Open https://trinity-check.galancloquebd.chatgpt.site/?lang=en .
2. Paste the exact pinned file link above; choose Check header.
3. Export JSON and compare `revision`, `parser_sha256`, `rows`, `bytes` and `fileSize` with the attached evidence. Timestamps will differ.
4. If the parser hash changed, treat the output as a new inspection rather than an exact reproduction.
5. Save both reports and investigate any changed decision before revising release documentation.

## Suggested release-note wording

“Header metadata for this pinned GGUF file was inspected with Trinity Check parser SHA-256 2a3d397…cf1452 on 2026-09-30. Its PrismML profile accepted the metadata; llama.cpp and bitnet.cpp profiles returned a tensor-type rejection. This inspection does not establish successful inference or compatibility with other runtime revisions.”

## Manual service

A commissioned audit agrees the exact release files, deliverables, price and delivery date before work begins. Request a quote: dmitrii.f@t27.ai. Runtime execution or broader assurance requires a separately agreed scope.
