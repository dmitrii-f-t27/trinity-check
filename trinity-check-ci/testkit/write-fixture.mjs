// Usage: node trinity-check-ci/testkit/write-fixture.mjs <directory>
// Writes the two smoke fixtures: minimal-ok.gguf and rejected-bad-magic.gguf.
import {mkdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {FIXTURES} from './fixtures.mjs';

const directory = process.argv[2];
if (!directory) { process.stderr.write('Usage: write-fixture.mjs <directory>\n'); process.exit(2); }
mkdirSync(directory, {recursive: true});
writeFileSync(path.join(directory, 'minimal-ok.gguf'), FIXTURES.minimalOk());
writeFileSync(path.join(directory, 'rejected-bad-magic.gguf'), FIXTURES.badMagic());
