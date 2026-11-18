# 초원 + 배로 건너기 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 은지 게임(Room Sim)의 맵을 낚시섬 R3F 세계 동쪽 200m 에 180° 돌려 띄우고, 배를 타고 로딩 없이 두 땅을 오간다.

**Architecture:** 은지 코드(vanilla three)를 `src/meadow/vendor/` 에 복사해 `createWorld()` 가 만든 `THREE.Group` 을 R3F `<primitive>` 로 붙인다. 은지 충돌 상자(Box3)는 순수 함수로 세계 좌표 Rapier 상자로 바꾼다. 땅 판정·뱃길·지도 좌표·저장 위치는 모두 `src/game/logic/` 의 순수 함수로 두고 vitest 로 검증한다. 조명은 은지 해·하늘빛·DayNight(정오 고정)로 통일한다.

**Tech Stack:** React 19, @react-three/fiber 9, @react-three/rapier 2, three 0.186, zustand 5, vitest 5, oxlint, Cloudflare Workers(방 서버).

**Spec:** `docs/superpowers/specs/2026-11-17-meadow-boat-design.md`

## Global Constraints

- 브랜치 `feat/meadow-boat`. 1·2단계를 모두 끝낸 뒤 main 에 한 번에 합친다. main push = Vercel 자동 배포라 **main 에는 사람이 승인한 뒤에만** 합친다.
- 서버 배포(`npm run server:deploy`)·브랜치 push·main 합치기는 바깥에 영향을 주므로 **사용자에게 먼저 묻는다**.
- 좌표 변환: 세계 `(x, z) = (200 - x_은지, -z_은지)`. 코드는 `<group position={[200, 0, 0]} rotation-y={Math.PI}>`.
- 초원 땅(세계): x 90..290, z -110..90. 걸을 수 있는 땅은 1m 안쪽(x 91..289, z -109..89). 섬은 원점 반지름 `ISLAND_RADIUS` 30, 걸을 수 있는 원은 29.
- `WATER_Y` -0.3. 땅 윗면 y 0.
- 초원 선착장: 세계 x 84..90, z -3.5..-0.5. 섬 선착장: 기존 x -1.7..1.7, z 20.8..30.
- 뱃길 경유점: (82, -2) → (55, 18) → (25, 40) → (0, 32). 약 12초, 출발·도착 1초씩 가감속.
- 시작 자리: 은지 (12, 12) → 세계 (188, -12).
- `NET.coordLimit` 400. `NetState.boat?: { dir: 'toIsland' | 'toMeadow'; t: number }`.
- 은지 복사본을 고친 줄마다 `// rinfish:` 주석. 복사한 커밋 `f3c3808`.
- oxlint 경고 기준선 **6** 을 늘리지 않는다(`src/meadow/vendor/**` 는 검사에서 뺀다). 테스트 기준선 46 파일 / 464 개 통과.
- 컴포넌트 파일(.tsx)은 컴포넌트만 export 한다(`react/only-export-components` 경고가 늘지 않게). 상수·함수는 .ts 로.
- hook 에 넘긴 값(`useMemo` 결과 등)을 `useFrame` 에서 고치지 않는다(`react(immutability)` 경고). 매 프레임 고치는 값은 모듈 변수로 둔다(Player.tsx 처럼).
- 커밋 메시지: `feat:`/`fix:`/`docs:`/`test:`/`chore:` 처럼 타입만, 제목 짧게, 자세한 건 본문. Co-Authored-By·AI 생성 표기 금지.
- 코드 주석·UI 글은 한국어, 지금 코드의 말투(평서형, 짧게)를 따른다.

## Review Focus

1. **늦게 온 모델 상자가 세계 좌표로 섞이는 것** — `world.group` 을 모델이 다 들어오기 전에 변환 그룹 아래 붙이면 가구·나무 충돌 상자가 엉뚱한 곳(은지 좌표가 아닌 세계 좌표를 한 번 더 변환)에 생긴다. Task 5 의 `meadowReady()` 뒤에만 붙이는지, 모델 하나가 실패해도(`allSettled`) 초원이 붙는지 본다.
2. **배 타는 중 새로고침·탭 숨김** — 1초 저장과 `visibilitychange`/`pagehide` 저장 모두 배 위 자리를 저장하면 다음에 바다 한가운데(땅 밖)에서 시작해 `START_PLACE` 로 튄다. 타는 중엔 저장하지 않아 출발한 선착장에서 이어야 한다(Task 7 테스트 + meadow-check 4).
3. **초원에 저장된 "벤치 쉬기"** — `resting: true` 가 초원 자리와 함께 저장돼 있으면 들어오자마자 섬 벤치로 순간이동한다. 섬 위일 때만 `resting` 을 살린다(Task 3 테스트).
4. **초원에서 낚시 안내** — `fishingEdge` 는 "섬 중심에서 멀다 = 바다"라 초원 어디서나 낚시 안내가 뜬다. 섬 위에서만 찾는지(Task 3 테스트, meadow-check 5).
5. **배 모드에서 다른 키** — ESC 메뉴·E·숫자 키가 배 모드를 다른 모드로 바꾸면 Player 가 키네마틱 몸을 놓친 채 바다에 멈춘다. 배 모드에선 `resolveKeyAction` 이 늘 `none` 이어야 한다(Task 7 테스트).

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `src/meadow/vendor/*.js` | 은지 코드 복사본 (+ `// rinfish:` 최소 수정) |
| `src/meadow/vendor/{world,outdoor,town,daynight}.d.ts` | 우리가 쓰는 부분 타입 |
| `src/meadow/vendor/README.md` | 출처·커밋·고친 곳 |
| `src/meadow/meadowWorld.ts` | `createWorld()`·`DayNight` 싱글턴, `meadowReady()` |
| `src/meadow/MeadowWorld.tsx` | 은지 그룹·충돌체를 R3F 에 붙인다 |
| `src/meadow/MeadowGround.tsx` | 바닥 충돌체, 모래 띠·옆면, 초원 선착장 |
| `src/meadow/MeadowLighting.tsx` | 은지 해·하늘빛·DayNight(정오 고정)·배경색·그림자 크기 |
| `src/game/data/meadow.ts` | 배치 상수·좌표 변환 |
| `src/game/logic/meadowColliders.ts` | Box3 → Rapier 상자 |
| `src/game/logic/land.ts` | 땅 판정·경계 |
| `src/game/logic/boatRoute.ts` | 뱃길·진행도·배 자세 |
| `src/game/logic/mapView.ts` | 지도 좌표 변환 |
| `src/game/data/boat.ts` | 배 모양 수치(앉는 자리) |
| `src/game/scene/boat/BoatModel.tsx` | 나무배 모양 |
| `src/game/scene/boat/Docks.tsx` | 선착장 배·타기 감지 상자 |
| `src/game/ui/MiniMap.tsx` | 미니맵·큰 지도 |
| `tools/meadow-check.mjs` | 헤드리스 점검 |

---

### Task 1: 은지 코드·모델 복사

**Files:**
- Create: `src/meadow/vendor/{world,outdoor,town,furniture,door,daynight,paths,items}.js` (은지 저장소 `src/` 에서 복사)
- Create: `src/meadow/vendor/{world,outdoor,town,daynight}.d.ts`, `src/meadow/vendor/README.md`
- Create: `public/meadow/models/{kenney,nature,town,food}/` (은지 저장소 `public/models/` 에서 폴더째 복사)
- Modify: `package.json` (lint 스크립트)
- Test: `src/meadow/vendor.test.ts`

**Interfaces:**
- Produces: `createWorld(): EunjiWorld` (`./vendor/world.js`), `ROOMS`, `YARD`/`ANIMAL_ZONE`/`GROUND`/`GATE_E` (`./vendor/outdoor.js`), `TOWN`/`TOWN_LAYOUT` (`./vendor/town.js`), `DayNight` (`./vendor/daynight.js`). 타입은 아래 d.ts 그대로.

은지 저장소 위치: 이 세션 스크래치패드 `scratchpad/eunji/repo2` (커밋 `f3c3808`). 없으면 `git clone https://github.com/Eunji1217/3js <임시폴더>` 후 `git -C <임시폴더> checkout f3c3808`.

- [ ] **Step 1: 실패하는 테스트 쓰기** — `src/meadow/vendor.test.ts`

```ts
// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

// 모델 파일은 테스트에서 받지 않는다 (로딩 실패는 allSettled 로 넘긴다)
beforeAll(() => vi.stubGlobal('fetch', () => Promise.reject(new Error('offline'))))
afterAll(() => vi.unstubAllGlobals())

describe('은지 맵 복사본', () => {
  it('createWorld 가 사격장·동물·상인·거울 파일 없이 만들어지고 충돌 상자가 땅 안에 있다', async () => {
    const { createWorld } = await import('./vendor/world.js')
    const { GROUND } = await import('./vendor/outdoor.js')
    const w = createWorld()
    await Promise.allSettled([w.furnitureReady, w.outdoor.ready, w.town.ready])
    const boxes = w.allColliders()
    expect(boxes.length).toBeGreaterThan(10)
    for (const b of boxes) {
      if (!Number.isFinite(b.min.x)) continue
      expect(b.min.x).toBeGreaterThanOrEqual(GROUND.minX - 1)
      expect(b.max.z).toBeLessThanOrEqual(GROUND.maxZ + 1)
    }
    expect(w.lights.sun.isDirectionalLight).toBe(true)
  })

  it('모델 주소는 meadow/ 아래', async () => {
    const { asset } = await import('./vendor/paths.js')
    expect(asset('models/kenney/desk.glb')).toBe('/meadow/models/kenney/desk.glb')
  })
})
```

`paths.js` 도 우리 코드가 import 하므로 `src/meadow/vendor/paths.d.ts` 를 둔다:

```ts
export const BASE_URL: string
export function asset(path: string): string
```

- [ ] **Step 2: 실행해 실패 확인**

Run: `npx vitest run src/meadow/vendor.test.ts`
Expected: FAIL — `Failed to resolve import "./vendor/world.js"`

- [ ] **Step 3: 파일 복사**

```bash
E=<은지 저장소 경로>
mkdir -p src/meadow/vendor public/meadow/models
for f in world outdoor town furniture door daynight paths items; do cp "$E/src/$f.js" src/meadow/vendor/; done
for d in kenney nature town food; do cp -R "$E/public/models/$d" public/meadow/models/; done
du -sh public/meadow/models   # 약 2.1MB
```

- [ ] **Step 4: 복사본 최소 수정 (`// rinfish:` 주석)**

`src/meadow/vendor/paths.js` — 마지막 줄:

```js
// rinfish: 낚시섬에서는 은지 모델을 public/meadow/ 아래에 둔다
export const asset = (path) => BASE_URL + 'meadow/' + path.replace(/^\//, '');
```

`src/meadow/vendor/world.js`:
- `import { Reflector } from 'three/addons/objects/Reflector.js';` 줄을 지우고 그 자리에 `// rinfish: 거울(Reflector)은 매 프레임 한 번 더 그려서 뺐다`
- `import { RANGE_ROOM, buildRange } from './range.js';` 를 아래로 바꾼다(값은 은지 range.js 6행 그대로):

```js
// rinfish: range.js 는 무기·소리 코드를 끌고 와서 복사하지 않았다. 방 크기만 옮겨 둔다 (빈 방으로 남는다)
const RANGE_ROOM = { id: 'range', name: '사격장', minX: 15, maxX: 27, minZ: -5, maxZ: 5, floor: 0x8f8f8c, wall: 0xd6d6cf };
```

- `import { createAnimals } from './animals.js';` 줄을 지우고 `// rinfish: 동물(animals.js)은 3단계에서`
- `const range = buildRange({ group, std, box, shootables });` → `const range = null; // rinfish: 사격장 설비 뺌`
- `const animals = createAnimals({ group, shootables });` → `const animals = { update() {} }; // rinfish: 동물 뺌`
- 거울 블록(`// --- 거울 (침실 왼쪽 벽) ---` 부터 `group.add(mirror);` 까지)에서 `const mirror = new Reflector(...)` 문과 `mirror.position…`, `mirror.rotation…`, `group.add(mirror);` 세 줄을 지우고 `const mirror = null; // rinfish: 거울 뺌 (테두리만 남는다)` 를 둔다. 테두리(`frame`) 코드는 남긴다.

`src/meadow/vendor/town.js`:
- `import { UMCharacter, UM_DEFAULT } from './umchar.js';` 줄을 지우고 `// rinfish: 상인 NPC(umchar.js, 모델 21MB)는 3단계에서`
- `jobs.push(makeNpc(v));` 줄을 지우고 `// rinfish: 상인 만들기 뺌`
- `async function makeNpc(v) { … }` 함수 전체를 지우고 `// rinfish: makeNpc 뺌`

그 밖의 파일(outdoor, furniture, door, daynight, items)은 고치지 않는다.

- [ ] **Step 5: 타입 선언**

`src/meadow/vendor/world.d.ts`:

```ts
import type { Box3, DirectionalLight, Group, HemisphereLight, Light } from 'three'

export type EunjiRoom = { id: string; name: string; minX: number; maxX: number; minZ: number; maxZ: number }
export const ROOMS: EunjiRoom[]

export type EunjiDoor = { setOpen(open: boolean, instant?: boolean): void; collider: Box3 }

export type EunjiWorld = {
  group: Group
  allColliders(): Box3[]
  doors: EunjiDoor[]
  furnitureReady: Promise<unknown>
  outdoor: { ready: Promise<unknown> }
  town: { ready: Promise<unknown> }
  lights: { sun: DirectionalLight; hemi: HemisphereLight; lamps: Light[] }
}

export function createWorld(): EunjiWorld
```

`src/meadow/vendor/outdoor.d.ts`:

```ts
export type EunjiArea = { minX: number; maxX: number; minZ: number; maxZ: number }
export const GROUND: EunjiArea
export const YARD: EunjiArea
export const ANIMAL_ZONE: EunjiArea
export const GATE_E: { minZ: number; maxZ: number }
```

`src/meadow/vendor/town.d.ts`:

```ts
import type { EunjiArea } from './outdoor.js'
export const TOWN: EunjiArea
export const TOWN_LAYOUT: {
  square: EunjiArea
  fountain: { x: number; z: number; r: number }
  stalls: { x: number; z: number; color: string }[]
  houses: { x: number; z: number; half: number }[]
}
```

`src/meadow/vendor/daynight.d.ts`:

```ts
import type { Color, DirectionalLight, HemisphereLight, Light, Vector3 } from 'three'
export class DayNight {
  constructor(lights: { sun: DirectionalLight; hemi: HemisphereLight; lamps?: Light[] })
  /** 하루 진행도 0~1 (0 = 06:00, 0.25 = 정오) */
  t: number
  update(dt: number, playerPos: Vector3): void
  skyFor(outdoor: boolean): { color: Color; fog: number }
}
```

`src/meadow/vendor/README.md`:

