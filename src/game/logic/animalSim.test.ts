import { describe, expect, it } from 'vitest'
import { ANIMAL, ANIMAL_CHASE, ANIMAL_FIELD } from '../data/animals'
import { calmHerd, herdViews, hitAnimal, nearAnimalField, newHerd, stepHerd, type Animal, type Herd, type HerdEvent, type HerdPlayer } from './animalSim'

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

describe('이상한 값 막기', () => {
  it('dt 가 0·음수·NaN·Infinity 면 무리를 그대로 돌려준다', () => {
    const h = newHerd(seeded(3))
    for (const dt of [0, -1, NaN, Infinity]) {
      const r = stepHerd(h, [], dt, seeded(1))
      expect(r.herd).toBe(h)
      expect(r.events).toEqual([])
    }
  })
  it('dt 는 1초까지만 (큰 dt 는 1초 한 번과 같다)', () => {
    const h = one({ state: 'walk', tx: ANIMAL_FIELD.x1, tz: mid.z })
    expect(stepHerd(h, [], 50, seeded(1)).herd).toEqual(stepHerd(h, [], 1, seeded(1)).herd)
  })
  it('좌표가 숫자가 아닌 사람은 없는 사람처럼 본다', () => {
    const h = one({ state: 'attack', target: 'x', timer: 10 })
    const bad = [at('x', NaN, mid.z), at('y', mid.x, Infinity)]
    const r = stepHerd(h, bad, 0.2, seeded(1)).herd
    expect(r).toEqual(stepHerd(h, [], 0.2, seeded(1)).herd)
    expect(Number.isFinite(r.animals[0].x) && Number.isFinite(r.animals[0].h)).toBe(true)
  })
  it('피해가 0·음수·NaN 이면 miss (체력도 상태도 그대로)', () => {
    const h = one({})
    for (const dmg of [0, -2, NaN]) {
      const r = hitAnimal(h, 1, dmg, 'p1')
      expect(r.result).toBe('miss')
      expect(r.herd).toBe(h)
    }
  })
})

describe('nearAnimalField', () => {
  it('쫓는 곳(ANIMAL_CHASE)과 그 둘레 달아나기 거리(7m) 안이면 true', () => {
    expect(nearAnimalField(mid.x, mid.z)).toBe(true)
    expect(nearAnimalField(ANIMAL_CHASE.x0 - ANIMAL.fleeDist + 0.1, mid.z)).toBe(true)
    expect(nearAnimalField(ANIMAL_CHASE.x0 - ANIMAL.fleeDist - 0.1, mid.z)).toBe(false)
    expect(nearAnimalField(mid.x, ANIMAL_CHASE.z1 + ANIMAL.fleeDist + 0.1)).toBe(false)
    expect(nearAnimalField(0, 0)).toBe(false)
    expect(nearAnimalField(NaN, mid.z)).toBe(false)
  })
})
