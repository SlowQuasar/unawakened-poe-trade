# PHASE 2-3 — 3.30 아이템 데이터 추가

작성: Codex · 2026-11-17 · 로컬 데이터만 사용.

## 결과

`tools/data-generator/src/delta-3.30.mjs`를 만들고 en/ko `items.ndjson`에 각각 **192행**을 동일 refName 집합·순서로 추가했다. 기존 행의 바이트는 그대로 보존했다. 젬은 아래의 불확실성 때문에 제외했다.

| 종류 | 언어별 추가 행 |
|---|---:|
| Thread 10종 + Frayed Thread | 11 |
| 개명: 메이븐의 끌·환영의 오브 | 2 |
| Soul Core | 4 |
| Allflame Ember | 3 |
| Immortal/Feral/Royal/Cryptic Astrolabe | 4 |
| Royal Visage·Essence of Trickery·Afarud Enshrouding Crystal | 3 |
| Mycelium Core | 1 |
| 살덩이 | 164 |
| 합계 | 192 |

## 구현과 원천

`ggpk.mjs`의 `Ggpk.open()`은 게임 입력을 `r`로만 연다. 기존 PoC의 번들 인덱스 해제 → `FileLoader.getFileContents()` → `readDatFile`/`readColumn` 경로를 재사용했다. 네트워크, 설치, git, hc send, 서브에이전트는 사용하지 않았다.

형식 7 스키마의 PoE1 정의를 선택하고 모든 열의 길이 합과 실제 행 크기를 대조했다. BaseItemTypes.Id/Name/ItemClassesKey와 ItemClasses.Id/Name을 이름으로 읽었다. en/ko는 유일한 BaseItemTypes.Id로 조인하며 누락 번역은 오류로 처리한다. 문자열 offset 탐색은 사용하지 않는다.

| 테이블 | 행 수 | 행 크기 | SHA-256 |
|---|---:|---:|---|
| BaseItemTypes.en | 5668 | 373 | e67c5a990f46fe329c404f95c1a08eff239fbaad7925f7b543c26f6c3deec774 |
| ItemClasses.en | 105 | 153 | aa63d34e43ed7dbf0fbad5272bc5a235a70bdd6246bd8234fe2c62ec542b0038 |
| BaseItemTypes.ko | 5668 | 373 | 1ec6ac05b4a406ecfad51d6c6ab515971d7246b82ebcab47759717f648fc64f3 |
| ItemClasses.ko | 105 | 153 | f63fcfe1da0b8c776d3d8957584ef8530f8bfef5875fb74b7f13c27e5c651e37 |
| Mods.ko | 41324 | 692 | 5b147865265aa0e4be00da22217d253ca19262fa8febcca6ae96324359896ad8 |

스키마 SHA-256: `25e17f0463e56a4ed0dcc13a841aeb811012debb23daa9111053aa8157bd7b60`

Kakao static snapshot SHA-256: `f094b25e4c2a95b78e70a801b4f14cd8b50e95bf9ab566c3edb97746a726bc79`

Kakao items snapshot SHA-256: `80641704527b7e4326d6f5c001f648f36ed1c13ba6cfe04c093958609cb7f7ce`

## 한국어 이름과 살덩이 판정

추가 192개 모두 ko BaseItemTypes.Name이 Kakao items의 type과 **정확히 일치**했다. 화폐·조각 27개는 ko static.text도 정확히 일치하여 양쪽 파일에 같은 static.id를 tradeTag로 넣었다. 주얼과 살덩이는 bulk 대상이 아니므로 tradeTag가 없다. bulk 항목의 tradeTag 누락은 0개다.

살덩이 클래스는 영어 Id `Viscera`, 한국어 Name `살덩이`다. 원본 166행의 고유 이름은 **164개**다. `VisceraVaalOversoul`, `VisceraVaalOversoul2`, `VisceraVaalOversoul3`은 모두 `Artificial Appendage` / `인공물 수족`이므로 레코드 하나로 합쳤다. 나머지 이름을 포함한 고유 이름 164개는 Kakao viscera 목록과 일치한다.

