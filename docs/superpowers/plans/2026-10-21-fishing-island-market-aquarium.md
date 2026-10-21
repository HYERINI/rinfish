# 낚시섬 1차-B①: 체력·어시장·어항 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 선착장 해변에 어시장(요리·버프)·진료소·벤치·어항을 세우고, 체력/약화/쓰러짐 규칙과 어항 전시·관람객 수입·먹이·배고픔·방생·확장·종류를 플레이할 수 있게 만든다. 시설은 Kenney CC0 에셋으로 꾸민다.

**Architecture:** 1차-A와 같은 층 구조를 지킨다. 규칙은 `logic/`의 순수 함수(`stamina.ts`, `cooking.ts`, `aquarium.ts`)로 만들고 vitest로 검증한다. 저장되는 상태(체력·버프·사료·어항)는 `progressStore`에 더하고, 1초마다 도는 `PlayTimeTicker`가 `tick()` 한 번으로 플레이 시간·체력·어항 시간을 함께 진행시킨다. 3D 씬과 패널은 스토어를 읽어 그리기만 한다.

**Tech Stack:** Vite 8, React 19, TypeScript 6, three 0.186, @react-three/fiber 9, @react-three/drei 10, @react-three/rapier, zustand 5, vitest, jsdom

**Spec:** `docs/superpowers/specs/2026-10-12-fishing-island-design.md` (7장 체력과 어시장, 8장 어항, 9장 경제)

**범위:** 스펙 14장 개발 순서의 5단계(체력·어시장·진료소·벤치)와 7단계(어항). 구역 해금(6), 전설·엔딩·`onFinish`(8), 캐릭터 선택(9)은 다음 계획(1차-B②)에서 다룬다.

**시작 지점:** `feat/character`(플레이어를 사람 모델로 바꾼 브랜치)가 합쳐진 뒤의 브랜치에서 `feat/market-aquarium`을 만들어 시작한다. Task 6에서 `Player.tsx`를 조금 고치므로, 캐릭터 작업보다 먼저 시작하면 충돌한다.

## Global Constraints

- 게임 전체는 `src/game/Game.tsx`의 `Game` 컴포넌트 하나로 노출한다. Props(`onExit`, `onFinish`)는 바꾸지 않는다
- 저장 키는 `fishing-island-save-v1` 그대로, persist `version: 1` 그대로 둔다. 새 필드는 `merge`에서 검증하고 없으면 초기값을 쓴다(버전을 올리면 migrate 함수 없이는 기존 저장본을 통째로 버린다)
- 모든 밸런스 수치는 `src/game/data/`에만 둔다. 로직·컴포넌트에 숫자를 하드코딩하지 않는다(좌표·크기·연출 값 제외)
- 시간 기반 규칙(유예, 버프, 배고픔, 방생)은 실제 시각이 아닌 누적 플레이 시간 기준. 로비에 나가 있는 동안에는 흐르지 않는다
- `logic/`은 React·three·zustand를 import하지 않는다
- tsconfig: `verbatimModuleSyntax`(타입은 `import type`), `erasableSyntaxOnly`(enum 금지), `noUnusedLocals`/`noUnusedParameters`
- 3D 안의 한글 텍스트는 drei `<Html>`로 표시한다
- 에셋은 CC0만 쓴다. 출처는 `public/models/CREDITS.md`에 적는다
- 커밋 메시지: `feat:`/`chore:`/`test:` 처럼 타입만, 괄호 스코프 금지, 제목은 짧게 한국어, 자세한 내용은 본문에. Co-Authored-By나 AI·도구 표기를 절대 넣지 않는다

## Review Focus

1. **약화 상태에서 줄다리기 도중 체력이 바닥나거나 버프가 끝난다** → 진행 중인 싸움에 바로 반영돼야 한다(다음 판까지 기다리지 않는다). Task 1에서 `stepFishing`이 매 스텝 `ctx.mods`를 쓰는지 테스트한다.
2. **어항을 오래 방치한 채로 한 틱이 배고픔·방생 시각을 동시에 넘는다** → 방생이 일어나고, 배고파진 뒤의 시간만큼은 수입이 붙지 않아야 한다. Task 3 `tickAquarium` 테스트로 고정한다.
3. **예전 저장본(체력·어항 필드가 없음)이나 깨진 어항 데이터로 시작** → 크래시 없이 초기값으로 시작하고 멀쩡한 필드는 살린다. 전시 물고기가 칸 수보다 많으면 잘라 낸다. Task 4 테스트로 고정한다.
4. **쓰러질 때 어항 전시 물고기와 코인 1코인 단위** → 보관함만 비고 전시 물고기는 남는다. 진료비는 내림(코인 9개면 1개). Task 1·4 테스트로 고정한다.
5. **빈 어항에 먹이 주기, 잡어가 아닌 물고기를 먹이로 주기, 꽉 찬 어항에 전시** → 아무 일도 없고 사료·물고기가 줄지 않는다. Task 4 테스트로 고정한다.

---

## 파일 구조

```
src/game/
  data/
    types.ts            (수정) DishId, BuffKind, Buff, TankTypeId
    balance.ts          (수정) STAMINA, FAINT_COIN_PENALTY, DISH_POTENCY, AQUARIUM, VISITOR_INCOME_PER_MINUTE
    dishes.ts           (새로) 요리 3종
    aquarium.ts         (새로) 어항 단계·종류
    zones.ts            (수정) 시설 위치 FACILITY
  logic/
    stamina.ts          (새로) 체력·약화·버프·쓰러짐 진료비 (+ test)
    cooking.ts          (새로) 요리 효과 (+ test)
    aquarium.ts         (새로) 전시·수입·배고픔·방생·구매 (+ test)
    fishingSession.ts   (수정) 싸움 중 보정값을 매 스텝 반영 (+ test)
    interaction.ts      (수정) market/bench/aquarium, rest 모드 (+ test)
  stores/
    progressStore.ts    (수정) survival, feed, aquarium + 액션 + 저장본 검증 (+ test)
    sessionStore.ts     (수정) 알림(notice), 순간이동(teleport)
  scene/
    modelBounds.ts      (새로) restBox: FishModel에서 옮겨 와 같이 쓴다
    assets.ts           (새로) Kenney 에셋 경로 + preload
    Prop.tsx            (새로) 정적 glb 소품 (높이 기준 크기 맞춤)
    Visitor.tsx         (새로) 어항 구경꾼 (Kenney 미니 캐릭터)
    PlayTimeTicker.tsx  (수정) tick + 쓰러짐/어항 알림 처리
    Player.tsx          (수정) 순간이동 요청 처리
    World.tsx           (수정) 새 시설 배치
    facilities/
      Market.tsx  Clinic.tsx  Bench.tsx  Aquarium.tsx  AquariumFish.tsx  (새로)
    fishing/
      FishingController.tsx (수정) 캐스팅 체력, 보정값
      FishModel.tsx         (수정) restBox import
  ui/
    Hud.tsx             (수정) 체력 바, 버프, 휴식 안내, 알림
    WeaknessOverlay.tsx (새로) 붉은 가장자리 + 카운트다운 + 심장 소리
    heartbeat.ts        (새로) WebAudio 심장 소리
    MarketPanel.tsx  AquariumPanel.tsx  (새로)
    GearShopPanel.tsx   (수정) 사료 판매
    Panels.tsx          (수정) 새 패널 연결
  Game.tsx              (수정) WeaknessOverlay 추가
public/models/
  kenney/food/  kenney/furniture/  kenney/nature/  kenney/characters/
  CREDITS.md            (수정)
```

---

### Task 1: 체력·약화·버프 로직

**Files:**
- Modify: `src/game/data/types.ts`, `src/game/data/balance.ts`
- Create: `src/game/logic/stamina.ts`, `src/game/logic/stamina.test.ts`
- Modify: `src/game/logic/fishingSession.ts` (fighting 분기), `src/game/logic/fishingSession.test.ts`

**Interfaces:**
- Consumes: `FightMods`(`logic/fight.ts`), `FIGHT`(`data/balance.ts`)
- Produces:
  - `type Buff = { kind: BuffKind; mul: number; remaining: number }`, `type BuffKind = 'reel' | 'tension'`
  - `type Survival = { stamina: number; graceLeft: number | null; buffs: Buff[] }`, `FRESH_SURVIVAL`
  - `isWeak(s): boolean`, `spendStamina(s, amount): Survival`, `healStamina(s, amount): Survival`, `addBuff(buffs, buff): Buff[]`
  - `tickSurvival(s, dt, ctx: { fighting: boolean; resting: boolean }): { survival: Survival; fainted: boolean }`
  - `fightMods(s): FightMods`, `faintPenalty(coins): number`

- [ ] **Step 1: 타입과 수치 추가**

`src/game/data/types.ts` 끝에 추가:

```ts
export type DishId = 'sashimi' | 'bowl' | 'stew'
/** 요리 버프 종류. 같은 종류끼리는 겹치지 않고 남은 시간만 갱신된다 */
export type BuffKind = 'reel' | 'tension'
/** remaining: 남은 플레이 시간(초) */
export type Buff = { kind: BuffKind; mul: number; remaining: number }
export type TankTypeId = 'basic' | 'sea' | 'fresh' | 'cave'
```

`src/game/data/balance.ts` 끝에 추가 (맨 위 import를 `import type { BasicPattern, Rarity } from './types'` 그대로 둔다):

```ts
/** 체력 */
export const STAMINA = {
  max: 100,
  /** 한 번 던질 때 드는 체력 */
  castCost: 4,
  /** 줄다리기 중 초당 드는 체력 */
  fightCostPerSecond: 1.5,
  /** 체력 0이 된 뒤 쓰러지기까지 유예 시간(초) */
  graceSeconds: 180,
  /** 약화 상태에서 릴 속도에 곱하는 값 */
  weakReelMul: 0.6,
  /** 약화 상태에서 텐션 상승에 곱하는 값 */
  weakTensionMul: 1.3,
  /** 벤치에 앉아 있을 때 초당 회복량 */
  benchRegenPerSecond: 2,
}

/** 쓰러졌을 때 보유 코인에서 진료비로 빠지는 비율 */
export const FAINT_COIN_PENALTY = 0.2

/** 요리 효과 배율. 희귀한 물고기로 만들수록 회복량과 버프 지속시간이 커진다 */
export const DISH_POTENCY: Record<Rarity, number> = {
  junk: 0.5,
  common: 1,
  rare: 1.5,
  epic: 2,
  legendary: 3,
}

/** 어항 */
export const AQUARIUM = {
  /** 마지막 급식 후 이 시간(초)이 지나면 배고픔 */
  hungerAfter: 600,
  /** 배고픈 상태로 이 시간(초)이 더 지나면 방생 */
  releaseAfter: 600,
  /** 방생 몇 초 전에 알림을 띄울지 */
  releaseWarningBefore: 120,
  /** 어항 종류와 맞는 구역 물고기의 수입 배율 */
  typeBonus: 1.5,
  /** 사료 1개 가격 */
  feedPrice: 5,
}

/** 전시 물고기 한 마리가 1분에 버는 입장료 */
export const VISITOR_INCOME_PER_MINUTE: Record<Rarity, number> = {
  junk: 0,
  common: 1,
  rare: 3,
  epic: 8,
  legendary: 20,
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

`src/game/logic/stamina.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { STAMINA } from '../data/balance'
import {
  FRESH_SURVIVAL,
  addBuff,
  faintPenalty,
  fightMods,
  healStamina,
  isWeak,
  spendStamina,
  tickSurvival,
  type Survival,
} from './stamina'

const at = (stamina: number, graceLeft: number | null = null): Survival => ({ stamina, graceLeft, buffs: [] })
const rest = { fighting: false, resting: false }

describe('spendStamina / healStamina', () => {
  it('0이 되는 순간 유예 시간이 시작되고, 더 써도 유예 시간은 그대로다', () => {
    const zero = spendStamina(at(3), 5)
    expect(zero.stamina).toBe(0)
    expect(zero.graceLeft).toBe(STAMINA.graceSeconds)
    expect(isWeak(zero)).toBe(true)
    expect(spendStamina({ ...zero, graceLeft: 50 }, 5).graceLeft).toBe(50)
  })

  it('조금이라도 회복하면 약화가 풀리고, 최대치를 넘지 않는다', () => {
    const healed = healStamina(at(0, 30), 1)
    expect(healed).toEqual(at(1, null))
    expect(healStamina(at(95), 20).stamina).toBe(STAMINA.max)
  })

  it('0만큼 회복하면 아무것도 바뀌지 않는다', () => {
    const weak = at(0, 30)
    expect(healStamina(weak, 0)).toBe(weak)
  })
})

describe('addBuff', () => {
  it('같은 종류는 겹치지 않고 새 것으로 바뀐다(남은 시간 갱신)', () => {
    const buffs = addBuff([{ kind: 'reel', mul: 1.3, remaining: 5 }], { kind: 'reel', mul: 1.3, remaining: 90 })
    expect(buffs).toEqual([{ kind: 'reel', mul: 1.3, remaining: 90 }])
  })

  it('다른 종류는 함께 유지된다', () => {
    const buffs = addBuff([{ kind: 'reel', mul: 1.3, remaining: 5 }], { kind: 'tension', mul: 0.75, remaining: 90 })
    expect(buffs).toHaveLength(2)
  })
})

describe('tickSurvival', () => {
  it('줄다리기 중이면 체력이 줄고, 벤치에서 쉬면 회복한다', () => {
    expect(tickSurvival(at(50), 2, { fighting: true, resting: false }).survival.stamina).toBe(50 - STAMINA.fightCostPerSecond * 2)
    expect(tickSurvival(at(50), 2, { fighting: false, resting: true }).survival.stamina).toBe(50 + STAMINA.benchRegenPerSecond * 2)
  })

  it('버프 남은 시간이 줄고, 다 되면 사라진다', () => {
    const s: Survival = { ...FRESH_SURVIVAL, buffs: [{ kind: 'reel', mul: 1.3, remaining: 1.5 }] }
    const once = tickSurvival(s, 1, rest).survival
    expect(once.buffs[0].remaining).toBeCloseTo(0.5)
    expect(tickSurvival(once, 1, rest).survival.buffs).toEqual([])
  })

  it('유예 시간이 끝나면 쓰러진다', () => {
    expect(tickSurvival(at(0, 1.5), 1, rest)).toEqual({ survival: at(0, 0.5), fainted: false })
    expect(tickSurvival(at(0, 0.5), 1, rest).fainted).toBe(true)
  })

  it('약화 중에 벤치에서 쉬면 쓰러지지 않고 정상으로 돌아온다', () => {
    const result = tickSurvival(at(0, 0.5), 1, { fighting: false, resting: true })
    expect(result.fainted).toBe(false)
    expect(isWeak(result.survival)).toBe(false)
  })
})

describe('fightMods', () => {
  it('보통 상태면 1배', () => {
    expect(fightMods(FRESH_SURVIVAL)).toEqual({ reelSpeedMul: 1, tensionMul: 1 })
  })

  it('버프와 약화가 곱해진다', () => {
    const s: Survival = {
      stamina: 0,
      graceLeft: 10,
      buffs: [
        { kind: 'reel', mul: 1.5, remaining: 10 },
        { kind: 'tension', mul: 0.5, remaining: 10 },
      ],
    }
    const mods = fightMods(s)
    expect(mods.reelSpeedMul).toBeCloseTo(1.5 * STAMINA.weakReelMul)
    expect(mods.tensionMul).toBeCloseTo(0.5 * STAMINA.weakTensionMul)
  })
})

