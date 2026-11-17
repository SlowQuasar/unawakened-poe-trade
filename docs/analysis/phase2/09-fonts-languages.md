# 글꼴 교체 및 지원 언어 정리

## 구현

- `renderer/src/assets/font.css`: 본문 `.font-poe`는 모든 언어에서 `"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`를 사용한다. `.font-poe-sc`와 공통 동작 버튼 `.btn`은 `"Marcellus SC"`를 먼저 사용하고 같은 한국어 스택으로 글자별 fallback한다. 기존 한국어 전용 덮어쓰기를 없앴으며 Exo2 정의는 유지했다.
- `App.vue`: 앱 전체의 기본 클래스를 `font-poe-sc`에서 `font-poe`로 변경해 일반 본문·설정·아이템 정보에 장식 글꼴이 상속되지 않게 했다.
- `ui/AppTitlebar.vue`: 제목 버튼에 `font-poe-sc`를 추가했다. 가격 확인 창의 리그 이름과 설정 창 제목에 적용된다.
- `price-check/CheckedItem.vue`의 Search 및 공통 `.btn` 버튼은 `font.css`의 `.btn` 선택자를 통해 장식 글꼴을 사용한다. 개별 Search 마크업 수정은 필요하지 않았다.
- `price-check/trade/TradeLinks.vue`: Trade 버튼에 `font-poe-sc`를 추가했다.
- `overlay/WidgetMenu.vue`: 위젯 메뉴 제목 텍스트에 `font-poe-sc`를 추가했다.
- `stash-search/WidgetStashSearch.vue`: 위젯 제목에 `font-poe-sc`를 추가했다.
- `settings/SettingsWindow.vue`: Save·Cancel 버튼에 `font-poe-sc`를 추가했다.
- `tools/licenses/collect-notices.mjs`: 이전 두 글꼴의 고지를 제거하고 Marcellus SC의 SIL OFL 1.1 고지와 `MarcellusSC-OFL.txt` 전문을 포함했다.
- 리드가 삭제한 언어 데이터 폴더와 이전 글꼴 파일은 재삭제하지 않았다. 최종 디렉터리에는 데이터 `en`, `ko`와 Marcellus SC·Exo2 글꼴만 남아 있음을 확인했다.

## 언어 및 설정 호환

- `make-index-files.mjs`의 LANGUAGES와 Config language 타입을 영어·한국어로 제한했다. 기본 언어는 한국어다.
- Config 버전은 19다. 저장된 `ru`, `cmn-Hant`, 구형 `zh_TW`는 한국어로 전환하고 국제 거래소 옵션을 false로 초기화하며 기존 leagueId를 지워 한국어 거래소에서 리그를 다시 선택하게 한다. 이전 realm 필드는 삭제한다. 영어·한국어 설정의 leagueId와 국제 거래소 선호는 유지한다.
- 버전 18 이전 설정의 useIntlSite 마이그레이션은 역사적 호환을 위해 유지한다. 버전 19 변환이 바로 뒤에서 제거된 언어와 realm을 정리한다.
- 설정의 언어 선택지는 English·한국어뿐이며 서버 선택 UI를 제거했다. 한국어 국제 거래소 옵션은 유지했다. 배경색 선택에 쓰이는 UiRadio는 유지했다.
- `poeWebApi`, 프록시 허용 호스트, 거래 귓속말 정규식, poedb 언어 매핑, 아이템 검색의 번체 분기, OCR 언어 매핑에서 러시아어·번체 지원을 제거했다.
- Leagues의 realm 반환값과 Prices의 realm 조건, 번체 상설 리그 이름을 제거했다. API URL의 `realm=pc`는 PC 리그를 지정하는 실제 API 인자이므로 유지한다.
- i18n 로딩은 영어 이외의 입력을 한국어로 정규화해 제거된 데이터 경로를 요청하지 않는다.
- `HostClipboard.ts`의 LANGUAGE_DETECTOR는 지시대로 그대로 유지했다.

## 검증

- `renderer`: `npm test` 통과 — 테스트 파일 5개, 테스트 28개. 추가한 `config-migration.test.ts` 6개는 제거 언어 전환, 영어·한국어 및 국제 거래소 옵션 보존, realm 삭제, 버전 17에서 연속 업그레이드를 확인한다.
- `renderer`: `npm run lint` 통과 — 오류 0개. 작업 범위 밖 `RateLimiter.ts`, `common.ts`의 기존 eslint-disable 관련 경고 4개는 남아 있다.
- `renderer`: `./node_modules/.bin/vue-tsc.cmd --noEmit` 통과. 네트워크·패키지 설치 금지에 따라 `npx vue-tsc --noEmit`과 동일한 설치된 로컬 실행 파일을 직접 사용했다.
- `main`: node_modules가 없어 지시대로 `tsc --noEmit`을 생략했다.
- `node tools/licenses/collect-notices.mjs "$env:TEMP\unawakened-fonts-langs-notices.txt"` 성공 — 패키지 131개. 생성 결과에 Marcellus SC OFL 전문이 포함되고 이전 두 글꼴 이름은 없는 것을 추가 확인했다. 패키지 라이선스 원문 파일 누락 안내 12개는 생성기가 출력하며, main 의존성이 설치되지 않은 상태를 포함한다.
- 전체 저장소 대상 `rg --hidden` 검색에서 docs/analysis, tools/data-generator, node_modules, .git, dist, package-lock을 제외했다. `cmn-Hant`, `'ru'`, `Fontin`, `FrizQuadrata`, `pc-garena`의 남은 참조는 Config의 설정 마이그레이션, 그 회귀 테스트, 유지하도록 지정된 HostClipboard 감지기뿐이다. 삭제한 글꼴 참조는 없다.
- 실행 중인 앱의 화면 렌더링 검증은 수행하지 않았다. 글꼴 적용은 CSS 선택자와 Vue 템플릿 연결을 확인했다.

## 범위 준수

- git, hc send, 서브에이전트, 네트워크, 패키지 설치를 사용하지 않았다.
- `renderer/src/web/price-check/trends/PriceTrend.vue`와 `tools/data-generator`는 수정하지 않았다.
- 중단 전 루트에 만들었던 임시 편집 스크립트는 리드가 삭제했으며, 이후 임시 스크립트를 추가로 생성하지 않았다.
