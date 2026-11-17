# 05. 보안 정적 감사

분석 기준: 2026-11-17 로컬 소스/lockfile. 실행·설치·테스트·빌드·네트워크 조회·npm audit는 수행하지 않았다. **확인된 사실**은 코드의 구성/검증 유무, **추정**은 악용 가능성/라이브러리 기본 동작, **미검증 — 후속 작업**은 실제 재현·배포 상태·취약점 DB 조회다. 위험도는 이 제품의 권한과 데이터에 대한 정성 평가이며 CVSS 점수나 재현 성공 판정이 아니다.

## 위험도 요약

집계: **Critical 후보 1 / High 4(H1,H3,H4,H5) / Medium 7 / Low 1**. C1은 H1+H3의 연쇄 시나리오를 별도로 표시한 **Critical 후보(재현 필요)**이며 독립 취약점이나 확정 Critical로 중복 집계하지 않는다. H2는 기본 loopback 조건에서 Medium, `--listen`으로 비-loopback에 노출하면 High로 평가한다.

| ID | 위험도 | 확인된 사실·근거 | 추정 영향 / 전제 |
|---|---|---|---|
| C1 | Critical 후보(재현 필요) | H1+H3 연쇄: 인증 없는 `/events` WS 클라이언트의 이벤트가 그대로 전달되고, `CLIENT->MAIN::update-host-config` 핸들러가 `cfg.logKeys`를 `shortcuts.updateActions()`에 넘긴다. true이면 게임 활성 여부 검사 없이 전역 keydown/up를 기록하고 `MAIN->CLIENT::log-entry`로 broadcast한다 (`main/src/server.ts:84`, `main/src/server.ts:87`, `main/src/server.ts:91`, `main/src/main.ts:43`, `main/src/main.ts:45`, `main/src/shortcuts/Shortcuts.ts:66`, `main/src/shortcuts/Shortcuts.ts:71`, `main/src/shortcuts/Shortcuts.ts:97`, `main/src/RemoteLogger.ts:13`) | **추정:** 악성 웹페이지가 localhost 포트를 찾고 WS 연결을 수립하면 유효한 host-config payload의 `logKeys=true` 설정 후 시스템 전체 키 입력 로그를 수신할 가능성. 브라우저 WebSocket은 일반 fetch CORS 검사 대상이 아니므로 loopback만으로 차단을 보장할 수 없다. 다만 브라우저의 로컬 네트워크 접근 정책·혼합 콘텐츠 제한·포트 탐지·설정 갱신 등에 따라 달라진다. **미검증 — PHASE 5에서 브라우저별 연쇄 재현 후 Critical 여부 확정** |
| H1 | High | HTTP/WS 인증·Origin·Host 검증 없음. `/events`의 JSON을 타입 단언 후 event bus로 전달 (`main/src/server.ts:69`, `:84`, `:87`, `:106`) | 앱 포트를 아는 로컬 프로세스 또는 연결이 허용되는 웹 페이지가 설정/호스트 설정/종료/업데이트/키 로깅/채팅 검색 기능을 호출하거나 로그·아이템 이벤트를 수신 가능. 기본 loopback도 브라우저와 로컬 앱에 대한 인증은 아님. 웹 악용은 브라우저 정책/포트 탐지 조건에 의존 |
| H2 | Medium | 정적 파일과 업로드 GET이 요청 경로를 `path.join` 후 그대로 read stream에 전달; 정규화 후 루트 포함 여부 검사 없음 (`main/src/server.ts:24`, `:32`, `main/src/host-files/file-uploads.ts:11`, `:13`) | raw 요청의 `..` 경로로 지정 루트 밖 파일 읽기 가능성. 브라우저는 URL의 `..`를 정규화하므로 웹 경유 악용이 어렵고, 기본 `127.0.0.1` 바인딩에서 raw 요청을 보내는 공격자는 이미 동일 사용자 권한의 로컬 프로세스라는 전제로 Medium으로 조정한다. loopback 자체가 OS 사용자 인증을 제공하는 것은 아니다. `--listen`으로 비-loopback에 노출하면 네트워크 공격자가 앱 권한으로 읽을 수 있는 파일에 접근할 수 있어 **High**로 상향한다 (`main/src/server.ts:118`, `main/src/server.ts:121`, `main/src/server.ts:129`). OS 구분자·실제 프로덕션 `__dirname`을 포함한 재현은 미검증 |
| H3 | High | `logKeys` true 시 전역 keydown/up를 게임 활성 여부 검사 없이 기록 (`main/src/shortcuts/Shortcuts.ts:66`). 기록은 전체 WS broadcast/새 연결 history로 전송 (`main/src/RemoteLogger.ts:10`, `main/src/server.ts:100`) | 사용자가 디버그 기능을 켜거나 H1로 host config가 변경되면 다른 앱의 비밀번호 등 입력 순서 노출 가능. 기본값 false (`renderer/src/web/Config.ts:160`) |
| H4 | High | Windows 서명 강제/독립 publisher 설정 없음, GitHub publish owner/repo 미지정, repository가 원본 (`main/electron-builder.yml:1`, `main/package.json:16`, `.github/workflows/main.yml:50`) | 공급자 오지정으로 원본 업데이트 수신, Release 계정/토큰 탈취 시 악성 실행 파일 공급 가능. 실제 설치 파일 서명 여부와 updater의 강제 검증은 미검증 |
| H5 | High | 사용자 쓰기 가능한 `userData/apt-data/cv-ocr`에서 `tesseract-core-simd.js`, `opencv.js`를 worker가 동적 import. digest/signature 확인 없음 (`main/src/vision/link-main.ts:10`, `:22`, `main/src/vision/wasm-bindings.ts:20`, `:24`). 배포 안내는 원본 Release zip (`docs/ocr-guide.md:9`) | 외부 OCR 아카이브가 변조되거나 해당 폴더에 쓰기 가능한 공격자가 있으면 앱 권한의 Node worker 코드 실행. 원격 자동 다운로드 RCE가 확인된 것은 아님. 사용자 수동 설치/로컬 쓰기 전제 |
| M1 | Medium | `webviewTag: true`, 원격 src 할당. `will-navigate`/`will-attach-webview` 허용목록 없음, 새 창 URL을 그대로 `shell.openExternal` (`main/src/windowing/OverlayWindow.ts:35`, `:53`, `renderer/src/web/price-check/PriceCheckWindow.vue:264`) | 원격 페이지 탐색/외부 프로토콜 호출 공격면. Node 권한 탈출이나 즉시 RCE는 확인하지 못함 |
| M2 | Medium | CSP meta/header 없음 (`renderer/index.html:3`, `main/src/server.ts:25`), contextIsolation/nodeIntegration/webSecurity를 명시하지 않음 (`main/src/windowing/OverlayWindow.ts:35`) | XSS 발생 시 방어층 부족과 H1 연결. Electron 기본값에 의존하며 옵션 확산/실효값은 실행 검증 필요 |
| M3 | Medium | 프록시는 호스트 allowlist를 사용하지만 입력 헤더 상당수를 전달, session cookie 사용, Partitioned 제거 (`main/src/proxy.ts:5`, `:26`, `:39`, `:56`) | H1과 결합 시 쿠키를 사용하는 허용 도메인 요청 대행. Cookie/Authorization 전달·리다이렉트·Set-Cookie 반환에 대한 경계와 파티션 격리 축소 검증 필요 |
| M4 | Medium | 복원 옵션 사용 시 120ms 후 기존 텍스트 복원, 게임 지연 시 복원된 비밀번호가 붙을 수 있다는 주석 (`main/src/shortcuts/HostClipboard.ts:7`, `:94`) | 채팅/검색 입력 지연으로 이전 민감 클립보드 텍스트가 게임에 입력될 가능성. 기본 복원 false (`renderer/src/web/Config.ts:130`) |
| M5 | Medium | Actions가 major tag 고정, main permissions 없음, pages는 모든 branch docs push 배포 (`.github/workflows/main.yml:17`, `:51`, `.github/workflows/pages.yml:3`, `:15`) | 외부 액션/설치 스크립트 공급망이 빌드나 GH_TOKEN/Pages 배포 권한에 도달. PR target 트리거는 없음. 실제 환경 보호와 기본 권한 미검증 |
| M6 | Medium | WS JSON parse 예외/스키마/메시지별 크기 정책 없음, 업로드 전체 메모리 버퍼·동기 디스크 쓰기, GET stream 오류 처리 없음, 로그 history 무제한 (`main/src/server.ts:87`, `main/src/host-files/file-uploads.ts:20`, `:32`, `main/src/RemoteLogger.ts:12`) | 비정상 요청/반복 업로드/키 로깅으로 서비스 거부·메모리/디스크 소모. 16MB 체크는 다음 chunk concat 전 기존 길이만 검사하여 엄밀한 상한 아님 |
| L1 | Low | poeprices 예측/피드백과 craftofexile 링크에 아이템 원문 전달 (`renderer/src/web/price-check/price-prediction/poeprices.ts:31`, `:90`, `renderer/src/web/item-check/hotkeyable-actions.ts:39`) | 예상 기능이나 제3자에 원문/리그/피드백을 보냄. Base64는 암호화가 아니며 URL 기록/서버 로그에 남을 가능성 |