describe('faintPenalty', () => {
  it('보유 코인의 20%를 내림해서 뗀다', () => {
    expect(faintPenalty(100)).toBe(20)
    expect(faintPenalty(9)).toBe(1)
    expect(faintPenalty(4)).toBe(0)
  })
})
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run src/game/logic/stamina.test.ts`
Expected: FAIL (`./stamina` 모듈 없음)

- [ ] **Step 4: 구현**

`src/game/logic/stamina.ts`:

```ts
import { FAINT_COIN_PENALTY, STAMINA } from '../data/balance'
import type { Buff } from '../data/types'
import type { FightMods } from './fight'

/** 체력, 약화 유예 시간, 요리 버프. 저장되는 상태다 */
export type Survival = {
  stamina: number
  /** 체력 0 이후 쓰러지기까지 남은 시간(초). 약화 상태가 아니면 null */
  graceLeft: number | null
  buffs: Buff[]
}

export const FRESH_SURVIVAL: Survival = { stamina: STAMINA.max, graceLeft: null, buffs: [] }

export function isWeak(s: Survival): boolean {
  return s.graceLeft !== null
}

/** 체력을 쓴다. 0이 되는 순간 유예 시간이 시작되고, 이미 약화 중이면 유예 시간은 그대로 */
export function spendStamina(s: Survival, amount: number): Survival {
  const stamina = Math.max(0, s.stamina - amount)
  const graceLeft = s.graceLeft ?? (stamina === 0 ? STAMINA.graceSeconds : null)
  return { ...s, stamina, graceLeft }
}

/** 체력을 회복한다. 약화 중이어도 조금이라도 회복하면 정상으로 돌아온다 */
export function healStamina(s: Survival, amount: number): Survival {
  if (amount <= 0) return s
  return { ...s, stamina: Math.min(STAMINA.max, s.stamina + amount), graceLeft: null }
}

/** 같은 종류 버프는 겹치지 않고 새 것으로 바꾼다(지속시간 갱신) */
export function addBuff(buffs: Buff[], buff: Buff): Buff[] {
  return [...buffs.filter((b) => b.kind !== buff.kind), buff]
}

export type SurvivalTickContext = { fighting: boolean; resting: boolean }

/** dt초만큼 시간을 진행한다. 유예 시간이 다 되면 fainted */
export function tickSurvival(s: Survival, dt: number, ctx: SurvivalTickContext): { survival: Survival; fainted: boolean } {
  const buffs = s.buffs.map((b) => ({ ...b, remaining: b.remaining - dt })).filter((b) => b.remaining > 0)
  let next: Survival = { ...s, buffs }
  if (ctx.fighting) next = spendStamina(next, STAMINA.fightCostPerSecond * dt)
  if (ctx.resting) next = healStamina(next, STAMINA.benchRegenPerSecond * dt)
  if (next.graceLeft === null) return { survival: next, fainted: false }

  const graceLeft = next.graceLeft - dt
  if (graceLeft <= 0) return { survival: { ...next, graceLeft: 0 }, fainted: true }
  return { survival: { ...next, graceLeft }, fainted: false }
}

/** 버프와 약화를 줄다리기 보정값으로 바꾼다 */
export function fightMods(s: Survival): FightMods {
  let reelSpeedMul = 1
  let tensionMul = 1
  for (const buff of s.buffs) {
    if (buff.kind === 'reel') reelSpeedMul *= buff.mul
    else tensionMul *= buff.mul
  }
  if (isWeak(s)) {
    reelSpeedMul *= STAMINA.weakReelMul
    tensionMul *= STAMINA.weakTensionMul
  }
  return { reelSpeedMul, tensionMul }
}

