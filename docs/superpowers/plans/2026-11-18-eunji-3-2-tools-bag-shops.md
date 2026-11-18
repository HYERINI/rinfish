# 3-2 도구 칸·가방·요리·상인 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 낚시섬 세계에 은지 게임의 도구 칸(1~9, 1 = 낚싯대)·감정 표현 T 바퀴·Tab 큰 지도·가방(I)·먹기(F)·부엌 가스레인지 요리·버섯/호박 줍기·문 여닫기·마을 상인 3곳을 넣는다.

**Architecture:** 은지 아이템·배합법은 `data/meadowItems.ts`(은지 `items.js` 값 그대로, 같은지 테스트로 지킨다), 가격·누가 사고파는지는 `data/meadowPrices.ts`, 가방 규칙(태그 재료는 가장 많이 가진 것부터·F 로 고르기·먹기)은 `logic/inventory.ts`, 사고팔기는 `logic/meadowShop.ts` 순수 함수로 둔다. 저장은 `progressStore` v4 (`items`·`doors`). 손에 든 도구·가스레인지 요리·연 상인은 저장하지 않는 `sessionStore` 상태. 초원 E 대상(가스레인지·문·상인·버섯·호박)은 감지 상자 대신 은지 `consider` 처럼 바닥 거리로 가장 가까운 것 하나를 매 프레임 고르는 감시자(`meadow/MeadowInteractions.tsx`)가 정하고, 문 충돌 상자는 은지 좌표에서 직접 잰다(`logic/meadowColliders.doorBox`). 화면은 지금 키오스크(`Kiosk`)를 쓴다.

**Tech Stack:** React 19, @react-three/fiber 9, @react-three/rapier 2, three 0.186, zustand 5, vitest 5, oxlint.

**Spec:** `docs/superpowers/specs/2026-11-18-eunji-features-design.md` — 이 계획은 "3-2 도구 칸·가방·요리·상인" 과, "키 배치"·"저장"·"같이 하기 메시지"·"확인 방법" 가운데 3-2 몫만 만든다. 동물·휘두르기(3-3), 총·탄약 판매·1인칭(3-4)은 하지 않는다.

**기준 커밋:** `feat/eunji-features` 의 `eef70f5` (docs: 3-1 설계를 구현에 맞춤) 위에서 계획의 코드를 스크래치 복사본으로 Task 1~9 순서대로 모두 만들어 확인했다 (각 Task 끝마다 `npx tsc -b`·oxlint 6·vitest 통과, 마지막에 `npm run build` 와 `tools/meadow-check.mjs` 1~27 전부 OK). 시작할 때 HEAD 가 `eef70f5` 보다 앞서 있으면 바뀐 파일(특히 `Hud.tsx`·`interaction.ts`·`meadowSingleton.ts`·`tools/meadow-check.mjs`)의 "바꿀 곳" 글이 그대로 있는지 먼저 본다.

## Global Constraints

- 브랜치 `feat/eunji-features` 에서 그대로 커밋한다. push·main 합치기·서버 배포(`npm run server:deploy`)는 바깥에 영향을 주므로 **사용자에게 먼저 묻는다** (Task 9). 배포 순서는 **서버 먼저**: 서버 코드는 그대로지만 `parseClientMsg` 가 `src/game/logic/netProtocol.ts` 를 같이 쓰므로, 다시 배포해야 서버가 `tool` 필드와 은지 요리 먹기(`act.eat`)를 남에게 넘긴다 (옛 서버는 모르는 `eat` 이 든 모습 전체를 버린다).
- 은지 값 그대로: 아이템 25종(재료 12 + 요리 13)과 배합법 13가지·요리 시간(`items.js`), 은지 요리 먹기 = 체력 `sate × 2`·배고픔 `sate × 8`, F = 배고픔을 가장 많이 채우는 것부터, 태그 재료는 가장 많이 가진 것부터. E 거리 (바닥 거리, `<`): 문 2.5 · 버섯·호박 1.6 · 가스레인지 1.6 · 상인 2.8. 버섯은 따면 120초, 호박은 90초 뒤 다시 보인다 (내 화면만, 저장 안 함).
- 가격 (코인, `data/meadowPrices.ts` 한 파일): 파는 값 소고기 12 · 돼지고기 10 · 멧돼지고기 14 · 사슴고기 14 · 토끼고기 6 · 여우고기 6 · 닭고기 8 · 뼈 4 · 비계 4 · 달걀 4 · 호박 6 · 버섯 4 · 요리 `sate × 6 + 10` (22~46). 사는 값 달걀 8 · 호박 12 · 버섯 8. 정육점 = 고기·요리 삼 / 잡화점 = 뼈·비계 삼 (탄약은 3-4) / 농산물 가게 = 달걀·호박·버섯 사고팜.
- 좌표 변환: 세계 `(x, z) = (200 − x_은지, −z_은지)` (`toWorld`·`toMeadowLocal`). 은지 물건(Box3·center)은 **은지 좌표**로 잰다: `world.group` 은 180° 돌리고 200m 옮긴 그룹 아래라 `setFromObject`·월드 행렬로 잰 값은 세계 좌표가 된다 (그래서 문 상자는 `doorBox` 로 직접 잰다).
- 저장 키 `fishing-island-save-v1` 그대로, persist **version 4**. 필드만 늘어난다: `items`(없으면 빈 가방), `doors`(없으면 4개 모두 닫힘). 예전 저장본(version 1~3)은 그대로 열린다 (`migrateSave` 는 version ≥ 2 를 손대지 않는다).
- 같이 하기: `NET.protocolVersion` 은 **1 그대로**. `NetState` 에 선택 필드 `tool`(손에 든 도구, 빈손이면 없음)만 더한다. 틀린 `tool` 은 그 필드만 버린다(`boat` 와 같은 방식). 모르는 `act.eat` 은 "안 먹는 중" 으로 읽는다(모습 전체를 버리지 않는다).
- 새 모드 `emote`(T 바퀴)·`bag`(가방)·`vendor`(상인)를 모든 모드 검사에 맞춘다: `canLockPointer` 는 `emote` 를 더한다(바퀴는 잠긴 채 마우스로 고른다). 그 밖의 허용 목록(`canZoom` 의 `ZOOM_MODES`, `ChatBox` 의 `CHAT_MODES`, `TouchControls`, `timeStops`, `MAP_FROM`, `nextAction` 의 explore 검사)은 새 모드를 넣지 않는 게 맞다(패널·바퀴 중엔 확대·채팅·이동·감정 표현이 없다). `setMode('explore')` 는 배 타는 중 `boat` 로 바뀌는 규칙, `sleep` 모드 키 규칙은 그대로 둔다.
- oxlint 경고 기준선 **6** 을 늘리지 않는다 (`npm run lint 2>&1 | grep -c warning`). 컴포넌트 파일(.tsx)은 컴포넌트만 export 한다 (함수·상수는 .ts 로: `ui/eatFromBag.ts`, `scene/emojiTexture.ts`, `meadow/meadowActions.ts`). hook 에 넘긴 값을 `useFrame` 에서 고치지 않는다 — 매 프레임 바뀌는 것은 모듈 객체(은지 `world` 의 문·버섯, `playerRig`)에 둔다. 렌더 중에 `performance.now()` 를 부르지 않는다 (oxlint `react(purity)`).
- macOS 파일 이름은 대소문자를 가리지 않는다: 대소문자만 다른 두 파일을 만들지 않는다 (예: `meadowActions.ts` 옆에 `MeadowActions.tsx` 금지).
- 테스트 기준선 59 파일 / 608 개 (eef70f5). 이 계획을 다 하면 **65 파일 / 662 개**. `npx tsc -b` 깨끗 (server 프로젝트 포함).
- 커밋 메시지: `feat:`/`fix:`/`test:`/`docs:` 처럼 타입만(괄호 스코프 금지), 제목 짧게, 자세한 건 본문. Co-Authored-By·AI 생성 표기 금지.
- 코드 주석·UI 글은 한국어, 지금 코드 말투(평서형, 짧게). 아이콘은 은지처럼 이모지.
- 헤드리스 점검 준비: `npm run server:dev` (8787) 와 `VITE_ROOM_SERVER=ws://127.0.0.1:8787 npx vite --port 5190 --strictPort`. Vite 는 `::1` 에 뜨므로 점검 주소는 `http://localhost:5190`. 다른 사람이 같은 기계에서 점검을 돌리고 있으면 Chrome 디버깅 포트(9731~9741)가 겹쳐 남의 탭에 붙는다 — 그땐 포트를 바꾼 사본으로 돌린다.

## Review Focus

1. **옛 서버·옛 클라이언트와 섞일 때** — 서버를 다시 배포하기 전엔 `tool` 이 남에게 가지 않고, 은지 요리를 먹는 2.4초 동안 내 모습이 통째로 버려져 남 화면에서 멈춘다. 새 `readNetState`·`readAct` 는 모르는 도구·음식을 그 필드만 버리거나 "안 먹는 중" 으로 읽어야 한다 (Task 2·4 netProtocol 테스트 "모르는 음식은 안 먹는 중으로 읽고 모습은 살린다"·"tool 은 … 그 필드만 버린다", Task 9 배포는 서버 먼저).
2. **T 바퀴가 열린 채 갇히기** — 바퀴는 `emote` 모드라 이동·E 가 막힌다. T 를 누른 채 창 밖으로 포커스가 나가면 keyup 이 오지 않으므로 blur 에서 아무것도 하지 않고 닫아야 하고, ESC 는 닫기만(메뉴를 열지 않음), 채팅 입력 중 T 는 무시해야 한다. 마우스 잠금 중엔 잠금을 풀지 않고(`canLockPointer('emote')`) 움직임을 모아 고른다 (Task 3 테스트 `canLockPointer('emote')`·`shouldOpenMenuOnUnlock('emote')`·`resolveKeyAction('Escape','emote')`, meadow-check 18 "포커스를 잃으면 닫힌다"·"ESC 는 닫기만").
3. **초원 감시자와 감지 상자·물가 낚시가 nearby 를 서로 지우기** — 침대(감지 상자)는 거실 문(2.5m)과 겹치고, 섬에선 물가 낚시가 nearby 를 잡는다. 감시자는 자기가 잡은 종류(pickup·stove·door·vendor)만 바꾸고 지워야 한다 — 섬에서 `found = null` 이라고 낚시 자리를 지우면 섬 낚시가 깨진다 (Task 6 `meadowNearbyUpdate` 테스트, meadow-check 20 "섬 선착장 끝 낚시 안내").
4. **문이 처음 붙을 때와 여닫을 때의 충돌 상자** — 저장된 "열림" 으로 다시 들어오면 애니메이션 없이 열린 자리여야 하고(그래야 첫 프레임부터 지나갈 수 있다), 여닫으면 Rapier 상자가 은지 좌표로 잰 목표 자리로 바뀌어야 한다. 세계 행렬로 재면 상자가 200m 떨어진 곳에 생긴다 (Task 7 `doorBox` 가 은지 `door.collider` 와 같다는 테스트, `applyDoors` 즉시/애니메이션 테스트, meadow-check 24 "닫힌 문에 막힌다"·"열린 문으로 지나간다"·"저장한다").
5. **가스레인지 요리 중 자리를 떠나거나 다른 창을 열 때** — 은지처럼 요리는 돌아다녀도 이어져야 하고(가스레인지 앞이 아니어도·메뉴가 열려 있어도 시간이 되면 가방에), 요리 중엔 또 시작하지 않아야 한다(재료가 두 번 빠지지 않게) (Task 6 meadowActions 테스트 "요리하는 동안 가스레인지를 떠나거나 다른 창을 열어도"·"요리 중엔 또 시작하지 않고").

---

## 결정한 것 (스펙 해석)

- **아이템은 25종이다.** 스펙의 "22종" 은 잘못 센 수다: 은지 `ITEMS` 는 재료 12(고기 7·달걀·뼈·비계·호박·버섯) + 요리 13 = 25. 테스트가 은지 `items.js` 와 같은지 본다.
- **저장 버전은 4 다.** 스펙 "저장" 은 version 3 에 모든 필드를 적었지만 3 은 3-1 이 이미 썼다. 3-2 의 `items`·`doors` 는 version 4 (필드만 늘어 옮길 것은 없다). 3-4 의 탄약 등은 그때 5.
- **아이템·배합법은 TS 데이터로 옮긴다** (`data/meadowItems.ts`). 같이 하기 메시지 검사(`netProtocol.ts`)를 서버도 같이 쓰고 3-3 에서 서버가 전리품을 정하므로, lint 에서 빠진 은지 JS 를 서버가 끌고 가지 않게 한다. 은지 값과 같은지는 `meadowItems.test.ts` 가 지킨다. 전리품 표(`DROPS`)는 3-3 에서 옮긴다.
- **탄약 묶음 값은 3-4 에서 `meadowPrices.ts` 에 더한다** (쓰지 않는 값을 두지 않는다). 잡화점 "사기" 탭은 3-2 에서 "탄약은 곧 들어와요".
- **문은 처음엔 닫혀 있다** (은지 그대로). 1·2단계에서 모두 열어 두던 것을 없앤다. 예전 저장본도 닫힌 채 열린다 (문 상태는 저장되므로 한 번 열면 그대로).
- **문 충돌 상자는 누르는 순간 목표 자리로 바뀐다** (문짝은 은지처럼 0.5초쯤 돌아간다). 은지는 매 프레임 상자를 바꾸지만, React 로 매 프레임 Rapier 상자를 새로 만드는 대신 한 번만 바꾼다.
- **초원 E 대상은 감지 상자 대신 거리로 고른다** (은지 `consider`: 바닥 거리, 대상마다 거리, 가장 가까운 것). 버섯 22개가 모델이 들어오는 대로 생기고 문·상인 거리도 은지 값을 그대로 쓰기 쉽다. 침대 감지 상자(3-1)는 그대로 두고, 감지 상자·물가 낚시가 잡은 대상이 먼저다 (침대 상자 안에선 거실 문 E 가 안 잡힌다 — 문 바로 앞(침대 상자 밖)에선 잡힌다).
- **가방 F·눌러 먹기는 낚시섬 간식도 같이 본다.** 배고픔을 가장 많이 채우는 것부터, 같으면 은지 요리(사전 순서) 다음 간식. 재료(고기 등)는 먹지 않는다 (은지 그대로). 미스터찜 요리(물고기)는 가방에 들어오지 않는다 (지금처럼 주문하면 바로 먹는다).
- **가스레인지 요리는 재료를 시작할 때 뺀다** (은지 그대로). 요리 중 상태는 세션 상태라 새로고침하면 재료와 함께 사라진다. 요리하는 동안 돌아다녀도 되고 HUD 에 "🍳 달걀 프라이 요리 중… 2초".
- **가방 화면은 `bag` 모드**, 가스레인지에서 E 를 누르면 같은 가방이 "요리법" 탭부터 열리고 그때만 "요리하기" 버튼이 있다 (가스레인지 앞인지는 `nearby` 로 본다 — 패널이 열려 있는 동안 nearby 는 바뀌지 않는다).
- **상인 화면은 `vendor` 모드 + `sessionStore.vendor`**, 키오스크 탭 "팔기"(왼쪽)·"사기"(오른쪽). 팔기는 그 상인이 사는 것 중 가방에 있는 것만, 한 번에 가진 만큼까지. 사기는 한 번에 10개까지.
- **상인 모습**: 정육점 = 어부 할아버지, 잡화점 = 어부 아가씨, 농산물 가게 = 레인저(남) (`LOOK_PRESETS`). 노점 뒤 은지 (x, 12.4) 에 서서 분수 쪽(세계 +z)을 본다. 이름표는 그 가게 앞에 왔을 때만.
- **도구 칸**: 3-2 에는 1 낚싯대 · 2 주먹 · 3 칼만 있다. 주먹은 그릴 게 없고, 칼은 손에 작은 모형(`KnifeModel`)만 든다(휘두르기는 3-3). 빈 칸 숫자는 무시. 낚싯대 칸의 숫자는 고른 미끼 개수(미끼 없이면 "–"). 낚시 중 숫자 키는 지금처럼 미끼.
- **같이 하기 `tool`** 은 손에 든 도구(빈손이면 보내지 않음). 남의 낚싯대가 보이는지는 지금처럼 `rodOn` 이 정하고, `tool` 은 칼(3-4 에선 총)을 그리는 데만 쓴다.
- **감정 표현 바퀴는 `emote` 모드**: T 를 누르는 동안 이동·E 가 막히고 카메라가 돌지 않는다. 고르기는 마우스 방향(잠금 중엔 움직인 만큼 모아서, 잠금이 없으면 화면 가운데에서 커서까지) 또는 숫자 1~5. 아무것도 안 가리키고 떼면 그냥 닫힌다. 폰은 지금 😀 메뉴 그대로.
- **Tab 은 탐험·배·메뉴·지도에서** 큰 지도를 열고 닫는다 (메뉴의 지도 버튼·미니맵과 같은 `openMap`/`closeMap`). 포커스 이동을 막으려고 지도를 열고 닫을 때만 `preventDefault`.
- **폰의 가방 버튼은 오른쪽 아래 😀 옆**에 둔다 (스펙은 "위쪽에 가방·지도 버튼"). 세로 화면에선 위쪽 버튼 줄이 이미 코인 줄까지 와서 한 개 더 넣으면 코인이 가린다. 지도는 지금 미니맵을 누르면 열린다. 컴퓨터는 위쪽 줄에 "🎒 가방 (I)".
- **도구 칸 자리**: 컴퓨터는 아래 가운데(바닥 30px), E 안내는 그 위(96px), 마우스 잠금 안내는 더 위(144px), 키 안내 줄은 맨 아래 가운데. 폰은 쓰는 칸 3개만, 가로 화면은 조이스틱·버튼 사이 아래, 세로 화면은 조이스틱 위(174px)로 올리고 터치 안내 글을 그 위로 올린다.

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `src/game/data/meadowItems.ts` (+test) | 은지 아이템 25종·배합법 13가지 (TS 복사본, 은지 `items.js` 와 같은지 테스트) |
| `src/game/data/meadowPrices.ts` | 파는 값·사는 값·요리 값 공식, 상인별 사고파는 것 |
| `src/game/logic/inventory.ts` (+test) | 가방 개수(`ItemCounts`), 넣기·빼기, 태그 개수, 요리 가능·재료 빼기, 먹기(체력·배고픔), F 고르기 |
| `src/game/logic/meadowShop.ts` (+test) | 상인에게 팔기·사기 결과 |
| `src/game/data/types.ts` | `FoodId` 에 은지 요리 |
| `src/game/scene/emojiTexture.ts`, `src/game/scene/FoodInHand.tsx` | 손에 든 은지 요리는 이모지 판 |
| `src/game/stores/progressStore.ts` (+test) | 저장 v4: `items`·`doors`, 먹기·F·요리 시작·사고팔기·문 |
| `src/game/logic/emoteWheel.ts` (+test), `src/game/ui/EmoteWheel.tsx` | T 바퀴 고르기 계산, 바퀴 화면과 키·마우스 |
| `src/game/logic/interaction.ts` (+test) | 모드 `emote`·`bag`·`vendor`, 대상 `pickup`·`stove`·`door`·`vendor`, 키 Tab·1~9·X·F·I·E |
| `src/game/logic/mouseLook.ts` (+test) | `canLockPointer('emote')` |
| `src/game/data/tools.ts` | 도구 3개, 도구 칸 9칸, 숫자 키 → 칸 |
| `src/game/logic/playerMotion.ts` (+test) | `rodVisible` → `shownTool` (손에 그릴 도구) |
| `src/game/stores/sessionStore.ts` (+test) | `tool`·`equip`, `stoveCook`, `vendor`·`openVendor` |
| `src/game/logic/netProtocol.ts` (+test), `src/game/net/NetBridge.tsx` | `NetState.tool`, 은지 요리 `FOOD_IDS`, 모르는 음식 너그럽게 |
| `src/game/scene/tools/KnifeModel.tsx`, `src/game/scene/Player.tsx`, `src/game/scene/RemotePlayer.tsx` | 칼 모형, 든 도구만 그리기 |
| `src/game/ui/Hotbar.tsx`, `src/game/ui/styles.ts`, `src/game/data/touch.ts` | 도구 칸 화면과 아래쪽 안내 자리 |
| `src/game/ui/BagPanel.tsx`, `src/game/ui/eatFromBag.ts` | 가방 키오스크(가방·요리법), 가방에서 먹기·F |
| `src/game/ui/VendorPanel.tsx` | 상인 키오스크(팔기·사기) |
| `src/game/ui/Panels.tsx`, `src/game/ui/Hud.tsx`, `src/game/ui/TouchControls.tsx`, `src/game/ui/interactLabel.ts`, `src/game/Game.tsx` | 새 패널·버튼·요리 중 표시·E 글씨·키 안내 |
| `src/game/input/useInteractionKeys.ts`, `src/game/input/usePlayerActionKeys.ts`, `src/game/data/emotes.ts` | 새 키 동작 잇기, 숫자 키 감정 표현 없애기 |
| `src/game/logic/meadowInteract.ts` (+test) | 초원 E 대상 거리·가장 가까운 것, 감시자가 nearby 를 바꾸는 규칙 |
| `src/game/logic/meadowColliders.ts` (+test) | `doorBox` (은지 좌표 문짝 상자) |
| `src/game/data/meadow.ts` | 문 이름 4개, 상인 3곳 자리·모습 |
| `src/meadow/meadowSingleton.ts` (+test) | 버섯·호박 따기·다시 자라기, E 대상 목록, 문 상자·문 상태 맞추기 |
| `src/meadow/meadowActions.ts` (+test) | 따기·가스레인지 요리 시작/완성·문 여닫기 |
| `src/meadow/MeadowInteractions.tsx`, `src/meadow/MeadowDoors.tsx`, `src/meadow/MeadowVendors.tsx`, `src/meadow/MeadowWorld.tsx`, `src/game/scene/World.tsx` | 감시자, 문 충돌체·애니메이션, 상인 사람 모습, 붙이기 |
| `src/meadow/vendor/{items,town,world}.d.ts`, `src/meadow/vendor.test.ts` | 은지 타입(아이템·상인·문·버섯·가스레인지), 은지 값과 같은지 |
| `tools/meadow-check.mjs` | 헤드리스 점검 18~27 |

---
### Task 1: 은지 아이템·가방 규칙·가격 (순수)

**Files:**
- Create: `src/game/data/meadowItems.ts`, `src/game/data/meadowPrices.ts`, `src/game/logic/inventory.ts`, `src/game/logic/meadowShop.ts`, `src/meadow/vendor/items.d.ts`
- Test: `src/game/data/meadowItems.test.ts`, `src/game/logic/inventory.test.ts`, `src/game/logic/meadowShop.test.ts`

**Interfaces:**
- Consumes: `SNACKS`·`SnackId` (`data/snacks.ts`), `SnackCounts`·`NO_SNACKS` (`logic/snacks.ts`)
- Produces:
  - `type RawItemId`, `type MeadowDishId`, `type ItemId = RawItemId | MeadowDishId`, `type ItemTag = 'meat' | 'dish'`, `ITEMS: Record<ItemId, { name; icon; tags; sate?; desc }>`, `ITEM_IDS: ItemId[]` (사전 순서), `MEADOW_DISH_IDS: MeadowDishId[]`, `TAGS`, `type Ingredient = { id: ItemId; n } | { tag: ItemTag; n }`, `type Recipe = { id; name; time; ingredients; result }`, `RECIPES: Recipe[]`, `getRecipe(id)`, `hasTag(id, tag)`, `isMeadowDish(id: string): id is MeadowDishId` (`data/meadowItems.ts`)
  - `SELL_PRICE`, `DISH_PRICE`, `BUY_PRICE: Partial<Record<ItemId, number>>`, `sellPrice(id): number`, `type VendorId = 'butcher' | 'general' | 'grocer'`, `VENDOR_IDS`, `VENDOR_TRADE: Record<VendorId, { buys(id): boolean; sells: ItemId[] }>` (`data/meadowPrices.ts`)
  - `type ItemCounts = Record<ItemId, number>`, `NO_ITEMS`, `addItems(items, id, n = 1)`, `removeItems(items, id, n = 1): ItemCounts | null`, `tagCount(items, tag)`, `ingredientHave(items, ingredient)`, `canCook(items, recipe)`, `consumeRecipe(items, recipe): ItemCounts | null`, `dishFill(id): { heal; hunger }`, `type BagFood = MeadowDishId | SnackId`, `bagFoodFill(id)`, `bestFood(items, snacks): BagFood | null` (`logic/inventory.ts`)
  - `type TradeResult`, `sellToVendor(coins, items, vendor, id, qty)`, `buyFromVendor(coins, items, vendor, id, qty)` (`logic/meadowShop.ts`)

- [ ] **Step 1: 실패하는 테스트 쓰기**

`src/game/data/meadowItems.test.ts` (은지 `items.js` 를 직접 불러 비교한다):

```ts
import { describe, expect, it } from 'vitest'
import * as eunji from '../../meadow/vendor/items.js'
import { ITEMS, ITEM_IDS, MEADOW_DISH_IDS, RECIPES } from './meadowItems'

describe('은지 아이템 TS 복사본', () => {
  it('25종 물건(재료 12 + 요리 13)의 이름·아이콘·태그·포만감이 은지 items.js 와 같다 (순서까지)', () => {
    expect(ITEM_IDS).toEqual(Object.keys(eunji.ITEMS))
    expect(ITEM_IDS).toHaveLength(25)
    for (const id of ITEM_IDS) expect(ITEMS[id]).toEqual(eunji.ITEMS[id])
  })
  it('배합법 13가지가 같다', () => {
    expect(RECIPES).toEqual(eunji.RECIPES)
    expect(MEADOW_DISH_IDS).toHaveLength(13)
    expect(RECIPES.map((r) => r.result).sort()).toEqual([...MEADOW_DISH_IDS].sort())
  })
})
```

