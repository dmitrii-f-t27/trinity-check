// In-process tests of the check run against the real formats.wasm. Network is mocked.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';
import {loadParser, DEFAULT_WASM_PATH} from '../src/parser.mjs';
import {runCheck} from '../src/run.mjs';
import {FIXTURES} from '../testkit/fixtures.mjs';
import {HF, config, put, rangeFetcher, readJson, tempRoot} from '../testkit/helpers.mjs';

const ALL = ['llama.cpp', 'PrismML', 'bitnet.cpp', 'mortar.cpp'];

async function run(root, inputs, extra = {}, deps = {}) {
  const outcome = await runCheck(config(root, inputs, extra), deps);
  return {outcome, report: outcome.report, written: existsSync(path.join(root, 'report.json'))
    ? readJson(path.join(root, 'report.json')) : null};
}

test('minimal supported GGUF is accepted by all four profiles through the real WASM', async t => {
  const root = tempRoot(t);
  const bytes = FIXTURES.minimalOk();
  put(root, 'ok.gguf', bytes);
  const {outcome, written} = await run(root, ['ok.gguf'], {runtimes: ['all']});
  assert.equal(outcome.exitCode, 0);
  assert.equal(written.result.passed, true);
  assert.equal(written.result.exitCode, 0);
  const file = written.files[0];
  assert.equal(file.status, 'checked');
  assert.equal(file.verdict, 'accepted');
  assert.deepEqual(file.profiles.map(p => p.name), ALL);
  for (const profile of file.profiles) {
    assert.equal(profile.decision, 'accepted');
    assert.equal(profile.model.result, 0);
    assert.equal(profile.model.status, 0);
    assert.equal(profile.walk.reader, 0);
  }
  assert.equal(file.fileSize, String(bytes.length));
  assert.equal(file.bytesRead, bytes.length);
  assert.equal(file.prefixSha256, createHash('sha256').update(bytes).digest('hex'));
  assert.equal(file.location.path, 'ok.gguf');
  assert.equal('revision' in file.location, false, 'a local check has no immutable revision');
  assert.equal(written.parser.verified, true);
  assert.equal(written.profileSelection, 'explicit');
});

test('a GGUF with one F32 tensor is accepted and u64 fields keep full precision as strings', async t => {
  const root = tempRoot(t);
  put(root, 'tensor.gguf', FIXTURES.withTensor());
  const {outcome, written} = await run(root, ['tensor.gguf']);
  assert.equal(outcome.exitCode, 0);
  const walk = written.files[0].profiles[0].walk;
  assert.equal(walk.tensors, '1');
  assert.equal(walk.keys, '1');
  assert.equal(typeof walk.data_start, 'string');
  assert.equal(written.profileSelection, 'default-all');
});

test('rejected inputs are exit 1 with raw status and normalized decision', async t => {
  const root = tempRoot(t);
  put(root, 'magic.gguf', FIXTURES.badMagic());
  put(root, 'arch.gguf', FIXTURES.unknownArchitecture());
  put(root, 'cut.gguf', FIXTURES.truncated());
  const {outcome, written} = await run(root, ['magic.gguf', 'arch.gguf', 'cut.gguf']);
  assert.equal(outcome.exitCode, 1);
  assert.equal(written.result.passed, false);
  const [magic, arch, cut] = written.files;
  for (const file of written.files) {
    assert.equal(file.verdict, 'not-accepted');
    for (const profile of file.profiles) {
      assert.equal(profile.decision, 'rejected');
      assert.equal(profile.model.result, 1);
    }
  }
  assert.equal(magic.profiles[0].model.status, -73);
  assert.equal(arch.profiles[0].model.status, -83);
  assert.equal(cut.profiles[0].model.status, -87);
});

test('a split part is never green even when its header is valid', async t => {
  const root = tempRoot(t);
  put(root, 'model-00001-of-00002.gguf', FIXTURES.minimalOk());
  const {outcome, written} = await run(root, ['model-00001-of-00002.gguf']);
  assert.equal(outcome.exitCode, 1);
  const file = written.files[0];
  assert.equal(file.split, true);
  assert.deepEqual(new Set(file.profiles.map(p => p.decision)), new Set(['part-only']));
  assert.equal(file.profiles[0].model.result, 0, 'the parser itself accepted the header');
});

