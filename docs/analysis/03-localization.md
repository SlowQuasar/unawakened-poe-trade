# 03. 다국어(한국어) 지원 분석

- 작성: Claude Code (Architect) · PHASE 0 정적 분석 · 2026-11-17
- 표기: ✅ 확인된 사실(코드/데이터로 확인) · 🔶 추정 · ❓ 미검증(실제 한국어 클라이언트 샘플 미확보)

---

## 0. 핵심 결론 — 한국어 지원은 "신규 구현"이 아니라 "기존 구현 검증·보수"

**upstream Awakened PoE Trade는 이미 한국어 클라이언트를 공식 지원 언어로 포함하고 있다.** ✅

| 증거 | 위치 |
|---|---|
| 설정 언어 타입에 `'ko'` 포함 | `renderer/src/web/Config.ts:117` |
| 설정 화면에 "한국어" 선택지 | `renderer/src/web/settings/general.vue:9` |
| 한국어 클립보드 감지 `'아이템 종류: '` | `main/src/shortcuts/HostClipboard.ts:130-132` |
| 한국어 거래소 엔드포인트 `poe.kakaogames.com` | `Config.ts:95`, 프록시 허용목록 `main/src/proxy.ts:9` |
| 한국어 데이터 세트 | `renderer/public/data/ko/{items.ndjson, stats.ndjson, client_strings.js, app_i18n.json}` |
| 빌드 인덱스 대상 언어 | `renderer/src/assets/make-index-files.mjs:11` `['en', 'ru', 'cmn-Hant', 'ko']` |
| 한국어 거래 귓속말 파싱 정규식 | `renderer/src/web/client-log/client-log.ts:128` |

데이터 정합성(직접 측정) ✅:

| 항목 | en | ko |
|---|---|---|
| items.ndjson 고유 (namespace, refName) | 4,962 | 4,962 (차이 0) |
| stats.ndjson 고유 ref | 9,198 | 9,198 (차이 0) |
| 미번역 아이템명(name == refName) | — | 0 / 4,979 |
| client_strings.js 키 | 143행 | 143행 (키 구조 동일) |
| app_i18n.json(UI) 키 | 332 | 305 (**27개 누락** → 영어 fallback) |
| 마지막 데이터 갱신 | 2026-09-09 `543423a` | 동일 커밋 (3.29 기준) |

→ 마스터 프롬프트 PHASE 3의 목표 아키텍처(입력 텍스트 → 언어별 파서 → 공통 아이템 모델 → 거래소 Stat ID → Trade API)는 **이미 이 구조로 구현되어 있다.** "언어별 파서"는 별도 코드가 아니라 **언어별 문자열 테이블(`client_strings.js`) + 언어별 매처 데이터(`stats.ndjson`의 `matchers`)로 구동되는 단일 파서**이며, 공통 모델의 안정 키는 `refName`/`ref`(영문)와 `trade.ids`다.

**따라서 처음부터 다시 설계하지 않는다.** 남은 일은 (1) 실제 한국어 클라이언트에서 현재 무엇이 깨지는지 **샘플로 검증**, (2) 3.30 한국어 데이터 갱신, (3) 아래의 하드코딩·UX 공백 보수다.

## 1. 현재 지원 언어 ✅

| 구분 | 언어 |
|---|---|
| 아이템 파싱 + 가격 검색 | `en`, `ru`, `cmn-Hant`(번체), `ko` |
| 아이템 여부 감지만(파싱 불가) | `fr`, `de`, `pt`, `es`, `th`, `cmn-Hans` (`HostClipboard.ts:109-140`) |
| UI 번역 | `app_i18n.json` 존재 언어 (vue-i18n, `renderer/src/web/i18n.ts`, fallback `en`) — UI 번역은 Crowdin(`crowdin.yml`)으로 관리 |

## 2. 언어 판별·전환 방식 ✅

1. 메인 프로세스 `isPoeItem()`은 첫 줄로 언어를 **감지하지만 그 결과를 렌더러에 전달하지 않는다** — 아이템 여부 판정에만 사용 (`HostClipboard.ts:105-107`).
2. 파서 언어 = **사용자가 설정한 `AppConfig().language`** 하나뿐. `assets/data/index.ts:219` `loadForLang(lang)`이 해당 언어의 `client_strings.js`·ndjson을 로드한다.
3. 결과: 설정이 `en`인데 한국어 클라이언트에서 복사하면 → 아이템으로는 감지되지만 `parseNamePlate()`가 `_$.ITEM_CLASS`(`'Item Class: '`) 불일치로 `item.parse_error` 반환 (`Parser.ts:349-352`). **사용자에게 "언어 설정이 틀렸다"는 안내가 없다.** 🔶(코드상 추론, 실행 미확인)

## 3. 이름·옵션 매핑 구조 ✅

