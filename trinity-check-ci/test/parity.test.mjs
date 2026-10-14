// Parity between the CLI, the shared decision code, the browser view and the pinned parser identity.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {readHeader} from '../../header-fetch.mjs';
import {verdict as browserVerdict} from '../../report-view.mjs';
import {DECISIONS, classify, isSplitName} from '../../verdict-core.mjs';
import {DEFAULT_WASM_PATH, loadParser} from '../src/parser.mjs';
import {PARSER} from '../src/provenance.mjs';
import {serializeReport} from '../src/report.mjs';
import {runCheck} from '../src/run.mjs';
import {FIXTURES} from '../testkit/fixtures.mjs';
import {HF, REPO_ROOT, config, put, rangeFetcher, tempRoot} from '../testkit/helpers.mjs';

const wire = report => JSON.parse(serializeReport(report));
const KIND = {accepted: 'accept', rejected: 'refuse', caveat: '', unknown: '', 'part-only': ''};

test('decision codes follow the documented table for every numeric result', () => {
  const table = [[null, 'unknown'], [-1, 'unknown'], [-55, 'unknown'], [0, 'accepted'], [1, 'rejected'], [2, 'caveat'],
    [3, 'rejected'], [7, 'rejected']];
  for (const [result, expected] of table) {
    const row = {model: result === null ? null : {result}};
    assert.equal(classify(row, false), expected, `result ${result}`);
    assert.equal(classify(row, true), DECISIONS.partOnly, `split overrides result ${result}`);
  }
});

test('the browser verdict() agrees with the shared decision code for every case', () => {
  const texts = new Map();
  for (const result of [null, -87, -55, 0, 1, 2, 3]) {
    for (const split of [false, true]) {
      const row = {model: result === null ? null : {result}};
      const code = classify(row, split), view = browserVerdict(row, split);
      assert.equal(view.kind, KIND[code], `result ${result} split ${split}`);
      assert.ok(view.text && view.short);
      texts.set(code, view.text);
    }
  }
  assert.equal(new Set(texts.values()).size, 5, 'each decision keeps its own browser label');
});

test('raw parser rows classify identically in the CLI report and in the browser view', async t => {
  const {inspector} = await loadParser();
  const root = tempRoot(t);
  const cases = {minimalOk: ['llama.cpp', 'PrismML', 'bitnet.cpp', 'mortar.cpp'], withTensor: ['llama.cpp'],
    badMagic: ['llama.cpp'], unknownArchitecture: ['llama.cpp'], declaresRotation: ['llama.cpp', 'PrismML'], truncated: ['llama.cpp']};
  for (const [name, runtimes] of Object.entries(cases)) {
    const bytes = FIXTURES[name]();
    put(root, `${name}.gguf`, bytes);
    const raw = inspector.inspect(bytes, bytes.length);
    const report = wire((await runCheck(config(root, [`${name}.gguf`], {runtimes}))).report);
    for (const profile of report.files[0].profiles) {
      const row = raw.rows.find(candidate => candidate.name === profile.name);
      assert.equal(profile.decision, classify(row, false), `${name} ${profile.name}`);
      assert.equal(browserVerdict(row, false).kind, KIND[profile.decision], `${name} ${profile.name}`);
      assert.equal(profile.model.result, row.model.result);
      assert.equal(profile.model.status, row.model.status);
      assert.equal(profile.walk.reader, row.walk.reader);
      assert.equal(profile.walk.keys, row.walk.keys.toString());
    }
  }
});

test('the HF path returns the same raw rows the browser would see', async t => {
  const {inspector} = await loadParser();
  const root = tempRoot(t);
  const bytes = FIXTURES.minimalOk();
  const fetcher = rangeFetcher(bytes);
  const browser = await readHeader(HF(), inspector, () => {}, fetcher);
  const report = wire((await runCheck(config(root, [HF()]), {fetcher})).report);
  for (const profile of report.files[0].profiles) {
    const row = browser.rows.find(candidate => candidate.name === profile.name);
    assert.equal(profile.model.result, row.model.result);
    assert.equal(profile.decision, classify(row, browser.split));
  }
  assert.equal(report.files[0].location.revision, browser.revision);
  assert.equal(report.files[0].fileSize, browser.fileSize.toString());
});

test('split-name detection is one function shared by the browser reader and the CLI', async () => {
  const {inspector} = await loadParser();
  const names = [['m-00001-of-00004.gguf', true], ['M-00002-of-00004.GGUF', true], ['m-0001-of-0004.gguf', false],
    ['m-00001-of-00004.gguf.bak', false], ['model.gguf', false]];
  for (const [name, split] of names) {
    assert.equal(isSplitName(name), split, name);
    if (!name.toLowerCase().endsWith('.gguf')) continue;
    const result = await readHeader(HF('a'.repeat(40), name), inspector, () => {}, rangeFetcher(FIXTURES.minimalOk()));
    assert.equal(result.split, split, name);
  }
});

test('the pinned parser identity matches formats.wasm, provenance.txt and the browser constant', () => {
  const digest = createHash('sha256').update(readFileSync(DEFAULT_WASM_PATH)).digest('hex');
  assert.equal(digest, PARSER.sha256);
  const provenance = readFileSync(`${REPO_ROOT}provenance.txt`, 'utf8');
  for (const value of [PARSER.sha256, PARSER.upstream.commit, PARSER.compiler.commit]) assert.ok(provenance.includes(value), value);
  assert.ok(readFileSync(`${REPO_ROOT}app.mjs`, 'utf8').includes(`parserSHA='${PARSER.sha256}'`));
});
