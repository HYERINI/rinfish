import { SPECIES_IDS } from '../data/animals'
import { DAY_LENGTH } from '../data/balance'
import { DISHES } from '../data/dishes'
import { EMOTES, type EmoteId } from '../data/emotes'
import { MEADOW_DISH_IDS, RAW_ITEM_IDS, isMeadowDish, type MeadowDishId, type RawItemId } from '../data/meadowItems'
import { MELEE_IDS, type MeleeId } from '../data/melee'
import { NET } from '../data/net'
import { SNACK_IDS } from '../data/snacks'
import { TOOL_IDS, type ToolId } from '../data/tools'
import type { CharacterLook, FoodId } from '../data/types'
import type { BoatDir } from './boatRoute'
import { FISHING_POSES, type FishingLook, type FishingPose } from './characterPose'
import { normalizeLook } from './characterLook'
import { ANIMAL_POSES, nearAnimalField, type AnimalView } from './animalSim'
import type { ClockTime } from './dayClock'
import type { PlayerAction } from './playerMotion'
import { cleanText, textLength } from './roomKey'

/**
 * 같이 하기 메시지 (JSON 텍스트). 서버와 클라이언트가 같은 함수로 만들고 검사한다.
 * 받은 값은 믿지 않는다: 모양·범위·이름 목록을 확인하고 틀리면 null (그 메시지만 버린다)
 */

export type Vec3 = [number, number, number]
/**
 * 동작 상태. 기기마다 시계가 달라 시각 대신 "몇 초 전" 으로 보낸다.
 * meal: 은지 요리를 먹는 중이면 그 요리 (3-2). 옛 빌드는 모르는 eat 이 오면 모습 전체를 버리므로
 * 은지 요리는 eat 에 옛 음식(LEGACY_MEAL)을 넣고 진짜 요리는 meal 에 담는다. 받는 쪽은 meal 을 먼저 본다
 */
export type NetAct = { emote: EmoteId | null; emoteAge: number; airAge: number | null; landedAge: number; eat: FoodId | null; eatAge: number; meal?: MeadowDishId }
/** 은지 요리를 먹을 때 옛 빌드에 보이는 음식 (그릇에 담긴 매운탕) */
export const LEGACY_MEAL: FoodId = 'stew'
/** 배 타는 중이면 가는 방향과 진행도(0~1). 없으면 배를 타지 않았다 (옛 클라이언트도 보내지 않는다) */
export type NetBoat = { dir: BoatDir; t: number }
const BOAT_DIRS: BoatDir[] = ['toIsland', 'toMeadow']
/**
 * 내 모습 한 장면. p: 몸 가운데(캡슐 가운데) 위치, f: 바라보는 각도, v: 수평 속도.
 * tool: 손에 든 도구 (3-2. 빈손이거나 옛 클라이언트면 없다. 낚싯대가 보이는지는 rodOn 이 정한다)
 */
export type NetState = { p: Vec3; f: number; v: number; rest: boolean; fish: FishingLook | null; rod: number; rodOn: boolean; bob: Vec3 | null; act: NetAct; boat?: NetBoat; tool?: ToolId }
export type JoinMode = 'create' | 'join'
export type ErrorCode = 'bad-hello' | 'room-exists' | 'no-room' | 'bad-password' | 'full' | 'version'
export const ERROR_CODES: ErrorCode[] = ['bad-hello', 'room-exists', 'no-room', 'bad-password', 'full', 'version']
export type PeerInfo = { id: string; nick: string; look: CharacterLook; s: NetState | null }

export type ClientMsg =
  | { type: 'hello'; v: number; mode: JoinMode; passHash: string; nick: string; look: CharacterLook }
  | { type: 'state'; s: NetState }
  | { type: 'chat'; text: string }
  | { type: 'profile'; nick: string; look: CharacterLook }
  /** 같이 하기 잠 투표: 침대에 누웠다(on) / 일어났다 */
  | { type: 'sleep'; on: boolean }
  /** 들판 동물을 때렸다 (3-3). 피해는 서버가 공격 종류(w)로 정한다 (dmg 는 내 화면에서 본 값) */
  | { type: 'animalHit'; id: number; dmg: number; w: MeleeId }

