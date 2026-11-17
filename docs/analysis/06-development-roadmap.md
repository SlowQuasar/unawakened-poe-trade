# 06. 개발 로드맵 및 PHASE 0 종합 보고

- 작성: Claude Code (Architect/Reviewer) · 2026-11-17
- 입력: `01`~`03`(Claude Code 작성), `04`·`05`(Codex 작성, Claude Code 리뷰 완료 — §3 참조)
- 표기: ✅ 확인된 사실 · 🔶 추정 · ❓ 미검증

---

## 1. PHASE 0 핵심 발견 (요약)

1. ✅ **한국어 클라이언트는 upstream에서 이미 지원 언어다.** `ko` 데이터(아이템 4,962 / 스탯 9,198, 영어와 키 차이 0), 클립보드 감지, `poe.kakaogames.com` 엔드포인트, 설정 UI가 모두 존재한다. → PHASE 3은 "신규 구현"이 아니라 **실제 샘플로 검증·보수**하는 작업이다.
2. ✅ **파서는 이미 언어 중립 구조**(언어별 문자열 테이블 + 매처 데이터 → 영문 키 `refName`/`ref` → 거래소 ID)다. 마스터 프롬프트의 목표 아키텍처와 일치하므로 재설계가 필요 없다.
3. ✅ **upstream은 활발히 유지 중**이다 — 오늘(2026-11-17)도 `b6792c9 support new textual ranges` 커밋이 있다. 그러나 **사용자 결정: upstream을 추종하지 않고 독자 노선**(§6). → 3.30 데이터·파서 대응을 자체적으로 해야 한다.
4. ✅ **아이템/스탯 데이터(ndjson) 생성기가 저장소에 없다.** 데이터는 upstream 작성자가 외부 도구로 만들어 커밋한다. 독자 노선 결정으로 **자체 생성기 구축이 필수 과제**가 되었다 — 최대 리스크.
5. ✅ **자동화 테스트가 사실상 없다**(렌더러/파서 테스트 0개). 모든 구현 Phase의 선행 조건.
6. ✅ **빌드/업데이트 체계는 재사용 가능하지만 그대로 배포하면 안 된다** — `publish: github`에 owner/repo가 없고 `repository`가 `SnosMe`를 가리켜 업데이트 출처가 원본으로 추론될 수 있으며, appId·이름·userData 경로가 원본과 같다.
7. ✅ **보안: 로컬 HTTP/WebSocket 서버에 인증·Origin 검증이 없다.** 키 로깅 디버그 옵션과 결합하면 원격 웹페이지에서 전역 키로거로 악용될 수 있는 경로가 코드상 존재한다(재현 전, §3).

## 2. 필수 질문 답변

### Q1. 현재 프로젝트에서 아이템 인식은 어떻게 동작하는가?
전역 단축키(`globalShortcut`) → uiohook으로 `Ctrl+C` 합성(3.29부터 고급 설명이 항상 복사) → 메인이 클립보드를 48ms 간격으로 최대 500ms 폴링, 첫 줄(`Item Class:` / `아이템 종류:` 등)로 아이템 판정 → WebSocket `MAIN->CLIENT::item-text` → 렌더러 `parseClipboard()`가 `--------` 섹션 분할 → 이름판(Rarity/이름/베이스) → 약 50개 섹션 파서 체인(레벨·소켓·젬·지도·리그 메커니즘·옵션) → 번역명으로 `items.ndjson` 조회해 `refName` 확정, 옵션 줄은 `stats.ndjson` 매처로 `Stat{ref, trade.ids}` 확정 → `createPresets()`가 필터 생성 → `/api/trade/search|fetch|exchange`를 메인 프록시 경유로 호출 → 오버레이에 표시. 상세: `02-item-parsing.md`.

### Q2. 3.30 대응을 위해 어느 부분을 수정해야 하는가?
- **데이터(최대 작업량)**: `renderer/public/data/{en,ko,ru,cmn-Hant}/items.ndjson`, `stats.ndjson`, `client_strings.js`
- **코드(필요 시)**: `parser/Parser.ts` 파서 체인, `parser/stat-translations.ts`·`advanced-mod-desc.ts`(복사 텍스트 형식), `parser/meta.ts`(카테고리), `price-check/filters/*`·`trade/pathofexile-trade.ts`(신규 거래소 필터/카테고리)
- 메인 프로세스는 복사 키 동작이 또 바뀌지 않는 한 수정 불필요.
- ❓ 실제 3.30 변경 목록은 PHASE 1에서 공식 자료로 검증 후 확정. 상세: `02-item-parsing.md §4`.

