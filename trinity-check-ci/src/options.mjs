import {RUNTIMES} from '../../wasm-live.mjs';

export class CheckError extends Error {
  constructor(code, message) { super(message); this.name = 'CheckError'; this.code = code; }
}

export const DEFAULT_REPORT = 'trinity-check-report.json';

export const USAGE = `Usage: trinity-check-ci [options] <input>...

Inputs: local paths ending in .gguf, or public https://huggingface.co/.../resolve/<revision>/<file>.gguf URLs.

Options:
  --runtime <list>   llama.cpp, prismml, bitnet.cpp, mortar.cpp or all (comma list, repeatable).
                     Default: all four profiles. Name the runtimes you ship.
  --report <path>    JSON report path (default ${DEFAULT_REPORT}), inside the root.
  --root <dir>       Containment root for local inputs and the report (default: current directory).
  --json             Print the JSON report to stdout instead of the concise text.
  --help, --version
Exit codes: 0 all accepted; 1 findings; 2 usage, IO, network, parser or internal failure.
Scope: GGUF header and metadata only.
`;

// Names are matched case-insensitively against the runtime names the parser binding exports.
export function parseRuntimes(values) {
  if (values === undefined || values === null) {
    return {profiles: RUNTIMES.map(([id, name]) => ({id, name})), selection: 'default-all'};
  }
  const words = values.flatMap(value => String(value).split(/[\s,]+/)).filter(Boolean).map(word => word.toLowerCase());
  if (words.length === 0) throw new CheckError('usage', 'The runtime list is empty; name runtimes or use "all"');
  const wanted = new Set();
  for (const word of words) {
    if (word === 'all') { for (const [id] of RUNTIMES) wanted.add(id); continue; }
    const found = RUNTIMES.find(([, name]) => name.toLowerCase() === word);
    if (!found) throw new CheckError('usage', `Unknown runtime "${safeWord(word)}"; use ${RUNTIMES.map(r => r[1]).join(', ')} or all`);
    wanted.add(found[0]);
  }
  return {profiles: RUNTIMES.filter(([id]) => wanted.has(id)).map(([id, name]) => ({id, name})), selection: 'explicit'};
}

function safeWord(word) { return word.replace(/[^\x20-\x7e]/g, '?').slice(0, 40); }

// Never throws: a bad command line becomes config.usageError so the run can still write a report.
export function parseCliArgs(argv) {
  const config = {inputs: [], runtimes: null, reportPath: DEFAULT_REPORT, root: null, json: false, usageError: null,
    help: false, version: false};
  let optionsDone = false;
  const fail = message => { if (!config.usageError) config.usageError = new CheckError('usage', message); };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (optionsDone || !arg.startsWith('-') || arg === '-') { config.inputs.push(arg); continue; }
    const [flag, inline] = arg.startsWith('--') && arg.includes('=') ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)] : [arg, undefined];
    const value = () => {
      if (inline !== undefined) return inline;
      if (i + 1 >= argv.length) { fail(`Option ${flag} needs a value`); return undefined; }
      return argv[++i];
    };
    switch (flag) {
      case '--': optionsDone = true; break;
      case '--help': case '-h': config.help = true; break;
      case '--version': config.version = true; break;
      case '--json': config.json = true; break;
      case '--runtime': { const v = value(); if (v !== undefined) (config.runtimes ??= []).push(v); break; }
      case '--report': { const v = value(); if (v !== undefined) config.reportPath = v; break; }
      case '--root': { const v = value(); if (v !== undefined) config.root = v; break; }
      default: fail(`Unknown option ${safeWord(flag)}`);
    }
  }
  return config;
}

// Action inputs arrive as INPUT_<NAME> environment variables; they are data, never shell text.
export function configFromActionEnv(env) {
  const input = name => env[`INPUT_${name.toUpperCase()}`];
  const lines = value => (value ?? '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const runtimes = input('runtimes');
  const summary = (input('summary') ?? 'true').trim().toLowerCase();
  const config = {inputs: lines(input('files')), runtimes: runtimes === undefined ? null : [runtimes],
    reportPath: (input('report-path') ?? '').trim() || DEFAULT_REPORT, root: env.GITHUB_WORKSPACE || null,
    json: false, usageError: null, help: false, version: false, summary: summary !== 'false'};
  if (summary !== 'true' && summary !== 'false') {
    config.usageError = new CheckError('usage', 'Input "summary" must be "true" or "false"');
  }
  return config;
}
