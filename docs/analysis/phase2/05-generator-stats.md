# PHASE 2-5 — en/ko stats 데이터 생성기

2026-11-17, 로컬 Kakao 3.30.0b 설치 대상으로 실행했다. 생성 코드는 `tools/data-generator/src/stats/`에만 추가했고, 산출물은 `tools/data-generator/out/staging/`에 있다. 앱의 기준선 `renderer/public/data/{en,ko}/stats.ndjson`은 교체하지 않았다. 네트워크, 패키지 설치, git, 서브에이전트, `hc send`는 사용하지 않았다.

## 실행

저장소 루트에서 기존에 설치된 Node 및 의존성으로 실행한다.

```powershell
node tools/data-generator/src/stats/build.mjs
node --test tools/data-generator/src/stats/csd.test.mjs tools/data-generator/src/stats/invariants.test.mjs
node tools/data-generator/src/stats/verify.mjs
```

`build.mjs`의 선택적 첫 인자는 GGPK 경로다. 기본값은 `C:\Daum Games\Path of Exile\Content.ggpk`다. 캐시 추출본에 의존하지 않고 매번 GGPK에서 CSD를 읽는다. 마지막 생성 실행의 시간은 **4,651 ms**다. 최근 반복 실행은 약 4.5–5.2초였다. 시간은 Node 시작과 테스트 실행을 제외한 생성 함수 내부 측정이다.

## 구성과 원천

- `source.mjs`: 기존 `ggpk.mjs`와 설치된 `pathofexile-dat`의 `FileLoader`, 인덱스/번들 해제 함수를 재사용한다. 게임 파일은 `r`로만 열며 크기·mtime이 읽기 전후 동일한지 확인한다.
- `csd.mjs`: description, stat ID 배열, 언어별 조건/템플릿/핸들러/인자/reminderstring, include, no_description을 IR로 보존한다. 개수나 문법이 틀리면 실패한다. 실제 원천의 `!0`, `1|99#`도 IR에 보존한다.
- `build.mjs`: 영어 ref 추론, en/ko 매처, 거래소 ID 연결, 기준선 병합, 충돌 검사, 직렬화, 보고서 생성을 담당한다.
- `verify.mjs`: renderer의 소스·테스트·데이터를 staging 아래 독립 디렉터리로 복사하고 기존 의존성에 junction을 연결한다. `global-setup.mts`는 복사본에서도 그대로 사용하여 복사본의 인덱스만 생성한다. Vite 캐시는 복사본 `.validation-cache`로 보낸다.

원천은 **23개 CSD, description 13,417개**다. 기본 stat, map, advanced_mod 외에 heist_equipment, expedition_relic, sanctum_relic, tincture, necropolis, graft, atlas/atlas_relic/atlas_variant, leaguestone, sentinel, legion, harvest, primordial_altar, vaal_side_area, deepwater 계열 4개, passive_skill을 포함한다. 기본 설명만으로는 지도·강탈·리그·고급 설명의 기준선 매처를 설명하지 못하므로 이 계열을 추가했다. skill/monster 전용 설명은 아이템 문맥을 덮어쓸 수 있어 포함하지 않았다. include 대상은 이 원천 집합에서 직접 읽으므로 중복 재귀 확장은 하지 않는다. no_description은 문맥별 억제 정보로 보고서에 남기며 다른 문맥의 기본 설명을 전역 삭제하지 않는다.

이번 생성은 CSD 자체의 stat ID로 언어를 연결하므로 `.datc64` 열이나 `schema.min.json`의 열 정의를 사용하지 않는다. 스키마를 사용한 척하거나 탐색 문자열 오프셋을 정식 열로 취급하지 않는다.

## ref와 매처