`하위 검술가의 칼날`은 별도 베이스가 아니다. 실제 BaseItemTypes는 `Metadata/Items/Viscera/VisceraDaresso` → `Swordmaster's Blade` / `검술가의 칼날`이고, 한국어 베이스 전체에 `하위 검술가의 칼날`은 없다. 로컬 실제 복사 샘플 `renderer/test/fixtures/ko/3.30-viscera-arm-lesser-swordsman-blade.txt`에는 `하위 검술가의 칼날`이 표시되므로 `하위`는 베이스 앞에 붙는 표시 접두어로 판단한다. Mods에는 `VisceraModDaressoLow` 같은 낮은 단계 옵션이 있으나 Name은 비어 있어 이 열만으로 접두어 생성 규칙까지 확정하지는 않았다.

## 제외·기존 항목

- Tailoring Orb / 재단 오브, Tempering Orb / 단조 오브 및 기존 Astrolabe 등 22개 후보는 기존 en refName이 있어 건너뛰었다. 기존 한국어·tradeTag·이미지도 수정하지 않았다.
- `Memory Traces`라는 BaseItemTypes.Name은 없었다. 이는 개별 거래 베이스 이름인지 확인되지 않아 생성하지 않았다.
- `Arcane Link` / `비전의 연결`, `Quickstep` / `빠른 걸음`은 BaseItemTypes에서 확인했다. 따라서 빠른 걸음의 영문명은 **Quickstep**이다.
- `Fireball of Radiation`은 BaseItemTypes.Name에 없다. 변형 젬 이름·normalVariant와 각 젬의 maxLevel을 검증하는 추가 테이블 조인을 이번 생성기에 구현하지 않았다. maxLevel을 기존 젬의 20으로 추측하지 않고 신규 젬 3종은 모두 제외했다. 후속 젬 패치에서 SkillGems/GemEffects/경험치 정의의 검증이 필요하다.

## 검증과 제한

- `node --check tools/data-generator/src/delta-3.30.mjs` 통과.
- 생성기 최초 실행: 각 언어 192행 추가. 두 번째 실행: 각 언어 0행 추가, 결과 파일 SHA-256 동일.
- 기존 `makeIndexFiles()`를 실제 실행하되 `fs.writeFileSync`만 메모리 내 검증 함수로 대체했다. 16개 인덱스 출력 계산이 정상 완료되었고, 모든 items 인덱스의 offset에서 해당 JSON 행을 다시 파싱했다. 디스크의 인덱스 파일은 쓰지 않았다.
- 기존 데이터 전체 prefix를 원본 Buffer와 바이트 단위로 대조했다. 기존 행 변경·삭제 0개.
- 기존 파일은 **CRLF**였다. 기존 바이트 보존 요구를 우선하여 기존 줄바꿈은 그대로 두고, 추가 행은 **LF**와 마지막 개행으로 기록했다. 인덱스 생성기의 `indexOf("\n")`/JSON.parse 순회와 호환된다. 전체 파일을 LF로 재작성하면 기존 행 바이트 보존 조건에 어긋나므로 하지 않았다.
- 전체 `cd renderer && npm test`: 실행 당시 **17개 중 13개 통과, 4개 실패**. 동시 작업으로 테스트가 추가되고 있어 지시서의 10개보다 많다. 실패는 Thread 기대값 `Thread of Expedition` vs 실제 게임 데이터 `Expedition Thread` 1건과 살덩이 newMods 3건이다. 데이터 이름은 스키마 원천 그대로 유지했다. 살덩이 스탯은 이번 수정 금지 영역인 stats/parser 작업에 해당한다. renderer/src, renderer/test, client_strings.js, stats.ndjson은 수정하지 않았다.
- 기존 10개만 선택하는 `npm test -- -t "English \[synthetic\] clipboard samples|Korean real clipboard samples"`: **10개 통과**, 동시 추가된 테스트 8개 제외(총 18개 발견).
- 게임 입력 크기·mtime 불변: **true**.

