import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { expandSupportDescription } from './support-effects.mjs';
const root = new URL('../../../../', import.meta.url);
const json = path => JSON.parse(readFileSync(new URL(path, root), 'utf8'));

test('both random support slots expand names without a second numeric roll', () => {
  for (const suffix of ['', '_1']) {
    const variant = template => ({ template, handlers: [{ name: 'display_indexable_support', args: [2, 1] }], conditions: [{ min: null, max: null }, { min: null, max: null }] });
    const d = { stats: [`local_random_support_gem_level${suffix}`], languages: {
      English: [variant('Socketed Gems are Supported by Level {0} {1}')], Korean: [variant('장착된 젬에 {0}레벨 {1} 보조 효과 적용')]
    } };
    const [expanded] = expandSupportDescription(d, [{ en: 'Rage Support', ko: '격노 보조', legacy: { en: 'Rage', ko: '격노' } }]);
    assert.equal(expanded.languages.Korean[0].template, '장착된 젬에 {0}레벨 격노 보조 보조 효과 적용');
    assert.equal(expanded.languages.English[1].template, 'Socketed Gems are Supported by Level {0} Rage');
    assert.deepEqual(expanded.languages.English[0].handlers, []);
  }
});

test('all 228 cached support effect IDs have current Korean matchers and legacy Rage is retained', () => {
  const stats = readFileSync(new URL('tools/data-generator/out/staging/ko/stats.ndjson', root), 'utf8').trim().split('\n').map(JSON.parse).flatMap(r => r.stats ?? [r]);
  const entries = json('tools/data-generator/snapshots/kakao-2026-11-18/stats.json').result.flatMap(g => g.entries);
  const effects = entries.filter(e => e.id.includes('.effect_') && e.text.startsWith('장착된 젬에 #레벨') && e.text.endsWith('보조 효과 적용'));
  assert.equal(effects.length, 228);
  for (const entry of effects) assert.ok(stats.some(s => Object.values(s.trade.ids).flat().includes(entry.id) && s.matchers.some(m => m.string === entry.text)), entry.id);
  const rage = stats.find(s => s.ref === 'Socketed Gems are Supported by Level # Rage');
  assert.equal(rage.trade.ids.explicit[0], 'explicit.effect_3512123051');
  assert.ok(rage.trade.ids.explicit.includes('explicit.indexable_support_28'));
  assert.ok(rage.matchers.some(m => m.string === '장착된 젬에 #레벨 격노 보조 효과 적용'));
});
