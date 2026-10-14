import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createInspector} from '../../wasm-live.mjs';
import {PARSER} from './provenance.mjs';
import {CheckError} from './options.mjs';

export const DEFAULT_WASM_PATH = fileURLToPath(new URL('../../formats.wasm', import.meta.url));

// The parser hash is verified before a single byte of WASM is instantiated.
export async function loadParser({wasmPath = DEFAULT_WASM_PATH, expectedSha256 = PARSER.sha256} = {}) {
  let bytes;
  try { bytes = await readFile(wasmPath); }
  catch { throw new CheckError('parser-load-failed', 'Cannot read the parser file formats.wasm'); }
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (sha256 !== expectedSha256) {
    const error = new CheckError('parser-hash-mismatch', 'formats.wasm does not match the pinned SHA-256; refusing to run');
    error.actualSha256 = sha256;
    throw error;
  }
  try {
    const {instance} = await WebAssembly.instantiate(bytes, {});
    return {inspector: createInspector(instance.exports), sha256};
  } catch {
    throw new CheckError('parser-load-failed', 'The parser could not be instantiated');
  }
}