### Q3. 한국어 지원은 어느 정도의 구조 변경이 필요한가?
**작음.** 새 파서나 새 내부 모델은 필요 없다(언어별로 파서가 갈라지면 리그마다 두 벌을 유지해야 한다). 사용자 제공 실제 샘플 3건(고유 갑옷·레어 목걸이·결합 셉터)이 **3.29 한국어 데이터와 정적 대조에서 전부 매칭**됐다(`03 §8`). 필요한 것: ① 남은 유형 샘플로 실제 파서 실행 검증, ② 3.30 한국어 데이터 갱신, ③ ~~영어 하드코딩 접미사 이전~~ → 샘플로 **불필요 확인**(`(augmented)`/`(enchant)`는 한국어 클라이언트도 영어), ④ 감지된 클라이언트 언어 ≠ 설정 언어일 때 안내/자동 전환, ⑤ 한국어 bulk 귓속말 정규식, ⑥ UI 누락 27키. ❓ `poe.kakaogames.com` 거래소의 현재 운영/호환 여부가 최대 불확실성. 상세: `03-localization.md`.

### Q4. 기존 빌드와 자동 업데이트 시스템을 재사용할 수 있는가?
**예, 구조는 재사용한다**(esbuild + Vite + electron-builder NSIS/portable + electron-updater GitHub provider + GitHub Actions). 단 PHASE 4에서 반드시: owner/repo 명시(`SlowQuasar/unawakened-poe-trade`), `appId`·`productName`·`executableName`·`artifactName`·package `name` 변경(→ userData 경로와 단일 인스턴스 락 분리), Actions 권한 최소화·SHA 고정. **Windows 코드 서명은 하지 않음(사용자 재결정, §6)** — 아래 제약은 참고용. 원본 사용자 설정은 덮어쓰지 않고 "가져오기"를 별도 제공. 상세: `04-build-and-update.md`.

**코드 서명 설계 제약** 🔶(PHASE 4에서 최신 정보로 재확인):
- 2023년 6월 이후 발급되는 코드 서명 인증서는 개인키를 하드웨어(HSM/토큰)에 보관해야 한다는 업계 요건이 있어, **`.pfx`를 GitHub Secret에 넣고 CI에서 서명하는 전통 방식은 신규 인증서로는 불가**한 것으로 알고 있다. → **클라우드 서명 서비스**(CA의 클라우드 HSM, Azure Artifact Signing(구 Trusted Signing), SignPath 등)를 electron-builder `win.signtoolOptions`/커스텀 `sign` 훅으로 연결하는 구조가 필요.
- ❓ 각 서비스의 **한국 거주 개인 개발자 가입 자격**, 비용, 오픈소스 무료 프로그램 조건은 미확인 — PHASE 4 착수 시 조사.
- 인증서 구매·신원 확인은 **사용자가 직접** 해야 한다(Claude/Codex가 대행 불가). CI에는 서명 서비스 자격 증명만 Secret으로 등록.
- electron-updater의 Windows 업데이트 서명 검증(`publisherName` 일치)을 켜서, 서명이 다른 업데이트 파일은 설치 거부하도록 설정.

### Q5. 보안상 가장 주의해야 할 부분은 무엇인가?
1. **무인증 로컬 HTTP/WS(H1) + 키 로깅(H3) 연쇄** — WebSocket 클라이언트는 누구든 `CLIENT->MAIN::update-host-config`로 `logKeys`를 켜고 `log-entry` 브로드캐스트로 **시스템 전체 키 입력**을 받을 수 있다(`server.ts:84-90`, `Shortcuts.ts:66-74`, `main.ts:43-50`). 브라우저의 WebSocket은 CORS 대상이 아니므로 악성 웹페이지가 localhost 포트를 찾으면 도달 가능 🔶 → 세션 토큰 + Origin 검증 필수.
2. **업데이트 출처·서명(H4)** — 오지정 시 원본 업데이트가 우리 설치본을 덮어쓰거나, Release 계정 탈취 시 악성 바이너리 배포.
3. **사용자 폴더의 OCR JS 동적 import(H5)** — 무결성 검증 없이 `userData/apt-data/cv-ocr`의 JS 실행.
4. **정적 파일 경로 결합(H2)** — `path.join(__dirname, req.url)` 무검증. 기본 loopback에서는 Medium, `--listen`으로 외부 노출 시 High.
5. **CI 공급망(M5)** — 가변 태그 액션, 권한 미선언, 설치 스크립트가 배포 토큰과 같은 job.
상세: `05-security-audit.md`.

