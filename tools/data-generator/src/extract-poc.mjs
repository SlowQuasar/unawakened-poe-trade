import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { decompressSliceInBundle, decompressedBundleSize, readIndexBundle, FileLoader } from 'pathofexile-dat/bundles.js';
import { unpackPaths } from '../node_modules/pathofexile-dat/dist/bundles/index-paths.js';
import { readDatFile, readColumn, getHeaderLength } from 'pathofexile-dat/dat.js';
import { SCHEMA_VERSION, SCHEMA_URL, ValidFor } from 'pathofexile-dat-schema';
import { Ggpk } from './ggpk.mjs';

const out = fileURLToPath(new URL('../out/', import.meta.url));
const started = performance.now();
const summary = { startedUtc: new Date().toISOString(), schema: { formatVersion: SCHEMA_VERSION, url: SCHEMA_URL }, stages: {}, tables: {}, descriptions: [] };
const save = (name, data) => writeFile(`${out}/${name}`, typeof data === 'string' || data instanceof Uint8Array ? data : JSON.stringify(data, null, 2) + '\n');
const hash = data => createHash('sha256').update(data).digest('hex');
function inflate(bytes) {
  const raw = new Uint8Array(decompressedBundleSize(bytes));
  decompressSliceInBundle(bytes, 0, raw);
  return raw;
}
function headersFor(table, dat, schema) {
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
    else if (column.type === 'f32' || column.type === 'f64') type.decimal = { size: Number(column.type.slice(1)) / 8 };
    else if (column.type === 'row' || column.type === 'foreignrow') type.key = { foreign: column.type === 'foreignrow' };
    else if (!column.array) throw new Error(`Unsupported schema type ${column.type}`);
    const header = { name: column.name, offset, type };
    offset += getHeaderLength(header, dat);
    return header;
  });
  if (offset !== dat.rowLength) throw new Error(`Schema length ${offset} != actual ${dat.rowLength}`);
  return headers;
}
// Exploratory evidence only: bounded UTF-16 pointers, without assigning schema field names.
function stringAt(dat, row, offset) {
  if (offset + 8 > dat.rowLength) return null;
  const ptr = dat.readerFixed.getBigUint64(row * dat.rowLength + offset, true);
  if (ptr < 8n || ptr >= BigInt(dat.dataVariable.length) || ptr % 2n) return null;
  const start = Number(ptr);
  // Strings start after the magic or a four-byte terminator. Reject interior
  // pointers and coincidental integers that happen to land inside text.
  if (start !== 8 && (start < 4 || !dat.dataVariable.subarray(start - 4, start).every(b => b === 0))) return null;
  for (let end = start; end + 3 < dat.dataVariable.length && end - start < 32768; end += 2) {
    if (dat.dataVariable[end] === 0 && dat.dataVariable[end + 1] === 0 && dat.dataVariable[end + 2] === 0 && dat.dataVariable[end + 3] === 0) {
      const text = Buffer.from(dat.dataVariable.subarray(start, end)).toString('utf16le');
      return /[\u0000-\u0008\u000b\u000e-\u001f\ufffd]/.test(text) ? null : text;
    }
  }
  return null;
}
function probe(dat) {
  const offsets = [];
  for (let offset = 0; offset + 8 <= dat.rowLength; offset++) {
    const values = Array.from({ length: Math.min(30, dat.rowCount) }, (_, row) => stringAt(dat, row, offset));
    if (values.length && values.every(v => v !== null) && values.some(v => v.length)) offsets.push(offset);
  }
  return { stringOffsets: offsets, samples: Array.from({ length: Math.min(3, dat.rowCount) }, (_, row) => ({ row, strings: Object.fromEntries(offsets.map(offset => [offset, stringAt(dat, row, offset)])) })) };
}

