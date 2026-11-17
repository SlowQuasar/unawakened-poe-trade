import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import fnv1a from '../../../../renderer/node_modules/@sindresorhus/fnv1a/index.js';
import { readSources } from './source.mjs';
import { parseCsd, makeMatcher, uniqueMatchers, plainText } from './csd.mjs';
import { readAreaMods, classifyArea } from './area-mods.mjs';
import { readSupportEffects, expandSupportDescription } from './support-effects.mjs';
import { readPassiveOptions, expandPassiveDescription, addMixedClusterMatchers } from './item-options.mjs';
import { readGrantedSkillDescriptions } from './granted-skills.mjs';

const root = new URL('../../../../', import.meta.url);
const staging = new URL('tools/data-generator/out/staging/', root);
const load = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const flatten = rows => rows.flatMap(row => row.stats ?? [row]);
const key = text => plainText(text).replace(/\r\n/g, '\n').replace(/[+]#/g, '#').replace(/[ \t]+/g, ' ').trim();
const matcherKey = m => m.advanced ?? m.string;
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const save = (name, data) => writeFile(new URL(name, staging), data);

export function collisions(rows) {
  const hashes = { refs: new Map(), matchers: new Map() }, result = [];
  for (const stat of flatten(rows)) {
    for (const [kind, strings] of [['refs', [stat.ref]], ['matchers', stat.matchers.map(matcherKey)]]) {
      for (const string of strings) {
        const hash = Number(fnv1a(string, { size: 32 }));
        const previous = hashes[kind].get(hash);
        if (previous !== undefined && previous !== string) result.push({ kind, hash, strings: [previous, string] });
        hashes[kind].set(hash, string);
      }
    }
  }
  return [...new Map(result.map(r => [JSON.stringify(r), r])).values()];
}

function tradeIndex(snapshot) {
  const byText = new Map();
  for (const group of snapshot.result) for (const entry of group.entries) {
    // Option text is expanded using the documented app ID|option contract.
    const variants = entry.option?.options
      ? entry.option.options.map(option => ({ text: entry.text.replace('#', String(option.text)), id: `${entry.id}|${option.id}` }))
      : [{ text: entry.text, id: entry.id }];
    for (const variant of variants) {
      const text = key(variant.text);
      if (!byText.has(text)) byText.set(text, []);
      byText.get(text).push({ type: entry.type === 'mercenary' ? 'pseudo' : entry.type, id: variant.id });
    }
  }
  return byText;
}

function canonical(description) {
  const variants = description.languages.English;
  return variants.find(v => v.handlers.some(h => h.name === 'canonical_line')) ??
    variants.find(v => /\{(?:\d|:|\})/.test(v.template) && !makeMatcher(v).matcher?.negate) ?? variants[0];
}

// An enum such as display_map_mission_id has several unrelated static texts.
// Its NPC names are separate app refs, not synonyms of the first English line.
export function splitStaticDescription(description) {
  const english = description.languages.English;
  if (english.some(v => /\{(?:\d|:|\})/.test(v.template))) return [description];
  const templates = [...new Set(english.map(v => v.template))];
  if (templates.length < 2) return [description];
  return templates.map(template => {
    const variants = english.filter(v => v.template === template);
    const conditions = new Set(variants.map(v => JSON.stringify(v.conditions)));
    return { ...description, languages: Object.fromEntries(Object.entries(description.languages).map(([language, lines]) =>
      [language, lines.filter(v => conditions.has(JSON.stringify(v.conditions)))])) };
  });
}

// 3.30's Citadel name-table handler needs domain-specific expansion. Preserve
// historical refs; names come from baseline English and verified Kakao options.
export function expandCitadelDescription(description, englishBaseline, snapshot) {
  if (description.stats.length !== 1 || description.stats[0] !== 'map_contains_citadel') return [description];
  const variants = [];
  const entries = snapshot.result.flatMap(group => group.entries);
  for (const stat of englishBaseline) {
    const id = stat.trade.ids.implicit?.find(id => id.startsWith('implicit.stat_2563183002|'));
    if (!id) continue;
    const entry = entries.find(entry => entry.id === id);
    if (!entry) throw new Error(`Missing Citadel snapshot option ${id}`);
    const texts = { English: stat.ref.split('\n')[0], Korean: entry.text };
    const languages = {};
    for (const [language, text] of Object.entries(texts)) {
      const source = description.languages[language].find(v => v.handlers.some(h => h.name === 'atlas_exile_citadel_index'));
      if (!source) throw new Error(`Missing Citadel CSD handler: ${language}`);
      const [prefix, suffix] = source.template.split('{0}');
      if (suffix === undefined || !text.startsWith(prefix) || !text.endsWith(suffix)) throw new Error(`Citadel template mismatch: ${text}`);
      const option = Number(id.split('|')[1]);
      languages[language] = [{ ...source, template: text, handlers: [], conditions: [{ min: option, max: option }] }];
    }
    variants.push({ ...description, languages });
  }
  if (variants.length !== 4) throw new Error('Expected all four Citadel options');
  return variants;
}

// 3.30 removed the Blight chest-count sentence, while the cached trade schema
// still uses the historical three-line text. Preserve the established ID/ref
// using the game stat identity, rather than inventing a new trade stat or text.
export function preserveMapTradeIdentity(candidate, englishBaseline) {
  if (!candidate || candidate.description.stats.length !== 1 || candidate.description.stats[0] !== 'is_blighted_map') return candidate;
  const id = 'implicit.stat_299373046';
  const existing = englishBaseline.find(stat => stat.trade.ids.implicit?.includes(id));
  if (!existing) throw new Error('Missing baseline Blighted Map trade identity');
  candidate.ids.implicit = [...new Set([...(candidate.ids.implicit ?? []), id])];
  return candidate;
}

// Some stats are listed on trade only by their fixed wording (e.g. 100%:
// "Gain Bitterblood equal to Life spent", 1: "Arc Chains an additional
// time"). When no numeric wording maps to a trade ID, take the ID from the
// fixed wording; the numeric ref stays and the fixed matcher keeps its value.
// Only for trade IDs no baseline ref owns yet: otherwise an existing ref
// already covers the fixed wording.
function compile(description, tradeByText, report) {
  const candidate = compileWith(description, tradeByText, report, false);
  if (!candidate || Object.keys(candidate.ids).length || !candidate.ref.includes('#')) return candidate;
  report.baselineIds ??= new Set(report.englishBaseline.flatMap(stat => Object.values(stat.trade.ids).flat().map(id => id.replace(/^[a-z]+\./, ''))));
  const fixed = compileWith(description, tradeByText, { unsupported: {}, deferred: [] }, true);
  const ids = fixed ? Object.values(fixed.ids).flat().map(id => id.replace(/^[a-z]+\./, '')) : [];
  return ids.length && !ids.some(id => report.baselineIds.has(id)) ? fixed : candidate;
}

function compileWith(description, tradeByText, report, fixedIds) {
  const canonicalVariant = canonical(description);
  if (!canonicalVariant) return;
  const canonicalResult = makeMatcher(canonicalVariant, { ref: true });
  if (!canonicalResult.matcher) {
    for (const handler of canonicalResult.unsupported) report.unsupported[handler] = (report.unsupported[handler] ?? 0) + 1;
    report.deferred.push({ source: description.source, stats: description.stats, reason: 'canonical-handler-or-format', handlers: canonicalResult.unsupported });
    return;
  }
  const ref = canonicalResult.matcher.string;
  const canonicalNegative = !!canonicalResult.matcher.negate;
  const matchers = {};
  for (const [lang, language] of [['en', 'English'], ['ko', 'Korean']]) {
    matchers[lang] = uniqueMatchers((description.languages[language] ?? []).flatMap(variant => {
      const result = makeMatcher(variant);
      if (!result.matcher) {
        for (const handler of result.unsupported) report.unsupported[handler] = (report.unsupported[handler] ?? 0) + 1;
        return [];
      }
      const matcher = result.matcher;
      if (!!matcher.negate !== canonicalNegative) matcher.negate = true;
      else delete matcher.negate;
      // Fixed variants represent the canonical stat's displayed numeric value.
      // A 100% flag with no placeholder therefore yields roll 100.
      if (canonicalNegative && matcher.value !== undefined) matcher.value *= -1;
      if (!ref.includes('#')) delete matcher.value;
      return [matcher];
    }));
  }
  if (!matchers.en.length || !matchers.ko.length) return;
  const ids = {};
  for (const matcher of matchers.ko) {
    // Negative wording uses the inverse trade roll. It cannot safely supply a
    // new ID without an explicit trade.inverted policy.
    if (matcher.negate) continue;
    // Fixed flag variants can have a separate trade stat with boolean request
    // semantics. Do not merge it into a numeric ref without a group policy.
    if (!fixedIds && ref.includes('#') && !matcher.string.includes('#')) continue;
    for (const entry of tradeByText.get(key(matcher.string)) ?? []) {
      if (description.supportEffect && entry.id.includes('.effect_') && !entry.id.endsWith(`.effect_${description.supportEffect.hash}`)) continue;
      if (description.grantedEffect && entry.id.includes('.effect_') && !entry.id.endsWith(`.effect_${description.grantedEffect}`)) continue;
      (ids[entry.type] ??= []).push(entry.id);
    }
  }
  for (const type in ids) ids[type] = [...new Set(ids[type])];
  return { ref, matchers, ids, description, advanced: description.source.includes('advanced_mod_') };
}

function merge(rows, generated, lang, report) {
  const output = structuredClone(rows), stats = flatten(output);
  const originals = new Map(flatten(rows).map(s => [s.ref, s]));
  const byRef = new Map(), byEnglish = new Map(), byId = new Map();
  const add = (map, k, value) => { if (!map.has(k)) map.set(k, new Set()); map.get(k).add(value); };
  for (const stat of stats) add(byRef, stat.ref, stat);
  // English baseline is used even when updating Korean output.
  for (const stat of report.englishBaseline) {
    for (const matcher of stat.matchers) add(byEnglish, key(matcher.string), stat.ref);
    for (const ids of Object.values(stat.trade.ids)) for (const id of ids) add(byId, id, stat.ref);
  }
  const owner = new Map();
  for (const row of output) for (const stat of row.stats ?? [row]) for (const m of stat.matchers) add(owner, matcherKey(m), row);
  const statRow = new Map(output.flatMap(row => (row.stats ?? [row]).map(s => [s, row])));
  const changed = new Set(), regenerated = new Set(), added = new Set();
  const changes = [], conflicts = [];
  for (const candidate of generated) {
    let targets = byRef.get(candidate.ref);
    let method = 'ref';
    if (!targets) {
      const matches = new Set(candidate.matchers.en.flatMap(m => [...(byEnglish.get(key(m.string)) ?? [])]));
      if (matches.size === 1) { targets = byRef.get([...matches][0]); method = 'english-matcher'; }
    }
    if (!targets && candidate.description.supportEffect) {
      targets = byRef.get(candidate.ref.replace(/ Support$/, ''));
      method = 'support-name-legacy';
    }
    const independentRefs = new Set(candidate.matchers.en.flatMap(m => [...(byEnglish.get(key(m.string)) ?? [])]));
    // Existing groups own deliberately ambiguous text; their structure stays
    // authoritative. Defer separate unambiguous refs in a single description.
    if (independentRefs.size > 1 && candidate.matchers.en.every(m => (byEnglish.get(key(m.string))?.size ?? 0) <= 1)) {
      conflicts.push({ ref: candidate.ref, action: 'description-deferred-multiple-baseline-refs', refs: [...independentRefs] });
      continue;
    }
    if (!targets) {
      const matches = new Set(Object.values(candidate.ids).flat().flatMap(id => [...(byId.get(id) ?? [])]));
      if (matches.size === 1) { targets = byRef.get([...matches][0]); method = 'stable-trade-id'; }
    }
    if (!targets && !Object.keys(candidate.ids).length && !candidate.area) continue;
    if (!targets) {
      const occupied = candidate.matchers[lang].filter(m => owner.has(m.string));
      if (occupied.length) {
        conflicts.push({ ref: candidate.ref, action: 'new-ref-skipped', strings: occupied.map(m => m.string) });
        continue;
      }
      const better = /(?:Damage taken|Lose |reduced|less |Duration of Ailments on You)/i.test(candidate.ref) ? -1 : 1;
      const stat = { ref: candidate.ref, better, matchers: candidate.matchers[lang], trade: { ids: structuredClone(candidate.ids) } };
      if (candidate.area) {
        stat.fromAreaMods = candidate.area.value;
        report.areaMods.added.push({ lang, ref: stat.ref, ...candidate.area, stats: candidate.description.stats });
      }
      output.push(stat); stats.push(stat); add(byRef, stat.ref, stat); statRow.set(stat, stat);
      for (const matcher of stat.matchers) add(owner, matcherKey(matcher), stat);
      added.add(stat.ref);
      report.generated.push({ lang, ref: stat.ref, better, status: 'generated', source: candidate.description.source, stats: candidate.description.stats });
      continue;
    }
    for (const stat of targets) {
      if (candidate.area) {
        report.areaMods.baselineMatches.push({ lang, ref: stat.ref, baseline: originals.get(stat.ref)?.fromAreaMods, inferred: candidate.area.value, mods: candidate.area.mods });
        if (!stat.fromAreaMods) {
          stat.fromAreaMods = candidate.area.value;
          changed.add(stat.ref);
          report.areaMods.added.push({ lang, ref: stat.ref, ...candidate.area, stats: candidate.description.stats });
        }
      }
      if (originals.has(stat.ref)) regenerated.add(stat.ref);
      const row = statRow.get(stat), old = stat.matchers;
      // Match the existing roll convention; increased/reduced can be canonical
      // in different directions in the app and the game.
      let flip = false;
      const enOriginal = report.englishBaseline.find(s => s.ref === stat.ref);
      const shared = enOriginal?.matchers.flatMap(m => candidate.matchers.en.filter(n => key(n.string) === key(m.string)).map(n => [m, n]))[0];
      if (shared) flip = !!shared[0].negate !== !!shared[1].negate;
      const fresh = candidate.matchers[lang].flatMap(m => {
        const matcher = { ...m };
        if (flip) { if (matcher.negate) delete matcher.negate; else matcher.negate = true; }
        if (candidate.advanced) matcher.advanced = matcher.string;
        // Existing exact text can carry hand-maintained fixed-roll semantics
        // (flag/percent groups, inverted values). Preserve that contract.
        const existing = old.find(n => matcherKey(n) === matcherKey(matcher));
        if (existing) return [existing];
        const otherRows = [...(owner.get(matcherKey(matcher)) ?? [])].filter(r => r !== row);
        if (otherRows.length) {
          conflicts.push({ ref: stat.ref, action: 'matcher-skipped', string: matcherKey(matcher), owners: otherRows.flatMap(r => (r.stats ?? [r]).map(s => s.ref)) });
          return [];
        }
        return [matcher];
      });
      // New source wording takes priority. Keep historical clipboard text for
      // legacy items and advanced/name lookup variants not yet regenerated.
      const merged = uniqueMatchers([...fresh, ...old]);
      const newStrings = fresh.filter(m => !old.some(n => JSON.stringify(n) === JSON.stringify(m)));
      if (newStrings.length) {
        stat.matchers = merged;
        changed.add(stat.ref);
        changes.push({ ref: stat.ref, method, source: candidate.description.source,
          added: newStrings, legacyRetained: old, policy: 'source-first; retain historical matchers for legacy items' });
        for (const m of fresh) add(owner, matcherKey(m), row);
      }
      for (const [type, ids] of Object.entries(candidate.ids)) {
        // Local/global qualifiers in baseline English refs must not acquire a
        // different equipment-context ID through an unqualified text match.
        if (!(type in stat.trade.ids) && /\((?:Local|Global)\)/i.test(stat.ref)) continue;
        const dest = stat.trade.ids[type] ??= [];
        for (const id of ids) if (!dest.includes(id)) {
          dest.push(id);
          changed.add(stat.ref);
        }
        if (candidate.description.supportEffect || candidate.description.grantedEffect) dest.sort((a, b) => Number(b.includes('.effect_')) - Number(a.includes('.effect_')));
      }
    }
  }
  output.sort((a, b) => compare((a.stats?.[0] ?? a).ref, (b.stats?.[0] ?? b).ref));
  const baselineOnly = [...originals.keys()].filter(ref => !regenerated.has(ref));
  report.languages[lang] = {
    baselineRefs: originals.size, regenerated: regenerated.size,
    regeneratedPercent: Number((100 * regenerated.size / originals.size).toFixed(2)),
    kept: originals.size - changed.size, changed: changed.size, added: added.size,
    baselineOnly: baselineOnly.length, baselineOnlyRefs: baselineOnly,
    changes, conflicts, hashCollisions: collisions(output),
    nearbyToMetres: new Set(changes.filter(c => /nearby/i.test(c.ref) && c.added.some(m => /미터|metres/.test(m.string))).map(c => c.ref)).size
  };
  return output;
}

export async function build() {
  const start = performance.now();
  await mkdir(staging, { recursive: true });
  const baseline = {};
  for (const lang of ['en', 'ko']) baseline[lang] = (await readFile(new URL(`tools/data-generator/baseline/${lang}/stats.ndjson`, root), 'utf8')).trimEnd().split('\n').map(JSON.parse);
  const report = { sources: [], languages: {}, generated: [], unsupported: {}, deferred: [], englishBaseline: flatten(baseline.en) };
  const area = await readAreaMods(process.argv[2]);
  report.areaMods = { ...area.evidence, added: [], baselineMatches: [], descriptions: [] };
  const snapshot = await load('tools/data-generator/snapshots/kakao-2026-11-18/stats.json');
  const byText = tradeIndex(snapshot);
  const supportEffects = await readSupportEffects(process.argv[2]);
  const passiveOptions = await readPassiveOptions(snapshot, process.argv[2]);
  const generated = [];
  for (const description of await readGrantedSkillDescriptions(snapshot, report.englishBaseline, process.argv[2])) {
    const candidate = compile(description, byText, report);
    if (candidate) generated.push(candidate);
  }
  for (const source of await readSources(process.argv[2])) {
    const parsed = parseCsd(source.text, source.path);
    report.sources.push({ path: source.path, descriptions: parsed.descriptions.length, includes: parsed.includes, suppressed: parsed.suppressed });
    for (const description of parsed.descriptions.flatMap(d => expandSupportDescription(d, supportEffects)).flatMap(d => expandPassiveDescription(d, passiveOptions)).flatMap(d => expandCitadelDescription(d, report.englishBaseline, snapshot)).flatMap(splitStaticDescription)) {
      const classification = classifyArea(description, area.byStat);
      const candidate = preserveMapTradeIdentity(compile(description, byText, report), report.englishBaseline);
      if (classification) report.areaMods.descriptions.push({ stats: description.stats, source: description.source, ref: candidate?.ref, compiled: !!candidate, ...classification });
      if (candidate) candidate.area = classification;
      if (candidate) generated.push(candidate);
    }
  }
  const outputs = Object.fromEntries(['en', 'ko'].map(lang => [lang, merge(baseline[lang], generated, lang, report)]));
  addMixedClusterMatchers(outputs.ko, report.englishBaseline, snapshot);
  // A ref is a cross-language identity. If a newly generated row is ambiguous
  // in either language, defer it in both rather than ship asymmetric ref sets.
  const refSets = Object.fromEntries(['en', 'ko'].map(lang => [lang, new Set(flatten(outputs[lang]).map(s => s.ref))]));
  for (const lang of ['en', 'ko']) {
    const other = lang === 'en' ? 'ko' : 'en';
    const removed = new Set();
    const rows = outputs[lang].filter(row => {
      const ref = (row.stats?.[0] ?? row).ref;
      if (refSets[other].has(ref)) return true;
      removed.add(ref);
      report.languages[lang].conflicts.push({ ref, action: 'new-ref-deferred-cross-language-conflict' });
      return false;
    });
    report.languages[lang].added -= removed.size;
    report.generated = report.generated.filter(r => r.lang !== lang || !removed.has(r.ref));
    report.languages[lang].hashCollisions = collisions(rows);
    const finalStats = flatten(rows);
    const finalRefs = new Set(finalStats.map(s => s.ref));
    const finalMatchers = new Set(finalStats.flatMap(s => s.matchers.map(m => m.string)));
    const generatedByRef = new Map(generated.map(c => [c.ref, c]));
    report.areaMods[lang] = {
      before: Object.fromEntries(['yes', 'ubermap_exclusive', 'heist_exclusive'].map(value => [value, flatten(baseline[lang]).filter(s => s.fromAreaMods === value).length])),
      after: Object.fromEntries(['yes', 'ubermap_exclusive', 'heist_exclusive'].map(value => [value, finalStats.filter(s => s.fromAreaMods === value).length])),
      withoutTradeIds: finalStats.filter(s => s.fromAreaMods && !Object.values(s.trade.ids).flat().length).map(s => s.ref),
      missingMatchers: finalStats.filter(s => s.fromAreaMods && !s.matchers.length).map(s => s.ref),
      deferred: report.areaMods.descriptions.filter(d => !d.compiled || !(finalRefs.has(d.ref) || generatedByRef.get(d.ref)?.matchers[lang].some(m => finalMatchers.has(m.string))))
    };
    await mkdir(new URL(`${lang}/`, staging), { recursive: true });
    await save(`${lang}/stats.ndjson`, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
  }
  delete report.englishBaseline;
  report.totalMs = Math.round(performance.now() - start);
  await save('stats-report.json', JSON.stringify(report, null, 2) + '\n');
  const lines = ['# Stats generation report', '', `Elapsed: ${report.totalMs} ms. Sources: ${report.sources.length}.`, '',
    '| Language | Baseline refs | Regenerated | Ratio | Kept | Changed | Added | Baseline only | Nearby→metres | Hash collisions |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|'];
  for (const [lang, r] of Object.entries(report.languages)) lines.push(`| ${lang} | ${r.baselineRefs} | ${r.regenerated} | ${r.regeneratedPercent}% | ${r.kept} | ${r.changed} | ${r.added} | ${r.baselineOnly} | ${r.nearbyToMetres} | ${r.hashCollisions.length} |`);
  lines.push('', 'Regenerated = a source description matched an existing ref, English matcher, or unique stable trade ID; unsupported name/table expansion is excluded. Kept/changed partition baseline refs; baseline-only overlaps kept. Historical wording is retained conservatively for legacy items. New cross-row matcher conflicts are skipped, never silently assigned. See JSON for every decision and complete lists.', '', '## Changed matcher samples (50 per language)');
  for (const [lang, r] of Object.entries(report.languages)) {
    lines.push('', `### ${lang}`);
    for (const c of r.changes.slice(0, 50)) lines.push('', `- ${JSON.stringify(c.ref)} (${c.method})`, `  - old/legacy retained: ${JSON.stringify(c.legacyRetained)}`, `  - source first: ${JSON.stringify(c.added)}`);
    lines.push('', `### ${lang}: conflicts (${r.conflicts.length})`, '', '```json', JSON.stringify(r.conflicts, null, 2), '```', '', `### ${lang}: baseline-only refs`, '', ...r.baselineOnlyRefs.map(ref => `- ${JSON.stringify(ref)}`), '', `### ${lang}: FNV1a collisions`, '', '```json', JSON.stringify(r.hashCollisions, null, 2), '```');
  }
  lines.push('', '## Generated refs (better inferred; requires review)', '', ...report.generated.map(r => `- ${r.lang}: ${JSON.stringify(r.ref)}; better=${r.better}; generated; ${r.source}`), '', '## Unsupported handlers (variant occurrences)', '', '```json', JSON.stringify(report.unsupported, null, 2), '```', '', '## Deferred canonical descriptions', '', '```json', JSON.stringify(report.deferred, null, 2), '```', '', '## Sources', '', ...report.sources.map(s => `- ${s.path}: ${s.descriptions} descriptions; suppressed ${s.suppressed.length}`));
  await save('stats-report.md', lines.join('\n') + '\n');
  console.log(JSON.stringify({ totalMs: report.totalMs, languages: Object.fromEntries(Object.entries(report.languages).map(([lang, r]) => [lang, { ...r, changes: r.changes.length, conflicts: r.conflicts.length, baselineOnlyRefs: undefined }])) }));
  return report;
}

if (fileURLToPath(import.meta.url) === process.argv[1]) await build();
