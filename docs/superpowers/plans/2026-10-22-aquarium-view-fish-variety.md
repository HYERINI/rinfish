# 낚시섬 어항 구경 모드·물고기 생김새·희귀 어종 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 어항을 화면 가득 크게 보는 모드, 23종 모두 서로 다른 생김새(모델·색·크기·소품), 희귀·에픽 어종 9종 추가.

**Architecture:** 어종 → 생김새 표(`data/fishLooks.ts`)를 한곳에 두고, 3D 물고기(`FishModel`)와 사진(`fishThumbnail`)이 같은 적용 함수(`scene/fishing/fishAppearance.ts`)를 쓴다. 소품은 three 기본 도형으로 만든 Group을 돌려주는 함수라서 R3F와 사진 렌더러 양쪽에서 쓴다. 어항 헤엄 경로는 순수 함수(`logic/aquariumSwim.ts`)로 빼서 게임 속 어항과 크게 보기 화면이 같이 쓴다.

**Tech Stack:** React 19, R3F 9, drei 10(OrbitControls), three 0.186, zustand 5, vitest, oxlint

**Spec:** `docs/superpowers/specs/2026-10-22-aquarium-view-fish-variety-design.md`

## Global Constraints

- 층 규칙: scene/ui → stores → logic → data. `logic/`은 React·three·zustand를 import하지 않는다
- 밸런스 값은 `src/game/data/`에만(연출 값 제외)
- 저장 키·버전 그대로. 어종 id는 늘어나기만 한다
- 모델은 CC0만, 출처는 `public/models/CREDITS.md`
- 3D 안의 한글은 drei `<Html>` + `zIndexRange={[100, 0]}`, UI 레이어는 zIndex 1000
- tsconfig: `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUnusedLocals`/`noUnusedParameters`
- 커밋 메시지: 타입만, 괄호 스코프 금지, 짧은 한국어 제목 + 본문, Co-Authored-By·AI 표기 금지

## Review Focus

1. **동굴에 에픽(수정 눈 동굴어)이 들어가면 전설 확률이 1/9로 떨어진다** → 동굴은 전설이 주로 나와야 한다(엔딩 조건). 구역별 희귀도 가중치 덮어쓰기로 막고 Task 1 테스트로 고정한다.
2. **생김새 표에 없는 어종(새 어종을 데이터에 먼저 넣은 경우)** → 기본 생김새로 그려지고 깨지지 않는다. Task 1 테스트(`fishLookFor` 기본값)로 고정한다.
3. **크게 보기에서 ESC** → 게임 탐험으로 튀어 나가지 않고 어항 패널로 돌아간다. Task 1 `resolveKeyAction` 테스트로 고정한다.
4. **크게 보기에서 휠** → 게임 카메라 줌이 바뀌지 않는다. Task 1 `canZoom` 테스트로 고정한다.
5. **같은 모델을 여러 어종·여러 마리가 동시에 쓸 때 색이 섞인다**(재질 공유) → 인스턴스마다 재질을 복제한다. Task 2 캡처(같은 모델 두 어종을 한 장면에)로 확인한다.

---

### Task 1: 어종·생김새 데이터와 규칙

**Files:**
- Modify: `src/game/data/fish.ts`, `src/game/data/balance.ts`, `src/game/logic/catchTable.ts`, `src/game/logic/catchTable.test.ts`
- Create: `src/game/data/fishLooks.ts`, `src/game/data/fishLooks.test.ts`
- Create: `src/game/logic/aquariumSwim.ts`, `src/game/logic/aquariumSwim.test.ts`
- Modify: `src/game/logic/interaction.ts`, `src/game/logic/interaction.test.ts`, `src/game/logic/cameraZoom.test.ts`

**Interfaces:**
- Produces:
  - 새 어종 9종(아래 표의 id)
  - `ZONE_RARITY_WEIGHTS: Partial<Record<ZoneId, Partial<Record<Rarity, number>>>>`
  - `FishModelId`, `FISH_MODEL_FILES: Record<FishModelId, string>`, `FishAccessoryKind`, `FishLook`, `FISH_LOOKS: Record<string, FishLook>`, `DEFAULT_FISH_LOOK`, `fishLookFor(speciesId: string | null): FishLook`
  - `swimPose(time, seed, half, hungry, sinceFed): { x; y; z; heading; tilt }`, `FEEDING_SHOW_SECONDS`
  - `Mode`에 `'aquariumView'`; ESC in aquariumView → `{ type: 'openMode', mode: 'aquarium' }`

