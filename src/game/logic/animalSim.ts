import { ANIMAL, ANIMAL_CHASE, ANIMAL_FIELD, SPECIES, speciesOf, type SpeciesId } from '../data/animals'
import type { Rect } from '../data/meadow'
import type { Rng } from './rng'

/**
 * 들판 동물 시뮬레이션 (은지 animals.js 의 상태 기계를 그래픽 없이 옮긴 것). 세계 좌표.
 * 같이 하기에선 서버(rinfish-rooms)가 사람 메시지가 올 때(0.15초에 한 번까지), 혼자 할 때는 내 화면이 매 프레임 같은 함수로 돌린다.
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
/** 한 번에 진행하는 최대 시간(초). 오래 멈췄다 와도 한꺼번에 뛰지 않는다 */
const MAX_DT = 1

/**
 * 동물이 이 사람을 볼 수 있는 곳: 쫓는 곳(ANIMAL_CHASE)과 그 둘레 달아나기 거리.
 * 같이 하기에선 이 안에 있는 사람이 가만히 있어도 NET.sendHz 로 모습을 보낸다 (서버가 그 메시지에 맞춰 동물을 움직인다)
 */
export function nearAnimalField(x: number, z: number): boolean {
  const R = ANIMAL_CHASE
  const m = ANIMAL.fleeDist
  return x >= R.x0 - m && x <= R.x1 + m && z >= R.z0 - m && z <= R.z1 + m
}
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
  // 시간이 안 갔거나 이상한 값이면 그대로. 좌표가 숫자가 아닌 사람은 없는 사람처럼 본다
  if (!(dt > 0) || !Number.isFinite(dt)) return { herd, events: [] }
  dt = Math.min(dt, MAX_DT)
  if (players.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.z))) players = players.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.z))
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

/** 동물 id 를 dmg 만큼 때렸다 (by: 때린 사람). 피해가 0 이하·숫자가 아니면 miss */
export function hitAnimal(herd: Herd, id: number, dmg: number, by: string): HitResult {
  const old = herd.animals.find((a) => a.id === id)
  if (!old || old.state === 'dead' || !(dmg > 0) || !Number.isFinite(dmg)) return { herd, result: 'miss', animal: old ?? null }
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
