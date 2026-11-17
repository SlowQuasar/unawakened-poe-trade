# 04. 빌드·배포·자동 업데이트 정적 분석

분석 기준: 2026-11-17, 로컬 소스와 두 package-lock.json. **확인된 사실**은 파일에서 직접 읽은 설정/분기이며, **추정**은 도구 기본값에 의존하는 결과다. **미검증 — 후속 작업**은 설치·빌드·실행·네트워크가 필요한 사항이다. 이 단계에서는 해당 작업을 실행하지 않았다. `.git/HEAD:1`은 `docs/phase0-analysis`를 가리킨다. 최초 Git 상태 조회는 소유권 검사로 거부되었다. 최종 조회는 명령 1회에만 적용되는 `git -c safe.directory=...`로 수행했으며 전역 Git 설정은 변경하지 않았다.

## 앱 식별자와 산출물

| 항목 | 확인된 사실 / 추정 | 근거 |
|---|---|---|
| 패키지 이름·버전 | main `awakened-poe-trade`, `3.29.108`; renderer도 같은 이름, 버전 `0.0.0` | `main/package.json:2`, `main/package.json:3`, `renderer/package.json:2` |
| 표시 이름 | `productName: Awakened PoE Trade` | `main/electron-builder.yml:3` |
| appId / 실행 파일명 / artifactName | 명시 설정 없음. builder 기본값에 의존. appId가 `com.electron.awakened-poe-trade`, Windows 실행 파일이 `Awakened PoE Trade.exe`일 가능성은 **추정**이며 생성 설정으로 확인해야 함 | `main/electron-builder.yml:1`, `main/package.json:2` |
| Windows 설치 | NSIS + portable. `oneClick: false`, `allowToChangeInstallationDirectory: true`; perMachine·설치 경로·설치 GUID 명시 없음 | `main/electron-builder.yml:17` |
| 기타 플랫폼 | Linux AppImage(toolset 1.0.3), macOS universal dmg, `identity: null`, `x64ArchFiles: "*"` | `main/electron-builder.yml:5`, `main/electron-builder.yml:24` |
| 문서가 기대하는 아티팩트 | `Awakened-PoE-Trade-Setup-${version}.exe`, `Awakened-PoE-Trade-${version}.exe`, `Awakened-PoE-Trade-${version}.AppImage`, `Awakened-PoE-Trade-${version}-universal.dmg` | `docs/download.md:16`, `docs/download.md:17`, `docs/download.md:18`, `docs/download.md:19` |
| 패키징 파일 | main `dist/main.js`, `dist/vision.js`, renderer `dist`를 앱 루트에 배치하고 main을 `main.js`로 덮어씀. 네이티브 런타임 의존성은 builder의 의존성 수집에 의존 | `main/electron-builder.yml:8`, `main/electron-builder.yml:15`, `main/package.json:19` |

실제 설치 경로와 최종 파일명은 생성물을 보지 않았으므로 미검증이다. 기본 NSIS 사용자별 설치라면 `%LOCALAPPDATA%\Programs\awakened-poe-trade` 계열 경로가 예상되지만 이를 확정 경로로 사용하면 안 된다.

## 빌드 파이프라인과 패치

1. renderer: `npm run build`는 `vue-tsc --noEmit && vite build`이다(`renderer/package.json:8`). Vite는 Vue 플러그인, `webview` custom element, 데이터 인덱스 생성 플러그인을 사용하며 `esnext`, `assetsInlineLimit: 0` 설정이다(`renderer/vite.config.mts:8`, `renderer/vite.config.mts:15`).
2. main: `tsc --noEmit && node build/script.mjs --prod`(`main/package.json:7`). esbuild가 OCR worker를 `dist/vision.js`, main을 `dist/main.js`로 번들한다. Electron/uiohook/overlay는 external이다(`main/build/script.mjs:27`, `main/build/script.mjs:34`, `main/build/script.mjs:39`). 프로덕션 main은 minify하고 dev server URL을 null로 치환한다(`main/build/script.mjs:37`, `main/build/script.mjs:43`).
3. 개발 모드는 watch + Electron 재시작이며 Linux에서는 X11 인수를 넣는다. 이 `child_process.spawn`은 개발 도구 경로다(`main/build/script.mjs:12`, `main/build/script.mjs:20`, `main/build/script.mjs:55`). renderer dev proxy는 main의 `127.0.0.1:8584`로 연결한다(`renderer/vite.config.mts:31`).
4. 패키징은 `electron-builder build`, `npmRebuild: false`이다(`main/package.json:8`, `main/electron-builder.yml:4`). 네이티브 모듈 Electron ABI/플랫폼 호환성은 후속 검증 대상이다.
5. postinstall은 `patch-package --patch-dir build`(`main/package.json:9`). `main/build/`의 패치 파일은 **하나**: `app-builder-lib+26.8.1.patch`. AppImage `AppRun`의 args에 `--ozone-platform=x11`을 추가하고 인수 개수를 배열 길이로 바꾼다(`main/build/app-builder-lib+26.8.1.patch:9`). Windows 서명·업데이트 검증을 변경하는 패치는 아니다.
6. `artifactBuildCompleted`는 AppImage에만 `chmod`, `--appimage-extract AppRun`, `grep`을 실행하고 수정된 args 문자열을 assert한다(`main/electron-builder.yml:7`, `main/build/apprun-patch.test.mjs:6`). 이름은 test지만 패키징 hook에서 실행된다. 이번 분석에서는 실행하지 않았다.