```
한국어 텍스트 "아이템 종류: 반지 / 아이템 희귀도: 희귀 / …"
  └ CLIENT_STRINGS(ko) 접두사 비교 → rarity, category, 섹션 속성
  └ ITEM_BY_TRANSLATED('ITEM', '<한국어 베이스명>') → BaseType { name: 한국어, refName: 영문 }
  └ 스탯 줄 → 숫자→# 치환 → STAT_BY_MATCH_STR_V2(한국어 매처) → Stat { ref: 영문, trade.ids }
  └ 거래소 요청: stats = trade.ids(언어 무관), name/type = useIntlSite ? refName(영문) : name(한국어)
  └ 엔드포인트: useIntlSite ? www.pathofexile.com : poe.kakaogames.com
```

- `t()` 헬퍼 `price-check/filters/create-item-filters.ts:507`: `useEn ? info.refName : info.name`
- `useEn`은 `AppConfig().useIntlSite` (`CheckedItem.vue:125`)
- 설정 UI: `general.vue:19` — 언어가 `en`이 아니고 realm이 `pc-ggg`일 때 "국제 거래소 사용" 체크박스 노출

## 4. 한국어 지원을 방해하는 하드코딩 / 공백

| 심각도 | 위치 | 내용 | 영향 |
|---|---|---|---|
| ✅ 해소(문제 아님) | `parser/advanced-mod-desc.ts:5-7` `SCOURGE_LINE=' (scourge)'`, `ENCHANT_LINE=' (enchant)'`, `IMPLICIT_LINE=' (implicit)'`; `Parser.ts:92` `VALUE_AUGMENTED=' (augmented)'` | 영어 접미사 하드코딩 | **실제 한국어 샘플(§8)에서 `(augmented)`, `(enchant)`가 영어 그대로 출력됨을 확인** → 수정 불필요. `(scourge)`/`(implicit)`는 샘플 미확보 🔶 동일할 것으로 추정 |
| 중간 | `client-log.ts:141` `'ko': /^_FIX_ME_$/` | 한국어 **대량 거래(bulk) 귓속말** 정규식 미구현 | 거래 요청 알림 기능에서 한국어 bulk 귓속말 미인식 |
| 낮음 | `Parser.ts:157-176` `normalizeName()` | Metamorph 장기 이름을 영어(`'Metamorph Brain'` 등)로 치환 후 `ITEM_BY_TRANSLATED`(번역명 조회)에 전달 | 비영어에서 Metamorph 샘플 조회 실패 가능 (구 리그 콘텐츠, 낮은 우선순위) |
| 낮음 | `web/item-search/WidgetItemSearch.vue:148` | 검색어 분할에 `cmn-Hant`만 예외 처리 | 한국어는 띄어쓰기를 쓰므로 대체로 문제 없음 🔶 |
| 중간 | `renderer/public/data/ko/app_i18n.json` | UI 키 27개 누락 (예: `settings.use_intl_site`, `filters.tier_gilded`, `item.split`) | 해당 UI가 영어로 표시 |
| 중간 | 언어 자동 감지 부재 | §2 참조 | 오설정 시 원인 불명 오류 |
| ❓ 높음 | `poe.kakaogames.com` 거래소 | 현재 운영 여부·API 호환성·리그 ID·Rate limit 정책 **미검증** | 동작하지 않으면 `useIntlSite`(영문명으로 국제 거래소 검색)가 유일한 경로 |
| ❓ | 한국어 realm과 국제 realm의 매물 공유 여부 | 국제 거래소 검색 결과가 한국어 클라이언트 사용자에게 유효한지 | PHASE 3 설계 결정에 직결 |

## 5. 거래소 API 언어별 지원 범위

| 엔드포인트 | 이름 검색 언어 | 스탯 ID | 상태 |
|---|---|---|---|
| `www.pathofexile.com` | 영어 | 공통 | ✅ 코드 경로 존재, ❓ 3.30 미검증 |
| `poe.kakaogames.com` | 한국어 | 공통 🔶 | ✅ 코드 경로 존재, ❓ 운영/호환 미검증 |
| `ru.pathofexile.com`, `pathofexile.tw` | 러시아어/번체 | 공통 | 범위 외 |

Stat ID가 언어 무관이라는 점은 upstream 설계(동일 `trade.ids`를 모든 언어 데이터가 공유)에서 확인된다 ✅. 단, 한국어 거래소가 국제 거래소와 **동일 시점에 3.30 스탯 ID를 반영하는지**는 ❓.

## 6. 수정이 필요한 모듈 (Q3 답변: 구조 변경 규모 = 작음)

