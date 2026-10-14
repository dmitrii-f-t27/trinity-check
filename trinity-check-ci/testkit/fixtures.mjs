// Test fixture writer: builds tiny GGUF byte strings so tests exercise the real WASM parser.
// It encodes the public GGUF layout only; it contains no verdict logic and decides nothing.
const text = new TextEncoder();

const u16 = n => { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, n, true); return b; };
const u32 = n => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n, true); return b; };
const u64 = n => { const b = new Uint8Array(8); new DataView(b.buffer).setBigUint64(0, BigInt(n), true); return b; };
const join = parts => {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) { out.set(part, at); at += part.length; }
  return out;
};
const gguf_string = value => { const bytes = text.encode(value); return join([u64(bytes.length), bytes]); };

const VALUE_TYPES = {
  u16: [2, value => u16(value)],
  u32: [4, value => u32(value)],
  string: [8, value => gguf_string(value)],
};

function pair({key, type, value}) {
  const [id, encode] = VALUE_TYPES[type];
  return join([gguf_string(key), u32(id), encode(value)]);
}

function tensorInfo({name, dims, type, offset}) {
  return join([gguf_string(name), u32(dims.length), ...dims.map(dim => u64(dim)), u32(type), u64(offset)]);
}

export const ARCH_LLAMA = {key: 'general.architecture', type: 'string', value: 'llama'};

// tensors: [{name, dims, type, offset}]; dataBytes: zero bytes appended after the aligned header.
export function buildGguf({magic = 'GGUF', version = 3, kvs = [ARCH_LLAMA], tensors = [], dataBytes = 0, alignment = 32} = {}) {
  const header = join([text.encode(magic), u32(version), u64(tensors.length), u64(kvs.length),
    ...kvs.map(pair), ...tensors.map(tensorInfo)]);
  if (tensors.length === 0) return header;
  const padded = Math.ceil(header.length / alignment) * alignment;
  return join([header, new Uint8Array(padded - header.length), new Uint8Array(dataBytes)]);
}

export const FIXTURES = {
  // Version 3, one string key (general.architecture = llama), no tensors.
  minimalOk: () => buildGguf(),
  // One F32 tensor (type 0), 8 elements = 32 bytes at offset 0.
  withTensor: () => buildGguf({tensors: [{name: 'token_embd.weight', dims: [8], type: 0, offset: 0}], dataBytes: 32}),
  badMagic: () => buildGguf({magic: 'NOPE'}),
  unknownArchitecture: () => buildGguf({kvs: [{key: 'general.architecture', type: 'string', value: 'not-a-real-architecture'}]}),
  // A model that declares a PrismML rotation; runtimes that ignore it accept the model with a caveat.
  declaresRotation: () => buildGguf({kvs: [ARCH_LLAMA, {key: 'prism.hadamard.version', type: 'u32', value: 1}]}),
  truncated: () => buildGguf().slice(0, 20),
  // A long string value: a small inspector limit cannot hold the header.
  largeHeader: () => buildGguf({kvs: [ARCH_LLAMA, {key: 'general.name', type: 'string', value: 'a'.repeat(500)}]}),
};