- [ ] **Step 1: 새 어종**

`src/game/data/fish.ts`의 `FISH_SPECIES`에 구역별로 기존 어종 뒤에 끼워 넣는다(해변 블록 끝, 연못 블록 끝, 암초 블록 끝, 동굴 블록 끝 — 잡어는 맨 뒤 유지):

```ts
  // 해변
  { id: 'selfie-flyingfish', name: '셀카 날치', description: '물 위로 튀어 오를 때마다 셀카를 찍는다.', zones: ['beach'], rarity: 'rare', pattern: 'dasher', strength: 4, weightRange: [0.3, 0.9], basePrice: 45, color: '#ffd54f' },
  { id: 'lifeguard-flounder', name: '구조대 가자미', description: '빨간 구명튜브를 두르고 해변을 순찰한다.', zones: ['beach'], rarity: 'epic', pattern: 'endurance', strength: 6, weightRange: [1, 4], basePrice: 140, color: '#a1887f' },
  // 연못
  { id: 'professor-crucian', name: '안경 박사 붕어', description: '동그란 안경을 쓴, 연못에서 제일 똑똑한 붕어.', zones: ['pond'], rarity: 'rare', pattern: 'erratic', strength: 4, weightRange: [0.3, 1.2], basePrice: 50, color: '#a1887f' },
  { id: 'frog-prince-carp', name: '개구리 왕자 잉어', description: '개구리 모자 위에 작은 왕관. 뽀뽀하면 뭐가 될까.', zones: ['pond'], rarity: 'rare', pattern: 'endurance', strength: 5, weightRange: [1, 3], basePrice: 55, color: '#9ccc65' },
  { id: 'sleepy-catfish-king', name: '잠꾸러기 메기왕', description: '수면 모자를 쓰고 졸다가 갑자기 돌진한다.', zones: ['pond'], rarity: 'epic', pattern: 'dasher', strength: 7, weightRange: [4, 10], basePrice: 160, color: '#455a64' },
  // 암초
  { id: 'reggae-lionfish', name: '레게 쏠배감펭', description: '지느러미가 레게 머리처럼 휘날린다.', zones: ['reef'], rarity: 'rare', pattern: 'erratic', strength: 5, weightRange: [0.5, 1.5], basePrice: 65, color: '#ef6c00' },
  { id: 'astronaut-angler', name: '우주비행사 아귀', description: '헬멧 속 초롱이 별처럼 빛난다.', zones: ['reef'], rarity: 'epic', pattern: 'endurance', strength: 8, weightRange: [3, 8], basePrice: 220, color: '#37474f' },
  { id: 'ninja-ray', name: '닌자 가오리', description: '검은 복면. 눈 깜짝할 새 사라진다.', zones: ['reef'], rarity: 'epic', pattern: 'erratic', strength: 8, weightRange: [5, 15], basePrice: 230, color: '#263238' },
  // 동굴
  { id: 'crystal-eye-cavefish', name: '수정 눈 동굴어', description: '눈 대신 빛나는 수정. 동굴에만 산다.', zones: ['cave'], rarity: 'epic', pattern: 'erratic', strength: 8, weightRange: [1, 3], basePrice: 260, color: '#b2ebf2' },
```

- [ ] **Step 2: 동굴 전설 확률 지키기 (실패하는 테스트 먼저)**

`catchTable.test.ts`의 `'동굴에서는 항상 전설의 물고기가 나온다'` 테스트를 다음으로 바꾼다:

```ts
  it('동굴에서는 에픽이 같이 살아도 전설이 가장 많이 나온다 (세게 던져 에픽이 3배가 되어도 40% 이상)', () => {
    const legendShare = (power: number) => {
      const table = catchWeights('cave', power)
      const total = table.reduce((sum, e) => sum + e.weight, 0)
      return table.filter((e) => e.species.rarity === 'legendary').reduce((sum, e) => sum + e.weight, 0) / total
    }
    expect(legendShare(0)).toBeGreaterThan(0.6)
    expect(legendShare(1)).toBeGreaterThanOrEqual(0.4)
  })

  it('새 어종도 자기 구역에서 나온다', () => {
    const ids = (zone: 'beach' | 'pond' | 'reef' | 'cave') => catchWeights(zone, 0.5).map((e) => e.species.id)
    expect(ids('beach')).toContain('selfie-flyingfish')
    expect(ids('pond')).toContain('sleepy-catfish-king')
    expect(ids('reef')).toContain('ninja-ray')
    expect(ids('cave')).toContain('crystal-eye-cavefish')
  })
```