/** 쓰러졌을 때 내는 진료비 */
export function faintPenalty(coins: number): number {
  return Math.floor(coins * FAINT_COIN_PENALTY)
}
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run src/game/logic/stamina.test.ts`
Expected: PASS

- [ ] **Step 6: 싸움 도중 보정값 반영 테스트 추가**

`src/game/logic/fishingSession.test.ts` 맨 위 import에 추가:

```ts
import { FIGHT } from '../data/balance'
import { createFight } from './fight'
```

파일 끝에 추가:

```ts
describe('싸움 중 보정값', () => {
  it('약화·버프가 바뀌면 진행 중인 싸움에 바로 반영된다', () => {
    const gear = { maxTension: 100, reelSpeed: 8, shockAbsorb: 1 }
    // rng 0.5: 지구전 패턴의 첫 당김은 2초 뒤라 0.1초 동안은 당김이 없다
    const fight = createFight({ strength: 2, pattern: 'endurance' }, gear, fixedRng(0.5))
    const state: FishingState = { stage: 'fighting', castPower: 0.5, speciesId: 'sleepy-sardine', weight: 0.2, fight }
    const reel = { pointerDown: true, pressed: false }
    const base = { zone: 'beach' as const, gear, rng: fixedRng(0.5) }

    const normal = stepFishing(state, reel, 0.1, base)
    const slowed = stepFishing(state, reel, 0.1, { ...base, mods: { reelSpeedMul: 0.5, tensionMul: 1 } })
    if (normal.stage !== 'fighting' || slowed.stage !== 'fighting') throw new Error('싸움이 끝나면 안 된다')
    expect(FIGHT.startDistance - slowed.fight.distance).toBeCloseTo((FIGHT.startDistance - normal.fight.distance) / 2)
  })
})
```

Run: `npx vitest run src/game/logic/fishingSession.test.ts`
Expected: FAIL (slowed도 normal과 같은 거리만큼 감긴다)

- [ ] **Step 7: fishingSession 수정**

`src/game/logic/fishingSession.ts`의 `case 'fighting':` 첫 줄을 바꾼다:

```ts
    case 'fighting': {
      // 약화·버프는 싸움 도중에도 바뀌므로 매 스텝 최신 보정값을 쓴다
      const current = ctx.mods ? { ...state.fight, mods: ctx.mods } : state.fight
      const fight = stepFight(current, { reeling: input.pointerDown }, dt, ctx.rng)
```

(이 아래 줄은 그대로 둔다.)

Run: `npx vitest run`
Expected: 전부 PASS

- [ ] **Step 8: 커밋**

```bash
git add src/game/data/types.ts src/game/data/balance.ts src/game/logic/stamina.ts src/game/logic/stamina.test.ts src/game/logic/fishingSession.ts src/game/logic/fishingSession.test.ts
git commit -m "feat: 체력·약화·버프 규칙 추가" -m "체력 소모와 회복, 체력 0 이후 3분 유예, 쓰러짐 진료비, 요리 버프 갱신 규칙을 순수 함수로 만들었다. 약화와 버프가 진행 중인 줄다리기에도 바로 반영되도록 매 스텝 보정값을 넘긴다."
```

---

### Task 2: 요리 로직

**Files:**
- Create: `src/game/data/dishes.ts`, `src/game/logic/cooking.ts`, `src/game/logic/cooking.test.ts`

**Interfaces:**
- Consumes: `Survival`, `healStamina`, `addBuff` (Task 1), `DISH_POTENCY` (Task 1)
- Produces:
  - `type DishDef`, `DISHES: DishDef[]`, `getDish(id: DishId): DishDef`, `BUFF_LABEL: Record<BuffKind, string>`
  - `dishEffect(dish, rarity): { heal: number; buff: Buff | null }`
  - `cook(coins, survival, dish, rarity): { ok: true; coins: number; survival: Survival } | { ok: false; reason: 'coins' }`

- [ ] **Step 1: 요리 데이터**

`src/game/data/dishes.ts`:

```ts
import type { BuffKind, DishId } from './types'

export type DishDef = {
  id: DishId
  name: string
  description: string
  /** 물고기 1마리와 함께 내는 조리비 */
  cookFee: number
  /** 일반 물고기로 만들었을 때 회복량 (희귀도 배율이 곱해진다) */
  heal: number
  /** duration: 일반 물고기로 만들었을 때 지속시간(초) */
  buff: { kind: BuffKind; mul: number; duration: number } | null
}

export const DISHES: DishDef[] = [
  { id: 'sashimi', name: '회', description: '체력 회복', cookFee: 5, heal: 20, buff: null },
  { id: 'bowl', name: '회덮밥', description: '체력 회복 + 잠시 릴 속도 증가', cookFee: 15, heal: 15, buff: { kind: 'reel', mul: 1.3, duration: 90 } },
  { id: 'stew', name: '매운탕', description: '체력 크게 회복 + 잠시 텐션 상승 완화', cookFee: 25, heal: 40, buff: { kind: 'tension', mul: 0.75, duration: 90 } },
]

export const BUFF_LABEL: Record<BuffKind, string> = {
  reel: '릴 속도 증가',
  tension: '텐션 완화',
}

export function getDish(id: DishId): DishDef {
  const dish = DISHES.find((d) => d.id === id)
  if (!dish) throw new Error(`알 수 없는 요리: ${id}`)
  return dish
}
```

- [ ] **Step 2: 실패하는 테스트**

`src/game/logic/cooking.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { DISH_POTENCY, STAMINA } from '../data/balance'
import { getDish } from '../data/dishes'
import { cook, dishEffect } from './cooking'
import { FRESH_SURVIVAL, type Survival } from './stamina'

const hungry: Survival = { stamina: 10, graceLeft: null, buffs: [] }

describe('dishEffect', () => {
  it('희귀할수록 회복량과 버프 지속시간이 커진다', () => {
    const bowl = getDish('bowl')
    const common = dishEffect(bowl, 'common')
    const epic = dishEffect(bowl, 'epic')
    expect(common).toEqual({ heal: 15, buff: { kind: 'reel', mul: 1.3, remaining: 90 } })
    expect(epic.heal).toBe(Math.round(15 * DISH_POTENCY.epic))
    expect(epic.buff?.remaining).toBe(90 * DISH_POTENCY.epic)
  })

  it('회는 버프가 없다', () => {
    expect(dishEffect(getDish('sashimi'), 'common').buff).toBeNull()
  })
})

describe('cook', () => {
  it('조리비를 내고 회복과 버프를 얻는다', () => {
    const result = cook(30, hungry, getDish('stew'), 'common')
    expect(result).toEqual({
      ok: true,
      coins: 5,
      survival: { stamina: 50, graceLeft: null, buffs: [{ kind: 'tension', mul: 0.75, remaining: 90 }] },
    })
  })

  it('코인이 조리비보다 적으면 실패한다 (같으면 성공)', () => {
    expect(cook(24, hungry, getDish('stew'), 'common')).toEqual({ ok: false, reason: 'coins' })
    expect(cook(25, hungry, getDish('stew'), 'common').ok).toBe(true)
  })

  it('같은 버프 요리를 또 먹으면 지속시간만 갱신된다', () => {
    const first = cook(100, FRESH_SURVIVAL, getDish('bowl'), 'common')
    if (!first.ok) throw new Error('첫 요리는 성공해야 한다')
    const worn: Survival = { ...first.survival, buffs: [{ kind: 'reel', mul: 1.3, remaining: 3 }] }
    const second = cook(100, worn, getDish('bowl'), 'common')
    if (!second.ok) throw new Error('두 번째 요리도 성공해야 한다')
    expect(second.survival.buffs).toEqual([{ kind: 'reel', mul: 1.3, remaining: 90 }])
    expect(second.survival.stamina).toBe(STAMINA.max)
  })

  it('약화 상태에서 먹으면 정상으로 돌아온다', () => {
    const result = cook(10, { stamina: 0, graceLeft: 20, buffs: [] }, getDish('sashimi'), 'junk')
    expect(result.ok && result.survival.graceLeft).toBeNull()
  })
})
```

Run: `npx vitest run src/game/logic/cooking.test.ts`
Expected: FAIL (`./cooking` 모듈 없음)

- [ ] **Step 3: 구현**

`src/game/logic/cooking.ts`:

```ts
import { DISH_POTENCY } from '../data/balance'
import type { DishDef } from '../data/dishes'
import type { Buff, Rarity } from '../data/types'
import { addBuff, healStamina, type Survival } from './stamina'

export type DishEffect = { heal: number; buff: Buff | null }

/** 희귀도 배율을 회복량과 버프 지속시간에 곱한다 */
export function dishEffect(dish: DishDef, rarity: Rarity): DishEffect {
  const potency = DISH_POTENCY[rarity]
  return {
    heal: Math.round(dish.heal * potency),
    buff: dish.buff ? { kind: dish.buff.kind, mul: dish.buff.mul, remaining: dish.buff.duration * potency } : null,
  }
}

export type CookResult = { ok: true; coins: number; survival: Survival } | { ok: false; reason: 'coins' }

/** 물고기를 쓰는 일(보관함에서 빼기)은 스토어가 한다. 여기서는 코인과 체력만 계산한다 */
export function cook(coins: number, survival: Survival, dish: DishDef, rarity: Rarity): CookResult {
  if (coins < dish.cookFee) return { ok: false, reason: 'coins' }
  const effect = dishEffect(dish, rarity)
  let next = healStamina(survival, effect.heal)
  if (effect.buff) next = { ...next, buffs: addBuff(next.buffs, effect.buff) }
  return { ok: true, coins: coins - dish.cookFee, survival: next }
}
```

Run: `npx vitest run src/game/logic/cooking.test.ts`
Expected: PASS

- [ ] **Step 4: 커밋**

```bash
git add src/game/data/dishes.ts src/game/logic/cooking.ts src/game/logic/cooking.test.ts
git commit -m "feat: 어시장 요리 규칙 추가" -m "회, 회덮밥, 매운탕 3종. 물고기 희귀도가 높을수록 회복량과 버프 지속시간이 커지고, 같은 버프는 지속시간만 갱신된다."
```

---

### Task 3: 어항 로직

**Files:**
- Create: `src/game/data/aquarium.ts`, `src/game/logic/aquarium.ts`, `src/game/logic/aquarium.test.ts`

**Interfaces:**
- Consumes: `AQUARIUM`, `VISITOR_INCOME_PER_MINUTE` (Task 1), `FishInstance`, `TankTypeId`, `findSpecies`
- Produces:
  - `TANK_LEVELS: TankLevelDef[]`, `TANK_TYPES: TankTypeDef[]`, `getTankType(id): TankTypeDef`
  - `type AquariumState`, `EMPTY_AQUARIUM`, `type AquariumEvent = 'hungry' | 'releaseWarning' | 'released'`
  - `slotCount(aq)`, `isHungry(aq, playTime)`, `incomePerSecond(aq)`, `tickAquarium(aq, playTime, dt)`
  - `displayFish(aq, fish, playTime)`, `removeFromDisplay(aq, fishId)`, `feedAquarium(aq, playTime)`, `claimIncome(aq)`
  - `buyExpansion(coins, aq)`, `buyTankType(coins, aq, typeId)`, `selectTankType(aq, typeId)`

- [ ] **Step 1: 어항 데이터**

`src/game/data/aquarium.ts`:

```ts
import type { TankTypeId, ZoneId } from './types'

export type TankLevelDef = {
  slots: number
  incomeMul: number
  /** 이 단계로 확장하는 가격. Lv1은 0 */
  price: number
  /** 3D 어항 크기 [가로, 높이, 세로] */
  size: [number, number, number]
}

export const TANK_LEVELS: TankLevelDef[] = [
  { slots: 6, incomeMul: 1, price: 0, size: [3, 1.6, 1.4] },
  { slots: 9, incomeMul: 1.2, price: 400, size: [4, 1.8, 1.6] },
  { slots: 12, incomeMul: 1.5, price: 1000, size: [5, 2, 1.8] },
]

export type TankTypeDef = {
  id: TankTypeId
  name: string
  description: string
  price: number
  /** 이 구역 물고기를 전시하면 수입 보너스 */
  bonusZones: ZoneId[]
  water: string
  waterOpacity: number
  floor: string
}

export const TANK_TYPES: TankTypeDef[] = [
  { id: 'basic', name: '기본 유리 어항', description: '투명 유리, 모래 바닥', price: 0, bonusZones: [], water: '#cfefff', waterOpacity: 0.12, floor: '#e9d8a6' },
  { id: 'sea', name: '바다 수조', description: '파란 물, 산호. 해변·암초 물고기 보너스', price: 300, bonusZones: ['beach', 'reef'], water: '#29b6f6', waterOpacity: 0.28, floor: '#f5deb3' },
  { id: 'fresh', name: '민물 수조', description: '초록 물, 수초·돌. 연못 물고기 보너스', price: 300, bonusZones: ['pond'], water: '#66bb6a', waterOpacity: 0.28, floor: '#6d4c41' },
  { id: 'cave', name: '동굴 수조', description: '어두운 물, 발광 이끼. 동굴 물고기 보너스', price: 600, bonusZones: ['cave'], water: '#1a237e', waterOpacity: 0.45, floor: '#37474f' },
]

export function getTankType(id: TankTypeId): TankTypeDef {
  const type = TANK_TYPES.find((t) => t.id === id)
  if (!type) throw new Error(`알 수 없는 어항 종류: ${id}`)
  return type
}
```

- [ ] **Step 2: 실패하는 테스트**

`src/game/logic/aquarium.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { AQUARIUM } from '../data/balance'
import type { FishInstance } from '../data/types'
import {
  EMPTY_AQUARIUM,
  buyExpansion,
  buyTankType,
  claimIncome,
  displayFish,
  feedAquarium,
  incomePerSecond,
  isHungry,
  removeFromDisplay,
  selectTankType,
  tickAquarium,
  type AquariumState,
} from './aquarium'

const fish = (id: string, speciesId = 'sleepy-sardine'): FishInstance => ({ id, speciesId, weight: 0.2, caughtAtPlayTime: 0 })
/** 일반 해변 물고기 1마리 = 분당 1코인 */
const withSardine = (patch: Partial<AquariumState> = {}): AquariumState => ({ ...EMPTY_AQUARIUM, displayed: [fish('a')], ...patch })
const HUNGRY_AT = AQUARIUM.hungerAfter
const RELEASE_AT = AQUARIUM.hungerAfter + AQUARIUM.releaseAfter

describe('incomePerSecond', () => {
  it('희귀도별 분당 수입을 초 단위로 바꾼다', () => {
    expect(incomePerSecond(withSardine())).toBeCloseTo(1 / 60)
    expect(incomePerSecond({ ...EMPTY_AQUARIUM, displayed: [fish('t', 'pirate-tuna')] })).toBeCloseTo(8 / 60)
  })

  it('어항 종류 보너스와 확장 배율이 곱해진다', () => {
    const sea = withSardine({ ownedTypes: ['basic', 'sea'], activeType: 'sea', level: 2 })
    expect(incomePerSecond(sea)).toBeCloseTo((1 * AQUARIUM.typeBonus * 1.5) / 60)
  })

  it('잡어와 저장본에만 남은 없는 물고기는 수입이 없다', () => {
    expect(incomePerSecond({ ...EMPTY_AQUARIUM, displayed: [fish('j', 'lost-anchovy'), fish('x', 'deleted-fish')] })).toBe(0)
  })
})

describe('tickAquarium', () => {
  it('배부른 동안 입장료가 쌓인다', () => {
    const { aquarium, events } = tickAquarium(withSardine(), 60, 60)
    expect(aquarium.pendingIncome).toBeCloseTo(1)
    expect(events).toEqual([])
  })

  it('배고파지는 순간 알림이 오고, 그 뒤 시간만큼은 벌지 않는다', () => {
    const { aquarium, events } = tickAquarium(withSardine(), HUNGRY_AT + 30, 60)
    expect(events).toEqual(['hungry'])
    expect(aquarium.pendingIncome).toBeCloseTo(30 / 60)
    expect(isHungry(aquarium, HUNGRY_AT + 30)).toBe(true)
  })

  it('방생 2분 전에 알림이 온다', () => {
    const warnAt = RELEASE_AT - AQUARIUM.releaseWarningBefore
    expect(tickAquarium(withSardine(), warnAt, 1).events).toEqual(['releaseWarning'])
  })

  it('방생 시각이 지나면 전시 물고기가 모두 사라진다. 한 틱이 배고픔·방생을 동시에 넘어도 같다', () => {
    const { aquarium, events } = tickAquarium(withSardine({ pendingIncome: 3 }), RELEASE_AT + 10, RELEASE_AT + 10)
    expect(events).toEqual(['released'])
    expect(aquarium.displayed).toEqual([])
    expect(aquarium.pendingIncome).toBe(3)
  })

  it('빈 어항은 시간이 흘러도 아무 일도 없다', () => {
    expect(tickAquarium(EMPTY_AQUARIUM, RELEASE_AT + 10, 5)).toEqual({ aquarium: EMPTY_AQUARIUM, events: [] })
  })
})

describe('전시', () => {
  it('빈 어항에 처음 넣으면 막 밥을 먹은 상태로 시작한다', () => {
    const result = displayFish(EMPTY_AQUARIUM, fish('a'), 500)
    expect(result.ok && result.aquarium.lastFedAt).toBe(500)
    const second = result.ok ? displayFish(result.aquarium, fish('b'), 900) : result
    expect(second.ok && second.aquarium.lastFedAt).toBe(500)
  })

  it('칸이 꽉 차면 넣을 수 없다', () => {
    const full = { ...EMPTY_AQUARIUM, displayed: ['1', '2', '3', '4', '5', '6'].map((id) => fish(id)) }
    expect(displayFish(full, fish('7'), 0)).toEqual({ ok: false, reason: 'full' })
  })

  it('전시를 해제하면 그 물고기를 돌려준다. 없는 id면 null', () => {
    const { aquarium, fish: back } = removeFromDisplay(withSardine(), 'a')
    expect(back?.id).toBe('a')
    expect(aquarium.displayed).toEqual([])
    expect(removeFromDisplay(withSardine(), 'zz').fish).toBeNull()
  })

  it('먹이를 주면 배고픔이 풀린다', () => {
    const fed = feedAquarium(withSardine(), HUNGRY_AT + 5)
    expect(isHungry(fed, HUNGRY_AT + 5)).toBe(false)
  })

  it('입장료는 정수만 받고 소수점은 남겨 둔다', () => {
    const { aquarium, coins } = claimIncome(withSardine({ pendingIncome: 4.75 }))
    expect(coins).toBe(4)
    expect(aquarium.pendingIncome).toBeCloseTo(0.75)
  })
})

describe('구매', () => {
  it('확장: 코인이 딱 맞으면 성공, 최고 단계면 실패', () => {
    expect(buyExpansion(399, EMPTY_AQUARIUM)).toEqual({ ok: false, reason: 'coins' })
    const r = buyExpansion(400, EMPTY_AQUARIUM)
    expect(r.ok && [r.coins, r.aquarium.level]).toEqual([0, 1])
    expect(buyExpansion(99999, { ...EMPTY_AQUARIUM, level: 2 })).toEqual({ ok: false, reason: 'max' })
  })

  it('종류를 사면 보유 목록에 들어가고 바로 바뀐다. 이미 있으면 실패', () => {
    const r = buyTankType(300, EMPTY_AQUARIUM, 'sea')
    expect(r.ok && [r.coins, r.aquarium.ownedTypes, r.aquarium.activeType]).toEqual([0, ['basic', 'sea'], 'sea'])
    expect(buyTankType(999, EMPTY_AQUARIUM, 'basic')).toEqual({ ok: false, reason: 'owned' })
  })

  it('가진 종류로만 바꿀 수 있다', () => {
    expect(selectTankType(EMPTY_AQUARIUM, 'cave')).toBe(EMPTY_AQUARIUM)
    const owned = { ...EMPTY_AQUARIUM, ownedTypes: ['basic', 'cave'] as AquariumState['ownedTypes'], activeType: 'cave' as const }
    expect(selectTankType(owned, 'basic').activeType).toBe('basic')
  })
})
```

Run: `npx vitest run src/game/logic/aquarium.test.ts`
Expected: FAIL (`./aquarium` 모듈 없음)

- [ ] **Step 3: 구현**

`src/game/logic/aquarium.ts`:

```ts
import { TANK_LEVELS, getTankType } from '../data/aquarium'
import { AQUARIUM, VISITOR_INCOME_PER_MINUTE } from '../data/balance'
import { findSpecies } from '../data/fish'
import type { FishInstance, TankTypeId } from '../data/types'

export type AquariumState = {
  /** 확장 단계. 0부터 시작하고 화면에는 Lv1~Lv3 */
  level: number
  ownedTypes: TankTypeId[]
  activeType: TankTypeId
  displayed: FishInstance[]
  /** 마지막으로 먹이를 준 플레이 시간(초) */
  lastFedAt: number
  /** 아직 받지 않은 입장료. 소수점까지 쌓는다 */
  pendingIncome: number
}

export const EMPTY_AQUARIUM: AquariumState = {
  level: 0,
  ownedTypes: ['basic'],
  activeType: 'basic',
  displayed: [],
  lastFedAt: 0,
  pendingIncome: 0,
}

export type AquariumEvent = 'hungry' | 'releaseWarning' | 'released'

export function slotCount(aq: AquariumState): number {
  return TANK_LEVELS[aq.level].slots
}

const hungryAt = (aq: AquariumState) => aq.lastFedAt + AQUARIUM.hungerAfter
const releaseAt = (aq: AquariumState) => hungryAt(aq) + AQUARIUM.releaseAfter

export function isHungry(aq: AquariumState, playTime: number): boolean {
  return aq.displayed.length > 0 && playTime >= hungryAt(aq)
}

/** 배부른 상태일 때 1초에 버는 입장료 */
export function incomePerSecond(aq: AquariumState): number {
  const type = getTankType(aq.activeType)
  let perMinute = 0
  for (const fish of aq.displayed) {
    const species = findSpecies(fish.speciesId)
    if (!species) continue
    const bonus = species.zones.some((z) => type.bonusZones.includes(z)) ? AQUARIUM.typeBonus : 1
    perMinute += VISITOR_INCOME_PER_MINUTE[species.rarity] * bonus
  }
  return (perMinute * TANK_LEVELS[aq.level].incomeMul) / 60
}

/** playTime: 이번 틱이 끝난 시점의 플레이 시간. dt: 이번 틱 길이 */
export function tickAquarium(aq: AquariumState, playTime: number, dt: number): { aquarium: AquariumState; events: AquariumEvent[] } {
  if (aq.displayed.length === 0) return { aquarium: aq, events: [] }
  if (playTime >= releaseAt(aq)) return { aquarium: { ...aq, displayed: [] }, events: ['released'] }

  const before = playTime - dt
  const crossed = (t: number) => before < t && playTime >= t
  const events: AquariumEvent[] = []
  if (crossed(hungryAt(aq))) events.push('hungry')
  if (crossed(releaseAt(aq) - AQUARIUM.releaseWarningBefore)) events.push('releaseWarning')

  // 배고픈 동안은 수입이 멈춘다. 틱 도중에 배고파졌다면 그 전까지만 번다
  const earning = Math.max(0, Math.min(playTime, hungryAt(aq)) - before)
  return { aquarium: { ...aq, pendingIncome: aq.pendingIncome + incomePerSecond(aq) * earning }, events }
}

export type DisplayResult = { ok: true; aquarium: AquariumState } | { ok: false; reason: 'full' }

export function displayFish(aq: AquariumState, fish: FishInstance, playTime: number): DisplayResult {
  if (aq.displayed.length >= slotCount(aq)) return { ok: false, reason: 'full' }
  // 빈 어항에 처음 넣을 때는 막 밥을 먹은 상태로 시작한다
  const lastFedAt = aq.displayed.length === 0 ? playTime : aq.lastFedAt
  return { ok: true, aquarium: { ...aq, displayed: [...aq.displayed, fish], lastFedAt } }
}

export function removeFromDisplay(aq: AquariumState, fishId: string): { aquarium: AquariumState; fish: FishInstance | null } {
  const fish = aq.displayed.find((f) => f.id === fishId) ?? null
  if (!fish) return { aquarium: aq, fish: null }
  return { aquarium: { ...aq, displayed: aq.displayed.filter((f) => f.id !== fishId) }, fish }
}

export function feedAquarium(aq: AquariumState, playTime: number): AquariumState {
  return { ...aq, lastFedAt: playTime }
}

export function claimIncome(aq: AquariumState): { aquarium: AquariumState; coins: number } {
  const coins = Math.floor(aq.pendingIncome)
  return { aquarium: { ...aq, pendingIncome: aq.pendingIncome - coins }, coins }
}

export type PurchaseResult = { ok: true; coins: number; aquarium: AquariumState } | { ok: false; reason: 'max' | 'coins' | 'owned' }

export function buyExpansion(coins: number, aq: AquariumState): PurchaseResult {
  const next = TANK_LEVELS[aq.level + 1]
  if (!next) return { ok: false, reason: 'max' }
  if (coins < next.price) return { ok: false, reason: 'coins' }
  return { ok: true, coins: coins - next.price, aquarium: { ...aq, level: aq.level + 1 } }
}

/** 사면 바로 그 종류로 바꾼다 */
export function buyTankType(coins: number, aq: AquariumState, typeId: TankTypeId): PurchaseResult {
  if (aq.ownedTypes.includes(typeId)) return { ok: false, reason: 'owned' }
  const price = getTankType(typeId).price
  if (coins < price) return { ok: false, reason: 'coins' }
  return { ok: true, coins: coins - price, aquarium: { ...aq, ownedTypes: [...aq.ownedTypes, typeId], activeType: typeId } }
}

export function selectTankType(aq: AquariumState, typeId: TankTypeId): AquariumState {
  if (!aq.ownedTypes.includes(typeId)) return aq
  return { ...aq, activeType: typeId }
}
```

Run: `npx vitest run src/game/logic/aquarium.test.ts`
Expected: PASS

- [ ] **Step 4: 커밋**

```bash
git add src/game/data/aquarium.ts src/game/logic/aquarium.ts src/game/logic/aquarium.test.ts
git commit -m "feat: 어항 규칙 추가" -m "전시, 관람객 입장료, 배고픔과 방생, 확장 단계와 어항 종류 보너스를 순수 함수로 만들었다. 배고픈 동안은 수입이 멈추고, 방생 2분 전에 알림 이벤트를 낸다."
```

---

### Task 4: 저장 상태와 액션 (progressStore)

**Files:**
- Modify: `src/game/stores/progressStore.ts`, `src/game/stores/progressStore.test.ts`

**Interfaces:**
- Consumes: Task 1~3의 모든 함수, `getDish`, `TANK_TYPES`, `TANK_LEVELS`
- Produces (스토어 필드·액션, 이후 Task가 그대로 쓴다):
  - 필드: `survival: Survival`, `feed: number`, `aquarium: AquariumState`
  - `spendCastStamina(): void`
  - `tick(seconds: number, ctx: SurvivalTickContext): { fainted: boolean; aquarium: AquariumEvent[] }`
  - `cookDish(dishId: DishId, fishId: string): boolean`
  - `displayFish(fishId): boolean`, `undisplayFish(fishId): boolean`
  - `buyFeed(): boolean`, `feedWithPellet(): boolean`, `feedWithJunk(fishId): boolean`
  - `claimAquariumIncome(): number`, `buyAquariumExpansion(): boolean`, `buyTankType(id): boolean`, `selectTankType(id): void`

- [ ] **Step 1: 실패하는 테스트 추가**

`src/game/stores/progressStore.test.ts`의 import 아래에 추가:

```ts
import { AQUARIUM, STAMINA } from '../data/balance'
import { EMPTY_AQUARIUM } from '../logic/aquarium'
```

`describe('progressStore', ...)` 블록 안 끝에 추가:

```ts
  it('요리하면 물고기 1마리와 조리비를 쓰고 체력이 오른다', () => {
    const fish = store().addCatch('sleepy-sardine', 0.2)
    useProgressStore.setState({ coins: 10, survival: { stamina: 30, graceLeft: null, buffs: [] } })
    expect(store().cookDish('sashimi', fish.id)).toBe(true)
    expect(store().coins).toBe(5)
    expect(store().survival.stamina).toBe(50)
    expect(store().inventory).toEqual([])
  })

  it('조리비가 없거나 없는 물고기면 요리되지 않고 물고기도 남는다', () => {
    const fish = store().addCatch('sleepy-sardine', 0.2)
    expect(store().cookDish('stew', fish.id)).toBe(false)
    expect(store().cookDish('sashimi', 'no-such-id')).toBe(false)
    expect(store().inventory).toHaveLength(1)
  })

  it('캐스팅하면 체력이 준다', () => {
    store().spendCastStamina()
    expect(store().survival.stamina).toBe(STAMINA.max - STAMINA.castCost)
  })

  it('쓰러지면 보관함을 잃고 진료비를 내지만, 어항 물고기는 남고 체력은 가득 찬다', () => {
    const displayed = store().addCatch('pirate-tuna', 20)
    store().displayFish(displayed.id)
    store().addCatch('sleepy-sardine', 0.2)
    useProgressStore.setState({ coins: 9, survival: { stamina: 0, graceLeft: 0.5, buffs: [] } })
    const events = store().tick(1, { fighting: false, resting: false })
    expect(events.fainted).toBe(true)
    expect(store().coins).toBe(8)
    expect(store().inventory).toEqual([])
    expect(store().aquarium.displayed.map((f) => f.id)).toEqual([displayed.id])
    expect(store().survival.stamina).toBe(STAMINA.max)
  })

  it('tick은 플레이 시간을 늘리고 어항 입장료를 쌓는다', () => {
    const fish = store().addCatch('sleepy-sardine', 0.2)
    store().displayFish(fish.id)
    store().tick(60, { fighting: false, resting: false })
    expect(store().playTime).toBe(60)
    expect(store().aquarium.pendingIncome).toBeCloseTo(1)
    expect(store().claimAquariumIncome()).toBe(1)
    expect(store().coins).toBe(1)
  })

  it('전시하면 보관함에서 빠지고, 해제하면 돌아온다. 꽉 차면 보관함에 남는다', () => {
    const ids = Array.from({ length: 7 }, () => store().addCatch('sleepy-sardine', 0.2).id)
    for (const id of ids.slice(0, 6)) expect(store().displayFish(id)).toBe(true)
    expect(store().displayFish(ids[6])).toBe(false)
    expect(store().inventory.map((f) => f.id)).toEqual([ids[6]])
    expect(store().undisplayFish(ids[0])).toBe(true)
    expect(store().inventory).toHaveLength(2)
  })

  it('먹이: 빈 어항이나 잡어가 아닌 물고기로는 줄 수 없고, 사료·물고기가 줄지 않는다', () => {
    useProgressStore.setState({ feed: 1 })
    expect(store().feedWithPellet()).toBe(false)
    const sardine = store().addCatch('sleepy-sardine', 0.2)
    const shown = store().addCatch('sleepy-sardine', 0.2)
    store().displayFish(shown.id)
    expect(store().feedWithJunk(sardine.id)).toBe(false)
    expect(store().inventory).toHaveLength(1)
    expect(store().feed).toBe(1)

    const anchovy = store().addCatch('lost-anchovy', 0.02)
    useProgressStore.setState({ playTime: AQUARIUM.hungerAfter + 5 })
    expect(store().feedWithJunk(anchovy.id)).toBe(true)
    expect(store().aquarium.lastFedAt).toBe(AQUARIUM.hungerAfter + 5)
    expect(store().feedWithPellet()).toBe(true)
    expect(store().feed).toBe(0)
  })

  it('사료는 코인으로 산다', () => {
    expect(store().buyFeed()).toBe(false)
    useProgressStore.setState({ coins: AQUARIUM.feedPrice })
    expect(store().buyFeed()).toBe(true)
    expect([store().coins, store().feed]).toEqual([0, 1])
  })

  it('어항 확장과 종류 구매', () => {
    useProgressStore.setState({ coins: 700 })
    expect(store().buyAquariumExpansion()).toBe(true)
    expect(store().coins).toBe(300)
    expect(store().buyTankType('cave')).toBe(false)
    expect(store().buyTankType('sea')).toBe(true)
    store().selectTankType('basic')
    expect(store().aquarium).toMatchObject({ level: 1, ownedTypes: ['basic', 'sea'], activeType: 'basic' })
  })

  it('체력·어항 필드가 없는 예전 저장본은 초기값으로 채운다', async () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ state: { coins: 7 }, version: 1 }))
    await useProgressStore.persist.rehydrate()
    expect(store().coins).toBe(7)
    expect(store().survival).toEqual(INITIAL_PROGRESS.survival)
    expect(store().aquarium).toEqual(EMPTY_AQUARIUM)
    expect(store().feed).toBe(0)
  })

  it('깨진 체력·어항 필드는 걸러 내고, 칸 수보다 많은 전시 물고기는 잘라 낸다', async () => {
    const shown = Array.from({ length: 8 }, (_, i) => ({ id: `f${i}`, speciesId: 'sleepy-sardine', weight: 0.2, caughtAtPlayTime: 0 }))
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        state: {
          feed: 2.5,
          survival: { stamina: 500, graceLeft: 'x', buffs: [{ kind: 'reel', mul: 1.3, remaining: 10 }, { kind: 'fly', mul: 2, remaining: 10 }] },
          aquarium: { level: 9, ownedTypes: ['sea', 'gold'], activeType: 'cave', displayed: [...shown, { id: 'bad' }], lastFedAt: -1, pendingIncome: 3 },
        },
        version: 1,
      }),
    )
    await useProgressStore.persist.rehydrate()
    expect(store().feed).toBe(0)
    expect(store().survival).toEqual({ stamina: STAMINA.max, graceLeft: null, buffs: [{ kind: 'reel', mul: 1.3, remaining: 10 }] })
    expect(store().aquarium).toEqual({
      level: 0,
      ownedTypes: ['basic', 'sea'],
      activeType: 'basic',
      displayed: shown.slice(0, 6),
      lastFedAt: 0,
      pendingIncome: 3,
    })
  })
