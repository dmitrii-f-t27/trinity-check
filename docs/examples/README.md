# Examples

Two samples, both real tool output with no hand edits:

| File | Source | Profiles |
| --- | --- | --- |
| `minimal-header-report.json` | synthetic test fixture, written locally | all four, all `accepted` |
| `bonsai-prismml-header-report.json` | manual live run on a public Hugging Face file | PrismML, `accepted` |

## minimal-header-report.json (synthetic fixture)

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

## bonsai-prismml-header-report.json (manual live run)

The unedited report from a manual run of the CLI with `--runtime PrismML` on the public Hugging
Face file `prism-ml/Ternary-Bonsai-2-27B-gguf`, `Ternary-Bonsai-2-27B-PTQ1_0.gguf`, pinned to the
immutable commit `b072e1d3b35a0a630cece372c2127528e0994386`. Result: exit 0, `accepted`; 16777216
bytes (16 MiB) were read of a 5946648928-byte file.

It is a manual smoke, not part of the automated suite, whose network tests use a mocked `fetch`.
Scope is GGUF header and metadata only. It does not check the weights, does not hash the file, and
says nothing about quality, performance, safety or that inference will work, and only the PrismML
profile was selected. Re-running it needs network access and may change if the file changes; the
pinned commit keeps the URL immutable.
