import { describe, expect, it } from 'vitest'
import { DEFAULT_LOOK } from '../data/characterParts'
import { DISHES } from '../data/dishes'
import { SNACK_IDS } from '../data/snacks'
import { IDLE_ACTION, type PlayerAction } from './playerMotion'
import { fromNetAct, packAnimals, parseClientMsg, parseServerMsg, roundState, stateKey, stateSendDue, toNetAct, unpackAnimals, type NetState } from './netProtocol'

const state = (over: Partial<NetState> = {}): NetState => ({
  p: [1, 2, 3], f: 0.5, v: 1, rest: false, fish: null, rod: 0.5, rodOn: true, bob: null,
  act: { emote: null, emoteAge: 30, airAge: null, landedAge: 30, eat: null, eatAge: 30 },
  ...over,
})
const json = (v: unknown) => JSON.stringify(v)

describe('parseClientMsg', () => {
  it('초원 좌표(최대 400)를 받는다', () => {
    expect(parseClientMsg(json({ type: 'state', s: state({ p: [290, 0, -110] }) }))).toEqual({ type: 'state', s: state({ p: [290, 0, -110] }) })
    expect(parseClientMsg(json({ type: 'state', s: state({ p: [401, 0, 0] }) }))).toBeNull()
  })
  it('배 정보는 있으면 검사하고, 틀리면 그 필드만 버린다', () => {
    const boat = { dir: 'toIsland', t: 0.4 }
    expect(parseClientMsg(json({ type: 'state', s: { ...state(), boat } }))).toEqual({ type: 'state', s: { ...state(), boat } })
    expect(parseClientMsg(json({ type: 'state', s: { ...state(), boat: { dir: 'toMoon', t: 0.4 } } }))).toEqual({ type: 'state', s: state() })
    expect(parseClientMsg(json({ type: 'state', s: { ...state(), boat: { dir: 'toMeadow', t: 2 } } }))).toEqual({ type: 'state', s: state() })
    expect(parseClientMsg(json({ type: 'state', s: state() }))).toEqual({ type: 'state', s: state() })
  })
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

describe('시계·잠 투표 메시지 (3-1)', () => {
  it('sleep {on} 을 읽고, on 이 참/거짓이 아니면 null', () => {
    expect(parseClientMsg(json({ type: 'sleep', on: true }))).toEqual({ type: 'sleep', on: true })
    expect(parseClientMsg(json({ type: 'sleep', on: false }))).toEqual({ type: 'sleep', on: false })
    expect(parseClientMsg(json({ type: 'sleep', on: 'yes' }))).toBeNull()
    expect(parseClientMsg(json({ type: 'sleep' }))).toBeNull()
  })
  it('welcome 의 방 시계: 맞으면 읽고, 틀리거나 없으면(옛 서버) 그 필드만 없다', () => {
    const base = { type: 'welcome', you: 'me', players: [] }
    expect(parseServerMsg(json({ ...base, time: { tm: 12.5, day: 3 } }))).toEqual({ ...base, time: { tm: 12.5, day: 3 } })
    expect(parseServerMsg(json(base))).toEqual(base)
    expect(parseServerMsg(json({ ...base, time: { tm: 480, day: 3 } }))).toEqual(base)
    expect(parseServerMsg(json({ ...base, time: { tm: 5, day: 0 } }))).toEqual(base)
  })
  it('time·sleepers·morning', () => {
    expect(parseServerMsg(json({ type: 'time', tm: 0, day: 1 }))).toEqual({ type: 'time', tm: 0, day: 1 })
    expect(parseServerMsg(json({ type: 'time', tm: -1, day: 1 }))).toBeNull()
    expect(parseServerMsg(json({ type: 'time', tm: 3, day: 2.5 }))).toBeNull()
    expect(parseServerMsg(json({ type: 'sleepers', n: 1, need: 2 }))).toEqual({ type: 'sleepers', n: 1, need: 2 })
    expect(parseServerMsg(json({ type: 'sleepers', n: 0, need: 0 }))).toBeNull()
    expect(parseServerMsg(json({ type: 'sleepers', n: 21, need: 2 }))).toBeNull()
    expect(parseServerMsg(json({ type: 'morning', day: 4 }))).toEqual({ type: 'morning', day: 4 })
    expect(parseServerMsg(json({ type: 'morning', day: 'x' }))).toBeNull()
  })
  it('아직 모르는 종류(3-4 이후 kill 등)는 버린다', () => {
    expect(parseServerMsg(json({ type: 'kill', victim: 'a', killer: 'b' }))).toBeNull()
  })
})

describe('roundState·stateKey', () => {
  it('배 진행도도 둘째 자리로, 배를 타고 내리면 다른 상태', () => {
    const s = state({ boat: { dir: 'toMeadow', t: 0.123456 } })
    expect(roundState(s).boat).toEqual({ dir: 'toMeadow', t: 0.12 })
    expect(stateKey(roundState(s))).not.toBe(stateKey(state()))
    expect('boat' in roundState(state())).toBe(false)
  })
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

describe('은지 요리 먹기 (3-2)', () => {
  const eating = (eat: unknown) => ({ ...state(), act: { ...state().act, eat, eatAge: 1 } })
  it('은지 요리를 먹는 모습을 읽는다', () => {
    expect(parseClientMsg(json({ type: 'state', s: eating('steak') }))).toEqual({ type: 'state', s: eating('steak') })
  })
  it('모르는 음식은 안 먹는 중으로 읽고 모습은 살린다. 글자가 아니면 버린다', () => {
    expect(parseClientMsg(json({ type: 'state', s: eating('pizza') }))).toEqual({ type: 'state', s: eating(null) })
    expect(parseClientMsg(json({ type: 'state', s: eating(3) }))).toBeNull()
  })
})

describe('은지 요리 먹기는 옛 빌드와 맞게 보낸다 (3-2)', () => {
  // 옛 클라이언트·옛 서버의 readAct 는 eat 이 이 목록에 없으면 모습 전체를 버린다
  const LEGACY_FOOD: string[] = [...DISHES.map((d) => d.id), ...SNACK_IDS]
  const steakAt: PlayerAction = { ...IDLE_ACTION, eat: 'steak', eatAt: 99 }
  it('eat 에는 옛 음식, meal 에는 은지 요리를 담는다', () => {
    const act = toNetAct(steakAt, 100)
    expect(LEGACY_FOOD).toContain(act.eat)
    expect(act.meal).toBe('steak')
    const sent = JSON.parse(json({ type: 'state', s: roundState({ ...state(), act }) }))
    expect(LEGACY_FOOD).toContain(sent.s.act.eat)
    expect(sent.s.act.meal).toBe('steak')
  })
  it('새 쪽은 meal 을 먼저 보고 은지 요리를 보여 준다 (서버를 거쳐도 meal 이 남는다)', () => {
    const relayed = parseClientMsg(json({ type: 'state', s: roundState({ ...state(), act: toNetAct(steakAt, 100) }) }))
    expect(relayed?.type).toBe('state')
    const s = (relayed as { s: NetState }).s
    expect(s.act.meal).toBe('steak')
    const back = parseServerMsg(json({ type: 'state', id: 'a', s }))
    expect(fromNetAct((back as { s: NetState }).s.act, 500, IDLE_ACTION).eat).toBe('steak')
  })
  it('틀린 meal 은 그 필드만 버리고 eat 을 쓴다', () => {
    const bad = { ...state(), act: { ...state().act, eat: 'stew', eatAge: 1, meal: 'pizza' } }
    const r = parseClientMsg(json({ type: 'state', s: bad })) as { s: NetState }
    expect(r.s.act).not.toHaveProperty('meal')
    expect(r.s.act.eat).toBe('stew')
    expect(fromNetAct(r.s.act, 500, IDLE_ACTION).eat).toBe('stew')
  })
  it('옛 음식은 meal 없이 그대로 보낸다', () => {
    const act = toNetAct({ ...IDLE_ACTION, eat: 'gimbap', eatAt: 99 }, 100)
    expect(act.eat).toBe('gimbap')
    expect(act).not.toHaveProperty('meal')
  })
  it('은지 요리를 바꾸면 다른 상태', () => {
    const a = { ...state(), act: toNetAct(steakAt, 100) }
    const b = { ...state(), act: toNetAct({ ...steakAt, eat: 'roast' }, 100) }
    expect(stateKey(a)).not.toBe(stateKey(b))
  })
})

describe('손에 든 도구 (3-2)', () => {
  it('tool 은 있으면 검사하고, 틀리거나 모르는 도구면 그 필드만 버린다', () => {
    expect(parseClientMsg(json({ type: 'state', s: { ...state(), tool: 'knife' } }))).toEqual({ type: 'state', s: { ...state(), tool: 'knife' } })
    expect(parseClientMsg(json({ type: 'state', s: { ...state(), tool: 'bazooka' } }))).toEqual({ type: 'state', s: state() })
    expect(parseServerMsg(json({ type: 'state', id: 'a', s: { ...state(), tool: 'fists' } }))).toEqual({ type: 'state', id: 'a', s: { ...state(), tool: 'fists' } })
  })
  it('보낼 때 그대로 두고, 도구를 바꾸면 다른 상태', () => {
    expect(roundState({ ...state(), tool: 'knife' }).tool).toBe('knife')
    expect(roundState(state())).not.toHaveProperty('tool')
    expect(stateKey({ ...state(), tool: 'knife' })).not.toBe(stateKey({ ...state(), tool: 'fists' }))
  })
})

describe('동물·사냥 메시지 (3-3)', () => {
  it('animalHit {id, dmg, w} 를 읽고, 틀리면 null', () => {
    expect(parseClientMsg(json({ type: 'animalHit', id: 4, dmg: 2, w: 'stab' }))).toEqual({ type: 'animalHit', id: 4, dmg: 2, w: 'stab' })
    expect(parseClientMsg(json({ type: 'animalHit', id: 0, dmg: 1, w: 'knife' }))).toBeNull()
    expect(parseClientMsg(json({ type: 'animalHit', id: 4, dmg: 1, w: 'pistol' }))).toBeNull()
    expect(parseClientMsg(json({ type: 'animalHit', id: 4, dmg: 99, w: 'fists' }))).toBeNull()
    expect(parseClientMsg(json({ type: 'animalHit', id: 1.5, dmg: 1, w: 'fists' }))).toBeNull()
  })
  it('animals 는 짧은 배열로 보내고(소수 둘째 자리) 받으면 그리는 값으로 되돌린다', () => {
    const view = { id: 3, sp: 'deer' as const, x: 180.123, z: -40.456, h: -1.234, pose: 'run' as const, hp: 2 }
    const list = packAnimals([view])
    expect(list).toEqual([[3, 2, 180.12, -40.46, -1.23, 3, 2]])
    const msg = parseServerMsg(json({ type: 'animals', list }))
    expect(msg).toEqual({ type: 'animals', list })
    expect(unpackAnimals(list)).toEqual([{ ...view, x: 180.12, z: -40.46, h: -1.23 }])
  })
  it('animals 의 틀린 동물만 빼고, 목록이 아니거나 너무 길면 null', () => {
    const good = [1, 0, 180, -40, 0, 0, 3]
    expect(parseServerMsg(json({ type: 'animals', list: [good, [1, 9, 0, 0, 0, 0, 3], [2, 0, 999, 0, 0, 0, 1], 'x'] }))).toEqual({ type: 'animals', list: [good] })
    expect(parseServerMsg(json({ type: 'animals', list: 'nope' }))).toBeNull()
    expect(parseServerMsg(json({ type: 'animals', list: Array.from({ length: 65 }, () => good) }))).toBeNull()
  })
  it('loot {items, x, z}: 은지 재료만, 하나라도 틀리면 null', () => {
    expect(parseServerMsg(json({ type: 'loot', items: ['beef', 'beef', 'bone'], x: 181, z: -40 }))).toEqual({ type: 'loot', items: ['beef', 'beef', 'bone'], x: 181, z: -40 })
    expect(parseServerMsg(json({ type: 'loot', items: ['steak'], x: 181, z: -40 }))).toBeNull()
    expect(parseServerMsg(json({ type: 'loot', items: ['beef'] }))).toBeNull()
  })
  it('hurt {dmg, by, from?}', () => {
    expect(parseServerMsg(json({ type: 'hurt', dmg: 15, by: 'animal' }))).toEqual({ type: 'hurt', dmg: 15, by: 'animal' })
    expect(parseServerMsg(json({ type: 'hurt', dmg: 15, by: 'animal', from: 'ab12' }))).toEqual({ type: 'hurt', dmg: 15, by: 'animal', from: 'ab12' })
    expect(parseServerMsg(json({ type: 'hurt', dmg: -1, by: 'animal' }))).toBeNull()
    expect(parseServerMsg(json({ type: 'hurt', dmg: 5, by: 'ghost' }))).toBeNull()
  })
})

describe('stateSendDue (3-3 들판 근처는 5Hz 로 계속)', () => {
  const field = state({ p: [186, 1, -39] })
  const town = state({ p: [0, 1, 0] })
  it('바뀌었으면 0.2초(1/sendHz)마다', () => {
    expect(stateSendDue(town, true, 0.19)).toBe(false)
    expect(stateSendDue(town, true, 0.2)).toBe(true)
  })
  it('들판에서 멀면 그대로일 땐 2초마다', () => {
    expect(stateSendDue(town, false, 0.5)).toBe(false)
    expect(stateSendDue(town, false, 2)).toBe(true)
  })
  it('들판 근처면 그대로여도 0.2초마다 (서버가 이 메시지에 맞춰 동물을 움직인다)', () => {
    expect(stateSendDue(field, false, 0.19)).toBe(false)
    expect(stateSendDue(field, false, 0.2)).toBe(true)
  })
})
