# 낚시섬 1차-A: 핵심 루프 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 선착장 해변에서 캐릭터를 움직여 낚시 포인트에서 낚시(캐스팅 → 입질 → 텐션 줄다리기)를 하고, 잡은 물고기를 도감에 등록하고 팔아서 장비를 업그레이드할 수 있는 플레이 가능한 핵심 루프를 만든다.

**Architecture:** 게임 규칙(입질, 줄다리기, 물고기 추첨, 경제)은 `src/game/logic/`의 순수 함수로 만들고 vitest로 검증한다. 상태는 zustand 스토어 세 개(저장되는 `progressStore`, 저장 안 되는 `sessionStore`·`fishingStore`)로 나눈다. 3D 씬(R3F + Rapier)과 HTML UI는 스토어를 읽어 표현만 한다.

**Tech Stack:** Vite 8, React 19, TypeScript 6, three 0.186, @react-three/fiber 9, @react-three/drei 10, @react-three/rapier, zustand 5, vitest, jsdom

**Spec:** `docs/superpowers/specs/2026-10-12-fishing-island-design.md`

**범위:** 스펙 14장 개발 순서의 1~4단계(섬·이동, 낚시 미니게임, 물고기·도감, 판매·장비). 체력·어시장·진료소, 구역 해금, 어항, 전설·엔딩·`onFinish`, 캐릭터 선택은 다음 계획(1차-B)에서 다룬다. 이 계획에서 플레이 가능한 구역은 ① 선착장 해변뿐이고, 나머지 구역은 잠긴 문으로 막혀 있다.

## Global Constraints

- 게임 전체는 `src/game/Game.tsx`의 `Game` 컴포넌트 하나로 노출하고, 부모 요소 크기를 100% 채운다. Props: `onExit?: () => void`, `onFinish?: (result: { score: number }) => void`
- 저장은 localStorage만 사용, 키는 `fishing-island-save-v1`
- 모든 밸런스 수치는 `src/game/data/`에만 둔다. 로직·컴포넌트에 숫자를 하드코딩하지 않는다(좌표·크기 같은 배치 값 제외)
- 시간 기반 규칙은 실제 시각이 아닌 누적 플레이 시간 기준
- `logic/`은 React·three·zustand를 import하지 않는다
- tsconfig: `verbatimModuleSyntax`(타입은 `import type`), `erasableSyntaxOnly`(enum 금지), `noUnusedLocals`/`noUnusedParameters`
- 3D 모델 없이 기본 도형으로 만든다. 3D 안의 한글 텍스트는 drei `<Html>`로 표시한다(`<Text>`는 한글 폰트가 없음)
- 커밋 메시지: `feat:`/`chore:`/`test:` 처럼 타입만, 괄호 스코프 금지, 제목은 짧게 한국어, Co-Authored-By 금지

## Review Focus

1. **탭을 오래 비웠다 돌아오면 프레임 delta가 수 초가 된다** → 줄이 한 프레임에 끊기거나 입질 창이 지나가 버리면 안 된다. `stepFight`의 dt 상한(Task 4)과 `clampDelta`(Task 10)로 막고 테스트한다.
2. **localStorage에 깨진 JSON이나 지금은 없는 물고기 id가 저장돼 있다** → 게임이 크래시 없이 시작돼야 한다. 영속화 `merge`에서 걸러내고 테스트한다(Task 7).
3. **낚시 중 E를 누르거나, ESC를 누르거나, 키를 꾹 눌러 반복 입력** → 엉뚱한 패널이 열리면 안 된다. `resolveKeyAction`으로 테스트한다(Task 9).
4. **코인이 가격과 정확히 같을 때 / 이미 최고 단계일 때 업그레이드** → 같으면 살 수 있고, 최고 단계에서는 코인이 줄지 않아야 한다(Task 6).
5. **빈 보관함 판매, 없는 id 판매** → 코인이 변하지 않아야 한다(Task 7).

---

## 파일 구조

```
src/game/
  Game.tsx                      (수정) Physics + 입력 훅 + UI 레이어
  data/
    types.ts                    공용 타입
    balance.ts                  밸런스 수치
    fish.ts                     물고기 14종 + 희귀도 라벨
    gear.ts                     장비 3종 × 3단계
    zones.ts                    구역, 섬 크기, 낚시 포인트
  logic/                        순수 함수 (+ *.test.ts)
    rng.ts  cast.ts  catchTable.ts  bite.ts  fight.ts
    fishingSession.ts  economy.ts  interaction.ts  time.ts  id.ts
  stores/
    progressStore.ts            저장: 코인, 장비, 보관함, 도감, 플레이 시간
    sessionStore.ts             비저장: 현재 모드, 근처 상호작용 대상
    fishingStore.ts             비저장: 진행 중인 낚시 상태
  input/
    keys.ts  pointer.ts  useInteractionKeys.ts
  scene/
    World.tsx  Island.tsx  Player.tsx  PlayTimeTicker.tsx
    facilities/  InteractionZone.tsx  FishingSpots.tsx  SellBox.tsx  GearShop.tsx
    fishing/     FishingController.tsx  FishingVisuals.tsx
  ui/
    styles.ts  Hud.tsx  Panel.tsx  Panels.tsx  MenuPanel.tsx
    FishingOverlay.tsx  DexPanel.tsx  SellPanel.tsx  GearShopPanel.tsx
삭제: src/game/store.ts, (World.tsx/Hud.tsx는 전면 교체)
```

---

### Task 1: 저장소와 도구 준비

**Files:**
- Modify: `package.json` (scripts.test 추가, 의존성 추가)

**Interfaces:**
- Produces: `npm test` (vitest run), `@react-three/rapier` 사용 가능

- [ ] **Step 1: git 저장소 초기화 및 현재 상태 커밋**

```bash
cd /Users/ihyelin/proten_hrlee/스터디/threejs
git init
git add -A
git commit -m "chore: 프로젝트 뼈대와 설계 문서 추가"
```

- [ ] **Step 2: 의존성 설치**

```bash
npm install @react-three/rapier
npm install -D vitest jsdom
```

Expected: 설치 성공. peer dependency 충돌이 나면 멈추고 에러 내용을 보고한다(`--force` 금지).

- [ ] **Step 3: test 스크립트 추가**

`package.json`의 `scripts`에 추가:

```json
"test": "vitest run"
```

- [ ] **Step 4: 동작 확인**

Run: `npm test`
Expected: "No test files found" 메시지와 함께 종료(아직 테스트 없음). 에러로 vitest가 실행조차 안 되면 멈추고 보고.

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add package.json package-lock.json
git commit -m "chore: rapier, vitest 설치"
```

---

### Task 2: 게임 데이터와 물고기 추첨

**Files:**
- Create: `src/game/data/types.ts`, `src/game/data/balance.ts`, `src/game/data/fish.ts`, `src/game/data/gear.ts`, `src/game/data/zones.ts`
- Create: `src/game/logic/rng.ts`, `src/game/logic/cast.ts`, `src/game/logic/catchTable.ts`
- Test: `src/game/logic/catchTable.test.ts`

**Interfaces:**
- Produces:
  - 타입: `ZoneId`, `Rarity`, `FightPattern`, `BasicPattern`, `FishSpecies`, `GearSlot`, `GearLevels`, `GearStats`, `FishInstance`
  - `FIGHT`, `PATTERNS`, `BITE`, `CAST`, `RARITY_WEIGHTS`, `CAST_RARITY_BONUS`, `MAX_FRAME_DELTA`
  - `FISH_SPECIES`, `RARITY_LABEL`, `RARITY_COLOR`, `findSpecies(id): FishSpecies | undefined`, `getSpecies(id): FishSpecies`
  - `GEAR: Record<GearSlot, GearDef>`
  - `ZONES: ZoneDef[]`, `FISHING_SPOTS: FishingSpot[]`, `getSpot(id): FishingSpot`, `ISLAND_RADIUS`, `FENCE_Z`, `WATER_Y`
  - `type Rng = () => number`, `lerp`, `lerpRange`, `fixedRng(v)`
  - `castPowerFromHold(seconds): number` (0~1), `castDistance(power): number`
  - `catchWeights(zone, castPower)`, `rollSpecies(zone, castPower, rng): FishSpecies`, `rollWeight(species, rng): number`

- [ ] **Step 1: 타입 파일 작성** — `src/game/data/types.ts`

```ts
export type ZoneId = 'beach' | 'pond' | 'reef' | 'cave'
export type Rarity = 'junk' | 'common' | 'rare' | 'epic' | 'legendary'
export type FightPattern = 'dasher' | 'endurance' | 'erratic' | 'mixed'
/** mixed(전설)는 이 세 가지를 번갈아 쓴다 */
export type BasicPattern = Exclude<FightPattern, 'mixed'>

export type FishSpecies = {
  id: string
  name: string
  description: string
  zones: ZoneId[]
  rarity: Rarity
  pattern: FightPattern
  /** 1~10. 클수록 당기는 힘이 세다 */
  strength: number
  /** kg 단위 [최소, 최대] */
  weightRange: [number, number]
  /** 무게가 범위의 중간값일 때 판매가 */
  basePrice: number
  /** 3D 모델이 생기기 전까지 쓰는 대표 색 */
  color: string
}

export type GearSlot = 'line' | 'reel' | 'rod'
/** 장비 단계. 0부터 시작하고 화면에는 Lv1~Lv3로 보여 준다 */
export type GearLevels = Record<GearSlot, number>
export type GearStats = {
  /** 이 텐션을 넘으면 줄이 끊긴다 (낚싯줄) */
  maxTension: number
  /** 초당 감는 거리 (릴) */
  reelSpeed: number
  /** 물고기 당김으로 오르는 텐션에 곱하는 값. 작을수록 좋다 (낚싯대) */
  shockAbsorb: number
}

/** 잡은 물고기 한 마리. 판매·요리·전시가 모두 이 단위로 다룬다 */
export type FishInstance = {
  id: string
  speciesId: string
  weight: number
  caughtAtPlayTime: number
}
```

- [ ] **Step 2: 밸런스 수치** — `src/game/data/balance.ts`

```ts
import type { BasicPattern, Rarity } from './types'

type Range = [number, number]

/** 텐션 줄다리기 */
export const FIGHT = {
  startDistance: 60,
  /** 이 거리까지 멀어지면 물고기가 도망간다 */
  escapeDistance: 100,
  startTension: 30,
  /** 감는 동안 초당 오르는 텐션 */
  reelTensionRate: 30,
  /** 손을 뗀 동안 초당 내려가는 텐션 */
  relaxRate: 40,
  /** 텐션이 이보다 낮은 상태가 slackEscapeTime 초 이어지면 바늘이 빠진다 */
  slackThreshold: 5,
  slackEscapeTime: 2.5,
  /** 당김 중 초당 텐션 상승 = strength × 이 값 × 당김 세기 × 낚싯대 */
  pullTensionPerStrength: 8,
  /** 당김 중 손을 떼고 있을 때 초당 멀어지는 거리 = strength × 이 값 × 당김 세기 */
  pullDistancePerStrength: 1.5,
  /** 당김이 없을 때 손을 떼고 있으면 초당 멀어지는 거리 */
  driftSpeed: 1,
  /** 당김 중에 감으면 감기 속도에 곱하는 값 */
  reelDuringPullFactor: 0.3,
  /** 한 번의 스텝에서 처리하는 최대 시간(초) */
  maxDt: 0.1,
}

export type PatternConfig = {
  /** 당김과 당김 사이 쉬는 시간(초) */
  interval: Range
  /** 당김 지속 시간(초) */
  duration: Range
  /** 당김 세기 */
  intensity: Range
}

export const PATTERNS: Record<BasicPattern, PatternConfig> = {
  dasher: { interval: [3, 5], duration: [0.6, 0.6], intensity: [1.6, 1.6] },
  endurance: { interval: [1.5, 2.5], duration: [2, 2], intensity: [0.6, 0.6] },
  erratic: { interval: [0.5, 3], duration: [0.3, 1.2], intensity: [0.5, 1.5] },
}

/** 입질 */
export const BITE = {
  waitMin: 2,
  waitMax: 5,
  /** 진짜 입질 전 페이크(톡톡) 횟수 */
  nibbleMin: 1,
  nibbleMax: 3,
  nibbleDuration: 0.3,
  gapMin: 0.5,
  gapMax: 1.2,
  /** 찌가 크게 잠긴 뒤 챔질할 수 있는 시간 */
  biteWindow: 0.8,
}

/** 캐스팅 */
export const CAST = {
  /** 이만큼 누르고 있으면 최대 파워 */
  fullPowerHoldSeconds: 1.5,
  minDistance: 4,
  extraDistance: 8,
}

/** 물고기 추첨 가중치 */
export const RARITY_WEIGHTS: Record<Rarity, number> = {
  junk: 8,
  common: 60,
  rare: 24,
  epic: 8,
  legendary: 1,
}

/** 최대 파워로 던졌을 때 가중치 증가 배율 (rare ×2, epic ×3) */
export const CAST_RARITY_BONUS = { rare: 1, epic: 2 }

/** 한 프레임에서 진행시킬 최대 시간(초). 탭 전환 후 큰 delta 방지 */
export const MAX_FRAME_DELTA = 0.1
```

- [ ] **Step 3: 물고기 데이터** — `src/game/data/fish.ts`

```ts
import type { FishSpecies, Rarity } from './types'

export const RARITY_LABEL: Record<Rarity, string> = {
  junk: '잡어',
  common: '일반',
  rare: '희귀',
  epic: '에픽',
  legendary: '전설',
}

export const RARITY_COLOR: Record<Rarity, string> = {
  junk: '#9e9e9e',
  common: '#e0e0e0',
  rare: '#4fc3f7',
  epic: '#ba68c8',
  legendary: '#ffd54f',
}

