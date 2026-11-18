# 3-3 동물과 사냥 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 초원 들판에 은지 동물 7종을 풀어 놓고(혼자: 내 화면, 같이: 방 서버가 같은 동물을 돌린다), 주먹·칼로 사냥해 고기를 줍게 하며, 맞은 동물이 반격하면 체력이 줄어 죽음 규칙(침대)으로 이어지게 한다.

**Architecture:** 은지 `animals.js` 상태 기계를 그래픽 없는 순수 TS `logic/animalSim.ts`(세계 좌표, 난수 주입)로 옮겨 서버(rinfish-rooms Durable Object, alarm 200ms)와 클라이언트(혼자일 때 `scene/animals/HerdRunner`)가 같이 쓴다. 같이 하기에선 서버가 `animals`(짧은 배열)를 5Hz 로 보내고 클라이언트는 다른 사람처럼 0.25초 늦게 이어 그리며(`logic/animalInterp`), 명중은 휘두른 쪽 화면이 판정해 `animalHit` 을 보내면 서버가 거리·간격을 검사(`judgeAnimalHit`)해 체력을 깎고 잡은 사람에게만 `loot`, 들이받힌 사람에게만 `hurt` 를 보낸다. 매 프레임 바뀌는 동물·전리품·휘두르기 상태는 React 밖 모듈 객체(`hunt/animalRig`, `hunt/meleeRig`)에 둔다.

**Tech Stack:** React 19, @react-three/fiber 9, @react-three/rapier 2, three 0.186 (SkeletonUtils), zustand 5, vitest 5, oxlint, Cloudflare Durable Objects (WebSocket Hibernation API, wrangler 4).

**Spec:** `docs/superpowers/specs/2026-11-18-eunji-features-design.md` — 이 계획은 "3-3 동물과 사냥" 과, "같이 하기 메시지"(`animals`·`loot`·`hurt`·`animalHit`)·"확인 방법"(animalSim·명중·쿨다운·프로토콜 테스트, 두 사람이 같은 소를 보는 헤드리스 점검) 가운데 3-3 몫만 만든다. 3-1·3-2 에서 넘어온 것 두 가지(피해 0 죽음 판정, 아침 직후 눕기)도 Task 1 에서 고친다. 총·사격장·PvP(3-4)는 하지 않는다.

**기준 커밋:** `feat/eunji-features` 의 `641cf71` (test: 3-2 마무리 헤드리스 점검). 이 위에서 계획의 코드를 스크래치 복사본으로 Task 1~8 순서대로 모두 만들어 확인했다 (Task 마다 `npx tsc -b` 깨끗·oxlint 경고 6·vitest 통과, 마지막에 `npm run build`, `tools/room-smoke.mjs` 31개 전부 OK, `tools/meadow-check.mjs` 의 3-3 점검 28~36 전부 OK). 각 Task 머리의 스크래치 커밋 SHA 는 그 Task 끝 상태다 (스크래치 저장소 `/private/tmp/claude-501/-Users-ihyelin-proten-hrlee-----threejs/e476c70e-362f-4ed3-9ff7-d8664da04e4b/scratchpad/plan-3-3/repo`, 브랜치 `feat/eunji-features`). 시작할 때 HEAD 가 `641cf71` 보다 앞서 있으면 diff 의 바꿀 곳(특히 `Player.tsx`·`TouchControls.tsx`·`netStore.ts`·`room.ts`·`tools/meadow-check.mjs`)이 그대로 있는지 먼저 본다.

## Global Constraints

- 브랜치 `feat/eunji-features` 에서 그대로 커밋한다. push·main 합치기·서버 배포(`npm run server:deploy`)는 바깥에 영향을 주므로 **사용자에게 먼저 묻는다** (Task 8 Step 5). 배포 순서는 **서버 먼저**: 새 클라이언트가 옛 서버 방에 들어가면 동물이 하나도 없다(혼자 시뮬레이션은 같이 하는 동안 돌지 않는다). 새 서버에 옛 클라이언트가 붙으면 모르는 `animals`·`loot`·`hurt` 를 버린다(`parseServerMsg` 가 null) — 그 사람 자리(state)도 동물이 달아나는 데 쓰인다.
- 은지 값 그대로 (`data/animals.ts`·`data/melee.ts`·`data/meadowItems.ts DROPS`): 동물 7종(소·돼지·사슴·멧돼지·토끼·여우·병아리) 체력·속도·피해, 마릿수 12, 다시 나타남 25초, 달아나기 7m, 진정 14m, 들이받기 1.5m·1.3초(첫 번째 0.5초), 포기 14초·30m, 쓰러져 사라지기 1.4초, 넘어지기 0.5초, 번쩍 0.15초, 줍기 1.6m. 공격: 주먹 피해 1·거리 1.3·간격 0.45, 칼 베기 1·1.8·60/110, 찌르기 2·2.3·0.85, 동작 시간·맞는 순간(punch 0.38/0.4, slash 0.3/0.42, stab 0.62/0.46). 전리품 표 `DROPS` 와 `rollDrops`.
- 들판: 은지 `ANIMAL_ZONE` (-6..34, 26..52) → 세계 x 166..206, z -52..-26. 쫓을 때(은지 `AGGRO_ZONE`) 세계 x 156..216, z -58..-24. 좌표 변환은 지금처럼 세계 `(x, z) = (200 − x_은지, −z_은지)`. 실내 = 은지 집 방 4개(`MEADOW_ROOMS`, 은지 `roomAt` 처럼 maxX 는 빼고 maxZ 는 넣는다).
- 서버 (rinfish-rooms): 사람이 있는 동안 alarm 을 **200ms** 로 건다(3-1 의 30초 시계 확인·세지 않은 잠 표시 세기는 그대로 한다). 마지막 사람이 나가면 alarm 을 지우고 동물을 버린다. 동물은 메모리에만 둔다(Hibernation 으로 메모리가 사라지면 다음 alarm 에 새 무리, 스펙 허용). 새 클라이언트 메시지 `animalHit` 은 공격 종류별 최소 간격(주먹 0.3·칼 0.4·찌르기 0.7초)과 거리(사거리 + 판정 원 + 2.5m)로 검사하고, 피해는 보낸 `dmg` 가 아니라 공격 표 값으로 정한다.
- 같이 하기: `NET.protocolVersion` **1 그대로**. 새 종류만 더한다: 서버 → `animals {list}`·`loot {items, x, z}`·`hurt {dmg, by, from?}`, → 서버 `animalHit {id, dmg, w}`. `NetState` 는 바꾸지 않는다.
- 저장(`fishing-island-save-v1`) 은 그대로 **version 4**. 동물·전리품·휘두르기는 저장하지 않는다(은지 그대로).
- oxlint 경고 기준선 **6** 을 늘리지 않는다 (`npm run lint 2>&1 | grep -c warning`). 컴포넌트 파일(.tsx)은 컴포넌트만 export 한다 (함수·상수는 .ts: `scene/animals/animalModel.ts`·`lootMesh.ts`, `hunt/*.ts`). hook 에 넘긴 값을 `useFrame` 에서 고치지 않는다 — 매 프레임 바뀌는 것은 모듈 객체(`hunt/animalRig`·`hunt/meleeRig`·`playerRig`)에 둔다. 렌더 중에 `performance.now()` 를 부르지 않는다. 스토어(`stores/*`)는 `scene/*` 을 import 하지 않는다(서버 `hurt` 는 `animalRig.setHurtHandler` 로 `HerdRunner` 가 붙인 처리기로 간다).
- 빛 개수는 처음부터 같게(1·2단계 원칙): 동물·전리품은 빛을 더하지 않는다. 새 `Mode` 는 없다.
- macOS 파일 이름은 대소문자를 가리지 않는다: 대소문자만 다른 두 파일을 만들지 않는다.
- 테스트 기준선 67 파일 / 680 개 (641cf71). 이 계획을 다 하면 **76 파일 / 752 개**. `npx tsc -b` 깨끗 (server 프로젝트 포함).
- 커밋 메시지: `feat:`/`fix:`/`test:` 처럼 타입만(괄호 스코프 금지), 제목 짧게, 자세한 건 본문. Co-Authored-By·AI 생성 표기 금지.
- 코드 주석·UI 글은 한국어, 지금 코드 말투(평서형, 짧게).
- 헤드리스 점검 준비: `npm run server:dev` (8787) 와 `VITE_ROOM_SERVER=ws://127.0.0.1:8787 npx vite --port 5190 --strictPort`. Vite 는 `::1` 에 뜨므로 점검 주소는 `http://localhost:5190`. 같은 기계에서 다른 사람이 점검을 돌리고 있으면 포트(서버 8787·Vite 5190·Chrome 디버깅 9731~9744)가 겹친다 — 그땐 `wrangler dev --port <다른 포트>`, `vite --port <다른 포트>`, 디버깅 포트를 바꾼 `tools/meadow-check.mjs` 사본으로 돌린다. 헤드리스(swiftshader)는 5~9fps 라 시간에 기대는 옛 점검(16·21·24)이 바쁜 기계에서 가끔 늦어 실패한다 — 실패하면 그 묶음만 다시 돌려 본다.

## Review Focus

1. **같이 하기 명중을 서버가 믿지 않기** — 멀리서 보낸 `animalHit`, 너무 자주 보낸 것(자동 클릭), 부풀린 `dmg` 는 버리거나 공격 표 값으로만 깎아야 한다. 받는 사람 화면은 0.25초 늦은 동물을 보므로 거리 여유(2.5m)가 없으면 정직한 명중도 버려진다 (Task 3 `judgeAnimalHit` 테스트 "가까운 살아 있는 동물…보낸 dmg 는 믿지 않는다"·"최소 간격"·"사거리 + 판정 원 + 여유", Task 4 room-smoke "곧바로 또 보낸 것은 버린다"·"먼 동물을 때린 것은 버린다").
2. **쫓던 사람이 사라질 때 동물이 멈춰 버리지 않기** — 쫓던 사람이 집 안에 들어가거나 방을 나가거나(서버 목록에서 빠짐) 죽어 침대로 가면 동물은 포기하고 달아나야 한다. 같이 하기에선 따로 "진정" 메시지가 없고 침대가 실내라 서버 동물이 포기한다 (Task 2 animalSim "쫓던 사람이 집 안에 들어가거나 나가거나…", Task 5 dayActions "죽으면 나를 쫓던 혼자 동물이 진정한다", Task 7 meadow-check 34 "실내로 들어가면 쫓던 멧돼지가 포기한다").
3. **죽는 동안·지친 채 맞기** — 화면이 어두워지는 동안(죽음·잠) 서버 `hurt` 가 또 오면 무시해야 하고(죽음이 두 번 시작되거나 깨어난 체력이 깎이지 않게), 피해 0 은 지친 사람(체력 0, 약화 유예 중)을 죽이지 않으며, 맞아서 죽으면 약화 유예를 지워 진료소로 가지 않아야 한다 (Task 1 survival "피해 0(또는 이상한 값)은 아무 일도 없다"·"죽으면 약화 유예를 지운다", Task 5 dayActions "잠·죽음으로 어두워지는 동안엔 맞지 않는다").
4. **휘두르기가 아닌 클릭** — 마우스 잠금을 거는 첫 클릭, 손가락으로 화면을 끌어 시점을 돌리기, 가운데 버튼은 휘두르기가 되면 안 된다 (폰은 휘두르기 버튼). 빈손·낚싯대는 휘두르지 않는다 (Task 7 pointer.test "잠기기 전 클릭은…"·"손가락은…", melee.test `meleeFor`).
5. **두 사람이 거의 같이 누울 때 아침이 두 번** (3-1 에서 넘어온 것) — 아침이 온 직후 늦게 닿은 눕기를 세면 다음 날이 또 온다. 새로 만든 방(1일차)에 들어오자마자 눕는 것은 막지 않는다 (Task 1 `justAfterMorning` 테스트, room-smoke "아침 직후 3초 안의 눕기는 세지 않는다").

---

## 결정한 것 (스펙 해석·Ruling)

- **맞아서 체력 0 이면 약화 중이어도 죽음, 피해 0 은 아무 일도 없다.** 3-1 에서 넘어온 고칠 거리는 "피해 0 이 지친 사람을 죽인다"·"죽어도 약화 유예가 남는다" 다. 스펙 표 "동물·PvP 피해로 체력 0 → 죽음(침대)" 대로 약화 중(체력 0)에 맞으면 죽고, 피해가 0 이하(또는 NaN)면 그대로 둔다. 죽으면 `graceLeft` 를 지운다.
- **아침 직후 눕기 막기는 "2일차 이상 기준점에서 3초"** (`justAfterMorning`, `NET.morningGuard`). 기준점(epoch)은 방을 만들 때도 지금이라, 1일차 기준점까지 막으면 방에 들어오자마자 눕는 것이 버려진다. 새 상태를 더하지 않는다. 막힌 사람 화면도 `morning` 을 받아 깨므로(3-1) 어긋나지 않는다.
- **시뮬레이션은 세계 좌표로 돈다.** 들판·쫓기 영역은 `areaToWorld` 로 바꾸고 방향은 세계에서 `atan2(dx, dz)` (동물 모델은 장면 루트에 바로 둔다, 은지 그룹 아래가 아니다). 서버가 받는 사람 자리(`NetState.p`)가 세계 좌표라 바꿀 필요가 없다.
- **여럿일 때: 달아나기는 가장 가까운 사람, 쫓기는 때린 사람만.** 은지는 플레이어가 하나뿐이었다. 포기 조건(실내·14초·30m)에 "쫓던 사람이 없다(나감)" 를 더한다. 포기하는 순간엔 들이받지 않는다(은지는 같은 프레임에 한 번 더 받을 수 있었다).
- **같이 하기에서 죽었을 때 진정 메시지는 없다.** 깨어나는 침대가 실내라 서버 동물이 실내 규칙으로 포기한다. 혼자는 `startDeath` 에서 나를 쫓던 동물을 진정시킨다(은지 `calmAll`, 3-1 이 미룬 것).
- **서버 동물은 메모리에만, alarm 은 200ms 하나로 묶는다.** 30초마다 `time` 과 잠 세기를 같은 alarm 안에서 한다(`clockAt`). 너무 잦아 세지 않은 잠 표시는 다음 alarm(200ms 뒤)에 센다(`sleepPending`, 메모리가 사라져도 30초 확인 때 센다). 사람이 있는 동안엔 200ms 마다 깨어 있으니 Hibernation 으로 잠들지 않는다(그동안 요금이 든다 — 스펙 결정).
- **`animals` 는 짧은 배열** `[번호, 종 순서, x, z, 방향, 동작 순서, 체력]` (소수 둘째 자리, 12마리 약 450바이트). 상태(state) 대신 **그릴 동작(pose)** 을 보낸다 — 받는 쪽은 클립만 고르면 된다(쉬기 중 풀 뜯기·들이받기를 따로 알 수 있다). 틀린 동물은 그 동물만 버린다.
- **`loot` 에 떨어진 자리(x, z) 를 더한다** (스펙 `loot {items}`). 잡은 사람 화면이 동물 목록(늦게 그림)에서 자리를 찾지 않아도 된다. 전리품은 은지처럼 쓰러진 동물이 사라질 때(1.4초 뒤) 보이고 그 둘레 ±0.5m 에 흩어진다.
- **명중 판정은 바닥의 선분 → 판정 원.** 은지는 카메라 광선을 메시에 쐈다. 우리는 3인칭이라 카메라가 보는 쪽(`playerRig.yaw`)으로 몸 가운데에서 사거리만큼 바닥 선분을 긋고, 동물마다 원(반지름 `max(0.35, 0.65 × 배율)`)에 처음 닿는 것을 고른다. 그 거리 안에 고정 충돌체(벽·울타리)가 있으면 안 맞는다(Rapier `castRay`, `ONLY_FIXED`). 휘두르는 동안엔 그쪽을 본다.
- **휘두르기 입력**: 주먹·칼을 들었을 때만(빈손·낚싯대는 아니다. 3-2 의 주먹 칸이 은지 "맨손"). 마우스는 잠금 중일 때만(첫 클릭은 잠금용), 손가락 끌기는 시점 돌리기라 아니다. 폰은 오른쪽 아래 휘두르기 버튼 하나(세로 화면은 가방 줄에, 가로는 한 줄). 칼 찌르기 폰 버튼은 3-4 의 총 버튼과 같이 만든다. 먹는 중엔 휘두르지 않는다.
- **남이 휘두르는 모습은 그리지 않는다.** `NetState` 에 새 필드를 더하지 않는다(스펙의 선택 필드는 `tool`·`hp` 뿐). 남 화면에선 동물이 번쩍이고 쓰러지는 것으로 보인다.
- **전리품 줍기가 다른 초원 E 대상보다 먼저다** (발밑 1.6m 안). 방금 잡은 걸 줍는 게 할 일이다. 감지 상자(침대)·물가 낚시가 잡은 대상은 지금처럼 그대로 둔다.
- **동물 모델은 처음에 미리 받는다** (`useGLTF.preload`, 7개 956KB). 동물마다 `SkeletonUtils.clone` + 재질 복제(번쩍이려고), 클립 idle/walk/run/eat. 혼자 무리와 방 무리는 번호가 겹치므로 그려 둔 모델은 `종:번호` 로 찾는다.
- **혼자 시뮬레이션은 게임 시간처럼 멈춘다** (`restStops`: 메뉴·꾸미기·로비·잠/죽음으로 어두워지는 동안). 같이 하는 동안(연결 중·다시 붙는 중 포함)엔 돌리지 않는다.
- **맞으면 화면 가장자리가 빨갛게 번쩍인다** (`ui/HurtFlash`, 은지 `hurtEl`). 소리는 3-4 의 은지 `audio.js` 와 같이 넣는다.
- **헤드리스 점검용으로 그린 동물 수를 남긴다** (`animalRig.herdDrawn.count`). Resource Timing 버퍼(250개)가 이미 차 있어 모델 받기를 그쪽으로 볼 수 없다.

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `src/game/logic/survival.ts` (+test) | `takeDamage`: 피해 0 무시, 죽으면 약화 유예 지우기 |
| `server/src/roomRules.ts` (+test), `src/game/data/net.ts` | `justAfterMorning`, `judgeAnimalHit`, `Member.lastHit`; `NET.morningGuard`·`animalEvery`·`maxAnimals`·`hitSlack` |
| `src/game/data/animals.ts` (+test) | 동물 7종·숫자들·들판/쫓기 영역(세계)·판정 원 |
| `src/game/data/meadow.ts` | `MEADOW_ROOMS`, `isIndoor` (세계 좌표 실내) |
| `src/game/data/meadowItems.ts` (+test), `src/meadow/vendor/items.d.ts` | `DROPS`, `rollDrops` |
| `src/game/logic/animalSim.ts` (+test) | 무리 만들기·진행·맞기·진정·그릴 값 (서버·클라이언트 공용, 순수) |
| `src/game/data/melee.ts` (+test) | 근접 공격 표(은지 시간표), `meleeFor`, `hitDelay` |
| `src/game/logic/netProtocol.ts` (+test) | `animalHit`·`animals`·`loot`·`hurt`, `packAnimals`/`unpackAnimals` |
| `server/src/room.ts`, `tools/room-smoke.mjs` | 200ms alarm·동물·명중·전리품·hurt, 아침 직후 눕기 버림 / 서버 점검 |
| `src/game/logic/animalInterp.ts` (+test), `src/game/logic/loot.ts` (+test) | 받은 동물 목록 이어 그리기, 전리품 흩기·가까운 것 |
| `src/game/hunt/animalRig.ts` (+test) | 혼자 무리·방 목록·전리품·hurt 처리기 (모듈 객체) |
| `src/game/hunt/huntActions.ts` (+test), `src/game/hunt/meleeRig.ts` | 명중(혼자/서버)·전리품 줍기 / 내 휘두르기 상태 |
| `src/game/stores/{progressStore,sessionStore,netStore}.ts` (+test) | `hurt`, `hurtAt`·`flashHurt`, 새 메시지 받기·`sendAnimalHit` |
| `src/game/scene/day/dayActions.ts` (+test) | `takeHit`, 죽으면 혼자 동물 진정 |
| `src/game/scene/animals/{HerdRunner,Animals,LootItems}.tsx`, `animalModel.ts`, `lootMesh.ts` | 혼자 시뮬레이션·맞기 / 동물 그리기 / 전리품 그리기 |
| `public/meadow/models/pets/` | 은지 Kenney Cube Pets 7종 + Textures + LICENSE (CC0) |
| `src/game/logic/interaction.ts`, `meadowInteract.ts`, `src/meadow/MeadowInteractions.tsx`, `ui/interactLabel.ts`, `input/useInteractionKeys.ts` (+test) | E 대상 `loot`·`pickLoot` |
| `src/game/logic/melee.ts` (+test), `src/game/input/pointer.ts` (+test), `src/game/scene/melee/MeleeController.tsx` | 휘두르기 시간·판정 / 입력 / 매 프레임 판정 |
| `src/game/logic/characterPose.ts` (+test), `src/game/scene/PlayerModel.tsx`, `src/game/scene/Player.tsx` | 휘두르는 오른팔·칼 기울기·방향 |
| `src/game/ui/{HurtFlash,Hud,TouchControls}.tsx`, `src/game/Game.tsx`, `src/game/scene/World.tsx` | 화면 번쩍·키 안내·폰 버튼·붙이기 |
| `tools/meadow-check.mjs` | 헤드리스 점검 28~36 |

---

### Task 1: 피해 0 죽음 판정과 아침 직후 눕기 (넘어온 것)  — 스크래치 `2001350`

**Files:**
- Modify: `src/game/logic/survival.ts`, `server/src/roomRules.ts`, `server/src/room.ts`, `src/game/data/net.ts`, `tools/room-smoke.mjs`
- Test: `src/game/logic/survival.test.ts`, `server/src/roomRules.test.ts`

**Interfaces:**
- Consumes: `RoomClock` (`logic/dayClock`), `NET` (`data/net`)
- Produces: `takeDamage(s: Survival, amount: number): { survival: Survival; died: boolean }` (피해 0 이하 → 그대로·`died: false`, 죽으면 `graceLeft: null`), `NET.morningGuard = 3`, `justAfterMorning(clock: RoomClock, nowMs: number): boolean` (`server/src/roomRules.ts`)

- [ ] **Step 1: 실패하는 테스트 쓰기**

`src/game/logic/survival.test.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/logic/survival.test.ts b/src/game/logic/survival.test.ts
--- a/src/game/logic/survival.test.ts
+++ b/src/game/logic/survival.test.ts
@@ -90,6 +90,15 @@ describe('죽음 판정 (피해)', () => {
     expect(takeDamage(at(10, 100), 15)).toEqual({ survival: at(0, 100), died: true })
     expect(takeDamage(at(30, 100), 15)).toEqual({ survival: at(15, 100), died: false })
   })
+  it('피해 0(또는 이상한 값)은 아무 일도 없다: 이미 지친 사람도 죽지 않고 약화 유예도 그대로', () => {
+    expect(takeDamage(at(0, 100, 42), 0)).toEqual({ survival: at(0, 100, 42), died: false })
+    expect(takeDamage(at(0, 100, 42), Number.NaN)).toEqual({ survival: at(0, 100, 42), died: false })
+    expect(takeDamage(at(30, 100), -5)).toEqual({ survival: at(30, 100), died: false })
+  })
+  it('죽으면 약화 유예를 지운다 (진료소로 가지 않는다). 약화 중에 맞아도 죽음', () => {
+    expect(takeDamage(at(5, 100, 42), 15)).toEqual({ survival: at(0, 100), died: true })
+    expect(takeDamage(at(0, 100, 42), 6)).toEqual({ survival: at(0, 100), died: true })
+  })
 })
 
 describe('먹기·잠·깨어나기', () => {
```

`server/src/roomRules.test.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/server/src/roomRules.test.ts b/server/src/roomRules.test.ts
--- a/server/src/roomRules.test.ts
+++ b/server/src/roomRules.test.ts
@@ -2,7 +2,7 @@ import { describe, expect, it } from 'vitest'
 import { DEFAULT_LOOK } from '../../src/game/data/characterParts'
 import type { ClientMsg, NetState } from '../../src/game/logic/netProtocol'
 import { NEW_WINDOW } from '../../src/game/logic/rateLimit'
-import { handleMemberMsg, judgeHello, memberFrom, tallySleep, type Member, type RoomMeta } from './roomRules'
+import { handleMemberMsg, judgeHello, justAfterMorning, memberFrom, tallySleep, type Member, type RoomMeta } from './roomRules'
 
 const hello = (mode: 'create' | 'join', passHash = 'a'.repeat(64)): Extract<ClientMsg, { type: 'hello' }> => ({ type: 'hello', v: 1, mode, passHash, nick: '혜린', look: DEFAULT_LOOK })
 const DAY = 86_400_000
@@ -103,3 +103,17 @@ describe('tallySleep', () => {
     expect(tallySleep([false])).toEqual({ n: 0, need: 1, morning: false })
   })
 })
+
+describe('justAfterMorning', () => {
+  it('잠 투표 아침(2일차 이상 기준점) 뒤 3초 안이면 true (늦게 닿은 눕기를 버린다)', () => {
+    expect(justAfterMorning({ epoch: 10_000, day0: 2 }, 10_000)).toBe(true)
+    expect(justAfterMorning({ epoch: 10_000, day0: 2 }, 12_999)).toBe(true)
+    expect(justAfterMorning({ epoch: 10_000, day0: 2 }, 13_000)).toBe(false)
+  })
+  it('새로 만든 방(1일차 기준점)은 아침이 아니다: 들어오자마자 누워도 센다', () => {
+    expect(justAfterMorning({ epoch: 10_000, day0: 1 }, 10_500)).toBe(false)
+  })
+  it('기준점보다 이른 시각(서버 시계가 뒤로 감)은 아침 직후로 보지 않는다', () => {
+    expect(justAfterMorning({ epoch: 10_000, day0: 3 }, 9_000)).toBe(false)
+  })
+})
```

- [ ] **Step 2: 실행해 실패 확인**

Run: `npx vitest run src/game/logic/survival.test.ts server/src/roomRules.test.ts`
Expected: FAIL — survival "피해 0…" (`died: true` 가 나온다)·"죽으면 약화 유예를 지운다", roomRules `justAfterMorning is not a function`

- [ ] **Step 3: 구현**

`src/game/logic/survival.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/logic/survival.ts b/src/game/logic/survival.ts
--- a/src/game/logic/survival.ts
+++ b/src/game/logic/survival.ts
@@ -36,10 +36,15 @@ export function tickSurvival(s: Survival, dt: number, ctx: SurvivalTickContext):
   return { survival: { ...next, graceLeft }, fainted: false, died: false }
 }
 
-/** 동물·PvP 피해 (3-3·3-4 에서 쓴다). 체력이 0 이 되면 약화 없이 바로 죽음 */
+/**
+ * 동물·PvP 피해. 맞아서 체력이 0 이 되면 약화 없이 바로 죽음 (약화 유예는 지운다).
+ * 피해가 0 이하면 아무 일도 없다 (이미 지친 사람도 죽지 않는다). 약화 중(체력 0)에 맞으면 죽음
+ */
 export function takeDamage(s: Survival, amount: number): { survival: Survival; died: boolean } {
-  const stamina = Math.max(0, s.stamina - Math.max(0, amount))
-  return { survival: { ...s, stamina }, died: stamina === 0 }
+  if (!(amount > 0)) return { survival: s, died: false }
+  const stamina = Math.max(0, s.stamina - amount)
+  if (stamina > 0) return { survival: { ...s, stamina }, died: false }
+  return { survival: { ...s, stamina: 0, graceLeft: null }, died: true }
 }
 
 /** 먹기: 체력(약화도 풀린다)과 배고픔이 찬다 */
```

`src/game/data/net.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/data/net.ts b/src/game/data/net.ts
--- a/src/game/data/net.ts
+++ b/src/game/data/net.ts
@@ -35,6 +35,8 @@ export const NET = {
   serverProfileEvery: 5,
   /** 서버 속도 제한: 잠 투표(sleep) 초당 횟수 */
   serverSleepPerSecond: 4,
+  /** 아침이 온 뒤 이만큼(초) 안에 닿은 "눕기"는 버린다 (둘이 거의 같이 누우면 늦게 닿은 눕기가 아침을 또 부른다) */
+  morningGuard: 3,
   /** 방에 사람이 있는 동안 서버가 시계 확인(time)을 보내는 간격(초) */
   clockEvery: 30,
   /** 서버가 받는 메시지 최대 길이(글자) */
```

`server/src/roomRules.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/server/src/roomRules.ts b/server/src/roomRules.ts
--- a/server/src/roomRules.ts
+++ b/server/src/roomRules.ts
@@ -1,5 +1,6 @@
 import { NET } from '../../src/game/data/net'
 import type { CharacterLook } from '../../src/game/data/types'
+import type { RoomClock } from '../../src/game/logic/dayClock'
 import type { ClientMsg, ErrorCode, NetState, ServerMsg } from '../../src/game/logic/netProtocol'
 import { NEW_WINDOW, allowEvery, allowPerSecond, type RateWindow } from '../../src/game/logic/rateLimit'
 
@@ -88,3 +89,13 @@ export function tallySleep(sleeping: boolean[]): { n: number; need: number; morn
   const need = Math.max(1, Math.ceil(sleeping.length / 2))
   return { n, need, morning: n > 0 && n >= need }
 }
+
+/**
+ * 방금 잠 투표로 아침이 왔나 (기준점에서 NET.morningGuard 초 안). 이때 닿은 "눕기"는 버린다:
+ * 둘이 거의 같이 누우면 한 사람으로 아침이 오고, 늦게 닿은 다른 사람의 눕기가 다음 아침을 또 부른다.
+ * 새로 만든 방(1일차 기준점)은 아침이 아니다
+ */
+export function justAfterMorning(clock: RoomClock, nowMs: number): boolean {
+  const since = nowMs - clock.epoch
+  return clock.day0 > 1 && since >= 0 && since < NET.morningGuard * 1000
+}
```

`server/src/room.ts` — 눕기를 handleMemberMsg 전에 버린다 (바꿀 곳, `git diff -U3`):

```diff
diff --git a/server/src/room.ts b/server/src/room.ts
--- a/server/src/room.ts
+++ b/server/src/room.ts
@@ -3,7 +3,7 @@ import { NET } from '../../src/game/data/net'
 import { newRoomClock, roomMorning, roomTime, type RoomClock } from '../../src/game/logic/dayClock'
 import { parseClientMsg, type ErrorCode, type PeerInfo, type ServerMsg } from '../../src/game/logic/netProtocol'
 import { NEW_WINDOW } from '../../src/game/logic/rateLimit'
-import { handleMemberMsg, judgeHello, memberFrom, tallySleep, type Member, type RoomMeta } from './roomRules'
+import { handleMemberMsg, judgeHello, justAfterMorning, memberFrom, tallySleep, type Member, type RoomMeta } from './roomRules'
 
 /** 웹소켓 붙임 정보: 아직 hello 전이거나, 들어온 사람 */
 type Attachment = { phase: 'hello' } | ({ phase: 'in' } & Member)
@@ -61,6 +61,8 @@ export class Room extends DurableObject<Env> {
       if ((await this.ctx.storage.getAlarm()) === null) await this.ctx.storage.setAlarm(Date.now() + NET.clockEvery * 1000)
       return
     }
+    // 아침 직후에 닿은 눕기는 버린다 (그 사람 화면도 morning 을 받고 깬다)
+    if (msg.type === 'sleep' && msg.on && justAfterMorning(await this.clock(), Date.now())) return
     const member = toMember(att)
     const r = handleMemberMsg(member, msg, Date.now() / 1000)
     if (r.member !== member) ws.serializeAttachment({ phase: 'in', ...r.member } satisfies Attachment)
```

- [ ] **Step 4: 서버 점검에 아침 직후 눕기를 더한다**

아침 바로 뒤에 둘이 누워도 아침이 또 오지 않는지 보고, 원래 있던 "사람이 나가 필요한 수가 줄면 아침" 점검은 3초 기다린 뒤 눕게 바꾼다.

`tools/room-smoke.mjs` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/tools/room-smoke.mjs b/tools/room-smoke.mjs
--- a/tools/room-smoke.mjs
+++ b/tools/room-smoke.mjs
@@ -1,4 +1,4 @@
-// 로컬 방 서버(npm run server:dev) 확인: 만들기·틀린 암호·들어가기·state·chat·나가기, 방 시계·잠 투표·잠 표시 횟수 제한
+// 로컬 방 서버(npm run server:dev) 확인: 만들기·틀린 암호·들어가기·state·chat·나가기, 방 시계·잠 투표·잠 표시 횟수 제한·아침 직후 눕기 버림
 // 사용: node tools/room-smoke.mjs [ws://127.0.0.1:8787]
 import { createHash } from 'node:crypto'
 