```

Run: `npx vitest run src/game/stores/progressStore.test.ts`
Expected: FAIL (`cookDish` 등이 없음)

- [ ] **Step 2: 스토어 구현**

`src/game/stores/progressStore.ts`를 다음처럼 바꾼다.

import 블록을 교체:

```ts
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { TANK_LEVELS, TANK_TYPES } from '../data/aquarium'
import { AQUARIUM, STAMINA } from '../data/balance'
import { getDish } from '../data/dishes'
import { GEAR } from '../data/gear'
import { findSpecies } from '../data/fish'
import type { Buff, DishId, FishInstance, GearLevels, GearSlot, TankTypeId } from '../data/types'
import {
  EMPTY_AQUARIUM,
  buyExpansion,
  buyTankType as buyTankTypeRule,
  claimIncome,
  displayFish as displayFishRule,
  feedAquarium,
  removeFromDisplay,
  selectTankType as selectTankTypeRule,
  tickAquarium,
  type AquariumEvent,
  type AquariumState,
} from '../logic/aquarium'
import { cook } from '../logic/cooking'
import { buyGearUpgrade, sellPrice } from '../logic/economy'
import { makeId } from '../logic/id'
import { FRESH_SURVIVAL, faintPenalty, spendStamina, tickSurvival, type Survival, type SurvivalTickContext } from '../logic/stamina'
```

`ProgressData`에 필드 추가:

```ts
  /** 체력, 약화 유예 시간, 요리 버프 */
  survival: Survival
  /** 보유 사료 개수 */
  feed: number
  aquarium: AquariumState
```

`ProgressActions`에 추가:

```ts
  spendCastStamina: () => void
  /** 1초 안팎마다 호출. 플레이 시간·체력·어항 시간을 함께 진행하고 생긴 일을 돌려준다 */
  tick: (seconds: number, ctx: SurvivalTickContext) => TickEvents
  cookDish: (dishId: DishId, fishId: string) => boolean
  displayFish: (fishId: string) => boolean
  undisplayFish: (fishId: string) => boolean
  buyFeed: () => boolean
  feedWithPellet: () => boolean
  /** 보관함의 잡어 1마리를 먹이로 준다 */
  feedWithJunk: (fishId: string) => boolean
  /** 받은 코인을 돌려준다 */
  claimAquariumIncome: () => number
  buyAquariumExpansion: () => boolean
  buyTankType: (typeId: TankTypeId) => boolean
  selectTankType: (typeId: TankTypeId) => void
```

`ProgressActions` 위에 추가:

```ts
export type TickEvents = { fainted: boolean; aquarium: AquariumEvent[] }
```

`INITIAL_PROGRESS`에 추가:

```ts
  survival: FRESH_SURVIVAL,
  feed: 0,
  aquarium: EMPTY_AQUARIUM,
```

검증 함수 영역(`readDex` 아래)에 추가:

```ts
const BUFF_KINDS: Buff['kind'][] = ['reel', 'tension']
const TANK_TYPE_IDS = TANK_TYPES.map((t) => t.id)

function isValidBuff(v: unknown): v is Buff {
  return (
    isRecord(v) &&
    BUFF_KINDS.includes(v.kind as Buff['kind']) &&
    isFiniteNumber(v.mul) &&
    v.mul > 0 &&
    isFiniteNumber(v.remaining) &&
    v.remaining > 0
  )
}

function readSurvival(v: unknown, fallback: Survival): Survival {
  if (!isRecord(v)) return fallback
  const stamina = isFiniteNumber(v.stamina) && v.stamina >= 0 && v.stamina <= STAMINA.max ? v.stamina : fallback.stamina
  const graceLeft = isFiniteNumber(v.graceLeft) && v.graceLeft > 0 ? v.graceLeft : null
  const buffs = Array.isArray(v.buffs) ? v.buffs.filter(isValidBuff) : fallback.buffs
  return { stamina, graceLeft, buffs }
}

function readAquarium(v: unknown, fallback: AquariumState): AquariumState {
  if (!isRecord(v)) return fallback
  const level = Number.isInteger(v.level) && (v.level as number) >= 0 && (v.level as number) < TANK_LEVELS.length ? (v.level as number) : fallback.level
  const savedTypes = Array.isArray(v.ownedTypes) ? v.ownedTypes.filter((t): t is TankTypeId => TANK_TYPE_IDS.includes(t as TankTypeId)) : []
  // 기본 어항은 항상 갖고 있다
  const ownedTypes = TANK_TYPE_IDS.filter((id) => id === 'basic' || savedTypes.includes(id))
  const activeType = ownedTypes.includes(v.activeType as TankTypeId) ? (v.activeType as TankTypeId) : 'basic'
  const displayed = Array.isArray(v.displayed) ? v.displayed.filter(isValidFish).slice(0, TANK_LEVELS[level].slots) : fallback.displayed
  return {
    level,
    ownedTypes,
    activeType,
    displayed,
    lastFedAt: readNonNegative(v.lastFedAt, fallback.lastFedAt),
    pendingIncome: readNonNegative(v.pendingIncome, fallback.pendingIncome),
  }
}

function readCount(v: unknown, fallback: number): number {
  return Number.isInteger(v) && (v as number) >= 0 ? (v as number) : fallback
}
```

`resetProgress` 위에 액션들을 추가:

```ts
      spendCastStamina: () => set((s) => ({ survival: spendStamina(s.survival, STAMINA.castCost) })),

      tick: (seconds, ctx) => {
        const s = get()
        const playTime = s.playTime + seconds
        const survivalTick = tickSurvival(s.survival, seconds, ctx)
        const aquariumTick = tickAquarium(s.aquarium, playTime, seconds)
        if (survivalTick.fainted) {
          // 쓰러짐: 팔지 않은 물고기를 잃고 진료비를 낸다. 어항·장비·도감은 그대로
          set({
            playTime,
            aquarium: aquariumTick.aquarium,
            survival: FRESH_SURVIVAL,
            inventory: [],
            coins: s.coins - faintPenalty(s.coins),
          })
        } else {
          set({ playTime, aquarium: aquariumTick.aquarium, survival: survivalTick.survival })
        }
        return { fainted: survivalTick.fainted, aquarium: aquariumTick.events }
      },

      cookDish: (dishId, fishId) => {
        const s = get()
        const fish = s.inventory.find((f) => f.id === fishId)
        const species = fish && findSpecies(fish.speciesId)
        if (!species) return false
        const result = cook(s.coins, s.survival, getDish(dishId), species.rarity)
        if (!result.ok) return false
        set({ coins: result.coins, survival: result.survival, inventory: s.inventory.filter((f) => f.id !== fishId) })
        return true
      },

      displayFish: (fishId) => {
        const s = get()
        const fish = s.inventory.find((f) => f.id === fishId)
        if (!fish) return false
        const result = displayFishRule(s.aquarium, fish, s.playTime)
        if (!result.ok) return false
        set({ aquarium: result.aquarium, inventory: s.inventory.filter((f) => f.id !== fishId) })
        return true
      },

      undisplayFish: (fishId) => {
        const s = get()
        const { aquarium, fish } = removeFromDisplay(s.aquarium, fishId)
        if (!fish) return false
        set({ aquarium, inventory: [...s.inventory, fish] })
        return true
      },

      buyFeed: () => {
        const s = get()
        if (s.coins < AQUARIUM.feedPrice) return false
        set({ coins: s.coins - AQUARIUM.feedPrice, feed: s.feed + 1 })
        return true
      },

      feedWithPellet: () => {
        const s = get()
        if (s.feed <= 0 || s.aquarium.displayed.length === 0) return false
        set({ feed: s.feed - 1, aquarium: feedAquarium(s.aquarium, s.playTime) })
        return true
      },

      feedWithJunk: (fishId) => {
        const s = get()
        const fish = s.inventory.find((f) => f.id === fishId)
        if (!fish || findSpecies(fish.speciesId)?.rarity !== 'junk' || s.aquarium.displayed.length === 0) return false
        set({ inventory: s.inventory.filter((f) => f.id !== fishId), aquarium: feedAquarium(s.aquarium, s.playTime) })
        return true
      },

      claimAquariumIncome: () => {
        const s = get()
        const { aquarium, coins } = claimIncome(s.aquarium)
        if (coins > 0) set({ aquarium, coins: s.coins + coins })
        return coins
      },

      buyAquariumExpansion: () => {
        const result = buyExpansion(get().coins, get().aquarium)
        if (!result.ok) return false
        set({ coins: result.coins, aquarium: result.aquarium })
        return true
      },

      buyTankType: (typeId) => {
        const result = buyTankTypeRule(get().coins, get().aquarium, typeId)
        if (!result.ok) return false
        set({ coins: result.coins, aquarium: result.aquarium })
        return true
      },

      selectTankType: (typeId) => set((s) => ({ aquarium: selectTankTypeRule(s.aquarium, typeId) })),