// 순서가 곧 도감 순서이자 추첨 순서다
export const FISH_SPECIES: FishSpecies[] = [
  // ① 선착장 해변
  { id: 'sleepy-sardine', name: '졸린 정어리', description: '늘 반쯤 감긴 눈. 잡혀도 크게 저항하지 않는다.', zones: ['beach'], rarity: 'common', pattern: 'endurance', strength: 2, weightRange: [0.1, 0.3], basePrice: 10, color: '#90a4ae' },
  { id: 'chatty-mackerel', name: '수다쟁이 전갱이', description: '입을 쉬지 않는다. 가끔 확 튀어 오른다.', zones: ['beach'], rarity: 'common', pattern: 'dasher', strength: 3, weightRange: [0.2, 0.6], basePrice: 14, color: '#80cbc4' },
  { id: 'bubble-puffer', name: '뽀글 복어', description: '놀라면 부풀었다 줄었다, 종잡을 수 없다.', zones: ['beach'], rarity: 'common', pattern: 'erratic', strength: 3, weightRange: [0.3, 0.8], basePrice: 16, color: '#fff176' },
  { id: 'sunglasses-mackerel', name: '선글라스 고등어', description: '바다에서 제일 힙한 녀석. 순간 가속이 엄청나다.', zones: ['beach'], rarity: 'rare', pattern: 'dasher', strength: 4, weightRange: [0.5, 1.5], basePrice: 40, color: '#37474f' },
  // ② 숲속 연못
  { id: 'firefly-minnow', name: '반딧불 송사리', description: '밤마다 꼬리가 깜빡인다.', zones: ['pond'], rarity: 'common', pattern: 'endurance', strength: 2, weightRange: [0.05, 0.2], basePrice: 12, color: '#c6ff00' },
  { id: 'ribbit-catfish', name: '개굴 메기', description: '개구리 소리를 흉내 낸다. 이유는 아무도 모른다.', zones: ['pond'], rarity: 'common', pattern: 'erratic', strength: 3, weightRange: [1, 3], basePrice: 20, color: '#8d6e63' },
  { id: 'rainbow-trout', name: '무지개 송어', description: '비늘이 일곱 빛깔로 반짝인다.', zones: ['pond'], rarity: 'rare', pattern: 'dasher', strength: 5, weightRange: [1, 2.5], basePrice: 45, color: '#f48fb1' },
  { id: 'moss-carp', name: '이끼 거북잉어', description: '등에 이끼가 자랄 만큼 오래 산 잉어. 지치지 않는다.', zones: ['pond'], rarity: 'epic', pattern: 'endurance', strength: 7, weightRange: [3, 6], basePrice: 120, color: '#558b2f' },
  // ③ 암초 앞바다
  { id: 'buff-seabream', name: '근육 도미', description: '매일 파도를 상대로 운동한다.', zones: ['reef'], rarity: 'common', pattern: 'endurance', strength: 4, weightRange: [1, 3], basePrice: 25, color: '#ef9a9a' },
  { id: 'disco-jelly', name: '디스코 해파리', description: '물속에서 혼자 조명을 켜고 춤춘다.', zones: ['reef'], rarity: 'rare', pattern: 'erratic', strength: 5, weightRange: [0.5, 2], basePrice: 60, color: '#e1bee7' },
  { id: 'pirate-tuna', name: '해적 참치', description: '안대를 찼다. 낚싯줄을 노리고 돌진한다.', zones: ['reef'], rarity: 'epic', pattern: 'dasher', strength: 8, weightRange: [10, 30], basePrice: 200, color: '#1a237e' },
  { id: 'thunder-eel', name: '번개 장어', description: '몸에서 찌릿찌릿 전기가 흐른다.', zones: ['reef'], rarity: 'epic', pattern: 'erratic', strength: 8, weightRange: [2, 5], basePrice: 180, color: '#ffee58' },
  // ④ 동굴 지하호수
  { id: 'golden-crown-carp', name: '왕관 쓴 황금 잉어', description: '섬의 전설. 세 가지 얼굴로 낚시꾼을 시험한다.', zones: ['cave'], rarity: 'legendary', pattern: 'mixed', strength: 10, weightRange: [8, 12], basePrice: 1000, color: '#ffc107' },
  // 잡어
  { id: 'lost-anchovy', name: '길 잃은 멸치', description: '무리에서 떨어진 작은 멸치. 어항 먹이로 쓸 수 있다.', zones: ['beach', 'pond', 'reef'], rarity: 'junk', pattern: 'endurance', strength: 1, weightRange: [0.01, 0.05], basePrice: 1, color: '#b0bec5' },
]

export function findSpecies(id: string): FishSpecies | undefined {
  return FISH_SPECIES.find((s) => s.id === id)
}

export function getSpecies(id: string): FishSpecies {
  const species = findSpecies(id)
  if (!species) throw new Error(`알 수 없는 물고기: ${id}`)
  return species
}
```

- [ ] **Step 4: 장비 데이터** — `src/game/data/gear.ts`

```ts
import type { GearSlot } from './types'

export type GearLevelDef = {
  label: string
  /** 0단계는 기본 장비라 0 */
  price: number
  /** line=maxTension, reel=reelSpeed, rod=shockAbsorb */
  value: number
}

export type GearDef = {
  name: string
  description: string
  levels: GearLevelDef[]
}

export const GEAR: Record<GearSlot, GearDef> = {
  line: {
    name: '낚싯줄',
    description: '끊어지기 전까지 버티는 최대 텐션',
    levels: [
      { label: '면 낚싯줄', price: 0, value: 100 },
      { label: '나일론 낚싯줄', price: 150, value: 140 },
      { label: '강철 낚싯줄', price: 450, value: 190 },
    ],
  },
  reel: {
    name: '릴',
    description: '감는 속도',
    levels: [
      { label: '나무 릴', price: 0, value: 8 },
      { label: '스피닝 릴', price: 120, value: 11 },
      { label: '전동 릴', price: 400, value: 15 },
    ],
  },
  rod: {
    name: '낚싯대',
    description: '물고기가 확 당길 때 텐션이 치솟는 정도를 줄여 준다',
    levels: [
      { label: '대나무 낚싯대', price: 0, value: 1 },
      { label: '카본 낚싯대', price: 120, value: 0.75 },
      { label: '티타늄 낚싯대', price: 400, value: 0.55 },
    ],
  },
}
```

- [ ] **Step 5: 구역·낚시 포인트 데이터** — `src/game/data/zones.ts`

```ts
import type { ZoneId } from './types'

export const ISLAND_RADIUS = 30
/** 해변(z > FENCE_Z)과 나머지 구역을 나누는 울타리의 z 좌표 */
export const FENCE_Z = 5
/** 바다 수면 높이 (섬 윗면은 y = 0) */
export const WATER_Y = -0.3
/** 연못·동굴 호수처럼 섬 위에 있는 물의 수면 높이 */
export const INLAND_WATER_Y = 0.03

export type ZoneDef = {
  id: ZoneId
  name: string
  color: string
  /** 잠겨 있을 때 문 위에 보여 줄 안내 */
  unlockLabel: string
  /** 울타리에서 이 구역으로 들어가는 문의 x 범위. 해변은 null */
  gate: { xFrom: number; xTo: number } | null
}

export const ZONES: ZoneDef[] = [
  { id: 'beach', name: '선착장 해변', color: '#e9d8a6', unlockLabel: '', gate: null },
  { id: 'pond', name: '숲속 연못', color: '#81c784', unlockLabel: '무너진 다리를 고쳐야 해요', gate: { xFrom: -18, xTo: -10 } },
  { id: 'cave', name: '동굴 지하호수', color: '#5d4037', unlockLabel: '바위로 막혀 있어요', gate: { xFrom: -4, xTo: 4 } },
  { id: 'reef', name: '암초 앞바다', color: '#4fc3f7', unlockLabel: '부서진 보트를 고쳐야 해요', gate: { xFrom: 10, xTo: 18 } },
]

export type FishingSpot = {
  id: string
  zone: ZoneId
  /** 서는 위치 [x, z] */
  position: [number, number]
  /** 물 쪽을 향하는 단위 방향 [dx, dz] */
  facing: [number, number]
  /** 찌가 떠 있을 수면 높이 */
  surfaceY: number
}

export const FISHING_SPOTS: FishingSpot[] = [
  { id: 'beach-dock', zone: 'beach', position: [0, 27], facing: [0, 1], surfaceY: WATER_Y },
  { id: 'beach-rocks', zone: 'beach', position: [-19, 21], facing: [-0.67, 0.74], surfaceY: WATER_Y },
  { id: 'pond-edge', zone: 'pond', position: [-15, -6.5], facing: [0, -1], surfaceY: INLAND_WATER_Y },
  { id: 'reef-cliff', zone: 'reef', position: [22, -17], facing: [0.79, -0.61], surfaceY: WATER_Y },
  { id: 'cave-lake', zone: 'cave', position: [0, -19], facing: [0, -1], surfaceY: INLAND_WATER_Y },
]

export function getSpot(id: string): FishingSpot {
  const spot = FISHING_SPOTS.find((s) => s.id === id)
  if (!spot) throw new Error(`알 수 없는 낚시 포인트: ${id}`)
  return spot
}
```

- [ ] **Step 6: 실패하는 테스트 작성** — `src/game/logic/catchTable.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { catchWeights, rollSpecies, rollWeight } from './catchTable'
import { castDistance, castPowerFromHold } from './cast'
import { fixedRng } from './rng'
import { getSpecies } from '../data/fish'

describe('rollSpecies', () => {
  it('rng가 0이면 그 구역 목록의 첫 물고기가 나온다', () => {
    expect(rollSpecies('beach', 0, fixedRng(0)).id).toBe('sleepy-sardine')
  })

  it('동굴에서는 항상 전설의 물고기가 나온다', () => {
    for (const v of [0, 0.5, 0.99]) {
      expect(rollSpecies('cave', 0.5, fixedRng(v)).rarity).toBe('legendary')
    }
  })

  it('멀리 던질수록 에픽이 나올 확률이 올라간다', () => {
    const epicShare = (power: number) => {
      const table = catchWeights('reef', power)
      const total = table.reduce((sum, e) => sum + e.weight, 0)
      const epic = table.filter((e) => e.species.rarity === 'epic').reduce((sum, e) => sum + e.weight, 0)
      return epic / total
    }
    expect(epicShare(1)).toBeGreaterThan(epicShare(0))
  })
})

describe('rollWeight', () => {
  it('무게는 종의 무게 범위 안에서 나온다', () => {
    const sardine = getSpecies('sleepy-sardine')
    expect(rollWeight(sardine, fixedRng(0))).toBe(0.1)
    const heavy = rollWeight(sardine, fixedRng(0.999))
    expect(heavy).toBeGreaterThan(0.29)
    expect(heavy).toBeLessThanOrEqual(0.3)
  })
})

describe('cast', () => {
  it('누른 시간에 비례해 파워가 0~1로 정해진다', () => {
    expect(castPowerFromHold(0)).toBe(0)
    expect(castPowerFromHold(0.75)).toBe(0.5)
    expect(castPowerFromHold(10)).toBe(1)
  })

  it('파워에 따라 찌가 떨어지는 거리가 4~12가 된다', () => {
    expect(castDistance(0)).toBe(4)
    expect(castDistance(1)).toBe(12)
  })
})
```

- [ ] **Step 7: 테스트 실패 확인**

Run: `npx vitest run src/game/logic/catchTable.test.ts`
Expected: FAIL — `./catchTable` 등을 찾을 수 없음

- [ ] **Step 8: 구현** — `src/game/logic/rng.ts`

```ts
/** 0 이상 1 미만의 수를 돌려주는 난수 함수. 테스트에서는 고정값을 넣는다 */
export type Rng = () => number

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function lerpRange([min, max]: [number, number], t: number): number {
  return lerp(min, max, t)
}

export function fixedRng(value: number): Rng {
  return () => value
}
```

`src/game/logic/cast.ts`

```ts
import { CAST } from '../data/balance'

export function castPowerFromHold(seconds: number): number {
  return Math.min(1, Math.max(0, seconds / CAST.fullPowerHoldSeconds))
}

export function castDistance(power: number): number {
  return CAST.minDistance + CAST.extraDistance * power
}
```

`src/game/logic/catchTable.ts`

```ts
import { CAST_RARITY_BONUS, RARITY_WEIGHTS } from '../data/balance'
import { FISH_SPECIES } from '../data/fish'
import type { FishSpecies, Rarity, ZoneId } from '../data/types'
import { lerpRange, type Rng } from './rng'

export type CatchEntry = { species: FishSpecies; weight: number }

export function catchWeights(zone: ZoneId, castPower: number): CatchEntry[] {
  return FISH_SPECIES.filter((s) => s.zones.includes(zone)).map((species) => ({
    species,
    weight: rarityWeight(species.rarity, castPower),
  }))
}

function rarityWeight(rarity: Rarity, castPower: number): number {
  const base = RARITY_WEIGHTS[rarity]
  if (rarity === 'rare') return base * (1 + CAST_RARITY_BONUS.rare * castPower)
  if (rarity === 'epic') return base * (1 + CAST_RARITY_BONUS.epic * castPower)
  return base
}

export function rollSpecies(zone: ZoneId, castPower: number, rng: Rng): FishSpecies {
  const table = catchWeights(zone, castPower)
  if (table.length === 0) throw new Error(`물고기가 없는 구역: ${zone}`)
  const total = table.reduce((sum, e) => sum + e.weight, 0)
  let r = rng() * total
  for (const entry of table) {
    if (r < entry.weight) return entry.species
    r -= entry.weight
  }
  return table[table.length - 1].species
}

/** 소수 둘째 자리(kg)까지 */
export function rollWeight(species: FishSpecies, rng: Rng): number {
  return Math.round(lerpRange(species.weightRange, rng()) * 100) / 100
}
```

- [ ] **Step 9: 테스트 통과 확인**

Run: `npx vitest run src/game/logic/catchTable.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 10: 커밋**

```bash
git add src/game/data src/game/logic
git commit -m "feat: 게임 데이터와 물고기 추첨 로직 추가"
```

---

### Task 3: 입질 로직

**Files:**
- Create: `src/game/logic/bite.ts`
- Test: `src/game/logic/bite.test.ts`

**Interfaces:**
- Consumes: `BITE`, `Rng`, `lerp`, `fixedRng`
- Produces: `BitePhase`, `BiteState`, `createBite(rng): BiteState`, `stepBite(state, dt, rng): BiteState`, `hook(state): BiteState`

동작: `waiting`(대기) → `nibble`(페이크, 0.3초) → `waiting`(간격) → … 페이크를 다 쓰면 `bite`(챔질 가능 0.8초) → 시간 초과 시 `missed`. 대기·페이크 중에 챔질하면 `missed`, `bite` 중에 챔질하면 `hooked`.

- [ ] **Step 1: 실패하는 테스트 작성** — `src/game/logic/bite.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { createBite, hook, stepBite } from './bite'
import { fixedRng } from './rng'

const rng = fixedRng(0)

describe('bite', () => {
  it('rng가 0이면 2초 대기, 페이크 1번으로 시작한다', () => {
    expect(createBite(rng)).toEqual({ phase: 'waiting', timer: 2, nibblesLeft: 1 })
  })

  it('대기 → 페이크 → 대기 → 진짜 입질 순서로 진행된다', () => {
    let s = createBite(rng)
    s = stepBite(s, 2, rng)
    expect(s.phase).toBe('nibble')
    s = stepBite(s, 0.3, rng)
    expect(s.phase).toBe('waiting')
    s = stepBite(s, 0.5, rng)
    expect(s.phase).toBe('bite')
  })

  it('진짜 입질 때 챔질하면 걸린다', () => {
    let s = createBite(rng)
    s = stepBite(s, 2, rng)
    s = stepBite(s, 0.3, rng)
    s = stepBite(s, 0.5, rng)
    expect(hook(s).phase).toBe('hooked')
  })

  it('페이크에 속아 챔질하면 놓친다', () => {
    let s = createBite(rng)
    s = stepBite(s, 2, rng)
    expect(s.phase).toBe('nibble')
    expect(hook(s).phase).toBe('missed')
  })

  it('입질 전에 챔질해도 놓친다', () => {
    expect(hook(createBite(rng)).phase).toBe('missed')
  })

  it('진짜 입질을 그냥 보내면 놓친다', () => {
    let s = createBite(rng)
    s = stepBite(s, 2, rng)
    s = stepBite(s, 0.3, rng)
    s = stepBite(s, 0.5, rng)
    s = stepBite(s, 0.8, rng)
    expect(s.phase).toBe('missed')
  })

  it('끝난 상태는 더 진행되지 않는다', () => {
    const missed = hook(createBite(rng))
    expect(stepBite(missed, 10, rng)).toBe(missed)
    expect(hook(missed)).toBe(missed)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/game/logic/bite.test.ts`
Expected: FAIL — `./bite` 없음

- [ ] **Step 3: 구현** — `src/game/logic/bite.ts`

