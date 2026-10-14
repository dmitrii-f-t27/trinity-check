// Pinned parser identity. Keep in sync with provenance.txt and app.mjs (a test enforces this).
export const PARSER = Object.freeze({
  file: 'formats.wasm',
  sha256: '76760c0124ed3bef9c322b3dd6ceffb331607c0f990ce4075f83658a5770d7d0',
  upstream: Object.freeze({
    repository: 'https://github.com/dmitrii-f-t27/trinity-memory',
    commit: '096efbd01142ebafbeb2c7cd364e9f6e57bf41f6',
  }),
  compiler: Object.freeze({
    repository: 'https://github.com/gHashTag/t27',
    commit: 'bff21b85b206a0dd367876343e56dcd8312d81ba',
  }),
});

export const SCOPE = 'GGUF header and metadata only; not a guarantee of successful inference';

export const LIMITATIONS = Object.freeze([
  'Only the beginning of each GGUF file is read, up to the parser limit; the whole file is never read or hashed.',
  'Weight integrity, precision loss in weights, safety, licensing, quality and performance are not checked.',
  'The four runtime profiles are pinned revisions inside the parser, not the latest or every revision of any runtime.',
  'One part of a split model is not a complete model and is never reported as accepted.',
  'A local check has no immutable revision; only the HF mode pins a commit.',
]);