```

`merge`의 반환 객체에 추가:

```ts
          survival: readSurvival(saved.survival, current.survival),
          feed: readCount(saved.feed, current.feed),
          aquarium: readAquarium(saved.aquarium, current.aquarium),
```

- [ ] **Step 3: 통과 확인**

Run: `npx vitest run`
Expected: 전부 PASS

Run: `npx tsc -b`
Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add src/game/stores/progressStore.ts src/game/stores/progressStore.test.ts
git commit -m "feat: 체력·요리·어항을 저장 상태에 연결" -m "progressStore에 survival, feed, aquarium 필드와 요리·전시·먹이·구매 액션을 더했다. tick 한 번으로 플레이 시간, 체력, 어항 시간을 함께 진행하고 쓰러짐과 어항 알림을 돌려준다. 예전 저장본과 깨진 필드는 merge에서 걸러 낸다."
```

---

### Task 5: 상호작용 대상·모드·알림

**Files:**
- Modify: `src/game/logic/interaction.ts`, `src/game/logic/interaction.test.ts`, `src/game/stores/sessionStore.ts`, `src/game/data/zones.ts`

**Interfaces:**
- Produces:
  - `Mode`에 `'market' | 'aquarium' | 'rest'` 추가
  - `Interactable`에 `{ kind: 'market' } | { kind: 'bench' } | { kind: 'aquarium' }` 추가
  - sessionStore: `notice: { id: number; text: string } | null`, `notify(text)`, `teleport: [number, number] | null`, `requestTeleport(pos)`, `clearTeleport()`
  - zones.ts: `FACILITY` (시설 위치 `[x, z]`), `CLINIC_SPAWN: [number, number]`

- [ ] **Step 1: 실패하는 테스트 추가**

`src/game/logic/interaction.test.ts`의 `describe('resolveKeyAction', ...)` 블록 안 끝에 추가:

```ts
  it('어시장·어항은 패널을 열고, 벤치는 앉는다', () => {
    expect(resolveKeyAction('KeyE', 'explore', { kind: 'market' })).toEqual({ type: 'openMode', mode: 'market' })
    expect(resolveKeyAction('KeyE', 'explore', { kind: 'aquarium' })).toEqual({ type: 'openMode', mode: 'aquarium' })
    expect(resolveKeyAction('KeyE', 'explore', { kind: 'bench' })).toEqual({ type: 'openMode', mode: 'rest' })
  })

  it('앉아 있을 때 E나 ESC를 누르면 일어난다', () => {
    expect(resolveKeyAction('KeyE', 'rest', { kind: 'bench' })).toEqual({ type: 'closePanel' })
    expect(resolveKeyAction('Escape', 'rest', { kind: 'bench' })).toEqual({ type: 'closePanel' })
  })

  it('패널이 열려 있을 때 E는 아무 일도 하지 않는다', () => {
    expect(resolveKeyAction('KeyE', 'market', { kind: 'market' })).toEqual({ type: 'none' })
  })
```

Run: `npx vitest run src/game/logic/interaction.test.ts`
Expected: FAIL (타입 에러 또는 `none` 반환)

- [ ] **Step 2: interaction.ts 수정**

```ts
/** 지금 플레이어가 무엇을 하고 있는지 (어떤 화면이 열려 있는지). rest = 벤치에 앉아 쉬는 중 */
export type Mode = 'explore' | 'fishing' | 'sell' | 'shop' | 'dex' | 'menu' | 'market' | 'aquarium' | 'rest'

/** E 키로 상호작용할 수 있는 대상 */
export type Interactable =
  | { kind: 'fishingSpot'; spotId: string }
  | { kind: 'sellBox' }
  | { kind: 'gearShop' }
  | { kind: 'market' }
  | { kind: 'bench' }
  | { kind: 'aquarium' }
```

`resolveKeyAction`에서 Escape 분기 다음에 추가:

```ts
  // 벤치에 앉아 있으면 E로도 일어난다
  if (code === 'KeyE' && mode === 'rest') return { type: 'closePanel' }
```

`switch (nearby.kind)`에 추가:

```ts
      case 'market':
        return { type: 'openMode', mode: 'market' }
      case 'aquarium':
        return { type: 'openMode', mode: 'aquarium' }
      case 'bench':
        return { type: 'openMode', mode: 'rest' }
```

Run: `npx vitest run src/game/logic/interaction.test.ts`
Expected: PASS

- [ ] **Step 3: 시설 위치**

`src/game/data/zones.ts` 끝에 추가:

```ts
/** 선착장 해변 시설 위치 [x, z]. 바닥(y=0) 기준 */
export const FACILITY = {
  market: [12, 12] as [number, number],
  aquarium: [14, 19] as [number, number],
  clinic: [-14, 10] as [number, number],
  bench: [-5, 21] as [number, number],
}

/** 쓰러지면 깨어나는 곳 (진료소 앞) */
export const CLINIC_SPAWN: [number, number] = [FACILITY.clinic[0], FACILITY.clinic[1] + 2.5]
```

- [ ] **Step 4: sessionStore에 알림·순간이동 추가**

`src/game/stores/sessionStore.ts` 전체:

```ts
import { create } from 'zustand'
import { isSameInteractable, type Interactable, type Mode } from '../logic/interaction'

type SessionState = {
  mode: Mode
  /** 플레이어가 지금 서 있는 상호작용 영역 */
  nearby: Interactable | null
  /** 화면 위쪽에 잠깐 띄우는 알림. id가 바뀌면 새 알림 */
  notice: { id: number; text: string } | null
  /** 다음 프레임에 플레이어를 옮길 위치 [x, z] (쓰러진 뒤 진료소로) */
  teleport: [number, number] | null
  setMode: (mode: Mode) => void
  setNearby: (target: Interactable) => void
  /** 영역을 벗어날 때 호출. 다른 영역에 이미 들어가 있으면 지우지 않는다 */
  clearNearby: (target: Interactable) => void
  notify: (text: string) => void
  requestTeleport: (pos: [number, number]) => void
  clearTeleport: () => void
  resetSession: () => void
}

// 저장하지 않는 "이번 판" 상태
export const useSessionStore = create<SessionState>((set, get) => ({
  mode: 'explore',
  nearby: null,
  notice: null,
  teleport: null,
  setMode: (mode) => set({ mode }),
  setNearby: (target) => set({ nearby: target }),
  clearNearby: (target) => {
    if (isSameInteractable(get().nearby, target)) set({ nearby: null })
  },
  notify: (text) => set((s) => ({ notice: { id: (s.notice?.id ?? 0) + 1, text } })),
  requestTeleport: (pos) => set({ teleport: pos }),
  clearTeleport: () => set({ teleport: null }),
  resetSession: () => set({ mode: 'explore', nearby: null, notice: null, teleport: null }),
}))
```

- [ ] **Step 5: 타입 확인 후 커밋**

`src/game/ui/Hud.tsx`의 `PROMPT`가 새 kind 때문에 타입 에러가 난다. 지금 채운다:

```ts
const PROMPT: Record<Interactable['kind'], string> = {
  fishingSpot: 'E  낚시하기',
  sellBox: 'E  물고기 팔기',
  gearShop: 'E  장비 상점',
  market: 'E  어시장',
  bench: 'E  앉아서 쉬기',
  aquarium: 'E  어항',
}
```

Run: `npx tsc -b && npx vitest run`
Expected: 에러 없음, 전부 PASS

```bash
git add src/game/logic/interaction.ts src/game/logic/interaction.test.ts src/game/stores/sessionStore.ts src/game/data/zones.ts src/game/ui/Hud.tsx
git commit -m "feat: 어시장·벤치·어항 상호작용과 알림 추가" -m "새 모드(market, aquarium, rest)와 상호작용 대상을 더하고, 앉아 있을 때 E나 ESC로 일어나게 했다. sessionStore에 화면 알림과 순간이동 요청을 두고, 시설 위치를 zones.ts에 모았다."
```

---

### Task 6: 체력 연결 (낚시·시간·쓰러짐·HUD)

**Files:**
- Modify: `src/game/scene/fishing/FishingController.tsx`, `src/game/scene/PlayTimeTicker.tsx`, `src/game/scene/Player.tsx`, `src/game/ui/Hud.tsx`, `src/game/Game.tsx`
- Create: `src/game/ui/WeaknessOverlay.tsx`, `src/game/ui/heartbeat.ts`

**Interfaces:**
- Consumes: `fightMods`, `isWeak` (Task 1), 스토어 `tick`, `spendCastStamina` (Task 4), `notify`, `requestTeleport`, `teleport`, `clearTeleport`, `CLINIC_SPAWN` (Task 5), `BUFF_LABEL` (Task 2)

- [ ] **Step 1: FishingController — 캐스팅 체력과 보정값**

`src/game/scene/fishing/FishingController.tsx`에 import 추가:

```ts
import { fightMods } from '../../logic/stamina'
```

`stepFishing` 호출부와 그 아래를 바꾼다:

```ts
    const progress = useProgressStore.getState()
    const next = stepFishing(fishing.state, input, clampDelta(delta), {
      zone: spot.zone,
      gear: gearStats(progress.gear),
      mods: fightMods(progress.survival),
      rng: Math.random,
    })
    if (next === fishing.state) return

    // 던지는 순간 체력을 쓴다 (줄다리기 중 소모는 PlayTimeTicker가 1초마다 처리)
    if (fishing.state.stage === 'aiming' && next.stage === 'waiting') progress.spendCastStamina()

    // 'done'은 한 번만 들어온다 (done 상태는 stepFishing이 그대로 돌려주므로 위에서 return)
    if (next.stage === 'done' && next.result === 'caught') {
      const caught = progress.addCatch(next.speciesId, next.weight)
      fishing.update(next, caught)
    } else {
      fishing.update(next)
    }
```

- [ ] **Step 2: PlayTimeTicker — tick과 쓰러짐 처리**

`src/game/scene/PlayTimeTicker.tsx` 전체:

```ts
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CLINIC_SPAWN } from '../data/zones'
import type { AquariumEvent } from '../logic/aquarium'
import { clampDelta } from '../logic/time'
import { useFishingStore } from '../stores/fishingStore'
import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'

const AQUARIUM_NOTICE: Record<AquariumEvent, string> = {
  hungry: '어항 물고기들이 배고파해요. 수입이 멈췄어요!',
  releaseWarning: '2분 안에 먹이를 주지 않으면 어항 물고기들이 바다로 돌아가요!',
  released: '배고픈 물고기들이 바다로 돌아갔어요… (도감 기록은 남아요)',
}

/**
 * 플레이 시간, 체력(유예·버프), 어항 시간을 1초씩 모아서 진행한다.
 * 매 프레임 저장하면 localStorage 쓰기가 너무 잦기 때문
 */
export function PlayTimeTicker() {
  const pending = useRef(0)
  useFrame((_, delta) => {
    pending.current += clampDelta(delta)
    if (pending.current < 1) return
    const seconds = pending.current
    pending.current = 0

    const session = useSessionStore.getState()
    const fighting = session.mode === 'fishing' && useFishingStore.getState().state?.stage === 'fighting'
    const events = useProgressStore.getState().tick(seconds, { fighting, resting: session.mode === 'rest' })

    if (events.fainted) {
      useFishingStore.getState().end()
      session.setMode('explore')
      session.requestTeleport(CLINIC_SPAWN)
      session.notify('쓰러졌다… 진료소에서 깨어났어요. 들고 있던 물고기를 잃고 진료비를 냈어요.')
    }
    for (const event of events.aquarium) session.notify(AQUARIUM_NOTICE[event])
  })
  return null
}
```

- [ ] **Step 3: Player — 순간이동 요청 처리**

`src/game/scene/Player.tsx`의 `useFrame` 콜백 맨 앞(움직임 계산 전)에 넣는다. 물리 몸체 ref는 지금 `body`다(캐릭터 작업으로 이름이 바뀌었으면 그 ref를 쓴다). `useSessionStore`는 이미 import되어 있다.

```ts
    // 쓰러진 뒤 진료소로 옮기기
    const teleport = useSessionStore.getState().teleport
    if (teleport && body.current) {
      body.current.setTranslation({ x: teleport[0], y: 1, z: teleport[1] }, true)
      body.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
      useSessionStore.getState().clearTeleport()
    }
```

- [ ] **Step 4: 심장 소리**

`src/game/ui/heartbeat.ts`:

```ts
let audio: AudioContext | null = null

/** 쿵-쿵 두 번 울리는 낮은 소리. 파일 없이 WebAudio로 만든다 */
export function playHeartbeat() {
  try {
    audio ??= new AudioContext()
    const now = audio.currentTime
    for (const offset of [0, 0.22]) {
      const osc = audio.createOscillator()
      const gain = audio.createGain()
      osc.frequency.value = 55
      gain.gain.setValueAtTime(0.0001, now + offset)
      gain.gain.exponentialRampToValueAtTime(0.6, now + offset + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.18)
      osc.connect(gain).connect(audio.destination)
      osc.start(now + offset)
      osc.stop(now + offset + 0.2)
    }
  } catch {
    // 소리를 낼 수 없는 환경이면 조용히 넘어간다
  }
}
```

- [ ] **Step 5: 약화 화면 효과**

`src/game/ui/WeaknessOverlay.tsx`:

```tsx
import { useEffect } from 'react'
import { useProgressStore } from '../stores/progressStore'
import { playHeartbeat } from './heartbeat'

/** 약화 상태: 화면 가장자리 붉은 효과 + 쓰러지기까지 남은 시간 + 심장 소리 */
export function WeaknessOverlay() {
  const graceLeft = useProgressStore((s) => s.survival.graceLeft)
  const weak = graceLeft !== null

  useEffect(() => {
    if (!weak) return
    playHeartbeat()
    const id = setInterval(playHeartbeat, 1000)
    return () => clearInterval(id)
  }, [weak])

  if (graceLeft === null) return null
  const minutes = Math.floor(graceLeft / 60)
  const seconds = Math.floor(graceLeft % 60)
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', boxShadow: 'inset 0 0 140px 40px rgba(200, 0, 0, 0.55)' }}>
      <div style={{ position: 'absolute', top: 56, width: '100%', textAlign: 'center', color: '#ff8a80', fontWeight: 800, fontSize: 18, textShadow: '0 1px 3px #000' }}>
        기진맥진! {minutes}:{String(seconds).padStart(2, '0')} 안에 먹거나 쉬지 않으면 쓰러져요
      </div>
    </div>
  )
}
```