```ts
import { BITE } from '../data/balance'
import { lerp, type Rng } from './rng'

export type BitePhase = 'waiting' | 'nibble' | 'bite' | 'missed' | 'hooked'

export type BiteState = {
  phase: BitePhase
  /** 현재 단계가 끝날 때까지 남은 시간(초) */
  timer: number
  /** 진짜 입질 전에 남은 페이크 횟수 */
  nibblesLeft: number
}

export function createBite(rng: Rng): BiteState {
  return {
    phase: 'waiting',
    timer: lerp(BITE.waitMin, BITE.waitMax, rng()),
    nibblesLeft: Math.floor(lerp(BITE.nibbleMin, BITE.nibbleMax + 1, rng())),
  }
}

export function stepBite(state: BiteState, dt: number, rng: Rng): BiteState {
  if (state.phase === 'missed' || state.phase === 'hooked') return state
  const timer = state.timer - dt
  if (timer > 0) return { ...state, timer }

  switch (state.phase) {
    case 'waiting':
      if (state.nibblesLeft > 0) {
        return { phase: 'nibble', timer: BITE.nibbleDuration, nibblesLeft: state.nibblesLeft - 1 }
      }
      return { ...state, phase: 'bite', timer: BITE.biteWindow }
    case 'nibble':
      return { ...state, phase: 'waiting', timer: lerp(BITE.gapMin, BITE.gapMax, rng()) }
    case 'bite':
      return { ...state, phase: 'missed', timer: 0 }
  }
}

/** 챔질(클릭). 진짜 입질일 때만 성공 */
export function hook(state: BiteState): BiteState {
  if (state.phase === 'bite') return { ...state, phase: 'hooked' }
  if (state.phase === 'waiting' || state.phase === 'nibble') return { ...state, phase: 'missed' }
  return state
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/game/logic/bite.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/game/logic/bite.ts src/game/logic/bite.test.ts
git commit -m "feat: 입질 타이밍 로직 추가"
```

---

### Task 4: 텐션 줄다리기 로직

**Files:**
- Create: `src/game/logic/fight.ts`
- Test: `src/game/logic/fight.test.ts`

**Interfaces:**
- Consumes: `FIGHT`, `PATTERNS`, `GearStats`, `FightPattern`, `BasicPattern`, `Rng`, `lerpRange`
- Produces:
  - `FightOutcome = 'fighting' | 'caught' | 'snapped' | 'escaped'`
  - `FightMods = { reelSpeedMul: number; tensionMul: number }`, `DEFAULT_MODS` (1차-B에서 버프·약화 상태에 사용)
  - `Pull = { active: boolean; timer: number; intensity: number; pattern: BasicPattern }`
  - `FightState = { strength, pattern, gear: GearStats, mods: FightMods, distance, tension, slackTime, elapsed, pull: Pull, outcome: FightOutcome }`
  - `createFight(fish: { strength: number; pattern: FightPattern }, gear, rng, mods?): FightState`
  - `stepFight(state, input: { reeling: boolean }, dt, rng): FightState`
  - `activePattern(state): BasicPattern`

- [ ] **Step 1: 실패하는 테스트 작성** — `src/game/logic/fight.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { activePattern, createFight, stepFight, type FightState } from './fight'
import { fixedRng } from './rng'
import type { GearStats } from '../data/types'

const rng = fixedRng(0.5)
const GEAR_LV1: GearStats = { maxTension: 100, reelSpeed: 8, shockAbsorb: 1 }
const weakFish = { strength: 1, pattern: 'endurance' as const }

/** 결과가 날 때까지 0.05초씩 진행 */
function runUntilDone(state: FightState, reeling: boolean): FightState {
  let s = state
  for (let i = 0; i < 4000 && s.outcome === 'fighting'; i++) {
    s = stepFight(s, { reeling }, 0.05, rng)
  }
  return s
}

describe('stepFight', () => {
  it('계속 감기만 하면 줄이 끊긴다', () => {
    const end = runUntilDone(createFight(weakFish, GEAR_LV1, rng), true)
    expect(end.outcome).toBe('snapped')
  })

  it('아무것도 안 하면 바늘이 빠져 도망간다', () => {
    const end = runUntilDone(createFight(weakFish, GEAR_LV1, rng), false)
    expect(end.outcome).toBe('escaped')
  })

  it('낚싯줄 단계가 높으면 더 오래 버틴다', () => {
    const lv1 = runUntilDone(createFight(weakFish, GEAR_LV1, rng), true)
    const lv3 = runUntilDone(createFight(weakFish, { ...GEAR_LV1, maxTension: 190 }, rng), true)
    expect(lv3.outcome).toBe('snapped')
    expect(lv3.elapsed).toBeGreaterThan(lv1.elapsed)
  })

  it('거리가 0이 되면 잡힌다', () => {
    const near: FightState = {
      ...createFight(weakFish, GEAR_LV1, rng),
      distance: 0.1,
      pull: { active: false, timer: 10, intensity: 0, pattern: 'endurance' },
    }
    expect(stepFight(near, { reeling: true }, 0.05, rng).outcome).toBe('caught')
  })

  it('힘센 물고기가 당기면 손을 떼고 있어도 텐션이 오른다', () => {
    const pulling: FightState = {
      ...createFight({ strength: 10, pattern: 'dasher' }, GEAR_LV1, rng),
      tension: 30,
      pull: { active: true, timer: 1, intensity: 1.6, pattern: 'dasher' },
    }
    expect(stepFight(pulling, { reeling: false }, 0.1, rng).tension).toBeGreaterThan(30)
  })

  it('좋은 낚싯대는 당김 충격을 줄인다', () => {
    const pull = { active: true, timer: 1, intensity: 1.6, pattern: 'dasher' as const }
    const rod1: FightState = { ...createFight({ strength: 10, pattern: 'dasher' }, GEAR_LV1, rng), tension: 30, pull }
    const rod3: FightState = { ...createFight({ strength: 10, pattern: 'dasher' }, { ...GEAR_LV1, shockAbsorb: 0.55 }, rng), tension: 30, pull }
    const t1 = stepFight(rod1, { reeling: false }, 0.1, rng).tension
    const t3 = stepFight(rod3, { reeling: false }, 0.1, rng).tension
    expect(t3).toBeLessThan(t1)
  })

  it('dt가 아무리 커도 한 번에 0.1초까지만 진행한다 (탭 전환 대비)', () => {
    const s = stepFight(createFight(weakFish, GEAR_LV1, rng), { reeling: true }, 5, rng)
    expect(s.elapsed).toBeCloseTo(0.1)
    expect(s.outcome).toBe('fighting')
  })

  it('끝난 싸움은 더 진행되지 않는다', () => {
    const done: FightState = { ...createFight(weakFish, GEAR_LV1, rng), outcome: 'snapped' }
    expect(stepFight(done, { reeling: true }, 0.05, rng)).toBe(done)
  })
})

describe('activePattern', () => {
  it('전설(mixed)은 남은 거리에 따라 돌진 → 지구전 → 변덕으로 바뀐다', () => {
    const base = createFight({ strength: 10, pattern: 'mixed' }, GEAR_LV1, rng)
    expect(activePattern({ ...base, distance: 60 })).toBe('dasher')
    expect(activePattern({ ...base, distance: 30 })).toBe('endurance')
    expect(activePattern({ ...base, distance: 10 })).toBe('erratic')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/game/logic/fight.test.ts`
Expected: FAIL — `./fight` 없음

- [ ] **Step 3: 구현** — `src/game/logic/fight.ts`

```ts
import { FIGHT, PATTERNS } from '../data/balance'
import type { BasicPattern, FightPattern, GearStats } from '../data/types'
import { lerpRange, type Rng } from './rng'

export type FightOutcome = 'fighting' | 'caught' | 'snapped' | 'escaped'

/** 요리 버프·체력 약화처럼 싸움에 곱해지는 보정값 (1차-B에서 사용) */
export type FightMods = { reelSpeedMul: number; tensionMul: number }
export const DEFAULT_MODS: FightMods = { reelSpeedMul: 1, tensionMul: 1 }

/** 물고기의 당김. active가 false면 timer는 다음 당김까지 남은 시간 */
export type Pull = { active: boolean; timer: number; intensity: number; pattern: BasicPattern }

export type FightState = {
  strength: number
  pattern: FightPattern
  gear: GearStats
  mods: FightMods
  distance: number
  tension: number
  /** 텐션이 너무 낮은 상태가 이어진 시간 */
  slackTime: number
  elapsed: number
  pull: Pull
  outcome: FightOutcome
}

export function createFight(
  fish: { strength: number; pattern: FightPattern },
  gear: GearStats,
  rng: Rng,
  mods: FightMods = DEFAULT_MODS,
): FightState {
  const state: FightState = {
    strength: fish.strength,
    pattern: fish.pattern,
    gear,
    mods,
    distance: FIGHT.startDistance,
    tension: FIGHT.startTension,
    slackTime: 0,
    elapsed: 0,
    pull: { active: false, timer: 0, intensity: 0, pattern: 'endurance' },
    outcome: 'fighting',
  }
  return { ...state, pull: scheduleNextPull(state, rng) }
}

/** 전설(mixed)은 남은 거리에 따라 패턴을 바꾼다 */
export function activePattern(state: FightState): BasicPattern {
  if (state.pattern !== 'mixed') return state.pattern
  const progress = state.distance / FIGHT.startDistance
  if (progress > 0.66) return 'dasher'
  if (progress > 0.33) return 'endurance'
  return 'erratic'
}

function scheduleNextPull(state: FightState, rng: Rng): Pull {
  const pattern = activePattern(state)
  return { active: false, timer: lerpRange(PATTERNS[pattern].interval, rng()), intensity: 0, pattern }
}

function startPull(state: FightState, rng: Rng): Pull {
  const config = PATTERNS[state.pull.pattern]
  return {
    active: true,
    timer: lerpRange(config.duration, rng()),
    intensity: lerpRange(config.intensity, rng()),
    pattern: state.pull.pattern,
  }
}

export function stepFight(state: FightState, input: { reeling: boolean }, rawDt: number, rng: Rng): FightState {
  if (state.outcome !== 'fighting') return state
  const dt = Math.min(rawDt, FIGHT.maxDt)
  const { gear, mods, pull, strength } = state

  const pullRate = pull.active
    ? strength * FIGHT.pullTensionPerStrength * pull.intensity * gear.shockAbsorb * mods.tensionMul
    : 0

  let tension = state.tension
  let distance = state.distance
  if (input.reeling) {
    tension += (FIGHT.reelTensionRate + pullRate) * dt
    distance -= gear.reelSpeed * mods.reelSpeedMul * (pull.active ? FIGHT.reelDuringPullFactor : 1) * dt
  } else {
    tension += (pullRate - FIGHT.relaxRate) * dt
    distance += (pull.active ? strength * FIGHT.pullDistancePerStrength * pull.intensity : FIGHT.driftSpeed) * dt
  }
  tension = Math.max(0, tension)
  distance = Math.max(0, distance)
  const slackTime = tension < FIGHT.slackThreshold ? state.slackTime + dt : 0

  const next: FightState = {
    ...state,
    tension,
    distance,
    slackTime,
    elapsed: state.elapsed + dt,
    pull: { ...pull, timer: pull.timer - dt },
  }
  if (next.pull.timer <= 0) {
    next.pull = pull.active ? scheduleNextPull(next, rng) : startPull(next, rng)
  }

  if (tension > gear.maxTension) next.outcome = 'snapped'
  else if (distance <= 0) next.outcome = 'caught'
  else if (distance >= FIGHT.escapeDistance || slackTime >= FIGHT.slackEscapeTime) next.outcome = 'escaped'
  return next
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/game/logic/fight.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/game/logic/fight.ts src/game/logic/fight.test.ts
git commit -m "feat: 텐션 줄다리기 로직 추가"
```

---

### Task 5: 낚시 한 판 흐름 (캐스팅 → 입질 → 싸움 → 결과)

**Files:**
- Create: `src/game/logic/fishingSession.ts`
- Test: `src/game/logic/fishingSession.test.ts`

**Interfaces:**
- Consumes: `castPowerFromHold`, `rollSpecies`, `rollWeight`, `createBite`, `stepBite`, `hook`, `BiteState`, `createFight`, `stepFight`, `FightState`, `FightMods`, `getSpecies`
- Produces:
  - `FishingResult = 'caught' | 'snapped' | 'escaped' | 'missed'`
  - `FishingState` (stage: `'aiming' | 'waiting' | 'fighting' | 'done'`, 아래 코드 참고)
  - `FishingInput = { pointerDown: boolean; pressed: boolean }` (pressed = 이번 프레임에 새로 눌림)
  - `FishingContext = { zone: ZoneId; gear: GearStats; mods?: FightMods; rng: Rng }`
  - `startFishing(): FishingState`, `stepFishing(state, input, dt, ctx): FishingState`

- [ ] **Step 1: 실패하는 테스트 작성** — `src/game/logic/fishingSession.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { startFishing, stepFishing, type FishingContext, type FishingState } from './fishingSession'
import { fixedRng } from './rng'

const ctx: FishingContext = {
  zone: 'beach',
  gear: { maxTension: 100, reelSpeed: 8, shockAbsorb: 1 },
  rng: fixedRng(0),
}
const idle = { pointerDown: false, pressed: false }
const hold = { pointerDown: true, pressed: false }
const click = { pointerDown: true, pressed: true }

/** 1.5초 누르고 떼서 최대 파워로 던진 상태 */
function cast(): FishingState {
  let s = startFishing()
  s = stepFishing(s, click, 0.75, ctx)
  s = stepFishing(s, hold, 0.75, ctx)
  return stepFishing(s, idle, 0.016, ctx)
}

/** 던진 뒤 진짜 입질 직전까지 진행 (rng 0: 대기 2초, 페이크 1번, 간격 0.5초) */
function untilBite(): FishingState {
  let s = cast()
  s = stepFishing(s, idle, 2, ctx)
  s = stepFishing(s, idle, 0.3, ctx)
  return stepFishing(s, idle, 0.5, ctx)
}

describe('stepFishing', () => {
  it('누르고 있다가 떼면 던져지고, 물고기가 미리 정해진다', () => {
    const s = cast()
    expect(s.stage).toBe('waiting')
    if (s.stage !== 'waiting') return
    expect(s.castPower).toBe(1)
    expect(s.speciesId).toBe('sleepy-sardine')
  })

  it('누르지 않으면 던지지 않는다', () => {
    const s = startFishing()
    expect(stepFishing(s, idle, 1, ctx)).toBe(s)
  })

  it('입질 전에 클릭하면 놓친다', () => {
    let s = cast()
    s = stepFishing(s, idle, 1, ctx)
    s = stepFishing(s, click, 0.01, ctx)
    expect(s).toMatchObject({ stage: 'done', result: 'missed' })
  })

  it('진짜 입질 때 클릭하면 싸움이 시작되고 무게가 정해진다', () => {
    const s = stepFishing(untilBite(), click, 0.01, ctx)
    expect(s.stage).toBe('fighting')
    if (s.stage !== 'fighting') return
    expect(s.weight).toBe(0.1)
  })

  it('싸움 중 계속 감기만 하면 줄이 끊겨 끝난다', () => {
    let s = stepFishing(untilBite(), click, 0.01, ctx)
    for (let i = 0; i < 2000 && s.stage === 'fighting'; i++) s = stepFishing(s, hold, 0.05, ctx)
    expect(s).toMatchObject({ stage: 'done', result: 'snapped', speciesId: 'sleepy-sardine' })
  })

  it('끝난 상태는 그대로 유지된다', () => {
    let s = cast()
    s = stepFishing(s, click, 0.01, ctx)
    expect(stepFishing(s, click, 1, ctx)).toBe(s)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/game/logic/fishingSession.test.ts`
