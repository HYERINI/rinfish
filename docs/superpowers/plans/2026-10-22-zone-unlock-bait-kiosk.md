# 낚시섬 잠긴 구역 해금·수리기사 연출·미끼·키오스크 상점·먹는 동작 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 잠긴 세 구역(연못·암초·동굴)을 열 수 있게 하고, 열 때 수리기사님들이 와서 망치질(다리·보트)하거나 둘이서 바위를 밀어 치우는 연출을 보여 준다. 미끼(지렁이·새우·루어)를 사서 낚시 중 골라 쓰면 희귀한 물고기가 잘 나온다. 사고파는 패널(장비 상점·어시장·판매함)을 그림이 있는 키오스크처럼 바꾸고, 음식을 먹으면 캐릭터가 먹는 동작을 한다.

**Architecture:** 해금 조건·연출 진행·미끼 배율·먹는 자세는 모두 순수 함수(`logic/`)가 정하고 scene 은 그 결과를 그리기만 한다. 해금 상태는 구매하는 순간 `progressStore.unlockedZones` 에 저장하고, 연출(`sessionStore.cutscene`)은 보여 주기만 한다 — 연출 중 새로고침해도 구역은 열려 있다. 연출 진행은 `logic/repairTimeline.ts` 의 `repairTimeline(kind, t)` 가 시각 t 만으로 단계·기사님 위치·자세·바위 위치를 돌려준다(타이머를 따로 두지 않는다). 먹는 상태는 감정 표현처럼 `sessionStore.playerAction.eatAt` 에 둔다(여러 명이 같이 할 때 이 값만 주고받으면 된다).

**Tech Stack:** React 19, R3F 9, drei 10, @react-three/rapier, zustand 5(persist), vitest, Node + gltf-transform(캐릭터 빌드 도구)

**Spec:** 사용자 요청(2026-10-22): "잠긴 구역 여는 기능 + 미끼 바로 만들어줘. 고칠 때 수리기사님들이 오셔서 망치 때려서 고치고 가는 걸 볼 수 있게, 동굴은 수리기사님들이 둘이서 영차영차 (바위를) 치워주게. 사고 파는 모달창들에도 이미지 넣고 진짜 키오스크처럼 고르는 걸로. 먹이(음식) 먹을 때 캐릭터가 먹는 애니메이션도." 상위 기획 `docs/superpowers/specs/2026-10-12-fishing-island-design.md` 6장(구역 해금 조건)을 따른다. 섬 바닥(풀·지형) 꾸미기는 다른 작업이 하므로 건드리지 않는다.

## Global Constraints

- 층 규칙: scene/ui → stores → logic → data. `logic/`은 React·three·zustand를 import하지 않는다
- 가격·배율·연출 시간·기사님 동선 같은 값은 `src/game/data/`에만
- 저장 키 `fishing-island-save-v1` 그대로. 새 필드(`unlockedZones`, `bait`, `selectedBait`)는 `merge`에서 검증하고, 옛 저장본은 "모두 잠김·미끼 없음"으로 불러온다
- 캐릭터 glb는 `tools/build-characters`로만 만든다. `npm run inspect` 통과, 파일당 4MB 이하
- 키: 탐험 중 1~5 감정 표현은 그대로. 낚시 중에만 1~3 미끼, 0 미끼 없이
- UI 패널 zIndex 1000, drei Html 라벨 `zIndexRange={[100, 0]}`, 모바일 폭 `min(…, 92vw)`
- tsconfig: `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUnusedLocals`/`noUnusedParameters`
- 커밋 메시지: 타입만, 괄호 스코프 금지, 짧은 한국어 제목 + 본문, Co-Authored-By·AI 표기 금지

## Review Focus

1. **옛 저장본** → 세 구역 모두 잠김, 미끼 0개로 불러온다. 이상한 값(모르는 구역 id, 음수 미끼)은 버린다. Task 4 테스트로 고정한다.
2. **잠긴 구역 낚시 포인트** → 잠겨 있으면 포인트 표시·E 안내가 없다(장벽을 넘을 수 없지만 이중으로 막는다). Task 4 테스트로 고정한다.
3. **동굴 조건 미달에서 E** → 진행도("도감 5/8 · 낚싯줄 Lv2/3")만 보여 주고 아무것도 바뀌지 않는다. Task 4 테스트로 고정한다.
4. **연출 중 새로고침** → 구역은 이미 열려 있고 고쳐진 모습이다. 연출 중엔 이동·점프·감정 표현·E가 먹히지 않는다. Task 5 확인.
5. **미끼 없이 던지기** → 기본 확률로 낚인다. 미끼가 있으면 던질 때 1개만 줄어든다(입질을 놓쳐도 이미 쓴 것). Task 2 테스트로 고정한다.
6. **먹는 중 이동 키** → 바로 멈추고 걷는다. Task 6 테스트로 고정한다.

---

### Task 1: 수리 클립 추가해서 캐릭터 다시 만들기

