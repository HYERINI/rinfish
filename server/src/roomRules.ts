import { hitRadius } from '../../src/game/data/animals'
import { MELEE, hitDelay, meleeFor, type MeleeId } from '../../src/game/data/melee'
import { NET } from '../../src/game/data/net'
import type { CharacterLook } from '../../src/game/data/types'
import type { AnimalView } from '../../src/game/logic/animalSim'
import type { RoomClock } from '../../src/game/logic/dayClock'
import type { ClientMsg, ErrorCode, NetState, ServerMsg } from '../../src/game/logic/netProtocol'
import { NEW_WINDOW, allowEvery, allowPerSecond, type RateWindow } from '../../src/game/logic/rateLimit'

/** 방 저장소에 두는 것: 암호 해시와 만든·마지막으로 쓴 시각(ms) */
export type RoomMeta = { passHash: string; createdAt: number; lastActive: number }

/**
 * 방에 들어온 사람 (웹소켓 붙임 정보). 시각은 초. sleeping: 잠 투표 중 (침대에 누워 있다).
 * lastHit·lastW: 마지막으로 받은 동물 명중과 그 공격 종류, hitWin: animalHit 메시지 1초 창 (버린 것도 센다)
 */
export type Member = {
  id: string
  nick: string
  look: CharacterLook
  joinedAt: number
  s: NetState | null
  stateWin: RateWindow
  lastChat: number
  lastProfile: number
  sleeping: boolean
  sleepWin: RateWindow
  lastHit: number
  lastW: MeleeId | null
  hitWin: RateWindow
}

/**
 * 웹소켓 붙임 정보 → 사람. 3-1 전에 붙은 소켓(배포 중 살아 있던 방)엔 잠 필드가 없다: 안 자는 사람·새 창으로 본다.
 * 3-3 전 소켓엔 lastHit 이 없다: 한 번도 안 때린 사람. lastW·hitWin 이 없으면 모르는 종류·새 창
 */
type Optional = 'sleeping' | 'sleepWin' | 'lastHit' | 'lastW' | 'hitWin'
export function memberFrom(a: Omit<Member, Optional> & Partial<Pick<Member, Optional>>): Member {
  return {
    id: a.id,
    nick: a.nick,
    look: a.look,
    joinedAt: a.joinedAt,
    s: a.s,
    stateWin: a.stateWin,
    lastChat: a.lastChat,
    lastProfile: a.lastProfile,
    sleeping: a.sleeping === true,
    sleepWin: a.sleepWin ?? NEW_WINDOW,
    lastHit: a.lastHit ?? -Infinity,
    lastW: a.lastW ?? null,
    hitWin: a.hitWin ?? NEW_WINDOW,
  }
}

const DAY_MS = 86_400_000

/** 입장 판정. players: 지금 방에 들어와 있는 사람 수. fresh: 방을 새로 만들었다 (옛 방 시계를 버린다) */
export function judgeHello(hello: Extract<ClientMsg, { type: 'hello' }>, meta: RoomMeta | null, players: number, nowMs: number): { ok: true; meta: RoomMeta; fresh?: true } | { ok: false; code: ErrorCode } {
  if (hello.v !== NET.protocolVersion) return { ok: false, code: 'version' }
  // 아무도 없는 채 오래된 방은 없는 방으로 본다 (이름을 다시 쓸 수 있게)
  const live = meta && (players > 0 || nowMs - meta.lastActive <= NET.roomExpireDays * DAY_MS) ? meta : null
  if (hello.mode === 'create') {
    if (live) return { ok: false, code: 'room-exists' }
    return { ok: true, fresh: true, meta: { passHash: hello.passHash, createdAt: nowMs, lastActive: nowMs } }
  }
  if (!live) return { ok: false, code: 'no-room' }
  if (live.passHash !== hello.passHash) return { ok: false, code: 'bad-password' }
  if (players >= NET.maxPlayers) return { ok: false, code: 'full' }
  return { ok: true, meta: { ...live, lastActive: nowMs } }
}

/**
 * 들어온 사람의 메시지 하나 처리: 바뀐 사람 정보와 다른 사람들에게 보낼 메시지(없으면 null).
 * quiet: 너무 잦은 sleep 이라 표시만 바꾸고 세지 않는다 (room.ts 가 다음 alarm 에 센다)
 */
export function handleMemberMsg(member: Member, msg: ClientMsg, nowSec: number): { member: Member; out: ServerMsg | null; quiet?: true } {
  switch (msg.type) {
    case 'state': {
      const r = allowPerSecond(member.stateWin, nowSec, NET.serverStatePerSecond)
      if (!r.ok) return { member, out: null }
      return { member: { ...member, s: msg.s, stateWin: r.w }, out: { type: 'state', id: member.id, s: msg.s } }
    }
    case 'chat':
      if (!allowEvery(member.lastChat, nowSec, NET.serverChatEvery)) return { member, out: null }
      return { member: { ...member, lastChat: nowSec }, out: { type: 'chat', id: member.id, text: msg.text } }
    case 'profile':
      if (!allowEvery(member.lastProfile, nowSec, NET.serverProfileEvery)) return { member, out: null }
      return { member: { ...member, nick: msg.nick, look: msg.look, lastProfile: nowSec }, out: { type: 'profile', id: member.id, nick: msg.nick, look: msg.look } }
    case 'sleep': {
      // 자는 사람 수는 방 전체를 봐야 해서 room.ts 가 센다 (tallySleep). 여기서는 표시만 바꾼다.
      // 너무 잦아도 마지막 표시는 남긴다 (버리면 서버와 클라이언트의 잠 표시가 어긋난다)
      const r = allowPerSecond(member.sleepWin, nowSec, NET.serverSleepPerSecond)
      if (!r.ok) return { member: { ...member, sleeping: msg.on }, out: null, quiet: true }
      return { member: { ...member, sleeping: msg.on, sleepWin: r.w }, out: null }
    }
    case 'hello':
    case 'animalHit':
      // 동물 명중은 방의 동물을 봐야 해서 room.ts 가 judgeAnimalHit 로 본다
      return { member, out: null }
  }
}