/** 동물 한 마리 보내는 모양: [번호, 종(SPECIES_IDS 순서), x, z, 방향, 동작(ANIMAL_POSES 순서), 체력]. 소수 둘째 자리 */
export type AnimalTuple = [number, number, number, number, number, number, number]
/** 누구에게 맞았나: 동물 (3-4 에서 pvp) */
export type HurtBy = 'animal'
const HURT_BY: HurtBy[] = ['animal']

/**
 * 서버 → 클라이언트. 3-1 에서 더한 것: welcome.time (방 시계), time (30초마다 시계 확인), sleepers (자는 사람 수 / 필요한 수), morning (모두 아침).
 * 3-3 에서 더한 것: animals (들판 동물), loot (잡은 사람에게 전리품), hurt (맞은 사람에게 피해)
 * 옛 클라이언트는 모르는 종류를 버리고(parseServerMsg 가 null) welcome 의 time 은 읽지 않는다
 */
export type ServerMsg =
  | { type: 'welcome'; you: string; players: PeerInfo[]; time?: ClockTime }
  | { type: 'error'; code: ErrorCode }
  | { type: 'join'; id: string; nick: string; look: CharacterLook }
  | { type: 'leave'; id: string }
  | { type: 'profile'; id: string; nick: string; look: CharacterLook }
  | { type: 'state'; id: string; s: NetState }
  | { type: 'chat'; id: string; text: string }
  | { type: 'time'; tm: number; day: number }
  | { type: 'sleepers'; n: number; need: number }
  | { type: 'morning'; day: number }
  /** 3-3: 들판 동물 전부 (사람 메시지에 맞춰 0.15초에 한 번까지), 잡은 사람에게만 전리품과 떨어진 자리, 맞은 사람에게만 피해 */
  | { type: 'animals'; list: AnimalTuple[] }
  | { type: 'loot'; items: RawItemId[]; x: number; z: number }
  | { type: 'hurt'; dmg: number; by: HurtBy; from?: string }

const EMOTE_IDS = EMOTES.map((e) => e.id)
const FOOD_IDS: FoodId[] = [...DISHES.map((d) => d.id), ...SNACK_IDS, ...MEADOW_DISH_IDS]

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const num = (v: unknown, lo: number, hi: number): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : null)
const oneOf = <T extends string>(v: unknown, list: readonly T[]): T | null => (typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : null)
const id = (v: unknown): string | null => (typeof v === 'string' && v.length >= 1 && v.length <= 40 ? v : null)
const int = (v: unknown, lo: number, hi: number): number | null => (Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi ? (v as number) : null)
/** 날짜 상한 (하루 8분이라 백만 일이면 15년) */
const MAX_DAY = 1e6

/** 방 시각. 틀리면 null */
function clockTime(tmRaw: unknown, dayRaw: unknown): ClockTime | null {
  const tm = typeof tmRaw === 'number' && Number.isFinite(tmRaw) && tmRaw >= 0 && tmRaw < DAY_LENGTH ? tmRaw : null
  const day = int(dayRaw, 1, MAX_DAY)
  return tm === null || day === null ? null : { tm, day }
}

function vec3(v: unknown): Vec3 | null {
  if (!Array.isArray(v) || v.length !== 3) return null
  const L = NET.coordLimit
  const x = num(v[0], -L, L)
  const y = num(v[1], -L, L)
  const z = num(v[2], -L, L)
  return x === null || y === null || z === null ? null : [x, y, z]
}

/** 정리한 글자가 [lo, hi] 글자 안이면 그 글자, 아니면 null */
function text(v: unknown, lo: number, hi: number): string | null {
  if (typeof v !== 'string') return null
  const t = cleanText(v)
  const n = textLength(t)
  return n >= lo && n <= hi ? t : null
}
const nick = (v: unknown) => text(v, NET.nick[0], NET.nick[1])
const look = (v: unknown): CharacterLook | null => normalizeLook(v)

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
  const act: NetAct = { emote, emoteAge, airAge, landedAge, eat, eatAge }
  // 틀린 meal 은 그 필드만 버린다
  const meal = oneOf(v.meal, MEADOW_DISH_IDS)
  if (meal) act.meal = meal
  return act
}

/** 낚시 정보. 틀리면 undefined (null 은 "낚시 중 아님" 이라는 맞는 값) */
function readFish(v: unknown): FishingLook | null | undefined {
  if (v === null) return null
  if (!isRecord(v)) return undefined
  const pose = oneOf<FishingPose>(v.pose, FISHING_POSES)
  const lean = num(v.lean, 0, 1)
  return pose === null || lean === null ? undefined : { pose, lean }
}

