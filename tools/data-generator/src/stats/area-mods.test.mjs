import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnWeight, classifyArea } from './area-mods.mjs';

test('spawn weights use the first matching tag including explicit exclusions', () => {
  const weights = [['uber_tier_map', 0], ['top_tier_map', 100], ['default', 10]];
  assert.equal(spawnWeight(weights, ['uber_tier_map']), 0);
  assert.equal(spawnWeight(weights, ['top_tier_map']), 100);
  assert.equal(spawnWeight(weights, ['low_tier_map']), 10);
});

test('area classification follows stat FKs, prefers shared normal maps and excludes other text contexts', () => {
  const byStat = new Map([['map_example', [
    { id: 'Uber', classification: 'ubermap_exclusive' },
    { id: 'Normal', classification: 'yes' }
  ]]]);
  const description = { stats: ['map_example'], source: 'metadata/statdescriptions/stat_descriptions.csd' };
  assert.equal(classifyArea(description, byStat).value, 'yes');
  assert.equal(classifyArea({ ...description, source: 'metadata/statdescriptions/atlas_stat_descriptions.csd' }, byStat), undefined);
  assert.equal(classifyArea({ ...description, stats: ['unrelated'] }, byStat), undefined);
});