`src/game/logic/inventory.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { getRecipe } from '../data/meadowItems'
import { NO_SNACKS } from './snacks'
import { NO_ITEMS, addItems, bagFoodFill, bestFood, canCook, consumeRecipe, dishFill, ingredientHave, removeItems, tagCount } from './inventory'

describe('가방 (은지 Inventory)', () => {
  it('넣고 빼기. 모자라거나 이상한 개수면 빼지 않는다', () => {
    const a = addItems(NO_ITEMS, 'egg', 2)
    expect(a.egg).toBe(2)
    expect(removeItems(a, 'egg', 1)?.egg).toBe(1)
    expect(removeItems(a, 'egg', 3)).toBeNull()
    expect(removeItems(a, 'egg', 0)).toBeNull()
    expect(addItems(a, 'egg', 0)).toBe(a)
    expect(addItems(a, 'egg', 1.5)).toBe(a)
  })
  it('태그 개수는 고기를 모두 더한다', () => {
    const items = { ...NO_ITEMS, beef: 2, rabbit: 1, egg: 5 }
    expect(tagCount(items, 'meat')).toBe(3)
    expect(ingredientHave(items, { tag: 'meat', n: 1 })).toBe(3)
    expect(ingredientHave(items, { id: 'egg', n: 1 })).toBe(5)
  })
  it('재료가 다 있어야 요리할 수 있다', () => {
    const steak = getRecipe('steak')
    expect(canCook({ ...NO_ITEMS, beef: 1 }, steak)).toBe(false)
    expect(canCook({ ...NO_ITEMS, beef: 1, fat: 1 }, steak)).toBe(true)
    expect(consumeRecipe({ ...NO_ITEMS, beef: 1 }, steak)).toBeNull()
  })
  it('태그 재료(아무 고기)는 가장 많이 가진 고기부터 쓴다', () => {
    const items = { ...NO_ITEMS, beef: 1, pork: 3, mushroom: 1 }
    const after = consumeRecipe(items, getRecipe('skewer'))!
    expect(after.pork).toBe(1)
    expect(after.beef).toBe(1)
    expect(after.mushroom).toBe(0)
  })
  it('가장 많은 고기가 모자라면 다음 고기로 채운다 (같은 수면 사전 순서)', () => {
    const after = consumeRecipe({ ...NO_ITEMS, beef: 1, pork: 1, mushroom: 1 }, getRecipe('skewer'))!
    expect([after.beef, after.pork]).toEqual([0, 0])
    const one = consumeRecipe({ ...NO_ITEMS, beef: 1, pork: 1 }, getRecipe('roast'))!
    expect([one.beef, one.pork]).toEqual([0, 1])
  })
  it('은지 요리: 체력 sate×2, 배고픔 sate×8', () => {
    expect(dishFill('steak')).toEqual({ heal: 10, hunger: 40 })
    expect(bagFoodFill('ramen')).toEqual({ heal: 45, hunger: 50 })
  })
  it('F: 배고픔을 가장 많이 채우는 것부터. 간식도 같이 본다', () => {
    expect(bestFood(NO_ITEMS, NO_SNACKS)).toBeNull()
    expect(bestFood({ ...NO_ITEMS, roast: 1, steak: 1 }, NO_SNACKS)).toBe('steak')
    // 컵라면 50 > 스테이크 40
    expect(bestFood({ ...NO_ITEMS, steak: 1 }, { ...NO_SNACKS, ramen: 1 })).toBe('ramen')
    // 닭고기 수프 48 = 멧돼지 스튜 48 → 사전 순서(멧돼지 스튜 먼저)
    expect(bestFood({ ...NO_ITEMS, chickensoup: 1, boarstew: 1 }, NO_SNACKS)).toBe('boarstew')
    // 재료(고기)는 먹지 않는다
    expect(bestFood({ ...NO_ITEMS, beef: 3 }, NO_SNACKS)).toBeNull()
  })
})
```

`src/game/logic/meadowShop.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ITEM_IDS } from '../data/meadowItems'
import { BUY_PRICE, VENDOR_TRADE, sellPrice } from '../data/meadowPrices'
import { NO_ITEMS } from './inventory'
import { buyFromVendor, sellToVendor } from './meadowShop'

describe('마을 상인 가격 (스펙 표)', () => {
  it('파는 값: 고기·부산물·채집, 요리는 sate×6+10', () => {
    expect([sellPrice('beef'), sellPrice('pork'), sellPrice('boar'), sellPrice('venison'), sellPrice('rabbit'), sellPrice('foxmeat'), sellPrice('chicken')]).toEqual([12, 10, 14, 14, 6, 6, 8])
    expect([sellPrice('bone'), sellPrice('fat'), sellPrice('egg'), sellPrice('pumpkin'), sellPrice('mushroom')]).toEqual([4, 4, 4, 6, 4])
    expect(sellPrice('roast')).toBe(22)
    expect(sellPrice('boarstew')).toBe(46)
  })
  it('사는 값: 달걀 8 · 호박 12 · 버섯 8', () => {
    expect(BUY_PRICE).toEqual({ egg: 8, pumpkin: 12, mushroom: 8 })
  })
  it('모든 물건은 누군가 산다 (팔 곳 없는 물건이 없다)', () => {
    for (const id of ITEM_IDS) expect(Object.values(VENDOR_TRADE).some((v) => v.buys(id))).toBe(true)
  })
})

describe('사고팔기', () => {
  it('정육점은 고기·요리를 산다. 달걀은 안 산다', () => {
    const r = sellToVendor(5, { ...NO_ITEMS, beef: 3, steak: 1 }, 'butcher', 'beef', 2)
    expect(r).toEqual({ ok: true, coins: 29, items: { ...NO_ITEMS, beef: 1, steak: 1 } })
    expect(sellToVendor(0, { ...NO_ITEMS, egg: 1 }, 'butcher', 'egg', 1)).toEqual({ ok: false, reason: 'vendor' })
  })
  it('가진 것보다 많이 팔 수 없다', () => {
    expect(sellToVendor(0, { ...NO_ITEMS, bone: 1 }, 'general', 'bone', 2)).toEqual({ ok: false, reason: 'qty' })
  })
  it('농산물 가게에서 산다. 코인이 모자라거나 안 파는 물건이면 실패', () => {
    expect(buyFromVendor(20, NO_ITEMS, 'grocer', 'pumpkin', 1)).toEqual({ ok: true, coins: 8, items: { ...NO_ITEMS, pumpkin: 1 } })
    expect(buyFromVendor(20, NO_ITEMS, 'grocer', 'pumpkin', 2)).toEqual({ ok: false, reason: 'coins' })
    expect(buyFromVendor(100, NO_ITEMS, 'butcher', 'egg', 1)).toEqual({ ok: false, reason: 'vendor' })
    expect(buyFromVendor(100, NO_ITEMS, 'grocer', 'egg', 0)).toEqual({ ok: false, reason: 'qty' })
  })
})
```

- [ ] **Step 2: 실행해 실패 확인**

Run: `npx vitest run src/game/data/meadowItems.test.ts src/game/logic/inventory.test.ts src/game/logic/meadowShop.test.ts`
Expected: FAIL — `Failed to resolve import "./meadowItems"` 등 (파일이 아직 없다)

- [ ] **Step 3: 은지 아이템 타입과 TS 복사본**

`src/meadow/vendor/items.d.ts` (테스트에서 은지 값을 읽을 때만 쓴다):

```ts
/** 은지 아이템 사전 (우리 TS 복사본 data/meadowItems.ts 와 같은지 테스트에서만 비교한다) */
export const ITEMS: Record<string, { name: string; icon: string; tags: string[]; sate?: number; desc: string }>
export const RECIPES: { id: string; name: string; time: number; ingredients: ({ id: string; n: number } | { tag: string; n: number })[]; result: string }[]
export function hasTag(id: string, tag: string): boolean
```

`src/game/data/meadowItems.ts`:

```ts
/**
 * 은지 게임 식재료·요리·배합법 (은지 `src/meadow/vendor/items.js` 값을 그대로 옮긴 것. 같은지 meadowItems.test 가 본다).
 * 서버(3-3 전리품)와 같이 하기 메시지(먹는 요리)도 쓰므로 은지 JS 가 아닌 TS 데이터로 둔다
 */

export type RawItemId = 'beef' | 'pork' | 'boar' | 'venison' | 'rabbit' | 'foxmeat' | 'chicken' | 'egg' | 'bone' | 'fat' | 'pumpkin' | 'mushroom'
export type MeadowDishId =
  | 'roast'
  | 'skewer'
  | 'steak'
  | 'porkbelly'
  | 'boarstew'
  | 'venisonstew'
  | 'rabbitbraise'
  | 'chickensoup'
  | 'bonebroth'
  | 'pumpkinsoup'
  | 'mushroomfry'
  | 'friedegg'
  | 'omelet'
/** 가방에 들어가는 은지 물건 25종 (재료 12 + 요리 13. 스펙의 "22종" 은 잘못 센 수) */
export type ItemId = RawItemId | MeadowDishId
export type ItemTag = 'meat' | 'dish'

export type ItemDef = {
  name: string
  /** 그림 대신 쓰는 이모지 (은지 그대로) */
  icon: string
  tags: ItemTag[]
  /** 요리만: 포만감 2~6. 먹으면 배고픔 sate × 8, 체력 sate × 2 */
  sate?: number
  desc: string
}

export const ITEMS: Record<ItemId, ItemDef> = {
  beef: { name: '소고기', icon: '🥩', tags: ['meat'], desc: '소에서 2개. 스테이크·꼬치의 재료' },
  pork: { name: '돼지고기', icon: '🥓', tags: ['meat'], desc: '돼지에서 2개. 삼겹살 구이' },
  boar: { name: '멧돼지고기', icon: '🍖', tags: ['meat'], desc: '멧돼지에서 2개. 스튜에 어울린다' },
  venison: { name: '사슴고기', icon: '🦌', tags: ['meat'], desc: '사슴에서 2개. 담백해서 스튜·꼬치' },
  rabbit: { name: '토끼고기', icon: '🐇', tags: ['meat'], desc: '토끼에서 1개. 조림' },
  foxmeat: { name: '여우고기', icon: '🦊', tags: ['meat'], desc: '여우에서 1개. 구이' },
  chicken: { name: '닭고기', icon: '🍗', tags: ['meat'], desc: '병아리에서 1개. 수프' },
  egg: { name: '달걀', icon: '🥚', tags: [], desc: '병아리가 가끔 떨어뜨린다. 프라이·오믈렛' },
  bone: { name: '뼈', icon: '🦴', tags: [], desc: '소·멧돼지·사슴에서. 사골 국물' },
  fat: { name: '비계', icon: '🧈', tags: [], desc: '돼지·멧돼지에서. 스테이크에 풍미를' },
  pumpkin: { name: '호박', icon: '🎃', tags: [], desc: '주방 뒤 텃밭. 90초 뒤 다시 자란다' },
  mushroom: { name: '버섯', icon: '🍄', tags: [], desc: '울타리 밖 숲 바닥. 2분 뒤 다시 자란다' },
  roast: { name: '구운 고기', icon: '🍖', tags: ['dish'], sate: 2, desc: '아무 고기나 구운 것' },
  skewer: { name: '꼬치구이', icon: '🍢', tags: ['dish'], sate: 4, desc: '고기와 버섯을 꿰어 구웠다' },
  steak: { name: '스테이크', icon: '🥩', tags: ['dish'], sate: 5, desc: '소고기를 비계로 구운 것' },
  porkbelly: { name: '삼겹살 구이', icon: '🥓', tags: ['dish'], sate: 4, desc: '돼지고기 두 덩이' },
  boarstew: { name: '멧돼지 스튜', icon: '🍲', tags: ['dish'], sate: 6, desc: '멧돼지고기·호박·버섯' },
  venisonstew: { name: '사슴 스튜', icon: '🍲', tags: ['dish'], sate: 5, desc: '사슴고기와 버섯' },
  rabbitbraise: { name: '토끼 조림', icon: '🥘', tags: ['dish'], sate: 4, desc: '토끼고기와 호박' },
  chickensoup: { name: '닭고기 수프', icon: '🍜', tags: ['dish'], sate: 6, desc: '닭고기·달걀·뼈' },
  bonebroth: { name: '사골 국물', icon: '🍵', tags: ['dish'], sate: 3, desc: '뼈 두 개를 오래 끓인 것' },
  pumpkinsoup: { name: '호박죽', icon: '🥣', tags: ['dish'], sate: 3, desc: '호박 두 개' },
  mushroomfry: { name: '버섯 볶음', icon: '🍄', tags: ['dish'], sate: 3, desc: '버섯 세 개' },
  friedegg: { name: '달걀 프라이', icon: '🍳', tags: ['dish'], sate: 2, desc: '달걀 하나' },
  omelet: { name: '호박 오믈렛', icon: '🍳', tags: ['dish'], sate: 5, desc: '달걀 두 개와 호박' },
}

/** 사전 순서 (가방·상점 카드 순서) */
export const ITEM_IDS = Object.keys(ITEMS) as ItemId[]
export const MEADOW_DISH_IDS = ITEM_IDS.filter((id) => ITEMS[id].tags.includes('dish')) as MeadowDishId[]

export const TAGS: Record<ItemTag, { name: string; icon: string }> = { meat: { name: '아무 고기', icon: '🥩' }, dish: { name: '요리', icon: '🍽️' } }

/** 배합법 재료 한 줄: 정해진 물건 n 개 또는 태그(아무 고기) n 개 */
export type Ingredient = { id: ItemId; n: number } | { tag: ItemTag; n: number }
export type Recipe = { id: MeadowDishId; name: string; /** 요리 시간(초) */ time: number; ingredients: Ingredient[]; result: MeadowDishId }

export const RECIPES: Recipe[] = [
  { id: 'roast', name: '구운 고기', time: 2.5, ingredients: [{ tag: 'meat', n: 1 }], result: 'roast' },
  { id: 'friedegg', name: '달걀 프라이', time: 2, ingredients: [{ id: 'egg', n: 1 }], result: 'friedegg' },
  { id: 'skewer', name: '꼬치구이', time: 3, ingredients: [{ tag: 'meat', n: 2 }, { id: 'mushroom', n: 1 }], result: 'skewer' },
  { id: 'steak', name: '스테이크', time: 4, ingredients: [{ id: 'beef', n: 1 }, { id: 'fat', n: 1 }], result: 'steak' },
  { id: 'porkbelly', name: '삼겹살 구이', time: 3.5, ingredients: [{ id: 'pork', n: 2 }], result: 'porkbelly' },
  { id: 'mushroomfry', name: '버섯 볶음', time: 2.5, ingredients: [{ id: 'mushroom', n: 3 }], result: 'mushroomfry' },
  { id: 'pumpkinsoup', name: '호박죽', time: 4, ingredients: [{ id: 'pumpkin', n: 2 }], result: 'pumpkinsoup' },
  { id: 'omelet', name: '호박 오믈렛', time: 3.5, ingredients: [{ id: 'egg', n: 2 }, { id: 'pumpkin', n: 1 }], result: 'omelet' },
  { id: 'bonebroth', name: '사골 국물', time: 6, ingredients: [{ id: 'bone', n: 2 }], result: 'bonebroth' },
  { id: 'rabbitbraise', name: '토끼 조림', time: 4, ingredients: [{ id: 'rabbit', n: 1 }, { id: 'pumpkin', n: 1 }], result: 'rabbitbraise' },
  { id: 'venisonstew', name: '사슴 스튜', time: 5, ingredients: [{ id: 'venison', n: 1 }, { id: 'mushroom', n: 2 }], result: 'venisonstew' },
  { id: 'boarstew', name: '멧돼지 스튜', time: 6, ingredients: [{ id: 'boar', n: 1 }, { id: 'pumpkin', n: 1 }, { id: 'mushroom', n: 1 }], result: 'boarstew' },
  { id: 'chickensoup', name: '닭고기 수프', time: 5, ingredients: [{ id: 'chicken', n: 1 }, { id: 'egg', n: 1 }, { id: 'bone', n: 1 }], result: 'chickensoup' },
]

export function getRecipe(id: MeadowDishId): Recipe {
  const r = RECIPES.find((x) => x.id === id)
  if (!r) throw new Error(`알 수 없는 배합법: ${id}`)
  return r
}

export const hasTag = (id: ItemId, tag: ItemTag): boolean => ITEMS[id].tags.includes(tag)
export const isMeadowDish = (id: string): id is MeadowDishId => (MEADOW_DISH_IDS as string[]).includes(id)
```

- [ ] **Step 4: 가격** — `src/game/data/meadowPrices.ts`

```ts
import { ITEMS, hasTag, type ItemId, type RawItemId } from './meadowItems'

/**
 * 마을 상인 가격 (코인). 은지 "원" 값의 약 2배: 고기 ≈ 흔한·희귀 물고기, 요리 ≈ 간식. 나중에 맞추기 쉽게 숫자는 여기에만 둔다.
 * 탄약 묶음(권총 80 · 소총 150 · 산탄 120 · 저격 250)은 3-4 에서 잡화점에 연다
 */
export const SELL_PRICE: Record<RawItemId, number> = {
  beef: 12,
  pork: 10,
  boar: 14,
  venison: 14,
  rabbit: 6,
  foxmeat: 6,
  chicken: 8,
  bone: 4,
  fat: 4,
  egg: 4,
  pumpkin: 6,
  mushroom: 4,
}

/** 요리 파는 값: 포만감 × 6 + 10 (22~46) */
export const DISH_PRICE = { perSate: 6, base: 10 }

/** 상인이 파는 물건과 값 (달걀·호박·버섯만) */
export const BUY_PRICE: Partial<Record<ItemId, number>> = { egg: 8, pumpkin: 12, mushroom: 8 }

/** 물건 하나를 상인에게 팔 때 받는 값 */
export function sellPrice(id: ItemId): number {
  const sate = ITEMS[id].sate
  return sate !== undefined ? sate * DISH_PRICE.perSate + DISH_PRICE.base : SELL_PRICE[id as RawItemId]
}

export type VendorId = 'butcher' | 'general' | 'grocer'
export const VENDOR_IDS: VendorId[] = ['butcher', 'general', 'grocer']

/** 누가 무엇을 사고(buys) 파는지(sells). 은지 VENDORS 그대로: 정육점 고기·요리 삼 / 잡화점 뼈·비계 삼 (탄약은 3-4) / 농산물 사고팜 */
export const VENDOR_TRADE: Record<VendorId, { buys: (id: ItemId) => boolean; sells: ItemId[] }> = {
  butcher: { buys: (id) => hasTag(id, 'meat') || hasTag(id, 'dish'), sells: [] },
  general: { buys: (id) => id === 'bone' || id === 'fat', sells: [] },
  grocer: { buys: (id) => id === 'egg' || id === 'pumpkin' || id === 'mushroom', sells: ['egg', 'pumpkin', 'mushroom'] },
}
```

- [ ] **Step 5: 가방 규칙과 사고팔기**

`src/game/logic/inventory.ts`:

```ts
import { ITEMS, ITEM_IDS, MEADOW_DISH_IDS, hasTag, type Ingredient, type ItemId, type ItemTag, type MeadowDishId, type Recipe } from '../data/meadowItems'
import { SNACKS, type SnackId } from '../data/snacks'
import type { SnackCounts } from './snacks'

/** 은지 물건별 가방 속 개수 (은지 Inventory 를 순수 함수로). 칸 수 제한은 없다 */
export type ItemCounts = Record<ItemId, number>

export const NO_ITEMS: ItemCounts = Object.fromEntries(ITEM_IDS.map((id) => [id, 0])) as ItemCounts

export function addItems(items: ItemCounts, id: ItemId, n = 1): ItemCounts {
  if (!Number.isInteger(n) || n < 1) return items
  return { ...items, [id]: items[id] + n }
}

/** n 개를 뺀다. 모자라면 null */
export function removeItems(items: ItemCounts, id: ItemId, n = 1): ItemCounts | null {
  if (!Number.isInteger(n) || n < 1 || items[id] < n) return null
  return { ...items, [id]: items[id] - n }
}

/** 태그(아무 고기 등)가 붙은 물건 개수 합 */
export function tagCount(items: ItemCounts, tag: ItemTag): number {
  return ITEM_IDS.reduce((sum, id) => sum + (hasTag(id, tag) ? items[id] : 0), 0)
}

/** 재료 한 줄을 가진 수 (태그면 그 태그 물건 합) */
export const ingredientHave = (items: ItemCounts, s: Ingredient): number => ('tag' in s ? tagCount(items, s.tag) : items[s.id])

export const canCook = (items: ItemCounts, recipe: Recipe): boolean => recipe.ingredients.every((s) => ingredientHave(items, s) >= s.n)

/** 재료를 뺀 가방. 태그 재료는 가장 많이 가진 것부터 쓴다 (같으면 사전 순서). 모자라면 null */
export function consumeRecipe(items: ItemCounts, recipe: Recipe): ItemCounts | null {
  if (!canCook(items, recipe)) return null
  const next = { ...items }
  for (const s of recipe.ingredients) {
    if ('id' in s) {
      next[s.id] -= s.n
      continue
    }
    let left = s.n
    const pool = ITEM_IDS.filter((id) => hasTag(id, s.tag) && next[id] > 0).sort((a, b) => next[b] - next[a])
    for (const id of pool) {
      const take = Math.min(left, next[id])
      next[id] -= take
      left -= take
      if (left === 0) break
    }
  }
  return next
}

/** 은지 요리를 먹으면: 체력 sate × 2, 배고픔 sate × 8 (은지 그대로) */
export function dishFill(id: MeadowDishId): { heal: number; hunger: number } {
  const sate = ITEMS[id].sate ?? 0
  return { heal: sate * 2, hunger: sate * 8 }
}

/** 가방에서 먹을 수 있는 것: 은지 요리 또는 낚시섬 간식 */
export type BagFood = MeadowDishId | SnackId

/** 먹으면 차는 체력·배고픔 */
export function bagFoodFill(id: BagFood): { heal: number; hunger: number } {
  const snack = SNACKS.find((s) => s.id === id)
  return snack ? { heal: snack.heal, hunger: snack.hunger } : dishFill(id as MeadowDishId)
}

/**
 * F 키: 배고픔을 가장 많이 채우는 것부터 (은지 eatBest). 같으면 은지 요리가 먼저(사전 순서), 그다음 간식. 먹을 게 없으면 null
 */
export function bestFood(items: ItemCounts, snacks: SnackCounts): BagFood | null {
  const owned: BagFood[] = [...MEADOW_DISH_IDS.filter((id) => items[id] > 0), ...SNACKS.filter((s) => snacks[s.id] > 0).map((s) => s.id)]
  let best: BagFood | null = null
  for (const id of owned) if (best === null || bagFoodFill(id).hunger > bagFoodFill(best).hunger) best = id
  return best
}
```

`src/game/logic/meadowShop.ts`:

```ts
import type { ItemId } from '../data/meadowItems'
import { BUY_PRICE, VENDOR_TRADE, sellPrice, type VendorId } from '../data/meadowPrices'
import { addItems, removeItems, type ItemCounts } from './inventory'

export type TradeResult = { ok: true; coins: number; items: ItemCounts } | { ok: false; reason: 'vendor' | 'qty' | 'coins' }

/** 상인에게 qty 개를 판다. 그 상인이 사지 않는 물건이거나 개수가 모자라면 실패 */
export function sellToVendor(coins: number, items: ItemCounts, vendor: VendorId, id: ItemId, qty: number): TradeResult {
  if (!VENDOR_TRADE[vendor].buys(id)) return { ok: false, reason: 'vendor' }
  const next = removeItems(items, id, qty)
  if (!next) return { ok: false, reason: 'qty' }
  return { ok: true, coins: coins + sellPrice(id) * qty, items: next }
}

/** 상인에게서 qty 개를 산다. 그 상인이 팔지 않거나 코인이 모자라면 실패 */
export function buyFromVendor(coins: number, items: ItemCounts, vendor: VendorId, id: ItemId, qty: number): TradeResult {
  const price = BUY_PRICE[id]
  if (!VENDOR_TRADE[vendor].sells.includes(id) || price === undefined) return { ok: false, reason: 'vendor' }
  if (!Number.isInteger(qty) || qty < 1) return { ok: false, reason: 'qty' }
  if (coins < price * qty) return { ok: false, reason: 'coins' }
  return { ok: true, coins: coins - price * qty, items: addItems(items, id, qty) }
}
```

- [ ] **Step 6: 실행해 통과 확인**

Run: `npx vitest run src/game/data/meadowItems.test.ts src/game/logic/inventory.test.ts src/game/logic/meadowShop.test.ts && npx tsc -b && npm run lint 2>&1 | grep -c warning`
Expected: PASS (15 tests), tsc 출력 없음, 경고 `6`. 전체 `npx vitest run` 은 62 파일 / 623 개

- [ ] **Step 7: 커밋**

```bash
git add src/game/data/meadowItems.ts src/game/data/meadowItems.test.ts src/game/data/meadowPrices.ts src/game/logic/inventory.ts src/game/logic/inventory.test.ts src/game/logic/meadowShop.ts src/game/logic/meadowShop.test.ts src/meadow/vendor/items.d.ts
git commit -m "feat: 은지 아이템·가방 규칙·상인 가격" -m "은지 items.js 의 아이템 25종·배합법 13가지를 TS 데이터로 옮기고 은지 값과 같은지 테스트로 지킨다 (서버도 같이 쓸 수 있게).
가방은 종류별 개수로 두고, 태그 재료는 가장 많이 가진 것부터 쓰는 은지 규칙과 F 로 배고픔을 가장 많이 채우는 음식 고르기를 순수 함수로 둔다.
상인 값은 은지 원의 약 2배 코인으로 meadowPrices.ts 한 곳에 모은다."
```

---
### Task 2: 은지 요리 먹기와 저장 v4 (가방)

**Files:**
- Modify: `src/game/logic/inventory.ts` (꺼내 먹기 `eatBagFood`)
- Modify: `src/game/data/types.ts` (`FoodId` 에 은지 요리)
- Modify: `src/game/logic/netProtocol.ts` (`FOOD_IDS`, 모르는 음식 너그럽게)
- Create: `src/game/scene/emojiTexture.ts`; Modify: `src/game/scene/FoodInHand.tsx`
- Modify: `src/game/stores/progressStore.ts` (v4 `items`, `addItem`·`eatFromBag`·`eatBest`·`startRecipe`)
- Test: `src/game/logic/inventory.test.ts`, `src/game/logic/netProtocol.test.ts`, `src/game/stores/progressStore.test.ts`

**Interfaces:**
- Consumes: Task 1 의 `ItemCounts`·`NO_ITEMS`·`addItems`·`bestFood`·`consumeRecipe`·`bagFoodFill`·`BagFood`·`ITEM_IDS`·`MEADOW_DISH_IDS`·`getRecipe`·`ITEMS`, `eatFood(s, heal, hunger)` (`logic/survival.ts`, 3-1)
- Produces:
  - `type BagMeal = { items: ItemCounts; snacks: SnackCounts; survival: Survival }`, `eatBagFood(bag, id): BagMeal | null` (`logic/inventory.ts`)
  - `type FoodId = DishId | SnackId | MeadowDishId` (`data/types.ts`)
  - `emojiTexture(icon: string): CanvasTexture` (`scene/emojiTexture.ts`)
  - progressStore: `items: ItemCounts` 필드, `addItem(id: ItemId, n?: number): void`, `eatFromBag(id: BagFood): boolean`, `eatBest(): BagFood | null`, `startRecipe(id: MeadowDishId): boolean`, persist version 4

- [ ] **Step 1: 실패하는 테스트 쓰기**

`src/game/logic/inventory.test.ts` — import 줄 `import { NO_ITEMS, addItems, … } from './inventory'` 를 아래 두 줄로 바꾸고:

```ts
import { FRESH_SURVIVAL } from './stamina'
import { NO_ITEMS, addItems, bagFoodFill, bestFood, canCook, consumeRecipe, dishFill, eatBagFood, ingredientHave, removeItems, tagCount } from './inventory'
```