function readBoat(v: unknown): NetBoat | null {
  if (!isRecord(v)) return null
  const dir = oneOf(v.dir, BOAT_DIRS)
  const t = num(v.t, 0, 1)
  return dir && t !== null ? { dir, t } : null
}

export function readNetState(v: unknown): NetState | null {
  if (!isRecord(v)) return null
  const p = vec3(v.p)
  const f = num(v.f, -1e4, 1e4)
  const speed = num(v.v, 0, 50)
  const rod = num(v.rod, -4, 4)
  const fish = readFish(v.fish)
  const bob = v.bob === null ? null : vec3(v.bob)
  const act = readAct(v.act)
  if (!p || f === null || speed === null || rod === null || fish === undefined || (v.bob !== null && bob === null) || !act) return null
  if (typeof v.rest !== 'boolean' || typeof v.rodOn !== 'boolean') return null
  const out: NetState = { p, f, v: speed, rest: v.rest, fish, rod, rodOn: v.rodOn, bob, act }
  // 배 정보는 틀려도 그 필드만 버린다 (모습 전체를 버리지 않는다)
  const boat = readBoat(v.boat)
  if (boat) out.boat = boat
  // 도구도 틀리면 그 필드만 버린다 (모르는 도구 = 3-4 의 총을 든 새 클라이언트)
  const tool = oneOf(v.tool, TOOL_IDS)
  if (tool) out.tool = tool
  return out
}

function parse(raw: string): Record<string, unknown> | null {
  try {
    const v: unknown = JSON.parse(raw)
    return isRecord(v) ? v : null
  } catch {
    return null
  }
}

export function parseClientMsg(raw: string): ClientMsg | null {
  const m = parse(raw)
  if (!m) return null
  switch (m.type) {
    case 'hello': {
      const mode = oneOf<JoinMode>(m.mode, ['create', 'join'])
      const v = num(m.v, 0, 1e6)
      const passHash = typeof m.passHash === 'string' && /^[0-9a-f]{64}$/.test(m.passHash) ? m.passHash : null
      const n = nick(m.nick)
      const l = look(m.look)
      return mode && v !== null && passHash && n && l ? { type: 'hello', v, mode, passHash, nick: n, look: l } : null
    }
    case 'state': {
      const s = readNetState(m.s)
      return s ? { type: 'state', s } : null
    }
    case 'chat': {
      const t = text(m.text, 1, NET.chatLength)
      return t ? { type: 'chat', text: t } : null
    }
    case 'profile': {
      const n = nick(m.nick)
      const l = look(m.look)
      return n && l ? { type: 'profile', nick: n, look: l } : null
    }
    case 'sleep':
      return typeof m.on === 'boolean' ? { type: 'sleep', on: m.on } : null
    case 'animalHit': {
      const i = int(m.id, 1, 1e9)
      const dmg = num(m.dmg, 0, 10)
      const w = oneOf(m.w, MELEE_IDS)
      return i !== null && dmg !== null && w ? { type: 'animalHit', id: i, dmg, w } : null
    }
    default:
      return null
  }
}

/** 동물 한 마리. 틀리면 null */
function animalTuple(v: unknown): AnimalTuple | null {
  if (!Array.isArray(v) || v.length !== 7) return null
  const L = NET.coordLimit
  const i = int(v[0], 1, 1e9)
  const sp = int(v[1], 0, SPECIES_IDS.length - 1)
  const x = num(v[2], -L, L)
  const z = num(v[3], -L, L)
  const h = num(v[4], -10, 10)
  const pose = int(v[5], 0, ANIMAL_POSES.length - 1)
  const hp = int(v[6], 0, 10)
  return i === null || sp === null || x === null || z === null || h === null || pose === null || hp === null ? null : [i, sp, x, z, h, pose, hp]
}

function readPeer(v: unknown): PeerInfo | null {
  if (!isRecord(v)) return null
  const i = id(v.id)
  const n = nick(v.nick)
  const l = look(v.look)
  const s = v.s === null ? null : readNetState(v.s)
  if (!i || !n || !l || (v.s !== null && s === null)) return null
  return { id: i, nick: n, look: l, s }
}

