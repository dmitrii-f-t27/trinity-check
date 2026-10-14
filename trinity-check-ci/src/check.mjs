import path from 'node:path';
import {parseURL, readHeader} from '../../header-fetch.mjs';
import {classify, DECISIONS, isSplitName} from '../../verdict-core.mjs';
import {readLocalHeader, resolveLocal} from './local-file.mjs';
import {CheckError} from './options.mjs';
import {safeText} from './text.mjs';

export const isUrlInput = input => input.includes('://');

// Never echo credentials, query strings or fragments from a URL input.
export function redactInput(input) {
  if (!isUrlInput(input)) return input;
  try {
    const url = new URL(input);
    url.username = ''; url.password = ''; url.search = ''; url.hash = '';
    return url.href;
  } catch { return '<unparseable-url>'; }
}

function profileEntries(result, split, profiles) {
  return profiles.map(({id, name}) => {
    const row = result.rows.find(candidate => candidate.id === id);
    if (!row) throw new CheckError('internal', `The parser returned no row for ${name}`);
    const decision = classify(row, split);
    return {id, name, decision, accepted: decision === DECISIONS.accepted, walk: row.walk, model: row.model};
  });
}

function entry(index, input, kind, fields) {
  return {index, input: safeText(redactInput(input), 500), kind, status: 'error', verdict: 'error', location: null,
    fileSize: null, bytesRead: null, prefixSha256: null, complete: false, split: false, profiles: [], error: null, ...fields};
}

function checked(index, input, kind, location, details, split, profiles) {
  const entries = profileEntries(details.result, split, profiles);
  return entry(index, input, kind, {status: 'checked', location, fileSize: details.fileSize, bytesRead: details.bytesRead,
    prefixSha256: details.prefixSha256, complete: details.result.complete, split, profiles: entries,
    verdict: entries.every(item => item.accepted) ? 'accepted' : 'not-accepted'});
}

function failure(index, input, kind, error) {
  const code = error instanceof CheckError ? error.code : kind === 'huggingface' ? 'fetch-failed' : 'internal';
  return entry(index, input, kind, {error: {code, message: safeText(error?.message || 'Unknown failure', 300)}});
}

async function checkLocal(index, input, ctx) {
  if (!/\.gguf$/i.test(input)) throw new CheckError('unsupported-input', 'A local input must be a path ending in .gguf');
  const file = await resolveLocal(input, ctx.root);
  const details = await readLocalHeader(file, ctx.inspector);
  const location = {path: safeText(file.relPath, 500), symlinkFollowed: file.symlinkFollowed};
  if (details.empty) {
    return entry(index, input, 'local', {status: 'empty', verdict: 'empty', location, fileSize: details.fileSize,
      bytesRead: 0, complete: false});
  }
  const split = isSplitName(path.basename(input)) || isSplitName(path.basename(file.real));
  return checked(index, input, 'local', location, details, split, ctx.profiles);
}

async function checkRemote(index, input, ctx) {
  try { parseURL(input); }
  catch (error) { throw new CheckError('unsupported-input', error.message); }
  const result = await readHeader(input, ctx.inspector, () => {}, ctx.fetcher);
  return checked(index, input, 'huggingface', {url: result.url, revision: result.revision},
    {result, fileSize: result.fileSize, bytesRead: result.bytes, prefixSha256: null}, result.split, ctx.profiles);
}

// ctx: {profiles, root, inspector, fetcher}. Files are checked one after another, in input order.
export async function checkInputs(inputs, ctx) {
  const files = [];
  for (const [i, input] of inputs.entries()) {
    const kind = isUrlInput(input) ? 'huggingface' : 'local';
    try { files.push(await (kind === 'local' ? checkLocal : checkRemote)(i + 1, input, ctx)); }
    catch (error) { files.push(failure(i + 1, input, kind, error)); }
  }
  return files;
}

// The gate. Exit 0 only when every requested file is fully checked and every selected profile accepts it.
// Errors (2) outrank findings (1). This only combines decision codes; it adds no parser rule.
// `requested` is the number of inputs the caller asked for; files.length is how many were evaluated
// (fewer when the run stopped early, for example on a parser hash mismatch).
export function summarize(files, fatal, requested = files.length) {
  const evaluated = files.length;
  const accepted = files.filter(file => file.verdict === 'accepted').length;
  const errored = files.filter(file => file.status === 'error').length;
  const notAccepted = evaluated - accepted - errored;
  const counts = {filesRequested: requested, filesEvaluated: evaluated, filesAccepted: accepted,
    filesNotAccepted: notAccepted, filesErrored: errored};
  let exitCode, reason;
  if (fatal) { exitCode = 2; reason = fatal.message; }
  else if (requested === 0) { exitCode = 2; reason = 'No input files were given'; }
  else if (evaluated !== requested) { exitCode = 2; reason = `Only ${evaluated} of ${requested} file(s) were evaluated`; }
  else if (errored > 0) { exitCode = 2; reason = `${errored} of ${requested} file(s) could not be fully checked`; }
  else if (notAccepted > 0) { exitCode = 1; reason = `${notAccepted} of ${requested} file(s) not accepted by every selected profile`; }
  else { exitCode = 0; reason = `All ${requested} file(s) accepted by every selected profile`; }
  return {passed: exitCode === 0, exitCode, reason, ...counts};
}