Expected: FAIL — `./fishingSession` 없음

- [ ] **Step 3: 구현** — `src/game/logic/fishingSession.ts`

```ts
import { getSpecies } from '../data/fish'
import type { GearStats, ZoneId } from '../data/types'
import { createBite, hook, stepBite, type BiteState } from './bite'
import { castPowerFromHold } from './cast'
import { rollSpecies, rollWeight } from './catchTable'
import { createFight, stepFight, type FightMods, type FightState } from './fight'
import type { Rng } from './rng'

export type FishingResult = 'caught' | 'snapped' | 'escaped' | 'missed'

export type FishingState =
  | { stage: 'aiming'; holding: boolean; holdTime: number }
  | { stage: 'waiting'; castPower: number; speciesId: string; bite: BiteState }
  | { stage: 'fighting'; castPower: number; speciesId: string; weight: number; fight: FightState }
  | { stage: 'done'; result: 'missed'; castPower: number }
  | { stage: 'done'; result: 'caught' | 'snapped' | 'escaped'; castPower: number; speciesId: string; weight: number }

export type FishingInput = {
  /** 마우스를 누르고 있는지 */
  pointerDown: boolean
  /** 이번 프레임에 새로 눌렀는지 (챔질) */
  pressed: boolean
}

export type FishingContext = { zone: ZoneId; gear: GearStats; mods?: FightMods; rng: Rng }

export function startFishing(): FishingState {
  return { stage: 'aiming', holding: false, holdTime: 0 }
}

export function stepFishing(state: FishingState, input: FishingInput, dt: number, ctx: FishingContext): FishingState {
  switch (state.stage) {
    case 'aiming': {
      if (input.pointerDown) return { stage: 'aiming', holding: true, holdTime: state.holdTime + dt }
      if (!state.holding) return state
      // 손을 뗀 순간 던진다. 어떤 물고기가 올지는 이때 정해진다
      const castPower = castPowerFromHold(state.holdTime)
      const species = rollSpecies(ctx.zone, castPower, ctx.rng)
      return { stage: 'waiting', castPower, speciesId: species.id, bite: createBite(ctx.rng) }
    }
    case 'waiting': {
      let bite = stepBite(state.bite, dt, ctx.rng)
      if (input.pressed) bite = hook(bite)
      if (bite.phase === 'missed') return { stage: 'done', result: 'missed', castPower: state.castPower }
      if (bite.phase === 'hooked') {
        const species = getSpecies(state.speciesId)
        return {
          stage: 'fighting',
          castPower: state.castPower,
          speciesId: state.speciesId,
          weight: rollWeight(species, ctx.rng),
          fight: createFight(species, ctx.gear, ctx.rng, ctx.mods),
        }
      }
      return { ...state, bite }
    }
    case 'fighting': {
      const fight = stepFight(state.fight, { reeling: input.pointerDown }, dt, ctx.rng)
      if (fight.outcome === 'fighting') return { ...state, fight }
      return {
        stage: 'done',
        result: fight.outcome,
        castPower: state.castPower,
        speciesId: state.speciesId,
        weight: state.weight,
      }
    }
    case 'done':
      return state
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/game/logic/fishingSession.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/game/logic/fishingSession.ts src/game/logic/fishingSession.test.ts
git commit -m "feat: 낚시 한 판 흐름 로직 추가"
```

---

### Task 6: 판매가와 장비 업그레이드 계산

**Files:**
- Create: `src/game/logic/economy.ts`
- Test: `src/game/logic/economy.test.ts`

**Interfaces:**
- Consumes: `GEAR`, `FishSpecies`, `GearLevels`, `GearSlot`, `GearStats`
- Produces:
  - `sellPrice(species, weight): number` (최소 1)
  - `gearStats(levels): GearStats`
  - `gearUpgradeCost(slot, currentLevel): number | null` (최고 단계면 null)
  - `BuyResult = { ok: true; coins: number; levels: GearLevels } | { ok: false; reason: 'max' | 'coins' }`
  - `buyGearUpgrade(coins, levels, slot): BuyResult`

- [ ] **Step 1: 실패하는 테스트 작성** — `src/game/logic/economy.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { buyGearUpgrade, gearStats, gearUpgradeCost, sellPrice } from './economy'
import { getSpecies } from '../data/fish'
import type { GearLevels } from '../data/types'

const START: GearLevels = { line: 0, reel: 0, rod: 0 }

describe('sellPrice', () => {
  const tuna = getSpecies('pirate-tuna') // 10~30kg, 기본가 200

  it('중간 무게면 기본가', () => {
    expect(sellPrice(tuna, 20)).toBe(200)
  })

  it('무거울수록 비싸다', () => {
    expect(sellPrice(tuna, 30)).toBeGreaterThan(sellPrice(tuna, 10))
  })

  it('아무리 작아도 1코인은 받는다', () => {
    expect(sellPrice(getSpecies('lost-anchovy'), 0.01)).toBe(1)
  })
})

describe('gearStats', () => {
  it('기본 장비 능력치', () => {
    expect(gearStats(START)).toEqual({ maxTension: 100, reelSpeed: 8, shockAbsorb: 1 })
  })
})

describe('buyGearUpgrade', () => {
  it('다음 단계 가격을 알려 주고, 최고 단계면 null', () => {
    expect(gearUpgradeCost('line', 0)).toBe(150)
    expect(gearUpgradeCost('line', 2)).toBeNull()
  })

  it('코인이 가격과 딱 같으면 살 수 있다', () => {
    const r = buyGearUpgrade(150, START, 'line')
    expect(r).toEqual({ ok: true, coins: 0, levels: { line: 1, reel: 0, rod: 0 } })
  })

  it('코인이 모자라면 살 수 없다', () => {
    expect(buyGearUpgrade(149, START, 'line')).toEqual({ ok: false, reason: 'coins' })
  })

  it('최고 단계면 코인이 많아도 살 수 없다', () => {
    expect(buyGearUpgrade(99999, { ...START, line: 2 }, 'line')).toEqual({ ok: false, reason: 'max' })
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/game/logic/economy.test.ts`
Expected: FAIL — `./economy` 없음

- [ ] **Step 3: 구현** — `src/game/logic/economy.ts`

```ts
import { GEAR } from '../data/gear'
import type { FishSpecies, GearLevels, GearSlot, GearStats } from '../data/types'

/** 판매가는 무게에 비례한다. 범위 중간 무게일 때 basePrice */
export function sellPrice(species: FishSpecies, weight: number): number {
  const [min, max] = species.weightRange
  const mid = (min + max) / 2
  return Math.max(1, Math.round((species.basePrice * weight) / mid))
}

export function gearStats(levels: GearLevels): GearStats {
  return {
    maxTension: GEAR.line.levels[levels.line].value,
    reelSpeed: GEAR.reel.levels[levels.reel].value,
    shockAbsorb: GEAR.rod.levels[levels.rod].value,
  }
}

export function gearUpgradeCost(slot: GearSlot, currentLevel: number): number | null {
  const next = GEAR[slot].levels[currentLevel + 1]
  return next ? next.price : null
}

export type BuyResult = { ok: true; coins: number; levels: GearLevels } | { ok: false; reason: 'max' | 'coins' }

export function buyGearUpgrade(coins: number, levels: GearLevels, slot: GearSlot): BuyResult {
  const cost = gearUpgradeCost(slot, levels[slot])
  if (cost === null) return { ok: false, reason: 'max' }
  if (coins < cost) return { ok: false, reason: 'coins' }
  return { ok: true, coins: coins - cost, levels: { ...levels, [slot]: levels[slot] + 1 } }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/game/logic/economy.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/game/logic/economy.ts src/game/logic/economy.test.ts
git commit -m "feat: 판매가와 장비 업그레이드 계산 추가"
```

---

### Task 7: 상태 저장소 (진행 상황 / 세션 / 낚시)

**Files:**
- Create: `src/game/logic/id.ts`, `src/game/logic/interaction.ts`
- Create: `src/game/stores/progressStore.ts`, `src/game/stores/sessionStore.ts`, `src/game/stores/fishingStore.ts`
- Test: `src/game/stores/progressStore.test.ts`, `src/game/logic/interaction.test.ts`

**Interfaces:**
- Consumes: `sellPrice`, `buyGearUpgrade`, `findSpecies`, `startFishing`, `FishingState`, `FishInstance`, `GearLevels`, `GearSlot`
- Produces:
  - `makeId(): string`
  - `Mode = 'explore' | 'fishing' | 'sell' | 'shop' | 'dex' | 'menu'`
  - `Interactable = { kind: 'fishingSpot'; spotId: string } | { kind: 'sellBox' } | { kind: 'gearShop' }`
  - `isSameInteractable(a: Interactable | null, b: Interactable): boolean`
  - `SAVE_KEY = 'fishing-island-save-v1'`, `INITIAL_PROGRESS`, `DexEntry = { count: number; maxWeight: number }`
  - `useProgressStore`: `coins, gear, inventory, dex, playTime, addPlayTime(dt), addCatch(speciesId, weight): FishInstance, sellFish(ids): number, buyGear(slot): boolean, resetProgress()`
  - `useSessionStore`: `mode, nearby, setMode(mode), setNearby(target), clearNearby(target), resetSession()`
  - `useFishingStore`: `spotId, state, caught, begin(spotId), update(state, caught?), end()`

- [ ] **Step 1: 실패하는 테스트 작성** — `src/game/logic/interaction.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { isSameInteractable } from './interaction'

describe('isSameInteractable', () => {
  it('같은 낚시 포인트면 true, 다른 포인트면 false', () => {
    const a = { kind: 'fishingSpot' as const, spotId: 'beach-dock' }
    expect(isSameInteractable(a, { kind: 'fishingSpot', spotId: 'beach-dock' })).toBe(true)
    expect(isSameInteractable(a, { kind: 'fishingSpot', spotId: 'beach-rocks' })).toBe(false)
  })

  it('종류가 다르거나 비어 있으면 false', () => {
    expect(isSameInteractable({ kind: 'sellBox' }, { kind: 'gearShop' })).toBe(false)
    expect(isSameInteractable(null, { kind: 'sellBox' })).toBe(false)
    expect(isSameInteractable({ kind: 'sellBox' }, { kind: 'sellBox' })).toBe(true)
  })
})
```

`src/game/stores/progressStore.test.ts`

```ts
// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { INITIAL_PROGRESS, SAVE_KEY, useProgressStore } from './progressStore'

const store = () => useProgressStore.getState()

beforeEach(() => {
  localStorage.clear()
  useProgressStore.setState({ ...INITIAL_PROGRESS })
})

describe('progressStore', () => {
  it('물고기를 잡으면 보관함과 도감에 들어간다', () => {
    store().addCatch('sleepy-sardine', 0.2)
    store().addCatch('sleepy-sardine', 0.25)
    expect(store().inventory).toHaveLength(2)
    expect(store().dex['sleepy-sardine']).toEqual({ count: 2, maxWeight: 0.25 })
  })

  it('팔면 보관함에서 빠지고 코인이 오른다', () => {
    const fish = store().addCatch('pirate-tuna', 20)
    const earned = store().sellFish([fish.id])
    expect(earned).toBe(200)
    expect(store().coins).toBe(200)
    expect(store().inventory).toHaveLength(0)
    expect(store().dex['pirate-tuna'].count).toBe(1)
  })

  it('빈 보관함이나 없는 id를 팔면 아무 일도 없다', () => {
    expect(store().sellFish([])).toBe(0)
    expect(store().sellFish(['no-such-id'])).toBe(0)
    expect(store().coins).toBe(0)
  })

  it('코인이 있으면 장비를 사고, 없으면 실패한다', () => {
    expect(store().buyGear('line')).toBe(false)
    useProgressStore.setState({ coins: 150 })
    expect(store().buyGear('line')).toBe(true)
    expect(store().gear.line).toBe(1)
    expect(store().coins).toBe(0)
  })

  it('저장 데이터가 깨져 있어도 초기 상태로 시작한다', async () => {
    localStorage.setItem(SAVE_KEY, '{망가진 json')
    await useProgressStore.persist.rehydrate()
    expect(store().coins).toBe(0)
    expect(store().inventory).toEqual([])
  })

  it('지금은 없는 물고기가 저장돼 있으면 불러올 때 걸러낸다', async () => {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        state: {
          coins: 5,
          inventory: [
            { id: 'a', speciesId: 'deleted-fish', weight: 1, caughtAtPlayTime: 0 },
            { id: 'b', speciesId: 'sleepy-sardine', weight: 0.2, caughtAtPlayTime: 0 },
          ],
        },
        version: 1,
      }),
    )
    await useProgressStore.persist.rehydrate()
    expect(store().coins).toBe(5)
    expect(store().inventory.map((f) => f.id)).toEqual(['b'])
    expect(store().gear).toEqual({ line: 0, reel: 0, rod: 0 })
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/game/stores src/game/logic/interaction.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현** — `src/game/logic/id.ts`

```ts
export function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}
```

`src/game/logic/interaction.ts`

```ts
/** 지금 플레이어가 무엇을 하고 있는지 (어떤 화면이 열려 있는지) */
export type Mode = 'explore' | 'fishing' | 'sell' | 'shop' | 'dex' | 'menu'

/** E 키로 상호작용할 수 있는 대상 */
export type Interactable = { kind: 'fishingSpot'; spotId: string } | { kind: 'sellBox' } | { kind: 'gearShop' }

export function isSameInteractable(a: Interactable | null, b: Interactable): boolean {
  if (!a || a.kind !== b.kind) return false
  if (a.kind === 'fishingSpot' && b.kind === 'fishingSpot') return a.spotId === b.spotId
  return true
}
```

`src/game/stores/progressStore.ts`

```ts
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { findSpecies } from '../data/fish'
import type { FishInstance, GearLevels, GearSlot } from '../data/types'
import { buyGearUpgrade, sellPrice } from '../logic/economy'
import { makeId } from '../logic/id'

export const SAVE_KEY = 'fishing-island-save-v1'

export type DexEntry = { count: number; maxWeight: number }

type ProgressData = {
  coins: number
  gear: GearLevels
  /** 아직 팔지 않은 물고기 */
  inventory: FishInstance[]
  /** 종 id → 기록. 한 번이라도 잡으면 생긴다 */
  dex: Record<string, DexEntry>
  /** 누적 플레이 시간(초) */
  playTime: number
}

type ProgressActions = {
  addPlayTime: (seconds: number) => void
  addCatch: (speciesId: string, weight: number) => FishInstance
  /** 판 금액을 돌려준다 */
  sellFish: (ids: string[]) => number
  buyGear: (slot: GearSlot) => boolean
  resetProgress: () => void
}

export const INITIAL_PROGRESS: ProgressData = {
  coins: 0,
  gear: { line: 0, reel: 0, rod: 0 },
  inventory: [],
  dex: {},
  playTime: 0,
}

