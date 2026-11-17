import { openTables } from '../items/tables.mjs';

// Granted item skills use a ClientString, not stat_descriptions.csd. Every
// non-support GrantedEffect is a candidate; the HASH32 trade ID and Korean
// wording are independently verified against the cached trade schema. 3.30
// moved many skills (curses, Aspects, Harbingers, Bestial summons) that had
// no "Grants Level # X Skill" ref before onto these effect IDs.
export async function readGrantedSkillDescriptions(snapshot, baseline, path) {
  const db = await openTables(path);
  try {
    const effects = await db.table('GrantedEffects');
    const en = await db.table('ActiveSkills');
    const ko = await db.table('ActiveSkills', 'ko');
    const strings = await db.table('ClientStrings');
    const stringsKo = await db.table('ClientStrings', 'ko');
    const template = id => {
      const index = strings.findIndex(row => row.Id === id);
      if (index < 0) throw new Error(`Missing granted effect ClientString ${id}`);
      return [strings[index].Text, stringsKo[index].Text];
    };
    // Kakao lists most skills with a level ("#레벨 X 부여"); Harbingers and a
    // few others are listed without one ("X 부여", ModGrantsEffect).
    const forms = [
      { id: 'ModGrantsEffectWithLevel', text: template('ModGrantsEffectWithLevel'), ref: name => `Grants Level # ${name} Skill`, legacy: true },
      { id: 'ModGrantsEffect', text: template('ModGrantsEffect'), ref: name => `Grants ${name}`, legacy: false }
    ];
    const entries = snapshot.result.flatMap(group => group.entries);
    const result = [];
    for (const effect of effects) {
      if (effect.IsSupport || effect.ActiveSkill == null) continue;
      const names = [en[effect.ActiveSkill]?.DisplayedName, ko[effect.ActiveSkill]?.DisplayedName];
      if (!names.every(Boolean)) continue;
      const trade = entries.filter(entry => entry.id.endsWith(`.effect_${effect.HASH32}`));
      for (const form of forms) {
        const templates = form.text.map((text, i) => text.replace('{0}', names[i]).replace('{1}', '{0}'));
        if (!trade.some(entry => entry.text === templates[1].replace('{0}', '#'))) continue;
        const variant = template => ({ template, conditions: [{ min: null, max: null }], handlers: [] });
        const legacy = form.ref(names[0]);
        result.push({
          source: `ClientStrings.${form.id} + GrantedEffects.ActiveSkill → ActiveSkills.DisplayedName`,
          stats: [`granted_effect_${effect.HASH32}`],
          grantedEffect: effect.HASH32,
          languages: {
            English: form.legacy ? [variant(templates[0]), variant(legacy.replace('#', '{0}'))] : [variant(templates[0])],
            Korean: [variant(templates[1])]
          }
        });
        break;
      }
    }
    if (!await db.ggpk.unchanged()) throw new Error('GGPK changed during granted skill lookup');
    return result;
  } finally { await db.ggpk.close(); }
}
