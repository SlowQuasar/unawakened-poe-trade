# 실제 매물 기반 장비·젬 등 24유형 점검

실제 한국어 일반 복사 원문 478건을 검사했다. 파싱/요청 예외는 0건이며, 보고된 unknown은 49 → 0줄이다. **이 결과를 모든 옵션 인식 성공으로 해석하면 안 된다.** API ID 미인식은 1882 → 1835건 남아 있다. 일반 복사 형식에는 고급 속성 정보줄이 없어서 기존 파서가 고정/명시 옵션 섹션 대부분을 건너뛴다. unknown=0은 이 누락을 포함하지 않는다.

## 입력과 방법

- tools/data-generator/out/item-listings의 24개 비어 있지 않은 유형, 23×20 + socketed-support-effect 18 = 478건. idol은 summary에 fetched=0이므로 표본/유형 수에 포함하지 않았다. 검색 total과 표본 수는 구분한다.
- extended.text를 base64→UTF-8로 디코딩하고 CRLF만 LF로 정규화한 뒤 마지막 구분선부터 메모 섹션을 제거했다. API 필드에서 클립보드를 재구성하거나 고급 정보줄을 추가하지 않았다.
- parseClipboard 성공 및 실제 category, unknownModifiers 원문, statsByType의 해당 type trade.ids와 extended.hashes의 양방향 차집합, createPresets의 active 프리셋→createTradeRequest 예외를 기록했다. 후보 ID 중 하나라도 API와 겹치면 인식 불일치는 아니다. API ID 누락은 매물별 ID 발생 수이며 전역 고유 ID 수가 아니다.
- category는 비어 있지 않은지와 검토한 매물별 기대 category를 검증한다. unique-armour 표본에는 화살통이 있으며, socketed-support-effect는 모두 장갑, mycelium-core는 Jewel이다.
- API 누락에는 일반 옵션 섹션의 미파싱, 지원하지 않는 옵션 이름, 일지 지역별 옵션처럼 statsByType에 합산하지 않는 구조가 섞여 있다. 이 수치를 전부 데이터 누락이라고 단정하지 않는다.
- 기본 검색 옵션: league=Covens, merchantOnly=false, currency=null, collapseListings=app, activateStockFilter=false, useEn=true, searchStatRange=0. 기본 활성 ID는 12-item-audit-details.json에 보존한다. 네트워크 요청은 보내지 않았다.
- 매물별 수정 전 결과는 [12-item-audit-before.json](12-item-audit-before.json), 수정 후 결과는 [12-item-audit-details.json](12-item-audit-details.json)에 보존했다. index는 원본 파일 내 0부터 시작하는 인덱스다.

## 수정 전후