Run: `npx vitest run src/game/logic/catchTable.test.ts` → 전설 비율 테스트 FAIL 확인.

`src/game/data/balance.ts`의 `RARITY_WEIGHTS` 아래에 추가:

```ts
/** 구역별 희귀도 가중치 덮어쓰기. 동굴은 전설을 노리는 곳이라 같이 사는 에픽보다 전설이 잘 나온다 */
export const ZONE_RARITY_WEIGHTS: Partial<Record<ZoneId, Partial<Record<Rarity, number>>>> = {
  cave: { legendary: 16 },
}
```

(`ZoneId` import 추가). `catchTable.ts`의 `rarityWeight`에 구역을 넘겨 `const base = ZONE_RARITY_WEIGHTS[zone]?.[rarity] ?? RARITY_WEIGHTS[rarity]`로 바꾼다. Run → PASS.

- [ ] **Step 3: 생김새 표 (실패하는 테스트 먼저)**

`src/game/data/fishLooks.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { FISH_SPECIES } from './fish'
import { DEFAULT_FISH_LOOK, FISH_LOOKS, FISH_MODEL_FILES, fishLookFor } from './fishLooks'

describe('fishLooks', () => {
  it('모든 어종에 생김새가 있고, 모델은 실제 파일 목록에 있다', () => {
    for (const s of FISH_SPECIES) {
      const look = FISH_LOOKS[s.id]
      expect(look, s.id).toBeDefined()
      expect(FISH_MODEL_FILES[look.model], s.id).toBeDefined()
      expect(look.size).toBeGreaterThan(0)
    }
  })

  it('같은 모델을 쓰는 어종은 색·크기·소품 중 하나 이상이 다르다', () => {
    const seen = new Map<string, string>()
    for (const [id, look] of Object.entries(FISH_LOOKS)) {
      const key = `${look.model}|${look.tint ?? ''}|${look.glow ?? ''}|${look.size}|${look.accessory ?? ''}`
      expect(seen.has(key), `${id} 와 ${seen.get(key)} 가 똑같이 생겼다`).toBe(false)
      seen.set(key, id)
    }
  })

  it('표에 없는 어종은 기본 생김새', () => {
    expect(fishLookFor('no-such-fish')).toEqual(DEFAULT_FISH_LOOK)
    expect(fishLookFor(null)).toEqual(DEFAULT_FISH_LOOK)
  })
})
```

`src/game/data/fishLooks.ts`:

```ts
/** 물고기 3D 모델 (public/models/fish/ 아래 CC0 glb). 머리는 +z */
export type FishModelId =
  | 'puffer' | 'tuna' | 'blue-tang' | 'cardinal' | 'tang' | 'tetra' | 'armored-catfish' | 'trout' | 'koi'
  | 'red-snapper' | 'blobfish' | 'goblin-shark' | 'goldfish' | 'mackerel' | 'yellow-tang' | 'flatfish'
  | 'blue-goldfish' | 'flowerhorn' | 'lionfish' | 'anglerfish' | 'manta' | 'betta'

export const FISH_MODEL_FILES: Record<FishModelId, string> = {
  puffer: 'fish/puffer.glb',
  tuna: 'fish/tuna.glb',
  'blue-tang': 'fish/blue-tang.glb',
  cardinal: 'fish/cardinal.glb',
  tang: 'fish/tang.glb',
  tetra: 'fish/tetra.glb',
  'armored-catfish': 'fish/armored-catfish.glb',
  trout: 'fish/trout.glb',
  koi: 'fish/koi.glb',
  'red-snapper': 'fish/red-snapper.glb',
  blobfish: 'fish/blobfish.glb',
  'goblin-shark': 'fish/goblin-shark.glb',
  goldfish: 'fish/goldfish.glb',
  mackerel: 'fish/mackerel.glb',
  'yellow-tang': 'fish/yellow-tang.glb',
  flatfish: 'fish/flatfish.glb',
  'blue-goldfish': 'fish/blue-goldfish.glb',
  flowerhorn: 'fish/flowerhorn.glb',
  lionfish: 'fish/lionfish.glb',
  anglerfish: 'fish/anglerfish.glb',
  manta: 'fish/manta.glb',
  betta: 'fish/betta.glb',
}

export type FishAccessoryKind =
  | 'sunglasses' | 'eyepatch' | 'crown' | 'frogCrown' | 'roundGlasses' | 'headband' | 'nightcap'
  | 'lifebuoy' | 'spaceHelmet' | 'ninjaMask' | 'dreadlocks' | 'crystal' | 'selfieStick'

export type FishLook = {
  model: FishModelId
  /** 재질에 곱하는 색 */
  tint?: string
  /** 스스로 빛나는 색 (발광) */
  glow?: string
  /** 몸길이 배율 (기본 1) */
  size: number
  accessory?: FishAccessoryKind
  /** 소품 위치 보정 [x, y, z] (몸길이 1.2로 맞춘 물고기 기준, 머리 +z). 없으면 소품 기본 위치 */
  accessoryAt?: [number, number, number]
}

export const DEFAULT_FISH_LOOK: FishLook = { model: 'blue-tang', size: 1 }

export const FISH_LOOKS: Record<string, FishLook> = {
  'sleepy-sardine': { model: 'cardinal', tint: '#b0c4d4', size: 0.8 },
  'chatty-mackerel': { model: 'tang', size: 0.9 },
  'bubble-puffer': { model: 'puffer', size: 0.9 },
  'sunglasses-mackerel': { model: 'blue-tang', tint: '#5c6b75', size: 1, accessory: 'sunglasses' },
  'selfie-flyingfish': { model: 'yellow-tang', size: 0.9, accessory: 'selfieStick' },
  'lifeguard-flounder': { model: 'flatfish', size: 1.1, accessory: 'lifebuoy' },
  'firefly-minnow': { model: 'tetra', glow: '#c6ff00', size: 0.7 },
  'ribbit-catfish': { model: 'armored-catfish', tint: '#8d6e63', size: 1 },
  'rainbow-trout': { model: 'trout', size: 1 },
  'moss-carp': { model: 'koi', tint: '#7cb342', size: 1.2 },
  'professor-crucian': { model: 'blue-goldfish', tint: '#a1887f', size: 0.9, accessory: 'roundGlasses' },
  'frog-prince-carp': { model: 'flowerhorn', tint: '#9ccc65', size: 1, accessory: 'frogCrown' },
  'sleepy-catfish-king': { model: 'armored-catfish', tint: '#455a64', size: 1.4, accessory: 'nightcap' },
  'buff-seabream': { model: 'red-snapper', size: 1, accessory: 'headband' },
  'disco-jelly': { model: 'blobfish', tint: '#e1bee7', glow: '#ff4fd8', size: 0.9 },
  'pirate-tuna': { model: 'tuna', size: 1.3, accessory: 'eyepatch' },
  'thunder-eel': { model: 'goblin-shark', tint: '#ffee58', glow: '#ffd600', size: 1.2 },
  'reggae-lionfish': { model: 'lionfish', size: 1, accessory: 'dreadlocks' },
  'astronaut-angler': { model: 'anglerfish', size: 1.2, accessory: 'spaceHelmet' },
  'ninja-ray': { model: 'manta', tint: '#263238', size: 1.3, accessory: 'ninjaMask' },
  'golden-crown-carp': { model: 'goldfish', tint: '#ffd54f', glow: '#ff8f00', size: 1.5, accessory: 'crown' },
  'crystal-eye-cavefish': { model: 'betta', tint: '#e0f7fa', size: 1, accessory: 'crystal' },
  'lost-anchovy': { model: 'mackerel', tint: '#b0bec5', size: 0.6 },
}

export function fishLookFor(speciesId: string | null): FishLook {
  return (speciesId && FISH_LOOKS[speciesId]) || DEFAULT_FISH_LOOK
}
```

Run: `npx vitest run src/game/data/fishLooks.test.ts` → PASS.

- [ ] **Step 4: 헤엄 경로 순수 함수 (실패하는 테스트 먼저)**