## 클립보드·키보드·화면

**확인된 사실:** `HostClipboard.readItemText()`가 기존 텍스트를 읽고 아이템 텍스트를 48ms 간격/약 500ms 제한으로 폴링한다. 아이템/플랫폼 조건에서 클립보드를 비우거나 marker를 쓰며 복원 옵션에 따라 이전 텍스트를 다시 쓴다(`main/src/shortcuts/HostClipboard.ts:4`, `:36`, `:53`, `:63`). 임의 클립보드를 서버에 주기적으로 전송하는 코드는 확인하지 못했다. 인식한 아이템은 `last-active` WS 클라이언트에 전달한다(`main/src/shortcuts/Shortcuts.ts:161`). 복원은 텍스트만 처리하므로 이미지 등 전체 포맷 보존을 보장하지 않는다.

`restoreShortly()`는 텍스트를 저장하고 callback에서 채팅·검색용 텍스트를 쓴 뒤 120ms 후 선택적으로 복원한다(`main/src/shortcuts/HostClipboard.ts:86`). `typeInChat`/`stashSearch`는 Enter/Home/Delete/Ctrl+V 등의 키를 시뮬레이션하고 설정에 따라 Enter로 전송한다(`main/src/shortcuts/text-box.ts:16`, `:40`, `:55`). uiohook은 앱 ready 이후 계속 시작되며 글로벌 훅이다(`main/src/main.ts:51`). 단축키 등록은 게임 포커스를 따라가지만 H3의 디버그 훅에는 그 제한이 없다.