await mkdir(out, { recursive: true });
let schema;
if (process.argv[3]) {
  const bytes = await readFile(process.argv[3]);
  schema = JSON.parse(bytes);
  if (schema.version !== SCHEMA_VERSION) throw new Error('Incompatible schema format');
  summary.schema = { ...summary.schema, suppliedPath: process.argv[3], sha256: hash(bytes), status: 'loaded' };
} else summary.schema.status = 'unavailable: package ships types/constants only; no offline table definitions; network prohibited';
const ggpk = await Ggpk.open(process.argv[2] ?? 'C:\\Daum Games\\Path of Exile\\Content.ggpk');
try {
  const indexStart = performance.now();
  const compressed = await ggpk.fetchFile('_.index.bin');
  const indexRaw = inflate(compressed);
  const index = readIndexBundle(indexRaw);
  const pathsRaw = inflate(index.pathRepsBundle);
  const paths = unpackPaths(pathsRaw);
  summary.stages.index = { ms: performance.now() - indexStart, compressedBytes: compressed.length, rawBytes: indexRaw.length, pathsRawBytes: pathsRaw.length, pathCount: paths.length, indexedFileCount: index.filesInfo.length / 20, memory: process.memoryUsage() };
  summary.ggpk = { version: ggpk.version, size: ggpk.before.size, mtime: ggpk.before.mtime.toISOString() };
  await save('virtual-paths.txt', paths.join('\n') + '\n');
  const dataPaths = paths.filter(p => /^data\//i.test(p));
  summary.data = { count: dataPaths.length, folders: [...new Set(dataPaths.filter(p => p.split('/').length > 2).map(p => p.split('/')[1]))].sort(), defaultDatc64: dataPaths.filter(p => /^data\/[^/]+\.datc64$/i.test(p)).length, koreanDatc64: dataPaths.filter(p => /^data\/korean\/[^/]+\.datc64$/i.test(p)).length };
  const loader = new FileLoader(ggpk, index);
  const baseDats = {};
  for (const table of ['BaseItemTypes', 'Mods', 'Stats', 'ClientStrings']) {
    summary.tables[table] = {};
    for (const [lang, folder] of [['en', 'Data'], ['ko', 'Data/Korean']]) {
      const tick = performance.now();
      const target = paths.find(p => p.toLowerCase() === `${folder}/${table}.datc64`.toLowerCase());
      if (!target) { summary.tables[table][lang] = { error: 'Path not found (no fallback)' }; continue; }
      const bytes = await loader.getFileContents(target);
      await save(`${table}.${lang}.datc64`, bytes);
      const dat = readDatFile('.datc64', bytes);
      const info = { path: target, bytes: bytes.length, sha256: hash(bytes), rowCount: dat.rowCount, rowLength: dat.rowLength, ...probe(dat) };
      if (schema) {
        const columns = headersFor(table, dat, schema).filter(h => ['Id', 'Name', 'Text'].includes(h.name));
        const data = Object.fromEntries(columns.map(h => [h.name, readColumn(h, dat)]));
        await save(`${table}.${lang}.json`, data);
        info.schemaSamples = Array.from({ length: Math.min(3, dat.rowCount) }, (_, i) => Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v[i]])));
      }
      info.ms = performance.now() - tick;
      summary.tables[table][lang] = info;
      if (table === 'BaseItemTypes') baseDats[lang] = dat;
      console.log(`${table} ${lang}: ${dat.rowCount} rows, ${dat.rowLength} bytes/row, ${info.ms.toFixed(0)} ms`);
    }
  }
  if (baseDats.en && baseDats.ko) {
    // Candidate ID at offset 0 must be nonempty and unique on both sides.
    const maps = Object.fromEntries(Object.entries(baseDats).map(([lang, dat]) => {
      const rows = Array.from({ length: dat.rowCount }, (_, row) => [stringAt(dat, row, 0), row]);
      if (rows.some(([id]) => !id) || new Set(rows.map(([id]) => id)).size !== rows.length) throw new Error('Candidate ID is not unique');
      return [lang, new Map(rows)];
    }));
    const nameOffset = summary.tables.BaseItemTypes.en.stringOffsets.find(offset => offset > 0 && Array.from({ length: Math.min(100, baseDats.en.rowCount) }, (_, row) => stringAt(baseDats.en, row, offset)).some(v => v && /[A-Za-z]/.test(v) && !v.includes('/')));
    const all = [...maps.en].map(([id, enRow]) => ({ candidateId: id, enRow, koRow: maps.ko.get(id), en: stringAt(baseDats.en, enRow, nameOffset), ko: maps.ko.has(id) ? stringAt(baseDats.ko, maps.ko.get(id), nameOffset) : null }));
    const special = all.filter(row => /Thread|Mycelium/i.test(row.en ?? ''));
    summary.baseJoin = { method: 'EXPLORATORY: unique string at offset 0, candidate display name at offset ' + nameOffset + '; NOT schema-verified', enUniqueIds: maps.en.size, koUniqueIds: maps.ko.size, missingKo: all.filter(r => r.koRow === undefined).length, specialMatches: special, samples: [...special.filter(r => /Mycelium/i.test(r.en)), ...special.filter(r => /Thread/i.test(r.en)), ...all].filter((r, i, a) => a.findIndex(v => v.candidateId === r.candidateId) === i).slice(0, 10) };
    console.table(summary.baseJoin.samples);
  }
  const descriptions = paths.filter(p => /stat_descriptions\.(csd|txt)$/i.test(p));
  summary.descriptionPaths = descriptions;
  for (const target of descriptions.filter(p => /(^|\/)stat_descriptions\.(csd|txt)$/i.test(p) && !/\/specific_/i.test(p)).slice(0, 4)) {
    const bytes = await loader.getFileContents(target);
    const text = new TextDecoder(bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf-16le' : 'utf-8').decode(bytes);
    const filename = `description-${summary.descriptions.length}.txt`;
    await save(filename, text);
    summary.descriptions.push({ path: target, bytes: bytes.length, sha256: hash(bytes), output: filename, firstLines: text.split(/\r?\n/).slice(0, 18), languageMarkers: [...text.matchAll(/^\s*lang\s+"([^"]+)"/gm)].reduce((acc, m) => { acc[m[1]] = (acc[m[1]] ?? 0) + 1; return acc; }, {}), koreanExcerpt: text.includes('lang "Korean"') ? text.slice(text.indexOf('lang "Korean"'), text.indexOf('lang "Korean"') + 350) : null });
  }
} catch (error) { summary.error = error.stack; process.exitCode = 1; }
finally {
  summary.ggpkUnchangedSizeAndMtime = await ggpk.unchanged();
  summary.bytesRead = ggpk.bytesRead;
  await ggpk.close();
  summary.totalMs = performance.now() - started;
  summary.memory = process.memoryUsage();
  summary.peakRssBytes = process.resourceUsage().maxRSS * 1024;
  await save('summary.json', summary);
  console.log(JSON.stringify({ error: summary.error, data: summary.data, index: summary.stages.index, totalMs: summary.totalMs, bytesRead: summary.bytesRead, peakRssBytes: summary.peakRssBytes }));
}