export function parseServerMsg(raw: string): ServerMsg | null {
  const m = parse(raw)
  if (!m) return null
  switch (m.type) {
    case 'welcome': {
      const you = id(m.you)
      if (!you || !Array.isArray(m.players)) return null
      const out: ServerMsg = { type: 'welcome', you, players: m.players.map(readPeer).filter((p): p is PeerInfo => p !== null) }
      // 방 시계는 틀려도 그 필드만 버린다 (옛 서버는 보내지 않는다)
      const time = isRecord(m.time) ? clockTime(m.time.tm, m.time.day) : null
      if (time) out.time = time
      return out
    }
    case 'error': {
      const code = oneOf(m.code, ERROR_CODES)
      return code ? { type: 'error', code } : null
    }
    case 'join':
    case 'profile': {
      const i = id(m.id)
      const n = nick(m.nick)
      const l = look(m.look)
      return i && n && l ? { type: m.type, id: i, nick: n, look: l } : null
    }
    case 'leave': {
      const i = id(m.id)
      return i ? { type: 'leave', id: i } : null
    }
    case 'state': {
      const i = id(m.id)
      const s = readNetState(m.s)
      return i && s ? { type: 'state', id: i, s } : null
    }
    case 'chat': {
      const i = id(m.id)
      const t = text(m.text, 1, NET.chatLength)
      return i && t ? { type: 'chat', id: i, text: t } : null
    }
    case 'time': {
      const time = clockTime(m.tm, m.day)
      return time ? { type: 'time', ...time } : null
    }
    case 'sleepers': {
      const n = int(m.n, 0, NET.maxPlayers)
      const need = int(m.need, 1, NET.maxPlayers)
      return n !== null && need !== null ? { type: 'sleepers', n, need } : null
    }
    case 'morning': {
      const day = int(m.day, 1, MAX_DAY)
      return day !== null ? { type: 'morning', day } : null
    }
    case 'animals': {
      // 틀린 동물만 빼고 읽는다
      if (!Array.isArray(m.list) || m.list.length > NET.maxAnimals) return null
      return { type: 'animals', list: m.list.map(animalTuple).filter((a): a is AnimalTuple => a !== null) }
    }
    case 'loot': {
      const L = NET.coordLimit
      const x = num(m.x, -L, L)
      const z = num(m.z, -L, L)
      if (!Array.isArray(m.items) || m.items.length > 10 || x === null || z === null) return null
      const items = m.items.map((v) => oneOf(v, RAW_ITEM_IDS))
      return items.every((v) => v !== null) ? { type: 'loot', items: items as RawItemId[], x, z } : null
    }
    case 'hurt': {
      const dmg = num(m.dmg, 0, 200)
      const by = oneOf(m.by, HURT_BY)
      if (dmg === null || !by) return null
      const from = id(m.from)
      return from ? { type: 'hurt', dmg, by, from } : { type: 'hurt', dmg, by }
    }
    default:
      return null
  }
}

/** 소수 둘째 자리로 (+ 0: -0 을 0 으로) */
const r2 = (n: number) => Math.round(n * 100) / 100 + 0
const r3 = (v: Vec3): Vec3 => [r2(v[0]), r2(v[1]), r2(v[2])]

/** 보내기 (서버): 그리는 값 → 짧은 배열 (소수 둘째 자리) */
export function packAnimals(list: readonly AnimalView[]): AnimalTuple[] {
  return list.map((a) => [a.id, SPECIES_IDS.indexOf(a.sp), r2(a.x), r2(a.z), r2(a.h), ANIMAL_POSES.indexOf(a.pose), a.hp])
}

/** 받기: 짧은 배열 → 그리는 값 */
export function unpackAnimals(list: readonly AnimalTuple[]): AnimalView[] {
  return list.map(([id, sp, x, z, h, pose, hp]) => ({ id, sp: SPECIES_IDS[sp], x, z, h, pose: ANIMAL_POSES[pose], hp }))
}