1. 영어 `canonical_line`이 있으면 우선한다. 없으면 비음수 방향의 수치 템플릿, 그다음 첫 변형을 사용한다. `{0}`, `{0:+d}`, `{}`, `{:d}`, `{:+d}`를 지원한다. ref에서는 명시적 양수 부호를 `+#`로 유지하고 매처에서는 `#`로 만든다. 앱 파서가 숫자 부호를 함께 추출하기 때문이다.
2. 게임 링크 `[대상|표시명]`은 표시명으로, `[표시명]`은 표시명만 남긴다. 이스케이프된 개행·따옴표를 복원한다.
3. negate 계열 핸들러와 canonical 방향으로 `matcher.negate`를 정규화한다. 변수 없이 단일 stat 조건이 고정값이면 `value`를 만들며 milliseconds/divide 등 표시 단위 변환을 적용한다. 수치형 ref의 100% 고정 문구는 100 roll을 유지한다. 수치가 없는 독립 flag ref에는 인위적인 1 roll을 붙이지 않는다.
4. NPC enum처럼 서로 다른 고정 문구는 영어 템플릿별 별도 description으로 나누고 **조건 배열**로 한국어를 연결한다. 줄 순서가 같다는 가정으로 번역하지 않는다.
5. baseline ref → 영어 baseline 매처 → 유일한 기존 거래소 ID 순으로 기존 identity를 찾는다. 따라서 `Every 3 seconds, Consume a nearby Corpse to Recover #% of Life`라는 기존 ref는 유지하면서 현재 `within 5 metres` / `5미터 내` 매처를 추가할 수 있다. 문구 변경 때문에 기존 ref를 새 identity로 갈아 끼우지 않는다.

한국어 거래소 snapshot은 `tools/data-generator/snapshots/kakao-2026-11-17/stats.json`이다. 공백, CRLF, `+#`와 `#`, 링크 표기를 정규화하되 지역/범주 구분 문구는 임의 제거하지 않는다. 각 entry의 실제 type/ID를 사용하며 옵션은 `ID|option`으로 확장한다. ID 접두사를 복제하거나 숫자 해시를 추측하지 않는다. 반대 부호 문구와 numeric ref의 별도 boolean trade stat은 수동 inverted/group 정책 없이 신규 ID 원천으로 사용하지 않는다.

## 기준선 병합 정책

기준선 행·그룹 내부 순서·resolve·수동 필드를 복제해 보존한다. trade의 inverted/option 및 기존 type별 ID 배열은 그대로 두고 신규 ID만 뒤에 추가한다. 동일 매처 문자열의 기존 negate/value/advanced 정책도 유지한다.

게임에서 읽은 새 문구를 먼저 두고 이전 매처를 뒤에 보존한다. 과거 아이템의 문구가 사라졌다고 판정할 버전별 근거가 없으므로 모든 변경에서 레거시 매처를 보수적으로 남긴다. 각 결정의 ref, 연결 방법, 원천, 신규 문구, 보존 문구를 보고서에 기록한다. 원천과 연결되지 않은 baseline ref도 전부 유지한다.

기준선에 없는 ref는 거래소 ID가 있어야 추가한다. `better`는 영어 템플릿 방향으로 추정하고 보고서의 generated 목록에 표시한다. 같은 문구가 다른 행을 가리키게 되는 신규 충돌은 자동 그룹화하지 않고 보류한다. 한 description이 서로 다른 기존 identity를 섞는 경우도 보류한다. 한 언어에서 새 ref가 충돌하면 다른 언어에서도 보류하여 두 언어의 ref 집합을 맞춘다.

행은 첫 stat.ref의 ordinal 순서, 객체는 기존 키 순서, 새 stat은 ref/better/matchers/trade 순서, JSON은 공백 없는 한 행, LF 및 마지막 개행으로 직렬화한다. baseline의 기존 key 순서와 그룹 구조는 유지한다.

## 최종 수치

수치는 고유 ref 기준이다. “유지 + 변경”은 baseline ref 수와 같으며 baseline 전용은 별도의 겹치는 분류다. 추가 항목에는 과거 기준선에서 빠져 있던 항목도 포함되므로 전부 3.30 신설 옵션이라는 뜻은 아니다.

| 항목 | en | ko |
|---|---:|---:|
| baseline 고유 ref | 9,198 | 9,198 |
| 원천 description과 연결된 baseline ref | 5,518 | 5,518 |
| 원본에서 재생성됨 비율 | 59.99% | 59.99% |
| 유지 | 8,331 | 8,346 |
| 변경(매처 또는 trade ID 추가) | 867 | 852 |
| 신규 ref | 1,928 | 1,928 |
| baseline 전용, 보존 | 3,680 | 3,680 |
| 최종 고유 ref | 11,126 | 11,126 |
| nearby ref에 거리 문구 반영 | 105 | 106 |
| 충돌/보류 결정 건수 | 10 | 17 |
| FNV1a 서로 다른 문자열 해시 충돌 | 0 | 0 |