test('a split part reached through a symlink with a plain name is still a split part', async t => {
  const root = tempRoot(t);
  put(root, 'model-00002-of-00003.gguf', FIXTURES.minimalOk());
  symlinkSync('model-00002-of-00003.gguf', path.join(root, 'plain.gguf'));
  const {outcome, written} = await run(root, ['plain.gguf']);
  assert.equal(outcome.exitCode, 1);
  assert.equal(written.files[0].split, true);
  assert.equal(written.files[0].location.symlinkFollowed, true);
});

test('caveat: a runtime that ignores a declared rotation is not green', async t => {
  const root = tempRoot(t);
  put(root, 'rot.gguf', FIXTURES.declaresRotation());
  const {outcome, written} = await run(root, ['rot.gguf'], {runtimes: ['llama.cpp']});
  assert.equal(outcome.exitCode, 1);
  const profile = written.files[0].profiles[0];
  assert.equal(profile.model.result, 2);
  assert.equal(profile.decision, 'caveat');
});

test('unknown and unexpected parser answers are never green (synthetic parser rows)', async t => {
  const root = tempRoot(t);
  put(root, 'x.gguf', FIXTURES.minimalOk());
  const row = (id, name, model) => ({id, name, walk: {status: 0, reader: 0}, model});
  const stub = rows => ({loadParser: async () => ({sha256: 'stub', inspector: {limit: 1 << 20,
    inspect: (bytes, size) => ({rows, needed: 0n, complete: true, bytes: bytes.length, fileSize: BigInt(size)})}})});
  const unknown = await run(root, ['x.gguf'], {runtimes: ['llama.cpp']},
    stub([row(1, 'llama.cpp', {result: -55, verdict: -55, status: -55})]));
  assert.equal(unknown.outcome.exitCode, 1);
  assert.equal(unknown.report.files[0].profiles[0].decision, 'unknown');
  const missing = await run(root, ['x.gguf'], {runtimes: ['llama.cpp']}, stub([row(1, 'llama.cpp', null)]));
  assert.equal(missing.outcome.exitCode, 1);
  assert.equal(missing.report.files[0].profiles[0].decision, 'unknown');
  const odd = await run(root, ['x.gguf'], {runtimes: ['llama.cpp']},
    stub([row(1, 'llama.cpp', {result: 7, verdict: 7, status: 0})]));
  assert.equal(odd.outcome.exitCode, 1);
  assert.equal(odd.report.files[0].profiles[0].decision, 'rejected');
});

test('one profile not accepting fails the file even if the others accept', async t => {
  const root = tempRoot(t);
  put(root, 'x.gguf', FIXTURES.minimalOk());
  const rows = [1, 2, 3, 4].map(id => ({id, name: ALL[id - 1], walk: {}, model: {result: id === 3 ? 1 : 0, status: 0}}));
  const {outcome, report} = await run(root, ['x.gguf'], {},
    {loadParser: async () => ({sha256: 'stub', inspector: {limit: 1 << 20,
      inspect: (bytes, size) => ({rows, needed: 0n, complete: true, bytes: bytes.length, fileSize: BigInt(size)})}})});
  assert.equal(outcome.exitCode, 1);
  assert.equal(report.files[0].verdict, 'not-accepted');
});

test('an empty file is a finding and the parser is not called', async t => {
  const root = tempRoot(t);
  put(root, 'empty.gguf', new Uint8Array(0));
  const {outcome, written} = await run(root, ['empty.gguf']);
  assert.equal(outcome.exitCode, 1);
  assert.equal(written.files[0].status, 'empty');
  assert.equal(written.files[0].verdict, 'empty');
  assert.deepEqual(written.files[0].profiles, []);
});

test('usage failures are exit 2 and still write a failing report', async t => {
  const root = tempRoot(t);
  put(root, 'ok.gguf', FIXTURES.minimalOk());
  const badRuntime = await run(root, ['ok.gguf'], {runtimes: ['nonexistent.cpp']});
  assert.equal(badRuntime.outcome.exitCode, 2);
  assert.equal(badRuntime.written.error.code, 'usage');
  assert.equal(badRuntime.written.result.passed, false);
  const blank = await run(root, ['ok.gguf'], {runtimes: [' , ']});
  assert.equal(blank.outcome.exitCode, 2);
  const none = await run(root, []);
  assert.equal(none.outcome.exitCode, 2);
  assert.equal(none.written.result.passed, false);
  const twice = await run(root, ['ok.gguf', 'ok.gguf']);
  assert.equal(twice.outcome.exitCode, 2);
});

