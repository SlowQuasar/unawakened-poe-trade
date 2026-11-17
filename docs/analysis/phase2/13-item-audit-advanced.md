# 고급 복사 형식 장비·젬 등 24유형 재점검

478건 모두 고급 형식 재구성 입력으로 파싱·요청 생성에 성공했다. unknown은 **1 → 0줄**, 인식 ID 불일치는 **0 → 0건**, API ID 누락은 **116 → 115건**이다. 잔여 115건은 탐험 일지 지역 옵션 93건과 균사체 핵의 별도 API 해시 22건이다. 이를 전체 옵션 검색 성공으로 해석하지 않는다.

## 입력과 측정

- tools/data-generator/out/item-listings의 24개 비어 있지 않은 유형 전체: 23×20 + socketed-support-effect 18 = 478건. idol은 0건이다. 검색 total은 표본 수가 아니다.
- 이전 12 보고서의 일반 형식 API ID 누락 1,835건은 이번 기준선이 아니다. 3.29부터 Ctrl+C가 고급 형식이라는 Shortcuts.ts 주석과 리드 결정을 따른다. 이번 before/after는 같은 고급 재구성기와 보정된 ID 비교 규칙에서 데이터 수정 전후를 측정했다.
- parseClipboard의 성공·category, unknownModifiers 원문, statsByType의 타입별 거래 ID와 extended.hashes 양방향 차집합, createPresets의 active 프리셋 → createTradeRequest 예외를 기록했다. 매물별 발생 수이며 전역 고유 ID 수가 아니다.
- 후보 ID가 하나라도 API와 겹치면 인식 오류가 아니다. {empty_if_100}, {div_by_100}, {empty} 같은 값 변환 접두사는 거래 ID가 아니므로 비교할 때 제거한다. 제품 요청 생성기는 그대로 둔다. 즉시 회복 3건의 조건부 별칭을 오류로 세지 않는다.
- 초기 재구성 조사에서 발견한 제작 옵션 오분류 1건은 재구성기 문제였다. explicitMods 안에도 domain=crafted, flags.crafted가 있으므로 이를 반영했다. 제품 파서 오류로 보고하지 않는다. 조사 단계의 4건(별칭 3 + 제작 분류 1)을 수정 전 제품 오류로 집계하지 않았다.
- 기본 검색 옵션: league=Covens, merchantOnly=false, currency=null, collapseListings=app, activateStockFilter=false, useEn=true, searchStatRange=0. 네트워크 요청은 보내지 않았다.
- [수정 전 매물별 결과](13-item-audit-advanced-before.json), [최종 결과](13-item-audit-advanced-details.json). index는 원본 파일의 0부터 시작하는 인덱스다. 각 결과에 category/unknown/mismatched/missing/enabled 및 파싱·요청 오류를 보존했다.

## 수정 전후

| 유형 | 입력 | 파싱 성공 전→후 | unknown 줄 전→후 | 인식 ID 오류 전→후 | API ID 누락 전→후 | 요청 예외 전→후 |
|---|---:|---:|---:|---:|---:|---:|
| abyss-jewel | 20 | 20 → 20 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 |
| cluster-jewel | 20 | 20 → 20 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 |
| corrupted-implicit-rare | 20 | 20 → 20 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 |
| gem-active | 20 | 20 → 20 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 |
| gem-support | 20 | 20 → 20 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 |
| heist-contract | 20 | 20 → 20 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 |
| logbook | 20 | 20 → 20 | 0 → 0 | 0 → 0 | 93 → 93 | 0 → 0 |
| magic-flask | 20 | 20 → 20 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 |
| mycelium-core | 20 | 20 → 20 | 0 → 0 | 0 → 0 | 19 → 19 | 0 → 0 |
| rare-accessory | 20 | 20 → 20 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 |
| rare-armour | 20 | 20 → 20 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 |
| rare-jewel | 20 | 20 → 20 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 |
| rare-weapon | 20 | 20 → 20 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 |
| sanctum-relic | 20 | 20 → 20 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 |
| socketed-support-effect | 18 | 18 → 18 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 |
| tincture | 20 | 20 → 20 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 |
| unique-accessory | 20 | 20 → 20 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 |
| unique-armour-corrupted | 20 | 20 → 20 | 1 → 0 | 0 → 0 | 1 → 0 | 0 → 0 |
| unique-armour | 20 | 20 → 20 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 |
| unique-flask | 20 | 20 → 20 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 |
| unique-jewel | 20 | 20 → 20 | 0 → 0 | 0 → 0 | 3 → 3 | 0 → 0 |
| unique-weapon-corrupted | 20 | 20 → 20 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 |
| unique-weapon | 20 | 20 → 20 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 |
| viscera | 20 | 20 → 20 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 |
| 합계 | 478 | 478 → 478 | 1 → 0 | 0 → 0 | 116 → 115 | 0 → 0 |

## 재구성기

renderer/test/helpers/listing-to-clipboard.ts에 itemListingToClipboard와 ordinaryClipboard를 추가했다. 기존 지도 헬퍼와 지도 CI는 유지한다.

