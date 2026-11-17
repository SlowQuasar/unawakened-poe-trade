# PHASE 2-0. 파서 Fixture 테스트 하네스

- 작성: Codex (Implementer), 2026-11-17
- 기준: `02-item-parsing.md`, `03-localization.md` §8, `phase1/03-impact-and-plan.md`

## 구조

| 파일 | 역할 |
|---|---|
| `renderer/vitest.config.mts` | Vite 설정의 `resolve`를 재사용해 `@`/`@ipc` alias 유지. Node 환경, 언어별 테스트 모듈 격리 |
| `renderer/test/global-setup.mts` | worker 시작 전에 기존 `makeIndexFiles()`를 한 번 실행해 인덱스 생성 |
| `renderer/test/setup.ts` | `fetch`를 `public` 내부 파일 읽기로 대체하고 종료 시 복구. 네트워크 요청 없음 |
| `renderer/test/parser-cases.ts` | 정적 기대값과 공통 검증. 각 모드의 순서·타입·stat ref 목록 전체 비교 |
| `renderer/test/parser.ko.test.ts` | `init('ko')` 후 실제 한국어 샘플 3건 검증 |
| `renderer/test/parser.en.test.ts` | `init('en')` 후 합성 영어 샘플 2건 검증 |
| `renderer/test/fixtures/ko/*.txt` | 사용자 제공 원문 3건의 바이트 단위 복사 |
| `renderer/test/fixtures/en/synthetic-*.txt` | 한국어 레어 목걸이·고유 갑옷과 대응하는 합성 고급 설명 형식 |

`test.env.BASE_URL`을 로컬 `public/`의 `file:` URL로 설정했다. 따라서 실제 `init()`의 동적 `client_strings.js` import와 데이터 fetch를 모두 그대로 실행한다. fetch는 상대 경로 검사를 통해 `public` 외부 파일을 거부하며, 파일이 없으면 테스트 초기화가 실패한다. `.index.bin`만 기존 빌드 생성기로 생성하며, 이 파일들은 기존 `renderer/public/data/.gitignore` 대상이다. ndjson/client_strings 등 원본 데이터는 수정하지 않았다.

언어마다 별도 테스트 파일에서 `init()`을 호출한다. Vitest `isolate: true`로 모듈 전역 조회 함수·문자열·지연 stat 검증 상태를 격리하며, 같은 파일의 테스트는 동시 실행하지 않는다. 언어 전환에 따른 상태 공유를 피한다.

## Fixture와 기대값

한국어 원문 3건 모두 원본과 복사본의 SHA-256 일치를 확인했다. 파일 읽기에는 trim을 사용하지 않는다. 각 Fixture를 LF와 CRLF 두 가지로 실행하되 줄바꿈 이외의 문자와 행 끝 공백을 보존한다. 영어 파일명에는 모두 `synthetic-`이 있고 개별 테스트 이름에도 `[synthetic]`를 표시했다. 영어는 실제 클라이언트에서 수집한 샘플이 아니다.

모든 테스트는 `isOk()`, rarity, category, `info.refName`, `info.namespace`, 모드별 stat ref와 타입, 빈 `unknownModifiers`를 검증한다. 고유 아이템은 `uniqueBase.refName`도 검증한다.

| Fixture | rarity / category | refName / namespace | 모드별 기대 stat ref |
|---|---|---|---|
| ko Cloak / en synthetic Cloak | Unique / Body Armour | Cloak of Flame / UNIQUE, 베이스 Scholar's Robe | explicit: `+#% to Fire Resistance`; `#% increased Ignite Duration on Enemies`; `#% of Physical Damage taken as Fire Damage`; `Reflects # Fire Damage to Melee Attackers` |
| ko amulet / en synthetic amulet | Rare / Amulet | Turquoise Amulet / ITEM | enchant: `Allocates Disciple of the Unyielding`; implicit: `+# to Dexterity and Intelligence`; explicit: `+# to maximum Life`, `Adds # to # Lightning Damage to Attacks`, `+#% to Damage over Time Multiplier`, `#% increased Global Critical Strike Chance`; crafted: `+#% to Fire and Chaos Resistances` |
| ko Nebulis | Unique / Sceptre | Nebulis / UNIQUE, 베이스 Void Sceptre | implicit: `#% increased maximum Energy Shield`, `Gain # Life per Enemy Killed`, `#% of Physical Attack Damage Leeched as Life`; explicit: `#% increased Implicit Modifier magnitudes`, `#% increased Cast Speed`, `#% increased Elemental Damage per 1% Fire, Cold, or Lightning Resistance above 75%` |

