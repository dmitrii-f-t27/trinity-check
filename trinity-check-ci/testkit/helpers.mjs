// Shared helpers for the offline tests. No network: HTTP is a mocked fetcher.
import {spawnSync} from 'node:child_process';
import {mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const CLI = fileURLToPath(new URL('../src/cli.mjs', import.meta.url));
export const ACTION = fileURLToPath(new URL('../src/action.mjs', import.meta.url));
export const ACTION_YML = fileURLToPath(new URL('../action.yml', import.meta.url));
export const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

export function tempRoot(t) {
  const dir = realpathSync(mkdtempSync(path.join(tmpdir(), 'tcci-')));
  t.after(() => rmSync(dir, {recursive: true, force: true}));
  return dir;
}

export function put(root, name, bytes) {
  const file = path.join(root, name);
  writeFileSync(file, bytes);
  return file;
}

export const readJson = file => JSON.parse(readFileSync(file, 'utf8'));

export function config(root, inputs, extra = {}) {
  return {inputs, runtimes: null, reportPath: 'report.json', root, json: false, usageError: null, ...extra};
}

export function runCli(args, cwd, env = {}) {
  const run = spawnSync(process.execPath, [CLI, ...args], {cwd, encoding: 'utf8', env: {PATH: process.env.PATH, ...env}});
  return {status: run.status, stdout: run.stdout, stderr: run.stderr};
}

// Parses the GITHUB_OUTPUT "name<<delimiter / value / delimiter" format.
export function parseOutputs(text) {
  const outputs = {};
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const match = /^([^<]+)<<(.+)$/.exec(lines[i]);
    if (!match) continue;
    const value = [];
    for (i++; i < lines.length && lines[i] !== match[2]; i++) value.push(lines[i]);
    outputs[match[1]] = value.join('\n');
  }
  return outputs;
}

export function runAction(inputs, root, extraEnv = {}) {
  const output = path.join(root, '..', `${path.basename(root)}.output`);
  const summary = path.join(root, '..', `${path.basename(root)}.summary`);
  writeFileSync(output, ''); writeFileSync(summary, '');
  const env = {PATH: process.env.PATH, GITHUB_WORKSPACE: root, GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary, ...extraEnv};
  for (const [name, value] of Object.entries(inputs)) env[`INPUT_${name.toUpperCase()}`] = value;
  const run = spawnSync(process.execPath, [ACTION], {cwd: root, encoding: 'utf8', env});
  const result = {status: run.status, stdout: run.stdout, stderr: run.stderr,
    outputs: parseOutputs(readFileSync(output, 'utf8')), summary: readFileSync(summary, 'utf8')};
  rmSync(output, {force: true}); rmSync(summary, {force: true});
  return result;
}

// A fetcher that behaves like a Hugging Face resolve endpoint with HTTP Range support.
export function rangeFetcher(bytes, {sha = 'a'.repeat(40), etag = '"fixture"', calls = [], status = 206, fail = null} = {}) {
  return async (url, options = {}) => {
    calls.push({url: String(url), range: options.headers?.Range ?? null, credentials: options.credentials});
    if (fail) throw new TypeError(fail);
    if (String(url).startsWith('https://huggingface.co/api/models/')) {
      return new Response(JSON.stringify({sha}), {status: 200});
    }
    if (status !== 206) return new Response(bytes, {status});
    const match = /^bytes=(\d+)-(\d+)$/.exec(options.headers?.Range ?? '');
    if (!match) return new Response(bytes, {status: 200});
    const start = Number(match[1]), end = Math.min(Number(match[2]), bytes.length - 1);
    return new Response(bytes.slice(start, end + 1), {status: 206,
      headers: {'Content-Range': `bytes ${start}-${end}/${bytes.length}`, ETag: etag}});
  };
}

export const HF = (revision = 'a'.repeat(40), file = 'model.gguf') => `https://huggingface.co/org/repo/resolve/${revision}/${file}`;
