// Offline smoke for CI: a green input must exit 0, a controlled rejected input must exit 1,
// a missing file must exit 2, and every run must leave a matching report.
// Usage: node trinity-check-ci/testkit/smoke.mjs   (from the repository root)
import {spawnSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const cli = fileURLToPath(new URL('../src/cli.mjs', import.meta.url));
const writer = fileURLToPath(new URL('./write-fixture.mjs', import.meta.url));
const dir = mkdtempSync(path.join(process.cwd(), '.smoke-'));
let failed = false;

function expect(label, args, exitCode, passed) {
  const run = spawnSync(process.execPath, [cli, '--report', 'report.json', ...args], {cwd: dir, encoding: 'utf8'});
  let report = null;
  try { report = JSON.parse(readFileSync(path.join(dir, 'report.json'), 'utf8')); } catch { /* reported below */ }
  const ok = run.status === exitCode && report?.result?.passed === passed && report?.result?.exitCode === exitCode;
  if (!ok) { failed = true; process.stderr.write(`${run.stdout}${run.stderr}`); }
  process.stdout.write(`${ok ? 'ok  ' : 'FAIL'} ${label}: exit ${run.status}, expected ${exitCode}\n`);
}

try {
  const write = spawnSync(process.execPath, [writer, dir], {encoding: 'utf8'});
  if (write.status !== 0) throw new Error(`fixture writer failed: ${write.stderr}`);
  expect('green fixture', ['--runtime', 'all', 'minimal-ok.gguf'], 0, true);
  expect('controlled rejected fixture', ['rejected-bad-magic.gguf'], 1, false);
  expect('missing file', ['absent.gguf'], 2, false);
} catch (error) {
  failed = true;
  process.stderr.write(`${error.message}\n`);
} finally { rmSync(dir, {recursive: true, force: true}); }
process.exitCode = failed ? 1 : 0;
