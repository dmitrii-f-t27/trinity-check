import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {lstat, open, realpath} from 'node:fs/promises';
import path from 'node:path';
import {CheckError} from './options.mjs';

const FIRST_READ = 262144;

const inside = (target, root) => target === root || target.startsWith(root.endsWith(path.sep) ? root : root + path.sep);
const posix = p => p.split(path.sep).join('/');

// Resolves a local input to a regular file whose real path is inside the root.
// A symlink is followed only when its final target is inside the root.
export async function resolveLocal(input, root) {
  if (input.includes('\0')) throw new CheckError('unsupported-input', 'A path must not contain a NUL byte');
  let realRoot;
  try { realRoot = await realpath(root); }
  catch { throw new CheckError('io-error', 'The root directory cannot be read'); }
  const absolute = path.resolve(root, input);
  let real;
  try { real = await realpath(absolute); }
  catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') throw new CheckError('not-found', 'The file does not exist');
    throw new CheckError('io-error', `The file cannot be resolved (${error.code || 'error'})`);
  }
  if (!inside(real, realRoot)) throw new CheckError('outside-root', 'The file resolves outside the root directory');
  let info;
  try { info = await lstat(real, {bigint: true}); }
  catch { throw new CheckError('io-error', 'The file cannot be inspected'); }
  if (!info.isFile()) throw new CheckError('not-regular-file', 'The input is not a regular file');
  let lexical = real;
  try { lexical = path.join(await realpath(path.dirname(absolute)), path.basename(absolute)); } catch { /* keep real */ }
  return {real, relPath: posix(path.relative(realRoot, real)), symlinkFollowed: real !== lexical,
    identity: {dev: info.dev, ino: info.ino}, size: info.size};
}

async function fillFrom(handle, bytes, target) {
  const grown = new Uint8Array(target);
  grown.set(bytes);
  let filled = bytes.length;
  while (filled < target) {
    const {bytesRead} = await handle.read(grown, filled, target - filled, filled);
    if (bytesRead === 0) throw new CheckError('file-changed', 'The file ended while it was being read');
    filled += bytesRead;
  }
  return grown;
}

// Reads a bounded prefix, growing it exactly as header-fetch.mjs does for HTTP ranges.
// Never reads more than inspector.limit bytes and never loads the whole file.
export async function readLocalHeader(file, inspector, progress = () => {}) {
  let handle;
  try { handle = await open(file.real, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0)); }
  catch { throw new CheckError('io-error', 'The file cannot be opened'); }
  try {
    const opened = await handle.stat({bigint: true});
    if (!opened.isFile() || opened.dev !== file.identity.dev || opened.ino !== file.identity.ino || opened.size !== file.size) {
      throw new CheckError('file-changed', 'The file changed after it was resolved');
    }
    const size = file.size, limit = inspector.limit;
    if (size === 0n) return {empty: true, fileSize: 0n, bytesRead: 0, prefixSha256: null};
    let bytes = new Uint8Array(0), next = Math.min(FIRST_READ, limit);
    for (;;) {
      bytes = await fillFrom(handle, bytes, BigInt(next) > size ? Number(size) : next);
      let result;
      try { result = inspector.inspect(bytes, size); }
      catch (error) { throw new CheckError('parser-error', String(error?.message || 'The parser rejected the request')); }
      progress({bytes: bytes.length, limit});
      if (result.complete) {
        const closing = await handle.stat({bigint: true});
        if (closing.size !== size) throw new CheckError('file-changed', 'The file size changed while it was being read');
        return {result, fileSize: size, bytesRead: bytes.length,
          prefixSha256: createHash('sha256').update(bytes).digest('hex'), empty: false};
      }
      if (result.needed <= BigInt(bytes.length)) throw new CheckError('parser-error', 'Parser requested no additional bytes');
      if (result.needed > BigInt(limit) || bytes.length >= limit) {
        throw new CheckError('header-limit', `Header exceeds the ${limit / 1048576} MiB inspection limit`);
      }
      next = Math.min(limit, Math.max(bytes.length * 2, Number(result.needed)));
      if (BigInt(next) > size) next = Number(size);
      if (next <= bytes.length) throw new CheckError('parser-error', 'File ends before the required header');
    }
  } finally { await handle.close(); }
}
