import { openTables } from '../items/tables.mjs';

// Granted item skills use a ClientString, not stat_descriptions.csd. Resolve
// only existing app refs and independently verify the HASH32 ID and Korean
// wording against the cached trade schema before adding current wording.
export async function readGrantedSkillDescriptions(snapshot, baseline, path) {
  const db = await openTables(path);
  try {
    const effects = await db.table('GrantedEffects');
    const en = await db.table('ActiveSkills');
    const ko = await db.table('ActiveSkills', 'ko');
    const strings = await db.table('ClientStrings');
    const stringsKo = await db.table('ClientStrings', 'ko');
    const indexes = ['ModGrantsEffectWithLevel', 'ModGrantsSupportEffectWithLevel'].map(id => strings.findIndex(row => row.Id === id));
    if (indexes.some(index => index < 0)) throw new Error('Missing granted effect ClientString');
    const refs = new Set(baseline.map(stat => stat.ref));
    const entries = snapshot.result.flatMap(group => group.entries);
    const result = [];
    for (const effect of effects) {
      if (effect.IsSupport || effect.ActiveSkill == null) continue;
      const names = [en[effect.ActiveSkill]?.DisplayedName, ko[effect.ActiveSkill]?.DisplayedName];
      if (!names.every(Boolean)) continue;
      const legacy = `Grants Level # ${names[0]} Skill`;
      if (!refs.has(legacy)) continue;
      // supports are skipped above, so only ModGrantsEffectWithLevel applies here
      const index = indexes[0];
      const templates = [strings[index].Text, stringsKo[index].Text].map((text, i) => text.replace('{0}', names[i]).replace('{1}', '{0}'));
      if (!entries.some(entry => entry.id.endsWith(`.effect_${effect.HASH32}`) && entry.text === templates[1].replace('{0}', '#'))) continue;
      const variant = template => ({ template, conditions: [{ min: null, max: null }], handlers: [] });
      result.push({
        source: 'ClientStrings.ModGrantsEffectWithLevel + GrantedEffects.ActiveSkill → ActiveSkills.DisplayedName',
        stats: [`granted_effect_${effect.HASH32}`],
        grantedEffect: effect.HASH32,
        languages: {
          English: [variant(templates[0]), variant(legacy.replace('#', '{0}'))],
          Korean: [variant(templates[1])]
        }
      });
    }
    if (!await db.ggpk.unchanged()) throw new Error('GGPK changed during granted skill lookup');
    return result;
  } finally { await db.ggpk.close(); }
}