| 언어 | 기존 바이트 | 기존 SHA-256 | 최종 SHA-256 |
|---|---:|---|---|
| en | 1464961 | f4b2ed5147351da1fe0b973f38b1fc23edb2472e58fe74bb064e12b12191f686 | 3bf966bbd8a76653358cccb83d4dd8425b0bc2f071008175ede60db4d72e5031 |
| ko | 1476916 | a72376a9ffbae853c4964d8a645519b755a8a8dbee4d72b2945e7d78d83e0e6d | 1521fc42fc71665cd7278cba53f7e2cfffc1e49e5e9a03917144db6b2b2df828 |

## 추가한 전체 목록 (파일에 추가한 순서)

static/items 열의 일치는 한국어 원천 이름에 대한 정확한 문자열 비교다.

| # | refName (en 이름) | ko 이름 | 카테고리 | static / items | tradeTag |
|---:|---|---|---|---|---|
| 1 | Maven's Chisel of Threads | 실낱의 메이븐의 끌 | bulk | 일치 / 일치 | mavens-chisel-of-threads |
| 2 | Threaded Delirium Orb | 실낱을 꿴 환영의 오브 | bulk | 일치 / 일치 | threaded-delirium-orb |
| 3 | Essence of Trickery | 계략의 에센스 | bulk | 일치 / 일치 | essence-of-trickery |
| 4 | Frayed Thread | 해진 실낱 | bulk | 일치 / 일치 | frayed-thread |
| 5 | Mycelium Core | 균사체 핵 | Jewel | 해당 없음 / 일치 | — |
| 6 | Royal Visage | 용안 | bulk | 일치 / 일치 | royal-visage |
| 7 | Expedition Thread | 탐험 실낱 | bulk | 일치 / 일치 | expedition-thread |
| 8 | Abyss Thread | 심연 실낱 | bulk | 일치 / 일치 | abyss-thread |
| 9 | Breach Thread | 균열 실낱 | bulk | 일치 / 일치 | breach-thread |
| 10 | Ritual Thread | 의식 실낱 | bulk | 일치 / 일치 | ritual-thread |
| 11 | Ultimatum Thread | 결전 실낱 | bulk | 일치 / 일치 | ultimatum-thread |
| 12 | Legion Thread | 군단 실낱 | bulk | 일치 / 일치 | legion-thread |
| 13 | Blight Thread | 역병 실낱 | bulk | 일치 / 일치 | blight-thread |
| 14 | Bestiary Thread | 야수 도감 실낱 | bulk | 일치 / 일치 | bestiary-thread |
| 15 | Betrayal Thread | 배신 실낱 | bulk | 일치 / 일치 | betrayal-thread |
| 16 | Incursion Thread | 기습 실낱 | bulk | 일치 / 일치 | incursion-thread |
| 17 | Allflame Ember of the Cloister | 회랑의 올플레임 잉걸불 | bulk | 일치 / 일치 | allflame-ember-of-the-cloister |
| 18 | Allflame Ember of the Multitude | 군중의 올플레임 잉걸불 | bulk | 일치 / 일치 | allflame-ember-of-the-multitude |
| 19 | Allflame Ember of the Divine | 신성의 올플레임 잉걸불 | bulk | 일치 / 일치 | allflame-ember-of-the-divine |
| 20 | Soul Core of Intellect | 지능의 영혼 핵 | bulk | 일치 / 일치 | soul-core-of-intellect |
| 21 | Soul Core of Might | 완력의 영혼 핵 | bulk | 일치 / 일치 | soul-core-of-might |
| 22 | Soul Core of Finesse | 수완의 영혼 핵 | bulk | 일치 / 일치 | soul-core-of-finesse |
| 23 | Soul Core of Instability | 불안정의 영혼 핵 | bulk | 일치 / 일치 | soul-core-of-instability |
| 24 | Immortal Astrolabe | 불멸의 관측기 | bulk | 일치 / 일치 | immortal-astrolabe |
| 25 | Feral Astrolabe | 야생 관측기 | bulk | 일치 / 일치 | feral-astrolabe |
| 26 | Royal Astrolabe | 왕실 관측기 | bulk | 일치 / 일치 | royal-astrolabe |
| 27 | Cryptic Astrolabe | 난해한 관측기 | bulk | 일치 / 일치 | cryptic-astrolabe |
| 28 | Afarud Enshrouding Crystal | 아파루드 휩싸는 수정 | bulk | 일치 / 일치 | afarud-enshrouding-crystal |
| 29 | Scorched Arm | 그을린 팔 | Viscera | 해당 없음 / 일치 | — |
| 30 | Severed Rhoa Head | 잘린 로아 머리 | Viscera | 해당 없음 / 일치 | — |
| 31 | Sea Witch's Tentacle | 바다 마녀의 촉수 | Viscera | 해당 없음 / 일치 | — |
| 32 | Crustacean's Claw | 갑각류의 집게 | Viscera | 해당 없음 / 일치 | — |
| 33 | Totemic Visage | 토템 얼굴 | Viscera | 해당 없음 / 일치 | — |
| 34 | Skeletal Archer's Arm | 해골 궁수의 팔 | Viscera | 해당 없음 / 일치 | — |
| 35 | Skeletal Warrior's Leg | 해골 전사의 다리 | Viscera | 해당 없음 / 일치 | — |
| 36 | Warden's Arm | 간수의 팔 | Viscera | 해당 없음 / 일치 | — |
| 37 | Goatman's Horn | 염소인간의 뿔 | Viscera | 해당 없음 / 일치 | — |
| 38 | Mariner's Tricorne | 선원의 삼각모 | Viscera | 해당 없음 / 일치 | — |
| 39 | Elemental Essence | 원소의 정수 | Viscera | 해당 없음 / 일치 | — |
| 40 | Galvanic Tentacle | 충격 촉수 | Viscera | 해당 없음 / 일치 | — |
| 41 | Siren's Tentacle | 사이렌의 촉수 | Viscera | 해당 없음 / 일치 | — |
| 42 | Cutthroat's Head | 살인자의 머리 | Viscera | 해당 없음 / 일치 | — |
| 43 | Golemic Stone | 골렘 돌 | Viscera | 해당 없음 / 일치 | — |
| 44 | Gargantuan Claws | 가르강튀아 발톱 | Viscera | 해당 없음 / 일치 | — |
| 45 | Hollowed Skull | 텅 빈 두개골 | Viscera | 해당 없음 / 일치 | — |
| 46 | Bonestalker's Ribcage | 뼈추적자의 흉곽 | Viscera | 해당 없음 / 일치 | — |
| 47 | Templar Skull | 템플러 두개골 | Viscera | 해당 없음 / 일치 | — |
| 48 | Arachnid Fangs | 거미류 송곳니 | Viscera | 해당 없음 / 일치 | — |
| 49 | Severed Stinger | 잘린 독침 | Viscera | 해당 없음 / 일치 | — |
| 50 | Bandit Rogue's Head | 도적 부랑자의 머리 | Viscera | 해당 없음 / 일치 | — |
| 51 | Poacher's Leg | 밀렵꾼의 다리 | Viscera | 해당 없음 / 일치 | — |
| 52 | Cobra Tail | 코브라 꼬리 | Viscera | 해당 없음 / 일치 | — |
| 53 | Bandit Witch's Head | 도적 마녀의 머리 | Viscera | 해당 없음 / 일치 | — |
| 54 | Arachnid Leg | 거미류 다리 | Viscera | 해당 없음 / 일치 | — |
| 55 | Vaal Appendage | 바알 수족 | Viscera | 해당 없음 / 일치 | — |
| 56 | Bandit Warrior's Head | 도적 전사의 머리 | Viscera | 해당 없음 / 일치 | — |
| 57 | Primate Foot | 영장류 발 | Viscera | 해당 없음 / 일치 | — |
| 58 | Ursine Flesh | 곰 살점 | Viscera | 해당 없음 / 일치 | — |
| 59 | Artificial Appendage | 인공물 수족 | Viscera | 해당 없음 / 일치 | — |
| 60 | Severed Scythe-hand | 잘린 낫손 | Viscera | 해당 없음 / 일치 | — |
| 61 | Captain's Leg | 대장의 다리 | Viscera | 해당 없음 / 일치 | — |
| 62 | Spined Claws | 가시 발톱 | Viscera | 해당 없음 / 일치 | — |
| 63 | Molten Core | 녹아내린 핵 | Viscera | 해당 없음 / 일치 | — |
| 64 | Defaced Bust | 손상된 흉상 | Viscera | 해당 없음 / 일치 | — |
| 65 | Spectral Hood | 영체 두건 | Viscera | 해당 없음 / 일치 | — |
| 66 | Soldier's Head | 병사의 머리 | Viscera | 해당 없음 / 일치 | — |
| 67 | Flaming Ribbon | 불을 뿜는 리본 | Viscera | 해당 없음 / 일치 | — |
| 68 | Statue Leg | 조각상 다리 | Viscera | 해당 없음 / 일치 | — |
| 69 | Voidbearer's Leg | 공허운반자의 다리 | Viscera | 해당 없음 / 일치 | — |
| 70 | Voltaic Apparatus | 전도성 기구 | Viscera | 해당 없음 / 일치 | — |
| 71 | General's Head | 장군의 머리 | Viscera | 해당 없음 / 일치 | — |
| 72 | Brute's Arm | 냉혈한의 팔 | Viscera | 해당 없음 / 일치 | — |
| 73 | Thaumaturge's Head | 마석학자의 머리 | Viscera | 해당 없음 / 일치 | — |
| 74 | Spiked Carapace | 가시 박힌 등딱지 | Viscera | 해당 없음 / 일치 | — |
| 75 | Skeletal Beast Leg | 해골 야수 다리 | Viscera | 해당 없음 / 일치 | — |
| 76 | Scholar's Arm | 학자의 팔 | Viscera | 해당 없음 / 일치 | — |
| 77 | Aristocrat's Torso | 귀족의 몸통 | Viscera | 해당 없음 / 일치 | — |
| 78 | Despot's Fist | 절대군주의 주먹 | Viscera | 해당 없음 / 일치 | — |
| 79 | Vulture's Gut | 시체매의 내장 | Viscera | 해당 없음 / 일치 | — |
| 80 | Templar Banner | 템플러 깃발 | Viscera | 해당 없음 / 일치 | — |
| 81 | Pocked Leg | 구멍투성이 다리 | Viscera | 해당 없음 / 일치 | — |
| 82 | Pocked Arm | 구멍투성이 팔 | Viscera | 해당 없음 / 일치 | — |
| 83 | Flesh-fused Lantern | 살점으로 융합된 등불 | Viscera | 해당 없음 / 일치 | — |
| 84 | Carved Haunches | 조각된 둔부 | Viscera | 해당 없음 / 일치 | — |
| 85 | Blazing Skull | 이글거리는 두개골 | Viscera | 해당 없음 / 일치 | — |
| 86 | Gladiator's Heart | 검투사의 심장 | Viscera | 해당 없음 / 일치 | — |
| 87 | Swordmaster's Blade | 검술가의 칼날 | Viscera | 해당 없음 / 일치 | — |
| 88 | Chitinous Leg | 키틴질 다리 | Viscera | 해당 없음 / 일치 | — |
| 89 | Engorged Eye | 충혈된 눈 | Viscera | 해당 없음 / 일치 | — |
| 90 | Corrupted Carapace | 타락한 등딱지 | Viscera | 해당 없음 / 일치 | — |
| 91 | Vendigo Claws | 벤디고 발톱 | Viscera | 해당 없음 / 일치 | — |
| 92 | Overseer's Whip | 간수의 채찍 | Viscera | 해당 없음 / 일치 | — |
| 93 | Justicar's Helm | 법관의 투구 | Viscera | 해당 없음 / 일치 | — |
| 94 | Flaming Furnace | 불을 뿜는 용광로 | Viscera | 해당 없음 / 일치 | — |
| 95 | Adherent's Crown | 지지자의 왕관 | Viscera | 해당 없음 / 일치 | — |
| 96 | Heretical Tome | 이단의 책 | Viscera | 해당 없음 / 일치 | — |
| 97 | Hallowed Descry | 거룩한 성표 | Viscera | 해당 없음 / 일치 | — |
| 98 | Skeletal Tail | 해골 꼬리 | Viscera | 해당 없음 / 일치 | — |
| 99 | Scholar's Leg | 학자의 다리 | Viscera | 해당 없음 / 일치 | — |
| 100 | Ravenous Skull | 굶주린 두개골 | Viscera | 해당 없음 / 일치 | — |
| 101 | Noble's Head | 귀족의 머리 | Viscera | 해당 없음 / 일치 | — |
| 102 | Conjoined Hound Head | 결합된 사냥개 머리 | Viscera | 해당 없음 / 일치 | — |
| 103 | Scout's Bow | 정찰병의 활 | Viscera | 해당 없음 / 일치 | — |
| 104 | Ancestor's Club | 선조의 곤봉 | Viscera | 해당 없음 / 일치 | — |
| 105 | Skeleton Wheel | 해골 바퀴 | Viscera | 해당 없음 / 일치 | — |
| 106 | Osseous Talon | 골질 발톱 | Viscera | 해당 없음 / 일치 | — |
| 107 | Flayed Visage | 박피된 얼굴 | Viscera | 해당 없음 / 일치 | — |
| 108 | Bear Head | 곰 머리 | Viscera | 해당 없음 / 일치 | — |
| 109 | Boar Head | 멧돼지 머리 | Viscera | 해당 없음 / 일치 | — |
| 110 | Stag Head | 수사슴 머리 | Viscera | 해당 없음 / 일치 | — |
| 111 | Arachnid Egg Sac | 거미류 알 주머니 | Viscera | 해당 없음 / 일치 | — |
| 112 | Infested Torso | 감염된 몸통 | Viscera | 해당 없음 / 일치 | — |
| 113 | King Crab's Claw | 왕게의 집게 | Viscera | 해당 없음 / 일치 | — |
| 114 | Calcified Leg | 석회화된 다리 | Viscera | 해당 없음 / 일치 | — |
| 115 | Wraith Claws | 악령의 발톱 | Viscera | 해당 없음 / 일치 | — |
| 116 | Infected Leg | 감염된 다리 | Viscera | 해당 없음 / 일치 | — |
| 117 | Inquisitor's Claw | 이단심문관의 클로 | Viscera | 해당 없음 / 일치 | — |
| 118 | Necromancer's Mask | 강령술사의 가면 | Viscera | 해당 없음 / 일치 | — |
| 119 | Ornate Torso | 화려한 몸통 | Viscera | 해당 없음 / 일치 | — |
| 120 | Devourer's Antenna | 포식자의 더듬이 | Viscera | 해당 없음 / 일치 | — |
| 121 | Blackened Lungs | 검게 변한 폐 | Viscera | 해당 없음 / 일치 | — |
| 122 | Construct's Head | 구조물의 머리 | Viscera | 해당 없음 / 일치 | — |
| 123 | Spider Queen's Head | 거미 여왕의 머리 | Viscera | 해당 없음 / 일치 | — |
| 124 | Dessicated Head | 바싹 마른 머리 | Viscera | 해당 없음 / 일치 | — |
| 125 | Hag's Stomach | 마녀의 위장 | Viscera | 해당 없음 / 일치 | — |
| 126 | Ghostly Claw | 귀신 클로 | Viscera | 해당 없음 / 일치 | — |
| 127 | Terrifying Maw | 공포스러운 아가리 | Viscera | 해당 없음 / 일치 | — |
| 128 | Armoured Leg | 장갑을 두른 다리 | Viscera | 해당 없음 / 일치 | — |
| 129 | Blackguard's Leg | 검은 근위병의 다리 | Viscera | 해당 없음 / 일치 | — |
| 130 | Champion's Banner | 용사의 깃발 | Viscera | 해당 없음 / 일치 | — |
| 131 | Lunar Bow | 달의 활 | Viscera | 해당 없음 / 일치 | — |
| 132 | Golden Ankh | 황금 앙크 | Viscera | 해당 없음 / 일치 | — |
| 133 | Gemling Torso | 마석병의 몸통 | Viscera | 해당 없음 / 일치 | — |
| 134 | Scarecrow's Pitchfork | 허수아비의 쇠스랑 | Viscera | 해당 없음 / 일치 | — |
| 135 | Charred Leg | 까맣게 탄 다리 | Viscera | 해당 없음 / 일치 | — |
| 136 | Sun-bleached Breastplate | 햇빛에 바랜 흉갑 | Viscera | 해당 없음 / 일치 | — |
| 137 | Resplendent Sceptre | 찬연한 셉터 | Viscera | 해당 없음 / 일치 | — |
| 138 | Solar Shield | 태양의 방패 | Viscera | 해당 없음 / 일치 | — |
| 139 | Crescent Blade | 초승달 칼날 | Viscera | 해당 없음 / 일치 | — |
| 140 | Smuggler's Hand | 밀수범의 손 | Viscera | 해당 없음 / 일치 | — |
| 141 | Coagulated Essence | 응고된 에센스 | Viscera | 해당 없음 / 일치 | — |
| 142 | Gelid Fangs | 극한의 송곳니 | Viscera | 해당 없음 / 일치 | — |
| 143 | Desert Sword | 사막 검 | Viscera | 해당 없음 / 일치 | — |
| 144 | Scorpion Stinger | 전갈 독침 | Viscera | 해당 없음 / 일치 | — |
| 145 | Lithic Haunches | 돌덩이 둔부 | Viscera | 해당 없음 / 일치 | — |
| 146 | Chimeral Eye | 키메랄 눈알 | Viscera | 해당 없음 / 일치 | — |
| 147 | Chaos Golem's Core | 카오스 골렘의 핵 | Viscera | 해당 없음 / 일치 | — |
| 148 | Desert Queen's Crown | 사막 여왕의 왕관 | Viscera | 해당 없음 / 일치 | — |
| 149 | Voltaic Skull | 전도성 해골 | Viscera | 해당 없음 / 일치 | — |
| 150 | Flayed Arm | 박피된 팔 | Viscera | 해당 없음 / 일치 | — |
| 151 | Inquisitor's Head | 이단심문관의 머리 | Viscera | 해당 없음 / 일치 | — |
| 152 | Witch's Head | 마녀의 머리 | Viscera | 해당 없음 / 일치 | — |
| 153 | Hag's Head | 악녀의 머리 | Viscera | 해당 없음 / 일치 | — |
| 154 | Diseased Wing | 질병 걸린 날개 | Viscera | 해당 없음 / 일치 | — |
| 155 | Bloodied Arm | 피투성이 팔 | Viscera | 해당 없음 / 일치 | — |
| 156 | Prosthetic Leg | 의족 | Viscera | 해당 없음 / 일치 | — |
| 157 | Distended Stomach | 팽창한 위장 | Viscera | 해당 없음 / 일치 | — |
| 158 | Smouldering Leg | 그을린 다리 | Viscera | 해당 없음 / 일치 | — |
| 159 | Broken Bust | 깨진 흉상 | Viscera | 해당 없음 / 일치 | — |
| 160 | Osseous Scythe | 골질 낫 | Viscera | 해당 없음 / 일치 | — |
| 161 | Flaming Goat Hoof | 불을 뿜는 염소 발굽 | Viscera | 해당 없음 / 일치 | — |
| 162 | Maven's Orrery | 메이븐의 천체 모형 | Viscera | 해당 없음 / 일치 | — |
| 163 | Sirus' Head | 사이러스의 머리 | Viscera | 해당 없음 / 일치 | — |
| 164 | Incarnation of Dread's Head | 불안의 화신의 머리 | Viscera | 해당 없음 / 일치 | — |
| 165 | Incarnation of Neglect's Cube | 방치의 화신의 육면체 | Viscera | 해당 없음 / 일치 | — |
| 166 | Incarnation of Fear's Head | 두려움의 화신의 머리 | Viscera | 해당 없음 / 일치 | — |
| 167 | Searing Exarch's Descry | 작열의 총주교의 성표 | Viscera | 해당 없음 / 일치 | — |
| 168 | Eater of Worlds' Head | 세계 포식자의 머리 | Viscera | 해당 없음 / 일치 | — |
| 169 | Elder's Head | 엘더의 머리 | Viscera | 해당 없음 / 일치 | — |
| 170 | Shaper's Head | 쉐이퍼의 머리 | Viscera | 해당 없음 / 일치 | — |
| 171 | Venarius' Scripture | 베나리우스의 성서 | Viscera | 해당 없음 / 일치 | — |
| 172 | Minotaur's Head | 미노타우로스의 머리 | Viscera | 해당 없음 / 일치 | — |
| 173 | Hydra's Head | 히드라의 머리 | Viscera | 해당 없음 / 일치 | — |
| 174 | Chimera's Head | 키메라의 머리 | Viscera | 해당 없음 / 일치 | — |
| 175 | Phoenix's Head | 불사조의 머리 | Viscera | 해당 없음 / 일치 | — |
| 176 | Constrictor's Head | 위압자의 머리 | Viscera | 해당 없음 / 일치 | — |
| 177 | Purifier's Head | 정화자의 머리 | Viscera | 해당 없음 / 일치 | — |
| 178 | Enslaver's Head | 조종자의 머리 | Viscera | 해당 없음 / 일치 | — |
| 179 | Eradicator's Head | 박멸자의 머리 | Viscera | 해당 없음 / 일치 | — |
| 180 | Baran's Head | 바란의 머리 | Viscera | 해당 없음 / 일치 | — |
| 181 | Veritania's Head | 베리타니아의 머리 | Viscera | 해당 없음 / 일치 | — |
| 182 | Drox's Head | 드록스의 머리 | Viscera | 해당 없음 / 일치 | — |
| 183 | Al-Hezmin's Head | 알-헤즈민의 머리 | Viscera | 해당 없음 / 일치 | — |
| 184 | Pit Fighter's Helm | 구덩이 투사의 투구 | Viscera | 해당 없음 / 일치 | — |
| 185 | Lion's Claws | 사자의 발톱 | Viscera | 해당 없음 / 일치 | — |
| 186 | Bat's Wings | 박쥐의 날개 | Viscera | 해당 없음 / 일치 | — |
| 187 | Nightmarish Book of Depravity | 악행의 악몽 같은 서 | Viscera | 해당 없음 / 일치 | — |
| 188 | Nightmarish Head of Uhtred | 우트레드의 악몽 같은 머리 | Viscera | 해당 없음 / 일치 | — |
| 189 | Nightmarish Core of the Unbreakable | 파괴 불가능한 존재의 악몽 같은 핵 | Viscera | 해당 없음 / 일치 | — |
| 190 | Nightmarish Wings of Lycia | 리키아의 악몽 같은 날개 | Viscera | 해당 없음 / 일치 | — |
| 191 | Nightmarish Wings of Catarina | 카타리나의 악몽 같은 날개 | Viscera | 해당 없음 / 일치 | — |
| 192 | Coven Queen's Crown | 마녀단 여왕의 왕관 | Viscera | 해당 없음 / 일치 | — |

