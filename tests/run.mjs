import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
mkdirSync('.sites-runtime/tests', { recursive: true });
const r = spawnSync(
  process.execPath,
  [
    'node_modules/typescript/bin/tsc',
    'lib/model.ts',
    'lib/actions.ts',
    'lib/automation.ts',
    'lib/calendar.ts',
    'lib/order-files.ts',
    'lib/public-demo.ts',
    'lib/workspace-http.ts',
    '--target',
    'ES2022',
    '--module',
    'commonjs',
    '--moduleResolution',
    'node',
    '--skipLibCheck',
    '--outDir',
    '.sites-runtime/tests',
  ],
  { stdio: 'inherit' },
);
if (r.status !== 0) process.exit(r.status || 1);
writeFileSync('.sites-runtime/tests/package.json', '{"type":"commonjs"}');
copyFileSync('tests/business.cjs', '.sites-runtime/tests/check.cjs');
for (const [source, target] of [
  ['tests/business.cjs', 'check.cjs'],
  ['tests/workspace-http.cjs', 'workspace-http.cjs'],
]) {
  copyFileSync(source, '.sites-runtime/tests/' + target);
  const t = spawnSync(process.execPath, ['.sites-runtime/tests/' + target], { stdio: 'inherit' });
  if (t.error) throw t.error;
  if (t.status !== 0) process.exit(t.status ?? 1);
}
const crypto = spawnSync(process.execPath, ['tests/review-access.mjs'], { stdio: 'inherit' });
if (crypto.error) throw crypto.error;
process.exit(crypto.status ?? 1);
