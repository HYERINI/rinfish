# 낚시섬 캐릭터 움직임(빠르게·질주·점프·감정 표현·얼굴 줌) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 이동을 빠르게, Shift 질주, Space 점프, 숫자 키 감정 표현(춤·수다·구르기·펀치·마법), 휠로 얼굴이 보일 만큼 확대.

**Architecture:** 캐릭터 동작은 순수 함수(`logic/characterPose.ts`, 새 `logic/playerMotion.ts`)가 "지금 상태 → 자세·속도"를 정하고, `Player`/`PlayerModel`은 그 결과를 재생만 한다. 플레이어의 동작 상태(감정 표현·점프·질주)는 `sessionStore.playerAction` 한곳에 모아 둔다 — 나중에 여러 명이 같이 할 때 이 값만 서버로 주고받으면 다른 사람 캐릭터도 같은 코드로 그릴 수 있게 하기 위해서다(이번에는 네트워크를 만들지 않는다). 필요한 애니메이션 클립은 저장소의 캐릭터 빌드 도구로 다시 만든다.

**Tech Stack:** React 19, R3F 9, @react-three/rapier, zustand, vitest, Node + gltf-transform(빌드 도구)

**Spec:** 사용자 요청(2026-10-22): "캐릭터가 너무 느리고, 뛰어오르거나 춤추는 것도 넣고 싶다. 나중에 여러 유저가 같이 할 수 있어서 얼굴을 볼 수 있을 정도로 확대가 가능해야 한다." 상위 기획 `docs/superpowers/specs/2026-10-21-character-customization-design.md` 7장(줌)을 고친다: 최소 거리 4 → 1.5, 가까울수록 카메라가 얼굴 높이로 내려온다.

## Global Constraints

- 층 규칙: scene/ui → stores → logic → data. `logic/`은 React·three·zustand를 import하지 않는다
- 속도·줌 범위·키 배치 같은 값은 `src/game/data/`에만
- 캐릭터 glb는 `tools/build-characters`로만 만든다(손으로 고치지 않는다). `npm run inspect` 통과
- 키: WASD 이동, Shift 질주, Space 점프, 1~5 감정 표현, E 상호작용, ESC 메뉴 — 탐험 모드에서만(낚시·패널·휴식 중엔 이동·점프·감정 표현 안 함)
- tsconfig: `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUnusedLocals`/`noUnusedParameters`
- 커밋 메시지: 타입만, 괄호 스코프 금지, 짧은 한국어 제목 + 본문, Co-Authored-By·AI 표기 금지

## Review Focus

1. **공중에서 Space 연타** → 땅에 닿기 전에는 다시 뛰지 않는다(무한 점프 금지). Task 2 테스트로 고정한다.
2. **감정 표현 중 이동 키** → 바로 감정 표현을 멈추고 걷는다. Task 2 테스트로 고정한다.
3. **낚시·패널·휴식 중 Space·숫자 키** → 아무 일도 없다(숫자 키는 나중에 미끼 고르기에 쓰인다). Task 2 테스트로 고정한다.
4. **가장 가까이 당긴 카메라** → 캐릭터 몸속으로 들어가지 않고 얼굴이 정면 비스듬히 보인다(키 0.75~1.3 모두). Task 2 캡처로 확인한다.
5. **점프 착지 후 바로 낚시 시작** → 점프 자세가 남지 않는다. Task 2 캡처로 확인한다.

---

### Task 1: 캐릭터 클립 추가해서 다시 만들기

**Files:** Modify `tools/build-characters/build.mjs`(CLIPS), `tools/build-characters/inspect.mjs`(EXPECTED_CLIPS), `public/models/characters/male.glb`, `female.glb`

- [ ] **Step 1:** `CLIPS`에 `Sprint_Loop`, `Jump_Start`, `Jump_Loop`, `Jump_Land`, `Idle_Talking_Loop`, `Roll`, `Punch_Jab`, `Spell_Simple_Shoot`를 더한다(UAL 무료 판에 있음). `inspect.mjs` 기대 목록도 같이.
- [ ] **Step 2:** `cd tools/build-characters && npm install && npm run build && npm run inspect` — `.cache`가 없으면 `npm run fetch` 먼저. 파일당 4MB 이하 유지(넘으면 resample 허용오차를 올리거나 클립별 키프레임을 줄인다).
- [ ] **Step 3:** 게임에서 기존 동작(걷기·낚시 반응·앉기)이 그대로인지 headless 캡처 몇 장으로 확인.
- [ ] **Step 4: 커밋** `chore: 캐릭터에 질주·점프·감정 표현 클립 추가` (본문에 추가한 클립과 파일 크기)

---

### Task 2: 빠른 이동·질주·점프·감정 표현·얼굴 줌

**Files:**
- Modify: `src/game/data/balance.ts` (MOVE, CAMERA_ZOOM), `src/game/data/characters.ts` (클립 표), `src/game/logic/characterPose.ts` (+test)
- Create: `src/game/logic/playerMotion.ts` (+test), `src/game/data/emotes.ts`
- Modify: `src/game/stores/sessionStore.ts` (playerAction), `src/game/input/keys.ts` 또는 새 `input/usePlayerActionKeys.ts`, `src/game/scene/Player.tsx`, `src/game/scene/PlayerModel.tsx`, `src/game/ui/Hud.tsx`(키 안내)