**Files:** Modify `tools/build-characters/build.mjs`(CLIPS), `tools/build-characters/inspect.mjs`(EXPECTED_CLIPS), `public/models/characters/male.glb`, `female.glb`

- [ ] **Step 1:** `CLIPS`에 UAL 무료 판의 `Fixing_Kneeling`(무릎 꿇고 손으로 고치는 동작)을 더한다. 바위 밀기는 이미 있는 `Push_Loop`를 쓴다. 먹는 동작은 맞는 클립이 없어(마시기·먹기 없음) 서 있기 클립 위에 오른팔 뼈를 덧돌린다.
- [ ] **Step 2:** `npm run build && npm run inspect`. 남·여 각각 약 2.8MB.
- [ ] **Step 3: 커밋** `chore: 캐릭터에 수리 클립 추가`

---

### Task 2: 미끼

**Files:**
- Create: `src/game/data/bait.ts`, `src/game/logic/bait.ts` (+test)
- Modify: `src/game/logic/catchTable.ts` (+test), `src/game/logic/fishingSession.ts`, `src/game/logic/interaction.ts` (+test), `src/game/stores/progressStore.ts` (+test), `src/game/scene/fishing/FishingController.tsx`, `src/game/input/useInteractionKeys.ts`, `src/game/ui/FishingOverlay.tsx`, Create `src/game/ui/ItemIcon.tsx`

```ts
// data/bait.ts
export type BaitId = 'worm' | 'shrimp' | 'lure'
export const BAITS: BaitDef[] = [
  { id: 'worm', name: '지렁이', price: 5, key: 'Digit1', rarityMul: {} },
  { id: 'shrimp', name: '새우', price: 20, key: 'Digit2', rarityMul: { rare: 1.5, epic: 1.5 } },
  { id: 'lure', name: '루어', price: 60, key: 'Digit3', rarityMul: { rare: 2, epic: 2.5, legendary: 2 } },
]
export const NO_BAIT_KEY = 'Digit0'
```

- `catchWeights(zone, castPower, bait: BaitId | null = null)` — 희귀도 묶음 가중치 = 구역 기본 × 던진 힘 보너스 × 미끼 배율(곱한다).
- `logic/bait.ts`: `usableBait(selected, counts)` — 고른 미끼가 0개면 null(미끼 없이). `buyBait(coins, counts, id, qty)`.
- 저장: `bait: Record<BaitId, number>`, `selectedBait: BaitId | null`.
- 던지는 순간(aiming → waiting) `usableBait`로 정한 미끼를 `stepFishing` 컨텍스트에 넘기고, 같은 프레임에 1개 쓴다.
- 낚시 중 숫자 키 1~3·0 → `resolveKeyAction`이 `{ type: 'selectBait' }`. 낚시 화면 오른쪽 아래 미끼 칸(그림·개수·키)을 눌러도 고른다.

- [ ] **Step 1: 실패하는 테스트** — 미끼 배율이 던진 힘 보너스와 곱해진다, 지렁이는 기본과 같다, 루어면 전설 비율이 오른다, 미끼가 0개면 미끼 없이, 낚시 중 1~3·0만 미끼 선택(탐험 중엔 아님), 저장본 검증.
- [ ] **Step 2: 구현 → 테스트 통과**
- [ ] **Step 3: 커밋** `feat: 미끼 추가`

---

### Task 3: 키오스크 상점

**Files:** Create `src/game/ui/Kiosk.tsx`(공통 틀: 코인 머리줄·분류 탭·큰 카드 격자·고른 상품 자세히·수량·큰 버튼), Modify `GearShopPanel.tsx`(미끼/장비/사료), `MarketPanel.tsx`(요리 고르기 → 물고기 고르기 → 먹기), `SellPanel.tsx`(물고기 카드 → 팔기·모두 팔기), `ItemIcon.tsx`(장비·미끼·사료·요리 SVG)

- 물고기 그림은 `FishImage`, 나머지는 작은 SVG 아이콘.
- 카드를 누르면 고른 상태(테두리·체크) + 아래(모바일) / 오른쪽(넓은 화면) 자세히 칸. 수량 +/-는 미끼·사료만.
- ESC 닫기·zIndex 1000·`min(…, 92vw)` 유지. 버튼을 누른 뒤 `blur()`로 Space 연타 구매 방지.

- [ ] **Step 1: 구현**
- [ ] **Step 2: 캡처** — 세 패널 목록·고른 상태, 1280px·390px
- [ ] **Step 3: 커밋** `feat: 상점을 키오스크처럼 바꾸기`

---

### Task 4: 잠긴 구역 해금

**Files:**
- Modify: `src/game/data/zones.ts` (해금 방법·가격·조건·연출 자리), `src/game/logic/interaction.ts` (`zoneGate` 대상, `unlock` 모드)
- Create: `src/game/logic/zoneUnlock.ts` (+test)
- Modify: `src/game/stores/progressStore.ts` (+test), `src/game/stores/sessionStore.ts` (cutscene), `src/game/scene/Island.tsx` (문 부분만 떼어 냄), Create `src/game/scene/zones/ZoneGates.tsx`, `src/game/ui/UnlockPanel.tsx`, Modify `FishingSpots.tsx`, `Hud.tsx`, `Panels.tsx`