- 화염의 망토, 레어 목걸이, 성운, 미확인 타락 양손 철퇴, 살덩이, 카옴의 실제 한국어 고급 fixture를 읽고 이름판·기본 속성·요구사항·홈·아이템 레벨·정보줄 형식을 대조했다. 실제 fixture 파서 회귀도 기본 테스트에 포함된다.
- extended.text를 base64→UTF-8로 읽고 CRLF를 정규화하며 마지막 메모 섹션을 제거한다. 이름판·속성·요구사항·홈·아이템 레벨·도움말·타락/미확인 상태 등은 원문을 보존한다. 표시 마크업과 U+200B는 옵션 매칭과 재구성 시 제거한다.
- implicitMods/explicitMods/craftedMods/fracturedMods/enchantMods의 description을 원문의 완전한 옵션 섹션과 대조한 뒤 고급 정보줄로 바꾼다. 일부 문구만 일치하는 섹션은 교체하지 않는다. API 옵션을 찾지 못하면 예외로 실패시켜 조용한 미검증을 막는다.
- mods[0].name/tier에서 접두어·접미어·이름·등급을 사용한다. 같은 이름·티어·종류의 문구는 하나의 정보줄로 묶는다. 이름 없는 서로 다른 옵션을 임의로 한 mod로 합치지 않는다. 고유는 고유 속성 부여, 고정은 고정 속성 부여, 제작/분열은 각각 해당 접두/접미어 정보줄, 인챈트는 (enchant) 형식이다. P0는 등급을 발명하지 않고 생략한다.
- explicitMods 내부의 domain/flags 제작·분열 구분을 우선한다. flags.corrupted가 명시된 고정 옵션에는 타락 고정 속성 부여를 지원한다. 이번 원본에는 해당 표식이 없으므로 타락 아이템의 모든 고정을 타락 고정이라고 추측하지 않았다.
- 젬의 explicitMods는 스킬 설명이며 장비 mod가 아니다. 젬은 원문 섹션을 유지한다. 탐험 일지의 지역별 옵션은 원문 (implicit) 형식을 유지하며, 일지 자체의 명시 옵션만 고급 정보줄로 바뀐다. 지역별 파서 설계는 변경하지 않았다.

### 복원 한계

API에는 실제 정보줄의 태그, 표시 수치 범위, 변경 불가 표시, 리마인더, 개별 고정 옵션의 타락/엘드리치/결합 기원, 명시적인 mod 경계가 항상 존재하지 않는다. 이 정보는 만들지 않는다. magnitudes는 거래 내부 수치이므로 클립보드 괄호 범위로 쓰지 않는다. 이름/티어가 없는 명시 옵션은 일반 정보줄을 쓰며 접두/접미를 발명하지 않는다. 제작/분열인데 P/S 메타가 없으면 복원 예외를 낸다. 현재 478건에는 이 예외가 없다.

특히 성운 같은 고정 속성 증폭 정보줄과 카옴 같은 변경 불가 표시의 완전한 복원은 보장하지 않는다. 실제 고급 fixture가 이 경로의 회귀를 검증하며, 재구성 매물 점검은 API에서 관찰 가능한 문구·종류·ID와 요청 생성에 한정한다. 고정 옵션 기원이 누락되므로 실제 게임의 모든 기본 활성 정책까지 동일하다고 주장하지 않는다.

## 실제 데이터 수정

발견 unknown은 unique-armour-corrupted[16] 베루소의 야심의 “20레벨 굶주림 부여” 1줄이다. 기존 데이터는 “#레벨 굶주림 스킬 사용 가능”과 과거 stat_636370122만 가지고 있었다.

- tools/data-generator/src/stats/granted-skills.mjs를 추가하고 build.mjs에 연결했다. 게임의 ClientStrings.ModGrantsEffectWithLevel(en: Grants Level {1} {0}), GrantedEffects.ActiveSkill → ActiveSkills.DisplayedName의 en/ko, GrantedEffects.HASH32를 사용한다. 스킬 부여는 stat_descriptions.csd 문구만으로 생성되지 않는 경로다.
- 굶주림은 GrantedEffects Id=Ravenous, HASH32=388828889, ActiveSkill=1862, 표시 이름 en=Ravenous/ko=굶주림이다. 캐시 snapshot의 explicit.effect_388828889 및 implicit.effect_388828889와 한국어 문구가 정확히 맞는 경우에만 연결한다.
- 같은 문제가 있는 기존 Grants Level # … Skill ref 계열에 일반화했다. 캐시 검증을 통과한 기존 61개 ref(일부 그룹 내 동일 ref의 두 stat 포함 71개 matcher 변경 기록)를 갱신했다. 신규 임의 ref·해시는 만들지 않았다. 현재 effect ID를 후보 앞에 두고 과거 ref·matcher·stat ID와 그룹 resolver를 보존한다. baseline 대비 타입별 ID와 영어/한국어 ref 정렬·충돌 검사도 통과했다.
- en/ko stats.ndjson은 생성기 staging 출력 전체를 복사했다. 제품 파서에는 이번 작업으로 추가 수정할 실제 결함이 확인되지 않았다.
- 기본 활성 ID가 바뀐 매물은 위 1건이다. 기존 카오스 저항·이동 속도에 explicit.effect_388828889 및 레거시 explicit.stat_636370122 후보가 추가된다. 이들은 기존 요청 생성기의 후보 검색 방식에 따라 전달된다. 별도 회귀 테스트는 현재 effect ID와 min=20 전달을 확인한다. 다른 477건의 기본 활성 ID는 수정 전후 동일하다.