`src/game/logic/aquariumSwim.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { FEEDING_SHOW_SECONDS, swimPose } from './aquariumSwim'

const half: [number, number, number] = [2, 1, 1]

describe('swimPose', () => {
  it('늘 어항 안에 있다', () => {
    for (let t = 0; t < 50; t += 0.37) {
      const p = swimPose(t, 3, half, false, 999)
      expect(Math.abs(p.x)).toBeLessThanOrEqual(half[0])
      expect(Math.abs(p.y)).toBeLessThanOrEqual(half[1])
      expect(Math.abs(p.z)).toBeLessThanOrEqual(half[2])
    }
  })

  it('배고프면 바닥 가까이 가라앉아 옆으로 눕는다', () => {
    const p = swimPose(5, 1, half, true, 999)
    expect(p.y).toBeCloseTo(-0.8)
    expect(p.tilt).toBeCloseTo(Math.PI / 2)
  })

  it('먹이를 막 주면 수면 가운데로 몰려든다', () => {
    const p = swimPose(5, 1, half, false, FEEDING_SHOW_SECONDS / 2)
    expect(p.y).toBeCloseTo(0.75)
    expect(Math.abs(p.x)).toBeLessThanOrEqual(half[0] * 0.25)
  })
})
```

`src/game/logic/aquariumSwim.ts`:

```ts
/** 먹이를 준 뒤 물고기들이 수면 가운데로 몰려드는 시간(초) */
export const FEEDING_SHOW_SECONDS = 5

export type SwimPose = { x: number; y: number; z: number; heading: number; tilt: number }

/**
 * 어항 안 8자 헤엄 경로. half: 어항 안쪽 절반 크기, seed: 물고기마다 다른 경로,
 * hungry: 바닥에 가라앉아 옆으로 눕는다, sinceFed: 먹이 준 뒤 지난 초 (짧으면 수면으로 몰려든다)
 */
export function swimPose(time: number, seed: number, half: [number, number, number], hungry: boolean, sinceFed: number): SwimPose {
  const t = time * (hungry ? 0.15 : 0.5) + seed * 2.1
  const [hx, hy, hz] = half
  let x = Math.sin(t) * hx * 0.75
  let z = Math.sin(t * 2) * hz * 0.5
  let y = Math.sin(t * 0.7 + seed) * hy * 0.4
  if (hungry) y = -hy * 0.8
  if (sinceFed < FEEDING_SHOW_SECONDS) {
    x *= 0.25
    z *= 0.25
    y = hy * 0.75
  }
  // 경로의 진행 방향을 바라보게 한다 (머리 +z)
  const heading = Math.atan2(Math.cos(t) * hx * 0.75, Math.cos(t * 2) * 2 * hz * 0.5)
  return { x, y, z, heading, tilt: hungry ? Math.PI / 2 : 0 }
}
```

Run → PASS.

- [ ] **Step 5: 크게 보기 모드 규칙 (실패하는 테스트 먼저)**

`interaction.test.ts`의 `resolveKeyAction` describe 끝에:

```ts
  it('어항 크게 보기에서 ESC를 누르면 어항 패널로 돌아간다', () => {
    expect(resolveKeyAction('Escape', 'aquariumView', null)).toEqual({ type: 'openMode', mode: 'aquarium' })
  })
```

`cameraZoom.test.ts`의 `canZoom` 테스트의 막는 모드 목록에 `'aquariumView'`를 더한다.

`interaction.ts`: `Mode`에 `| 'aquariumView'`, Escape 분기에서 `panelLocked` 다음에 `if (mode === 'aquariumView') return { type: 'openMode', mode: 'aquarium' }`. (`canZoom`은 이미 탐험·낚시·휴식만 허용하므로 코드 변경 없이 테스트만 통과하면 된다.)

Run: `npx vitest run && npx tsc -b` → PASS (`ui/Hud.tsx` 등 `Mode`를 쓰는 곳에서 타입 에러가 나면 맞게 고친다)

- [ ] **Step 6: 커밋**

```bash
git add src/game
git commit -m "feat: 새 어종 9종과 물고기 생김새 표 추가" -m "희귀·에픽 어종 9종을 구역별로 더하고, 동굴은 같이 사는 에픽보다 전설이 잘 나오도록 구역별 희귀도 가중치를 덮어쓴다. 어종마다 모델·색·발광·크기·소품을 정한 생김새 표, 게임 속 어항과 크게 보기가 같이 쓸 헤엄 경로 함수, 크게 보기 모드(ESC로 어항 패널 복귀)를 추가했다."
```