```ts
// data/zones.ts
export type ZoneUnlock =
  | { kind: 'repair'; target: 'bridge' | 'boat'; price: number }
  | { kind: 'clear'; minDex: number; minLineLevel: number } // 화면 Lv = 단계 + 1
// logic/zoneUnlock.ts
export function unlockStatus(zone, ctx: { coins; dexCount; lineLevel; unlocked: ZoneId[] }):
  { state: 'open' } | { state: 'ready'; price: number } | { state: 'short'; reason: 'coins' | 'conditions'; progress: string }
export function isZoneOpen(zone: ZoneId, unlocked: readonly ZoneId[]): boolean // 해변은 늘 열림
```

- 문 앞 감지 상자 → E → `unlock` 패널(사진 같은 그림·가격·진행도·"수리 맡기기"/"수리기사님 부르기"). 누르면 그 자리에서 코인을 내고 `unlockedZones`에 넣은 뒤 연출을 시작한다.
- 열리면 보이지 않는 벽(콜라이더)을 없앤다. 낚시 포인트는 열린 구역만 보인다.

- [ ] **Step 1: 실패하는 테스트** — 해변은 늘 열림, 코인 부족/충분, 동굴 진행도 문자열, 이미 열림, 저장본 검증(모르는 id 버림), 잠긴 구역 포인트 숨김.
- [ ] **Step 2: 구현 → 테스트 통과**
- [ ] **Step 3: 커밋** `feat: 잠긴 구역 해금`

---

### Task 5: 수리기사님 연출

**Files:** Create `src/game/data/repair.ts`, `src/game/logic/repairTimeline.ts` (+test), `src/game/scene/zones/Worker.tsx`, `src/game/scene/zones/RepairCutscene.tsx`; Modify `Player.tsx`(연출 중 카메라), `ZoneGates.tsx`

- `repairTimeline(kind: 'hammer' | 'push', t)` → `{ phase: 'arrive' | 'work' | 'done' | 'leave' | 'end'; fixed: boolean; workers: { x; z; facing; pose: 'walk' | 'fix' | 'push' | 'idle' | 'cheer' }[]; rock: number(0~1 치운 정도); bubble: string | null }`. 동선(출발·작업·퇴장 위치)은 data 에서 상대 좌표로.
- 망치질: 두 분이 걸어와 무릎 꿇고 망치(손뼈에 붙인 메시)를 내리친다 + 먼지·"뚝딱뚝딱"·"쾅!". 중간에 부서진 모습 → 고친 모습으로 바뀌고, 엄지 척 뒤 걸어 나간다. 약 9초.
- 바위: 둘이 바위 옆에 붙어 `Push_Loop`로 밀며 "영차! 영차!" 말풍선, 바위가 굴러가 비켜난다. 약 9초.
- 기사님 모습: 캐릭터 glb + 작업복(주황 윗옷·남색 바지) + 노란 안전모 메시.
- 연출 중 `mode = 'cutscene'`: 플레이어 조작·E·ESC 없음, 카메라는 연출 자리를 비춘다. 끝나면 탐험으로.

- [ ] **Step 1: 실패하는 테스트** — 단계 순서, 시작·끝 위치가 화면 밖, 작업 중엔 작업 자리, 고친 순간 이후 fixed, 바위 진행 0→1 단조 증가, 끝 이후 end.
- [ ] **Step 2: 구현** — 캡처: 도착·망치질·고침·퇴장, 바위 밀기, 열린 구역 걸어 들어가기.
- [ ] **Step 3: 커밋** `feat: 수리기사님이 와서 고쳐 주는 연출`

---

### Task 6: 먹는 동작

**Files:** Modify `src/game/data/balance.ts`(EAT 시간), `src/game/logic/playerMotion.ts` (+test), `src/game/logic/characterPose.ts` (+test), `src/game/stores/sessionStore.ts`, `src/game/scene/PlayerModel.tsx`, `src/game/scene/Player.tsx`, `src/game/ui/MarketPanel.tsx`

- `PlayerAction`에 `eatAt`(먹기 시작 시각) 추가. `startEating(action, now)`, `isEating(action, now)` — `EAT.duration`(1.8초) 동안. 움직이거나 점프·감정 표현하면 끝난다.
- `characterPose`: 먹는 중이면 `'eat'`(idle 클립 + 오른팔 덧돌림, 씹을 때마다 살짝 오르내림). 손에 요리 메시, 머리 위 "냠냠".
- 어시장에서 먹으면 패널을 닫고 바로 먹는 동작.

- [ ] **Step 1: 실패하는 테스트** → **Step 2: 구현** → 캡처 → **Step 3: 커밋** `feat: 음식을 먹는 동작`

---

### Task 7: 마무리

- [ ] `npx vitest run && npx tsc -b && npm run lint && npm run build` (기존 경고 6개 외에 새 경고 없음)
- [ ] 캡처 묶음(contact sheet) 만들기
