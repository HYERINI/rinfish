import { NET } from '../../src/game/data/net'
import type { CharacterLook } from '../../src/game/data/types'
import type { ClientMsg, ErrorCode, NetState, ServerMsg } from '../../src/game/logic/netProtocol'
import { allowEvery, allowPerSecond, type RateWindow } from '../../src/game/logic/rateLimit'

/** 방 저장소에 두는 것: 암호 해시와 만든·마지막으로 쓴 시각(ms) */
export type RoomMeta = { passHash: string; createdAt: number; lastActive: number }

/** 방에 들어온 사람 (웹소켓 붙임 정보). 시각은 초 */
export type Member = { id: string; nick: string; look: CharacterLook; joinedAt: number; s: NetState | null; stateWin: RateWindow; lastChat: number; lastProfile: number }

const DAY_MS = 86_400_000

/** 입장 판정. players: 지금 방에 들어와 있는 사람 수 */
export function judgeHello(hello: Extract<ClientMsg, { type: 'hello' }>, meta: RoomMeta | null, players: number, nowMs: number): { ok: true; meta: RoomMeta } | { ok: false; code: ErrorCode } {
  if (hello.v !== NET.protocolVersion) return { ok: false, code: 'version' }
  // 아무도 없는 채 오래된 방은 없는 방으로 본다 (이름을 다시 쓸 수 있게)
  const live = meta && (players > 0 || nowMs - meta.lastActive <= NET.roomExpireDays * DAY_MS) ? meta : null
  if (hello.mode === 'create') {
    if (live) return { ok: false, code: 'room-exists' }
    return { ok: true, meta: { passHash: hello.passHash, createdAt: nowMs, lastActive: nowMs } }
  }
  if (!live) return { ok: false, code: 'no-room' }
  if (live.passHash !== hello.passHash) return { ok: false, code: 'bad-password' }
  if (players >= NET.maxPlayers) return { ok: false, code: 'full' }
  return { ok: true, meta: { ...live, lastActive: nowMs } }
}

/** 들어온 사람의 메시지 하나 처리: 바뀐 사람 정보와 다른 사람들에게 보낼 메시지(없으면 null) */
export function handleMemberMsg(member: Member, msg: ClientMsg, nowSec: number): { member: Member; out: ServerMsg | null } {
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
    case 'hello':
      return { member, out: null }
  }
}