---

### Task 2: 물고기 모델 에셋과 생김새 적용

**Files:**
- Create: `public/models/fish/*.glb` (22개), Modify: `public/models/CREDITS.md`
- Delete: `public/models/clownfish.glb`, `shark.glb`, `swordfish.glb`, `dolphin.glb` (더 안 씀). `puffer.glb`, `tuna.glb`, `blue-tang.glb`는 `public/models/fish/`로 `git mv`
- Create: `src/game/scene/fishing/fishAppearance.ts`
- Modify: `src/game/scene/fishing/fishModels.ts`, `FishModel.tsx`, `fishThumbnail.ts`

**Interfaces:**
- Consumes: Task 1 `fishLookFor`, `FISH_MODEL_FILES`, `FishLook`, `FishAccessoryKind`
- Produces:
  - `fishModelUrl(model: FishModelId): string`
  - `applyFishLook(object: Object3D, look: FishLook): void` (재질을 복제해 색·발광 적용)
  - `buildAccessory(kind: FishAccessoryKind): Group` (몸길이 1.2 물고기 기준 크기, 머리 +z, 원점이 머리 위 부착점)
  - `FishModel` 그대로(`speciesId`, `scale?`) — 생김새는 speciesId로 알아서

- [ ] **Step 1: 모델 받기**

poly.pizza CC0 모델(조사 때 각 페이지에서 "Licence: CC0 1.0" 확인, 제작 Quaternius). 파일은 `https://static.poly.pizza/<id>.glb`:

| 파일 | id |
|---|---|
| cardinal | YyZyVhg2Jq |
| tang | D36zsP5ESu |
| tetra | l6AhogdZHe |
| armored-catfish | mtd9QK5yCe |
| trout | XWl86YFtpF |
| koi | qyGtRmhgzl |
| red-snapper | BRKfDKwPTv |
| blobfish | 7Jh8vsARfN |
| goblin-shark | JQrBevTzgD |
| goldfish | qS6CgsWFAh |
| mackerel | uassUTYYae (애니메이션 없음) |
| yellow-tang | CrDlkPLon0 |
| flatfish | X5EjEA6fMF |
| blue-goldfish | imxZBHZ1yS |
| flowerhorn | ExfO0SGWmf |
| lionfish | czsz9Baw86 |
| anglerfish | MRjSlwCjHM |
| manta | yzD8b7ZHZm (클립 `Armature|Swim`) |
| betta | Vg8IlYjdZi |

(조사 때 받은 사본이 `/private/tmp/claude-501/-Users-ihyelin-proten-hrlee-----threejs/e476c70e-362f-4ed3-9ff7-d8664da04e4b/scratchpad/fishresearch/glb/<id>.glb`에 있다.) 각 모델 페이지에서 CC0를 다시 확인하고 `public/models/fish/<파일>.glb`로 둔다. `CREDITS.md`의 물고기 표를 새 목록(파일·id·애니메이션 여부)으로 바꾼다.

- [ ] **Step 2: 생김새 적용 함수**

`src/game/scene/fishing/fishAppearance.ts`:
- `applyFishLook(object, look)`: `object.traverse`로 메시 재질을 **인스턴스마다 복제**하고, `look.tint`가 있으면 `material.color.set(tint)`(원래 색과 곱해지게 `multiply`가 아니라 텍스처 모델이면 `color` 곱, 색만 있는 재질이면 원래 색에 `multiply`), `look.glow`가 있으면 `material.emissive.set(glow)`, `emissiveIntensity = 0.6`.
- `buildAccessory(kind)`: three 기본 도형(Box/Cylinder/Torus/Sphere/Cone)으로 소품 Group을 만든다. 크기는 몸길이 1.2 물고기 기준. 원점은 "머리 위 부착점", +z가 앞(얼굴 쪽).
  - sunglasses: 검은 렌즈 둘(납작한 상자) + 다리, 얼굴 앞쪽
  - eyepatch: 검은 원판 하나 + 끈(가는 토러스), 두건은 빨간 반구
  - crown: 금색 원통 테 + 뾰족한 원뿔 5개, 금속 질감
  - frogCrown: 초록 반구(개구리 모자) + 흰 눈 둘 + 작은 금관
  - roundGlasses: 가는 토러스 둘 + 다리
  - headband: 빨간 토러스(머리 둘레)
  - nightcap: 파란 원뿔(끝이 휘게 두 조각) + 흰 방울
  - lifebuoy: 빨강·흰 줄무늬 토러스(몸통 가운데에 두를 수 있게 큼직하게)
  - spaceHelmet: 반투명 구 + 위로 뻗은 대 끝에 빛나는 공(emissive)
  - ninjaMask: 눈 부분만 뚫린 검은 띠(두꺼운 토러스) + 뒤로 날리는 끈
  - dreadlocks: 머리 뒤로 늘어진 갈색·노랑·초록 원통 여러 개
  - crystal: 빛나는 하늘색 팔면체(OctahedronGeometry) 둘(눈 자리)
  - selfieStick: 가는 원통 + 끝의 작은 폰(상자, 화면 발광)