마지막 `})` 바로 앞(`it('F: …')` 다음)에 넣는다:

```ts
  it('꺼내 먹으면 하나 줄고 배고픔이 찬다 (없으면 null)', () => {
    const hungry = { ...FRESH_SURVIVAL, stamina: 30, hunger: 20 }
    const meal = eatBagFood({ items: { ...NO_ITEMS, omelet: 1 }, snacks: NO_SNACKS, survival: hungry }, 'omelet')!
    expect(meal.items.omelet).toBe(0)
    expect(meal.survival).toMatchObject({ stamina: 40, hunger: 60 })
    expect(eatBagFood(meal, 'omelet')).toBeNull()
    const snack = eatBagFood({ items: NO_ITEMS, snacks: { ...NO_SNACKS, gimbap: 2 }, survival: hungry }, 'gimbap')!
    expect(snack.snacks.gimbap).toBe(1)
    expect(snack.survival.hunger).toBe(50)
  })
```

`src/game/logic/netProtocol.test.ts` 맨 끝에 붙인다:

```ts
describe('은지 요리 먹기 (3-2)', () => {
  const eating = (eat: unknown) => ({ ...state(), act: { ...state().act, eat, eatAge: 1 } })
  it('은지 요리를 먹는 모습을 읽는다', () => {
    expect(parseClientMsg(json({ type: 'state', s: eating('steak') }))).toEqual({ type: 'state', s: eating('steak') })
  })
  it('모르는 음식은 안 먹는 중으로 읽고 모습은 살린다. 글자가 아니면 버린다', () => {
    expect(parseClientMsg(json({ type: 'state', s: eating('pizza') }))).toEqual({ type: 'state', s: eating(null) })
    expect(parseClientMsg(json({ type: 'state', s: eating(3) }))).toBeNull()
  })
})
```

`src/game/stores/progressStore.test.ts` — `import { FIRST_MORNING } from '../logic/dayClock'` 아래에:

```ts
import { NO_ITEMS } from '../logic/inventory'
import { NO_SNACKS } from '../logic/snacks'
```

맨 끝 `describe('progressStore')` 를 닫는 `})` 바로 앞에 넣는다:

```ts
  it('가방(items)이 없는 예전 저장본(version 3)은 빈 가방, 모르는 물건·깨진 개수는 버린다', async () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ state: { coins: 4 }, version: 3 }))
    await useProgressStore.persist.rehydrate()
    expect(store().items).toEqual(NO_ITEMS)
    localStorage.setItem(SAVE_KEY, JSON.stringify({ state: { items: { egg: 3, steak: 1.5, pizza: 9, beef: -1 } }, version: 4 }))
    await useProgressStore.persist.rehydrate()
    expect(store().items).toEqual({ ...NO_ITEMS, egg: 3 })
  })

  it('가스레인지 요리: 재료를 빼고 시작, 모자라면 아무것도 빼지 않는다', () => {
    store().addItem('egg', 1)
    expect(store().startRecipe('omelet')).toBe(false)
    expect(store().items.egg).toBe(1)
    expect(store().startRecipe('friedegg')).toBe(true)
    expect(store().items.egg).toBe(0)
  })

  it('F: 배고픔을 가장 많이 채우는 요리·간식을 먹는다. 없으면 null', () => {
    useProgressStore.setState({ survival: { stamina: 50, hunger: 10, graceLeft: null, buffs: [] }, items: { ...NO_ITEMS, roast: 1, steak: 1 }, snacks: { ...NO_SNACKS, energy: 1 } })
    expect(store().eatBest()).toBe('steak')
    expect(store().survival).toMatchObject({ stamina: 60, hunger: 50 })
    expect(store().items.steak).toBe(0)
    expect(store().eatBest()).toBe('roast')
    expect(store().eatBest()).toBe('energy')
    expect(store().snacks.energy).toBe(0)
    expect(store().eatBest()).toBeNull()
  })

  it('가방에서 골라 먹기: 은지 요리·간식, 없으면 false', () => {
    useProgressStore.setState({ survival: { stamina: 50, hunger: 10, graceLeft: 30, buffs: [] }, items: { ...NO_ITEMS, bonebroth: 1 } })
    expect(store().eatFromBag('bonebroth')).toBe(true)
    // 먹으면 약화도 풀린다
    expect(store().survival).toMatchObject({ stamina: 56, hunger: 34, graceLeft: null })
    expect(store().eatFromBag('bonebroth')).toBe(false)
    expect(store().eatFromBag('gimbap')).toBe(false)
  })
```

- [ ] **Step 2: 실행해 실패 확인**

Run: `npx vitest run src/game/logic/inventory.test.ts src/game/logic/netProtocol.test.ts src/game/stores/progressStore.test.ts`
Expected: FAIL — `eatBagFood is not a function`, `store().startRecipe is not a function`, 은지 요리 `eat: 'steak'` 를 읽지 못해 `null`

- [ ] **Step 3: 꺼내 먹기** — `src/game/logic/inventory.ts`

`import type { SnackCounts } from './snacks'` 아래에:

```ts
import type { Survival } from './stamina'
import { eatFood } from './survival'
```

파일 맨 끝에:

```ts
export type BagMeal = { items: ItemCounts; snacks: SnackCounts; survival: Survival }

/** 가방에서 하나 꺼내 먹는다 (체력·배고픔이 찬다). 없으면 null */
export function eatBagFood(bag: BagMeal, id: BagFood): BagMeal | null {
  const isSnack = SNACKS.some((s) => s.id === id)
  if (isSnack ? bag.snacks[id as SnackId] <= 0 : bag.items[id as MeadowDishId] <= 0) return null
  const { heal, hunger } = bagFoodFill(id)
  const survival = eatFood(bag.survival, heal, hunger)
  return isSnack
    ? { ...bag, snacks: { ...bag.snacks, [id]: bag.snacks[id as SnackId] - 1 }, survival }
    : { ...bag, items: { ...bag.items, [id]: bag.items[id as MeadowDishId] - 1 }, survival }
}
```

- [ ] **Step 4: 먹을 수 있는 것** — `src/game/data/types.ts`

맨 위 `import type { SnackId } from './snacks'` 앞에 `import type { MeadowDishId } from './meadowItems'` 를 넣고, `FoodId` 와 그 주석을 바꾼다:

```ts
/** 먹을 수 있는 것: 물고기 요리, 간식, 은지 요리. 먹는 동작에서 손에 든 음식을 고른다 */
export type FoodId = DishId | SnackId | MeadowDishId
```

- [ ] **Step 5: 같이 하기 메시지** — `src/game/logic/netProtocol.ts`

import 에 `import { MEADOW_DISH_IDS } from '../data/meadowItems'` (`import { EMOTES, … }` 다음 줄)를 더하고, `FOOD_IDS` 에 은지 요리를 붙인다:

```ts
const FOOD_IDS: FoodId[] = [...DISHES.map((d) => d.id), ...SNACK_IDS, ...MEADOW_DISH_IDS]
```

`readAct` 를 아래로 바꾼다 (바뀐 곳: `const eat` 위 주석, 마지막에서 둘째 검사 — 예전 `if ((v.emote !== null && emote === null) || (v.eat !== null && eat === null)) return null` 을 둘로 나눠, 모르는 음식 글자는 `oneOf` 가 `null` 로 돌려줘 "안 먹는 중" 이 되고 글자가 아닌 값만 버린다):

```ts
function readAct(v: unknown): NetAct | null {
  if (!isRecord(v)) return null
  const cap = NET.actAgeCap
  const emote = v.emote === null ? null : oneOf(v.emote, EMOTE_IDS)
  // 모르는 음식(더 새 클라이언트의 요리)은 "안 먹는 중" 으로 읽는다 (모습 전체를 버리지 않는다)
  const eat = v.eat === null ? null : oneOf(v.eat, FOOD_IDS)
  const emoteAge = num(v.emoteAge, 0, cap)
  const airAge = v.airAge === null ? null : num(v.airAge, 0, cap)
  const landedAge = num(v.landedAge, 0, cap)
  const eatAge = num(v.eatAge, 0, cap)
  if (v.emote !== null && emote === null) return null
  if (v.eat !== null && typeof v.eat !== 'string') return null
  if (emoteAge === null || landedAge === null || eatAge === null || (v.airAge !== null && airAge === null)) return null
  return { emote, emoteAge, airAge, landedAge, eat, eatAge }
}
```

- [ ] **Step 6: 손에 든 은지 요리** — 이모지 판

`src/game/scene/emojiTexture.ts`:

```ts
import { CanvasTexture, SRGBColorSpace } from 'three'

/** 이모지별 텍스처. 같은 이모지는 한 번만 그린다 (먹는 요리가 바뀌어도 다시 만들지 않는다) */
const cache = new Map<string, CanvasTexture>()

/** 이모지 한 글자를 그린 투명 텍스처 (은지 요리를 손에 들 때 판(스프라이트)에 붙인다) */
export function emojiTexture(icon: string): CanvasTexture {
  let texture = cache.get(icon)
  if (!texture) {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 128
    const g = canvas.getContext('2d')
    if (g) {
      g.font = '100px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(icon, 64, 72)
    }
    texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    cache.set(icon, texture)
  }
  return texture
}
```

`src/game/scene/FoodInHand.tsx` — import 에 `import { ITEMS } from '../data/meadowItems'` 와 `import { emojiTexture } from './emojiTexture'` 를 더하고, 컴포넌트 주석을 `/** 먹을 때 손에 드는 음식 (손 크기에 맞춘 작은 모형, 은지 요리는 이모지 판). 원점이 주먹 가운데 */` 로 바꾼다. `switch` 의 마지막 `case 'bowl': case 'stew':` 의 `return (…)` 다음, `switch` 를 닫는 `}` 앞에:

```tsx
    default:
      // 은지 요리: 이모지를 그린 판 (늘 카메라를 본다)
      return (
        <sprite position={[0, 0.09, 0.03]} scale={0.16}>
          <spriteMaterial map={emojiTexture(ITEMS[dish].icon)} transparent depthWrite={false} />
        </sprite>
      )
```

- [ ] **Step 7: 저장 v4** — `src/game/stores/progressStore.ts`

import 에 더한다 (`findSpecies` 줄 다음, `cooking` 줄 다음):

```ts
import { ITEM_IDS, getRecipe, type ItemId, type MeadowDishId } from '../data/meadowItems'
import { NO_ITEMS, addItems, bestFood, consumeRecipe, eatBagFood, type BagFood, type ItemCounts } from '../logic/inventory'
```

`ProgressData` 의 `clock: Clock` 아래에:

```ts
  /** 가방 속 은지 물건(재료·요리) 개수 */
  items: ItemCounts
```

`ProgressActions` 의 `eatSnack` 아래에:

```ts
  /** 은지 물건을 가방에 넣는다 (줍기·요리 완성·사기) */
  addItem: (id: ItemId, n?: number) => void
  /** 가방의 은지 요리나 간식을 하나 꺼내 먹는다. 없으면 false */
  eatFromBag: (id: BagFood) => boolean
  /** F: 배고픔을 가장 많이 채우는 것을 먹는다. 먹은 것, 먹을 게 없으면 null */
  eatBest: () => BagFood | null
  /** 가스레인지 요리 시작: 재료를 뺀다 (완성되면 addItem). 재료가 모자라면 false */
  startRecipe: (id: MeadowDishId) => boolean
```

`INITIAL_PROGRESS` 의 `clock: FIRST_MORNING,` 아래에 `items: NO_ITEMS,`. `readSnacks` 함수 다음에:

```ts
function readItems(v: unknown, fallback: ItemCounts): ItemCounts {
  if (!isRecord(v)) return fallback
  const counts = { ...fallback }
  for (const id of ITEM_IDS) counts[id] = readCount(v[id], fallback[id])
  return counts
}
```

액션: `unlockZone: (id) => {` 바로 앞에:

```ts
      addItem: (id, n = 1) => set((s) => ({ items: addItems(s.items, id, n) })),

      eatFromBag: (id) => {
        const s = get()
        const meal = eatBagFood({ items: s.items, snacks: s.snacks, survival: s.survival }, id)
        if (meal) set(meal)
        return meal !== null
      },

      eatBest: () => {
        const s = get()
        const id = bestFood(s.items, s.snacks)
        return id && get().eatFromBag(id) ? id : null
      },

      startRecipe: (id) => {
        const items = consumeRecipe(get().items, getRecipe(id))
        if (items) set({ items })
        return items !== null
      },
```

persist 설정의 버전과 주석:

```ts
      // 2: 장비·어항이 5단계 → 10단계. 3: 배고픔(survival.hunger)·혼자 시계(clock) 추가. 4: 은지 가방(items) 추가 (3·4 는 필드만 늘어 옮길 것 없다)
      version: 4,
```

`merge` 의 `clock: readClock(saved.clock) ?? current.clock,` 아래에 `items: readItems(saved.items, current.items),`.

- [ ] **Step 8: 실행해 통과 확인**

Run: `npx vitest run src/game/logic/inventory.test.ts src/game/logic/netProtocol.test.ts src/game/stores/progressStore.test.ts && npx tsc -b && npm run lint 2>&1 | grep -c warning`
Expected: PASS, tsc 출력 없음, 경고 `6`. 전체 62 파일 / 630 개

- [ ] **Step 9: 커밋**

```bash
git add src/game/logic/inventory.ts src/game/logic/inventory.test.ts src/game/data/types.ts src/game/logic/netProtocol.ts src/game/logic/netProtocol.test.ts src/game/scene/emojiTexture.ts src/game/scene/FoodInHand.tsx src/game/stores/progressStore.ts src/game/stores/progressStore.test.ts
git commit -m "feat: 은지 요리 먹기와 가방 저장" -m "저장 v4 에 은지 가방(items)을 더하고, 가방에서 꺼내 먹기·F 로 배고픔을 가장 많이 채우는 것 먹기·가스레인지 요리 재료 빼기를 진행 저장소에 둔다.
은지 요리를 먹는 모습은 같이 하기에도 보내고(FOOD_IDS), 손에는 요리 이모지를 그린 판을 든다.
모르는 음식을 먹는 모습은 모습 전체를 버리지 않고 안 먹는 중으로 읽는다."
```

---
### Task 3: 감정 표현 T 바퀴와 Tab 큰 지도

**Files:**
- Create: `src/game/logic/emoteWheel.ts`, `src/game/ui/EmoteWheel.tsx`
- Modify: `src/game/logic/interaction.ts` (모드 `emote`, 키 동작 `toggleMap`)
- Modify: `src/game/logic/mouseLook.ts` (`canLockPointer('emote')`)
- Modify: `src/game/input/useInteractionKeys.ts` (`runKeyAction` 이 했는지 돌려준다, Tab 지도)
- Modify: `src/game/input/usePlayerActionKeys.ts`, `src/game/data/emotes.ts` (숫자 키 감정 표현 없애기)
- Modify: `src/game/Game.tsx` (`<EmoteWheel />`), `src/game/ui/Hud.tsx` (키 안내)
- Test: `src/game/logic/emoteWheel.test.ts`, `src/game/logic/interaction.test.ts`, `src/game/logic/mouseLook.test.ts`

**Interfaces:**
- Consumes: `EMOTES` (id·key·label·icon), `pressEmote(id)` (`input/usePlayerActionKeys.ts`), `openMap`·`closeMap` (sessionStore)
- Produces:
  - `WHEEL_DEAD`, `WHEEL_REACH`, `wheelPick(dx, dy, count, dead?): number | null`, `addAim(aim, mx, my)`, `wheelSlot(i, count, r)` (`logic/emoteWheel.ts`)
  - `Mode` 에 `'emote'`, `KeyAction` 에 `{ type: 'toggleMap' }` (`logic/interaction.ts`)
  - `runKeyAction(code: string): boolean` — 무언가 했으면 true (TouchControls 는 돌려준 값을 쓰지 않는다)
  - `<EmoteWheel />` (`ui/EmoteWheel.tsx`)

- [ ] **Step 1: 실패하는 테스트 쓰기**

`src/game/logic/emoteWheel.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { WHEEL_REACH, addAim, wheelPick, wheelSlot } from './emoteWheel'

describe('감정 표현 바퀴', () => {
  it('위가 0번, 시계 방향으로 칸이 이어진다 (5칸)', () => {
    expect(wheelPick(0, -100, 5)).toBe(0)
    expect(wheelPick(100, -30, 5)).toBe(1)
    expect(wheelPick(60, 100, 5)).toBe(2)
    expect(wheelPick(-60, 100, 5)).toBe(3)
    expect(wheelPick(-100, -30, 5)).toBe(4)
  })
  it('가운데 근처는 아무것도 고르지 않는다', () => {
    expect(wheelPick(5, 5, 5)).toBeNull()
    expect(wheelPick(0, 0, 5)).toBeNull()
  })
  it('칸 자리와 고르기가 맞는다', () => {
    for (let i = 0; i < 5; i++) {
      const p = wheelSlot(i, 5, 100)
      expect(wheelPick(p.x, p.y, 5)).toBe(i)
    }
  })
  it('마우스 잠금 중 움직임은 모으되 길이는 WHEEL_REACH 까지', () => {
    expect(addAim({ x: 0, y: 0 }, 10, -5)).toEqual({ x: 10, y: -5 })
    const far = addAim({ x: 100, y: 0 }, 500, 0)
    expect(far.x).toBeCloseTo(WHEEL_REACH)
    expect(far.y).toBe(0)
  })
})
```

`src/game/logic/interaction.test.ts` — 탐험 중 숫자 키는 이제 감정 표현이 아니라 도구 칸이다(Task 4). 기존 테스트 이름 `'낚시 중 1~3은 미끼, 0은 미끼 없이. 탐험·패널에선 숫자 키를 받지 않는다(감정 표현)'` 을 `'낚시 중 1~3은 미끼, 0은 미끼 없이. 패널에선 숫자 키를 받지 않는다'` 로 바꾸고, 그 안의 `expect(resolveKeyAction('Digit1', 'explore', null)).toEqual({ type: 'none' })` 줄을 지운다. `describe('resolveKeyAction')` 를 닫는 `})` 앞에 넣는다:

```ts
  it('Tab: 탐험·배·메뉴·지도에서 큰 지도를 열고 닫는다. 낚시·패널·바퀴에선 무시', () => {
    for (const mode of ['explore', 'boat', 'menu', 'map'] as const) expect(resolveKeyAction('Tab', mode, null)).toEqual({ type: 'toggleMap' })
    for (const mode of ['fishing', 'shop', 'sleep', 'emote', 'lobby', 'cutscene'] as const) expect(resolveKeyAction('Tab', mode, null)).toEqual({ type: 'none' })
  })
  it('감정 표현 바퀴(emote) 중엔 E·숫자는 무시하고 ESC 는 닫기', () => {
    expect(resolveKeyAction('KeyE', 'emote', { kind: 'sellBox' })).toEqual({ type: 'none' })
    expect(resolveKeyAction('Digit1', 'emote', null)).toEqual({ type: 'none' })
    expect(resolveKeyAction('Escape', 'emote', null)).toEqual({ type: 'closePanel' })
  })
```

`src/game/logic/mouseLook.test.ts` — `'탐험 중에만 잠글 수 있다'` 의 `expect(canLockPointer('rest')).toBe(true)` 다음 줄에 `expect(canLockPointer('emote')).toBe(true)`, `'탐험 중 ESC 로 잠금이 풀리면 …'` 의 `shouldOpenMenuOnUnlock('shop', false)` 줄 다음에 `expect(shouldOpenMenuOnUnlock('emote', false)).toBe(false)`.

- [ ] **Step 2: 실행해 실패 확인**

Run: `npx vitest run src/game/logic/emoteWheel.test.ts src/game/logic/interaction.test.ts src/game/logic/mouseLook.test.ts`
Expected: FAIL — `./emoteWheel` 이 없고, `resolveKeyAction('Tab', …)` 이 `{ type: 'none' }`, `canLockPointer('emote')` 가 false (타입 오류는 vitest 가 보지 않는다)

- [ ] **Step 3: 바퀴 고르기 계산** — `src/game/logic/emoteWheel.ts`

```ts
/** 감정 표현 바퀴: 가운데에서 이만큼(px) 안쪽이면 아무것도 고르지 않는다 */
export const WHEEL_DEAD = 24
/** 마우스 잠금 중 움직인 만큼 모으는 최대 길이(px). 이 이상 밀어도 방향만 바뀐다 */
export const WHEEL_REACH = 120

/**
 * 화면 방향(dx 오른쪽 +, dy 아래 +) → 바퀴 칸 번호. 0번이 맨 위, 시계 방향으로 count 칸. 가운데 근처면 null
 */
export function wheelPick(dx: number, dy: number, count: number, dead = WHEEL_DEAD): number | null {
  if (count < 1 || Math.hypot(dx, dy) < dead) return null
  const angle = Math.atan2(dx, -dy)
  const step = (Math.PI * 2) / count
  return ((Math.round(angle / step) % count) + count) % count
}

/** 마우스 잠금 중 움직임(movementX/Y)을 모은다. 길이는 WHEEL_REACH 까지 */
export function addAim(aim: { x: number; y: number }, mx: number, my: number): { x: number; y: number } {
  const x = aim.x + mx
  const y = aim.y + my
  const len = Math.hypot(x, y)
  return len > WHEEL_REACH ? { x: (x / len) * WHEEL_REACH, y: (y / len) * WHEEL_REACH } : { x, y }
}

/** 바퀴 위 칸 i 의 자리 (가운데 기준 px, 반지름 r) */
export function wheelSlot(i: number, count: number, r: number): { x: number; y: number } {
  const a = (i / count) * Math.PI * 2
  return { x: Math.sin(a) * r, y: -Math.cos(a) * r }
}
```

- [ ] **Step 4: 모드와 키** — `src/game/logic/interaction.ts`

`Mode` 주석의 ` * map = 큰 지도 …` 줄을 아래 두 줄로 바꾸고, union 의 `| 'sleep'` 다음에 `| 'emote'` 를 더한다:

```ts
 * map = 큰 지도 (이동·E 막힘, ESC·Tab 으로 닫는다), sleep = 잠·죽음으로 화면이 어두워지는 중이거나 같이 하기에서 침대에 누워 아침을 기다리는 중 (이동 막힘),
 * emote = T 를 누르고 있는 동안 감정 표현 바퀴 (이동·E 막힘, 떼면 고른 것을 한다. ui/EmoteWheel)
```

`KeyAction` 의 `| { type: 'wake' }` 다음에:

```ts
  /** Tab: 큰 지도 열기/닫기 */
  | { type: 'toggleMap' }
```

`resolveKeyAction` 첫 줄(연출·로비·배 검사보다 먼저)에 — 배 타는 중에도 지도를 열 수 있어야 해서 맨 앞이다:

```ts
  // Tab: 큰 지도 (배 타는 중에도 열고, 메뉴에서도 연다 — 메뉴의 지도 버튼과 같다)
  if (code === 'Tab') return mode === 'explore' || mode === 'boat' || mode === 'menu' || mode === 'map' ? { type: 'toggleMap' } : { type: 'none' }
```

그리고 `// 낚시 중 숫자 키는 미끼 고르기 (탐험 중 숫자 키는 감정 표현이라 여기서 받지 않는다)` 주석을 `// 낚시 중 숫자 키는 미끼 고르기` 로 줄인다.

- [ ] **Step 5: 바퀴 중에도 마우스 잠금 유지** — `src/game/logic/mouseLook.ts` 의 `canLockPointer` 를 아래로:

```ts
/**
 * 마우스를 잠가 둘 수 있는 화면 (돌아다닐 때·벤치에서 쉴 때·배·감정 표현 바퀴). 낚시·패널·꾸미기 등 그 밖의 화면은 커서가 필요해서 풀어 준다.
 * 바퀴는 잠긴 채 마우스 움직임으로 고른다 (풀면 바퀴를 닫을 때마다 다시 눌러 잠가야 한다)
 */
export function canLockPointer(mode: Mode): boolean {
  return mode === 'explore' || mode === 'rest' || mode === 'boat' || mode === 'emote'
}
```

- [ ] **Step 6: 키 잇기**

`src/game/input/useInteractionKeys.ts` — `onKeyDown` 의 마지막 `runKeyAction(e.code)` 를:

```ts
      // Tab 으로 지도를 열고 닫을 땐 포커스가 다른 버튼으로 넘어가지 않게 막는다
      if (runKeyAction(e.code) && e.code === 'Tab') e.preventDefault()
```

`runKeyAction` 주석 끝에 ` 무언가 했으면 true` 를 붙이고 선언을 `export function runKeyAction(code: string): boolean {` 로 바꾼다. `switch` 의 `case 'wake':` 다음, 끝을 아래로 (`'none'` 은 false, 그 밖은 switch 뒤 `return true`):

```ts
    case 'toggleMap':
      if (session.mode === 'map') session.closeMap()
      else session.openMap()
      break
    case 'none':
      return false
  }
  return true
}
```

`src/game/input/usePlayerActionKeys.ts` — import 를 `import { ACTION_KEYS, type EmoteId } from '../data/emotes'` 로, `pressEmote` 주석을 `/** 감정 표현 (터치 감정 표현 메뉴·T 바퀴) */` 로 바꾸고, `usePlayerActionKeys` 를 아래로 바꾼다 (숫자 키 감정 표현을 뺀다):

```ts
/** Space → 점프. 꾹 누르고 있을 때 반복 입력과 글자 입력 칸에서 누른 키는 무시한다 (감정 표현은 T 바퀴, 숫자 키는 도구 칸) */
export function usePlayerActionKeys() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.defaultPrevented || isTypingTarget(e.target)) return
      if (e.code === ACTION_KEYS.jump) {
        // 탐험 중엔 포커스가 남은 버튼이 Space 로 눌리거나 페이지가 스크롤되지 않게 막는다 (패널에선 그대로 둔다)
        if (useSessionStore.getState().mode === 'explore') e.preventDefault()
        jumpPressed = true
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
```

`src/game/data/emotes.ts` — `EMOTES` 위 주석을:

```ts
/**
 * 감정 표현 (탐험 중 T 를 누르고 있으면 바퀴, 폰은 😀 메뉴). loop: 이동 키를 누를 때까지 계속, 아니면 클립 한 번 뒤 저절로 끝난다.
 * icon: 바퀴·터치 메뉴에 보이는 그림. key: 바퀴가 열린 동안 숫자 키로 바로 고르기 (바퀴 칸 순서와 같다)
 */
```

- [ ] **Step 7: 바퀴 화면** — `src/game/ui/EmoteWheel.tsx`