```md
# 은지 게임(Room Sim) 코드 복사본

- 출처: https://github.com/Eunji1217/3js 커밋 `f3c3808` 의 `src/` (모델은 `public/models/{kenney,nature,town,food}` → `public/meadow/models/`, 모두 CC0)
- 고친 곳은 `// rinfish:` 로 찾는다: 모델 경로(paths.js), 사격장 설비·동물·거울(world.js), 상인 NPC(town.js)
- 남의 코드라 oxlint 검사에서 뺀다. 타입은 우리가 쓰는 부분만 `.d.ts` 에 선언한다
- 은지 원본이 바뀌면 같은 파일을 다시 복사하고 `// rinfish:` 자리만 다시 고친다
```

- [ ] **Step 6: lint 에서 빼기** — `package.json` 의 lint 스크립트:

```json
"lint": "oxlint --ignore-pattern=.claude/** --ignore-pattern=tools/** --ignore-pattern=src/meadow/vendor/**",
```

- [ ] **Step 7: 테스트·타입·lint 확인**

Run: `npx vitest run src/meadow/vendor.test.ts && npx tsc -b && npm run lint 2>&1 | grep -c "warning"`
Expected: 테스트 2개 PASS, tsc 오류 없음, warning 줄 수 6.
(거울을 지웠으면 `createWorld` 는 WebGL 없이 jsdom 에서 만들어져야 한다. 안 되면 어떤 브라우저 기능이 문제인지 찾아 원인을 ledger 에 적고, 복사본을 고쳐야 하면 `// rinfish:` 로 표시한다.)

- [ ] **Step 8: 커밋**

```bash
git add src/meadow public/meadow package.json
git commit -m "feat: 은지 맵 코드와 모델 복사" -m "은지 Room Sim f3c3808 의 world·outdoor·town·furniture·door·daynight·paths·items 와 CC0 모델(약 2.1MB)을 가져왔다.
사격장 설비·동물·상인·거울은 복사본에서 지우고 // rinfish: 로 표시했다. vendor 폴더는 lint 에서 뺀다."
```

---

### Task 2: 배치 상수·좌표 변환·충돌 상자 변환

**Files:**
- Create: `src/game/data/meadow.ts`
- Create: `src/game/logic/meadowColliders.ts`
- Test: `src/game/logic/meadowColliders.test.ts`

**Interfaces:**
- Produces (`data/meadow.ts`):
  - `type Rect = { x0: number; x1: number; z0: number; z1: number }`
  - `type EunjiArea = { minX: number; maxX: number; minZ: number; maxZ: number }`
  - `MEADOW_OFFSET_X = 200`, `MEADOW_POS: [number, number, number]`, `MEADOW_YAW = Math.PI`
  - `toWorld(ex, ez): [number, number]`, `toMeadowLocal(x, z): [number, number]`, `areaToWorld(a: EunjiArea): Rect`
  - `MEADOW_RECT: Rect` (x 90..290, z -110..90), `MEADOW_LAND: Rect` (1m 안쪽)
  - `MEADOW_DOCK: Rect` (84..90, -3.5..-0.5), `MEADOW_DOCK_TOP = 0.1`, `MEADOW_DOCK_LAND: Rect`
  - `ISLAND_LAND_RADIUS = ISLAND_RADIUS - 1`
  - `START_SPOT: [number, number]` = (188, -12)
  - `SHORE_SAND = 4`
- Produces (`logic/meadowColliders.ts`): `type Cuboid = { center: [number, number, number]; half: [number, number, number] }`, `boxesToCuboids(boxes: readonly BoxLike[]): Cuboid[]` (`BoxLike = { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } }`)

- [ ] **Step 1: 실패하는 테스트** — `src/game/logic/meadowColliders.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { MEADOW_LAND, MEADOW_RECT, START_SPOT, areaToWorld, toMeadowLocal, toWorld } from '../data/meadow'
import { boxesToCuboids } from './meadowColliders'

const box = (min: [number, number, number], max: [number, number, number]) => ({ min: { x: min[0], y: min[1], z: min[2] }, max: { x: max[0], y: max[1], z: max[2] } })

describe('초원 좌표', () => {
  it('은지 좌표를 180° 돌리고 동쪽으로 200m', () => {
    expect(toWorld(0, 0)).toEqual([200, 0])
    expect(toWorld(12, 12)).toEqual([188, -12])
    expect(toWorld(110, -90)).toEqual([90, 90])
  })
  it('세계 → 은지 좌표는 반대 변환', () => {
    expect(toMeadowLocal(188, -12)).toEqual([12, 12])
    expect(toMeadowLocal(...toWorld(37, -5))).toEqual([37, -5])
  })
  it('은지 영역 → 세계 사각형 (최소·최대가 뒤집힌다)', () => {
    expect(areaToWorld({ minX: 39, maxX: 67, minZ: -15, maxZ: 17 })).toEqual({ x0: 133, x1: 161, z0: -17, z1: 15 })
    expect(MEADOW_RECT).toEqual({ x0: 90, x1: 290, z0: -110, z1: 90 })
    expect(MEADOW_LAND).toEqual({ x0: 91, x1: 289, z0: -109, z1: 89 })
  })
  it('시작 자리는 은지 집 마당 (12, 12)', () => {
    expect(START_SPOT).toEqual([188, -12])
  })
})

describe('boxesToCuboids', () => {
  it('가운데를 세계로 옮기고 반폭은 그대로 둔다', () => {
    expect(boxesToCuboids([box([0, 0, 0], [2, 1, 4])])).toEqual([{ center: [199, 0.5, -2], half: [1, 0.5, 2] }])
  })
  it('얇거나 깨진 상자는 버린다', () => {
    const empty = box([Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity])
    const flat = box([0, 0, 0], [2, 0.005, 2])
    const nan = box([Number.NaN, 0, 0], [1, 1, 1])
    expect(boxesToCuboids([empty, flat, nan])).toEqual([])
  })
})
```

- [ ] **Step 2: 실행해 실패 확인**

Run: `npx vitest run src/game/logic/meadowColliders.test.ts`
Expected: FAIL — `Failed to resolve import "../data/meadow"`

- [ ] **Step 3: 구현**

`src/game/data/meadow.ts`:

```ts
import { ISLAND_RADIUS } from './zones'

/** 바닥의 축 정렬 사각형 (세계 좌표, x0 < x1, z0 < z1) */
export type Rect = { x0: number; x1: number; z0: number; z1: number }
/** 은지 코드가 쓰는 영역 모양 (은지 좌표) */
export type EunjiArea = { minX: number; maxX: number; minZ: number; maxZ: number }

/**
 * 초원(은지 맵)을 놓는 자리. 은지 좌표를 180° 돌리고 동쪽으로 200m 옮긴다:
 * 세계 (x, z) = (200 - x_은지, -z_은지). 그러면 은지 지도에서 보던 방향(위 = 동물 들판, 왼쪽 = 마을) 그대로다
 */
export const MEADOW_OFFSET_X = 200
export const MEADOW_POS: [number, number, number] = [MEADOW_OFFSET_X, 0, 0]
export const MEADOW_YAW = Math.PI

// + 0: -0 을 0 으로
export const toWorld = (ex: number, ez: number): [number, number] => [MEADOW_OFFSET_X - ex + 0, -ez + 0]
export const toMeadowLocal = (x: number, z: number): [number, number] => [MEADOW_OFFSET_X - x + 0, -z + 0]

/** 은지 영역 → 세계 사각형. 180° 돌려서 최소·최대가 뒤집힌다 */
export function areaToWorld(a: EunjiArea): Rect {
  return { x0: MEADOW_OFFSET_X - a.maxX, x1: MEADOW_OFFSET_X - a.minX, z0: -a.maxZ + 0, z1: -a.minZ + 0 }
}

const inset = (r: Rect, d: number): Rect => ({ x0: r.x0 + d, x1: r.x1 - d, z0: r.z0 + d, z1: r.z1 - d })

/** 초원 땅 전체 (은지 GROUND x -90..110, z -90..110) */
export const MEADOW_RECT: Rect = areaToWorld({ minX: -90, maxX: 110, minZ: -90, maxZ: 110 })
/** 걸을 수 있는 초원 (가장자리 1m 안쪽, 섬의 29m 원과 같은 여유) */
export const MEADOW_LAND: Rect = inset(MEADOW_RECT, 1)
/** 섬에서 걸을 수 있는 원의 반지름 */
export const ISLAND_LAND_RADIUS = ISLAND_RADIUS - 1

/** 초원 선착장 판자 (마을 쪽 해안에서 서쪽 바다로 6m, 은지 GATE_E 와 같은 줄) */
export const MEADOW_DOCK: Rect = { x0: 84, x1: 90, z0: -3.5, z1: -0.5 }
/** 선착장 판자 윗면 높이 */
export const MEADOW_DOCK_TOP = 0.1
/** 선착장 위 걸을 수 있는 곳. 초원 땅(x 91)과 겹치게 x 91.5 까지 */
export const MEADOW_DOCK_LAND: Rect = { x0: 84.5, x1: 91.5, z0: -3.2, z1: -0.8 }

/** 처음 시작하는 자리: 은지 집 마당 (은지 좌표 12, 12) */
export const START_SPOT: [number, number] = toWorld(12, 12)

/** 초원 가장자리 모래 띠 폭 (m, 사각형 안쪽) */
export const SHORE_SAND = 4
```

`src/game/logic/meadowColliders.ts`:

```ts
import { MEADOW_OFFSET_X } from '../data/meadow'

type XYZ = { x: number; y: number; z: number }
export type BoxLike = { min: XYZ; max: XYZ }
/** Rapier 고정 상자: 가운데와 반폭 (세계 좌표) */
export type Cuboid = { center: [number, number, number]; half: [number, number, number] }

/** 이보다 얇은 상자는 충돌체로 만들지 않는다 (m) */
const MIN_THICKNESS = 0.01

/**
 * 은지 좌표의 축 정렬 상자 → 세계 좌표 Rapier 상자. 180° 돌리기는 축 정렬을 유지해서 반폭은 그대로다.
 * 비었거나(무한) 깨졌거나(NaN) 얇은 상자는 버린다
 */
export function boxesToCuboids(boxes: readonly BoxLike[]): Cuboid[] {
  const out: Cuboid[] = []
  for (const b of boxes) {
    const v = [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z]
    if (!v.every(Number.isFinite)) continue
    const hx = (b.max.x - b.min.x) / 2
    const hy = (b.max.y - b.min.y) / 2
    const hz = (b.max.z - b.min.z) / 2
    if (Math.min(hx, hy, hz) * 2 < MIN_THICKNESS) continue
    const cx = (b.min.x + b.max.x) / 2
    const cy = (b.min.y + b.max.y) / 2
    const cz = (b.min.z + b.max.z) / 2
    out.push({ center: [MEADOW_OFFSET_X - cx + 0, cy, -cz + 0], half: [hx, hy, hz] })
  }
  return out
}
```

- [ ] **Step 4: 실행해 통과 확인**

Run: `npx vitest run src/game/logic/meadowColliders.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/game/data/meadow.ts src/game/logic/meadowColliders.ts src/game/logic/meadowColliders.test.ts
git commit -m "feat: 초원 배치 상수와 충돌 상자 변환" -m "은지 좌표를 180도 돌려 동쪽 200m 에 놓는 변환, 초원·선착장 사각형, 시작 자리를 정했다.
은지 Box3 를 세계 좌표 Rapier 상자로 바꾸고 얇거나 깨진 상자는 버린다."
```

---

### Task 3: 땅 판정·낚시 물가·저장 위치

**Files:**
- Create: `src/game/logic/land.ts`
- Modify: `src/game/logic/fishingEdge.ts` (`findFishingEdge` 맨 앞)
- Modify: `src/game/logic/place.ts`
- Test: `src/game/logic/land.test.ts`, `src/game/logic/fishingEdge.test.ts`, `src/game/logic/place.test.ts`

**Interfaces:**
- Consumes: `MEADOW_LAND`, `MEADOW_DOCK_LAND`, `ISLAND_LAND_RADIUS`, `START_SPOT`, `Rect` (Task 2)
- Produces: `type Land = 'island' | 'meadow'`, `landAt(x: number, z: number): Land | null`, `clampToLand(prev: { x: number; z: number }, next: { x: number; z: number }): { x: number; z: number }`. `START_PLACE` 가 (188, -12).

- [ ] **Step 1: 실패하는 테스트**

`src/game/logic/land.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { clampToLand, landAt } from './land'

describe('landAt', () => {
  it('섬 원(29m)·초원·초원 선착장은 땅, 그 밖은 바다', () => {
    expect(landAt(0, 0)).toBe('island')
    expect(landAt(0, 28.9)).toBe('island')
    expect(landAt(0, 29.5)).toBeNull()
    expect(landAt(150, 0)).toBe('meadow')
    expect(landAt(87, -2)).toBe('meadow')
    expect(landAt(87, 5)).toBeNull()
    expect(landAt(60, 0)).toBeNull()
    expect(landAt(290, 0)).toBeNull()
  })
})

describe('clampToLand', () => {
  it('땅 안이면 그대로', () => {
    expect(clampToLand({ x: 0, z: 0 }, { x: 1, z: 1 })).toEqual({ x: 1, z: 1 })
  })
  it('섬 가장자리에서 붙잡는다 (지금 원 경계와 같다)', () => {
    const p = clampToLand({ x: 0, z: 28 }, { x: 0, z: 31 })
    expect(p.x).toBeCloseTo(0)
    expect(p.z).toBeCloseTo(29)
  })
  it('초원 가장자리에서 붙잡는다', () => {
    expect(clampToLand({ x: 100, z: 0 }, { x: 89, z: 0 })).toEqual({ x: 91, z: 0 })
    expect(clampToLand({ x: 150, z: 88 }, { x: 150, z: 95 })).toEqual({ x: 150, z: 89 })
  })
  it('선착장 끝에서 붙잡고, 선착장과 초원 사이는 오간다', () => {
    expect(clampToLand({ x: 85, z: -2 }, { x: 83, z: -2 })).toEqual({ x: 84.5, z: -2 })
    expect(clampToLand({ x: 90, z: -2 }, { x: 92, z: -2 })).toEqual({ x: 92, z: -2 })
    expect(clampToLand({ x: 92, z: -2 }, { x: 89.5, z: -2 })).toEqual({ x: 89.5, z: -2 })
  })
  it('이전 자리도 땅 밖이면 가장 가까운 땅으로', () => {
    const p = clampToLand({ x: 60, z: 0 }, { x: 61, z: 0 })
    expect(landAt(p.x, p.z)).not.toBeNull()
  })
})
```

`src/game/logic/fishingEdge.test.ts` 맨 끝에 추가:

```ts
describe('findFishingEdge: 초원', () => {
  it('초원 위에서는 바다 낚시 안내를 하지 않는다 (섬에서 멀다고 바다가 아니다)', () => {
    expect(findFishingEdge(150, 0, ALL)).toBeNull()
    expect(findFishingEdge(91.2, 30, ALL)).toBeNull()
    expect(findFishingEdge(85, -2, ALL)).toBeNull()
  })
})
```

`src/game/logic/place.test.ts` 의 `describe('normalizePlace', …)` 안에 추가:

```ts
  it('처음 자리는 초원 은지 집 마당', () => {
    expect([START_PLACE.x, START_PLACE.z]).toEqual([188, -12])
  })
  it('초원 위 자리도 이어서 쓴다. 울타리 규칙은 섬에서만', () => {
    expect(normalizePlace({ x: 150, z: 0 }, []).x).toBe(150)
    expect(normalizePlace({ x: 150, z: -50 }, []).z).toBe(-50)
    expect(normalizePlace({ x: 60, z: 0 }, [])).toEqual(START_PLACE)
  })
  it('벤치에 앉아 있던 건 섬 위일 때만 이어서 앉는다', () => {
    expect(normalizePlace({ x: 150, z: 0, resting: true }, []).resting).toBe(false)
    expect(normalizePlace({ x: -5, z: 21, resting: true }, []).resting).toBe(true)
  })
```

