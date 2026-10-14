# Darwin pilot brief and demo checklist (plan)

Status: plan only. Darwin is an accelerator conversation referenced in the owner's
materials. Dates, attendees, wording about the team and any terms are private and
are kept in `~/Brain/private/`, not here. This document sends nothing and commits to nothing.

## What may be shown

The Trinity Check header check and the `trinity-check-ci` gate, as they exist at the release
SHA. Nothing that is not in the repository.

## Brief (what the pilot is, in plain words)

- Problem: before a model release goes out, nobody checks mechanically that its GGUF header
  and metadata are readable by the runtimes you intend to support.
- Product: a browser check and a CI gate that run one verified parser and fail closed.
- Scope: header and metadata only. Not weights, not quality, not safety, not speed.
- Stage: first release. No customers are claimed. No revenue is claimed.

## Facts that may be stated (each must be re-verified on the day)

- The parser SHA-256 and upstream commits in `provenance.txt`.
- Exit codes 0, 1, 2 and the fail-closed rule.
- The audit offer exists on the site; its current terms are whatever the live page says. Do
  not quote terms from memory.

## Facts that must not be stated

- Any customer, pilot partner, user count or revenue (none established).
- Any claim about weights, bf16 loss, safety, quality or performance.
- Anything about the team structure, ownership or company formation beyond the wording the
  owner has agreed in private.
- Any statement that the Action is published or listed anywhere before it really is.

## Demo checklist (run through once beforehand, offline-capable)

1. Release SHA chosen; CI green on that SHA (link saved).
2. `node --test` passes locally on the demo machine; smoke script passes.
3. Fixtures written to a scratch folder with `trinity-check-ci/testkit/write-fixture.mjs`.
4. Demo A, green: `minimal-ok.gguf` exits 0; show the concise output and the report file.
5. Demo B, controlled rejection: `rejected-bad-magic.gguf` exits 1; show the report says rejected.
6. Demo C, fail closed: a missing path exits 2 and the report is still written and says failed.
7. Browser check on one real public Hugging Face URL chosen and tried in advance, with the
   network available; have a screenshot ready in case the network fails.
8. Show the limits slide before any question about weights or quality is asked.
9. Keep a note of every question asked that the product cannot answer; these feed
   customer-validation.md.

## After the conversation

Record, in `~/Brain/private/`, what was asked and what was promised. Promise nothing that is not
in the evidence matrix with status SUPPORTED.
