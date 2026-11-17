import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../../../../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const entries = JSON.parse(read('tools/data-generator/snapshots/kakao-2026-11-17/stats.json')).result.flatMap(g => g.entries);
const flatten = path => read(path).trimEnd().split('\n').map(JSON.parse).flatMap(row => row.stats ?? [row]);

test('current granted-skill wording keeps legacy refs and uses cached effect identities', () => {
  const report = JSON.parse(read('tools/data-generator/out/staging/stats-report.json'));
  const changes = report.languages.ko.changes.filter(change => change.source.startsWith('ClientStrings.ModGrantsEffectWithLevel'));
  assert.equal(new Set(changes.map(change => change.ref)).size, 61);
  for (const lang of ['en', 'ko']) {
    const stats = flatten(`tools/data-generator/out/staging/${lang}/stats.ndjson`);
    for (const change of changes) {
      const stat = stats.find(stat => stat.ref === change.ref);
      assert.ok(stat, change.ref);
      const effectIds = Object.values(stat.trade.ids).flat().filter(id => id.includes('.effect_'));
      assert.ok(effectIds.length, change.ref);
      for (const id of effectIds) {
        const entry = entries.find(entry => entry.id === id);
        assert.ok(entry, id);
        if (lang === 'ko') assert.ok(stat.matchers.some(matcher => matcher.string === entry.text), id);
      }
    }
    const ravenous = stats.find(stat => stat.ref === 'Grants Level # Ravenous Skill');
    assert.equal(ravenous.trade.ids.explicit[0], 'explicit.effect_388828889');
    assert.ok(ravenous.trade.ids.explicit.includes('explicit.stat_636370122'));
    assert.ok(ravenous.matchers.some(m => m.string === (lang === 'ko' ? '#레벨 굶주림 스킬 사용 가능' : 'Grants Level # Ravenous Skill')));
  }
});
