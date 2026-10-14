import {randomUUID} from 'node:crypto';
import {appendFileSync} from 'node:fs';
import {configFromActionEnv} from './options.mjs';
import {runCheck} from './run.mjs';

// GitHub output file format: name<<delimiter, value, delimiter. A fresh random delimiter cannot appear in the value.
function setOutput(file, name, value) {
  if (!file) return;
  const delimiter = `ghadelimiter_${randomUUID()}`;
  appendFileSync(file, `${name}<<${delimiter}\n${String(value)}\n${delimiter}\n`);
}

// env is process.env in production; tests pass their own. Inputs are read as data only.
export async function runAction(env, deps = {}) {
  const config = configFromActionEnv(env);
  const outcome = await runCheck(config, deps);
  if (outcome.stderr) process.stderr.write(outcome.stderr);
  process.stdout.write(outcome.stdout);
  const report = outcome.report;
  setOutput(env.GITHUB_OUTPUT, 'passed', outcome.exitCode === 0 ? 'true' : 'false');
  setOutput(env.GITHUB_OUTPUT, 'exit-code', outcome.exitCode);
  setOutput(env.GITHUB_OUTPUT, 'report-path', outcome.reportRelative);
  setOutput(env.GITHUB_OUTPUT, 'files-requested', report?.result.filesRequested ?? 0);
  setOutput(env.GITHUB_OUTPUT, 'files-accepted', report?.result.filesAccepted ?? 0);
  if (config.summary !== false && env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, outcome.summary + '\n');
  return outcome.exitCode;
}
