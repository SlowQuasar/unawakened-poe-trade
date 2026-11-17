# PHASE 2-2 — Kakao GGPK 게임 데이터 추출 PoC

작성: Codex · 2026-11-17 · 실제 로컬 실행, 네트워크 사용 없음.

## 결과

**한 Kakao 설치에서 영어·한국어 데이터를 동시에 읽을 수 있다.** BaseItemTypes/Mods/ClientStrings의 양쪽 파일과 공통 Stats, 영어·한국어를 함께 담은 StatDescriptions를 추출했다. 단, **설치된 `pathofexile-dat-schema`에는 실제 테이블 정의가 없어서 스키마 기반 열 해석은 미완료**다. 문자열 포인터 탐색 결과를 정식 스키마 해석 성공으로 계산하지 않는다.

| 질문 | 실제 실행 결과 |
|---|---|
| 1. GGPK의 번들 인덱스와 가상 경로 목록 | ✅ `Bundles2/_.index.bin` 해제, **3,013,550개** 경로. 파일 인덱스의 레코드 수도 동일 |
| 2. 영어 기본 및 한국어 테이블 | ✅ `data/*.datc64` **980개**, `data/korean/*.datc64` **241개**. 인덱스의 실제 표기는 소문자 |
| 3. BaseItemTypes en/ko 추출 및 조인 | ✅ 각각 **5,668행**, 유일한 문자열 ID 후보로 전 행 조인, 한국어 누락 **0개**. ❓ 스키마 해석은 정의 파일 부재로 미검증 |
| 4. Mods/Stats/ClientStrings | ✅ 행 수 및 문자열 샘플 확보. **`data/korean/stats.datc64`는 없음**. ❓ 각 열의 스키마 검증은 동일하게 미완료 |
| 5. StatDescriptions en/ko | ✅ `metadata/statdescriptions/stat_descriptions.csd` 한 파일에 기본 영어와 `lang "Korean"` 블록 존재 |

선행 `phase1/02-data-sources.md`, `03-impact-and-plan.md`를 읽었다. 3.30.0b라는 패치 정보는 선행 조사 결과이며 이번에는 GGPK의 패치를 독립 판독하지 않았다. 신규 Thread/Mycelium 데이터 존재는 직접 확인했다. 이번 작업은 PoC이며 앱 데이터 생성·교체를 수행하지 않았다.

## 실행 및 산출물

저장소 루트 PowerShell에서:

```powershell
node --check tools/data-generator/src/ggpk.mjs
node --check tools/data-generator/src/extract-poc.mjs
node tools/data-generator/src/extract-poc.mjs
```

기본 입력은 `C:\Daum Games\Path of Exile\Content.ggpk`. 다른 입력이나 **이미 확보한 로컬 스키마**를 사용할 경우:

```powershell
node tools/data-generator/src/extract-poc.mjs 'C:\Daum Games\Path of Exile\Content.ggpk' 'tools/data-generator/out/schema.min.json'
```

두 번째 명령은 사용법이며 실제 실행하지 않았다. 스키마가 주어지면 형식 버전·PoE1 적용 대상·열 크기 합과 실제 행 크기 일치를 검사하고 Id/Name/Text 열을 라이브러리 `readColumn`으로 읽는다. 이 선택 경로는 실제 스키마 입력이 없어 실행 검증하지 못했다. 조인 표는 현재 명령 모두 탐색 모드이므로 정식 생성기 조인으로 사용하면 안 된다.

추가한 구현:

- `tools/data-generator/src/ggpk.mjs`: `fs.open(path, 'r')`와 명시적 위치 `read`만 사용하는 GGPK 어댑터. 헤더, PDIR 자식 오프셋, FILE 본문 위치/길이를 따라 필요한 `Bundles2/*` 파일을 읽는다. 파일/레코드/디렉터리 범위를 검사한다.
- `tools/data-generator/src/extract-poc.mjs`: 기존 패키지의 `decompressSliceInBundle`, `readIndexBundle`, `unpackPaths`, `FileLoader`, `readDatFile` 사용. `FileLoader`의 `fetchFile` 인터페이스에 GGPK 어댑터를 연결한다. 네트워크를 쓰는 패키지 CLI는 호출하지 않는다.
- `tools/data-generator/.gitignore`: `out/` 제외.

