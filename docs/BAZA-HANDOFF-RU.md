# BAZA handoff: trinity-check-ci on the Ternara technical page

(Integration notes for whoever builds the Ternara technical page. First-party docs in this
repository are English only.)

## Goal

Add a technical block about `trinity-check-ci` to the Ternara technical section, in EN, RU and
PT-BR, with a call to action to the Trinity Check site and the Model Release Audit.

## Do not do

- Do not change Ternara design, leads, Zoho, DNS or data. Keep the existing design system.
- Do not change prices or payments. Audit facts that already exist on trinitycheck.com:
  free until 2026-11-04, then 250 USD. Link to it; do not restate or alter it.
- Do not copy the parser or its logic into the Ternara site. There is exactly one parser source:
  `formats.wasm` in https://github.com/dmitrii-f-t27/trinity-check, with its provenance in
  `provenance.txt`. Link to it instead.
- Do not embed an interactive checker in the first release. An embed needs a CSP/CORS review
  (Hugging Face range requests from a third-party origin) and must reuse the same module
  files, not a copy. A full technical block plus CTA is enough for now.
- Do not claim: weight integrity, bf16 loss detection, safety, quality, performance, or that
  inference will work. Scope is GGUF header and metadata only.
- Do not invent a tag name, a Marketplace listing or a different SHA. Use only the pinned
  commit below, and a tag only once it exists in the repository.

## Find the active Ternara source first

Locate the active Ternara site sources yourself (the live repository or the folder that deploys
it), confirm which one is live, and work there. Do this before editing.

## Content for the block (source text, English)

Title: **trinity-check-ci: a fail-closed gate for GGUF headers**

Description: A command-line tool and a GitHub Action that run the Trinity Check parser on the
header and metadata of GGUF model files in your CI. The job passes only if every file was fully
checked and every runtime profile you selected (llama.cpp, PrismML, bitnet.cpp, mortar.cpp) accepts
it. Anything else fails the job: rejected, accepted with a caveat, undetermined, one part of a
split model, an empty file, or a network or IO error. A JSON report is always written.

Limits (show them on the page):
- Header and metadata only. The tool does not check weights, does not hash the whole file,
  and does not detect precision loss.
- It does not assess safety, licensing, quality or performance, and does not promise that
  inference will succeed.
- The four runtime profiles are pinned revisions inside the parser, not "latest".
- A local check has no immutable revision; a Hugging Face check pins the commit it read.

CTA links:
- Browser check: https://www.trinitycheck.com/
- Model Release Audit: https://www.trinitycheck.com/audit.html (verify the URL and the audit
  terms on the live page before linking; do not copy prices into Ternara)
- Repository: https://github.com/dmitrii-f-t27/trinity-check
- Interface spec: `docs/specs/trinity-check-ci.md` in that repository

Setup example for the page. The reference is the published immutable tested code commit
`692d1e171c4ef5916c2b34e6113fb8d32c6ceb2e`, verified by GitHub CI (all 5 jobs passed: Node 20, 22
and 24, local Action smoke, and an external consumer run of the Action at this commit):
https://github.com/dmitrii-f-t27/trinity-check/actions/runs/38654418753
Describe it as a tested commit; do not name a release or tag on the page until one exists in the repository.

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

CLI example:

```
node trinity-check-ci/src/cli.mjs --runtime llama.cpp models/model.gguf
```

Exit codes to show: 0 all accepted; 1 findings; 2 usage, IO, network or internal failure.

Sample report: `docs/examples/minimal-header-report.json` in the repository (explained in
`docs/examples/README.md`). It is the actual tool output for a tiny synthetic GGUF test fixture,
with four accepted profiles. It is not a real LLM and not a check of weights. Show an abbreviated
view and say so next to it. Do not hand-write a sample.

## Translations

EN, RU and PT-BR must keep the same limits and the same exit-code table. Keep product names
(Trinity Check, trinity-check-ci, llama.cpp, PrismML, bitnet.cpp, mortar.cpp) untranslated.
Use the site's existing i18n mechanism for Ternara, not a new one.

## Acceptance for BAZA

1. The block exists in EN, RU and PT-BR with the limits visible, not hidden behind a toggle.
2. Links work: Trinity Check, audit page, repository.
3. No parser or verdict logic duplicated on the Ternara site.
4. Design, leads, Zoho, DNS and data untouched; prices and payments untouched.
5. The setup example contains the pinned commit above, described as a tested code commit
   not as a release, unless a tag exists by then.
6. Report back the files changed and how it was checked (screenshots of each language at
   mobile and desktop widths).