**확인된 불일치:** 패치 파일명은 26.8.1, lockfile의 app-builder-lib은 26.9.0이다(`main/package-lock.json:1448`). 패치가 실제 적용되거나 실패한다고 단정할 수 없다. PHASE 5의 승인된 설치 환경에서 적용 결과·hook 검증을 확인해야 한다.

## 업데이트 흐름과 신뢰 경계

**확인된 사실:** `publish: [github]`이며 owner/repo가 명시되지 않았다(`main/electron-builder.yml:1`). 패키지 repository는 여전히 `SnosMe/awakened-poe-trade`다(`main/package.json:16`). 따라서 repository 기반 공급자 추론에 맡긴 상태이며, 포크 배포 전에 owner/repo를 명시해야 한다. 실제 생성 `app-update.yml`은 미검증이다.

- `main.ts`가 `AppUpdater`를 만들고 host-config 수신 시 `checkAtStartup()`을 부른다(`main/src/main.ts:35`, `main/src/main.ts:48`). 메서드가 첫 호출만 통과시킨다(`main/src/AppUpdater.ts:62`).
- 생성자에서 16시간 간격으로 `check`를 예약하고 수동 `check-for-update` 이벤트도 처리한다(`main/src/AppUpdater.ts:24`). `check`는 `autoUpdater.checkForUpdates()`를 호출한다(`main/src/AppUpdater.ts:69`).
- `autoDownload`는 portable 환경변수 `PORTABLE_EXECUTABLE_DIR` 유무로 정한다. portable은 자동 다운로드가 꺼진다. macOS는 `not-supported`를 표시하지만 이 분기 자체는 autoDownload를 false로 바꾸지 않는다. `--no-updates`는 앞선 portable/mac 분기에 들어가지 않은 경우에만 autoDownload를 끈다. `check()` 자체를 막지는 않는다(`main/src/AppUpdater.ts:34`).
- checking/available/not-available/error/downloaded 상태를 WebSocket broadcast로 renderer에 전달한다(`main/src/AppUpdater.ts:13`, `main/src/AppUpdater.ts:44`, `renderer/src/web/background/IPC.ts:16`). 사용자 `update-and-restart` 이벤트는 `autoUpdater.quitAndInstall(false)`를 부른다(`main/src/AppUpdater.ts:29`). 상태 검증은 이 핸들러에 없다.
- CI가 `latest.yml`, `latest-linux.yml`, `latest-mac.yml`을 출력한다(`.github/workflows/main.yml:52`). builder/updater가 생성 메타데이터와 실제 아티팩트를 GitHub Releases에서 사용하도록 의도된 구성이다. `app-update.yml`, blockmap, 최종 sha512 및 게시 파일은 생성하지 않았으므로 미검증이다.

**서명·무결성:** Windows 인증서·publisherName·서명 강제 정책·`verifyUpdateCodeSignature`는 저장소 설정에 명시되지 않았다. CI env에는 GH_TOKEN만 있고 macOS identity는 null이다(`.github/workflows/main.yml:50`, `main/electron-builder.yml:32`). 따라서 Windows 서명은 **구성상 보장되지 않음**이며 실제 배포 파일이 무서명이라는 확정 판정은 하지 않는다. 개발 문서의 `CSC_NAME` 예시는 CI 서명 증거가 아니다(`DEVELOPING.md:41`). sha512 검증은 electron-updater에 위임한 것으로 **추정**하며 잠긴 버전 6.8.3 구현 및 손상 파일 거부를 후속 확인해야 한다(`main/package-lock.json:2842`). 같은 배포 계정에서 파일과 해시가 모두 바뀌는 공격을 해시만으로 막을 수 없다. Authenticode 검증 여부·실패 시 설치 거부도 미검증이다.