| 유형 | 입력 | 파싱 성공 전→후 | unknown 줄 전→후 | 인식 ID 오류 전→후 | API ID 누락 전→후 | 요청 예외 전→후 |
|---|---:|---:|---:|---:|---:|---:|
| abyss-jewel | 20 | 20 → 20 | 0 → 0 | 0 → 0 | 65 → 65 | 0 → 0 |
| cluster-jewel | 20 | 20 → 20 | 22 → 0 | 0 → 0 | 79 → 59 | 0 → 0 |
| corrupted-implicit-rare | 20 | 20 → 20 | 0 → 0 | 0 → 0 | 119 → 119 | 0 → 0 |
| gem-active | 20 | 20 → 20 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 |
| gem-support | 20 | 20 → 20 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 |
| heist-contract | 20 | 20 → 20 | 0 → 0 | 0 → 0 | 113 → 113 | 0 → 0 |
| logbook | 20 | 20 → 20 | 0 → 0 | 0 → 0 | 108 → 108 | 0 → 0 |
| magic-flask | 20 | 20 → 20 | 0 → 0 | 0 → 0 | 42 → 42 | 0 → 0 |
| mycelium-core | 20 | 20 → 20 | 27 → 0 | 0 → 0 | 65 → 38 | 0 → 0 |
| rare-accessory | 20 | 20 → 20 | 0 → 0 | 0 → 0 | 111 → 111 | 0 → 0 |
| rare-armour | 20 | 20 → 20 | 0 → 0 | 0 → 0 | 99 → 99 | 0 → 0 |
| rare-jewel | 20 | 20 → 20 | 0 → 0 | 0 → 0 | 63 → 63 | 0 → 0 |
| rare-weapon | 20 | 20 → 20 | 0 → 0 | 0 → 0 | 104 → 104 | 0 → 0 |
| sanctum-relic | 20 | 20 → 20 | 0 → 0 | 0 → 0 | 41 → 41 | 0 → 0 |
| socketed-support-effect | 18 | 18 → 18 | 0 → 0 | 0 → 0 | 90 → 90 | 0 → 0 |
| tincture | 20 | 20 → 20 | 0 → 0 | 0 → 0 | 52 → 52 | 0 → 0 |
| unique-accessory | 20 | 20 → 20 | 0 → 0 | 0 → 0 | 129 → 129 | 0 → 0 |
| unique-armour-corrupted | 20 | 20 → 20 | 0 → 0 | 0 → 0 | 118 → 118 | 0 → 0 |
| unique-armour | 20 | 20 → 20 | 0 → 0 | 0 → 0 | 112 → 112 | 0 → 0 |
| unique-flask | 20 | 20 → 20 | 0 → 0 | 0 → 0 | 60 → 60 | 0 → 0 |
| unique-jewel | 20 | 20 → 20 | 0 → 0 | 0 → 0 | 41 → 41 | 0 → 0 |
| unique-weapon-corrupted | 20 | 20 → 20 | 0 → 0 | 0 → 0 | 125 → 125 | 0 → 0 |
| unique-weapon | 20 | 20 → 20 | 0 → 0 | 0 → 0 | 126 → 126 | 0 → 0 |
| viscera | 20 | 20 → 20 | 0 → 0 | 0 → 0 | 20 → 20 | 0 → 0 |
| 합계 | 478 | 478 → 478 | 49 → 0 | 0 → 0 | 1882 → 1835 | 0 → 0 |

## 보조 젬 전체 계열 수정

snapshot의 정확한 .effect_ ID는 357개이며 type별 집계는 {"explicit":270,"implicit":77,"enchant":1,"scourge":9}이다. 이 중 “장착된 젬에 #레벨 … 보조 효과 적용” 계열은 228개, {"explicit":186,"implicit":39,"scourge":3}이다. 나머지는 스킬 부여 등 다른 계열이며 이번 수정의 228개에 포함하지 않았다.

- CSD stat_descriptions.csd 9889행 description: local_random_support_gem_level/local_random_support_gem_index, 9924행의 _1 변형은 display_indexable_support(2,1) 핸들러로 이름을 동적 조회한다. 각 보조 젬마다 고정 문구 description이 있는 구조가 아니다. 두 슬롯 모두 확장한다.
- support-effects.mjs가 로컬 GGPK GrantedEffects의 IsSupport, SupportName(en/ko), HASH32를 읽는다. 3.30 영어 Rage Support, 한국어 격노 보조를 CSD의 {1}에 넣어 실제 문구를 생성한다. 한국어의 “보조 보조”는 게임 원문이므로 제거하지 않는다.
- IndexableSupportGems → SkillGems.GemVariants[0] → GemEffects.GrantedEffect 연결로 과거 이름도 확장한다. Rage ref 및 기존 stat_369650395는 유지하고 explicit.indexable_support_28도 연결했다. effect ID를 후보 목록 앞에 두어 새 항목을 선택할 수 있게 했다. 레거시 Random Support Gem ref/그룹도 삭제하지 않았다.
- CSD en/ko 매처와 snapshot 문구를 조인해 228개 전부 연결했다. 생성기 회귀 테스트가 각 ID와 현재 문구가 같은 row에 있는지 검사한다. 고정 ID가 없는 나머지 support 행을 새 거래 ID로 발명하지 않는다.
- 실제 카옴 고급 복사 샘플은 unknown=0, 보조 옵션 활성화 시 요청에 implicit.effect_3512123051, min=10이 들어간다. 고유 아이템 프리셋에서 타락 고정 옵션은 기본 비활성이므로 테스트에서 해당 필터를 명시적으로 켰다. 기본 활성 정책을 바꾸지 않았다.

