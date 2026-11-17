# PHASE 1 — 데이터 원천과 독립 생성기 조사

작성: Codex · 2026-11-17 · 대상: PoE1, en/ko 우선. ✅ 직접 확인한 사실, 🔶 근거가 있는 추정/제안, ❓ 미검증을 구분한다. **원본 생성기가 없으므로 아래의 게임 테이블 → 출력 필드 관계는 추출로 입증한 관계가 아니라 후보 매핑이다.** 확신도는 그 후보 관계에 대한 평가다.

✅ 선행 자료 `docs/analysis/01-architecture.md`, `02-item-parsing.md`, `03-localization.md`, `06-development-roadmap.md`를 읽고 현재 타입·소비 코드·en/ko 실제 데이터를 대조했다. 게임 파일은 읽기 전용으로 열었다. GGPK는 헤더·디렉터리·파일명만 총 **3,106바이트** 읽었으며 파일 본문/인덱스 압축 해제는 하지 않았다. 설치·다운로드·게임/외부 추출기 실행·셸 네트워크·git 명령·서브에이전트·`hc send`는 사용하지 않았다. 임시 Python 표준 라이브러리 조사 스크립트는 `.codex-scratch/phase1_probe.py`에만 두었다. 이 문서 외 제품/분석 파일은 수정하지 않았다.

## 1. 핵심 판단

- ✅ 로컬 로그는 **3.30.0b**, GGPK는 버전 3 컨테이너이며 **`Bundles2/_.index.bin`이 존재**한다. ❓ 실제 `Data/Korean`·영어 기본 테이블 및 `.datc64`는 번들 안을 열지 않아 확인하지 못했다. 따라서 **한 Kakao 설치에서 en/ko를 모두 추출할 수 있다는 결론은 아직 불가**하다(§4).
- 🔶 주 원천은 **클라이언트 테이블·StatDescriptions + 거래소 메타데이터 + 버전 관리하는 앱 보정**의 조합이어야 한다. 거래소 텍스트만으로 `advanced`, 다의성 해소, 변형 판별, `better` 등을 재현할 수 없다(§2–3).
- 🔶 **PoEDB는 교차 검증용**으로 권장한다. en/ko 3.30 콘텐츠를 확인했으나 공개 bulk JSON 계약, robots 내용, 자동 수집 허가는 확인하지 못했다(§6). 거래소 8개 URL 역시 웹 도구로 응답 본문을 확보하지 못했으므로 최신 상태를 단정하지 않는다(§7).

## 2. 현재 ndjson: 실제 레코드와 필드별 원천 매핑

### 2.1 측정 단위와 샘플

✅ 이번 파일 파싱 결과다. 물리 행 수, 그룹을 펼친 개수, 고유 키 수를 구분해야 한다. 앞선 PHASE 0 문서의 고유 키 수와 일치한다.

| 항목 | en | ko |
|---|---:|---:|
| items 물리 JSON 행 | 4,978 | 4,979 |
| 고유 `(namespace, refName)` | 4,962 | 4,962 |
| stats 물리 JSON 행 | 9,178 | 9,162 |
| StatGroup을 펼친 Stat 개수 | 9,278 | 9,278 |
| 고유 `Stat.ref` | 9,198 | 9,198 |
| 그룹 select / trivial / percent / flag | 41 / 43 / 11 / 5 | 44 / 55 / 12 / 5 |

✅ 아이템 고유 키 집합은 en/ko 동일하다. 한국어의 AREA 행이 1개 더 있고, 스탯은 언어마다 동일 텍스트 충돌 방식이 달라 그룹 수가 다르다. 따라서 **행 번호나 행 개수로 언어를 조인하면 안 된다.** 근거: 두 언어 `items.ndjson`·`stats.ndjson` 전체 JSON 집계; 그룹 의미는 `renderer/src/parser/stat-translations.ts:262`.

✅ 다음은 실제 행의 일부 필드다. 표의 행 번호는 각 언어 파일 기준이며 값은 생략 표시 외에는 그대로다.

| namespace | en 행·이름 | ko 행·name | 실제 추가 필드 |
|---|---|---|---|
| AREA | `en/items.ndjson:1` Abyssal Plain | `ko/items.ndjson:1` 심연의 평야 | `tradeDisc:"AbyssalPlain"`, `icon:""`, `area:{}` |
| CAPTURED_BEAST | `en/items.ndjson:165` Acid Slitherer | `ko/items.ndjson:166` 산성 미끄럼뱀 | 공통 BestiaryOrbFull CDN 아이콘 |
| DIVINATION_CARD | `en/items.ndjson:385` A Chilling Wind | `ko/items.ndjson:386` 싸늘한 바람 | `exchangeable:true`, 공통 카드 InventoryIcon |
| GEM | `en/items.ndjson:840` Absolution | `ko/items.ndjson:841` 면죄 | `gem:{maxLevel:20}` |
| ITEM | `en/items.ndjson:1664` Aberrant Fossil | `ko/items.ndjson:1665` 특이한 화석 | `tradeTag:"aberrant-fossil"`, `exchangeable:true` |
| MERCENARY_BUILD | `en/items.ndjson:3656` Bastion | `ko/items.ndjson:3657` 보루 | `mercenaryBuild.skills`의 primary/secondary/utility와 영문 스킬 키 |
| UNIQUE | `en/items.ndjson:3720` Abberath's Hooves | `ko/items.ndjson:3721` 아버라스의 발굽 | `unique:{base:"Goathide Boots",disenchantValue:34.61}` |

위 약식 경로는 모두 `renderer/public/data/` 아래다. 이후 같은 형식을 사용한다.

### 2.2 BaseType 전체 필드

