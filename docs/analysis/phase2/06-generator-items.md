# PHASE 2-6 — en/ko items 생성기

작성: Codex · 2026-11-17 · 로컬 3.30.0b GGPK, 네트워크·설치 없음.

## 산출물과 실행

`tools/data-generator/src/items/build.mjs`로 7개 namespace의 전체 병합 데이터를 생성했다. 제품 데이터는 교체하지 않았다.

```powershell
node tools/data-generator/src/items/build.mjs
node tools/data-generator/src/items/verify.mjs
```

- 구현: `src/items/build.mjs`, `tables.mjs`, `verify.mjs` — 모두 `tools/data-generator/` 기준.
- 데이터: `tools/data-generator/out/staging/{en,ko}/items.ndjson`.
- 상세 보고서: `tools/data-generator/out/staging/items-report.md`.
- 원천·테이블 해시·조인·제외 후보: `items-evidence.json`.
- 검증: `items-validation.json`, `items-tests.log`, `items-reproducibility.json`.

`tables.mjs`는 기존 읽기 전용 `Ggpk` 어댑터와 설치된 `FileLoader`/DAT 라이브러리를 import한다. 공용 생성기 파일은 변경하지 않았다. 스키마 형식 7, PoE1 적용 대상, 모든 열의 크기 합과 실제 행 크기를 검사했다. 영어/한국어 조인은 FK가 가리키는 물리 행의 Id/HASH32/HASH16 일치를 검증한 뒤 수행했다. 읽은 테이블은 언어별 파일을 포함해 26개다.

## 생성 및 병합

| Namespace | 유지 | 변경 | 추가 | 기준선 전용 en / ko |
|---|---:|---:|---:|---:|
| AREA | 148 | 0 | 39 | 16 / 17 |
| CAPTURED_BEAST | 220 | 0 | 0 | 0 / 0 |
| DIVINATION_CARD | 455 | 0 | 14 | 0 / 0 |
| GEM | 820 | 3 | 3 | 1 / 1 |
| ITEM | 2,014 | 165 | 344 | 5 / 5 |
| MERCENARY_BUILD | 64 | 0 | 2 | 0 / 0 |
| UNIQUE | 1,258 | 0 | 225 | 1 / 1 |

유지/변경은 게임 원천과 조인된 기준선 행만 집계한다. 기준선 전용은 따로 보존한다. 언어별 추가는 **627행**, 최종 en **5,797행**, ko **5,798행**이다. `(namespace, refName, disc, unique.base)` 집합은 같다. 물리 행 수 차이는 기준선의 한국어 `Lost Ruins` 번역 alias 1행을 보존했기 때문이다. 양쪽 기준선의 `Voidborn Reliquary Key` 중복도 그대로 남긴다.

추가 627행 전체가 이번 패치에 새로 등장한 콘텐츠라는 뜻은 아니다. 기준선에서 빠졌던 예전 카드·고유·화폐 등도 포함한다. 전체 신규 목록과 기존 192행 delta 목록을 상세 보고서에 분리해 기록했다. 이름 변경 목록도 출력하며 이번 최종 실행의 변경 건수는 0이다.

- ITEM/카드: BaseItemTypes → ItemClasses. 기준선에서 category를 학습하고, Jewel/Cluster Jewel 같은 혼합 클래스는 기존 base별 category를 우선한다. ArmourTypes의 Armour/Evasion/EnergyShield/Ward Min/Max를 직접 사용한다. Width/Height는 1보다 클 때 출력한다. 신규 원천은 정확한 거래소 items/static 증거가 있는 대상으로 한정하며, 내부·미출시·거래 증거 부재 후보는 제외 사유와 함께 기록한다. 기준선에 매핑이 없는 ItemClass 29종은 추정 category를 만들지 않고 보고한다. 이는 패치에서 새로 생긴 클래스라는 판정이 아니다.
- UNIQUE: UniqueStashLayout → Words.Text2. Text는 내부 이름 또는 옛 철자가 남은 사례가 있어 표시명으로 사용하지 않는다. 보관함 슬롯이 없는 우상·성유물·조각은 Words에서 추가로 찾는다. 한국어 snapshot의 `{name,type}` 정확한 짝을 BaseItemTypes로 역조인한다. 원천에서 base가 불명확하면 기준선 값을 사용한다. 무거운 화살통의 `Heavy Quiver`/`Heavy Arrow Quiver` 번역 충돌은 근거 없이 선택하지 않는다.
- GEM: SkillGems → BaseItemTypes/GemEffects → GrantedEffects → ActiveSkills. 기본 젬 이름은 BaseItemTypes.Name이며, GemEffects.Name은 기본 젬에서 별도 문구일 수 있어 변성 젬에만 사용한다. TransfigureBase 관계를 검증해 transfigured/normalVariant를 채운다. Vaal은 IsVaalVariant로 판별한다.
- AREA: WorldAreas와 Maps의 지역 FK. 원천 미해결인 수중 지역 등은 기준선을 유지한다.
- 야수: BestiaryCapturableMonsters → MonsterVarieties. 비활성 신규 후보는 추가하지 않는다.
- 용병: MercenaryBuilds → MercenarySkills. 기존 mercenaryBuild는 그대로 보존하며 신규 2종에만 역할별 스킬을 생성한다.