기대값은 §8의 정적 대조와 저장소 매처의 영문 ref를 확인해 고정했다. 테스트 실행 중 파싱 결과나 조회 테이블에서 기대값을 생성하지 않는다. 실제 파서 결과와 정적 기대값의 차이는 없었으며, `it.fails`/`todo`로 남길 파서 불일치는 발견되지 않았다.

## 실행 방법과 결과

이미 설치된 renderer 의존성을 사용했다. 추가 설치 없음.

```powershell
cd D:\Works\unawakened-poe-trade\renderer
npm test
npm run lint
```

최종 `npm test` 실행 출력 (종료 코드 0):

```text
> unawakened-poe-trade@0.0.0 test
> vitest run

 RUN  v2.1.9 D:/Works/unawakened-poe-trade/renderer

 ✓ test/parser.en.test.ts (4 tests) 32ms
 ✓ test/parser.ko.test.ts (6 tests) 38ms

 Test Files  2 passed (2)
      Tests  10 passed (10)
   Start at  22:29:40
   Duration  1.05s (transform 119ms, setup 21ms, collect 198ms, tests 70ms, environment 0ms, prepare 246ms)
```

통과 10, 실패 0, 건너뜀 0. 한국어 3건 × 줄바꿈 2종 = 6개, 영어 2건 × 줄바꿈 2종 = 4개다.

초기 하네스 실행에서는 `define`으로 지정한 BASE_URL이 Vitest 환경에 적용되지 않아 `/data/en/client_strings.js` import에서 두 suite가 초기화 실패했다(10개 테스트 미실행). 설정을 `test.env.BASE_URL`로 수정한 뒤 위 결과를 얻었다. 제품 코드나 파서 기대값 변경으로 회피하지 않았다.

`npm run lint` 실행 결과 (종료 코드 0):

```text
> eslint --ext .ts,.vue src

src/web/price-check/trade/RateLimiter.ts
  1:1 warning Unused eslint-disable directive
src/web/price-check/trade/common.ts
  62:3 warning Unused eslint-disable directive
  100:9 warning Unused eslint-disable directive
  120:7 warning Unused eslint-disable directive

✖ 4 problems (0 errors, 4 warnings)
```

기존 lint 명령은 `src`만 대상으로 한다. 기존 소스의 불필요한 eslint-disable 경고 4개는 변경하지 않았다. 테스트 파일은 이 lint 명령의 검사 범위 밖이다.

## 변경 범위와 한계

- 제품 코드(`renderer/src/`) 수정 **없음**. 기존 파서·필터·데이터 로더·인덱스 생성기를 그대로 사용한다.
- `renderer/package.json`에 `test: vitest run`을 추가했다. CI에는 renderer lint 다음, build 전에 `npm test`를 추가했다.
- 실제 한국어 샘플은 3건이며 영어는 합성 2건뿐이다. 영어 클라이언트 복사 원문 형식과의 일치는 향후 실제 샘플로 추가 검증해야 한다.
- 검증 대상은 현재 저장소의 3.29 데이터와 파싱이다. 3.30 신규 형식·아이템, 거래소 호출·필터 생성·UI·브라우저 fetch 동작은 이 테스트에서 검증하지 않는다.
- 인덱스 생성기는 기존 동작대로 en/ko 외 ru/cmn-Hant 인덱스도 생성하지만 실제 파싱 테스트는 en/ko만 수행한다.
- 타입 검사 및 lint의 테스트 파일 범위 확대는 하지 않았다. CI 전체 빌드는 이번 검증 범위 밖이며 로컬에서 테스트와 요청된 lint를 실행했다.
- git 명령, hc send, 서브에이전트, 네트워크를 사용하지 않았고 `tools/` 및 `phase2/02-*`는 수정하지 않았다.