**Interfaces / 데이터:**

```ts
// data/balance.ts
export const MOVE = { walkSpeed: 8, sprintSpeed: 13, jumpSpeed: 6.5 }
export const CAMERA_ZOOM = { min: 1.5, max: 18, initial: 10, heightRatio: 0.7, sensitivity: 0.0015,
  /** 가장 가까울 때 카메라 높이 비율과 시선 높이(캐릭터 키 대비) */
  closeHeightRatio: 0.12, closeLookAt: 0.88, farLookAt: 0.55, closeFrom: 6 }

// data/emotes.ts
export type EmoteId = 'dance' | 'chat' | 'roll' | 'punch' | 'spell'
export const EMOTES: { id: EmoteId; key: string; label: string; clip: CharacterClip; loop: boolean }[] = [
  { id: 'dance', key: 'Digit1', label: '춤', clip: 'dance', loop: true },
  { id: 'chat', key: 'Digit2', label: '수다', clip: 'chat', loop: true },
  { id: 'roll', key: 'Digit3', label: '구르기', clip: 'roll', loop: false },
  { id: 'punch', key: 'Digit4', label: '펀치', clip: 'punch', loop: false },
  { id: 'spell', key: 'Digit5', label: '마법', clip: 'spell', loop: false },
]
```

- `CharacterClip`에 `'sprint' | 'jumpStart' | 'jumpLoop' | 'jumpLand' | 'dance' | 'chat' | 'roll' | 'punch' | 'spell'`(`celebrate`는 춤 클립을 같이 쓴다).
- `logic/playerMotion.ts`(순수):
  - `type PlayerAction = { emote: EmoteId | null; emoteAt: number; airborne: boolean; jumpAt: number; landedAt: number }`
  - `nextAction(action, input: { moving: boolean; sprint: boolean; jumpPressed: boolean; emotePressed: EmoteId | null; grounded: boolean; mode: Mode; now: number }): PlayerAction` — 탐험 모드가 아니면 감정 표현 해제·점프 무시, 움직이면 감정 표현 해제, 땅에 있을 때만 점프, 한 번만 하는 감정 표현은 클립 길이 뒤 자동 해제(길이는 인자로 받는다).
  - `moveSpeed(sprint: boolean): number`
  - `cameraRig(distance: number, characterHeight: number): { height: number; lookAtY: number }` — 거리가 `closeFrom`보다 가까워질수록 높이 비율이 `heightRatio`→`closeHeightRatio`, 시선이 `farLookAt`→`closeLookAt`(키 비율)로 부드럽게 바뀐다.
- `characterPose`에 점프(`jumpStart`→`jumpLoop`→`jumpLand`), 질주(`sprint`), 감정 표현 자세를 더한다. 낚시·앉기 자세가 우선.
- `sessionStore.playerAction` + `setPlayerAction`. Player는 매 프레임 `nextAction`으로 갱신하고 `PlayerModel.update`에 넘긴다(다른 사람 캐릭터도 같은 입력으로 그릴 수 있게 update 인자는 이 값과 속도만 받는다).
- 땅 판정: 리지드바디 아래로 짧게 레이캐스트(rapier `world.castRay`) 또는 세로 속도 ≈ 0 + 발 높이. 테스트 가능한 부분(언제 점프할 수 있는지)은 `grounded` 입력으로 순수 함수가 정한다.
- HUD 키 안내: "WASD 이동 · Shift 달리기 · Space 점프 · 1~5 감정 표현 · 휠 확대".

- [ ] **Step 1: 실패하는 테스트** — `playerMotion.test.ts`: 공중 Space 무시, 움직이면 감정 해제, 탐험 외 모드 무시, 한 번짜리 감정 자동 해제, 질주 속도, `cameraRig` 가까울수록 낮고 얼굴 높이를 봄. `characterPose.test.ts`: 점프·질주·감정 자세, 낚시·앉기 우선.
- [ ] **Step 2: 구현** (위 인터페이스)
- [ ] **Step 3: Player/PlayerModel 연결**, 키 입력(반복 입력 무시), 이동 속도·질주, 점프(세로 속도 `jumpSpeed`), 카메라 `cameraRig` 적용.
- [ ] **Step 4: 확인** — `npx vitest run && npx tsc -b && npm run lint && npm run build`. headless 캡처: 질주, 점프 중(올라감·내려옴·착지), 감정 표현 5개, 감정 중 이동 키, 가장 가까운 줌(남녀·키 0.75/1.3) 얼굴, 멀리 줌, 낚시 중 숫자·Space 무반응.
- [ ] **Step 5: 커밋** `feat: 질주·점프·감정 표현과 얼굴까지 확대` (본문에 키 배치, 속도, 줌 변화, 나중 여러 명 대비 구조)
