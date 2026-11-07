// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_LOOK } from '../data/characterParts'
import type { ClientMsg, NetState, ServerMsg } from '../logic/netProtocol'
import type { ConnStatus, Connector } from '../net/connection'
import { remoteRig, selfBubble } from '../net/remoteRig'
import { useNetStore } from './netStore'
import { useSessionStore } from './sessionStore'

const st: NetState = { p: [1, 1, 1], f: 0, v: 0, rest: false, fish: null, rod: 0.5, rodOn: true, bob: null, act: { emote: null, emoteAge: 30, airAge: null, landedAge: 30, eat: null, eatAge: 30 } }

let sent: ClientMsg[] = []
let helloFn: () => ClientMsg
let push: (m: ServerMsg) => void
let status: (s: ConnStatus) => void
let closed = 0
const fake: Connector = (_url, hello, onMessage, onStatus) => {
  helloFn = hello
  push = onMessage
  status = onStatus
  return { send: (m) => sent.push(m), close: () => closed++ }
}

const join = (mode: 'create' | 'join' = 'create') => useNetStore.getState().join({ mode, room: 'Study', password: 'secret1', nick: '혜린', look: DEFAULT_LOOK })
const notice = () => useSessionStore.getState().notice?.text

beforeEach(() => {
  useNetStore.getState()._setConnector(fake)
  useNetStore.getState().leave()
  useNetStore.setState({ chat: [], error: null })
  sent = []
  closed = 0
})

describe('netStore', () => {
  it('들어가면 hello 를 만들고, welcome 에 online 이 된다', async () => {
    await join()
    expect(useNetStore.getState().phase).toBe('connecting')
    expect(helloFn()).toMatchObject({ type: 'hello', mode: 'create', nick: '혜린', v: 1 })
    expect(JSON.stringify(helloFn())).not.toContain('secret1')
    push({ type: 'welcome', you: 'me', players: [{ id: 'p1', nick: '정빈', look: DEFAULT_LOOK, s: st }] })
    const s = useNetStore.getState()
    expect(s.phase).toBe('online')
    expect(s.room).toBe('study')
    expect(s.peers.p1.nick).toBe('정빈')
    expect(remoteRig.get('p1')?.buf.length).toBe(1)
    expect(s.lastRoom).toBe('study')
  })

  it('한 번 들어간 뒤 다시 연결할 땐 create 가 아니라 join 으로', async () => {
    await join('create')
    push({ type: 'welcome', you: 'me', players: [] })
    status('connecting')
    expect(useNetStore.getState().phase).toBe('reconnecting')
    expect(helloFn()).toMatchObject({ mode: 'join' })
  })

  it('끊기면 다른 사람을 숨기고, 다시 welcome 이 오면 채운다', async () => {
    await join()
    push({ type: 'welcome', you: 'me', players: [{ id: 'p1', nick: '정빈', look: DEFAULT_LOOK, s: st }] })
    status('connecting')
    expect(useNetStore.getState().peers).toEqual({})
    expect(remoteRig.size).toBe(0)
    push({ type: 'welcome', you: 'me2', players: [{ id: 'p1', nick: '정빈', look: DEFAULT_LOOK, s: st }] })
    expect(useNetStore.getState()).toMatchObject({ phase: 'online', you: 'me2' })
    expect(remoteRig.size).toBe(1)
  })

  it('join·leave·state·chat·profile', async () => {
    await join()
    push({ type: 'welcome', you: 'me', players: [] })
    push({ type: 'join', id: 'p2', nick: '민수', look: DEFAULT_LOOK })
    expect(notice()).toBe('민수님이 들어왔어요')
    push({ type: 'state', id: 'p2', s: st })
    expect(remoteRig.get('p2')?.buf.length).toBe(1)
    push({ type: 'state', id: 'ghost', s: st })
    expect(remoteRig.has('ghost')).toBe(false)
    push({ type: 'chat', id: 'p2', text: '안녕' })
    expect(useNetStore.getState().chat.at(-1)).toMatchObject({ from: '민수', text: '안녕', mine: false })
    expect(remoteRig.get('p2')?.bubble?.text).toBe('안녕')
    push({ type: 'profile', id: 'p2', nick: '민수2', look: DEFAULT_LOOK })
    expect(useNetStore.getState().peers.p2.nick).toBe('민수2')
    push({ type: 'leave', id: 'p2' })
    expect(useNetStore.getState().peers.p2).toBeUndefined()
    expect(remoteRig.has('p2')).toBe(false)
    expect(notice()).toBe('민수2님이 나갔어요')
  })

  it('error 를 받으면 off 로 돌아가고 코드를 남긴다', async () => {
    await join('join')
    push({ type: 'error', code: 'bad-password' })
    expect(useNetStore.getState()).toMatchObject({ phase: 'off', error: 'bad-password', room: null })
  })

  it('채팅: 정리해서 보내고 내 줄·말풍선을 남긴다. 1초 안에 또 보내면 거절, 빈 글자도 거절', async () => {
    await join()
    push({ type: 'welcome', you: 'me', players: [] })
    expect(useNetStore.getState().sendChat('  안녕\n ')).toBe(true)
    expect(sent.at(-1)).toEqual({ type: 'chat', text: '안녕' })
    expect(useNetStore.getState().chat.at(-1)).toMatchObject({ text: '안녕', mine: true, from: '혜린' })
    expect(selfBubble.text).toBe('안녕')
    expect(useNetStore.getState().sendChat('또')).toBe(false)
    expect(useNetStore.getState().sendChat('   ')).toBe(false)
  })

  it('연결 전엔 채팅·state 를 보내지 않는다', async () => {
    await join()
    expect(useNetStore.getState().sendChat('안녕')).toBe(false)
    useNetStore.getState().sendState(st)
    expect(sent).toEqual([])
  })

  it('채팅 기록은 30줄까지', async () => {
    await join()
    push({ type: 'welcome', you: 'me', players: [{ id: 'p1', nick: 'a', look: DEFAULT_LOOK, s: null }] })
    for (let i = 0; i < 35; i++) push({ type: 'chat', id: 'p1', text: `${i}` })
    expect(useNetStore.getState().chat).toHaveLength(30)
    expect(useNetStore.getState().chat[0].text).toBe('5')
  })

  it('나가면 연결을 닫고 off', async () => {
    await join()
    useNetStore.getState().leave()
    expect(closed).toBe(1)
    expect(useNetStore.getState().phase).toBe('off')
  })

  it('암호는 저장하지 않는다 (방 이름·닉네임만)', async () => {
    await join()
    const saved = localStorage.getItem('fishing-island-net-v1') ?? ''
    expect(saved).toContain('study')
    expect(saved).not.toContain('secret1')
  })
})