test('runtime selection is canonical, deduplicated and recorded', async t => {
  const root = tempRoot(t);
  put(root, 'ok.gguf', FIXTURES.minimalOk());
  const {report} = await run(root, ['ok.gguf'], {runtimes: ['MORTAR.CPP,llama.cpp', 'llama.cpp']});
  assert.deepEqual(report.profiles, [{id: 1, name: 'llama.cpp'}, {id: 4, name: 'mortar.cpp'}]);
  assert.deepEqual(report.files[0].profiles.map(p => p.name), ['llama.cpp', 'mortar.cpp']);
});

test('a modified parser file is refused before it runs', async t => {
  const root = tempRoot(t);
  put(root, 'ok.gguf', FIXTURES.minimalOk());
  const tampered = path.join(root, 'tampered.wasm');
  writeFileSync(tampered, Buffer.concat([readFileSync(DEFAULT_WASM_PATH), Buffer.from([0])]));
  const {outcome, written} = await run(root, ['ok.gguf'], {}, {loadParser: () => loadParser({wasmPath: tampered})});
  assert.equal(outcome.exitCode, 2);
  assert.equal(written.error.code, 'parser-hash-mismatch');
  assert.equal(written.parser.verified, false);
  assert.notEqual(written.parser.sha256, written.parser.expectedSha256);
  assert.deepEqual(written.files, []);
  const wrongPin = await run(root, ['ok.gguf'], {}, {loadParser: () => loadParser({expectedSha256: '0'.repeat(64)})});
  assert.equal(wrongPin.outcome.exitCode, 2);
  const missing = await run(root, ['ok.gguf'], {}, {loadParser: () => loadParser({wasmPath: path.join(root, 'none.wasm')})});
  assert.equal(missing.written.error.code, 'parser-load-failed');
});

test('a header larger than the inspection limit is an error, not a pass', async t => {
  const root = tempRoot(t);
  put(root, 'big.gguf', FIXTURES.largeHeader());
  const {inspector} = await loadParser();
  const small = {limit: 100, inspect: (bytes, size) => inspector.inspect(bytes, size)};
  const {outcome, written} = await run(root, ['big.gguf'], {}, {loadParser: async () => ({inspector: small, sha256: 'x'})});
  assert.equal(outcome.exitCode, 2);
  assert.equal(written.files[0].status, 'error');
  assert.equal(written.files[0].error.code, 'header-limit');
});

test('only a bounded prefix of a large local file is read', async t => {
  const root = tempRoot(t);
  const header = FIXTURES.minimalOk();
  const body = new Uint8Array(header.length + 3 * 1024 * 1024);
  body.set(header);
  put(root, 'large.gguf', body);
  const {outcome, written} = await run(root, ['large.gguf']);
  assert.equal(outcome.exitCode, 0);
  assert.equal(written.files[0].bytesRead, 262144);
  assert.equal(written.files[0].fileSize, String(body.length));
});

test('local path containment: outside, symlink out, directory, wrong extension, missing', async t => {
  const outer = tempRoot(t);
  const root = path.join(outer, 'workspace');
  mkdirSync(root);
  put(outer, 'secret.gguf', FIXTURES.minimalOk());
  put(root, 'inside.gguf', FIXTURES.minimalOk());
  mkdirSync(path.join(root, 'dir.gguf'));
  put(root, 'notes.txt', 'x');
  symlinkSync(path.join(outer, 'secret.gguf'), path.join(root, 'escape.gguf'));
  symlinkSync('inside.gguf', path.join(root, 'alias.gguf'));
  const inputs = ['../secret.gguf', 'escape.gguf', 'dir.gguf', 'notes.txt', 'absent.gguf', 'alias.gguf'];
  const {outcome, written} = await run(root, inputs);
  assert.equal(outcome.exitCode, 2);
  const codes = written.files.map(file => file.error?.code ?? file.verdict);
  assert.deepEqual(codes, ['outside-root', 'outside-root', 'not-regular-file', 'unsupported-input', 'not-found', 'accepted']);
  assert.equal(written.files[5].location.symlinkFollowed, true);
  assert.equal(written.files[5].location.path, 'inside.gguf');
  assert.ok(!JSON.stringify(written).includes(outer), 'no absolute runner path in the report');
});

test('hugging face: bounded ranges, pinned revision, accepted (mocked fetch)', async t => {
  const root = tempRoot(t);
  const calls = [];
  const {outcome, written} = await run(root, [HF()], {runtimes: ['llama.cpp']},
    {fetcher: rangeFetcher(FIXTURES.minimalOk(), {calls})});
  assert.equal(outcome.exitCode, 0);
  const file = written.files[0];
  assert.equal(file.kind, 'huggingface');
  assert.equal(file.location.revision, 'a'.repeat(40));
  assert.equal(file.prefixSha256, null);
  assert.ok(calls.length >= 1);
  for (const call of calls) { assert.match(call.range, /^bytes=0-\d+$/); assert.equal(call.credentials, 'omit'); }
});

