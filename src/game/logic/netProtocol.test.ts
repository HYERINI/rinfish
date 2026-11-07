import { describe, expect, it } from 'vitest'
import { DEFAULT_LOOK } from '../data/characterParts'
import { IDLE_ACTION, type PlayerAction } from './playerMotion'
import { fromNetAct, parseClientMsg, parseServerMsg, roundState, stateKey, toNetAct, type NetState } from './netProtocol'

const state = (over: Partial<NetState> = {}): NetState => ({
  p: [1, 2, 3], f: 0.5, v: 1, rest: false, fish: null, rod: 0.5, rodOn: true, bob: null,
  act: { emote: null, emoteAge: 30, airAge: null, landedAge: 30, eat: null, eatAge: 30 },
  ...over,
})
const json = (v: unknown) => JSON.stringify(v)

describe('parseClientMsg', () => {
  it('맞는 hello·state·chat·profile 을 읽는다', () => {
    const hello = { type: 'hello', v: 1, mode: 'join', passHash: 'a'.repeat(64), nick: ' 혜린 ', look: DEFAULT_LOOK }
    expect(parseClientMsg(json(hello))).toEqual({ ...hello, nick: '혜린' })
    expect(parseClientMsg(json({ type: 'state', s: state() }))).toEqual({ type: 'state', s: state() })
    expect(parseClientMsg(json({ type: 'chat', text: ' 안녕\n ' }))).toEqual({ type: 'chat', text: '안녕' })
    expect(parseClientMsg(json({ type: 'profile', nick: '새이름', look: DEFAULT_LOOK }))).toEqual({ type: 'profile', nick: '새이름', look: DEFAULT_LOOK })
  })

  it('깨진 JSON·모르는 종류·범위 밖 값은 null', () => {
    expect(parseClientMsg('{oops')).toBeNull()
    expect(parseClientMsg(json({ type: 'nuke' }))).toBeNull()
    expect(parseClientMsg(json({ type: 'chat', text: '' }))).toBeNull()
    expect(parseClientMsg(json({ type: 'chat', text: '가'.repeat(61) }))).toBeNull()
    expect(parseClientMsg(json({ type: 'state', s: state({ p: [999, 0, 0] }) }))).toBeNull()
    expect(parseClientMsg(json({ type: 'state', s: { ...state(), p: [null, 0, 0] } }))).toBeNull()
    expect(parseClientMsg(json({ type: 'state', s: state({ fish: { pose: 'moonwalk', lean: 0 } as never }) }))).toBeNull()
    expect(parseClientMsg(json({ type: 'state', s: { ...state(), act: { ...state().act, emote: 'hack' } } }))).toBeNull()
    expect(parseClientMsg(json({ type: 'state', s: { ...state(), rest: 'yes' } }))).toBeNull()
    expect(parseClientMsg(json({ type: 'hello', v: 1, mode: 'steal', passHash: 'a'.repeat(64), nick: 'a', look: DEFAULT_LOOK }))).toBeNull()
    expect(parseClientMsg(json({ type: 'hello', v: 1, mode: 'join', passHash: 'short', nick: 'a', look: DEFAULT_LOOK }))).toBeNull()
    expect(parseClientMsg(json({ type: 'profile', nick: '', look: DEFAULT_LOOK }))).toBeNull()
    expect(parseClientMsg(json({ type: 'profile', nick: 'a', look: 'x' }))).toBeNull()
    expect(parseClientMsg(json(null))).toBeNull()
  })
})

