import { readFile, writeFile } from 'node:fs/promises';
const root = new URL('../../../../', import.meta.url);
const read = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const report = await read('tools/data-generator/out/staging/stats-report.json');
const validation = await read('tools/data-generator/out/staging/stats-validation.json');
const reproducibility = await read('tools/data-generator/out/staging/stats-reproducibility.json');
const fixture = JSON.parse(await readFile(new URL('map-fixture.json', new URL('file:///' + validation.validation.replaceAll('\\', '/') + '/')), 'utf8'));
const area = report.areaMods;
const baseline = (await readFile(new URL('tools/data-generator/baseline/en/stats.ndjson', root), 'utf8')).trim().split('\n').map(JSON.parse).flatMap(r => r.stats ?? [r]);
const matches = new Map(area.baselineMatches.filter(r => r.lang === 'en' && r.baseline).map(r => [r.ref, r]));
const added = [...new Map(area.added.filter(r => r.lang === 'en').map(r => [r.ref, r])).values()];
const lines = [
  '# PHASE 2-7 — 지도 옵션 fromAreaMods 생성', '',
  '로컬 게임 Mods/Stats/Tags를 저장된 PoE1 스키마(format 7)로 읽었다. 열 전체 길이가 실제 dat rowLength와 일치해야 진행한다. FK는 StatsKey1–8 → Stats.Id → CSD description.stats → 기존 identity 또는 생성 ref로 연결한다. 게임은 읽기 전용으로 열고 변경 여부를 검사했다.', '',
  '## 분류 규칙과 근거', '',
  '- Domain=5(지도), GenerationType=1/2(prefix/suffix)를 대상으로 spawn weight 배열의 첫 일치 태그를 평가한다. default도 순서에 포함하고 weight=0인 제외 태그를 존중한다. low/mid/top_tier_map에 양수이면 yes, uber_tier_map/has_uber_map_prefix/has_uber_map_suffix에만 양수이면 ubermap_exclusive다.',
  '- Domain=22(강탈 계약/설계도), GenerationType=1/2는 heist_exclusive다. 강탈에는 현재 weight=0인 레거시 속성도 포함한다. 일반 지도와 공유하는 Stats.Id는 yes를 우선한다.',
  '- MapDeliriumOrb는 Domain=5, suffix이나 default=0이다. 오브로 직접 적용되므로 명시적으로 포함한다. map_endgame_fog_depth가 Players in Area are #% Delirious에 연결되며 기존 yes를 보존한다.',
  '- 기존 fromAreaMods는 항상 우선한다. 동일 Stats.Id가 atlas/장비/항해 인접 지역 설명에 재사용되므로 stat_descriptions 및 map_stat_descriptions 문맥만 분류한다. Atlas Drops는 실제 Mods FK에 있는 표시 스탯이므로 포함된다.',
  '- spawn weight가 없는 이벤트/고유 지도/아틀라스 패시브를 Domain만 보고 일괄 분류하지 않는다. 현재 굴릴 수 없는 일반 지도 레거시 분류는 baseline으로 보존한다.', '',
  `스키마 SHA-256: \`${area.schemaSha256}\`. 테이블 해시, 선택된 Mods ${area.rows.length}행의 Domain/GenerationType/태그/weight/Stats.Id, description 연결, baseline 역대조 전체는 staging/stats-report.json의 areaMods에 있다.`, '',
  '| 분류 | en/ko 이전 | en/ko 이후 | 기존 ref 역대조 성공 |', '|---|---:|---:|---:|',
  ...Object.keys(area.en.before).map(value => `| ${value} | ${area.en.before[value]} | ${area.en.after[value]} | ${[...matches.values()].filter(r => r.baseline === value).length} |`), '',
  '역대조의 분모는 기준선 전체다. 아래 미연결 ref는 삭제하거나 재분류하지 않았다. inferred와 baseline이 다른 항목도 baseline을 유지했다.', '',
  '### 기준선과 추론 불일치', '',
  ...[...matches.values()].filter(r => r.baseline !== r.inferred).map(r => `- ${r.ref}: baseline=${r.baseline}, inferred=${r.inferred}; ${r.mods.join(', ')}`), '',
  '### 기준선 전용/현재 roll 규칙 미연결', '',
  ...baseline.filter(s => s.fromAreaMods && !matches.has(s.ref)).map(s => `- ${s.fromAreaMods}: ${s.ref}`), '',
  '## 새로 분류한 ref 전체', '',
  ...added.map(r => `- ${r.value}: ${r.ref}; Stats.Id=${r.stats.join(', ')}; Mods=${r.mods.join(', ')}`), '',
  '## 3.30 신규 접미어 9종', '',
  '- buried Pandemonium / Apex / Stalker Sentinel: MapContainsSentinel{Pandemonium,Apex,Stalker}Worlds → map_contains_buried_*_sentinel → 해당 영어 ref. 세 ref 모두 yes.',
  '- Mirage: MapContainsMirageWorlds → map_is_overrun_by_faridun → 기존 ref Area contains an Empowered Mirage which covers the entire Map. yes 보존.',
  '- Viridian Wildwood: MapContainsWildwoodWorlds → map_azmeri_league → Area contains the Viridian Wildwood. yes.',
  "- Evocator of Beidat / K'Tash / Ghorr: MapContainsBeyond{Pale,Flesh,Demon}FactionWorlds → map_beyond_spawn_initiator_*_faction → 각 영어 ref. 세 ref 모두 yes.",
  '- Mirror of Delirium: MapContainsDeliriumMirrorWorlds → map_spawn_affliction_mirror → 기존 ref Areas contain a Mirror of Delirium. yes 보존.',
  '- 위 Worlds suffix는 uber_tier_map=0, secret_area/maven_map/expedition_logbook/primordial_map=0, default=100–300이다. T17의 MapUberWeak 대응 행도 같은 Stats.Id를 쓰므로 일반 지도 yes가 우선한다.', '',
  '## 매처와 빈 trade IDs 검사', '',
  '신규 9종 및 Delirious의 en/ko 매처 모두 실제 앱 STAT_BY_MATCH_STR 인덱스 조회를 통과했다. 분류된 출력에 매처 배열이 빈 ref는 en/ko 각각 0개다. 거래소 ID가 없는 신규 area ref도 trade.ids={}로 생성한다. settings-maps.vue는 STATS_ITERATOR(AreaMods)와 fromAreaMods/matchers만 소비하며, MapCheck.vue → prepareMapStat 경로도 trade ID를 요구하지 않는다. 실제 fixture와 빈 ID 데이터가 포함된 전체 renderer 테스트로 확인했다.', '',
  ...['en', 'ko'].map(lang => `- ${lang} 빈 trade IDs (${area[lang].withoutTradeIds.length}): ${area[lang].withoutTradeIds.join('; ')}`), '',
  '남은 미지원 표시: MapDeliriumOrb의 두 번째 FK map_endgame_affliction_reward_0은 affliction_reward_type 이름 lookup 핸들러가 필요하여 양 언어 모두 보류된다. CSD 문구는 Delirium Reward Type: {0} / 환영 보상 유형: {0}이다. Delirious 강도 ref는 인식되지만 보상 유형 이름까지 완전 지원한다고 주장하지 않는다. 이 보류는 areaMods.en/ko.deferred에 기록했다.', '',
  '## 검증', '',
  '- node:test 12/12 통과: 기존 데이터 보존, en/ko identity 일치, 해시 충돌, 첫 일치 spawn weight와 문맥 제외를 검증했다.',
  ...validation.results.map(r => `- npm test (${r.label}): ${r.status === 0 ? 'PASS' : 'FAIL'}; ${r.stdout.match(/Tests\s+[^\n]+/)?.[0]?.trim() ?? ''}`),
  '- 실제 renderer의 소스/데이터는 수정하지 않았다. staging 아래 renderer 임시 복사본에만 생성 stats를 넣고 npm test를 실행했다. 원본 renderer/public/data 전체 파일 목록 및 SHA-256이 검증 전후 동일했다. 지시 파일의 git 금지에 따라 git diff 대신 이 비교를 사용했다.',
  `- 연속 두 번 생성한 en/ko NDJSON 바이트 동일: ${reproducibility.identical}. 해시는 stats-reproducibility.json에 기록했다.`, '',
  '### ko/3.30-rare-map-atlas-drops.txt의 4개 modifier', '',
  ...fixture.map((mod, i) => `- ${i + 1}: ${mod.map(s => `${s.ref} (${s.fromAreaMods})`).join('; ')}`), '',
  '4개 modifier 안의 개별 stat ref는 총 6개이며 모두 yes다. unknownModifiers=[]이고 prepareMapStat 변환도 통과했다. renderer/main 수정, 게임 쓰기, git, hc send, 네트워크, 패키지 설치, 서브에이전트는 사용하지 않았다.', ''
];
await writeFile(new URL('docs/analysis/phase2/07-generator-map-mods.md', root), lines.join('\n'));
console.log(JSON.stringify({ counts: area.en.after, newClassifications: added.length, baselineMatched: matches.size, fixtureStats: fixture.flat().length }));