## 기존 항목 건너뛰기 목록

| refName | ko 원천 이름 |
|---|---|
| Tempering Orb | 단조 오브 |
| Tailoring Orb | 재단 오브 |
| Allflame Ember of Kulemak | 쿨레막의 올플레임 잉걸불 |
| Allflame Ember of Resplendence | 광휘의 올플레임 잉걸불 |
| Allflame Ember of Propagation | 증식의 올플레임 잉걸불 |
| Allflame Ember of Flesh | 살점의 올플레임 잉걸불 |
| Allflame Ember of the Wildwood | 야생림의 올플레임 잉걸불 |
| Allflame Ember of the Ethereal | 천상에 속한 자의 올플레임 잉걸불 |
| Allflame Ember of the Gilded | 도금된 자의 올플레임 잉걸불 |
| Allflame Ember of Toads | 두꺼비의 올플레임 잉걸불 |
| Lightless Astrolabe | 무광의 관측기 |
| Grasping Astrolabe | 장악하는 관측기 |
| Nameless Astrolabe | 이름 없는 관측기 |
| Fungal Astrolabe | 곰팡이 관측기 |
| Chaotic Astrolabe | 혼돈의 관측기 |
| Timeless Astrolabe | 무궁한 관측기 |
| Runic Astrolabe | 룬의 관측기 |
| Karui Enshrouding Crystal | 카루이 휩싸는 수정 |
| Imperial Enshrouding Crystal | 제국 휩싸는 수정 |
| Vaal Enshrouding Crystal | 바알 휩싸는 수정 |
| Templar Enshrouding Crystal | 템플러 휩싸는 수정 |
| Maraketh Enshrouding Crystal | 마라케스 휩싸는 수정 |