## 잔여 문제와 리드 결정 필요

1. **탐험 일지 93건**: 20개 매물의 지역별 implicit ID 발생 수다. parseLogbookArea는 옵션을 지역별 logbookAreaMods에 보관하고 비교 가능한 수치를 의도적으로 생략하며 statsByType에 합산하지 않는다. 리드 결정대로 유지했다. 전체 지역 옵션을 한 AND 검색으로 바꾸지 않았다. 이번 수치는 이 설계로 인한 전수 ID 대조 잔여이며 파싱 예외가 아니다.
2. **균사체 핵 22건 — 리드 결정 필요**: mycelium-core 19건과 unique-jewel 3건의 explicit.stat_3418580811이 남는다. 예시 mycelium-core[0]의 extended.hashes는 stat_3418580811과 stat_2255402066을 모두 같은 description index [0]에 연결한다. API description에는 무작위 4개 성장/성유 영향의 2줄이 하나뿐이고, mods.magnitudes는 12와 1을 가진다. CSD blightcore_display_stat와 캐시 스키마는 이 표시 문구를 stat_2255402066으로 연결하며 제품도 그것을 정상 인식한다. stat_3418580811은 제공 snapshot에 없다. 별도 내부 stat인지 동일 표시의 거래 별칭인지 검증되지 않아 새 별칭이나 검색 수치를 추가하지 않았다. 두 ID를 같은 검색 조건으로 취급할지, 관찰 불가능한 추가 해시로 분류할지 리드 판단이 필요하다. 이 22건은 unknown 문구 누락이 아니다.
3. **고정 옵션 기원 부족**: 원본 전체에 제작 flags 1건만 있고 고정 옵션의 corruption 기원 표식은 없다. 타락 여부만으로 일반 고정을 타락 고정으로 분류할 수 없다. 실제 클립보드와 기본 활성 필터까지 완전히 비교하려면 기원 메타 또는 실제 고급 원문이 필요하다. 현재 결과는 이 한계를 갖는 재구성 입력 점검이다.

## CI 및 검증

- 기존 renderer/test/fixtures/listings-items의 유형당 5건, 총 120건을 재사용했다. 동일 sourceIndex의 허용 필드(frameType 및 옵션 description/domain/hash/flags/mod 메타)를 보충하고 기대값을 고급 기준으로 갱신했다. unique-armour-corrupted의 마지막 표본만 [4]에서 실제 결함 표본 [16]으로 교체했다. 계정·캐릭터·매물 ID·메모·가격·판매 정보는 포함하지 않았다.
- 기본 npm test는 원본 out 없이 축소본만 읽는다. ITEM_AUDIT_FULL=1은 전체 478건, ITEM_AUDIT_DISCOVERY=1은 발견 전용, ITEM_AUDIT_OUTPUT은 결과 JSON 경로다. full strict는 DISCOVERY 없이 13의 최종 매물별 기대값(category/unknown/mismatched/missing/enabled)과 정확히 비교하여 통과했다. unknown=0만 고정하지 않고 잔여 누락의 증가/감소도 검출한다.
- 재구성기 회귀는 기본 섹션 보존, explicitMods 내부 제작, 명명된 복합 mod 묶음, 젬 설명과 일지 지역 보존, 복원 실패 노출을 확인한다. 굶주림 요청 ID/레벨 회귀도 포함한다.
- renderer npm test: **12파일 46테스트 통과**. lint: **오류 0, 기존 eslint-disable 경고 4개**(RateLimiter.ts 1, common.ts 3). npx --no-install vue-tsc --noEmit 통과. 패키지 설치 없이 로컬 실행했다.
- 생성기 회귀: node --test로 csd/area-mods/invariants/support-effects/granted-skills의 **16테스트 통과**. 신규 61개 ref의 캐시 ID·문구, 굶주림 현재/레거시 ID, 기존 보조 효과 228개, ref/그룹/충돌 보존을 확인했다.
- 최종 node tools/data-generator/src/stats/build.mjs 재실행 뒤 반영본과 staging을 Buffer.equals로 비교하여 en/ko 모두 바이트 일치했다.
  - en SHA-256: 4d813359125c0bef1ad6061e2ffdaa37d942943fe1cc2526f82a75954ed717db
  - ko SHA-256: c8646e865de916f04fc9eb2512534c426c69b808b45f66a091cdfa5244baf20a
- git, hc send, 서브에이전트, 네트워크, 패키지 설치는 사용하지 않았다.