- [ ] **Step 2: 실행해 실패 확인**

Run: `npx vitest run src/game/logic/land.test.ts src/game/logic/fishingEdge.test.ts src/game/logic/place.test.ts`
Expected: FAIL — land.ts 없음, 초원 낚시 안내가 null 이 아님, START_PLACE 가 (0, 15)

- [ ] **Step 3: 구현**

`src/game/logic/land.ts`:

```ts
import { ISLAND_LAND_RADIUS, MEADOW_DOCK_LAND, MEADOW_LAND, type Rect } from '../data/meadow'

export type Land = 'island' | 'meadow'
type Point = { x: number; z: number }
type Region = { land: Land; circle: number } | { land: Land; rect: Rect }

/** 걸을 수 있는 곳: 섬 원, 초원, 초원 선착장 (선착장은 초원으로 친다) */
const REGIONS: Region[] = [
  { land: 'island', circle: ISLAND_LAND_RADIUS },
  { land: 'meadow', rect: MEADOW_LAND },
  { land: 'meadow', rect: MEADOW_DOCK_LAND },
]

function inside(r: Region, x: number, z: number): boolean {
  if ('circle' in r) return Math.hypot(x, z) <= r.circle
  return x >= r.rect.x0 && x <= r.rect.x1 && z >= r.rect.z0 && z <= r.rect.z1
}

/** 영역 안에서 (x, z) 에 가장 가까운 점 */
function project(r: Region, x: number, z: number): Point {
  if ('circle' in r) {
    const d = Math.hypot(x, z)
    return d <= r.circle || d === 0 ? { x, z } : { x: (x * r.circle) / d, z: (z * r.circle) / d }
  }
  return { x: Math.min(r.rect.x1, Math.max(r.rect.x0, x)), z: Math.min(r.rect.z1, Math.max(r.rect.z0, z)) }
}

/** (x, z) 가 어느 땅 위인가. 바다면 null */
export function landAt(x: number, z: number): Land | null {
  return REGIONS.find((r) => inside(r, x, z))?.land ?? null
}

/**
 * 다음 자리가 땅 밖이면 이전 자리가 있던 땅의 경계로 붙인다 (섬은 원 경계, 초원·선착장은 사각형 경계).
 * 이전 자리도 땅 밖이면(처음·순간이동 직후) 가장 가까운 땅으로
 */
export function clampToLand(prev: Point, next: Point): Point {
  if (landAt(next.x, next.z)) return next
  const home = REGIONS.filter((r) => inside(r, prev.x, prev.z))
  let best: Point | null = null
  let bestD = Infinity
  for (const r of home.length ? home : REGIONS) {
    const p = project(r, next.x, next.z)
    const d = Math.hypot(p.x - next.x, p.z - next.z)
    if (d < bestD) {
      best = p
      bestD = d
    }
  }
  return best ?? next
}
```

`src/game/logic/fishingEdge.ts` — import 에 `import { landAt } from './land'` 를 더하고, `findFishingEdge` 본문 맨 앞에:

```ts
  // 바다 판정은 "섬에서 멀다 = 바다" 라서 섬 위에서만 찾는다 (초원 해안 낚시는 3단계)
  if (landAt(x, z) !== 'island') return null
```

`src/game/logic/place.ts`:

```ts
import { CAMERA_ZOOM } from '../data/balance'
import { START_SPOT } from '../data/meadow'
import { MOUSE_LOOK } from '../data/settings'
import type { ZoneId } from '../data/types'
import { FENCE_Z } from '../data/zones'
import { landAt } from './land'

/** 다시 들어왔을 때 이어서 시작할 자리: 서 있던 곳·바라보던 방향·카메라·벤치에 앉아 있었는지 */
export type Place = { x: number; z: number; facing: number; yaw: number; pitch: number; zoom: number; resting: boolean }

/** 처음 시작하는 자리 (초원 은지 집 마당) */
export const START_PLACE: Place = { x: START_SPOT[0], z: START_SPOT[1], facing: Math.PI, yaw: 0, pitch: 0, zoom: CAMERA_ZOOM.initial, resting: false }
```

`placeMoved` 는 그대로 두고, `normalizePlace` 는:

```ts
/**
 * 저장본을 검증해서 쓸 수 있는 자리로. 깨졌거나 땅(섬·초원) 밖이거나, 섬에서 아직 아무 구역도 안 열었는데 울타리 북쪽이면
 * (저장본을 손대거나 예전 진행으로 돌아간 경우) 처음 자리로
 */
export function normalizePlace(raw: unknown, unlocked: readonly ZoneId[]): Place {
  if (!raw || typeof raw !== 'object') return START_PLACE
  const r = raw as Record<string, unknown>
  if (!num(r.x) || !num(r.z)) return START_PLACE
  const land = landAt(r.x, r.z)
  if (!land) return START_PLACE
  // 섬 울타리 북쪽(잠긴 구역 쪽)은 한 곳이라도 열려 있어야 갈 수 있다 (열린 문으로 북쪽이 다 이어진다)
  if (land === 'island' && r.z < FENCE_Z && !unlocked.some((z) => z !== 'beach')) return START_PLACE
  const zoom = num(r.zoom) ? Math.min(CAMERA_ZOOM.max, Math.max(CAMERA_ZOOM.min, r.zoom)) : START_PLACE.zoom
  const pitch = num(r.pitch) ? Math.min(MOUSE_LOOK.maxPitch, Math.max(MOUSE_LOOK.minPitch, r.pitch)) : 0
  return {
    x: r.x,
    z: r.z,
    facing: num(r.facing) ? r.facing : START_PLACE.facing,
    yaw: num(r.yaw) ? r.yaw : 0,
    pitch,
    zoom,
    // 벤치는 섬에만 있다
    resting: land === 'island' && r.resting === true,
  }
}
```

- [ ] **Step 4: 실행해 통과 확인 (전체 테스트)**

Run: `npx vitest run`
Expected: 모두 PASS. 기존 place 테스트 `섬 밖이면 처음 자리 {x:40}` 도 그대로 통과(40 은 바다).

- [ ] **Step 5: 커밋**

```bash
git add src/game/logic/land.ts src/game/logic/land.test.ts src/game/logic/fishingEdge.ts src/game/logic/fishingEdge.test.ts src/game/logic/place.ts src/game/logic/place.test.ts
git commit -m "feat: 섬과 초원 땅 판정" -m "landAt·clampToLand 로 섬 원, 초원, 초원 선착장을 땅으로 본다.
바다 낚시 물가는 섬 위에서만 찾고, 저장 자리는 초원도 인정한다. 처음 자리는 은지 집 마당.
울타리 규칙과 벤치 쉬기는 섬 위일 때만 본다."
```

---

### Task 4: 바다를 두 땅에 맞게

**Files:**
- Modify: `src/game/scene/Ocean.tsx`

**Interfaces:**
- Consumes: `MEADOW_RECT` (Task 2)

셰이더라 단위 테스트가 없다. 확인은 Task 5 의 스크린샷과 `npx tsc -b`.

- [ ] **Step 1: 바다 판 크기·위치** — `Ocean()` 의 geometry:

```ts
  const geometry = useMemo(() => {
    // 처음부터 바닥(xz)에 눕힌 평면을 만들어서 셰이더에서 position.xz 를 그대로 쓴다.
    // 섬과 초원을 다 덮게 x -90..360, z -180..160. 메시는 원점에 두고 판만 옮겨서 position.xz 가 곧 세계 좌표다
    const g = new PlaneGeometry(SEA.width, SEA.depth, SEA.segX, SEA.segZ)
    g.rotateX(-Math.PI / 2)
    g.translate(SEA.centerX, 0, SEA.centerZ)
    return g
  }, [])
```

파일 위쪽(셰이더 문자열 앞)에:

```ts
/** 바다 판: 섬(원점)과 초원(x 90..290)을 다 덮는다. 격자 한 칸은 지금(320m/220칸)과 비슷한 약 1.5m, 정점은 2배를 넘지 않게 */
const SEA = { width: 450, depth: 340, centerX: 135, centerZ: -10, segX: 300, segZ: 230 }
```

- [ ] **Step 2: 해안까지 거리** — fragment shader 에서 uniform 을 바꾼다:

```glsl
  uniform float uShore;
  uniform vec2 uMeadowCenter;
  uniform vec2 uMeadowHalf;
```

`// 섬에서 멀어질수록 …` 부분을 아래로 바꾼다:

```glsl
    // 가장 가까운 땅(섬 원·초원 사각형)의 가장자리까지 거리. 멀어질수록 얕은 청록 → 깊은 파랑
    float island = length(vWorld.xz) - uShore;
    vec2 q2 = abs(vWorld.xz - uMeadowCenter) - uMeadowHalf;
    float meadow = length(max(q2, 0.0)) + min(max(q2.x, q2.y), 0.0);
    float edge = min(island, meadow);
    float shallow = 1.0 - smoothstep(0.0, 14.0, edge);
    vec3 color = mix(uDeep, uShallow, shallow);
```

거품 부분에서 `float edge = dist - uShore;` 줄을 지운다(위에서 이미 `edge` 를 구했다). `wobble` 식은 그대로 둔다.

material uniforms 에 더하고 하늘색·해 방향을 은지 낮에 맞춘다:

```ts
          uSky: { value: new Color(SKY_DAY) },
          ...
          // 은지 해(정오): 은지 좌표 (0, 18, 6) → 180° 돌려 세계 (0, 18, -6)
          uSunDir: { value: new Vector3(0, 18, -6).normalize() },
          uShore: { value: ISLAND_RADIUS },
          uMeadowCenter: { value: new Vector2((MEADOW_RECT.x0 + MEADOW_RECT.x1) / 2, (MEADOW_RECT.z0 + MEADOW_RECT.z1) / 2) },
          uMeadowHalf: { value: new Vector2((MEADOW_RECT.x1 - MEADOW_RECT.x0) / 2, (MEADOW_RECT.z1 - MEADOW_RECT.z0) / 2) },
```

`SKY_DAY` 는 `src/game/data/meadow.ts` 끝에 더한다(은지 daynight.js 의 `DAY` 색, 정오 `skyFor(true)` 와 같다):

```ts
/** 낮 하늘색 (은지 daynight.js DAY). 바다가 먼 곳에서 이 색으로 흐려진다 */
export const SKY_DAY = '#a9d4f5'
```

import: `import { Color, PlaneGeometry, ShaderMaterial, Vector2, Vector3 } from 'three'`, `import { MEADOW_RECT, SKY_DAY } from '../data/meadow'`.

- [ ] **Step 3: 타입 확인**

Run: `npx tsc -b`
Expected: 오류 없음

- [ ] **Step 4: 커밋**

```bash
git add src/game/scene/Ocean.tsx src/game/data/meadow.ts
git commit -m "feat: 바다를 초원까지 넓힘" -m "바다 판을 x -90..360, z -180..160 으로 키우고 얕은 물·거품을 섬 원과 초원 사각형 중 가까운 쪽 기준으로 그린다.
하늘색·햇빛 방향을 은지 낮에 맞췄다."
```

---

### Task 5: 초원 띄우기 (그룹·충돌체·바닥·조명·플레이어 경계)

**Files:**
- Create: `src/meadow/meadowWorld.ts`, `src/meadow/MeadowWorld.tsx`, `src/meadow/MeadowGround.tsx`, `src/meadow/MeadowLighting.tsx`
- Modify: `src/game/scene/World.tsx`, `src/game/scene/Player.tsx`
- Create: `tools/meadow-check.mjs` (이번 Task 에서는 1~3번 점검만)

**Interfaces:**
- Consumes: Task 1 vendor, Task 2 `boxesToCuboids`, `MEADOW_*`, `toMeadowLocal`, Task 3 `clampToLand`
- Produces: `meadowWorld(): EunjiWorld`, `meadowReady(): Promise<void>`, `meadowDayNight(): DayNight`, `NOON_T = 0.25`. `playerRig.yaw` (카메라 각도, Task 9 미니맵이 쓴다).

- [ ] **Step 1: 싱글턴** — `src/meadow/meadowWorld.ts`

```ts
import { DayNight } from './vendor/daynight.js'
import { createWorld, type EunjiWorld } from './vendor/world.js'

/** 하루 진행도 0.25 = 정오. 낮과 밤은 3단계에서 서버 시계와 함께 켠다 */
export const NOON_T = 0.25

let world: EunjiWorld | null = null
let daynight: DayNight | null = null

/** 은지 맵. 한 번만 만든다 (모델을 내려받기 시작한다). 문은 3단계 전까지 열어 둔다 */
export function meadowWorld(): EunjiWorld {
  if (!world) {
    world = createWorld()
    for (const d of world.doors) d.setOpen(true, true)
  }
  return world
}

/** 은지 낮과 밤 (해·하늘빛을 움직인다) */
export function meadowDayNight(): DayNight {
  daynight ??= new DayNight(meadowWorld().lights)
  return daynight
}

/**
 * 가구·들판·마을 모델이 다 들어왔을 때 (실패한 모델은 빼고).
 * 은지 코드는 모델이 올 때 부모까지 포함한 좌표로 충돌 상자를 재므로, 이게 끝나기 전엔 group 을 장면(변환 그룹)에 붙이지 않는다
 */
export function meadowReady(): Promise<void> {
  const w = meadowWorld()
  return Promise.allSettled([w.furnitureReady, w.outdoor.ready, w.town.ready]).then(() => undefined)
}
```

- [ ] **Step 2: 바닥·모래·선착장** — `src/meadow/MeadowGround.tsx`

