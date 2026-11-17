import { readFile, appendFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { decompressSliceInBundle, decompressedBundleSize, readIndexBundle, FileLoader } from 'pathofexile-dat/bundles.js';
import { readDatFile, readColumn, getHeaderLength } from 'pathofexile-dat/dat.js';
import { SCHEMA_VERSION, ValidFor } from 'pathofexile-dat-schema';
import { Ggpk } from './ggpk.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const read = path => readFile(root + path);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const schemaBytes = await read('tools/data-generator/schema/schema.min.json');
const schema = JSON.parse(schemaBytes);
if (schema.version !== 7 || schema.version !== SCHEMA_VERSION) throw new Error('Expected schema format 7');

// Same typed-column construction and read-only GGPK/FileLoader as extract-poc.mjs.
function headersFor(table, dat) {
  const definition = schema.tables.find(t => t.name === table && (t.validFor & ValidFor.PoE1));
  if (!definition) throw new Error(`Missing PoE1 schema: ${table}`);
  let offset = 0;
  const headers = definition.columns.map(column => {
    const integer = /^([ui])(8|16|32|64)$/.exec(column.type);
    const type = { array: column.array, interval: column.interval };
    if (integer) type.integer = { unsigned: integer[1] === 'u', size: Number(integer[2]) / 8 };
    else if (column.type === 'enumrow') type.integer = { unsigned: false, size: 4 };
    else if (column.type === 'string') type.string = {};
    else if (column.type === 'bool') type.boolean = {};
    else if (/^f(32|64)$/.test(column.type)) type.decimal = { size: Number(column.type.slice(1)) / 8 };
    else if (['row', 'foreignrow'].includes(column.type)) type.key = { foreign: column.type === 'foreignrow' };
    else if (!column.array) throw new Error(`Unsupported type: ${column.type}`);
    const header = { name: column.name, offset, type };
    offset += getHeaderLength(header, dat);
    return header;
  });
  if (offset !== dat.rowLength) throw new Error(`${table}: schema ${offset} != row length ${dat.rowLength}`);
  return headers;
}
function inflate(bytes) {
  const raw = new Uint8Array(decompressedBundleSize(bytes));
  decompressSliceInBundle(bytes, 0, raw);
  return raw;
}

const ggpk = await Ggpk.open(process.argv.find(a => a.endsWith('.ggpk')) ?? 'C:\\Daum Games\\Path of Exile\\Content.ggpk');
try {
  const index = readIndexBundle(inflate(await ggpk.fetchFile('_.index.bin')));
  const loader = new FileLoader(ggpk, index);
  const tables = {};
  async function table(name, lang, fields) {
    const path = `data/${lang === 'ko' ? 'korean/' : ''}${name.toLowerCase()}.datc64`;
    const bytes = await loader.getFileContents(path);
    const dat = readDatFile('.datc64', bytes);
    const headers = headersFor(name, dat);
    const cols = Object.fromEntries(fields.map(field => {
      const header = headers.find(h => h.name === field);
      if (!header) throw new Error(`Missing ${name}.${field}`);
      return [field, readColumn(header, dat)];
    }));
    tables[`${name}.${lang}`] = { rows: dat.rowCount, rowLength: dat.rowLength, sha256: sha(bytes) };
    return Array.from({ length: dat.rowCount }, (_, i) => Object.fromEntries(fields.map(f => [f, cols[f][i]])));
  }
  const bases = {}, classes = {};
  for (const lang of ['en', 'ko']) {
    bases[lang] = await table('BaseItemTypes', lang, ['Id', 'Name', 'ItemClassesKey']);
    classes[lang] = await table('ItemClasses', lang, ['Id', 'Name']);
  }
  const koById = new Map(bases.ko.map(b => [b.Id, b]));
  if (koById.size !== bases.ko.length || new Set(bases.en.map(b => b.Id)).size !== bases.en.length) throw new Error('Duplicate base ID');
  const all = bases.en.map((b, row) => {
    const ko = koById.get(b.Id);
    if (!ko) throw new Error(`Missing Korean base ${b.Id}`);
    return { id: b.Id, en: b.Name, ko: ko.Name, row, class: classes.en[b.ItemClassesKey]?.Id, koClass: classes.ko[ko.ItemClassesKey]?.Name };
  });
  const mods = await table('Mods', 'ko', ['Id', 'Name']);
  const lesserMods = mods.filter(m => m.Name.includes('하위') || (/Viscera/i.test(m.Id) && /Lesser|Low|Tier/i.test(m.Id)));
  await mkdir(root + 'tools/data-generator/out', { recursive: true });
  await writeFile(root + 'tools/data-generator/out/delta-inspect.json', JSON.stringify({ tables, all, lesserMods }, null, 2) + '\n');
  if (process.argv.includes('--inspect')) {
    console.log(JSON.stringify({ tables, candidates: all.filter(b => /Thread|Astrolabe|Soul Core|Allflame|Royal Visage|Trickery|Tailoring|Tempering|Mycelium|Memory Trace|Arcane Link|Radiation/.test(b.en) || b.ko === '빠른 걸음' || /Viscera/i.test(b.class)) }, null, 2));
  }
  if (!await ggpk.unchanged()) throw new Error('GGPK changed during extraction');
  if (!process.argv.includes('--inspect')) {
    const staticBytes = await read('tools/data-generator/snapshots/kakao-2026-11-17/static.json');
    const itemsBytes = await read('tools/data-generator/snapshots/kakao-2026-11-17/items.json');
    const staticEntries = JSON.parse(staticBytes).result.flatMap(g => g.entries);
    const itemGroups = JSON.parse(itemsBytes).result;
    const itemNames = new Set(itemGroups.flatMap(g => g.entries.map(e => e.type)));
    const namedBulk = /^(?:Maven's Chisel of Threads|Threaded Delirium Orb|Frayed Thread|Memory Traces|Royal Visage|Essence of Trickery|Tailoring Orb|Tempering Orb|Soul Core of .+|.+ Astrolabe|.+ Enshrouding Crystal|Allflame Ember of .+)$/;
    const candidates = all.filter(b => b.en && b.ko && (
      b.class === 'Viscera' || b.en === 'Mycelium Core' ||
      b.id.startsWith('Metadata/Items/Threads/') ||
      (namedBulk.test(b.en) && b.class !== 'QuestItem' &&
        (staticEntries.some(e => e.text === b.ko) || ['Memory Traces', "Maven's Chisel of Threads", 'Threaded Delirium Orb', 'Frayed Thread'].includes(b.en)))
    ));
    const originals = {}, existing = {};
    for (const lang of ['en', 'ko']) {
      originals[lang] = await read(`renderer/public/data/${lang}/items.ndjson`);
      const text = originals[lang].toString('utf8');
      if (!text.endsWith('\n')) throw new Error(`${lang}: expected final newline`);
      existing[lang] = new Set(text.trimEnd().split('\n').map(line => JSON.parse(line).refName));
    }
    const additions = [], skipped = [], duplicates = [], seen = new Map();
    for (const b of candidates) {
      if (seen.has(b.en)) {
        const previous = seen.get(b.en);
        if (previous.ko !== b.ko || previous.class !== b.class) throw new Error(`Ambiguous candidate refName: ${b.en}`);
        duplicates.push(b);
        continue;
      }
      seen.set(b.en, b);
      if (existing.en.has(b.en)) { skipped.push(b); continue; }
      if (existing.ko.has(b.en)) throw new Error(`Korean-only refName would violate append symmetry: ${b.en}`);
      const matches = staticEntries.filter(e => e.text === b.ko && e.id);
      if (new Set(matches.map(e => e.id)).size > 1) throw new Error(`Ambiguous static ID: ${b.ko}`);
      const entry = matches[0];
      const records = {};
      for (const lang of ['en', 'ko']) {
        const record = { name: b[lang], refName: b.en, namespace: 'ITEM' };
        if (b.class === 'Viscera') Object.assign(record, { icon: '', craftable: { category: 'Viscera' } });
        else if (b.en === 'Mycelium Core') Object.assign(record, { craftable: { category: 'Jewel' }, icon: '' });
        else {
          if (entry) record.tradeTag = entry.id;
          Object.assign(record, { exchangeable: true, icon: entry?.image ? new URL(entry.image, 'https://web.poecdn.com').href : '' });
        }
        records[lang] = record;
      }
      additions.push({ ...b, staticMatch: !!entry, itemsMatch: itemNames.has(b.ko), records });
    }
    if (!await ggpk.unchanged()) throw new Error('GGPK changed before append');
    for (const lang of ['en', 'ko']) {
      const path = `renderer/public/data/${lang}/items.ndjson`;
      if (!(await read(path)).equals(originals[lang])) throw new Error(`${lang}: concurrent modification`);
    }
    for (const lang of ['en', 'ko']) {
      if (additions.length) await appendFile(root + `renderer/public/data/${lang}/items.ndjson`, additions.map(b => JSON.stringify(b.records[lang])).join('\n') + '\n');
    }
    const verification = {};
    for (const lang of ['en', 'ko']) {
      const after = await read(`renderer/public/data/${lang}/items.ndjson`);
      if (!after.subarray(0, originals[lang].length).equals(originals[lang])) throw new Error('Original bytes changed');
      verification[lang] = { originalBytes: originals[lang].length, originalSha256: sha(originals[lang]), finalSha256: sha(after), addedRows: additions.length };
    }
    const result = { schemaSha256: sha(schemaBytes), staticSha256: sha(staticBytes), itemsSha256: sha(itemsBytes), tables, ggpkUnchanged: await ggpk.unchanged(), additions, skipped, duplicates, lesserMods, verification };
    // A no-op run must not replace the evidence for the original append.
    if (additions.length) await writeFile(root + 'tools/data-generator/out/delta-result.json', JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify({ addedRowsPerLanguage: additions.length, skipped: skipped.length, verification }));
  }
} finally { await ggpk.close(); }