describe('parseServerMsg', () => {
  it('welcome 의 사람 목록에서 틀린 사람만 빼고 읽는다', () => {
    const good = { id: 'a1', nick: '혜린', look: DEFAULT_LOOK, s: null }
    const msg = parseServerMsg(json({ type: 'welcome', you: 'me', players: [good, { id: 3 }] }))
    expect(msg).toEqual({ type: 'welcome', you: 'me', players: [good] })
  })
  it('error 코드는 목록에 있는 것만', () => {
    expect(parseServerMsg(json({ type: 'error', code: 'bad-password' }))).toEqual({ type: 'error', code: 'bad-password' })
    expect(parseServerMsg(json({ type: 'error', code: 'whatever' }))).toBeNull()
  })
  it('state·chat·join·leave', () => {
    expect(parseServerMsg(json({ type: 'state', id: 'a', s: state() }))).toEqual({ type: 'state', id: 'a', s: state() })
    expect(parseServerMsg(json({ type: 'chat', id: 'a', text: 'hi' }))).toEqual({ type: 'chat', id: 'a', text: 'hi' })
    expect(parseServerMsg(json({ type: 'leave', id: 'a' }))).toEqual({ type: 'leave', id: 'a' })
    expect(parseServerMsg(json({ type: 'join', id: 'a', nick: 'n', look: DEFAULT_LOOK }))).toEqual({ type: 'join', id: 'a', nick: 'n', look: DEFAULT_LOOK })
  })
})

describe('roundState·stateKey', () => {
  it('숫자를 소수 둘째 자리로', () => {
    const r = roundState(state({ p: [1.23456, 0.001, -3.999], f: 1.005, bob: [1.111, 2.222, 3.333] }))
    expect(r.p).toEqual([1.23, 0, -4])
    expect(Object.is(r.p[1], -0)).toBe(false)
    expect(r.bob).toEqual([1.11, 2.22, 3.33])
  })
  it('나이(몇 초 전)만 바뀐 건 같은 상태로 본다', () => {
    const a = state()
    const b = state({ act: { ...a.act, emoteAge: 12, landedAge: 3 } })
    expect(stateKey(a)).toBe(stateKey(b))
    expect(stateKey(state({ p: [1, 2, 3.5] }))).not.toBe(stateKey(a))
  })
})

describe('toNetAct·fromNetAct', () => {
  const now = 100
  const rolling: PlayerAction = { ...IDLE_ACTION, emote: 'roll', emoteAt: 99.5 }

  it('시각을 "몇 초 전" 으로 보내고, 오래된 건 상한으로 자른다', () => {
    const act = toNetAct(rolling, now)
    expect(act.emote).toBe('roll')
    expect(act.emoteAge).toBeCloseTo(0.5)
    expect(act.landedAge).toBe(30)
    expect(act.airAge).toBeNull()
  })

  it('받은 쪽 시계로 바꾼다', () => {
    const local = fromNetAct(toNetAct(rolling, now), 500, IDLE_ACTION)
    expect(local.emote).toBe('roll')
    expect(local.emoteAt).toBeCloseTo(499.5)
  })

  it('같은 감정 표현이 계속 오면 시작 시각을 그대로 둔다 (한 번짜리 동작이 처음부터 다시 재생되지 않게)', () => {
    const first = fromNetAct({ ...toNetAct(rolling, now), emoteAge: 0.5 }, 500, IDLE_ACTION)
    // 0.2초 뒤 같은 동작이 조금 다른 나이로 도착 (네트워크 지연이 들쭉날쭉)
    const again = fromNetAct({ ...toNetAct(rolling, now), emoteAge: 0.62 }, 500.2, first)
    expect(again.emoteAt).toBe(first.emoteAt)
    expect(again).toBe(first)
  })

  it('한참 뒤에도 오래된(상한) 나이가 계속 오면 바뀐 게 없다', () => {
    const first = fromNetAct(toNetAct(IDLE_ACTION, now), 500, IDLE_ACTION)
    expect(fromNetAct(toNetAct(IDLE_ACTION, now), 520, first)).toBe(first)
  })

  it('같은 감정 표현을 새로 시작했으면 시각을 바꾼다', () => {
    const first = fromNetAct({ ...toNetAct(rolling, now), emoteAge: 0.5 }, 500, IDLE_ACTION)
    const restarted = fromNetAct({ ...toNetAct(rolling, now), emoteAge: 0.1 }, 503, first)
    expect(restarted.emoteAt).toBeCloseTo(502.9)
  })

  it('점프 중이면 airAge 가 있고 받은 쪽에서 airborne', () => {
    const jumping: PlayerAction = { ...IDLE_ACTION, airborne: true, jumpAt: 99.8 }
    const act = toNetAct(jumping, now)
    expect(act.airAge).toBeCloseTo(0.2)
    expect(fromNetAct(act, 10, IDLE_ACTION)).toMatchObject({ airborne: true })
  })
})