```tsx
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { MEADOW_DOCK, MEADOW_DOCK_TOP, MEADOW_RECT, SHORE_SAND } from '../game/data/meadow'

const W = MEADOW_RECT.x1 - MEADOW_RECT.x0
const D = MEADOW_RECT.z1 - MEADOW_RECT.z0
const CX = (MEADOW_RECT.x0 + MEADOW_RECT.x1) / 2
const CZ = (MEADOW_RECT.z0 + MEADOW_RECT.z1) / 2
const SAND = '#e9d8a6'
/** 모래 띠 네 변 [가운데 x, 가운데 z, 가로, 세로] (사각형 안쪽 SHORE_SAND m) */
const STRIPS: [number, number, number, number][] = [
  [MEADOW_RECT.x0 + SHORE_SAND / 2, CZ, SHORE_SAND, D],
  [MEADOW_RECT.x1 - SHORE_SAND / 2, CZ, SHORE_SAND, D],
  [CX, MEADOW_RECT.z0 + SHORE_SAND / 2, W - SHORE_SAND * 2, SHORE_SAND],
  [CX, MEADOW_RECT.z1 - SHORE_SAND / 2, W - SHORE_SAND * 2, SHORE_SAND],
]
const DOCK_W = MEADOW_DOCK.x1 - MEADOW_DOCK.x0
const DOCK_D = MEADOW_DOCK.z1 - MEADOW_DOCK.z0
const DOCK_H = 0.3

/**
 * 초원 바닥 충돌체(윗면 y=0), 가장자리 모래 띠와 물 아래로 내려가는 옆면, 마을 쪽 선착장.
 * 은지 모델보다 먼저 있어야 초원에서 시작해도 떨어지지 않는다
 */
export function MeadowGround() {
  return (
    <>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[W / 2, 0.5, D / 2]} position={[CX, -0.5, CZ]} />
        <CuboidCollider args={[DOCK_W / 2, DOCK_H / 2, DOCK_D / 2]} position={[(MEADOW_DOCK.x0 + MEADOW_DOCK.x1) / 2, MEADOW_DOCK_TOP - DOCK_H / 2, (MEADOW_DOCK.z0 + MEADOW_DOCK.z1) / 2]} />
      </RigidBody>
      {/* 옆면: 섬처럼 물 아래로 내려가는 2m 두께 상자. 윗면은 은지 풀밭(-0.01) 아래에 숨는다 */}
      <mesh position={[CX, -1.02, CZ]} receiveShadow>
        <boxGeometry args={[W, 2, D]} />
        <meshStandardMaterial color={SAND} />
      </mesh>
      {STRIPS.map(([x, z, w, d]) => (
        <mesh key={`${x},${z}`} rotation-x={-Math.PI / 2} position={[x, -0.005, z]} receiveShadow>
          <planeGeometry args={[w, d]} />
          <meshStandardMaterial color={SAND} />
        </mesh>
      ))}
      <mesh position={[(MEADOW_DOCK.x0 + MEADOW_DOCK.x1) / 2, MEADOW_DOCK_TOP - DOCK_H / 2, (MEADOW_DOCK.z0 + MEADOW_DOCK.z1) / 2]} castShadow receiveShadow>
        <boxGeometry args={[DOCK_W, DOCK_H, DOCK_D]} />
        <meshStandardMaterial color="#a1887f" />
      </mesh>
    </>
  )
}
```

(모래 띠 y -0.005 는 은지 풀밭 -0.01 보다 위, 실내 바닥 0 보다 아래. 풀밭과 겹쳐 깜빡이면 -0.004 로 올린다.)

- [ ] **Step 3: 은지 그룹·충돌체** — `src/meadow/MeadowWorld.tsx`

```tsx
import { useEffect, useState } from 'react'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { MEADOW_POS, MEADOW_YAW } from '../game/data/meadow'
import { boxesToCuboids, type Cuboid } from '../game/logic/meadowColliders'
import { MeadowGround } from './MeadowGround'
import { meadowReady, meadowWorld } from './meadowWorld'

/** 초원(은지 맵). 바닥은 바로, 은지 모델·충돌체는 모델이 다 들어온 뒤에 붙인다 */
export function MeadowWorld() {
  const world = meadowWorld()
  const [cuboids, setCuboids] = useState<Cuboid[] | null>(null)

  useEffect(() => {
    let alive = true
    void meadowReady().then(() => {
      // 아직 장면에 붙이기 전이라 상자가 모두 은지 좌표다
      if (alive) setCuboids(boxesToCuboids(world.allColliders()))
    })
    return () => {
      alive = false
    }
  }, [world])

  return (
    <>
      <MeadowGround />
      {cuboids && (
        <>
          <group position={MEADOW_POS} rotation-y={MEADOW_YAW}>
            <primitive object={world.group} />
          </group>
          <RigidBody type="fixed" colliders={false}>
            {cuboids.map((c, i) => (
              <CuboidCollider key={i} args={c.half} position={c.center} />
            ))}
          </RigidBody>
        </>
      )}
    </>
  )
}
```

- [ ] **Step 4: 조명** — `src/meadow/MeadowLighting.tsx`

```tsx
import { useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { MEADOW_POS, MEADOW_YAW, toMeadowLocal } from '../game/data/meadow'
import { useQualityPreset } from '../game/input/touchDevice'
import { playerRig } from '../game/scene/Player'
import { NOON_T, meadowDayNight, meadowWorld } from './meadowWorld'

// 매 프레임 new 하지 않도록 재사용 (은지 좌표의 플레이어 위치)
const local = new Vector3()

function followPlayer() {
  const [x, z] = toMeadowLocal(playerRig.position.x, playerRig.position.z)
  local.set(x, playerRig.position.y, z)
  const dn = meadowDayNight()
  dn.t = NOON_T // 낮(정오) 고정. 3단계에서 서버 시계로 바꾼다
  dn.update(0, local)
}

/**
 * 세계 조명은 은지 것 한 벌: 해(그림자)·하늘빛은 처음부터 여기 붙이고, 방 조명·가로등은 은지 group 에 남는다.
 * 해와 그림자 범위(±22m)는 은지 DayNight 가 플레이어를 따라 옮긴다 (그래서 섬에서도 그림자가 생긴다)
 */
export function MeadowLighting() {
  const { sun, hemi } = meadowWorld().lights
  const { shadowMapSize } = useQualityPreset()
  const scene = useThree((s) => s.scene)

  useEffect(() => {
    // 그림자 지도 크기는 품질 설정을 따른다 (바뀌면 지도를 새로 만든다)
    sun.shadow.mapSize.set(shadowMapSize, shadowMapSize)
    sun.shadow.map?.dispose()
    sun.shadow.map = null
  }, [sun, shadowMapSize])

  useEffect(() => {
    followPlayer()
    scene.background = meadowDayNight().skyFor(true).color.clone()
  }, [scene])

  useFrame(followPlayer)

  return (
    <group position={MEADOW_POS} rotation-y={MEADOW_YAW}>
      <primitive object={sun} />
      <primitive object={sun.target} />
      <primitive object={hemi} />
    </group>
  )
}
```

(`<primitive>` 로 붙이면 three 가 `world.group` 에서 빼서 옮긴다. 은지 좌표 그대로라 변환 그룹 아래 둔다.)

- [ ] **Step 5: World.tsx** — 우리 하늘색·환경광·해를 빼고 초원을 넣는다.

`<color attach="background" … />`, `<ambientLight … />`, `<directionalLight … />` 세 요소와 위 주석들을 지우고, `const { shadowMapSize } = useQualityPreset()` 와 `useQualityPreset` import 도 지운다. 그 자리에:

```tsx
      {/* 빛·하늘색은 은지 것 한 벌 (meadow/MeadowLighting) */}
      <MeadowLighting />
      <MeadowWorld />
```

import:

```ts
import { MeadowLighting } from '../../meadow/MeadowLighting'
import { MeadowWorld } from '../../meadow/MeadowWorld'
```

- [ ] **Step 6: Player.tsx 땅 경계·카메라 각도**

`playerRig` 에 필드 추가:

```ts
  /** 카메라가 플레이어 주위를 도는 각도 (미니맵이 이 방향을 위로 그린다) */
  yaw: 0,
```

`const PLAYER_LIMIT = ISLAND_RADIUS - 1` 줄과 `ISLAND_RADIUS` import 를 지우고(`BENCH_SEAT` 는 남긴다) `import { clampToLand } from '../logic/land'` 를 더한다.

`// 2) 섬 밖으로 못 나가게 가장자리에서 붙잡는다` 블록을 아래로 바꾼다:

```ts
    // 2) 땅(섬·초원·선착장) 밖으로 못 나가게 가장자리에서 붙잡는다 (이전 자리가 있던 땅의 경계로)
    const p = rb.translation()
    const held = clampToLand(playerRig.position, p)
    const x = held.x
    const z = held.z
    if (x !== p.x || z !== p.z) rb.setTranslation({ x, y: p.y, z }, true)
    playerRig.position.set(x, p.y, z)
```

`playerRig.facing = facing.current` 줄 아래에 `playerRig.yaw = yaw.current` 를 더한다.

`playerRig.position` 의 처음 값은 `new Vector3(0, 1, 15)` 이다. 처음 프레임 clamp 의 "이전 자리"가 섬이 되어 초원 시작 자리가 섬으로 끌려가지 않게, `Player()` 안 `start` 를 읽은 직후 한 번 맞춘다:

```ts
  // 땅 경계는 "이전 자리"를 기준으로 붙잡으므로 처음부터 시작 자리로 둔다
  useState(() => playerRig.position.set(start.x, 1, start.z))
```

(이 줄은 `const [start] = useState(…)` 바로 아래. `useState` 초기화 함수는 한 번만 돈다.)

- [ ] **Step 7: 확인 스크립트 시작** — `tools/meadow-check.mjs`

`tools/hub-entry-check.mjs` 의 `browser()` 함수와 `tools/multiplayer-check.mjs` 의 `HELPERS`(`__mod`, `__fill`, `__click`)를 그대로 복사해 쓴다(두 파일과 같은 방식). 맨 위 주석:

```js
// 초원 + 배 점검 (헤드리스 Chrome). 스크린샷을 남긴다
// 준비: npm run server:dev (8787) 와 VITE_ROOM_SERVER=ws://127.0.0.1:8787 npx vite --port 5190 --strictPort
// 사용: node tools/meadow-check.mjs [게임 주소] [스크린샷 폴더]
```

열기 함수(캐릭터를 만들어 두고 위치 저장본을 지운 채 들어간다):

```js
async function open(port, presetIndex, query = '') {
  const b = await browser(port)
  await b.send('Page.enable')
  await b.send('Runtime.enable')
  await b.send('Page.navigate', { url: GAME })
  await b.until(`document.readyState === 'complete'`)
  await b.evaluate(`(async () => {
    const { LOOK_PRESETS } = await import('/src/game/data/characterParts.ts')
    localStorage.setItem('fishing-island-save-v1', JSON.stringify({ state: { look: LOOK_PRESETS[${presetIndex}].look }, version: 2 }))
    localStorage.removeItem('fishing-island-place-v1')
    return true
  })()`)
  await b.send('Page.navigate', { url: `${GAME}/${query}` })
  await b.until(`document.readyState === 'complete'`)
  await b.evaluate(HELPERS)
  await b.until(`document.body.innerText.includes('혼자 하기')`, 90000)
  await b.until(`!document.body.innerText.includes('헤엄쳐 오는 중')`, 180000)
  return b
}
const pos = `(async () => { const { playerRig } = await __mod('/src/game/scene/Player.tsx'); return [playerRig.position.x, playerRig.position.y, playerRig.position.z] })()`
const teleport = (x, z) => `(async () => { const { useSessionStore } = await __mod('/src/game/stores/sessionStore.ts'); useSessionStore.getState().requestTeleport([${x}, ${z}]); return true })()`
const walk = async (b, code, ms) => { await b.key('keydown', code); await wait(ms); await b.key('keyup', code); await wait(400) }
```

점검은 키로 걷는다(순간이동은 충돌을 무시해서 벽 점검에 못 쓴다). 카메라 각도를 읽어 원하는 방향에 가장 가까운 키를 고른다 — 앞(W) = (-sin yaw, -cos yaw), 오른쪽(D) = (cos yaw, -sin yaw):

```js
const camYaw = `(async () => { const { playerRig } = await __mod('/src/game/scene/Player.tsx'); return playerRig.yaw })()`
async function keyToward(b, dx, dz) {
  const yaw = await b.evaluate(camYaw)
  const dirs = { KeyW: [-Math.sin(yaw), -Math.cos(yaw)], KeyS: [Math.sin(yaw), Math.cos(yaw)], KeyD: [Math.cos(yaw), -Math.sin(yaw)], KeyA: [-Math.cos(yaw), Math.sin(yaw)] }
  return Object.entries(dirs).sort((a, b2) => (b2[1][0] * dx + b2[1][1] * dz) - (a[1][0] * dx + a[1][1] * dz))[0][0]
}
```

점검 1~3:

```js
const A = await open(9731, 0)
await A.evaluate(`__click('혼자 하기')`)
await wait(3000)
const p0 = await A.evaluate(pos)
check(Math.hypot(p0[0] - 188, p0[2] + 12) < 2, `1) 새 저장본은 초원 마당에서 시작 (${p0.map((v) => v.toFixed(1))})`)
await A.shot('1-start')

// 2) 침실 서쪽 벽은 은지 x -5 → 세계 x 205. 그 바깥 세계 (207, -2) = 은지 (-7, 2) 는 집 밖 마당이다. 세계 서쪽(-x)으로 걸으면 그 벽에 막힌다
await A.evaluate(teleport(207, -2))
await wait(1500)
await walk(A, await keyToward(A, -1, 0), 2500)
const p2 = await A.evaluate(pos)
check(p2[0] > 205, `2) 집 벽을 넘지 않는다 (x ${p2[0].toFixed(2)} > 205)`)
await A.shot('2-wall')

// 3) 초원 남쪽 끝(세계 z 89) 근처에서 남쪽(+z)으로 계속 걸어도 바다에 빠지지 않는다
await A.evaluate(teleport(150, 86))
await wait(1500)
await walk(A, await keyToward(A, 0, 1), 3000)
const p3 = await A.evaluate(pos)
check(p3[2] <= 89.01 && p3[1] > -0.5, `3) 초원 끝에서 멈춘다 (z ${p3[2].toFixed(2)}, y ${p3[1].toFixed(2)})`)
await A.shot('3-edge')

// 섬 색 비교용 (스펙 "낚시섬 색 맞추기")
await A.evaluate(teleport(0, 15))
await wait(2000)
await A.shot('0-island')
```


끝에:

```js
A.close()
console.log(`스크린샷: ${OUT}`)
process.exit(failed ? 1 : 0)
```

- [ ] **Step 8: 실행해서 확인**

```bash
npm run server:dev &   # 8787
VITE_ROOM_SERVER=ws://127.0.0.1:8787 npx vite --port 5190 --strictPort &
node tools/meadow-check.mjs http://127.0.0.1:5190 <스크래치패드>/meadow-check
```

Expected: `OK 1)`, `OK 2)`, `OK 3)`. 스크린샷 `1-start.png` 에 은지 집·마당·울타리가 보이고, 빛이 너무 밝거나 어둡지 않다.

`0-island.png` 를 `docs/superpowers/specs/img/rinfish-island.png` 와 나란히 본다. 섬이 눈에 띄게 하얗게 뜨거나 어두우면 `Island.tsx` 섬 모래(`#e9d8a6`)·풀(`#9ccc65`) 색만 조정하고(은지 조명 값은 그대로) 커밋 본문에 적는다.

`npx vitest run && npx tsc -b && npm run lint 2>&1 | grep -c warning` → 모두 통과, warning 6.

- [ ] **Step 9: 커밋**

```bash
git add src/meadow src/game/scene/World.tsx src/game/scene/Player.tsx tools/meadow-check.mjs
git commit -m "feat: 초원을 낚시섬 세계에 띄움" -m "은지 createWorld 를 한 번 만들어 모델이 다 들어온 뒤 180도 돌려 붙이고, Box3 를 Rapier 상자로 바꿔 충돌체를 만든다.
바닥 충돌체·모래 띠·옆면·선착장은 먼저 둔다. 빛과 하늘색은 은지 해·하늘빛·DayNight(정오 고정)로 통일했다.
플레이어는 섬·초원·선착장 경계 안에서만 다닌다. tools/meadow-check.mjs 로 시작 자리·벽·땅 끝을 본다."
```

---

### Task 6: 뱃길

**Files:**
- Create: `src/game/logic/boatRoute.ts`
- Test: `src/game/logic/boatRoute.test.ts`

