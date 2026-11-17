import { openTables } from '../items/tables.mjs';

// Spawn weights are ordered: the first tag present on the item wins.
export function spawnWeight(weights, tags) {
  return weights.find(([tag]) => tag === 'default' || tags.includes(tag))?.[1] ?? 0;
}

export async function readAreaMods(path) {
  const db = await openTables(path);
  try {
    const mods = await db.table('Mods'), stats = await db.table('Stats'), tags = await db.table('Tags');
    const byStat = new Map(), rows = [];
    for (const mod of mods) {
      if (![1, 2].includes(mod.GenerationType) || ![5, 22].includes(mod.Domain)) continue;
      const weights = mod.SpawnWeight_TagsKeys.map((tag, i) => [tags[tag].Id.trim(), mod.SpawnWeight_Values[i]]);
      const normal = ['low_tier_map', 'mid_tier_map', 'top_tier_map'].some(tag => spawnWeight(weights, [tag]) > 0);
      const uber = spawnWeight(weights, ['uber_tier_map', 'has_uber_map_prefix', 'has_uber_map_suffix']) > 0;
      // Delirium Orbs apply this suffix directly; it deliberately cannot roll.
      const applied = mod.Id === 'MapDeliriumOrb';
      const classification = mod.Domain === 22 ? 'heist_exclusive' : normal || applied ? 'yes' : uber ? 'ubermap_exclusive' : undefined;
      if (!classification) continue;
      const ids = Array.from({ length: 8 }, (_, i) => stats[mod[`StatsKey${i + 1}`]]?.Id).filter(Boolean);
      const row = { id: mod.Id, domain: mod.Domain, generationType: mod.GenerationType, weights, classification, stats: ids };
      rows.push(row);
      for (const id of ids) {
        if (!byStat.has(id)) byStat.set(id, []);
        byStat.get(id).push(row);
      }
    }
    if (!await db.ggpk.unchanged()) throw new Error('GGPK metadata changed during map classification');
    return { byStat, evidence: { schemaSha256: db.schemaSha256, tables: db.evidence, rows } };
  } finally { await db.ggpk.close(); }
}

export function classifyArea(description, byStat) {
  // The same Stats.Id is reused by atlas passives, equipment and adjacent-area
  // descriptions. Only clipboard area contexts describe the mod itself.
  if (!/\/(?:stat|map_stat)_descriptions\.csd$/.test(description.source)) return;
  const rows = [...new Set(description.stats.flatMap(id => byStat.get(id) ?? []))];
  if (!rows.length) return;
  const classes = new Set(rows.map(row => row.classification));
  return { value: classes.has('yes') ? 'yes' : classes.has('ubermap_exclusive') ? 'ubermap_exclusive' : 'heist_exclusive', mods: rows.map(row => row.id) };
}