| 모듈 | 변경 | 규모 |
|---|---|---|
| `renderer/public/data/ko/*.ndjson` | 3.30 데이터 갱신 (영어와 같은 파이프라인) | 데이터 — 생성기 확보 여부에 좌우 |
| `renderer/public/data/ko/client_strings.js` | 3.30 신규 문구 키 추가 (en과 동시) | 소 |
| `parser/advanced-mod-desc.ts`, `Parser.ts` | ~~영어 접미사를 `CLIENT_STRINGS` 키로 이전~~ → 샘플로 **불필요 확인** (§8) | 없음 |
| `main/.../HostClipboard.ts` + `ipc/types.ts` + `PriceCheckWindow.vue` | 감지한 클라이언트 언어를 이벤트에 실어 보내고, 설정과 불일치 시 안내(또는 자동 전환) | 소~중 |
| `client-log.ts` | 한국어 bulk 귓속말 정규식 | 소 (실제 샘플 필요) |
| `ko/app_i18n.json` | 누락 27키 번역 (Crowdin 흐름과 충돌 주의) | 소 |
| 테스트 | 언어별 Fixture 하네스(en/ko 동일 아이템 쌍) | 중 — 신규 |

**새 "한국어 전용 파서"나 별도 내부 모델은 필요 없다.** 오히려 만들면 영어 파서와 동작이 갈라져 리그마다 두 벌을 유지해야 한다. (upstream 비추종 결정과 무관하게 단일 파서 + 언어별 데이터 구조를 유지한다.)

## 7. 실제 샘플 수집 계획 (PHASE 3 선행)

실제 샘플 없이 정확성을 주장하지 않는다. 다음을 **사용자에게 요청**해야 한다:

1. 한국어 클라이언트에서 Ctrl+C한 텍스트: 일반/매직/레어/유니크 무기·방어구, 인챈트·임플리싯·커럽트·스커지·분열 옵션 보유 아이템, 주얼, 지도, 화폐, 젬(변형 포함), 카드, 3.30 신규 아이템
2. 동일 아이템의 영어 클라이언트 텍스트(가능하면) — en/ko 쌍 Fixture
3. 한국어 클라이언트의 대량 거래 귓속말 원문
4. `poe.kakaogames.com/trade`가 현재 정상 운영되는지, 리그 목록이 국제 서버와 같은지

## 8. 실제 한국어 샘플 정적 대조 결과 (2026-11-17, 사용자 제공 3건)

샘플 원문: `docs/analysis/samples/ko/*.txt` (PHASE 2 테스트 하네스의 첫 ko Fixture로 사용 예정)

**방법(중요):** 실제 파서를 실행하지 않았다(PHASE 0 — 설치 금지). 대신 스크립트로 ① 이름/베이스를 `ko/items.ndjson`에서 조회하고, ② 각 옵션 줄의 숫자·범위를 `#`로 치환한 후보를 `ko/stats.ndjson` 매처와 대조했다. 실제 `stat-translations.ts` 로직의 **근사치**이므로 "데이터 수준 대조 통과"이지 "파싱 성공"이 아니다.

| 샘플 | 이름/베이스 | 옵션 줄 대조 | 특이 형식 |
|---|---|---|---|
| `unique-body-cloak-of-flame.txt` 화염의 망토 / 학자의 로브 | ✅ `Cloak of Flame` / `Scholar's Robe` | ✅ 4/4 | `퀄리티: +7% (augmented)` — 접미사 영어 |
| `rare-amulet-anointed-crafted.txt` 터키석 목걸이(레어) | ✅ `Turquoise Amulet` | ✅ 6/6 + 기름 부여 `할당 완고한 신봉자 (enchant)` → `Allocates Disciple of the Unyielding` (`enchant.stat_2954116742\|64882`) | `(enchant)` 영어, 대가의 제작 접미어(`CRAFTED_SUFFIX`), `2(1-4)~40(40-43)` 범위 표기 |
| `unique-synthesised-sceptre-nebulis.txt` 성운 / 결합된 공허의 셉터 | ✅ `Nebulis` / `Void Sceptre` (`결합된 ` 접두 제거 = `ITEM_SYNTHESISED`) | ✅ 6/6 (`— 변경이 불가능한 값` = `UNSCALABLE_VALUE`, `75%를 초과하는 … 1%당`처럼 고정 숫자가 섞인 줄 포함) | 임플리싯 정보줄 3번째 칸 `96% 증가` = `MODIFIER_INCREASED`, 섹션 `결합된 아이템` = `SECTION_SYNTHESISED` |

결론:
- ✅ 한국어 클라이언트의 정보줄(`{ 고유 속성 부여 — … }`, `{ 접두어 속성 부여 "…" (등급: N) — … }`) 형식은 `ko/client_strings.js`의 `MODIFIER_LINE`·키들과 일치한다.
- ✅ `(augmented)`, `(enchant)`는 한국어 클라이언트에서도 영어 → 하드코딩 이슈 해소.
- ✅ 3.29 기준 한국어 데이터는 이 샘플들의 아이템·옵션을 모두 포함한다.
- ❓ 실제 파서 실행 결과(카테고리 판별, 변형 선택, 필터 생성, 거래소 응답)는 PHASE 2 하네스로 검증 예정.
- ❓ 미확보 유형: 젬(변형 포함), 지도, 화폐/스택, 주얼, 카드, 매직, 커럽트/분열/스커지/메아리(Eldritch), 3.30 신규 아이템.
