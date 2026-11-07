import { DISHES } from '../data/dishes'
import { EMOTES, type EmoteId } from '../data/emotes'
import { NET } from '../data/net'
import { SNACK_IDS } from '../data/snacks'
import type { CharacterLook, FoodId } from '../data/types'
import { FISHING_POSES, type FishingLook, type FishingPose } from './characterPose'
import { normalizeLook } from './characterLook'
import type { PlayerAction } from './playerMotion'
import { cleanText, textLength } from './roomKey'

/**
 * 같이 하기 메시지 (JSON 텍스트). 서버와 클라이언트가 같은 함수로 만들고 검사한다.
 * 받은 값은 믿지 않는다: 모양·범위·이름 목록을 확인하고 틀리면 null (그 메시지만 버린다)
 */

export type Vec3 = [number, number, number]
/** 동작 상태. 기기마다 시계가 달라 시각 대신 "몇 초 전" 으로 보낸다 */
export type NetAct = { emote: EmoteId | null; emoteAge: number; airAge: number | null; landedAge: number; eat: FoodId | null; eatAge: number }
/** 내 모습 한 장면. p: 몸 가운데(캡슐 가운데) 위치, f: 바라보는 각도, v: 수평 속도 */
export type NetState = { p: Vec3; f: number; v: number; rest: boolean; fish: FishingLook | null; rod: number; rodOn: boolean; bob: Vec3 | null; act: NetAct }
export type JoinMode = 'create' | 'join'
export type ErrorCode = 'bad-hello' | 'room-exists' | 'no-room' | 'bad-password' | 'full' | 'version'
export const ERROR_CODES: ErrorCode[] = ['bad-hello', 'room-exists', 'no-room', 'bad-password', 'full', 'version']
export type PeerInfo = { id: string; nick: string; look: CharacterLook; s: NetState | null }

export type ClientMsg =
  | { type: 'hello'; v: number; mode: JoinMode; passHash: string; nick: string; look: CharacterLook }
  | { type: 'state'; s: NetState }
  | { type: 'chat'; text: string }
  | { type: 'profile'; nick: string; look: CharacterLook }

export type ServerMsg =
  | { type: 'welcome'; you: string; players: PeerInfo[] }
  | { type: 'error'; code: ErrorCode }
  | { type: 'join'; id: string; nick: string; look: CharacterLook }
  | { type: 'leave'; id: string }
  | { type: 'profile'; id: string; nick: string; look: CharacterLook }
  | { type: 'state'; id: string; s: NetState }
  | { type: 'chat'; id: string; text: string }

const EMOTE_IDS = EMOTES.map((e) => e.id)
const FOOD_IDS: FoodId[] = [...DISHES.map((d) => d.id), ...SNACK_IDS]

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const num = (v: unknown, lo: number, hi: number): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : null)
const oneOf = <T extends string>(v: unknown, list: readonly T[]): T | null => (typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : null)
const id = (v: unknown): string | null => (typeof v === 'string' && v.length >= 1 && v.length <= 40 ? v : null)

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
  const eat = v.eat === null ? null : oneOf(v.eat, FOOD_IDS)
  const emoteAge = num(v.emoteAge, 0, cap)
  const airAge = v.airAge === null ? null : num(v.airAge, 0, cap)
  const landedAge = num(v.landedAge, 0, cap)
  const eatAge = num(v.eatAge, 0, cap)
  if ((v.emote !== null && emote === null) || (v.eat !== null && eat === null)) return null
  if (emoteAge === null || landedAge === null || eatAge === null || (v.airAge !== null && airAge === null)) return null
  return { emote, emoteAge, airAge, landedAge, eat, eatAge }
}

/** 낚시 정보. 틀리면 undefined (null 은 "낚시 중 아님" 이라는 맞는 값) */
function readFish(v: unknown): FishingLook | null | undefined {
  if (v === null) return null
  if (!isRecord(v)) return undefined
  const pose = oneOf<FishingPose>(v.pose, FISHING_POSES)
  const lean = num(v.lean, 0, 1)
  return pose === null || lean === null ? undefined : { pose, lean }
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
  return { p, f, v: speed, rest: v.rest, fish, rod, rodOn: v.rodOn, bob, act }
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
    default:
      return null
  }
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
      return { type: 'welcome', you, players: m.players.map(readPeer).filter((p): p is PeerInfo => p !== null) }
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
    default:
      return null
  }
}

/** 소수 둘째 자리로 (+ 0: -0 을 0 으로) */
const r2 = (n: number) => Math.round(n * 100) / 100 + 0
const r3 = (v: Vec3): Vec3 => [r2(v[0]), r2(v[1]), r2(v[2])]

/** 보내기 전 숫자를 소수 둘째 자리로 (메시지 크기를 줄인다) */
export function roundState(s: NetState): NetState {
  const a = s.act
  return {
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
}

/** "바뀐 게 있나" 비교용 열쇠. 저절로 늘어나는 나이(몇 초 전)는 빼고 무엇을 하는지만 넣는다 */
export function stateKey(s: NetState): string {
  return JSON.stringify([s.p, s.f, s.v, s.rest, s.fish, s.rod, s.rodOn, s.bob, s.act.emote, s.act.eat, s.act.airAge !== null])
}

const age = (now: number, at: number) => Math.min(NET.actAgeCap, Math.max(0, now - at))

/** 내 동작 상태 → 보낼 값 (now: 동작 시각과 같은 시계) */
export function toNetAct(action: PlayerAction, now: number): NetAct {
  return {
    emote: action.emote,
    emoteAge: age(now, action.emoteAt),
    airAge: action.airborne ? age(now, action.jumpAt) : null,
    landedAge: age(now, action.landedAt),
    eat: action.eat,
    eatAge: age(now, action.eatAt),
  }
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
  const airborne = act.airAge !== null
  const emoteAt = startAt(prev.emoteAt, now, act.emoteAge, act.emote === prev.emote)
  const jumpAt = airborne ? startAt(prev.jumpAt, now, act.airAge!, prev.airborne) : prev.jumpAt
  const landedAt = startAt(prev.landedAt, now, act.landedAge, true)
  const eatAt = startAt(prev.eatAt, now, act.eatAge, act.eat === prev.eat)
  const same = act.emote === prev.emote && emoteAt === prev.emoteAt && airborne === prev.airborne && jumpAt === prev.jumpAt && landedAt === prev.landedAt && act.eat === prev.eat && eatAt === prev.eatAt
  return same ? prev : { emote: act.emote, emoteAt, airborne, jumpAt, landedAt, eat: act.eat, eatAt }
}