// persist: 상태를 localStorage에 자동 저장하고, 새로고침하면 다시 불러온다
export const useProgressStore = create<ProgressData & ProgressActions>()(
  persist(
    (set, get) => ({
      ...INITIAL_PROGRESS,

      addPlayTime: (seconds) => set((s) => ({ playTime: s.playTime + seconds })),

      addCatch: (speciesId, weight) => {
        const fish: FishInstance = { id: makeId(), speciesId, weight, caughtAtPlayTime: get().playTime }
        set((s) => {
          const prev = s.dex[speciesId]
          return {
            inventory: [...s.inventory, fish],
            dex: {
              ...s.dex,
              [speciesId]: { count: (prev?.count ?? 0) + 1, maxWeight: Math.max(prev?.maxWeight ?? 0, weight) },
            },
          }
        })
        return fish
      },

      sellFish: (ids) => {
        const toSell = new Set(ids)
        let earned = 0
        const keep: FishInstance[] = []
        for (const fish of get().inventory) {
          const species = findSpecies(fish.speciesId)
          if (toSell.has(fish.id) && species) earned += sellPrice(species, fish.weight)
          else keep.push(fish)
        }
        if (earned > 0) set((s) => ({ inventory: keep, coins: s.coins + earned }))
        return earned
      },

      buyGear: (slot) => {
        const result = buyGearUpgrade(get().coins, get().gear, slot)
        if (!result.ok) return false
        set({ coins: result.coins, gear: result.levels })
        return true
      },

      resetProgress: () => set({ ...INITIAL_PROGRESS }),
    }),
    {
      name: SAVE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // 저장본에 없는 필드는 기본값을 쓰고, 지금은 없는 물고기는 버린다
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<ProgressData>
        return {
          ...current,
          ...saved,
          inventory: (saved.inventory ?? current.inventory).filter((f) => findSpecies(f.speciesId) !== undefined),
        }
      },
    },
  ),
)
```

`src/game/stores/sessionStore.ts`

```ts
import { create } from 'zustand'
import { isSameInteractable, type Interactable, type Mode } from '../logic/interaction'

type SessionState = {
  mode: Mode
  /** 플레이어가 지금 서 있는 상호작용 영역 */
  nearby: Interactable | null
  setMode: (mode: Mode) => void
  setNearby: (target: Interactable) => void
  /** 영역을 벗어날 때 호출. 다른 영역에 이미 들어가 있으면 지우지 않는다 */
  clearNearby: (target: Interactable) => void
  resetSession: () => void
}

// 저장하지 않는 "이번 판" 상태
export const useSessionStore = create<SessionState>((set, get) => ({
  mode: 'explore',
  nearby: null,
  setMode: (mode) => set({ mode }),
  setNearby: (target) => set({ nearby: target }),
  clearNearby: (target) => {
    if (isSameInteractable(get().nearby, target)) set({ nearby: null })
  },
  resetSession: () => set({ mode: 'explore', nearby: null }),
}))
```

`src/game/stores/fishingStore.ts`

```ts
import { create } from 'zustand'
import type { FishInstance } from '../data/types'
import { startFishing, type FishingState } from '../logic/fishingSession'

type FishingStore = {
  spotId: string | null
  state: FishingState | null
  /** 이번 판에서 잡은 물고기 (결과 카드용) */
  caught: FishInstance | null
  begin: (spotId: string) => void
  update: (state: FishingState, caught?: FishInstance) => void
  end: () => void
}

// 진행 중인 낚시. 3D 연출과 UI가 함께 읽는다
export const useFishingStore = create<FishingStore>((set) => ({
  spotId: null,
  state: null,
  caught: null,
  begin: (spotId) => set({ spotId, state: startFishing(), caught: null }),
  update: (state, caught) => set(caught ? { state, caught } : { state }),
  end: () => set({ spotId: null, state: null, caught: null }),
}))
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/game/stores src/game/logic/interaction.test.ts`
Expected: PASS (8 tests). "깨진 json" 테스트에서 zustand가 콘솔 경고를 찍는 것은 정상.

- [ ] **Step 5: 전체 테스트 + 빌드**

Run: `npm test && npm run build`
Expected: 모두 PASS

- [ ] **Step 6: 커밋**

```bash
git add src/game/logic/id.ts src/game/logic/interaction.ts src/game/logic/interaction.test.ts src/game/stores
git commit -m "feat: 진행 상황·세션·낚시 상태 저장소 추가"
```

---

### Task 8: 섬과 플레이어 이동

**Files:**
- Create: `src/game/input/keys.ts`, `src/game/input/pointer.ts`
- Create: `src/game/scene/Island.tsx`, `src/game/scene/Player.tsx`
- Create: `src/game/ui/styles.ts`
- Modify (전면 교체): `src/game/scene/World.tsx`, `src/game/ui/Hud.tsx`, `src/game/Game.tsx`
- Delete: `src/game/store.ts`

**Interfaces:**
- Consumes: `ZONES`, `ZoneDef`, `ISLAND_RADIUS`, `FENCE_Z`, `WATER_Y`, `INLAND_WATER_Y`, `getSpot`, `useSessionStore`, `useFishingStore`, `useProgressStore`
- Produces:
  - `isKeyDown(code): boolean`, `useKeyboardTracking()`
  - `pressPointer()`, `isPointerDown()`, `readPointer(): FishingInput`, `usePointerRelease()`
  - `playerRig: { position: Vector3; rodTip: Vector3 }` (매 프레임 갱신)
  - `styles.ts`: `overlayLayer`, `panelBox`, `button`, `disabledButton`, `hint`

- [ ] **Step 1: 키보드 입력** — `src/game/input/keys.ts`

```ts
import { useEffect } from 'react'

// 지금 눌려 있는 키 목록. useFrame 안에서 리렌더 없이 읽는다
const pressed = new Set<string>()

/** e.code 기준 ('KeyW', 'KeyE', 'Escape' …) */
export function isKeyDown(code: string): boolean {
  return pressed.has(code)
}

export function useKeyboardTracking() {
  useEffect(() => {
    const down = (e: KeyboardEvent) => pressed.add(e.code)
    const up = (e: KeyboardEvent) => pressed.delete(e.code)
    // 창 밖으로 포커스가 나가면 keyup을 못 받으니 전부 뗀 것으로 처리
    const clear = () => pressed.clear()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear)
    }
  }, [])
}
```

- [ ] **Step 2: 마우스 입력** — `src/game/input/pointer.ts`

```ts
import { useEffect } from 'react'
import type { FishingInput } from '../logic/fishingSession'

const pointer = { down: false, pressed: false }

/** 캔버스 영역에서 마우스를 눌렀을 때 호출 (UI 버튼 클릭은 여기로 오지 않는다) */
export function pressPointer() {
  pointer.down = true
  pointer.pressed = true
}

export function isPointerDown(): boolean {
  return pointer.down
}

/** 현재 입력을 읽고 '이번에 새로 눌림' 신호를 비운다. 매 프레임 한 번만 호출 */
export function readPointer(): FishingInput {
  const input = { pointerDown: pointer.down, pressed: pointer.pressed }
  pointer.pressed = false
  return input
}

export function usePointerRelease() {
  useEffect(() => {
    const release = () => {
      pointer.down = false
    }
    window.addEventListener('pointerup', release)
    window.addEventListener('blur', release)
    return () => {
      window.removeEventListener('pointerup', release)
      window.removeEventListener('blur', release)
    }
  }, [])
}
```

- [ ] **Step 3: 섬** — `src/game/scene/Island.tsx`

```tsx
import { Html } from '@react-three/drei'
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import { FENCE_Z, INLAND_WATER_Y, ISLAND_RADIUS, WATER_Y, ZONES, type ZoneDef } from '../data/zones'

export function Island() {
  return (
    <>
      {/* 섬 본체: 윗면이 y=0인 납작한 원기둥. fixed = 움직이지 않는 물리 물체 */}
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[1, ISLAND_RADIUS]} position={[0, -1, 0]} />
        <mesh position={[0, -1, 0]} receiveShadow>
          <cylinderGeometry args={[ISLAND_RADIUS, ISLAND_RADIUS, 2, 64]} />
          <meshStandardMaterial color="#e9d8a6" />
        </mesh>
      </RigidBody>

      {/* 북쪽 반원은 풀밭 (잠긴 구역들) */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, 0]} receiveShadow>
        <circleGeometry args={[ISLAND_RADIUS - 0.1, 64, 0, Math.PI]} />
        <meshStandardMaterial color="#9ccc65" />
      </mesh>

      {/* 바다 */}
      <mesh rotation-x={-Math.PI / 2} position={[0, WATER_Y, 0]}>
        <planeGeometry args={[300, 300]} />
        <meshStandardMaterial color="#2a9df4" transparent opacity={0.85} />
      </mesh>

      {/* 선착장 (보기용, 충돌 없음) */}
      <mesh position={[0, 0.05, 31]} castShadow receiveShadow>
        <boxGeometry args={[3, 0.3, 10]} />
        <meshStandardMaterial color="#a1887f" />
      </mesh>

      {/* 숲속 연못 */}
      <mesh rotation-x={-Math.PI / 2} position={[-15, INLAND_WATER_Y - 0.01, -12]}>
        <circleGeometry args={[5, 32]} />
        <meshStandardMaterial color="#4db6ac" />
      </mesh>

      {/* 동굴 지하호수 + 동굴 바위 */}
      <mesh rotation-x={-Math.PI / 2} position={[0, INLAND_WATER_Y - 0.01, -24]}>
        <circleGeometry args={[4, 32]} />
        <meshStandardMaterial color="#1a237e" />
      </mesh>
      <mesh position={[0, 2, -26]} castShadow>
        <boxGeometry args={[12, 4, 4]} />
        <meshStandardMaterial color="#5d4037" />
      </mesh>

      {/* 암초 */}
      {[
        [26, -20],
        [29, -14],
        [24, -25],
      ].map(([x, z]) => (
        <mesh key={`${x},${z}`} position={[x, 0, z]} castShadow>
          <dodecahedronGeometry args={[1.5]} />
          <meshStandardMaterial color="#78909c" />
        </mesh>
      ))}

      {fenceSegments().map(([from, to]) => (
        <FenceWall key={from} from={from} to={to} />
      ))}
      {ZONES.map((zone) => (
        <Gate key={zone.id} zone={zone} />
      ))}
    </>
  )
}

/** 문(gate) 자리를 뺀 나머지 울타리 구간들 */
function fenceSegments(): [number, number][] {
  const gates = ZONES.flatMap((z) => (z.gate ? [z.gate] : [])).sort((a, b) => a.xFrom - b.xFrom)
  const segments: [number, number][] = []
  let x = -ISLAND_RADIUS
  for (const gate of gates) {
    if (gate.xFrom > x) segments.push([x, gate.xFrom])
    x = gate.xTo
  }
  if (x < ISLAND_RADIUS) segments.push([x, ISLAND_RADIUS])
  return segments
}

function FenceWall({ from, to }: { from: number; to: number }) {
  const width = to - from
  return (
    <RigidBody type="fixed" colliders={false} position={[(from + to) / 2, 0.6, FENCE_Z]}>
      <CuboidCollider args={[width / 2, 1.5, 0.2]} />
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, 1.2, 0.3]} />
        <meshStandardMaterial color="#8d6e63" />
      </mesh>
    </RigidBody>
  )
}

/** 잠긴 구역 입구. 1차-B에서 해금되면 사라지게 만든다 */
function Gate({ zone }: { zone: ZoneDef }) {
  if (!zone.gate) return null
  const { xFrom, xTo } = zone.gate
  const width = xTo - xFrom
  return (
    <RigidBody type="fixed" colliders={false} position={[(xFrom + xTo) / 2, 1, FENCE_Z]}>
      <CuboidCollider args={[width / 2, 1, 0.3]} />
      <mesh castShadow>
        <boxGeometry args={[width, 2, 0.6]} />
        <meshStandardMaterial color={zone.color} transparent opacity={0.7} />
      </mesh>
      {/* Html: 3D 위치에 일반 HTML을 띄운다 (한글 표시용) */}
      <Html center position={[0, 2, 0]} style={gateLabel}>
        잠김 · {zone.name} — {zone.unlockLabel}
      </Html>
    </RigidBody>
  )
}

const gateLabel = {
  pointerEvents: 'none' as const,
  whiteSpace: 'nowrap' as const,
  background: 'rgba(0,0,0,0.6)',
  color: '#fff',
  padding: '4px 8px',
  borderRadius: 6,
  fontSize: 13,
}
```

- [ ] **Step 4: 플레이어** — `src/game/scene/Player.tsx`

```tsx
import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { CapsuleCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier'
import { Vector3, type Group, type Object3D } from 'three'
import { ISLAND_RADIUS, getSpot } from '../data/zones'
import { isKeyDown } from '../input/keys'
import { isPointerDown } from '../input/pointer'
import { useFishingStore } from '../stores/fishingStore'
import { useSessionStore } from '../stores/sessionStore'

/** 다른 컴포넌트(낚싯줄 등)가 읽는 플레이어 정보. Player가 매 프레임 갱신한다 */
export const playerRig = {
  position: new Vector3(0, 1, 15),
  rodTip: new Vector3(0, 2, 15),
}

const MOVE_SPEED = 6
const PLAYER_LIMIT = ISLAND_RADIUS - 1
const CAMERA_DISTANCE = 10
const CAMERA_HEIGHT = 7
const DRAG_SENSITIVITY = 0.005

// 매 프레임 new Vector3()를 만들지 않도록 재사용
const moveDir = new Vector3()
const cameraTarget = new Vector3()

export function Player() {
  const body = useRef<RapierRigidBody>(null)
  const visual = useRef<Group>(null)
  const rod = useRef<Group>(null)
  const rodTip = useRef<Object3D>(null)
  /** 카메라가 플레이어 주위를 도는 각도 */
  const yaw = useRef(0)
  /** 캐릭터가 바라보는 각도 (0 = +z 방향) */
  const facing = useRef(Math.PI)
  const camera = useThree((s) => s.camera)

  // 탐험 중 마우스 드래그로 카메라 회전
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (isPointerDown() && useSessionStore.getState().mode === 'explore') {
        yaw.current -= e.movementX * DRAG_SENSITIVITY
      }
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  useFrame((_, delta) => {
    const rb = body.current
    if (!rb) return
    const mode = useSessionStore.getState().mode

    // 1) WASD → 카메라 기준 이동 방향
    const forward = mode === 'explore' ? Number(isKeyDown('KeyW')) - Number(isKeyDown('KeyS')) : 0
    const right = mode === 'explore' ? Number(isKeyDown('KeyD')) - Number(isKeyDown('KeyA')) : 0
    const sin = Math.sin(yaw.current)
    const cos = Math.cos(yaw.current)
    moveDir.set(-sin * forward + cos * right, 0, -cos * forward - sin * right)
    if (moveDir.lengthSq() > 0) moveDir.normalize()

    // 속도를 직접 정해 준다. y(중력에 의한 낙하)는 물리 엔진 값을 그대로 둔다
    const velocity = rb.linvel()
    rb.setLinvel({ x: moveDir.x * MOVE_SPEED, y: velocity.y, z: moveDir.z * MOVE_SPEED }, true)

    // 2) 섬 밖으로 못 나가게 가장자리에서 붙잡는다
    const p = rb.translation()
    const dist = Math.hypot(p.x, p.z)
    let x = p.x
    let z = p.z
    if (dist > PLAYER_LIMIT) {
      x = (p.x * PLAYER_LIMIT) / dist
      z = (p.z * PLAYER_LIMIT) / dist
      rb.setTranslation({ x, y: p.y, z }, true)
    }
    playerRig.position.set(x, p.y, z)

    // 3) 바라보는 방향: 낚시 중엔 물 쪽, 아니면 이동 방향
    const spotId = useFishingStore.getState().spotId
    if (mode === 'fishing' && spotId) {
      const [fx, fz] = getSpot(spotId).facing
      facing.current = Math.atan2(fx, fz)
    } else if (moveDir.lengthSq() > 0) {
      facing.current = Math.atan2(moveDir.x, moveDir.z)
    }
    if (visual.current) visual.current.rotation.y = facing.current

    // 4) 텐션이 높을수록 낚싯대가 물 쪽으로 휜다
    const fishing = useFishingStore.getState().state
    const bend = fishing?.stage === 'fighting' ? fishing.fight.tension / fishing.fight.gear.maxTension : 0
    if (rod.current) rod.current.rotation.x = 0.5 + Math.min(bend, 1) * 0.7
    rodTip.current?.getWorldPosition(playerRig.rodTip)

    // 5) 3인칭 카메라: 목표 위치로 부드럽게 따라간다
    cameraTarget.set(x + sin * CAMERA_DISTANCE, p.y + CAMERA_HEIGHT, z + cos * CAMERA_DISTANCE)
    camera.position.lerp(cameraTarget, 1 - Math.exp(-delta * 5))
    camera.lookAt(x, p.y + 1, z)
  })

  return (
    // dynamic 물체지만 회전은 막아서 넘어지지 않게 한다
    <RigidBody ref={body} colliders={false} position={[0, 2, 15]} enabledRotations={[false, false, false]}>
      <CapsuleCollider args={[0.5, 0.4]} />
      <group ref={visual}>
        <mesh castShadow>
          <capsuleGeometry args={[0.4, 1, 4, 12]} />
          <meshStandardMaterial color="#f4a261" />
        </mesh>
        {/* 바라보는 방향 표시용 눈 */}
        <mesh position={[0, 0.5, 0.35]}>
          <boxGeometry args={[0.4, 0.1, 0.1]} />
          <meshStandardMaterial color="#222" />
        </mesh>
        {/* 낚싯대: 그룹을 x축으로 기울이면 앞(+z)으로 숙여진다 */}
        <group ref={rod} position={[0.35, 0.1, 0.2]}>
          <mesh position={[0, 1, 0]}>
            <cylinderGeometry args={[0.02, 0.04, 2]} />
            <meshStandardMaterial color="#6d4c41" />
          </mesh>
          <object3D ref={rodTip} position={[0, 2, 0]} />
        </group>
      </group>
    </RigidBody>
  )
}
```

- [ ] **Step 5: 공용 UI 스타일** — `src/game/ui/styles.ts`

```ts
import type { CSSProperties } from 'react'

/** 캔버스 위를 덮는 레이어. 클릭은 통과시키고, 버튼에서만 받는다 */
export const overlayLayer: CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  color: '#fff',
}