### Q6. Claude Code와 Codex가 어떤 단위로 작업을 나누는 것이 좋은가?
**"파일 소유권이 겹치지 않는 수직 슬라이스 1개 = 브랜치 1개 = PR 1개"** 단위.

| 역할 | 담당 |
|---|---|
| Claude Code | 공식 자료/웹 조사와 사실 검증(PHASE 1), 설계 문서·작업 지시서, 실제 샘플 해석, 코드 리뷰, 보안 리뷰, 최종 보고 |
| Codex | 지시서 기반 구현, 데이터 갱신 스크립트, Fixture·테스트 작성, CI 설정, 빌드/테스트 오류 수정 |

규칙:
- `renderer/src/parser/Parser.ts`(1,314행)는 **핫스팟** — 한 시점에 한 브랜치만 수정.
- 데이터 파일(`public/data/**`)은 사람이 손으로 고치지 않고 **스크립트 산출물로만** 변경(리뷰 가능성).
- Codex는 샌드박스(`workspace-write`, 승인 `on-request`)에서 실행, 네트워크·설치 스크립트가 필요한 단계는 사용자 승인 후 별도 터미널에서 실행.
- Herdr 운영: Claude Code가 `hc run --bg`로 Codex를 띄우고, 결과는 문서/커밋으로 받고, 리뷰 후 수정 지시. (이번 PHASE 0에서 이 방식으로 `04`·`05`를 분담함.)

### Q7. 전체 개발에서 가장 위험하거나 어려운 작업은 무엇인가?
1. **데이터 파이프라인 독립(최고 난도·최고 위험, 독자 노선 결정으로 확정 과제)** — 게임 클라이언트 데이터(GGPK/번들 `.datc64`) 추출 + 공식 거래소 `/api/trade/data/*` 대조로 ndjson을 재생성하는 도구를 새로 만들어야 한다. 기존 ndjson 스키마(`assets/data/interfaces.ts`)와 **완전히 같은 출력**을 내야 파서를 건드리지 않는다. 한국어 번역명은 한국 클라이언트 데이터가 필요하다. 첫 단계로 "현재 3.29 ndjson을 재현하는 생성기"를 만들어 기존 파일과 diff 0을 맞춘 뒤 3.30에 적용하는 방식을 권장.
2. **실제 한국어 샘플 없이 정확성 주장 불가** — 사용자 협조(샘플 수집)가 필수.
3. **`poe.kakaogames.com` 거래소 상태** — 동작하지 않으면 국제 거래소(영문명) 경로로 설계를 바꿔야 함.
4. **로컬 서버 보안 수정(H1)** — 렌더러의 "웹 버전" 호환성을 깨지 않고 토큰/Origin을 도입해야 한다(웹 버전 유지 여부 결정에 따라 단순해질 수 있음).
5. **Windows 코드 서명** — 비용·인증서 보관(Secret) 문제. 미서명 시 SmartScreen 경고와 업데이트 출처 보증 약화.
6. **독자 유지보수 부담** — upstream을 따르지 않으므로 리그마다 데이터·파서 대응 전체가 우리 몫. 자동화 테스트와 데이터 생성기가 없으면 지속 불가능.

## 3. Codex 산출물(04·05) 리뷰 결과

리뷰어: Claude Code. 주요 주장은 소스로 직접 대조했다.