@@ -72,6 +72,13 @@ assert(s3.inbox.some((m) => m.type === 'morning' && m.day === 2), '둘이 자면
 const s4 = await open('join', 'secret1', 'S4', room2)
 assert(s4.first.time?.day === 2 && s4.first.time.tm < 5, '아침 뒤에 온 사람은 2일차 06:00 근처를 받는다')
 s4.ws.close()
+// 아침 바로 뒤(3초 안)에 닿은 눕기는 버린다: 둘 중 한 명이 늦게 누워도 아침이 또 오지 않는다
+s3.ws.send(JSON.stringify({ type: 'sleep', on: true }))
+s2.ws.send(JSON.stringify({ type: 'sleep', on: true }))
+await wait(400)
+const afterMorning = s1.inbox.slice(s1.inbox.findIndex((m) => m.type === 'morning' && m.day === 2) + 1)
+assert(!afterMorning.some((m) => (m.type === 'sleepers' && m.n > 0) || m.type === 'morning'), '아침 직후 3초 안의 눕기는 세지 않는다')
+await wait(3000)
 s3.ws.send(JSON.stringify({ type: 'sleep', on: true }))
 await wait(300)
 s2.ws.close()
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run && npx tsc -b && npm run lint 2>&1 | grep -c warning`
Expected: 67 파일 / 685 개 통과, tsc 출력 없음, `6`

Run (서버 켜 둔 채): `npm run server:dev` 를 다른 창에서 띄우고 `node tools/room-smoke.mjs ws://127.0.0.1:8787`
Expected: 19줄 모두 `OK` (새 줄 "아침 직후 3초 안의 눕기는 세지 않는다" 포함)

- [ ] **Step 6: 커밋**

```bash
git add src/game/logic/survival.ts \
  src/game/logic/survival.test.ts \
  server/src/roomRules.ts \
  server/src/roomRules.test.ts \
  server/src/room.ts \
  src/game/data/net.ts \
  tools/room-smoke.mjs
git commit -F - <<'EOF'
fix: 피해 0 죽음 판정과 아침 직후 눕기

takeDamage 는 피해가 0 이하면 아무 일도 없게 하고, 죽으면 약화 유예를 지운다.
서버는 잠 투표 아침 뒤 3초 안에 닿은 눕기를 버린다 (둘이 거의 같이 누우면 아침이 두 번 오던 것).
EOF
```

검증한 스크래치 커밋: `2001350` (이 커밋의 diff 를 그대로 적용해도 된다: `git -C /private/tmp/claude-501/-Users-ihyelin-proten-hrlee-----threejs/e476c70e-362f-4ed3-9ff7-d8664da04e4b/scratchpad/plan-3-3/repo format-patch -1 --binary 2001350 --stdout | git apply --index` 한 뒤 위 커밋 명령. 스크래치 커밋의 작성자는 scratch 라 `git am` 은 쓰지 않는다)


### Task 2: 들판 동물 시뮬레이션 (순수, 서버·클라이언트 공용)  — 스크래치 `e7f6f0a`

**Files:**
- Create: `src/game/data/animals.ts`, `src/game/logic/animalSim.ts`
- Modify: `src/game/data/meadow.ts`, `src/game/data/meadowItems.ts`, `src/meadow/vendor/items.d.ts`
- Test: `src/game/data/animals.test.ts`, `src/game/logic/animalSim.test.ts`, `src/game/data/meadowItems.test.ts`

**Interfaces:**
- Consumes: `areaToWorld`, `toMeadowLocal`, `EunjiArea`, `Rect` (`data/meadow`), `Rng` (`logic/rng`)
- Produces:
  - `type SpeciesId = 'cow' | 'pig' | 'deer' | 'hog' | 'bunny' | 'fox' | 'chick'`, `SPECIES: Species[]`, `SPECIES_IDS`, `speciesOf(id)`, `ANIMAL` (숫자들: count·respawn·fleeDist·calmDist·attackDist·attackCool·firstAttack·giveUp·loseDist·corpse·fall·flash·pickDist·edge), `EUNJI_ANIMAL_ZONE`, `ANIMAL_FIELD: Rect`, `ANIMAL_CHASE: Rect`, `hitRadius(id): number` (`data/animals.ts`)
  - `MEADOW_ROOMS: EunjiArea[]`, `isIndoor(x, z): boolean` (세계 좌표) (`data/meadow.ts`)
  - `DROPS: Record<SpeciesId, { id: RawItemId; n: number; p?: number }[]>`, `rollDrops(species, rng = Math.random): RawItemId[]` (`data/meadowItems.ts`)
  - `type AnimalState`, `type AnimalPose = 'idle' | 'eat' | 'walk' | 'run' | 'butt' | 'dead'`, `ANIMAL_POSES`, `type Animal`, `type Herd = { animals; respawn: number[]; nextId }`, `type HerdPlayer = { id; x; z; indoor }`, `type HerdEvent = { type: 'attack'; id; target; dmg } | { type: 'gone'; id; sp; x; z }`, `newHerd(rng?)`, `stepHerd(herd, players, dt, rng?): { herd; events }`, `type HitResult`, `hitAnimal(herd, id, dmg, by): { herd; result: 'miss' | 'hurt' | 'killed'; animal }`, `calmHerd(herd, target?)`, `type AnimalView = { id; sp; x; z; h; pose; hp }`, `herdViews(herd): AnimalView[]` (`logic/animalSim.ts`)

- [ ] **Step 1: 실패하는 테스트 쓰기**

은지 `ANIMAL_ZONE`·`ROOMS`·`DROPS` 는 vendor 복사본과 같은지 비교한다 (은지 `animals.js` 는 복사하지 않았으므로 7종 값은 숫자로 적는다).

`src/game/data/animals.test.ts` (새 파일):

```ts
import { describe, expect, it } from 'vitest'
import { ANIMAL_ZONE } from '../../meadow/vendor/outdoor.js'
import { ROOMS } from '../../meadow/vendor/world.js'
import { ANIMAL_CHASE, ANIMAL_FIELD, EUNJI_ANIMAL_ZONE, SPECIES, hitRadius } from './animals'
import { MEADOW_ROOMS, isIndoor, toWorld } from './meadow'

describe('들판 동물 수치', () => {
  it('7종, 은지 animals.js 순서와 값', () => {
    expect(SPECIES.map((s) => s.id)).toEqual(['cow', 'pig', 'deer', 'hog', 'bunny', 'fox', 'chick'])
    expect(SPECIES.find((s) => s.id === 'cow')).toEqual({ id: 'cow', name: '소', scale: 0.8, hp: 3, speed: 1.0, run: 3.0, meat: 3, dmg: 15 })
    expect(SPECIES.filter((s) => s.dmg === 0).map((s) => s.id)).toEqual(['bunny', 'chick'])
  })
  it('들판은 은지 ANIMAL_ZONE 을 세계 좌표로 (x 166..206, z -52..-26), 쫓기는 그보다 넓게', () => {
    expect(EUNJI_ANIMAL_ZONE).toEqual({ minX: ANIMAL_ZONE.minX, maxX: ANIMAL_ZONE.maxX, minZ: ANIMAL_ZONE.minZ, maxZ: ANIMAL_ZONE.maxZ })
    expect(ANIMAL_FIELD).toEqual({ x0: 166, x1: 206, z0: -52, z1: -26 })
    expect(ANIMAL_CHASE).toEqual({ x0: 156, x1: 216, z0: -58, z1: -24 })
  })
  it('판정 원: 소 0.52, 병아리처럼 작아도 0.35', () => {
    expect(hitRadius('cow')).toBeCloseTo(0.52)
    expect(hitRadius('chick')).toBe(0.35)
  })
})

describe('은지 집 실내', () => {
  it('방 4개가 은지 world.js ROOMS 와 같다', () => {
    expect(MEADOW_ROOMS).toEqual(ROOMS.map((r) => ({ minX: r.minX, maxX: r.maxX, minZ: r.minZ, maxZ: r.maxZ })))
  })
  it('침실·주방·사격장은 실내, 마당·들판은 밖', () => {
    expect(isIndoor(...toWorld(3.5, 3.6))).toBe(true)
    expect(isIndoor(...toWorld(9, -9))).toBe(true)
    expect(isIndoor(...toWorld(20, 0))).toBe(true)
    expect(isIndoor(...toWorld(12, 12))).toBe(false)
    expect(isIndoor(...toWorld(14, 40))).toBe(false)
  })
})
```

`src/game/data/meadowItems.test.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/data/meadowItems.test.ts b/src/game/data/meadowItems.test.ts
--- a/src/game/data/meadowItems.test.ts
+++ b/src/game/data/meadowItems.test.ts
@@ -1,6 +1,6 @@
 import { describe, expect, it } from 'vitest'
 import * as eunji from '../../meadow/vendor/items.js'
-import { ITEMS, ITEM_IDS, MEADOW_DISH_IDS, RECIPES } from './meadowItems'
+import { DROPS, ITEMS, ITEM_IDS, MEADOW_DISH_IDS, RECIPES, rollDrops } from './meadowItems'
 
 describe('은지 아이템 TS 복사본', () => {
   it('25종 물건(재료 12 + 요리 13)의 이름·아이콘·태그·포만감이 은지 items.js 와 같다 (순서까지)', () => {
@@ -14,3 +14,15 @@ describe('은지 아이템 TS 복사본', () => {
     expect(RECIPES.map((r) => r.result).sort()).toEqual([...MEADOW_DISH_IDS].sort())
   })
 })
+
+describe('전리품 (은지 DROPS)', () => {
+  it('동물 7종의 전리품 표가 은지 items.js 와 같다', () => {
+    expect(DROPS).toEqual(eunji.DROPS)
+  })
+  it('확률 없는 것은 늘, 확률 있는 것은 굴려서 (rng 가 p 보다 작을 때만)', () => {
+    expect(rollDrops('cow', () => 0.99)).toEqual(['beef', 'beef', 'bone'])
+    expect(rollDrops('hog', () => 0.99)).toEqual(['boar', 'boar'])
+    expect(rollDrops('hog', () => 0)).toEqual(['boar', 'boar', 'fat', 'bone'])
+    expect(rollDrops('chick', () => 0.4)).toEqual(['chicken', 'egg'])
+  })
+})
```

`src/game/logic/animalSim.test.ts` (새 파일):

```ts
import { describe, expect, it } from 'vitest'
import { ANIMAL, ANIMAL_CHASE, ANIMAL_FIELD } from '../data/animals'
import { calmHerd, herdViews, hitAnimal, newHerd, stepHerd, type Animal, type Herd, type HerdEvent, type HerdPlayer } from './animalSim'

/** 같은 수열을 내는 난수 (mulberry32) */
function seeded(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const mid = { x: (ANIMAL_FIELD.x0 + ANIMAL_FIELD.x1) / 2, z: (ANIMAL_FIELD.z0 + ANIMAL_FIELD.z1) / 2 }
const one = (a: Partial<Animal>): Herd => ({ animals: [{ id: 1, sp: 'cow', x: mid.x, z: mid.z, h: 0, hp: 3, state: 'idle', pose: 'idle', timer: 5, atkCool: 0, tx: mid.x, tz: mid.z, target: null, ...a }], respawn: [], nextId: 2 })
const at = (id: string, x: number, z: number, indoor = false): HerdPlayer => ({ id, x, z, indoor })
/** dt 초씩 n 번 */
function run(herd: Herd, players: HerdPlayer[], n: number, dt = 0.2, rng = seeded(1)) {
  const events: HerdEvent[] = []
  for (let i = 0; i < n; i++) {
    const r = stepHerd(herd, players, dt, rng)
    herd = r.herd
    events.push(...r.events)
  }
  return { herd, events }
}
const inside = (a: Animal, r = ANIMAL_FIELD) => a.x >= r.x0 && a.x <= r.x1 && a.z >= r.z0 && a.z <= r.z1

describe('newHerd', () => {
  it('7종을 차례로 12마리, 들판 가장자리 2m 안쪽에, 번호 1..12', () => {
    const h = newHerd(seeded(3))
    expect(h.animals.map((a) => a.sp)).toEqual(['cow', 'pig', 'deer', 'hog', 'bunny', 'fox', 'chick', 'cow', 'pig', 'deer', 'hog', 'bunny'])
    expect(h.animals.map((a) => a.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    for (const a of h.animals) expect(inside(a, { x0: ANIMAL_FIELD.x0 + 2, x1: ANIMAL_FIELD.x1 - 2, z0: ANIMAL_FIELD.z0 + 2, z1: ANIMAL_FIELD.z1 - 2 })).toBe(true)
    expect(h.nextId).toBe(13)
  })
})

describe('어슬렁거리기', () => {
  it('쉬는 시간이 끝나면 들판 안 목적지로 걷고, 닿으면 다시 쉰다. 2초 넘게 남았으면 풀을 뜯는다', () => {
    expect(stepHerd(one({ timer: 5 }), [], 0.1).herd.animals[0].pose).toBe('eat')
    let h = stepHerd(one({ timer: 0.1 }), [], 0.2, () => 0.5).herd
    expect(h.animals[0].state).toBe('walk')
    expect([h.animals[0].tx, h.animals[0].tz]).toEqual([mid.x, mid.z])
    h = one({ state: 'walk', tx: mid.x + 2, tz: mid.z })
    const r = run(h, [], 15)
    expect(r.herd.animals[0].state).toBe('idle')
    expect(r.herd.animals[0].x).toBeCloseTo(mid.x + 2, 0)
  })
})

describe('달아나기', () => {
  it('7m 안에 사람이 오면 반대쪽으로 달리고, 2초 지나 14m 넘게 멀어지면 다시 쉰다', () => {
    const p = at('a', mid.x - 5, mid.z)
    let r = run(one({}), [p], 1)
    expect(r.herd.animals[0].state).toBe('flee')
    expect(r.herd.animals[0].pose).toBe('run')
    expect(r.herd.animals[0].x).toBeGreaterThan(mid.x)
    let t = 0.2
    while (r.herd.animals[0].state === 'flee' && t < 30) {
      r = run(r.herd, [p], 1)
      t += 0.2
    }
    expect(t).toBeGreaterThan(2)
    expect(r.herd.animals[0].state).toBe('idle')
    expect(Math.hypot(r.herd.animals[0].x - p.x, r.herd.animals[0].z - p.z)).toBeGreaterThan(ANIMAL.calmDist)
  })
  it('여럿이면 가장 가까운 사람에게서 달아난다', () => {
    const r = run(one({}), [at('far', mid.x + 6.5, mid.z), at('near', mid.x - 2, mid.z)], 3)
    expect(r.herd.animals[0].x).toBeGreaterThan(mid.x)
  })
  it('들판 밖으로 나가지 않는다', () => {
    const r = run(one({ x: ANIMAL_FIELD.x0 + 1 }), [at('a', ANIMAL_FIELD.x0 + 3, mid.z)], 40)
    for (const a of r.herd.animals) expect(inside(a)).toBe(true)
  })
})

describe('맞기·반격', () => {
  it('큰 동물은 살아남으면 때린 사람을 쫓아 0.5초 뒤 처음, 그 뒤 1.3초마다 들이받는다', () => {
    let h = hitAnimal(one({}), 1, 1, 'me').herd
    expect(h.animals[0]).toMatchObject({ hp: 2, state: 'attack', target: 'me', timer: ANIMAL.giveUp })
    const me = at('me', mid.x + 1, mid.z)
    const r = run(h, [me, at('other', mid.x - 1, mid.z)], 20, 0.1)
    const hits = r.events.filter((e) => e.type === 'attack')
    expect(hits.length).toBe(2)
    expect(hits[0]).toEqual({ type: 'attack', id: 1, target: 'me', dmg: 15 })
    h = r.herd
    expect(h.animals[0].pose).toBe('butt')
  })
  it('멀면 달려가서(쫓을 땐 울타리 바깥까지) 들이받는다', () => {
    const me = at('me', ANIMAL_FIELD.x1 + 6, mid.z)
    const r = run(hitAnimal(one({ x: ANIMAL_FIELD.x1 - 3 }), 1, 1, 'me').herd, [me], 40, 0.1)
    expect(r.events.some((e) => e.type === 'attack')).toBe(true)
    expect(r.herd.animals[0].x).toBeGreaterThan(ANIMAL_FIELD.x1)
    expect(inside(r.herd.animals[0], ANIMAL_CHASE)).toBe(true)
  })
  it('쫓던 사람이 집 안에 들어가거나 나가거나 30m 넘게 멀어지거나 14초가 지나면 포기하고 달아난다', () => {
    const hurt = hitAnimal(one({}), 1, 1, 'me').herd
    expect(stepHerd(hurt, [at('me', mid.x + 3, mid.z, true)], 0.2).herd.animals[0].state).toBe('flee')
    expect(stepHerd(hurt, [at('other', mid.x + 3, mid.z)], 0.2).herd.animals[0].state).toBe('flee')
    expect(stepHerd(hurt, [at('me', mid.x + 31, mid.z)], 0.2).herd.animals[0].state).toBe('flee')
    expect(run(hurt, [at('me', mid.x + 20, mid.z)], Math.ceil(ANIMAL.giveUp / 0.2) + 1).herd.animals[0]).toMatchObject({ target: null })
    expect(run(hurt, [at('me', mid.x + 20, mid.z)], Math.ceil(ANIMAL.giveUp / 0.2) + 1).herd.animals[0].state).not.toBe('attack')
    const r = run(hurt, [at('me', mid.x + 3, mid.z, true)], 5)
    expect(r.events).toEqual([])
  })
  it('토끼·병아리(피해 0)는 맞으면 3초 달아나기만 한다', () => {
    const h = hitAnimal(one({ sp: 'bunny', hp: 2 }), 1, 1, 'me').herd
    expect(h.animals[0]).toMatchObject({ state: 'flee', timer: 3, target: null })
  })
  it('체력이 다하면 쓰러지고 1.4초 뒤 사라진다(gone). 25초 뒤 새 동물이 다음 번호로', () => {
    const k = hitAnimal(one({ hp: 1 }), 1, 2, 'me')
    expect(k.result).toBe('killed')
    expect(k.animal).toMatchObject({ hp: 0, state: 'dead', pose: 'dead' })
    expect(hitAnimal(k.herd, 1, 1, 'me').result).toBe('miss')
    let r = run(k.herd, [], 8)
    expect(r.events).toEqual([{ type: 'gone', id: 1, sp: 'cow', x: mid.x, z: mid.z }])
    expect(r.herd.animals).toEqual([])
    r = run(r.herd, [], Math.ceil(ANIMAL.respawn / 0.2) + 1)
    expect(r.herd.animals.map((a) => a.id)).toEqual([2])
    expect(r.herd.nextId).toBe(3)
  })
  it('없는 동물은 miss', () => {
    expect(hitAnimal(one({}), 99, 1, 'me').result).toBe('miss')
  })
})

describe('진정·보기', () => {
  it('calmHerd: 쫓던 동물은 쉬기로. target 을 주면 그 사람을 쫓던 것만', () => {
    const h = hitAnimal(one({}), 1, 1, 'me').herd
    expect(calmHerd(h, 'other')).toBe(h)
    expect(calmHerd(h, 'me').animals[0]).toMatchObject({ state: 'idle', target: null, timer: 2 })
    expect(calmHerd(h).animals[0].state).toBe('idle')
  })
  it('herdViews 는 그리는 값만', () => {
    expect(herdViews(one({}))).toEqual([{ id: 1, sp: 'cow', x: mid.x, z: mid.z, h: 0, pose: 'idle', hp: 3 }])
  })
  it('받은 무리는 고치지 않는다', () => {
    const h = one({})
    const copy = structuredClone(h)
    stepHerd(h, [at('a', mid.x + 1, mid.z)], 0.5)
    hitAnimal(h, 1, 1, 'a')
    expect(h).toEqual(copy)
  })
})
```

- [ ] **Step 2: 실행해 실패 확인**

Run: `npx vitest run src/game/data/animals.test.ts src/game/data/meadowItems.test.ts src/game/logic/animalSim.test.ts`
Expected: FAIL — `Failed to resolve import "./animals"` / `"./animalSim"`, `DROPS` 가 없다

- [ ] **Step 3: 수치·실내·전리품 표**

`src/game/data/animals.ts` (새 파일):

```ts
import { areaToWorld, type EunjiArea, type Rect } from './meadow'

/**
 * 초원 들판 동물 (은지 animals.js 값 그대로, Kenney Cube Pets CC0).
 * 서버(같이 하기)와 내 화면(혼자)이 같은 시뮬레이션(logic/animalSim)으로 움직이므로 그래픽 없는 TS 값으로 둔다
 */
export type SpeciesId = 'cow' | 'pig' | 'deer' | 'hog' | 'bunny' | 'fox' | 'chick'

/** scale: 모델 배율, hp: 맞아야 하는 횟수, speed·run: 걷기·달리기 (m/s), meat: 은지 표시용, dmg: 들이받는 피해 (0 이면 도망만) */
export type Species = { id: SpeciesId; name: string; scale: number; hp: number; speed: number; run: number; meat: number; dmg: number }

export const SPECIES: Species[] = [
  { id: 'cow', name: '소', scale: 0.8, hp: 3, speed: 1.0, run: 3.0, meat: 3, dmg: 15 },
  { id: 'pig', name: '돼지', scale: 0.6, hp: 2, speed: 1.1, run: 3.2, meat: 2, dmg: 8 },
  { id: 'deer', name: '사슴', scale: 0.8, hp: 2, speed: 1.4, run: 5.0, meat: 2, dmg: 10 },
  { id: 'hog', name: '멧돼지', scale: 0.65, hp: 3, speed: 1.2, run: 4.0, meat: 2, dmg: 14 },
  { id: 'bunny', name: '토끼', scale: 0.3, hp: 1, speed: 1.6, run: 5.0, meat: 1, dmg: 0 },
  { id: 'fox', name: '여우', scale: 0.45, hp: 1, speed: 1.6, run: 5.0, meat: 1, dmg: 6 },
  { id: 'chick', name: '병아리', scale: 0.25, hp: 1, speed: 0.8, run: 2.5, meat: 1, dmg: 0 },
]
export const SPECIES_IDS: SpeciesId[] = SPECIES.map((s) => s.id)
const BY_ID = Object.fromEntries(SPECIES.map((s) => [s.id, s])) as Record<SpeciesId, Species>
export const speciesOf = (id: SpeciesId): Species => BY_ID[id]

/** 은지 animals.js 숫자들 (거리 m, 시간 초) */
export const ANIMAL = {
  /** 동시에 있는 동물 수 */
  count: 12,
  /** 죽은 뒤 새 동물이 나오기까지 */
  respawn: 25,
  /** 이 거리 안에 사람이 오면 달아난다 */
  fleeDist: 7,
  /** 이만큼 멀어지면 다시 어슬렁거린다 */
  calmDist: 14,
  /** 이 거리 안에서 들이받는다 */
  attackDist: 1.5,
  /** 들이받는 간격 */
  attackCool: 1.3,
  /** 맞고 반격을 시작할 때 첫 들이받기까지 */
  firstAttack: 0.5,
  /** 이만큼 쫓다가 포기한다 */
  giveUp: 14,
  /** 이만큼 멀어지면 포기 */
  loseDist: 30,
  /** 쓰러져 있다가 사라지기까지 (사라질 때 전리품이 보인다) */
  corpse: 1.4,
  /** 옆으로 넘어지는 시간 */
  fall: 0.5,
  /** 맞으면 빨갛게 번쩍이는 시간 */
  flash: 0.15,
  /** 전리품 줍는 거리 (E) */
  pickDist: 1.6,
  /** 들판 가장자리에서 이만큼 안쪽에 태어난다 / 가장자리에 몰리면 비스듬히 튼다 */
  edge: 2,
}

/** 은지 들판 (은지 outdoor.js ANIMAL_ZONE, 은지 좌표. 같은지 테스트) */
export const EUNJI_ANIMAL_ZONE: EunjiArea = { minX: -6, maxX: 34, minZ: 26, maxZ: 52 }
/** 동물이 돌아다니는 들판 (세계 좌표: x 166..206, z -52..-26) */
export const ANIMAL_FIELD: Rect = areaToWorld(EUNJI_ANIMAL_ZONE)
/** 쫓아올 때 움직일 수 있는 곳: 들판보다 넓게, 울타리 바로 바깥까지 (은지 AGGRO_ZONE. 세계 x 156..216, z -58..-24) */
export const ANIMAL_CHASE: Rect = areaToWorld({ minX: EUNJI_ANIMAL_ZONE.minX - 10, maxX: EUNJI_ANIMAL_ZONE.maxX + 10, minZ: 24, maxZ: EUNJI_ANIMAL_ZONE.maxZ + 6 })

/**
 * 판정 원 반지름 (m). 은지는 메시에 광선을 쐈지만 우리는 바닥의 원으로 본다:
 * 큐브 동물 몸통 반폭(배율 1 에서 약 0.65) × 배율, 병아리처럼 아주 작은 동물도 0.35 는 된다
 */
export function hitRadius(id: SpeciesId): number {
  return Math.max(0.35, 0.65 * speciesOf(id).scale)
}
```

`src/game/data/meadow.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/data/meadow.ts b/src/game/data/meadow.ts
--- a/src/game/data/meadow.ts
+++ b/src/game/data/meadow.ts
@@ -39,6 +39,20 @@ export const MEADOW_DOCK_TOP = 0.1
 /** 선착장 위 걸을 수 있는 곳. 초원 땅(x 91)과 겹치게 x 91.5 까지 */
 export const MEADOW_DOCK_LAND: Rect = { x0: 84.5, x1: 91.5, z0: -3.2, z1: -0.8 }
 
+/** 은지 집 실내 방 4개 (은지 world.js ROOMS: 침실·거실·주방·사격장, 은지 좌표. 같은지 테스트) */
+export const MEADOW_ROOMS: EunjiArea[] = [
+  { minX: -5, maxX: 5, minZ: -5, maxZ: 5 },
+  { minX: 5, maxX: 15, minZ: -5, maxZ: 5 },
+  { minX: 5, maxX: 13, minZ: -13, maxZ: -5 },
+  { minX: 15, maxX: 27, minZ: -5, maxZ: 5 },
+]
+
+/** 세계 (x, z) 가 은지 집 안인가. 은지 roomAt 처럼 maxX 는 빼고 maxZ 는 넣는다 (동물이 쫓기를 포기한다) */
+export function isIndoor(x: number, z: number): boolean {
+  const [lx, lz] = toMeadowLocal(x, z)
+  return MEADOW_ROOMS.some((r) => lx >= r.minX && lx < r.maxX && lz >= r.minZ && lz <= r.maxZ)
+}
+
 /** 은지 침실 침대 (은지 world.bedSpot 3.5, 3.6) */
 export const BED_SPOT: [number, number] = toWorld(3.5, 3.6)
 /** E "잠자기" 감지 상자: 침대와 그 앞을 덮고 침실 벽(은지 x 5, z 5) 밖으로 나가지 않는다 (은지 2m 와 비슷) */
```

`src/game/data/meadowItems.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/data/meadowItems.ts b/src/game/data/meadowItems.ts
--- a/src/game/data/meadowItems.ts
+++ b/src/game/data/meadowItems.ts
@@ -1,3 +1,5 @@
+import type { SpeciesId } from './animals'
+
 /**
  * 은지 게임 식재료·요리·배합법 (은지 `src/meadow/vendor/items.js` 값을 그대로 옮긴 것. 같은지 meadowItems.test 가 본다).
  * 서버(3-3 전리품)와 같이 하기 메시지(먹는 요리)도 쓰므로 은지 JS 가 아닌 TS 데이터로 둔다
@@ -94,3 +96,21 @@ export function getRecipe(id: MeadowDishId): Recipe {
 
 export const hasTag = (id: ItemId, tag: ItemTag): boolean => ITEMS[id].tags.includes(tag)
 export const isMeadowDish = (id: string): id is MeadowDishId => (MEADOW_DISH_IDS as string[]).includes(id)
+
+/** 동물마다 떨어뜨리는 것 (은지 items.js DROPS). p 가 있으면 그 확률로만 */
+export const DROPS: Record<SpeciesId, { id: RawItemId; n: number; p?: number }[]> = {
+  cow: [{ id: 'beef', n: 2 }, { id: 'bone', n: 1 }],
+  pig: [{ id: 'pork', n: 2 }, { id: 'fat', n: 1 }],
+  hog: [{ id: 'boar', n: 2 }, { id: 'fat', n: 1, p: 0.6 }, { id: 'bone', n: 1, p: 0.5 }],
+  deer: [{ id: 'venison', n: 2 }, { id: 'bone', n: 1, p: 0.6 }],
+  bunny: [{ id: 'rabbit', n: 1 }],
+  fox: [{ id: 'foxmeat', n: 1 }],
+  chick: [{ id: 'chicken', n: 1 }, { id: 'egg', n: 1, p: 0.5 }],
+}
+
+/** 전리품 굴리기 (은지 rollDrops). rng: 0 이상 1 미만 */
+export function rollDrops(species: SpeciesId, rng: () => number = Math.random): RawItemId[] {
+  const out: RawItemId[] = []
+  for (const d of DROPS[species]) if (d.p === undefined || rng() < d.p) for (let k = 0; k < d.n; k++) out.push(d.id)
+  return out
+}
```

`src/meadow/vendor/items.d.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/meadow/vendor/items.d.ts b/src/meadow/vendor/items.d.ts
--- a/src/meadow/vendor/items.d.ts
+++ b/src/meadow/vendor/items.d.ts
@@ -2,3 +2,4 @@
 export const ITEMS: Record<string, { name: string; icon: string; tags: string[]; sate?: number; desc: string }>
 export const RECIPES: { id: string; name: string; time: number; ingredients: ({ id: string; n: number } | { tag: string; n: number })[]; result: string }[]
 export function hasTag(id: string, tag: string): boolean
+export const DROPS: Record<string, { id: string; n: number; p?: number }[]>
```

- [ ] **Step 4: 시뮬레이션**

은지 `Animal.update`·`createAnimals.update`·`hit`·`calmAll` 을 옮긴다. 받은 무리는 고치지 않고(동물마다 얕은 복사본을 고친다) 새 무리를 돌려준다. 그래픽(재질 번쩍·넘어짐·부드러운 회전)은 Task 6 의 그리는 쪽 일이다.

`src/game/logic/animalSim.ts` (새 파일):

```ts
import { ANIMAL, ANIMAL_CHASE, ANIMAL_FIELD, SPECIES, speciesOf, type SpeciesId } from '../data/animals'
import type { Rect } from '../data/meadow'
import type { Rng } from './rng'

/**
 * 들판 동물 시뮬레이션 (은지 animals.js 의 상태 기계를 그래픽 없이 옮긴 것). 세계 좌표.
 * 같이 하기에선 서버(rinfish-rooms)가 200ms 마다, 혼자 할 때는 내 화면이 매 프레임 같은 함수로 돌린다.
 * 받은 무리(herd)는 고치지 않고 새 무리를 돌려준다
 */

/** idle: 서서 풀 뜯기·쉬기, walk: 목적지로 어슬렁, flee: 사람 반대쪽으로 달아남, attack: 때린 사람을 쫓아 들이받음, dead: 쓰러짐 */
export type AnimalState = 'idle' | 'walk' | 'flee' | 'attack' | 'dead'
/** 그릴 동작 (클립): idle·eat(풀 뜯기)·walk·run, butt = 들이받기(eat 클립), dead = 쓰러짐 */
export type AnimalPose = 'idle' | 'eat' | 'walk' | 'run' | 'butt' | 'dead'
export const ANIMAL_POSES: AnimalPose[] = ['idle', 'eat', 'walk', 'run', 'butt', 'dead']

export type Animal = {
  id: number
  sp: SpeciesId
  x: number
  z: number
  /** 바라보는 각도 (0 = +z, atan2(dx, dz)) */
  h: number
  hp: number
  state: AnimalState
  pose: AnimalPose
  /** 지금 상태에서 남은 시간 (idle 쉬기·flee 최소 시간·attack 포기까지·dead 사라지기까지) */
  timer: number
  /** 다음 들이받기까지 */
  atkCool: number
  /** 어슬렁거릴 목적지 */
  tx: number
  tz: number
  /** 쫓는 사람 (attack 일 때만) */
  target: string | null
}

/** 동물들과 다시 나올 차례 (남은 초), 다음 번호 */
export type Herd = { animals: Animal[]; respawn: number[]; nextId: number }
/** 사람 한 명 (세계 좌표). indoor: 은지 집 안 (쫓던 동물이 포기한다) */
export type HerdPlayer = { id: string; x: number; z: number; indoor: boolean }
/** attack: 들이받았다 (target 에게 dmg), gone: 쓰러져 있던 동물이 사라졌다 */
export type HerdEvent = { type: 'attack'; id: number; target: string; dmg: number } | { type: 'gone'; id: number; sp: SpeciesId; x: number; z: number }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const inRect = (r: Rect, rng: Rng, margin: number) => ({ x: r.x0 + margin + rng() * (r.x1 - r.x0 - 2 * margin), z: r.z0 + margin + rng() * (r.z1 - r.z0 - 2 * margin) })

function spawn(id: number, sp: SpeciesId, rng: Rng): Animal {
  const p = inRect(ANIMAL_FIELD, rng, ANIMAL.edge)
  return { id, sp, x: p.x, z: p.z, h: rng() * Math.PI * 2, hp: speciesOf(sp).hp, state: 'idle', pose: 'idle', timer: 1 + rng() * 3, atkCool: 0, tx: p.x, tz: p.z, target: null }
}

/** 처음 무리: 7종을 차례로 12마리 (은지 그대로) */
export function newHerd(rng: Rng = Math.random): Herd {
  const animals = Array.from({ length: ANIMAL.count }, (_, i) => spawn(i + 1, SPECIES[i % SPECIES.length].id, rng))
  return { animals, respawn: [], nextId: ANIMAL.count + 1 }
}

/** 가장 가까운 사람까지 거리와 그 사람 (없으면 Infinity) */
function nearest(a: Animal, players: readonly HerdPlayer[]): { d: number; p: HerdPlayer | null } {
  let best: HerdPlayer | null = null
  let d = Infinity
  for (const p of players) {
    const dd = Math.hypot(p.x - a.x, p.z - a.z)
    if (dd < d) {
      d = dd
      best = p
    }
  }
  return { d, p: best }
}

/** 한 마리 dt 초. a 는 이미 복사본이라 고친다. 들이받으면 사건을 넣는다 */
function stepOne(a: Animal, players: readonly HerdPlayer[], dt: number, rng: Rng, events: HerdEvent[]) {
  const sp = speciesOf(a.sp)
  const near = nearest(a, players)
  if (a.state !== 'flee' && a.state !== 'attack' && near.d < ANIMAL.fleeDist) {
    a.state = 'flee'
    a.timer = 2
  }
  let speed = 0
  if (a.state === 'attack') {
    // 반격: 때린 사람을 향해 달리고, 닿으면 간격을 두고 들이받는다. 너무 오래·멀리·실내(또는 나감)면 포기하고 달아난다
    a.timer -= dt
    const t = players.find((p) => p.id === a.target)
    const dT = t ? Math.hypot(t.x - a.x, t.z - a.z) : Infinity
    if (!t || t.indoor || a.timer <= 0 || dT > ANIMAL.loseDist) {
      a.state = 'flee'
      a.timer = 2.5
      a.target = null
    } else {
      a.h = Math.atan2(t.x - a.x, t.z - a.z)
      a.atkCool -= dt
      if (dT > ANIMAL.attackDist) {
        speed = sp.run
        a.pose = 'run'
      } else {
        a.pose = 'butt'
        if (a.atkCool <= 0) {
          a.atkCool = ANIMAL.attackCool
          events.push({ type: 'attack', id: a.id, target: t.id, dmg: sp.dmg })
        }
      }
    }
  }
  if (a.state === 'flee') {
    // 가장 가까운 사람 반대쪽으로. 들판 가장자리에 몰리면 비스듬히 튼다
    if (near.p) {
      let vx = a.x - near.p.x
      let vz = a.z - near.p.z
      const F = ANIMAL_FIELD
      const M = ANIMAL.edge
      if ((a.x < F.x0 + M && vx < 0) || (a.x > F.x1 - M && vx > 0)) vx = -vx
      if ((a.z < F.z0 + M && vz < 0) || (a.z > F.z1 - M && vz > 0)) vz = -vz
      if (vx !== 0 || vz !== 0) a.h = Math.atan2(vx, vz)
    }
    speed = sp.run
    a.pose = 'run'
    a.timer -= dt
    if (a.timer <= 0 && near.d > ANIMAL.calmDist) {
      a.state = 'idle'
      a.timer = 1 + rng() * 2
    }
  } else if (a.state === 'walk') {
    const dx = a.tx - a.x
    const dz = a.tz - a.z
    if (Math.hypot(dx, dz) < 0.3) {
      a.state = 'idle'
      a.timer = 1.5 + rng() * 3
    } else {
      a.h = Math.atan2(dx, dz)
      speed = sp.speed
      a.pose = 'walk'
    }
  } else if (a.state === 'idle') {
    a.pose = a.timer > 2 ? 'eat' : 'idle'
    a.timer -= dt
    if (a.timer <= 0) {
      a.state = 'walk'
      const p = inRect(ANIMAL_FIELD, rng, 0)
      a.tx = p.x
      a.tz = p.z
    }
  }
  if (speed > 0) {
    // 걷는 거리는 들판 안 (쫓을 땐 울타리 바로 바깥까지 넓게)
    const R = a.state === 'attack' ? ANIMAL_CHASE : ANIMAL_FIELD
    a.x = clamp(a.x + Math.sin(a.h) * speed * dt, R.x0, R.x1)
    a.z = clamp(a.z + Math.cos(a.h) * speed * dt, R.z0, R.z1)
  }
}

/**
 * dt 초 진행. 쓰러진 동물은 ANIMAL.corpse 초 뒤 사라지고(gone) ANIMAL.respawn 초 뒤 아무 종이나 새로 나온다.
 * players: 들판을 보는 모든 사람 (달아나기는 가장 가까운 사람, 쫓기는 때린 사람)
 */
export function stepHerd(herd: Herd, players: readonly HerdPlayer[], dt: number, rng: Rng = Math.random): { herd: Herd; events: HerdEvent[] } {
  const events: HerdEvent[] = []
  const animals: Animal[] = []
  const respawn: number[] = []
  for (const r of herd.respawn) respawn.push(r - dt)
  for (const old of herd.animals) {
    const a = { ...old }
    if (a.state === 'dead') {
      a.timer -= dt
      if (a.timer <= 0) {
        events.push({ type: 'gone', id: a.id, sp: a.sp, x: a.x, z: a.z })
        respawn.push(ANIMAL.respawn)
        continue
      }
    } else {
      stepOne(a, players, dt, rng, events)
    }
    animals.push(a)
  }
  let nextId = herd.nextId
  const waiting: number[] = []
  for (const r of respawn) {
    if (r > 0) waiting.push(r)
    else animals.push(spawn(nextId++, SPECIES[Math.floor(rng() * SPECIES.length) % SPECIES.length].id, rng))
  }
  return { herd: { animals, respawn: waiting, nextId }, events }
}

/** 맞은 결과: miss = 없거나 이미 쓰러짐, hurt = 살아남음 (큰 동물은 때린 사람에게 반격, 작은 동물은 도망), killed = 쓰러짐 */
export type HitResult = { herd: Herd; result: 'miss' | 'hurt' | 'killed'; animal: Animal | null }

/** 동물 id 를 dmg 만큼 때렸다 (by: 때린 사람) */
export function hitAnimal(herd: Herd, id: number, dmg: number, by: string): HitResult {
  const old = herd.animals.find((a) => a.id === id)
  if (!old || old.state === 'dead') return { herd, result: 'miss', animal: old ?? null }
  const a: Animal = { ...old, hp: Math.max(0, old.hp - dmg) }
  let result: HitResult['result'] = 'hurt'
  if (a.hp > 0) {
    if (speciesOf(a.sp).dmg > 0) Object.assign(a, { state: 'attack', timer: ANIMAL.giveUp, atkCool: ANIMAL.firstAttack, target: by })
    else Object.assign(a, { state: 'flee', timer: 3, target: null })
  } else {
    Object.assign(a, { state: 'dead', pose: 'dead', timer: ANIMAL.corpse, target: null })
    result = 'killed'
  }
  return { herd: { ...herd, animals: herd.animals.map((x) => (x.id === id ? a : x)) }, result, animal: a }
}

/** 쫓던 동물을 진정시킨다 (죽어 침대에서 깨어날 때). target 을 주면 그 사람을 쫓던 동물만 */
export function calmHerd(herd: Herd, target?: string): Herd {
  if (!herd.animals.some((a) => a.state === 'attack' && (target === undefined || a.target === target))) return herd
  const animals = herd.animals.map((a): Animal => (a.state === 'attack' && (target === undefined || a.target === target) ? { ...a, state: 'idle', pose: 'idle', timer: 2, target: null } : a))
  return { ...herd, animals }
}

/** 그리는 데 필요한 것만 (서버가 보내는 값) */
export type AnimalView = { id: number; sp: SpeciesId; x: number; z: number; h: number; pose: AnimalPose; hp: number }

export function herdViews(herd: Herd): AnimalView[] {
  return herd.animals.map((a) => ({ id: a.id, sp: a.sp, x: a.x, z: a.z, h: a.h, pose: a.pose, hp: a.hp }))
}
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run && npx tsc -b && npm run lint 2>&1 | grep -c warning`
Expected: 69 파일 / 706 개 통과, tsc 출력 없음, `6`

- [ ] **Step 6: 커밋**

```bash
git add src/game/data/animals.ts \
  src/game/data/animals.test.ts \
  src/game/data/meadow.ts \
  src/game/data/meadowItems.ts \
  src/game/data/meadowItems.test.ts \
  src/game/logic/animalSim.ts \
  src/game/logic/animalSim.test.ts \
  src/meadow/vendor/items.d.ts
git commit -F - <<'EOF'
feat: 들판 동물 시뮬레이션

은지 animals.js 상태 기계(쉬기·어슬렁·달아나기·반격·쓰러짐)를 그래픽 없는 logic/animalSim 으로 옮긴다.
동물 7종 수치·들판(세계 좌표)·실내 방·전리품 표(DROPS)·rollDrops 를 TS 데이터로 둔다.
서버와 내 화면이 같은 코드를 쓴다.
EOF
```

검증한 스크래치 커밋: `e7f6f0a` (이 커밋의 diff 를 그대로 적용해도 된다: `git -C /private/tmp/claude-501/-Users-ihyelin-proten-hrlee-----threejs/e476c70e-362f-4ed3-9ff7-d8664da04e4b/scratchpad/plan-3-3/repo format-patch -1 --binary e7f6f0a --stdout | git apply --index` 한 뒤 위 커밋 명령. 스크래치 커밋의 작성자는 scratch 라 `git am` 은 쓰지 않는다)


### Task 3: 동물·사냥 메시지와 서버 명중 검사  — 스크래치 `5ca97de`

**Files:**
- Create: `src/game/data/melee.ts`
- Modify: `src/game/logic/netProtocol.ts`, `src/game/data/net.ts`, `server/src/roomRules.ts`, `server/src/room.ts`
- Test: `src/game/data/melee.test.ts`, `src/game/logic/netProtocol.test.ts`, `server/src/roomRules.test.ts`

**Interfaces:**
- Consumes: `SPECIES_IDS`, `hitRadius` (Task 2), `ANIMAL_POSES`, `AnimalView` (Task 2), `RawItemId` (`data/meadowItems`), `ToolId` (`data/tools`)
- Produces:
  - `type MeleeId = 'fists' | 'knife' | 'stab'`, `MELEE_IDS`, `MELEE: Record<MeleeId, { name; dur; hitAt; reach; cool; dmg; serverCool }>`, `meleeFor(tool: ToolId | null, secondary: boolean): MeleeId | null`, `hitDelay(id): number` (`data/melee.ts`)
  - `NET.animalEvery = 0.2`, `NET.maxAnimals = 64`, `NET.hitSlack = 2.5`
  - `ClientMsg` 에 `{ type: 'animalHit'; id: number; dmg: number; w: MeleeId }`, `type AnimalTuple = [number, number, number, number, number, number, number]`, `type HurtBy = 'animal'`, `ServerMsg` 에 `{ type: 'animals'; list: AnimalTuple[] }`·`{ type: 'loot'; items: RawItemId[]; x: number; z: number }`·`{ type: 'hurt'; dmg: number; by: HurtBy; from?: string }`, `packAnimals(list: AnimalView[]): AnimalTuple[]`, `unpackAnimals(list: AnimalTuple[]): AnimalView[]` (`logic/netProtocol.ts`)
  - `Member.lastHit: number` (3-3 전 소켓은 `-Infinity`), `judgeAnimalHit(member, msg, animal: AnimalView | undefined, nowSec): { ok: true; dmg; member } | { ok: false }` (`server/src/roomRules.ts`)

- [ ] **Step 1: 실패하는 테스트 쓰기**

`src/game/data/melee.test.ts` (새 파일):

```ts
import { describe, expect, it } from 'vitest'
import { MELEE, hitDelay, meleeFor } from './melee'

describe('근접 공격', () => {
  it('주먹은 왼쪽만, 칼은 왼쪽 베기·오른쪽 찌르기, 낚싯대·빈손은 없다', () => {
    expect(meleeFor('fists', false)).toBe('fists')
    expect(meleeFor('fists', true)).toBeNull()
    expect(meleeFor('knife', false)).toBe('knife')
    expect(meleeFor('knife', true)).toBe('stab')
    expect(meleeFor('rod', false)).toBeNull()
    expect(meleeFor(null, false)).toBeNull()
  })
  it('은지 시간표: 맞는 순간은 주먹 0.152초·베기 0.126초·찌르기 0.285초 뒤, 서버 간격은 내 화면 간격보다 짧다', () => {
    expect(hitDelay('fists')).toBeCloseTo(0.152)
    expect(hitDelay('knife')).toBeCloseTo(0.126)
    expect(hitDelay('stab')).toBeCloseTo(0.2852)
    for (const m of Object.values(MELEE)) expect(m.serverCool).toBeLessThan(m.cool)
  })
})
```

`src/game/logic/netProtocol.test.ts` — 3-1 의 "아직 모르는 종류" 점검은 3-4 의 kill 로 바꾼다 (animals 는 이제 읽는다) (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/logic/netProtocol.test.ts b/src/game/logic/netProtocol.test.ts
--- a/src/game/logic/netProtocol.test.ts
+++ b/src/game/logic/netProtocol.test.ts
@@ -3,7 +3,7 @@ import { DEFAULT_LOOK } from '../data/characterParts'
 import { DISHES } from '../data/dishes'
 import { SNACK_IDS } from '../data/snacks'
 import { IDLE_ACTION, type PlayerAction } from './playerMotion'
-import { fromNetAct, parseClientMsg, parseServerMsg, roundState, stateKey, toNetAct, type NetState } from './netProtocol'
+import { fromNetAct, packAnimals, parseClientMsg, parseServerMsg, roundState, stateKey, toNetAct, unpackAnimals, type NetState } from './netProtocol'
 
 const state = (over: Partial<NetState> = {}): NetState => ({
   p: [1, 2, 3], f: 0.5, v: 1, rest: false, fish: null, rod: 0.5, rodOn: true, bob: null,
@@ -92,8 +92,8 @@ describe('시계·잠 투표 메시지 (3-1)', () => {
     expect(parseServerMsg(json({ type: 'morning', day: 4 }))).toEqual({ type: 'morning', day: 4 })
     expect(parseServerMsg(json({ type: 'morning', day: 'x' }))).toBeNull()
   })
-  it('아직 모르는 종류(3-3 이후 animals 등)는 버린다', () => {
-    expect(parseServerMsg(json({ type: 'animals', list: [] }))).toBeNull()
+  it('아직 모르는 종류(3-4 이후 kill 등)는 버린다', () => {
+    expect(parseServerMsg(json({ type: 'kill', victim: 'a', killer: 'b' }))).toBeNull()
   })
 })
 
@@ -225,3 +225,38 @@ describe('손에 든 도구 (3-2)', () => {
     expect(stateKey({ ...state(), tool: 'knife' })).not.toBe(stateKey({ ...state(), tool: 'fists' }))
   })
 })
+
+describe('동물·사냥 메시지 (3-3)', () => {
+  it('animalHit {id, dmg, w} 를 읽고, 틀리면 null', () => {
+    expect(parseClientMsg(json({ type: 'animalHit', id: 4, dmg: 2, w: 'stab' }))).toEqual({ type: 'animalHit', id: 4, dmg: 2, w: 'stab' })
+    expect(parseClientMsg(json({ type: 'animalHit', id: 0, dmg: 1, w: 'knife' }))).toBeNull()
+    expect(parseClientMsg(json({ type: 'animalHit', id: 4, dmg: 1, w: 'pistol' }))).toBeNull()
+    expect(parseClientMsg(json({ type: 'animalHit', id: 4, dmg: 99, w: 'fists' }))).toBeNull()
+    expect(parseClientMsg(json({ type: 'animalHit', id: 1.5, dmg: 1, w: 'fists' }))).toBeNull()
+  })
+  it('animals 는 짧은 배열로 보내고(소수 둘째 자리) 받으면 그리는 값으로 되돌린다', () => {
+    const view = { id: 3, sp: 'deer' as const, x: 180.123, z: -40.456, h: -1.234, pose: 'run' as const, hp: 2 }
+    const list = packAnimals([view])
+    expect(list).toEqual([[3, 2, 180.12, -40.46, -1.23, 3, 2]])
+    const msg = parseServerMsg(json({ type: 'animals', list }))
+    expect(msg).toEqual({ type: 'animals', list })
+    expect(unpackAnimals(list)).toEqual([{ ...view, x: 180.12, z: -40.46, h: -1.23 }])
+  })
+  it('animals 의 틀린 동물만 빼고, 목록이 아니거나 너무 길면 null', () => {
+    const good = [1, 0, 180, -40, 0, 0, 3]
+    expect(parseServerMsg(json({ type: 'animals', list: [good, [1, 9, 0, 0, 0, 0, 3], [2, 0, 999, 0, 0, 0, 1], 'x'] }))).toEqual({ type: 'animals', list: [good] })
+    expect(parseServerMsg(json({ type: 'animals', list: 'nope' }))).toBeNull()
+    expect(parseServerMsg(json({ type: 'animals', list: Array.from({ length: 65 }, () => good) }))).toBeNull()
+  })
+  it('loot {items, x, z}: 은지 재료만, 하나라도 틀리면 null', () => {
+    expect(parseServerMsg(json({ type: 'loot', items: ['beef', 'beef', 'bone'], x: 181, z: -40 }))).toEqual({ type: 'loot', items: ['beef', 'beef', 'bone'], x: 181, z: -40 })
+    expect(parseServerMsg(json({ type: 'loot', items: ['steak'], x: 181, z: -40 }))).toBeNull()
+    expect(parseServerMsg(json({ type: 'loot', items: ['beef'] }))).toBeNull()
+  })
+  it('hurt {dmg, by, from?}', () => {
+    expect(parseServerMsg(json({ type: 'hurt', dmg: 15, by: 'animal' }))).toEqual({ type: 'hurt', dmg: 15, by: 'animal' })
+    expect(parseServerMsg(json({ type: 'hurt', dmg: 15, by: 'animal', from: 'ab12' }))).toEqual({ type: 'hurt', dmg: 15, by: 'animal', from: 'ab12' })
+    expect(parseServerMsg(json({ type: 'hurt', dmg: -1, by: 'animal' }))).toBeNull()
+    expect(parseServerMsg(json({ type: 'hurt', dmg: 5, by: 'ghost' }))).toBeNull()
+  })
+})
```

`server/src/roomRules.test.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/server/src/roomRules.test.ts b/server/src/roomRules.test.ts
--- a/server/src/roomRules.test.ts
+++ b/server/src/roomRules.test.ts
@@ -2,7 +2,8 @@ import { describe, expect, it } from 'vitest'
 import { DEFAULT_LOOK } from '../../src/game/data/characterParts'
 import type { ClientMsg, NetState } from '../../src/game/logic/netProtocol'
 import { NEW_WINDOW } from '../../src/game/logic/rateLimit'
-import { handleMemberMsg, judgeHello, justAfterMorning, memberFrom, tallySleep, type Member, type RoomMeta } from './roomRules'
+import type { AnimalView } from '../../src/game/logic/animalSim'
+import { handleMemberMsg, judgeAnimalHit, judgeHello, justAfterMorning, memberFrom, tallySleep, type Member, type RoomMeta } from './roomRules'
 
 const hello = (mode: 'create' | 'join', passHash = 'a'.repeat(64)): Extract<ClientMsg, { type: 'hello' }> => ({ type: 'hello', v: 1, mode, passHash, nick: '혜린', look: DEFAULT_LOOK })
 const DAY = 86_400_000
@@ -36,7 +37,7 @@ describe('judgeHello', () => {
 
 describe('handleMemberMsg', () => {
   const s: NetState = { p: [0, 1, 0], f: 0, v: 0, rest: false, fish: null, rod: 0.5, rodOn: true, bob: null, act: { emote: null, emoteAge: 30, airAge: null, landedAge: 30, eat: null, eatAge: 30 } }
-  const me: Member = { id: 'm1', nick: '혜린', look: DEFAULT_LOOK, joinedAt: 0, s: null, stateWin: NEW_WINDOW, lastChat: -Infinity, lastProfile: -Infinity, sleeping: false, sleepWin: NEW_WINDOW }
+  const me: Member = { id: 'm1', nick: '혜린', look: DEFAULT_LOOK, joinedAt: 0, s: null, stateWin: NEW_WINDOW, lastChat: -Infinity, lastProfile: -Infinity, sleeping: false, sleepWin: NEW_WINDOW, lastHit: -Infinity }
 
   it('state 는 저장하고 내 id 를 붙여 나눠 준다. 초당 10번 넘으면 버린다', () => {
     let m = me
@@ -83,9 +84,14 @@ describe('handleMemberMsg', () => {
 })
 
 describe('memberFrom', () => {
+  it('3-3 전 붙임 정보(lastHit 없음)는 한 번도 안 때린 사람', () => {
+    const old = { id: 'o1', nick: '옛', look: DEFAULT_LOOK, joinedAt: 1, s: null, stateWin: NEW_WINDOW, lastChat: 2, lastProfile: 3, sleeping: true, sleepWin: NEW_WINDOW }
+    expect(memberFrom(old).lastHit).toBe(-Infinity)
+    expect(memberFrom({ ...old, lastHit: 7 }).lastHit).toBe(7)
+  })
   it('3-1 전 붙임 정보(잠 필드 없음)는 안 자는 사람·새 창으로 읽고, phase 같은 다른 필드는 버린다', () => {
     const old = { phase: 'in', id: 'o1', nick: '옛', look: DEFAULT_LOOK, joinedAt: 1, s: null, stateWin: NEW_WINDOW, lastChat: 2, lastProfile: 3 }
-    expect(memberFrom(old)).toEqual({ id: 'o1', nick: '옛', look: DEFAULT_LOOK, joinedAt: 1, s: null, stateWin: NEW_WINDOW, lastChat: 2, lastProfile: 3, sleeping: false, sleepWin: NEW_WINDOW })
+    expect(memberFrom(old)).toEqual({ id: 'o1', nick: '옛', look: DEFAULT_LOOK, joinedAt: 1, s: null, stateWin: NEW_WINDOW, lastChat: 2, lastProfile: 3, sleeping: false, sleepWin: NEW_WINDOW, lastHit: -Infinity })
     expect(memberFrom({ ...old, sleeping: true, sleepWin: { start: 5, count: 2 } })).toMatchObject({ sleeping: true, sleepWin: { start: 5, count: 2 } })
   })
 })
@@ -117,3 +123,37 @@ describe('justAfterMorning', () => {
     expect(justAfterMorning({ epoch: 10_000, day0: 3 }, 9_000)).toBe(false)
   })
 })
+
+describe('judgeAnimalHit', () => {
+  const s: NetState = { p: [180, 1, -40], f: 0, v: 0, rest: false, fish: null, rod: 0.5, rodOn: true, bob: null, act: { emote: null, emoteAge: 30, airAge: null, landedAge: 30, eat: null, eatAge: 30 } }
+  const me = memberFrom({ id: 'm1', nick: '혜린', look: DEFAULT_LOOK, joinedAt: 0, s, stateWin: NEW_WINDOW, lastChat: -Infinity, lastProfile: -Infinity })
+  const cow: AnimalView = { id: 4, sp: 'cow', x: 181.5, z: -40, h: 0, pose: 'idle', hp: 3 }
+  const hit = (w: 'fists' | 'knife' | 'stab', dmg = 9): Extract<ClientMsg, { type: 'animalHit' }> => ({ type: 'animalHit', id: 4, dmg, w })
+
+  it('가까운 살아 있는 동물: 피해는 공격 표 값 (보낸 dmg 는 믿지 않는다), 마지막 명중 시각을 남긴다', () => {
+    expect(judgeAnimalHit(me, hit('knife'), cow, 10)).toEqual({ ok: true, dmg: 1, member: { ...me, lastHit: 10 } })
+    expect(judgeAnimalHit(me, hit('stab'), cow, 10)).toMatchObject({ ok: true, dmg: 2 })
+    expect(judgeAnimalHit(me, hit('fists'), cow, 10)).toMatchObject({ ok: true, dmg: 1 })
+  })
+  it('공격 종류별 최소 간격 안에 또 오면 버린다 (주먹 0.3·칼 0.4·찌르기 0.7초)', () => {
+    const after = { ...me, lastHit: 10 }
+    expect(judgeAnimalHit(after, hit('fists'), cow, 10.29)).toEqual({ ok: false })
+    expect(judgeAnimalHit(after, hit('fists'), cow, 10.31)).toMatchObject({ ok: true })
+    expect(judgeAnimalHit(after, hit('knife'), cow, 10.39)).toEqual({ ok: false })
+    expect(judgeAnimalHit(after, hit('stab'), cow, 10.69)).toEqual({ ok: false })
+    expect(judgeAnimalHit(after, hit('stab'), cow, 10.71)).toMatchObject({ ok: true })
+  })
+  it('사거리 + 판정 원 + 여유 2.5m 보다 멀면 버린다', () => {
+    // 칼 1.8 + 소 0.52 + 2.5 = 4.82
+    expect(judgeAnimalHit(me, hit('knife'), { ...cow, x: 180 + 4.8 }, 10)).toMatchObject({ ok: true })
+    expect(judgeAnimalHit(me, hit('knife'), { ...cow, x: 180 + 4.9 }, 10)).toEqual({ ok: false })
+  })
+  it('모습을 안 보낸 사람, 없는 동물, 쓰러진 동물은 버린다', () => {
+    expect(judgeAnimalHit({ ...me, s: null }, hit('knife'), cow, 10)).toEqual({ ok: false })
+    expect(judgeAnimalHit(me, hit('knife'), undefined, 10)).toEqual({ ok: false })
+    expect(judgeAnimalHit(me, hit('knife'), { ...cow, pose: 'dead', hp: 0 }, 10)).toEqual({ ok: false })
+  })
+  it('handleMemberMsg 는 animalHit 을 남에게 넘기지 않는다', () => {
+    expect(handleMemberMsg(me, hit('knife'), 10)).toEqual({ member: me, out: null })
+  })
+})
```

- [ ] **Step 2: 실행해 실패 확인**

Run: `npx vitest run src/game/data/melee.test.ts src/game/logic/netProtocol.test.ts server/src/roomRules.test.ts`
Expected: FAIL — `Failed to resolve import "./melee"`, `packAnimals is not a function`, `judgeAnimalHit is not a function`, memberFrom 결과에 `lastHit` 이 없다

- [ ] **Step 3: 근접 공격 표**

`src/game/data/melee.ts` (새 파일):

```ts
import type { ToolId } from './tools'

/** 근접 공격: 주먹, 칼 베기(마우스 왼쪽), 칼 찌르기(마우스 오른쪽) */
export type MeleeId = 'fists' | 'knife' | 'stab'
export const MELEE_IDS: MeleeId[] = ['fists', 'knife', 'stab']

/**
 * 은지 weapons.js 값. dur: 동작 시간(초), hitAt: 맞는 순간 (동작 진행도, 휘두른 뒤 칼이 뻗는 때 판정한다),
 * reach: 사거리(m), cool: 다음 공격까지(초. 주먹 0.45, 칼 rpm 110, 찌르기 0.85), dmg: 동물 피해 (찌르기 2, 나머지 1).
 * serverCool: 같이 하기 서버가 받는 최소 간격(초, 스펙: 주먹 300ms·칼 400ms·찌르기 700ms)
 */
export const MELEE: Record<MeleeId, { name: string; dur: number; hitAt: number; reach: number; cool: number; dmg: number; serverCool: number }> = {
  fists: { name: '주먹', dur: 0.38, hitAt: 0.4, reach: 1.3, cool: 0.45, dmg: 1, serverCool: 0.3 },
  knife: { name: '베기', dur: 0.3, hitAt: 0.42, reach: 1.8, cool: 60 / 110, dmg: 1, serverCool: 0.4 },
  stab: { name: '찌르기', dur: 0.62, hitAt: 0.46, reach: 2.3, cool: 0.85, dmg: 2, serverCool: 0.7 },
}

/** 손에 든 도구와 누른 버튼(secondary = 오른쪽) → 공격. 휘두를 수 없으면 null (낚싯대·빈손, 주먹 오른쪽) */
export function meleeFor(tool: ToolId | null, secondary: boolean): MeleeId | null {
  if (tool === 'fists') return secondary ? null : 'fists'
  if (tool === 'knife') return secondary ? 'stab' : 'knife'
  return null
}

/** 공격 시작부터 맞는 순간까지(초) */
export const hitDelay = (id: MeleeId): number => MELEE[id].dur * MELEE[id].hitAt
```

- [ ] **Step 4: 메시지**

`src/game/data/net.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/data/net.ts b/src/game/data/net.ts
--- a/src/game/data/net.ts
+++ b/src/game/data/net.ts
@@ -37,6 +37,12 @@ export const NET = {
   serverSleepPerSecond: 4,
   /** 아침이 온 뒤 이만큼(초) 안에 닿은 "눕기"는 버린다 (둘이 거의 같이 누우면 늦게 닿은 눕기가 아침을 또 부른다) */
   morningGuard: 3,
+  /** 방에 사람이 있는 동안 서버가 들판 동물을 움직이고 보내는 간격(초, 5Hz) */
+  animalEvery: 0.2,
+  /** 동물 목록 최대 수 (받는 쪽 검사) */
+  maxAnimals: 64,
+  /** 서버 명중 검사: 사거리 + 판정 원에 더해 주는 여유(m). 내 모습(5Hz)과 남이 보는 동물(0.25초 늦음)이 어긋나는 만큼 */
+  hitSlack: 2.5,
   /** 방에 사람이 있는 동안 서버가 시계 확인(time)을 보내는 간격(초) */
   clockEvery: 30,
   /** 서버가 받는 메시지 최대 길이(글자) */
```

`src/game/logic/netProtocol.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/logic/netProtocol.ts b/src/game/logic/netProtocol.ts
--- a/src/game/logic/netProtocol.ts
+++ b/src/game/logic/netProtocol.ts
@@ -1,7 +1,9 @@
+import { SPECIES_IDS } from '../data/animals'
 import { DAY_LENGTH } from '../data/balance'
 import { DISHES } from '../data/dishes'
 import { EMOTES, type EmoteId } from '../data/emotes'
-import { MEADOW_DISH_IDS, isMeadowDish, type MeadowDishId } from '../data/meadowItems'
+import { MEADOW_DISH_IDS, isMeadowDish, type MeadowDishId, type RawItemId } from '../data/meadowItems'
+import { MELEE_IDS, type MeleeId } from '../data/melee'
 import { NET } from '../data/net'
 import { SNACK_IDS } from '../data/snacks'
 import { TOOL_IDS, type ToolId } from '../data/tools'
@@ -9,6 +11,7 @@ import type { CharacterLook, FoodId } from '../data/types'
 import type { BoatDir } from './boatRoute'
 import { FISHING_POSES, type FishingLook, type FishingPose } from './characterPose'
 import { normalizeLook } from './characterLook'
+import { ANIMAL_POSES, type AnimalView } from './animalSim'
 import type { ClockTime } from './dayClock'
 import type { PlayerAction } from './playerMotion'
 import { cleanText, textLength } from './roomKey'
@@ -47,9 +50,18 @@ export type ClientMsg =
   | { type: 'profile'; nick: string; look: CharacterLook }
   /** 같이 하기 잠 투표: 침대에 누웠다(on) / 일어났다 */
   | { type: 'sleep'; on: boolean }
+  /** 들판 동물을 때렸다 (3-3). 피해는 서버가 공격 종류(w)로 정한다 (dmg 는 내 화면에서 본 값) */
+  | { type: 'animalHit'; id: number; dmg: number; w: MeleeId }
+
+/** 동물 한 마리 보내는 모양: [번호, 종(SPECIES_IDS 순서), x, z, 방향, 동작(ANIMAL_POSES 순서), 체력]. 소수 둘째 자리 */
+export type AnimalTuple = [number, number, number, number, number, number, number]
+/** 누구에게 맞았나: 동물 (3-4 에서 pvp) */
+export type HurtBy = 'animal'
+const HURT_BY: HurtBy[] = ['animal']
 
 /**
  * 서버 → 클라이언트. 3-1 에서 더한 것: welcome.time (방 시계), time (30초마다 시계 확인), sleepers (자는 사람 수 / 필요한 수), morning (모두 아침).
+ * 3-3 에서 더한 것: animals (들판 동물), loot (잡은 사람에게 전리품), hurt (맞은 사람에게 피해)
  * 옛 클라이언트는 모르는 종류를 버리고(parseServerMsg 가 null) welcome 의 time 은 읽지 않는다
  */
 export type ServerMsg =
@@ -63,6 +75,10 @@ export type ServerMsg =
   | { type: 'time'; tm: number; day: number }
   | { type: 'sleepers'; n: number; need: number }
   | { type: 'morning'; day: number }
+  /** 3-3: 들판 동물 전부 (200ms 마다), 잡은 사람에게만 전리품과 떨어진 자리, 맞은 사람에게만 피해 */
+  | { type: 'animals'; list: AnimalTuple[] }
+  | { type: 'loot'; items: RawItemId[]; x: number; z: number }
+  | { type: 'hurt'; dmg: number; by: HurtBy; from?: string }
 
 const EMOTE_IDS = EMOTES.map((e) => e.id)
 const FOOD_IDS: FoodId[] = [...DISHES.map((d) => d.id), ...SNACK_IDS, ...MEADOW_DISH_IDS]
@@ -194,11 +210,33 @@ export function parseClientMsg(raw: string): ClientMsg | null {
     }
     case 'sleep':
       return typeof m.on === 'boolean' ? { type: 'sleep', on: m.on } : null
+    case 'animalHit': {
+      const i = int(m.id, 1, 1e9)
+      const dmg = num(m.dmg, 0, 10)
+      const w = oneOf(m.w, MELEE_IDS)
+      return i !== null && dmg !== null && w ? { type: 'animalHit', id: i, dmg, w } : null
+    }
     default:
       return null
   }
 }
 
+/** 동물 한 마리. 틀리면 null */
+function animalTuple(v: unknown): AnimalTuple | null {
+  if (!Array.isArray(v) || v.length !== 7) return null
+  const L = NET.coordLimit
+  const i = int(v[0], 1, 1e9)
+  const sp = int(v[1], 0, SPECIES_IDS.length - 1)
+  const x = num(v[2], -L, L)
+  const z = num(v[3], -L, L)
+  const h = num(v[4], -10, 10)
+  const pose = int(v[5], 0, ANIMAL_POSES.length - 1)
+  const hp = int(v[6], 0, 10)
+  return i === null || sp === null || x === null || z === null || h === null || pose === null || hp === null ? null : [i, sp, x, z, h, pose, hp]
+}
+
+const RAW_ITEM_IDS: RawItemId[] = ['beef', 'pork', 'boar', 'venison', 'rabbit', 'foxmeat', 'chicken', 'egg', 'bone', 'fat', 'pumpkin', 'mushroom']
+
 function readPeer(v: unknown): PeerInfo | null {
   if (!isRecord(v)) return null
   const i = id(v.id)
@@ -260,6 +298,26 @@ export function parseServerMsg(raw: string): ServerMsg | null {
       const day = int(m.day, 1, MAX_DAY)
       return day !== null ? { type: 'morning', day } : null
     }
+    case 'animals': {
+      // 틀린 동물만 빼고 읽는다
+      if (!Array.isArray(m.list) || m.list.length > NET.maxAnimals) return null
+      return { type: 'animals', list: m.list.map(animalTuple).filter((a): a is AnimalTuple => a !== null) }
+    }
+    case 'loot': {
+      const L = NET.coordLimit
+      const x = num(m.x, -L, L)
+      const z = num(m.z, -L, L)
+      if (!Array.isArray(m.items) || m.items.length > 10 || x === null || z === null) return null
+      const items = m.items.map((v) => oneOf(v, RAW_ITEM_IDS))
+      return items.every((v) => v !== null) ? { type: 'loot', items: items as RawItemId[], x, z } : null
+    }
+    case 'hurt': {
+      const dmg = num(m.dmg, 0, 200)
+      const by = oneOf(m.by, HURT_BY)
+      if (dmg === null || !by) return null
+      const from = id(m.from)
+      return from ? { type: 'hurt', dmg, by, from } : { type: 'hurt', dmg, by }
+    }
     default:
       return null
   }
@@ -269,6 +327,16 @@ export function parseServerMsg(raw: string): ServerMsg | null {
 const r2 = (n: number) => Math.round(n * 100) / 100 + 0
 const r3 = (v: Vec3): Vec3 => [r2(v[0]), r2(v[1]), r2(v[2])]
 
+/** 보내기 (서버): 그리는 값 → 짧은 배열 (소수 둘째 자리) */
+export function packAnimals(list: readonly AnimalView[]): AnimalTuple[] {
+  return list.map((a) => [a.id, SPECIES_IDS.indexOf(a.sp), r2(a.x), r2(a.z), r2(a.h), ANIMAL_POSES.indexOf(a.pose), a.hp])
+}
+
+/** 받기: 짧은 배열 → 그리는 값 */
+export function unpackAnimals(list: readonly AnimalTuple[]): AnimalView[] {
+  return list.map(([id, sp, x, z, h, pose, hp]) => ({ id, sp: SPECIES_IDS[sp], x, z, h, pose: ANIMAL_POSES[pose], hp }))
+}
+
 /** 보내기 전 숫자를 소수 둘째 자리로 (메시지 크기를 줄인다) */
 export function roundState(s: NetState): NetState {
   const a = s.act
```

- [ ] **Step 5: 서버 명중 검사** (방 안 동물을 쓰는 곳은 Task 4. 여기서는 규칙과 붙임 정보 필드만)

`server/src/roomRules.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/server/src/roomRules.ts b/server/src/roomRules.ts
--- a/server/src/roomRules.ts
+++ b/server/src/roomRules.ts
@@ -1,5 +1,8 @@
+import { hitRadius } from '../../src/game/data/animals'
+import { MELEE } from '../../src/game/data/melee'
 import { NET } from '../../src/game/data/net'
 import type { CharacterLook } from '../../src/game/data/types'
+import type { AnimalView } from '../../src/game/logic/animalSim'
 import type { RoomClock } from '../../src/game/logic/dayClock'
 import type { ClientMsg, ErrorCode, NetState, ServerMsg } from '../../src/game/logic/netProtocol'
 import { NEW_WINDOW, allowEvery, allowPerSecond, type RateWindow } from '../../src/game/logic/rateLimit'
@@ -7,7 +10,7 @@ import { NEW_WINDOW, allowEvery, allowPerSecond, type RateWindow } from '../../s
 /** 방 저장소에 두는 것: 암호 해시와 만든·마지막으로 쓴 시각(ms) */
 export type RoomMeta = { passHash: string; createdAt: number; lastActive: number }
 
-/** 방에 들어온 사람 (웹소켓 붙임 정보). 시각은 초. sleeping: 잠 투표 중 (침대에 누워 있다) */
+/** 방에 들어온 사람 (웹소켓 붙임 정보). 시각은 초. sleeping: 잠 투표 중 (침대에 누워 있다). lastHit: 마지막으로 받은 동물 명중 */
 export type Member = {
   id: string
   nick: string
@@ -19,10 +22,14 @@ export type Member = {
   lastProfile: number
   sleeping: boolean
   sleepWin: RateWindow
+  lastHit: number
 }
 
-/** 웹소켓 붙임 정보 → 사람. 3-1 전에 붙은 소켓(배포 중 살아 있던 방)엔 잠 필드가 없다: 안 자는 사람·새 창으로 본다 */
-export function memberFrom(a: Omit<Member, 'sleeping' | 'sleepWin'> & Partial<Pick<Member, 'sleeping' | 'sleepWin'>>): Member {
+/**
+ * 웹소켓 붙임 정보 → 사람. 3-1 전에 붙은 소켓(배포 중 살아 있던 방)엔 잠 필드가 없다: 안 자는 사람·새 창으로 본다.
+ * 3-3 전 소켓엔 lastHit 이 없다: 한 번도 안 때린 사람
+ */
+export function memberFrom(a: Omit<Member, 'sleeping' | 'sleepWin' | 'lastHit'> & Partial<Pick<Member, 'sleeping' | 'sleepWin' | 'lastHit'>>): Member {
   return {
     id: a.id,
     nick: a.nick,
@@ -34,6 +41,7 @@ export function memberFrom(a: Omit<Member, 'sleeping' | 'sleepWin'> & Partial<Pi
     lastProfile: a.lastProfile,
     sleeping: a.sleeping === true,
     sleepWin: a.sleepWin ?? NEW_WINDOW,
+    lastHit: a.lastHit ?? -Infinity,
   }
 }
 
@@ -79,10 +87,26 @@ export function handleMemberMsg(member: Member, msg: ClientMsg, nowSec: number):
       return { member: { ...member, sleeping: msg.on, sleepWin: r.w }, out: null }
     }
     case 'hello':
+    case 'animalHit':
+      // 동물 명중은 방의 동물을 봐야 해서 room.ts 가 judgeAnimalHit 로 본다
       return { member, out: null }
   }
 }
 
+/**
+ * 동물 명중 검사 (같이 하기). 받아들이면 피해(공격 종류 표의 값, 보낸 dmg 는 믿지 않는다)와 마지막 명중 시각을 고친 사람.
+ * 버리는 것: 모습을 아직 안 보낸 사람, 없거나 쓰러진 동물, 공격 종류별 최소 간격(주먹 0.3·칼 0.4·찌르기 0.7초) 안에 또 온 것,
+ * 내 마지막 모습에서 사거리 + 판정 원 + 여유(NET.hitSlack) 보다 먼 동물
+ */
+export function judgeAnimalHit(member: Member, msg: Extract<ClientMsg, { type: 'animalHit' }>, animal: AnimalView | undefined, nowSec: number): { ok: true; dmg: number; member: Member } | { ok: false } {
+  const m = MELEE[msg.w]
+  if (!member.s || !animal || animal.pose === 'dead') return { ok: false }
+  if (nowSec - member.lastHit < m.serverCool) return { ok: false }
+  const d = Math.hypot(member.s.p[0] - animal.x, member.s.p[2] - animal.z)
+  if (d > m.reach + hitRadius(animal.sp) + NET.hitSlack) return { ok: false }
+  return { ok: true, dmg: m.dmg, member: { ...member, lastHit: nowSec } }
+}
+
 /** 잠 투표 세기: 방 인원의 절반(올림) 이상이 자면 아침. 아무도 안 자면 아침이 아니다 */
 export function tallySleep(sleeping: boolean[]): { n: number; need: number; morning: boolean } {
   const n = sleeping.filter(Boolean).length
```

`server/src/room.ts` — 새로 들어온 사람의 붙임 정보 (바꿀 곳, `git diff -U3`):

```diff
diff --git a/server/src/room.ts b/server/src/room.ts
--- a/server/src/room.ts
+++ b/server/src/room.ts
@@ -50,6 +50,7 @@ export class Room extends DurableObject<Env> {
         lastProfile: -Infinity,
         sleeping: false,
         sleepWin: NEW_WINDOW,
+        lastHit: -Infinity,
       }
       ws.serializeAttachment({ phase: 'in', ...me } satisfies Attachment)
       const players: PeerInfo[] = this.members(ws).map(({ m }) => ({ id: m.id, nick: m.nick, look: m.look, s: m.s }))
```

- [ ] **Step 6: 통과 확인**

Run: `npx vitest run && npx tsc -b && npm run lint 2>&1 | grep -c warning`
Expected: 70 파일 / 719 개 통과, tsc 출력 없음(server 프로젝트도 `handleMemberMsg` 의 switch 가 `animalHit` 까지 다룬다), `6`

- [ ] **Step 7: 커밋**

```bash
git add src/game/data/melee.ts \
  src/game/data/melee.test.ts \
  src/game/data/net.ts \
  src/game/logic/netProtocol.ts \
  src/game/logic/netProtocol.test.ts \
  server/src/roomRules.ts \
  server/src/roomRules.test.ts \
  server/src/room.ts
git commit -F - <<'EOF'
feat: 동물·사냥 메시지와 서버 명중 검사

같이 하기 메시지에 animalHit(→ 서버), animals·loot·hurt(서버 →)를 더한다.
동물 목록은 짧은 배열(소수 둘째 자리)로 보내고, 틀린 동물만 빼고 읽는다.
은지 근접 공격 시간표(data/melee)와 서버 명중 검사 judgeAnimalHit(거리·공격 종류별 간격)를 둔다.
EOF
```

검증한 스크래치 커밋: `5ca97de` (이 커밋의 diff 를 그대로 적용해도 된다: `git -C /private/tmp/claude-501/-Users-ihyelin-proten-hrlee-----threejs/e476c70e-362f-4ed3-9ff7-d8664da04e4b/scratchpad/plan-3-3/repo format-patch -1 --binary 5ca97de --stdout | git apply --index` 한 뒤 위 커밋 명령. 스크래치 커밋의 작성자는 scratch 라 `git am` 은 쓰지 않는다)


### Task 4: 방 서버가 들판 동물을 돌린다  — 스크래치 `3d3e8c4`

**Files:**
- Modify: `server/src/room.ts`, `tools/room-smoke.mjs`

**Interfaces:**
- Consumes: `newHerd`·`stepHerd`·`hitAnimal`·`herdViews`·`HerdPlayer` (Task 2), `isIndoor` (Task 2), `rollDrops` (Task 2), `packAnimals`·`ClientMsg` (Task 3), `judgeAnimalHit` (Task 3), `NET.animalEvery`·`NET.clockEvery`
- Produces: 서버 동작 — 사람이 있는 동안 200ms 마다 `animals` (모두), 들이받힌 사람에게만 `hurt {dmg, by: 'animal'}`, `animalHit` 을 받아들이면 체력을 깎고 쓰러뜨린 사람에게만 `loot {items, x, z}`, 30초마다 `time`, 마지막 사람이 나가면 alarm·동물 지움

이 Task 는 Durable Object 코드라 단위 테스트 대신 로컬 서버 점검(`tools/room-smoke.mjs`)으로 확인한다. 규칙(검사·시뮬레이션)은 Task 2·3 의 단위 테스트가 지킨다.

- [ ] **Step 1: 서버 점검을 먼저 쓴다**

`tools/room-smoke.mjs` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/tools/room-smoke.mjs b/tools/room-smoke.mjs
--- a/tools/room-smoke.mjs
+++ b/tools/room-smoke.mjs
@@ -1,4 +1,4 @@
-// 로컬 방 서버(npm run server:dev) 확인: 만들기·틀린 암호·들어가기·state·chat·나가기, 방 시계·잠 투표·잠 표시 횟수 제한·아침 직후 눕기 버림
+// 로컬 방 서버(npm run server:dev) 확인: 만들기·틀린 암호·들어가기·state·chat·나가기, 방 시계·잠 투표·잠 표시 횟수 제한·아침 직후 눕기 버림, 들판 동물·명중·전리품·반격
 // 사용: node tools/room-smoke.mjs [ws://127.0.0.1:8787]
 import { createHash } from 'node:crypto'
 
@@ -96,5 +96,47 @@ await wait(300)
 r2.ws.send(JSON.stringify({ type: 'sleep', on: true }))
 await wait(300)
 assert(r2.inbox.some((m) => m.type === 'morning' && m.day === 2), '초당 4번 넘게 바꾼 잠 표시도 마지막 값(잔다)으로 센다')
+// 들판 동물 (3-3): 사람이 있으면 200ms 마다 모두에게 같은 동물. 때리면 서버가 검사해 체력을 깎고, 반격은 때린 사람에게만 hurt, 쓰러뜨리면 잡은 사람에게만 loot
+const room4 = sha(`rinfish-room|smoke-animals-${Date.now()}`).slice(0, 32)
+const h1 = await open('create', 'secret1', 'H1', room4)
+const h2 = await open('join', 'secret1', 'H2', room4)
+await wait(700)
+const lastAnimals = (c) => c.inbox.filter((m) => m.type === 'animals').at(-1)?.list ?? []
+const l1 = lastAnimals(h1)
+const l2 = lastAnimals(h2)
+assert(l1.length === 12 && l2.length === 12, `둘 다 동물 12마리를 받는다 (${l1.length}, ${l2.length})`)
+assert(JSON.stringify(l1.map((a) => [a[0], a[1]])) === JSON.stringify(l2.map((a) => [a[0], a[1]])), '둘이 같은 동물(번호·종)을 본다')
+const ticks = h1.inbox.filter((m) => m.type === 'animals').length
+assert(ticks >= 2 && ticks <= 6, `animals 는 200ms 마다 (0.7초에 ${ticks}번)`)
+const cow = l1.find((a) => a[0] === 1)
+assert(cow && cow[1] === 0 && cow[6] === 3, '1번은 소, 체력 3')
+const hstate = (x, z) => ({ ...state, p: [x, 1, z] })
+h2.ws.send(JSON.stringify({ type: 'state', s: hstate(0, 15) }))
+h1.ws.send(JSON.stringify({ type: 'state', s: hstate(cow[2] + 1, cow[3]) }))
+await wait(50)
+h1.ws.send(JSON.stringify({ type: 'animalHit', id: 1, dmg: 1, w: 'knife' }))
+h1.ws.send(JSON.stringify({ type: 'animalHit', id: 1, dmg: 1, w: 'knife' }))
+await wait(450)
+assert(lastAnimals(h2).find((a) => a[0] === 1)?.[6] === 2, '칼로 때리면 체력 3 → 2 (곧바로 또 보낸 것은 버린다)')
+await wait(1500)
+assert(h1.inbox.some((m) => m.type === 'hurt' && m.dmg === 15 && m.by === 'animal'), '맞은 소가 때린 사람을 들이받는다 (hurt 15)')
+assert(!h2.inbox.some((m) => m.type === 'hurt'), '다른 사람은 hurt 를 받지 않는다')
+const near = lastAnimals(h1).find((a) => a[0] === 1)
+h1.ws.send(JSON.stringify({ type: 'state', s: hstate(near[2] + 0.5, near[3]) }))
+await wait(50)
+h1.ws.send(JSON.stringify({ type: 'animalHit', id: 1, dmg: 2, w: 'stab' }))
+await wait(450)
+const loot = h1.inbox.find((m) => m.type === 'loot')
+assert(loot && JSON.stringify(loot.items) === '["beef","beef","bone"]', `찌르기(2)로 쓰러뜨리면 잡은 사람에게 소 전리품 (${JSON.stringify(loot?.items)})`)
+assert(!h2.inbox.some((m) => m.type === 'loot'), '다른 사람은 전리품을 받지 않는다')
+assert(lastAnimals(h2).find((a) => a[0] === 1)?.[5] === 5, '모두에게 쓰러진 모습(dead)')
+const far = lastAnimals(h1).filter((a) => a[5] !== 5).sort((a, b) => Math.hypot(b[2] - near[2], b[3] - near[3]) - Math.hypot(a[2] - near[2], a[3] - near[3]))[0]
+h1.ws.send(JSON.stringify({ type: 'animalHit', id: far[0], dmg: 1, w: 'knife' }))
+await wait(450)
+assert(lastAnimals(h2).find((a) => a[0] === far[0])?.[6] === far[6], '먼 동물을 때린 것은 버린다')
+await wait(1500)
+assert(!lastAnimals(h2).some((a) => a[0] === 1), '쓰러진 소는 1.4초 뒤 목록에서 빠진다')
+h1.ws.close()
+h2.ws.close()
 await wait(100)
 process.exit()
```

- [ ] **Step 2: 실행해 실패 확인**

Run: `npm run server:dev` (다른 창) 뒤 `node tools/room-smoke.mjs ws://127.0.0.1:8787`
Expected: 앞 19줄은 `OK`, 그다음 `FAIL 둘 다 동물 12마리를 받는다 (0, 0)`·`FAIL animals 는 200ms 마다 (0.7초에 0번)` 등이 나오고 1번 소가 없어 스크립트가 `TypeError` 로 멈춘다 (서버가 아직 동물을 보내지 않는다)

- [ ] **Step 3: 구현**

`alarm()` 은 시계 확인만 하던 것을 동물 진행 + (30초마다) 시계 확인으로 바꾸고, 처음 거는 alarm·다시 거는 alarm 을 200ms 로 한다. `animalHit` 은 `handleMemberMsg` 전에 따로 처리한다.

`server/src/room.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/server/src/room.ts b/server/src/room.ts
--- a/server/src/room.ts
+++ b/server/src/room.ts
@@ -1,9 +1,12 @@
 import { DurableObject } from 'cloudflare:workers'
+import { isIndoor } from '../../src/game/data/meadow'
+import { rollDrops } from '../../src/game/data/meadowItems'
 import { NET } from '../../src/game/data/net'
+import { herdViews, hitAnimal, newHerd, stepHerd, type Herd, type HerdPlayer } from '../../src/game/logic/animalSim'
 import { newRoomClock, roomMorning, roomTime, type RoomClock } from '../../src/game/logic/dayClock'
-import { parseClientMsg, type ErrorCode, type PeerInfo, type ServerMsg } from '../../src/game/logic/netProtocol'
+import { packAnimals, parseClientMsg, type ClientMsg, type ErrorCode, type PeerInfo, type ServerMsg } from '../../src/game/logic/netProtocol'
 import { NEW_WINDOW } from '../../src/game/logic/rateLimit'
-import { handleMemberMsg, judgeHello, justAfterMorning, memberFrom, tallySleep, type Member, type RoomMeta } from './roomRules'
+import { handleMemberMsg, judgeAnimalHit, judgeHello, justAfterMorning, memberFrom, tallySleep, type Member, type RoomMeta } from './roomRules'
 
 /** 웹소켓 붙임 정보: 아직 hello 전이거나, 들어온 사람 */
 type Attachment = { phase: 'hello' } | ({ phase: 'in' } & Member)
@@ -15,9 +18,18 @@ const toMember = (a: Extract<Attachment, { phase: 'in' }>): Member => memberFrom
 /**
  * 방 하나. 웹소켓 Hibernation API 를 써서 조용할 땐 잠들어 요금이 들지 않는다.
  * 사람 정보는 웹소켓마다 붙임 정보(attachment)에, 방 암호 해시와 시계 기준점은 저장소(meta, clock)에 둔다 (잠들면 메모리는 사라진다).
- * 시계 확인 alarm 은 사람이 있는 동안만 다시 건다
+ * alarm 은 사람이 있는 동안만 200ms 마다 다시 건다: 들판 동물을 움직여 보내고, 30초마다 시계를 확인한다.
+ * 동물은 메모리에만 둔다 (방이 비거나 메모리가 사라지면 버리고 다음 alarm 에 새로 만든다)
  */
 export class Room extends DurableObject<Env> {
+  /** 들판 동물과 마지막으로 움직인 때(ms) */
+  private herd: Herd | null = null
+  private herdAt = 0
+  /** 마지막으로 시계 확인(time)을 보낸 때(ms) */
+  private clockAt = 0
+  /** 너무 잦아 세지 않은 잠 표시가 있다 (다음 alarm 에 센다) */
+  private sleepPending = false
+
   async fetch(request: Request): Promise<Response> {
     if (request.headers.get('Upgrade') !== 'websocket') return new Response('websocket only', { status: 426 })
     const [client, server] = Object.values(new WebSocketPair())
@@ -59,18 +71,47 @@ export class Room extends DurableObject<Env> {
       this.broadcast({ type: 'join', id: me.id, nick: me.nick, look: me.look }, ws)
       // 사람이 늘면 필요한 수가 바뀐다 (자는 사람이 있을 때만 알린다)
       await this.checkSleep(false)
-      if ((await this.ctx.storage.getAlarm()) === null) await this.ctx.storage.setAlarm(Date.now() + NET.clockEvery * 1000)
+      if ((await this.ctx.storage.getAlarm()) === null) await this.ctx.storage.setAlarm(Date.now() + NET.animalEvery * 1000)
       return
     }
     // 아침 직후에 닿은 눕기는 버린다 (그 사람 화면도 morning 을 받고 깬다)
     if (msg.type === 'sleep' && msg.on && justAfterMorning(await this.clock(), Date.now())) return
     const member = toMember(att)
+    if (msg.type === 'animalHit') return this.hitAnimal(ws, member, msg)
     const r = handleMemberMsg(member, msg, Date.now() / 1000)
     if (r.member !== member) ws.serializeAttachment({ phase: 'in', ...r.member } satisfies Attachment)
     if (r.out) this.broadcast(r.out, ws)
+    if (r.quiet) this.sleepPending = true
     if (msg.type === 'sleep' && !r.quiet && r.member.sleeping !== member.sleeping) await this.checkSleep(true)
   }
 
+  /** 동물 명중: 검사해서 맞으면 체력을 깎고, 쓰러뜨렸으면 잡은 사람에게만 전리품 */
+  private hitAnimal(ws: WebSocket, member: Member, msg: Extract<ClientMsg, { type: 'animalHit' }>) {
+    if (!this.herd) return
+    const v = judgeAnimalHit(member, msg, this.herd.animals.find((a) => a.id === msg.id), Date.now() / 1000)
+    if (!v.ok) return
+    ws.serializeAttachment({ phase: 'in', ...v.member } satisfies Attachment)
+    const r = hitAnimal(this.herd, msg.id, v.dmg, member.id)
+    this.herd = r.herd
+    if (r.result === 'killed' && r.animal) send(ws, { type: 'loot', items: rollDrops(r.animal.sp), x: Math.round(r.animal.x * 100) / 100, z: Math.round(r.animal.z * 100) / 100 })
+  }
+
+  /** 동물을 지난번부터 지난 시간만큼(최대 1초) 움직이고 모두에게 보낸다. 들이받힌 사람에게만 hurt */
+  private stepAnimals(all: { ws: WebSocket; m: Member }[], now: number) {
+    const dt = this.herd ? Math.min(1, Math.max(0, (now - this.herdAt) / 1000)) : 0
+    this.herd ??= newHerd()
+    this.herdAt = now
+    const players: HerdPlayer[] = all.flatMap(({ m }) => (m.s ? [{ id: m.id, x: m.s.p[0], z: m.s.p[2], indoor: isIndoor(m.s.p[0], m.s.p[2]) }] : []))
+    const r = stepHerd(this.herd, players, dt)
+    this.herd = r.herd
+    for (const e of r.events) {
+      if (e.type !== 'attack') continue
+      const target = all.find(({ m }) => m.id === e.target)
+      if (target) send(target.ws, { type: 'hurt', dmg: e.dmg, by: 'animal' })
+    }
+    this.broadcastAll({ type: 'animals', list: packAnimals(herdViews(this.herd)) })
+  }
+
   async webSocketClose(ws: WebSocket): Promise<void> {
     await this.leave(ws)
   }
@@ -80,14 +121,27 @@ export class Room extends DurableObject<Env> {
   }
 
   /**
-   * 시계 확인: 사람이 있으면 지금 시각을 보내고 다시 건다. 아무도 없으면 다시 걸지 않는다 (방이 잠든다).
-   * 너무 잦아 세지 않은 잠 표시(quiet)도 여기서 센다
+   * 200ms 마다: 동물을 움직여 보내고, 30초마다 시계를 확인한다. 아무도 없으면 동물을 버리고 다시 걸지 않는다 (방이 잠든다).
+   * 너무 잦아 세지 않은 잠 표시(quiet)는 다음 alarm 에 센다 (메모리가 사라졌어도 30초 확인 때 센다)
    */
   async alarm(): Promise<void> {
-    if (this.members().length === 0) return
-    this.broadcastAll({ type: 'time', ...roomTime(await this.clock(), Date.now()) })
-    await this.checkSleep(true)
-    await this.ctx.storage.setAlarm(Date.now() + NET.clockEvery * 1000)
+    const all = this.members()
+    if (all.length === 0) {
+      this.herd = null
+      return
+    }
+    const now = Date.now()
+    this.stepAnimals(all, now)
+    if (now - this.clockAt >= NET.clockEvery * 1000) {
+      this.clockAt = now
+      this.sleepPending = false
+      this.broadcastAll({ type: 'time', ...roomTime(await this.clock(), now) })
+      await this.checkSleep(true)
+    } else if (this.sleepPending) {
+      this.sleepPending = false
+      await this.checkSleep(true)
+    }
+    await this.ctx.storage.setAlarm(now + NET.animalEvery * 1000)
   }
 
   /** 방 시계 기준점. 처음이면 지금을 1일차 06:00 으로 만들어 저장한다 */
@@ -159,8 +213,10 @@ export class Room extends DurableObject<Env> {
     const meta = await this.ctx.storage.get<RoomMeta>('meta')
     if (meta) await this.ctx.storage.put('meta', { ...meta, lastActive: Date.now() })
     // 사람이 줄면 필요한 수가 줄어 아침이 올 수 있다. 마지막 사람이 나가면 alarm 을 지운다
-    if (this.members().length === 0) await this.ctx.storage.deleteAlarm()
-    else await this.checkSleep(a.sleeping === true)
+    if (this.members().length === 0) {
+      this.herd = null
+      await this.ctx.storage.deleteAlarm()
+    } else await this.checkSleep(a.sleeping === true)
   }
 }
```

- [ ] **Step 4: 통과 확인**

Run: `npx tsc -b && npm run lint 2>&1 | grep -c warning && npx vitest run`
Expected: tsc 출력 없음, `6`, 70 파일 / 719 개

Run: 서버를 다시 띄우고(`npm run server:dev`, 코드가 바뀌면 wrangler 가 다시 읽는다) `node tools/room-smoke.mjs ws://127.0.0.1:8787`
Expected: 31줄 모두 `OK` — 새 줄: "둘 다 동물 12마리를 받는다 (12, 12)", "둘이 같은 동물(번호·종)을 본다", "animals 는 200ms 마다 (0.7초에 3번)", "1번은 소, 체력 3", "칼로 때리면 체력 3 → 2 (곧바로 또 보낸 것은 버린다)", "맞은 소가 때린 사람을 들이받는다 (hurt 15)", "다른 사람은 hurt 를 받지 않는다", "찌르기(2)로 쓰러뜨리면 잡은 사람에게 소 전리품 ([\"beef\",\"beef\",\"bone\"])", "다른 사람은 전리품을 받지 않는다", "모두에게 쓰러진 모습(dead)", "먼 동물을 때린 것은 버린다", "쓰러진 소는 1.4초 뒤 목록에서 빠진다"

- [ ] **Step 5: 커밋**

```bash
git add server/src/room.ts \
  tools/room-smoke.mjs
git commit -F - <<'EOF'
feat: 방 서버가 들판 동물을 돌린다

사람이 있는 동안 alarm 을 200ms 로 걸어 animalSim 을 돌리고 모두에게 animals 를 보낸다.
들이받힌 사람에게만 hurt, 명중(animalHit)은 judgeAnimalHit 로 검사해 쓰러뜨린 사람에게만 loot.
시계 확인(time)은 그대로 30초마다, 세지 않은 잠 표시는 다음 alarm 에 센다. 방이 비면 동물을 버린다.
EOF
```

검증한 스크래치 커밋: `3d3e8c4` (이 커밋의 diff 를 그대로 적용해도 된다: `git -C /private/tmp/claude-501/-Users-ihyelin-proten-hrlee-----threejs/e476c70e-362f-4ed3-9ff7-d8664da04e4b/scratchpad/plan-3-3/repo format-patch -1 --binary 3d3e8c4 --stdout | git apply --index` 한 뒤 위 커밋 명령. 스크래치 커밋의 작성자는 scratch 라 `git am` 은 쓰지 않는다)


### Task 5: 동물 상태를 내 화면에 두고 맞으면 다치기  — 스크래치 `f52a979`

**Files:**
- Create: `src/game/logic/animalInterp.ts`, `src/game/logic/loot.ts`, `src/game/hunt/animalRig.ts`, `src/game/scene/animals/HerdRunner.tsx`, `src/game/ui/HurtFlash.tsx`
- Modify: `src/game/stores/progressStore.ts`, `src/game/stores/sessionStore.ts`, `src/game/stores/netStore.ts`, `src/game/scene/day/dayActions.ts`, `src/game/scene/World.tsx`, `src/game/Game.tsx`
- Test: `src/game/logic/animalInterp.test.ts`, `src/game/logic/loot.test.ts`, `src/game/hunt/animalRig.test.ts`, `src/game/scene/day/dayActions.test.ts`, `src/game/stores/netStore.test.ts`, `src/game/stores/progressStore.test.ts`

**Interfaces:**
- Consumes: Task 2 (`newHerd`·`stepHerd`·`calmHerd`·`herdViews`·`AnimalView`·`Herd`·`isIndoor`·`ANIMAL`), Task 3 (`unpackAnimals`·`MeleeId`·`ServerMsg`), `takeDamage` (Task 1), `startDeath` (3-1 `dayActions`), `restStops`·`clampDelta` (`logic/time`), `netNow` (`net/remoteRig`), `playerRig` (`scene/Player`)
- Produces:
  - `type HerdSample = { at; list: AnimalView[] }`, `pushHerd(buf, sample, max)`, `herdAt(buf, t): AnimalView[]` (`logic/animalInterp.ts`)
  - `type Loot = { key; item: RawItemId; x; z; showAt; phase }`, `dropLoot(items, x, z, now, firstKey, rng?): Loot[]`, `nearestLoot(list, x, z, now): Loot | null` (`logic/loot.ts`)
  - `ME = 'me'`, `soloHerd(): Herd`, `setSoloHerd(h)`, `calmSolo()`, `receiveAnimals(list, now)`, `forgetRoomAnimals()`, `animalViews(online: boolean, now: number): AnimalView[]`, `spawnLoot(items, x, z, now)`, `lootList()`, `takeLoot(key): Loot | null`, `setHurtHandler(f)`, `receiveHurt(dmg)`, `resetAnimalRig()` (`hunt/animalRig.ts`; Task 6 에서 `herdDrawn` 을 더한다)
  - `progressStore.hurt(amount): boolean` (죽으면 true), `sessionStore.hurtAt: number | null`·`flashHurt()`, `netStore.sendAnimalHit(id, dmg, w)`
  - `takeHit(dmg: number)` (`scene/day/dayActions.ts`: 어두워지는 중이면 무시, 체력 깎기·번쩍·죽음)
  - 컴포넌트 `HerdRunner` (월드에), `HurtFlash` (화면에)

- [ ] **Step 1: 실패하는 테스트 쓰기**

`src/game/logic/animalInterp.test.ts` (새 파일):

```ts
import { describe, expect, it } from 'vitest'
import type { AnimalView } from './animalSim'
import { herdAt, pushHerd, type HerdSample } from './animalInterp'

const cow = (x: number, over: Partial<AnimalView> = {}): AnimalView => ({ id: 1, sp: 'cow', x, z: -40, h: 0, pose: 'walk', hp: 3, ...over })

describe('pushHerd', () => {
  it('뒤에 붙이고 max 개만 남긴다. 늦게 도착한 옛 목록은 버린다', () => {
    let buf: HerdSample[] = []
    for (let i = 0; i < 5; i++) buf = pushHerd(buf, { at: i, list: [cow(i)] }, 3)
    expect(buf.map((b) => b.at)).toEqual([2, 3, 4])
    expect(pushHerd(buf, { at: 3.5, list: [] }, 3)).toBe(buf)
  })
})

describe('herdAt', () => {
  const buf: HerdSample[] = [
    { at: 0, list: [cow(180, { h: 3 }), { ...cow(170), id: 2 }] },
    { at: 0.2, list: [cow(181, { h: -3, pose: 'dead', hp: 0 })] },
  ]
  it('비어 있으면 빈 목록, 범위 밖은 끝 목록', () => {
    expect(herdAt([], 1)).toEqual([])
    expect(herdAt(buf, -1)).toBe(buf[0].list)
    expect(herdAt(buf, 9)).toBe(buf[1].list)
  })
  it('두 목록 사이 위치는 선형, 방향은 짧은 쪽으로 돌고, 동작·체력은 앞 값', () => {
    const [a] = herdAt(buf, 0.1)
    expect(a.x).toBeCloseTo(180.5)
    expect(Math.abs(a.h)).toBeGreaterThan(3)
    expect([a.pose, a.hp]).toEqual(['walk', 3])
  })
  it('뒤 목록에 없는 동물(사라짐)은 앞 값 그대로, 너무 멀리 뛴 것도 잇지 않는다', () => {
    expect(herdAt(buf, 0.1)[1]).toEqual({ ...cow(170), id: 2 })
    const jump: HerdSample[] = [{ at: 0, list: [cow(180)] }, { at: 0.2, list: [cow(190)] }]
    expect(herdAt(jump, 0.1)[0].x).toBe(180)
  })
})
```

`src/game/logic/loot.test.ts` (새 파일):

```ts
import { describe, expect, it } from 'vitest'
import { dropLoot, nearestLoot } from './loot'

describe('전리품', () => {
  it('쓰러뜨린 자리 둘레 ±0.5m 에 번호를 붙여 떨어뜨리고, 1.4초 뒤에 보인다', () => {
    const list = dropLoot(['beef', 'bone'], 180, -40, 10, 7, () => 0.75)
    expect(list).toEqual([
      { key: 7, item: 'beef', x: 180.25, z: -39.75, showAt: 11.4, phase: 0.75 * Math.PI * 2 },
      { key: 8, item: 'bone', x: 180.25, z: -39.75, showAt: 11.4, phase: 0.75 * Math.PI * 2 },
    ])
  })
  it('E 로 줍는 것: 보이는 것 중 1.6m 안의 가장 가까운 것', () => {
    const list = dropLoot(['beef', 'pork'], 180, -40, 0, 1, () => 0.5)
    const far = { ...list[1], key: 2, x: 181.2 }
    expect(nearestLoot([list[0], far], 181, -40, 0.5)).toBeNull()
    expect(nearestLoot([list[0], far], 181, -40, 2)?.key).toBe(2)
    expect(nearestLoot([list[0]], 181.7, -40, 2)).toBeNull()
  })
})
```

`src/game/hunt/animalRig.test.ts` (새 파일):

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NET } from '../data/net'
import type { AnimalView } from '../logic/animalSim'
import { animalViews, forgetRoomAnimals, lootList, receiveAnimals, receiveHurt, resetAnimalRig, setHurtHandler, soloHerd, spawnLoot, takeLoot } from './animalRig'

const cow = (x: number): AnimalView => ({ id: 1, sp: 'cow', x, z: -40, h: 0, pose: 'walk', hp: 3 })

beforeEach(() => resetAnimalRig())

describe('animalRig', () => {
  it('혼자: 처음 쓸 때 무리 12마리를 만들고 그 값을 그린다', () => {
    expect(animalViews(false, 0)).toEqual([])
    soloHerd()
    expect(animalViews(false, 0)).toHaveLength(12)
  })
  it('같이: 받은 목록을 NET.interpDelay 늦게 이어 그리고, 방을 나오면 지운다', () => {
    receiveAnimals([cow(180)], 10)
    receiveAnimals([cow(181)], 10.2)
    expect(animalViews(true, 10.1 + NET.interpDelay)[0].x).toBeCloseTo(180.5)
    forgetRoomAnimals()
    expect(animalViews(true, 11)).toEqual([])
  })
  it('전리품은 번호를 붙여 쌓고, 주우면 빠진다 (두 번 주울 수 없다)', () => {
    spawnLoot(['beef', 'bone'], 180, -40, 5)
    spawnLoot(['egg'], 170, -30, 6)
    expect(lootList().map((l) => [l.key, l.item])).toEqual([[1, 'beef'], [2, 'bone'], [3, 'egg']])
    expect(takeLoot(2)?.item).toBe('bone')
    expect(takeLoot(2)).toBeNull()
    expect(lootList().map((l) => l.key)).toEqual([1, 3])
  })
  it('hurt 는 붙여 둔 처리기로 간다 (없으면 아무 일도 없다)', () => {
    receiveHurt(5)
    const f = vi.fn()
    setHurtHandler(f)
    receiveHurt(15)
    expect(f).toHaveBeenCalledWith(15)
  })
})
```

`src/game/stores/progressStore.test.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/stores/progressStore.test.ts b/src/game/stores/progressStore.test.ts
--- a/src/game/stores/progressStore.test.ts
+++ b/src/game/stores/progressStore.test.ts
@@ -368,6 +368,17 @@ describe('progressStore', () => {
     expect(store().inventory).toHaveLength(1)
   })
 
+  it('동물에게 맞으면 체력이 줄고, 0 이 되면 true (가방·코인은 그대로). 피해 0 은 아무 일도 없다', () => {
+    useProgressStore.setState({ coins: 50, survival: { stamina: 20, hunger: 80, graceLeft: null, buffs: [] } })
+    expect(store().hurt(15)).toBe(false)
+    expect(store().survival.stamina).toBe(5)
+    expect(store().hurt(0)).toBe(false)
+    expect(store().survival.stamina).toBe(5)
+    expect(store().hurt(15)).toBe(true)
+    expect(store().survival).toMatchObject({ stamina: 0, graceLeft: null })
+    expect(store().coins).toBe(50)
+  })
+
   it('같이 하는 중(시계 null)엔 저장된 혼자 시계를 건드리지 않는다', () => {
     useProgressStore.setState({ clock: { t: 0.3, day: 2 } })
     store().tick(1, { fighting: false, resting: false }, null)
```

`src/game/scene/day/dayActions.test.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/scene/day/dayActions.test.ts b/src/game/scene/day/dayActions.test.ts
--- a/src/game/scene/day/dayActions.test.ts
+++ b/src/game/scene/day/dayActions.test.ts
@@ -6,7 +6,9 @@ import { liveClock, useDayStore } from '../../stores/dayStore'
 import { useNetStore } from '../../stores/netStore'
 import { INITIAL_PROGRESS, useProgressStore } from '../../stores/progressStore'
 import { useSessionStore } from '../../stores/sessionStore'
-import { startDeath, startSleep, stepRest, wake } from './dayActions'
+import { ME, calmSolo, resetAnimalRig, setSoloHerd, soloHerd } from '../../hunt/animalRig'
+import { hitAnimal } from '../../logic/animalSim'
+import { startDeath, startSleep, stepRest, takeHit, wake } from './dayActions'
 
 const day = () => useDayStore.getState()
 const session = () => useSessionStore.getState()
@@ -157,3 +159,31 @@ describe('죽음 → 침대', () => {
     expect(day().seq).toBe(first)
   })
 })
+
+describe('동물에게 맞기 (3-3)', () => {
+  beforeEach(() => resetAnimalRig())
+
+  it('맞으면 체력이 줄고 화면이 번쩍인다. 0 이 되면 죽음 (침대)', () => {
+    takeHit(15)
+    expect(useProgressStore.getState().survival.stamina).toBe(5)
+    expect(session().hurtAt).not.toBeNull()
+    expect(day().seq).toBeNull()
+    takeHit(15)
+    expect(day().seq?.kind).toBe('death')
+    expect(session().mode).toBe('sleep')
+  })
+  it('잠·죽음으로 어두워지는 동안엔 맞지 않는다', () => {
+    startDeath()
+    useProgressStore.setState({ survival: { stamina: 40, hunger: 50, graceLeft: null, buffs: [] } })
+    takeHit(15)
+    expect(useProgressStore.getState().survival.stamina).toBe(40)
+  })
+  it('죽으면 나를 쫓던 혼자 동물이 진정한다', () => {
+    const cow = soloHerd().animals.find((a) => a.sp === 'cow')!
+    setSoloHerd(hitAnimal(soloHerd(), cow.id, 1, ME).herd)
+    expect(soloHerd().animals.find((a) => a.id === cow.id)?.state).toBe('attack')
+    startDeath()
+    expect(soloHerd().animals.find((a) => a.id === cow.id)?.state).toBe('idle')
+    calmSolo()
+  })
+})
```

`src/game/stores/netStore.test.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/stores/netStore.test.ts b/src/game/stores/netStore.test.ts
--- a/src/game/stores/netStore.test.ts
+++ b/src/game/stores/netStore.test.ts
@@ -4,6 +4,7 @@ import { DEFAULT_LOOK } from '../data/characterParts'
 import type { ClientMsg, NetState, ServerMsg } from '../logic/netProtocol'
 import type { ConnStatus, Connector } from '../net/connection'
 import { remoteRig, selfBubble } from '../net/remoteRig'
+import { animalViews, lootList, resetAnimalRig, setHurtHandler } from '../hunt/animalRig'
 import { liveClock, useDayStore } from './dayStore'
 import { useNetStore } from './netStore'
 import { useProgressStore } from './progressStore'
@@ -273,3 +274,31 @@ describe('netStore', () => {
     expect(sent).toEqual([{ type: 'sleep', on: true }, { type: 'sleep', on: false }])
   })
 })
+
+describe('들판 동물 메시지 (3-3)', () => {
+  beforeEach(() => resetAnimalRig())
+
+  it('animals 를 쌓아 그리고, loot 는 전리품과 알림, hurt 는 처리기로. 방을 나오면 동물을 지운다', async () => {
+    await join()
+    push({ type: 'welcome', you: 'me', players: [] })
+    push({ type: 'animals', list: [[1, 0, 180, -40, 0, 2, 3]] })
+    expect(animalViews(true, performance.now() / 1000 + 1)).toEqual([{ id: 1, sp: 'cow', x: 180, z: -40, h: 0, pose: 'walk', hp: 3 }])
+    push({ type: 'loot', items: ['beef', 'bone'], x: 180, z: -40 })
+    expect(lootList().map((l) => l.item)).toEqual(['beef', 'bone'])
+    expect(notice()).toContain('사냥 성공')
+    const hurt = vi.fn()
+    setHurtHandler(hurt)
+    push({ type: 'hurt', dmg: 15, by: 'animal' })
+    expect(hurt).toHaveBeenCalledWith(15)
+    useNetStore.getState().leave()
+    expect(animalViews(true, performance.now() / 1000 + 1)).toEqual([])
+  })
+  it('명중은 같이 하는 중에만 보낸다', async () => {
+    useNetStore.getState().sendAnimalHit(1, 1, 'knife')
+    expect(sent).toEqual([])
+    await join()
+    push({ type: 'welcome', you: 'me', players: [] })
+    useNetStore.getState().sendAnimalHit(3, 2, 'stab')
+    expect(sent.at(-1)).toEqual({ type: 'animalHit', id: 3, dmg: 2, w: 'stab' })
+  })
+})
```

- [ ] **Step 2: 실행해 실패 확인**

Run: `npx vitest run src/game/logic/animalInterp.test.ts src/game/logic/loot.test.ts src/game/hunt src/game/stores src/game/scene/day`
Expected: FAIL — `"./animalInterp"`·`"./loot"`·`"./animalRig"` 를 찾을 수 없다, `store().hurt is not a function`, `takeHit` 이 없다

- [ ] **Step 3: 순수 로직 (이어 그리기·전리품)**

`src/game/logic/animalInterp.ts` (새 파일):

```ts
import { NET } from '../data/net'
import type { AnimalView } from './animalSim'
import { shortestAngleDelta } from './cameraYaw'

/** 받은 동물 목록과 받은 시각(초, 받은 쪽 시계) */
export type HerdSample = { at: number; list: AnimalView[] }

/** 버퍼 뒤에 붙인다. 이미 있는 것보다 옛것이면 그대로 두고, max 개만 남긴다 */
export function pushHerd(buf: HerdSample[], sample: HerdSample, max: number): HerdSample[] {
  const last = buf[buf.length - 1]
  if (last && sample.at <= last.at) return buf
  const next = [...buf, sample]
  return next.length > max ? next.slice(next.length - max) : next
}

/**
 * 시각 t 의 동물들 (다른 사람처럼 받은 두 목록 사이를 잇는다). 앞 목록에 있는 동물만 그린다:
 * 위치·방향은 뒤 목록의 같은 번호 쪽으로 잇고, 동작·체력은 앞 값. 뒤에 없거나(사라짐) 너무 멀면 앞 값 그대로.
 * 버퍼 앞보다 이르면 첫 목록, 뒤보다 늦으면 마지막 목록 (앞질러 짐작하지 않는다)
 */
export function herdAt(buf: readonly HerdSample[], t: number): AnimalView[] {
  if (buf.length === 0) return []
  if (t <= buf[0].at) return buf[0].list
  const last = buf[buf.length - 1]
  if (t >= last.at) return last.list
  let i = 0
  while (buf[i + 1].at <= t) i++
  const a = buf[i]
  const b = buf[i + 1]
  const k = (t - a.at) / (b.at - a.at)
  const next = new Map(b.list.map((v) => [v.id, v]))
  return a.list.map((v) => {
    const w = next.get(v.id)
    if (!w || Math.hypot(w.x - v.x, w.z - v.z) > NET.snapDistance) return v
    return { ...v, x: v.x + (w.x - v.x) * k, z: v.z + (w.z - v.z) * k, h: v.h + shortestAngleDelta(v.h, w.h) * k }
  })
}
```

`src/game/logic/loot.ts` (새 파일):

```ts
import { ANIMAL } from '../data/animals'
import type { RawItemId } from '../data/meadowItems'
import type { Rng } from './rng'

/** 바닥에 떨어진 전리품 하나 (세계 좌표). showAt: 보이기 시작하는 때 (쓰러진 동물이 사라질 때), phase: 둥실거리는 박자 */
export type Loot = { key: number; item: RawItemId; x: number; z: number; showAt: number; phase: number }

/**
 * 쓰러뜨린 자리(x, z) 둘레 1m 안에 흩어 떨어뜨린다 (은지 그대로). 쓰러진 동물이 사라지는 ANIMAL.corpse 초 뒤에 보인다.
 * firstKey 부터 번호를 붙인다
 */
export function dropLoot(items: readonly RawItemId[], x: number, z: number, now: number, firstKey: number, rng: Rng = Math.random): Loot[] {
  return items.map((item, i) => ({ key: firstKey + i, item, x: x + (rng() - 0.5), z: z + (rng() - 0.5), showAt: now + ANIMAL.corpse, phase: rng() * Math.PI * 2 }))
}

/** 보이는 것 중 (x, z) 에서 바닥 거리 ANIMAL.pickDist 안의 가장 가까운 것 (없으면 null) */
export function nearestLoot(list: readonly Loot[], x: number, z: number, now: number): Loot | null {
  let best: Loot | null = null
  let bestD: number = ANIMAL.pickDist
  for (const l of list) {
    if (now < l.showAt) continue
    const d = Math.hypot(l.x - x, l.z - z)
    if (d < bestD) {
      bestD = d
      best = l
    }
  }
  return best
}
```

- [ ] **Step 4: 모듈 객체 (스토어가 scene 을 import 하지 않게 `src/game/hunt/` 에 둔다)**

`src/game/hunt/animalRig.ts` (새 파일):

```ts
import type { RawItemId } from '../data/meadowItems'
import { NET } from '../data/net'
import { herdAt, pushHerd, type HerdSample } from '../logic/animalInterp'
import { calmHerd, herdViews, newHerd, type AnimalView, type Herd } from '../logic/animalSim'
import { dropLoot, type Loot } from '../logic/loot'

/**
 * 들판 동물과 전리품. 매 프레임 읽고 바뀌는 값이라 React 상태가 아닌 모듈 객체에 둔다 (net/remoteRig 와 같은 방식).
 * - 혼자: 내 화면이 무리(solo)를 돌린다 (scene/animals/HerdRunner). 저장하지 않는다 (은지 그대로)
 * - 같이: 서버가 200ms 마다 보낸 목록을 쌓아 두고 다른 사람처럼 NET.interpDelay 늦게 이어 그린다
 * 전리품은 잡은 사람 화면에만 있다 (혼자든 같이든)
 */

/** 혼자 할 때 시뮬레이션 속 내 id */
export const ME = 'me'

let solo: Herd | null = null
let room: HerdSample[] = []
let loot: Loot[] = []
let lootKey = 1

/** 혼자 할 때 무리 (처음 부를 때 만든다) */
export function soloHerd(): Herd {
  solo ??= newHerd()
  return solo
}

export function setSoloHerd(h: Herd) {
  solo = h
}

/** 죽어 침대에서 깨어날 때: 나를 쫓던 동물을 진정시킨다 (같이 하기에선 실내 침대로 옮겨져 서버 동물이 포기한다) */
export function calmSolo() {
  if (solo) solo = calmHerd(solo, ME)
}

/** 서버가 보낸 동물 목록 (now: 받은 때, netNow 초) */
export function receiveAnimals(list: AnimalView[], now: number) {
  room = pushHerd(room, { at: now, list }, NET.bufferSize)
}

/** 방을 나오거나 새로 들어가면 받은 동물을 지운다 */
export function forgetRoomAnimals() {
  room = []
}

/** 그릴(그리고 때릴) 동물. online: 같이 하는 중 (받은 목록을 늦게 이어 그린다), now: netNow 초 */
export function animalViews(online: boolean, now: number): AnimalView[] {
  if (online) return herdAt(room, now - NET.interpDelay)
  return solo ? herdViews(solo) : []
}

/** 전리품을 떨어뜨린다 (now: netNow 초. 쓰러진 동물이 사라질 때 보인다) */
export function spawnLoot(items: readonly RawItemId[], x: number, z: number, now: number) {
  const drops = dropLoot(items, x, z, now, lootKey)
  lootKey += drops.length
  loot = [...loot, ...drops]
}

export function lootList(): readonly Loot[] {
  return loot
}

/** 줍기: 목록에서 빼고 돌려준다 (이미 없으면 null) */
export function takeLoot(key: number): Loot | null {
  const l = loot.find((x) => x.key === key) ?? null
  if (l) loot = loot.filter((x) => x !== l)
  return l
}

/** 맞았을 때 할 일 (scene/animals/HerdRunner 가 붙인다: 체력을 깎고 죽음). 서버 hurt 와 혼자 시뮬레이션이 같이 쓴다 */
let hurtHandler: (dmg: number) => void = () => {}
export function setHurtHandler(f: (dmg: number) => void) {
  hurtHandler = f
}
export function receiveHurt(dmg: number) {
  hurtHandler(dmg)
}

/** 테스트용: 다 지운다 */
export function resetAnimalRig() {
  solo = null
  room = []
  loot = []
  lootKey = 1
  hurtHandler = () => {}
}
```

- [ ] **Step 5: 스토어와 죽음**

`src/game/stores/progressStore.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/stores/progressStore.ts b/src/game/stores/progressStore.ts
--- a/src/game/stores/progressStore.ts
+++ b/src/game/stores/progressStore.ts
@@ -37,7 +37,7 @@ import { migrateSave } from '../logic/saveMigration'
 import { unlockZone as unlockZoneRule } from '../logic/zoneUnlock'
 import { FIRST_MORNING, readClock, type Clock } from '../logic/dayClock'
 import { FRESH_SURVIVAL, faintPenalty, spendStamina, type Survival } from '../logic/stamina'
-import { afterDeath, afterSleep, tickSurvival, type SurvivalTickContext } from '../logic/survival'
+import { afterDeath, afterSleep, takeDamage, tickSurvival, type SurvivalTickContext } from '../logic/survival'
 
 export const SAVE_KEY = 'fishing-island-save-v1'
 
@@ -95,6 +95,8 @@ type ProgressActions = {
   sleepWell: (clock: Clock | null) => void
   /** 죽었다 침대에서 깨어났다: 체력 가득, 배고픔 60. 가방·코인·물고기는 그대로. clock 이 있으면(혼자) 그 시계로 */
   reviveAtBed: (clock: Clock | null) => void
+  /** 동물(3-3)·PvP(3-4) 에게 맞았다. 체력이 0 이 되면 true (죽음 → 침대, dayActions.startDeath) */
+  hurt: (amount: number) => boolean
   /** 물고기(한 마리 또는 여러 마리)로 요리해 먹는다. 재료가 안 맞거나 코인이 모자라면 false */
   cookDish: (dishId: DishId, fishIds: string | string[]) => boolean
   displayFish: (fishId: string) => boolean
@@ -362,6 +364,12 @@ export const useProgressStore = create<ProgressData & ProgressActions>()(
 
       reviveAtBed: (clock) => set({ survival: afterDeath(), ...(clock ? { clock } : {}) }),
 
+      hurt: (amount) => {
+        const r = takeDamage(get().survival, amount)
+        if (r.survival !== get().survival) set({ survival: r.survival })
+        return r.died
+      },
+
       cookDish: (dishId, fishIds) => {
         const s = get()
         const ids = Array.isArray(fishIds) ? fishIds : [fishIds]
```

`src/game/stores/sessionStore.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/stores/sessionStore.ts b/src/game/stores/sessionStore.ts
--- a/src/game/stores/sessionStore.ts
+++ b/src/game/stores/sessionStore.ts
@@ -59,6 +59,9 @@ type SessionState = {
   /** 손에 든 도구 (도구 칸). null = 빈손. 저장하지 않는다 (다시 들어오면 낚싯대) */
   tool: ToolId | null
   equip: (tool: ToolId | null) => void
+  /** 마지막으로 맞은 때 (performance.now() 초. 화면 가장자리가 빨갛게 번쩍인다, ui/HurtFlash). 저장하지 않는다 */
+  hurtAt: number | null
+  flashHurt: () => void
   setPlayerAction: (action: PlayerAction) => void
   setMode: (mode: Mode) => void
   zoomBy: (deltaY: number) => void
@@ -104,6 +107,8 @@ export const useSessionStore = create<SessionState>((set, get) => ({
   setStoveCook: (stoveCook) => set({ stoveCook }),
   tool: 'rod',
   equip: (tool) => set({ tool }),
+  hurtAt: null,
+  flashHurt: () => set({ hurtAt: performance.now() / 1000 }),
   setPlayerAction: (playerAction) => set({ playerAction }),
   // 배 타는 중엔 탐험으로 돌려도(로비 닫기 등) 도착할 때까지 배 모드를 지킨다
   // 상인 창이 아닌 모드로 가면 연 상인을 지운다
@@ -118,5 +123,5 @@ export const useSessionStore = create<SessionState>((set, get) => ({
   // 순간이동(쓰러져 진료소로 등)하면 타던 배에서 내린다
   requestTeleport: (pos) => set((s) => ({ teleport: pos, boat: null, mode: s.mode === 'boat' ? 'explore' : s.mode })),
   clearTeleport: () => set({ teleport: null }),
-  resetSession: () => set({ mode: 'explore', nearby: null, notice: null, teleport: null, zoom: CAMERA_ZOOM.initial, playerAction: IDLE_ACTION, cutscene: null, cooking: null, boat: null, tool: 'rod', stoveCook: null, vendor: null }),
+  resetSession: () => set({ mode: 'explore', nearby: null, notice: null, teleport: null, zoom: CAMERA_ZOOM.initial, playerAction: IDLE_ACTION, cutscene: null, cooking: null, boat: null, tool: 'rod', stoveCook: null, vendor: null, hurtAt: null }),
 }))
```

`src/game/scene/day/dayActions.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/scene/day/dayActions.ts b/src/game/scene/day/dayActions.ts
--- a/src/game/scene/day/dayActions.ts
+++ b/src/game/scene/day/dayActions.ts
@@ -1,4 +1,5 @@
 import { BED_WAKE } from '../../data/meadow'
+import { calmSolo } from '../../hunt/animalRig'
 import { nextMorning } from '../../logic/dayClock'
 import { seqEnd, seqSwitchAt, type SeqKind } from '../../logic/restSeq'
 import { liveClock, useDayStore } from '../../stores/dayStore'
@@ -68,12 +69,25 @@ export function startDeath() {
     useNetStore.getState().sendSleep(false)
   }
   useFishingStore.getState().end()
+  // 혼자: 나를 쫓던 동물이 진정한다 (같이: 침대가 실내라 서버 동물이 포기한다)
+  calmSolo()
   day.startSeq('death')
   const session = useSessionStore.getState()
   session.setMode('sleep')
   session.notify('쓰러졌어요… 침대에서 깨어납니다')
 }
 
+/**
+ * 동물(3-3)·PvP(3-4) 에게 맞았다: 체력을 깎고 화면 가장자리를 번쩍인다. 0 이 되면 죽음 (침대).
+ * 잠·죽음으로 화면이 어두워지는 중엔 맞지 않는다 (은지 그대로)
+ */
+export function takeHit(dmg: number) {
+  if (useDayStore.getState().seq) return
+  const died = useProgressStore.getState().hurt(dmg)
+  useSessionStore.getState().flashHurt()
+  if (died) startDeath()
+}
+
 /** 다 어두워진 순간: 자고 일어나기 / 침대에서 깨어나기. 같이 하는 중엔 시계가 방 것이라 건드리지 않는다 */
 function atDark(kind: SeqKind) {
   // 방 아침은 시계를 방이 이미 옮겼다. 어두워지는 중에 방을 나왔어도 혼자 시계를 하루 옮기지 않는다
```

`src/game/stores/netStore.ts` — welcome·error·다시 붙기·나가기에서 받은 동물을 지운다 (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/stores/netStore.ts b/src/game/stores/netStore.ts
--- a/src/game/stores/netStore.ts
+++ b/src/game/stores/netStore.ts
@@ -2,7 +2,9 @@ import { create } from 'zustand'
 import { createJSONStorage, persist } from 'zustand/middleware'
 import { NET, NET_SAVE_KEY } from '../data/net'
 import type { CharacterLook } from '../data/types'
-import type { ClientMsg, ErrorCode, JoinMode, NetState, ServerMsg } from '../logic/netProtocol'
+import type { MeleeId } from '../data/melee'
+import { unpackAnimals, type ClientMsg, type ErrorCode, type JoinMode, type NetState, type ServerMsg } from '../logic/netProtocol'
+import { forgetRoomAnimals, receiveAnimals, receiveHurt, spawnLoot } from '../hunt/animalRig'
 import { hubRoomName, hubRoomPassword } from '../logic/hubParams'
 import { allowEvery } from '../logic/rateLimit'
 import { cleanText, normalizeNick, normalizeRoomName, passHashFor, roomIdFor, textLength } from '../logic/roomKey'
@@ -41,6 +43,8 @@ type NetStore = {
   sendProfile: (nick: string, look: CharacterLook) => void
   /** 잠 투표: 침대에 누웠다(true) / 일어났다(false). 같이 하는 중에만 보낸다 */
   sendSleep: (on: boolean) => void
+  /** 들판 동물을 때렸다 (서버가 검사한다). 같이 하는 중에만 보낸다 */
+  sendAnimalHit: (id: number, dmg: number, w: MeleeId) => void
   /** 테스트에서 가짜 연결로 바꾼다 */
   _setConnector: (c: Connector) => void
 }
@@ -72,6 +76,7 @@ export const useNetStore = create<NetStore>()(
         switch (m.type) {
           case 'welcome': {
             forgetRemote()
+            forgetRoomAnimals()
             const peers: Record<string, Peer> = {}
             for (const p of m.players) {
               peers[p.id] = { nick: p.nick, look: p.look }
@@ -93,6 +98,7 @@ export const useNetStore = create<NetStore>()(
             hubRetry = null
             conn = null
             forgetRemote()
+            forgetRoomAnimals()
             set({ phase: 'off', room: null, you: null, peers: {}, error: m.code })
             useDayStore.getState().toSoloClock()
             // 같이 하던 중 거절당했으면(다시 붙다가 꽉 참 등) 이유를 볼 수 있게 로비로 돌아간다
@@ -143,6 +149,16 @@ export const useNetStore = create<NetStore>()(
             if (wasVoting) get().sendSleep(false)
             return
           }
+          case 'animals':
+            receiveAnimals(unpackAnimals(m.list), now)
+            return
+          case 'loot':
+            spawnLoot(m.items, m.x, m.z, now)
+            notify('사냥 성공! 재료를 떨어뜨렸어요 (E 로 줍기)')
+            return
+          case 'hurt':
+            receiveHurt(m.dmg)
+            return
         }
       }
 
@@ -170,6 +186,7 @@ export const useNetStore = create<NetStore>()(
         conn = null
         c?.close()
         forgetRemote()
+        forgetRoomAnimals()
         set({ phase: 'off', room: null, you: null, peers: {} })
         // 방을 나오면 저장된 혼자 시계로 돌아간다
         useDayStore.getState().toSoloClock()
@@ -195,6 +212,7 @@ export const useNetStore = create<NetStore>()(
             // 끊겨서 다시 붙는 중엔 다른 사람을 숨긴다 (다시 붙으면 welcome 으로 채운다)
             if (status === 'connecting' && get().phase === 'online') {
               forgetRemote()
+              forgetRoomAnimals()
               set({ phase: 'reconnecting', peers: {} })
             }
             // 처음부터 끝내 안 붙었다 (서버가 꺼져 있음 등)
@@ -262,6 +280,10 @@ export const useNetStore = create<NetStore>()(
           if (get().phase === 'online') conn?.send({ type: 'sleep', on })
         },
 
+        sendAnimalHit(id, dmg, w) {
+          if (get().phase === 'online') conn?.send({ type: 'animalHit', id, dmg, w })
+        },
+
         _setConnector(c) {
           connector = c
           lastChatAt = -Infinity
```

- [ ] **Step 6: 혼자 시뮬레이션과 화면 번쩍**

`src/game/scene/animals/HerdRunner.tsx` (새 파일):

```tsx
import { useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { isIndoor } from '../../data/meadow'
import { ME, setHurtHandler, setSoloHerd, soloHerd } from '../../hunt/animalRig'
import { stepHerd } from '../../logic/animalSim'
import { clampDelta, restStops } from '../../logic/time'
import { useDayStore } from '../../stores/dayStore'
import { useNetStore } from '../../stores/netStore'
import { useSessionStore } from '../../stores/sessionStore'
import { takeHit } from '../day/dayActions'
import { playerRig } from '../Player'

/**
 * 화면엔 아무것도 그리지 않는다. 혼자 할 때 들판 동물을 매 프레임 돌리고(같이 하면 서버가 돌린다), 들이받히면 체력을 깎는다.
 * 메뉴·꾸미기·로비나 잠·죽음으로 어두워지는 동안은 게임 시간처럼 멈춘다. 서버 hurt 도 같은 takeHit 로 받는다
 */
export function HerdRunner() {
  useEffect(() => {
    setHurtHandler(takeHit)
    return () => setHurtHandler(() => {})
  }, [])

  useFrame((_, delta) => {
    if (useNetStore.getState().phase !== 'off') return
    if (restStops(useSessionStore.getState().mode, useDayStore.getState().seq?.kind)) return
    const { x, z } = playerRig.position
    const r = stepHerd(soloHerd(), [{ id: ME, x, z, indoor: isIndoor(x, z) }], clampDelta(delta))
    setSoloHerd(r.herd)
    for (const e of r.events) if (e.type === 'attack' && e.target === ME) takeHit(e.dmg)
  })
  return null
}
```

`src/game/ui/HurtFlash.tsx` (새 파일):

```tsx
import { useEffect, useRef } from 'react'
import { useSessionStore } from '../stores/sessionStore'

/** 맞으면 화면 가장자리가 빨갛게 번쩍였다 사라진다 (은지 hurtEl) */
export function HurtFlash() {
  const hurtAt = useSessionStore((s) => s.hurtAt)
  const el = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (hurtAt === null) return
    el.current?.animate([{ opacity: 0.75 }, { opacity: 0 }], { duration: 500, easing: 'ease-out', fill: 'forwards' })
  }, [hurtAt])
  return <div ref={el} aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0, boxShadow: 'inset 0 0 120px 30px rgba(220, 30, 30, 0.85)' }} />
}
```

`src/game/scene/World.tsx` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/scene/World.tsx b/src/game/scene/World.tsx
--- a/src/game/scene/World.tsx
+++ b/src/game/scene/World.tsx
@@ -3,6 +3,7 @@ import { MeadowInteractions } from '../../meadow/MeadowInteractions'
 import { MeadowVendors } from '../../meadow/MeadowVendors'
 import { MeadowWorld } from '../../meadow/MeadowWorld'
 import { NetBridge } from '../net/NetBridge'
+import { HerdRunner } from './animals/HerdRunner'
 import { Docks } from './boat/Docks'
 import { DayCycle } from './day/DayCycle'
 import { FishingSpots } from './facilities/FishingSpots'
@@ -57,6 +58,7 @@ export function World() {
       <FishingController />
       <FishingVisuals />
       <PlayTimeTicker />
+      <HerdRunner />
       <DayCycle />
     </>
   )
```

`src/game/Game.tsx` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/Game.tsx b/src/game/Game.tsx
--- a/src/game/Game.tsx
+++ b/src/game/Game.tsx
@@ -27,6 +27,7 @@ import { FishingOverlay } from './ui/FishingOverlay'
 import { GoalTracker } from './ui/GoalTracker'
 import { Hud, NoticeLayer } from './ui/Hud'
 import { Hotbar } from './ui/Hotbar'
+import { HurtFlash } from './ui/HurtFlash'
 import { LoadingScreen } from './ui/LoadingScreen'
 import { SleepOverlay } from './ui/SleepOverlay'
 import { WeaknessOverlay } from './ui/WeaknessOverlay'
@@ -111,6 +112,7 @@ export function Game({ onExit, hub }: GameProps) {
         </Canvas>
       </div>
       <WeaknessOverlay />
+      <HurtFlash />
       <Hud />
       <Hotbar />
       <RoomBadge />
```

- [ ] **Step 7: 통과 확인**

Run: `npx vitest run && npx tsc -b && npm run lint 2>&1 | grep -c warning`
Expected: 73 파일 / 735 개 통과, tsc 출력 없음, `6`

- [ ] **Step 8: 커밋**

```bash
git add src/game/logic/animalInterp.ts \
  src/game/logic/animalInterp.test.ts \
  src/game/logic/loot.ts \
  src/game/logic/loot.test.ts \
  src/game/hunt/animalRig.ts \
  src/game/hunt/animalRig.test.ts \
  src/game/stores/progressStore.ts \
  src/game/stores/progressStore.test.ts \
  src/game/stores/sessionStore.ts \
  src/game/stores/netStore.ts \
  src/game/stores/netStore.test.ts \
  src/game/scene/day/dayActions.ts \
  src/game/scene/day/dayActions.test.ts \
  src/game/scene/animals/HerdRunner.tsx \
  src/game/ui/HurtFlash.tsx \
  src/game/scene/World.tsx \
  src/game/Game.tsx
git commit -F - <<'EOF'
feat: 동물 상태를 내 화면에 두고 맞으면 다치기

혼자면 내 화면이 들판 동물을 돌리고(HerdRunner), 같이면 서버가 보낸 animals 를 다른 사람처럼 늦게 이어 그린다.
들이받히거나 서버 hurt 를 받으면 체력이 줄고 화면 가장자리가 번쩍이며, 0 이면 침대 죽음.
죽으면 나를 쫓던 혼자 동물이 진정한다. 전리품 목록(잡은 사람 화면에만)을 둔다.
EOF
```

검증한 스크래치 커밋: `f52a979` (이 커밋의 diff 를 그대로 적용해도 된다: `git -C /private/tmp/claude-501/-Users-ihyelin-proten-hrlee-----threejs/e476c70e-362f-4ed3-9ff7-d8664da04e4b/scratchpad/plan-3-3/repo format-patch -1 --binary f52a979 --stdout | git apply --index` 한 뒤 위 커밋 명령. 스크래치 커밋의 작성자는 scratch 라 `git am` 은 쓰지 않는다)


### Task 6: 들판 동물 그리기와 전리품 줍기  — 스크래치 `cb6ab92`

**Files:**
- Create: `public/meadow/models/pets/` (복사), `src/game/scene/animals/animalModel.ts`, `src/game/scene/animals/Animals.tsx`, `src/game/scene/animals/lootMesh.ts`, `src/game/scene/animals/LootItems.tsx`, `src/game/hunt/huntActions.ts`
- Modify: `src/game/hunt/animalRig.ts`, `src/game/logic/interaction.ts`, `src/game/logic/meadowInteract.ts`, `src/game/ui/interactLabel.ts`, `src/game/input/useInteractionKeys.ts`, `src/meadow/MeadowInteractions.tsx`, `src/game/scene/World.tsx`, `src/meadow/vendor/README.md`, `tools/meadow-check.mjs`
- Test: `src/game/hunt/huntActions.test.ts`, `src/game/logic/interaction.test.ts`, `src/game/logic/meadowInteract.test.ts`

**Interfaces:**
- Consumes: Task 5 (`animalViews`·`lootList`·`takeLoot`·`netNow`), Task 2 (`AnimalView`·`AnimalPose`·`speciesOf`·`ANIMAL`·`SPECIES_IDS`), `nearestLoot` (Task 5), `shortestAngleDelta` (`logic/cameraYaw`)
- Produces:
  - `herdDrawn: { count: number }` (`hunt/animalRig.ts`)
  - `type AnimalObject`, `makeAnimal(sp, scene, clips, v)`, `updateAnimal(a, v, dt)`, `disposeAnimal(a)` (`scene/animals/animalModel.ts`), `makeLootMesh(id: RawItemId): Group` (`scene/animals/lootMesh.ts`), 컴포넌트 `Animals`·`LootItems`
  - `Interactable` 에 `{ kind: 'loot'; key: number; item: RawItemId }`, `KeyAction` 에 `{ type: 'pickLoot'; key: number }`, `pickLoot(key)` (`hunt/huntActions.ts`)

- [ ] **Step 1: 은지 동물 모델 복사 (CC0)**

```bash
cp -R /private/tmp/claude-501/-Users-ihyelin-proten-hrlee-----threejs/e476c70e-362f-4ed3-9ff7-d8664da04e4b/scratchpad/eunji/repo2/public/models/pets public/meadow/models/pets
ls -R public/meadow/models/pets   # animal-{bunny,chick,cow,deer,fox,hog,pig}.glb, LICENSE.txt, Textures/colormap.png (956KB)
```

(은지 저장소 https://github.com/Eunji1217/3js `f3c3808` 의 `public/models/pets/` 와 같다. 위 경로가 없으면 그 저장소에서 받는다. glb 는 `Textures/colormap.png` 를 상대 경로로 읽는다.)

- [ ] **Step 2: 실패하는 테스트 쓰기**

`src/game/hunt/huntActions.test.ts` (새 파일):

```ts
// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { INITIAL_PROGRESS, useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'
import { lootList, resetAnimalRig, spawnLoot } from './animalRig'
import { pickLoot } from './huntActions'

beforeEach(() => {
  localStorage.clear()
  resetAnimalRig()
  useProgressStore.setState({ ...INITIAL_PROGRESS })
  useSessionStore.getState().resetSession()
})

describe('전리품 줍기', () => {
  it('가방에 넣고 "획득 (n개)" 알림, 바닥에서 빠지고 E 대상도 지운다', () => {
    spawnLoot(['beef', 'beef'], 180, -40, 0)
    useSessionStore.getState().setNearby({ kind: 'loot', key: 1, item: 'beef' })
    pickLoot(1)
    pickLoot(2)
    expect(useProgressStore.getState().items.beef).toBe(2)
    expect(useSessionStore.getState().notice?.text).toBe('🥩 소고기 획득 (2개)')
    expect(lootList()).toEqual([])
    expect(useSessionStore.getState().nearby).toBeNull()
  })
  it('이미 주운 번호는 아무 일도 없다', () => {
    pickLoot(9)
    expect(useProgressStore.getState().items.beef).toBe(0)
  })
})
```

`src/game/logic/interaction.test.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/logic/interaction.test.ts b/src/game/logic/interaction.test.ts
--- a/src/game/logic/interaction.test.ts
+++ b/src/game/logic/interaction.test.ts
@@ -180,3 +180,13 @@ describe('resolveKeyAction', () => {
     expect(resolveKeyAction('Escape', 'vendor', null)).toEqual({ type: 'closePanel' })
   })
 })
+
+describe('전리품 줍기 (3-3)', () => {
+  it('탐험 중 전리품 앞에서 E → 줍기, 같은 번호면 같은 대상', () => {
+    const beef = { kind: 'loot', key: 5, item: 'beef' } as const
+    expect(resolveKeyAction('KeyE', 'explore', beef)).toEqual({ type: 'pickLoot', key: 5 })
+    expect(resolveKeyAction('KeyE', 'bag', beef)).toEqual({ type: 'none' })
+    expect(isSameInteractable(beef, { ...beef })).toBe(true)
+    expect(isSameInteractable(beef, { ...beef, key: 6 })).toBe(false)
+  })
+})
```

`src/game/logic/meadowInteract.test.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/logic/meadowInteract.test.ts b/src/game/logic/meadowInteract.test.ts
--- a/src/game/logic/meadowInteract.test.ts
+++ b/src/game/logic/meadowInteract.test.ts
@@ -33,6 +33,13 @@ describe('초원 감시자가 nearby 를 바꾸는 규칙', () => {
     expect(meadowNearbyUpdate({ kind: 'stove' }, shroom)).toEqual(shroom)
     expect(meadowNearbyUpdate(shroom, { ...shroom })).toBe('keep')
   })
+  it('전리품도 감시자 몫: 번호가 다르면 바꾸고, 주워서 없어지면 지운다', () => {
+    const beef = { kind: 'loot', key: 3, item: 'beef' } as const
+    expect(meadowNearbyUpdate(shroom, beef)).toEqual(beef)
+    expect(meadowNearbyUpdate(beef, { ...beef, key: 4 })).toEqual({ ...beef, key: 4 })
+    expect(meadowNearbyUpdate(beef, null)).toBe('clear')
+    expect(meadowNearbyUpdate({ kind: 'bed' }, beef)).toBe('keep')
+  })
   it('못 찾으면 내가 잡은 것만 지운다', () => {
     expect(meadowNearbyUpdate(shroom, null)).toBe('clear')
     expect(meadowNearbyUpdate(null, null)).toBe('keep')
```

- [ ] **Step 3: 실행해 실패 확인**

Run: `npx vitest run src/game/hunt src/game/logic/interaction.test.ts src/game/logic/meadowInteract.test.ts`
Expected: FAIL — `"./huntActions"` 를 찾을 수 없다, `pickLoot` 대신 `none`, 전리품을 감시자가 바꾸지 않는다(`keep`)

- [ ] **Step 4: 전리품 E 대상과 줍기**

`src/game/logic/interaction.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/logic/interaction.ts b/src/game/logic/interaction.ts
--- a/src/game/logic/interaction.ts
+++ b/src/game/logic/interaction.ts
@@ -1,4 +1,5 @@
 import { BAITS, NO_BAIT_KEY, type BaitId } from '../data/bait'
+import type { RawItemId } from '../data/meadowItems'
 import type { VendorId } from '../data/meadowPrices'
 import { HOTBAR, hotbarSlot, type ToolId } from '../data/tools'
 import type { ZoneId } from '../data/types'
@@ -54,6 +55,8 @@ export type Interactable =
   | { kind: 'door'; index: number }
   /** 마을 상인 */
   | { kind: 'vendor'; id: VendorId }
+  /** 바닥에 떨어진 사냥 전리품 (key: hunt/animalRig 번호) */
+  | { kind: 'loot'; key: number; item: RawItemId }
 
 export function isSameInteractable(a: Interactable | null, b: Interactable): boolean {
   if (!a || a.kind !== b.kind) return false
@@ -63,6 +66,7 @@ export function isSameInteractable(a: Interactable | null, b: Interactable): boo
   if (a.kind === 'pickup' && b.kind === 'pickup') return a.index === b.index
   if (a.kind === 'door' && b.kind === 'door') return a.index === b.index
   if (a.kind === 'vendor' && b.kind === 'vendor') return a.id === b.id
+  if (a.kind === 'loot' && b.kind === 'loot') return a.key === b.key
   return true
 }
 
@@ -90,6 +94,8 @@ export type KeyAction =
   | { type: 'toggleDoor'; index: number }
   /** 상인 사고팔기 창 */
   | { type: 'openVendor'; id: VendorId }
+  /** 전리품 줍기 */
+  | { type: 'pickLoot'; key: number }
 
 /** 요리 연출을 건너뛰는 키 (E·Space·Enter·ESC). 수리 연출은 건너뛰지 않는다 */
 export function isCookingSkipKey(code: string): boolean {
@@ -157,6 +163,8 @@ export function resolveKeyAction(code: string, mode: Mode, nearby: Interactable
         return { type: 'toggleDoor', index: nearby.index }
       case 'vendor':
         return { type: 'openVendor', id: nearby.id }
+      case 'loot':
+        return { type: 'pickLoot', key: nearby.key }
       case 'stove':
         // 가방의 요리법 탭이 열린다 (BagPanel 이 가스레인지 앞인지 본다)
         return { type: 'openMode', mode: 'bag' }
```

`src/game/logic/meadowInteract.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/logic/meadowInteract.ts b/src/game/logic/meadowInteract.ts
--- a/src/game/logic/meadowInteract.ts
+++ b/src/game/logic/meadowInteract.ts
@@ -23,8 +23,8 @@ export function nearestSpot(px: number, pz: number, spots: readonly MeadowSpot[]
   return best?.target ?? null
 }
 
-/** 초원 감시자(MeadowInteractions)가 정하는 E 대상 종류. 그 밖(침대 감지 상자·물가 낚시 등)은 건드리지 않는다 */
-const MEADOW_KINDS: ReadonlySet<string> = new Set(['pickup', 'stove', 'door', 'vendor'])
+/** 초원 감시자(MeadowInteractions)가 정하는 E 대상 종류 (전리품 포함). 그 밖(침대 감지 상자·물가 낚시 등)은 건드리지 않는다 */
+const MEADOW_KINDS: ReadonlySet<string> = new Set(['pickup', 'stove', 'door', 'vendor', 'loot'])
 
 /**
  * 이번 프레임에 찾은 초원 대상(found)으로 nearby 를 어떻게 할까: 'keep' 그대로, 'clear' 지우기, 아니면 그 대상으로 바꾸기.
```

`src/game/ui/interactLabel.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/ui/interactLabel.ts b/src/game/ui/interactLabel.ts
--- a/src/game/ui/interactLabel.ts
+++ b/src/game/ui/interactLabel.ts
@@ -3,7 +3,7 @@ import { MARKET } from '../data/market'
 import { ITEMS } from '../data/meadowItems'
 import type { Interactable } from '../logic/interaction'
 
-const LABEL: Record<Exclude<Interactable['kind'], 'zoneGate' | 'dock' | 'pickup' | 'door' | 'vendor'>, string> = {
+const LABEL: Record<Exclude<Interactable['kind'], 'zoneGate' | 'dock' | 'pickup' | 'door' | 'vendor' | 'loot'>, string> = {
   fishingSpot: '낚시하기',
   sellBox: '물고기 팔기',
   gearShop: '장비 상점',
@@ -30,6 +30,7 @@ export function interactLabel(target: Interactable): string {
   }
   if (target.kind === 'door') return `🚪 ${MEADOW_DOORS[target.index] ?? '문'} 여닫기`
   if (target.kind === 'pickup') return `${ITEMS[target.item].icon} ${ITEMS[target.item].name} 따기`
+  if (target.kind === 'loot') return `${ITEMS[target.item].icon} ${ITEMS[target.item].name} 줍기`
   if (target.kind === 'dock') return target.dir === 'toIsland' ? '⛵ 배 타기 (섬으로)' : '⛵ 배 타기 (초원으로)'
   return LABEL[target.kind]
 }
```

`src/game/hunt/huntActions.ts` (새 파일):

```ts
import { ITEMS } from '../data/meadowItems'
import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'
import { takeLoot } from './animalRig'

/** E 로 전리품 줍기 → 가방 (은지 그대로 "🥩 소고기 획득 (3개)") */
export function pickLoot(key: number) {
  const l = takeLoot(key)
  if (!l) return
  const progress = useProgressStore.getState()
  progress.addItem(l.item)
  const { icon, name } = ITEMS[l.item]
  const session = useSessionStore.getState()
  session.clearNearby({ kind: 'loot', key, item: l.item })
  session.notify(`${icon} ${name} 획득 (${useProgressStore.getState().items[l.item]}개)`)
}
```

`src/game/input/useInteractionKeys.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/input/useInteractionKeys.ts b/src/game/input/useInteractionKeys.ts
--- a/src/game/input/useInteractionKeys.ts
+++ b/src/game/input/useInteractionKeys.ts
@@ -1,6 +1,7 @@
 import { useEffect } from 'react'
 import { isCookingSkipKey, resolveKeyAction } from '../logic/interaction'
 import { harvest, toggleDoor } from '../../meadow/meadowActions'
+import { pickLoot } from '../hunt/huntActions'
 import { finishCooking } from '../scene/cooking/finishCooking'
 import { startSleep, wake } from '../scene/day/dayActions'
 import { useFishingStore } from '../stores/fishingStore'
@@ -80,6 +81,9 @@ export function runKeyAction(code: string): boolean {
     case 'harvest':
       harvest(action.index)
       break
+    case 'pickLoot':
+      pickLoot(action.key)
+      break
     case 'eatBest':
       eatBestNow()
       break
```

`src/meadow/MeadowInteractions.tsx` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/meadow/MeadowInteractions.tsx b/src/meadow/MeadowInteractions.tsx
--- a/src/meadow/MeadowInteractions.tsx
+++ b/src/meadow/MeadowInteractions.tsx
@@ -1,7 +1,11 @@
 import { useFrame } from '@react-three/fiber'
 import { MEADOW_RECT, toMeadowLocal } from '../game/data/meadow'
+import { lootList } from '../game/hunt/animalRig'
+import type { Interactable } from '../game/logic/interaction'
+import { nearestLoot } from '../game/logic/loot'
 import { meadowNearbyUpdate, nearestSpot, type MeadowSpot } from '../game/logic/meadowInteract'
 import { clampDelta } from '../game/logic/time'
+import { netNow } from '../game/net/remoteRig'
 import { playerRig } from '../game/scene/Player'
 import { useSessionStore } from '../game/stores/sessionStore'
 import { stepStoveCook } from './meadowActions'
@@ -12,7 +16,8 @@ const usable = (s: MeadowSpot) => s.target.kind !== 'pickup' || meadowPickups()[
 
 /**
  * 화면엔 아무것도 그리지 않고, 매 프레임 초원 E 대상(meadowSpots)을 은지처럼 가장 가까운 것 하나로 고른다.
- * 감지 상자(침대 등)나 물가 낚시가 이미 잡혀 있으면 그쪽이 먼저다. 버섯 다시 자라기와 가스레인지 요리 완성도 여기서
+ * 발밑(1.6m) 전리품이 있으면 그게 먼저다 (방금 잡은 걸 줍는다). 감지 상자(침대 등)나 물가 낚시가 이미 잡혀 있으면 그쪽이 먼저다.
+ * 버섯 다시 자라기와 가스레인지 요리 완성도 여기서
  */
 export function MeadowInteractions() {
   useFrame((_, delta) => {
@@ -23,7 +28,8 @@ export function MeadowInteractions() {
     const { x, z } = playerRig.position
     // 섬에선 찾지 않는다 (내가 잡아 둔 게 있으면 지운다)
     const [lx, lz] = toMeadowLocal(x, z)
-    const found = x > MEADOW_RECT.x0 - 2 ? nearestSpot(lx, lz, meadowSpots(), usable) : null
+    const loot = nearestLoot(lootList(), x, z, netNow())
+    const found: Interactable | null = loot ? { kind: 'loot', key: loot.key, item: loot.item } : x > MEADOW_RECT.x0 - 2 ? nearestSpot(lx, lz, meadowSpots(), usable) : null
     const current = session.nearby
     const next = meadowNearbyUpdate(current, found)
     if (next === 'clear') {
```

- [ ] **Step 5: 동물·전리품 그리기**

`src/game/hunt/animalRig.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/hunt/animalRig.ts b/src/game/hunt/animalRig.ts
--- a/src/game/hunt/animalRig.ts
+++ b/src/game/hunt/animalRig.ts
@@ -11,6 +11,9 @@ import { dropLoot, type Loot } from '../logic/loot'
  * 전리품은 잡은 사람 화면에만 있다 (혼자든 같이든)
  */
 
+/** 장면에 그려 둔 동물 수 (scene/animals/Animals 가 매 프레임 적는다. 헤드리스 점검이 모델이 붙었는지 본다) */
+export const herdDrawn = { count: 0 }
+
 /** 혼자 할 때 시뮬레이션 속 내 id */
 export const ME = 'me'
```

`src/game/scene/animals/animalModel.ts` (새 파일):

```ts
import { AnimationMixer, type AnimationAction, type AnimationClip, type Material, type Mesh, type MeshStandardMaterial, type Object3D } from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { ANIMAL, speciesOf, type SpeciesId } from '../../data/animals'
import type { AnimalPose, AnimalView } from '../../logic/animalSim'
import { shortestAngleDelta } from '../../logic/cameraYaw'

/** 동작 → 은지 Cube Pets 클립 (들이받기는 머리를 숙이는 eat, 쓰러지면 idle 위에 옆으로 눕힌다) */
const CLIP: Record<AnimalPose, 'idle' | 'walk' | 'run' | 'eat'> = { idle: 'idle', eat: 'eat', walk: 'walk', run: 'run', butt: 'eat', dead: 'idle' }
/** 방향을 따라 도는 빠르기 (은지 8) */
const TURN = 8

/** 장면에 놓인 동물 한 마리 (그리기만. 움직임은 animalSim 이 정한다) */
export type AnimalObject = {
  obj: Object3D
  mixer: AnimationMixer
  actions: Partial<Record<'idle' | 'walk' | 'run' | 'eat', AnimationAction>>
  current: AnimationAction | null
  /** 번쩍이려고 동물마다 따로 복제한 재질 */
  mats: MeshStandardMaterial[]
  /** 마지막으로 본 체력 (줄면 번쩍) */
  hp: number
  flash: number
  /** 넘어진 정도 0..1 */
  fall: number
}

/** 모델을 복제해 동물 하나를 만든다 (SkeletonUtils.clone: 뼈까지 따로. 클립은 노드 이름으로 붙는다) */
export function makeAnimal(sp: SpeciesId, scene: Object3D, clips: AnimationClip[], v: AnimalView): AnimalObject {
  const obj = cloneSkinned(scene)
  obj.scale.setScalar(speciesOf(sp).scale)
  const mats: MeshStandardMaterial[] = []
  obj.traverse((o) => {
    const m = o as Mesh
    if (!m.isMesh) return
    m.castShadow = true
    m.material = (m.material as Material).clone()
    mats.push(m.material as MeshStandardMaterial)
  })
  obj.position.set(v.x, 0, v.z)
  obj.rotation.y = v.h
  const mixer = new AnimationMixer(obj)
  const actions: AnimalObject['actions'] = {}
  for (const name of ['idle', 'walk', 'run', 'eat'] as const) {
    const clip = clips.find((c) => c.name === name)
    if (clip) actions[name] = mixer.clipAction(clip)
  }
  const a: AnimalObject = { obj, mixer, actions, current: null, mats, hp: v.hp, flash: 0, fall: v.pose === 'dead' ? 1 : 0 }
  play(a, v.pose)
  return a
}

function play(a: AnimalObject, pose: AnimalPose) {
  const next = a.actions[CLIP[pose]] ?? a.actions.idle ?? null
  if (!next || next === a.current) return
  next.reset().fadeIn(0.2).play()
  a.current?.fadeOut(0.2)
  a.current = next
}

/** 매 프레임: 자리·방향(부드럽게)·클립, 맞으면 빨갛게 번쩍, 쓰러지면 0.5초 동안 옆으로 넘어진다 (은지 그대로) */
export function updateAnimal(a: AnimalObject, v: AnimalView, dt: number) {
  a.obj.position.set(v.x, 0, v.z)
  if (v.hp < a.hp) a.flash = ANIMAL.flash
  a.hp = v.hp
  if (v.pose === 'dead') {
    a.fall = Math.min(1, a.fall + dt / ANIMAL.fall)
    a.obj.rotation.z = (Math.PI / 2) * (1 - (1 - a.fall) ** 3)
  } else {
    a.obj.rotation.y += shortestAngleDelta(a.obj.rotation.y, v.h) * Math.min(1, TURN * dt)
  }
  if (a.flash > 0) a.flash = Math.max(0, a.flash - dt)
  const k = a.flash / ANIMAL.flash
  for (const m of a.mats) m.emissive.setRGB(k, 0, 0)
  play(a, v.pose)
  a.mixer.update(dt)
}

/** 장면에서 뺄 때 복제한 재질을 버린다 (형태는 원본과 같이 쓰므로 그대로) */
export function disposeAnimal(a: AnimalObject) {
  a.mixer.stopAllAction()
  for (const m of a.mats) m.dispose()
}
```

`src/game/scene/animals/Animals.tsx` (새 파일):

```tsx
import { useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { SPECIES_IDS, type SpeciesId } from '../../data/animals'
import { animalViews, herdDrawn } from '../../hunt/animalRig'
import { clampDelta } from '../../logic/time'
import { netNow } from '../../net/remoteRig'
import { useNetStore } from '../../stores/netStore'
import { disposeAnimal, makeAnimal, updateAnimal, type AnimalObject } from './animalModel'

const petUrl = (id: SpeciesId) => `${import.meta.env.BASE_URL}meadow/models/pets/animal-${id}.glb`
const URLS = SPECIES_IDS.map(petUrl)
for (const url of URLS) useGLTF.preload(url)

/**
 * 들판 동물 그리기 (은지 Kenney Cube Pets, CC0). 혼자면 내 화면 무리, 같이면 서버 목록을 이어 그린 값 (hunt/animalRig).
 * 동물은 번호·종마다 한 번 복제해 두고 매 프레임 자리만 바꾼다. 목록에서 빠지면(쓰러진 뒤 1.4초) 장면에서 뺀다.
 * 혼자 무리와 방 무리는 번호가 겹치므로(둘 다 1번부터) 종까지 열쇠로 쓴다
 */
export function Animals() {
  const gltfs = useGLTF(URLS)
  const group = useRef<Group>(null)
  const pool = useRef(new Map<string, AnimalObject>())

  useFrame((_, delta) => {
    const g = group.current
    if (!g) return
    const dt = clampDelta(delta)
    const views = animalViews(useNetStore.getState().phase !== 'off', netNow())
    const seen = new Set<string>()
    for (const v of views) {
      const key = `${v.sp}:${v.id}`
      seen.add(key)
      let a = pool.current.get(key)
      if (!a) {
        const gltf = gltfs[SPECIES_IDS.indexOf(v.sp)]
        a = makeAnimal(v.sp, gltf.scene, gltf.animations, v)
        pool.current.set(key, a)
        g.add(a.obj)
      }
      updateAnimal(a, v, dt)
    }
    for (const [key, a] of pool.current) {
      if (seen.has(key)) continue
      g.remove(a.obj)
      disposeAnimal(a)
      pool.current.delete(key)
    }
    herdDrawn.count = pool.current.size
  })

  return <group ref={group} />
}
```

`src/game/scene/animals/lootMesh.ts` (새 파일):

```ts
import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry } from 'three'
import type { RawItemId } from '../../data/meadowItems'

/** 고기 색 (은지 makeItemMesh) */
const MEAT_COLOR: Partial<Record<RawItemId, number>> = { beef: 0xc8484e, pork: 0xe8a0a8, boar: 0x9a3a3a, venison: 0x8a3a2a, rabbit: 0xe0b0a8, foxmeat: 0xd07060, chicken: 0xf0c8a0 }

// 모양·재질은 한 벌만 만들어 같이 쓴다 (전리품마다 새로 만들지 않는다)
const geo = {
  boneShaft: new CylinderGeometry(0.035, 0.035, 0.36, 8),
  knob: new SphereGeometry(0.06, 8, 8),
  fat: new BoxGeometry(0.24, 0.12, 0.18),
  egg: new SphereGeometry(0.1, 10, 10),
  meat: new SphereGeometry(0.16, 12, 10),
  meatBone: new CylinderGeometry(0.03, 0.03, 0.3, 8),
}
const mats = new Map<number, MeshStandardMaterial>()
const std = (color: number, roughness = 0.6) => {
  const key = color * 10 + Math.round(roughness * 10)
  let m = mats.get(key)
  if (!m) {
    m = new MeshStandardMaterial({ color, roughness })
    mats.set(key, m)
  }
  return m
}

/** 바닥에 떨어진 전리품 모양 (은지 makeItemMesh: 뼈·비계·달걀, 나머지는 색만 다른 뼈 붙은 고기) */
export function makeLootMesh(id: RawItemId): Group {
  const g = new Group()
  const add = (m: Mesh) => {
    m.castShadow = true
    g.add(m)
    return m
  }
  if (id === 'bone') {
    add(new Mesh(geo.boneShaft, std(0xf2eee4))).rotation.z = Math.PI / 2
    add(new Mesh(geo.knob, std(0xf2eee4))).position.x = -0.18
    add(new Mesh(geo.knob, std(0xf2eee4))).position.x = 0.18
  } else if (id === 'fat') {
    add(new Mesh(geo.fat, std(0xf4e2b0)))
  } else if (id === 'egg') {
    add(new Mesh(geo.egg, std(0xfaf3e0, 0.4))).scale.set(1, 1.3, 1)
  } else {
    add(new Mesh(geo.meat, std(MEAT_COLOR[id] ?? 0xc8484e))).scale.set(1.3, 0.7, 1)
    const bone = add(new Mesh(geo.meatBone, std(0xf2eee4)))
    bone.rotation.z = Math.PI / 2
    bone.position.x = 0.22
  }
  return g
}
```

`src/game/scene/animals/LootItems.tsx` (새 파일):

```tsx
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { lootList } from '../../hunt/animalRig'
import { netNow } from '../../net/remoteRig'
import { makeLootMesh } from './lootMesh'

/** 바닥에 떨어진 전리품: 둥실거리며 돈다 (은지 그대로). 쓰러진 동물이 사라진 뒤 보이고, 주우면 빠진다 */
export function LootItems() {
  const group = useRef<Group>(null)
  const pool = useRef(new Map<number, Group>())

  useFrame(({ clock }, delta) => {
    const g = group.current
    if (!g) return
    const now = netNow()
    const t = clock.elapsedTime
    const seen = new Set<number>()
    for (const l of lootList()) {
      if (now < l.showAt) continue
      seen.add(l.key)
      let m = pool.current.get(l.key)
      if (!m) {
        m = makeLootMesh(l.item)
        m.position.set(l.x, 0.15, l.z)
        pool.current.set(l.key, m)
        g.add(m)
      }
      m.position.y = 0.15 + Math.sin(t * 3 + l.phase) * 0.04
      m.rotation.y += delta
    }
    for (const [key, m] of pool.current) {
      if (seen.has(key)) continue
      g.remove(m)
      pool.current.delete(key)
    }
  })

  return <group ref={group} />
}
```

`src/game/scene/World.tsx` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/scene/World.tsx b/src/game/scene/World.tsx
--- a/src/game/scene/World.tsx
+++ b/src/game/scene/World.tsx
@@ -1,9 +1,12 @@
+import { Suspense } from 'react'
 import { MeadowLighting } from '../../meadow/MeadowLighting'
 import { MeadowInteractions } from '../../meadow/MeadowInteractions'
 import { MeadowVendors } from '../../meadow/MeadowVendors'
 import { MeadowWorld } from '../../meadow/MeadowWorld'
 import { NetBridge } from '../net/NetBridge'
+import { Animals } from './animals/Animals'
 import { HerdRunner } from './animals/HerdRunner'
+import { LootItems } from './animals/LootItems'
 import { Docks } from './boat/Docks'
 import { DayCycle } from './day/DayCycle'
 import { FishingSpots } from './facilities/FishingSpots'
@@ -59,6 +62,11 @@ export function World() {
       <FishingVisuals />
       <PlayTimeTicker />
       <HerdRunner />
+      {/* 동물 모델을 받는 동안 다른 것은 먼저 그린다 */}
+      <Suspense fallback={null}>
+        <Animals />
+      </Suspense>
+      <LootItems />
       <DayCycle />
     </>
   )
```

`src/meadow/vendor/README.md` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/meadow/vendor/README.md b/src/meadow/vendor/README.md
--- a/src/meadow/vendor/README.md
+++ b/src/meadow/vendor/README.md
@@ -1,6 +1,6 @@
 # 은지 게임(Room Sim) 코드 복사본
 
-- 출처: https://github.com/Eunji1217/3js 커밋 `f3c3808` 의 `src/` (모델은 `public/models/{kenney,nature,town,food}` → `public/meadow/models/`, 모두 CC0)
+- 출처: https://github.com/Eunji1217/3js 커밋 `f3c3808` 의 `src/` (모델은 `public/models/{kenney,nature,town,food,pets}` → `public/meadow/models/`, 모두 CC0. 동물(pets, Kenney Cube Pets)은 3-3 에서 TS 로 옮긴 `logic/animalSim`·`scene/animals` 가 쓴다)
 - 고친 곳은 `// rinfish:` 로 찾는다: 모델 경로(paths.js), 사격장 설비·동물·거울(world.js), 상인 NPC(town.js), 들판·마을 ready 를 allSettled 로(outdoor.js·town.js)
 - 남의 코드라 oxlint 검사에서 뺀다. 타입은 우리가 쓰는 부분만 `.d.ts` 에 선언한다
 - 은지 원본이 바뀌면 같은 파일을 다시 복사하고 `// rinfish:` 자리만 다시 고친다
```

- [ ] **Step 6: 헤드리스 점검 28~30 을 더한다**

3-3 점검은 새 Chrome(디버깅 포트 9742)으로 `27)` 뒤, 마지막 셰이더 점검 앞에 붙인다.

`tools/meadow-check.mjs` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/tools/meadow-check.mjs b/tools/meadow-check.mjs
--- a/tools/meadow-check.mjs
+++ b/tools/meadow-check.mjs
@@ -1,4 +1,4 @@
-// 초원 + 배 점검 (헤드리스 Chrome). 스크린샷을 남긴다
+// 초원 + 배 + 은지 기능(3-1 시간·생존, 3-2 도구·가방·상인, 3-3 동물·사냥) 점검 (헤드리스 Chrome). 스크린샷을 남긴다
 // 준비: npm run server:dev (8787) 와 VITE_ROOM_SERVER=ws://127.0.0.1:8787 npx vite --port 5190 --strictPort
 // 사용: node tools/meadow-check.mjs [게임 주소] [스크린샷 폴더]
 import { spawn } from 'node:child_process'
@@ -671,6 +671,43 @@ check(await B4.until(`${remoteTool}.then((t) => t === 'knife')`, 8000), '27) A 
 A4.close()
 B4.close()
 
+// ── 3-3 동물과 사냥 (28~) ──
+const H = await open(9742, 0)
+await H.evaluate(`__click('혼자 하기')`)
+await wait(3000)
+const HS = `(await __mod('/src/game/stores/sessionStore.ts')).useSessionStore.getState()`
+const HP = `(await __mod('/src/game/stores/progressStore.ts')).useProgressStore.getState()`
+const RIG = `(await __mod('/src/game/hunt/animalRig.ts'))`
+const hev = (expr) => H.evaluate(`(async () => { const r = ${RIG}; const s = ${HS}; const p = ${HP}; return ${expr} })()`)
+const hpress = async (code, k = code) => { await H.key('keydown', code, k); await H.key('keyup', code, k); await wait(300) }
+const herd = () => hev(`r.animalViews(false, 0)`)
+
+// 28) 혼자: 들판(세계 x 166..206, z -52..-26)에 동물 12마리, 은지 Cube Pets 모델을 받는다
+await H.evaluate(teleport(186, -23))
+await wait(1500)
+await turnTo(H, 0, -40)
+check(await H.until(`(async () => ${RIG}.herdDrawn.count === 12)()`, 30000), '28) 동물 모델을 받아 12마리를 그린다')
+const herd28 = await herd()
+check(herd28.length === 12 && herd28.every((a) => a.x >= 155 && a.x <= 217 && a.z >= -59 && a.z <= -23), `28) 혼자 하면 들판에 동물 12마리 (${herd28.length})`)
+await wait(1500)
+await H.shot('28-animals')
+
+// 29) 혼자 시뮬레이션이 돈다: 2초 뒤 누군가는 움직였다
+const moved = await H.until(`(async () => { const r = ${RIG}; const now = r.animalViews(false, 0); return now.some((a) => { const b = ${JSON.stringify(herd28)}.find((x) => x.id === a.id); return b && Math.hypot(a.x - b.x, a.z - b.z) > 0.3 }) })()`, 8000)
+check(moved, '29) 동물이 돌아다닌다')
+
+// 30) 발밑 전리품: E "소고기 줍기" → 가방
+const me = await H.evaluate(pos)
+await hev(`(r.spawnLoot(['beef', 'bone'], ${me[0] + 0.4}, ${me[2]}, performance.now() / 1000 - 2), true)`)
+check(await H.until(`document.body.innerText.includes('줍기')`, 4000), '30) 전리품 앞 "줍기" 안내')
+await H.shot('30-loot')
+const before30 = await hev(`[p.items.beef, p.items.bone]`)
+await hpress('KeyE', 'e')
+await hpress('KeyE', 'e')
+const after30 = await hev(`[p.items.beef, p.items.bone, r.lootList().length]`)
+check(after30[0] === before30[0] + 1 && after30[1] === before30[1] + 1 && after30[2] === 0, `30) E 두 번에 소고기·뼈가 가방으로 (${before30} → ${after30})`)
+H.close()
+
 check(!consoleErrors.some((e) => /shader|WebGLProgram/i.test(e)), '셰이더 컴파일 오류가 없다')
 if (consoleErrors.length) console.log(`콘솔 오류·경고 ${consoleErrors.length}개:\n${consoleErrors.slice(0, 20).join('\n')}`)
```

- [ ] **Step 7: 통과 확인**

Run: `npx vitest run && npx tsc -b && npm run lint 2>&1 | grep -c warning`
Expected: 74 파일 / 739 개 통과, tsc 출력 없음, `6`

Run (서버·Vite 켜 둔 채, Global Constraints 의 준비): `node tools/meadow-check.mjs http://localhost:5190`
Expected: 28~30 모두 `OK` — "동물 모델을 받아 12마리를 그린다", "혼자 하면 들판에 동물 12마리 (12)", "동물이 돌아다닌다", "전리품 앞 \"줍기\" 안내", "E 두 번에 소고기·뼈가 가방으로". 스크린샷 `28-animals.png` 에 울타리 너머 소·돼지·사슴·멧돼지·여우·병아리가 보인다. (1~27 은 3-2 그대로 OK)

- [ ] **Step 8: 커밋**

```bash
git add public/meadow/models/pets \
  src/game/scene/animals/animalModel.ts \
  src/game/scene/animals/Animals.tsx \
  src/game/scene/animals/lootMesh.ts \
  src/game/scene/animals/LootItems.tsx \
  src/game/hunt/huntActions.ts \
  src/game/hunt/huntActions.test.ts \
  src/game/hunt/animalRig.ts \
  src/game/logic/interaction.ts \
  src/game/logic/interaction.test.ts \
  src/game/logic/meadowInteract.ts \
  src/game/logic/meadowInteract.test.ts \
  src/game/ui/interactLabel.ts \
  src/game/input/useInteractionKeys.ts \
  src/meadow/MeadowInteractions.tsx \
  src/game/scene/World.tsx \
  src/meadow/vendor/README.md \
  tools/meadow-check.mjs
git commit -F - <<'EOF'
feat: 들판 동물 그리기와 전리품 줍기

은지 Kenney Cube Pets(CC0)를 public/meadow/models/pets 로 옮겨 동물마다 SkeletonUtils 로 복제해 그린다.
맞으면 빨갛게 번쩍, 쓰러지면 0.5초 동안 넘어지고 목록에서 빠지면 사라진다.
전리품은 둥실 도는 모양으로 떨어지고 발밑(1.6m)에서 E 로 줍는다 → 가방.
헤드리스 점검 28~30.
EOF
```

검증한 스크래치 커밋: `cb6ab92` (이 커밋의 diff 를 그대로 적용해도 된다: `git -C /private/tmp/claude-501/-Users-ihyelin-proten-hrlee-----threejs/e476c70e-362f-4ed3-9ff7-d8664da04e4b/scratchpad/plan-3-3/repo format-patch -1 --binary cb6ab92 --stdout | git apply --index` 한 뒤 위 커밋 명령. 스크래치 커밋의 작성자는 scratch 라 `git am` 은 쓰지 않는다)


### Task 7: 주먹·칼로 휘둘러 사냥  — 스크래치 `2b70db0`

**Files:**
- Create: `src/game/logic/melee.ts`, `src/game/hunt/meleeRig.ts`, `src/game/scene/melee/MeleeController.tsx`
- Modify: `src/game/input/pointer.ts`, `src/game/hunt/huntActions.ts`, `src/game/logic/characterPose.ts`, `src/game/scene/PlayerModel.tsx`, `src/game/scene/Player.tsx`, `src/game/scene/World.tsx`, `src/game/ui/Hud.tsx`, `src/game/ui/TouchControls.tsx`, `tools/meadow-check.mjs`
- Test: `src/game/logic/melee.test.ts`, `src/game/input/pointer.test.ts`, `src/game/logic/characterPose.test.ts`

**Interfaces:**
- Consumes: Task 3 (`MELEE`·`meleeFor`·`hitDelay`·`MeleeId`), Task 2 (`hitRadius`·`hitAnimal`·`AnimalView`), Task 5 (`animalViews`·`soloHerd`·`setSoloHerd`·`spawnLoot`·`ME`·`sendAnimalHit`), `rollDrops` (Task 2), `canUseMouseLook`·`isPointerLocked` (`input/pointerLock`), `playerRig` (`scene/Player`)
- Produces:
  - `type Swing = { kind; startedAt; hitDone }`, `type MeleeState = { swing; readyAt }`, `MELEE_IDLE`, `startSwing(s, kind, now): MeleeState | null`, `swingProgress(swing, now): number` (-1 = 아님), `hitDue(swing, now): boolean`, `meleeTarget(x, z, dx, dz, reach, animals): { id; dist } | null` (`logic/melee.ts`)
  - `meleeRig: MeleeState & { yaw: number }` (`hunt/meleeRig.ts`, R3F 시계 초)
  - `type AttackPress = 'primary' | 'secondary'`, `attackFromPointer(e, locked, mouseLook)`, `pressAttack(kind?)`, `takeAttackPress()` (`input/pointer.ts`)
  - `strikeAnimal(id, kind)` (`hunt/huntActions.ts`)
  - `type SwingArm = { forward; inward; elbow }`, `swingArm(kind, p): SwingArm` (`logic/characterPose.ts`), `PlayerModelHandle.swing(arm)`
  - 컴포넌트 `MeleeController` (월드에)

- [ ] **Step 1: 실패하는 테스트 쓰기**

`src/game/logic/melee.test.ts` (새 파일):

```ts
import { describe, expect, it } from 'vitest'
import type { AnimalView } from './animalSim'
import { MELEE_IDLE, hitDue, meleeTarget, startSwing, swingProgress } from './melee'

const at = (id: number, x: number, z: number, over: Partial<AnimalView> = {}): AnimalView => ({ id, sp: 'cow', x, z, h: 0, pose: 'idle', hp: 3, ...over })

describe('휘두르기 시간', () => {
  it('은지 간격: 칼 베기 뒤 60/110초 안엔 또 휘두를 수 없다', () => {
    const s = startSwing(MELEE_IDLE, 'knife', 10)!
    expect(s.swing).toEqual({ kind: 'knife', startedAt: 10, hitDone: false })
    expect(startSwing(s, 'knife', 10.5)).toBeNull()
    expect(startSwing(s, 'stab', 10 + 60 / 110)).not.toBeNull()
  })
  it('맞는 순간(동작 시간 × hitAt) 이 지나야 판정, 한 번만', () => {
    const sw = startSwing(MELEE_IDLE, 'stab', 0)!.swing!
    expect(hitDue(sw, 0.28)).toBe(false)
    expect(hitDue(sw, 0.29)).toBe(true)
    expect(hitDue({ ...sw, hitDone: true }, 0.3)).toBe(false)
    expect(hitDue(null, 1)).toBe(false)
  })
  it('진행도는 0..1, 끝나면 -1', () => {
    const sw = startSwing(MELEE_IDLE, 'fists', 0)!.swing!
    expect(swingProgress(sw, 0.19)).toBeCloseTo(0.5)
    expect(swingProgress(sw, 0.38)).toBe(-1)
    expect(swingProgress(null, 0)).toBe(-1)
  })
})

describe('meleeTarget', () => {
  it('앞쪽 사거리 안 판정 원에 닿는 가장 가까운 동물', () => {
    // +z 쪽을 본다. 소 판정 원 0.52
    expect(meleeTarget(0, 0, 0, 1, 1.8, [at(1, 0, 2), at(2, 0.3, 1.5)])).toEqual({ id: 2, dist: expect.closeTo(1.5 - Math.sqrt(0.52 ** 2 - 0.09), 5) })
  })
  it('사거리 + 반지름보다 멀거나, 옆으로 비껴가거나, 뒤에 있거나, 쓰러진 동물은 안 맞는다', () => {
    expect(meleeTarget(0, 0, 0, 1, 1.3, [at(1, 0, 1.9)])).toBeNull()
    expect(meleeTarget(0, 0, 0, 1, 1.8, [at(1, 0.6, 1)])).toBeNull()
    expect(meleeTarget(0, 0, 0, 1, 1.8, [at(1, 0, -1)])).toBeNull()
    expect(meleeTarget(0, 0, 0, 1, 1.8, [at(1, 0, 1, { pose: 'dead', hp: 0 })])).toBeNull()
  })
  it('원 안에 서 있으면 거리 0, 병아리도 0.35 원으로 맞는다', () => {
    expect(meleeTarget(0, 0, 1, 0, 1.3, [at(1, 0.2, 0)])).toEqual({ id: 1, dist: 0 })
    expect(meleeTarget(0, 0, 1, 0, 1.3, [at(5, 1.4, 0.3, { sp: 'chick' })])?.id).toBe(5)
  })
})
```

`src/game/input/pointer.test.ts` (새 파일):

```ts
import { describe, expect, it } from 'vitest'
import { attackFromPointer, pressAttack, takeAttackPress } from './pointer'

describe('휘두르기 입력', () => {
  it('마우스 잠금 중 왼쪽 = 베기·주먹, 오른쪽 = 찌르기, 가운데는 없다', () => {
    expect(attackFromPointer({ button: 0, pointerType: 'mouse' }, true, true)).toBe('primary')
    expect(attackFromPointer({ button: 2, pointerType: 'mouse' }, true, true)).toBe('secondary')
    expect(attackFromPointer({ button: 1, pointerType: 'mouse' }, true, true)).toBeNull()
  })
  it('잠기기 전 클릭은 시점 잠금용이라 휘두르지 않는다 (잠금을 못 쓰는 환경이면 늘 휘두른다)', () => {
    expect(attackFromPointer({ button: 0, pointerType: 'mouse' }, false, true)).toBeNull()
    expect(attackFromPointer({ button: 0, pointerType: 'mouse' }, false, false)).toBe('primary')
  })
  it('손가락은 시점 돌리기라 휘두르지 않는다 (폰은 휘두르기 버튼)', () => {
    expect(attackFromPointer({ button: 0, pointerType: 'touch' }, true, false)).toBeNull()
  })
  it('누른 휘두르기는 한 번만 가져간다', () => {
    pressAttack('secondary')
    expect(takeAttackPress()).toBe('secondary')
    expect(takeAttackPress()).toBeNull()
  })
})
```

`src/game/logic/characterPose.test.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/logic/characterPose.test.ts b/src/game/logic/characterPose.test.ts
--- a/src/game/logic/characterPose.test.ts
+++ b/src/game/logic/characterPose.test.ts
@@ -1,7 +1,8 @@
 import { describe, expect, it } from 'vitest'
 import { EAT } from '../data/balance'
 import { JUMP_POSE, SPRINT_MIN_SPEED } from '../data/characters'
-import { aimWeights, characterPose, chewBite, clipTimeScale, eatArm, fishingLook, leanBack, poseClips } from './characterPose'
+import { MELEE } from '../data/melee'
+import { aimWeights, characterPose, chewBite, clipTimeScale, eatArm, fishingLook, leanBack, poseClips, swingArm } from './characterPose'
 import { createFight } from './fight'
 import type { FishingState } from './fishingSession'
 import { IDLE_ACTION, type PlayerAction } from './playerMotion'
@@ -184,3 +185,25 @@ describe('먹기 자세', () => {
     expect(chewBite(eating, 10 + EAT.duration - EAT.raiseTime - 0.01)).toBeGreaterThanOrEqual(3)
   })
 })
+
+describe('swingArm (3-3 휘두르기)', () => {
+  it('처음·끝·범위 밖은 팔을 그대로 둔다', () => {
+    for (const kind of ['fists', 'knife', 'stab'] as const) {
+      expect(swingArm(kind, 0)).toEqual({ forward: 0, inward: 0, elbow: 0 })
+      expect(swingArm(kind, 1)).toEqual({ forward: 0, inward: 0, elbow: 0 })
+      expect(swingArm(kind, -1)).toEqual({ forward: 0, inward: 0, elbow: 0 })
+    }
+  })
+  it('맞는 순간(hitAt)엔 팔을 앞으로 뻗고 팔꿈치가 거의 펴져 있다', () => {
+    for (const kind of ['fists', 'knife', 'stab'] as const) {
+      const a = swingArm(kind, MELEE[kind].hitAt)
+      expect(a.forward).toBeLessThan(-1.2)
+      expect(a.elbow).toBeGreaterThan(-0.4)
+    }
+  })
+  it('베기는 바깥에서 안쪽으로 긋고, 찌르기는 먼저 뒤로 당긴다', () => {
+    expect(swingArm('knife', 0.3).inward).toBeLessThan(0)
+    expect(swingArm('knife', 0.6).inward).toBeGreaterThan(0)
+    expect(swingArm('stab', 0.3).forward).toBeGreaterThan(0)
+  })
+})
```

- [ ] **Step 2: 실행해 실패 확인**

Run: `npx vitest run src/game/logic/melee.test.ts src/game/input/pointer.test.ts src/game/logic/characterPose.test.ts`
Expected: FAIL — `"./melee"` 를 찾을 수 없다, `attackFromPointer is not a function`, `swingArm is not a function`

- [ ] **Step 3: 휘두르기 시간·판정 (순수)**

`src/game/logic/melee.ts` (새 파일):

```ts
import { hitRadius } from '../data/animals'
import { MELEE, hitDelay, type MeleeId } from '../data/melee'
import type { AnimalView } from './animalSim'

/** 휘두르는 중: 종류, 시작한 때(초), 이번 휘두르기의 명중 판정을 했나 */
export type Swing = { kind: MeleeId; startedAt: number; hitDone: boolean }
/** 지금 휘두르기와 다음에 휘두를 수 있는 때 (은지 cool) */
export type MeleeState = { swing: Swing | null; readyAt: number }

export const MELEE_IDLE: MeleeState = { swing: null, readyAt: -Infinity }

/** 휘두르기 시작. 아직 다음 공격을 할 수 없으면 null */
export function startSwing(s: MeleeState, kind: MeleeId, now: number): MeleeState | null {
  if (now < s.readyAt) return null
  return { swing: { kind, startedAt: now, hitDone: false }, readyAt: now + MELEE[kind].cool }
}

/** 동작 진행도 0..1 (끝났거나 휘두르는 중이 아니면 -1) */
export function swingProgress(swing: Swing | null, now: number): number {
  if (!swing) return -1
  const p = (now - swing.startedAt) / MELEE[swing.kind].dur
  return p >= 0 && p < 1 ? p : -1
}

/** 칼이 뻗는 순간이 지났는데 아직 판정 안 했나 (은지: 휘두르기 시작이 아니라 hitAt 에 판정) */
export function hitDue(swing: Swing | null, now: number): boolean {
  return !!swing && !swing.hitDone && now - swing.startedAt >= hitDelay(swing.kind)
}

/**
 * 근접 판정: 내 자리 (x, z) 에서 바닥 방향 (dx, dz, 단위 벡터) 으로 reach 만큼 그은 선분이 처음 닿는 살아 있는 동물 (판정 원).
 * dist 는 원에 닿는 거리 (원 안에 서 있으면 0). 없으면 null
 */
export function meleeTarget(x: number, z: number, dx: number, dz: number, reach: number, animals: readonly AnimalView[]): { id: number; dist: number } | null {
  let best: { id: number; dist: number } | null = null
  for (const a of animals) {
    if (a.pose === 'dead') continue
    const r = hitRadius(a.sp)
    const cx = a.x - x
    const cz = a.z - z
    const t = cx * dx + cz * dz
    const perp2 = cx * cx + cz * cz - t * t
    if (perp2 > r * r) continue
    const enter = Math.max(0, t - Math.sqrt(r * r - perp2))
    if (t + r < 0 || enter > reach) continue
    if (!best || enter < best.dist) best = { id: a.id, dist: enter }
  }
  return best
}
```

`src/game/logic/characterPose.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/logic/characterPose.ts b/src/game/logic/characterPose.ts
--- a/src/game/logic/characterPose.ts
+++ b/src/game/logic/characterPose.ts
@@ -2,6 +2,7 @@ import { EAT } from '../data/balance'
 import { JUMP_POSE, SPRINT_MIN_SPEED, type CharacterClip } from '../data/characters'
 import type { FishingState } from './fishingSession'
 import { EMOTES, type EmoteId } from '../data/emotes'
+import type { MeleeId } from '../data/melee'
 import { IDLE_ACTION, type PlayerAction } from './playerMotion'
 
 /**
@@ -158,6 +159,51 @@ export function eatArm(action: PlayerAction, now: number): { raise: number; chew
   return { raise, chew }
 }
 
+/** 휘두르는 오른팔 (라디안): forward 위팔을 앞으로(음수가 앞·위), inward 몸 안쪽으로(y 축), elbow 팔꿈치 굽힘(음수) */
+export type SwingArm = { forward: number; inward: number; elbow: number }
+const REST_ARM: SwingArm = { forward: 0, inward: 0, elbow: 0 }
+
+/**
+ * 휘두르기 자세표 [진행도, forward, inward, elbow]. 은지 3인칭 팔 동작을 닮게 (캐릭터를 띄워 보며 맞춘 값):
+ * 주먹 = 굽혔다 앞으로 곧게 뻗기, 베기 = 오른쪽 바깥에서 몸 앞을 가로질러 안쪽으로, 찌르기 = 뒤로 당겼다 앞으로 깊게. 처음·끝은 0 (툭 튀지 않게)
+ */
+const SWING_KEYS: Record<MeleeId, [number, number, number, number][]> = {
+  fists: [
+    [0, 0, 0, 0],
+    [0.25, -0.6, 0.1, -1.6],
+    [0.4, -1.5, 0.15, -0.15],
+    [0.7, -1.2, 0.1, -0.6],
+    [1, 0, 0, 0],
+  ],
+  knife: [
+    [0, 0, 0, 0],
+    [0.3, -1.3, -0.9, -0.6],
+    [0.42, -1.3, 0.2, -0.3],
+    [0.6, -1.1, 0.7, -0.5],
+    [1, 0, 0, 0],
+  ],
+  stab: [
+    [0, 0, 0, 0],
+    [0.3, 0.4, 0.1, -1.7],
+    [0.46, -1.5, 0.05, -0.1],
+    [0.62, -1.45, 0.05, -0.15],
+    [1, 0, 0, 0],
+  ],
+}
+
+/** 휘두르는 동안 오른팔 (서 있기 클립 위에 덧돌린다. eatArm 처럼). p: 동작 진행도 0..1, 범위 밖이면 그대로 */
+export function swingArm(kind: MeleeId, p: number): SwingArm {
+  if (!(p > 0 && p < 1)) return REST_ARM
+  const keys = SWING_KEYS[kind]
+  let i = 0
+  while (keys[i + 1][0] < p) i++
+  const [p0, f0, n0, e0] = keys[i]
+  const [p1, f1, n1, e1] = keys[i + 1]
+  const k = (p - p0) / (p1 - p0)
+  const t = k * k * (3 - 2 * k)
+  return { forward: f0 + (f1 - f0) * t, inward: n0 + (n1 - n0) * t, elbow: e0 + (e1 - e0) * t }
+}
+
 /**
  * 지금 몇 번째 한 입인지 (0부터). 손이 입에 다 올라간 뒤 biteEvery 마다 하나씩 늘고,
  * 손을 올리는 중·내리는 중·안 먹을 때는 -1
```

- [ ] **Step 4: 입력**

마우스 잠금 중 클릭만 휘두르기다(`pressPointer` 가 누른 순간의 잠금 상태로 정한다). 손가락은 지금처럼 시점 돌리기.

`src/game/input/pointer.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/input/pointer.ts b/src/game/input/pointer.ts
--- a/src/game/input/pointer.ts
+++ b/src/game/input/pointer.ts
@@ -3,6 +3,7 @@ import { canZoom } from '../logic/cameraZoom'
 import type { FishingInput } from '../logic/fishingSession'
 import { gestureStep, type Point } from '../logic/touchUi'
 import { useSessionStore } from '../stores/sessionStore'
+import { canUseMouseLook, isPointerLocked } from './pointerLock'
 
 /**
  * 지금 누르고 있는 게임 포인터들 (마우스·손가락마다 pointerId 로 따로 센다).
@@ -18,11 +19,40 @@ let pressed = false
 let dragX = 0
 let dragY = 0
 
-type PointerLike = { button: number; pointerId: number; clientX: number; clientY: number }
+/** 휘두르기 입력: primary = 마우스 왼쪽 (베기·주먹), secondary = 오른쪽 (칼 찌르기) */
+export type AttackPress = 'primary' | 'secondary'
+/** 지난 프레임 뒤로 새로 누른 휘두르기. MeleeController 가 매 프레임 가져가며 비운다 */
+let attackPress: AttackPress | null = null
+
+type PointerLike = { button: number; pointerId: number; clientX: number; clientY: number; pointerType?: string }
+
+/**
+ * 마우스로 캔버스를 누른 게 휘두르기인가: 왼쪽·오른쪽 버튼, 마우스 잠금 중(잠금을 못 쓰는 환경이면 늘).
+ * 잠기기 전 클릭은 시점 잠금용이라 휘두르지 않는다. 손가락은 시점 돌리기라 휘두르지 않는다 (폰은 휘두르기 버튼)
+ */
+export function attackFromPointer(e: Pick<PointerLike, 'button' | 'pointerType'>, locked: boolean, mouseLook: boolean): AttackPress | null {
+  if (e.pointerType !== 'mouse' || (mouseLook && !locked)) return null
+  if (e.button === 0) return 'primary'
+  if (e.button === 2) return 'secondary'
+  return null
+}
+
+/** 휘두르기 버튼 (폰) */
+export function pressAttack(kind: AttackPress = 'primary') {
+  attackPress = kind
+}
+
+/** 새로 누른 휘두르기를 가져가고 비운다 */
+export function takeAttackPress(): AttackPress | null {
+  const a = attackPress
+  attackPress = null
+  return a
+}
 
 /** 캔버스 영역에서 눌렀을 때 호출 (UI 버튼 클릭은 여기로 오지 않는다) */
 export function pressPointer(e: PointerLike) {
-  // 우클릭·휠 클릭은 입력으로 보지 않는다 (컨텍스트 메뉴가 pointerup을 삼켜 입력이 고착될 수 있다)
+  attackPress = attackFromPointer(e, isPointerLocked(), canUseMouseLook()) ?? attackPress
+  // 우클릭·휠 클릭은 낚시 입력으로 보지 않는다 (컨텍스트 메뉴가 pointerup을 삼켜 입력이 고착될 수 있다)
   if (e.button !== 0) return
   canvasPointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
   pressed = true
@@ -57,6 +87,7 @@ export function takeDrag(): { dx: number; dy: number } {
 function releaseAll() {
   canvasPointers.clear()
   buttonPointers.clear()
+  attackPress = null
   dragX = 0
   dragY = 0
 }
```

- [ ] **Step 5: 명중 → 혼자 때리기 / 서버로**

`src/game/hunt/meleeRig.ts` (새 파일):

```ts
import { MELEE_IDLE, type MeleeState } from '../logic/melee'

/**
 * 내 휘두르기 (scene/melee/MeleeController 가 매 프레임 고치고 Player 가 팔·방향을 그린다). 시각은 R3F 시계(초).
 * yaw: 휘두르기 시작할 때 카메라 방향 (그쪽을 보고 휘두른다, 판정도 그쪽)
 */
export const meleeRig: MeleeState & { yaw: number } = { ...MELEE_IDLE, yaw: 0 }
```

`src/game/hunt/huntActions.ts` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/hunt/huntActions.ts b/src/game/hunt/huntActions.ts
--- a/src/game/hunt/huntActions.ts
+++ b/src/game/hunt/huntActions.ts
@@ -1,7 +1,28 @@
-import { ITEMS } from '../data/meadowItems'
+import { speciesOf } from '../data/animals'
+import { ITEMS, rollDrops } from '../data/meadowItems'
+import { MELEE, type MeleeId } from '../data/melee'
+import { hitAnimal } from '../logic/animalSim'
+import { netNow } from '../net/remoteRig'
+import { useNetStore } from '../stores/netStore'
 import { useProgressStore } from '../stores/progressStore'
 import { useSessionStore } from '../stores/sessionStore'
-import { takeLoot } from './animalRig'
+import { ME, setSoloHerd, soloHerd, spawnLoot, takeLoot } from './animalRig'
+
+/**
+ * 내 휘두르기가 동물 id 에 맞았다. 같이 하면 서버에 알린다 (서버가 검사·체력·전리품). 혼자면 바로 때리고, 쓰러뜨리면 전리품을 떨어뜨린다
+ */
+export function strikeAnimal(id: number, kind: MeleeId) {
+  const net = useNetStore.getState()
+  if (net.phase !== 'off') {
+    net.sendAnimalHit(id, MELEE[kind].dmg, kind)
+    return
+  }
+  const r = hitAnimal(soloHerd(), id, MELEE[kind].dmg, ME)
+  setSoloHerd(r.herd)
+  if (r.result !== 'killed' || !r.animal) return
+  spawnLoot(rollDrops(r.animal.sp), r.animal.x, r.animal.z, netNow())
+  useSessionStore.getState().notify(`${speciesOf(r.animal.sp).name} 사냥 성공! 재료를 떨어뜨렸어요 (E 로 줍기)`)
+}
 
 /** E 로 전리품 줍기 → 가방 (은지 그대로 "🥩 소고기 획득 (3개)") */
 export function pickLoot(key: number) {
```

`src/game/scene/melee/MeleeController.tsx` (새 파일):

```tsx
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { MELEE, meleeFor } from '../../data/melee'
import { animalViews } from '../../hunt/animalRig'
import { strikeAnimal } from '../../hunt/huntActions'
import { meleeRig } from '../../hunt/meleeRig'
import { takeAttackPress } from '../../input/pointer'
import { hitDue, meleeTarget, startSwing, swingProgress } from '../../logic/melee'
import { netNow } from '../../net/remoteRig'
import { useNetStore } from '../../stores/netStore'
import { useSessionStore } from '../../stores/sessionStore'
import { playerRig } from '../Player'

/**
 * 화면엔 아무것도 그리지 않는다. 주먹·칼을 든 채 마우스 왼쪽(베기·주먹)·오른쪽(칼 찌르기)이나 폰 휘두르기 버튼을 누르면 휘두르고,
 * 은지처럼 칼이 뻗는 순간(hitAt)에 카메라가 보는 쪽으로 판정한다: 바닥의 선분 → 동물 판정 원, 그 앞에 벽(고정 충돌체)이 있으면 안 맞는다
 */
export function MeleeController() {
  const { world, rapier } = useRapier()
  const ray = useRef<InstanceType<typeof rapier.Ray> | null>(null)

  useFrame(({ clock }) => {
    const now = clock.elapsedTime
    const press = takeAttackPress()
    const session = useSessionStore.getState()
    if (press && session.mode === 'explore' && !session.playerAction.eat) {
      const kind = meleeFor(session.tool, press === 'secondary')
      const next = kind && startSwing(meleeRig, kind, now)
      if (next) Object.assign(meleeRig, next, { yaw: playerRig.yaw })
    }
    const swing = meleeRig.swing
    if (!swing) return
    if (hitDue(swing, now)) {
      swing.hitDone = true
      const dx = -Math.sin(meleeRig.yaw)
      const dz = -Math.cos(meleeRig.yaw)
      const { x, y, z } = playerRig.position
      const target = meleeTarget(x, z, dx, dz, MELEE[swing.kind].reach, animalViews(useNetStore.getState().phase !== 'off', netNow()))
      if (target) {
        const r = (ray.current ??= new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }))
        r.origin = { x, y, z }
        r.dir = { x: dx, y: 0, z: dz }
        const wall = target.dist > 0 ? world.castRay(r, target.dist, true, rapier.QueryFilterFlags.ONLY_FIXED | rapier.QueryFilterFlags.EXCLUDE_SENSORS) : null
        if (!wall) strikeAnimal(target.id, swing.kind)
      }
    }
    if (swingProgress(swing, now) < 0 && swing.hitDone) meleeRig.swing = null
  })
  return null
}
```

`src/game/scene/World.tsx` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/scene/World.tsx b/src/game/scene/World.tsx
--- a/src/game/scene/World.tsx
+++ b/src/game/scene/World.tsx
@@ -7,6 +7,7 @@ import { NetBridge } from '../net/NetBridge'
 import { Animals } from './animals/Animals'
 import { HerdRunner } from './animals/HerdRunner'
 import { LootItems } from './animals/LootItems'
+import { MeleeController } from './melee/MeleeController'
 import { Docks } from './boat/Docks'
 import { DayCycle } from './day/DayCycle'
 import { FishingSpots } from './facilities/FishingSpots'
@@ -67,6 +68,7 @@ export function World() {
         <Animals />
       </Suspense>
       <LootItems />
+      <MeleeController />
       <DayCycle />
     </>
   )
```

- [ ] **Step 6: 휘두르는 모습 (방향·오른팔·칼 기울기)**

`swing` 은 `update`(믹서) 뒤에 불러 클립 위에 팔을 덧돌린다 (먹기 팔과 같은 방식). `Player` 는 같은 R3F 시계로 진행도를 읽는다.

`src/game/scene/PlayerModel.tsx` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/scene/PlayerModel.tsx b/src/game/scene/PlayerModel.tsx
--- a/src/game/scene/PlayerModel.tsx
+++ b/src/game/scene/PlayerModel.tsx
@@ -4,6 +4,7 @@ import { AnimationMixer, LoopOnce, Quaternion, SRGBColorSpace, Vector3, type Ani
 import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
 import { CHARACTER_CLIPS, CHARACTER_FILES, ONE_SHOT_CLIPS, OUTFIT_ALT_TEXTURES, type CharacterClip } from '../data/characters'
 import { EMOTES, type EmoteId } from '../data/emotes'
+import type { SwingArm } from '../logic/characterPose'
 import type { CharacterLook, OutfitId } from '../data/types'
 import { CHARACTER_POSES, characterPose, clipTimeScale, eatArm, poseClips, type CharacterPose, type FishingLook } from '../logic/characterPose'
 import type { PlayerAction } from '../logic/playerMotion'
@@ -28,6 +29,8 @@ export type PlayerModelHandle = {
   emoteLength(id: EmoteId): number
   /** 낚싯대를 쥔 손(주먹 가운데)의 월드 위치 */
   gripPosition(target: Vector3): void
+  /** 휘두르는 오른팔 (update 뒤에 부른다. 클립 위에 덧돌린다, logic/characterPose swingArm) */
+  swing(arm: SwingArm): void
 }
 
 const modelUrl = (file: string) => `${import.meta.env.BASE_URL}models/${file}`
@@ -296,6 +299,12 @@ const Model = forwardRef<PlayerModelHandle, { look: CharacterLook }>(function Mo
         const action = actionsRef.current?.[clip]
         return action ? action.getClip().duration / clipTimeScale(clip, 0) : 1
       },
+      swing(arm) {
+        if (!bones.upperarm || !bones.lowerarm) return
+        bendBone(bones.upperarm, object, arm.forward)
+        bendBone(bones.upperarm, object, arm.inward, 'y')
+        bendBone(bones.lowerarm, object, arm.elbow)
+      },
       gripPosition(target) {
         if (!bones.hand || !bones.knuckle) return
         bones.hand.getWorldPosition(target)
```

`src/game/scene/Player.tsx` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/scene/Player.tsx b/src/game/scene/Player.tsx
--- a/src/game/scene/Player.tsx
+++ b/src/game/scene/Player.tsx
@@ -24,7 +24,9 @@ import { applyMouseLook, pitchedOffset } from '../logic/mouseLook'
 import { useSettingsStore } from '../stores/settingsStore'
 import { castPowerFromHold } from '../logic/cast'
 import type { FishingState } from '../logic/fishingSession'
-import { fishingLook } from '../logic/characterPose'
+import { fishingLook, swingArm } from '../logic/characterPose'
+import { swingProgress } from '../logic/melee'
+import { meleeRig } from '../hunt/meleeRig'
 import { cameraRig, isGrounded, moveSpeed, nextAction, shouldFaceCamera, shownTool } from '../logic/playerMotion'
 import { NO_MOVE } from '../logic/joystick'
 import { DEFAULT_LOOK } from '../data/characterParts'
@@ -104,6 +106,9 @@ function rodAngle(fishing: FishingState | null, now: number): number {
   }
 }
 
+/** 휘두르는 동안 칼날을 앞으로 눕히는 각도 (동작 가운데에서 가장 크게) */
+const KNIFE_SWING_TILT = 1.1
+
 /** 캡슐 콜라이더 바닥(발바닥) 높이. 모델은 발이 원점이라 이만큼 내린다 */
 export const FOOT_Y = -(PLAYER_BODY.halfHeight + PLAYER_BODY.radius)
 /**
@@ -370,6 +375,9 @@ export function Player() {
       // 연출 중엔 고치는 곳을 바라보며 구경한다
       const [sx, sz] = REPAIR_PLANS[session.cutscene.zoneId].site
       facing.current = Math.atan2(sx - x, sz - z)
+    } else if (mode === 'explore' && swingProgress(meleeRig.swing, now) >= 0) {
+      // 휘두르는 동안엔 휘두른 쪽(그때 카메라가 보던 쪽)을 본다
+      facing.current = meleeRig.yaw + Math.PI
     } else if (moveDir.lengthSq() > 0) {
       facing.current = Math.atan2(moveDir.x, moveDir.z)
     }
@@ -408,13 +416,15 @@ export function Player() {
         // 캐릭터는 동작 상태와 속도로만 그린다 (다른 사람 캐릭터도 같은 값으로 그릴 수 있게)
         const seated = mode === 'rest' || boatAt !== null
         m.update(delta, now, fishingLook(fishing), action, speed, rod.current.rotation.x, seated, boatAt ? BOAT_SEAT_SHAPE : BENCH_SEAT_SHAPE)
+        const swingAt = swingProgress(meleeRig.swing, now)
+        if (swingAt >= 0 && meleeRig.swing) m.swing(swingArm(meleeRig.swing.kind, swingAt))
         visual.current.updateWorldMatrix(true, false)
         m.gripPosition(grip)
         rod.current.position.copy(visual.current.worldToLocal(grip))
-        // 칼도 같은 손에, 낚싯대처럼 앞으로 살짝 숙여 든다
+        // 칼도 같은 손에, 낚싯대처럼 앞으로 살짝 숙여 든다. 휘두르는 동안엔 칼날을 앞으로 눕힌다
         if (knife.current) {
           knife.current.position.copy(rod.current.position)
-          knife.current.rotation.x = rod.current.rotation.x
+          knife.current.rotation.x = rod.current.rotation.x + (swingAt >= 0 ? KNIFE_SWING_TILT * Math.sin(Math.PI * swingAt) : 0)
         }
         // 먹는 음식도 같은 손에 든다
         if (food.current) food.current.position.copy(grip)
```

- [ ] **Step 7: 키 안내·폰 버튼**

`src/game/ui/Hud.tsx` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/ui/Hud.tsx b/src/game/ui/Hud.tsx
--- a/src/game/ui/Hud.tsx
+++ b/src/game/ui/Hud.tsx
@@ -34,6 +34,7 @@ export function Hud() {
   const clock = useDayStore((s) => s.clockText)
   const mode = useSessionStore((s) => s.mode)
   const nearby = useSessionStore((s) => s.nearby)
+  const tool = useSessionStore((s) => s.tool)
   const setMode = useSessionStore((s) => s.setMode)
   const locked = usePointerLockStore((s) => s.locked)
   const touchUi = useTouchUi()
@@ -131,7 +132,7 @@ export function Hud() {
           {mouseLook && !locked && <div style={lookHint}>클릭하면 마우스로 시점 회전 · ESC 해제</div>}
           {!touchUi && (
             <div style={{ position: 'absolute', bottom: 8, left: 16, right: 16, textAlign: 'center', opacity: 0.7, fontSize: 12 }}>
-              WASD 이동 · Shift 달리기 · Space 점프 · 1~3 도구 · X 넣기 · I 가방 · F 먹기 · T 꾹 감정 표현 · Tab 지도 · 휠 확대 · M 음악 · {mouseLook ? (locked ? '마우스로 시점 회전 · ESC 메뉴' : '클릭 후 마우스로 시점 회전') : '드래그로 카메라 회전'}
+              WASD 이동 · Shift 달리기 · Space 점프 · 1~3 도구 · X 넣기 · {tool === 'fists' ? '클릭 주먹 · ' : tool === 'knife' ? '클릭 베기 · 오른쪽 클릭 찌르기 · ' : ''}I 가방 · F 먹기 · T 꾹 감정 표현 · Tab 지도 · 휠 확대 · M 음악 · {mouseLook ? (locked ? '마우스로 시점 회전 · ESC 메뉴' : '클릭 후 마우스로 시점 회전') : '드래그로 카메라 회전'}
             </div>
           )}
         </>
```

`src/game/ui/TouchControls.tsx` — 세로 화면은 가방 줄(점프 위)에 두어 한 줄에 셋이 되지 않게 (바꿀 곳, `git diff -U3`):

```diff
diff --git a/src/game/ui/TouchControls.tsx b/src/game/ui/TouchControls.tsx
--- a/src/game/ui/TouchControls.tsx
+++ b/src/game/ui/TouchControls.tsx
@@ -2,7 +2,7 @@ import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, ty
 import { EMOTES } from '../data/emotes'
 import { TOUCH } from '../data/touch'
 import { resetStick, setStick } from '../input/move'
-import { pressFishingButton } from '../input/pointer'
+import { pressAttack, pressFishingButton } from '../input/pointer'
 import { useMediaQuery, useTouchUi } from '../input/touchDevice'
 import { runKeyAction } from '../input/useInteractionKeys'
 import { pressEmote, pressJump } from '../input/usePlayerActionKeys'
@@ -41,6 +41,7 @@ export function TouchControls() {
 
 function ExploreControls() {
   const nearby = useSessionStore((s) => s.nearby)
+  const tool = useSessionStore((s) => s.tool)
   const [emotesOpen, setEmotesOpen] = useState(false)
   const portrait = useMediaQuery('(orientation: portrait)')
   const bag = (
@@ -49,6 +50,20 @@ function ExploreControls() {
       <span style={{ fontSize: 11 }}>가방</span>
     </TapButton>
   )
+  // 주먹·칼을 들면 휘두르기 (누르는 순간 바로. 칼 찌르기 버튼은 3-4 의 총 버튼과 같이). 세로 화면은 가방 줄에
+  const attack = (tool === 'fists' || tool === 'knife') && (
+    <button
+      className="tc-btn tc-small"
+      aria-label="휘두르기"
+      onPointerDown={(e) => {
+        e.preventDefault()
+        pressAttack('primary')
+      }}
+    >
+      <span style={{ fontSize: 22, lineHeight: 1 }}>{tool === 'fists' ? '✊' : '🔪'}</span>
+      <span style={{ fontSize: 11 }}>{tool === 'fists' ? '치기' : '베기'}</span>
+    </button>
+  )
   return (
     <>
       <Joystick />
@@ -77,14 +92,20 @@ function ExploreControls() {
             {interactLabel(nearby)}
           </TapButton>
         )}
-        {/* 세로 화면은 좁아서 가방을 점프 위 오른쪽 끝에 둔다 (한 줄에 셋이면 조이스틱 자리와 겹친다). 가로 화면은 한 줄 그대로 */}
-        {portrait && <div className="tc-row">{bag}</div>}
+        {/* 세로 화면은 좁아서 가방(과 휘두르기)을 점프 위 오른쪽 끝에 둔다 (한 줄에 셋이면 조이스틱 자리와 겹친다). 가로 화면은 한 줄 그대로 */}
+        {portrait && (
+          <div className="tc-row">
+            {attack}
+            {bag}
+          </div>
+        )}
         <div className="tc-row">
           {!portrait && bag}
           <TapButton className={`tc-btn tc-small${emotesOpen ? ' on' : ''}`} ariaLabel="감정 표현" onTap={() => setEmotesOpen((o) => !o)}>
             <span style={{ fontSize: 22, lineHeight: 1 }}>😀</span>
             <span style={{ fontSize: 11 }}>표현</span>
           </TapButton>
+          {!portrait && attack}
           {/* 점프는 누르는 순간 바로 */}
           <button
             className="tc-btn tc-jump"
```

- [ ] **Step 8: 헤드리스 점검 31~35**

헤드리스에선 마우스 잠금이 없으므로 폰 버튼과 같은 `pressAttack` 으로 휘두른다. 다가가면 동물이 달아나므로(7m) 바로 뒤로 순간이동하고 곧장 휘두르며, 프레임이 느려 빗나가면 몇 번 더 한다.

`tools/meadow-check.mjs` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/tools/meadow-check.mjs b/tools/meadow-check.mjs
--- a/tools/meadow-check.mjs
+++ b/tools/meadow-check.mjs
@@ -706,6 +706,90 @@ await hpress('KeyE', 'e')
 await hpress('KeyE', 'e')
 const after30 = await hev(`[p.items.beef, p.items.bone, r.lootList().length]`)
 check(after30[0] === before30[0] + 1 && after30[1] === before30[1] + 1 && after30[2] === 0, `30) E 두 번에 소고기·뼈가 가방으로 (${before30} → ${after30})`)
+// 31) 칼(3)을 들고 소 바로 남쪽에서 북쪽을 보고 클릭(베기) → 소 체력 3 → 2, 때린 나를 쫓는다
+const attack = (kind) => H.evaluate(`(async () => { (await __mod('/src/game/input/pointer.ts')).pressAttack('${kind}'); return true })()`)
+const cowNow = `(async () => { const r = ${RIG}; return r.animalViews(false, 0).find((a) => a.sp === 'cow' && a.pose !== 'dead') ?? null })()`
+await hpress('Digit3', '3')
+check((await hev(`s.tool`)) === 'knife', '31) 3 → 칼')
+await turnTo(H, 0, -30)
+const cow0 = await H.evaluate(cowNow)
+const stamina31 = await hev(`p.survival.stamina`)
+const cowById = `(async () => { const r = ${RIG}; return r.soloHerd().animals.find((a) => a.id === ${cow0.id}) })()`
+// 다가가면 달아나므로(7m) 바로 뒤에 서서 곧장 휘두른다. 헤드리스는 프레임이 느려 빗나가면 몇 번 더
+let cow1 = cow0
+for (let i = 0; i < 4 && cow1.hp === 3; i++) {
+  await H.evaluate(teleport(cow1.x, cow1.z + 0.8))
+  await wait(100)
+  await attack('primary')
+  await wait(120)
+  if (i === 0) await H.shot('31-slash')
+  await wait(400)
+  cow1 = await H.evaluate(cowById)
+}
+check(cow1?.hp === 2 && cow1.state === 'attack' && cow1.target === 'me', `31) 베기 한 번에 소 체력 2, 나를 쫓는다 (${cow1?.hp}, ${cow1?.state})`)
+
+// 32) 맞은 소가 들이받으면 체력 15 가 줄고 화면 가장자리가 번쩍인다
+check(await H.until(`(async () => ${HP}.survival.stamina <= ${stamina31 - 15 + 0.5})()`, 5000), '32) 소가 들이받으면 체력 −15')
+check((await hev(`s.hurtAt`)) !== null, '32) 맞으면 화면 가장자리가 번쩍인다')
+await H.shot('32-hurt')
+
+// 33) 오른쪽 클릭(찌르기, 피해 2)으로 쓰러뜨리면 1.4초 뒤 전리품이 보이고 E 로 줍는다
+let dead = false
+for (let i = 0; i < 6 && !dead; i++) {
+  const c = await H.evaluate(`(async () => { const r = ${RIG}; return r.soloHerd().animals.find((a) => a.id === ${cow0.id}) ?? null })()`)
+  if (!c || c.state === 'dead') {
+    dead = true
+    break
+  }
+  await H.evaluate(teleport(c.x, c.z + 1))
+  await wait(150)
+  await attack('secondary')
+  await wait(900)
+  dead = await H.evaluate(`(async () => { const r = ${RIG}; const a = r.soloHerd().animals.find((x) => x.id === ${cow0.id}); return !a || a.state === 'dead' })()`)
+}
+check(dead, '33) 찌르기로 소를 쓰러뜨린다')
+await H.shot('33-down')
+check(await H.until(`document.body.innerText.includes('사냥 성공')`, 2000), '33) "소 사냥 성공!" 알림')
+const lootPos = await hev(`r.lootList().map((l) => [l.x, l.z, l.item])`)
+check(lootPos.length >= 3 && lootPos.filter((l) => l[2] === 'beef').length === 2, `33) 소고기 2·뼈 1 을 떨어뜨린다 (${lootPos.map((l) => l[2])})`)
+await wait(1600)
+await H.evaluate(teleport(lootPos[0][0], lootPos[0][1]))
+check(await H.until(`document.body.innerText.includes('줍기')`, 4000), '33) 1.4초 뒤 전리품 줍기 안내')
+await H.shot('33-loot')
+const beef33 = await hev(`p.items.beef`)
+for (let i = 0; i < 3; i++) await hpress('KeyE', 'e')
+check((await hev(`p.items.beef`)) >= beef33 + 1, `33) E 로 주우면 가방에 소고기 (${beef33} → ${await hev('p.items.beef')})`)
+
+// 34) 집 안(침실)으로 들어가면 쫓던 동물이 포기한다 (실내 판정: 은지 집 방 4개). 멧돼지(체력 3)를 찌르면(2) 살아남아 쫓아온다
+const hog = await H.evaluate(`(async () => { const r = ${RIG}; return r.soloHerd().animals.find((a) => a.sp === 'hog' && a.state !== 'dead') ?? null })()`)
+const hogById = `(async () => { const r = ${RIG}; return r.soloHerd().animals.find((a) => a.id === ${hog.id}) })()`
+let chasing = hog.state
+for (let i = 0; i < 4 && chasing !== 'attack'; i++) {
+  const now34 = await H.evaluate(hogById)
+  await H.evaluate(teleport(now34.x, now34.z + 0.9))
+  await wait(150)
+  await attack('secondary')
+  await wait(900)
+  chasing = (await H.evaluate(hogById))?.state
+}
+await H.evaluate(teleport(197, -2))
+check(chasing === 'attack' && (await H.until(`(async () => { const r = ${RIG}; return r.soloHerd().animals.find((a) => a.id === ${hog.id})?.state !== 'attack' })()`, 3000)), `34) 실내로 들어가면 쫓던 멧돼지가 포기한다 (${chasing})`)
+// 35) 폰: 주먹·칼을 들면 휘두르기 버튼. 세로 화면은 가방 줄(점프 위)에 있어 조이스틱과 겹치지 않는다. 누르면 휘두른다
+await H.evaluate(teleport(188, -12))
+await wait(1000)
+await H.evaluate(`(async () => { (await __mod('/src/game/input/touchDevice.ts')).useTouchUiStore.setState({ touchUi: true }); return true })()`)
+const overlapJoy = `(() => { const a = document.querySelector('button[aria-label="휘두르기"]')?.getBoundingClientRect(); const j = document.querySelector('.tc-joy')?.getBoundingClientRect(); if (!a || !j) return null; return a.left < j.right && a.right > j.left && a.top < j.bottom && a.bottom > j.top })()`
+for (const [w, h, name] of [[390, 844, 'portrait'], [844, 390, 'landscape']]) {
+  await H.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true })
+  await wait(1200)
+  check((await H.evaluate(overlapJoy)) === false, `35) 폰 ${name}: 휘두르기 버튼이 있고 조이스틱과 겹치지 않는다`)
+  await H.shot(`35-phone-${name}`)
+}
+const ready35 = await H.evaluate(`(async () => (await __mod('/src/game/hunt/meleeRig.ts')).meleeRig.readyAt)()`)
+await H.evaluate(`(document.querySelector('button[aria-label="휘두르기"]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })), true)`)
+check(await H.until(`(async () => (await __mod('/src/game/hunt/meleeRig.ts')).meleeRig.readyAt !== ${ready35})()`, 3000), '35) 폰 휘두르기 버튼을 누르면 휘두른다')
+await H.send('Emulation.clearDeviceMetricsOverride')
+await H.evaluate(`(async () => { (await __mod('/src/game/input/touchDevice.ts')).useTouchUiStore.setState({ touchUi: false }); return true })()`)
 H.close()
 
 check(!consoleErrors.some((e) => /shader|WebGLProgram/i.test(e)), '셰이더 컴파일 오류가 없다')
```

- [ ] **Step 9: 통과 확인**

Run: `npx vitest run && npx tsc -b && npm run lint 2>&1 | grep -c warning`
Expected: 76 파일 / 752 개 통과, tsc 출력 없음, `6`

Run: `node tools/meadow-check.mjs http://localhost:5190`
Expected: 31~35 모두 `OK` — "3 → 칼", "베기 한 번에 소 체력 2, 나를 쫓는다 (2, attack)", "소가 들이받으면 체력 −15", "맞으면 화면 가장자리가 번쩍인다", "찌르기로 소를 쓰러뜨린다", "\"소 사냥 성공!\" 알림", "소고기 2·뼈 1 을 떨어뜨린다 (beef,beef,bone)", "1.4초 뒤 전리품 줍기 안내", "E 로 주우면 가방에 소고기", "실내로 들어가면 쫓던 멧돼지가 포기한다 (attack)", "폰 portrait/landscape: 휘두르기 버튼이 있고 조이스틱과 겹치지 않는다", "폰 휘두르기 버튼을 누르면 휘두른다". 스크린샷 `35-phone-portrait.png` 에서 휘두르기(🔪 베기)가 가방 왼쪽, 점프 위에 있다.

- [ ] **Step 10: 눈으로 확인 (권장)**

`npm run dev` 로 띄워 혼자 하기 → 들판(세계 186, -23 근처, 마당 북쪽 울타리 너머)으로 가서 3(칼)을 들고 화면을 클릭해 마우스를 잠근 뒤 왼쪽·오른쪽 클릭. 오른팔이 바깥에서 안쪽으로 긋고(베기)·뒤로 당겼다 앞으로 찌르며(찌르기), 칼날이 동작 가운데에서 앞으로 눕는다. 맞은 동물은 빨갛게 번쩍이고, 쓰러지면 옆으로 넘어졌다 1.4초 뒤 사라지며 그 자리에 고기가 둥실 돈다.

- [ ] **Step 11: 커밋**

```bash
git add src/game/logic/melee.ts \
  src/game/logic/melee.test.ts \
  src/game/hunt/meleeRig.ts \
  src/game/hunt/huntActions.ts \
  src/game/input/pointer.ts \
  src/game/input/pointer.test.ts \
  src/game/logic/characterPose.ts \
  src/game/logic/characterPose.test.ts \
  src/game/scene/melee/MeleeController.tsx \
  src/game/scene/PlayerModel.tsx \
  src/game/scene/Player.tsx \
  src/game/scene/World.tsx \
  src/game/ui/Hud.tsx \
  src/game/ui/TouchControls.tsx \
  tools/meadow-check.mjs
git commit -F - <<'EOF'
feat: 주먹·칼로 휘둘러 사냥

주먹·칼을 든 채 마우스 왼쪽(주먹·베기)·오른쪽(칼 찌르기), 폰은 휘두르기 버튼(세로 화면은 가방 줄).
은지 공격 시간표대로 칼이 뻗는 순간 카메라가 보는 쪽으로 판정한다 (바닥 선분 → 동물 판정 원, Rapier 광선으로 벽에 막히면 안 맞음).
혼자면 바로 때리고 쓰러뜨리면 전리품, 같이면 animalHit 을 서버로.
휘두르는 동안 그쪽을 보고 오른팔을 덧돌린다. 키 안내에 휘두르기. 헤드리스 점검 31~35.
EOF
```

검증한 스크래치 커밋: `2b70db0` (이 커밋의 diff 를 그대로 적용해도 된다: `git -C /private/tmp/claude-501/-Users-ihyelin-proten-hrlee-----threejs/e476c70e-362f-4ed3-9ff7-d8664da04e4b/scratchpad/plan-3-3/repo format-patch -1 --binary 2b70db0 --stdout | git apply --index` 한 뒤 위 커밋 명령. 스크래치 커밋의 작성자는 scratch 라 `git am` 은 쓰지 않는다)


### Task 8: 동물 사냥 두 사람 헤드리스 점검과 마무리  — 스크래치 `1b77622`

**Files:**
- Modify: `tools/meadow-check.mjs`

**Interfaces:**
- Consumes: Task 4 서버 동작, Task 5~7 클라이언트 (`animalViews(true, …)`·`lootList`·`pressAttack`)
- Produces: meadow-check 36 (스펙 "확인 방법": 동물 사냥 두 사람이 같은 소를 보는지)

- [ ] **Step 1: 점검 36 을 더한다**

두 Chrome(디버깅 포트 9743·9744)이 같은 방에 들어가 두 화면을 거의 같은 때(`Promise.all`) 읽는다 — 달리는 동물은 초당 5m 까지 움직이고 받는 화면은 0.25초 늦게 그리므로 번호·종은 모두 같고 자리는 가운데 값이 1.5m 안이면 같은 동물로 본다.

`tools/meadow-check.mjs` (바꿀 곳, `git diff -U3`):

```diff
diff --git a/tools/meadow-check.mjs b/tools/meadow-check.mjs
--- a/tools/meadow-check.mjs
+++ b/tools/meadow-check.mjs
@@ -792,6 +792,65 @@ await H.send('Emulation.clearDeviceMetricsOverride')
 await H.evaluate(`(async () => { (await __mod('/src/game/input/touchDevice.ts')).useTouchUiStore.setState({ touchUi: false }); return true })()`)
 H.close()
 
+// 36) 같이 하기: 두 사람이 같은 동물을 본다 (서버가 돌린다). A 가 소를 때리면 B 화면에서도 체력이 줄고, 쓰러뜨리면 전리품은 A 에게만
+const RUN33 = Date.now().toString(36)
+const A5 = await open(9743, 0, `?room=hunt-${RUN33}`)
+await A5.evaluate(`__click('🔒 방 만들기')`)
+await A5.evaluate(`__fill('암호', 'secret1') && __fill('닉네임', '에이')`)
+await A5.evaluate(`__click('방 만들고 들어가기')`)
+check(await A5.until(`document.body.innerText.includes('👥 1명')`, 20000), '36) A 방 만들기')
+const B5 = await open(9744, 1, `?room=hunt-${RUN33}`)
+await B5.evaluate(`__fill('암호', 'secret1') && __fill('닉네임', '비이')`)
+await B5.evaluate(`__click('들어가기')`)
+check(await B5.until(`document.body.innerText.includes('👥 2명')`, 20000), '36) B 들어가기')
+const roomHerd = (b) => b.evaluate(`(async () => { const r = ${RIG}; return r.animalViews(true, performance.now() / 1000) })()`)
+await A5.evaluate(teleport(186, -23))
+await B5.evaluate(teleport(180, -23))
+await wait(2500)
+// 두 화면을 거의 같은 때 읽는다 (달리는 동물은 초당 5m 까지 움직인다). 번호·종은 모두 같고, 자리는 대부분 1.5m 안
+const [ha, hb] = await Promise.all([roomHerd(A5), roomHerd(B5)])
+const gaps = ha.map((a) => { const b = hb.find((x) => x.id === a.id && x.sp === a.sp); return b ? Math.hypot(b.x - a.x, b.z - a.z) : Infinity }).sort((x, y) => x - y)
+check(ha.length === 12 && hb.length === 12 && gaps.every(Number.isFinite) && gaps[6] < 1.5, `36) 두 사람이 같은 동물 12마리를 본다 (${ha.length}, ${hb.length}, 가운데 거리 ${gaps[6]?.toFixed(2)}m)`)
+await turnTo(A5, 0, -30)
+await A5.shot('36-room-A')
+await B5.shot('36-room-B')
+await A5.key('keydown', 'Digit3', '3')
+await A5.key('keyup', 'Digit3', '3')
+await wait(300)
+const attackA = (kind) => A5.evaluate(`(async () => { (await __mod('/src/game/input/pointer.ts')).pressAttack('${kind}'); return true })()`)
+const roomCow = (b, id) => b.evaluate(`(async () => { const r = ${RIG}; return r.animalViews(true, performance.now() / 1000).find((a) => ${id === undefined ? "a.sp === 'cow' && a.pose !== 'dead'" : `a.id === ${id}`}) ?? null })()`)
+const rc0 = await roomCow(A5)
+let rcB = rc0
+for (let i = 0; i < 6 && rcB && rcB.hp === 3; i++) {
+  const c = await roomCow(A5, rc0.id)
+  await A5.evaluate(teleport(c.x, c.z + 0.8))
+  await wait(400)
+  await attackA('primary')
+  await wait(900)
+  rcB = await roomCow(B5, rc0.id)
+}
+check(rcB?.hp === 2, `36) A 가 베면 B 화면의 소도 체력 2 (${rcB?.hp})`)
+const staminaA = await A5.evaluate(`(async () => ${HP}.survival.stamina)()`)
+check(await A5.until(`(async () => ${HP}.survival.stamina < ${staminaA})()`, 6000), '36) 서버의 소가 A 를 들이받으면 A 체력이 준다 (hurt)')
+let downB = false
+for (let i = 0; i < 6 && !downB; i++) {
+  const c = await roomCow(A5, rc0.id)
+  if (!c || c.pose === 'dead') break
+  await A5.evaluate(teleport(c.x, c.z + 0.8))
+  await wait(400)
+  await attackA('secondary')
+  await wait(1000)
+  const b = await roomCow(B5, rc0.id)
+  downB = !b || b.pose === 'dead'
+}
+check(downB, '36) A 가 찔러 쓰러뜨리면 B 화면에서도 쓰러진다')
+const lootA = await A5.evaluate(`(async () => ${RIG}.lootList().map((l) => l.item))()`)
+const lootB = await B5.evaluate(`(async () => ${RIG}.lootList().length)()`)
+check(lootA.filter((x) => x === 'beef').length === 2 && lootB === 0, `36) 전리품은 잡은 A 에게만 (${lootA} / B ${lootB})`)
+await A5.shot('36-room-loot')
+A5.close()
+B5.close()
+
 check(!consoleErrors.some((e) => /shader|WebGLProgram/i.test(e)), '셰이더 컴파일 오류가 없다')
 if (consoleErrors.length) console.log(`콘솔 오류·경고 ${consoleErrors.length}개:\n${consoleErrors.slice(0, 20).join('\n')}`)
```

- [ ] **Step 2: 실행해 확인**

Run: `node tools/meadow-check.mjs http://localhost:5190`
Expected: 36 모두 `OK` — "A 방 만들기", "B 들어가기", "두 사람이 같은 동물 12마리를 본다 (12, 12, 가운데 거리 0.00m)", "A 가 베면 B 화면의 소도 체력 2 (2)", "서버의 소가 A 를 들이받으면 A 체력이 준다 (hurt)", "A 가 찔러 쓰러뜨리면 B 화면에서도 쓰러진다", "전리품은 잡은 A 에게만 (beef,beef,bone / B 0)". 마지막에 "셰이더 컴파일 오류가 없다".

- [ ] **Step 3: 커밋**

```bash
git add tools/meadow-check.mjs
git commit -F - <<'EOF'
test: 동물 사냥 두 사람 헤드리스 점검

같이 하기에서 두 사람이 같은 동물 12마리를 보고, A 가 소를 베면 B 화면에서도 체력이 줄고,
서버의 소가 A 를 들이받으며, 쓰러뜨린 전리품은 A 에게만 떨어지는지 본다 (meadow-check 36).
EOF
```

검증한 스크래치 커밋: `1b77622` (이 커밋의 diff 를 그대로 적용해도 된다: `git -C /private/tmp/claude-501/-Users-ihyelin-proten-hrlee-----threejs/e476c70e-362f-4ed3-9ff7-d8664da04e4b/scratchpad/plan-3-3/repo format-patch -1 --binary 1b77622 --stdout | git apply --index` 한 뒤 위 커밋 명령. 스크래치 커밋의 작성자는 scratch 라 `git am` 은 쓰지 않는다)

- [ ] **Step 4: 마무리 확인 (커밋 없음)**

Run: `npx vitest run && npx tsc -b && npm run lint 2>&1 | grep -c warning && npm run build`
Expected: 76 파일 / 752 개, tsc 출력 없음, `6`, 빌드 성공 (500kB 넘는 덩어리 경고는 전부터 있다)

Run: `node tools/room-smoke.mjs ws://127.0.0.1:8787` → 31줄 모두 `OK`
Run: `node tools/meadow-check.mjs http://localhost:5190` → 1~36 모두 `OK`. 바쁜 기계에선 시간에 기대는 옛 점검(16 배 타다 죽기·21 F 먹기·24 열린 문 지나가기)이 가끔 늦어 실패한다 — 3-2 기준 커밋에서도 같은 점검이라 그 묶음만 다시 돌려 확인한다.

- [ ] **Step 5: 배포는 사용자에게 묻는다**

push·main 합치기·`npm run server:deploy` 는 사용자에게 먼저 묻는다. 배포한다면 **서버 먼저** (`npm run server:deploy`), 그다음 클라이언트(main push = Vercel). 서버가 먼저 나가면 옛 클라이언트는 `animals`·`loot`·`hurt` 를 버리고(동물이 안 보일 뿐) 그대로 논다.

---

## 자기 점검 (스펙 대조)

| 스펙 3-3 항목 | Task |
|---|---|
| 상태 기계(idle/walk/flee/attack/dead) 순수 TS `logic/animalSim.ts`, 입력 = 동물·사람(+실내)·dt·난수, 출력 = 새 목록 + 사건 | 2 |
| 7종 수치·12마리·25초·들판 세계 변환 | 2 |
| 공격은 맞은 동물만, 대상은 때린 사람, 실내면 포기 | 2 (+ 7 점검 34) |
| 혼자: 내 화면이 돌린다(저장 안 함) | 5 |
| 같이: 서버 alarm 200ms, `animals {list}` 소수 둘째 자리, 0.25초 늦게 이어 그리기, 방이 비면 버림 | 3·4·5 |
| 모델 `public/meadow/models/pets/`, SkeletonUtils.clone + idle/walk/run/eat | 6 |
| 맞으면 빨갛게, 죽으면 0.5초 넘어지고 1.4초 뒤 사라짐 | 6 |
| 주먹(1, 1.3)·칼(베기 1/찌르기 2, 1.8/2.3), 은지 공격 시간표 | 3·7 |
| 명중: 광선(Rapier 로 벽 막힘) → 판정 원. 혼자 `hit`, 같이 `animalHit {id, dmg}` → 서버 거리·쿨다운(300/400/700ms) → 체력 → `rollDrops` → 잡은 사람에게만 `loot`, 모두에게 `animals` 로 쓰러짐 | 3·4·7 |
| 전리품: 떠서 도는 물건, E(1.6m) → 가방, 같이 하기에선 잡은 사람 화면에만 | 5·6 |
| 동물이 때리면: 혼자 바로 피해, 같이 `hurt {dmg, by:'animal'}` → 체력 → 죽음(침대) | 1·4·5 |
| 죽으면 동물 진정 (3-1 이 미룬 것) | 5 (혼자), 결정한 것 (같이: 실내 침대) |
| 같이 하기 메시지 표 3-3 줄 (`animals`·`loot`·`hurt`·`animalHit`) | 3 |
| 확인 방법: `animalSim`·명중·쿨다운(`roomRules`)·프로토콜 테스트, 헤드리스 "두 사람이 같은 소" | 2·3·8 |
| 넘어온 것: `takeDamage` 피해 0, 아침 직후 눕기 | 1 |