실행 산출물은 모두 `tools/data-generator/out/` 안에 있다. `summary.json`은 입력 크기·mtime, 실행 시간, 메모리, 테이블 SHA-256, 경로, 샘플, 스키마 부재 사유를 담는다. `virtual-paths.txt`는 전체 경로 목록(193,219,337바이트), 7개 `.datc64`는 필요한 테이블 원본, `description-0.txt`는 CSD를 디코딩한 UTF-8 텍스트다. GGPK/번들 전체를 복사하거나 인덱스 원본을 저장하지 않았다.

## 성능과 읽기 전용 확인

Node v24에서 같은 명령을 3회 실제 실행했다. 아래는 **마지막 실행**이며 캐시가 따뜻한 실행이다. 최초 실행 전체 시간은 6.865초였다. `totalMs`는 요약 파일 최종 저장 직전까지의 시간으로 Node 시작 시간은 제외한다.

| 항목 | 측정값 |
|---|---:|
| GGPK 버전 / 파일 크기 | 3 / 79,851,505,154바이트 |
| 인덱스 FILE 압축 본문 | 75,396,165바이트 |
| 인덱스 해제 크기 | 101,048,630바이트 |
| 중첩 경로 표현 번들 해제 크기 | 86,178,838바이트 |
| 인덱스 읽기→전체 경로 배열 생성 | 1.004초 |
| 전체 추출 | 5.324초 |
| GGPK 누적 읽기 | 86,647,408바이트 (약 82.63 MiB) |
| 인덱스 단계 RSS | 762,904,576바이트 (약 727.56 MiB) |
| 프로세스 최고 RSS | 1,463,349,248바이트 (약 1.363 GiB) |

전체 경로 301만 개를 JS 문자열로 펼치고 한 텍스트로 합쳐 쓰므로 인덱스 압축 크기보다 메모리 사용이 크다. 번들 파일은 필요한 것만 읽고 라이브러리는 요청한 파일과 겹치는 청크만 해제한다. 본 구현에서는 경로를 디렉터리별로 순회하고 선택한 경로만 유지하며 경로 목록도 스트리밍 출력하는 것이 좋다. 현재 수치는 최소 메모리 요구량이 아니라 이 PoC의 실측이다.

게임 입력은 전부 `r`로 열었다. 실행 전후 GGPK 크기·mtime 비교는 `true`이며 mtime은 `2026-11-14T02:12:50.798Z`였다. 전체 80GB 해시 비교는 하지 않았다. 패키지 설치·git 명령·`hc send`·서브에이전트·네트워크·게임 실행은 하지 않았다. `renderer/`, `main/`, `.github/`, `phase2/01-*`는 수정하지 않았다.

## Data 경로와 언어

`data/`로 시작하는 가상 파일은 6,301개다. 하위 언어 폴더는 실제 인덱스 표기로 다음 9개다:

```text
french
german
japanese
korean
portuguese
russian
spanish
thai
traditional chinese
```

기본 영어는 `data/` 직속이다. 언어별 테이블 수가 다르므로 모든 기본 테이블에 한국어 경로가 있다고 가정하면 안 된다. PoC는 한국어 파일이 없을 때 영어를 묵시적으로 대체하지 않고 `Path not found (no fallback)`을 기록한다.

## BaseItemTypes 조인 10행

실제 경로 `data/baseitemtypes.datc64`, `data/korean/baseitemtypes.datc64`. 각각 행 수 5,668, 고정 행 크기 373바이트. 추출 크기는 en 2,989,464바이트, ko 2,901,082바이트다.

**아래는 스키마 미검증 탐색 결과다.** 고정 행 offset 0의 유효 UTF-16 문자열 포인터를 ID 후보로 읽었고 양쪽 모두 비어 있지 않으며 5,668개가 유일했다. 이 값으로 조인했으며 행 번호를 조인 키로 사용하지 않았다. offset 32의 표시명 후보는 문자열 포인터 탐색으로 얻었다. 실제 스키마가 이 필드를 Id/Name으로 정의하는지는 아직 검증하지 못했다. 표의 행 번호는 0부터 센 진단 정보다.

