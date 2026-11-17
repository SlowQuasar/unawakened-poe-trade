# PHASE 2-4. 3.30 파서 및 실제 샘플 검증

작성: Codex (Implementer), 2026-11-17. 리드 리뷰용.

## 변경 파일과 함수

- `renderer/src/assets/data/interfaces.ts`: TranslationDict에 MAP_ATLAS_DROPS, VISCERA_CLASS, VISCERA_SLOT_HEAD/ARM/BODY/LEG 추가.
- `renderer/public/data/{en,ko,ru,cmn-Hant}/client_strings.js`: 새 키를 모든 언어에 추가. 확인값과 unverified 값을 주석으로 구분.
- `renderer/src/parser/ParsedItem.ts`: areaAtlasDrops와 visceraSlot(head/arm/body/leg) 추가.
- `renderer/src/parser/meta.ts`: ItemCategory.Viscera 추가.
- `renderer/src/parser/Parser.ts`: parseAreaPropNested에서 아틀라스 획득물 수치를 별도 필드로 파싱. parseNamePlate의 기존 희귀도 생략 처리는 유지하고, 아이템 종류 문자열로 살덩이 분류를 설정. findInDatabase는 살덩이 정확 조회 실패 시 기존 magicBasetype을 재사용해 부분 이름으로 조회. 매직 아이템용 함수 자체는 변경하지 않음. parseVisceraSlot은 살덩이의 한 줄짜리 부위 섹션만 소비. parseModifiers는 희귀도가 없는 살덩이도 기존 고정 속성 파싱을 타도록 허용.
- `renderer/src/web/price-check/filters/pseudo/maps.ts`: areaProps에서 기존 아이템 수량 방식과 동일한 Atlas Drops 속성 필터 생성. 기본 활성화 및 검색 범위 처리 재사용.
- `renderer/src/web/price-check/filters/interfaces.ts`: item.map_atlas_drops 내부 ID와 ItemFilters.visceraSlot 추가.
- `renderer/src/web/price-check/filters/create-item-filters.ts`: 살덩이 베이스 이름, 카테고리, 부위를 요청용 필터에 전달.
- `renderer/src/web/price-check/trade/pathofexile-trade.ts`: CATEGORY_TO_TRADE_ID에 viscera 추가. createTradeRequest에서 부위별 viscera.head/arm/body/leg를 선택하고 부위 미상은 viscera로 처리. Atlas Drops는 map_filters.filters.map_bonus로 전달. 기존 map_iiq 처리 유지.
- `renderer/public/data/{en,ko}/app_i18n.json`: map_atlas_drops 표시 라벨 추가.
- `renderer/test/parser.ko.test.ts`: 실제 샘플 7건과 합성 조회 레코드 기반 독립 테스트 1건 추가.

Kakao 로컬 스냅샷 `tools/data-generator/snapshots/kakao-2026-11-17/filters.json`을 읽어 map_filters의 map_bonus(아틀라스 획득물), viscera 및 네 부위 카테고리를 확인했다. 네트워크나 거래소 API 호출은 하지 않았다.

## 테스트 결과

renderer 디렉터리의 설치된 의존성으로 실행했다.

- `npm test`: 최종 종료 코드 0. 2개 파일, 18개 테스트 모두 통과(기존 10개 + 실제 3.30 샘플 7개 + 합성 조회 테스트 1개).
- `npm run lint`: 종료 코드 0, 오류 0. 기존 RateLimiter.ts 1개 및 common.ts 3개의 unused eslint-disable 경고 4개 유지.
- `npx --no-install vue-tsc --noEmit`: 종료 코드 0. 요청한 vue-tsc 타입 검사를 설치/네트워크 없이 실행. 기존 tsconfig 기준 src와 모든 언어 client_strings 검사이며 test 파일은 tsconfig 및 npm lint 범위 밖이다.

실제 샘플 검증:

| 샘플 | 검증 결과 |
|---|---|
| rare-twohand-mace-unidentified-corrupted | Karui Maul, 희귀, 미확인, 타락, 기존 implicit stat 보존 |
| rare-map-atlas-drops | areaAtlasDrops=64, 희귀도=37, 무리 규모=24, 모드 4개, unknown 없음. 생성 필터 활성화 및 map_bonus min/max=60/80 검증. 기존 areaItemQuantity=50을 함께 둔 요청에서 map_iiq 유지 검증 |
| currency-royal-astrolabe | Royal Astrolabe, 화폐, 중첩 1/10 |
| thread-expedition | Expedition Thread, 일반, 중첩 73/100 |
| viscera-arm-gargantuan-claw | Gargantuan Claws, rarity 없음, arm, 레벨 83, 클로 공격 속도 implicit 인식, viscera.arm 요청 |
| viscera-arm-lesser-swordsman-blade | Swordmaster’s Blade, 접두어 하위 부분 조회, rarity 없음, arm, 레벨 38, 검 공격 속도 implicit 인식, viscera.arm 요청 |
| viscera-head-hungry-skull | Ravenous Skull, rarity 없음, head, 레벨 73, implicit 모드 1개 및 unknown 2줄 보존, viscera.head 요청 |

살덩이 실제 테스트는 부위를 제거한 필터가 viscera fallback으로 요청되는 것도 확인한다. 합성 조회 테스트는 디스크 데이터를 바꾸지 않고 ITEM_BY_TRANSLATED만 일시적으로 대체하여, 접두어 이름 조회·희귀도 생략·기존 implicit 파싱·네 부위 및 미상 부위 fallback을 독립적으로 검증한다. 합성 영문 이름은 공식 이름의 근거로 쓰지 않는다.

첫 실행은 12개 통과, 데이터 미추가로 관측기·실낱·살덩이 5건이 item.unknown이었다. 작업 중 별도 작업의 데이터가 들어온 다음 실행은 17개 통과, 실낱 기대 영문명을 추정한 테스트 1건만 실패했다. 추가된 정적 데이터의 실제 refName인 Expedition Thread로 기대값을 수정한 뒤 최종 18개가 통과했다. 데이터 추가를 기다리는 작업은 수행하지 않았다.

## 남은 unknown 및 unverified 값

굶주린 두개골의 다음 두 줄은 스탯 데이터 부재로 unknownModifiers에 Implicit 타입으로 남는다(이번 범위에서 허용):

- 3초마다 5미터 내의 시신 1구를 소모해 생명력의 4(4-5)% 회복
- 3초마다 5미터 내의 시신 1구를 소모해 마나의 5(4-5)% 회복

클로/검 공격 속도는 기존 스탯 데이터로 정상 인식된다.

확인된 한국어 문자열은 아틀라스 획득물 접두사 `아틀라스 획득물: `, 종류 `살덩이`, 부위 `머리`와 `상지`다. 다음 값은 client_strings 주석에 unverified로 표시했다:

- en: `Atlas Drops: `, `Viscera`, `Head`, `Arm`, `Body`, `Leg`.
- ko: BODY=`몸통`, LEG=`하지`.
- ru/cmn-Hant: 위 영어 값 전체를 임시 fallback으로 사용. 실제 현지화된 클립보드 인식은 미검증.

body/leg의 한국어와 영어 부위 테스트는 합성 문자열 검증이다. 실제 클라이언트 원문 확인을 대신하지 않는다. UI 및 실제 거래소 응답은 검증하지 않았다.

## 범위 준수

items.ndjson, stats.ndjson, tools 및 원문 fixture는 수정하지 않았다. 테스트 하네스의 기존 인덱스 생성은 그대로 실행했다. git 명령, hc send, 서브에이전트, 네트워크, 패키지 설치를 사용하지 않았다. 본 보고서의 아이템 데이터 추가는 별도 작업 결과이며 이 작업의 변경으로 보고하지 않는다.