- 소품 기본 위치는 종류별 상수(예: 머리 위 `[0, 0.2, 0.3]`, 눈 높이 `[0, 0.05, 0.4]`)로 두고, `look.accessoryAt`가 있으면 그 값을 쓴다.

- [ ] **Step 3: 모델·사진에 적용**

- `fishModels.ts`: 어종→모델 표를 지우고 `fishModelUrl(model)`만 남긴다(`${BASE_URL}models/${FISH_MODEL_FILES[model]}`). 어종은 `fishLookFor`로 찾는다.
- `FishModel.tsx`: `const look = fishLookFor(speciesId)`. 모델 `useGLTF(fishModelUrl(look.model))`, 복제 뒤 `applyFishLook`, 몸길이 1.2로 맞춘 그룹 안에 `look.size` 배율 그룹, 그 안에 모델과 `<primitive object={useMemo(() => buildAccessory(kind))} position={accessoryAt} />`. 애니메이션은 `Fish_Armature|Swimming_Fast` ?? `Armature|Swim` ?? 첫 클립 ?? 없음(정적 모델 허용). 미리 받기(preload)는 하지 않는다(모델이 많아져서 필요할 때 받는다).
- `fishThumbnail.ts`: 캐시 키를 **어종 id**로 바꾸고, 모델을 불러온 뒤 `applyFishLook` + `buildAccessory`를 같은 위치에 붙여서 그린다.

- [ ] **Step 4: 화면 확인과 소품 위치 맞추기**

`npx vite --port 5197 --strictPort` + headless Chrome(`--headless=new --use-angle=swiftshader --enable-unsafe-swiftshader`, 새 프로필)으로:
1. 23종을 한 장면에 줄 세운 캡처(임시 디버그 화면, 커밋하지 않음). 옆·앞 두 방향. 소품이 머리에 제대로 붙었는지, 크기·색이 맞는지 보고 `FISH_LOOKS`의 `accessoryAt`·`size`를 고친다.
2. 같은 모델 두 어종(메기·메기왕)이 동시에 나올 때 색이 섞이지 않는지.
3. 도감(여러 어종을 잡은 상태)과 결과 카드 사진.
4. 낚아 올린 장면(크기·소품).

- [ ] **Step 5: 커밋**

```bash
git add -A public/models src/game
git commit -m "feat: 어종마다 다른 물고기 생김새" -m "Quaternius CC0 물고기 모델 19종을 더해 23종이 각자 어울리는 모델을 쓰고, 같은 모델을 쓰는 어종은 색·발광·크기·소품(선글라스, 안대, 금관, 수면 모자, 우주 헬멧 등 13가지)으로 구분한다. 결과 카드·도감 사진도 같은 생김새로 그린다. 안 쓰는 모델 4개는 지웠다."
```

---

### Task 3: 어항 크게 보기 화면

**Files:**
- Create: `src/game/ui/AquariumView.tsx`
- Modify: `src/game/scene/facilities/Aquarium.tsx` (수조 몸체·장식을 export해서 재사용), `src/game/scene/facilities/AquariumFish.tsx` (swimPose 사용, 크기 1.5배), `src/game/ui/AquariumPanel.tsx`, `src/game/ui/Panels.tsx`

**Interfaces:**
- Consumes: `swimPose`, `FEEDING_SHOW_SECONDS` (Task 1), `FishModel` (Task 2), `FishImage`, 스토어 `aquarium`, `playTime`, `isHungry`