export const panelBox: CSSProperties = {
  pointerEvents: 'auto',
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 'min(560px, 90vw)',
  maxHeight: '80vh',
  overflowY: 'auto',
  background: 'rgba(20, 30, 45, 0.95)',
  color: '#fff',
  borderRadius: 12,
  padding: 20,
  boxSizing: 'border-box',
}

export const button: CSSProperties = {
  pointerEvents: 'auto',
  padding: '6px 14px',
  cursor: 'pointer',
  borderRadius: 6,
  border: 'none',
  background: '#ffd166',
  color: '#222',
  fontWeight: 600,
}

export const disabledButton: CSSProperties = {
  ...button,
  background: '#555',
  color: '#999',
  cursor: 'not-allowed',
}

/** 화면 아래 가운데 안내 문구 */
export const hint: CSSProperties = {
  position: 'absolute',
  bottom: 32,
  left: '50%',
  transform: 'translateX(-50%)',
  background: 'rgba(0, 0, 0, 0.6)',
  padding: '8px 16px',
  borderRadius: 8,
  fontSize: 16,
  whiteSpace: 'nowrap',
}
```

- [ ] **Step 6: HUD 교체** — `src/game/ui/Hud.tsx`

```tsx
import type { Interactable } from '../logic/interaction'
import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'
import { button, hint, overlayLayer } from './styles'

const PROMPT: Record<Interactable['kind'], string> = {
  fishingSpot: 'E  낚시하기',
  sellBox: 'E  물고기 팔기',
  gearShop: 'E  장비 상점',
}

export function Hud() {
  const coins = useProgressStore((s) => s.coins)
  const mode = useSessionStore((s) => s.mode)
  const nearby = useSessionStore((s) => s.nearby)
  const setMode = useSessionStore((s) => s.setMode)

  return (
    <div style={overlayLayer}>
      <div style={{ position: 'absolute', top: 16, left: 16, fontSize: 18 }}>
        <strong>코인 {coins}</strong>
      </div>

      {mode === 'explore' && (
        <>
          <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 8 }}>
            <button style={button} onClick={() => setMode('dex')}>
              도감
            </button>
            <button style={button} onClick={() => setMode('menu')}>
              메뉴 (ESC)
            </button>
          </div>
          {nearby && <div style={hint}>{PROMPT[nearby.kind]}</div>}
          <div style={{ position: 'absolute', bottom: 16, left: 16, opacity: 0.7, fontSize: 13 }}>
            WASD 이동 · 마우스 드래그로 카메라 회전
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 7: World 교체** — `src/game/scene/World.tsx`

```tsx
import { Island } from './Island'
import { Player } from './Player'

export function World() {
  return (
    <>
      {/* 하늘색 배경 */}
      <color attach="background" args={['#9fd8ff']} />
      <ambientLight intensity={0.6} />
      {/* 섬 전체에 그림자가 생기도록 그림자 카메라 범위를 넓힌다 */}
      <directionalLight
        position={[20, 30, 10]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
      />
      <Island />
      <Player />
    </>
  )
}
```

- [ ] **Step 8: Game 교체** — `src/game/Game.tsx`

```tsx
import { Suspense, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { useKeyboardTracking } from './input/keys'
import { pressPointer, usePointerRelease } from './input/pointer'
import { World } from './scene/World'
import { useFishingStore } from './stores/fishingStore'
import { useSessionStore } from './stores/sessionStore'
import { Hud } from './ui/Hud'

export type GameResult = { score: number }

export type GameProps = {
  /** 사용자가 게임을 나가려 할 때 (로비로 돌아가기) */
  onExit?: () => void
  /** 전설의 물고기를 처음 잡았을 때 결과 전달 (1차-B에서 연결) */
  onFinish?: (result: GameResult) => void
}

/**
 * 게임 전체를 감싸는 단일 컴포넌트. 로비 앱은 이것만 import 해서 쓰면 된다.
 * 부모 요소의 크기를 100% 채운다.
 */
export function Game(_props: GameProps) {
  useKeyboardTracking()
  usePointerRelease()

  // 진행 상황(progressStore)은 저장된 것을 이어 쓰고, 이번 판 상태만 초기화한다
  useEffect(() => {
    useSessionStore.getState().resetSession()
    useFishingStore.getState().end()
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* 캔버스 영역 클릭만 게임 입력으로 받는다 (UI 버튼 클릭은 제외) */}
      <div style={{ position: 'absolute', inset: 0 }} onPointerDown={pressPointer}>
        <Canvas shadows camera={{ position: [0, 8, 25], fov: 50 }}>
          {/* Rapier는 물리 엔진(wasm)을 비동기로 불러오므로 Suspense가 필요하다 */}
          <Suspense fallback={null}>
            <Physics>
              <World />
            </Physics>
          </Suspense>
        </Canvas>
      </div>
      <Hud />
    </div>
  )
}
```

> 참고: `_props`는 이 Task에서 아직 쓰지 않는다. Task 9에서 `onExit`을 연결한다. `noUnusedParameters`는 `_`로 시작하는 매개변수를 허용한다.

- [ ] **Step 9: 옛 스토어 삭제**

```bash
git rm src/game/store.ts
```

- [ ] **Step 10: 빌드·테스트 확인**

Run: `npm run build && npm test`
Expected: PASS. `store` import 에러가 나면 남은 참조를 찾아 제거한다(`grep -rn "from '../store'\|from './store'" src`).

- [ ] **Step 11: 브라우저 확인**

Run: `npm run dev` 후 표시된 주소 열기
확인:
- 하늘, 바다, 모래섬, 북쪽 풀밭, 울타리와 반투명한 문 3개(라벨 "잠김 · …")가 보인다
- 캡슐 캐릭터가 바닥에 떨어져 선다
- WASD로 움직이고 이동 방향을 바라본다(검은 눈이 앞쪽)
- 마우스 드래그로 카메라가 돈다. W는 항상 화면 안쪽 방향
- 울타리와 문을 통과하지 못하고, 섬 가장자리에서 멈춘다
- 왼쪽 위 "코인 0", 오른쪽 위 "도감"/"메뉴" 버튼 (아직 눌러도 아무 것도 안 뜸)

- [ ] **Step 12: 커밋**

```bash
git add -A
git commit -m "feat: 섬과 3인칭 플레이어 이동 추가"
```

---

### Task 9: 상호작용 영역과 E/ESC 키, 메뉴

**Files:**
- Create: `src/game/scene/facilities/InteractionZone.tsx`, `src/game/scene/facilities/FishingSpots.tsx`, `src/game/scene/facilities/SellBox.tsx`, `src/game/scene/facilities/GearShop.tsx`
- Create: `src/game/input/useInteractionKeys.ts`
- Create: `src/game/ui/Panel.tsx`, `src/game/ui/Panels.tsx`, `src/game/ui/MenuPanel.tsx`
- Modify: `src/game/logic/interaction.ts` (resolveKeyAction 추가), `src/game/logic/interaction.test.ts`
- Modify: `src/game/scene/World.tsx`, `src/game/Game.tsx`

**Interfaces:**
- Consumes: `Interactable`, `Mode`, `useSessionStore`, `useFishingStore`, `FISHING_SPOTS`, `FishingSpot`
- Produces:
  - `KeyAction = { type: 'none' } | { type: 'startFishing'; spotId: string } | { type: 'openMode'; mode: Mode } | { type: 'stopFishing' } | { type: 'closePanel' }`
  - `resolveKeyAction(code, mode, nearby): KeyAction`
  - `useInteractionKeys()`
  - `<InteractionZone position halfSize target />`
  - `<Panel title>`: 닫기 버튼이 있는 공용 패널 틀
  - `<Panels onExit />`: mode에 따라 패널을 고른다

- [ ] **Step 1: 실패하는 테스트 추가** — `src/game/logic/interaction.test.ts` 맨 아래에 추가하고, 첫 줄 import를 `import { isSameInteractable, resolveKeyAction } from './interaction'`로 바꾼다

```ts
describe('resolveKeyAction', () => {
  const spot = { kind: 'fishingSpot' as const, spotId: 'beach-dock' }

  it('탐험 중 낚시 포인트에서 E를 누르면 낚시를 시작한다', () => {
    expect(resolveKeyAction('KeyE', 'explore', spot)).toEqual({ type: 'startFishing', spotId: 'beach-dock' })
  })

  it('판매함·상점에서 E를 누르면 해당 패널을 연다', () => {
    expect(resolveKeyAction('KeyE', 'explore', { kind: 'sellBox' })).toEqual({ type: 'openMode', mode: 'sell' })
    expect(resolveKeyAction('KeyE', 'explore', { kind: 'gearShop' })).toEqual({ type: 'openMode', mode: 'shop' })
  })

  it('주변에 아무것도 없거나 이미 다른 일을 하는 중이면 E는 무시한다', () => {
    expect(resolveKeyAction('KeyE', 'explore', null)).toEqual({ type: 'none' })
    expect(resolveKeyAction('KeyE', 'fishing', spot)).toEqual({ type: 'none' })
    expect(resolveKeyAction('KeyE', 'shop', { kind: 'gearShop' })).toEqual({ type: 'none' })
  })

  it('ESC: 탐험 중이면 메뉴, 낚시 중이면 낚시 중단, 패널이면 닫기', () => {
    expect(resolveKeyAction('Escape', 'explore', null)).toEqual({ type: 'openMode', mode: 'menu' })
    expect(resolveKeyAction('Escape', 'fishing', spot)).toEqual({ type: 'stopFishing' })
    expect(resolveKeyAction('Escape', 'menu', null)).toEqual({ type: 'closePanel' })
  })

  it('다른 키는 무시한다', () => {
    expect(resolveKeyAction('KeyW', 'explore', spot)).toEqual({ type: 'none' })
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/game/logic/interaction.test.ts`
Expected: FAIL — `resolveKeyAction` 없음

- [ ] **Step 3: 구현** — `src/game/logic/interaction.ts` 맨 아래에 추가

```ts
export type KeyAction =
  | { type: 'none' }
  | { type: 'startFishing'; spotId: string }
  | { type: 'openMode'; mode: Mode }
  | { type: 'stopFishing' }
  | { type: 'closePanel' }

export function resolveKeyAction(code: string, mode: Mode, nearby: Interactable | null): KeyAction {
  if (code === 'Escape') {
    if (mode === 'explore') return { type: 'openMode', mode: 'menu' }
    if (mode === 'fishing') return { type: 'stopFishing' }
    return { type: 'closePanel' }
  }
  if (code === 'KeyE' && mode === 'explore' && nearby) {
    switch (nearby.kind) {
      case 'fishingSpot':
        return { type: 'startFishing', spotId: nearby.spotId }
      case 'sellBox':
        return { type: 'openMode', mode: 'sell' }
      case 'gearShop':
        return { type: 'openMode', mode: 'shop' }
    }
  }
  return { type: 'none' }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/game/logic/interaction.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: 키 입력 훅** — `src/game/input/useInteractionKeys.ts`

```ts
import { useEffect } from 'react'
import { resolveKeyAction } from '../logic/interaction'
import { useFishingStore } from '../stores/fishingStore'
import { useSessionStore } from '../stores/sessionStore'

export function useInteractionKeys() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return // 꾹 누르고 있을 때 반복 입력 무시
      const session = useSessionStore.getState()
      const action = resolveKeyAction(e.code, session.mode, session.nearby)
      switch (action.type) {
        case 'startFishing':
          useFishingStore.getState().begin(action.spotId)
          session.setMode('fishing')
          break
        case 'openMode':
          session.setMode(action.mode)
          break
        case 'stopFishing':
          useFishingStore.getState().end()
          session.setMode('explore')
          break
        case 'closePanel':
          session.setMode('explore')
          break
        case 'none':
          break
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
```

- [ ] **Step 6: 상호작용 영역** — `src/game/scene/facilities/InteractionZone.tsx`

```tsx
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import type { Interactable } from '../../logic/interaction'
import { useSessionStore } from '../../stores/sessionStore'

type Props = {
  position: [number, number, number]
  /** 상자 크기의 절반 [x, y, z] */
  halfSize: [number, number, number]
  target: Interactable
}

/**
 * 눈에 보이지 않는 감지 상자(sensor). 부딪히지 않고 "들어왔다/나갔다"만 알려 준다.
 * 움직이는 물체는 플레이어뿐이라 상대가 누구인지 따로 확인하지 않는다.
 */
export function InteractionZone({ position, halfSize, target }: Props) {
  return (
    <RigidBody type="fixed" colliders={false} position={position}>
      <CuboidCollider
        sensor
        args={halfSize}
        onIntersectionEnter={() => useSessionStore.getState().setNearby(target)}
        onIntersectionExit={() => useSessionStore.getState().clearNearby(target)}
      />
    </RigidBody>
  )
}
```

- [ ] **Step 7: 낚시 포인트** — `src/game/scene/facilities/FishingSpots.tsx`

```tsx
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh, MeshBasicMaterial } from 'three'
import { FISHING_SPOTS, type FishingSpot } from '../../data/zones'
import { InteractionZone } from './InteractionZone'

export function FishingSpots() {
  return (
    <>
      {FISHING_SPOTS.map((spot) => (
        <FishingSpotMarker key={spot.id} spot={spot} />
      ))}
    </>
  )
}

/** 물 위에 퍼지는 물결 고리로 낚시 포인트를 알려 준다 */
function FishingSpotMarker({ spot }: { spot: FishingSpot }) {
  const ring = useRef<Mesh>(null)
  const material = useRef<MeshBasicMaterial>(null)
  const [x, z] = spot.position
  const [fx, fz] = spot.facing

  useFrame(({ clock }) => {
    const t = (clock.elapsedTime * 0.8) % 1 // 0 → 1 반복
    const scale = 1 + t * 1.5
    ring.current?.scale.set(scale, scale, scale)
    if (material.current) material.current.opacity = 1 - t
  })

  return (
    <>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position={[x + fx * 4, spot.surfaceY + 0.02, z + fz * 4]}>
        <ringGeometry args={[0.5, 0.65, 32]} />
        <meshBasicMaterial ref={material} color="white" transparent />
      </mesh>
      <InteractionZone position={[x, 1, z]} halfSize={[2.5, 1.5, 2.5]} target={{ kind: 'fishingSpot', spotId: spot.id }} />
    </>
  )
}
```

- [ ] **Step 8: 판매함과 장비 상점** — `src/game/scene/facilities/SellBox.tsx`

```tsx
import { RigidBody } from '@react-three/rapier'
import { InteractionZone } from './InteractionZone'

const POSITION: [number, number, number] = [5, 0.5, 16]

export function SellBox() {
  return (
    <>
      {/* colliders="cuboid": 메시 모양에 맞춰 상자 충돌체를 자동으로 만든다 */}
      <RigidBody type="fixed" colliders="cuboid" position={POSITION}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1.2, 1, 1.2]} />
          <meshStandardMaterial color="#c62828" />
        </mesh>
      </RigidBody>
      <InteractionZone position={POSITION} halfSize={[2, 1.5, 2]} target={{ kind: 'sellBox' }} />
    </>
  )
}
```

`src/game/scene/facilities/GearShop.tsx`

```tsx
import { RigidBody } from '@react-three/rapier'
import { InteractionZone } from './InteractionZone'

