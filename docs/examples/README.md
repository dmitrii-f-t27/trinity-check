# Examples

## minimal-header-report.json

The actual JSON report written by the `trinity-check-ci` CLI for one tiny synthetic GGUF file
produced by `trinity-check-ci/testkit/fixtures.mjs` (version 3, one key `general.architecture`
= `llama`, no tensors), checked against all four runtime profiles, all four `accepted`.

What it shows: the report schema (`schemaVersion` 1), parser provenance, per-profile raw parser
rows and normalized decisions, and the scope and limitations fields.

What it is not:

- not a real LLM and not a model anyone ships;
- not a check of weights, weight integrity or a whole-file hash (the file has no weights);
- not evidence about safety, quality, performance or that inference works;
- not a statement about the latest version of any runtime.

It is linked from `docs/BAZA-HANDOFF-RU.md` for the Ternara technical page and must be shown with
the "synthetic test fixture" label.

To regenerate it:

```
node trinity-check-ci/testkit/write-fixture.mjs <dir>
node trinity-check-ci/src/cli.mjs --runtime all --root <dir> --report minimal-header-report.json minimal-ok.gguf
```