| 항목 | 검증 | 판정 |
|---|---|---|
| 04: 패치 파일 `app-builder-lib+26.8.1.patch` vs lockfile `26.9.0` 불일치 | `main/package-lock.json:1448-1449` 확인 | ✅ 정확 |
| 04: `publish: github`에 owner/repo 없음, `repository`는 SnosMe | `main/electron-builder.yml:1-2`, `main/package.json:14-16` 확인 | ✅ 정확 — **포크 그대로 빌드하면 업데이트 출처가 원본으로 추론될 위험** 🔶 (실제 `app-update.yml` 생성 확인은 PHASE 4) |
| 04: appId/executableName 미지정 → 기본값 의존 | `electron-builder.yml` 전체 확인 | ✅ 정확 |
| 05 H1: HTTP/WS 무인증, Origin 미검증 | `main/src/server.ts:69-76, 84-90` 확인 | ✅ 정확 |
| 05 H3: `logKeys` 시 게임 포커스와 무관하게 전역 키 기록 | `Shortcuts.ts:66-74` 확인 | ✅ 정확. **리뷰 보강: H1+H3 연쇄는 "원격 웹페이지 → 전역 키로거" 경로이므로 Critical 후보로 상향 권고**(브라우저의 localhost WebSocket 허용 정책에 따라 달라지므로 PHASE 5 재현으로 확정) |
| 05 H2: 정적 파일 `path.join(__dirname, req.url)` 무검증 | `server.ts:24,32`, `file-uploads.ts:13` 확인 | ✅ 코드 사실 정확. **리뷰 조정: 브라우저는 `..`를 정규화하므로 웹 경유 악용은 어렵고, 기본 바인딩(127.0.0.1)에서는 공격자가 이미 같은 사용자 권한의 로컬 프로세스여야 함 → 기본 Medium, `--listen` 외부 노출 시 High** |
| 05 H5: OCR JS를 userData에서 동적 import | 파일·라인 인용 형식 확인(코드 정독은 미실시) | 🔶 수용 |
| 05 전반: 확인/추정/미검증 구분, 네트워크·설치 미실행 명시 | | ✅ 지시 준수 |

리뷰 후 집계(권고): **Critical 후보 1(H1+H3 연쇄) / High 3(H1 단독, H4, H5) / Medium 7(H2 포함) / Low 1.**

## 4. 권장 개발 전략

**"독자 노선(사용자 결정 2026-11-17) + 기존 코드 최대 재사용"**

- upstream을 리모트로 추종하거나 정기 병합하지 않는다. 현재 코드(`3188208`)를 기반선으로 삼는다. upstream 변경은 **참고만** 하며, 필요한 개별 수정은 이해한 뒤 직접 구현하거나 라이선스 고지를 유지한 채 선별 반영한다. 원본 저장소에 Push/PR은 하지 않는다.
- 재작성하지 않는다: 파서·필터·거래 로직·Electron 구조는 그대로 두고, 우리가 소유해야 하는 것(①데이터 생성기 ②테스트 ③브랜딩·배포·서명 ④보안)에 투자한다.
- **데이터 생성기를 최우선 인프라로** 만든다: 스키마 호환 출력 → 3.29 재현(diff 0) → 3.30 생성. 리그마다 "생성기 실행 + Fixture 테스트"만으로 대응 가능한 구조가 목표(최종 목표 8 "신규 리그에 쉽게 대응").

## 5. Phase별 로드맵

| Phase | 브랜치(안) | 담당 | 핵심 작업 | 완료 기준 |
|---|---|---|---|---|
| 1 | `research/3.30` | Claude(조사) | 공식 패치 노트·거래소 `/api/trade/data/{items,stats,filters}`·PoEDB 대조, Thread/Scarab 등 소문 검증, **데이터 원천(게임 클라이언트 데이터 추출 방법, 한국어 데이터 확보 경로) 조사** | 3.30 비교표·데이터 목록·영향 파일·우선순위·생성기 설계안 |
| 2-0 | `test/fixture-harness` | Codex | vitest 도입(의존성 보안 검토 포함), `parseClipboard()` Fixture 테스트 하네스, 기존 3.29 회귀 세트 + **ko 실제 샘플 3건**(`docs/analysis/samples/ko`) | `npm test`로 en/ko Fixture 통과 |
| 2-1 | `tools/data-generator` | Codex 구현, Claude 설계·리뷰 | ndjson 생성기: 게임 데이터 + 거래소 데이터 → `items.ndjson`/`stats.ndjson`(스키마 동일). 1단계 목표: **현재 3.29 파일 재현(diff 0 또는 설명 가능한 차이만)** | 재현 리포트 |
| 2-2 | `feat/3.30-data` | Codex | 생성기로 3.30 데이터 생성(en·ko 우선) + `init()` 지연 검증 통과 | 대상 언어 로드 성공 |
| 2-3 | `feat/3.30-parser-*` | Codex | 신규 메커니즘별 파서/필터(1 메커니즘 = 1 PR) | 신규 Fixture 통과, 미검증 항목 표시 |
| 3-0 | — | 사용자 | 한국어 샘플 수집(`03 §7`) — **3건 확보**(고유 갑옷·레어 목걸이·결합 셉터), 나머지 유형은 아이템마다 형식이 달라 진행하면서 수시 수집 | 유형별 샘플 확보 |
| 3-1 | `feat/ko-verify` | Codex | ko Fixture 테스트, 하드코딩 접미사 처리, 언어 불일치 감지/안내 | en/ko 쌍 Fixture 통과 |
| 3-2 | `feat/ko-polish` | Codex | bulk 귓속말 정규식, UI 누락 키, kakao/국제 거래소 경로 정리 | |
| 4 | `release/branding` | Codex → Claude 리뷰 | 이름·appId·executableName·artifactName·publish owner/repo·트레이/About/README, 버전 `3.30.x`, 설정 가져오기, Actions(**Windows 전용** 빌드·테스트·draft Release·sha256 해시 게시), macOS/Linux 타깃 제거. 코드 서명 없음 | draft Release 생성, 원본과 동시 설치·자동 업데이트 확인 |
| 5 | `security/hardening` | Codex 구현, Claude 리뷰 | WS/HTTP 세션 토큰+Origin, 경로 정규화, logKeys 제한, OCR 무결성, Electron 옵션 명시·CSP·webview allowlist, Actions SHA 고정·권한 최소화, 의존성 감사 | `05` 항목별 재현→차단 확인 |