```tsx
import { useEffect, useRef, useState } from 'react'
import { EMOTES } from '../data/emotes'
import { pressEmote } from '../input/usePlayerActionKeys'
import { isTypingTarget } from '../input/typing'
import { addAim, wheelPick, wheelSlot } from '../logic/emoteWheel'
import { useSessionStore } from '../stores/sessionStore'

/** 바퀴 반지름(px) */
const RADIUS = 110

/** 바퀴를 닫고, 고른 게 있으면 그 감정 표현을 한다 (다음 프레임에 Player 가 가져간다) */
function close(pick: number | null) {
  const session = useSessionStore.getState()
  if (session.mode !== 'emote') return
  session.setMode('explore')
  if (pick !== null) pressEmote(EMOTES[pick].id)
}

/**
 * T 를 누르고 있는 동안 화면 가운데 감정 표현 5개 바퀴 (mode 'emote').
 * 마우스 방향(잠금 중엔 움직인 만큼, 아니면 화면 가운데에서 커서까지)이나 숫자 1~5 로 고르고, T 를 떼면 한다.
 * 창 밖으로 포커스가 나가면(떼는 걸 못 받으니) 아무것도 하지 않고 닫는다. 폰은 지금 😀 메뉴 그대로
 */
export function EmoteWheel() {
  const mode = useSessionStore((s) => s.mode)
  const [pick, setPick] = useState<number | null>(null)
  const aim = useRef({ x: 0, y: 0 })
  const picked = useRef<number | null>(null)

  useEffect(() => {
    const choose = (i: number | null) => {
      picked.current = i
      setPick(i)
    }
    const onDown = (e: KeyboardEvent) => {
      if (e.repeat || isTypingTarget(e.target)) return
      const current = useSessionStore.getState().mode
      if (e.code === 'KeyT' && current === 'explore') {
        aim.current = { x: 0, y: 0 }
        choose(null)
        useSessionStore.getState().setMode('emote')
        return
      }
      if (current !== 'emote') return
      const i = EMOTES.findIndex((em) => em.key === e.code)
      if (i >= 0) close(i)
    }
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyT') close(picked.current)
    }
    const onMove = (e: PointerEvent) => {
      if (useSessionStore.getState().mode !== 'emote') return
      aim.current = document.pointerLockElement ? addAim(aim.current, e.movementX, e.movementY) : { x: e.clientX - window.innerWidth / 2, y: e.clientY - window.innerHeight / 2 }
      const i = wheelPick(aim.current.x, aim.current.y, EMOTES.length)
      if (i !== picked.current) choose(i)
    }
    const onBlur = () => close(null)
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  if (mode !== 'emote') return null
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 1001, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-label="감정 표현 바퀴">
      <div style={{ position: 'relative', width: 0, height: 0 }}>
        <div style={{ position: 'absolute', left: -RADIUS - 46, top: -RADIUS - 46, width: (RADIUS + 46) * 2, height: (RADIUS + 46) * 2, borderRadius: '50%', background: 'rgba(15, 20, 30, 0.45)' }} />
        <div style={{ position: 'absolute', transform: 'translate(-50%, -50%)', color: '#fff', fontSize: 13, whiteSpace: 'nowrap', textShadow: '0 1px 2px #000' }}>{pick === null ? 'T 를 떼면 닫기' : EMOTES[pick].label}</div>
        {EMOTES.map((em, i) => {
          const p = wheelSlot(i, EMOTES.length, RADIUS)
          const on = i === pick
          return (
            <div
              key={em.id}
              style={{ position: 'absolute', left: p.x, top: p.y, transform: `translate(-50%, -50%) scale(${on ? 1.2 : 1})`, width: 70, height: 70, borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: on ? 'rgba(255, 209, 102, 0.95)' : 'rgba(255, 255, 255, 0.85)', color: '#222', boxShadow: '0 3px 10px rgba(0,0,0,0.35)', transition: 'transform 0.08s' }}
            >
              <span style={{ fontSize: 26, lineHeight: 1 }}>{em.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 700 }}>
                {em.key.replace('Digit', '')} {em.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

`src/game/Game.tsx` — `import { ChatBox } from './ui/ChatBox'` 다음에 `import { EmoteWheel } from './ui/EmoteWheel'`, JSX 의 `<TouchControls />` 다음 줄에 `<EmoteWheel />`.

`src/game/ui/Hud.tsx` — 아래 키 안내 글의 `· 1~5 감정 표현 ·` 을 `· T 꾹 감정 표현 · Tab 지도 ·` 로 바꾼다.

- [ ] **Step 8: 실행해 통과 확인**

Run: `npx vitest run src/game/logic/emoteWheel.test.ts src/game/logic/interaction.test.ts src/game/logic/mouseLook.test.ts && npx tsc -b && npm run lint 2>&1 | grep -c warning`
Expected: PASS, tsc 출력 없음, 경고 `6`. 전체 63 파일 / 636 개

- [ ] **Step 9: 커밋**

```bash
git add src/game/logic/emoteWheel.ts src/game/logic/emoteWheel.test.ts src/game/ui/EmoteWheel.tsx src/game/logic/interaction.ts src/game/logic/interaction.test.ts src/game/logic/mouseLook.ts src/game/logic/mouseLook.test.ts src/game/input/useInteractionKeys.ts src/game/input/usePlayerActionKeys.ts src/game/data/emotes.ts src/game/Game.tsx src/game/ui/Hud.tsx
git commit -m "feat: 감정 표현 T 바퀴와 Tab 지도" -m "숫자 키 1~5 에 있던 감정 표현을 T 를 누르고 있는 동안 뜨는 바퀴로 옮긴다 (마우스 방향이나 숫자로 고르고 떼면 한다, emote 모드).
바퀴 중에도 마우스 잠금을 풀지 않고 움직임을 모아 고르며, 포커스를 잃으면 아무것도 하지 않고 닫는다.
Tab 은 탐험·배·메뉴에서 큰 지도를 열고 닫는다. 숫자 키는 다음 커밋에서 도구 칸이 된다."
```

---
### Task 4: 도구 칸 (1 낚싯대 · 2 주먹 · 3 칼)

**Files:**
- Create: `src/game/data/tools.ts`, `src/game/scene/tools/KnifeModel.tsx`, `src/game/ui/Hotbar.tsx`
- Modify: `src/game/logic/interaction.ts` (숫자 키·X → `equip`), `src/game/stores/sessionStore.ts` (`tool`·`equip`), `src/game/input/useInteractionKeys.ts` (`equip`, 물가 E 는 낚싯대로)
- Modify: `src/game/logic/playerMotion.ts` (`rodVisible` → `shownTool`), `src/game/scene/Player.tsx`, `src/game/scene/RemotePlayer.tsx`
- Modify: `src/game/logic/netProtocol.ts` (`NetState.tool`), `src/game/net/NetBridge.tsx`
- Modify: `src/game/Game.tsx` (`<Hotbar />`), `src/game/ui/styles.ts`·`src/game/ui/Hud.tsx` (아래쪽 안내 자리), `src/game/data/touch.ts`·`src/game/ui/TouchControls.tsx` (폰 도구 칸 자리)
- Test: `src/game/logic/interaction.test.ts`, `src/game/stores/sessionStore.test.ts`, `src/game/logic/playerMotion.test.ts`, `src/game/logic/netProtocol.test.ts`

**Interfaces:**
- Consumes: Task 3 의 `runKeyAction`, `getBait` (`data/bait.ts`), `useMediaQuery`·`useTouchUi` (`input/touchDevice.ts`)
- Produces:
  - `type ToolId = 'rod' | 'fists' | 'knife'`, `TOOLS: { id; name; icon }[]`, `TOOL_IDS`, `HOTBAR: (ToolId | null)[]` (9칸), `hotbarSlot(code): number | null` (`data/tools.ts`)
  - `KeyAction` 에 `{ type: 'equip'; tool: ToolId | null }`
  - sessionStore: `tool: ToolId | null` (처음·`resetSession` 뒤 `'rod'`), `equip(tool)`
  - `shownTool(mode, zoom, action, tool): ToolId | null` (`logic/playerMotion.ts`, `rodVisible` 은 없어진다)
  - `NetState.tool?: ToolId`
  - `TOUCH.hotbarBottom = { landscape: 12, portrait: 174 }`, `<Hotbar />`, `<KnifeModel />`

- [ ] **Step 1: 실패하는 테스트 쓰기**

`src/game/logic/interaction.test.ts` — `describe('resolveKeyAction')` 를 닫는 `})` 앞에:

```ts
  it('탐험 중 숫자 키는 도구 칸 (1 낚싯대 · 2 주먹 · 3 칼), 빈 칸은 무시. X 는 넣기', () => {
    expect(resolveKeyAction('Digit1', 'explore', null)).toEqual({ type: 'equip', tool: 'rod' })
    expect(resolveKeyAction('Digit2', 'explore', null)).toEqual({ type: 'equip', tool: 'fists' })
    expect(resolveKeyAction('Digit3', 'explore', null)).toEqual({ type: 'equip', tool: 'knife' })
    expect(resolveKeyAction('Digit4', 'explore', null)).toEqual({ type: 'none' })
    expect(resolveKeyAction('Digit0', 'explore', null)).toEqual({ type: 'none' })
    expect(resolveKeyAction('KeyX', 'explore', null)).toEqual({ type: 'equip', tool: null })
    // 낚시 중 숫자는 그대로 미끼, 패널에선 무시
    expect(resolveKeyAction('Digit2', 'fishing', null)).toEqual({ type: 'selectBait', bait: 'shrimp' })
    expect(resolveKeyAction('KeyX', 'fishing', null)).toEqual({ type: 'none' })
    expect(resolveKeyAction('Digit1', 'market', null)).toEqual({ type: 'none' })
  })
```

`src/game/stores/sessionStore.test.ts` 맨 끝에:

```ts
describe('도구 칸', () => {
  beforeEach(() => useSessionStore.getState().resetSession())

  it('처음엔 낚싯대, 바꾸고 넣을 수 있고, 판을 새로 시작하면 다시 낚싯대', () => {
    expect(useSessionStore.getState().tool).toBe('rod')
    useSessionStore.getState().equip('knife')
    expect(useSessionStore.getState().tool).toBe('knife')
    useSessionStore.getState().equip(null)
    expect(useSessionStore.getState().tool).toBeNull()
    useSessionStore.getState().resetSession()
    expect(useSessionStore.getState().tool).toBe('rod')
  })
})
```

`src/game/logic/playerMotion.test.ts` — import 의 `rodVisible` 을 `shownTool` 로 바꾸고(`nextAction, shouldFaceCamera, shownTool` 순서), `'먹는 동안엔 낚싯대를 숨긴다'` 안의 줄을 `expect(shownTool('explore', 10, { ...IDLE_ACTION, eat: 'bowl', eatAt: 10 }, 'rod')).toBeNull()` 로 바꾸고, 맨 끝 `describe('rodVisible', …)` 블록 전체를 아래로 바꾼다:

```ts
describe('shownTool', () => {
  it('배에 앉아 있으면 낚싯대를 숨긴다', () => {
    expect(shownTool('boat', 10, IDLE_ACTION, 'rod')).toBeNull()
  })
  it('낚시 중엔 늘 낚싯대 (다른 도구를 들고 있었어도)', () => {
    expect(shownTool('fishing', 1.5, IDLE_ACTION, 'rod')).toBe('rod')
    expect(shownTool('fishing', 10, { ...IDLE_ACTION, airborne: true }, 'knife')).toBe('rod')
  })

  it('서 있거나 걸을 땐 보이고, 감정 표현·점프·휴식·가까운 줌에선 숨긴다', () => {
    expect(shownTool('explore', 10, IDLE_ACTION, 'rod')).toBe('rod')
    expect(shownTool('explore', 10, { ...IDLE_ACTION, emote: 'spell' }, 'rod')).toBeNull()
    expect(shownTool('explore', 10, { ...IDLE_ACTION, airborne: true }, 'rod')).toBeNull()
    expect(shownTool('rest', 10, IDLE_ACTION, 'rod')).toBeNull()
    expect(shownTool('explore', CAMERA_ZOOM.hideRodBelow - 0.1, IDLE_ACTION, 'rod')).toBeNull()
  })

  it('칼은 가까운 줌에서도 보이고, 주먹·빈손은 그릴 게 없다', () => {
    expect(shownTool('explore', CAMERA_ZOOM.hideRodBelow - 0.1, IDLE_ACTION, 'knife')).toBe('knife')
    expect(shownTool('explore', 10, { ...IDLE_ACTION, emote: 'dance' }, 'knife')).toBeNull()
    expect(shownTool('explore', 10, IDLE_ACTION, 'fists')).toBeNull()
    expect(shownTool('explore', 10, IDLE_ACTION, null)).toBeNull()
  })
})
```

`src/game/logic/netProtocol.test.ts` 맨 끝에:

```ts
describe('손에 든 도구 (3-2)', () => {
  it('tool 은 있으면 검사하고, 틀리거나 모르는 도구면 그 필드만 버린다', () => {
    expect(parseClientMsg(json({ type: 'state', s: { ...state(), tool: 'knife' } }))).toEqual({ type: 'state', s: { ...state(), tool: 'knife' } })
    expect(parseClientMsg(json({ type: 'state', s: { ...state(), tool: 'bazooka' } }))).toEqual({ type: 'state', s: state() })
    expect(parseServerMsg(json({ type: 'state', id: 'a', s: { ...state(), tool: 'fists' } }))).toEqual({ type: 'state', id: 'a', s: { ...state(), tool: 'fists' } })
  })
  it('보낼 때 그대로 두고, 도구를 바꾸면 다른 상태', () => {
    expect(roundState({ ...state(), tool: 'knife' }).tool).toBe('knife')
    expect(roundState(state())).not.toHaveProperty('tool')
    expect(stateKey({ ...state(), tool: 'knife' })).not.toBe(stateKey({ ...state(), tool: 'fists' }))
  })
})
```

- [ ] **Step 2: 실행해 실패 확인**

Run: `npx vitest run src/game/logic/interaction.test.ts src/game/stores/sessionStore.test.ts src/game/logic/playerMotion.test.ts src/game/logic/netProtocol.test.ts`
Expected: FAIL — `shownTool is not a function`, `equip is not a function`, `Digit1` 이 `none`, `tool` 필드가 버려진다

- [ ] **Step 3: 도구 데이터** — `src/game/data/tools.ts`

```ts
/** 손에 드는 도구. 3-2 에서는 낚싯대·주먹·칼 (휘두르기는 3-3, 총 4~7 칸은 3-4) */
export type ToolId = 'rod' | 'fists' | 'knife'

export const TOOLS: { id: ToolId; name: string; icon: string }[] = [
  { id: 'rod', name: '낚싯대', icon: '🎣' },
  { id: 'fists', name: '주먹', icon: '✊' },
  { id: 'knife', name: '칼', icon: '🔪' },
]
export const TOOL_IDS: ToolId[] = TOOLS.map((t) => t.id)

/** 도구 칸 9개 (숫자 키 1~9). 1 = 낚싯대, 2 = 주먹, 3 = 칼, 4~7 = 총 (3-4 에서 채운다) */
export const HOTBAR: (ToolId | null)[] = ['rod', 'fists', 'knife', null, null, null, null, null, null]

/** 숫자 키(e.code) → 칸 번호 (0부터). 숫자 키가 아니면 null */
export function hotbarSlot(code: string): number | null {
  const m = /^Digit([1-9])$/.exec(code)
  return m ? Number(m[1]) - 1 : null
}
```

- [ ] **Step 4: 키·상태**

`src/game/logic/interaction.ts` — import 에 `import { HOTBAR, hotbarSlot, type ToolId } from '../data/tools'` (bait import 다음), `KeyAction` 끝(`toggleMap` 다음)에:

```ts
  /** 도구 칸 고르기 (1~9) 또는 손에 든 것 넣기 (X, tool null) */
  | { type: 'equip'; tool: ToolId | null }
```

`resolveKeyAction` 의 낚시 미끼 블록(`if (mode === 'fishing') { … }`) 바로 다음, `// 벤치에 앉아 있으면 E로도 일어난다` 앞에:

```ts
  // 탐험 중 숫자 키는 도구 칸 (빈 칸은 무시), X 는 손에 든 것 넣기
  if (mode === 'explore') {
    const slot = hotbarSlot(code)
    if (slot !== null) return HOTBAR[slot] ? { type: 'equip', tool: HOTBAR[slot] } : { type: 'none' }
    if (code === 'KeyX') return { type: 'equip', tool: null }
  }
```

`src/game/stores/sessionStore.ts` — import 에 `import type { ToolId } from '../data/tools'`, `SessionState` 의 `setPlayerAction` 앞에:

```ts
  /** 손에 든 도구 (도구 칸). null = 빈손. 저장하지 않는다 (다시 들어오면 낚싯대) */
  tool: ToolId | null
  equip: (tool: ToolId | null) => void
```

스토어 본문 `setPlayerAction: (playerAction) => …` 앞에:

```ts
  tool: 'rod',
  equip: (tool) => set({ tool }),
```

`resetSession` 이 넣는 객체 끝에 `tool: 'rod'` 를 더한다 (`… cooking: null, boat: null, tool: 'rod' })`).

`src/game/input/useInteractionKeys.ts` — `case 'startFishing':` 의 `useFishingStore.getState().begin(action.spot)` 앞에:

```ts
      // 다른 도구를 들고 있어도 물가에서 E 를 누르면 저절로 낚싯대로 바꿔 시작한다
      session.equip('rod')
```

`case 'toggleMap':` 앞에:

```ts
    case 'equip':
      session.equip(action.tool)
      break
```

- [ ] **Step 5: 손에 그릴 도구** — `src/game/logic/playerMotion.ts`

import 에 `import type { ToolId } from '../data/tools'` (`FoodId` import 앞), 파일 끝의 `rodVisible` 을 지우고 아래로 바꾼다:

```ts
/**
 * 손에 그릴 도구. 낚시 중엔 늘 낚싯대. 그 밖엔 든 도구를 서 있거나 걸을 때만(감정 표현·점프·먹기·휴식·배 중엔 몸을 뚫는다).
 * 낚싯대는 가까운 줌에서 화면을 가려 숨긴다. 주먹은 그릴 게 없다
 */
export function shownTool(mode: Mode, zoom: number, action: PlayerAction, tool: ToolId | null): ToolId | null {
  if (mode === 'fishing') return 'rod'
  if (!tool || tool === 'fists' || mode === 'rest' || mode === 'boat' || action.emote || action.airborne || action.eat) return null
  if (tool === 'rod' && zoom < CAMERA_ZOOM.hideRodBelow) return null
  return tool
}
```

- [ ] **Step 6: 같이 하기 `tool`**

`src/game/logic/netProtocol.ts` — import 에 `import { TOOL_IDS, type ToolId } from '../data/tools'` (`SNACK_IDS` 다음), `NetState` 와 주석을:

```ts
/**
 * 내 모습 한 장면. p: 몸 가운데(캡슐 가운데) 위치, f: 바라보는 각도, v: 수평 속도.
 * tool: 손에 든 도구 (3-2. 빈손이거나 옛 클라이언트면 없다. 낚싯대가 보이는지는 rodOn 이 정한다)
 */
export type NetState = { p: Vec3; f: number; v: number; rest: boolean; fish: FishingLook | null; rod: number; rodOn: boolean; bob: Vec3 | null; act: NetAct; boat?: NetBoat; tool?: ToolId }
```

`readNetState` 의 `if (boat) out.boat = boat` 다음 줄에:

```ts
  // 도구도 틀리면 그 필드만 버린다 (모르는 도구 = 3-4 의 총을 든 새 클라이언트)
  const tool = oneOf(v.tool, TOOL_IDS)
  if (tool) out.tool = tool
```

`roundState` 의 `if (s.boat) out.boat = …` 다음 줄에 `if (s.tool) out.tool = s.tool`, `stateKey` 배열 끝에 `, s.tool ?? null` 을 더한다:

```ts
  return JSON.stringify([s.p, s.f, s.v, s.rest, s.fish, s.rod, s.rodOn, s.bob, s.act.emote, s.act.eat, s.act.airAge !== null, s.boat?.dir ?? null, s.tool ?? null])
```

`src/game/net/NetBridge.tsx` — `if (session.boat) raw.boat = …` 다음 줄에:

```tsx
    if (session.tool) raw.tool = session.tool
```

- [ ] **Step 7: 칼 모형과 그리기**

`src/game/scene/tools/KnifeModel.tsx`:

```tsx
/** 손에 든 칼 (원점이 주먹 가운데, 칼날이 위로). 내 캐릭터와 다른 사람이 같이 쓴다 */
export function KnifeModel() {
  return (
    <group>
      <mesh castShadow>
        <cylinderGeometry args={[0.018, 0.02, 0.12, 8]} />
        <meshStandardMaterial color="#5d4037" />
      </mesh>
      <mesh position={[0, 0.065, 0]}>
        <boxGeometry args={[0.07, 0.012, 0.025]} />
        <meshStandardMaterial color="#78909c" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.17, 0]} castShadow>
        <boxGeometry args={[0.01, 0.2, 0.04]} />
        <meshStandardMaterial color="#cfd8dc" metalness={0.8} roughness={0.25} />
      </mesh>
    </group>
  )
}
```

`src/game/scene/Player.tsx`:
- import 의 `rodVisible` 을 `shownTool` 로 (`cameraRig, isGrounded, moveSpeed, nextAction, shouldFaceCamera, shownTool`), `import { PlayerModel, … } from './PlayerModel'` 다음에 `import { KnifeModel } from './tools/KnifeModel'`.
- `const rodTip = useRef<Object3D>(null)` 다음에:

```tsx
  /** 손에 든 칼 (도구 칸 3) */
  const knife = useRef<Group>(null)
```

- 낚싯대 보이기 두 줄(`// 배 위에서 큰 지도를 봐도 …` 와 `rod.current.visible = rodVisible(…)`)을:

```tsx
      // 배 위에서 큰 지도를 봐도 앉은 채로 낚싯대를 숨긴다. 도구 칸에서 다른 도구를 들면 그 도구만 보인다
      const held = shownTool(boatAt ? 'boat' : mode, session.zoom, action, session.tool)
      rod.current.visible = held === 'rod'
      if (knife.current) knife.current.visible = held === 'knife'
```

- `rod.current.position.copy(visual.current.worldToLocal(grip))` 다음에:

```tsx
        // 칼도 같은 손에, 낚싯대처럼 앞으로 살짝 숙여 든다
        if (knife.current) {
          knife.current.position.copy(rod.current.position)
          knife.current.rotation.x = rod.current.rotation.x
        }
```

- JSX 에서 낚싯대 `<group ref={rod} …>` 를 닫는 `</group>` 다음에:

```tsx
        <group ref={knife} visible={false}>
          <KnifeModel />
        </group>
```

`src/game/scene/RemotePlayer.tsx`:
- import 에 `import { shownTool } from '../logic/playerMotion'` (`sampleAt` 다음), `import { KnifeModel } from './tools/KnifeModel'` (`PlayerModel` 다음). `const rod = useRef<Group>(null)` 다음에 `const knife = useRef<Group>(null)`.
- `rod.current.position.copy(visual.current.worldToLocal(grip))` 다음에:

```tsx
    // 남이 든 칼 (낚싯대는 rodOn 이 정한다). 앉았거나 감정 표현·점프·먹는 중엔 숨긴다
    if (knife.current) {
      knife.current.visible = shownTool(s.fish ? 'fishing' : s.rest ? 'rest' : 'explore', Infinity, e.action, s.tool ?? null) === 'knife'
      knife.current.position.copy(rod.current.position)
      knife.current.rotation.x = s.rod
    }
```

- JSX 의 낚싯대 `<group ref={rod}>` 를 닫는 `</group>` 다음에 (`visual` 그룹 안):

```tsx
          <group ref={knife} visible={false}>
            <KnifeModel />
          </group>
```

- [ ] **Step 8: 도구 칸 화면** — `src/game/ui/Hotbar.tsx`

```tsx
import { getBait } from '../data/bait'
import { HOTBAR, TOOLS } from '../data/tools'
import { TOUCH } from '../data/touch'
import { useMediaQuery, useTouchUi } from '../input/touchDevice'
import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'
import { safeBottom } from './styles'

/**
 * 화면 아래 가운데 도구 칸 (탐험 중). 숫자 키 1~9 와 같고, 눌러서도 바꾼다(폰).
 * 낚싯대 칸에는 고른 미끼 개수를 탄약처럼 적는다. 폰은 좁아서 빈 칸을 그리지 않는다
 */
export function Hotbar() {
  const mode = useSessionStore((s) => s.mode)
  const tool = useSessionStore((s) => s.tool)
  const bait = useProgressStore((s) => s.selectedBait)
  const baitCount = useProgressStore((s) => (s.selectedBait ? s.bait[s.selectedBait] : 0))
  const touchUi = useTouchUi()
  const portrait = useMediaQuery('(orientation: portrait)')
  if (mode !== 'explore') return null
  const bottom = touchUi ? TOUCH.hotbarBottom[portrait ? 'portrait' : 'landscape'] : 30
  const slots = HOTBAR.map((id, i) => ({ id, i })).filter((s) => !touchUi || s.id)
  return (
    <div style={{ position: 'absolute', left: '50%', bottom: safeBottom(bottom), transform: 'translateX(-50%)', display: 'flex', gap: 4, pointerEvents: 'auto', zIndex: 1000 }} aria-label="도구 칸">
      {slots.map(({ id, i }) => {
        const def = id ? TOOLS.find((t) => t.id === id) : undefined
        const on = id !== null && id === tool
        return (
          <button
            key={i}
            disabled={!id}
            title={def ? `${i + 1} ${def.name}` : undefined}
            aria-label={def ? `${def.name} 들기` : `빈 칸 ${i + 1}`}
            aria-pressed={on}
            onClick={(e) => {
              e.currentTarget.blur()
              if (id) useSessionStore.getState().equip(on ? null : id)
            }}
            style={{
              position: 'relative',
              width: 46,
              height: 46,
              borderRadius: 10,
              border: on ? '3px solid #ffd166' : '2px solid rgba(255,255,255,0.35)',
              background: on ? 'rgba(255, 209, 102, 0.35)' : 'rgba(15, 20, 30, 0.55)',
              color: '#fff',
              cursor: id ? 'pointer' : 'default',
              padding: 0,
              fontSize: 24,
              lineHeight: 1,
            }}
          >
            <span style={{ position: 'absolute', top: 2, left: 4, fontSize: 10, opacity: 0.8 }}>{i + 1}</span>
            {def?.icon}
            {id === 'rod' && (
              <span style={{ position: 'absolute', bottom: 1, right: 3, fontSize: 10, fontWeight: 800 }} title={bait ? `${getBait(bait).name} ${baitCount}개` : '미끼 없이'}>
                {bait ? baitCount : '–'}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
```

`src/game/data/touch.ts` — `buttons: { … },` 다음에:

```ts
  /** 도구 칸 아래 여백: 가로 화면은 아래 가운데(조이스틱·버튼 사이), 세로 화면은 좁아서 조이스틱 위로 올린다 */
  hotbarBottom: { landscape: 12, portrait: 174 },
```

`src/game/Game.tsx` — `import { Hud, NoticeLayer } from './ui/Hud'` 다음에 `import { Hotbar } from './ui/Hotbar'`, JSX `<Hud />` 다음 줄에 `<Hotbar />`.