## 추가 수정

- Parser.ts: 일반 복사에 존재하는 (implicit) 표식을 parseModifiers 진입 조건에 포함했다. 기존 parseModType이 이미 고정 속성 타입을 처리하지만 진입 조건에서 누락되어 있었다. 링크 이름에 포함된 U+200B도 섹션 분할 전에 제거한다. 고급 정보줄 없는 옵션의 타입을 추정하는 코드는 추가하지 않았다.
- item-options.mjs: 균사체 핵의 4개 local_jewel_blightcore_granted_passive_hash_* description을 PassiveSkills.PassiveSkillGraphId/Name의 en/ko와 snapshot 옵션 ID로 검증해 확장한다. 이름이 같아 충돌하는 경우 기존 생성기의 충돌 보류 정책을 유지한다.
- 군 주얼 일반 원문은 “추가된 소형 패시브 스킬 효과: +15% to Lightning Resistance”처럼 영어 소형 노드 설명을 포함한다. snapshot의 동일 옵션 ID로 연결된 기존 영어 ref와 한국어 접두부를 조합한 혼합 매처를 생성기에 추가했다. 원본 22줄이 인식된다.
- en/ko stats.ndjson은 생성기를 실행한 staging 출력 전체를 복사했다. 데이터 파일을 직접 수정하지 않았다.

## 상위 문제 문구

| 수정 전 실제 unknown 문구 | 발생 줄 | 수정 후 |
|---|---:|---:|
| 추가된 패시브 스킬 1개가 무차별적인 복수 | 4 | 0 |
| 추가된 소형 패시브 스킬 효과: +15% to Cold Resistance | 3 | 0 |
| 추가된 소형 패시브 스킬 효과: 10% increased Effect of Non-Damaging Ailments | 3 | 0 |
| 추가된 소형 패시브 스킬 효과: +15% to Lightning Resistance | 2 | 0 |
| 추가된 소형 패시브 스킬 효과: 12% increased Cold Damage over Time | 2 | 0 |
| 추가된 패시브 스킬 1개가 전사의 길 | 2 | 0 |
| 추가된 패시브 스킬 1개가 전투의 흐름 | 2 | 0 |
| 추가된 패시브 스킬 1개가 준비된 응답 | 2 | 0 |
| 추가된 패시브 스킬 1개가 타쇄하는 대응 | 2 | 0 |
| 추가된 소형 패시브 스킬 효과: 12% increased Brand Damage | 1 | 0 |
| 추가된 소형 패시브 스킬 효과: 2% increased Effect of your Curses | 1 | 0 |
| 추가된 소형 패시브 스킬 효과: 6% increased maximum Energy Shield | 1 | 0 |
| 추가된 소형 패시브 스킬 효과: Staff Attacks deal 12% increased Damage with Hits and Ailments | 1 | 0 |
| 추가된 소형 패시브 스킬 효과: Mace or Sceptre Attacks deal 12% increased Damage with Hits and Ailments | 1 | 0 |
| 추가된 소형 패시브 스킬 효과: 10% increased Damage over Time | 1 | 0 |

전체 unknown 문구와 빈도는 전수 원문 점검 결과 기준이다. 보조 효과 문구는 기존 일반 파서가 해당 섹션을 통째로 건너뛰므로 수정 전 unknown 집계에 나타나지 않았다. 이 문제는 카옴 고급 원문 테스트와 생성기 228개 coverage 테스트로 별도 검증한다.

## 리드 결정 필요 / 남은 한계