test('hugging face: a branch name is resolved to an immutable commit in the report', async t => {
  const root = tempRoot(t);
  const sha = 'b'.repeat(40);
  const {outcome, written} = await run(root, [HF('main')], {runtimes: ['llama.cpp']},
    {fetcher: rangeFetcher(FIXTURES.minimalOk(), {sha})});
  assert.equal(outcome.exitCode, 0);
  assert.equal(written.files[0].location.revision, sha);
  assert.ok(written.files[0].location.url.includes(sha));
});

test('hugging face: rejected content is exit 1; split name is part-only', async t => {
  const root = tempRoot(t);
  const rejected = await run(root, [HF()], {}, {fetcher: rangeFetcher(FIXTURES.badMagic())});
  assert.equal(rejected.outcome.exitCode, 1);
  const part = await run(root, [HF('a'.repeat(40), 'm-00001-of-00004.gguf')], {},
    {fetcher: rangeFetcher(FIXTURES.minimalOk())});
  assert.equal(part.outcome.exitCode, 1);
  assert.equal(part.written.files[0].profiles[0].decision, 'part-only');
});

test('hugging face: a server that ignores Range (HTTP 200) is an error', async t => {
  const root = tempRoot(t);
  const {outcome, written} = await run(root, [HF()], {}, {fetcher: rangeFetcher(FIXTURES.minimalOk(), {status: 200})});
  assert.equal(outcome.exitCode, 2);
  assert.equal(written.files[0].error.code, 'fetch-failed');
  assert.match(written.files[0].error.message, /bounded range/);
});

test('hugging face: network failure is an error and leaves a failing report', async t => {
  const root = tempRoot(t);
  const {outcome, written} = await run(root, [HF()], {}, {fetcher: rangeFetcher(new Uint8Array(), {fail: 'fetch failed'})});
  assert.equal(outcome.exitCode, 2);
  assert.equal(written.result.passed, false);
  assert.equal(written.files[0].error.code, 'fetch-failed');
});

test('unsupported URLs never reach the network; credentials are redacted from the report', async t => {
  const root = tempRoot(t);
  const calls = [];
  const fetcher = rangeFetcher(FIXTURES.minimalOk(), {calls});
  const {outcome, written} = await run(root, ['https://example.com/a/b/resolve/main/x.gguf',
    'http://huggingface.co/a/b/resolve/main/x.gguf',
    'https://user:hunter2@huggingface.co/o/r/resolve/main/x.gguf?token=hf_secret#frag'], {}, {fetcher});
  assert.equal(outcome.exitCode, 2);
  assert.deepEqual(calls, []);
  assert.deepEqual(written.files.map(file => file.error.code), ['unsupported-input', 'unsupported-input', 'unsupported-input']);
  const text = JSON.stringify(written);
  assert.ok(!text.includes('hunter2') && !text.includes('hf_secret') && !text.includes('frag'));
});

test('errors outrank findings and a green file cannot hide a failing one', async t => {
  const root = tempRoot(t);
  put(root, 'ok.gguf', FIXTURES.minimalOk());
  put(root, 'bad.gguf', FIXTURES.badMagic());
  const finding = await run(root, ['ok.gguf', 'bad.gguf']);
  assert.equal(finding.outcome.exitCode, 1);
  assert.deepEqual([finding.report.result.filesAccepted, finding.report.result.filesNotAccepted], [1, 1]);
  const error = await run(root, ['ok.gguf', 'bad.gguf', 'absent.gguf']);
  assert.equal(error.outcome.exitCode, 2);
});

test('no stale success: an old passing report is removed before every run', async t => {
  const root = tempRoot(t);
  put(root, 'ok.gguf', FIXTURES.minimalOk());
  const green = await run(root, ['ok.gguf']);
  assert.equal(green.written.result.passed, true);
  const failing = await run(root, ['absent.gguf']);
  assert.equal(failing.written.result.passed, false);
  const usage = await run(root, ['ok.gguf'], {runtimes: ['bogus']});
  assert.equal(usage.written.result.passed, false);
  writeFileSync(path.join(root, 'report.json'), JSON.stringify({tool: {name: 'trinity-check-ci'}, result: {passed: true, exitCode: 0}}));
  const noInputs = await run(root, []);
  assert.equal(noInputs.written.result.passed, false);
  // A directory at the report path cannot be replaced: exit 2 and nothing claims success.
  mkdirSync(path.join(root, 'taken.json'));
  const blocked = await run(root, ['ok.gguf'], {reportPath: 'taken.json'});
  assert.equal(blocked.outcome.exitCode, 2);
});

