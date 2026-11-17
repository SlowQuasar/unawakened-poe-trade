import { decompressSliceInBundle, decompressedBundleSize, readIndexBundle, FileLoader } from 'pathofexile-dat/bundles.js';
import { unpackPaths } from '../../node_modules/pathofexile-dat/dist/bundles/index-paths.js';
import { Ggpk } from '../ggpk.mjs';

function inflate(bytes) {
  const raw = new Uint8Array(decompressedBundleSize(bytes));
  decompressSliceInBundle(bytes, 0, raw);
  return raw;
}

// Item, area, atlas, league and advanced descriptions. Skill/monster descriptions
// have different display contexts and must not overwrite item descriptions.
export const FILES = [
  'stat', 'map_stat', 'advanced_mod_stat', 'heist_equipment_stat',
  'expedition_relic_stat', 'sanctum_relic_stat', 'tincture_stat',
  'necropolis_stat', 'graft_stat', 'atlas_stat', 'atlas_relic_stat',
  'atlas_variant_stat', 'leaguestone_stat', 'sentinel_stat', 'legion_stat',
  'harvest_stat', 'primordial_altar_stat', 'vaal_side_area_stat',
  'deepwater_stat', 'deepwater_implicit_stat', 'deepwater_explicit_stat',
  'deepwater_applied_adjacent_stat', 'passive_skill_stat'
].map(name => `metadata/statdescriptions/${name}_descriptions.csd`);

export async function readSources(ggpkPath = 'C:\\Daum Games\\Path of Exile\\Content.ggpk') {
  const ggpk = await Ggpk.open(ggpkPath);
  try {
    const index = readIndexBundle(inflate(await ggpk.fetchFile('_.index.bin')));
    const paths = new Set(unpackPaths(inflate(index.pathRepsBundle)));
    const loader = new FileLoader(ggpk, index);
    const sources = [];
    for (const path of FILES) {
      if (!paths.has(path)) throw new Error(`Missing source ${path}`);
      const bytes = await loader.getFileContents(path);
      const text = new TextDecoder(bytes[0] === 255 && bytes[1] === 254 ? 'utf-16le' : 'utf-8').decode(bytes);
      sources.push({ path, text });
    }
    if (!await ggpk.unchanged()) throw new Error('GGPK metadata changed during read');
    return sources;
  } finally { await ggpk.close(); }
}