## GitHub Actions

| 워크플로 | 트리거·권한 | 외부 액션·배포 |
|---|---|---|
| `main.yml` | master push만, 모든 tag 제외, docs/README 변경 제외. `permissions` 선언 없음 → 저장소/조직 기본 토큰 권한에 의존. PR/`pull_request_target` 트리거 없음 | checkout@v6, setup-node@v6, upload-artifact@v7, download-artifact@v8. 모두 SHA가 아닌 가변 major tag (`.github/workflows/main.yml:17`, `:25`, `:38`, `:40`) |
| renderer job | ubuntu-latest, npm ci → lint → build → renderer-dist 보관 1일 | `.github/workflows/main.yml:14` |
| package job | renderer 의존, windows-2022/ubuntu-22.04/macos-14, npm ci → main build → package `-p onTagOrDraft` | `GH_TOKEN: secrets.GITHUB_TOKEN`. 명시적 서명 Secret 없음. `onTagOrDraft`는 매 master push가 공개 릴리스를 만든다는 의미가 아님. 태그 push는 workflow에서 제외되므로 draft 사전 생성 등 운영 방식 필요 (`.github/workflows/main.yml:31`, `:48`, `:51`) |
| `pages.yml` | 모든 branch의 docs 변경 push, 모든 tag 제외. job permissions `pages: write`, `id-token: write`; environment github-pages | checkout@v4, setup-node@v4, configure-pages@v5, upload-pages-artifact@v3, deploy-pages@v4. 모두 major tag. docs에서 npm install → npx vitepress build → Pages 배포 (`.github/workflows/pages.yml:3`, `:15`, `:22`) |

`main.yml`에 Node 버전 명시가 없고 Pages는 npm ci 대신 npm install을 사용한다. Pages job에 `contents: read`가 명시되지 않았으므로 비공개 저장소 checkout 권한과 environment 보호/허용 branch를 후속 확인한다. 실제 기본 GITHUB_TOKEN 권한, Release draft 상태, Secret/환경 보호 설정은 네트워크 금지로 미검증이다.

## 동시 설치 충돌

| 경계 | 분석 |
|---|---|
| 설치·제거·업데이트 | 같은 name/productName과 미지정 appId/설치 GUID는 원본 설치와 식별자를 공유할 가능성이 높다. 제품명만 변경해도 충분하다고 단정할 수 없음. 독립 appId, name, executableName, artifactName, publish owner/repo를 명시하고 installer의 install/uninstall registry를 비교해야 함 (`main/package.json:2`, `main/electron-builder.yml:3`) |
| 설정·세션·OCR | `app.getPath('userData')/apt-data/config.json`, 임시 저장 전환 시 `config.json.tmp`, 이미지 `apt-data/files`, 외부 OCR `apt-data/cv-ocr` (`main/src/host-files/ConfigStore.ts:8`, `:32`, `main/src/host-files/file-uploads.ts:8`, `main/src/vision/link-main.ts:10`). userData 재정의 코드가 없어 같은 앱 이름이면 충돌 예상. Windows 문서상 `%APPDATA%\awakened-poe-trade` (`docs/issues.md:17`); 실경로는 실행 미검증. Electron 쿠키/캐시도 userData 분리 검증 필요 |
| 단일 인스턴스 | `app.requestSingleInstanceLock()` 실패 시 종료. 두 제품의 userData/앱 정체성이 같으면 상대 실행을 막을 가능성 (`main/src/main.ts:18`). 설치 후 실험 필요 |
| 단축키·클립보드 | 게임 활성 시 globalShortcut 등록/비활성 시 해제, 충돌 시 오류 로그 (`main/src/shortcuts/Shortcuts.ts:48`, `:132`, `:202`, `:211`). 이름을 분리해도 같은 단축키와 글로벌 uiohook, 클립보드는 OS 자원을 공유 |
| 서버 | 기본 production 동적 port + 127.0.0.1이라 고정 포트 충돌은 줄어듦. 개발은 8584, 사용자 --listen 지정 시 충돌 가능 (`main/src/server.ts:118`) |

