// End-to-end CLI tests: real child processes, real WASM, no network.
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';
import {FIXTURES} from '../testkit/fixtures.mjs';
import {put, readJson, runCli, tempRoot} from '../testkit/helpers.mjs';

test('exit 0 for an accepted file, with concise output and a report', t => {
  const root = tempRoot(t);
  put(root, 'ok.gguf', FIXTURES.minimalOk());
  const run = runCli(['--runtime', 'all', 'ok.gguf'], root);
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout, /^ACCEPTED ok\.gguf /m);
  assert.match(run.stdout, /^RESULT PASS \(exit 0\)/m);
  assert.match(run.stdout, /header and metadata only/);
  const report = readJson(path.join(root, 'trinity-check-report.json'));
  assert.equal(report.result.passed, true);
  assert.equal(report.schemaVersion, 1);
});

test('exit 1 for a rejected file and the report says so', t => {
  const root = tempRoot(t);
  put(root, 'bad.gguf', FIXTURES.badMagic());
  const run = runCli(['--report', 'out/r.json', 'bad.gguf'], root);
  assert.equal(run.status, 1);
  assert.match(run.stdout, /^NOT-ACCEPTED bad\.gguf /m);
  assert.match(run.stdout, /^RESULT FAIL \(exit 1\)/m);
  assert.equal(readJson(path.join(root, 'out', 'r.json')).result.exitCode, 1);
});

test('exit 2 for missing files, usage errors and unknown options; reports still written', t => {
  const root = tempRoot(t);
  put(root, 'ok.gguf', FIXTURES.minimalOk());
  for (const args of [['absent.gguf'], [], ['--bogus', 'ok.gguf'], ['--runtime', 'nope', 'ok.gguf'], ['--runtime'],
    ['--report', '../escape.json', 'ok.gguf']]) {
    const run = runCli(args, root);
    assert.equal(run.status, 2, `args ${JSON.stringify(args)}: ${run.stdout}${run.stderr}`);
  }
  assert.equal(readJson(path.join(root, 'trinity-check-report.json')).result.passed, false);
  assert.equal(existsSync(path.join(root, '..', 'escape.json')), false);
});

test('a later failing run replaces an earlier passing report', t => {
  const root = tempRoot(t);
  put(root, 'ok.gguf', FIXTURES.minimalOk());
  assert.equal(runCli(['ok.gguf'], root).status, 0);
  assert.equal(readJson(path.join(root, 'trinity-check-report.json')).result.passed, true);
  assert.equal(runCli(['absent.gguf'], root).status, 2);
  assert.equal(readJson(path.join(root, 'trinity-check-report.json')).result.passed, false);
});

test('--json prints exactly the report that is written', t => {
  const root = tempRoot(t);
  put(root, 'ok.gguf', FIXTURES.minimalOk());
  const run = runCli(['--json', '--runtime=llama.cpp,PrismML', 'ok.gguf'], root);
  assert.equal(run.status, 0);
  assert.equal(run.stdout, readFileSync(path.join(root, 'trinity-check-report.json'), 'utf8'));
  assert.deepEqual(JSON.parse(run.stdout).profiles.map(p => p.name), ['llama.cpp', 'PrismML']);
});

test('--help and --version exit 0 and write no report', t => {
  const root = tempRoot(t);
  const help = runCli(['--help'], root);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Usage: trinity-check-ci/);
  const version = runCli(['--version'], root);
  assert.equal(version.status, 0);
  assert.match(version.stdout, /^trinity-check-ci \d+\.\d+\.\d+$/m);
  assert.equal(existsSync(path.join(root, 'trinity-check-report.json')), false);
});

test('file names cannot forge workflow commands or control characters in stdout', t => {
  const root = tempRoot(t);
  const run = runCli(['bad\n::set-output name=passed::true\n.gguf', '::error::x.gguf'], root);
  assert.equal(run.status, 2);
  for (const line of run.stdout.split('\n')) assert.ok(!line.startsWith('::'), line);
  assert.ok(/^[\x20-\x7e\n]*$/.test(run.stdout), 'stdout is printable ASCII');
});

test('the CLI reads no credentials: a token in the environment never appears in output', t => {
  const root = tempRoot(t);
  put(root, 'ok.gguf', FIXTURES.minimalOk());
  const run = runCli(['--json', 'ok.gguf'], root, {HF_TOKEN: 'hf_super_secret', GITHUB_TOKEN: 'ghp_super_secret'});
  assert.equal(run.status, 0);
  assert.ok(!run.stdout.includes('super_secret') && !run.stderr.includes('super_secret'));
});
