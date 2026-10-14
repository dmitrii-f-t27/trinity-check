// Pure mapping from the t27 WASM's numeric answer to a stable decision code. No DOM, no i18n.
// Shared by the browser report view and trinity-check-ci. Every verdict still comes from the t27 WASM.
export const DECISIONS = Object.freeze({
  partOnly: 'part-only', unknown: 'unknown', accepted: 'accepted', caveat: 'caveat', rejected: 'rejected',
});

export function classify(row, split) {
  if (split) return DECISIONS.partOnly;
  if (!row.model || row.model.result < 0) return DECISIONS.unknown;
  if (row.model.result === 0) return DECISIONS.accepted;
  if (row.model.result === 2) return DECISIONS.caveat;
  return DECISIONS.rejected;
}

// Split-model part files are named <name>-00001-of-00003.gguf.
export const isSplitName = name => /-\d{5}-of-\d{5}\.gguf$/i.test(name);
