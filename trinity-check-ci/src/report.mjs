import {lstat, mkdir, readFile, realpath, rename, rm, stat, writeFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {LIMITATIONS, PARSER, SCOPE} from './provenance.mjs';
import {CheckError} from './options.mjs';
import {markdownText, safeText} from './text.mjs';

export const TOOL = Object.freeze({name: 'trinity-check-ci',
  version: JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version});

// parserState: {sha256, verified}. Fixed key order; no timestamps; BigInt values become decimal strings on serialization.
export function buildReport({parserState, profiles, selection, files, summary, fatal}) {
  return {
    schemaVersion: 1,
    tool: {name: TOOL.name, version: TOOL.version},
    parser: {file: PARSER.file, sha256: parserState.sha256 ?? null, expectedSha256: PARSER.sha256,
      verified: parserState.verified === true, upstream: {...PARSER.upstream}, compiler: {...PARSER.compiler},
      headerLimitBytes: parserState.headerLimitBytes ?? null},
    scope: SCOPE,
    limitations: [...LIMITATIONS],
    profiles: profiles.map(({id, name}) => ({id, name})),
    profileSelection: selection,
    policy: {id: 'all-selected-profiles-accepted',
      description: 'Exit 0 only if at least one input was given, every input was fully checked, and every selected profile decided accepted (model.result 0). Part-only, caveat, unknown, rejected, empty and error are never green.'},
    result: {passed: summary.passed, exitCode: summary.exitCode, reason: safeText(summary.reason, 300),
      filesRequested: summary.filesRequested, filesEvaluated: summary.filesEvaluated, filesAccepted: summary.filesAccepted,
      filesNotAccepted: summary.filesNotAccepted, filesErrored: summary.filesErrored},
    files,
    error: fatal ? {code: fatal.code || 'internal', message: safeText(fatal.message, 300)} : null,
  };
}

export const serializeReport = report =>
  JSON.stringify(report, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2) + '\n';

// ---- report file: validated path, stale report removed first, atomic write ----

const MAX_OLD_REPORT_BYTES = 16 * 1024 * 1024;

// Step 1 of 3, read-only: validates the report path. Nothing is created, changed or deleted here.
// The path must be a .json file inside the root, not a symlink or directory; an existing file
// must be an earlier trinity-check-ci report, so no other file can be replaced by mistake.
export async function planReportPath(reportPath, root) {
  if (typeof reportPath !== 'string' || reportPath === '' || reportPath.includes('\0')) {
    throw new CheckError('usage', 'The report path is empty or invalid');
  }
  const base = path.resolve(root);
  const target = path.resolve(base, reportPath);
  const relative = path.relative(base, target);
  if (relative === '' || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    throw new CheckError('usage', 'The report path must be a file inside the root directory');
  }
  if (!/\.json$/i.test(path.basename(target))) throw new CheckError('usage', 'The report path must end in .json');
  try {
    const realBase = await realpath(base);
    const within = candidate => candidate === realBase || candidate.startsWith(realBase.endsWith(path.sep) ? realBase : realBase + path.sep);
    // Check the nearest existing ancestor, so a symlinked directory cannot lead outside.
    let ancestor = path.dirname(target), realAncestor;
    for (;;) {
      try { realAncestor = await realpath(ancestor); break; }
      catch (error) {
        const parent = path.dirname(ancestor);
        if ((error.code !== 'ENOENT' && error.code !== 'ENOTDIR') || parent === ancestor) throw error;
        ancestor = parent;
      }
    }
    if (!within(realAncestor)) throw new CheckError('usage', 'The report directory resolves outside the root directory');
    let info = null;
    try { info = await lstat(target, {bigint: true}); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (info?.isDirectory()) throw new CheckError('usage', 'The report path is a directory');
    if (info?.isSymbolicLink()) throw new CheckError('usage', 'The report path is a symbolic link; refusing to replace it');
    if (info) {
      if (!info.isFile() || info.size > BigInt(MAX_OLD_REPORT_BYTES)) throw new CheckError('usage', 'The existing file at the report path is not a trinity-check-ci report');
      let old = null;
      try { old = JSON.parse(await readFile(target, 'utf8')); } catch { /* not JSON */ }
      if (old?.tool?.name !== TOOL.name) throw new CheckError('usage', 'The existing file at the report path is not a trinity-check-ci report; refusing to replace it');
    }
    return {absolute: target, relative: relative.split(path.sep).join('/'), existing: info !== null,
      realAbsolute: path.join(realAncestor, path.relative(ancestor, target)), identity: info ? {dev: info.dev, ino: info.ino} : null};
  } catch (error) {
    if (error instanceof CheckError) throw error;
    throw new CheckError('report-write-failed', 'The report location cannot be inspected');
  }
}

// Step 2 of 3, read-only: the report must never alias an input. Compares normalized paths, real
// paths (symlinks) and device/inode (hard links) before anything is deleted or written.
export async function assertReportSeparate(plan, localInputs, root) {
  for (const input of localInputs) {
    if (typeof input !== 'string' || input.includes('\0')) continue;
    const absolute = path.resolve(root, input);
    let same = absolute === plan.absolute || absolute === plan.realAbsolute;
    if (!same) {
      try {
        const real = await realpath(absolute);
        same = real === plan.realAbsolute || (plan.existing && real === await realpath(plan.absolute));
        if (!same && plan.identity) {
          const info = await stat(absolute, {bigint: true});
          same = info.ino !== 0n && info.dev === plan.identity.dev && info.ino === plan.identity.ino;
        }
      } catch { /* an input that cannot be resolved cannot alias the report */ }
    }
    if (same) throw new CheckError('usage', 'The report path refers to an input file; refusing to overwrite it');
  }
}

// Step 3 of 3, destructive and only reached after steps 1 and 2: creates the directory and removes the
// previous report so that no stale success can survive a failed run.
export async function clearStaleReport(plan) {
  try {
    await mkdir(path.dirname(plan.absolute), {recursive: true});
    if (plan.existing) await rm(plan.absolute, {force: true});
  } catch {
    throw new CheckError('report-write-failed', 'The report location cannot be prepared');
  }
  return {absolute: plan.absolute, relative: plan.relative};
}

export async function writeReportFile(absolute, text) {
  const temporary = `${absolute}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, text, {flag: 'wx'});
    await rename(temporary, absolute);
  } catch {
    await rm(temporary, {force: true}).catch(() => {});
    throw new CheckError('report-write-failed', 'The report could not be written');
  }
}

// ---- human output ----

const profileWord = item => `${item.name}=${item.decision}`;

export function formatConcise(report, reportRelative) {
  const lines = [];
  lines.push(`trinity-check-ci ${report.tool.version} | parser sha256 ${report.parser.sha256 ?? 'unavailable'} (${report.parser.verified ? 'verified' : 'NOT verified'})`);
  lines.push(`profiles: ${report.profiles.map(p => p.name).join(', ') || 'none'} (${report.profileSelection})`);
  for (const file of report.files) {
    const name = file.location?.path ?? file.location?.url ?? file.input;
    if (file.status === 'checked') lines.push(`${file.verdict === 'accepted' ? 'ACCEPTED' : 'NOT-ACCEPTED'} ${safeText(name)}${file.split ? ' (split part)' : ''} [${file.profiles.map(profileWord).join(', ')}]`);
    else if (file.status === 'empty') lines.push(`EMPTY ${safeText(name)} (zero-byte file)`);
    else lines.push(`ERROR ${safeText(file.input)} ${file.error.code}: ${file.error.message}`);
  }
  if (report.error) lines.push(`ERROR ${report.error.code}: ${report.error.message}`);
  lines.push(`RESULT ${report.result.passed ? 'PASS' : 'FAIL'} (exit ${report.result.exitCode}): ${report.result.reason}`);
  if (reportRelative) lines.push(`Report: ${safeText(reportRelative, 300)}`);
  lines.push(`Scope: ${report.scope}`);
  return lines.join('\n') + '\n';
}

export function formatSummary(report) {
  const lines = [`## Trinity Check CI: ${report.result.passed ? 'PASS' : 'FAIL'}`, '',
    markdownText(report.result.reason), '',
    `Profiles: ${report.profiles.map(p => markdownText(p.name)).join(', ') || 'none'} (${report.profileSelection})`, ''];
  if (report.files.length > 0) {
    lines.push('| File | Verdict | Profiles |', '| --- | --- | --- |');
    for (const file of report.files) {
      const name = file.location?.path ?? file.location?.url ?? file.input;
      const detail = file.status === 'checked' ? file.profiles.map(profileWord).join(', ') : file.error ? `${file.error.code}: ${file.error.message}` : file.status;
      lines.push(`| ${markdownText(name)} | ${markdownText(file.verdict)} | ${markdownText(detail)} |`);
    }
    lines.push('');
  }
  if (report.error) lines.push(`Error: ${markdownText(report.error.code)}: ${markdownText(report.error.message)}`, '');
  lines.push(`Parser SHA-256: \`${report.parser.sha256 ?? 'unavailable'}\` (${report.parser.verified ? 'verified' : 'not verified'})`, '',
    `Scope: ${markdownText(report.scope)}. Not checked: weight integrity, safety, quality, performance.`, '');
  return lines.join('\n');
}
