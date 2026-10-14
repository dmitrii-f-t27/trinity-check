// Action entry tests: real child process driven only by INPUT_* variables and GitHub file commands.
import assert from 'node:assert/strict';
import {existsSync, mkdirSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';
import {FIXTURES} from '../testkit/fixtures.mjs';
import {ACTION_YML, put, readJson, runAction, tempRoot} from '../testkit/helpers.mjs';

const DECLARED = text => {
  const section = name => {
    const block = new RegExp(`^${name}:\\n((?:  .*\\n|\\n)*)`, 'm').exec(text)?.[1] ?? '';
    return [...block.matchAll(/^  ([a-z-]+):/gm)].map(match => match[1]);
  };
  return {inputs: section('inputs'), outputs: section('outputs')};
};

test('accepted file: passed=true, exit-code 0, report and summary written', t => {
  const root = tempRoot(t);
  put(root, 'ok.gguf', FIXTURES.minimalOk());
  const run = runAction({files: 'ok.gguf', runtimes: 'all', 'report-path': 'reports/out.json', summary: 'true'}, root);
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.equal(run.outputs.passed, 'true');
  assert.equal(run.outputs['exit-code'], '0');
  assert.equal(run.outputs['report-path'], 'reports/out.json');
  assert.equal(run.outputs['files-requested'], '1');
  assert.equal(run.outputs['files-accepted'], '1');
  assert.equal(readJson(path.join(root, 'reports', 'out.json')).result.passed, true);
  assert.match(run.summary, /Trinity Check CI: PASS/);
});

test('rejected file: the step fails with exit 1 and passed=false', t => {
  const root = tempRoot(t);
  put(root, 'bad.gguf', FIXTURES.badMagic());
  const run = runAction({files: 'bad.gguf', runtimes: 'llama.cpp'}, root);
  assert.equal(run.status, 1);
  assert.equal(run.outputs.passed, 'false');
  assert.equal(run.outputs['exit-code'], '1');
  assert.equal(run.outputs['files-accepted'], '0');
  assert.match(run.summary, /FAIL/);
});

test('several lines, blank lines ignored; one missing file makes the step fail with exit 2', t => {
  const root = tempRoot(t);
  put(root, 'ok.gguf', FIXTURES.minimalOk());
  const run = runAction({files: '\nok.gguf\n\n  absent.gguf  \n', runtimes: 'all'}, root);
  assert.equal(run.status, 2);
  assert.equal(run.outputs.passed, 'false');
  assert.equal(run.outputs['files-requested'], '2');
  assert.equal(run.outputs['files-accepted'], '1');
});

test('empty files input, bad runtimes and bad summary value are exit 2 with a failing report', t => {
  const root = tempRoot(t);
  put(root, 'ok.gguf', FIXTURES.minimalOk());
  for (const inputs of [{files: '', runtimes: 'all'}, {files: 'ok.gguf', runtimes: 'x'}, {files: 'ok.gguf', runtimes: 'all', summary: 'maybe'}]) {
    const run = runAction(inputs, root);
    assert.equal(run.status, 2);
    assert.equal(run.outputs.passed, 'false');
    assert.equal(readJson(path.join(root, 'trinity-check-report.json')).result.passed, false);
  }
});

test('shell metacharacters in inputs are data: nothing is executed or created', t => {
  const root = tempRoot(t);
  const evil = ['$(touch pwned).gguf', '`touch pwned2`.gguf', 'a; touch pwned3 #.gguf', '" && touch pwned4 && ".gguf'];
  const run = runAction({files: evil.join('\n'), runtimes: 'all'}, root);
  assert.equal(run.status, 2);
  for (const name of ['pwned', 'pwned2', 'pwned3', 'pwned4']) assert.equal(existsSync(path.join(root, name)), false);
  assert.ok(!run.summary.includes('$(touch'), 'summary escapes untrusted names');
  for (const line of run.stdout.split('\n')) assert.ok(!line.startsWith('::'));
});

test('workspace containment applies to the Action too', t => {
  const outer = tempRoot(t);
  const root = path.join(outer, 'workspace');
  mkdirSync(root);
  put(outer, 'outside.gguf', FIXTURES.minimalOk());
  const run = runAction({files: '../outside.gguf', runtimes: 'all'}, root);
  assert.equal(run.status, 2);
  assert.equal(run.outputs.passed, 'false');
  assert.equal(readJson(path.join(root, 'trinity-check-report.json')).files[0].error.code, 'outside-root');
});

test('summary=false writes no job summary but still sets outputs', t => {
  const root = tempRoot(t);
  put(root, 'ok.gguf', FIXTURES.minimalOk());
  const run = runAction({files: 'ok.gguf', runtimes: 'all', summary: 'false'}, root);
  assert.equal(run.status, 0);
  assert.equal(run.summary, '');
  assert.equal(run.outputs.passed, 'true');
});

test('action.yml declares exactly the inputs the code reads and the outputs it sets', t => {
  const declared = DECLARED(readFileSync(ACTION_YML, 'utf8'));
  const root = tempRoot(t);
  put(root, 'ok.gguf', FIXTURES.minimalOk());
  const run = runAction({files: 'ok.gguf', runtimes: 'all'}, root);
  assert.deepEqual(Object.keys(run.outputs).sort(), [...declared.outputs].sort());
  assert.deepEqual([...declared.inputs].sort(), ['files', 'report-path', 'runtimes', 'summary']);
  const yml = readFileSync(ACTION_YML, 'utf8');
  assert.match(yml, /^  using: node\d+$/m);
  assert.ok(!/^\s+(run|shell):/m.test(yml), 'a JavaScript action has no shell steps');
  assert.ok(existsSync(path.join(path.dirname(ACTION_YML), yml.match(/^  main: (\S+)$/m)[1])));
});
