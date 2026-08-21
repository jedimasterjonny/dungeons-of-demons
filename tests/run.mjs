/**
 * Bundles each .test.ts with esbuild (so TS and extensionless imports resolve the
 * way Vite resolves them) and runs each one in its own process.
 */
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = mkdtempSync(join(tmpdir(), 'dnd-tests-'));
const tests = readdirSync(here).filter((f) => f.endsWith('.test.ts')).sort();

let failures = 0;
for (const test of tests) {
  const out = join(outDir, `${test}.mjs`);
  await build({
    entryPoints: [join(here, test)],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: out,
    logLevel: 'error',
  });
  const run = spawnSync(process.execPath, [out], { stdio: 'inherit' });
  if (run.status !== 0) failures++;
}

console.log(`\n${tests.length - failures}/${tests.length} test file(s) passed`);
process.exit(failures === 0 ? 0 : 1);