`src/game/Game.tsx`: import 추가 후 `<Hud />` 바로 앞에 넣는다.

```tsx
import { WeaknessOverlay } from './ui/WeaknessOverlay'
```

```tsx
      <WeaknessOverlay />
      <Hud />
```

- [ ] **Step 6: HUD — 체력 바, 버프, 휴식 안내, 알림**

`src/game/ui/Hud.tsx` 전체:

```tsx
import { useEffect, useState } from 'react'
import { STAMINA } from '../data/balance'
import { BUFF_LABEL } from '../data/dishes'
import type { Interactable } from '../logic/interaction'
import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'
import { button, hint, overlayLayer } from './styles'

const PROMPT: Record<Interactable['kind'], string> = {
  fishingSpot: 'E  낚시하기',
  sellBox: 'E  물고기 팔기',
  gearShop: 'E  장비 상점',
  market: 'E  어시장',
  bench: 'E  앉아서 쉬기',
  aquarium: 'E  어항',
}

/** 알림을 띄워 두는 시간 */
const NOTICE_MS = 4000

export function Hud() {
  const coins = useProgressStore((s) => s.coins)
  const survival = useProgressStore((s) => s.survival)
  const mode = useSessionStore((s) => s.mode)
  const nearby = useSessionStore((s) => s.nearby)
  const setMode = useSessionStore((s) => s.setMode)

  const ratio = survival.stamina / STAMINA.max
  return (
    <div style={overlayLayer}>
      <div style={{ position: 'absolute', top: 16, left: 16, fontSize: 18, width: 200 }}>
        <strong>코인 {coins}</strong>
        <div style={{ fontSize: 13, marginTop: 6 }}>체력 {Math.ceil(survival.stamina)}</div>
        <div style={{ height: 8, background: '#333', borderRadius: 4, overflow: 'hidden', marginTop: 2 }}>
          <div style={{ width: `${ratio * 100}%`, height: '100%', background: ratio < 0.25 ? '#ef5350' : '#66bb6a' }} />
        </div>
        {survival.buffs.map((b) => (
          <div key={b.kind} style={{ fontSize: 12, marginTop: 4, color: '#ffd166' }}>
            {BUFF_LABEL[b.kind]} {Math.ceil(b.remaining)}초
          </div>
        ))}
      </div>

      <Notice />

      {mode === 'rest' && <div style={hint}>벤치에서 쉬는 중… 체력 회복 · E / ESC 일어나기</div>}

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

/** 쓰러짐·어항 알림. 새 알림이 오면 처음부터 다시 센다 */
function Notice() {
  const notice = useSessionStore((s) => s.notice)
  const [hiddenId, setHiddenId] = useState<number | null>(null)
  useEffect(() => {
    if (!notice) return
    const id = setTimeout(() => setHiddenId(notice.id), NOTICE_MS)
    return () => clearTimeout(id)
  }, [notice])

  if (!notice || hiddenId === notice.id) return null
  return (
    <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.75)', padding: '10px 18px', borderRadius: 8, fontSize: 15, maxWidth: '80vw', textAlign: 'center' }}>
      {notice.text}
    </div>
  )
}
```

- [ ] **Step 7: 확인 후 커밋**

Run: `npx tsc -b && npx vitest run && npm run lint`
Expected: 타입 에러 없음, 테스트 전부 PASS, 린트 새 에러 없음

브라우저 확인(`npm run dev`):
1. 낚시를 몇 번 던지면 왼쪽 위 체력 바가 준다
2. 개발자 도구 콘솔에서 체력을 0으로 만든다: `performance.getEntriesByType('resource').map(e=>e.name).find(n=>n.includes('/stores/progressStore.ts'))`로 얻은 URL을 `import()`해서 `useProgressStore.setState({ survival: { stamina: 0, graceLeft: 5, buffs: [] } })` → 붉은 테두리, 카운트다운, 심장 소리가 나고 5초 뒤 진료소 앞으로 옮겨지며 알림이 뜬다

```bash
git add src/game/scene/fishing/FishingController.tsx src/game/scene/PlayTimeTicker.tsx src/game/scene/Player.tsx src/game/ui/Hud.tsx src/game/ui/WeaknessOverlay.tsx src/game/ui/heartbeat.ts src/game/Game.tsx
git commit -m "feat: 체력 소모와 쓰러짐 연출 연결" -m "캐스팅과 줄다리기에 체력을 쓰고, 버프·약화를 줄다리기에 반영한다. 약화 중에는 붉은 화면 가장자리, 남은 시간, 심장 소리를 보여 주고, 유예 시간이 끝나면 진료소 앞으로 옮기며 알림을 띄운다. HUD에 체력 바와 버프 남은 시간을 더했다."
```

---

### Task 7: Kenney 에셋 준비

**Files:**
- Create: `public/models/kenney/food/…`, `public/models/kenney/furniture/…`, `public/models/kenney/nature/…`, `public/models/kenney/characters/…`
- Create: `src/game/scene/assets.ts`, `src/game/scene/modelBounds.ts`, `src/game/scene/Prop.tsx`, `src/game/scene/Visitor.tsx`
- Modify: `src/game/scene/fishing/FishModel.tsx` (restBox import로 교체), `public/models/CREDITS.md`

**Interfaces:**
- Produces:
  - `ASSET` (경로 상수), `preloadFacilityAssets()`
  - `restBox(root: Object3D): Box3` (`scene/modelBounds.ts`)
  - `<Prop url height position? rotationY? />`: 정적 glb를 높이 기준으로 맞춰 바닥에 세운다
  - `<Visitor url position rotationY? clip? />`: 스킨 캐릭터를 복제해 애니메이션 재생

- [ ] **Step 1: 에셋 받기**

모두 Kenney(kenney.nl) CC0 팩이다. 각 페이지의 다운로드 링크(`https://kenney.nl/media/pages/assets/<팩>/…/kenney_<팩>.zip`)를 페이지 HTML에서 찾아 받는다. 압축은 스크래치 폴더에 푼다.

```bash
TMP=$(mktemp -d)
for p in food-kit furniture-kit nature-kit mini-characters; do
  url=$(curl -sL "https://kenney.nl/assets/$p" | grep -oE 'https://kenney.nl/media/[^"]+\.zip' | head -1)
  curl -sL -o "$TMP/$p.zip" "$url"
  unzip -q -o "$TMP/$p.zip" -d "$TMP/$p"
done
mkdir -p public/models/kenney/food/Textures public/models/kenney/furniture public/models/kenney/nature public/models/kenney/characters/Textures
# food-kit, mini-characters의 glb는 Textures/colormap.png를 상대 경로로 참조하므로 팩마다 폴더를 나눈다
for f in fish pot-stew sushi-salmon bowl-broth cutting-board-japanese plate-dinner; do cp "$TMP/food-kit/Models/GLB format/$f.glb" public/models/kenney/food/; done
cp "$TMP/food-kit/Models/GLB format/Textures/colormap.png" public/models/kenney/food/Textures/
for f in kitchenBar kitchenStove bench bedSingle pottedPlant; do cp "$TMP/furniture-kit/Models/GLTF format/$f.glb" public/models/kenney/furniture/; done
for f in rock_smallA rock_smallC rock_tallA plant_bushSmall lily_small stone_tallB; do cp "$TMP/nature-kit/Models/GLTF format/$f.glb" public/models/kenney/nature/; done
for f in character-female-a character-male-c character-female-d; do cp "$TMP/mini-characters/Models/GLB format/$f.glb" public/models/kenney/characters/; done
cp "$TMP/mini-characters/Models/GLB format/Textures/colormap.png" public/models/kenney/characters/Textures/
du -sh public/models/kenney
```

Expected: 파일이 모두 복사되고 합계 2MB 안팎. 각 팩의 `License.txt`가 CC0인지 열어 확인한다(`cat "$TMP/food-kit/License.txt"`).

`public/models/CREDITS.md` 끝에 추가:

```markdown
## Kenney (CC0 1.0)

- 출처: https://kenney.nl — Food Kit, Furniture Kit, Nature Kit, Mini Characters
- 라이선스: Creative Commons Zero (CC0). 출처 표기 의무는 없지만 기록해 둔다
- 위치: `public/models/kenney/`
```

- [ ] **Step 2: restBox를 공용 파일로 옮기기**

`src/game/scene/modelBounds.ts`:

```ts
import { Box3 } from 'three'
import type { Mesh, Object3D } from 'three'

/** 애니메이션 전 기본 자세의 경계 상자. 스킨 메시는 setFromObject 가 뼈 변환까지 섞어 값이 튀어서 지오메트리로 직접 잰다 */
export function restBox(root: Object3D): Box3 {
  const box = new Box3()
  const part = new Box3()
  root.updateWorldMatrix(false, true)
  root.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh) return
    mesh.geometry.computeBoundingBox()
    box.union(part.copy(mesh.geometry.boundingBox!).applyMatrix4(mesh.matrixWorld))
  })
  return box
}
```

`src/game/scene/fishing/FishModel.tsx`에서 `restBox` 함수 정의를 지우고 `import { restBox } from '../modelBounds'`를 추가한다. `Box3` import가 더 이상 안 쓰이면 지운다(`Vector3`는 그대로 쓴다).

- [ ] **Step 3: 에셋 경로와 소품 컴포넌트**

`src/game/scene/assets.ts`:

```ts
import { useGLTF } from '@react-three/drei'

const base = `${import.meta.env.BASE_URL}models/kenney`

/** 시설 장식에 쓰는 Kenney 에셋 (CC0) */
export const ASSET = {
  fish: `${base}/food/fish.glb`,
  potStew: `${base}/food/pot-stew.glb`,
  sushi: `${base}/food/sushi-salmon.glb`,
  bowlBroth: `${base}/food/bowl-broth.glb`,
  cuttingBoard: `${base}/food/cutting-board-japanese.glb`,
  plate: `${base}/food/plate-dinner.glb`,
  counter: `${base}/furniture/kitchenBar.glb`,
  stove: `${base}/furniture/kitchenStove.glb`,
  bench: `${base}/furniture/bench.glb`,
  bed: `${base}/furniture/bedSingle.glb`,
  plant: `${base}/furniture/pottedPlant.glb`,
  rockA: `${base}/nature/rock_smallA.glb`,
  rockC: `${base}/nature/rock_smallC.glb`,
  rockTall: `${base}/nature/rock_tallA.glb`,
  bush: `${base}/nature/plant_bushSmall.glb`,
  lily: `${base}/nature/lily_small.glb`,
  stoneTall: `${base}/nature/stone_tallB.glb`,
  visitorA: `${base}/characters/character-female-a.glb`,
  visitorB: `${base}/characters/character-male-c.glb`,
  visitorC: `${base}/characters/character-female-d.glb`,
} as const

/** 씬이 그려지기 전에 미리 받아 둔다 */
export function preloadFacilityAssets() {
  for (const url of Object.values(ASSET)) useGLTF.preload(url)
}
```

`src/game/scene/Prop.tsx`:

```tsx
import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import { Vector3 } from 'three'
import type { Mesh } from 'three'
import { restBox } from './modelBounds'

type Props = {
  url: string
  /** 이 높이에 맞춰 크기를 정한다 */
  height: number
  position?: [number, number, number]
  rotationY?: number
}

/** 움직이지 않는 장식용 glb. 바닥면이 position 의 y 에 오도록 세운다 */
export function Prop({ url, height, position = [0, 0, 0], rotationY = 0 }: Props) {
  const { scene } = useGLTF(url)
  const { object, scale, lift } = useMemo(() => {
    const object = scene.clone(true)
    object.traverse((o) => {
      const mesh = o as Mesh
      if (mesh.isMesh) {
        mesh.castShadow = true
        mesh.receiveShadow = true
      }
    })
    const box = restBox(object)
    const size = box.getSize(new Vector3())
    const scale = size.y > 0 ? height / size.y : 1
    return { object, scale, lift: -box.min.y * scale }
  }, [scene, height])

  return (
    <group position={position} rotation-y={rotationY}>
      <primitive object={object} scale={scale} position-y={lift} />
    </group>
  )
}
```

`src/game/scene/Visitor.tsx`:

```tsx
import { useAnimations, useGLTF } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import { Vector3 } from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { restBox } from './modelBounds'

/** 구경꾼 키 */
const VISITOR_HEIGHT = 1.5

type Props = {
  url: string
  position: [number, number, number]
  rotationY?: number
  /** Kenney 미니 캐릭터 애니메이션 이름 (idle, emote-yes, sit …) */
  clip?: string
}

/** 어항 구경꾼. 같은 모델을 여러 명 세우므로 뼈대까지 복제한다 */
export function Visitor({ url, position, rotationY = 0, clip = 'idle' }: Props) {
  const { scene, animations } = useGLTF(url)
  const object = useMemo(() => cloneSkinned(scene), [scene])
  const { actions } = useAnimations(animations, object)
  const scale = useMemo(() => {
    const size = restBox(object).getSize(new Vector3())
    return size.y > 0 ? VISITOR_HEIGHT / size.y : 1
  }, [object])

  useEffect(() => {
    object.traverse((o) => {
      o.castShadow = true
      o.frustumCulled = false
    })
    const action = actions[clip] ?? actions.idle
    action?.reset().fadeIn(0.2).play()
    return () => {
      action?.fadeOut(0.2)
    }
  }, [actions, clip, object])

  return (
    <group position={position} rotation-y={rotationY} scale={scale}>
      <primitive object={object} />
    </group>
  )
}
```

- [ ] **Step 4: 확인 후 커밋**

Run: `npx tsc -b && npx vitest run && npm run lint`
Expected: 에러 없음, 테스트 PASS

```bash
git add public/models src/game/scene/assets.ts src/game/scene/modelBounds.ts src/game/scene/Prop.tsx src/game/scene/Visitor.tsx src/game/scene/fishing/FishModel.tsx
git commit -m "chore: 시설 장식용 Kenney 에셋 추가" -m "Food Kit, Furniture Kit, Nature Kit, Mini Characters에서 쓸 모델만 골라 넣었다(모두 CC0). 텍스처를 상대 경로로 참조하는 팩은 폴더를 나눴다. 높이 기준으로 크기를 맞추는 Prop, 애니메이션이 있는 Visitor 컴포넌트를 만들고 경계 상자 계산(restBox)을 공용 파일로 옮겼다."
```

---

### Task 8: 어시장·진료소·벤치

**Files:**
- Create: `src/game/scene/facilities/Market.tsx`, `src/game/scene/facilities/Clinic.tsx`, `src/game/scene/facilities/Bench.tsx`, `src/game/ui/MarketPanel.tsx`
- Modify: `src/game/scene/World.tsx`, `src/game/ui/Panels.tsx`

**Interfaces:**
- Consumes: `ASSET`, `Prop`, `Visitor`, `preloadFacilityAssets` (Task 7), `FACILITY` (Task 5), `InteractionZone`, 스토어 `cookDish` (Task 4), `DISHES`, `dishEffect`

- [ ] **Step 1: 어시장 3D**

`src/game/scene/facilities/Market.tsx`:

```tsx
import { Html } from '@react-three/drei'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { FACILITY } from '../../data/zones'
import { ASSET } from '../assets'
import { Prop } from '../Prop'
import { Visitor } from '../Visitor'
import { InteractionZone } from './InteractionZone'

const [X, Z] = FACILITY.market
/** 줄무늬 천막 색 */
const AWNING = ['#e53935', '#fafafa']

/** 노점 어시장: 조리대, 화구, 냄비, 도마 위 생선, 천막, 요리사 */
export function Market() {
  return (
    <group position={[X, 0, Z]} rotation-y={-Math.PI / 2}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[2, 0.6, 0.5]} position={[0, 0.6, 0]} />
      </RigidBody>
      <Prop url={ASSET.counter} height={1} position={[-1, 0, 0]} />
      <Prop url={ASSET.counter} height={1} position={[0, 0, 0]} />
      <Prop url={ASSET.stove} height={1} position={[1.1, 0, 0]} />
      <Prop url={ASSET.potStew} height={0.35} position={[1.1, 1, 0]} />
      <Prop url={ASSET.cuttingBoard} height={0.06} position={[-0.6, 1, 0]} />
      <Prop url={ASSET.fish} height={0.15} position={[-0.6, 1.06, 0]} rotationY={0.4} />
      <Prop url={ASSET.sushi} height={0.12} position={[0.1, 1, 0.1]} />
      <Prop url={ASSET.bowlBroth} height={0.18} position={[-1.3, 1, 0.1]} />
      {/* 요리사 */}
      <Visitor url={ASSET.visitorB} position={[0, 0, -0.9]} clip="interact-right" />
      {/* 기둥과 줄무늬 천막 */}
      {[-1.8, 1.8].map((x) => (
        <mesh key={x} position={[x, 1.3, -1.2]} castShadow>
          <cylinderGeometry args={[0.06, 0.06, 2.6]} />
          <meshStandardMaterial color="#6d4c41" />
        </mesh>
      ))}
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} position={[-1.75 + i * 0.5, 2.55, -0.6]} rotation-x={0.35} castShadow>
          <boxGeometry args={[0.5, 0.05, 1.6]} />
          <meshStandardMaterial color={AWNING[i % 2]} />
        </mesh>
      ))}
      <Html center position={[0, 3.1, -0.4]} style={sign}>
        🐟 어시장
      </Html>
      <InteractionZone position={[0, 1, 1.2]} halfSize={[2.2, 1.5, 1.2]} target={{ kind: 'market' }} />
    </group>
  )
}

const sign = {
  pointerEvents: 'none' as const,
  whiteSpace: 'nowrap' as const,
  background: 'rgba(0,0,0,0.6)',
  color: '#fff',
  padding: '4px 10px',
  borderRadius: 6,
  fontSize: 14,
  fontWeight: 700,
}
```

주의: `InteractionZone`의 `position`은 RigidBody 위치라서 부모 group의 변환을 따른다. group 안에 넣었으므로 위 좌표는 노점 기준 상대 좌표다.

- [ ] **Step 2: 진료소·벤치 3D**

`src/game/scene/facilities/Clinic.tsx`:

```tsx
import { Html } from '@react-three/drei'
import { RigidBody } from '@react-three/rapier'
import { FACILITY } from '../../data/zones'
import { ASSET } from '../assets'
import { Prop } from '../Prop'
import { Visitor } from '../Visitor'

const [X, Z] = FACILITY.clinic

/** 진료소: 쓰러지면 이 앞에서 깨어난다. 상호작용은 없다 */
export function Clinic() {
  return (
    <group position={[X, 0, Z]}>
      <RigidBody type="fixed" colliders="cuboid">
        <mesh position={[0, 1.2, 0]} castShadow receiveShadow>
          <boxGeometry args={[3.4, 2.4, 2.6]} />
          <meshStandardMaterial color="#fafafa" />
        </mesh>
      </RigidBody>
      {/* 빨간 십자 */}
      <mesh position={[0, 1.8, 1.31]}>
        <boxGeometry args={[0.9, 0.25, 0.02]} />
        <meshStandardMaterial color="#e53935" />
      </mesh>
      <mesh position={[0, 1.8, 1.31]}>
        <boxGeometry args={[0.25, 0.9, 0.02]} />
        <meshStandardMaterial color="#e53935" />
      </mesh>
      <Prop url={ASSET.bed} height={0.6} position={[1.2, 0, 1.9]} rotationY={Math.PI / 2} />
      <Prop url={ASSET.plant} height={0.9} position={[-1.4, 0, 1.6]} />
      <Visitor url={ASSET.visitorC} position={[-0.6, 0, 1.8]} clip="idle" />
      <Html center position={[0, 2.9, 0]} style={sign}>
        🏥 진료소
      </Html>
    </group>
  )
}

const sign = {
  pointerEvents: 'none' as const,
  whiteSpace: 'nowrap' as const,
  background: 'rgba(0,0,0,0.6)',
  color: '#fff',
  padding: '4px 10px',
  borderRadius: 6,
  fontSize: 14,
  fontWeight: 700,
}
```

`src/game/scene/facilities/Bench.tsx`:

```tsx
import { FACILITY } from '../../data/zones'
import { ASSET } from '../assets'
import { Prop } from '../Prop'
import { InteractionZone } from './InteractionZone'

const [X, Z] = FACILITY.bench

/** 바다를 바라보는 벤치. 앉으면 체력이 천천히 찬다 */
export function Bench() {
  return (
    <>
      <Prop url={ASSET.bench} height={0.9} position={[X, 0, Z]} rotationY={Math.PI} />
      <InteractionZone position={[X, 0.8, Z]} halfSize={[1.4, 1, 1.2]} target={{ kind: 'bench' }} />
    </>
  )
}
```

벤치 방향(`rotationY`)은 화면에서 등받이가 섬 안쪽, 앉는 면이 바다(+z) 쪽인지 확인하고, 반대면 `0`으로 바꾼다.

- [ ] **Step 3: 어시장 패널**

`src/game/ui/MarketPanel.tsx`:

```tsx
import { useState } from 'react'
import { DISHES, BUFF_LABEL } from '../data/dishes'
import { RARITY_COLOR, RARITY_LABEL, findSpecies } from '../data/fish'
import type { DishId } from '../data/types'
import { dishEffect } from '../logic/cooking'
import { useProgressStore } from '../stores/progressStore'
import { Panel } from './Panel'
import { button, disabledButton } from './styles'

export function MarketPanel() {
  const inventory = useProgressStore((s) => s.inventory)
  const coins = useProgressStore((s) => s.coins)
  const stamina = useProgressStore((s) => s.survival.stamina)
  const cookDish = useProgressStore((s) => s.cookDish)
  const [dishId, setDishId] = useState<DishId>('sashimi')
  const dish = DISHES.find((d) => d.id === dishId) ?? DISHES[0]

  const rows = inventory.flatMap((fish) => {
    const species = findSpecies(fish.speciesId)
    return species ? [{ fish, species, effect: dishEffect(dish, species.rarity) }] : []
  })
  const affordable = coins >= dish.cookFee

  return (
    <Panel title={`어시장 · 코인 ${coins} · 체력 ${Math.ceil(stamina)}`}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {DISHES.map((d) => (
          <button key={d.id} style={{ ...button, flex: 1, opacity: d.id === dishId ? 1 : 0.55 }} onClick={() => setDishId(d.id)}>
            {d.name}
            <div style={{ fontSize: 11, fontWeight: 400 }}>조리비 {d.cookFee}</div>
          </button>
        ))}
      </div>
      <p style={{ margin: '0 0 12px', fontSize: 14, opacity: 0.85 }}>{dish.description}. 희귀한 물고기일수록 효과가 커요.</p>
      {rows.length === 0 ? (
        <p>요리할 물고기가 없어요. 낚시하러 가 볼까요?</p>
      ) : (
        rows.map(({ fish, species, effect }) => (
          <div key={fish.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #333' }}>
            <span style={{ color: RARITY_COLOR[species.rarity], flex: 1 }}>
              {species.name} <span style={{ fontSize: 12, opacity: 0.7 }}>{RARITY_LABEL[species.rarity]}</span>
            </span>
            <span style={{ fontSize: 13, width: 170, textAlign: 'right' }}>
              체력 +{effect.heal}
              {effect.buff && ` · ${BUFF_LABEL[effect.buff.kind]} ${Math.round(effect.buff.remaining)}초`}
            </span>
            <button style={affordable ? button : disabledButton} disabled={!affordable} onClick={(e) => {
                cookDish(dish.id, fish.id)
                e.currentTarget.blur()
              }}>
              먹기
            </button>
          </div>
        ))
      )}
    </Panel>
  )
}
```

- [ ] **Step 4: 연결**

`src/game/ui/Panels.tsx`: import 추가 후 switch에 추가.

```tsx
import { MarketPanel } from './MarketPanel'
```

```tsx
    case 'market':
      return <MarketPanel />
```

`src/game/scene/World.tsx`: import 추가, 에셋 미리 받기, 시설 배치.

```tsx
import { preloadFacilityAssets } from './assets'
import { Bench } from './facilities/Bench'
import { Clinic } from './facilities/Clinic'
import { Market } from './facilities/Market'

preloadFacilityAssets()
```

`<GearShop />` 아래에 추가:

```tsx
      <Market />
      <Clinic />
      <Bench />
```

- [ ] **Step 5: 확인 후 커밋**

Run: `npx tsc -b && npx vitest run && npm run lint && npm run build`
Expected: 모두 통과

브라우저 확인(`npm run dev`):
1. 해변 오른쪽에 천막 노점(어시장), 왼쪽에 흰 진료소, 선착장 왼쪽에 벤치가 보인다. 소품이 바닥에 묻히거나 떠 있지 않다
2. 어시장 앞에서 E → 요리 패널. 물고기를 골라 먹으면 체력이 오르고 버프가 HUD에 뜬다
3. 벤치에서 E → 이동이 멈추고 "쉬는 중" 안내, 체력이 1초에 2씩 오른다. E/ESC로 일어난다

```bash
git add src/game/scene/facilities/Market.tsx src/game/scene/facilities/Clinic.tsx src/game/scene/facilities/Bench.tsx src/game/ui/MarketPanel.tsx src/game/ui/Panels.tsx src/game/scene/World.tsx
git commit -m "feat: 어시장·진료소·벤치 추가" -m "줄무늬 천막 노점에서 물고기를 골라 회, 회덮밥, 매운탕을 먹을 수 있다. 진료소는 쓰러졌을 때 깨어나는 곳이고, 바다를 보는 벤치에 앉으면 체력이 천천히 찬다. 소품은 Kenney 에셋으로 꾸몄다."
```

---

### Task 9: 어항 3D와 어항 패널, 사료 판매

**Files:**
- Create: `src/game/scene/facilities/Aquarium.tsx`, `src/game/scene/facilities/AquariumFish.tsx`, `src/game/ui/AquariumPanel.tsx`
- Modify: `src/game/scene/World.tsx`, `src/game/ui/Panels.tsx`, `src/game/ui/GearShopPanel.tsx`

**Interfaces:**
- Consumes: 스토어의 어항 액션 전부 (Task 4), `TANK_LEVELS`, `TANK_TYPES`, `getTankType`, `isHungry`, `incomePerSecond`, `slotCount` (Task 3), `FishModel` (`speciesId` prop), `ASSET`, `Prop`, `Visitor` (Task 7), `FACILITY` (Task 5)

- [ ] **Step 1: 헤엄치는 물고기**

`src/game/scene/facilities/AquariumFish.tsx`:

```tsx
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Vector3 } from 'three'
import type { Group } from 'three'
import { FishModel } from '../fishing/FishModel'

/** 어항 안 물고기 크기 (FishModel 기본 몸길이 1.2 에 곱한다) */
const FISH_SCALE = 0.32
/** 먹이를 준 뒤 물고기들이 수면 가운데로 몰려드는 시간(초) */
const FEEDING_SECONDS = 5

type Props = {
  speciesId: string
  /** 어항 안쪽 절반 크기 [x, y, z] */
  half: [number, number, number]
  /** 물고기마다 다른 헤엄 경로를 만드는 값 */
  seed: number
  hungry: boolean
  /** 먹이를 준 뒤 지난 플레이 시간(초) */
  sinceFed: number
}

/** 어항 안을 8자로 헤엄친다. 배고프면 바닥에 가라앉고, 먹이를 주면 수면으로 몰려든다 */
export function AquariumFish({ speciesId, half, seed, hungry, sinceFed }: Props) {
  const ref = useRef<Group>(null)
  const target = useMemo(() => new Vector3(), [])
  useFrame(({ clock }) => {
    const fish = ref.current
    if (!fish) return
    const t = clock.elapsedTime * (hungry ? 0.15 : 0.5) + seed * 2.1
    const [hx, hy, hz] = half
    let x = Math.sin(t) * hx * 0.75
    let z = Math.sin(t * 2) * hz * 0.5
    let y = Math.sin(t * 0.7 + seed) * hy * 0.4
    if (hungry) y = -hy * 0.8
    if (sinceFed < FEEDING_SECONDS) {
      // 수면 가운데로 몰려들어 입을 대는 연출
      x *= 0.25
      z *= 0.25
      y = hy * 0.75
    }
    // 다음 위치를 바라보게 해서 머리(+z)가 헤엄치는 방향을 향하게 한다
    const dx = Math.cos(t) * hx * 0.75
    const dz = Math.cos(t * 2) * 2 * hz * 0.5
    // 목표 위치로 부드럽게 따라가서 배고픔·먹이 연출이 툭 끊기지 않게 한다
    fish.position.lerp(target.set(x, y, z), 0.08)
    fish.rotation.y = Math.atan2(dx, dz)
    fish.rotation.z = hungry ? Math.PI / 2 : 0
  })
  return <FishModel ref={ref} speciesId={speciesId} scale={FISH_SCALE} />
}
```

`FishModel`은 지금 `speciesId`만 받는다. `src/game/scene/fishing/FishModel.tsx`의 `forwardRef` 타입을 `{ speciesId: string | null; scale?: number }`로 넓히고, 바깥 group에 넘긴다(기본값 1):

```tsx
export const FishModel = forwardRef<Group, { speciesId: string | null; scale?: number }>(function FishModel({ speciesId, scale = 1 }, ref) {
  const id = (speciesId && SPECIES_MODEL[speciesId]) || DEFAULT_MODEL
  return (
    <group ref={ref} scale={scale}>
```

(나머지는 그대로. 낚시 연출의 `FishingVisuals`는 ref로 group.scale을 직접 바꾸므로 scale prop을 넘기지 않는다.)

- [ ] **Step 2: 어항 3D**

`src/game/scene/facilities/Aquarium.tsx`:

```tsx
import { Html } from '@react-three/drei'
import { RigidBody } from '@react-three/rapier'
import { TANK_LEVELS, getTankType } from '../../data/aquarium'
import { FACILITY } from '../../data/zones'
import { incomePerSecond, isHungry } from '../../logic/aquarium'
import { useProgressStore } from '../../stores/progressStore'
import { ASSET } from '../assets'
import { Prop } from '../Prop'
import { Visitor } from '../Visitor'
import { AquariumFish } from './AquariumFish'
import { InteractionZone } from './InteractionZone'

const [X, Z] = FACILITY.aquarium
/** 받침대 높이 */
const STAND = 0.8
const VISITOR_URLS = [ASSET.visitorA, ASSET.visitorB, ASSET.visitorC]
/** 분당 입장료 몇 코인마다 구경꾼 1명 (최대 VISITOR_URLS × 2명) */
const INCOME_PER_VISITOR = 3

export function Aquarium() {
  const aquarium = useProgressStore((s) => s.aquarium)
  const playTime = useProgressStore((s) => s.playTime)
  const level = TANK_LEVELS[aquarium.level]
  const type = getTankType(aquarium.activeType)
  const [w, h, d] = level.size
  const hungry = isHungry(aquarium, playTime)
  const perMinute = hungry ? 0 : incomePerSecond(aquarium) * 60
  const visitors = Math.min(VISITOR_URLS.length * 2, Math.ceil(perMinute / INCOME_PER_VISITOR))

  return (
    <group position={[X, 0, Z]}>
      {/* 받침대 */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh position={[0, STAND / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[w + 0.3, STAND, d + 0.3]} />
          <meshStandardMaterial color="#5d4037" />
        </mesh>
      </RigidBody>

      <group position={[0, STAND + h / 2, 0]}>
        {/* 물과 유리. 물은 안쪽, 유리는 바깥 테두리 */}
        <mesh renderOrder={1}>
          <boxGeometry args={[w - 0.05, h - 0.1, d - 0.05]} />
          <meshStandardMaterial color={type.water} transparent opacity={type.waterOpacity} depthWrite={false} />
        </mesh>
        <mesh renderOrder={2}>
          <boxGeometry args={[w, h, d]} />
          <meshPhysicalMaterial color="#ffffff" transparent opacity={0.12} roughness={0.05} metalness={0} depthWrite={false} />
        </mesh>
        {/* 바닥 */}
        <mesh position={[0, -h / 2 + 0.06, 0]} receiveShadow>
          <boxGeometry args={[w - 0.05, 0.12, d - 0.05]} />
          <meshStandardMaterial color={type.floor} />
        </mesh>
        <TankDecor type={aquarium.activeType} w={w} h={h} d={d} />
        {aquarium.displayed.map((fish, i) => (
          <AquariumFish
            key={fish.id}
            speciesId={fish.speciesId}
            half={[w / 2 - 0.3, h / 2 - 0.25, d / 2 - 0.25]}
            seed={i}
            hungry={hungry}
            sinceFed={playTime - aquarium.lastFedAt}
          />
        ))}
      </group>

      {/* 구경꾼: 수입이 높을수록 많이 모인다 */}
      {Array.from({ length: visitors }, (_, i) => (
        <Visitor
          key={i}
          url={VISITOR_URLS[i % VISITOR_URLS.length]}
          position={[-w / 2 + 0.4 + (i % 4) * 0.9, 0, d / 2 + 1.1 + Math.floor(i / 4) * 0.8]}
          rotationY={Math.PI}
          clip={i % 2 === 0 ? 'idle' : 'emote-yes'}
        />
      ))}

      <Html center position={[0, STAND + h + 0.6, 0]} style={sign}>
        🐠 어항 Lv{aquarium.level + 1} · {type.name}
        {hungry && ' · 배고파요!'}
      </Html>
      <InteractionZone position={[0, 1, d / 2 + 1]} halfSize={[w / 2 + 0.5, 1.5, 1.2]} target={{ kind: 'aquarium' }} />
    </group>
  )
}

/** 어항 종류별 장식. 동굴 수조의 이끼는 스스로 빛난다 */
function TankDecor({ type, w, h, d }: { type: string; w: number; h: number; d: number }) {
  const floorY = -h / 2 + 0.12
  switch (type) {
    case 'sea':
      return (
        <>
          {[-0.35, 0.1, 0.38].map((k, i) => (
            <mesh key={k} position={[w * k, floorY + 0.25, -d * 0.25]}>
              <coneGeometry args={[0.12, 0.5 + i * 0.15, 6]} />
              <meshStandardMaterial color={['#ff7043', '#f06292', '#ffca28'][i]} />
            </mesh>
          ))}
          <Prop url={ASSET.rockA} height={0.25} position={[-w * 0.2, floorY, d * 0.15]} />
        </>
      )
    case 'fresh':
      return (
        <>
          <Prop url={ASSET.bush} height={0.6} position={[-w * 0.35, floorY, -d * 0.2]} />
          <Prop url={ASSET.bush} height={0.45} position={[w * 0.3, floorY, -d * 0.25]} />
          <Prop url={ASSET.rockC} height={0.25} position={[w * 0.05, floorY, d * 0.15]} />
          <Prop url={ASSET.lily} height={0.03} position={[w * 0.2, h / 2 - 0.1, 0]} />
        </>
      )
    case 'cave':
      return (
        <>
          <Prop url={ASSET.stoneTall} height={0.8} position={[-w * 0.35, floorY, -d * 0.2]} />
          <Prop url={ASSET.rockTall} height={0.6} position={[w * 0.3, floorY, -d * 0.2]} />
          {[-0.2, 0.1, 0.25].map((k) => (
            <mesh key={k} position={[w * k, floorY + 0.03, d * 0.1]}>
              <sphereGeometry args={[0.08, 8, 8]} />
              <meshStandardMaterial color="#76ff03" emissive="#76ff03" emissiveIntensity={1.5} />
            </mesh>
          ))}
        </>
      )
    default:
      return <Prop url={ASSET.rockA} height={0.2} position={[w * 0.25, floorY, -d * 0.15]} />
  }
}

const sign = {
  pointerEvents: 'none' as const,
  whiteSpace: 'nowrap' as const,
  background: 'rgba(0,0,0,0.6)',
  color: '#fff',
  padding: '4px 10px',
  borderRadius: 6,
  fontSize: 14,
  fontWeight: 700,
}
```

`TankDecor`의 `type` 매개변수 타입은 `TankTypeId`로 import해서 쓴다(`import type { TankTypeId } from '../../data/types'`).

- [ ] **Step 3: 어항 패널**

`src/game/ui/AquariumPanel.tsx`:

```tsx
import { TANK_LEVELS, TANK_TYPES } from '../data/aquarium'
import { AQUARIUM } from '../data/balance'
import { RARITY_COLOR, findSpecies } from '../data/fish'
import { incomePerSecond, isHungry, slotCount } from '../logic/aquarium'
import { useProgressStore } from '../stores/progressStore'
import { Panel } from './Panel'
import { button, disabledButton } from './styles'

const row = { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #333' } as const
const section = { margin: '16px 0 6px', fontSize: 15 } as const

export function AquariumPanel() {
  const s = useProgressStore()
  const { aquarium, playTime, coins, feed, inventory } = s
  const hungry = isHungry(aquarium, playTime)
  const nextLevel = TANK_LEVELS[aquarium.level + 1]
  const full = aquarium.displayed.length >= slotCount(aquarium)
  const fedAgo = Math.floor((playTime - aquarium.lastFedAt) / 60)
  const junk = inventory.find((f) => findSpecies(f.speciesId)?.rarity === 'junk')
  const income = Math.floor(aquarium.pendingIncome)

  return (
    <Panel title={`어항 Lv${aquarium.level + 1} · 코인 ${coins}`}>
      <div style={{ fontSize: 14, marginBottom: 8 }}>
        전시 {aquarium.displayed.length}/{slotCount(aquarium)} · 분당 입장료 {hungry ? 0 : Math.round(incomePerSecond(aquarium) * 60 * 10) / 10}코인
        {aquarium.displayed.length > 0 && (hungry ? <b style={{ color: '#ef5350' }}> · 배고파요!</b> : ` · ${fedAgo}분 전에 먹음`)}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button style={income > 0 ? button : disabledButton} disabled={income === 0} onClick={() => s.claimAquariumIncome()}>
          입장료 받기 (+{income})
        </button>
        <button style={feed > 0 && aquarium.displayed.length > 0 ? button : disabledButton} disabled={feed === 0 || aquarium.displayed.length === 0} onClick={() => s.feedWithPellet()}>
          사료 주기 (남은 사료 {feed})
        </button>
        <button style={junk && aquarium.displayed.length > 0 ? button : disabledButton} disabled={!junk || aquarium.displayed.length === 0} onClick={() => junk && s.feedWithJunk(junk.id)}>
          잡어 주기
        </button>
      </div>

      <h3 style={section}>전시 중</h3>
      {aquarium.displayed.length === 0 && <p style={{ fontSize: 14 }}>아직 전시한 물고기가 없어요.</p>}
      {aquarium.displayed.map((fish) => {
        const species = findSpecies(fish.speciesId)
        return (
          <div key={fish.id} style={row}>
            <span style={{ flex: 1, color: species ? RARITY_COLOR[species.rarity] : undefined }}>{species?.name ?? '???'}</span>
            <span style={{ width: 70, textAlign: 'right' }}>{fish.weight}kg</span>
            <button style={button} onClick={() => s.undisplayFish(fish.id)}>
              빼기
            </button>
          </div>
        )
      })}

      <h3 style={section}>보관함에서 전시하기</h3>
      {inventory.length === 0 && <p style={{ fontSize: 14 }}>보관함이 비어 있어요.</p>}
      {inventory.map((fish) => {
        const species = findSpecies(fish.speciesId)
        return (
          <div key={fish.id} style={row}>
            <span style={{ flex: 1, color: species ? RARITY_COLOR[species.rarity] : undefined }}>{species?.name ?? '???'}</span>
            <span style={{ width: 70, textAlign: 'right' }}>{fish.weight}kg</span>
            <button style={full ? disabledButton : button} disabled={full} onClick={() => s.displayFish(fish.id)}>
              전시
            </button>
          </div>
        )
      })}

      <h3 style={section}>어항 종류</h3>
      {TANK_TYPES.map((type) => {
        const owned = aquarium.ownedTypes.includes(type.id)
        const active = aquarium.activeType === type.id
        return (
          <div key={type.id} style={row}>
            <span style={{ flex: 1 }}>
              {type.name} <span style={{ fontSize: 12, opacity: 0.7 }}>{type.description}</span>
            </span>
            {active ? (
              <span style={{ color: '#ffd166', fontSize: 14 }}>사용 중</span>
            ) : owned ? (
              <button style={button} onClick={() => s.selectTankType(type.id)}>
                바꾸기
              </button>
            ) : (
              <button style={coins >= type.price ? button : disabledButton} disabled={coins < type.price} onClick={() => s.buyTankType(type.id)}>
                {type.price} 코인
              </button>
            )}
          </div>
        )
      })}

      <h3 style={section}>어항 확장</h3>
      {nextLevel ? (
        <div style={row}>
          <span style={{ flex: 1 }}>
            Lv{aquarium.level + 2}: {nextLevel.slots}칸 · 입장료 ×{nextLevel.incomeMul}
          </span>
          <button style={coins >= nextLevel.price ? button : disabledButton} disabled={coins < nextLevel.price} onClick={() => s.buyAquariumExpansion()}>
            {nextLevel.price} 코인
          </button>
        </div>
      ) : (
        <p style={{ fontSize: 14, color: '#ffd166' }}>최고 단계</p>
      )}
      <p style={{ fontSize: 12, opacity: 0.6, marginTop: 12 }}>
        마지막으로 먹이를 주고 {AQUARIUM.hungerAfter / 60}분이 지나면 배고파져서 수입이 멈추고, {AQUARIUM.releaseAfter / 60}분 더 지나면 바다로 돌아가요. 사료는 장비 상점에서 팔아요.
      </p>
    </Panel>
  )
}
```

- [ ] **Step 4: 장비 상점에서 사료 팔기**

`src/game/ui/GearShopPanel.tsx`: import에 `import { AQUARIUM } from '../data/balance'`를 추가하고, 컴포넌트에서 `feed`, `buyFeed`를 읽는다.

```tsx
  const feed = useProgressStore((s) => s.feed)
  const buyFeed = useProgressStore((s) => s.buyFeed)
```

`SLOTS.map(...)` 블록 뒤(`</Panel>` 앞)에 추가:

```tsx
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', fontSize: 14 }}>
        <span style={{ flex: 1 }}>
          <strong>어항 사료</strong> <span style={{ opacity: 0.7 }}>보유 {feed}개</span>
        </span>
        <button style={coins >= AQUARIUM.feedPrice ? button : disabledButton} disabled={coins < AQUARIUM.feedPrice} onClick={(e) => {
            buyFeed()
            e.currentTarget.blur()
          }}>
          {AQUARIUM.feedPrice} 코인
        </button>
      </div>
```

- [ ] **Step 5: 연결**

`src/game/ui/Panels.tsx`:

```tsx
import { AquariumPanel } from './AquariumPanel'
```

```tsx
    case 'aquarium':
      return <AquariumPanel />
```

`src/game/scene/World.tsx`: `import { Aquarium } from './facilities/Aquarium'`를 추가하고 `<Bench />` 아래에 `<Aquarium />`를 넣는다.

- [ ] **Step 6: 확인 후 커밋**

Run: `npx tsc -b && npx vitest run && npm run lint && npm run build`
Expected: 모두 통과

브라우저 확인(`npm run dev`, 저장본에 물고기가 있어야 하므로 먼저 몇 마리 낚는다):
1. 어항 앞에서 E → 패널. 물고기를 전시하면 어항 안에서 헤엄치고, 수입이 생기면 앞에 구경꾼이 선다
2. 어항 종류를 사서 바꾸면 물 색과 장식이 바뀐다. 확장하면 어항이 커진다
3. 사료를 사서 주면 물고기들이 수면 가운데로 몰려들었다가 흩어진다
4. 콘솔에서 `useProgressStore.setState((s) => ({ aquarium: { ...s.aquarium, lastFedAt: s.playTime - 601 } }))` → 물고기가 바닥에 가라앉고 "배고파요" 알림이 뜬다(다음 1초 틱에서)

```bash
git add src/game/scene/facilities/Aquarium.tsx src/game/scene/facilities/AquariumFish.tsx src/game/scene/fishing/FishModel.tsx src/game/ui/AquariumPanel.tsx src/game/ui/GearShopPanel.tsx src/game/ui/Panels.tsx src/game/scene/World.tsx
git commit -m "feat: 어항 전시와 관람객 수입 추가" -m "보관함 물고기를 어항에 전시하면 3D로 헤엄치고, 희귀도에 따라 구경꾼이 모여 입장료가 쌓인다. 배고프면 바닥에 가라앉고, 먹이를 주면 수면으로 몰려든다. 어항 종류(기본·바다·민물·동굴)마다 물 색과 장식이 다르고, 확장하면 어항이 커진다. 사료는 장비 상점에서 판다."
```

---

## 마무리 확인

- `npx vitest run` 전부 PASS, `npx tsc -b`, `npm run lint`(새 에러 없음), `npm run build` 통과
- 브라우저에서 한 바퀴: 낚시로 체력 소모 → 어시장에서 요리 → 벤치 휴식 → 어항 전시·먹이·입장료 수령 → 일부러 체력 0으로 두고 쓰러짐·진료소 확인
- 스펙과 다른 결정(필요하면 스펙에 반영):
  - 쓰러진 뒤 체력은 가득 찬 상태로 깨어난다(스펙에 없음)
  - 진료소는 깨어나는 장소일 뿐 상호작용은 없다
  - 배고픔·방생은 물고기 한 마리씩이 아니라 어항 전체 기준(마지막 급식 시각 하나)
