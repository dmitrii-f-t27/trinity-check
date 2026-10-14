import {parseCliArgs, USAGE} from './options.mjs';
import {TOOL} from './report.mjs';
import {runCheck} from './run.mjs';

// Returns the exit code. deps (tests only): loadParser, fetcher, cwd.
export async function main(argv, deps = {}) {
  const config = parseCliArgs(argv);
  if (config.help) { process.stdout.write(USAGE); return 0; }
  if (config.version) { process.stdout.write(`${TOOL.name} ${TOOL.version}\n`); return 0; }
  const outcome = await runCheck(config, deps);
  if (outcome.stderr) process.stderr.write(outcome.stderr);
  process.stdout.write(outcome.stdout);
  return outcome.exitCode;
}