**Interfaces:**
- Consumes: `MEADOW_RECT`, `ISLAND_RADIUS`
- Produces: `type BoatDir = 'toIsland' | 'toMeadow'`, `BOAT_RIDE_SECONDS = 12`, `BOAT_EASE_SECONDS = 1`, `BOAT_WAYPOINTS`, `routePoint(t: number): { x: number; z: number; heading: number }`, `routeLength(): number`, `boatProgress(elapsed: number): number` (0..1), `boatPose(dir: BoatDir, progress: number): { x: number; z: number; heading: number }`, `boatDestination(dir: BoatDir): 'island' | 'meadow'`

- [ ] **Step 1: 실패하는 테스트** — `src/game/logic/boatRoute.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { MEADOW_RECT } from '../data/meadow'
import { ISLAND_RADIUS } from '../data/zones'
import { BOAT_RIDE_SECONDS, boatDestination, boatPose, boatProgress, routeLength, routePoint } from './boatRoute'

/** 사각형 바깥까지의 거리 (안이면 0) */
const rectDist = (x: number, z: number) => Math.hypot(Math.max(MEADOW_RECT.x0 - x, 0, x - MEADOW_RECT.x1), Math.max(MEADOW_RECT.z0 - z, 0, z - MEADOW_RECT.z1))

describe('뱃길', () => {
  it('초원 선착장 끝에서 섬 선착장 끝까지', () => {
    const a = routePoint(0)
    const b = routePoint(1)
    expect(a.x).toBeCloseTo(82)
    expect(a.z).toBeCloseTo(-2)
    expect(b.x).toBeCloseTo(0)
    expect(b.z).toBeCloseTo(32)
  })
  it('길이는 대략 100m', () => {
    expect(routeLength()).toBeGreaterThan(90)
    expect(routeLength()).toBeLessThan(115)
  })
  it('모든 점이 섬(30m)과 초원 사각형에서 1m 넘게 떨어진 바다 위 (양 끝 1m 제외)', () => {
    const len = routeLength()
    for (let i = 0; i <= 400; i++) {
      const t = i / 400
      if (t * len < 1 || (1 - t) * len < 1) continue
      const p = routePoint(t)
      expect(Math.hypot(p.x, p.z)).toBeGreaterThan(ISLAND_RADIUS + 1)
      expect(rectDist(p.x, p.z)).toBeGreaterThan(1)
    }
  })
  it('출발할 때 서쪽(섬 쪽)을 본다', () => {
    expect(Math.sin(routePoint(0).heading)).toBeLessThan(0)
  })
})

describe('boatProgress', () => {
  it('0 에서 시작해 BOAT_RIDE_SECONDS 에 1, 그 뒤로도 1', () => {
    expect(boatProgress(0)).toBe(0)
    expect(boatProgress(BOAT_RIDE_SECONDS)).toBeCloseTo(1)
    expect(boatProgress(BOAT_RIDE_SECONDS + 5)).toBe(1)
    expect(boatProgress(-1)).toBe(0)
  })
  it('늘 앞으로만 가고, 처음·끝 1초는 천천히', () => {
    let prev = 0
    for (let s = 0; s <= BOAT_RIDE_SECONDS; s += 0.1) {
      const p = boatProgress(s)
      expect(p).toBeGreaterThanOrEqual(prev)
      prev = p
    }
    const mid = boatProgress(6.1) - boatProgress(6)
    expect(boatProgress(0.1) - boatProgress(0)).toBeLessThan(mid / 5)
    expect(boatProgress(BOAT_RIDE_SECONDS) - boatProgress(BOAT_RIDE_SECONDS - 0.1)).toBeLessThan(mid / 5)
  })
})

describe('boatPose', () => {
  it('섬으로 가면 초원 → 섬, 초원으로 가면 거꾸로이고 반대쪽을 본다', () => {
    expect(boatPose('toIsland', 0).x).toBeCloseTo(82)
    expect(boatPose('toMeadow', 0).x).toBeCloseTo(0)
    expect(boatPose('toMeadow', 1).x).toBeCloseTo(82)
    const a = boatPose('toIsland', 0.5)
    const b = boatPose('toMeadow', 0.5)
    expect(a.x).toBeCloseTo(b.x)
    expect(Math.cos(a.heading - b.heading)).toBeCloseTo(-1)
  })
  it('도착하는 땅', () => {
    expect(boatDestination('toIsland')).toBe('island')
    expect(boatDestination('toMeadow')).toBe('meadow')
  })
})
```

- [ ] **Step 2: 실행해 실패 확인**

Run: `npx vitest run src/game/logic/boatRoute.test.ts`
Expected: FAIL — `Failed to resolve import "./boatRoute"`

- [ ] **Step 3: 구현** — `src/game/logic/boatRoute.ts`

```ts
import { CatmullRomCurve3, Vector3 } from 'three'

export type BoatDir = 'toIsland' | 'toMeadow'

/** 배 타는 시간(초)과 출발·도착 때 천천히 가속·감속하는 시간(초) */
export const BOAT_RIDE_SECONDS = 12
export const BOAT_EASE_SECONDS = 1

/** 뱃길 경유점 [x, z]: 초원 선착장 끝 → 바다 → 섬 선착장 끝 */
export const BOAT_WAYPOINTS: [number, number][] = [
  [82, -2],
  [55, 18],
  [25, 40],
  [0, 32],
]

// 경유점을 부드럽게 잇는 곡선 (centripetal: 경유점 사이에서 고리·뾰족한 곳이 생기지 않는다)
const curve = new CatmullRomCurve3(BOAT_WAYPOINTS.map(([x, z]) => new Vector3(x, 0, z)), false, 'centripetal')
const pt = new Vector3()
const tan = new Vector3()

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** 뱃길 위 점. t: 0 = 초원 선착장, 1 = 섬 선착장 (길이 비율). heading: 초원 → 섬으로 갈 때 바라보는 각도 (0 = +z) */
export function routePoint(t: number): { x: number; z: number; heading: number } {
  const u = clamp01(t)
  curve.getPointAt(u, pt)
  curve.getTangentAt(u, tan)
  return { x: pt.x, z: pt.z, heading: Math.atan2(tan.x, tan.z) }
}

export const routeLength = () => curve.getLength()

/** 탄 지 elapsed 초 → 진행도 0..1. 처음·끝 BOAT_EASE_SECONDS 동안 가속·감속하고 가운데는 일정한 속도 */
export function boatProgress(elapsed: number): number {
  const d = BOAT_RIDE_SECONDS
  const e = BOAT_EASE_SECONDS
  const t = Math.min(d, Math.max(0, elapsed))
  const v = 1 / (d - e)
  if (t < e) return (0.5 * v * t * t) / e
  if (t > d - e) return 1 - (0.5 * v * (d - t) * (d - t)) / e
  return v * (t - e / 2)
}

/** 가는 방향과 진행도로 배 자리·바라보는 각도 */
export function boatPose(dir: BoatDir, progress: number): { x: number; z: number; heading: number } {
  if (dir === 'toIsland') return routePoint(progress)
  const p = routePoint(1 - progress)
  return { x: p.x, z: p.z, heading: p.heading + Math.PI }
}

export const boatDestination = (dir: BoatDir): 'island' | 'meadow' => (dir === 'toIsland' ? 'island' : 'meadow')
```

- [ ] **Step 4: 실행해 통과 확인**

Run: `npx vitest run src/game/logic/boatRoute.test.ts`
Expected: PASS. 바다 위 점 검사가 실패하면 경유점 `(25, 40)` 을 `(25, 42)` 처럼 바깥으로 옮겨 다시 돌리고, 바꾼 값을 스펙 4장 "뱃길" 과 이 계획 Global Constraints 에 같이 고친다.

- [ ] **Step 5: 커밋**

```bash
git add src/game/logic/boatRoute.ts src/game/logic/boatRoute.test.ts
git commit -m "feat: 초원과 섬을 잇는 뱃길" -m "경유점 넷을 centripetal Catmull-Rom 으로 잇고 길이 비율로 위치·방향을 구한다.
12초 동안 처음·끝 1초는 가감속한다. 모든 점이 두 땅에서 1m 넘게 떨어져 있는지 테스트한다."
```

---

### Task 7: 배 타기 (모드·상호작용·선착장·플레이어)

**Files:**
- Create: `src/game/data/boat.ts`, `src/game/scene/boat/BoatModel.tsx`, `src/game/scene/boat/Docks.tsx`
- Modify: `src/game/logic/interaction.ts`, `src/game/logic/playerMotion.ts`, `src/game/logic/mouseLook.ts`, `src/game/logic/cameraZoom.ts`, `src/game/stores/sessionStore.ts`, `src/game/input/useInteractionKeys.ts`, `src/game/ui/interactLabel.ts`, `src/game/scene/Player.tsx`, `src/game/scene/World.tsx`
- Test: `src/game/logic/interaction.test.ts`, `src/game/logic/playerMotion.test.ts`, `src/game/logic/mouseLook.test.ts`, `src/game/logic/cameraZoom.test.ts`

**Interfaces:**
- Consumes: Task 6 `BoatDir`, `boatProgress`, `boatPose`, `boatDestination`, `BOAT_WAYPOINTS`
- Produces:
  - `Mode` 에 `'boat'`. `Interactable` 에 `{ kind: 'dock'; dir: BoatDir }`. `KeyAction` 에 `{ type: 'boardBoat'; dir: BoatDir }`.
  - sessionStore: `boat: { dir: BoatDir; startedAt: number } | null`, `startBoat(dir: BoatDir)`, `endBoat()`.
  - `data/boat.ts`: `BOAT_FLOOR`, `BOAT_SEAT_SHAPE: SeatShape`, `BOAT_ARRIVE`, `BOAT_BOARD`.
  - `BoatModel` 컴포넌트 (원점 = 물 높이, 앞 = +z).

- [ ] **Step 1: 실패하는 테스트**

`src/game/logic/interaction.test.ts` 의 `describe('resolveKeyAction', …)` 안에 추가:

```ts
  it('선착장에서 E 로 배를 탄다', () => {
    expect(resolveKeyAction('KeyE', 'explore', { kind: 'dock', dir: 'toIsland' })).toEqual({ type: 'boardBoat', dir: 'toIsland' })
  })
  it('배 타는 중엔 어떤 키도 모드를 바꾸지 않는다', () => {
    for (const code of ['Escape', 'KeyE', 'Digit1', 'Space']) {
      expect(resolveKeyAction(code, 'boat', { kind: 'dock', dir: 'toMeadow' })).toEqual({ type: 'none' })
    }
  })
```

`isSameInteractable` describe 안에 추가:

```ts
  it('선착장은 가는 방향이 같아야 같은 대상', () => {
    expect(isSameInteractable({ kind: 'dock', dir: 'toIsland' }, { kind: 'dock', dir: 'toIsland' })).toBe(true)
    expect(isSameInteractable({ kind: 'dock', dir: 'toIsland' }, { kind: 'dock', dir: 'toMeadow' })).toBe(false)
  })
```

`src/game/logic/playerMotion.test.ts` 의 `describe('rodVisible', …)` 안에 추가:

```ts
  it('배에 앉아 있으면 낚싯대를 숨긴다', () => {
    expect(rodVisible('boat', 10, IDLE_ACTION)).toBe(false)
  })
```

`src/game/logic/mouseLook.test.ts` 끝에:

```ts
describe('배 타는 중 카메라', () => {
  it('마우스 잠금으로 시점을 돌릴 수 있고, 잠금이 풀려도 메뉴를 열지 않는다', () => {
    expect(canLockPointer('boat')).toBe(true)
    expect(shouldOpenMenuOnUnlock('boat', false)).toBe(false)
  })
})
```

`src/game/logic/cameraZoom.test.ts` 끝에:

```ts
describe('배 타는 중 줌', () => {
  it('확대·축소할 수 있다', () => {
    expect(canZoom('boat')).toBe(true)
  })
})
```

(두 파일의 import 에 `canLockPointer`, `shouldOpenMenuOnUnlock`, `canZoom` 이 없으면 더한다.)

- [ ] **Step 2: 실행해 실패 확인**

Run: `npx vitest run src/game/logic/interaction.test.ts src/game/logic/playerMotion.test.ts src/game/logic/mouseLook.test.ts src/game/logic/cameraZoom.test.ts`
Expected: FAIL — `'boat'` 가 Mode 가 아님(타입 오류는 vitest 가 무시하므로 실제로는 `boardBoat` 기대값 불일치·rodVisible true 로 실패)

- [ ] **Step 3: 상호작용·모드**

`src/game/logic/interaction.ts`:
- import: `import type { BoatDir } from './boatRoute'`
- 주석에 `boat = 배 타고 건너는 중 (조작 없음)` 을 더하고 `Mode` 끝에 `| 'boat'`.
- `Interactable` 끝에 `| { kind: 'dock'; dir: BoatDir }`.
- `isSameInteractable` 의 zoneGate 줄 아래: `if (a.kind === 'dock' && b.kind === 'dock') return a.dir === b.dir`
- `KeyAction` 끝에 `| { type: 'boardBoat'; dir: BoatDir }`.
- `resolveKeyAction` 첫 줄을 `if (mode === 'cutscene' || mode === 'lobby' || mode === 'boat') return { type: 'none' }` 로, 주석에 "배 타는 중에도" 를 더한다.
- switch 에 `case 'dock': return { type: 'boardBoat', dir: nearby.dir }`.

`src/game/logic/playerMotion.ts` `rodVisible`: `if (mode === 'rest' || mode === 'boat' || action.emote …` 로.

`src/game/logic/mouseLook.ts` `canLockPointer`: `return mode === 'explore' || mode === 'rest' || mode === 'boat'`.

`src/game/logic/cameraZoom.ts` 의 `ZOOM_MODES` 배열에 `'boat'` 를 더한다.

`src/game/stores/sessionStore.ts`:
- import `type BoatDir` from `'../logic/boatRoute'`.
- 상태 타입에:

```ts
  /** 배 타고 건너는 중. startedAt: 탄 시각(performance.now() 초). 진행은 boatProgress(지금 - startedAt). 저장하지 않는다 */
  boat: { dir: BoatDir; startedAt: number } | null
  startBoat: (dir: BoatDir) => void
  endBoat: () => void
```

- 구현:

```ts
  boat: null,
  startBoat: (dir) => set({ boat: { dir, startedAt: performance.now() / 1000 }, mode: 'boat', nearby: null }),
  endBoat: () => set((s) => ({ boat: null, mode: s.mode === 'boat' ? 'explore' : s.mode })),
```

- `resetSession` 에 `boat: null` 을 더한다.

`src/game/input/useInteractionKeys.ts` `runKeyAction` switch 에:

```ts
    case 'boardBoat':
      session.startBoat(action.dir)
      break
```

`src/game/ui/interactLabel.ts`:

```ts
const LABEL: Record<Exclude<Interactable['kind'], 'zoneGate' | 'dock'>, string> = {
```

`interactLabel` 을:

```ts
export function interactLabel(target: Interactable): string {
  if (target.kind === 'zoneGate') return GATE_LABEL[target.zoneId] ?? '살펴보기'
  if (target.kind === 'dock') return target.dir === 'toIsland' ? '⛵ 배 타기 (섬으로)' : '⛵ 배 타기 (초원으로)'
  return LABEL[target.kind]
}
```