아래쪽 안내를 도구 칸 위로 올린다:
- `src/game/ui/styles.ts` 의 `hint`: 주석을 `/** 화면 아래 가운데 안내 문구 (도구 칸 위) */`, `bottom: 32` → `bottom: 96` (`touchHint` 는 `bottom: 'auto'` 로 덮으니 그대로).
- `src/game/ui/Hud.tsx` 의 `lookHint`: `bottom: 80` → `bottom: 144`. 키 안내 줄 `<div style={{ position: 'absolute', bottom: 16, left: 16, opacity: 0.7, fontSize: 13 }}>` 를 가운데 맨 아래로 바꾸고 글에 도구 키를 더한다:

```tsx
            <div style={{ position: 'absolute', bottom: 8, left: 16, right: 16, textAlign: 'center', opacity: 0.7, fontSize: 12 }}>
              WASD 이동 · Shift 달리기 · Space 점프 · 1~3 도구 · X 넣기 · T 꾹 감정 표현 · Tab 지도 · 휠 확대 · M 음악 · {mouseLook ? (locked ? '마우스로 시점 회전 · ESC 메뉴' : '클릭 후 마우스로 시점 회전') : '드래그로 카메라 회전'}
```

- `src/game/ui/TouchControls.tsx` 의 CSS: `.tc-help` 의 `bottom: ${safe('bottom', 16)}` → `bottom: ${safe('bottom', TOUCH.hotbarBottom.landscape + 56)}`, 세로 화면 `@media (orientation: portrait)` 안의 `bottom: ${safe('bottom', JOY.margin + JOY.radius * 2 + 34)}` → `bottom: ${safe('bottom', TOUCH.hotbarBottom.portrait + 56)}`.

- [ ] **Step 9: 실행해 통과 확인**

Run: `npx vitest run && npx tsc -b && npm run lint 2>&1 | grep -c warning`
Expected: 63 파일 / 641 개 PASS, tsc 출력 없음, 경고 `6`

- [ ] **Step 10: 커밋**

```bash
git add src/game/data/tools.ts src/game/scene/tools/KnifeModel.tsx src/game/ui/Hotbar.tsx src/game/logic/interaction.ts src/game/logic/interaction.test.ts src/game/stores/sessionStore.ts src/game/stores/sessionStore.test.ts src/game/input/useInteractionKeys.ts src/game/logic/playerMotion.ts src/game/logic/playerMotion.test.ts src/game/logic/netProtocol.ts src/game/logic/netProtocol.test.ts src/game/net/NetBridge.tsx src/game/scene/Player.tsx src/game/scene/RemotePlayer.tsx src/game/Game.tsx src/game/ui/styles.ts src/game/ui/Hud.tsx src/game/data/touch.ts src/game/ui/TouchControls.tsx
git commit -m "feat: 도구 칸 (낚싯대·주먹·칼)" -m "화면 아래 가운데 9칸 도구 칸을 두고 숫자 키 1~3 으로 낚싯대·주먹·칼을 든다. X 는 빈손, 폰은 칸을 눌러 바꾼다.
낚싯대는 들고 있을 때만 보이고, 물가에서 E 를 누르면 저절로 낚싯대로 바꿔 낚시를 시작한다. 낚싯대 칸엔 고른 미끼 개수를 적는다.
같이 하기 모습에 선택 필드 tool 을 더해 남이 든 칼을 그린다 (틀린 값은 그 필드만 버린다)."
```

---
### Task 5: 가방 (I)·먹기 (F)

**Files:**
- Create: `src/game/ui/eatFromBag.ts`, `src/game/ui/BagPanel.tsx`
- Modify: `src/game/logic/interaction.ts` (모드 `bag`, 키 F·I), `src/game/input/useInteractionKeys.ts` (`eatBest`)
- Modify: `src/game/ui/Panels.tsx` (`bag`), `src/game/ui/Hud.tsx` (가방 버튼·키 안내), `src/game/ui/TouchControls.tsx` (폰 가방 버튼)
- Test: `src/game/logic/interaction.test.ts`

**Interfaces:**
- Consumes: Task 1 의 `ITEMS`·`ITEM_IDS`·`RECIPES`·`TAGS`·`isMeadowDish`·`bagFoodFill`·`canCook`·`dishFill`·`ingredientHave`, Task 2 의 `eatFromBag`·`eatBest`·`items`, `pressEat` (`input/usePlayerActionKeys.ts`), `Kiosk`·`KioskDetail`·`BigButton` (`ui/Kiosk.tsx`), `ItemIcon` (간식 그림)
- Produces:
  - `Mode` 에 `'bag'`, `KeyAction` 에 `{ type: 'eatBest' }`
  - `bagFoodName(id: BagFood): string`, `eatFromBagNow(id: BagFood): boolean`, `eatBestNow(): void` (`ui/eatFromBag.ts`)
  - `<BagPanel />` — 이 Task 에선 "요리법" 탭이 보기만 한다. Task 6 이 가스레인지 앞에서 "요리하기" 를 더한다

- [ ] **Step 1: 실패하는 테스트 쓰기** — `src/game/logic/interaction.test.ts` 의 `describe('resolveKeyAction')` 를 닫는 `})` 앞에:

```ts
  it('탐험 중 F 는 먹기, I 는 가방 (가방에서 I·ESC 는 닫기). 낚시·패널 중엔 무시', () => {
    expect(resolveKeyAction('KeyF', 'explore', null)).toEqual({ type: 'eatBest' })
    expect(resolveKeyAction('KeyI', 'explore', null)).toEqual({ type: 'openMode', mode: 'bag' })
    expect(resolveKeyAction('KeyI', 'bag', null)).toEqual({ type: 'closePanel' })
    expect(resolveKeyAction('Escape', 'bag', null)).toEqual({ type: 'closePanel' })
    for (const mode of ['fishing', 'market', 'map', 'emote', 'sleep'] as const) {
      expect(resolveKeyAction('KeyF', mode, null).type).not.toBe('eatBest')
      expect(resolveKeyAction('KeyI', mode, null).type).not.toBe('openMode')
    }
  })
```

- [ ] **Step 2: 실행해 실패 확인**

Run: `npx vitest run src/game/logic/interaction.test.ts`
Expected: FAIL — `KeyF` 가 `{ type: 'none' }`

- [ ] **Step 3: 모드와 키** — `src/game/logic/interaction.ts`

`Mode` 주석의 `emote = …` 줄 끝에 `, bag = 가방 (I, 가스레인지에선 요리법)` 을 붙이고 union 의 `| 'emote'` 다음에 `| 'bag'`. `KeyAction` 의 `equip` 다음에:

```ts
  /** F: 가방에서 배고픔을 가장 많이 채우는 것을 먹는다 */
  | { type: 'eatBest' }
```

Task 4 에서 넣은 탐험 블록(`if (mode === 'explore') { … }`)의 `KeyX` 줄 다음에:

```ts
    if (code === 'KeyF') return { type: 'eatBest' }
    if (code === 'KeyI') return { type: 'openMode', mode: 'bag' }
```

그 블록을 닫는 `}` 다음 줄에:

```ts
  // 가방은 I 로도 닫는다
  if (code === 'KeyI' && mode === 'bag') return { type: 'closePanel' }
```

- [ ] **Step 4: 가방에서 먹기** — `src/game/ui/eatFromBag.ts`

```ts
import { ITEMS } from '../data/meadowItems'
import { SNACKS } from '../data/snacks'
import { pressEat } from '../input/usePlayerActionKeys'
import { bagFoodFill, type BagFood } from '../logic/inventory'
import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'

/** 가방 음식 이름 (은지 요리·간식) */
export function bagFoodName(id: BagFood): string {
  return SNACKS.find((s) => s.id === id)?.name ?? ITEMS[id as keyof typeof ITEMS].name
}

/** 먹었다는 알림을 띄우고 창을 닫고 캐릭터가 먹는 모습을 보여 준다 */
function ate(id: BagFood) {
  const { heal, hunger } = bagFoodFill(id)
  const session = useSessionStore.getState()
  session.notify(`냠냠! ${bagFoodName(id)} · 배고픔 +${hunger} · 체력 +${heal}`)
  if (session.mode !== 'explore') session.setMode('explore')
  pressEat(id)
}

/** 가방에서 골라 먹기. 없으면 false */
export function eatFromBagNow(id: BagFood): boolean {
  if (!useProgressStore.getState().eatFromBag(id)) return false
  ate(id)
  return true
}

/** F: 배고픔을 가장 많이 채우는 것부터 먹는다. 먹을 게 없으면 알림만 */
export function eatBestNow() {
  const id = useProgressStore.getState().eatBest()
  if (id) ate(id)
  else useSessionStore.getState().notify('먹을 음식이 없어요. 가스레인지에서 요리하거나 미스터찜에서 사 와요')
}
```

`src/game/input/useInteractionKeys.ts` — import 에 `import { eatBestNow } from '../ui/eatFromBag'` (sessionStore import 다음), `case 'toggleMap':` 앞에:

```ts
    case 'eatBest':
      eatBestNow()
      break
```

- [ ] **Step 5: 가방 화면** — `src/game/ui/BagPanel.tsx`

```tsx
import { useState } from 'react'
import { ITEMS, ITEM_IDS, RECIPES, TAGS, isMeadowDish, type Ingredient, type ItemId, type MeadowDishId, type Recipe } from '../data/meadowItems'
import { SNACKS, getSnack, type SnackId } from '../data/snacks'
import { bagFoodFill, canCook, dishFill, ingredientHave, type BagFood } from '../logic/inventory'
import { useProgressStore } from '../stores/progressStore'
import { eatFromBagNow } from './eatFromBag'
import { ItemIcon } from './ItemIcon'
import { BigButton, Kiosk, KioskDetail } from './Kiosk'

type Tab = 'items' | 'recipes'

/** 은지 물건 그림 (이모지) */
function Emoji({ icon, size }: { icon: string; size: number }) {
  return <span style={{ fontSize: size * 0.8, lineHeight: 1 }}>{icon}</span>
}

const isSnack = (id: string): id is SnackId => SNACKS.some((s) => s.id === id)

/** 가방 칸 하나: 은지 물건 또는 낚시섬 간식 */
type Row = { id: ItemId | SnackId; n: number }

const fillText = (id: BagFood) => {
  const { heal, hunger } = bagFoodFill(id)
  return `배고픔 +${hunger} · 체력 +${heal}`
}

/** 재료 한 줄 글 (🥩 아무 고기 1/2) */
function ingredientText(s: Ingredient, have: number): string {
  const { icon, name } = 'tag' in s ? TAGS[s.tag] : ITEMS[s.id]
  return `${icon} ${name} ${Math.min(have, s.n)}/${s.n}`
}

/**
 * 가방 (I): "가방" 탭은 은지 물건(재료·요리)과 낚시섬 간식, "요리법" 탭은 은지 배합법 13가지.
 * 요리·간식은 눌러 먹는다 (창이 닫히고 먹는 모습). 물고기는 판매함 그대로 (여기 섞지 않는다)
 */
export function BagPanel() {
  const coins = useProgressStore((s) => s.coins)
  const [tab, setTab] = useState<Tab>('items')
  const frame = {
    title: '🎒 가방',
    subtitle: '요리는 주방 가스레인지에서 · 고기·채집물은 마을 상인에게 팔아요',
    accent: '#8d6e63',
    coins,
    tabs: [
      { id: 'items', label: '가방' },
      { id: 'recipes', label: '요리법' },
    ],
    tab,
    onTab: (id: string) => setTab(id as Tab),
  }
  return tab === 'items' ? <ItemsTab frame={frame} /> : <RecipesTab frame={frame} />
}

type Frame = Pick<Parameters<typeof Kiosk>[0], 'title' | 'subtitle' | 'accent' | 'coins' | 'tabs' | 'tab' | 'onTab'>

function ItemsTab({ frame }: { frame: Frame }) {
  const items = useProgressStore((s) => s.items)
  const snacks = useProgressStore((s) => s.snacks)
  const rows: Row[] = [...ITEM_IDS.filter((id) => items[id] > 0).map((id) => ({ id, n: items[id] })), ...SNACKS.filter((s) => snacks[s.id] > 0).map((s) => ({ id: s.id, n: snacks[s.id] }))]
  const [selected, setSelected] = useState<string | null>(null)
  const row = rows.find((r) => r.id === selected) ?? rows[0]
  const image = (id: Row['id'], size: number) => (isSnack(id) ? <ItemIcon id={id} size={size} /> : <Emoji icon={ITEMS[id].icon} size={size} />)
  const name = (id: Row['id']) => (isSnack(id) ? getSnack(id).name : ITEMS[id].name)
  const edible = (id: Row['id']): id is BagFood => isSnack(id) || isMeadowDish(id)
  return (
    <Kiosk
      {...frame}
      cards={rows.map((r) => ({ id: r.id, name: name(r.id), image: image(r.id, 56), badge: `×${r.n}`, sub: edible(r.id) ? fillText(r.id) : '재료' }))}
      selectedId={row?.id ?? null}
      onSelect={setSelected}
      empty="가방이 비어 있어요. 버섯·호박을 따거나 마을 상인에게 사 보세요"
      detail={
        row && (
          <KioskDetail
            image={image(row.id, 96)}
            title={name(row.id)}
            lines={[isSnack(row.id) ? getSnack(row.id).description : ITEMS[row.id].desc, edible(row.id) ? fillText(row.id) : '요리 재료예요', `가방에 ${row.n}개`]}
          >
            {edible(row.id) && <BigButton label="먹기" sub={fillText(row.id)} onClick={() => edible(row.id) && eatFromBagNow(row.id)} />}
          </KioskDetail>
        )
      }
    />
  )
}

function RecipesTab({ frame }: { frame: Frame }) {
  const items = useProgressStore((s) => s.items)
  const [selected, setSelected] = useState<MeadowDishId>(RECIPES[0].id)
  const recipe: Recipe = RECIPES.find((r) => r.id === selected) ?? RECIPES[0]
  const ready = canCook(items, recipe)
  const { heal, hunger } = dishFill(recipe.result)
  return (
    <Kiosk
      {...frame}
      cards={RECIPES.map((r) => ({
        id: r.id,
        name: r.name,
        image: <Emoji icon={ITEMS[r.result].icon} size={56} />,
        sub: canCook(items, r) ? '재료가 다 있어요' : '재료가 모자라요',
        subColor: canCook(items, r) ? '#2e7d32' : '#c62828',
        price: `${r.time}초`,
        dimmed: !canCook(items, r),
      }))}
      selectedId={recipe.id}
      onSelect={(id) => setSelected(id as MeadowDishId)}
      detail={
        <KioskDetail
          image={<Emoji icon={ITEMS[recipe.result].icon} size={96} />}
          title={recipe.name}
          lines={[ITEMS[recipe.result].desc, `배고픔 +${hunger} · 체력 +${heal} · ${recipe.time}초`, ...recipe.ingredients.map((s) => ingredientText(s, ingredientHave(items, s)))]}
        >
          <p className="kiosk-note" style={{ color: ready ? '#2e7d32' : undefined }}>
            {ready ? '재료가 다 있어요. 주방 가스레인지에서 요리해요' : '재료가 모자라요'}
          </p>
        </KioskDetail>
      }
    />
  )
}
```

`src/game/ui/Panels.tsx` — import 에 `import { BagPanel } from './BagPanel'` (`AquariumView` 다음), `switch` 의 `case 'wardrobe':` 앞에:

```tsx
    case 'bag':
      return <BagPanel />
```

- [ ] **Step 6: 가방 버튼과 키 안내**

`src/game/ui/Hud.tsx` — 탐험 중 오른쪽 위 버튼 줄의 `<MusicButton />` 다음에 (폰은 위쪽 줄이 좁아 코인 줄을 가리므로 컴퓨터만):

```tsx
            {/* 폰은 위쪽 줄이 좁아서 가방 버튼을 오른쪽 아래 조작 버튼 옆에 둔다 (TouchControls) */}
            {!touchUi && (
              <button style={button} aria-label="가방" onClick={(e) => { e.currentTarget.blur(); setMode('bag') }}>
                🎒 가방 (I)
              </button>
            )}
```

키 안내 글의 `· X 넣기 ·` 다음에 `I 가방 · F 먹기 ·` 를 넣는다:

```tsx
              WASD 이동 · Shift 달리기 · Space 점프 · 1~3 도구 · X 넣기 · I 가방 · F 먹기 · T 꾹 감정 표현 · Tab 지도 · 휠 확대 · M 음악 · {mouseLook ? (locked ? '마우스로 시점 회전 · ESC 메뉴' : '클릭 후 마우스로 시점 회전') : '드래그로 카메라 회전'}
```

`src/game/ui/TouchControls.tsx` — 파일 주석의 `(상호작용·점프·감정 표현, …)` 을 `(상호작용·점프·감정 표현·가방, …)` 으로, `ExploreControls` 의 `<div className="tc-row">` 바로 안쪽 맨 앞(😀 표현 버튼 앞)에:

```tsx
          <TapButton className="tc-btn tc-small" ariaLabel="가방" onTap={() => useSessionStore.getState().setMode('bag')}>
            <span style={{ fontSize: 22, lineHeight: 1 }}>🎒</span>
            <span style={{ fontSize: 11 }}>가방</span>
          </TapButton>
```

- [ ] **Step 7: 실행해 통과 확인**

Run: `npx vitest run && npx tsc -b && npm run lint 2>&1 | grep -c warning`
Expected: 63 파일 / 642 개 PASS, tsc 출력 없음, 경고 `6`

- [ ] **Step 8: 커밋**

```bash
git add src/game/ui/eatFromBag.ts src/game/ui/BagPanel.tsx src/game/logic/interaction.ts src/game/logic/interaction.test.ts src/game/input/useInteractionKeys.ts src/game/ui/Panels.tsx src/game/ui/Hud.tsx src/game/ui/TouchControls.tsx
git commit -m "feat: 가방과 먹기" -m "I 로 여는 가방 키오스크에 은지 물건(재료·요리)과 낚시섬 간식을 보여 주고, 요리·간식은 눌러 먹는다. 요리법 탭은 은지 배합법 13가지.
F 는 배고픔을 가장 많이 채우는 것부터 먹고 지금 먹기 동작(손에 든 음식·냠냠)을 그대로 쓴다.
컴퓨터는 위쪽 버튼 줄, 폰은 오른쪽 아래 😀 옆에 가방 버튼."
```

---
### Task 6: 버섯·호박 줍기와 가스레인지 요리

**Files:**
- Create: `src/game/logic/meadowInteract.ts`, `src/meadow/meadowActions.ts`, `src/meadow/MeadowInteractions.tsx`
- Modify: `src/meadow/vendor/world.d.ts` (버섯·호박, 가스레인지), `src/meadow/meadowSingleton.ts` (따기·다시 자라기·E 대상 목록)
- Modify: `src/game/logic/interaction.ts` (대상 `pickup`·`stove`, 키 동작 `harvest`), `src/game/ui/interactLabel.ts`, `src/game/input/useInteractionKeys.ts`
- Modify: `src/game/stores/sessionStore.ts` (`stoveCook`), `src/game/ui/BagPanel.tsx` (요리하기), `src/game/ui/Hud.tsx` (요리 중 표시), `src/game/scene/World.tsx`
- Test: `src/game/logic/meadowInteract.test.ts`, `src/meadow/meadowActions.test.ts`, `src/meadow/meadowSingleton.test.ts`, `src/game/logic/interaction.test.ts`

**Interfaces:**
- Consumes: Task 2 의 `startRecipe`·`addItem`·`items`, Task 1 의 `getRecipe`·`ITEMS`, Task 5 의 `<BagPanel />`, `toMeadowLocal`·`MEADOW_RECT` (`data/meadow.ts`), `playerRig` (`scene/Player.tsx`), `clampDelta` (`logic/time.ts`)
- Produces:
  - `Interactable` 에 `{ kind: 'pickup'; index: number; item: 'mushroom' | 'pumpkin' }`, `{ kind: 'stove' }`, `KeyAction` 에 `{ type: 'harvest'; index: number }`
  - `MEADOW_REACH = { pickup: 1.6, stove: 1.6, door: 2.5, vendor: 2.8 }`, `type MeadowSpot = { target: Interactable; x; z; reach }`, `nearestSpot(px, pz, spots, usable?)`, `meadowNearbyUpdate(current, found): Interactable | 'clear' | 'keep'` (`logic/meadowInteract.ts`, `MEADOW_KINDS` 에 Task 7·8 의 `door`·`vendor` 도 미리 들어 있다)
  - `type EunjiPickup`, `EunjiWorld.outdoor.pickups`, `EunjiWorld.stove` (`world.d.ts`)
  - `meadowPickups()`, `harvestPickup(index): 'mushroom' | 'pumpkin' | null`, `regrowPickups(dt)`, `meadowSpots(): MeadowSpot[]` (`meadow/meadowSingleton.ts`)
  - sessionStore: `stoveCook: { recipe: MeadowDishId; startedAt: number } | null`, `setStoveCook(cook)`
  - `harvest(index)`, `startStoveCook(recipe, now?): boolean`, `stoveCookLeft(now): number | null`, `stepStoveCook(now)` (`meadow/meadowActions.ts`)
  - `<MeadowInteractions />`

- [ ] **Step 1: 실패하는 테스트 쓰기**

`src/game/logic/meadowInteract.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { MEADOW_REACH, meadowNearbyUpdate, nearestSpot, type MeadowSpot } from './meadowInteract'

const stove: MeadowSpot = { target: { kind: 'stove' }, x: 9, z: -12, reach: MEADOW_REACH.stove }
const mushroom = (index: number, x: number, z: number): MeadowSpot => ({ target: { kind: 'pickup', index, item: 'mushroom' }, x, z, reach: MEADOW_REACH.pickup })

describe('초원 E 대상 고르기', () => {
  it('거리 안에서 가장 가까운 것', () => {
    const spots = [stove, mushroom(0, 10, -12), mushroom(1, 9.5, -12)]
    expect(nearestSpot(9.6, -12, spots)).toEqual({ kind: 'pickup', index: 1, item: 'mushroom' })
    expect(nearestSpot(8.9, -12, spots)).toEqual({ kind: 'stove' })
  })
  it('각자 거리보다 멀거나 딱 그 거리면 없다', () => {
    const at0 = { ...stove, x: 0, z: 0 }
    expect(nearestSpot(MEADOW_REACH.stove, 0, [at0])).toBeNull()
    expect(nearestSpot(MEADOW_REACH.stove - 0.01, 0, [at0])).toEqual({ kind: 'stove' })
  })
  it('쓸 수 없는 것(숨긴 버섯)은 건너뛰고 다음으로 가까운 것', () => {
    const spots = [mushroom(0, 0, 0), mushroom(1, 1, 0)]
    expect(nearestSpot(0.1, 0, spots, (s) => s.target.kind !== 'pickup' || s.target.index !== 0)).toEqual({ kind: 'pickup', index: 1, item: 'mushroom' })
  })
})

describe('초원 감시자가 nearby 를 바꾸는 규칙', () => {
  const shroom = { kind: 'pickup' as const, index: 1, item: 'mushroom' as const }
  it('침대 감지 상자·물가 낚시가 잡은 건 건드리지 않는다 (찾은 게 있어도, 없어도)', () => {
    expect(meadowNearbyUpdate({ kind: 'bed' }, { kind: 'stove' })).toBe('keep')
    expect(meadowNearbyUpdate({ kind: 'bed' }, null)).toBe('keep')
    expect(meadowNearbyUpdate({ kind: 'dock', dir: 'toIsland' }, null)).toBe('keep')
  })
  it('비었거나 내가 잡은 거면 찾은 것으로 바꾸고, 같으면 그대로', () => {
    expect(meadowNearbyUpdate(null, shroom)).toEqual(shroom)
    expect(meadowNearbyUpdate({ kind: 'stove' }, shroom)).toEqual(shroom)
    expect(meadowNearbyUpdate(shroom, { ...shroom })).toBe('keep')
  })
  it('못 찾으면 내가 잡은 것만 지운다', () => {
    expect(meadowNearbyUpdate(shroom, null)).toBe('clear')
    expect(meadowNearbyUpdate(null, null)).toBe('keep')
  })
})
```

`src/meadow/meadowActions.test.ts`:

```ts
// @vitest-environment jsdom
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NO_ITEMS } from '../game/logic/inventory'
import { INITIAL_PROGRESS, useProgressStore } from '../game/stores/progressStore'
import { useSessionStore } from '../game/stores/sessionStore'
import { startStoveCook, stepStoveCook, stoveCookLeft } from './meadowActions'

beforeAll(() => vi.stubGlobal('fetch', () => Promise.reject(new Error('offline'))))
afterAll(() => vi.unstubAllGlobals())

beforeEach(() => {
  localStorage.clear()
  useProgressStore.setState({ ...INITIAL_PROGRESS })
  useSessionStore.getState().resetSession()
})

describe('가스레인지 요리', () => {
  it('가스레인지 앞에서만, 재료를 빼고 창을 닫고 요리 시간 뒤 가방에 넣는다', () => {
    useProgressStore.setState({ items: { ...NO_ITEMS, egg: 1 } })
    useSessionStore.setState({ mode: 'bag' })
    expect(startStoveCook('friedegg', 10)).toBe(false)
    useSessionStore.getState().setNearby({ kind: 'stove' })
    expect(startStoveCook('friedegg', 10)).toBe(true)
    expect(useProgressStore.getState().items.egg).toBe(0)
    expect(useSessionStore.getState().mode).toBe('explore')
    expect(stoveCookLeft(11)).toBe(1)
    stepStoveCook(11.9)
    expect(useProgressStore.getState().items.friedegg).toBe(0)
    stepStoveCook(12)
    expect(useProgressStore.getState().items.friedegg).toBe(1)
    expect(useSessionStore.getState().stoveCook).toBeNull()
    expect(useSessionStore.getState().notice?.text).toContain('달걀 프라이 완성')
  })
  it('요리 중엔 또 시작하지 않고, 재료가 모자라면 시작하지 않는다', () => {
    useProgressStore.setState({ items: { ...NO_ITEMS, egg: 2 } })
    useSessionStore.getState().setNearby({ kind: 'stove' })
    expect(startStoveCook('omelet', 0)).toBe(false)
    expect(startStoveCook('friedegg', 0)).toBe(true)
    expect(startStoveCook('friedegg', 0.5)).toBe(false)
    expect(useProgressStore.getState().items.egg).toBe(1)
  })
  it('요리하는 동안 가스레인지를 떠나거나 다른 창을 열어도 시간이 되면 가방에 들어온다', () => {
    useProgressStore.setState({ items: { ...NO_ITEMS, bone: 2 } })
    useSessionStore.getState().setNearby({ kind: 'stove' })
    expect(startStoveCook('bonebroth', 0)).toBe(true)
    useSessionStore.getState().clearNearby({ kind: 'stove' })
    useSessionStore.getState().setMode('menu')
    stepStoveCook(6)
    expect(useProgressStore.getState().items.bonebroth).toBe(1)
  })
})
```

