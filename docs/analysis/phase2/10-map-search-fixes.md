# 3.30 지도 가격 검색 수정

## 구현

- `pseudo/maps.ts`: 아틀라스 획득물은 표시하되 기본 체크 해제. 요청된 검증 날짜 주석을 추가했다. 직접 체크하면 기존 `map_bonus` 경로를 사용한다.
- `client_strings.js`(en/ko), 문자열 인터페이스, `Parser.ts`: `MAP_MORE_THREADS`를 추가하고 `mapMoreScarabs`에 저장한다. 기존 갑충석 파싱을 유지했다. 거래소에서 검증된 `pseudo.pseudo_map_more_scarab_drops`를 그대로 사용한다. 영어 `More Threads: `에는 unverified 주석을 남겼다.
- `stat-translations.ts`: 빈 `()` 제거 바로 옆에서 리터럴 `(...)`만 제거한다. 임의 설명 괄호나 숫자 범위는 제거하지 않는다. 사냥꾼 샘플의 `25(20-30)`이 value=25/min=20/max=30으로 유지되는 것을 검증했다.
- `create-stat-filters.ts`: bulk 이외의 레어 지도에 implicit/explicit을 포함한다. 위험 옵션은 등급 1이어도 기본 해제한다. 시타델 ID 및 Wildwood, 파수꾼 3종, 환기자 3종, Mirage, Mirror of Delirium의 명시적 ref 목록만 기본 체크한다.
- `create-presets.ts`는 이미 식별된 비블라이트 레어 지도에서 props 프리셋을 기본 선택하므로 수정할 필요가 없었다. 실제 `createPresets`의 활성 프리셋을 통해 요청을 검증했다. bulk의 옵션 선택 규칙, 블라이트의 조기 반환, 고유 지도의 기존 규칙은 유지했다.

## 시타델 원인과 생성기 수정

읽기 전용으로 확인한 3.30 `metadata/statdescriptions/stat_descriptions.csd`의 `map_contains_citadel` description(약 324800행)은 다음 템플릿을 사용한다.

```text
English: "Map contains {0}" atlas_exile_citadel_index 1
Korean:  "지도에 {0} 등장" atlas_exile_citadel_index 1
```

기존 생성기는 이름 조회 처리기 `atlas_exile_citadel_index`를 unsupported로 보류했다. 따라서 baseline의 3.29 두 줄 매처만 남아 있었고, `(...)` 제거만으로는 해결되지 않았다.

`tools/data-generator/src/stats/build.mjs`의 `expandCitadelDescription`은 이 description만 확장한다. 영어 이름은 기존 baseline ref의 첫 줄, 한국어 문구와 옵션 ID는 로컬 Kakao snapshot의 항목을 사용하며, 양쪽 CSD 템플릿과 일치하는지 검사한다. 네 항목이 모두 없으면 생성에 실패한다. 확장 결과는 기존 stable-trade-id 병합 경로를 통해 기존 ref에 합쳐진다. 두 줄 레거시 매처도 보존한다. 기준선 override는 사용하지 않았다.

| 정복자 | 거래 ID |
|---|---|
| 바란 / Baran | `implicit.stat_2563183002\|1` |
| 베리타니아 / Veritania | `implicit.stat_2563183002\|2` |
| 알-헤즈민 / Al-Hezmin | `implicit.stat_2563183002\|3` |
| 드록스 / Drox | `implicit.stat_2563183002\|4` |

`node tools/data-generator/src/stats/build.mjs`를 실행한 뒤 staging의 en/ko `stats.ndjson`을 `renderer/public/data/{en,ko}/stats.ndjson`에 복사했다. 각 언어 파일은 Buffer.equals로 바이트 일치를 확인했다.

| 언어 | 바이트 | SHA-256 (staging = 반영 파일) |
|---|---:|---|
| en | 3125124 | `c75b9b8ffb33ad719036cb73d1a0b867f14fa6646b99a51696b55bd7fa64c9d0` |
| ko | 3182041 | `c4d3cf123313f768d3813629ec97c30ce1768a53bfe9b6a2c947e182ee7af9a9` |

## 검증

- `npm test`: 7개 파일, 35개 테스트 모두 통과.
- `npm run lint`: 종료 코드 0, 오류 0. 기존 `RateLimiter.ts`의 unused eslint-disable 1개와 `common.ts`의 unused eslint-disable 3개 경고가 있다.
- `npx vue-tsc --noEmit`: 종료 코드 0.
- `node --test tools/data-generator/src/stats/*.test.mjs`: 12개 테스트 모두 통과. baseline 매처/ID/그룹 보존, 양 언어 ref 정합성, 해시 충돌 부재를 포함한다.

추가 회귀 테스트는 다음을 확인한다.

- 악몽 지도 활성 props 프리셋의 실제 요청에 `map_bonus`가 없고, 실낱 95가 활성 `pseudo.pseudo_map_more_scarab_drops`로 전달된다. explicit 위험 옵션이 표시되며 기본 해제된다.
- 사냥꾼 샘플의 unknown이 비어 있고 시타델과 Wildwood가 기본 체크된다. 실제 요청에 `implicit.stat_2563183002|3`과 활성 Wildwood ID가 포함된다.
- 네 정복자의 en/ko 한 줄 문구와 `(...)`가 각각 올바른 거래 ID로 파싱된다.
- 모든 지정 콘텐츠 옵션은 기본 체크되며, 기존 갑충석 헤더도 계속 파싱된다.
- influence가 명시된 레어 지도에서 implicit을 props에 포함하지만 bulk의 기존 제외 규칙은 유지한다. 제공된 사냥꾼 샘플 자체에는 별도 influence 줄이 없으므로 bulk도 기존 일반 implicit 규칙에 따라 시타델을 포함한다.
- 블라이트·고유 지도 규칙 및 숫자 범위가 유지된다. 기존 Atlas Drops 샘플에서 기본 해제와 수동 체크 후 `map_bonus` 전달도 검증했다.

제공된 실제 지도 fixture 세 개는 수정하지 않았다. git, hc send, 서브에이전트, 네트워크, 패키지 설치를 사용하지 않았으며 게임 폴더에 쓰지 않았다. 거래소의 실시간 질의는 지시에 제공된 리드의 확인 결과를 근거로 사용했다.