Run: `npx vitest run src/game/logic/interaction.test.ts src/game/logic/playerMotion.test.ts src/game/logic/mouseLook.test.ts src/game/logic/cameraZoom.test.ts && npx tsc -b`
Expected: PASS, tsc 오류 없음 (tsc 가 `Mode` switch 의 빠진 경우를 알려 주면 그 파일도 `'boat'` 를 `'cutscene'` 과 같이 다룬다 — 예: Hud·ChatBox 가 cutscene 때 숨기는 것은 boat 때 숨기지 않아도 된다. 타입 오류만 고친다).

- [ ] **Step 4: 배 수치** — `src/game/data/boat.ts`

```ts
import type { SeatShape } from '../scene/PlayerModel'
import type { BoatDir } from '../logic/boatRoute'

/** 배 바닥 높이 (배 원점 = 물 높이에서, m). 캐릭터 발이 여기 놓인다 */
export const BOAT_FLOOR = 0.15
/** 배 가로대에 앉는 모양 (발 기준). 등받이가 없어 엉덩이가 가로대 가운데 오게 backrestZ 를 뒤로 둔다 */
export const BOAT_SEAT_SHAPE: SeatShape = { surfaceY: 0.3, backrestZ: -0.25 }

/** 배 타기 감지 상자 가운데 [x, z] 와 가는 방향. 선착장 뭍 쪽 (섬은 낚시 물가 띠 밖) */
export const BOAT_BOARD: { center: [number, number]; dir: BoatDir }[] = [
  { center: [88.5, -2], dir: 'toIsland' },
  { center: [0, 23.5], dir: 'toMeadow' },
]

/** 내리는 자리와 바라보는 각도 (0 = +z): 선착장 끝, 뭍 쪽을 본다 */
export const BOAT_ARRIVE = {
  island: { x: 0, z: 26.2, facing: Math.PI },
  meadow: { x: 85, z: -2, facing: Math.PI / 2 },
}
```

(배가 떠 있는 자리는 뱃길 양 끝 `BOAT_WAYPOINTS` 를 그대로 쓴다.)

- [ ] **Step 5: 배 모양** — `src/game/scene/boat/BoatModel.tsx`

```tsx
const WOOD = '#8d6e63'
const DARK = '#5d4037'

/** 기본 도형으로 만든 작은 나무배. 원점 = 물 높이, 앞 = +z, 길이 3.2m 폭 1.4m */
export function BoatModel() {
  return (
    <group>
      {/* 바닥 */}
      <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.2, 2.8]} />
        <meshStandardMaterial color={WOOD} />
      </mesh>
      {/* 양옆 */}
      {[-0.65, 0.65].map((x) => (
        <mesh key={x} position={[x, 0.3, 0]} castShadow>
          <boxGeometry args={[0.1, 0.4, 2.8]} />
          <meshStandardMaterial color={WOOD} />
        </mesh>
      ))}
      {/* 뒤판과 뾰족한 앞 */}
      <mesh position={[0, 0.3, -1.4]} castShadow>
        <boxGeometry args={[1.4, 0.4, 0.1]} />
        <meshStandardMaterial color={WOOD} />
      </mesh>
      <mesh position={[0, 0.3, 1.55]} rotation-y={Math.PI / 4} castShadow>
        <boxGeometry args={[0.95, 0.4, 0.95]} />
        <meshStandardMaterial color={WOOD} />
      </mesh>
      {/* 앉는 가로대 */}
      <mesh position={[0, 0.4, -0.1]} castShadow>
        <boxGeometry args={[1.2, 0.06, 0.35]} />
        <meshStandardMaterial color={DARK} />
      </mesh>
    </group>
  )
}
```

(가로대 윗면 = 0.43 = `BOAT_FLOOR` 0.15 + 0.28 ≈ `BOAT_SEAT_SHAPE.surfaceY` 0.3. 화면에서 엉덩이가 뜨거나 묻히면 `surfaceY` 만 조정한다.)

- [ ] **Step 6: 선착장 배·감지 상자** — `src/game/scene/boat/Docks.tsx`

```tsx
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { BOAT_BOARD } from '../../data/boat'
import { WATER_Y } from '../../data/zones'
import { BOAT_WAYPOINTS } from '../../logic/boatRoute'
import { waveHeight } from '../../logic/waves'
import { useSessionStore } from '../../stores/sessionStore'
import { InteractionZone } from '../facilities/InteractionZone'
import { BoatModel } from './BoatModel'

const first = BOAT_WAYPOINTS[0]
const last = BOAT_WAYPOINTS[BOAT_WAYPOINTS.length - 1]
/** 선착장에 떠 있는 배 [x, z, 바라보는 각도]: 초원 쪽은 서쪽(섬), 섬 쪽은 남쪽(바다)을 본다 */
const MOORED: [number, number, number][] = [
  [first[0], first[1], -Math.PI / 2],
  [last[0], last[1], 0],
]

/** 두 선착장의 배(물결 따라 출렁인다)와 배 타기 감지 상자. 내가 배를 타는 동안엔 선착장 배를 숨긴다 (타고 있는 배가 대신 간다) */
export function Docks() {
  const boats = useRef<(Group | null)[]>([])
  const riding = useSessionStore((s) => s.boat !== null)

  useFrame(({ clock }) => {
    MOORED.forEach(([x, z], i) => {
      const g = boats.current[i]
      if (g) g.position.y = WATER_Y + waveHeight(x, z, clock.elapsedTime)
    })
  })

  return (
    <>
      {MOORED.map(([x, z, heading], i) => (
        <group key={i} ref={(g) => void (boats.current[i] = g)} position={[x, WATER_Y, z]} rotation-y={heading} visible={!riding}>
          <BoatModel />
        </group>
      ))}
      {BOAT_BOARD.map((b) => (
        <InteractionZone key={b.dir} position={[b.center[0], 0.8, b.center[1]]} halfSize={[1.5, 1.2, 1.5]} target={{ kind: 'dock', dir: b.dir }} />
      ))}
    </>
  )
}
```

World.tsx 에 `<Docks />` 를 `<MeadowWorld />` 아래에 넣는다(`import { Docks } from './boat/Docks'`).

- [ ] **Step 7: Player.tsx 배 타기**

import 더하기:

```ts
import { BOAT_ARRIVE, BOAT_FLOOR, BOAT_SEAT_SHAPE } from '../data/boat'
import { WATER_Y } from '../data/zones'
import { boatDestination, boatPose, boatProgress } from '../logic/boatRoute'
import { waveHeight } from '../logic/waves'
import { BoatModel } from './boat/BoatModel'
```

(`BENCH_SEAT` import 줄에 `WATER_Y` 를 합친다.)

`Player()` 안 refs 에 `const boatRef = useRef<Group>(null)` 를 더한다.

배 위에서도 시점을 돌릴 수 있게, 마우스 잠금 `onMove` 의 `if ((mode !== 'explore' && mode !== 'rest') || …` 를 `if ((mode !== 'explore' && mode !== 'rest' && mode !== 'boat') || …` 로, `// 0-1)` 드래그 조건 `(mode === 'explore' || mode === 'rest')` 를 `(mode === 'explore' || mode === 'rest' || mode === 'boat')` 로 바꾼다(주석의 "돌아다닐 때와 벤치에 앉아 쉴 때" 에 "배 탈 때" 를 더한다).

`currentPlace` 맨 앞:

```ts
    // 배 타는 중엔 저장하지 않는다 (새로고침하면 출발한 선착장에서 다시 시작)
    if (useSessionStore.getState().mode === 'boat') return null
```

(1초 저장과 `visibilitychange`/`pagehide` 저장이 모두 `currentPlace()` 를 거치므로 이것 하나로 막힌다.)

`useFrame` 안, `const rb = body.current; if (!rb) return; const mode = …` 다음에 배 진행을 계산한다:

```ts
    // 0-a) 배 타기: 몸을 물리에서 빼고(키네마틱) 뱃길을 따라 옮긴다. 도착하면 선착장에 내려 주고 물리로 돌린다
    const ride = mode === 'boat' ? useSessionStore.getState().boat : null
    let boatAt: { x: number; y: number; z: number; heading: number } | null = null
    if (ride) {
      const progress = boatProgress(performance.now() / 1000 - ride.startedAt)
      if (progress >= 1) {
        const to = BOAT_ARRIVE[boatDestination(ride.dir)]
        rb.setBodyType(rapier.RigidBodyType.Dynamic, true)
        rb.setTranslation({ x: to.x, y: 1, z: to.z }, true)
        rb.setLinvel({ x: 0, y: 0, z: 0 }, true)
        playerRig.position.set(to.x, 1, to.z)
        facing.current = to.facing
        useSessionStore.getState().endBoat()
        // 도착하면 바로 저장한다
        const place = currentPlace()
        if (place) {
          saved.current.place = place
          usePlaceStore.getState().savePlace(place)
        }
      } else {
        const pose = boatPose(ride.dir, progress)
        const waterY = WATER_Y + waveHeight(pose.x, pose.z, clock.elapsedTime)
        if (rb.bodyType() !== rapier.RigidBodyType.KinematicPositionBased) rb.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true)
        boatAt = { x: pose.x, y: waterY + BOAT_FLOOR - FOOT_Y, z: pose.z, heading: pose.heading }
        rb.setNextKinematicTranslation({ x: boatAt.x, y: boatAt.y, z: boatAt.z })
      }
    }
```

(`endBoat()` 뒤 같은 프레임의 `mode` 변수는 아직 'boat' 다. 아래 단계는 `boatAt === null` 이면 보통처럼 움직이고, 다음 프레임부터 explore 다.)

`// 2) 땅 …` 블록(Task 5 에서 바꾼 것)을 아래로 바꾼다:

```ts
    // 2) 땅(섬·초원·선착장) 밖으로 못 나가게 가장자리에서 붙잡는다 (이전 자리가 있던 땅의 경계로). 배 위면 배 자리
    const p = rb.translation()
    let x: number
    let z: number
    let y = p.y
    if (boatAt) {
      x = boatAt.x
      z = boatAt.z
      y = boatAt.y
    } else {
      const held = clampToLand(playerRig.position, p)
      x = held.x
      z = held.z
      if (x !== p.x || z !== p.z) rb.setTranslation({ x, y: p.y, z }, true)
    }
    playerRig.position.set(x, y, z)
```

아래쪽에서 `p.y` 를 쓰는 카메라 줄 `c.feetY += (p.y + FOOT_Y - c.feetY) * k` 를 `c.feetY += (y + FOOT_Y - c.feetY) * k` 로 바꾼다.

`// 3) 바라보는 방향` 의 if 사슬 맨 앞에 배를 더한다:

```ts
    if (boatAt) {
      facing.current = boatAt.heading
    } else if (mode === 'fishing' && spot) {
```

`playerRig.resting = mode === 'rest'` 를 `playerRig.resting = mode === 'rest' || boatAt !== null` 로.

캐릭터 그리기 `m.update(...)` 를:

```ts
        const seated = mode === 'rest' || boatAt !== null
        m.update(delta, now, fishingLook(fishing), action, speed, rod.current.rotation.x, seated, boatAt ? BOAT_SEAT_SHAPE : BENCH_SEAT_SHAPE)
```

(주석 "골반은 벤치 자리에 붙인다" 를 "골반은 벤치·배 가로대에 붙인다" 로.)

배 모양을 몸에 붙여 같이 움직이게: `if (visual.current) visual.current.rotation.y = facing.current` 다음 줄에

```ts
    if (boatRef.current) boatRef.current.visible = boatAt !== null
```

JSX 의 `<group ref={visual}>` 안 첫 자식으로:

```tsx
        {/* 타고 가는 배. 원점이 물 높이라 발(FOOT_Y)에서 배 바닥만큼 내린다 */}
        <group ref={boatRef} position={[0, FOOT_Y - BOAT_FLOOR, 0]} visible={false}>
          <BoatModel />
        </group>
```

- [ ] **Step 8: 확인**

Run: `npx vitest run && npx tsc -b && npm run lint 2>&1 | grep -c warning`
Expected: 모두 PASS, warning 6.

meadow-check 에 점검 4·5 를 더한다(Step 7 의 A 를 닫기 전에):

```js
// 4) 초원 선착장에서 E → 배 → 15초 안에 섬 선착장
await A.evaluate(teleport(88.5, -2))
await wait(1500)
check(await A.until(`document.body.innerText.includes('배 타기 (섬으로)')`, 5000), '4) 선착장에서 "배 타기 (섬으로)" 안내')
await A.key('keydown', 'KeyE', 'e')
await A.key('keyup', 'KeyE', 'e')
await wait(5000)
const mid = await A.evaluate(pos)
check(Math.hypot(mid[0], mid[2]) > 31 && mid[0] < 90, `4) 가는 중엔 바다 위 (${mid.map((v) => v.toFixed(1))})`)
await A.shot('4-boat')
// 타는 중 새로고침해도 출발한 쪽에서 시작하도록 저장하지 않는다
const savedMid = await A.evaluate(`JSON.parse(localStorage.getItem('fishing-island-place-v1') || 'null')?.state?.place`)
check(!savedMid || savedMid.x > 84, `4) 타는 중 자리는 저장하지 않는다 (${JSON.stringify(savedMid && [savedMid.x, savedMid.z])})`)
const arrived = await A.until(`(async () => { const { playerRig } = await __mod('/src/game/scene/Player.tsx'); return Math.hypot(playerRig.position.x, playerRig.position.z) < 29 })()`, 15000)
const pa = await A.evaluate(pos)
check(arrived && pa[1] > -0.2, `4) 섬 선착장에 내렸다 (${pa.map((v) => v.toFixed(1))})`)
await A.shot('4-arrived')
// 키네마틱으로 감지 상자를 떠났다 돌아와도 안내가 다시 뜬다 (섬 쪽, 출발했던 초원 쪽 둘 다)
await A.evaluate(teleport(0, 23.5))
check(await A.until(`document.body.innerText.includes('배 타기 (초원으로)')`, 5000), '4) 섬 선착장에서 "배 타기 (초원으로)" 안내')
await A.evaluate(teleport(88.5, -2))
check(await A.until(`document.body.innerText.includes('배 타기 (섬으로)')`, 5000), '4) 출발했던 초원 선착장에서도 안내가 다시 뜬다')

// 5) 섬 물가에선 낚시 안내, 초원 안쪽에선 없다
await A.evaluate(teleport(0, 27))
await wait(1500)
check(await A.until(`document.body.innerText.includes('낚시하기')`, 5000), '5) 섬 선착장 끝에서 낚시 안내')
await A.evaluate(teleport(150, 0))
await wait(1500)
check(await A.evaluate(`!document.body.innerText.includes('낚시하기')`), '5) 초원에서는 낚시 안내 없음')
```

Run: `node tools/meadow-check.mjs http://127.0.0.1:5190 <스크래치패드>/meadow-check`
Expected: 1)~5) 모두 OK. `4-boat.png` 에서 캐릭터가 배에 앉아 있다(엉덩이가 가로대에 맞지 않으면 `BOAT_SEAT_SHAPE.surfaceY` 만 고치고 다시 찍는다).

- [ ] **Step 9: 커밋**

```bash
git add src/game tools/meadow-check.mjs
git commit -m "feat: 배 타고 초원과 섬 오가기" -m "선착장에서 E(모바일 상호작용 버튼)로 배를 타면 키네마틱 몸으로 12초 동안 뱃길을 따라가고 반대편 선착장에 내린다.
타는 동안 앉은 자세이고 모든 키는 무시한다. 카메라는 움직일 수 있다. 타는 중엔 자리를 저장하지 않는다."
```

---