기준선은 namespace/refName으로 묶고 방어 속성과 unique.base를 추가로 사용해 같은 이름의 원천을 선택한다. disc, tradeTag, tradeDisc, exchangeable, icon, unique.fixedStats/disenchantValue, area 전체, mercenaryBuild를 기준선 행별로 보존한다. 이름과 gem/armour/크기 등 게임에서 확인한 값은 갱신한다. 신규 tradeTag/icon은 snapshot 정확 일치에서만 가져오며, 이미지가 없으면 빈 문자열이다.

기준선 객체 키 순서는 유지한다. 신규 객체는 기존 compact JSON 형식을 따르고 LF와 마지막 개행을 보장한다. 기준선의 기존 정렬을 대조해 단순 코드 포인트 순서가 아닌 **영어 localeCompare** 순서임을 확인했다. namespace/refName을 영어 순서로 안정 정렬해 동명 disc 변형을 인접 배치하고 기존 우선순위를 유지한다.

## 필수 신규 젬과 고유

| 젬 | ko | maxLevel | 경험치 진행 근거 |
|---|---|---:|---|
| Arcane Link | 비전의 연결 | 20 | ItemExperienceType 10, GemProgression34, 레벨 1–20 |
| Quickstep | 빠른 걸음 | 1 | ItemExperienceType 12, GemProgressionSingleLevel, 레벨 1 |
| Fireball of Radiation | 방사능의 화염구 | 20 | Fireball의 ItemExperienceType 0, GemProgression1, 레벨 1–20 |

최대 레벨은 ItemExperiencePerLevel.ItemCurrentLevel의 최댓값이다. 효과 테이블의 40레벨까지 존재하는 스케일링을 최대 레벨로 오인하지 않았다. Convocation에는 옛 20레벨 효과와 현재 1레벨 효과가 함께 존재하므로 `ConvocationOld`를 현재 같은 이름의 정의보다 우선하지 않는다. 기준선 젬의 변경 3행은 Vaal Breach/Vaal Immortal Call/Vaal Lightning Warp의 vaal 플래그 보완이다.

신규 고유 11종 모두 영어·한국어 레코드와 거래소 name/type 짝을 확인했다.

| en | ko | base |
|---|---|---|
| Dreadmaidens' Sacrament | 공포의 마녀의 성체 | Basalt Flask |
| Putrid Seed | 구역질 나는 씨앗 | Mycelium Core |
| Hide of the Vendigo | 벤디고의 가죽 | Exquisite Leather |
| Unwilling Embrace | 내키지 않는 포옹 | Bone Ring |
| The Covetous Dark | 탐하는 어둠 | Eye Gouger |
| Corpse Rose | 시신 장미 | Imbued Wand |
| The Sword of Ages | 세월의 검 | Exquisite Blade |
| Ordered Fate | 순리의 운명 | Walnut Spirit Shield |
| Bane of the Apostate | 배교자의 파멸 | Judgement Staff |
| Mantle of Dreams | 꿈의 외투 | Twilight Regalia |
| Veil of Flesh | 육신의 장막 | Callous Mask |

## 단계별 검증 결과

1. 생성 명령이 GGPK 읽기부터 최종 출력까지 성공했다. GGPK 크기/mtime 불변은 true이며 전체 GGPK 해시는 계산하지 않았다.
2. 검증 스크립트가 기준선 5,170/5,171행의 존재와 관리 필드 보존, 언어별 identity 집합 일치, 동명 변형 연속 배치, 정렬·직렬화, 신규 젬과 고유, unique base 및 category 참조, normalVariant 참조를 확인했다.
3. `out/staging/test-workspace/renderer`에 제품 소스와 테스트를 복사하고 그 복사본의 items만 staging으로 교체했다. stats는 기준선 그대로 복사했다. 설치된 node_modules는 junction으로 재사용했다. 기존 global setup과 파서 테스트를 그대로 실행해 **2개 파일, 18개 테스트가 모두 통과**했다.
4. 검증 실행 전후 원본 renderer의 node_modules를 제외한 226개 파일을 SHA-256 manifest로 비교해 전부 동일함을 확인했다. 작업 지시의 git 금지가 있으므로 `git diff`는 실행하지 않았으며 바이트 해시 비교로 대신했다. renderer/public/data를 덮어쓰지 않았다.
5. 생성기를 재실행해 en/ko items, 상세 보고서, 원천 evidence의 SHA-256이 모두 동일함을 확인했다.

| 언어 | 기준선 SHA-256 | staging SHA-256 |
|---|---|---|
| en | 3bf966bbd8a76653358cccb83d4dd8425b0bc2f071008175ede60db4d72e5031 | da5d076ced67f9294c1af0b5078a2fe6cd8448a246ef5875d4e4c9a55a55f9af |
| ko | 1521fc42fc71665cd7278cba53f7e2cfffc1e49e5e9a03917144db6b2b2df828 | acddb4cd98c41ae2484f6428ffac0984b2c1b199b3daccabaef1c4b97eb50931 |

기준선에만 남는 항목은 삭제하지 않는다. 전체 소스 후보를 무조건 사용자 아이템으로 노출하지 않으며, 제외 목록과 미해결 조인은 evidence에서 리뷰할 수 있다. 기존 stats, renderer, main, .github, stats 생성기 및 공용 GGPK 파일은 수정하지 않았다. git, hc send, 서브에이전트, 네트워크, 패키지 설치는 사용하지 않았다.