| ID 후보 (`Metadata/Items/` 이하) | en/ko 행 | en 표시명 후보 | ko 표시명 후보 |
|---|---:|---|---|
| `Jewels/JewelBlighted` | 2497 / 2497 | Mycelium Core | 균사체 핵 |
| `Currency/CurrencyMapQualityScarabs` | 30 / 30 | Maven's Chisel of Threads | 실낱의 메이븐의 끌 |
| `Currency/CurrencyAfflictionOrbScarabs` | 82 / 82 | Threaded Delirium Orb | 실낱을 꿴 환영의 오브 |
| `Currency/CurrencyStackedThread` | 213 / 213 | Frayed Thread | 해진 실낱 |
| `Threads/ThreadExpedition` | 3877 / 3877 | Expedition Thread | 탐험 실낱 |
| `Threads/ThreadAbyss` | 3878 / 3878 | Abyss Thread | 심연 실낱 |
| `Threads/ThreadBreach` | 3879 / 3879 | Breach Thread | 균열 실낱 |
| `Threads/ThreadRitual` | 3880 / 3880 | Ritual Thread | 의식 실낱 |
| `Threads/ThreadUltimatum` | 3881 / 3881 | Ultimatum Thread | 결전 실낱 |
| `Threads/ThreadLegion` | 3882 / 3882 | Legion Thread | 군단 실낱 |

나머지 신규 실낱도 검색됐다: Blight Thread → 역병 실낱, Bestiary Thread → 야수 도감 실낱, Betrayal Thread → 배신 실낱, Incursion Thread → 기습 실낱. 이름 검색은 해당 패치의 신규 여부를 판정하는 규칙은 아니다.

## Mods / Stats / ClientStrings

행 수와 행 크기는 라이브러리 `readDatFile`의 실제 결과다. 아래 문자열은 명시한 바이트 offset의 탐색 결과이며 **스키마가 확인한 열 이름이 아니다**. 일반 포인터 탐색은 정수/FK를 문자열로 오인할 수 있으므로 `summary.json`의 다른 후보 offset을 그대로 사용하지 않는다.

| 테이블 | en 행 수 | ko 행 수 | 고정 행 바이트 |
|---|---:|---:|---:|
| Mods | 41,324 | 41,324 | 692 |
| Stats | 23,630 | 한국어 경로 없음 | 105 |
| ClientStrings | 8,649 | 8,649 | 52 |

Mods의 `data/mods.datc64`, `data/korean/mods.datc64` 앞 3행:

| 행 | offset 0 (en/ko 동일) | offset 98 en | offset 98 ko |
|---|---|---|---|
| 0 | Strength1 | of the Brute | - 짐승 |
| 1 | Strength2 | of the Wrestler | - 씨름꾼 |
| 2 | Strength3 | of the Bear | - 곰 |

Stats의 `data/stats.datc64` 앞 3행:

| 행 | offset 0 |
|---|---|
| 0 | level |
| 1 | item_drop_slots |
| 2 | main_hand_weapon_type |

한국어 별도 Stats 파일이 없다는 것은 경로 목록에서 확인했다. Stats를 언어 공통 ID 테이블로 사용하는 설계는 합리적이지만, 이는 추후 스키마와 소비 관계로 확정해야 한다. 이 PoC는 한국어 Stats를 생성하거나 읽었다고 주장하지 않는다. 한국어 스탯 표시 텍스트는 아래 CSD에서 직접 확인했다.

ClientStrings의 `data/clientstrings.datc64`, `data/korean/clientstrings.datc64` 앞 3행:

| 행 | offset 0 (en/ko 동일) | offset 8 en | offset 8 ko |
|---|---|---|---|
| 0 | GameName | Path of Exile | 패스 오브 엑자일 |
| 1 | Error | Error | 오류 |
| 2 | FatalError | Fatal Error | 치명적 오류 |

## StatDescriptions

현재 경로는 `metadata/statdescriptions/stat_descriptions.csd`다. `.txt` 파일이나 별도 Korean 경로 대신 하나의 UTF-16LE BOM 파일(30,317,102바이트)에 여러 언어가 들어 있다. 디코딩 후 파일은 `out/description-0.txt`다. `stat_descriptions.csd`로 끝나는 관련 CSD는 48개이며 전부 경로를 기록하고, 본문은 정확한 기본 파일 하나만 읽었다.