/** 보내기 전 숫자를 소수 둘째 자리로 (메시지 크기를 줄인다) */
export function roundState(s: NetState): NetState {
  const a = s.act
  const out: NetState = {
    p: r3(s.p),
    f: r2(s.f),
    v: r2(s.v),
    rest: s.rest,
    fish: s.fish && { pose: s.fish.pose, lean: r2(s.fish.lean) },
    rod: r2(s.rod),
    rodOn: s.rodOn,
    bob: s.bob && r3(s.bob),
    act: { emote: a.emote, emoteAge: r2(a.emoteAge), airAge: a.airAge === null ? null : r2(a.airAge), landedAge: r2(a.landedAge), eat: a.eat, eatAge: r2(a.eatAge) },
  }
  if (a.meal) out.act.meal = a.meal
  if (s.boat) out.boat = { dir: s.boat.dir, t: r2(s.boat.t) }
  if (s.tool) out.tool = s.tool
  return out
}

/** "바뀐 게 있나" 비교용 열쇠. 저절로 늘어나는 나이(몇 초 전)는 빼고 무엇을 하는지만 넣는다 */
export function stateKey(s: NetState): string {
  return JSON.stringify([s.p, s.f, s.v, s.rest, s.fish, s.rod, s.rodOn, s.bob, s.act.emote, s.act.eat, s.act.meal ?? null, s.act.airAge !== null, s.boat?.dir ?? null, s.tool ?? null])
}

/**
 * 내 모습을 지금 보낼까. since: 지난번 보낸 뒤 초, changed: stateKey 가 바뀌었나.
 * 바뀌었으면 초당 최대 NET.sendHz 번, 그대로면 NET.idleSendEvery 초마다. 단 들판 근처(nearAnimalField)면 그대로여도 NET.sendHz 로:
 * 서버는 alarm 없이 이 메시지에 맞춰 동물을 움직인다 (창이 뒤에 있으면 그리지 않아 보내지도 않는다)
 */
export function stateSendDue(s: NetState, changed: boolean, since: number): boolean {
  if (since >= NET.idleSendEvery) return true
  if (since < 1 / NET.sendHz) return false
  return changed || nearAnimalField(s.p[0], s.p[2])
}

const age = (now: number, at: number) => Math.min(NET.actAgeCap, Math.max(0, now - at))

/** 내 동작 상태 → 보낼 값 (now: 동작 시각과 같은 시계) */
export function toNetAct(action: PlayerAction, now: number): NetAct {
  const meal = action.eat && isMeadowDish(action.eat) ? action.eat : null
  const act: NetAct = {
    emote: action.emote,
    emoteAge: age(now, action.emoteAt),
    airAge: action.airborne ? age(now, action.jumpAt) : null,
    landedAge: age(now, action.landedAt),
    eat: meal ? LEGACY_MEAL : action.eat,
    eatAge: age(now, action.eatAt),
  }
  if (meal) act.meal = meal
  return act
}

/** 같은 동작인데 시작 시각이 이보다(초) 적게 다르면 네트워크 지연 차이로 보고 그대로 둔다 */
const SAME_START = 0.3

/** 받은 나이(몇 초 전) → 내 시계의 시각. 상한까지 오래된 값이나 거의 같은 시각이면 이전 값을 그대로 쓴다 */
function startAt(prevAt: number, now: number, ageSec: number, same: boolean): number {
  if (same && ageSec >= NET.actAgeCap) return prevAt
  const at = now - ageSec
  return same && Math.abs(prevAt - at) < SAME_START ? prevAt : at
}

/**
 * 받은 값 → 내 시계(now) 의 동작 상태. 같은 동작이 이어서 오면 이전 시각을 그대로 써서
 * 한 번짜리 동작이 받을 때마다 처음부터 다시 재생되지 않게 한다. 바뀐 게 없으면 prev 를 그대로 돌려준다
 */
export function fromNetAct(act: NetAct, now: number, prev: PlayerAction): PlayerAction {
  const eat = act.meal ?? act.eat
  const airborne = act.airAge !== null
  const emoteAt = startAt(prev.emoteAt, now, act.emoteAge, act.emote === prev.emote)
  const jumpAt = airborne ? startAt(prev.jumpAt, now, act.airAge!, prev.airborne) : prev.jumpAt
  const landedAt = startAt(prev.landedAt, now, act.landedAge, true)
  const eatAt = startAt(prev.eatAt, now, act.eatAge, eat === prev.eat)
  const same = act.emote === prev.emote && emoteAt === prev.emoteAt && airborne === prev.airborne && jumpAt === prev.jumpAt && landedAt === prev.landedAt && eat === prev.eat && eatAt === prev.eatAt
  return same ? prev : { emote: act.emote, emoteAt, airborne, jumpAt, landedAt, eat, eatAt }
}