### Task 8: 같이 하기 (좌표 한도·배 표시)

**Files:**
- Modify: `src/game/data/net.ts`, `src/game/logic/netProtocol.ts`, `src/game/net/NetBridge.tsx`, `src/game/scene/RemotePlayer.tsx`
- Test: `src/game/logic/netProtocol.test.ts`, `server/src/roomRules.test.ts` (그대로 통과하는지만)

**Interfaces:**
- Consumes: `BoatDir`, `boatProgress` (Task 6), session `boat` (Task 7), `BoatModel`, `BOAT_FLOOR`, `BOAT_SEAT_SHAPE` (Task 7)
- Produces: `NetState.boat?: { dir: BoatDir; t: number }`

- [ ] **Step 1: 실패하는 테스트** — `src/game/logic/netProtocol.test.ts` `describe('parseClientMsg', …)` 안에:

```ts
  it('초원 좌표(최대 400)를 받는다', () => {
    expect(parseClientMsg(json({ type: 'state', s: state({ p: [290, 0, -110] }) }))).toEqual({ type: 'state', s: state({ p: [290, 0, -110] }) })
    expect(parseClientMsg(json({ type: 'state', s: state({ p: [401, 0, 0] }) }))).toBeNull()
  })
  it('배 정보는 있으면 검사하고, 틀리면 그 필드만 버린다', () => {
    const boat = { dir: 'toIsland', t: 0.4 }
    expect(parseClientMsg(json({ type: 'state', s: { ...state(), boat } }))).toEqual({ type: 'state', s: { ...state(), boat } })
    expect(parseClientMsg(json({ type: 'state', s: { ...state(), boat: { dir: 'toMoon', t: 0.4 } } }))).toEqual({ type: 'state', s: state() })
    expect(parseClientMsg(json({ type: 'state', s: { ...state(), boat: { dir: 'toMeadow', t: 2 } } }))).toEqual({ type: 'state', s: state() })
    expect(parseClientMsg(json({ type: 'state', s: state() }))).toEqual({ type: 'state', s: state() })
  })
```

`describe('roundState·stateKey', …)` 안에:

```ts
  it('배 진행도도 둘째 자리로, 배를 타고 내리면 다른 상태', () => {
    const s = state({ boat: { dir: 'toMeadow', t: 0.123456 } })
    expect(roundState(s).boat).toEqual({ dir: 'toMeadow', t: 0.12 })
    expect(stateKey(roundState(s))).not.toBe(stateKey(state()))
    expect('boat' in roundState(state())).toBe(false)
  })
```

- [ ] **Step 2: 실행해 실패 확인**

Run: `npx vitest run src/game/logic/netProtocol.test.ts`
Expected: FAIL — `[290, 0, -110]` 이 null, boat 가 빠짐

- [ ] **Step 3: 구현**

`src/game/data/net.ts`:

```ts
  /** 받는 좌표 한계 (섬 원점 반경 30 + 초원 x 90..290 + 여유) */
  coordLimit: 400,
```

`src/game/logic/netProtocol.ts`:
- import `type BoatDir` from `'./boatRoute'`.
- `NetState` 끝에 `; boat?: NetBoat` 를 더하고 위에:

```ts
/** 배 타는 중이면 가는 방향과 진행도(0~1). 없으면 배를 타지 않았다 (옛 클라이언트도 보내지 않는다) */
export type NetBoat = { dir: BoatDir; t: number }
const BOAT_DIRS: BoatDir[] = ['toIsland', 'toMeadow']
```

- `readNetState` 의 `return` 을:

```ts
  const out: NetState = { p, f, v: speed, rest: v.rest, fish, rod, rodOn: v.rodOn, bob, act }
  // 배 정보는 틀려도 그 필드만 버린다 (모습 전체를 버리지 않는다)
  const boat = readBoat(v.boat)
  if (boat) out.boat = boat
  return out
```

  그리고 `readFish` 아래에:

```ts
function readBoat(v: unknown): NetBoat | null {
  if (!isRecord(v)) return null
  const dir = oneOf(v.dir, BOAT_DIRS)
  const t = num(v.t, 0, 1)
  return dir && t !== null ? { dir, t } : null
}
```

- `roundState` 의 반환 객체를 변수로 받아 끝에 `if (s.boat) out.boat = { dir: s.boat.dir, t: r2(s.boat.t) }` 를 더하고 `return out`.
- `stateKey` 배열 끝에 `s.boat?.dir ?? null` 을 더한다(진행도는 저절로 늘어서 빼고, 탔는지·방향만).

`src/game/net/NetBridge.tsx` — `roundState({ … })` 에 넘기는 객체를 변수로 만들고 배 정보를 붙인다:

```ts
    const session = useSessionStore.getState()
    const raw: NetState = {
      p: [playerRig.position.x, playerRig.position.y, playerRig.position.z],
      f: playerRig.facing,
      v: playerRig.speed,
      rest: playerRig.resting,
      fish: fishingLook(useFishingStore.getState().state),
      rod: playerRig.rodAngle,
      rodOn: playerRig.rodShown,
      bob: bob?.visible ? [bob.position.x, bob.position.y, bob.position.z] : null,
      act: toNetAct(session.playerAction, now),
    }
    if (session.mode === 'boat' && session.boat) raw.boat = { dir: session.boat.dir, t: boatProgress(performance.now() / 1000 - session.boat.startedAt) }
    const s = roundState(raw)
```

(import `boatProgress` from `'../logic/boatRoute'`.)

`src/game/scene/RemotePlayer.tsx`:
- import `BOAT_FLOOR`, `BOAT_SEAT_SHAPE` from `'../data/boat'`, `BoatModel` from `'./boat/BoatModel'`.
- ref `const boatRef = useRef<Group>(null)`.
- `useFrame` 에서 `const s = cur.s` 다음에 `if (boatRef.current) boatRef.current.visible = s.boat !== undefined`.
- `m.update(...)` 마지막 인자를 `s.boat ? BOAT_SEAT_SHAPE : BENCH_SEAT_SHAPE` 로, 주석 "골반은 벤치 자리에 붙인다(앉아 있으면)" 를 "골반은 벤치·배 가로대에 붙인다(앉아 있으면)" 로.
- JSX `<group ref={visual}>` 첫 자식:

```tsx
          {/* 배 타는 사람은 배째로 (원점 = 물 높이, 발에서 배 바닥만큼 아래) */}
          <group ref={boatRef} position={[0, FOOT_Y - BOAT_FLOOR, 0]} visible={false}>
            <BoatModel />
          </group>
```

- [ ] **Step 4: 실행해 통과 확인**

Run: `npx vitest run && npx tsc -b && npm run lint 2>&1 | grep -c warning`
Expected: 모두 PASS(서버 `roomRules.test.ts` 포함), warning 6.

- [ ] **Step 5: 두 사람 점검** — meadow-check 끝(A 를 닫기 전)에 점검 7 을 더한다. multiplayer-check 처럼 방을 만들고 B 가 들어온다:

```js
// 7) 같이 하기: A 가 초원에서 걷고 배를 타는 게 B 에게 보인다
const RUN = Date.now().toString(36)
const A2 = await open(9733, 0, `?room=meadow-${RUN}`)
await A2.evaluate(`__click('🔒 방 만들기')`)
await A2.evaluate(`__fill('암호', 'secret1') && __fill('닉네임', '에이')`)
await A2.evaluate(`__click('방 만들고 들어가기')`)
check(await A2.until(`document.body.innerText.includes('👥 1명')`, 20000), '7) A 방 만들기')
const B2 = await open(9734, 1, `?room=meadow-${RUN}`)
await B2.evaluate(`__fill('암호', 'secret1') && __fill('닉네임', '비이')`)
await B2.evaluate(`__click('들어가기')`)
check(await B2.until(`document.body.innerText.includes('👥 2명')`, 20000), '7) B 들어가기')
const remote = `(async () => { const { remoteRig } = await __mod('/src/game/net/remoteRig.ts'); const e = [...remoteRig.values()][0]; return e ? e.buf.at(-1).s : null })()`
await wait(2500)
const r0 = await B2.evaluate(remote)
check(r0 && r0.p[0] > 90, `7) B 가 초원에 있는 A 를 받는다 (${r0 && r0.p.map((v) => v.toFixed(1))})`)
await A2.evaluate(teleport(88.5, -2))
await wait(1500)
await A2.key('keydown', 'KeyE', 'e')
await A2.key('keyup', 'KeyE', 'e')
check(await B2.until(`${remote}.then((s) => !!s && !!s.boat)`, 8000), '7) A 가 배를 타면 B 가 배 정보를 받는다')
await wait(1500)
await B2.shot('7-b-sees-boat')
A2.close()
B2.close()
```

Run: `node tools/meadow-check.mjs http://127.0.0.1:5190 <스크래치패드>/meadow-check && node tools/multiplayer-check.mjs http://127.0.0.1:5190 <스크래치패드>/mp && node tools/hub-entry-check.mjs http://127.0.0.1:5190 <스크래치패드>/hub`
Expected: 모두 OK. `7-b-sees-boat.png` 에 B 화면 속 A 가 배를 타고 있다(카메라가 B 자리라 멀면 작게 보인다. 안 보이면 B 도 선착장(88.5, -2) 근처로 옮겨 다시 찍는다).

multiplayer-check 는 새 시작 자리(초원)에서 W 로 걷는 점검을 한다 — 초원에서도 걸을 수 있으니 그대로 통과해야 한다. 실패하면 원인을 찾아 고치고 이 Task 에 적는다.

- [ ] **Step 6: 커밋**

```bash
git add src/game server tools/meadow-check.mjs
git commit -m "feat: 같이 하기에서 초원과 배 보이기" -m "받는 좌표 한도를 40에서 400으로 올렸다. 모습(state)에 선택 필드 boat(방향·진행도)를 더했다.
배 정보가 틀리면 그 필드만 버린다. 받는 쪽은 배와 앉은 자세로 그린다. 옛 클라이언트는 boat 를 모르고 넘긴다."
```

---

### Task 9: 미니맵·큰 지도

**Files:**
- Create: `src/game/logic/mapView.ts`, `src/game/ui/MiniMap.tsx`
- Modify: `src/game/Game.tsx`
- Test: `src/game/logic/mapView.test.ts`

**Interfaces:**
- Consumes: `playerRig.position`, `playerRig.facing`, `playerRig.yaw` (Task 5), `remoteRig` 버퍼, `areaToWorld`, `MEADOW_RECT`, `MEADOW_DOCK`, vendor `ROOMS`/`YARD`/`ANIMAL_ZONE`/`TOWN_LAYOUT`
- Produces: `MAP_BOUNDS: Rect`, `MAP_PX_PER_M = 2`, `mapPixel(x, z): [number, number]`, `miniMapPoint(dx, dz, yaw, scale): [number, number]`, `fitBigMap(width, height): { scale: number; ox: number; oy: number }`

- [ ] **Step 1: 실패하는 테스트** — `src/game/logic/mapView.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { MAP_BOUNDS, MAP_PX_PER_M, fitBigMap, mapPixel, miniMapPoint } from './mapView'

const close = (a: [number, number], b: [number, number]) => {
  expect(a[0]).toBeCloseTo(b[0])
  expect(a[1]).toBeCloseTo(b[1])
}

describe('정적 지도 픽셀', () => {
  it('왼쪽 위가 MAP_BOUNDS 의 (x0, z0), 위 = 북(-z), 오른쪽 = 동(+x)', () => {
    expect(mapPixel(MAP_BOUNDS.x0, MAP_BOUNDS.z0)).toEqual([0, 0])
    expect(mapPixel(MAP_BOUNDS.x0 + 10, MAP_BOUNDS.z0 + 5)).toEqual([10 * MAP_PX_PER_M, 5 * MAP_PX_PER_M])
  })
  it('섬과 초원이 모두 들어간다', () => {
    expect(MAP_BOUNDS.x0).toBeLessThan(-30)
    expect(MAP_BOUNDS.x1).toBeGreaterThan(290)
    expect(MAP_BOUNDS.z0).toBeLessThan(-110)
    expect(MAP_BOUNDS.z1).toBeGreaterThan(90)
  })
})

describe('미니맵 (카메라 방향이 위)', () => {
  it('카메라 yaw 0 이면 카메라가 -z(북)를 보므로 북이 위, 동이 오른쪽', () => {
    close(miniMapPoint(0, -10, 0, 1), [0, -10])
    close(miniMapPoint(10, 0, 0, 1), [10, 0])
  })
  it('카메라가 동쪽을 보면(yaw -π/2) 동쪽이 위', () => {
    // 앞 = (-sin yaw, -cos yaw) = (1, 0) 동쪽
    close(miniMapPoint(10, 0, -Math.PI / 2, 1), [0, -10])
  })
  it('캔버스 rotate(yaw) 와 같은 변환이다 (그림과 점이 같이 돈다)', () => {
    const yaw = 0.7
    const [dx, dz] = [3, -4]
    const canvas: [number, number] = [dx * Math.cos(yaw) - dz * Math.sin(yaw), dx * Math.sin(yaw) + dz * Math.cos(yaw)]
    close(miniMapPoint(dx, dz, yaw, 1), canvas)
  })
})

describe('큰 지도', () => {
  it('화면에 맞게 줄이고 가운데에 둔다', () => {
    const w = MAP_BOUNDS.x1 - MAP_BOUNDS.x0
    const h = MAP_BOUNDS.z1 - MAP_BOUNDS.z0
    const f = fitBigMap(w, h * 2)
    expect(f.scale).toBeCloseTo(1)
    expect(f.ox).toBeCloseTo(0)
    expect(f.oy).toBeCloseTo(h / 2)
  })
})
```

- [ ] **Step 2: 실행해 실패 확인**

Run: `npx vitest run src/game/logic/mapView.test.ts`
Expected: FAIL — `Failed to resolve import "./mapView"`

- [ ] **Step 3: 구현** — `src/game/logic/mapView.ts`

```ts
import type { Rect } from '../data/meadow'

/** 지도에 그리는 세계 범위: 섬(-30..30)과 초원(x 90..290, z -110..90) + 여유 */
export const MAP_BOUNDS: Rect = { x0: -40, x1: 300, z0: -120, z1: 100 }
/** 정적 지도 그림의 해상도 (픽셀/m) */
export const MAP_PX_PER_M = 2

/** 세계 (x, z) → 정적 지도 그림 픽셀. 위 = 북(-z), 오른쪽 = 동(+x) */
export function mapPixel(x: number, z: number): [number, number] {
  return [(x - MAP_BOUNDS.x0) * MAP_PX_PER_M, (z - MAP_BOUNDS.z0) * MAP_PX_PER_M]
}

/**
 * 미니맵: 내 자리에서 (dx, dz) 떨어진 곳 → 미니맵 가운데 기준 화면 좌표. 화면 위 = 카메라가 보는 쪽.
 * 카메라 앞 = (-sin yaw, -cos yaw), 오른쪽 = (cos yaw, -sin yaw) 라서 캔버스 rotate(yaw) 와 같다
 */
export function miniMapPoint(dx: number, dz: number, yaw: number, scale: number): [number, number] {
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  return [(dx * c - dz * s) * scale, (dx * s + dz * c) * scale]
}

/** 큰 지도: 지도 범위(m)를 width×height 화면에 맞추는 배율(px/m)과 왼쪽 위 여백 */
export function fitBigMap(width: number, height: number): { scale: number; ox: number; oy: number } {
  const w = MAP_BOUNDS.x1 - MAP_BOUNDS.x0
  const h = MAP_BOUNDS.z1 - MAP_BOUNDS.z0
  const scale = Math.min(width / w, height / h)
  return { scale, ox: (width - w * scale) / 2, oy: (height - h * scale) / 2 }
}
```