test('wrong parser hash with one input: requested is 1, evaluated is 0', async t => {
  const root = tempRoot(t);
  put(root, 'ok.gguf', FIXTURES.minimalOk());
  const {outcome, written} = await run(root, ['ok.gguf'], {}, {loadParser: () => loadParser({expectedSha256: '0'.repeat(64)})});
  assert.equal(outcome.exitCode, 2);
  assert.equal(written.result.filesRequested, 1);
  assert.equal(written.result.filesEvaluated, 0);
  assert.equal(written.result.filesAccepted, 0);
  const usage = await run(root, ['ok.gguf', 'two.gguf'], {runtimes: ['bogus']});
  assert.equal(usage.written.result.filesRequested, 2);
  assert.equal(usage.written.result.filesEvaluated, 0);
});

test('a file that is not an earlier report is never replaced, and the old report path rules hold', async t => {
  const root = tempRoot(t);
  put(root, 'ok.gguf', FIXTURES.minimalOk());
  put(root, 'notes.json', '{"keep":"me"}');
  const refused = await run(root, ['ok.gguf'], {reportPath: 'notes.json'});
  assert.equal(refused.outcome.exitCode, 2);
  assert.equal(readFileSync(path.join(root, 'notes.json'), 'utf8'), '{"keep":"me"}');
  put(root, 'notes.txt', 'plain');
  const wrongExtension = await run(root, ['ok.gguf'], {reportPath: 'notes.txt'});
  assert.equal(wrongExtension.outcome.exitCode, 2);
  assert.equal(readFileSync(path.join(root, 'notes.txt'), 'utf8'), 'plain');
  const ok = await run(root, ['ok.gguf'], {reportPath: 'fresh.json'});
  assert.equal(ok.outcome.exitCode, 0);
  const again = await run(root, ['ok.gguf'], {reportPath: 'fresh.json'});
  assert.equal(again.outcome.exitCode, 0, 'an earlier trinity-check-ci report is replaced safely');
});

test('report path must stay inside the root', async t => {
  const outer = tempRoot(t);
  const root = path.join(outer, 'ws');
  mkdirSync(root);
  put(root, 'ok.gguf', FIXTURES.minimalOk());
  const escaped = await runCheck(config(root, ['ok.gguf'], {reportPath: '../report.json'}));
  assert.equal(escaped.exitCode, 2);
  assert.equal(escaped.reportRelative, '');
  assert.equal(existsSync(path.join(outer, 'report.json')), false);
  mkdirSync(path.join(outer, 'elsewhere'));
  symlinkSync(path.join(outer, 'elsewhere'), path.join(root, 'link'));
  const viaLink = await runCheck(config(root, ['ok.gguf'], {reportPath: 'link/new/report.json'}));
  assert.equal(viaLink.exitCode, 2);
  assert.equal(existsSync(path.join(outer, 'elsewhere', 'new')), false);
  const nested = await runCheck(config(root, ['ok.gguf'], {reportPath: 'out/deep/report.json'}));
  assert.equal(nested.exitCode, 0);
  assert.equal(nested.reportRelative, 'out/deep/report.json');
});

test('reports are deterministic: same input, byte-identical report', async t => {
  const root = tempRoot(t);
  put(root, 'ok.gguf', FIXTURES.minimalOk());
  put(root, 'bad.gguf', FIXTURES.badMagic());
  await run(root, ['ok.gguf', 'bad.gguf']);
  const first = readFileSync(path.join(root, 'report.json'), 'utf8');
  await run(root, ['ok.gguf', 'bad.gguf']);
  assert.equal(readFileSync(path.join(root, 'report.json'), 'utf8'), first);
  assert.ok(!/\d{4}-\d{2}-\d{2}T/.test(first), 'no timestamps');
});

test('the report states scope and limits and never claims whole-file hashing', async t => {
  const root = tempRoot(t);
  put(root, 'ok.gguf', FIXTURES.minimalOk());
  const {written} = await run(root, ['ok.gguf']);
  assert.match(written.scope, /header and metadata only/i);
  assert.ok(written.limitations.length >= 4);
  assert.equal(written.parser.sha256, written.parser.expectedSha256);
  assert.equal(written.parser.headerLimitBytes, 268435456);
  assert.ok(!('fullFileSha256' in written.files[0]));
});