`src/meadow/meadowSingleton.test.ts` 맨 끝에:

```ts
describe('버섯·호박 따기', () => {
  it('따면 숨기고 respawn 초 뒤 다시 보인다. 숨긴 걸 또 딸 수 없다', async () => {
    const { harvestPickup, meadowPickups, meadowSpots, regrowPickups } = await import('./meadowSingleton')
    const { Object3D } = await import('three')
    const list = meadowPickups()
    const index = list.length
    list.push({ obj: new Object3D(), id: 'pumpkin', label: '호박', center: new Vector3(6.5, 1, -15.2), respawn: 90, timer: 0 })
    expect(meadowSpots().some((s) => s.target.kind === 'pickup' && s.target.index === index && s.x === 6.5)).toBe(true)
    expect(harvestPickup(index)).toBe('pumpkin')
    expect(list[index].obj.visible).toBe(false)
    expect(harvestPickup(index)).toBeNull()
    regrowPickups(89)
    expect(list[index].obj.visible).toBe(false)
    regrowPickups(1)
    expect(list[index].obj.visible).toBe(true)
    expect(harvestPickup(999)).toBeNull()
    list.pop()
  })
})
```

`src/game/logic/interaction.test.ts` — `describe('resolveKeyAction')` 를 닫는 `})` 앞에:

```ts
  it('초원: 버섯 E 는 따기, 가스레인지 E 는 가방(요리법). 같은 버섯인지는 번호로', () => {
    const shroom = { kind: 'pickup' as const, index: 4, item: 'mushroom' as const }
    expect(resolveKeyAction('KeyE', 'explore', shroom)).toEqual({ type: 'harvest', index: 4 })
    expect(resolveKeyAction('KeyE', 'explore', { kind: 'stove' })).toEqual({ type: 'openMode', mode: 'bag' })
    expect(isSameInteractable(shroom, { kind: 'pickup', index: 4, item: 'mushroom' })).toBe(true)
    expect(isSameInteractable(shroom, { kind: 'pickup', index: 5, item: 'mushroom' })).toBe(false)
  })
```

- [ ] **Step 2: 실행해 실패 확인**

Run: `npx vitest run src/game/logic/meadowInteract.test.ts src/meadow/meadowActions.test.ts src/meadow/meadowSingleton.test.ts src/game/logic/interaction.test.ts`
Expected: FAIL — `./meadowInteract`·`./meadowActions` 가 없고, `harvestPickup is not a function`, 버섯 E 가 `none`

- [ ] **Step 3: E 대상 고르기** — `src/game/logic/meadowInteract.ts`

```ts
import { isSameInteractable, type Interactable } from './interaction'

/** E 가 닿는 거리 (은지 값, 바닥 거리 m) */
export const MEADOW_REACH = { pickup: 1.6, stove: 1.6, door: 2.5, vendor: 2.8 }

/** 초원(은지 좌표)의 E 대상 하나 */
export type MeadowSpot = { target: Interactable; x: number; z: number; reach: number }

/**
 * 가장 가까운 대상 (은지 consider: 높이는 보지 않고 바닥 거리, 각자 거리보다 가까워야 한다). 없으면 null.
 * usable 이 false 인 것(따서 숨긴 버섯 등)은 건너뛴다
 */
export function nearestSpot(px: number, pz: number, spots: readonly MeadowSpot[], usable: (s: MeadowSpot) => boolean = () => true): Interactable | null {
  let best: MeadowSpot | null = null
  let bestD = Infinity
  for (const s of spots) {
    const d = Math.hypot(s.x - px, s.z - pz)
    if (d < s.reach && d < bestD && usable(s)) {
      best = s
      bestD = d
    }
  }
  return best?.target ?? null
}

/** 초원 감시자(MeadowInteractions)가 정하는 E 대상 종류. 그 밖(침대 감지 상자·물가 낚시 등)은 건드리지 않는다 */
const MEADOW_KINDS: ReadonlySet<string> = new Set(['pickup', 'stove', 'door', 'vendor'])

/**
 * 이번 프레임에 찾은 초원 대상(found)으로 nearby 를 어떻게 할까: 'keep' 그대로, 'clear' 지우기, 아니면 그 대상으로 바꾸기.
 * 감지 상자·물가 낚시가 이미 잡은 건 그쪽이 먼저라 늘 'keep'. 내가 잡은 것만 바꾸거나 지운다
 */
export function meadowNearbyUpdate(current: Interactable | null, found: Interactable | null): Interactable | 'clear' | 'keep' {
  if (current && !MEADOW_KINDS.has(current.kind)) return 'keep'
  if (found) return isSameInteractable(current, found) ? 'keep' : found
  return current ? 'clear' : 'keep'
}
```

- [ ] **Step 4: 대상·키·글씨**

`src/game/logic/interaction.ts` — `Interactable` 의 `| { kind: 'bed' }` 다음에:

```ts
  /** 초원 버섯·호박 (index: 은지 outdoor.pickups 순서) */
  | { kind: 'pickup'; index: number; item: 'mushroom' | 'pumpkin' }
  /** 초원 부엌 가스레인지 */
  | { kind: 'stove' }
```

`isSameInteractable` 의 `dock` 줄 다음에:

```ts
  if (a.kind === 'pickup' && b.kind === 'pickup') return a.index === b.index
```

`KeyAction` 의 `eatBest` 다음에:

```ts
  /** 버섯·호박 따기 */
  | { type: 'harvest'; index: number }
```

E 의 `switch (nearby.kind)` 에서 `case 'bed':` 다음에:

```ts
      case 'pickup':
        return { type: 'harvest', index: nearby.index }
      case 'stove':
        // 가방의 요리법 탭이 열린다 (BagPanel 이 가스레인지 앞인지 본다)
        return { type: 'openMode', mode: 'bag' }
```

`src/game/ui/interactLabel.ts` — import 에 `import { ITEMS } from '../data/meadowItems'`, `LABEL` 의 `Exclude<…, 'zoneGate' | 'dock'>` 를 `'zoneGate' | 'dock' | 'pickup'` 로, `bed: '🛏️ 잠자기',` 다음에 `stove: '🍳 요리하기 (요리법 보기)',`, `interactLabel` 의 `zoneGate` 줄 다음에:

```ts
  if (target.kind === 'pickup') return `${ITEMS[target.item].icon} ${ITEMS[target.item].name} 따기`
```

- [ ] **Step 5: 은지 타입** — `src/meadow/vendor/world.d.ts`

three import 에 `Object3D` 를 더하고, `export type EunjiWorld = {` 앞에:

```ts
/** 따는 것 (버섯·호박). 모델이 들어온 순서대로 쌓인다. timer: 다시 보일 때까지 남은 초 */
export type EunjiPickup = { obj: Object3D; id: 'mushroom' | 'pumpkin'; label: string; center: Vector3; respawn: number; timer: number }
```

`EunjiWorld` 의 `outdoor: { ready: Promise<unknown> }` 를:

```ts
  outdoor: { ready: Promise<unknown>; pickups: EunjiPickup[] }
  /** 부엌 가스레인지 (가구가 들어오면 자리가 정해진다) */
  stove: { center: Vector3; label: string }
```

- [ ] **Step 6: 따기·다시 자라기·대상 목록** — `src/meadow/meadowSingleton.ts`

import 를 바꾼다:

```ts
import { MEADOW_REACH, type MeadowSpot } from '../game/logic/meadowInteract'
import { ROOMS, createWorld, type EunjiPickup, type EunjiWorld } from './vendor/world.js'
```

파일 맨 끝에:

```ts
/** 버섯·호박 (은지 좌표). 모델이 들어오는 대로 늘어난다 */
export function meadowPickups(): EunjiPickup[] {
  return meadowWorld().outdoor.pickups
}

/** 따기: 숨기고 다시 자랄 시간을 건다. 이미 숨겼거나 없는 번호면 null */
export function harvestPickup(index: number): EunjiPickup['id'] | null {
  const p = meadowPickups()[index]
  if (!p || !p.obj.visible) return null
  p.obj.visible = false
  p.timer = p.respawn
  return p.id
}

/** 숨긴 것의 남은 시간을 줄이고, 다 되면 다시 보인다 (은지 그대로 내 화면만) */
export function regrowPickups(dt: number) {
  for (const p of meadowPickups()) {
    if (p.obj.visible) continue
    p.timer -= dt
    if (p.timer <= 0) p.obj.visible = true
  }
}

let spots: MeadowSpot[] = []
let spotsKey = ''

/** 초원 E 대상 (은지 좌표): 가스레인지·버섯·호박. 모델이 들어와 자리·개수가 바뀔 때만 다시 만든다 */
export function meadowSpots(): MeadowSpot[] {
  const w = meadowWorld()
  const pickups = w.outdoor.pickups
  const key = `${pickups.length}:${w.stove.center.x}:${w.stove.center.z}`
  if (key !== spotsKey) {
    spotsKey = key
    spots = [
      { target: { kind: 'stove' }, x: w.stove.center.x, z: w.stove.center.z, reach: MEADOW_REACH.stove },
      ...pickups.map((p, index): MeadowSpot => ({ target: { kind: 'pickup', index, item: p.id }, x: p.center.x, z: p.center.z, reach: MEADOW_REACH.pickup })),
    ]
  }
  return spots
}
```

- [ ] **Step 7: 요리 중 상태** — `src/game/stores/sessionStore.ts`

import 에 `import type { MeadowDishId } from '../data/meadowItems'` (tools import 앞), `SessionState` 의 `/** 손에 든 도구 … */` 앞에:

```ts
  /**
   * 초원 가스레인지 요리 중 (재료는 시작할 때 이미 뺐다). startedAt: performance.now() 초. 은지처럼 요리하는 동안 돌아다녀도 된다.
   * 저장하지 않는다 (새로고침하면 재료와 함께 사라진다, 은지 그대로)
   */
  stoveCook: { recipe: MeadowDishId; startedAt: number } | null
  setStoveCook: (cook: { recipe: MeadowDishId; startedAt: number } | null) => void
```

본문 `tool: 'rod',` 앞에:

```ts
  stoveCook: null,
  setStoveCook: (stoveCook) => set({ stoveCook }),
```

`resetSession` 객체 끝에 `stoveCook: null` 을 더한다 (`… tool: 'rod', stoveCook: null })`).

- [ ] **Step 8: 따기·요리 흐름** — `src/meadow/meadowActions.ts`

```ts
import { ITEMS, getRecipe, type MeadowDishId } from '../game/data/meadowItems'
import { useProgressStore } from '../game/stores/progressStore'
import { useSessionStore } from '../game/stores/sessionStore'
import { harvestPickup } from './meadowSingleton'

/** E 로 버섯·호박 따기 → 가방 */
export function harvest(index: number) {
  const item = harvestPickup(index)
  if (!item) return
  const progress = useProgressStore.getState()
  progress.addItem(item)
  const { icon, name } = ITEMS[item]
  useSessionStore.getState().notify(`${icon} ${name} 획득 (${useProgressStore.getState().items[item]}개)`)
}

/**
 * 가스레인지 요리 시작 (가스레인지 앞에서 연 가방의 "요리하기"). 재료를 빼고 창을 닫는다. 요리 중이거나 재료가 모자라면 false.
 * now: performance.now() 초
 */
export function startStoveCook(recipe: MeadowDishId, now = performance.now() / 1000): boolean {
  const session = useSessionStore.getState()
  if (session.stoveCook || session.nearby?.kind !== 'stove') return false
  if (!useProgressStore.getState().startRecipe(recipe)) return false
  session.setStoveCook({ recipe, startedAt: now })
  session.setMode('explore')
  return true
}

/** 요리가 끝나기까지 남은 초 (요리 중이 아니면 null) */
export function stoveCookLeft(now: number): number | null {
  const cook = useSessionStore.getState().stoveCook
  return cook ? Math.max(0, getRecipe(cook.recipe).time - (now - cook.startedAt)) : null
}

/** 매 프레임: 요리 시간이 다 되면 가방에 넣고 알린다 */
export function stepStoveCook(now: number) {
  const session = useSessionStore.getState()
  const cook = session.stoveCook
  if (!cook || (stoveCookLeft(now) ?? 1) > 0) return
  const recipe = getRecipe(cook.recipe)
  useProgressStore.getState().addItem(recipe.result)
  session.setStoveCook(null)
  session.notify(`${ITEMS[recipe.result].icon} ${recipe.name} 완성! 가방에 넣었어요 (F 로 먹기)`)
}
```

`src/game/input/useInteractionKeys.ts` — import 에 `import { harvest } from '../../meadow/meadowActions'` (`interaction` import 다음), `case 'eatBest':` 앞에:

```ts
    case 'harvest':
      harvest(action.index)
      break
```

- [ ] **Step 9: 감시자** — `src/meadow/MeadowInteractions.tsx`

```tsx
import { useFrame } from '@react-three/fiber'
import { MEADOW_RECT, toMeadowLocal } from '../game/data/meadow'
import { meadowNearbyUpdate, nearestSpot, type MeadowSpot } from '../game/logic/meadowInteract'
import { clampDelta } from '../game/logic/time'
import { playerRig } from '../game/scene/Player'
import { useSessionStore } from '../game/stores/sessionStore'
import { stepStoveCook } from './meadowActions'
import { meadowPickups, meadowSpots, regrowPickups } from './meadowSingleton'

/** 따서 숨긴 버섯·호박은 건너뛴다 */
const usable = (s: MeadowSpot) => s.target.kind !== 'pickup' || meadowPickups()[s.target.index]?.obj.visible === true

/**
 * 화면엔 아무것도 그리지 않고, 매 프레임 초원 E 대상(meadowSpots)을 은지처럼 가장 가까운 것 하나로 고른다.
 * 감지 상자(침대 등)나 물가 낚시가 이미 잡혀 있으면 그쪽이 먼저다. 버섯 다시 자라기와 가스레인지 요리 완성도 여기서
 */
export function MeadowInteractions() {
  useFrame((_, delta) => {
    regrowPickups(clampDelta(delta))
    stepStoveCook(performance.now() / 1000)
    const session = useSessionStore.getState()
    if (session.mode !== 'explore') return
    const { x, z } = playerRig.position
    // 섬에선 찾지 않는다 (내가 잡아 둔 게 있으면 지운다)
    const [lx, lz] = toMeadowLocal(x, z)
    const found = x > MEADOW_RECT.x0 - 2 ? nearestSpot(lx, lz, meadowSpots(), usable) : null
    const current = session.nearby
    const next = meadowNearbyUpdate(current, found)
    if (next === 'clear') {
      if (current) session.clearNearby(current)
    } else if (next !== 'keep') {
      session.setNearby(next)
    }
  })
  return null
}
```

`src/game/scene/World.tsx` — `import { MeadowInteractions } from '../../meadow/MeadowInteractions'` 를 더하고 JSX `<MeadowWorld />` 다음 줄에 `<MeadowInteractions />`.

- [ ] **Step 10: 가스레인지 앞에서 요리하기** — `src/game/ui/BagPanel.tsx`

import 에 `import { startStoveCook } from '../../meadow/meadowActions'` (inventory import 다음)와 `import { useSessionStore } from '../stores/sessionStore'` (progressStore import 다음). `BagPanel` 주석 둘째 줄 끝을 `… 섞지 않는다).` 로 바꾸고 ` * 가스레인지 앞에서 열면 요리법 탭부터, 재료가 있으면 "요리하기"` 줄을 더한다. 처음 탭:

```tsx
  const [tab, setTab] = useState<Tab>(() => (useSessionStore.getState().nearby?.kind === 'stove' ? 'recipes' : 'items'))
```

`RecipesTab` 의 `const items = …` 다음에:

```tsx
  const nearStove = useSessionStore((s) => s.nearby?.kind === 'stove')
  const cooking = useSessionStore((s) => s.stoveCook !== null)
```

`RecipesTab` 의 `<KioskDetail …>` 안 `<p className="kiosk-note" …>…</p>` 를 아래로 바꾼다:

```tsx
          {nearStove ? (
            <BigButton
              label="요리하기"
              sub={cooking ? '가스레인지에서 요리하는 중이에요' : ready ? `${recipe.time}초 뒤 가방에 들어와요` : '재료가 모자라요'}
              disabled={!ready || cooking}
              onClick={() => startStoveCook(recipe.id)}
            />
          ) : (
            <p className="kiosk-note" style={{ color: ready ? '#2e7d32' : undefined }}>
              {ready ? '재료가 다 있어요. 주방 가스레인지에서 요리해요' : '재료가 모자라요'}
            </p>
          )}
```

- [ ] **Step 11: 요리 중 표시** — `src/game/ui/Hud.tsx`

import 에 `import { ITEMS, getRecipe } from '../data/meadowItems'` (finishCooking import 다음). 왼쪽 위 칸의 `{mode === 'explore' && <SnackBag />}` 바로 앞에 `<StoveCookStatus />`, `const letterbox = …` 앞에 (렌더 중 `performance.now()` 를 부르지 않게 시각을 상태로 둔다):

```tsx
/** 가스레인지 요리 중: "🍳 스테이크 요리 중… 3초" (0.2초마다 다시 센다) */
function StoveCookStatus() {
  const cook = useSessionStore((s) => s.stoveCook)
  const [now, setNow] = useState(() => performance.now() / 1000)
  useEffect(() => {
    if (!cook) return
    const id = setInterval(() => setNow(performance.now() / 1000), 200)
    return () => clearInterval(id)
  }, [cook])
  if (!cook) return null
  const recipe = getRecipe(cook.recipe)
  const left = Math.min(recipe.time, Math.max(0, recipe.time - (now - cook.startedAt)))
  return (
    <div style={{ fontSize: 13, marginTop: 6, color: '#ffe082', textShadow: '0 1px 2px #000' }}>
      {ITEMS[recipe.result].icon} {recipe.name} 요리 중… {Math.ceil(left)}초
    </div>
  )
}
```

- [ ] **Step 12: 실행해 통과 확인**

Run: `npx vitest run && npx tsc -b && npm run lint 2>&1 | grep -c warning`
Expected: 65 파일 / 653 개 PASS, tsc 출력 없음, 경고 `6`

- [ ] **Step 13: 커밋**

```bash
git add src/game/logic/meadowInteract.ts src/game/logic/meadowInteract.test.ts src/meadow/meadowActions.ts src/meadow/meadowActions.test.ts src/meadow/MeadowInteractions.tsx src/meadow/vendor/world.d.ts src/meadow/meadowSingleton.ts src/meadow/meadowSingleton.test.ts src/game/logic/interaction.ts src/game/logic/interaction.test.ts src/game/ui/interactLabel.ts src/game/input/useInteractionKeys.ts src/game/stores/sessionStore.ts src/game/ui/BagPanel.tsx src/game/ui/Hud.tsx src/game/scene/World.tsx
git commit -m "feat: 버섯·호박 줍기와 가스레인지 요리" -m "초원 E 대상은 은지 consider 처럼 바닥 거리로 가장 가까운 것 하나를 매 프레임 고른다 (감지 상자·물가 낚시가 잡은 대상이 먼저).
버섯 18개·호박 4개는 E 로 따면 가방에 들어가고 120초(호박 90초) 뒤 다시 보인다 (내 화면만).
부엌 가스레인지에서 E 를 누르면 가방 요리법 탭이 열리고, 요리하기를 누르면 재료를 빼고 요리 시간 뒤 가방에 넣는다 (그동안 돌아다녀도 된다)."
```

---
### Task 7: 문 여닫기 (은지 좌표로 잰 충돌 상자, 저장)

**Files:**
- Create: `src/meadow/MeadowDoors.tsx`
- Modify: `src/game/logic/meadowColliders.ts` (`doorBox`), `src/game/data/meadow.ts` (`MEADOW_DOORS`), `src/meadow/vendor/world.d.ts` (`EunjiDoor`·`colliders`)
- Modify: `src/game/stores/progressStore.ts` (`doors`·`setDoorOpen`)
- Modify: `src/meadow/meadowSingleton.ts` (처음에 다 열지 않기, 문 E 대상, `doorCuboid`·`applyDoors`), `src/meadow/MeadowWorld.tsx` (정적 상자에서 문 빼기, `<MeadowDoors />`)
- Modify: `src/game/logic/interaction.ts` (대상 `door`, `toggleDoor`), `src/game/ui/interactLabel.ts`, `src/meadow/meadowActions.ts` (`toggleDoor`), `src/game/input/useInteractionKeys.ts`
- Test: `src/game/logic/meadowColliders.test.ts`, `src/game/stores/progressStore.test.ts`, `src/meadow/meadowSingleton.test.ts`, `src/meadow/vendor.test.ts`, `src/game/logic/interaction.test.ts`

**Interfaces:**
- Consumes: Task 6 의 `meadowSpots`·`MEADOW_REACH.door`·`meadowNearbyUpdate`(이미 `door` 를 안다), `boxesToCuboids`·`type BoxLike`·`type Cuboid` (`logic/meadowColliders.ts`), `clampDelta`
- Produces:
  - `DOOR_THICK = 0.06`, `doorBox({ x, z, yaw, width, height }): BoxLike` (은지 좌표)
  - `MEADOW_DOORS = ['거실 문', '사격장 문', '주방 문', '현관문']` (`data/meadow.ts`)
  - `EunjiDoor = { group; panel: Mesh<BoxGeometry>; base; angle; width; open; label; center; collider; setOpen(open, instant?); update(dt) }`, `EunjiWorld.colliders: Box3[]`
  - progressStore: `doors: boolean[]` (처음 4개 모두 false), `setDoorOpen(index, open)`
  - `doorCuboid(index, open): Cuboid | null`, `applyDoors(opens, instant)` (`meadow/meadowSingleton.ts`)
  - `Interactable` 에 `{ kind: 'door'; index: number }`, `KeyAction` 에 `{ type: 'toggleDoor'; index: number }`, `toggleDoor(index)` (`meadow/meadowActions.ts`)
  - `<MeadowDoors />`

- [ ] **Step 1: 실패하는 테스트 쓰기**

`src/game/logic/meadowColliders.test.ts` — import 를 `import { DOOR_THICK, boxesToCuboids, doorBox } from './meadowColliders'` 로 바꾸고 맨 끝에:

```ts
describe('doorBox', () => {
  it('닫힌 문(z 로 뻗음)은 경첩에서 +z 로 폭만큼, 두께는 x 로', () => {
    const b = doorBox({ x: 5, z: -0.5, yaw: 0, width: 1, height: 2.1 })
    expect(b.min).toEqual({ x: 5 - DOOR_THICK / 2, y: 0, z: -0.5 })
    expect(b.max).toEqual({ x: 5 + DOOR_THICK / 2, y: 2.1, z: 0.5 })
  })
  it('90° 열면 +x 로 뻗는다', () => {
    const b = doorBox({ x: 5, z: -0.5, yaw: Math.PI / 2, width: 1, height: 2.1 })
    expect(b.min.x).toBeCloseTo(5)
    expect(b.max.x).toBeCloseTo(6)
    expect(b.min.z).toBeCloseTo(-0.5 - DOOR_THICK / 2)
    expect(b.max.z).toBeCloseTo(-0.5 + DOOR_THICK / 2)
  })
})
```

`src/meadow/vendor.test.ts` — `it('모델 주소는 meadow/ 아래', …)` 앞에 (은지 `door.collider` 는 group 이 변환 아래에 없을 때만 은지 좌표라 테스트에서는 같아야 한다):

```ts
  it('문 4개는 MEADOW_DOORS 순서이고, doorBox 로 잰 상자가 은지 door.collider 와 같다 (group 이 변환 아래에 없을 때)', async () => {
    const { createWorld } = await import('./vendor/world.js')
    const { MEADOW_DOORS } = await import('../game/data/meadow')
    const { doorBox } = await import('../game/logic/meadowColliders')
    const w = createWorld()
    expect(w.doors.map((d) => d.label)).toEqual(MEADOW_DOORS)
    for (const d of w.doors) {
      for (const open of [false, true]) {
        d.setOpen(open, true)
        const b = doorBox({ x: d.group.position.x, z: d.group.position.z, yaw: d.base + (open ? Math.PI / 2 : 0), width: d.width, height: d.panel.geometry.parameters.height })
        for (const k of ['x', 'y', 'z'] as const) {
          expect(b.min[k]).toBeCloseTo(d.collider.min[k], 5)
          expect(b.max[k]).toBeCloseTo(d.collider.max[k], 5)
        }
      }
    }
    await Promise.allSettled([w.furnitureReady, w.outdoor.ready, w.town.ready])
  })
```

`src/meadow/meadowSingleton.test.ts` 맨 끝에:

```ts
describe('문', () => {
  it('저장된 상태로 처음엔 바로(돌아가는 중 없이), 그 뒤엔 은지처럼 돌아가며 맞춘다. 충돌 상자는 목표 자리', async () => {
    const { applyDoors, doorCuboid, meadowWorld } = await import('./meadowSingleton')
    const doors = meadowWorld().doors
    applyDoors([true, false, false, false], true)
    expect(doors[0].open).toBe(true)
    expect(doors[0].angle).toBeCloseTo(Math.PI / 2)
    applyDoors([false, false, false, false], false)
    expect(doors[0].open).toBe(false)
    // 문짝은 아직 열린 자리 (update 로 돌아간다)
    expect(doors[0].angle).toBeCloseTo(Math.PI / 2)
    for (let i = 0; i < 60; i++) doors[0].update(1 / 30)
    expect(doors[0].angle).toBeCloseTo(0)
    // 거실 문(은지 x 5, z -0.5~0.5 → 세계 x 195): 닫히면 얇은 판이 세계 z 축을 따라, 열리면 x 축을 따라
    const closed = doorCuboid(0, false)!
    const open = doorCuboid(0, true)!
    expect(closed.center[0]).toBeCloseTo(195)
    expect(closed.half[2]).toBeCloseTo(0.5)
    expect(open.half[0]).toBeCloseTo(0.5)
    expect(doorCuboid(9, true)).toBeNull()
  })
})
```

`src/game/stores/progressStore.test.ts` — 맨 끝 `describe('progressStore')` 를 닫는 `})` 앞에:

```ts
  it('문: 처음엔 모두 닫힘, 열고 닫은 상태를 저장한다. 깨진 값은 그 문만 닫힘', async () => {
    expect(store().doors).toEqual([false, false, false, false])
    store().setDoorOpen(3, true)
    store().setDoorOpen(9, true)
    expect(store().doors).toEqual([false, false, false, true])
    useProgressStore.setState({ ...INITIAL_PROGRESS })
    localStorage.setItem(SAVE_KEY, JSON.stringify({ state: { doors: [true, 'yes', true] }, version: 4 }))
    await useProgressStore.persist.rehydrate()
    expect(store().doors).toEqual([true, false, true, false])
  })
```

`src/game/logic/interaction.test.ts` — `describe('resolveKeyAction')` 를 닫는 `})` 앞에:

```ts
  it('문 앞에서 E 는 여닫기. 다른 문이면 다른 대상', () => {
    expect(resolveKeyAction('KeyE', 'explore', { kind: 'door', index: 2 })).toEqual({ type: 'toggleDoor', index: 2 })
    expect(isSameInteractable({ kind: 'door', index: 2 }, { kind: 'door', index: 3 })).toBe(false)
  })
```

- [ ] **Step 2: 실행해 실패 확인**

Run: `npx vitest run src/game/logic/meadowColliders.test.ts src/meadow/vendor.test.ts src/meadow/meadowSingleton.test.ts src/game/stores/progressStore.test.ts src/game/logic/interaction.test.ts`
Expected: FAIL — `doorBox is not a function`, `MEADOW_DOORS` 없음, `store().doors` 가 undefined, 문 E 가 `none`

- [ ] **Step 3: 문짝 상자** — `src/game/logic/meadowColliders.ts` 맨 끝에:

```ts
/** 문짝 두께 (은지 door.js BoxGeometry 0.06) */
export const DOOR_THICK = 0.06

/**
 * 은지 문짝의 축 정렬 상자 (은지 좌표). 문 그룹은 경첩 (x, z) 에 서서 y 축으로 yaw 만큼 돌아 있고, 문짝은 그룹 기준
 * x ±두께/2, y 0..높이, z 0..폭 이다. 은지 door.collider 는 세계 행렬로 재서(setFromObject) 초원 변환 그룹 아래에선 세계 좌표가 되므로 직접 잰다
 */
export function doorBox(d: { x: number; z: number; yaw: number; width: number; height: number }): BoxLike {
  const c = Math.cos(d.yaw)
  const s = Math.sin(d.yaw)
  const xs: number[] = []
  const zs: number[] = []
  for (const lx of [-DOOR_THICK / 2, DOOR_THICK / 2]) {
    for (const lz of [0, d.width]) {
      // three.js y 축 회전: x' = x cos + z sin, z' = -x sin + z cos
      xs.push(d.x + lx * c + lz * s)
      zs.push(d.z - lx * s + lz * c)
    }
  }
  return { min: { x: Math.min(...xs), y: 0, z: Math.min(...zs) }, max: { x: Math.max(...xs), y: d.height, z: Math.max(...zs) } }
}
```

`src/game/data/meadow.ts` 맨 끝에:

```ts
/** 은지 집 문 4개 (은지 world.js 가 만드는 순서). 문 상태는 저장한다 (progressStore.doors) */
export const MEADOW_DOORS = ['거실 문', '사격장 문', '주방 문', '현관문']
```

- [ ] **Step 4: 은지 문 타입** — `src/meadow/vendor/world.d.ts`

three import 를:

```ts
import type { Box3, BoxGeometry, DirectionalLight, Group, HemisphereLight, Light, Mesh, Object3D, Vector3 } from 'three'
```

`export type EunjiDoor = { setOpen(open: boolean, instant?: boolean): void; collider: Box3 }` 를:

```ts
/** 은지 문. group 은 경첩 자리에 서서 rotation.y = base + angle. 문짝 상자는 logic/meadowColliders.doorBox 로 은지 좌표에서 잰다 */
export type EunjiDoor = {
  group: Group
  panel: Mesh<BoxGeometry>
  base: number
  angle: number
  width: number
  open: boolean
  label: string
  /** 상호작용 기준점 (문 가운데) */
  center: Vector3
  /** 은지가 세계 행렬로 잰 상자. 초원에선 세계 좌표라 쓰지 않는다 (테스트에서 doorBox 와 비교만) */
  collider: Box3
  setOpen(open: boolean, instant?: boolean): void
  /** 열리고 닫히는 애니메이션 (매 프레임) */
  update(dt: number): void
}
```

`EunjiWorld` 의 `group: Group` 다음에:

```ts
  /** 움직이지 않는 충돌 상자 (문 빼고, 은지 좌표) */
  colliders: Box3[]
```

- [ ] **Step 5: 문 저장** — `src/game/stores/progressStore.ts`

import 에 `import { MEADOW_DOORS } from '../data/meadow'` (`meadowItems` import 앞). `ProgressData` 의 `items` 다음에:

```ts
  /** 은지 집 문이 열려 있나 (MEADOW_DOORS 순서). 처음엔 모두 닫힘 (은지 그대로) */
  doors: boolean[]
```

`ProgressActions` 의 `startRecipe` 다음에 `setDoorOpen: (index: number, open: boolean) => void`, `INITIAL_PROGRESS` 의 `items: NO_ITEMS,` 다음에 `doors: MEADOW_DOORS.map(() => false),`. `readItems` 다음에:

```ts
function readDoors(v: unknown, fallback: boolean[]): boolean[] {
  return fallback.map((open, i) => (Array.isArray(v) && typeof v[i] === 'boolean' ? (v[i] as boolean) : open))
}
```

액션 `unlockZone` 앞에 (범위 밖 번호는 무시):

```ts
      setDoorOpen: (index, open) => set((s) => (index >= 0 && index < s.doors.length ? { doors: s.doors.map((o, i) => (i === index ? open : o)) } : {})),
```

persist 주석을 `4: 은지 가방(items)·문(doors) 추가` 로 고치고(버전은 4 그대로), `merge` 의 `items: …` 다음에 `doors: readDoors(saved.doors, current.doors),`.

- [ ] **Step 6: 은지 맵 문** — `src/meadow/meadowSingleton.ts`

import 에 `import { boxesToCuboids, doorBox, type Cuboid } from '../game/logic/meadowColliders'` (`meadowInteract` import 앞). `meadowWorld` 주석의 `문은 3-2 전까지 열어 둔다.` 를 `문은 닫힌 채로 만들어지고 MeadowDoors 가 저장된 상태로 맞춘다.` 로 바꾸고, `world = createWorld()` 다음 줄 `for (const d of world.doors) d.setOpen(true, true)` 를 지운다. `meadowSpots` 주석을 `가스레인지·문·버섯·호박` 으로, 목록의 가스레인지 줄 다음에:

```ts
      ...w.doors.map((d, index): MeadowSpot => ({ target: { kind: 'door', index }, x: d.center.x, z: d.center.z, reach: MEADOW_REACH.door })),
```

파일 맨 끝에:

```ts
/** 문 하나의 Rapier 상자 (세계 좌표). 문짝이 다 돌아간 뒤(열림 90°·닫힘 0°) 자리로 잰다 */
export function doorCuboid(index: number, open: boolean): Cuboid | null {
  const d = meadowWorld().doors[index]
  if (!d) return null
  const box = doorBox({ x: d.group.position.x, z: d.group.position.z, yaw: d.base + (open ? Math.PI / 2 : 0), width: d.width, height: d.panel.geometry.parameters.height })
  return boxesToCuboids([box])[0] ?? null
}

/** 저장된 문 상태로 맞춘다. instant 면 애니메이션 없이 바로 (처음 붙일 때) */
export function applyDoors(opens: readonly boolean[], instant: boolean) {
  meadowWorld().doors.forEach((d, i) => {
    const open = opens[i] === true
    if (d.open !== open) d.setOpen(open, instant)
  })
}
```

- [ ] **Step 7: 문 충돌체와 애니메이션** — `src/meadow/MeadowDoors.tsx`

```tsx
import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { clampDelta } from '../game/logic/time'
import { useProgressStore } from '../game/stores/progressStore'
import { applyDoors, doorCuboid, meadowWorld } from './meadowSingleton'

/**
 * 은지 집 문 4개: 저장된 상태로 맞추고(처음엔 바로, 그 뒤엔 은지처럼 돌아가며), 문짝마다 Rapier 상자를 둔다.
 * 상자는 누르는 순간 다 돌아간 자리로 바뀐다 (key 를 바꿔 새로 만든다). 문짝은 0.5초쯤 돌아간다
 */
export function MeadowDoors() {
  const doors = useProgressStore((s) => s.doors)
  const first = useRef(true)
  useEffect(() => {
    applyDoors(doors, first.current)
    first.current = false
  }, [doors])
  useFrame((_, delta) => {
    const dt = clampDelta(delta)
    for (const d of meadowWorld().doors) d.update(dt)
  })
  return (
    <RigidBody type="fixed" colliders={false}>
      {doors.map((open, i) => {
        const c = doorCuboid(i, open)
        return c && <CuboidCollider key={`${i}:${open}`} args={c.half} position={c.center} />
      })}
    </RigidBody>
  )
}
```

`src/meadow/MeadowWorld.tsx` — import 에 `import { MeadowDoors } from './MeadowDoors'`, 주석을 `/** 초원(은지 맵). 바닥은 바로, 은지 모델·충돌체·문은 모델이 다 들어온 뒤에 붙인다 */` 로. 정적 상자에서 문을 뺀다:

```tsx
      // 아직 장면에 붙이기 전이라 상자가 모두 은지 좌표다. 문은 MeadowDoors 가 따로 (여닫을 때 바뀐다)
      if (alive) setCuboids(boxesToCuboids(world.colliders))
```

`cuboids` 가 있을 때 그리는 `<RigidBody …>…</RigidBody>` 다음 줄(같은 `<>` 안)에 `<MeadowDoors />`.

- [ ] **Step 8: 문 E** 

`src/game/logic/interaction.ts` — `Interactable` 의 `stove` 다음에:

```ts
  /** 은지 집 문 (index: MEADOW_DOORS 순서) */
  | { kind: 'door'; index: number }
```

`isSameInteractable` 의 `pickup` 줄 다음에:

```ts
  if (a.kind === 'door' && b.kind === 'door') return a.index === b.index
```

`KeyAction` 의 `harvest` 다음에:

```ts
  /** 문 열기/닫기 */
  | { type: 'toggleDoor'; index: number }
```

E 의 `switch` 에서 `case 'stove':` 앞에:

```ts
      case 'door':
        return { type: 'toggleDoor', index: nearby.index }
```

`src/game/ui/interactLabel.ts` — import 에 `import { MEADOW_DOORS } from '../data/meadow'`, `LABEL` 의 `Exclude` 에 `| 'door'`, `interactLabel` 의 `pickup` 줄 앞에:

```ts
  if (target.kind === 'door') return `🚪 ${MEADOW_DOORS[target.index] ?? '문'} 여닫기`
```

`src/meadow/meadowActions.ts` 맨 끝에:

```ts
/** 문 여닫기 (상태는 저장되고, MeadowDoors 가 문짝을 돌리고 충돌 상자를 바꾼다) */
export function toggleDoor(index: number) {
  const progress = useProgressStore.getState()
  progress.setDoorOpen(index, !progress.doors[index])
}
```

`src/game/input/useInteractionKeys.ts` — import 를 `import { harvest, toggleDoor } from '../../meadow/meadowActions'` 로, `case 'harvest':` 앞에:

```ts
    case 'toggleDoor':
      toggleDoor(action.index)
      break
```

- [ ] **Step 9: 실행해 통과 확인**

Run: `npx vitest run && npx tsc -b && npm run lint 2>&1 | grep -c warning`
Expected: 65 파일 / 659 개 PASS, tsc 출력 없음, 경고 `6`

- [ ] **Step 10: 커밋**

```bash
git add src/meadow/MeadowDoors.tsx src/game/logic/meadowColliders.ts src/game/logic/meadowColliders.test.ts src/game/data/meadow.ts src/meadow/vendor/world.d.ts src/meadow/vendor.test.ts src/game/stores/progressStore.ts src/game/stores/progressStore.test.ts src/meadow/meadowSingleton.ts src/meadow/meadowSingleton.test.ts src/meadow/MeadowWorld.tsx src/game/logic/interaction.ts src/game/logic/interaction.test.ts src/game/ui/interactLabel.ts src/meadow/meadowActions.ts src/game/input/useInteractionKeys.ts
git commit -m "feat: 은지 집 문 여닫기" -m "문 4개를 E 로 여닫는다. 처음엔 닫혀 있고(은지 그대로) 상태는 저장 v4 의 doors 에 남는다.
은지 door.collider 는 세계 행렬로 재서 초원 변환 아래에선 세계 좌표가 되므로, 문짝 상자를 은지 좌표에서 직접 재(doorBox) Rapier 상자로 바꾼다.
상자는 누르는 순간 목표 자리로 바뀌고, 문짝은 은지처럼 돌아간다. 다시 들어오면 저장된 상태로 바로 맞춘다."
```

---
### Task 8: 마을 상인 3곳 (사람 모습·사고팔기)

**Files:**
- Create: `src/game/ui/VendorPanel.tsx`, `src/meadow/MeadowVendors.tsx`
- Modify: `src/game/data/meadow.ts` (`MEADOW_VENDORS`), `src/meadow/vendor/town.d.ts` (`VENDORS`·`VENDOR_DIST`)
- Modify: `src/game/logic/interaction.ts` (모드 `vendor`, 대상 `vendor`, `openVendor`), `src/game/ui/interactLabel.ts`, `src/game/stores/sessionStore.ts` (`vendor`·`openVendor`), `src/game/input/useInteractionKeys.ts`
- Modify: `src/game/stores/progressStore.ts` (`sellItem`·`buyItem`), `src/meadow/meadowSingleton.ts` (상인 E 대상)
- Modify: `src/game/ui/Panels.tsx` (`vendor`), `src/game/scene/World.tsx` (`<MeadowVendors />`)
- Test: `src/meadow/vendor.test.ts`, `src/game/logic/interaction.test.ts`, `src/game/stores/progressStore.test.ts`

**Interfaces:**
- Consumes: Task 1 의 `VendorId`·`VENDOR_TRADE`·`BUY_PRICE`·`sellPrice`·`sellToVendor`·`buyFromVendor`, Task 6 의 `meadowSpots`·`MEADOW_REACH.vendor`, `LOOK_PRESETS`·`DEFAULT_LOOK`, `PlayerModel` (`update(delta, now, fishing, action, speed, rodAngle, resting)`), `IDLE_ACTION`, `affordableQty` (`logic/bait.ts`), `QtyStepper`·`useFlash`
- Produces:
  - `MEADOW_VENDORS: { id: VendorId; name; greet; at: [x, z]; npc: [x, z]; look: string }[]` (은지 좌표, `data/meadow.ts`)
  - `Mode` 에 `'vendor'`, `Interactable` 에 `{ kind: 'vendor'; id: VendorId }`, `KeyAction` 에 `{ type: 'openVendor'; id: VendorId }`
  - sessionStore: `vendor: VendorId | null`, `openVendor(id)` (mode 도 `vendor` 로)
  - progressStore: `sellItem(vendor, id, qty): number` (받은 코인, 못 팔면 0), `buyItem(vendor, id, qty): boolean`
  - `<VendorPanel />`, `<MeadowVendors />`

- [ ] **Step 1: 실패하는 테스트 쓰기**

`src/meadow/vendor.test.ts` — `it('모델 주소는 meadow/ 아래', …)` 앞에:

```ts
  it('상인 3곳 자리·이름·E 거리가 은지 town.js 와 같다', async () => {
    const { VENDORS, VENDOR_DIST } = await import('./vendor/town.js')
    const { MEADOW_VENDORS } = await import('../game/data/meadow')
    const { MEADOW_REACH } = await import('../game/logic/meadowInteract')
    expect(MEADOW_VENDORS.map((v) => [v.id, v.name, ...v.at])).toEqual(VENDORS.map((v) => [v.id, v.name, v.x, v.z]))
    expect(MEADOW_REACH.vendor).toBe(VENDOR_DIST)
  })
```

`src/game/logic/interaction.test.ts` — `describe('resolveKeyAction')` 를 닫는 `})` 앞에:

```ts
  it('상인 앞에서 E 는 사고팔기 창. 다른 상인이면 다른 대상', () => {
    expect(resolveKeyAction('KeyE', 'explore', { kind: 'vendor', id: 'grocer' })).toEqual({ type: 'openVendor', id: 'grocer' })
    expect(isSameInteractable({ kind: 'vendor', id: 'grocer' }, { kind: 'vendor', id: 'butcher' })).toBe(false)
    expect(resolveKeyAction('Escape', 'vendor', null)).toEqual({ type: 'closePanel' })
  })
```

`src/game/stores/progressStore.test.ts` — 맨 끝 `describe('progressStore')` 를 닫는 `})` 앞에:

```ts
  it('마을 상인: 팔면 코인이 오르고 가방에서 빠진다. 사면 반대. 안 되면 그대로', () => {
    useProgressStore.setState({ coins: 10, items: { ...NO_ITEMS, beef: 2 } })
    expect(store().sellItem('butcher', 'beef', 2)).toBe(24)
    expect(store().coins).toBe(34)
    expect(store().items.beef).toBe(0)
    expect(store().sellItem('butcher', 'beef', 1)).toBe(0)
    expect(store().buyItem('grocer', 'mushroom', 2)).toBe(true)
    expect([store().coins, store().items.mushroom]).toEqual([18, 2])
    expect(store().buyItem('grocer', 'pumpkin', 2)).toBe(false)
    expect(store().coins).toBe(18)
  })
```

- [ ] **Step 2: 실행해 실패 확인**

Run: `npx vitest run src/meadow/vendor.test.ts src/game/logic/interaction.test.ts src/game/stores/progressStore.test.ts`
Expected: FAIL — `MEADOW_VENDORS` 가 없고, 상인 E 가 `none`, `store().sellItem is not a function`

- [ ] **Step 3: 상인 자리** — `src/game/data/meadow.ts`

import 에 `import type { VendorId } from './meadowPrices'` (`zones` import 앞), 맨 끝에:

```ts
/**
 * 마을 상인 3곳 (은지 town.js VENDORS). at: 노점 가운데 (은지 좌표, E 거리는 여기서 2.8m), npc: 노점 뒤 상인이 서는 자리 (은지 좌표).
 * 상인 모습은 은지 모델(21MB) 대신 낚시섬 캐릭터 프리셋 (LOOK_PRESETS id). 분수(은지 z 2) 쪽을 본다
 */
export const MEADOW_VENDORS: { id: VendorId; name: string; greet: string; at: [number, number]; npc: [number, number]; look: string }[] = [
  { id: 'butcher', name: '정육점', greet: '고기와 요리를 삽니다', at: [46, 11.5], npc: [46, 12.4], look: 'grandpa' },
  { id: 'general', name: '잡화점', greet: '뼈·비계를 삽니다 · 탄약은 곧 들어와요', at: [52, 11.5], npc: [52, 12.4], look: 'lady' },
  { id: 'grocer', name: '농산물 가게', greet: '달걀·호박·버섯을 사고팝니다', at: [58, 11.5], npc: [58, 12.4], look: 'rangerMale' },
]
```

`src/meadow/vendor/town.d.ts` 맨 끝에:

```ts
/** 노점 상인 (우리는 data/meadow MEADOW_VENDORS 로 옮겨 쓴다. 같은지 테스트에서만 비교) */
export const VENDORS: { id: string; name: string; x: number; z: number }[]
export const VENDOR_DIST: number
```

- [ ] **Step 4: 모드·대상·키** — `src/game/logic/interaction.ts`

import 에 `import type { VendorId } from '../data/meadowPrices'` (tools import 앞). `Mode` 주석의 `emote …, bag = …` 줄을 아래 두 줄로 바꾸고 union 의 `| 'bag'` 다음에 `| 'vendor'`:

```ts
 * emote = T 를 누르고 있는 동안 감정 표현 바퀴 (이동·E 막힘, 떼면 고른 것을 한다. ui/EmoteWheel), bag = 가방 (I, 가스레인지에선 요리법),
 * vendor = 마을 상인 사고팔기 (어느 상인인지는 sessionStore.vendor)
```

`Interactable` 의 `door` 다음에:

```ts
  /** 마을 상인 */
  | { kind: 'vendor'; id: VendorId }
```

`isSameInteractable` 의 `door` 줄 다음에:

```ts
  if (a.kind === 'vendor' && b.kind === 'vendor') return a.id === b.id
```

`KeyAction` 의 `toggleDoor` 다음에:

```ts
  /** 상인 사고팔기 창 */
  | { type: 'openVendor'; id: VendorId }
```

E 의 `switch` 에서 `case 'door':` 다음에:

```ts
      case 'vendor':
        return { type: 'openVendor', id: nearby.id }
```

`src/game/ui/interactLabel.ts` — import 를 `import { MEADOW_DOORS, MEADOW_VENDORS } from '../data/meadow'` 로, `LABEL` 의 `Exclude` 에 `| 'vendor'`, `interactLabel` 의 `door` 줄 앞에:

```ts
  if (target.kind === 'vendor') {
    const v = MEADOW_VENDORS.find((x) => x.id === target.id)
    return `🛒 ${v?.name} — ${v?.greet}`
  }
```

`src/game/stores/sessionStore.ts` — import 에 `import type { VendorId } from '../data/meadowPrices'` (meadowItems import 다음), `SessionState` 의 `/** 손에 든 도구 … */` 앞에:

```ts
  /** 사고팔기 창을 연 마을 상인 (mode 'vendor') */
  vendor: VendorId | null
  openVendor: (id: VendorId) => void
```

본문 `stoveCook: null,` 앞에:

```ts
  vendor: null,
  openVendor: (vendor) => set({ vendor, mode: 'vendor' }),
```

`resetSession` 객체 끝에 `vendor: null` (`… stoveCook: null, vendor: null })`).

`src/game/input/useInteractionKeys.ts` — `case 'toggleDoor':` 앞에:

```ts
    case 'openVendor':
      session.openVendor(action.id)
      break
```

- [ ] **Step 5: 사고팔기 저장** — `src/game/stores/progressStore.ts`

import 에 (inventory import 다음):

```ts
import { buyFromVendor, sellToVendor } from '../logic/meadowShop'
import type { VendorId } from '../data/meadowPrices'
```

`ProgressActions` 의 `setDoorOpen` 다음에:

```ts
  /** 마을 상인에게 qty 개 판다. 받은 코인 (못 팔면 0) */
  sellItem: (vendor: VendorId, id: ItemId, qty: number) => number
  /** 마을 상인에게서 qty 개 산다. 코인이 모자라거나 안 파는 물건이면 false */
  buyItem: (vendor: VendorId, id: ItemId, qty: number) => boolean
```

액션 `setDoorOpen: (index, open) =>` 앞에:

```ts
      sellItem: (vendor, id, qty) => {
        const s = get()
        const r = sellToVendor(s.coins, s.items, vendor, id, qty)
        if (!r.ok) return 0
        set({ coins: r.coins, items: r.items })
        return r.coins - s.coins
      },

      buyItem: (vendor, id, qty) => {
        const s = get()
        const r = buyFromVendor(s.coins, s.items, vendor, id, qty)
        if (r.ok) set({ coins: r.coins, items: r.items })
        return r.ok
      },
```

- [ ] **Step 6: 상인 E 대상** — `src/meadow/meadowSingleton.ts`

import 에 `import { MEADOW_VENDORS } from '../game/data/meadow'` (맨 위 three import 다음), `meadowSpots` 주석을 `가스레인지·문·상인·버섯·호박` 으로, 목록의 문 줄 다음에:

```ts
      ...MEADOW_VENDORS.map((v): MeadowSpot => ({ target: { kind: 'vendor', id: v.id }, x: v.at[0], z: v.at[1], reach: MEADOW_REACH.vendor })),
```

- [ ] **Step 7: 상인 키오스크** — `src/game/ui/VendorPanel.tsx`

```tsx
import { useState } from 'react'
import { MEADOW_VENDORS } from '../data/meadow'
import { ITEMS, ITEM_IDS, type ItemId } from '../data/meadowItems'
import { BUY_PRICE, VENDOR_TRADE, sellPrice, type VendorId } from '../data/meadowPrices'
import { affordableQty } from '../logic/bait'
import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'
import { BigButton, Kiosk, KioskDetail, QtyStepper } from './Kiosk'
import { useFlash } from './useFlash'

type Tab = 'sell' | 'buy'
/** 한 번에 사는 최대 수 */
const BUY_MAX = 10

function Emoji({ id, size }: { id: ItemId; size: number }) {
  return <span style={{ fontSize: size * 0.8, lineHeight: 1 }}>{ITEMS[id].icon}</span>
}

/**
 * 마을 상인 (정육점·잡화점·농산물 가게) 키오스크: 왼쪽 탭 "팔기" (내 가방에서 이 상인이 사는 것), 오른쪽 탭 "사기" (이 상인이 파는 것).
 * 누가 무엇을 사고파는지와 값은 data/meadowPrices
 */
export function VendorPanel() {
  const vendorId = useSessionStore((s) => s.vendor)
  const coins = useProgressStore((s) => s.coins)
  const [tab, setTab] = useState<Tab>('sell')
  const vendor = MEADOW_VENDORS.find((v) => v.id === vendorId)
  if (!vendor) return null
  const frame = {
    title: `🛒 ${vendor.name}`,
    subtitle: vendor.greet,
    accent: '#6d8b3a',
    coins,
    tabs: [
      { id: 'sell', label: '팔기' },
      { id: 'buy', label: '사기' },
    ],
    tab,
    onTab: (id: string) => setTab(id as Tab),
  }
  return tab === 'sell' ? <SellTab key={vendor.id} frame={frame} vendor={vendor.id} /> : <BuyTab key={vendor.id} frame={frame} vendor={vendor.id} />
}

type Frame = Pick<Parameters<typeof Kiosk>[0], 'title' | 'subtitle' | 'accent' | 'coins' | 'tabs' | 'tab' | 'onTab'>

function SellTab({ frame, vendor }: { frame: Frame; vendor: VendorId }) {
  const items = useProgressStore((s) => s.items)
  const rows = ITEM_IDS.filter((id) => items[id] > 0 && VENDOR_TRADE[vendor].buys(id))
  const [selected, setSelected] = useState<ItemId | null>(null)
  const [qty, setQty] = useState(1)
  const [toast, flash] = useFlash()
  const id = rows.find((r) => r === selected) ?? rows[0]
  const have = id ? items[id] : 0
  const n = Math.max(1, Math.min(qty, have))
  return (
    <Kiosk
      {...frame}
      cards={rows.map((r) => ({ id: r, name: ITEMS[r].name, image: <Emoji id={r} size={56} />, badge: `×${items[r]}`, price: `${sellPrice(r)} 코인` }))}
      selectedId={id ?? null}
      onSelect={(r) => {
        setSelected(r as ItemId)
        setQty(1)
      }}
      empty="이 가게에 팔 물건이 가방에 없어요"
      detail={
        id && (
          <KioskDetail image={<Emoji id={id} size={96} />} title={ITEMS[id].name} lines={[ITEMS[id].desc, `1개 ${sellPrice(id)} 코인 · 가방에 ${have}개`]}>
            <QtyStepper value={n} max={have} onChange={setQty} />
            <BigButton
              tone="sell"
              label={`${n}개 팔기`}
              sub={`+${sellPrice(id) * n} 코인`}
              onClick={() => {
                const earned = useProgressStore.getState().sellItem(vendor, id, n)
                if (earned > 0) flash(`${ITEMS[id].name} ${n}개를 팔았어요! +${earned} 코인`)
                setQty(1)
              }}
            />
          </KioskDetail>
        )
      }
      toast={toast}
    />
  )
}

function BuyTab({ frame, vendor }: { frame: Frame; vendor: VendorId }) {
  const { coins } = frame
  const items = useProgressStore((s) => s.items)
  const sells = VENDOR_TRADE[vendor].sells
  const [selected, setSelected] = useState<ItemId | null>(null)
  const [qty, setQty] = useState(1)
  const [toast, flash] = useFlash()
  const id = sells.find((r) => r === selected) ?? sells[0]
  const price = id ? (BUY_PRICE[id] ?? 0) : 0
  const max = Math.max(1, affordableQty(coins, price, BUY_MAX))
  const n = Math.min(qty, max)
  return (
    <Kiosk
      {...frame}
      cards={sells.map((r) => ({ id: r, name: ITEMS[r].name, image: <Emoji id={r} size={56} />, price: `${BUY_PRICE[r]} 코인`, badge: items[r] > 0 ? `가방 ${items[r]}` : undefined, dimmed: coins < (BUY_PRICE[r] ?? 0) }))}
      selectedId={id ?? null}
      onSelect={(r) => {
        setSelected(r as ItemId)
        setQty(1)
      }}
      empty={vendor === 'general' ? '탄약은 곧 들어와요' : '이 가게는 파는 물건이 없어요'}
      detail={
        id && (
          <KioskDetail image={<Emoji id={id} size={96} />} title={ITEMS[id].name} lines={[ITEMS[id].desc, `1개 ${price} 코인 · 가방에 ${items[id]}개`]}>
            <QtyStepper value={n} max={max} onChange={setQty} />
            <BigButton
              label={`${n}개 사기`}
              sub={coins >= price * n ? `${price * n} 코인` : '코인이 모자라요'}
              disabled={coins < price * n}
              onClick={() => {
                if (useProgressStore.getState().buyItem(vendor, id, n)) flash(`${ITEMS[id].name} ${n}개를 샀어요!`)
                setQty(1)
              }}
            />
          </KioskDetail>
        )
      }
      toast={toast}
    />
  )
}
```

