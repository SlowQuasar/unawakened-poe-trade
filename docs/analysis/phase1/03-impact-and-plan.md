# PHASE 1-03. 영향 분석·우선순위·PHASE 2 작업 계획 (종합)

- 작성: Claude Code (Architect/Reviewer) · 2026-11-17
- 입력: `01-3.30-changes.md`(Claude), `02-data-sources.md`(Codex, 리뷰 완료 §1), PHASE 0 문서
- 표기: ✅ 확인 · 🔷 공식 거래소 API로 확인 · 🔶 추정 · ❓ 미검증

## 1. Codex `02-data-sources.md` 리뷰 결과

| 항목 | 판정 |
|---|---|
| ndjson 필드별 원천 매핑(§2~3) | ✅ 실제 행 번호 근거로 정리됨. "후보 매핑"임을 명시한 점 적절. 생성기 설계의 기준 문서로 채택 |
| `advanced` 매처만 인덱싱(`make-index-files.mjs:30`), 마지막 개행 필수(`index.ts:43`) 등 함정 지적 | ✅ 코드로 확인. 생성기 검증 항목에 포함 |
| 로컬 클라이언트 3.30.0b, `Bundles2/_.index.bin` 존재, GGPK v3 | ✅ 수용 (헤더 3,106바이트만 읽음, 게임 파일 무변경) |
| §7 "거래소 API 8개 URL 모두 접근 불가" | ⚠ **정정**: Claude가 2026-11-17 직접 수신 — **Kakao 4개 엔드포인트 HTTP 200(한국어, 3.30 반영: `Covens` 리그, Thread, `viscera`, `unidentified_tier`/`twice_corrupted` 필터)**. 국제 호스트는 curl이 Cloudflare 403(브라우저/Electron 요청과는 별개). Codex 측 실패는 도구 접근 문제 |
| §8.3 "로컬 클라이언트가 3.30이므로 3.29 재현은 동일 입력이 아님" | ✅ **타당한 지적 — 수락 기준 수정**(§4) |
| 도구 권장(TypeScript + `pathofexile-dat` PoC, PoEDB는 교차 검증용) | ✅ 동의. 단 `ooz-wasm`은 GPL-3.0 → **개발 도구 전용**(앱 번들에 포함하지 않음)으로 격리하면 앱 MIT 배포에 영향 없음 🔶 |

## 2. 데이터 원천 결론

| 원천 | 역할 | 근거 |
|---|---|---|
| **로컬 Kakao 클라이언트** `C:\Daum Games\Path of Exile` (3.30.0b) | **한국어 텍스트·내부 ID의 주 원천** (BaseItemTypes, Mods, Stats, StatDescriptions, ClientStrings, Words …) | ✅ 존재·버전 확인. ❓ 번들 내부 `Data/Korean` 및 영어 테이블 동시 포함 여부는 PoC 필요 |
| 영어 원천 | Kakao 클라이언트에 영어가 없으면 **GGG 공식 패치 CDN에서 필요한 번들만 받는 방식**(`pathofexile-dat`가 지원하는 "patch 서버" 경로 🔶) | ❓ PoC |
| **Kakao 거래소 데이터 API** | 한국어 거래소 표시명, `trade.ids`, `tradeTag`(static), 카테고리/필터 | 🔷 동작 확인 |
| 국제 거래소 데이터 API | 영어 거래소 ID/이름 (앱 요청 경로와 같은 방식으로 수집) | ❓ curl 403 — 수집 방법 PoC 필요 |
| PoEDB | **교차 검증용**(사람이 확인). 한국어 페이지도 아이템명은 영어라 한국어 원천 불가, bulk export/약관 미확인 | ✅ |
| 수동 보정 파일 | `better`, StatGroup 전략, `disc`, 용병, 기름, 분해값, 아이콘 예외 등 | Codex §2.4 |

## 3. 영향 파일 목록과 구현 우선순위

**우선순위 기준:** ① 3.30에서 *지금* 오작동하는 것 → ② 신규 리그 핵심 아이템 → ③ 데이터 독립.

| 순위 | 작업 | 영향 파일 | 데이터 생성기 의존 | 실제 샘플 필요 |
|---|---|---|---|---|
| P1 | **텍스트 범위 `(...)` 처리** — 처리 안 하면 해당 옵션 줄 매칭 실패 | `parser/stat-translations.ts` | 없음 | ✅ 있으면 좋음 |
| P1 | **Twice Corrupted** 인식 + 필터 `twice_corrupted` | `Parser.ts` `parseCorrupted`, `ParsedItem.ts`, `client_strings.js`(en/ko), `create-item-filters.ts`, `pathofexile-trade.ts` | 문구만(수동 가능) | **필수** |
| P1 | **Item Tier** 인식 + 필터 `unidentified_tier` | 위와 동일 + 새 파서 함수 | 문구만 | **필수** |
| P1 | **"nearby" → "N미터 이내" 등 3.30 스탯 문구 변경** | `stats.ndjson`(en/ko) | **있음** | 검증용 |
| P2 | Thread 10종 + 해진 실낱 + 기타 신규 화폐(영혼 핵, 잉걸불, Royal Visage, 계략의 에센스 …) — bulk 검색 | `items.ndjson`(+`tradeTag`), `meta.ts` 카테고리 | **있음**(임시로 Kakao static에서 수동 추가 가능) | 1건 |
| P2 | **살덩이(Viscera)** 카테고리 `viscera.{head,arm,body,leg}` | `meta.ts`, `CATEGORY_TO_TRADE_ID`, `items.ndjson`, 필요 시 새 파서 | 있음 | **필수** |
| P2 | 균사체 핵 주얼 + 신규 고유 11종 + 신규 젬(비전의 연결, 빠른 걸음, Fireball of Radiation) + 신규 장신구 베이스 | `items.ndjson` | 있음 | 고유 1~2건 |
| P2 | 지도: Item Quantity → Atlas Drops, 신규 접미어, 델리리움 재련 모드, 지도 풀 교체 | `parseMap`, `client_strings.js`, `pseudo/maps.ts`, `map-check/*`, `stats.ndjson`, AREA | 있음 | **필수**(3.30 지도 1건) |
| P3 | 사원 방 개명(Cradle of Creation 등) | `pseudo/atzoatl-rules.ts`, `client_strings.js` | 문구만 | 연대기 1건 |
| P3 | 고유 아이템 변경 22종, 베이스 임플리싯 변경, 모드 계열 변경 | `items.ndjson` `fixedStats`, `stats.ndjson` | 있음 | — |
| 인프라 | **데이터 생성기** (§4) | `tools/data-generator/`(신규, 앱과 별도 package) | — | — |
| 인프라 | **테스트 하네스**(vitest) + en/ko Fixture | `renderer/` devDependency, `renderer/test/` | — | 샘플 활용 |

