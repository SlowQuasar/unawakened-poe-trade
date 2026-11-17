import { mkdir, writeFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { openTables, root, read, sha } from './tables.mjs';

const langs = ['en', 'ko'];
const namespaces = ['AREA','CAPTURED_BEAST','DIVINATION_CARD','GEM','ITEM','MERCENARY_BUILD','UNIQUE'];
const key = x => `${x.namespace}\0${x.refName}`;
const clean = s => s?.replace(/\[([^\]|]+)\|([^\]]+)\]/g, '$2');
const valid = s => !!s && !/\[DNT\]|\[UNUSED\]|\[DO NOT|^UNUSED|^Royale |^Unknown|^NULL$/i.test(s);
const group = (rows, fn) => {
  const map = new Map();
  for (const row of rows) { const k = fn(row); if (!map.has(k)) map.set(k, []); map.get(k).push(row); }
  return map;
};
const baselineBytes = {}, baseline = {}, baselineGroups = {};
for (const lang of langs) {
  baselineBytes[lang] = await read(`tools/data-generator/baseline/${lang}/items.ndjson`);
  baseline[lang] = baselineBytes[lang].toString('utf8').trimEnd().split('\n').map(JSON.parse);
  baselineGroups[lang] = group(baseline[lang], key);
}
const snapshotBytes = {};
for (const n of ['items','static','filters']) snapshotBytes[n] = await read(`tools/data-generator/snapshots/kakao-2026-11-17/${n}.json`);
const trade = JSON.parse(snapshotBytes.items).result.flatMap(g => g.entries.map(e => ({ ...e, group: g.id })));
const bulk = JSON.parse(snapshotBytes.static).result.flatMap(g => g.entries);
const filters = JSON.parse(snapshotBytes.filters).result.flatMap(g => g.filters).flatMap(f => f.option?.options ?? []);
const byType = group(trade.filter(e => !e.name), e => e.text ?? e.type);
const byUnique = group(trade.filter(e => e.name), e => e.name);
const byBulk = group(bulk, e => e.text);
const generated = new Map(), ambiguities = [], rejected = [], gemEvidence = [], uniqueChecks = [], newClasses = [], nameChanges = [];
function add(namespace, refName, names, fields = {}, source = '') {
  if (!valid(refName) || !valid(names.ko)) return;
  const candidate = { namespace, refName, names, fields, source };
  const k = key(candidate);
  const old = generated.get(k);
  if (!old) generated.set(k, [candidate]);
  else if (!old.some(x => isDeepStrictEqual(x.fields, fields) && isDeepStrictEqual(x.names, names))) old.push(candidate);
}
function snapshotFields(ko, entries = byType.get(ko) ?? []) {
  const result = {};
  const exact = (byBulk.get(ko) ?? []).filter(e => e.id);
  if (new Set(exact.map(e => e.id)).size === 1) {
    result.tradeTag = exact[0].id;
    result.exchangeable = true;
  }
  const icons = [...new Set([...entries, ...exact].map(e => e.image ?? e.icon).filter(Boolean))];
  if (icons.length === 1) result.icon = new URL(icons[0], 'https://web.poecdn.com').href;
  const discs = [...new Set(entries.map(e => e.disc ?? e.discriminator).filter(Boolean))];
  if (discs.length === 1) result.tradeDisc = discs[0];
  return result;
}
const db = await openTables(process.argv.find(a => a.endsWith('.ggpk')));
try {
  const en = {}, ko = {};
  for (const n of ['BaseItemTypes','ItemClasses','GemEffects','ActiveSkills','Words','WorldAreas','MonsterVarieties','MercenaryBuilds','MercenarySkills']) {
    en[n] = await db.table(n);
    ko[n] = await db.table(n, 'ko');
    if (en[n].length !== ko[n].length) throw new Error(`${n}: language row mismatch`);
    for (let i = 0; i < en[n].length; i++) {
      // Foreign keys address physical rows. Check stable identities before joining localized rows.
      const field = en[n][i].Id !== undefined ? 'Id' : en[n][i].HASH32 !== undefined ? 'HASH32' : en[n][i].HASH16 !== undefined ? 'HASH16' : null;
      if (field && en[n][i][field] !== ko[n][i][field]) throw new Error(`${n}[${i}]: localized identity mismatch`);
    }
  }
  for (const n of ['ArmourTypes','SkillGems','GrantedEffects','ItemExperienceTypes','ItemExperiencePerLevel','UniqueStashLayout','Maps','BestiaryCapturableMonsters']) en[n] = await db.table(n);
  const bases = en.BaseItemTypes;
  const armourByBase = group(en.ArmourTypes, a => a.BaseItemTypesKey);
  const learned = new Map();
  for (const b of bases) {
    const cls = en.ItemClasses[b.ItemClassesKey].Id;
    if (!learned.has(cls)) learned.set(cls, new Set());
    for (const previous of baselineGroups.en.get(`ITEM\0${b.Name}`) ?? []) learned.get(cls).add(previous.craftable?.category ?? null);
  }
  const classMapping = [...learned].map(([id, values]) => ({ id, categories: [...values] }));
  for (const [id, values] of learned) if (!values.size) newClasses.push({ id, decision: 'No baseline category; include only exact trade matches; leave craftable unset.' });
  for (let i = 0; i < bases.length; i++) {
    const b = bases[i], k = ko.BaseItemTypes[i], cls = en.ItemClasses[b.ItemClassesKey].Id;
    if (['Active Skill Gem','Support Skill Gem'].includes(cls)) continue;
    const ns = cls === 'DivinationCard' ? 'DIVINATION_CARD' : 'ITEM';
    const known = baselineGroups.en.has(`${ns}\0${b.Name}`);
    const market = (byType.get(k.Name) ?? []).some(e => e.type === k.Name && !e.disc);
    // Avoid creating quest, test, removed, and internal items solely because a display name exists.
    if (!known && !market && !(byBulk.get(k.Name)?.length)) { rejected.push({ namespace: ns, refName: b.Name, id: b.Id, reason: 'No baseline or exact trade/static evidence' }); continue; }
    if (!valid(b.Name) || /Royale/.test(b.Id)) continue;
    const fields = snapshotFields(k.Name);
    const values = learned.get(cls);
    if (values.size === 1 && !values.has(null)) fields.craftable = { category: [...values][0] };
    // Mixed classes (e.g. Jewel/Cluster Jewel) require a base-specific category.
    const existingCategory = baselineGroups.en.get(`${ns}\0${b.Name}`)?.[0]?.craftable?.category;
    if (existingCategory) fields.craftable = { category: existingCategory };
    if (b.IsCorrupted && fields.craftable) fields.craftable.corrupted = true;
    if (ns === 'DIVINATION_CARD') fields.exchangeable = true;
    if (b.Width > 1) fields.w = b.Width;
    if (b.Height > 1) fields.h = b.Height;
    const armour = armourByBase.get(i)?.[0];
    if (armour) {
      fields.armour = {};
      for (const [out, prefix] of [['ar','Armour'],['ev','Evasion'],['es','EnergyShield'],['ward','Ward']]) {
        if (armour[`${prefix}Max`] > 0) fields.armour[out] = [armour[`${prefix}Min`], armour[`${prefix}Max`]];
      }
    }
    add(ns, clean(b.Name), { en: clean(b.Name), ko: clean(k.Name) }, fields, `BaseItemTypes[${i}] ${b.Id}; ItemClasses.${cls}`);
  }
  // Experience tables define obtainable gem levels, unlike effect tables which include over-level scaling.
  for (const g of en.SkillGems) {
    const b = bases[g.BaseItemTypesKey], kb = ko.BaseItemTypes[g.BaseItemTypesKey];
    if (!b || /Royale/.test(b.Id) || !valid(b.Name)) continue;
    const levels = en.ItemExperiencePerLevel.filter(l => l.ItemExperienceType === g.ItemExperienceType).map(l => l.ItemCurrentLevel);
    if (!levels.length) throw new Error(`No progression: ${b.Id}`);
    const maxLevel = Math.max(...levels);
    for (let v = 0; v < g.GemVariants.length; v++) {
      const effectRow = g.GemVariants[v], effect = en.GemEffects[effectRow], ke = ko.GemEffects[effectRow];
      if (v && g.IsVaalVariant) continue; // Vaal secondary variants keep the same physical Vaal gem name.
      // Convocation retains an old 20-level definition alongside the current single-level gem.
      if (v === 0 && /Old$/.test(effect.Id) && en.SkillGems.some(other => bases[other.BaseItemTypesKey]?.Name === b.Name && other.GemVariants.some(row => en.GemEffects[row].Id === effect.Id.slice(0,-3)))) {
        rejected.push({ namespace:'GEM',refName:b.Name,reason:'Superseded effect; current same-name gem exists',id:effect.Id }); continue;
      }
      // Primary GemEffects.Name can be a flavour label (e.g. Melee Splash: Ash), not the item name.
      const name = clean(v === 0 ? b.Name : effect.Name), kn = clean(v === 0 ? kb.Name : ke.Name);
      if (!valid(name) || !valid(kn)) continue;
      const market = byType.get(kn) ?? [];
      if (!baselineGroups.en.has(`GEM\0${name}`) && !market.some(e => e.group === 'gem')) {
        rejected.push({ namespace: 'GEM', refName: name, reason: 'Unused/unlisted gem variant', id: effect.Id }); continue;
      }
      const gem = {};
      if (g.IsVaalVariant) gem.vaal = true;
      const granted = en.GrantedEffects[effect.GrantedEffect];
      const active = en.ActiveSkills[granted?.ActiveSkill];
      if (v && active?.TransfigureBase != null) {
        gem.transfigured = true;
        gem.normalVariant = clean(b.Name);
      } else if (v) {
        rejected.push({ namespace:'GEM', refName:name, reason:'No ActiveSkills.TransfigureBase link', id:effect.Id }); continue;
      }
      gem.maxLevel = maxLevel;
      add('GEM', name, { en: name, ko: kn }, { ...snapshotFields(kn, market), gem }, `SkillGems.BaseItemTypesKey=${g.BaseItemTypesKey}; GemEffects[${effectRow}]; ActiveSkills[${granted?.ActiveSkill}]`);
      gemEvidence.push({ refName: name, baseId: b.Id, effectId: effect.Id, progression: en.ItemExperienceTypes[g.ItemExperienceType].Id, progressionRow: g.ItemExperienceType, levels, maxLevel });
    }
  }
  // Words.Text2 is the displayed unique name; Text contains internal/old spellings.
  function uniqueFromWord(wordRow, source) {
    const word = en.Words[wordRow], kw = ko.Words[wordRow];
    const name = clean(word?.Text2 || word?.Text), kn = clean(kw?.Text2 || kw?.Text);
    if (!valid(name) || !valid(kn)) return;
    const existing = baselineGroups.en.get(`UNIQUE\0${name}`) ?? [];
    const matches = byUnique.get(kn) ?? [];
    const baseNames = new Set();
    for (const entry of matches) {
      const hits = bases.filter((b, row) => ko.BaseItemTypes[row].Name === entry.type);
      const names = [...new Set(hits.map(b => clean(b.Name)))];
      if (names.length === 1) baseNames.add(names[0]);
      else uniqueChecks.push({ name, ko: kn, type: entry.type, result: 'ambiguous/missing trade base', candidates: names });
    }
    if (!baseNames.size) for (const old of existing) baseNames.add(old.unique.base);
    if (!baseNames.size) { rejected.push({ namespace:'UNIQUE', refName:name, reason:'No exact trade pair and no baseline base', source }); return; }
    for (const base of baseNames) {
      const exact = matches.filter(e => bases.some((b, row) => clean(b.Name) === base && ko.BaseItemTypes[row].Name === e.type));
      uniqueChecks.push({ name, ko: kn, base, result: exact.length ? 'exact trade name/type pair' : 'baseline base fallback', source, wordsRow: wordRow });
      add('UNIQUE', name, { en: name, ko: kn }, { unique: { base }, ...snapshotFields(kn, exact) }, `${source}; Words.Text2; trade name/type`);
    }
  }
  const stashWords = new Set();
  for (let i = 0; i < en.UniqueStashLayout.length; i++) {
    const u = en.UniqueStashLayout[i];
    stashWords.add(u.WordsKey);
    uniqueFromWord(u.WordsKey, `UniqueStashLayout[${i}].WordsKey=${u.WordsKey}`);
  }
  // Relics, fragments, and idols are named in Words but do not necessarily have a unique stash slot.
  for (let i = 0; i < en.Words.length; i++) {
    if (stashWords.has(i)) continue;
    const w = en.Words[i], kw = ko.Words[i];
    if (baselineGroups.en.has(`UNIQUE\0${w.Text2 || w.Text}`) || byUnique.has(kw.Text2 || kw.Text)) uniqueFromWord(i, `Words[${i}] (no unique stash slot)`);
  }
  const mapAreas = new Set(en.Maps.flatMap(m => [m.Regular_WorldAreasKey,m.Unique_WorldAreasKey]).filter(x => x != null));
  for (let i = 0; i < en.WorldAreas.length; i++) {
    const a = en.WorldAreas[i], ka = ko.WorldAreas[i];
    if (!baselineGroups.en.has(`AREA\0${a.Name}`) && !mapAreas.has(i)) continue;
    // AREA names represent locations, not the physical Map base item.
    const options = filters.filter(f => f.text === ka.Name);
    const fields = { area: {} };
    if (new Set(options.map(f => f.id)).size === 1) fields.tradeDisc = options[0].id;
    add('AREA', clean(a.Name), { en: clean(a.Name), ko: clean(ka.Name) }, fields, `WorldAreas[${i}] ${a.Id}`);
  }
  for (const c of en.BestiaryCapturableMonsters) {
    const m = en.MonsterVarieties[c.MonsterVarietiesKey], km = ko.MonsterVarieties[c.MonsterVarietiesKey];
    if (!m || (c.IsDisabled && !baselineGroups.en.has(`CAPTURED_BEAST\0${m.Name}`))) continue;
    const listed = (byType.get(km.Name) ?? []).some(e => e.group === 'monster');
    if (!listed && !baselineGroups.en.has(`CAPTURED_BEAST\0${m.Name}`)) continue;
    add('CAPTURED_BEAST', clean(m.Name), { en: clean(m.Name), ko: clean(km.Name) }, snapshotFields(km.Name), `BestiaryCapturableMonsters.MonsterVarietiesKey=${c.MonsterVarietiesKey}; ${m.Id}`);
  }
  for (let i = 0; i < en.MercenaryBuilds.length; i++) {
    const b = en.MercenaryBuilds[i], kb = ko.MercenaryBuilds[i];
    const skills = [];
    for (const [field,type] of [['Skills1','primary'],['Skills2','secondary'],['Skills3','utility']]) {
      for (const row of b[field]) {
        const name = en.MercenarySkills[row]?.Name;
        if (name && !skills.some(s => s.name === name && s.type === type)) skills.push({ type, name });
      }
    }
    add('MERCENARY_BUILD', clean(b.Name), { en:clean(b.Name), ko:clean(kb.Name) }, { mercenaryBuild:{ skills } }, `MercenaryBuilds[${i}] ${b.Id}; MercenarySkills`);
  }

  const outputs = {}, counts = {}, legacy = [], additions = [], matchedSources = [];
  function select(old, candidates) {
    if (!candidates?.length) return;
    if (old.unique) return candidates.find(c => c.fields.unique?.base === old.unique.base);
    if (old.armour && candidates.length > 1) {
      const props = old.disc ? { ar: old.disc.propAR, ev: old.disc.propEV, es: old.disc.propES } : old.armour;
      const matches = candidates.filter(c => ['ar','ev','es'].every(p => !!c.fields.armour?.[p] === !!props[p]));
      if (matches.length === 1) return matches[0];
    }
    const names = [...new Set(candidates.map(c => c.names.ko))];
    if (names.length > 1) {
      const oldKo = baselineGroups.ko.get(key(old))?.find(k => k.tradeDisc === old.tradeDisc)?.name;
      const matching = candidates.filter(c => c.names.ko === oldKo);
      if (matching.length) return matching[0];
      ambiguities.push({ namespace: old.namespace, refName:old.refName, reason:'Conflicting localized names; baseline retained', candidates:candidates.map(c=>({names:c.names,source:c.source})) });
      return;
    }
    return candidates[0];
  }
  for (const lang of langs) {
    const rows = [], tally = Object.fromEntries(namespaces.map(n => [n,{ retained:0,changed:0,added:0,baselineOnly:0 }]));
    for (const old of baseline[lang]) {
      const candidate = select(old, generated.get(key(old)));
      if (!candidate) { rows.push(structuredClone(old)); tally[old.namespace].baselineOnly++; legacy.push({ lang, namespace:old.namespace, refName:old.refName, disc:old.disc, uniqueBase:old.unique?.base }); continue; }
      const row = structuredClone(old);
      row.name = candidate.names[lang];
      // Keep managed metadata exactly, including absent properties. Only source-derived fields change.
      for (const field of ['gem','armour','w','h']) {
        if (candidate.fields[field] !== undefined) row[field] = structuredClone(candidate.fields[field]);
      }
      if (candidate.fields.craftable) row.craftable = { ...old.craftable, ...candidate.fields.craftable };
      if (old.name !== row.name) nameChanges.push({ lang, namespace:old.namespace, refName:old.refName, before:old.name, after:row.name, source:candidate.source });
      tally[row.namespace][isDeepStrictEqual(row,old) ? 'retained' : 'changed']++;
      rows.push(row);
      if (lang === 'en') matchedSources.push({ namespace:old.namespace,refName:old.refName,source:candidate.source });
    }
    for (const [k, candidates] of generated) {
      if (baselineGroups.en.has(k) || baselineGroups.ko.has(k)) continue;
      // Same-name source rows are frequently league/history variants. A new record needs a unique name/base identity.
      const distinct = group(candidates, c => c.fields.unique?.base ?? '');
      for (const variants of distinct.values()) {
        const c = variants[0];
        if (new Set(variants.map(c=>c.names.ko)).size > 1) { if(lang==='en') ambiguities.push({namespace:c.namespace,refName:c.refName,reason:'New name has multiple translations; not emitted',sources:variants.map(x=>x.source)}); continue; }
        const row = { name:c.names[lang], refName:c.refName, namespace:c.namespace };
        for (const f of ['tradeTag','exchangeable','craftable','armour','tradeDisc','unique','area','mercenaryBuild']) if (c.fields[f] !== undefined) row[f] = structuredClone(c.fields[f]);
        row.icon = c.fields.icon ?? '';
        for (const f of ['w','h','gem']) if(c.fields[f] !== undefined) row[f] = structuredClone(c.fields[f]);
        rows.push(row); tally[row.namespace].added++;
        if(lang==='en') additions.push({namespace:c.namespace,refName:c.refName,ko:c.names.ko,base:c.fields.unique?.base,source:c.source});
      }
    }
    // Original files use namespace then English refName ordering. Stable sorting retains discriminator priority.
    rows.sort((a,b) => a.namespace.localeCompare(b.namespace, 'en') || a.refName.localeCompare(b.refName, 'en'));
    outputs[lang] = rows; counts[lang] = tally;
  }
  const identities = rows => new Set(rows.map(x => JSON.stringify([x.namespace,x.refName,x.disc??null,x.unique?.base??null])));
  const ek = identities(outputs.en), kk = identities(outputs.ko);
  if (ek.size !== kk.size || [...ek].some(k=>!kk.has(k))) throw new Error('Output en/ko record identity sets differ');
  for (const name of ['Arcane Link','Quickstep','Fireball of Radiation']) {
    if (!outputs.en.some(x=>x.namespace==='GEM'&&x.refName===name)) throw new Error(`Missing required gem: ${name}`);
  }
  const expectedUniques = ["Dreadmaidens' Sacrament",'Putrid Seed','Hide of the Vendigo','Unwilling Embrace','The Covetous Dark','Corpse Rose','The Sword of Ages','Ordered Fate','Bane of the Apostate','Mantle of Dreams','Veil of Flesh'];
  for (const name of expectedUniques) if (!outputs.en.some(x=>x.namespace==='UNIQUE'&&x.refName===name)) throw new Error(`Missing 3.30 unique: ${name}`);
  if (!await db.ggpk.unchanged()) throw new Error('GGPK changed during generation');
  for (const lang of langs) if (!(await read(`tools/data-generator/baseline/${lang}/items.ndjson`)).equals(baselineBytes[lang])) throw new Error(`Baseline changed: ${lang}`);
  const out = root + 'tools/data-generator/out/staging/';
  const hashes = {};
  for (const lang of langs) {
    await mkdir(out + lang, { recursive:true });
    const text = outputs[lang].map(x=>JSON.stringify(x)).join('\n')+'\n';
    await writeFile(out + lang + '/items.ndjson',text);
    hashes[lang] = { baselineSha256:sha(baselineBytes[lang]), outputSha256:sha(text), rows:outputs[lang].length };
  }
  const evidence = { schemaSha256:db.schemaSha256,snapshots:Object.fromEntries(Object.entries(snapshotBytes).map(([k,v])=>[k,sha(v)])),tables:db.evidence,hashes,counts,classMapping,newClasses,gemEvidence,uniqueChecks,additions,nameChanges,legacy,ambiguities,rejected,matchedSources,ggpkUnchanged:true };
  await writeFile(out+'items-evidence.json',JSON.stringify(evidence,null,2)+'\n');
  const cell = s => String(s??'').replace(/\|/g,'\\|').replace(/\r?\n/g,' ');
  const table = (heads,rows) => ['| '+heads.join(' | ')+' |','| '+heads.map(()=>'---').join(' | ')+' |',...rows.map(r=>'| '+r.map(cell).join(' | ')+' |')].join('\n');
  const report = [
    '# Items generator — 3.30.0b en/ko staging',
    '게임 GGPK는 읽기 전용. 기준선 items/stats와 제품 소스는 수정하지 않는다. 실행 명령: `node tools/data-generator/src/items/build.mjs`.',
    '## Namespace별 병합 결과 (물리 행 수)',
    table(['언어','Namespace','유지','변경','추가','기준선 전용'],langs.flatMap(l=>namespaces.map(n=>[l,n,...Object.values(counts[l][n])]))),
    '유지/변경은 원천과 조인된 기준선 행만 센다. 기준선 전용은 별도 열이며 그대로 보존한다. en/ko identity 집합(namespace, refName, disc, unique.base)은 동일하다. ko의 Lost Ruins 번역 alias 1행 때문에 물리 행 수는 다를 수 있다. 기존 중복 Voidborn Reliquary Key도 보존한다.',
    '## 3.30 신규 고유 11종',
    table(['en','ko','base','교차 검증'],expectedUniques.map(n=>{const x=outputs.en.find(x=>x.namespace==='UNIQUE'&&x.refName===n);return[n,outputs.ko.find(x=>x.namespace==='UNIQUE'&&x.refName===n).name,x.unique.base,uniqueChecks.find(u=>u.name===n)?.result];})),
    '## 필수 신규 젬과 maxLevel 근거',
    'SkillGems.ItemExperienceType → ItemExperienceTypes 및 ItemExperiencePerLevel.ItemCurrentLevel의 최댓값을 사용한다. GrantedEffectsPerLevel의 오버레벨 효과 수치를 최대 레벨로 쓰지 않는다. 변성은 GemEffects → GrantedEffects → ActiveSkills.TransfigureBase를 확인한다.',
    table(['젬','진행 타입 (FK)','레벨 범위','maxLevel','원천'],['Arcane Link','Quickstep','Fireball of Radiation'].map(n=>{const g=gemEvidence.find(g=>g.refName===n);return[n,`${g.progression} (${g.progressionRow})`,`${Math.min(...g.levels)}–${Math.max(...g.levels)}`,g.maxLevel,g.effectId];})),
    '## 기준선 대비 전체 신규 목록',
    '기준선에 없는 항목은 자동으로 3.30 신규라고 단정할 수 없다. 아래는 현재 거래소/게임 원천에서 생성된 전체 추가 목록이며 오래된 누락 항목도 포함한다. 이미 기준선에 포함된 192행 delta는 이후 절에 별도로 나열한다.',
    table(['Namespace','en','ko','base','원천'],additions.map(a=>[a.namespace,a.refName,a.ko,a.base,a.source])),
    '## 기존 3.30 delta (기준선 보존)',
    table(['en','ko'],baseline.en.slice(-192).map(x=>[x.refName,baselineGroups.ko.get(key(x))?.[0]?.name])),
    '## 이름 변경',table(['언어','Namespace','refName','기존','게임 원천','원천'],nameChanges.map(x=>[x.lang,x.namespace,x.refName,x.before,x.after,x.source])),
    '## ItemClass 학습 매핑',table(['ItemClass','기준선 category (∅ = 비 craftable)'],classMapping.map(x=>[x.id,x.categories.map(c=>c??'∅').join(', ')])),
    '혼합 클래스는 기존 base별 카테고리를 우선한다. 이름만으로 신규 mixed category를 추정하지 않는다.',
    '## 기준선에 매핑이 없는 ItemClass',table(['ItemClass','처리'],newClasses.map(x=>[x.id,x.decision])),
    '## 기준선 전용 (레거시/원천 미해결)',table(['언어','Namespace','refName','base'],legacy.map(x=>[x.lang,x.namespace,x.refName,x.uniqueBase])),
    '## 모호한 원천',...ambiguities.map(x=>'- '+JSON.stringify(x)),
    '## 재현성과 제한',
    '기준선 객체의 키 삽입 순서는 유지하고 값만 갱신한다. 신규 행은 기준선과 같은 compact JSON, LF, 마지막 개행 및 namespace/refName 정렬을 사용한다. 동명 변형은 안정 정렬로 인접 배치하고 기준선 disc 우선순위를 유지한다. refName은 기존 소비 코드의 영문 키를 유지한다.',
    'disc, tradeTag, tradeDisc, exchangeable, icon, unique.fixedStats/disenchantValue, area.*, mercenaryBuild는 기준선 그대로 보존한다. 신규 icon은 정확 snapshot 이미지가 있을 때만 URL을 사용하며 없으면 기준선 계약에 따라 빈 문자열이다. UNIQUE base는 거래소의 정확 name/type 짝을 우선하고 원천 미해결은 기준선 base를 유지한다. AREA/용병 역할 등 수동 데이터도 기준선이 우선한다.',
    `제외 원천 후보 ${rejected.length}건: 내부/미출시/거래 증거 부재 등을 items-evidence.json.rejected에 기록. 전체 젬 근거, UNIQUE 교차 검증, 입력 해시 및 테이블 행 크기 검증도 같은 파일에 기록.`,
    table(['언어','기준선 SHA-256','staging SHA-256','행 수'],langs.map(l=>[l,hashes[l].baselineSha256,hashes[l].outputSha256,hashes[l].rows])),
    'GGPK 크기/mtime 불변 확인: true. 전체 GGPK 해시를 계산하지는 않는다.'
  ].join('\n\n')+'\n';
  await writeFile(out+'items-report.md',report);
  console.log(JSON.stringify({counts,hashes,requiredUniques:expectedUniques.length,requiredGems:3,ambiguities:ambiguities.length,ggpkUnchanged:true}));
} finally { await db.ggpk.close(); }