(보안 Critical 후보는 PHASE 5까지 미루지 말고 **PHASE 4 첫 배포 전에** 수정하는 것을 권장.)

## 6. 사용자 결정 기록 및 남은 결정

**결정됨 (2026-11-17)**

| 항목 | 결정 |
|---|---|
| 한국어 샘플 | 3건 제공(`docs/analysis/samples/ko`). 아이템마다 형식이 달라 유형별로 진행하며 추가 수집 |
| upstream 전략 | **추종하지 않음 — 독자 노선** (§4) |
| Windows 코드 서명 | ~~적용~~ → **하지 않음** (2026-11-17 재결정: 개인 설치용이므로 불필요). Q4의 서명 설계 제약은 참고용으로만 남김. 대신 업데이트 무결성은 electron-updater sha512 + GitHub Release 계정 보호(2FA, 최소 권한 토큰)로 확보하고, SmartScreen 경고는 감수 |
| 버전 체계 | **`3.30.x`** — 리그 버전을 앞자리로 따름 (원본과 같은 방식, 업데이트 채널은 분리) |
| 대상 플랫폼 | **Windows 전용.** macOS/Linux 빌드·코드 경로는 정리 대상(CI 매트릭스에서 제외, 플랫폼 분기 코드는 회귀 위험을 봐 가며 단계적으로 제거) |
| PHASE 0 산출물 | 커밋·푸시 완료 (`7ce1c56`) |
| 데이터 원천 | 로컬 한국어 클라이언트(`C:\Daum Games\Path of Exile`, Kakao) + **PoEDB 사이트** 조사 (PHASE 1) |

**브라우저 "웹 버전"이란** ✅: 별도 제품이 아니라, 앱이 띄우는 로컬 서버(`http://localhost:<포트>`)를 **일반 브라우저로 열어 같은 UI를 쓰는 모드**다. 트레이 메뉴 "Open in Browser"(`main/src/AppTray.ts:48-50`)로 열리고, `--no-overlay`·`--listen` 옵션(`docs/cmd-flags.md`)과 함께 오버레이가 안 뜨는 환경(주로 Linux, VPN 문제, 듀얼 모니터)의 대안으로 쓰인다. 렌더러 코드의 `Host.isElectron` 분기(`IPC.ts:78`, `OverlayWindow.vue:56` 등)가 이 모드를 지원한다.
→ **권장: 유지하되 보안 수정과 함께.** 추가 비용이 거의 없고(같은 코드), Windows에서도 오버레이가 붙지 않을 때(관리자 권한/전체화면 문제)의 비상 수단이 된다. 단 C1/H1 수정 시 **세션 토큰을 URL에 포함**(오버레이 로드 URL과 트레이 "Open in Browser" URL 모두)하고 WebSocket은 토큰 + Origin 검사를 통과해야만 연결되게 한다. 이렇게 하면 웹 버전을 유지하면서 악성 웹페이지 접근을 막을 수 있다.

**남은 결정**

1. 웹 버전 유지(권장안) 확정 여부
