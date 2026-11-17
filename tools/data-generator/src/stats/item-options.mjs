import { openTables } from '../items/tables.mjs';

export async function readPassiveOptions(snapshot, path) {
  const db = await openTables(path);
  try {
    const en = await db.table('PassiveSkills');
    const ko = await db.table('PassiveSkills', 'ko');
    const byHash = new Map(en.map((row, i) => [row.PassiveSkillGraphId, { en: row.Name, ko: ko[i].Name }]));
    return snapshot.result.flatMap(g => g.entries).filter(e => e.id.startsWith('enchant.stat_3599615742|')).flatMap(entry => {
      const names = byHash.get(Number(entry.id.split('|')[1]));
      return names?.en && entry.text === `추가된 패시브 스킬 1개가 ${names.ko}` ? [{ ...names, id: entry.id }] : [];
    });
  } finally { await db.ggpk.close(); }
}

export function expandPassiveDescription(description, options) {
  if (!description.stats.some(s => /^local_jewel_blightcore_granted_passive_hash_[1-4]$/.test(s))) return [description];
  return options.map(option => ({ ...description, languages: Object.fromEntries([['English', option.en], ['Korean', option.ko]].map(([language, name]) =>
    [language, description.languages[language].map(v => ({ ...v, template: v.template.replace('{0}', name), handlers: [] }))])) }));
}

// The Korean game's ordinary clipboard currently embeds English small-node
// descriptions. Join only the established English ref and verified option ID.
export function addMixedClusterMatchers(rows, english, snapshot) {
  const entries = snapshot.result.flatMap(g => g.entries);
  const byId = new Map(english.flatMap(row => (row.stats ?? [row]).flatMap(s => (s.trade.ids.enchant ?? []).map(id => [id, s]))));
  for (const stat of rows.flatMap(row => row.stats ?? [row])) {
    for (const id of stat.trade.ids.enchant ?? []) {
      if (!id.startsWith('enchant.stat_3948993189|')) continue;
      const entry = entries.find(e => e.id === id);
      const prefix = '추가된 소형 패시브 스킬 효과: ';
      const source = byId.get(id)?.matchers[0].string;
      if (!entry?.text.startsWith(prefix) || !source?.startsWith('Added Small Passive Skills grant: ')) continue;
      const string = source.replaceAll('Added Small Passive Skills grant: ', prefix);
      if (!stat.matchers.some(m => m.string === string)) stat.matchers.push({ string });
    }
  }
}
