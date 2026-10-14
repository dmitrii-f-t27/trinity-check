// Action entry point only. Any failure to start is exit code 2, never a silent success.
import {runAction} from './action-main.mjs';

runAction(process.env).then(
  code => { process.exitCode = code; },
  error => { process.stderr.write(`trinity-check-ci: internal error: ${String(error?.message || error).slice(0, 200)}\n`); process.exitCode = 2; },
);