/**
 * 앞 명중(prev)에서 다음 명중(next)까지 받는 최소 간격(초). 화면에선 앞 공격 간격(cool)이 지나야 다시 휘두르고
 * 맞는 순간은 공격마다 달라서, 종류를 바꾸면 cool(prev) + 맞는 순간(next) − 맞는 순간(prev) 이 된다 (여유 NET.hitTimingSlack 을 뺀다).
 * 같은 종류 최소 간격(serverCool, 스펙 주먹 0.3·칼 0.4·찌르기 0.7초)보다 길게 잡지는 않는다
 */
export function minHitGap(prev: MeleeId, next: MeleeId): number {
  return Math.min(MELEE[next].serverCool, MELEE[prev].cool + hitDelay(next) - hitDelay(prev) - NET.hitTimingSlack)
}

/**
 * 동물 명중 검사 (같이 하기). 받아들이면 피해(공격 종류 표의 값, 보낸 dmg 는 믿지 않는다)와 마지막 명중 시각·종류를 고친 사람.
 * 버리는 것: 초당 NET.serverHitPerSecond 번 넘게 온 것(버린 것도 센다), 모습을 아직 안 보낸 사람, 든 도구로 할 수 없는 공격,
 * 없거나 쓰러진 동물, 앞 명중에서 minHitGap 안에 또 온 것, 내 마지막 모습에서 사거리 + 판정 원 + 여유(NET.hitSlack) 보다 먼 동물.
 * 버려도 member 를 돌려준다 (1초 창을 남긴다)
 */
export function judgeAnimalHit(member: Member, msg: Extract<ClientMsg, { type: 'animalHit' }>, animal: AnimalView | undefined, nowSec: number): { ok: true; dmg: number; member: Member } | { ok: false; member: Member } {
  const rate = allowPerSecond(member.hitWin, nowSec, NET.serverHitPerSecond)
  if (!rate.ok) return { ok: false, member }
  const counted: Member = { ...member, hitWin: rate.w }
  const no = { ok: false as const, member: counted }
  const m = MELEE[msg.w]
  if (!member.s || !animal || animal.pose === 'dead') return no
  if (member.s.tool && meleeFor(member.s.tool, msg.w === 'stab') !== msg.w) return no
  if (nowSec - member.lastHit < minHitGap(member.lastW ?? msg.w, msg.w)) return no
  const d = Math.hypot(member.s.p[0] - animal.x, member.s.p[2] - animal.z)
  if (d > m.reach + hitRadius(animal.sp) + NET.hitSlack) return no
  return { ok: true, dmg: m.dmg, member: { ...counted, lastHit: nowSec, lastW: msg.w } }
}

/** 동물을 움직이는 최소 간격(초): 사람 메시지(5Hz)가 올 때 움직이되, 0.2초에 조금 못 미쳐 와도 건너뛰지 않게 0.75 × NET.animalEvery */
export const HERD_STEP_MIN = 0.75 * NET.animalEvery

/**
 * 지난번 움직인 때(lastMs, 무리가 없으면 null)부터 지금 움직일지: 움직일 초(최대 1초) 또는 아직이면 null.
 * 무리가 없으면 0 (새로 만들어 바로 보낸다). 서버 시계가 뒤로 가면 0 (지금부터 다시 잰다).
 * force: 최소 간격을 보지 않는다 (명중 판정 전·새로 온 사람)
 */
export function herdStepDt(lastMs: number | null, nowMs: number, force = false): number | null {
  if (lastMs === null) return 0
  const since = (nowMs - lastMs) / 1000
  if (since < 0) return 0
  if (!force && since < HERD_STEP_MIN - 1e-9) return null
  return Math.min(1, since)
}

/** 잠 투표 세기: 방 인원의 절반(올림) 이상이 자면 아침. 아무도 안 자면 아침이 아니다 */
export function tallySleep(sleeping: boolean[]): { n: number; need: number; morning: boolean } {
  const n = sleeping.filter(Boolean).length
  const need = Math.max(1, Math.ceil(sleeping.length / 2))
  return { n, need, morning: n > 0 && n >= need }
}

/**
 * 방금 잠 투표로 아침이 왔나 (기준점에서 NET.morningGuard 초 안). 이때 닿은 "눕기"는 버린다:
 * 둘이 거의 같이 누우면 한 사람으로 아침이 오고, 늦게 닿은 다른 사람의 눕기가 다음 아침을 또 부른다.
 * 새로 만든 방(1일차 기준점)은 아침이 아니다
 */
export function justAfterMorning(clock: RoomClock, nowMs: number): boolean {
  const since = nowMs - clock.epoch
  return clock.day0 > 1 && since >= 0 && since < NET.morningGuard * 1000
}

/** 아침 직후(justAfterMorning)면 그 끝(ms). 그동안 닿은 눕기는 표시만 남기고 이때 센다. 아니면 null */
export function sleepGuardEnd(clock: RoomClock, nowMs: number): number | null {
  return justAfterMorning(clock, nowMs) ? clock.epoch + NET.morningGuard * 1000 : null
}