- [ ] **Step 4: 실행해 통과 확인**

Run: `npx vitest run src/game/logic/mapView.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: 미니맵 화면** — `src/game/ui/MiniMap.tsx`

```tsx
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { MEADOW_DOCK, MEADOW_RECT, areaToWorld, type Rect } from '../data/meadow'
import { ISLAND_RADIUS, ZONES } from '../data/zones'
import { MAP_BOUNDS, MAP_PX_PER_M, fitBigMap, mapPixel, miniMapPoint } from '../logic/mapView'
import { remoteRig } from '../net/remoteRig'
import { playerRig } from '../scene/Player'
import { useSessionStore } from '../stores/sessionStore'
import { useTouchUi } from '../input/touchDevice'
import { ANIMAL_ZONE, YARD } from '../../meadow/vendor/outdoor.js'
import { TOWN_LAYOUT } from '../../meadow/vendor/town.js'
import { ROOMS } from '../../meadow/vendor/world.js'
import { safeRight, safeTop } from './styles'
import { useNarrow } from './useNarrow'

/** 미니맵이 보여 주는 반경(m)과 다시 그리는 간격(초, 10fps) */
const VIEW_RADIUS = 40
const REDRAW = 0.1

const SEA = '#3b8fd1'
const SAND = '#e9d8a6'

/** 정적 지도: 바다·초원·마당·동물 들판·마을·집·선착장·섬. 한 번만 그린다 */
function drawStatic(): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = (MAP_BOUNDS.x1 - MAP_BOUNDS.x0) * MAP_PX_PER_M
  c.height = (MAP_BOUNDS.z1 - MAP_BOUNDS.z0) * MAP_PX_PER_M
  const g = c.getContext('2d')!
  const rect = (r: Rect, color: string) => {
    const [x, y] = mapPixel(r.x0, r.z0)
    g.fillStyle = color
    g.fillRect(x, y, (r.x1 - r.x0) * MAP_PX_PER_M, (r.z1 - r.z0) * MAP_PX_PER_M)
  }
  g.fillStyle = SEA
  g.fillRect(0, 0, c.width, c.height)
  // 초원
  rect(MEADOW_RECT, SAND)
  rect({ x0: MEADOW_RECT.x0 + 4, x1: MEADOW_RECT.x1 - 4, z0: MEADOW_RECT.z0 + 4, z1: MEADOW_RECT.z1 - 4 }, '#7fb15a')
  rect(areaToWorld(ANIMAL_ZONE), '#9cc76f')
  rect(areaToWorld(YARD), '#a6d07a')
  rect(areaToWorld(TOWN_LAYOUT.square), '#c9bfae')
  for (const room of ROOMS) rect(areaToWorld(room), '#efe6d6')
  rect(MEADOW_DOCK, '#a1887f')
  // 섬: 모래 원 + 북쪽 반원 풀밭 + 구역 색 점
  const [ix, iy] = mapPixel(0, 0)
  g.fillStyle = SAND
  g.beginPath()
  g.arc(ix, iy, ISLAND_RADIUS * MAP_PX_PER_M, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#9ccc65'
  g.beginPath()
  g.arc(ix, iy, (ISLAND_RADIUS - 0.1) * MAP_PX_PER_M, Math.PI, Math.PI * 2)
  g.fill()
  rect({ x0: -1.7, x1: 1.7, z0: 20.8, z1: 30 }, '#a1887f')
  for (const z of ZONES) {
    if (!z.gate) continue
    const [gx, gy] = mapPixel((z.gate.xFrom + z.gate.xTo) / 2, -10)
    g.fillStyle = z.color
    g.beginPath()
    g.arc(gx, gy, 6 * MAP_PX_PER_M, 0, Math.PI * 2)
    g.fill()
  }
  return c
}

/** 내 화살표 (바라보는 쪽 = angle, 캔버스 각도) */
function arrow(g: CanvasRenderingContext2D, x: number, y: number, angle: number, size: number) {
  g.save()
  g.translate(x, y)
  g.rotate(angle)
  g.fillStyle = '#ff5252'
  g.strokeStyle = '#fff'
  g.lineWidth = 1.5
  g.beginPath()
  g.moveTo(0, -size)
  g.lineTo(size * 0.7, size * 0.8)
  g.lineTo(0, size * 0.4)
  g.lineTo(-size * 0.7, size * 0.8)
  g.closePath()
  g.fill()
  g.stroke()
  g.restore()
}

/** 같이 하는 사람들 마지막 위치 [x, z] */
function peers(): [number, number][] {
  const out: [number, number][] = []
  for (const e of remoteRig.values()) {
    const p = e.buf.at(-1)?.s.p
    if (p) out.push([p[0], p[2]])
  }
  return out
}

/**
 * 오른쪽 위 둥근 미니맵: 내 주변 40m 를 카메라가 보는 쪽이 위로 오게 돌려 그린다. 누르면 큰 지도(위 = 북, 고정).
 * 정적 지도는 한 번만 그리고 10fps 로 다시 그린다
 */
export function MiniMap() {
  const mode = useSessionStore((s) => s.mode)
  const narrowScreen = useNarrow()
  const touchUi = useTouchUi()
  const narrow = narrowScreen || touchUi
  const [big, setBig] = useState(false)
  const mini = useRef<HTMLCanvasElement>(null)
  const large = useRef<HTMLCanvasElement>(null)
  const size = narrow ? 110 : 140

  useEffect(() => {
    const map = drawStatic()
    let last = 0
    let raf = 0
    const tick = (ms: number) => {
      raf = requestAnimationFrame(tick)
      if (ms / 1000 - last < REDRAW) return
      last = ms / 1000
      const { x, z } = playerRig.position
      const c = mini.current
      if (c) {
        const g = c.getContext('2d')!
        const r = c.width / 2
        const k = r / VIEW_RADIUS // px/m
        g.clearRect(0, 0, c.width, c.height)
        g.save()
        g.beginPath()
        g.arc(r, r, r, 0, Math.PI * 2)
        g.clip()
        g.translate(r, r)
        g.rotate(playerRig.yaw)
        g.scale(k / MAP_PX_PER_M, k / MAP_PX_PER_M)
        const [px, py] = mapPixel(x, z)
        g.drawImage(map, -px, -py)
        g.restore()
        for (const [qx, qz] of peers()) {
          const [sx, sy] = miniMapPoint(qx - x, qz - z, playerRig.yaw, k)
          if (Math.hypot(sx, sy) > r - 4) continue
          g.fillStyle = '#ffeb3b'
          g.beginPath()
          g.arc(r + sx, r + sy, 3.5, 0, Math.PI * 2)
          g.fill()
        }
        // 바라보는 쪽: facing(0 = +z)을 미니맵 화면 각도로
        const [fx, fy] = miniMapPoint(Math.sin(playerRig.facing), Math.cos(playerRig.facing), playerRig.yaw, 1)
        arrow(g, r, r, Math.atan2(fx, -fy), 7)
      }
      const L = large.current
      if (L) {
        const g = L.getContext('2d')!
        const f = fitBigMap(L.width, L.height)
        g.clearRect(0, 0, L.width, L.height)
        g.drawImage(map, f.ox, f.oy, (map.width / MAP_PX_PER_M) * f.scale, (map.height / MAP_PX_PER_M) * f.scale)
        const at = (wx: number, wz: number): [number, number] => [f.ox + (wx - MAP_BOUNDS.x0) * f.scale, f.oy + (wz - MAP_BOUNDS.z0) * f.scale]
        for (const [qx, qz] of peers()) {
          const [sx, sy] = at(qx, qz)
          g.fillStyle = '#ffeb3b'
          g.beginPath()
          g.arc(sx, sy, 4, 0, Math.PI * 2)
          g.fill()
        }
        const [mx, my] = at(x, z)
        // 위 = 북(-z): facing 0(+z) 이 아래를 향하도록
        arrow(g, mx, my, Math.PI - playerRig.facing, 9)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [big])

  if (mode === 'cutscene' || mode === 'lobby' || mode === 'aquariumView' || mode === 'wardrobe') return null
  const box: CSSProperties = { position: 'absolute', top: safeTop(narrow ? 84 : 140), right: safeRight(16), width: size, height: size, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.85)', boxShadow: '0 2px 6px rgba(0,0,0,0.4)', overflow: 'hidden', cursor: 'pointer', pointerEvents: 'auto', zIndex: 4 }
  return (
    <>
      <canvas ref={mini} width={size * 2} height={size * 2} style={box} onClick={() => setBig(true)} aria-label="미니맵 (누르면 큰 지도)" />
      {big && (
        <div onClick={() => setBig(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 30, pointerEvents: 'auto' }}>
          <canvas ref={large} width={1360} height={880} style={{ width: 'min(92vw, 1100px)', maxHeight: '86vh', aspectRatio: '1360 / 880', borderRadius: 12, background: SEA }} aria-label="큰 지도 (누르면 닫기)" />
        </div>
      )}
    </>
  )
}
```

(미니맵 캔버스는 화면 크기의 2배 픽셀로 그려 선명하게 한다. 화살표 각도: 화면 위가 -y 라서 `atan2(fx, -fy)`.)

`Game.tsx` 에 `import { MiniMap } from './ui/MiniMap'` 하고 `<RoomBadge />` 아래에 `<MiniMap />`.

- [ ] **Step 6: 확인**

Run: `npx vitest run && npx tsc -b && npm run lint 2>&1 | grep -c warning`
Expected: PASS, warning 6.

meadow-check 에 점검 6 을 더한다(점검 4 의 섬 도착 직후):

```js
// 6) 미니맵이 보이고, 섬에 오면 섬(모래색)을 그린다
check(await A.evaluate(`!!document.querySelector('canvas[aria-label^="미니맵"]')`), '6) 미니맵이 있다')
const sandAtCenter = await A.evaluate(`(() => {
  const c = document.querySelector('canvas[aria-label^="미니맵"]')
  const d = c.getContext('2d').getImageData(c.width / 2 + 12, c.height / 2 + 12, 1, 1).data
  return [d[0], d[1], d[2]]
})()`)
check(sandAtCenter[0] > 150 && sandAtCenter[2] < 200, `6) 섬에서 미니맵 가운데가 땅색 (${sandAtCenter})`)
await A.shot('6-minimap-island')
await A.evaluate(`document.querySelector('canvas[aria-label^="미니맵"]').click(), true`)
await wait(600)
check(await A.evaluate(`!!document.querySelector('canvas[aria-label^="큰 지도"]')`), '6) 미니맵을 누르면 큰 지도')
await A.shot('6-bigmap')
await A.evaluate(`document.querySelector('canvas[aria-label^="큰 지도"]').parentElement.click(), true`)
```

Run: `node tools/meadow-check.mjs …`
Expected: 1)~7) 모두 OK. `6-bigmap.png` 에서 섬이 왼쪽, 초원이 오른쪽, 마을이 초원 왼쪽, 동물 들판이 위. 폰 크기 스크린샷(`Emulation.setDeviceMetricsOverride` 390×844, multiplayer-check 끝과 같은 방식)을 하나 찍어 미니맵이 위쪽 버튼·방 배지와 겹치지 않는지 본다. 겹치면 `top` 값만 고친다.

- [ ] **Step 7: 커밋**

```bash
git add src/game/logic/mapView.ts src/game/logic/mapView.test.ts src/game/ui/MiniMap.tsx src/game/Game.tsx tools/meadow-check.mjs
git commit -m "feat: 미니맵과 큰 지도" -m "오른쪽 위 둥근 미니맵이 내 주변 40m 를 카메라가 보는 쪽이 위로 오게 그린다. 같이 하는 사람은 노란 점.
누르면 위가 북인 큰 지도: 섬이 왼쪽, 초원이 오른쪽. 정적 지도는 한 번만 그리고 10fps 로 다시 그린다."
```

---

### Task 10: 마무리 점검과 내보내기 (사용자 확인 단계 포함)

**Files:**
- Modify: 필요하면 `docs/superpowers/specs/2026-11-17-meadow-boat-design.md` (실제와 달라진 값)
- Modify: 메모리 `rinfish-deploy-and-state.md` (진행 상황)

- [ ] **Step 1: 전체 점검**

```bash
npx vitest run > <스크래치패드>/vitest.txt 2>&1; grep -E "Test Files|Tests " <스크래치패드>/vitest.txt
npx tsc -b && npm run build 2>&1 | tail -5
npm run lint 2>&1 | grep -c warning
node tools/meadow-check.mjs http://127.0.0.1:5190 <스크래치패드>/meadow-check
node tools/multiplayer-check.mjs http://127.0.0.1:5190 <스크래치패드>/mp
node tools/hub-entry-check.mjs http://127.0.0.1:5190 <스크래치패드>/hub
```

Expected: 테스트 전부 통과(기준선 464 + 새 테스트), 빌드 성공, warning 6, 세 점검 모두 OK. 빌드 결과 `dist/meadow/models` 가 있는지 `ls dist/meadow/models` 로 본다.

- [ ] **Step 2: 스펙과 다른 점 정리** — 구현하며 바꾼 값(배 앉는 높이, 경유점, 미니맵 위치, 섬 색 등)이 있으면 스펙의 해당 줄을 고치고 커밋:

```bash
git add docs/superpowers/specs/2026-11-17-meadow-boat-design.md
git commit -m "docs: 초원 설계를 구현에 맞춤"
```

- [ ] **Step 3: [사용자 확인] 서버 배포** — 사용자에게 "같이 하기 서버를 새 좌표 한도(400)·배 정보로 배포해도 될까요? 옛 게임도 그대로 됩니다" 라고 묻고, 허락하면:

```bash
npm run server:deploy
```

Expected: wrangler 가 `rinfish-rooms` 배포 성공을 알린다. 배포 뒤 main(지금 배포된 게임)으로 혼자·같이 하기가 그대로 되는지 `node tools/multiplayer-check.mjs https://rinfish.vercel.app <폴더>` 로 확인한다(이 점검은 개발 서버 모듈을 import 하므로 배포 주소에서는 `__mod` 점검이 실패할 수 있다 — 그러면 브라우저로 직접 방 만들기·들어가기만 확인한다).

- [ ] **Step 4: [사용자 확인] 브랜치 push → Vercel 미리보기** — 사용자에게 묻고 허락하면:

```bash
git push -u origin feat/meadow-boat
```

Vercel 이 만든 미리보기 주소를 사용자에게 알리고, 폰으로 확인할 것을 정리해 준다: 초원 걷기, 배 타기(섬으로·초원으로), 미니맵·큰 지도, 프레임(느리면 알려 달라고. 30fps 아래면 스펙 6장대로 3단계 앞에 최적화를 넣는다).

- [ ] **Step 5: [사용자 확인] main 합치기** — 사용자가 미리보기를 보고 승인하면 superpowers:finishing-a-development-branch 로 합친다. 합친 뒤 메모리 `rinfish-deploy-and-state.md` 의 합치기 결정 아래에 "1·2단계(초원+배) main 반영 (날짜, 커밋)" 을 적는다.
