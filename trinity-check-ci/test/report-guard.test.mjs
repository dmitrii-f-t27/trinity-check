// Regression: the report path must never overwrite or remove a model file or an input alias.
// Covers the CLI and the Action. Every case checks that the model bytes and links survive and the exit is 2.
import assert from 'node:assert/strict';
import {linkSync, lstatSync, readFileSync, readlinkSync, symlinkSync} from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';
import {FIXTURES} from '../testkit/fixtures.mjs';
import {put, runAction, runCli, tempRoot} from '../testkit/helpers.mjs';

const MODEL = 'minimal-ok.gguf';
const original = () => Buffer.from(FIXTURES.minimalOk());
const unchanged = (root, name = MODEL) => assert.deepEqual(readFileSync(path.join(root, name)), original(), `${name} changed`);

function setup(t) {
  const root = tempRoot(t);
  put(root, MODEL, FIXTURES.minimalOk());
  return root;
}

test('CLI: --report equal to the input path is refused and the model survives', t => {
  const root = setup(t);
  const run = runCli(['--report', MODEL, MODEL], root);
  assert.equal(run.status, 2, run.stdout + run.stderr);
  unchanged(root);
  assert.match(run.stderr, /\.json|input file/);
});

test('CLI: absolute and ./ spellings of the input path are refused too', t => {
  const root = setup(t);
  for (const spelling of [path.join(root, MODEL), `./${MODEL}`, `sub/../${MODEL}`]) {
    const run = runCli(['--report', spelling, MODEL], root);
    assert.equal(run.status, 2, spelling);
    unchanged(root);
  }
});

test('CLI: a .json symlink that points at the model is neither replaced nor followed', t => {
  const root = setup(t);
  symlinkSync(MODEL, path.join(root, 'link.json'));
  const run = runCli(['--report', 'link.json', MODEL], root);
  assert.equal(run.status, 2);
  assert.ok(lstatSync(path.join(root, 'link.json')).isSymbolicLink());
  assert.equal(readlinkSync(path.join(root, 'link.json')), MODEL);
  unchanged(root);
});

test('CLI: an input that is a symlink to the existing report is refused and the report is kept', t => {
  const root = setup(t);
  assert.equal(runCli([MODEL], root).status, 0);
  const report = path.join(root, 'trinity-check-report.json');
  const before = readFileSync(report);
  symlinkSync('trinity-check-report.json', path.join(root, 'alias.gguf'));
  const run = runCli(['alias.gguf'], root);
  assert.equal(run.status, 2);
  assert.deepEqual(readFileSync(report), before);
  assert.ok(lstatSync(path.join(root, 'alias.gguf')).isSymbolicLink());
});

test('CLI: an input that is a hard link to the existing report is refused and the report is kept', t => {
  const root = setup(t);
  assert.equal(runCli([MODEL], root).status, 0);
  const report = path.join(root, 'trinity-check-report.json');
  const before = readFileSync(report);
  linkSync(report, path.join(root, 'hard.gguf'));
  const run = runCli(['hard.gguf'], root);
  assert.equal(run.status, 2);
  assert.deepEqual(readFileSync(report), before);
  assert.deepEqual(readFileSync(path.join(root, 'hard.gguf')), before);
});

test('CLI: an invalid report path deletes nothing', t => {
  const root = setup(t);
  put(root, 'data.bin', 'precious');
  for (const target of ['data.bin', 'missing.txt', '../outside.json']) {
    const run = runCli(['--report', target, MODEL], root);
    assert.equal(run.status, 2, target);
  }
  assert.equal(readFileSync(path.join(root, 'data.bin'), 'utf8'), 'precious');
  unchanged(root);
});

test('Action: report-path equal to the model is refused; outputs say failed and no report path', t => {
  const root = setup(t);
  const run = runAction({files: MODEL, runtimes: 'all', 'report-path': MODEL}, root);
  assert.equal(run.status, 2, run.stdout + run.stderr);
  assert.equal(run.outputs.passed, 'false');
  assert.equal(run.outputs['exit-code'], '2');
  assert.equal(run.outputs['report-path'], '');
  unchanged(root);
});

test('Action: symlink alias as report-path keeps the link and the model', t => {
  const root = setup(t);
  symlinkSync(MODEL, path.join(root, 'link.json'));
  const run = runAction({files: MODEL, runtimes: 'all', 'report-path': 'link.json'}, root);
  assert.equal(run.status, 2);
  assert.equal(run.outputs.passed, 'false');
  assert.equal(readlinkSync(path.join(root, 'link.json')), MODEL);
  unchanged(root);
});

test('Action: a symlink input aliasing the existing report is refused and the report is kept', t => {
  const root = setup(t);
  assert.equal(runAction({files: MODEL, runtimes: 'all'}, root).status, 0);
  const report = path.join(root, 'trinity-check-report.json');
  const before = readFileSync(report);
  symlinkSync('trinity-check-report.json', path.join(root, 'alias.gguf'));
  const run = runAction({files: 'alias.gguf', runtimes: 'all'}, root);
  assert.equal(run.status, 2);
  assert.equal(run.outputs.passed, 'false');
  assert.deepEqual(readFileSync(report), before);
});
