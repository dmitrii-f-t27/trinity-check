import {checkInputs, isUrlInput, summarize} from './check.mjs';
import {CheckError, parseRuntimes} from './options.mjs';
import {loadParser} from './parser.mjs';
import {assertReportSeparate, buildReport, clearStaleReport, formatConcise, formatSummary, planReportPath, serializeReport,
  writeReportFile} from './report.mjs';
import {safeText} from './text.mjs';

// Shared by the CLI and the Action. config comes from parseCliArgs or configFromActionEnv.
// deps (tests only): loadParser, fetcher, cwd. Returns text to print; never touches process state.
export async function runCheck(config, deps = {}) {
  const root = config.root ?? deps.cwd ?? process.cwd();
  const outcome = {exitCode: 2, report: null, reportRelative: '', stdout: '', stderr: '', summary: ''};
  let fatal = config.usageError ?? null;
  let target = null;
  try {
    // Read-only validation and the alias guard come first; only then is the old report removed.
    const plan = await planReportPath(config.reportPath, root);
    await assertReportSeparate(plan, config.inputs.filter(input => !isUrlInput(input)), root);
    target = await clearStaleReport(plan);
  } catch (error) { fatal ??= error; outcome.stderr += `trinity-check-ci: ${safeText(error.message, 300)}\n`; }

  let profiles = [], selection = 'explicit', parserState = {sha256: null, verified: false, headerLimitBytes: null}, files = [];
  try {
    if (!fatal) {
      try { ({profiles, selection} = parseRuntimes(config.runtimes)); } catch (error) { fatal = error; }
    }
    if (!fatal && config.inputs.length === 0) fatal = new CheckError('usage', 'Give at least one input file');
    if (!fatal && new Set(config.inputs).size !== config.inputs.length) fatal = new CheckError('usage', 'Duplicate inputs are not allowed');
    let inspector = null;
    if (!fatal) {
      try {
        const parser = await (deps.loadParser ?? loadParser)();
        inspector = parser.inspector;
        parserState = {sha256: parser.sha256, verified: true, headerLimitBytes: parser.inspector.limit};
      } catch (error) {
        fatal = error;
        parserState = {sha256: error.actualSha256 ?? null, verified: false, headerLimitBytes: null};
      }
    }
    if (!fatal) files = await checkInputs(config.inputs, {profiles, root, inspector, fetcher: deps.fetcher ?? globalThis.fetch});
  } catch (error) {
    fatal = new CheckError('internal', `Internal failure: ${safeText(error?.message || error, 200)}`);
  }

  const summary = summarize(files, fatal, config.inputs.length);
  const report = buildReport({parserState, profiles, selection, files, summary, fatal});
  outcome.report = report;
  outcome.exitCode = summary.exitCode;
  if (target) {
    try {
      await writeReportFile(target.absolute, serializeReport(report));
      outcome.reportRelative = target.relative;
    } catch (error) {
      outcome.stderr += `trinity-check-ci: ${safeText(error.message, 300)}\n`;
      outcome.exitCode = 2;
      report.result.passed = false;
      report.result.exitCode = 2;
    }
  } else outcome.exitCode = 2;
  outcome.stdout = config.json ? serializeReport(report) : formatConcise(report, outcome.reportRelative);
  outcome.summary = formatSummary(report);
  return outcome;
}