OCR 시 `GameWindow.screenshot()`이 overlay 네이티브 모듈의 screenshot을 호출하고 worker에 이미지 버퍼를 전송한다(`main/src/windowing/GameWindow.ts:48`, `main/src/shortcuts/Shortcuts.ts:180`, `main/src/vision/link-main.ts:37`). 해당 이미지의 네트워크 전송 경로는 소스에서 확인하지 못했다.

## 파일·프로세스 접근

| 대상 | 범위·근거 |
|---|---|
| 설정 | `userData/apt-data/config.json` 읽기·쓰기, 임시 `config.json.tmp`, 문자열 저장 전 스키마 검증 없음 (`main/src/host-files/ConfigStore.ts:8`, `:11`, `:28`) |
| 게임 로그 | 기본 Windows GGG/Steam `logs/Client.txt`, Linux Wine/Steam, macOS 경로 추정. 설정으로 임의 경로 전달 가능. 파일을 읽기 모드로 열고 기존 EOF부터 450ms poll하며 이후 줄을 모든 WS 클라이언트에 전송 (`main/src/host-files/GameLogWatcher.ts:8`, `:35`, `:57`, `:88`) |
| 게임 설정 | 기본 `production_Config.ini` 또는 전달된 경로를 UTF-8 read, ACTION_KEYS의 고급 설명 키만 파싱. 게임 설정에 쓰는 경로는 없음 (`main/src/host-files/GameConfig.ts:10`, `:34`, `:53`) |
| 업로드·로컬 HTTP | GET 정적 파일/업로드 파일, POST 이미지를 검증 없이 MD5+요청 확장자 이름으로 저장. MD5는 이름 생성 용도이며 인증/서명이 아님 (`main/src/host-files/file-uploads.ts:8`, `:18`, `:28`) |
| OCR | Node worker `vision.js`, 외부 JS/WASM·traineddata·BMP 로드 (`main/src/vision/link-main.ts:15`, `main/src/vision/wasm-bindings.ts:20`, `:33`, `main/src/vision/HeistGemFinder.ts:37`) |
| 외부 실행 | 런타임은 shell.openExternal(새 창, 브라우저 모드, tray localhost)과 shell.openPath(고정 설정 폴더) (`main/src/windowing/OverlayWindow.ts:53`, `:64`, `main/src/AppTray.ts:50`, `:57`). dev script spawn Electron, AppImage build hook execSync는 빌드 도구 경로 (`main/build/script.mjs:20`, `main/build/apprun-patch.test.mjs:8`) |

