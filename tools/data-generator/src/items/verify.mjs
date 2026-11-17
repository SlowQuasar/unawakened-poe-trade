import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, cp, readdir, symlink, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { root, sha } from './tables.mjs';

const out = join(root,'tools/data-generator/out/staging');
const load = async path => (await readFile(path,'utf8')).trimEnd().split('\n').map(JSON.parse);
const identity = x => JSON.stringify([x.namespace,x.refName,x.disc??null,x.unique?.base??null]);
async function manifest(dir, relative = '') {
  const result = {};
  for (const entry of await readdir(join(dir,relative), {withFileTypes:true})) {
    if (['node_modules','.git'].includes(entry.name)) continue;
    const path = join(relative,entry.name);
    if(entry.isDirectory()) Object.assign(result,await manifest(dir,path));
    else if(entry.isFile()) result[path] = sha(await readFile(join(dir,path)));
  }
  return result;
}
const before = await manifest(join(root,'renderer'));
const checks = {};
for (const lang of ['en','ko']) {
  const baseline = await load(join(root,`renderer/public/data/${lang}/items.ndjson`));
  const bytes = await readFile(join(out,lang,'items.ndjson'));
  assert.equal(bytes.at(-1),10);
  assert(!bytes.includes(13),'LF only');
  const rows = await load(join(out,lang,'items.ndjson'));
  assert.equal(bytes.toString('utf8'),rows.map(x=>JSON.stringify(x)).join('\n')+'\n','Compact JSON and key order round trip');
  const groups = new Map();
  const closed = new Set(); let previous;
  for(let i=1;i<rows.length;i++) assert((rows[i-1].namespace.localeCompare(rows[i].namespace,'en') || rows[i-1].refName.localeCompare(rows[i].refName,'en'))<=0,'Baseline English collation order');
  for(const row of rows) {
    const k = `${row.namespace}\0${row.refName}`;
    if(previous!==k) { assert(!closed.has(k),`Noncontiguous variants: ${k}`); if(previous)closed.add(previous);previous=k; }
    const id=identity(row);if(!groups.has(id))groups.set(id,[]);groups.get(id).push(row);
  }
  const offsets = new Map();
  for(const old of baseline) {
    const k=identity(old),n=offsets.get(k)??0;offsets.set(k,n+1);
    const row=groups.get(k)?.[n];assert(row,`Lost baseline row: ${k} #${n}`);
    for(const field of ['disc','tradeTag','tradeDisc','exchangeable','icon','area','mercenaryBuild']) assert.deepEqual(row[field],old[field],`${lang} ${old.refName}.${field}`);
    for(const field of ['fixedStats','disenchantValue']) assert.deepEqual(row.unique?.[field],old.unique?.[field]);
  }
  const refs = new Set(rows.filter(x=>x.namespace==='ITEM').map(x=>x.refName));
  for(const u of rows.filter(x=>x.namespace==='UNIQUE')) {
    assert(refs.has(u.unique.base),`Missing unique base: ${u.refName} -> ${u.unique.base}`);
    assert(rows.some(x=>x.namespace==='ITEM'&&x.refName===u.unique.base&&x.craftable),`Missing unique base category: ${u.refName}`);
  }
  const normalGems=new Set(rows.filter(x=>x.namespace==='GEM').map(x=>x.refName));
  for(const g of rows.filter(x=>x.gem?.transfigured)) assert(normalGems.has(g.gem.normalVariant),`Missing normal gem ${g.refName}`);
  for(const [ref,maxLevel] of [['Arcane Link',20],['Quickstep',1],['Fireball of Radiation',20]]) assert.equal(rows.find(x=>x.namespace==='GEM'&&x.refName===ref)?.gem.maxLevel,maxLevel);
  assert.deepEqual(rows.find(x=>x.namespace==='GEM'&&x.refName==='Fireball of Radiation')?.gem,{transfigured:true,normalVariant:'Fireball',maxLevel:20});
  const requiredUniques=["Dreadmaidens' Sacrament",'Putrid Seed','Hide of the Vendigo','Unwilling Embrace','The Covetous Dark','Corpse Rose','The Sword of Ages','Ordered Fate','Bane of the Apostate','Mantle of Dreams','Veil of Flesh'];
  for(const ref of requiredUniques) assert(rows.some(x=>x.namespace==='UNIQUE'&&x.refName===ref),`Missing 3.30 unique: ${ref}`);
  checks[lang]={rows:rows.length,baselineRowsPreserved:baseline.length,identitySet:[...groups.keys()].sort(),sha256:sha(bytes)};
}
assert.deepEqual(checks.en.identitySet,checks.ko.identitySet);
delete checks.en.identitySet;delete checks.ko.identitySet;

// Run unmodified parser tests against a disposable renderer tree. No public data is replaced in the repository.
const work=join(out,'test-workspace'), renderer=join(work,'renderer');
await mkdir(work,{recursive:true});
await cp(join(root,'renderer'),renderer,{recursive:true,filter:source=>!source.split(/[\\/]/).some(part=>['node_modules','.git','dist','.vite'].includes(part))});
await cp(join(root,'ipc'),join(work,'ipc'),{recursive:true});
const modules=join(renderer,'node_modules');
try { await lstat(modules); } catch(error) { if(error.code!=='ENOENT')throw error; await symlink(join(root,'renderer/node_modules'),modules,'junction'); }
for(const lang of ['en','ko']) await cp(join(out,lang,'items.ndjson'),join(renderer,'public/data',lang,'items.ndjson'));
// Confirm stats remain the baseline bytes in the copy before invoking the standard global index setup.
for(const lang of ['en','ko']) assert.equal(sha(await readFile(join(renderer,'public/data',lang,'stats.ndjson'))),before[join('public','data',lang,'stats.ndjson')]);
const child=spawn(process.execPath,[join(root,'renderer/node_modules/vitest/vitest.mjs'),'run','--config','vitest.config.mts'],{cwd:renderer,stdio:['ignore','pipe','pipe']});
let log='';for(const stream of [child.stdout,child.stderr]) stream.on('data',bytes=>{log+=bytes.toString();process.stdout.write(bytes);});
const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve);});
await writeFile(join(out,'items-tests.log'),log);
const after=await manifest(join(root,'renderer'));
assert.deepEqual(after,before,'Original renderer contents changed');
await writeFile(join(out,'items-validation.json'),JSON.stringify({checks,parserExitCode:code,rendererFilesChecked:Object.keys(before).length,rendererUnchanged:true,statsBaseline:true},null,2)+'\n');
assert.equal(code,0,'Parser tests failed (see items-tests.log)');
console.log(JSON.stringify({checks,rendererFilesChecked:Object.keys(before).length,rendererUnchanged:true,statsBaseline:true}));
