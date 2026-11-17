# 실제 매물 기반 지도 파싱·검색 전수 점검

## 결과

제공된 17개 파일 340건을 모두 분류했다. 지도 331건은 수정 전후 모두 파싱·요청 생성에 성공했다. 실제 문제는 역병 속성의 새 문구 누락(44건, unknown 88줄)과 복합 속성을 단일 속성 둘로 잘못 인식하는 거래 ID 오류(3건, 잘못된 인식 6개)였다. 수정 후 unknown, 인식 ID 불일치, API ID 누락, 속성 불일치, 요청 생성 실패가 모두 0이다.

이는 제공 표본을 재구성한 오프라인 검증 결과다. 거래소 서버에 요청을 보내 검색 결과까지 검증하지 않았다. 게임에서 복사한 원문 전체와 완전히 같은 입력이라고 주장하지 않는다.

## 입력과 집계 기준

- 원본: tools/data-generator/out/map-listings/*.json 및 summary.json. Covens 매물 17유형 × 20건. summary.total은 거래소 검색 총수이며 표본 수가 아니다.
- unidentified.json의 9건은 지도 외 아이템(용병 소환장 2, 실낱 4, 새겨진 결전 3)이다. 이를 파싱 실패나 지도 성공에 포함하지 않고 제외 목록에 보존했다. 나머지 11건은 고유 1, 희귀 6, 마법 4의 실제 미확인 지도다.
- 유형명은 수집 파일 이름이다. 예를 들어 rare-t16에도 미확인·타락 지도가 있고, corrupted-rare에는 역병 지도 2건, rare-t10-15와 viridian에도 역병 지도 각 1건이 있다. 고유 지도는 확인 14건·미확인 6건이다.
- 파싱 성공은 parseClipboard.isOk 및 category=Map을 모두 만족해야 한다. unknown은 줄 단위 발생 수이며 괄호로 시작하는 리마인더 줄은 집계에서 제외한다. 실제 원본에서 발생한 unknown 88줄은 모두 게임 속성 문구였다.
- ID 불일치는 인식한 stat.trade.ids 중 해당 modifier type의 후보가 API extended.hashes 집합과 하나도 겹치지 않는 경우다. 후보 별칭은 허용한다. API ID 누락은 반대 방향의 차집합이며 unknown으로 인한 미인식과 잘못된 단일 ID 선택을 함께 포착한다.
- 같은 매물이 여러 수집 파일에 중복될 수 있다. 수치는 전역 고유 매물 수가 아니라 파일 내 표본별 발생 수다.

## 수정 전후

모든 수치는 전 → 후. ID 오류는 잘못 인식한 stat 개수이며 괄호는 영향받은 매물 수다.

| 유형 | 검색 총수 | 지도 / 입력 | 파싱 성공 전→후 | unknown 줄 전→후 | ID 오류 전→후 | API ID 누락 전→후 | 요청 실패 전→후 |
|---|---:|---:|---|---:|---:|---:|---:|
| blight-ravaged | 2605 | 20 / 20 | 20/20 (100%) → 20/20 (100%) | 40 → 0 | 0 (0) → 0 | 20 → 0 | 0 → 0 |
| blighted | 10000 | 20 / 20 | 20/20 (100%) → 20/20 (100%) | 40 → 0 | 0 (0) → 0 | 20 → 0 | 0 → 0 |
| citadel-1 | 714 | 20 / 20 | 20/20 (100%) → 20/20 (100%) | 0 → 0 | 2 (1) → 0 | 1 → 0 | 0 → 0 |
| citadel-2 | 757 | 20 / 20 | 20/20 (100%) → 20/20 (100%) | 0 → 0 | 0 (0) → 0 | 0 → 0 | 0 → 0 |
| citadel-3 | 676 | 20 / 20 | 20/20 (100%) → 20/20 (100%) | 0 → 0 | 2 (1) → 0 | 1 → 0 | 0 → 0 |
| citadel-4 | 669 | 20 / 20 | 20/20 (100%) → 20/20 (100%) | 0 → 0 | 0 (0) → 0 | 0 → 0 | 0 → 0 |
| corrupted-rare | 10000 | 20 / 20 | 20/20 (100%) → 20/20 (100%) | 4 → 0 | 0 (0) → 0 | 2 → 0 | 0 → 0 |
| magic | 10000 | 20 / 20 | 20/20 (100%) → 20/20 (100%) | 0 → 0 | 0 (0) → 0 | 0 → 0 | 0 → 0 |
| nightmare | 5392 | 20 / 20 | 20/20 (100%) → 20/20 (100%) | 0 → 0 | 0 (0) → 0 | 0 → 0 | 0 → 0 |
| normal | 10000 | 20 / 20 | 20/20 (100%) → 20/20 (100%) | 0 → 0 | 0 (0) → 0 | 0 → 0 | 0 → 0 |
| rare-low-tier | 10000 | 20 / 20 | 20/20 (100%) → 20/20 (100%) | 0 → 0 | 0 (0) → 0 | 0 → 0 | 0 → 0 |
| rare-t10-15 | 10000 | 20 / 20 | 20/20 (100%) → 20/20 (100%) | 2 → 0 | 0 (0) → 0 | 1 → 0 | 0 → 0 |
| rare-t16 | 10000 | 20 / 20 | 20/20 (100%) → 20/20 (100%) | 0 → 0 | 2 (1) → 0 | 1 → 0 | 0 → 0 |
| twice-corrupted | 260 | 20 / 20 | 20/20 (100%) → 20/20 (100%) | 0 → 0 | 0 (0) → 0 | 0 → 0 | 0 → 0 |
| unidentified | 10000 | 11 / 20 | 11/11 (100%) → 11/11 (100%) | 0 → 0 | 0 (0) → 0 | 0 → 0 | 0 → 0 |
| unique | 10000 | 20 / 20 | 20/20 (100%) → 20/20 (100%) | 0 → 0 | 0 (0) → 0 | 0 → 0 | 0 → 0 |
| viridian | 2001 | 20 / 20 | 20/20 (100%) → 20/20 (100%) | 2 → 0 | 0 (0) → 0 | 1 → 0 | 0 → 0 |
| 합계 | — | 331 / 340 | 331/331 → 331/331 (100%) | 88 → 0 | 6 (3) → 0 | 47 → 0 | 0 → 0 |

### 상위 문제 문구

| 원문 | 발생 줄 수 | 수정 후 |
|---|---:|---:|
| 지역이 번식하는 진균에 오염 | 44 | 0 |
| 최대 3번까지 성유 부을 수 있음 | 24 | 0 |
| 최대 9번까지 성유 부을 수 있음 | 20 | 0 |

이 세 문구가 unknown의 고유 문구 전부다. 앞의 진균 문구와 뒤의 성유 문구는 각각 독립적인 오류가 아니라 하나의 2줄 고정 속성이다.

### 실제 수정과 근거

1. renderer/src/parser/stat-translations.ts: linesToStatStrings가 짧은 한 줄을 먼저 확정해 복합 속성의 첫 줄을 소비했다. 긴 일치부터 시도하도록 수정했다. rare-t16[1], citadel-1[1], citadel-3[2]의 동일한 폭주(P1) 속성이 대상이다(인덱스는 0부터). 원문은 “몬스터의 동작 속도가 기본 수치 밑으로 내려가지 않음\n몬스터의 이동 속도가 기본 수치 밑으로 내려가지 않음”. 기존 explicit.stat_2758454849 및 explicit.stat_777421120 대신 복합 ID explicit.stat_798009319로 인식한다. API에 이미 두 줄짜리 description과 단일 hash가 있어 재구성의 줄 분할 때문이 아니다.
2. tools/data-generator/src/stats/build.mjs: 로컬 Content.ggpk의 metadata/statdescriptions/stat_descriptions.csd에서 is_blighted_map(282843행 시작)을 확인했다. 현재 게임 문구는 진균+성유의 2줄이며 과거 Blight chest count 문장은 없다. 캐시 거래 스키마와 기존 ref는 과거 3줄이어서 일반적인 텍스트 조인으로는 새 문구에 ID를 연결하지 못했다. preserveMapTradeIdentity가 이 게임 stat에 대해서만 기존 implicit.stat_299373046을 연결한다. matcher는 게임 CSD에서 생성하고 과거 ref·matcher는 보존한다.
3. node tools/data-generator/src/stats/build.mjs로 재생성하고 staging/{en,ko}/stats.ndjson 전체를 renderer/public/data/{en,ko}/stats.ndjson으로 복사했다. 각 언어에서 바뀐 row는 진균 속성 1개뿐이다. 데이터 파일을 수작업 수정하지 않았다. 기존 baseline 보존·다국어 ref 정렬 검사도 통과했다.

생성기 출력과 반영본의 바이트 동등성을 Buffer.equals로 확인했다. SHA-256:

- en: 96b0111e58509a118bbf1863ae46c98f9ff1a95ce3f5b2d2ceaefdf2be84ee14
- ko: 2081f02bc6ece8f67dbd42aec7467fbf59903b883cdf725aca101a337b2e2c50

## 재구성기와 오차 범위

renderer/test/helpers/listing-to-clipboard.ts는 지도 전용 테스트 헬퍼다. 한국어 실측 3종(3.30-rare-map-atlas-drops.txt, 3.30-rare-map-hunter-citadel.txt, 3.30-rare-nightmare-map.txt)의 구분선·이름판·속성·아이템 레벨·몬스터 레벨·고정/접두어/접미어 정보줄·타락·미확인 형식을 기준으로 작성했다.

- API의 [AtlasDropScaling|아틀라스 획득물], [Thread|실낱] 같은 마크업은 화면 표시 문구만 남긴다. augmented는 값 색상 코드 1을 기준으로 붙인다.
- name과 typeLine을 사용하고, 희귀도는 frameType으로 결정한다. 마법 이름을 baseType으로 강제 바꾸지 않는다.
- 구조화된 explicitMods[].mods[0]의 name/tier를 사용한다. 같은 이름·티어의 여러 description을 한 정보줄 아래 모아 여러 줄 옵션을 유지한다. 현재 입력에는 extended.mods가 없고 이 메타데이터가 각 mod 내부에 있다. 원본 extended.hashes는 별도 검증 기준으로 보존한다.
- 접두어/접미어 이름 또는 P/S 티어가 없으면 일반 정보줄을 사용한다. 태그, 고급 수치 범위, 변경이 불가능한 값 표기, 텍스트 범위 (...)와 설명용 리마인더는 API만으로 정확히 복원할 수 없어 만들지 않는다. magnitudes는 거래소 내부 stat 범위이므로 표시 숫자의 괄호 범위로 변환하지 않는다.
- 명명된 mod 그룹의 순서는 최초 출현 순서, 그룹 안 문구는 API 순서다. 실제 클라이언트의 접두어/접미어 표시 순서까지 보장하지 않는다. enchant는 줄 끝 (enchant)를 사용한다. 영향력은 알려진 6종 라벨만 지원하며 이 표본에는 influences가 없어 해당 분기는 실측 검증 대상이 아니다.
- 도움말은 descrText를 사용한다. 표시 문구에 없는 속성이나 특수 고유 지도 설명을 발명하지 않는다. 몬스터 레벨 줄은 보존하지만 이번 속성 수치 비교 대상은 아래 표의 7종이다.
- doubleCorrupted는 보존하되 재구성에서는 일반 “타락”으로 낮춰 처리했다. 따라서 twice-corrupted의 20/20 성공은 기존 타락 플래그·옵션 파싱/요청 생성에 한정하며 실제 “두 번 타락” 라벨 지원을 의미하지 않는다.
- 원본 extended.text는 base64 한국어 일반 설명이다. 고급 정보줄이 없고 메모/가격을 포함하므로 CI 샘플에서 제거했다. 원문의 “두 번 타락” 라벨은 이 필드를 디코딩하여 확인했다.
- 실제 3종 고급 클립보드 회귀 테스트도 함께 실행했다. 원문 범위·리마인더 처리의 검증은 그 테스트들이 담당하며, 재구성 표본만으로 범위 파싱 완전성을 주장하지 않는다.

## 속성 검증

표시는 API 마크업 제거 후 이름이다. 속성이 존재하는 모든 지도 표본에서 값을 비교했다. 수정 전후 불일치 0건이다.

| 속성 | 존재 표본 | 검사 필드 |
|---|---:|---|
| 아틀라스 획득물 | 190 | areaAtlasDrops |
| 아이템 희귀도 | 186 | areaItemRarity |
| 몬스터 무리 규모 | 186 | areaPackSize |
| 지도 더 많음 | 8 | mapMoreMaps |
| 실낱 더 많음 | 4 | mapMoreScarabs (기존 내부 필드명) |
| 화폐 더 많음 | 2 | mapMoreCurrency |
| 지도 지역 | 44 | mapArea.name |

갑충석 더 많음 및 점술 카드 더 많음은 이번 원본에 없다. 갑충석 호환성은 기존 maps330.ko.test.ts가 검증한다.

## 기본 활성 필터

검사 옵션: league=Covens, merchantOnly=false, currency=null, collapseListings=app, activateStockFilter=false, useEn=true, searchStatRange=0. createPresets의 active로 선택한 기본 프리셋만 createTradeRequest에 전달했다. “요청 생성 성공”과 “모든 위험 옵션 활성화”는 별개다.

매물별 최종 활성 stat ID 및 실제 요청의 모든 item filter 값은 [11-map-audit-details.json](11-map-audit-details.json)에 기록했다. 파일 내 index는 원본 배열의 0-based 인덱스다. 제외 9건도 excluded=true로 남아 있다. 아래 표는 유형별 활성 stat ID와 해당 ID를 켠 매물 수다. item filter는 실제로 생성된 요청 필드 이름의 합집합이다.

| 유형 | 기본 활성 stat (횟수) | 요청 item filter 필드 |
|---|---|---|
| blight-ravaged | 없음 | map_filters.map_tier<br>map_filters.map_uberblighted<br>misc_filters.corrupted<br>misc_filters.fractured_item<br>misc_filters.mirrored<br>misc_filters.split<br>trade_filters.price<br>type_filters.rarity |
| blighted | 없음 | map_filters.map_blighted<br>map_filters.map_tier<br>misc_filters.corrupted<br>misc_filters.fractured_item<br>misc_filters.mirrored<br>misc_filters.split<br>trade_filters.price<br>type_filters.rarity |
| citadel-1 | implicit.stat_2563183002&#124;1 (20)<br>implicit.stat_2696470877 (1) | map_filters.map_blighted<br>map_filters.map_iir<br>map_filters.map_packsize<br>map_filters.map_tier<br>map_filters.map_uberblighted<br>misc_filters.corrupted<br>misc_filters.fractured_item<br>misc_filters.mirrored<br>misc_filters.split<br>trade_filters.price<br>type_filters.rarity |
| citadel-2 | implicit.stat_2563183002&#124;2 (20) | map_filters.map_blighted<br>map_filters.map_iir<br>map_filters.map_packsize<br>map_filters.map_tier<br>map_filters.map_uberblighted<br>misc_filters.corrupted<br>misc_filters.fractured_item<br>misc_filters.mirrored<br>misc_filters.split<br>trade_filters.price<br>type_filters.rarity |
| citadel-3 | implicit.stat_2563183002&#124;3 (20)<br>explicit.stat_260515856 (1)<br>implicit.stat_2696470877 (1) | map_filters.map_blighted<br>map_filters.map_iir<br>map_filters.map_packsize<br>map_filters.map_tier<br>map_filters.map_uberblighted<br>misc_filters.corrupted<br>misc_filters.fractured_item<br>misc_filters.mirrored<br>misc_filters.split<br>trade_filters.price<br>type_filters.rarity |
| citadel-4 | implicit.stat_2563183002&#124;4 (20)<br>implicit.stat_2696470877 (1) | map_filters.map_blighted<br>map_filters.map_iir<br>map_filters.map_packsize<br>map_filters.map_tier<br>map_filters.map_uberblighted<br>misc_filters.corrupted<br>misc_filters.fractured_item<br>misc_filters.mirrored<br>misc_filters.split<br>trade_filters.price<br>type_filters.rarity |
| corrupted-rare | 없음 | map_filters.map_blighted<br>map_filters.map_iir<br>map_filters.map_packsize<br>map_filters.map_tier<br>map_filters.map_uberblighted<br>trade_filters.price<br>type_filters.rarity |
| magic | 없음 | map_filters.map_blighted<br>map_filters.map_tier<br>map_filters.map_uberblighted<br>misc_filters.corrupted<br>misc_filters.fractured_item<br>misc_filters.mirrored<br>misc_filters.split<br>trade_filters.price<br>type_filters.rarity |
| nightmare | pseudo.pseudo_map_more_currency_drops (1)<br>pseudo.pseudo_map_more_scarab_drops (3) | map_filters.map_iir<br>map_filters.map_packsize<br>misc_filters.corrupted<br>misc_filters.fractured_item<br>misc_filters.mirrored<br>misc_filters.split<br>trade_filters.price<br>type_filters.rarity |
| normal | 없음 | map_filters.map_blighted<br>map_filters.map_tier<br>map_filters.map_uberblighted<br>misc_filters.corrupted<br>misc_filters.fractured_item<br>misc_filters.mirrored<br>misc_filters.split<br>trade_filters.price<br>type_filters.rarity |
| rare-low-tier | explicit.stat_1975119765 (2)<br>explicit.stat_2788592463 (2) | map_filters.map_blighted<br>map_filters.map_iir<br>map_filters.map_packsize<br>map_filters.map_tier<br>map_filters.map_uberblighted<br>misc_filters.corrupted<br>misc_filters.fractured_item<br>misc_filters.mirrored<br>misc_filters.split<br>trade_filters.price<br>type_filters.rarity |
| rare-t10-15 | 없음 | map_filters.map_blighted<br>map_filters.map_iir<br>map_filters.map_packsize<br>map_filters.map_tier<br>map_filters.map_uberblighted<br>misc_filters.corrupted<br>misc_filters.fractured_item<br>misc_filters.mirrored<br>misc_filters.split<br>trade_filters.price<br>type_filters.rarity |
| rare-t16 | explicit.stat_1290924623 (1)<br>pseudo.pseudo_number_of_affix_mods (2)<br>explicit.stat_260515856 (1)<br>pseudo.pseudo_map_more_currency_drops (1)<br>explicit.stat_70969043 (1) | map_filters.map_blighted<br>map_filters.map_iir<br>map_filters.map_packsize<br>map_filters.map_tier<br>map_filters.map_uberblighted<br>misc_filters.corrupted<br>misc_filters.fractured_item<br>misc_filters.mirrored<br>misc_filters.split<br>trade_filters.price<br>type_filters.rarity |
| twice-corrupted | pseudo.pseudo_map_more_scarab_drops (1)<br>explicit.stat_2896557935 (1) | map_filters.map_blighted<br>map_filters.map_iir<br>map_filters.map_packsize<br>map_filters.map_tier<br>map_filters.map_uberblighted<br>trade_filters.price<br>type_filters.rarity |
| unidentified | 없음 | map_filters.map_blighted<br>map_filters.map_tier<br>map_filters.map_uberblighted<br>misc_filters.corrupted<br>misc_filters.foulborn_item<br>misc_filters.fractured_item<br>misc_filters.identified<br>misc_filters.mirrored<br>misc_filters.split<br>misc_filters.vestigial<br>trade_filters.price<br>type_filters.rarity |
| unique | 없음 | map_filters.map_blighted<br>map_filters.map_tier<br>map_filters.map_uberblighted<br>misc_filters.corrupted<br>misc_filters.foulborn_item<br>misc_filters.fractured_item<br>misc_filters.identified<br>misc_filters.mirrored<br>misc_filters.split<br>misc_filters.vestigial |
| viridian | explicit.stat_1975119765 (19)<br>explicit.stat_2788592463 (1) | map_filters.map_blighted<br>map_filters.map_iir<br>map_filters.map_packsize<br>map_filters.map_tier<br>map_filters.map_uberblighted<br>misc_filters.corrupted<br>misc_filters.fractured_item<br>misc_filters.mirrored<br>misc_filters.split<br>trade_filters.price<br>type_filters.rarity |

수정 전후 331건의 기본 활성 stat ID 및 item filter 값은 모두 동일했다. 이번에 바로잡은 폭주 옵션은 기본 비활성 위험 옵션이고, 역병 고정 속성은 기존 기본 필터 정책에서 생략되기 때문이다. 인식/ID 오류는 해소되었지만 기본 요청이 바뀌었다고 해석하면 안 된다.

아틀라스 획득물은 파싱되지만 기본 요청에 map_bonus로 추가되지 않는다. 희귀 확인 지도의 기본 요청은 희귀도·무리 규모와 특수 콘텐츠/획득물 조건을 선택하며 일반 위험 explicit은 꺼진다. 역병 지도는 기존 규칙대로 explicit stat 검색을 생략한다. 고유 지도 explicit을 기본 검색에서 생략하는 기존 정책도 유지했다.

## 두 번 타락 필드 및 리드 결정 필요

- twice-corrupted.json 20건 모두 corrupted=true와 doubleCorrupted=true를 가진다. extended에는 hashes와 text만 있고 전용 double-corruption stat hash는 없다. implicitMods의 유무/개수는 0개 5건, 1개 9건, 2개 6건이므로 “고정 속성 2개”로 두 번 타락을 추정하면 틀린다. extended.text의 실제 표시 라벨은 “두 번 타락”이다.
- 리드 결정 필요: 실제 클립보드의 “두 번 타락”을 별도 상태로 보존할지, 일반 isCorrupted로도 인식할지, 거래소의 해당 검색 필터와 UI를 어떻게 연결할지 결정해야 한다. 이번 재구성 헬퍼의 다운그레이드를 제품 지원으로 오해하면 안 된다.
- 리드 결정 필요: 고유 지도의 기본 검색이 이름/티어 위주이고 explicit 옵션을 생략하는 현재 정책을 유지할지 결정해야 한다. 확인 14건 및 미확인 6건 모두 예외는 없지만, 개별 고유 지도 옵션까지 기본 필터에 반영하는 정책은 이번 수정에 포함하지 않았다.
- 리드 결정 필요: unidentified 수집 쿼리의 지도 한정 조건을 바로잡고 재수집할지 결정해야 한다. 네트워크 금지 범위에서 입력 분류와 CI 오염 방지 검증까지만 수행했다.
- 남은 실제 입력 범위의 unknown/ID 오류/속성 오류/요청 예외는 0이다. 다만 이 20건씩의 표본이 게임 내 모든 지도·옵션을 대표하지는 않는다.

## CI와 재현

유형당 4~5건, 총 70건을 renderer/test/fixtures/listings/에 화이트리스트 방식으로 축소 저장했다. 지도는 69건이며 1건의 비지도 표본은 오염 분류 회귀용이다. 최초 발견 오류의 대표 문구·복합 ID를 모두 포함하며 nightmare는 지도/실낱/화폐 속성과 미확인을 포함하도록 골랐다. 계정·캐릭터·매물 ID·가격·메모·아이콘·league 및 extended.text를 제거했다.

기본 npm test는 이 CI 표본만 사용한다. 원본 out 디렉터리가 없어도 실행된다. MAP_AUDIT_FULL=1이면 원본 340건을 사용한다. MAP_AUDIT_DISCOVERY=1은 발견 단계에서 strict 오류 단언만 해제한다. 최종 전수 점검은 이 변수를 사용하지 않고 통과했다. MAP_AUDIT_OUTPUT에 경로를 지정하면 매물별 JSON 보고서를 쓴다.

PowerShell 전수 점검 예시(renderer에서):

```powershell
$env:MAP_AUDIT_FULL='1'
$env:MAP_AUDIT_OUTPUT=Join-Path (Get-Location) '../.codex-scratch/map-audit-after.json'
npm test -- --run test/maps-audit.ko.test.ts
Remove-Item Env:MAP_AUDIT_FULL, Env:MAP_AUDIT_OUTPUT
```

검증 결과:

- 전체 원본 strict audit: 17파일, 340건 분류 / 331지도, 통과.
- renderer npm test: 8파일, 36테스트 통과(기존 실제 한국어 3종 고급 지도 및 영어 회귀 포함).
- renderer npm run lint: 오류 0, 기존 미사용 eslint-disable 경고 4(RateLimiter.ts 1, common.ts 3).
- renderer npx --no-install vue-tsc --noEmit: 통과(설치 없이 로컬 실행).
- node --test tools/data-generator/src/stats/{csd,area-mods,invariants}.test.mjs: 13테스트 통과.
- 생성기 staging 출력과 en/ko 반영 데이터의 바이트 비교 일치.
- git, hc send, 서브에이전트, 네트워크, 패키지 설치를 사용하지 않았다.
