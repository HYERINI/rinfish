import { NET } from '../../src/game/data/net'
import type { CharacterLook } from '../../src/game/data/types'
import type { ClientMsg, ErrorCode, NetState, ServerMsg } from '../../src/game/logic/netProtocol'
import { NEW_WINDOW, allowEvery, allowPerSecond, type RateWindow } from '../../src/game/logic/rateLimit'

/** 방 저장소에 두는 것: 암호 해시와 만든·마지막으로 쓴 시각(ms) */
export type RoomMeta = { passHash: string; createdAt: number; lastActive: number }

/** 방에 들어온 사람 (웹소켓 붙임 정보). 시각은 초. sleeping: 잠 투표 중 (침대에 누워 있다) */
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
}

/** 웹소켓 붙임 정보 → 사람. 3-1 전에 붙은 소켓(배포 중 살아 있던 방)엔 잠 필드가 없다: 안 자는 사람·새 창으로 본다 */
export function memberFrom(a: Omit<Member, 'sleeping' | 'sleepWin'> & Partial<Pick<Member, 'sleeping' | 'sleepWin'>>): Member {
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
      return { member, out: null }
  }
}

/** 잠 투표 세기: 방 인원의 절반(올림) 이상이 자면 아침. 아무도 안 자면 아침이 아니다 */
export function tallySleep(sleeping: boolean[]): { n: number; need: number; morning: boolean } {
  const n = sleeping.filter(Boolean).length
  const need = Math.max(1, Math.ceil(sleeping.length / 2))
  return { n, need, morning: n > 0 && n >= need }
}