const POSITION: [number, number, number] = [-6, 1, 14]

export function GearShop() {
  return (
    <>
      <RigidBody type="fixed" colliders="cuboid" position={POSITION}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[3, 2, 2]} />
          <meshStandardMaterial color="#1565c0" />
        </mesh>
      </RigidBody>
      {/* 지붕 */}
      <mesh position={[POSITION[0], 2.3, POSITION[2]]} castShadow>
        <boxGeometry args={[3.6, 0.3, 2.6]} />
        <meshStandardMaterial color="#ffca28" />
      </mesh>
      <InteractionZone position={POSITION} halfSize={[2.5, 1.5, 2]} target={{ kind: 'gearShop' }} />
    </>
  )
}
```

- [ ] **Step 9: 패널 틀과 메뉴** — `src/game/ui/Panel.tsx`

```tsx
import type { ReactNode } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { button, panelBox } from './styles'

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  const setMode = useSessionStore((s) => s.setMode)
  return (
    <div style={panelBox}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>{title}</h2>
        <button style={button} onClick={() => setMode('explore')}>
          닫기 (ESC)
        </button>
      </div>
      {children}
    </div>
  )
}
```

`src/game/ui/MenuPanel.tsx`

```tsx
import { useSessionStore } from '../stores/sessionStore'
import { Panel } from './Panel'
import { button } from './styles'

export function MenuPanel({ onExit }: { onExit?: () => void }) {
  const setMode = useSessionStore((s) => s.setMode)
  return (
    <Panel title="메뉴">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button style={button} onClick={() => setMode('explore')}>
          계속하기
        </button>
        <button style={button} onClick={() => setMode('dex')}>
          도감
        </button>
        <button style={button} onClick={() => onExit?.()}>
          로비로 나가기
        </button>
      </div>
    </Panel>
  )
}
```

`src/game/ui/Panels.tsx`

```tsx
import { useSessionStore } from '../stores/sessionStore'
import { MenuPanel } from './MenuPanel'

/** 현재 mode에 맞는 패널 하나를 띄운다 */
export function Panels({ onExit }: { onExit?: () => void }) {
  const mode = useSessionStore((s) => s.mode)
  switch (mode) {
    case 'menu':
      return <MenuPanel onExit={onExit} />
    default:
      return null
  }
}
```

- [ ] **Step 10: World와 Game에 연결**

`src/game/scene/World.tsx`: import 3줄 추가, `<Player />` 아래에 시설 3개 추가

```tsx
import { FishingSpots } from './facilities/FishingSpots'
import { GearShop } from './facilities/GearShop'
import { SellBox } from './facilities/SellBox'
```

```tsx
      <Island />
      <Player />
      <FishingSpots />
      <SellBox />
      <GearShop />