H2는 임의 파일 **읽기** 경로 분석이다. POST filename은 해시+확장자이므로 같은 근거로 임의 경로 쓰기까지 주장하지 않는다. 다만 업로드된 HTML/SVG/JS가 앱과 같은 origin으로 제공될 수 있어 MIME/다운로드 정책과 H1 결합을 후속 점검해야 한다.

## 네트워크 대상과 인증 정보

소스/정적 데이터/문서의 `http(s)://`, `fetch`, `Host.proxy`, `window.open`, `webview`, 동적 endpoint 및 lockfile `resolved`를 검색했다. URL 존재와 실제 자동 요청은 구분했다. 네이티브 모듈/외부 OCR 바이너리/라이브러리 내부의 전체 네트워크 행위는 이 소스 감사 범위 밖이며 미검증이다.

| 대상 | 요청 종류·전달 데이터·근거 |
|---|---|
| `www.pathofexile.com`, `ru.pathofexile.com`, `pathofexile.tw`, `poe.kakaogames.com` | 언어별 `poeWebApi()`, `/api/leagues?type=main&realm=pc`, `/api/trade/search/{league}`, `/api/trade/fetch/{ids}?query=...`, `/api/trade/exchange/{league}`. 검색 조건/아이템 속성/리그 및 세션 쿠키 (`renderer/src/web/Config.ts:86`, `renderer/src/web/background/Leagues.ts:53`, `renderer/src/web/price-check/trade/pathofexile-trade.ts:773`, `:806`, `renderer/src/web/price-check/trade/pathofexile-bulk.ts:69`) |
| `poe.ninja` | `/poe1/api/economy/current/dense/overviews?league=...&language=en`, 경제 상세/지원 페이지 링크 (`renderer/src/web/background/Prices.ts:54`, `:109`, `renderer/src/web/price-check/CheckedItem.vue:49`) |
| `www.poeprices.info`, `poeprices.info` | `/api`에 Base64 아이템·리그·source, `/send_feedback` POST에 피드백/아이템/가격. 외부 링크도 있음 (`renderer/src/web/price-check/price-prediction/poeprices.ts:31`, `:80`, `:90`, `renderer/src/web/price-check/CheckedItem.vue:48`) |
| `web.poecdn.com`, `webtw.poecdn.com` | 정적 items.ndjson의 icon URL. 이미지 바인딩으로 원격 CDN 요청 가능 (`renderer/public/data/en/items.ndjson:1`, `renderer/public/data/cmn-Hant/items.ndjson:165`, `renderer/public/data/cmn-Hant/stats.ndjson:2704`, `renderer/src/web/ui/ItemQuickPrice.vue:5`). 응답/설정 기반 image URL은 이 목록에 제한된다고 보장하지 않음 |
| `www.poewiki.net`, `poedb.tw`, `craftofexile.com` | 사용자 외부 열기: refName/slug/URL 인코딩한 아이템 원문 (`renderer/src/web/item-check/hotkeyable-actions.ts:31`, `:35`, `:39`) |
| GitHub 및 원본 Pages | updater GitHub 공급자, 원본 Releases/issues/다운로드, 수동 OCR zip. 실제 GitHub 다운로드 리다이렉트 CDN은 네트워크 금지로 미검증 (`main/electron-builder.yml:1`, `main/package.json:16`, `renderer/src/web/settings/about.vue:8`, `:42`, `docs/ocr-guide.md:9`) |
| `patreon.com`, `discord.gg` | 후원/커뮤니티 외부 링크 (`renderer/src/web/settings/SettingsWindow.vue:33`, `renderer/src/web/settings/about.vue:21`) |
| loopback HTTP/WS | 앱 `/config`, `/uploads`, `/proxy`, `/events`, 로컬 packaged data/i18n. renderer가 현재 origin의 ws/wss로 연결 (`renderer/src/web/background/IPC.ts:19`, `:55`, `:64`, `:74`, `renderer/src/assets/data/index.ts:78`, `renderer/src/web/i18n.ts:16`) |
| 문서·주석 참조만 | `i.imgur.com`, `imgur.com`, `poestack.com`, `support.apple.com`, `somsubhra.github.io`, `user-images.githubusercontent.com`, `gist.github.com`, `iconhandbook.co.uk`, `pathofexile.gamepedia.com`, `www.electron.build`, `www.electronjs.org` 등. 앱의 API 호출 대상으로 발견된 것은 아님. 아래 보충 표에 검색 위치 기록 |
| 의존성 공급 | 두 lockfile의 npm registry `resolved` URL, `integrity` 값. 설치 시 공급 경로이며 런타임 API 아님 (`main/package-lock.json:51`, `renderer/package-lock.json:50`). 실제 registry/다운로드 안전성·알려진 CVE는 미검증 |

