import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { decompressSliceInBundle, decompressedBundleSize, readIndexBundle, FileLoader } from 'pathofexile-dat/bundles.js';
import { readDatFile, readColumn, getHeaderLength } from 'pathofexile-dat/dat.js';
import { SCHEMA_VERSION, ValidFor } from 'pathofexile-dat-schema';
import { Ggpk } from '../ggpk.mjs';

export const root = fileURLToPath(new URL('../../../../', import.meta.url));
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export const read = path => readFile(root + path);
export async function openTables(path = 'C:\\Daum Games\\Path of Exile\\Content.ggpk') {
  const schemaBytes = await read('tools/data-generator/schema/schema.min.json');
  const schema = JSON.parse(schemaBytes);
  if (schema.version !== 7 || schema.version !== SCHEMA_VERSION) throw new Error('Expected schema format 7');
  const ggpk = await Ggpk.open(path);
  try {
    const bytes = await ggpk.fetchFile('_.index.bin');
    const raw = new Uint8Array(decompressedBundleSize(bytes));
    decompressSliceInBundle(bytes, 0, raw);
    const loader = new FileLoader(ggpk, readIndexBundle(raw));
    const evidence = {};
    const cache = new Map();
    async function table(name, lang = 'en') {
      const key = `${name}.${lang}`;
      if (cache.has(key)) return cache.get(key);
      const definition = schema.tables.find(t => t.name === name && (t.validFor & ValidFor.PoE1));
      if (!definition) throw new Error(`Missing PoE1 schema: ${name}`);
      const bytes = await loader.getFileContents(`data/${lang === 'ko' ? 'korean/' : ''}${name.toLowerCase()}.datc64`);
      const dat = readDatFile('.datc64', bytes);
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
        else if (!column.array) throw new Error(`Unsupported ${name}.${column.name}: ${column.type}`);
        const header = { name: column.name, offset, type };
        offset += getHeaderLength(header, dat);
        return header;
      });
      if (offset !== dat.rowLength) throw new Error(`${name}: schema ${offset} != row length ${dat.rowLength}`);
      const columns = headers.filter(h => h.name).map(h => [h.name, readColumn(h, dat)]);
      const rows = Array.from({ length: dat.rowCount }, (_, i) => Object.fromEntries(columns.map(([name, col]) => [name, col[i]])));
      evidence[key] = { rows: dat.rowCount, rowLength: dat.rowLength, sha256: sha(bytes) };
      cache.set(key, rows);
      return rows;
    }
    return { table, ggpk, evidence, schemaSha256: sha(schemaBytes) };
  } catch (error) { await ggpk.close(); throw error; }
}