- [ ] **Step 1: 게임 속 어항이 swimPose 쓰기**

`AquariumFish.tsx`의 경로 계산을 `swimPose(clock.elapsedTime, seed, half, hungry, sinceFed)`로 바꾸고, 위치는 지금처럼 `lerp`, `rotation.y = heading`, `rotation.z = tilt`. `FISH_SCALE`을 0.32 → 0.48로. `FEEDING_SECONDS` 상수는 지우고 `FEEDING_SHOW_SECONDS`를 쓴다.

- [ ] **Step 2: 수조 몸체 재사용**

`Aquarium.tsx`에서 물·유리·바닥·장식을 그리는 부분을 `export function TankBody({ type, size }: { type: TankTypeId; size: [number, number, number] })`로 빼서(받침대·구경꾼·간판·상호작용 영역은 제외) `Aquarium`과 크게 보기가 같이 쓴다.

- [ ] **Step 3: 크게 보기 화면**

`src/game/ui/AquariumView.tsx`:
- 전체 화면 div(`position: absolute; inset: 0; zIndex: 1000; background: #0b1622`) 안에 `<Canvas camera={{ position: [0, 0.6, 7.5], fov: 40 }}>`.
- 조명(앰비언트 + 디렉셔널), `<TankBody type={aquarium.activeType} size={VIEW_TANK} />` (`VIEW_TANK = [8, 4, 4]`, 원점 가운데).
- 전시 물고기마다 `ViewFish`: `swimPose(t, i, [3.6, 1.7, 1.6], hungry, sinceFed)`로 움직이고 `FishModel scale={1}`. 그룹에 `onClick={(e) => { e.stopPropagation(); onSelect(fish.id) }}`, 마우스 올리면 커서 pointer.
- `<OrbitControls enablePan={false} minDistance={4} maxDistance={14} target={[0, 0, 0]} />` (drei). 빈 곳 클릭(`onPointerMissed`)이면 선택 해제.
- 선택한 물고기 카드: 화면 아래 가운데 HTML(`FishImage` 사진 + 이름(희귀도 색) + 희귀도 라벨 + 무게 + 설명 + X 버튼).
- 비어 있으면 가운데에 "아직 전시한 물고기가 없어요. 낚시해서 전시해 보세요" 안내(수조는 그대로 보인다).
- 오른쪽 위 "닫기 (ESC)" 버튼 → `setMode('aquarium')`.
- 위쪽 가운데에 어항 이름·전시 수·배고픔 상태 한 줄.
- 값 읽기: `aquarium`, `playTime`(1초마다 바뀜)으로 `hungry = isHungry(...)`, `sinceFed = playTime - aquarium.lastFedAt`.

`AquariumPanel.tsx` 위쪽(입장료 버튼 줄 앞)에 `🔍 크게 보기` 버튼 → `setMode('aquariumView')`. `Panels.tsx`에 `case 'aquariumView': return <AquariumView />`.

- [ ] **Step 4: 확인**

`npx tsc -b && npx vitest run && npm run lint && npm run build` 통과. headless 캡처: 물고기 여러 마리(서로 다른 어종 5마리 이상) 크게 보기, 물고기 클릭 → 카드, 빈 어항, 배고픔(바닥), 먹이 직후(수면), 휠 줌 후 게임 카메라 줌(`sessionStore.zoom`)이 그대로인지, ESC → 어항 패널, 게임 속 어항 물고기 크기.

- [ ] **Step 5: 커밋**

```bash
git add src/game
git commit -m "feat: 어항 크게 보기 화면" -m "어항 패널의 크게 보기 버튼으로 화면 가득 큰 수조를 연다. 전시한 물고기가 크게 헤엄치고, 끌어서 돌리고 휠로 확대·축소하며, 물고기를 클릭하면 이름·희귀도·무게·설명 카드가 뜬다. 게임 속 어항과 같은 헤엄 경로 함수를 쓰고, 게임 속 어항 물고기도 1.5배로 키웠다."
```

---

## 마무리 확인

- `npx vitest run`, `npx tsc -b`, `npm run lint`, `npm run build`
- 브라우저 한 바퀴: 낚시 → 결과 카드 생김새 → 도감 → 어항 전시 → 크게 보기 → 클릭 카드 → ESC