파일 맨 앞:

```text
description
    1 %_chance_debilitate_on_hit_for_4_seconds_vs_enemies_on_full_life
    2
        100 "Debilitate Enemies you Hit that are on Full Life for 4 seconds" reminderstring ReminderTextDebilitate
        # "{0}% chance to Debilitate Enemies you Hit that are on Full Life for 4 seconds" reminderstring ReminderTextDebilitate
    lang "Thai"
```

동일 첫 description 안의 한국어 부분:

```text
    lang "Korean"
    2
        100 "생명력이 최대인 적 명중 시 4초 동안 쇠잔 유발" reminderstring ReminderTextDebilitate
        # "생명력이 최대인 적 명중 시 {0}% 확률로 4초 동안 쇠잔 유발" reminderstring ReminderTextDebilitate
    lang "French"
```

`lang "Korean"` 블록 시작은 전체 파일에 **10,677개**다. 기본 영어는 첫 언어 태그 이전의 조건·표시문구다. 이번에는 블록과 원문 접근만 확인했으며 CSD 문법 전체를 파싱하거나 앱 매처로 컴파일하지 않았다.

## 스키마 해석 실패 원인과 2-3 다음 단계

`pathofexile-dat@16.0.1`의 CLI 소스는 `fetch(SCHEMA_URL)`로 실제 테이블 정의를 가져온다. 설치된 `pathofexile-dat-schema@8.0.0`의 배포 파일에는 README, 타입 선언, `SCHEMA_VERSION = 7`, `ValidFor`, URL 상수만 있고 `schema.min.json`이나 `.gql` 정의가 없다. **패키지 버전 8.0.0과 스키마 형식 버전 7은 다른 값**이다. 저장소 파일명 검색에서도 로컬 정의를 찾지 못했다. 네트워크 금지 조건을 지키므로 다운로드를 시도하지 않았다. 자체 추측 스키마를 정식 스키마로 둔갑시키지도 않았다.

1. 리드가 해당 클라이언트에 맞는 **로컬 스키마 snapshot**을 공급한 뒤 위 선택 명령으로 재실행한다. 스키마 전체 정의·출처·패치·SHA-256을 고정하고 en/ko 모두 행 크기 합 및 Id/Name 열을 검증한다. 현재 선택 경로는 이 검증의 출발점이며 아직 검증된 기능이 아니다.
2. 스키마로 읽은 `BaseItemTypes.Id`를 기준으로 5,668행 재조인하고 표시명 후보를 `Name`과 대조한다. Mods/Stats/ClientStrings 역시 타입과 FK 범위를 검증한다. 한국어 경로 부재는 테이블별 공통 처리 정책으로 명시하며 번역 누락을 숨기지 않는다.
3. 전체 경로 배열 대신 선택 디렉터리·파일만 유지하고 번들 캐시/메모리 상한을 둔다. 실행 중 입력 변경은 단순 기록에 그치지 않고 본 생성기에서는 실패 처리한다. 현재 어댑터는 v3 실제 입력만 검증했다.
4. CSD에서 description별 기본 영어·Korean 블록, 다중 stat, 조건/고정값/부호/정밀도/참조 문법을 파싱한다. `map_stat_descriptions.csd`, `advanced_mod_stat_descriptions.csd` 등 관련 파일은 필요에 따라 추가 추출한다.
5. 이후 거래소 snapshot·수동 보정과 조합하여 기존 앱 계약에 맞는 IR/산출물을 만든다. 이번 결과로 클라이언트 영어 원천을 별도로 받는 단계는 초기 범위에서 불필요하지만, 다른 테이블의 모든 번역이 보장된 것은 아니다. 3.30 후보와 3.29 기준선 차이는 선행 계획의 수정 수락 기준으로 설명한다.

결론: **en/ko 동시 원천 확보는 실행으로 확인했다. 스키마 기반 생성기 착수 전에는 실제 정의 snapshot 공급과 재검증이 필요하다.**