타입의 정확한 계약은 `renderer/src/assets/data/interfaces.ts:61`의 `BaseType`, `:118`의 `MercenaryBuild`다. 테이블명 후보는 [dat-schema 원본](https://github.com/poe-tool-dev/dat-schema/tree/main/dat-schema)과 [공통 스키마](https://raw.githubusercontent.com/poe-tool-dev/dat-schema/main/dat-schema/_Core.gql)를 출발점으로 하되, **선택한 패치 스키마에서 실제 열과 테이블 존재를 다시 검증**해야 한다.

| 필드 | 추정 원천 | 근거 | 확신도 |
|---|---|---|---|
| `name` | BaseItemTypes.Name; 유니크 Words/UniqueStash 계열; 젬 SkillGems/GrantedEffects/ActiveSkills; 영역 WorldAreas; 야수 MonsterVarieties/Bestiary 계열의 언어별 표시명 | ✅ §2.1의 en/ko 쌍, 모든 namespace가 BaseItemTypes 한 테이블로 설명되지 않음 | 🔶 높음(원천 계열), 정확한 조인 ❓ |
| `refName` | 동일 게임 ID의 영어 표시명 + 앱에서 정규화한 키 | ✅ ko에서도 `Absolution`, `Goathide Boots` 같은 영문을 유지 | 🔶 높음; 행 인덱스보다 게임 ID로 언어 조인 권장 |
| `namespace` | ItemClasses·UniqueStash·젬/야수/영역 테이블을 앱 분류로 변환 | ✅ 7종 enum과 샘플, 게임 Id가 아닌 앱 조회 키 (`assets/data/index.ts:83`) | 🔶 높음, 변환 규칙은 수동 정책 |
| `icon` | ItemVisualIdentity/ItemVisuals 등의 아트 경로 + 거래소 이미지 URL, 앱 로컬 이미지·보정 | ✅ CDN, 빈 문자열, 로컬 `/images/maps/blight2.png`, `%NOT_FOUND%` 혼재 | 🔶 높음(혼합), CDN 생성법 ❓; §2.4 |
| `w`, `h` | BaseItemTypes의 인벤토리 폭/높이 | ✅ Aetherwind Gloves en:1678 / ko:1679에 `2,2` | 🔶 높음; 생략 시 기본값 정책 별도 |
| `tradeTag` | 거래소 `/api/trade/data/static`의 exchange entry ID | ✅ fossil의 `aberrant-fossil`; `trade/common.ts:33`, `pathofexile-bulk.ts:124`에서 want ID로 사용 | 🔶 높음, API 실시간 대조 ❓ |
| `exchangeable` | 거래소 교환 가능 목록/필터 + 앱 정책 | ✅ 카드 en:385는 true인데 tradeTag 없음; `create-item-filters.ts:35`에서 두 필드 구분 | 🔶 중간; tradeTag 존재 여부와 동일시 금지 |
| `tradeDisc` | `/items`의 discriminator 또는 `/filters` 옵션 ID; 지도·영역·변형 젬 식별자 | ✅ en:841 `alt_x`, en:1818 `uberblighted`; AREA en:1 `AbyssalPlain`, en:2 `54575`; `create-item-filters.ts:96` | 🔶 높음(역할), 엔드포인트별 조인 ❓ |
| `disc.propAR`, `.propEV`, `.propES` | ArmourTypes 등 방어 속성 + 같은 이름 변형을 구분하는 앱 규칙 | ✅ Two-Toned Boots en:3495–3496, `Parser.ts:304` 변형 선택 | 🔶 높음; 게임 열 그대로 아님 |
| `disc.hasImplicit.ref`, `.hasExplicit.ref` | Mods/Stats/StatDescriptions에서 영문 ref를 생성한 뒤 수동/자동 변형 규칙 | ✅ Two-Stone Ring en:3492 / ko:3493의 Fire and Lightning Resistances; `Parser.ts:329`, `:334` | 🔶 높음(의미); hasExplicit은 현재 en 샘플 검색에서 미발견 ❓ |
| `disc.sectionText`, `.mapTier` | 클립보드 섹션 및 W/Y/R 지도 등급을 이용하는 앱 판별 규칙 | ✅ 타입·소비 코드 `interfaces.ts:84`, `Parser.ts:339`; 현재 en 행에서는 두 필드 미발견 | 🔶 중간; 현재 생성 필요 여부 ❓ |
| `craftable.category` | ItemClasses → 앱 ItemCategory 명시 매핑 | ✅ en:1678 `Gloves`, en:3492 `Ring`, en:1739 `Unique Fragment` | 🔶 높음; `/filters` 분류와 직접 동일하지 않음 |
| `craftable.corrupted`, `.uniqueOnly` | BaseItemTypes/관련 태그 + 예외 목록 | ✅ Breach Ring en:1858 corrupted, Archon Kite Shield Piece en:1739 uniqueOnly | 🔶 중간; 후자는 수동 보정 후보 |
| `unique.base` | UniqueStash/유니크 정의 → BaseItemTypes FK → 영어 refName | ✅ Abberath's Hooves en:3720 / ko:3721에서 모두 `Goathide Boots` | 🔶 높음; 거래소 `/items`의 unique name+type도 교차 검증 후보 |
| `unique.fixedStats` | 유니크 정의·Mods/Stats 조합 중 고정적으로 갖는 스탯의 ref 목록 | ✅ Aul's Uprising en:3788, Watcher's Eye en:4929; 숫자 roll 값이 아닌 ref | 🔶 중간; 실제 선택 기준은 보정 후보 |
| `unique.disenchantValue` | 유니크 분해 관련 게임 값/공식으로 계산한 기준값 + 예외 보정 | ✅ 34.61 등 소수, `Parser.ts:1284`–`:1313`에서 레벨·퀄리티 배수를 곱해 최종 dust 산출 | 🔶 낮음(정확한 테이블/산식 미확정); API만으로 복원 불가 |
| `area.screenshot` | 사람이 관리하는 스크린샷 링크 | ✅ Acid Caverns en:3의 `https://i.imgur.com/vISJftF.jpg` | 🔶 높음, 수동 필드 |
| `area.special`, `.blighted` | WorldAreas/지도 관련 테이블 + 앱 분류 예외 | ✅ Anchorfield en:5 special, Blight-ravaged Map en:1818 blighted | 🔶 중간, 보정 계층 필요 |
| `gem.vaal` | SkillGems/Vaal 관련 관계 | ✅ Vaal Absolution en:1568 | 🔶 높음 |
| `gem.transfigured`, `.normalVariant` | ActiveSkills.TransfigureBase 등 관계 + 앱 기본 젬 refName 연결 | ✅ Absolution of Inspiring en:841; 공통 스키마의 ActiveSkills.TransfigureBase | 🔶 높음, 패치별 열 검증 필요 |
| `gem.maxLevel` | GrantedEffectsPerLevel/젬 경험치·최대 레벨 정책 | ✅ Absolution maxLevel=20. PoEDB에 40레벨 효과가 있다고 40으로 생성하면 안 됨 | 🔶 중간 |
| `armour.ar`, `.ev`, `.es`, `.ward`의 `[min,max]` | ArmourTypes 등 기본 방어 + 기본 방어 편차/반올림 정책 | ✅ en:1678 `es:[28,32]`, en:3496 `ar/ev:[126,145]` | 🔶 높음(계열), 정확한 편차 테이블/산식 ❓ |
| `mercenaryBuild` 문자열 대안 | 다른 빌드 refName을 참조하는 앱 alias | ✅ 타입 `interfaces.ts:115`; 문자열형 실제 사례/원천 미확인 | 🔶 중간, 보정 후보 |
| `mercenaryBuild.skills[].type`, `.name` | Mercenary 빌드/스킬 데이터 + 앱 역할 분류; name은 영문 스킬 키 | ✅ Bastion en:3656 / ko:3657에서 같은 영문 이름·3개 역할 | 🔶 중간; 테이블명·역할 결정 규칙 ❓ |

### 2.3 Stat / StatMatcher / StatGroup 전체 필드

`interfaces.ts:3`–`:54`를 기준으로 한다. **Stat.ref는 Stats.datc64의 내부 Id와 다르다.** 예: 내부 ID 후보 `base_maximum_life`와 달리 이 앱은 영문 표시 템플릿을 키로 쓴다. 거래소 숫자 해시와도 별개다. 유사 텍스트만으로 합치면 local/global·장비 범주·고정값을 잃는다.

| 필드 | 추정 원천 | 근거 | 확신도 |
|---|---|---|---|
| `ref` | 영어 StatDescriptions 또는 거래소 표시 템플릿 + 앱 식별용 접미사 | ✅ en/stats:1702 `(Random Skill Gem)` 접미사, ko에서도 같은 영문 ref | 🔶 높음; 게임 Stats.Id를 바로 출력하면 호환 불가 |
| `dp` | stat description 숫자 변환/정밀도 + 수동 decimal 정책 | ✅ en/ko stats:119 true, `stat-translations.ts:214`에서 소수 처리 플래그에 반영 | 🔶 중간 |
| `matchers[].string` | 언어별 `Metadata/StatDescriptions/*` 조건부 설명 + 거래소 text/option + 보정 | ✅ en/ko stats:16 회복/상실 2개 문구; 숫자 자리 #, 고정 수치·복수형도 별도 매처 | 🔶 높음; 일반 단어 치환으로 번역 생성 금지 |
| `matchers[].advanced` | 고급 설명용 StatDescriptions/스킬·등급 문구 및 보정 | ✅ ko/stats:824 `방어력` 대 `방어`; en:1702 `Absolution(Fireball-Mana-Infused Staff)`; ko:2726 `(등급: 2)` | 🔶 높음(별도 매처 필요), 설명 파일별 연결 ❓ |
| `matchers[].negate` | 설명 조건의 증가/감소·gain/lose 등 부호 변환 | ✅ stats:16 `Lose # Life…` negate=true; `stat-translations.ts`에서 수치 정규화 | 🔶 높음 |
| `matchers[].value` | 조건부 고정값/단복수/100% 설명을 숫자 roll로 환원 | ✅ en:1 `1 Added Passive Skill…` value=1, en:105 무확률 문구 value=100 | 🔶 높음 |
| `better` (-1/0/1) | Stats 관련 의미·description 방향 정보 + 앱별 평가 정책 | ✅ `interfaces.ts:10`, `create-stat-filters.ts:233`, `:278`–`:326`; Action Speed en/ko:464는 ref가 increased지만 기본 매처 reduced, better=-1 | 🔶 높음(앱 의미), 한 게임 열에서 직접 생성 가능하다는 근거 없음 |
| `modFamily` | Mods 관계·스킬/용병 단계·Timeless jewel 변종 + 앱 family 보정 | ✅ Added Chaos en:2728 / ko:2726의 Lesser/일반/Greater; 소비 `filters/pseudo/mercenary.ts:68`, `timeless-jewel.ts:9` | 🔶 중간, 단순 Mods.Group과 일대일 아님 |
| `fromAreaMods` | Mods.Domain·지도/강탈/우버 지도 스탯 분류 + 앱 예외 | ✅ stats:105 `yes`; 타입은 yes/ubermap_exclusive/heist_exclusive; `web/map-check/settings-maps.vue:51` | 🔶 높음(앱 분류), 수동/파생 필드 |
| `anointments[].roll`, `.oils` | 기름 조합/부여 레시피 테이블 + 앱 인코딩 | ✅ en:2959 / ko:2956 roll=50, oils=`13,13`; en:2963 Acrimony oils=`1,10,10` | 🔶 중간; 기름 번호의 기준·정렬은 미확정, 수동/파생 필드 |
| `mercenary.icon`, `.supports` | 스킬 아이콘·지원 가능 관계 + 용병 전용 정책 | ✅ Absolution en:2706 / ko:2704; supports는 영문 키 배열 | 🔶 중간; 정확한 데이터 조인 ❓ |
| `mercenary.tier`, `.canonical`, `.syntheticFamily` | 용병 단계·기본 스킬 관계 + 합성 family 보정 | ✅ Added Chaos en:2728 tier=2/canonical; syntheticFamily는 타입으로 확인 | 🔶 중간, syntheticFamily 생성법 ❓ |
| `jewelleryQuality.catalyst` | Catalyst/퀄리티 태그 데이터 → 촉매 영문 refName | ✅ en:6265 / ko:6252 Abrasive Catalyst | 🔶 높음(역할), 정확한 테이블 조인 ❓ |
| `trade.ids[type][]` | 거래소 `/stats` entry.id, 옵션 ID를 앱 문법으로 결합 | ✅ en:16에 explicit/implicit/fractured 동일 해시; en:2963 `enchant.stat_2954116742` 뒤 파이프와 `25970`; 용병은 pseudo 키 아래 `mercenary.skill_15611`도 존재 | 🔶 높음; 접두사만 복제하거나 해시 계산해 추측하면 안 됨 |
| `trade.inverted` | 거래소 수치 부호와 기본 매처 방향이 다른 경우의 앱 정규화 | ✅ Action Speed en/ko:464 true | 🔶 높음(의미), 수동/파생 |
| `trade.option` | 거래소 옵션형 입력 + 앱 boolean/옵션 변환 정책 | ✅ Has Room: Antechamber en:5137 / ko:5129 true | 🔶 중간; 파이프 옵션 ID와 별개이므로 독립 보존 |
| `StatGroup.stats` | 같은 ref/매처를 공유하는 Stat 후보들 | ✅ ko:1은 서로 다른 영문 ref가 같은 한국어 매처를 공유 | 🔶 높음(앱이 구성) |
| `resolve.strat` | 앱이 정의한 모호성 해결 전략 | ✅ 4개 enum 및 실제 소비 `stat-translations.ts:262` | 🔶 높음, 게임/API 원시 필드 아님 |
| `resolve.test` | select 후보별 ItemCategory 조건 문자열/null fallback | ✅ en/ko:336 `[null,"WEAPON"]`, 정확 범주 우선 후 null (`:268`) | 🔶 높음, 후보 순서 보존 필수 |
| `resolve.kind` | percent/value 또는 flag/value 후보의 의미 라벨 | ✅ percent en:234 / ko:234, flag en:2349 / ko:2347; `:292`–`:316` | 🔶 높음, 수동/파생 |

✅ 해석상 주의점:

1. `advanced`는 `string`에 괄호를 기계적으로 덧붙인 값이 아니다. ko:824처럼 문구 자체가 다르다. `assets/data/index.ts:131`은 둘 다 허용하지만 **인덱스 생성기 `assets/make-index-files.mjs:30`은 advanced가 있으면 advanced만 인덱싱**한다. 출력의 빈 필드·문구 변경을 임의 정리하면 조회 동작이 달라질 수 있다.
2. `select`는 장비 범주로 후보 선택; `trivial-merge`는 현재 modType에 해당하는 거래소 ID를 병합; `percent-merge`는 100% 조건에서 flag/값형을 연결; `flag-merge`는 특정 roll과 일치할 때 flag ID를 연결한다. 병합 시 코드가 `{empty_if_100}`, `{div_by_100}`, `{empty}` 같은 앱 전용 접두사를 붙인다. 이것은 거래소 원래 ID가 아니다(`stat-translations.ts:292`, `:319`).
3. `trade.ids`는 타입당 배열이며 동일 표시문구에도 여러 ID가 가능하다. 옵션은 `ID|option` 형태일 수 있다. 파이프 문자열을 실제 HTTP stat ID로 그대로 내보내는 설계가 아니라 기존 요청 변환을 유지해야 한다. `better`와 `negate`와 `trade.inverted`는 역할이 다르므로 하나로 합치지 않는다.

### 2.4 icon URL 규칙과 수동 보정 경계

✅ fossil en:1664 URL의 `/gen/image/` 다음 URL-safe base64 조각을 표준 라이브러리로 디코딩하면 `[25,14,{"f":"2DItems/Currency/Delve/AbberantFossil","scale":1}]`이다. Gloves en:1678에는 `w`, `h`, `scale`이 들어간다. 경로는 대체로 게임 `Art/` 아래의 `.dds`를 제외한 아트 경로와 대응하며 뒤에 짧은 해시/파일명 `.png`가 붙는다. ❓ 배열 숫자와 해시 산식·패치 호환성은 검증하지 않았다. **게임 경로만으로 유효한 CDN URL 전체를 새로 합성할 수 있다고 주장하지 않는다.** 검증된 API 이미지 URL을 보존하거나 별도 이미지 매핑을 관리하는 편이 낫다.

✅ en 아이템 4,978행 중 HTTPS 4,731, 빈 문자열 또는 `/`로 시작하는 경로 245, `%NOT_FOUND%` 2개다. `/images/maps/blight2.png`는 로컬 예외이고 AREA/용병 빌드는 빈 아이콘이 많다. `%NOT_FOUND%`는 Assembled Eye Jewel(en:1751), Ring(en:2974)에 실제 존재한다. 따라서 모든 아이콘이 CDN이라는 검증 조건은 틀리다. ko의 같은 계열 값도 확인했다.

🔶 보정 파일로 분리할 우선 후보: **better, 그룹 전략/범주 조건, disc 전체, anointments 번호 표현, mercenary family/역할, fromAreaMods 세부 분류, fixedStats 선택, disenchant 산식 예외, area screenshot, 아이콘 예외, exchangeable 정책, client_strings 정규식**. 게임 데이터에서 자동 파생 가능한 부분도 있지만 원래 생성기가 실제 수작업했는지는 ❓이다. 보정마다 이유·원천·적용 버전을 적고, 값이 더 이상 필요한지 생성 시 검사한다.

## 3. TranslationDict / client_strings.js 전체 계약

✅ `renderer/src/assets/data/interfaces.ts:125` 이후의 모든 키를 아래 그룹에 포함했다. 실제 값의 근거는 `renderer/public/data/en/client_strings.js:4`, `ko/client_strings.js:4`부터의 객체다. 이 파일은 JSON이 아니라 **RegExp 리터럴/배열을 포함한 JS 모듈**이다. 출력기를 JSON serializer 하나로 만들면 안 된다. 원문은 ClientStrings·Words·Mods·ItemClasses·StatDescriptions 계열에서 가져올 수 있으나 **원문 키 ID와 아래 앱 키의 일대일 대응은 아직 미확인**이다.

| 필드(같은 접두사는 중괄호로 열거) | 추정 원천 | 근거 | 확신도 |
|---|---|---|---|
| `RARITY_{NORMAL,MAGIC,RARE,UNIQUE,GEM,CURRENCY,DIVCARD,QUEST}`, `RARITY`, `ITEM_CLASS` | ClientStrings/희귀도·ItemClasses 표시 문구 | ✅ en Normal / ko 일반 등, en 파일:4–11, :21–22 | 🔶 높음 |
| `ITEM_LEVEL`, `CORPSE_LEVEL`, `TALISMAN_TIER`, `GEM_LEVEL`, `STACK_SIZE`, `SOCKETS`, `QUALITY`, `MEMORY_STRANDS` | ClientStrings 속성 라벨 | ✅ en 파일:23–30, 파서는 공백/콜론까지 접두사로 비교 | 🔶 높음 |
| `PHYSICAL_DAMAGE`, `ELEMENTAL_DAMAGE`, `CRIT_CHANCE`, `ATTACK_SPEED`, `ARMOUR`, `EVASION`, `ENERGY_SHIELD`, `TAG_WARD`, `BLOCK_CHANCE` | ClientStrings/속성 설명 | ✅ en 파일:31–39 | 🔶 높음 |
| `MAP_TIER`, `MAP_COMPLETION_REWARD` | ClientStrings 포맷 → 앱 캡처 정규식 | ✅ en 파일:12, :20은 RegExp | 🔶 높음(변환 필요), 원문 키 ❓ |
| `MAP_ITEM_QUANTITY`, `MAP_ITEM_RARITY`, `MAP_MONSTER_PACK_SIZE`, `MAP_MORE_MAPS`, `MAP_MORE_SCARABS`, `MAP_MORE_CURRENCY`, `MAP_MORE_DIVINATION_CARDS`, `MAP_AREA`, `CHART_SULPHUR` | 지도 속성 ClientStrings/StatDescriptions | ✅ en 파일:13–19, :130–131 | 🔶 중간~높음 |
| `CORRUPTED`, `UNIDENTIFIED`, `MIRRORED`, `SPLIT`, `FOIL_UNIQUE`, `UNMODIFIABLE`, `CANNOT_USE_ITEM` | ClientStrings 고정 섹션 | ✅ en 파일:40–41, :64, :87–88, :124–125 | 🔶 높음 |
| `ITEM_SUPERIOR`, `MAP_BLIGHTED`, `MAP_BLIGHT_RAVAGED`, `ITEM_SYNTHESISED`, `FOULBORN_NAME`, `VESTIGIAL_NAME` | ClientStrings 아이템명 템플릿 → 앱 정규식 | ✅ en 파일:42–44, :52, :126, :128 | 🔶 높음; 정규식 escaping/캡처 수동 정책 |
| `INFLUENCE_{SHAPER,ELDER,CRUSADER,HUNTER,REDEEMER,WARLORD}`, `SECTION_SYNTHESISED`, `ITEM_EATER`, `ITEM_EXARCH` | ClientStrings 영향력/섹션 문구 | ✅ en 파일:45–51, :104–105 | 🔶 높음 |
| `VEILED_PREFIX`, `VEILED_SUFFIX`, `FLASK_CHARGES`, `METAMORPH_HELP`, `BEAST_HELP`, `VOIDSTONE_HELP`, `METAMORPH_{BRAIN,EYE,LUNG,HEART,LIVER}` | ClientStrings·아이템 설명/이름 패턴 | ✅ en 파일:53–63; FLASK 및 장기는 RegExp | 🔶 중간, 구 콘텐츠 예외 유지 여부 별도 |
| `QUALITY_{ANOMALOUS,DIVERGENT,PHANTASMAL}`, `AREA_LEVEL`, `SENTINEL_CHARGE` | 구 젬 이름 템플릿/ClientStrings | ✅ en 파일:65–68, :112 | 🔶 중간; 데이터에 없다고 파서 키 삭제 금지 |
| `HEIST_WINGS_REVEALED`, `HEIST_BLUEPRINT_{TARGET,ENCHANTS,TRINKETS,GEMS,REPLICAS}`, `HEIST_CONTRACT_JOB`, `HEIST_CONTRACT_TARGET`, `HEIST_TARGET_PRICELESS` | ClientStrings/Heist 목표·직업 데이터 + 캡처 정규식 | ✅ en 파일:69–75, :85–86, job/level 이름 캡처 | 🔶 높음(계열), 정확 테이블 ❓ |
| `HEIST_JOB_{LOCKPICKING,BRUTEFORCE,PERCEPTION,DEMOLITION,COUNTERTHAUMATURGY,TRAPDISARMAMENT,AGILITY,DECEPTION,ENGINEERING}` | Heist 직업 이름/ClientStrings | ✅ en 파일:76–84 | 🔶 높음 |
| `MODIFIER_LINE`, `PREFIX_MODIFIER`, `SUFFIX_MODIFIER`, `CRAFTED_PREFIX`, `CRAFTED_SUFFIX`, `IMPLICIT_MODIFIER`, `FRACTURED_PREFIX`, `FRACTURED_SUFFIX`, `UNSCALABLE_VALUE`, `CORRUPTED_IMPLICIT`, `MODIFIER_INCREASED`, `FOULBORN_MODIFIER`, `VESTIGIAL_IMPLICIT` | ClientStrings 고급 설명 + 앱 정규식 | ✅ en 파일:89–99, :127, :129; `MODIFIER_LINE`은 type/name/tier/rank 캡처 | 🔶 높음, 정규식은 수동 보정 |
| `INCURSION_OPEN`, `INCURSION_OBSTRUCTED`, `EATER_IMPLICIT`, `EXARCH_IMPLICIT`, `ELDRITCH_MOD_R{1,2,3,4,5,6}` | ClientStrings 방/고급 설명/등급 문구 | ✅ en 파일:100–103, :106–111 | 🔶 높음 |
| `{SHAPER,ELDER,CRUSADER,HUNTER,REDEEMER,WARLORD,DELVE,VEILED,INCURSION,ESSENCE,INFAMOUS}_MODS` | Mods.Name/Words의 패밀리별 이름을 앱이 선별 | ✅ en 파일:113–123; 모두 string[] | 🔶 중간; 이름 매핑/누락 검증 필요 |
| `MERCENARY_LEVEL`, `MERCENARY_BUILD` | ClientStrings/용병 표시 문구 | ✅ en 파일:132–133 | 🔶 높음 |
| `CHAT_SYSTEM`, `CHAT_TRADE`, `CHAT_GLOBAL`, `CHAT_PARTY`, `CHAT_GUILD`, `CHAT_WHISPER_TO`, `CHAT_WHISPER_FROM`, `CHAT_WEBTRADE_GEM` | 채팅/거래 귓속말 포맷 + 앱 정규식 | ✅ 파일 끝 8개 RegExp; 길드/이름/body, 젬 level/quality/name 캡처 | 🔶 중간; 실제 로그/클립보드 fixture로 검증해야 함 |

🔶 생성기는 `client-string-keys`에 게임 원문 ID, 전처리(콜론/공백), 정규식 템플릿, 수동 fallback을 선언하고 en/ko에 동일한 키·타입·named capture를 출력하는 방식이 적합하다. ClientStrings 전체를 그대로 복사해 앱 사전으로 쓰는 방식은 불충분하다. ❓ 이 조사에서 각 원문 ID를 추출하지 않았으므로 이 표를 완성된 ID 매핑으로 취급하면 안 된다.

## 4. 로컬 Kakao 클라이언트: 읽기 전용 관측

### 4.1 버전

✅ 설치 경로는 `C:\Daum Games\Path of Exile`, Content.ggpk 크기는 **79,851,505,154바이트**다. Windows FileVersion/ProductVersion 조회에서 `PathOfExile_x64_KG.exe`, `PathOfExile_KG.exe`, `PathOfExile.exe`, `Client.exe`, `PackCheck.exe`의 두 문자열은 비어 있었다. 별도 런처는 POE_Launcher.exe=1.0.19.0, 설치기는 1.0.1.4이나 이를 게임 버전으로 쓰면 안 된다.

✅ `logs/Client.txt`는 없고 `logs/KakaoClient.txt`와 `logs/LatestClient.txt`가 있다. KakaoClient.txt는 끝 350줄만 읽었고, LatestClient.txt(436바이트)는 끝 30줄만 읽었다. **`C:\Daum Games\Path of Exile\logs\LatestClient.txt:4`**:

```text
2026/11/17 21:24:33 … [HTTP2] User agent: PoE release/tags/3.30.0b Windows x64
```

✅ 이는 로그에 기록된 실행 버전이다. ❓ 현재 GGPK의 모든 파일이 완결된 동일 패치인지, 패치가 진행 중인지, 로그가 정확히 어느 바이너리에 대응하는지는 이 관측만으로 입증하지 못한다. 3.29 재현용 입력이라고 간주해서는 안 된다.

### 4.2 GGPK 헤더와 디렉터리

✅ Python `open(...,'rb')`, seek/read, struct만 사용했다. 전체 스캔·본문 읽기·복사 없이 28바이트 헤더 → 루트 PDIR → 루트 자식 이름 → Bundles2의 직계 자식 이름만 읽었다. 한 번의 read 최대 1MiB, 파일 범위·이름 길이·디렉터리 엔트리 수 검사도 넣었다. 형식 근거: [LibGGPK3 GGPKRecord](https://raw.githubusercontent.com/aianlinb/LibGGPK3/main/LibGGPK3/Records/GGPKRecord.cs), [DirectoryRecord](https://raw.githubusercontent.com/aianlinb/LibGGPK3/main/LibGGPK3/Records/DirectoryRecord.cs), [PyPoE ggpk.py](https://raw.githubusercontent.com/OmegaK2/PyPoE/dev/PyPoE/poe/file/ggpk.py). 옛 구현의 헤더 해석을 그대로 믿지 않고 실제 길이/태그/오프셋을 검사했다.

| 항목 | 실제 관측 |
|---|---|
| 헤더 원시 hex | `1c0000004747504b03000000f8fcbd0f04000000f8adfb8f12000000` |
| 길이 / 태그 / 버전 | 28 / GGPK / 3 |
| root PDIR offset / length | 17,443,978,488 / 122 |
| FREE chain offset | 79,725,047,288 (포인터만 읽음; FREE 본문은 읽지 않음) |
| 루트 직계 항목 전부 | `gateway_list.txt`(FILE), `Art`, `Streamline`, `Bundles2`, `FMOD`, `D3D12`(각 PDIR) |
| Bundles2 offset / length / 자식 수 | 58,393,848,830 / 642 / 48 |
| `Bundles2/_.index.bin` | FILE, offset=54,260,554,577, record length=75,396,233 |
| Bundles2 이름 예 | `Tiny_12.bundle.bin`, `Tiny_32.bundle.bin`, `Art.bundle.bin`, `Folders`, `Art`, `ggdh` |
| 이 실행에서 실제 읽은 총량 | **3,106바이트** |

✅ PDIR은 이름 길이·자식 수·hash·UTF-16LE 이름·(32bit namehash, 64bit offset) 목록을 가진다. FILE은 이름과 데이터 본문을 갖지만 이번에는 이름만 읽었다. FREE는 여유 공간 연결 레코드, GGPK는 컨테이너 루트 헤더다. **컨테이너 자체의 디렉터리와 번들 내부 가상 파일 경로는 다르다.** 루트에 `Data/`가 없다는 사실은 테이블이 없다는 뜻이 아니다. [bundle 접근 코드](https://raw.githubusercontent.com/SnosMe/poe-dat-viewer/master/lib/src/bundles/load-util.ts)는 `_.index.bin`을 먼저 압축 해제하여 가상 경로를 찾는다.

❓ 현재 제한(디렉터리 레코드만 읽기, 압축 해제 도구 실행 금지)에서는 `Data/Korean/*.datc64`, 영어 기본 `Data/*.datc64` 또는 `Data/English/*`를 확인할 수 없다. **Kakao이므로 한국어만 있다 / 다국어 도구가 있으므로 영어도 있다**는 양쪽 모두 근거 부족이다. 다음 단계는 추출을 승인받은 작업 범위에서 인덱스만 해제해 후보 경로를 찾고 BaseItemTypes·ClientStrings·Mods 각 언어 소량 행을 같은 내부 ID로 대조하는 것이다. 영어 폴더가 없더라도 영어가 기본 Data 경로인지도 검사해야 한다.

### 4.3 압축 해제 수단

✅ 설치 디렉터리와 하위 디렉터리의 파일명 검색(`*oo*`)에서 oo2core/oodle 이름의 외부 DLL을 발견하지 못했다. 이는 **해당 트리의 파일명 검색 결과**이며 실행 파일에 정적 링크되어 있지 않다는 증거는 아니다. ❓ 실제 압축 codec은 번들 본문을 읽지 않아 확정하지 못했다.

✅ 후보는 [ooz](https://github.com/zao/ooz), [ooz-wasm](https://github.com/SnosMe/ooz-wasm)이다. 전자는 여러 Oodle 계열을 지원하는 C/C++ 코드이며, 후자는 WASM을 base64로 JS에 포함하고 import 때 컴파일한다. `pathofexile-dat`의 [bundle.ts](https://raw.githubusercontent.com/SnosMe/poe-dat-viewer/master/lib/src/bundles/bundle.ts)는 필요한 chunk만 ooz-wasm으로 해제한다. 🔶 로컬 oo2core DLL에 의존하지 않는 WASM 경로를 우선 검토하되, 새 codec/변형까지 처리한다는 보장은 없으므로 작은 데이터에서 해제 크기·해시를 먼저 검증한다. 어떤 DLL/도구도 설치·로드·실행하지 않았다.

## 5. 추출 도구 생태계 (설치·실행 없이 조사)

| 후보 | 확인한 기능·유지 상태 | 라이선스 | Windows/Oodle/공급망 판단 |
|---|---|---|---|
| **SnosMe/poe-dat-viewer, pathofexile-dat** | ✅ README는 PoE1/2 `.datc64` 지원. 현재 package.json 16.0.1, Node>=22, CLI·라이브러리, patch 서버 또는 Steam 경로, translations 선택. ❓ 3.30 Kakao GGPK 직접 호환은 실행 미검증 | ✅ 패키지 MIT. 의존 ooz-wasm은 GPL-3.0이므로 MIT 한 줄로 전체 배포를 설명할 수 없음 | 🔶 TypeScript 생성기에 가장 자연스러움. ooz-wasm(컴파일된 WASM 포함), pathofexile-dat-schema 의존. CLI 예제는 GGPK 설치 경로 직접 지원을 보장하지 않으므로 읽기 전용 GGPK adapter 또는 별도 export 단계 필요 |
| **poe-tool-dev/dat-schema** | ✅ GraphQL 유사 스키마→JSON, FK·localized·게임 validFor 정보. 커밋마다 빌드; release 날짜 대신 schema의 createdAt를 확인하라고 안내. ❓ 선택한 3.29/3.30 열의 완전성·미상 `_` 열 의미는 별도 검증 | ✅ MIT | ✅ 압축/추출기가 아닌 스키마. 런타임 네이티브 불필요. 🔶 latest URL 가변이므로 commit+digest로 고정 |
| **aianlinb/LibGGPK3** (LibBundle3/LibBundledGGPK3 포함) | ✅ PoE1/2 GGPK, 크로스 플랫폼 C# 라이브러리, bundle 계층. ❓ 현 Kakao 3.30 + codec 호환은 미검증 | ✅ 저장소 AGPL-3.0, README 추가 Notice 존재. 🔶 채택 시 해당 조건 검토 | 🔶 Windows C# 사용성 좋음. 읽기/쓰기 기능이 공존하므로 제품에서 편집 API 노출 금지. ✅ SystemExtensions NuGet 및 `Oodle.cs`의 native `oo2core` DllImport 확인. ❓ 출시 바이너리 포함물 전수 검증 못함; "관리 코드만"으로 분류 금지 |
| **OmegaK2/PyPoE** | ✅ README가 개발 중단을 명시, Python 3.7 권장, bundle용 libooz.dll 별도 빌드 지시, UI bundle 미지원. ❓ 3.2x 전체를 최신이라고 볼 근거 없음 | ✅ MIT; libooz는 별도 조건 | 🔶 형식 참고용. Windows Python/네이티브 DLL/구 의존성 부담 때문에 신규 주 생성기의 우선 후보에서 제외 |
| **zao/ooz / SnosMe/ooz-wasm** | ✅ Kraken/Mermaid/Selkie/Leviathan/LZNA/Bitknit 계열 해제; WASM은 SIMD 필요. ❓ 로컬 3.30 번들에서 성공 여부 미검증 | ✅ ooz-wasm GPL-3.0; ooz 계열도 선택 fork/파일 단위 고지 확인 필요 | 🔶 직접 DLL 실행보다 WASM이 운영상 간단하나 공급망 위험이 없는 것은 아님. 소스와 배포 JS/WASM 일치·크기/메모리 상한·고정 버전 검토 |
| **ex-nihil/poe-bundle** | ✅ Rust GGPK/bundle 라이브러리; Cargo 버전 0.2.1, ggpk 1.2.2, libooz와 CMake 빌드 연결. ❓ 최신 3.2x 지원·최근 유지보수 시점은 이번에 확정 못함 | ✅ Cargo에 LGPL-3.0-only | 🔶 네이티브 빌드 체인 필요. Rust를 새로 도입할 이점은 현재 프로젝트에서 작음; 대안 구현/교차 검증 후보 |

근거: [viewer README](https://github.com/SnosMe/poe-dat-viewer), [lib 사용법](https://github.com/SnosMe/poe-dat-viewer/blob/master/lib/README.md), [package.json](https://raw.githubusercontent.com/SnosMe/poe-dat-viewer/master/lib/package.json), [dat-schema](https://github.com/poe-tool-dev/dat-schema), [release 주의사항](https://github.com/poe-tool-dev/dat-schema/releases), [schema LICENSE](https://raw.githubusercontent.com/poe-tool-dev/dat-schema/main/LICENSE), [LibGGPK3](https://github.com/aianlinb/LibGGPK3), [LibBundle3 csproj](https://raw.githubusercontent.com/aianlinb/LibGGPK3/main/LibBundle3/LibBundle3.csproj), [Oodle native 경계](https://raw.githubusercontent.com/aianlinb/LibGGPK3/main/LibBundle3/Oodle.cs), [Oodle native 경계](https://raw.githubusercontent.com/aianlinb/LibGGPK3/main/LibBundle3/Oodle.cs), [PyPoE README](https://github.com/OmegaK2/PyPoE), [PyPoE LICENSE](https://raw.githubusercontent.com/OmegaK2/PyPoE/dev/LICENSE), [ooz-wasm README](https://github.com/SnosMe/ooz-wasm), [Rust Cargo](https://raw.githubusercontent.com/ex-nihil/poe-bundle/master/Cargo.toml).

🔶 권장: **TypeScript + pathofexile-dat를 먼저 작은 PoC로 평가**, GGPK 읽기는 제한된 adapter로 분리한다. 이는 upstream 앱을 추종한다는 뜻이 아니라 범용 파일 포맷 라이브러리를 고정 버전으로 사용하는 선택이다. npm 버전의 최신성만으로 3.30 지원을 판정하지 말고, 테이블 길이/FK/번역 fixture 통과를 수락 기준으로 삼는다. 설치 시점에는 transitive dependency·WASM/native 파일·install scripts까지 검토하고 lockfile과 무결성을 고정한다. 이번 조사에서는 패키지를 받지 않아 실제 npm tarball 구성은 ❓이다.

## 6. PoEDB (poedb.tw)

✅ 2026-11-17 웹 도구로 [영문 홈](https://poedb.tw/us/)과 [한국어 홈](https://poedb.tw/kr/)을 열었다. 둘 다 3.30을 표시하며 신규 아이템·고유·젬 링크가 있다. 언어 prefix는 **en/ko가 아니라 us/kr**, 개별 페이지는 공백을 밑줄로 바꾼 영어 slug를 공유하는 사례를 확인했다.

| 확인 항목 | 관측 및 한계 |
|---|---|
| 신규 젬 | ✅ [Fireball of Radiation](https://poedb.tw/us/Fireball_of_Radiation): 효과·레벨 표·내부 Id/Metadata·3.30 추가 이력 제공. 게임 최대 젬 레벨과 효과 표의 최대 행은 구분 필요 |
| 신규 고유/한국어 | ✅ [Hide of the Vendigo 한국어](https://poedb.tw/kr/Hide_of_the_Vendigo): 벤디고의 가죽·베이스명·옵션·모드 데이터 제공 |
| 범위 | ✅ 홈에서 3.30 일반 아이템/고유/젬·한국어 이름 목록 확인. 🔶 수치/원문·내부 키·모드 대조에 유용. ❓ 모든 거래 가능한 항목·고급 복사 문구·영구 리그 구형 변형의 완전성은 미검증 |
| 제공 형식 | ✅ 열린 문서는 HTML 페이지와 표다. ❓ 공식 공개 bulk JSON/버전 고정 export/API 계약은 찾지 못함; HTML 내부 데이터가 있다고 안정 API라고 간주하지 않음 |
| robots.txt | ❓ `https://poedb.tw/robots.txt`를 웹 도구로 열었으나 접근 불가. HTTP 재시도도 같은 결과. **Disallow/Allow 내용을 확보하지 못함** |
| 약관/수집 허가 | ❓ 홈에서 Terms 문구를 찾지 못했고 명확한 자동 수집 허용문·재배포 라이선스를 확보하지 못함. 공개 열람 가능/robots 미확인=대량 수집 허가가 아님 |

🔶 판단: **교차 검증용**. 신규 이름·한국어 매핑·수치/태그가 생성 결과와 어긋났을 때 사람이 확인하는 용도에 적합하다. 주 원천으로 쓰면 HTML 변경·버전 혼합·누락·접근 정책에 생성기가 종속된다. 자동 수집이 필요해지는 경우에는 먼저 운영자가 제공하는 허용된 export/접근 조건을 확인한다. 이번에는 몇 페이지 열람만 했고 크롤러는 만들거나 실행하지 않았다.

## 7. 공식 거래소 데이터 API

### 7.1 URL별 확인 상태와 기대 용도

✅ 아래 **8개 URL을 모두 웹 도구로 열어 보았으나 모두 접근 불가** 결과였고 응답 JSON/HTTP 헤더를 얻지 못했다. 이것을 HTTP 403/429, 서비스 종료 또는 Kakao 장애로 해석할 수는 없다. 셸 네트워크로 우회하지 않았다.

| 국제 URL | Kakao 대응 URL | 생성기에서의 용도(추정) |
|---|---|---|
| [stats](https://www.pathofexile.com/api/trade/data/stats) | [stats](https://poe.kakaogames.com/api/trade/data/stats) | 🔶 result 그룹·entries의 id/text/type, 선택형 option. 게임 템플릿과 거래소 ID 연결 |
| [items](https://www.pathofexile.com/api/trade/data/items) | [items](https://poe.kakaogames.com/api/trade/data/items) | 🔶 그룹별 name/type/text/flags 및 변형 discriminator; 거래 가능한 표시명·유니크 base 대조 |
| [static](https://www.pathofexile.com/api/trade/data/static) | [static](https://poe.kakaogames.com/api/trade/data/static) | 🔶 그룹별 id/text/image; bulk tradeTag·이미지 매핑 |
| [filters](https://www.pathofexile.com/api/trade/data/filters) | [filters](https://poe.kakaogames.com/api/trade/data/filters) | 🔶 필터 그룹·입력·option id/text로 카테고리·지도/영역 옵션 대조; 정확 현재 스키마 ❓ |

✅ 형식 참고로 [PoEDB 운영자 계열의 공개 OpenAPI 예제](https://raw.githubusercontent.com/Chuanhsing/poe-api/master/poe.yaml)는 stats/items/static의 JSON result/entries 구조를 기술한다. 이는 **그 프로젝트가 기술한 과거 예제**이며 GGG가 보장한 현재 API 계약은 아니다. filters의 최신 구조 및 discriminator는 이 예제와 이번 응답으로 입증하지 못했으므로 위 표는 생성기 입력 adapter의 확인 대상이다. 실제 앱의 한국어 호스트 선택은 `renderer/src/web/Config.ts:86`, `main/src/proxy.ts:9`로 확인했다.

### 7.2 언어·패치·운영 조건

- ✅ 기존 en/ko 데이터는 영문 ref/같은 거래 ID를 공유하면서 매처와 name을 번역한다(§2). 🔶 국제 호스트는 영어, Kakao는 한국어 메타데이터를 기대하지만 **현재 3.30 응답 언어·ID 집합 동일성은 미검증**이다. 텍스트만으로 언어를 조인하지 말고 entry.id/option.id로 연결하고 누락을 보고한다.
- ❓ 이들 URL에는 조사 대상 경로상 패치 버전 매개변수가 없다. **3.30 반영 시각/SLA·국제와 Kakao 동기화 시간은 확인하지 못했다.** 클라이언트 로그가 3.30.0b이고 PoEDB가 3.30이라는 사실로 API 갱신을 추론하면 안 된다. 향후 snapshot에 URL, UTC 취득 시각, Content-Type, ETag/Last-Modified(있을 때), 상태, 본문 SHA-256, 클라이언트 패치·스키마 commit을 기록한다.
- ✅ [GGG 공식 개발자 문서](https://www.pathofexile.com/developer/docs)는 rate limit이 동적으로 바뀌며 `X-Rate-Limit-Rules`, 각 rule의 limit/state, `Retry-After`를 따르도록 한다. **이 8개 endpoint의 고정 허용 수치는 이번에 확인하지 못했다.** 기존 앱 `trade/common.ts:36`의 1회/5초는 클라이언트 초기값이지 서버 보장치가 아니다.
- ✅ 같은 문서는 식별 가능한 `User-Agent: OAuth {clientId}/{version} (contact: {contact}) ...` 형식을 요구한다. 🔶 향후 수집기는 자신의 정체성과 실제 연락처를 쓰고 로컬 cache·요청 직렬화·429 대기·403 중단을 적용한다. ❓ 이 비공개 웹 메타데이터 경로에 적용되는 별도 UA/OAuth 예외는 확인하지 못했다. 다른 앱 clientId를 사칭하면 안 된다.
- ✅ 공식 문서는 지원 대상을 문서화된 API/Data Exports로 한정하고 문서 밖 내부 웹 API를 별도로 다룬다([Available Resources](https://www.pathofexile.com/developer/docs#available-resources)). **"공식 거래소 호스트에서 제공"과 "공식 개발자 지원 계약"을 구분해야 한다.** 🔶 생성기 adapter에는 접근 실패 시 과거 snapshot으로 명시적으로 작업하거나 중단하도록 하고, 최신 데이터인 척 fallback하지 않는다.

## 8. 생성기 설계 초안

### 8.1 구현 언어·위치

🔶 **`tools/data-generator/`의 TypeScript CLI**를 권장한다. 기존 타입·JS RegExp serializer·pathofexile-dat를 공유하기 쉽다. Python은 이번처럼 표준 라이브러리로 GGPK 디렉터리 확인/JSON diff를 하는 보조 도구로 적합하지만, 새 생성기의 압축 해제/스키마 체인을 PyPoE에 의존시키는 것은 피한다.

```text
패치 고정 클라이언트(읽기 전용) ─ GGPK adapter ─ bundle/chunk reader ─ dat/text decoder
en/ko 거래소 메타데이터 snapshot ─ JSON input adapter ───────────────────────┐
수동 보정(JSON) + 문자열/정규식 템플릿 + 스키마 고정 정보 ────────────────────┤
                                                  정규화 IR → 조인/그룹 → 검증 → 출력
```

🔶 제안 디렉터리: `src/{ggpk,bundles,tables,translations,trade,normalize,emit,validate}/`, `overrides/`, `fixtures/`, `manifests/`. 대용량 원본과 cache는 저장소 밖 별도 출력 경로를 설정하고 게임 디렉터리에는 쓰지 않는다. 패키지/스키마 commit/digest/patch를 manifest로 잠근다.

### 8.2 단계별 파이프라인

1. 🔶 **입력 봉인**: client patch 확인, 동일 파일 변경 여부 감지, schema 버전·게임 구분(PoE1)·언어 목록 고정. 모든 입력 snapshot의 digest와 라이선스/출처를 기록한다. 온라인 수집과 오프라인 재현 명령을 분리한다.
2. 🔶 **선택 읽기**: GGPK 인덱스/번들 목록만 파싱하고 필요한 chunk만 읽는다. `Data` 영어 기본 경로와 `Data/Korean` 존재를 먼저 증명한다. 최초 범위는 BaseItemTypes, ItemClasses, Words, UniqueStash 계열, ItemVisualIdentity, Mods, Stats, ClientStrings, SkillGems/GrantedEffects/레벨, WorldAreas 및 필요한 description 파일. 테이블 명칭은 고정 스키마에 있는 이름으로 확정한다. 번들/가변 데이터 크기와 FK 범위를 검증한다.
3. 🔶 **공통 IR 생성**: 게임 내부 문자열 ID/복합 ID를 기준으로 원형을 보존하고 언어별 텍스트를 별도 붙인다. ref/refName은 앱 호환 영문 키로 도출한다. 재정렬되는 테이블 행 번호를 영구 키로 쓰지 않는다. 원천 테이블·행 ID·변환 규칙은 별도 provenance에 남긴다.
4. 🔶 **StatDescriptions 컴파일**: 숫자 자리·고정값 조건·단복수·부호/정밀도·다중 stat 설명·언어별 줄바꿈·고급 설명을 표현한다. 옵션형/앱 pseudo는 거래소 snapshot·보정으로 보완한다. 현재 파서의 정규화와 동일한 매처를 생성한다.
5. 🔶 **거래소 조인**: 영문/번역 텍스트 + type/option/장비 범주를 함께 사용하고 1:N을 보존한다. tradeTag/discriminator/image를 결합한다. 의미가 모호한 조인을 자동으로 확정하지 않고 수동 검토 목록으로 출력한다. `stat_숫자`는 게임 Stats ID에서 해시 계산해 새로 만들지 않는다.
6. 🔶 **앱 의미 보정**: better, disc, family, oils, 용병, 분해값 등을 적용한다. 보정에 출처·이유·도입/만료 패치를 강제한다. 언어별 충돌로 StatGroup을 구성하며 기존 select/test와 kind 순서를 보존한다.
7. 🔶 **출력**: en/ko `items.ndjson`, `stats.ndjson`, `client_strings.js`. 기존 프로퍼티/행 정렬·생략 규칙·유니크/동명 변형의 인접 배치·LF·마지막 개행을 보존한다. 문자열 정규화로 한국어 띄어쓰기/부호/괄호/개행을 바꾸지 않는다. 새로운 index 생성기를 만들지 않고 기존 빌드 단계와 연결한다(이번 조사에서 빌드 실행은 하지 않음).
8. 🔶 **검증 후 교체**: 우선 staging 경로에 생성하고 아래 차이 보고서를 리뷰한 뒤 제품 파일을 갱신한다. 원본이 없는 필드를 묵시적 빈 값으로 채우지 않는다.

### 8.3 첫 수락 기준: 현재 3.29 ndjson 재현

✅ **로컬 클라이언트는 3.30.0b 기록이므로 3.29 데이터 재현의 동일 버전 입력이 아니다.** ❓ 3.29 클라이언트/description·스키마·거래소 snapshot을 확보할 수 있는지는 아직 확인 못했다. 현재 저장소 파일은 기대 출력이며 원천 대용으로 읽어 그대로 내보내는 것을 재현 성공으로 계산해서는 안 된다.

🔶 검증 순서와 완료 기준:

- **고정 기준선**: 현재 en/ko 6개 산출물을 해시로 봉인하고 §2.1 수치를 검증한다. 확보한 3.29 입력으로 실행한다. 입력을 구하지 못하면 "3.30 후보 vs 3.29 기준선 비교"로 분리하고 재현 통과라고 기록하지 않는다.
- **구조/참조**: JSON 전 행 파싱, 필수 타입, enum, 배열 순서, 영문 키·번역명/매처 충돌, unique.base/normalVariant/fixedStats/mercenary 참조, 유효 option 형식, 이미지 예외 검사. 고유 키 수만 같다는 이유로 합격하지 않는다.
- **정확 diff**: 먼저 byte diff=0을 목표로 하고, 실패 시 정렬/직렬화만 다른 경우와 의미 차이를 구분한다. 각 차이는 원천·패치·수동 보정 누락·버그 중 원인을 제시한다. 설명 없는 삭제/새 ID/그룹 변경은 0건이어야 한다. 고유 key만 비교하면 동명 variant와 같은 ref의 다른 trade.ids를 놓치므로 레코드 multiset·그룹도 비교한다.
- **클라이언트 문자열**: 객체 키·값·RegExp source/flags·named captures·배열을 비교한다. 언어별 공백/이스케이프와 타입 차이도 보고한다.
- **소비자 검증**: 기존 `make-index-files.mjs` 산출물을 staging에서 만들고 `init()` 지연 참조 검증 및 실제 lookup을 검사한다. 한글은 JS 문자열 UTF-16 위치와 UTF-8 바이트 위치가 다르므로 인덱스 오프셋을 별도 구현하지 않는다. 마지막 개행 누락은 `assets/data/index.ts:43`의 순회에 문제를 만들 수 있어 필수 검사한다.
- **의미 fixture**: ko 실제 샘플 3건 + 영어 쌍, 증가/감소/고정100/소수/고급 매처, 4개 그룹 전략, Two-Stone/Two-Toned 변형, 변형 젬·유니크·지도·용병·교환 항목을 검사한다. ID/option·부호·검색 방향까지 맞아야 한다. 테스트 하네스 구현은 별도 PHASE 2 범위다.

## 9. 리드가 결정해야 할 사항

1. 🔶 TypeScript/pathofexile-dat + 별도 읽기 전용 GGPK adapter를 우선 PoC로 채택할지, LibGGPK3 별도 exporter를 둘지. 의존 WASM/native·라이선스 조건을 포함해 결정한다.
2. ❓ 다음 작업에서 번들 인덱스/필요 테이블 압축 해제를 수행할 범위와, **한 Kakao 클라이언트에서 en/ko 동시 확보 가능 여부를 입증할 최소 실험**을 확정한다. 불가능하면 영어 클라이언트/허용된 패치 export를 별도 입력으로 확보해야 한다.
3. ❓ 3.29 재현에 필요한 과거 클라이언트·description·거래소 snapshot을 확보할지, 확보 불가 시 어떤 차이를 설명 가능한 차이로 수용할지. 3.30 입력으로 diff 0을 강제하지 않는다.
4. 🔶 수동 보정의 초기 범위(특히 better/그룹/disc/용병/oils/disenchant)를 확정하고 필드별 미확정 조인·산식 담당을 지정한다.
5. ❓ 거래소 메타데이터의 허용된 접근·snapshot 확보 경로와 en/ko 동기화 검증을 정한다. 이 조사에서 실패한 웹 조회를 현재 API 미지원 판정으로 사용하지 않는다.
6. 🔶 PoEDB는 교차 검증용으로 채택하고 자동 bulk 수집은 robots·운영 조건·제공 export를 확인한 뒤 판단한다.
