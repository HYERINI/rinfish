import { describe, expect, it } from 'vitest'
import { DEFAULT_LOOK } from '../../src/game/data/characterParts'
import type { ClientMsg, NetState } from '../../src/game/logic/netProtocol'
import { NEW_WINDOW } from '../../src/game/logic/rateLimit'
import { handleMemberMsg, judgeHello, type Member, type RoomMeta } from './roomRules'

const hello = (mode: 'create' | 'join', passHash = 'a'.repeat(64)): Extract<ClientMsg, { type: 'hello' }> => ({ type: 'hello', v: 1, mode, passHash, nick: '혜린', look: DEFAULT_LOOK })
const DAY = 86_400_000
const meta: RoomMeta = { passHash: 'a'.repeat(64), createdAt: 0, lastActive: 10 * DAY }

describe('judgeHello', () => {
  it('없는 방은 만들 수 있고 들어갈 수 없다', () => {
    expect(judgeHello(hello('create'), null, 0, 5)).toEqual({ ok: true, meta: { passHash: 'a'.repeat(64), createdAt: 5, lastActive: 5 } })
    expect(judgeHello(hello('join'), null, 0, 5)).toEqual({ ok: false, code: 'no-room' })
  })
  it('있는 방: 만들기는 room-exists, 암호가 다르면 bad-password, 맞으면 들어간다', () => {
    const now = 10 * DAY + 1
    expect(judgeHello(hello('create'), meta, 1, now)).toEqual({ ok: false, code: 'room-exists' })
    expect(judgeHello(hello('join', 'b'.repeat(64)), meta, 1, now)).toEqual({ ok: false, code: 'bad-password' })
    expect(judgeHello(hello('join'), meta, 1, now)).toEqual({ ok: true, meta: { ...meta, lastActive: now } })
  })
  it('20명이면 full', () => {
    expect(judgeHello(hello('join'), meta, 20, 10 * DAY)).toEqual({ ok: false, code: 'full' })
  })
  it('7일 넘게 빈 방은 없는 방처럼 (새로 만들 수 있다). 누가 있으면 오래돼도 그대로', () => {
    const later = meta.lastActive + 8 * DAY
    expect(judgeHello(hello('create', 'c'.repeat(64)), meta, 0, later)).toEqual({ ok: true, meta: { passHash: 'c'.repeat(64), createdAt: later, lastActive: later } })
    expect(judgeHello(hello('join'), meta, 0, later)).toEqual({ ok: false, code: 'no-room' })
    expect(judgeHello(hello('create'), meta, 1, later)).toEqual({ ok: false, code: 'room-exists' })
  })
  it('버전이 다르면 version', () => {
    expect(judgeHello({ ...hello('join'), v: 99 }, meta, 0, 0)).toEqual({ ok: false, code: 'version' })
  })
})

describe('handleMemberMsg', () => {
  const s: NetState = { p: [0, 1, 0], f: 0, v: 0, rest: false, fish: null, rod: 0.5, rodOn: true, bob: null, act: { emote: null, emoteAge: 30, airAge: null, landedAge: 30, eat: null, eatAge: 30 } }
  const me: Member = { id: 'm1', nick: '혜린', look: DEFAULT_LOOK, joinedAt: 0, s: null, stateWin: NEW_WINDOW, lastChat: -Infinity, lastProfile: -Infinity }

  it('state 는 저장하고 내 id 를 붙여 나눠 준다. 초당 10번 넘으면 버린다', () => {
    let m = me
    for (let i = 0; i < 10; i++) {
      const r = handleMemberMsg(m, { type: 'state', s }, 1 + i * 0.05)
      expect(r.out).toEqual({ type: 'state', id: 'm1', s })
      m = r.member
    }
    expect(m.s).toEqual(s)
    expect(handleMemberMsg(m, { type: 'state', s }, 1.6).out).toBeNull()
  })
  it('chat 은 1초에 한 번', () => {
    const r = handleMemberMsg(me, { type: 'chat', text: '안녕' }, 3)
    expect(r.out).toEqual({ type: 'chat', id: 'm1', text: '안녕' })
    expect(handleMemberMsg(r.member, { type: 'chat', text: '또' }, 3.5).out).toBeNull()
    expect(handleMemberMsg(r.member, { type: 'chat', text: '또' }, 4).out).not.toBeNull()
  })
  it('profile 은 5초에 한 번, 바꾼 이름·옷을 저장한다', () => {
    const r = handleMemberMsg(me, { type: 'profile', nick: '새이름', look: DEFAULT_LOOK }, 10)
    expect(r.member.nick).toBe('새이름')
    expect(r.out).toEqual({ type: 'profile', id: 'm1', nick: '새이름', look: DEFAULT_LOOK })
    expect(handleMemberMsg(r.member, { type: 'profile', nick: '또', look: DEFAULT_LOOK }, 12).out).toBeNull()
  })
  it('들어온 뒤 hello 는 무시', () => {
    expect(handleMemberMsg(me, hello('join'), 1)).toEqual({ member: me, out: null })
  })
})