## 4. 데이터 생성기 수락 기준 (수정)

로컬 클라이언트가 이미 3.30.0b이므로 "3.29 파일 byte 재현"은 입력 버전이 달라 성립하지 않는다. 대신:

1. **구조 호환**: 생성물이 현재 파서/인덱서(`make-index-files.mjs`, `init()` 지연 검증)를 그대로 통과.
2. **기준선 대비 차이 설명**: (3.30 생성물) vs (3.29 저장소 파일) diff에서 **모든 삭제·변경이 3.30 변경 목록(`01`) 또는 명시적 수동 보정으로 설명**될 것. 설명 없는 삭제 0건.
3. **커버리지**: 3.29 파일의 고유 `(namespace, refName)` 4,962개, `Stat.ref` 9,198개 중 3.30에도 존재해야 할 항목의 유지율 리포트(레거시는 보정 파일로 유지).
4. **Fixture**: ko 실제 샘플 3건(PHASE 0) + 3.30 신규 샘플이 하네스에서 통과.

## 5. 예상 회귀 위험

| 위험 | 완화 |
|---|---|
| 데이터 교체 후 `init()`에서 `stat('…')` 참조 실패 → 앱 기동 불가 (`assets/data/index.ts:199-215`) | 생성기 검증 단계에서 코드의 모든 `stat()` 참조를 추출해 사전 검사 |
| 생성기 매처가 기존과 미세하게 달라 기존 아이템 인식률 하락 | 3.29 Fixture 회귀 세트 + 매처 diff 리포트 |
| 레거시 아이템(Scarab 등) 누락 → Standard 리그 가격 검색 불가 | 레거시 유지 보정 목록, 거래소 `map.scarab` 존속 확인 🔷 |
| 파서 체인에 새 파서 추가 시 섹션 가로채기 | 순서 테스트, 신규 파서는 고유 접두 문구로만 매칭 |
| fnv1a 32bit 해시 충돌(스탯 수 증가) | 생성 시 충돌 검사 리포트 |
| GPL 도구(`ooz-wasm`)의 앱 혼입 | 생성기를 별도 package로 격리, 앱 빌드 산출물 검사 |

## 6. PHASE 2 작업 계획 (승인 요청)

| 순서 | 브랜치 | 담당 | 내용 | 사용자 승인 필요 사항 |
|---|---|---|---|---|
| 2-0 | `test/fixture-harness` | Codex 구현 / Claude 리뷰 | renderer에 vitest 도입, `parseClipboard()` Fixture 하네스, ko 샘플 3건 + en 대표 샘플 | **npm 패키지 설치**(vitest 및 의존성 — 설치 스크립트 검토 후) |
| 2-1 | `fix/3.30-parser` | Codex / Claude 리뷰 | P1 코드 수정: `(...)` 범위, Twice Corrupted, Item Tier, 필터 2종 (샘플 받는 대로) | 실제 샘플 제공 |
| 2-2 | `tools/data-extract-poc` | Codex / Claude 리뷰 | `tools/data-generator/` 별도 package에 `pathofexile-dat` 고정 버전 설치 → Kakao GGPK 읽기 전용으로 인덱스 해제, `Data/` 경로·한국어/영어 테이블 존재 확인, BaseItemTypes 소량 행 en/ko 대조 | **npm 설치(GPL WASM 포함)**, **게임 데이터 읽기(쓰기 없음)** |
| 2-3 | `tools/data-generator` | Codex / Claude 설계·리뷰 | 생성기 본 구현(§4 수락 기준) | 2-2 결과 보고 후 |
| 2-4 | `feat/3.30-data` | Codex | 생성 데이터 적용 + P2/P3 | — |

**임시 조치 옵션(선택):** 생성기 완성 전, Thread·영혼 핵 등 P2 화폐 몇 종을 Kakao static 데이터로 `items.ndjson`(en/ko)에 수동 추가해 bulk 시세 검색을 먼저 살릴 수 있다. 수동 데이터는 생성기 완성 시 대체.

## 7. 사용자에게 요청할 실제 샘플 (한국어 클라이언트 Ctrl+C)

`01 §5`와 동일 — 우선순위 순:
1. Item Tier가 있는 **미확인** 레어/매직 장비
2. **두 번 타락** 아이템
3. **3.30 레어 지도**(신규 접미어 또는 Atlas Drops 표시)
4. **살덩이** 1개
5. **실낱** 1개(+ 해진 실낱)
6. **균사체 핵** 주얼
7. 범위가 `(...)`로 나오는 옵션, "N미터 이내" 옵션이 있는 아이템
