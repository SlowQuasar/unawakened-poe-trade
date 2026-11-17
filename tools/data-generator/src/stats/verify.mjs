import { cp, mkdir, readFile, writeFile, readdir, symlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = new URL('../../../../', import.meta.url);
const renderer = new URL('renderer/', root);
const staging = new URL('tools/data-generator/out/staging/', root);
const validation = new URL(`validation-${Date.now()}/`, staging);
const copy = new URL('renderer/', validation);
async function digestTree(dir, prefix = '') {
  const result = {};
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
    if (entry.isDirectory()) Object.assign(result, await digestTree(path, prefix + entry.name + '/'));
    else result[prefix + entry.name] = createHash('sha256').update(await readFile(path)).digest('hex');
  }
  return result;
}
const original = await digestTree(new URL('public/data/', renderer));
await mkdir(copy, { recursive: true });
for (const name of ['src', 'test', 'public/data', 'package.json', 'tsconfig.json', 'tsconfig.node.json', 'vite.config.mts', 'vitest.config.mts'])
  await cp(new URL(name, renderer), new URL(name, copy), { recursive: true });
await cp(new URL('ipc/', root), new URL('ipc/', validation), { recursive: true });
await symlink(fileURLToPath(new URL('node_modules/', renderer)), fileURLToPath(new URL('node_modules', copy)), 'junction');
const configPath = new URL('vitest.config.mts', copy);
const config = await readFile(configPath, 'utf8');
await writeFile(configPath, config.replace('export default defineConfig({', "export default defineConfig({\n  cacheDir: '.validation-cache',"));
function run(label) {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('node_modules/vitest/vitest.mjs', renderer)), 'run', '--config', 'vitest.config.mts'], {
    cwd: fileURLToPath(copy), encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' }, maxBuffer: 8 * 1024 * 1024
  });
  return { label, status: result.status, stdout: result.stdout, stderr: result.stderr, error: result.error?.message };
}
const results = [];
try {
  results.push(run('unchanged baseline: all existing tests'));
  for (const lang of ['en', 'ko']) await cp(new URL(`${lang}/stats.ndjson`, staging), new URL(`public/data/${lang}/stats.ndjson`, copy));
  // Only the temporary copy changes: the former known-gap assertion is now an
  // acceptance assertion. Keep every other existing case and expectation.
  const testPath = new URL('test/parser.ko.test.ts', copy);
  let test = await readFile(testPath, 'utf8');
  const old = `      expect(item.newMods).toHaveLength(1)\n      expect(item.newMods[0].info.type).toBe(ModifierType.Implicit)\n      if (slot === 'head') {\n        expect(item.unknownModifiers).toHaveLength(2)\n        expect(item.unknownModifiers.every(mod => mod.type === ModifierType.Implicit)).toBe(true)`;
  const replacement = `      expect(item.newMods).toHaveLength(1)\n      expect(item.newMods.every(mod => mod.info.type === ModifierType.Implicit)).toBe(true)\n      if (slot === 'head') {\n        expect(item.unknownModifiers).toEqual([])\n        expect(item.newMods[0].stats).toHaveLength(2)\n        expect(item.newMods.flatMap(mod => mod.stats).map(stat => stat.roll?.value)).toEqual([4, 5])`;
  test = test.replace(/\r\n/g, '\n');
  assert.ok(test.includes(old), 'Known-gap test changed: review temporary acceptance patch');
  await writeFile(testPath, test.replace(old, replacement));
  results.push(run('staging: existing tests + head unknownModifiers=[] and rolls 4/5'));
} finally {
  const after = await digestTree(new URL('public/data/', renderer));
  assert.deepEqual(after, original, 'Original renderer/public/data changed');
  await writeFile(new URL('stats-validation.json', staging), JSON.stringify({
    method: 'isolated renderer copy; original source/data never overwritten', validation: fileURLToPath(validation),
    originalDataUnchanged: true, sha256: original, results
  }, null, 2) + '\n');
  const reportPath = new URL('stats-report.md', staging);
  const report = await readFile(reportPath, 'utf8');
  await writeFile(reportPath, report + '\n## Parser validation\n\n' +
    results.map(result => `- ${result.label}: ${result.status === 0 ? 'PASS' : 'FAIL'}`).join('\n') +
    '\n- Original renderer/public/data: every file SHA-256 unchanged (isolated copy; no overwrite).\n' +
    '- git was prohibited by the task file; no git command was run. SHA-256 comparison replaces the requested git diff check.\n' +
    '- Full output, data hashes and temporary-copy path: stats-validation.json.\n');
}
for (const result of results) { console.log(result.label, result.status); console.log(result.stdout); console.error(result.stderr); }
if (results.some(result => result.status !== 0)) process.exitCode = 1;