프록시는 6개 호스트만 허용한다(`main/src/proxy.ts:5`). `official` 플래그는 허용 여부 판단 이후 별도 권한 분리에 쓰이지 않는다. `sec-*`, host, origin, content-length를 삭제하지만 cookie/authorization 헤더를 명시적으로 삭제하지 않고, `app.userAgentFallback`을 UA로 덮어쓴다. `useSessionCookies: true`와 defaultSession을 사용한다(`main/src/proxy.ts:23`, `:26`, `:32`). 응답 헤더를 그대로 로컬 응답에 복사하므로 Set-Cookie/리다이렉트/민감 헤더 노출과 최종 목적지 검증은 후속 대상이다(`main/src/proxy.ts:43`). Partitioned 속성 제거 hook은 공식 도메인에만 국한하지 않는다(`main/src/proxy.ts:56`).

**POESESSID:** main/renderer/ipc 검색에서 이 이름을 직접 저장·출력·입력받는 코드는 발견하지 못했다. 이것이 쿠키를 안 쓴다는 뜻은 아니다. 내장 브라우저/프록시의 Electron session cookie 경로가 있으므로 실제 cookie jar의 영속성, HttpOnly 쿠키 노출, 도메인 격리는 후속 검증해야 한다.

## Electron·원격 코드 실행 경계

- `app.enableSandbox()`는 명시되어 있다(`main/src/main.ts:25`). BrowserWindow는 라이브러리 `OVERLAY_WINDOW_OPTS`를 spread하고 자체 webPreferences에는 insecure content false/webviewTag true/spellcheck false를 둔다(`main/src/windowing/OverlayWindow.ts:30`). contextIsolation, nodeIntegration, sandbox, webSecurity의 창별 명시값은 없다. 현대 Electron 기본값이 각각 true/false/true/true일 것이라는 것은 **추정**이다. 설치된 라이브러리 코드와 실제 `getLastWebPreferences()` 확인이 필요하다.
- preload/contextBridge/ipcRenderer 노출 API는 저장소 소스에서 발견하지 못했다. 실제 권한 통로는 HTTP/WS이며 TS 타입은 런타임 검증이 아니다(`renderer/src/web/background/IPC.ts:36`, `main/src/server.ts:87`).
- production은 `http://localhost:${port}/index.html`, dev는 `http://localhost:5173`을 loadURL한다(`main/src/windowing/OverlayWindow.ts:59`, `main/build/script.mjs:43`). 기본 서버 바인딩은 127.0.0.1/동적 port, dev 8584이며 `--listen=[host][:port]`로 외부 인터페이스를 지정할 수 있다(`main/src/server.ts:118`). TLS/인증 없이 `0.0.0.0`에 열면 H1/H2의 접근 범위가 네트워크로 넓어진다.
- `<webview>`는 가격 확인 화면에 있고 `showBrowser(url)`이 src를 설정한다. 기본 `builtinBrowser: false`이나 기능을 쓰면 원격 페이지가 로드된다(`renderer/src/web/price-check/PriceCheckWindow.vue:53`, `:110`, `:264`). webview에 nodeintegration/preload를 지정하지는 않는다. 부모의 window-open 핸들러가 모든 webview의 새 창에도 동일하게 적용된다고 단정할 수 없다.
- `eval`, `innerHTML`, `v-html` 사용은 main/src·renderer/src 검색에서 발견하지 못했다. 따라서 API 문자열이 직접 eval되는 RCE 경로는 확인하지 못했다. H5는 별개의 실제 코드 import 경계다. Vue 텍스트 보간과 이미지 URL, webview 내 원격 JavaScript 실행을 OS 권한 RCE와 혼동하면 안 된다.

