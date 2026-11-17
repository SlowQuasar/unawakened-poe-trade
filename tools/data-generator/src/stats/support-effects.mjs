import { openTables } from '../items/tables.mjs';

// display_indexable_support resolves names at runtime. 3.30 uses the
// GrantedEffects HASH32 identity in trade, rather than the old indexable ID.
export async function readSupportEffects(path) {
  const db = await openTables(path);
  try {
    const en = await db.table('GrantedEffects');
    const ko = await db.table('GrantedEffects', 'ko');
    const gems = await db.table('SkillGems');
    const gemEffects = await db.table('GemEffects');
    const indexable = await db.table('IndexableSupportGems');
    const indexableKo = await db.table('IndexableSupportGems', 'ko');
    const legacy = new Map(indexable.flatMap((row, i) => {
      const gem = gems[row.SupportGem];
      const effect = gemEffects[gem?.GemVariants[0]];
      return effect ? [[effect.GrantedEffect, { en: row.Name, ko: indexableKo[i].Name }]] : [];
    }));
    const effects = en.flatMap((effect, index) => effect.IsSupport && effect.SupportName && ko[index].SupportName
      ? [{ hash: effect.HASH32, en: effect.SupportName, ko: ko[index].SupportName, legacy: legacy.get(index) }] : []);
    if (!await db.ggpk.unchanged()) throw new Error('GGPK changed during support lookup');
    return effects;
  } finally { await db.ggpk.close(); }
}

export function expandSupportDescription(description, effects) {
  if (!description.stats.includes('local_random_support_gem_level') && !description.stats.includes('local_random_support_gem_level_1')) return [description];
  return effects.map(effect => ({ ...description, supportEffect: effect,
    languages: Object.fromEntries([['English', effect.en], ['Korean', effect.ko]].map(([language, name]) =>
      [language, [name, effect.legacy?.[language === 'English' ? 'en' : 'ko']].filter(Boolean).flatMap(label => description.languages[language].map(v => ({ ...v, template: v.template.replace('{1}', label), handlers: [] }))) ])) }));
}