```

`src/game/Game.tsx`:
- import 추가: `import { useInteractionKeys } from './input/useInteractionKeys'`, `import { Panels } from './ui/Panels'`
- 시그니처를 `export function Game({ onExit }: GameProps) {`로 변경 (Task 8의 `_props` 참고 문단은 삭제)
- `usePointerRelease()` 아래에 `useInteractionKeys()` 추가
- `<Hud />` 아래에 `<Panels onExit={onExit} />` 추가

- [ ] **Step 11: 빌드·테스트 확인**

Run: `npm run build && npm test`
Expected: PASS

- [ ] **Step 12: 브라우저 확인**

Run: `npm run dev`
확인:
- 바다 쪽 선착장 끝과 서쪽 바위 해안에 물결 고리가 퍼진다(잠긴 구역 안쪽에도 고리가 보이는 것은 정상)
- 선착장 끝으로 가면 "E 낚시하기", 빨간 상자 옆은 "E 물고기 팔기", 파란 가게 옆은 "E 장비 상점"이 뜨고 벗어나면 사라진다
- 빨간 상자와 파란 가게에 몸이 막힌다
- ESC → 메뉴 패널, 다시 ESC 또는 "계속하기" → 닫힘
- "로비로 나가기" → 브라우저 콘솔에 `[dev] onExit 호출됨`
- 낚시 포인트에서 E → 캐릭터가 바다 쪽을 보고 WASD가 멈춘다. ESC → 다시 움직인다

- [ ] **Step 13: 커밋**

```bash
git add -A
git commit -m "feat: 상호작용 영역과 E/ESC 키, 메뉴 추가"
```

---

### Task 10: 낚시 진행과 연출 (찌, 낚싯줄, 텐션 게이지, 결과 카드)

**Files:**
- Create: `src/game/logic/time.ts`, `src/game/logic/time.test.ts`
- Create: `src/game/scene/fishing/FishingController.tsx`, `src/game/scene/fishing/FishingVisuals.tsx`, `src/game/scene/PlayTimeTicker.tsx`
- Create: `src/game/ui/FishingOverlay.tsx`
- Modify: `src/game/scene/World.tsx`, `src/game/Game.tsx`

**Interfaces:**
- Consumes: `stepFishing`, `FishingState`, `readPointer`, `gearStats`, `getSpot`, `castDistance`, `castPowerFromHold`, `FIGHT`, `MAX_FRAME_DELTA`, `playerRig`, `useFishingStore`, `useProgressStore`, `useSessionStore`, `getSpecies`, `RARITY_LABEL`, `RARITY_COLOR`
- Produces: `clampDelta(delta): number`, `<FishingController />`, `<FishingVisuals />`, `<PlayTimeTicker />`, `<FishingOverlay />`

- [ ] **Step 1: 실패하는 테스트 작성** — `src/game/logic/time.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { clampDelta } from './time'

describe('clampDelta', () => {
  it('보통 프레임 시간은 그대로', () => {
    expect(clampDelta(0.016)).toBe(0.016)
  })

  it('탭을 오래 비웠다 돌아와도 0.1초까지만 인정한다', () => {
    expect(clampDelta(30)).toBe(0.1)
  })

  it('음수나 NaN은 0으로 본다', () => {
    expect(clampDelta(-1)).toBe(0)
    expect(clampDelta(Number.NaN)).toBe(0)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/game/logic/time.test.ts`
Expected: FAIL — `./time` 없음

- [ ] **Step 3: 구현** — `src/game/logic/time.ts`

```ts
import { MAX_FRAME_DELTA } from '../data/balance'

/** 프레임 delta를 0 ~ MAX_FRAME_DELTA 로 제한 */
export function clampDelta(delta: number): number {
  if (!Number.isFinite(delta) || delta < 0) return 0
  return Math.min(delta, MAX_FRAME_DELTA)
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/game/logic/time.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: 낚시 진행 컨트롤러** — `src/game/scene/fishing/FishingController.tsx`

```tsx
import { useFrame } from '@react-three/fiber'
import { getSpot } from '../../data/zones'
import { readPointer } from '../../input/pointer'
import { gearStats } from '../../logic/economy'
import { stepFishing } from '../../logic/fishingSession'
import { clampDelta } from '../../logic/time'
import { useFishingStore } from '../../stores/fishingStore'
import { useProgressStore } from '../../stores/progressStore'
import { useSessionStore } from '../../stores/sessionStore'

/** 화면에는 아무것도 그리지 않고, 매 프레임 낚시 로직만 한 칸씩 진행시킨다 */
export function FishingController() {
  useFrame((_, delta) => {
    // 낚시 중이 아니어도 매 프레임 읽어서 '새로 눌림' 신호를 비워 둔다
    const input = readPointer()
    if (useSessionStore.getState().mode !== 'fishing') return

    const fishing = useFishingStore.getState()
    if (!fishing.state || !fishing.spotId) return
    const spot = getSpot(fishing.spotId)
    const next = stepFishing(fishing.state, input, clampDelta(delta), {
      zone: spot.zone,
      gear: gearStats(useProgressStore.getState().gear),
      rng: Math.random,
    })
    if (next === fishing.state) return

    // 'done'은 한 번만 들어온다 (done 상태는 stepFishing이 그대로 돌려주므로 위에서 return)
    if (next.stage === 'done' && next.result === 'caught') {
      const caught = useProgressStore.getState().addCatch(next.speciesId, next.weight)
      fishing.update(next, caught)
    } else {
      fishing.update(next)
    }
  })
  return null
}
```

- [ ] **Step 6: 찌와 낚싯줄** — `src/game/scene/fishing/FishingVisuals.tsx`

```tsx
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferGeometry, Line, LineBasicMaterial, Vector3, type Mesh } from 'three'
import { FIGHT } from '../../data/balance'
import { getSpot } from '../../data/zones'
import { castDistance } from '../../logic/cast'
import { useFishingStore } from '../../stores/fishingStore'
import { playerRig } from '../Player'

export function FishingVisuals() {
  const bobber = useRef<Mesh>(null)
  // 낚싯줄: 두 점(낚싯대 끝, 찌)을 잇는 선. 매 프레임 점 위치만 바꾼다
  const line = useMemo(() => {
    const geometry = new BufferGeometry().setFromPoints([new Vector3(), new Vector3()])
    const l = new Line(geometry, new LineBasicMaterial({ color: 'white' }))
    l.frustumCulled = false
    return l
  }, [])

  useFrame(({ clock }) => {
    const { state, spotId } = useFishingStore.getState()
    if (!bobber.current) return
    // 던지기 전(aiming)이나 낚시 중이 아닐 때는 찌와 줄을 숨긴다
    if (!state || !spotId || state.stage === 'aiming') {
      bobber.current.visible = false
      line.visible = false
      return
    }
    bobber.current.visible = true
    line.visible = true

    const spot = getSpot(spotId)
    const t = clock.elapsedTime
    let distance = castDistance(state.castPower)
    let dip = Math.sin(t * 2) * 0.03 // 둥실둥실
    let shake = 0

    if (state.stage === 'waiting') {
      if (state.bite.phase === 'nibble') dip = -0.08 // 톡톡
      if (state.bite.phase === 'bite') dip = -0.3 // 쑥!
    }
    if (state.stage === 'fighting') {
      const f = state.fight
      // 물고기가 가까워질수록 찌도 다가온다
      distance = 1 + (castDistance(state.castPower) - 1) * Math.min(1.5, f.distance / FIGHT.startDistance)
      dip = -0.25
      shake = f.pull.active ? Math.sin(t * 40) * 0.15 : 0
    }

    const [fx, fz] = spot.facing
    bobber.current.position.set(
      playerRig.position.x + fx * distance - fz * shake,
      spot.surfaceY + dip,
      playerRig.position.z + fz * distance + fx * shake,
    )

    const positions = line.geometry.attributes.position
    positions.setXYZ(0, playerRig.rodTip.x, playerRig.rodTip.y, playerRig.rodTip.z)
    positions.setXYZ(1, bobber.current.position.x, bobber.current.position.y, bobber.current.position.z)
    positions.needsUpdate = true
  })

  return (
    <>
      <mesh ref={bobber} visible={false}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color="#e63946" />
      </mesh>
      {/* primitive: 직접 만든 three.js 객체를 씬에 넣을 때 쓴다 */}
      <primitive object={line} />
    </>
  )
}
```

- [ ] **Step 7: 플레이 시간 기록** — `src/game/scene/PlayTimeTicker.tsx`

```tsx
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { clampDelta } from '../logic/time'
import { useProgressStore } from '../stores/progressStore'

/** 매 프레임 저장하면 localStorage 쓰기가 너무 잦으므로 1초씩 모아서 기록한다 */
export function PlayTimeTicker() {
  const pending = useRef(0)
  useFrame((_, delta) => {
    pending.current += clampDelta(delta)
    if (pending.current >= 1) {
      useProgressStore.getState().addPlayTime(pending.current)
      pending.current = 0
    }
  })
  return null
}
```

- [ ] **Step 8: 낚시 UI** — `src/game/ui/FishingOverlay.tsx`

```tsx
import { RARITY_COLOR, RARITY_LABEL, getSpecies } from '../data/fish'
import type { FishInstance } from '../data/types'
import { castPowerFromHold } from '../logic/cast'
import type { FightState } from '../logic/fight'
import type { FishingState } from '../logic/fishingSession'
import { useFishingStore } from '../stores/fishingStore'
import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'
import { button, hint, overlayLayer, panelBox } from './styles'

export function FishingOverlay() {
  const mode = useSessionStore((s) => s.mode)
  const state = useFishingStore((s) => s.state)
  const caught = useFishingStore((s) => s.caught)
  if (mode !== 'fishing' || !state) return null

  return (
    <div style={overlayLayer}>
      {state.stage === 'aiming' && <AimingView holdTime={state.holdTime} />}
      {state.stage === 'waiting' && <WaitingView biting={state.bite.phase === 'bite'} />}
      {state.stage === 'fighting' && <TensionGauge fight={state.fight} />}
      {state.stage === 'done' && <ResultCard state={state} caught={caught} />}
    </div>
  )
}

function AimingView({ holdTime }: { holdTime: number }) {
  const power = castPowerFromHold(holdTime)
  return (
    <div style={hint}>
      <div>마우스를 누르고 있다가 떼서 던지기 · ESC 그만하기</div>
      <Bar ratio={power} color="#ffd166" />
    </div>
  )
}

function WaitingView({ biting }: { biting: boolean }) {
  return (
    <>
      {biting && (
        <div style={{ position: 'absolute', top: '35%', width: '100%', textAlign: 'center', fontSize: 72, fontWeight: 800, color: '#ffeb3b' }}>
          !
        </div>
      )}
      <div style={hint}>찌를 지켜보세요… 크게 잠기면 클릭!</div>
    </>
  )
}

function TensionGauge({ fight }: { fight: FightState }) {
  const ratio = fight.tension / fight.gear.maxTension
  const color = ratio > 0.8 ? '#ef5350' : ratio < 0.15 ? '#90caf9' : '#66bb6a'
  return (
    <div style={{ ...hint, width: 360 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>텐션</span>
        <span>남은 거리 {Math.ceil(fight.distance)}m</span>
      </div>
      <Bar ratio={ratio} color={color} />
      <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
        누르고 있으면 감기 · 떼면 풀기 {fight.pull.active && '· 물고기가 당긴다!'}
      </div>
    </div>
  )
}

function Bar({ ratio, color }: { ratio: number; color: string }) {
  return (
    <div style={{ height: 12, background: '#333', borderRadius: 6, overflow: 'hidden', marginTop: 6 }}>
      <div style={{ width: `${Math.min(1, ratio) * 100}%`, height: '100%', background: color }} />
    </div>
  )
}

const FAIL_TEXT = {
  missed: '놓쳤다! 찌가 크게 잠길 때 챔질해야 해요.',
  snapped: '줄이 끊어졌다! 텐션이 빨개지면 손을 떼세요.',
  escaped: '물고기가 도망갔다! 줄이 너무 느슨했어요.',
}

function ResultCard({ state, caught }: { state: Extract<FishingState, { stage: 'done' }>; caught: FishInstance | null }) {
  const dex = useProgressStore((s) => s.dex)
  const spotId = useFishingStore((s) => s.spotId)

  const retry = () => {
    if (spotId) useFishingStore.getState().begin(spotId)
  }
  const quit = () => {
    useFishingStore.getState().end()
    useSessionStore.getState().setMode('explore')
  }

  let body
  if (state.result === 'caught' && caught) {
    const species = getSpecies(caught.speciesId)
    const isNew = dex[species.id]?.count === 1
    body = (
      <>
        {isNew && <div style={{ color: '#ffd166', fontWeight: 700 }}>새로운 물고기!</div>}
        <div style={{ width: 80, height: 40, borderRadius: '50%', background: species.color, margin: '12px auto' }} />
        <h2 style={{ margin: '4px 0' }}>{species.name}</h2>
        <div style={{ color: RARITY_COLOR[species.rarity] }}>{RARITY_LABEL[species.rarity]}</div>
        <div style={{ margin: '8px 0' }}>{caught.weight}kg</div>
        <div style={{ opacity: 0.8, fontSize: 14 }}>{species.description}</div>
      </>
    )
  } else {
    body = <h3>{state.result === 'caught' ? '' : FAIL_TEXT[state.result]}</h3>
  }

  return (
    <div style={{ ...panelBox, textAlign: 'center', width: 'min(360px, 90vw)' }}>
      {body}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
        <button style={button} onClick={retry}>
          다시 던지기
        </button>
        <button style={button} onClick={quit}>
          그만하기
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 9: World와 Game에 연결**

`src/game/scene/World.tsx`: import 추가 후 `<GearShop />` 아래에 추가

```tsx
import { FishingController } from './fishing/FishingController'
import { FishingVisuals } from './fishing/FishingVisuals'
import { PlayTimeTicker } from './PlayTimeTicker'
```

```tsx
      <GearShop />
      <FishingController />
      <FishingVisuals />
      <PlayTimeTicker />
```

`src/game/Game.tsx`: `import { FishingOverlay } from './ui/FishingOverlay'` 추가, `<Hud />` 아래에 `<FishingOverlay />` 추가

- [ ] **Step 10: 빌드·테스트 확인**

Run: `npm run build && npm test`
Expected: PASS

- [ ] **Step 11: 브라우저 확인**

Run: `npm run dev`
확인:
- 선착장 끝에서 E → 아래에 "누르고 있다가 떼서 던지기"와 파워 바. 누르면 바가 차고, 떼면 빨간 찌가 바다에 떨어지고 낚싯줄이 이어진다
- 짧게 누르면 가까이, 길게 누르면 멀리 떨어진다
- 찌가 둥실거리다 톡 잠기고(페이크) 크게 잠기며 "!"가 뜬다. 이때 클릭 → 텐션 게이지가 나타난다
- 페이크 때 클릭하거나 "!"를 놓치면 "놓쳤다!" 카드
- 계속 누르면 게이지가 빨개지고 "줄이 끊어졌다!", 아무것도 안 하면 "도망갔다!"
- 누르기/떼기를 조절해 거리를 0으로 만들면 물고기 카드(이름, 희귀도, 무게, 설명). 처음 잡은 종이면 "새로운 물고기!"
- 싸움 중 낚싯대가 텐션에 따라 휘고, 물고기가 당길 때 찌가 흔들린다
- "다시 던지기"로 바로 재시작, "그만하기"/ESC로 탐험 복귀
- 새로고침해도 콘솔에 에러가 없다

- [ ] **Step 12: 커밋**

```bash
git add -A
git commit -m "feat: 낚시 진행과 찌·낚싯줄·텐션 게이지 연출 추가"
```

---

### Task 11: 도감, 판매, 장비 상점 패널

**Files:**
- Create: `src/game/ui/DexPanel.tsx`, `src/game/ui/SellPanel.tsx`, `src/game/ui/GearShopPanel.tsx`
- Modify (전면 교체): `src/game/ui/Panels.tsx`

**Interfaces:**
- Consumes: `Panel`, `FISH_SPECIES`, `findSpecies`, `RARITY_LABEL`, `RARITY_COLOR`, `ZONES`, `GEAR`, `sellPrice`, `useProgressStore`(`dex`, `inventory`, `sellFish`, `gear`, `coins`, `buyGear`), `button`, `disabledButton`
- Produces: `<DexPanel />`, `<SellPanel />`, `<GearShopPanel />`

- [ ] **Step 1: 도감** — `src/game/ui/DexPanel.tsx`

```tsx
import { FISH_SPECIES, RARITY_COLOR, RARITY_LABEL } from '../data/fish'
import { ZONES } from '../data/zones'
import { useProgressStore } from '../stores/progressStore'
import { Panel } from './Panel'

export function DexPanel() {
  const dex = useProgressStore((s) => s.dex)
  const found = FISH_SPECIES.filter((s) => dex[s.id]).length

  return (
    <Panel title={`도감 ${found} / ${FISH_SPECIES.length}`}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
        {FISH_SPECIES.map((species) => {
          const entry = dex[species.id]
          const zoneNames = species.zones.map((z) => ZONES.find((zone) => zone.id === z)?.name).join(', ')
          return (
            <div key={species.id} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: 10, fontSize: 13 }}>
              <div style={{ width: 48, height: 24, borderRadius: '50%', background: entry ? species.color : '#333', marginBottom: 6 }} />
              {entry ? (
                <>
                  <strong>{species.name}</strong>
                  <div style={{ color: RARITY_COLOR[species.rarity] }}>{RARITY_LABEL[species.rarity]}</div>
                  <div style={{ opacity: 0.8, margin: '4px 0' }}>{species.description}</div>
                  <div>
                    최대 {entry.maxWeight}kg · {entry.count}마리
                  </div>
                </>
              ) : (
                <>
                  <strong>???</strong>
                  <div style={{ opacity: 0.6 }}>{zoneNames}</div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </Panel>
  )
}
```

- [ ] **Step 2: 판매** — `src/game/ui/SellPanel.tsx`

```tsx
import { RARITY_COLOR, findSpecies } from '../data/fish'
import { sellPrice } from '../logic/economy'
import { useProgressStore } from '../stores/progressStore'
import { Panel } from './Panel'
import { button } from './styles'

export function SellPanel() {
  const inventory = useProgressStore((s) => s.inventory)
  const sellFish = useProgressStore((s) => s.sellFish)

  const rows = inventory.flatMap((fish) => {
    const species = findSpecies(fish.speciesId)
    return species ? [{ fish, species, price: sellPrice(species, fish.weight) }] : []
  })
  const total = rows.reduce((sum, r) => sum + r.price, 0)

  return (
    <Panel title="물고기 팔기">
      {rows.length === 0 ? (
        <p>팔 물고기가 없어요. 낚시하러 가 볼까요?</p>
      ) : (
        <>
          <button style={{ ...button, width: '100%', marginBottom: 12 }} onClick={() => sellFish(rows.map((r) => r.fish.id))}>
            모두 팔기 (+{total} 코인)
          </button>
          {rows.map(({ fish, species, price }) => (
            <div key={fish.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #333' }}>
              <span style={{ color: RARITY_COLOR[species.rarity], flex: 1 }}>{species.name}</span>
              <span style={{ width: 70, textAlign: 'right' }}>{fish.weight}kg</span>
              <span style={{ width: 70, textAlign: 'right' }}>{price} 코인</span>
              <button style={button} onClick={() => sellFish([fish.id])}>
                팔기
              </button>
            </div>
          ))}
        </>
      )}
    </Panel>
  )
}
```

- [ ] **Step 3: 장비 상점** — `src/game/ui/GearShopPanel.tsx`

```tsx
import { GEAR } from '../data/gear'
import type { GearSlot } from '../data/types'
import { useProgressStore } from '../stores/progressStore'
import { Panel } from './Panel'
import { button, disabledButton } from './styles'

const SLOTS: GearSlot[] = ['line', 'reel', 'rod']

const VALUE_TEXT: Record<GearSlot, (value: number) => string> = {
  line: (v) => `최대 텐션 ${v}`,
  reel: (v) => `감기 속도 ${v}`,
  rod: (v) => `당김 충격 ${Math.round(v * 100)}%`,
}

export function GearShopPanel() {
  const gear = useProgressStore((s) => s.gear)
  const coins = useProgressStore((s) => s.coins)
  const buyGear = useProgressStore((s) => s.buyGear)

  return (
    <Panel title={`장비 상점 · 코인 ${coins}`}>
      {SLOTS.map((slot) => {
        const def = GEAR[slot]
        const level = gear[slot]
        const current = def.levels[level]
        const next = def.levels[level + 1]
        const affordable = next !== undefined && coins >= next.price
        return (
          <div key={slot} style={{ padding: '10px 0', borderBottom: '1px solid #333' }}>
            <div>
              <strong>{def.name}</strong> <span style={{ opacity: 0.7, fontSize: 13 }}>{def.description}</span>
            </div>
            <div style={{ fontSize: 14, margin: '4px 0' }}>
              지금: Lv{level + 1} {current.label} ({VALUE_TEXT[slot](current.value)})
            </div>
            {next ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                <span style={{ flex: 1 }}>
                  다음: Lv{level + 2} {next.label} ({VALUE_TEXT[slot](next.value)})
                </span>
                <button style={affordable ? button : disabledButton} disabled={!affordable} onClick={() => buyGear(slot)}>
                  {next.price} 코인
                </button>
              </div>
            ) : (
              <div style={{ fontSize: 14, color: '#ffd166' }}>최고 단계</div>
            )}
          </div>
        )
      })}
    </Panel>
  )
}
```

- [ ] **Step 4: Panels 교체** — `src/game/ui/Panels.tsx`

```tsx
import { useSessionStore } from '../stores/sessionStore'
import { DexPanel } from './DexPanel'
import { GearShopPanel } from './GearShopPanel'
import { MenuPanel } from './MenuPanel'
import { SellPanel } from './SellPanel'

/** 현재 mode에 맞는 패널 하나를 띄운다 */
export function Panels({ onExit }: { onExit?: () => void }) {
  const mode = useSessionStore((s) => s.mode)
  switch (mode) {
    case 'menu':
      return <MenuPanel onExit={onExit} />
    case 'dex':
      return <DexPanel />
    case 'sell':
      return <SellPanel />
    case 'shop':
      return <GearShopPanel />
    default:
      return null
  }
}
```

- [ ] **Step 5: 빌드·테스트 확인**

Run: `npm run build && npm test`
Expected: PASS

- [ ] **Step 6: 브라우저 확인**

Run: `npm run dev`
확인:
- "도감" 버튼/메뉴의 "도감" → 14칸, 안 잡은 종은 "???"와 서식 구역 이름, 잡은 종은 이름·희귀도·설명·최대 무게·마리 수
- 물고기를 몇 마리 잡고 빨간 상자에서 E → 목록과 가격. "팔기"로 한 마리씩, "모두 팔기"로 전부. 왼쪽 위 코인이 오른다
- 보관함이 비면 "팔 물고기가 없어요"
- 파란 가게에서 E → 장비 3종. 코인이 모자라면 버튼이 회색, 충분하면 노란색. 사면 코인이 줄고 Lv가 오른다. 최고 단계는 "최고 단계"
- 낚싯줄을 업그레이드한 뒤 낚시하면 게이지가 덜 빨리 찬다(같은 텐션에서 비율이 낮다)
- 새로고침해도 코인·장비·도감·보관함이 유지된다

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "feat: 도감, 판매, 장비 상점 패널 추가"
```

---

### Task 12: 최종 확인

**Files:** 없음 (확인만, 문제가 있으면 해당 Task의 파일 수정)

- [ ] **Step 1: 자동 검사 전체**

Run: `npm test && npm run lint && npm run build`
Expected: 모두 PASS. lint 경고가 있으면 내용을 보고(에러는 수정).

- [ ] **Step 2: 처음부터 플레이 확인**

브라우저 개발자 도구 → Application → Local Storage에서 `fishing-island-save-v1` 삭제 후 새로고침.
확인 시나리오:
1. 코인 0, 도감 0/14로 시작
2. 해변 두 포인트에서 낚시해 해변 4종 + 잡어 중 몇 종 잡기
3. 판매 → 150코인 모아 낚싯줄 Lv2 구매
4. 메뉴 → 로비로 나가기 → 콘솔에 `[dev] onExit 호출됨`
5. 새로고침 → 코인·장비·도감 유지
6. 다른 탭에 1분 이상 있다가 돌아왔을 때 진행 중이던 낚시가 한 번에 끝나 버리지 않는다

- [ ] **Step 3: 깨진 저장 데이터로 시작**

개발자 도구 콘솔에서 실행 후 새로고침:

```js
localStorage.setItem('fishing-island-save-v1', '{broken')
```

Expected: 게임이 정상적으로 뜨고 코인 0으로 시작(콘솔 경고는 허용, 에러 화면은 불가).

- [ ] **Step 4: 결과 보고**

통과/실패 항목과, 실제로 해 보니 너무 쉽거나 어려운 밸런스 수치(`src/game/data/balance.ts`, `gear.ts`)가 있으면 함께 적는다. 수치 조정은 이 계획 범위 밖이므로 기록만 한다.