## 의존성·설치 스크립트·패치

| 영역 | manifest / lockfile에서 확인한 주요 버전 |
|---|---|
| main runtime native | `electron-overlay-window 4.1.0`, `uiohook-napi 1.5.5`; 훅·스크린샷·윈도 제어를 네이티브 모듈에 맡김 (`main/package.json:19`, `main/package-lock.json:2756`, `:5588`) |
| main bundled/build | Electron 40.10.6, electron-builder/app-builder-lib 26.9.0, electron-updater 6.8.3, esbuild 0.28.0, ws 8.20.0 (`main/package-lock.json:2647`, `:2665`, `:1448`, `:2842`, `:3050`, `:5763`). ini/comlink/BMP도 번들 의존 (`main/package.json:24`) |
| renderer | Vue 3.2.37, Vite 5.4.11, esbuild 0.21.5 (`renderer/package-lock.json:5513`, `:5446`, `:3029`); VueUse/vue-i18n/apexcharts/sockette/tippy 등 (`renderer/package.json:10`) |

lockfile에서 `hasInstallScript: true`인 항목을 모두 열거했다. 스크립트의 실제 body는 lockfile만으로 알 수 없으며 실행하지 않았다.

| lockfile | 패키지와 hasInstallScript 라인 |
|---|---|
| main | root `main/package-lock.json:10`; electron `:2651`; electron-overlay-window `:2760`; electron-winstaller `:2915`; esbuild `:3055`; uiohook-napi `:5592` |
| renderer | @vueuse/core/node_modules/vue-demi `renderer/package-lock.json:2426`; @vueuse/shared/node_modules/vue-demi `:2473`; esbuild `:3034`; fsevents `:3747`; unrs-resolver `:5368` |

`main/package.json:38`의 `allowScripts`는 electron:true만 명시한다. CI는 일반 `npm ci`이며 `--ignore-scripts` 또는 allowScripts enforcement 도구 호출이 없다. 따라서 이 키가 모든 다른 설치 스크립트를 막는다고 가정하면 안 된다. root postinstall이 patch-package를 실행한다(`main/package.json:9`). 패치는 AppImage X11 args만 바꾸지만 26.8.1 파일명과 잠긴 26.9.0이 다르다(`main/build/app-builder-lib+26.8.1.patch:1`, `main/package-lock.json:1448`). 적용 여부/네이티브 바이너리 출처/다운로드 무결성은 후속 확인 대상이다. 알려진 취약점 여부는 **미검증 — 후속 작업**이며 버전이 오래됐다는 이유만으로 CVE를 확정하지 않았다.

## CI·업데이트 공급망·로그

main Actions는 master push만, PR 및 pull_request_target 없음. 가변 major tag의 외부 액션과 npm ci/postinstall이 같은 job의 배포 단계에 선행한다. GH_TOKEN은 패키징 step env에만 명시되지만 이전 step이 workspace를 변조할 수 있으므로 공급망 신뢰 경계다(`.github/workflows/main.yml:3`, `:38`, `:44`, `:48`). 토큰을 명시적으로 echo하는 코드는 발견하지 못했다. main workflow에는 permissions가 없어 기본값을 확인해야 한다. Pages는 pages/id-token write, 모든 branch docs push, npm install이며 Environment branch 보호와 contents read를 확인해야 한다(`.github/workflows/pages.yml:3`, `:15`, `:24`).

업데이트의 sha512는 전송 파일 무결성과 연결되지만 게시 계정 탈취 후 악성 파일/메타데이터 동시 변경의 출처 인증을 제공하지 않는다. 소스의 서명 인증서·강제 검증 정책이 없고 mac identity는 null이다(`main/electron-builder.yml:32`). Windows 실제 서명/해시 검증 실패 동작은 미검증이며, 소스 교체 시 owner/repo와 서명 신원·캐시·채널을 함께 검토해야 한다. 자세한 흐름은 `04-build-and-update.md` 참조.

