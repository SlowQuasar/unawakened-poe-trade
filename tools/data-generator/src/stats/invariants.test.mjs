import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { collisions } from './build.mjs';

const root = new URL('../../../../', import.meta.url);
const read = async path => {
  const text = await readFile(new URL(path, root), 'utf8');
  return { text, rows: text.trimEnd().split('\n').map(JSON.parse) };
};
const rowKey = row => JSON.stringify((row.stats ?? [row]).map(s => s.ref));
const flatten = rows => rows.flatMap(r => r.stats ?? [r]);

for (const lang of ['en', 'ko']) test(`${lang}: preserve every baseline row, group resolver, manual field, matcher and ID`, async () => {
  const baseline = await read(`renderer/public/data/${lang}/stats.ndjson`);
  const output = await read(`tools/data-generator/out/staging/${lang}/stats.ndjson`);
  assert.ok(output.text.endsWith('\n'));
  assert.ok(!output.text.includes('\r'));
  const queues = new Map();
  for (const row of output.rows) {
    const key = rowKey(row);
    if (!queues.has(key)) queues.set(key, []);
    queues.get(key).push(row);
  }
  for (const row of baseline.rows) {
    const next = queues.get(rowKey(row))?.shift();
    assert.ok(next, `Missing baseline row ${rowKey(row)}`);
    assert.deepEqual(next.resolve, row.resolve);
    const before = row.stats ?? [row], after = next.stats ?? [next];
    for (let i = 0; i < before.length; i++) {
      const { matchers, trade, ...manual } = before[i];
      const { matchers: actualMatchers, trade: actualTrade, ...actualManual } = after[i];
      if (!manual.fromAreaMods) delete actualManual.fromAreaMods;
      assert.deepEqual(actualManual, manual);
      const { ids, ...tradeManual } = trade, { ids: actualIds, ...actualTradeManual } = actualTrade;
      assert.deepEqual(actualTradeManual, tradeManual);
      for (const [type, idsBefore] of Object.entries(ids)) assert.deepEqual(actualIds[type].slice(0, idsBefore.length), idsBefore);
      for (const matcher of matchers) assert.ok(actualMatchers.some(m => JSON.stringify(m) === JSON.stringify(matcher)), `Missing historical matcher ${before[i].ref}`);
    }
  }
  const known = new Set(flatten(baseline.rows).map(s => s.ref));
  for (const stat of flatten(output.rows)) {
    if (!known.has(stat.ref)) assert.ok(stat.fromAreaMods || Object.values(stat.trade.ids).flat().length > 0);
  }
  assert.deepEqual(collisions(output.rows), []);
});

test('en/ko share identical ref sets and ordering is ordinal by row head ref', async () => {
  const en = await read('tools/data-generator/out/staging/en/stats.ndjson');
  const ko = await read('tools/data-generator/out/staging/ko/stats.ndjson');
  assert.deepEqual([...new Set(flatten(en.rows).map(s => s.ref))].sort(), [...new Set(flatten(ko.rows).map(s => s.ref))].sort());
  for (const rows of [en.rows, ko.rows]) {
    const refs = rows.map(r => (r.stats?.[0] ?? r).ref);
    assert.deepEqual(refs, [...refs].sort());
  }
});

test('every trade ID exists on the Kakao trade site snapshot', async () => {
  const snapshot = JSON.parse(await readFile(new URL('tools/data-generator/snapshots/kakao-2026-11-18/stats.json', root), 'utf8'));
  const live = new Set(snapshot.result.flatMap(group => group.entries.map(entry => entry.id)));
  for (const lang of ['en', 'ko']) {
    const output = await read(`tools/data-generator/out/staging/${lang}/stats.ndjson`);
    const retired = flatten(output.rows).flatMap(s => Object.values(s.trade.ids).flat()).filter(id => !live.has(id) && !live.has(id.split('|')[0]));
    assert.deepEqual(retired, [], `${lang}: IDs the trade search rejects`);
  }
});
