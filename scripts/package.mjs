import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import './build.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const result = spawnSync('tar', ['-czf', 'site.tar.gz', '.openai', 'dist'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, COPYFILE_DISABLE: '1' },
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
console.log('Packaged site.tar.gz with hosting metadata and dist/server/index.js.');