Logger는 이름과 달리 원격 서비스 전송 구현이 아니라 메모리 history 및 WS broadcast다(`main/src/RemoteLogger.ts:4`, `:10`). 명시적인 POESESSID/Authorization/Cookie 출력 코드는 발견하지 못했지만 key logging(H3), 전체 game-log broadcast, proxy `err.message`의 마스킹 부재는 주의해야 한다(`main/src/host-files/GameLogWatcher.ts:88`, `main/src/proxy.ts:49`). 전용 로그 파일 저장은 발견하지 못했다. err.message에 URL/민감값이 실제 포함되는지는 미검증이다.

## 보안상 가장 주의해야 할 부분 Top 5

1. **무인증 WS → 전역 키 로그 수신(C1, Critical 후보·재현 필요):** H1+H3 연쇄를 PHASE 5에서 브라우저별로 재현한다. 세션별 토큰, Host/Origin 허용목록, 이벤트 스키마·권한 검증과 `logKeys` 변경 통제를 도입하고 loopback 외 bind는 명시적으로 통제한다.
2. **파일 경로 탈출(H2):** URL을 안전하게 파싱하고 canonical root 포함 여부를 검사한다. 업로드는 타입/크기/총용량/비활성 콘텐츠 정책을 두고 같은 origin 실행을 제한한다.
3. **전역 키 로그(H3):** 게임 활성 범위 제한, 민감 입력 기록 방지, 자동 종료/보존 상한 및 로그 구독 인증을 적용한다.
4. **업데이트 출처·서명(H4):** 독립 owner/repo/appId를 명시하고 Windows 서명·검증 실패 시 거부·릴리스 계정 보호를 준비한다.
5. **사용자 폴더의 OCR 실행 코드(H5):** 신뢰한 배포에 포함하거나 서명/고정 해시 검증 후 사용하고 설치 안내의 원본 zip 의존을 해소한다.

## PHASE 4/5 조치

**PHASE 4 설계·수정:** 위 Top 5, 명시적 Electron 보안 옵션/CSP, webview 탐색/외부 프로토콜 allowlist, 프록시 쿠키/헤더/리다이렉트 정책, 최소 Actions permissions/SHA 고정/배포 branch 보호, 클립보드 복원 정책, 오류·로그 한도와 비밀 마스킹을 적용한다.

**PHASE 5 검증 — 현재 미수행:** 승인된 격리 환경에서 C1의 악성 웹페이지 → localhost 포트 탐지/WS 연결 → `CLIENT->MAIN::update-host-config`의 `logKeys=true` → 게임 외 입력의 `MAIN->CLIENT::log-entry` 수신 연쇄를 브라우저별 로컬 네트워크 접근 정책과 함께 재현하고 Critical 여부를 확정한다. 경로 탈출·다른 origin WS·비정상 JSON·큰 업로드·임의 listen 노출을 재현/차단 확인하며 H2는 기본 loopback과 비-loopback 조건을 나눠 평가한다. 게임 외 키 로깅/클립보드 지연·원본 앱 동시 설치·쿠키 분리를 확인한다. OCR 변조 파일 및 손상/타 게시자 업데이트 거부, Authenticode/메타데이터 hash 검증, CI 토큰/Environment 보호, 설치 스크립트/패치 적용과 의존성 취약점 DB를 확인한다. 네트워크가 필요한 검증은 모두 **미검증 — 후속 작업**이다.


## 문서·주석 URL 검색 위치 보충

| 호스트 | 근거 위치 |
|---|---|
| i.imgur.com / imgur.com | `README.md:14`, `docs/failed-load-leagues.md:5`, `docs/faq.md:26`, `docs/index.md:4`, `docs/no-item-mods.md:11`, `docs/nothing-happens.md:25`, `docs/ocr-guide.md:12`, `docs/quick-start.md:34` |
| poestack.com / support.apple.com / www.electronjs.org | `docs/faq.md:56`, `docs/download.md:24`, `docs/cmd-flags.md:23` |
| somsubhra.github.io / user-images.githubusercontent.com | `README.md:3` |
| gist.github.com / iconhandbook.co.uk | `renderer/src/parser/Parser.ts:1190`, `main/src/AppTray.ts:21` |
| pathofexile.gamepedia.com / www.electron.build | `renderer/src/web/price-check/filters/create-item-filters.ts:352`, `main/src/AppUpdater.ts:34` |
| 기타 개발 주석 URL | `renderer/vite.config.mts:6`의 vitejs.dev, `docs/.vitepress/config.js:22`의 github.com. 자동 런타임 호출이 아님 |