“재생성됨”은 지원 가능한 원천 description을 ref/영문 매처/유일한 안정 거래소 ID로 기존 ref에 연결했다는 의미다. 전체 baseline 매처와 수동 메타데이터를 게임으로부터 100% 복원했다는 의미는 아니다. 해시 검사는 `make-index-files.mjs`와 같은 설치된 `@sindresorhus/fnv1a`, UTF-8, 32-bit를 사용하고 ref 및 실제 인덱싱 대상(`advanced ?? string`)을 각각 확인한다. 동일 문자열 반복은 해시 충돌로 세지 않는다.

## 검증 결과

- node:test **10/10 통과**: CSD 문법·이스케이프·명시/암시 placeholder·조건·고정값·핸들러·언어 조인·잘못된 입력 실패, 모든 baseline 행/수동 필드/그룹 resolve/매처/기존 ID 보존, en/ko ref 집합, 정렬, 개행, 신규 ref의 ID 존재, 해시 충돌 검사.
- 변경 없는 baseline의 독립 복사본에서 기존 **18/18 통과**.
- staging stats를 사용한 독립 복사본에서 **18/18 통과**. 두개골 테스트의 기존 “unknown 2개”라는 알려진 미지원 기대값만 복사본에서 새 수락 조건으로 교체했다. 다른 테스트 기대값은 그대로다.
- `3.30-viscera-head-hungry-skull.txt`: 한 implicit mod 안에 stat **2개**, 생명력 roll **4**, 마나 roll **5**, `unknownModifiers=[]`를 실제 앱 파서로 확인했다.
- 검증 전후 `renderer/public/data` **모든 파일**의 SHA-256과 파일 목록이 동일했다. 작업 지시 상단의 **git 금지**를 지켜 `git diff`는 실행하지 않았으며, 그 수락 항목은 전체 파일 해시 비교로 대체했다. 원본 데이터의 교체/원복 과정 자체가 없다.
- 연속 생성한 en/ko NDJSON이 바이트 단위로 동일함을 확인했다. 최종 재현성 해시는 `stats-reproducibility.json`에 둔다.

검토용 파일:

- `out/staging/{en,ko}/stats.ndjson`
- `out/staging/stats-report.md`: 변경 매처 50개씩, 전체 baseline 전용 목록, generated 목록, 모든 충돌/보류, unsupported 핸들러 및 원천.
- `out/staging/stats-report.json`: 위 결정의 구조화된 전체 자료.
- `out/staging/stats-validation.json`: 두 테스트 실행의 전체 출력, 원본 데이터 SHA-256, 임시 복사본 경로.
- `out/staging/stats-reproducibility.json`: 연속 생성 결과 일치와 en/ko 해시.

## 남은 한계

이 구현은 완전 독립 생성기보다 **원천으로 문구를 갱신하는 기준선 병합 생성기**다. baseline 전용 3,680 ref에는 pseudo/용병/수동 접미사, 원천 범위 밖 설명, 이름 테이블 확장이 필요한 설명 등이 포함된다. 이들은 삭제하지 않고 리포트한다.

Timeless jewel 인명, passive_hash, support/skill index 이름 등 별도 테이블 조회가 필요한 핸들러는 일반 숫자 매처로 오인하지 않고 보류한다. 고정값 자동 환산은 단일 stat의 고정 조건에 한정한다. 여러 숨은 stat의 조합, lookup 이름, 복합 의미에 대한 범용 확장은 후속 작업이다. 원천 선택과 ref 추론은 baseline 표본·실제 테스트로 확인한 규칙이며 원래 비공개 생성기의 완전 재현을 주장하지 않는다.

새 `better`는 의미 방향의 추정값이고 신규 항목의 fromAreaMods/촉매/family/그룹 정책을 독립적으로 복원하지 않는다. generated 목록은 데이터 반영 전에 리드가 검토해야 한다. 기존 필드와 기존 거래소 ID 보존은 전체 데이터 검사로 확인했다. 매처 충돌은 사람이 그룹 전략을 정할 때까지 보류하며 전체 목록을 제공한다.