## 결론과 PHASE 4 체크리스트

**추정 결론:** esbuild/Vite/electron-builder/electron-updater의 구조는 재사용 가능하다. 독립 배포를 현재 설정 그대로 시작할 수 있다는 뜻은 아니다.

- [ ] 새 package name, productName, appId, executableName, artifactName 및 설치 식별자를 명시한다.
- [ ] GitHub owner/repo, repository URL, 독립 버전 정책, Release draft/tag/publish 운영을 확정한다.
- [ ] 원본 앱과 userData·설정·쿠키·업데이트 캐시·단일 인스턴스 락을 분리하고 설정 이관은 명시적으로 설계한다.
- [ ] Windows 코드 서명과 업데이트 게시/검증 정책을 정하고 installer/portable의 실제 파일명·해시·메타데이터를 확인한다.
- [ ] 아래 참조 목록의 다운로드/후원/버그 보고/Pages 경로/화면 이름을 변경하되 역사적 출처와 게임 아이템 이름을 보존한다.
- [ ] 패치 버전 불일치, 네이티브 모듈 호환성, NSIS 동시 설치/제거 및 업데이트 성공·손상·소스 오지정 거부를 PHASE 5에서 검증한다.
- [ ] Actions SHA 고정, 최소 권한, Release와 Pages의 branch/environment 보호를 적용한다.

## 원본 프로젝트 URL·식별자 전수 검색

`rg -n -i --hidden -g '!.git/**' -g '!docs/analysis/**' 'SnosMe|awakened|snosme\.github\.io' .`로 검색했다. `.git` 내부와 병행 작성 중인 분석 산출물은 제품 참조에서 제외했다. 아래 표는 ndjson 이외의 일치 라인을 모두 보존한다. ndjson의 `Awakened`는 게임 데이터이므로 별도 표로 파일별 모든 일치 라인을 기록한다. 대소문자 무시 검색이므로 문자열 일괄 치환 금지.

