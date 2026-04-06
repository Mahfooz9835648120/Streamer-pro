import fs from 'fs/promises';
import path from 'path';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');

const copyTargets = [
  'index.html',
  'admin.html',
  'app.js',
  'admin.js',
  'style.css',
  'modules',
  'public',
];

async function ensureCleanDist() {
  await fs.rm(DIST, { recursive: true, force: true });
  await fs.mkdir(DIST, { recursive: true });
}

async function copyTarget(target) {
  const src = path.join(ROOT, target);
  const dst = path.join(DIST, target);
  await fs.cp(src, dst, { recursive: true });
}

async function main() {
  await ensureCleanDist();
  for (const target of copyTargets) {
    await copyTarget(target);
  }
  console.log('[build-static] dist prepared successfully');
}

main().catch((err) => {
  console.error('[build-static] failed:', err);
  process.exit(1);
});
