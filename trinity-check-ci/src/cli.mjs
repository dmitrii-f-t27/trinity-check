#!/usr/bin/env node
// Entry point only. Any failure to start is exit code 2, never a silent success.
import {main} from './cli-main.mjs';

main(process.argv.slice(2)).then(
  code => { process.exitCode = code; },
  error => { process.stderr.write(`trinity-check-ci: internal error: ${String(error?.message || error).slice(0, 200)}\n`); process.exitCode = 2; },
);