`src/game/ui/Panels.tsx` — import 에 `import { VendorPanel } from './VendorPanel'` (`UnlockPanel` 다음), `case 'bag':` 다음에:

```tsx
    case 'vendor':
      return <VendorPanel />
```

- [ ] **Step 8: 상인 사람 모습** — `src/meadow/MeadowVendors.tsx`

```tsx
import { useRef } from 'react'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { DEFAULT_LOOK, LOOK_PRESETS } from '../game/data/characterParts'
import { MEADOW_VENDORS, toWorld } from '../game/data/meadow'
import { IDLE_ACTION } from '../game/logic/playerMotion'
import { PlayerModel, type PlayerModelHandle } from '../game/scene/PlayerModel'
import { useSessionStore } from '../game/stores/sessionStore'

/** 상인 팔 각도 (낚싯대 기본 자세와 같은 값. 들고 있는 건 없다) */
const ARM_REST = 0.5

/** 상인 한 명: 노점 뒤에 서서 분수 쪽(세계 +z)을 보고 숨 쉬는 자세. 가게 앞에 오면 이름표 */
function Vendor({ vendor }: { vendor: (typeof MEADOW_VENDORS)[number] }) {
  const model = useRef<PlayerModelHandle>(null)
  const look = LOOK_PRESETS.find((p) => p.id === vendor.look)?.look ?? DEFAULT_LOOK
  const near = useSessionStore((s) => s.nearby?.kind === 'vendor' && s.nearby.id === vendor.id)
  const [x, z] = toWorld(...vendor.npc)
  useFrame(({ clock }, delta) => model.current?.update(delta, clock.elapsedTime, null, IDLE_ACTION, 0, ARM_REST, false))
  return (
    <group position={[x, 0, z]}>
      <PlayerModel ref={model} look={look} />
      {near && (
        <Html center position={[0, 2.1, 0]} zIndexRange={[100, 0]} style={nameTag}>
          {vendor.name}
        </Html>
      )}
    </group>
  )
}

/** 마을 상인 3명 (은지 상인 모델 대신 낚시섬 캐릭터 프리셋) */
export function MeadowVendors() {
  return (
    <>
      {MEADOW_VENDORS.map((v) => (
        <Vendor key={v.id} vendor={v} />
      ))}
    </>
  )
}

const nameTag = {
  pointerEvents: 'none' as const,
  whiteSpace: 'nowrap' as const,
  background: 'rgba(255,255,255,0.9)',
  color: '#33691e',
  padding: '2px 8px',
  borderRadius: 10,
  fontSize: 12,
  fontWeight: 800,
}
```

`src/game/scene/World.tsx` — `import { MeadowVendors } from '../../meadow/MeadowVendors'` 를 더하고 JSX `<MeadowInteractions />` 다음 줄에 `<MeadowVendors />`.

- [ ] **Step 9: 실행해 통과 확인**

Run: `npx vitest run && npx tsc -b && npm run lint 2>&1 | grep -c warning && npm run build`
Expected: 65 파일 / 662 개 PASS, tsc 출력 없음, 경고 `6`, build 성공 (청크 크기 경고만)

- [ ] **Step 10: 커밋**

```bash
git add src/game/ui/VendorPanel.tsx src/meadow/MeadowVendors.tsx src/game/data/meadow.ts src/meadow/vendor/town.d.ts src/meadow/vendor.test.ts src/game/logic/interaction.ts src/game/logic/interaction.test.ts src/game/ui/interactLabel.ts src/game/stores/sessionStore.ts src/game/input/useInteractionKeys.ts src/game/stores/progressStore.ts src/game/stores/progressStore.test.ts src/meadow/meadowSingleton.ts src/game/ui/Panels.tsx src/game/scene/World.tsx
git commit -m "feat: 마을 상인 3곳" -m "정육점·잡화점·농산물 가게 노점 뒤에 낚시섬 캐릭터 프리셋으로 상인을 세우고, 2.8m 안에서 E 를 누르면 팔기·사기 키오스크가 열린다.
누가 무엇을 사고파는지는 은지 VENDORS 그대로이고 값은 코인(meadowPrices.ts). 잡화점 탄약은 3-4 에서 연다.
상인 자리·이름·E 거리가 은지 town.js 와 같은지 테스트로 지킨다."
```

---
### Task 9: 헤드리스 점검과 마무리 (사용자 확인 단계 포함)

**Files:**
- Modify: `tools/meadow-check.mjs` (점검 18~27)
- Modify: 필요하면 `docs/superpowers/specs/2026-11-18-eunji-features-design.md` (구현하며 정한 것: 아이템 25종, 폰 가방 버튼 자리, 문 처음 닫힘)

**Interfaces:**
- Consumes: Task 1~8 전부. 점검은 개발 서버 모듈을 `__mod` 로 불러 상태를 바꾸고 읽는다: `useSessionStore`(`mode`·`tool`·`vendor`·`playerAction`), `useProgressStore`(`items`·`doors`·`coins`·`addItem`), `meadowWorld` (`/src/meadow/meadowSingleton.ts`: `outdoor.pickups`·`stove`), `useTouchUiStore` (`/src/game/input/touchDevice.ts`), `remoteRig`, `playerRig`
- Produces: 없음

- [ ] **Step 1: 점검 추가** — `tools/meadow-check.mjs` 의 `check(!consoleErrors.some((e) => /shader|WebGLProgram/i.test(e)), '셰이더 컴파일 오류가 없다')` 바로 앞(3-1 의 17 다음)에 넣는다. `open`·`teleport`·`pos`·`walk`·`keyToward`·`turnTo` 는 위에 이미 있다. 새 브라우저(9739)를 따로 열어 앞 점검의 상태(도구·가방·문)와 섞이지 않게 하고, 같이 하기는 9740·9741:

```js
// ── 3-2 도구 칸·가방·요리·상인 (18~27) ──
const M = await open(9739, 0)
await M.evaluate(`__click('혼자 하기')`)
await wait(3000)
const S = `(await __mod('/src/game/stores/sessionStore.ts')).useSessionStore.getState()`
const P = `(await __mod('/src/game/stores/progressStore.ts')).useProgressStore.getState()`
const W = `(await __mod('/src/meadow/meadowSingleton.ts')).meadowWorld()`
const sess = (expr) => M.evaluate(`(async () => { const s = ${S}; return ${expr} })()`)
const prog = (expr) => M.evaluate(`(async () => { const p = ${P}; return ${expr} })()`)
const press = async (code, k = code) => { await M.key('keydown', code, k); await M.key('keyup', code, k); await wait(300) }
// 처음 떨어지는 중엔 감정 표현을 받지 않으니 땅에 설 때까지 기다린다
await wait(2000)

// 18) T 를 누르고 있으면 감정 표현 바퀴, 숫자로 고르면 바로 한다
await M.key('keydown', 'KeyT', 't')
await wait(300)
check((await sess('s.mode')) === 'emote' && (await M.evaluate(`!!document.querySelector('[aria-label="감정 표현 바퀴"]')`)), '18) T 를 누르고 있으면 감정 표현 바퀴')
await M.shot('18-wheel')
await M.key('keydown', 'Digit1', '1')
await M.key('keyup', 'Digit1', '1')
check(await M.until(`(async () => { const s = ${S}; return s.mode === 'explore' && s.playerAction.emote === 'dance' })()`, 3000), `18) 바퀴에서 1 → 춤 (${await sess('[s.mode, s.playerAction.emote].join()')})`)
await M.key('keyup', 'KeyT', 't')
// 마우스 방향으로 고르고 떼면 한다 (잠금 없이: 화면 가운데에서 커서 쪽)
await M.key('keydown', 'KeyT', 't')
await M.evaluate(`window.dispatchEvent(new PointerEvent('pointermove', { clientX: innerWidth / 2 + 110, clientY: innerHeight / 2 - 35 })), true`)
await wait(200)
await M.shot('18-wheel-aim')
await M.key('keyup', 'KeyT', 't')
check(await M.until(`(async () => ${S}.playerAction.emote === 'chat')()`, 3000), `18) 오른쪽 위를 가리키고 떼면 수다 (${await sess('s.playerAction.emote')})`)
await press('Digit2', '2')
check((await sess('[s.playerAction.emote, s.tool].join()')) === 'chat,fists', `18) 탐험 중 숫자 키는 도구 칸이지 감정 표현이 아니다 (${await sess('[s.playerAction.emote, s.tool].join()')})`)
// 바퀴를 연 채 창 밖으로 포커스가 나가면(떼는 키를 못 받는다) 아무것도 하지 않고 닫힌다. ESC 도 닫기만
await M.key('keydown', 'KeyT', 't')
await wait(200)
await M.evaluate(`window.dispatchEvent(new Event('blur')), true`)
await wait(200)
check((await sess('s.mode')) === 'explore', '18) 바퀴를 연 채 포커스를 잃으면 닫힌다')
await M.key('keyup', 'KeyT', 't')
await M.key('keydown', 'KeyT', 't')
await wait(200)
await press('Escape')
check((await sess('s.mode')) === 'explore', '18) 바퀴에서 ESC 는 닫기만 (메뉴를 열지 않는다)')
await M.key('keyup', 'KeyT', 't')

// 19) Tab 으로 큰 지도 열고 닫기
await press('Tab')
check((await sess('s.mode')) === 'map', '19) Tab 으로 큰 지도')
await press('Tab')
check((await sess('s.mode')) === 'explore', '19) 다시 Tab 으로 닫기')

// 20) 도구 칸: 1 낚싯대 · 2 주먹 · 3 칼 · X 넣기
check(await M.evaluate(`!!document.querySelector('[aria-label="도구 칸"]')`), '20) 도구 칸이 보인다')
const rig = `(async () => { const { playerRig } = await __mod('/src/game/scene/Player.tsx'); return playerRig.rodShown })()`
await press('Digit3', '3')
await wait(300)
check((await sess('s.tool')) === 'knife' && !(await M.evaluate(rig)), '20) 3 → 칼, 낚싯대는 숨긴다')
await M.evaluate(`(async () => { ${S}.zoomBy(-3000); return true })()`)
await wait(800)
await M.shot('20-knife')
await M.evaluate(`(async () => { ${S}.zoomBy(600); return true })()`)
await press('KeyX', 'x')
check((await sess('s.tool')) === null, '20) X → 빈손')
await press('Digit1', '1')
check((await sess('s.tool')) === 'rod', '20) 1 → 낚싯대')
// 물가에서 E 를 누르면 저절로 낚싯대
await press('Digit2', '2')
await M.evaluate(teleport(0, 27))
check(await M.until(`document.body.innerText.includes('낚시하기')`, 6000), '20) 섬 선착장 끝 낚시 안내')
await press('KeyE', 'e')
check((await sess('[s.mode, s.tool].join()')) === 'fishing,rod', `20) 주먹을 든 채 E → 낚싯대로 낚시 (${await sess('[s.mode, s.tool].join()')})`)
await press('Escape')

// 21) 가방·먹기
await press('KeyF', 'f')
check(await M.until(`document.body.innerText.includes('먹을 음식이 없어요')`, 3000), '21) 먹을 게 없으면 F 는 알림만')
await prog(`(p.addItem('steak', 1), p.addItem('mushroom', 2), true)`)
await press('KeyI', 'i')
check((await sess('s.mode')) === 'bag' && (await M.evaluate(`document.body.innerText.includes('스테이크')`)), '21) I → 가방에 스테이크')
await M.shot('21-bag')
await M.evaluate(`__click('요리법')`)
await wait(300)
await M.shot('21-recipes')
await press('KeyI', 'i')
check((await sess('s.mode')) === 'explore', '21) I 로 닫기')
const h0 = await prog('p.survival.hunger')
await press('KeyF', 'f')
await wait(400)
check((await prog('p.items.steak')) === 0 && (await sess('s.playerAction.eat')) === 'steak', `21) F → 스테이크를 먹는다 (배고픔 ${h0.toFixed(0)} → ${(await prog('p.survival.hunger')).toFixed(0)})`)
await M.evaluate(`(async () => { ${S}.zoomBy(-3000); return true })()`)
await wait(500)
await M.shot('21-eating')


// 22) 텃밭 호박 따기: 은지 (6.5, -15.2) → 세계 (193.5, 15.2)
check(await M.until(`(async () => ${W}.outdoor.pickups.length >= 20)()`, 30000), `22) 버섯·호박이 놓였다 (${await M.evaluate(`(async () => ${W}.outdoor.pickups.length)()`)}개)`)
await M.evaluate(teleport(193.5, 14.2))
check(await M.until(`document.body.innerText.includes('호박 따기')`, 6000), '22) 호박 앞에서 "호박 따기" 안내')
await M.shot('22-pumpkin')
await press('KeyE', 'e')
check((await prog('p.items.pumpkin')) === 1, '22) E → 가방에 호박 1개')
check(await M.until(`(async () => ${W}.outdoor.pickups.filter((p) => !p.obj.visible).length === 1)()`, 2000), '22) 딴 호박은 숨긴다')

// 23) 가스레인지 요리: 달걀 1개로 달걀 프라이 (2초)
const stove = await M.evaluate(`(async () => { const c = ${W}.stove.center; return [200 - c.x, -c.z] })()`)
await prog(`(p.addItem('egg', 1), true)`)
await M.evaluate(teleport(stove[0], stove[1]))
check(await M.until(`document.body.innerText.includes('요리하기 (요리법 보기)')`, 6000), `23) 가스레인지 앞 안내 (${stove.map((v) => v.toFixed(1))})`)
await press('KeyE', 'e')
check((await sess('s.mode')) === 'bag' && (await M.evaluate(`document.querySelector('.kiosk-tabs .on')?.textContent`)) === '요리법', '23) E → 가방 요리법 탭')
await M.evaluate(`[...document.querySelectorAll('.kiosk-card')].find((b) => b.textContent.includes('달걀 프라이')).click(), true`)
await wait(300)
await M.shot('23-recipe')
check(await M.evaluate(`__click('요리하기2초 뒤 가방에 들어와요') || __click('요리하기')`), '23) 요리하기 버튼')
await wait(400)
check((await sess('s.mode')) === 'explore' && (await prog('p.items.egg')) === 0 && (await M.evaluate(`document.body.innerText.includes('달걀 프라이 요리 중')`)), '23) 창이 닫히고 HUD 에 요리 중')
await M.shot('23-cooking')
check(await M.until(`(async () => ${P}.items.friedegg === 1)()`, 5000), '23) 2초 뒤 가방에 달걀 프라이')


// 24) 침실 문(거실 문, 은지 x 5 → 세계 x 195): 닫혀 있으면 거실에서 침실로 못 간다. E 로 열면 지나간다. 상태는 저장된다
check(JSON.stringify(await prog('p.doors')) === '[false,false,false,false]', '24) 처음엔 문이 모두 닫혀 있다')
await M.evaluate(teleport(193, 0))
await wait(1500)
await walk(M, await keyToward(M, 1, 0), 2000)
const d0 = await M.evaluate(pos)
check(d0[0] < 195, `24) 닫힌 문에 막힌다 (x ${d0[0].toFixed(2)} < 195)`)
check(await M.until(`document.body.innerText.includes('거실 문 여닫기')`, 3000), '24) 문 앞 "거실 문 여닫기" 안내')
await press('KeyE', 'e')
await wait(800)
check((await prog('p.doors[0]')) === true, '24) E 로 열었다')
await M.shot('24-door-open')
await walk(M, await keyToward(M, 1, 0), 2000)
const d1 = await M.evaluate(pos)
check(d1[0] > 195.5, `24) 열린 문으로 지나간다 (x ${d1[0].toFixed(2)})`)
const savedDoors = await M.evaluate(`JSON.parse(localStorage.getItem('fishing-island-save-v1')).state.doors`)
check(savedDoors?.[0] === true, `24) 문 상태를 저장한다 (${JSON.stringify(savedDoors)})`)


// 25) 농산물 가게 (은지 58, 11.5): 앞(은지 58, 9.5 → 세계 142, -9.5)에서 E → 팔기·사기
await prog(`(p.addItem('pumpkin', 2), true)`)
const before25 = await prog('[p.coins, p.items.pumpkin, p.items.mushroom]')
await M.evaluate(teleport(142, -9.5))
check(await M.until(`document.body.innerText.includes('농산물 가게 —')`, 6000), '25) 농산물 가게 앞 안내')
await turnTo(M, 0, -60)
await M.evaluate(`(async () => { ${S}.zoomBy(-200); return true })()`)
await wait(1500)
await M.shot('25-vendors')
await press('KeyE', 'e')
check((await sess('[s.mode, s.vendor].join()')) === 'vendor,grocer', '25) E → 농산물 가게 창')
await M.shot('25-sell')
const sellOne = `(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.startsWith('1개 팔기')); b?.click(); return !!b })()`
check(await M.evaluate(sellOne), '25) 팔기 버튼')
await wait(200)
await M.evaluate(sellOne)
await wait(200)
const afterSell = await prog('[p.coins, p.items.pumpkin]')
check(afterSell[0] === before25[0] + 12 && afterSell[1] === before25[1] - 2, `25) 호박 2개를 팔면 12 코인 (${before25} → ${afterSell})`)
await M.evaluate(`__click('사기')`)
await wait(300)
await M.evaluate(`[...document.querySelectorAll('.kiosk-card')].find((b) => b.textContent.includes('버섯')).click(), true`)
await wait(200)
await M.evaluate(`[...document.querySelectorAll('button')].find((b) => b.textContent.startsWith('1개 사기')).click(), true`)
await wait(300)
const afterBuy = await prog('[p.coins, p.items.mushroom]')
check(afterBuy[1] === before25[2] + 1 && afterBuy[0] === afterSell[0] - 8, `25) 버섯을 사면 8 코인 (${afterBuy})`)
await M.shot('25-buy')
await press('Escape')
check((await sess('s.mode')) === 'explore', '25) ESC 로 닫기')


// 26) 폰: 도구 칸은 쓰는 칸만, 위쪽에 가방 버튼. 세로·가로 화면에서 겹치지 않는지 스크린샷
await M.evaluate(`(async () => { (await __mod('/src/game/input/touchDevice.ts')).useTouchUiStore.setState({ touchUi: true }); return true })()`)
await M.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
await wait(1200)
check(await M.evaluate(`document.querySelectorAll('[aria-label="도구 칸"] button').length === 3`), '26) 폰 도구 칸은 3칸')
await M.shot('26-phone-portrait')
await M.evaluate(`[...document.querySelectorAll('[aria-label="도구 칸"] button')][2].click(), true`)
await wait(300)
check((await M.evaluate(`(async () => ${S}.tool)()`)) === 'knife', '26) 칸을 누르면 칼')
await M.send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 2, mobile: true })
await wait(1200)
await M.shot('26-phone-landscape')
check(await M.evaluate(`(document.querySelector('button[aria-label="가방"]').click(), true)`), '26) 폰 가방 버튼 (오른쪽 아래)')
await wait(500)
await M.shot('26-phone-bag')
await M.send('Emulation.clearDeviceMetricsOverride')

M.close()

// 27) 같이 하기: A 가 칼을 들면 B 가 받은 모습에 tool 이 있다 (서버도 같은 netProtocol 로 tool 을 넘긴다)
const RUN32 = Date.now().toString(36)
const A4 = await open(9740, 0, `?room=tools-${RUN32}`)
await A4.evaluate(`__click('🔒 방 만들기')`)
await A4.evaluate(`__fill('암호', 'secret1') && __fill('닉네임', '에이')`)
await A4.evaluate(`__click('방 만들고 들어가기')`)
check(await A4.until(`document.body.innerText.includes('👥 1명')`, 20000), '27) A 방 만들기')
const B4 = await open(9741, 1, `?room=tools-${RUN32}`)
await B4.evaluate(`__fill('암호', 'secret1') && __fill('닉네임', '비이')`)
await B4.evaluate(`__click('들어가기')`)
check(await B4.until(`document.body.innerText.includes('👥 2명')`, 20000), '27) B 들어가기')
await A4.key('keydown', 'Digit3', '3')
await A4.key('keyup', 'Digit3', '3')
const remoteTool = `(async () => { const { remoteRig } = await __mod('/src/game/net/remoteRig.ts'); const e = [...remoteRig.values()][0]; return e?.buf.at(-1)?.s.tool ?? null })()`
check(await B4.until(`${remoteTool}.then((t) => t === 'knife')`, 8000), '27) A 가 칼을 들면 B 가 tool knife 를 받는다')
A4.close()
B4.close()
```

- [ ] **Step 2: 헤드리스 점검 실행**

다른 터미널 둘에서 `npm run server:dev` 와 `VITE_ROOM_SERVER=ws://127.0.0.1:8787 npx vite --port 5190 --strictPort` 를 띄우고:

Run: `node tools/meadow-check.mjs http://localhost:5190 <스크래치패드>/meadow-check`
Expected: 1)~27) 과 `셰이더 컴파일 오류가 없다` 모두 `OK` (10분쯤 걸린다. 기준 커밋에서 102줄 OK). 새 줄 예:
`OK   18) 바퀴에서 1 → 춤 (explore,dance)`, `OK   18) 바퀴를 연 채 포커스를 잃으면 닫힌다`,
`OK   20) 주먹을 든 채 E → 낚싯대로 낚시 (fishing,rod)`, `OK   22) 버섯·호박이 놓였다 (22개)`,
`OK   23) 2초 뒤 가방에 달걀 프라이`, `OK   24) 닫힌 문에 막힌다 (x 194.57 < 195)`, `OK   24) 열린 문으로 지나간다 (x 204.52)`,
`OK   25) 호박 2개를 팔면 12 코인 (0,3,2 → 12,1)`, `OK   26) 폰 도구 칸은 3칸`, `OK   27) A 가 칼을 들면 B 가 tool knife 를 받는다`.
콘솔 경고는 three 의 `THREE.Clock`·`PCFSoftShadowMap`·초기화 인자 deprecated 경고뿐이어야 한다.

- [ ] **Step 3: 스크린샷 눈으로 보기**

스크린샷 폴더에서 확인한다:
- `18-wheel-aim.png` — 바퀴 5칸, 오른쪽 위 "2 수다" 가 노랗게, 가운데에 "수다"
- `20-knife.png` — 가까이 당긴 캐릭터 손에 칼, 아래 가운데 도구 칸 9칸 중 3번이 노란 테두리, 그 위 E 안내·마우스 잠금 안내가 겹치지 않음
- `21-bag.png`·`21-recipes.png` — 가방 키오스크(버섯·스테이크 카드), 요리법 13가지
- `21-eating.png` — 스테이크 이모지를 손에 들고 먹는 모습, "냠냠! 스테이크 · 배고픔 +40 · 체력 +10"
- `22-pumpkin.png` — 텃밭 호박 4개 앞 "E 🎃 호박 따기"
- `23-cooking.png` — 왼쪽 위 "🍳 달걀 프라이 요리 중… n초"
- `25-vendors.png` — 농산물 가게 노점 뒤 상인(레인저), "농산물 가게" 이름표, "E 🛒 농산물 가게 — …" 안내
- `25-buy.png` — 사기 탭 달걀·호박·버섯
- `26-phone-portrait.png`·`26-phone-landscape.png` — 폰 도구 칸 3칸이 조이스틱·버튼·안내 글과 겹치지 않고, 오른쪽 아래 🎒 가방 버튼

- [ ] **Step 4: 전체 확인**

Run: `npx vitest run && npx tsc -b && npm run lint 2>&1 | grep -c warning && npm run build`
Expected: 65 파일 / 662 개 PASS, tsc 출력 없음, 경고 `6`, build 성공

- [ ] **Step 5: 커밋**

```bash
git add tools/meadow-check.mjs
git commit -m "test: 도구 칸·가방·요리·상인 헤드리스 점검" -m "T 바퀴(숫자·마우스로 고르기, 포커스를 잃거나 ESC 면 닫기), Tab 지도, 도구 칸과 물가 E 의 낚싯대 자동 바꾸기, 가방·F 먹기를 본다.
호박 따기, 가스레인지 요리, 닫힌 문에 막히고 열면 지나가며 상태를 저장하는지, 농산물 가게 사고팔기, 폰 도구 칸·가방 버튼, 같이 하기 tool 전달까지 점검한다."
```

스펙을 고쳤다면 같이 커밋한다 (`docs: 3-2 설계를 구현에 맞춤`, 본문에 고친 줄을 적는다).

- [ ] **Step 6: 사용자에게 확인받기 (push·배포 전)**

여기서 멈추고 사용자에게 묻는다: (1) `feat/eunji-features` push, (2) **서버 먼저** 다시 배포(`npm run server:deploy` — 서버 코드는 그대로지만 같은 `netProtocol.ts` 로 `tool`·은지 요리 먹기를 넘기려면 필요), (3) 그다음 main 합치기(Vercel 자동 배포). 사용자가 허락한 것만 한다.
