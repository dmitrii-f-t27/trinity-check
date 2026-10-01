# Model Release Audit — demonstration report

**Report:** TC-SAMPLE-001 (revision 2)  
**Prepared:** 2026-10-01  
**Evidence captured:** 2026-10-01T22:23:59.515Z  
**Status:** Findings documented; release execution approval NOT established.

This is a sample deliverable based on one public file. No paid client engagement, publisher endorsement or completed full release audit is implied.

## Executive decision

Do not use this inspection alone to claim general llama.cpp, PrismML, bitnet.cpp or mortar.cpp runtime compatibility. The packaged checker accepts the PrismML metadata profile and rejects the file in its llama.cpp, bitnet.cpp and mortar.cpp profiles. Actual execution has not been tested.

Recommended next action: narrow the compatibility wording to the observed checker result, then run a separate load/inference smoke test on each intended runtime before a release sign-off.

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
- Parser SHA-256: `76760c0124ed3bef9c322b3dd6ceffb331607c0f990ce4075f83658a5770d7d0`.
- Parser source: https://github.com/dmitrii-f-t27/trinity-memory at commit `096efbd01142ebafbeb2c7cd364e9f6e57bf41f6`; the binary was rebuilt from that commit on 2026-10-01 and is byte-identical to the shipped file.
- The per-runtime revision mapping is documented upstream (`specs/runtimes/`) and was not independently re-verified for this report.

## Observed results

| Checker profile | Header walk status | Metadata status | Ternary matching / encountered | Interpretation |
|---|---:|---:|---:|---|
| llama.cpp | -80 | -80 | 0 / 0 | Tensor-type rejection; zero is not proof that the file has no ternary tensors. |
| PrismML | 0 | 0 | 402 / 402 | Metadata accepted by this checker profile. |
| bitnet.cpp | -80 | -80 | 0 / 0 | Tensor-type rejection; execution not tested. |
| mortar.cpp | -72 | -72 | 0 / 402 | Tensor-offset rejection; execution not tested. |

Additional header observations in JSON: GGUF version 3; 49 metadata keys; 851 tensor descriptors; 32-byte alignment; data start at byte 11,120,992. These are parser observations, not a full-file integrity assessment. `complete: true` means this header inspection completed, not that the model was fully validated.

## Findings

### F-01 — Compatibility claim needs qualification

**Priority:** High for a release claiming broad runtime support.  
**Evidence:** JSON rows for llama.cpp, bitnet.cpp and mortar.cpp return negative statuses, while the PrismML row returns status 0.  
**Implication:** The same artifact receives different metadata decisions across these checker profiles. This does not establish behavior of latest upstream runtimes.  
**Action:** State the exact tested runtime build and test procedure in release notes. Do not translate a metadata acceptance badge into an inference claim.  
**Closure evidence:** A pinned runtime build, documented command and captured successful load/inference log for each advertised runtime.

### F-02 — Runtime revision mapping must be cited

**Priority:** Medium for reproducible release approval.  
**Evidence:** The checker binary is traceable to a public commit and rebuilds byte-identically (see Evidence chain). The mapping from each profile to an exact upstream runtime commit is documented upstream and was not re-verified in this report.  
**Implication:** A reviewer can reproduce the binary, but should read the runtime revisions from the upstream specs before quoting them.  
**Action:** Quote the runtime revisions from `specs/runtimes/` in the release notes, next to the parser hash.  
**Closure evidence:** Release notes that cite the parser hash, source commit and runtime revisions.

### F-03 — Runtime and full-release checks remain open

**Priority:** Required before claiming deployment readiness.  
**Evidence:** Only a bounded prefix of one file was read; there are no execution logs in this audit.  
**Action:** Agree a complete release manifest, inspect all required parts, and separately test loading and a minimal inference on the intended runtime/hardware.  
**Closure evidence:** File manifest, complete test coverage, exact runtime/hardware versions, commands and logs.  
**Scope note:** This additional work is not represented as already delivered by this sample.

## Reproduce the observed header result

1. Open the Trinity Check page.
2. Paste the exact pinned file link above; choose Check header.
3. Export JSON and compare `revision`, `parser_sha256`, `rows`, `bytes` and `fileSize` with the attached evidence. Timestamps will differ.
4. If the parser hash changed, treat the output as a new inspection rather than an exact reproduction.
5. Save both reports and investigate any changed decision before revising release documentation.

## Suggested release-note wording

“Header metadata for this pinned GGUF file was inspected with Trinity Check parser SHA-256 76760c0…d7d0 on 2026-10-01. Its PrismML profile accepted the metadata; the llama.cpp and bitnet.cpp profiles returned a tensor-type rejection and the mortar.cpp profile a tensor-offset rejection. This inspection does not establish successful inference or compatibility with other runtime revisions.”

## Manual service

A commissioned audit agrees the exact release files, deliverables, price and delivery date before work begins. Request a quote: dmitrii.f@t27.ai. Runtime execution or broader assurance requires a separately agreed scope.