1. 일반 복사에서 고급 정보줄 없는 옵션을 지원하는 정책과 타입 판정이 필요하다. 1835개 ID 미인식 중 대부분은 이 경로다. “마나 재생 속도 25% 증가” 같은 문장은 implicit/explicit 양쪽 ID를 가지며, 제작 옵션도 표시 타입을 잃는다. 임의로 explicit으로 처리하면 API ID 불일치가 생긴다. 일반 복사 입력을 고급 복사 성공으로 보고하거나 API hash를 이용해 제품 파서에 타입을 주입하지 않았다. 제품에서 고급 복사를 요구할지, 일반 복사의 불확실한 옵션을 어떻게 표시/검색할지 리드 결정이 필요하다.
2. 탐험 일지는 parseLogbookArea가 선택 지역별 옵션을 logbookAreaMods에 저장하며 비교 가능한 수치 옵션 대부분을 의도적으로 생략한다. 모든 지역 옵션을 하나의 statsByType 검색으로 합치면 선택하지 않은 지역까지 AND 조건으로 검색할 수 있다. 지역 선택 UX와 수치 검색 범위를 결정해야 한다.
3. 균사체 핵의 일반 명시 옵션과 팅크의 표식 없는 고정 옵션 역시 원문에서 타입이 드러나지 않는 누락이다. 고급 복사 지원과 일반 복사 지원을 구분해서 리뷰해야 한다.
4. unknown=0이나 요청 예외=0을 검색 정확도 보장으로 사용하면 안 된다. CI는 검토한 누락 목록을 기대값으로 고정해 누락의 증가/감소도 실패로 검출한다. 리드 결정 뒤 기대값을 명시적으로 갱신해야 한다.

## CI 및 검증

- renderer/test/fixtures/listings-items: 유형당 5개, 총 120개. 과거 unknown 대표, ID 누락 최대 사례, 일반 사례를 골랐다. 화이트리스트 필드는 name, baseType, sourceIndex, extended.text/hashes, expectedAudit뿐이다. 계정·캐릭터·매물 ID·메모·가격·판매 정보는 없다. 디코딩된 text의 마지막 메모 섹션도 제거했다.
- npm test 기본 실행은 축소 fixture만 사용한다. ITEM_AUDIT_FULL=1이면 원본 478건을 사용하고 docs의 매물별 검토 결과와 category/unknown/mismatched/missing/enabled를 비교한다. ITEM_AUDIT_DISCOVERY=1은 조사 전용이며 최종 strict 검증에는 사용하지 않는다. ITEM_AUDIT_OUTPUT은 JSON 출력 경로다.
- 전체 원본 strict audit: 24유형 478건, 조사 모드를 끄고 검토 결과와 정확히 비교하여 통과했다. 이는 미인식 1,835건을 허용된 잔여 문제로 검출·고정한 결과이며, 미인식이 해결되었다는 의미가 아니다.
- renderer npm test: 11파일 41테스트 통과(120개 축소 매물, 카옴 실제 고급 원문 및 기존 한/영 회귀 포함).
- renderer npm run lint: 오류 0, 기존 미사용 eslint-disable 경고 4개(RateLimiter.ts 1개, common.ts 3개).
- renderer npx --no-install vue-tsc --noEmit: 통과. 설치 없이 기존 로컬 실행 파일을 사용했다.
- node --test tools/data-generator/src/stats/{csd,area-mods,invariants,support-effects}.test.mjs: 15테스트 통과. 보조 ID 228개, 두 랜덤 슬롯, 레거시 격노 및 en/ko ref 정렬·충돌을 검사했다.
- 최종 생성기 재실행 뒤 en/ko 양쪽 staging과 반영본 바이트 일치를 다시 확인했다.

## 생성물 바이트 검증

- en: staging과 Buffer.equals 일치, SHA-256 905c3b010272092cc236ec3502b383a6d615293a3044b6eb48aada39b60441f9
- ko: staging과 Buffer.equals 일치, SHA-256 69d93fc7bd854485fdbbce8c785baec7a1cc3451c6b767114c40352bdbaf46a8

## 실행 제약 기록

지시 파일을 읽은 직후 같은 초기 도구 호출에서 git status --short를 실행했으며 소유권 오류로 실패했다. 지시 파일의 git 금지를 확인한 이후에는 git을 사용하지 않았고 설정도 변경하지 않았다. hc send, 서브에이전트, 네트워크, 패키지 설치는 사용하지 않았다.