| 파일:라인 | 일치 내용 |
|---|---|
| `renderer/index.html:9` | `` <title>Awakened PoE Trade</title> `` |
| `DEVELOPING.md:14` | `` [.github/workflows/main.yml](https://github.com/SnosMe/awakened-poe-trade/blob/master/.github/workflows/main.yml) `` |
| `README.md:1` | `` # ![Awakener's Orb](https://web.poecdn.com/image/Art/2DItems/Currency/TransferOrb.png) Awakened PoE Trade `` |
| `README.md:3` | `` [![](https://user-images.githubusercontent.com/4292308/153364874-dde23599-278c-4350-8d86-dadbc4b978b3.svg)](https://somsubhra.github.io/github-release-stats/?username=SnosMe&repository=awakened-poe-trade) `` |
| `README.md:4` | `` [![](https://user-images.githubusercontent.com/4292308/153364769-e4fe1e82-1bbc-46ac-8a3c-f5a98a5667cc.svg)](https://patreon.com/awakened_poe_trade) `` |
| `README.md:5` | `` [![](https://user-images.githubusercontent.com/4292308/153364565-7a545d26-e617-4a33-a919-ff90d8feda3d.svg)](https://github.com/SnosMe/awakened-poe-trade/issues/22) `` |
| `README.md:8` | `` ➡ [Download for Windows & Linux](https://snosme.github.io/awakened-poe-trade/download) ⬅ `` |
| `.github/FUNDING.yml:4` | `` patreon: awakened_poe_trade `` |
| `docs/.vitepress/config.js:3` | `` const BASE = '/awakened-poe-trade/' `` |
| `docs/.vitepress/config.js:6` | `` title: 'Awakened PoE Trade', `` |
| `docs/.vitepress/config.js:25` | `` releasesUrl: 'https://github.com/SnosMe/awakened-poe-trade/releases' `` |
| `docs/.vitepress/config.js:31` | `` link: 'https://github.com/SnosMe/awakened-poe-trade/issues/22' `` |
| `docs/.vitepress/config.js:36` | `` link: 'https://patreon.com/awakened_poe_trade' `` |
| `docs/.vitepress/config.js:41` | `` link: 'https://github.com/SnosMe/awakened-poe-trade' `` |
| `docs/download.md:11` | `` You can download Awakened Poe Trade here. Any other mirrors are not known `` |
| `docs/download.md:16` | `` &#124; <a :href="`${theme.github.releasesUrl}/download/v${theme.appVersion}/Awakened-PoE-Trade-Setup-${theme.appVersion}.exe`">Windows 10+ (installer)</a> &#124; ✔ &#124; Fast &#124; `` |
| `docs/download.md:17` | `` &#124; <a :href="`${theme.github.releasesUrl}/download/v${theme.appVersion}/Awakened-PoE-Trade-${theme.appVersion}.exe`">Windows 10+ (portable)</a> &#124; ❌ &#124; Slower &#124; `` |
| `docs/download.md:18` | `` &#124; <a :href="`${theme.github.releasesUrl}/download/v${theme.appVersion}/Awakened-PoE-Trade-${theme.appVersion}.AppImage`">Linux (AppImage)</a> &#124; ✔ &#124; n/a &#124; `` |
| `docs/download.md:19` | `` &#124; <a :href="`${theme.github.releasesUrl}/download/v${theme.appVersion}/Awakened-PoE-Trade-${theme.appVersion}-universal.dmg`">macOS (dmg)</a> &#124; ❌ &#124; n/a &#124; `` |
| `docs/download.md:39` | `` In order for Awakened PoE Trade to have access to the PoE window, it must be started with Administrator rights.** `` |
| `main/electron-builder.yml:3` | `` productName: "Awakened PoE Trade" `` |
| `docs/failed-load-leagues.md:30` | `` People have encountered some weirdness related to VPN and [DNS](https://github.com/SnosMe/awakened-poe-trade/issues/1038#issuecomment-1691780513) settings. `` |
| `main/package-lock.json:2` | `` "name": "awakened-poe-trade", `` |
| `main/package-lock.json:8` | `` "name": "awakened-poe-trade", `` |
| `main/src/AppTray.ts:26` | `` this.tray.setToolTip(`Awakened PoE Trade v${app.getVersion()}`) `` |
| `main/package.json:2` | `` "name": "awakened-poe-trade", `` |
| `main/package.json:16` | `` "url": "https://github.com/SnosMe/awakened-poe-trade.git" `` |
| `renderer/package.json:2` | `` "name": "awakened-poe-trade", `` |
| `renderer/package-lock.json:2` | `` "name": "awakened-poe-trade", `` |
| `renderer/package-lock.json:8` | `` "name": "awakened-poe-trade", `` |
| `docs/issues.md:14` | `` If Awakened works for you with DirectX11/12 renderer, `` |
| `docs/issues.md:17` | `` 4. Delete `%appdata%\awakened-poe-trade` `` |
| `docs/issues.md:25` | `` 6. Restart Awakened PoE Trade. `` |
| `docs/issues.md:36` | `` - [How to remove the stopwatch in center of screen?](https://github.com/SnosMe/awakened-poe-trade/issues/219) `` |
| `docs/issues.md:37` | `` - [Sends a whisper when doing price-check](https://github.com/SnosMe/awakened-poe-trade/issues/178) `` |
| `docs/issues.md:42` | `` - [Can't open settings via tray icon when game is active](https://github.com/SnosMe/awakened-poe-trade/issues/265) `` |
| `docs/issues.md:46` | `` - [Tray icon is not shown](https://github.com/SnosMe/awakened-poe-trade/issues/106) `` |
| `docs/issues.md:47` | `` - 🔥[Screen is black](https://github.com/SnosMe/awakened-poe-trade/issues/185) `` |
| `docs/ocr-guide.md:5` | `` This guide will help you to setup and perform OCR using Awakened PoE Trade. `` |
| `docs/ocr-guide.md:9` | `` 1. Download a 6MB archive with OCR files from [here](https://github.com/SnosMe/awakened-poe-trade/releases/download/v3.20.10007/cv-ocr.zip). `` |
| `docs/quick-start.md:8` | `` All that remains is to parse text in Awakened PoE Trade and show to you in a fancy way. `` |
| `renderer/public/data/ko/app_i18n.json:296` | `` "title": "세팅 - Awakened PoE Trade", `` |
| `renderer/public/data/en/app_i18n.json:321` | `` "title": "Settings - Awakened PoE Trade", `` |
| `renderer/public/data/ru/app_i18n.json:335` | `` "title": "Настройки - Awakened PoE Trade", `` |
| `main/src/windowing/OverlayWindow.ts:148` | `` 'You need to restart Awakened PoE Trade with administrator rights.' `` |
| `main/src/shortcuts/HostClipboard.ts:43` | `` // see https://github.com/SnosMe/awakened-poe-trade/issues/1790#issuecomment-4062830614 `` |
| `main/src/shortcuts/HostClipboard.ts:47` | `` // workaround bug in Proton 10+ https://github.com/SnosMe/awakened-poe-trade/issues/1846 `` |
| `renderer/src/web/Config.ts:76` | `` //   'Awakened PoE Trade - Incompatible configuration', `` |
| `renderer/src/web/Config.ts:78` | `` //   'You are trying to use an older version of Awakened PoE Trade with a newer incompatible configuration file.\n' + `` |
| `renderer/src/web/overlay/LoadingAnimation.vue:8` | `` <div class="text-base">Awakened PoE Trade</div> `` |
| `renderer/src/web/price-check/CheckedItem.vue:46` | `` <div class="mb-1">{{ t('Support development on') }} <a href="https://patreon.com/awakened_poe_trade" class="inline-flex align-middle animate__animated animate__fadeInRight" target="_blank"><img class="inline h-5" src="/images/Patreon.svg"></a></div> `` |
| `renderer/src/parser/Parser.ts:1190` | `` // full markup: https://gist.github.com/SnosMe/151549b532df8ea08025a76ae2920ca4 `` |
| `renderer/src/web/settings/about.vue:5` | `` <p class="text-base">Awakened PoE Trade</p> `` |
| `renderer/src/web/settings/about.vue:8` | `` <a class="border-b" href="https://github.com/SnosMe/awakened-poe-trade/releases" target="_blank">{{ t('app.release_notes') }}</a> `` |
| `renderer/src/web/settings/about.vue:9` | `` <a class="border-b" href="https://github.com/SnosMe/awakened-poe-trade/issues" target="_blank">{{ t('app.report_bug') }}</a> `` |
| `renderer/src/web/settings/about.vue:42` | `` window.open('https://snosme.github.io/awakened-poe-trade/download') `` |
| `renderer/src/web/settings/SettingsWindow.vue:33` | `` {{ t('Support development on') }}<br> <a href="https://patreon.com/awakened_poe_trade" class="inline-flex mt-1" target="_blank"><img class="inline h-5" src="/images/Patreon.svg"></a> `` |
| `renderer/src/web/price-check/PriceCheckWindow.vue:215` | `` const title = computed(() => leagues.selectedId.value &#124;&#124; 'Awakened PoE Trade') `` |
| `renderer/src/web/price-check/price-prediction/poeprices.ts:35` | `` s: 'awakened-poe-trade' `` |
| `renderer/src/web/price-check/price-prediction/poeprices.ts:84` | `` s: 'awakened-poe-trade', `` |
| `renderer/src/web/price-check/price-prediction/poeprices.ts:99` | `` body.append('source', 'awakened-poe-trade') `` |
| `renderer/src/web/price-check/filters/pseudo/flasks.ts:12` | `` // https://github.com/SnosMe/awakened-poe-trade/issues/758 `` |

게임 데이터 일치(제품 식별자가 아니므로 변경 제외):

| 파일 | 모든 일치 라인 |
|---|---|
| `renderer/public/data/cmn-Hant/items.ndjson` | 585, 880, 881, 882, 883, 884, 885, 886, 887, 888, 889, 890, 891, 892, 893, 894, 895, 896, 897, 898, 899, 900, 901, 902, 903, 904, 905, 906, 907, 908, 909, 910, 911, 912, 913, 914, 915, 916, 917 |
| `renderer/public/data/en/items.ndjson` | 585, 880, 881, 882, 883, 884, 885, 886, 887, 888, 889, 890, 891, 892, 893, 894, 895, 896, 897, 898, 899, 900, 901, 902, 903, 904, 905, 906, 907, 908, 909, 910, 911, 912, 913, 914, 915, 916, 917 |
| `renderer/public/data/ko/items.ndjson` | 586, 881, 882, 883, 884, 885, 886, 887, 888, 889, 890, 891, 892, 893, 894, 895, 896, 897, 898, 899, 900, 901, 902, 903, 904, 905, 906, 907, 908, 909, 910, 911, 912, 913, 914, 915, 916, 917, 918 |
| `renderer/public/data/ru/items.ndjson` | 585, 880, 881, 882, 883, 884, 885, 886, 887, 888, 889, 890, 891, 892, 893, 894, 895, 896, 897, 898, 899, 900, 901, 902, 903, 904, 905, 906, 907, 908, 909, 910, 911, 912, 913, 914, 915, 916, 917 |


