import { describe, expect, it } from 'vitest'
import { DEFAULT_LOOK } from '../../src/game/data/characterParts'
import type { ClientMsg, NetState } from '../../src/game/logic/netProtocol'
import { NEW_WINDOW } from '../../src/game/logic/rateLimit'
import type { AnimalView } from '../../src/game/logic/animalSim'
import { HERD_STEP_MIN, handleMemberMsg, herdStepDt, hitGap, judgeAnimalHit, judgeDied, judgeHello, judgePvpHit, justAfterMorning, memberFrom, minHitGap, nextHitAt, pvpGap, screenAnimalHit, sleepGuardEnd, tallySleep, type Member, type RoomMeta } from './roomRules'

const hello = (mode: 'create' | 'join', passHash = 'a'.repeat(64)): Extract<ClientMsg, { type: 'hello' }> => ({ type: 'hello', v: 1, mode, passHash, nick: '혜린', look: DEFAULT_LOOK })
const DAY = 86_400_000
const meta: RoomMeta = { passHash: 'a'.repeat(64), createdAt: 0, lastActive: 10 * DAY }

describe('judgeHello', () => {
  it('없는 방은 만들 수 있고 들어갈 수 없다', () => {
    expect(judgeHello(hello('create'), null, 0, 5)).toEqual({ ok: true, fresh: true, meta: { passHash: 'a'.repeat(64), createdAt: 5, lastActive: 5 } })
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
    // fresh: 옛 방 시계를 버리고 새로 시작한다 (room.ts)
    expect(judgeHello(hello('create', 'c'.repeat(64)), meta, 0, later)).toEqual({ ok: true, fresh: true, meta: { passHash: 'c'.repeat(64), createdAt: later, lastActive: later } })
    expect(judgeHello(hello('join'), meta, 0, later)).toEqual({ ok: false, code: 'no-room' })
    expect(judgeHello(hello('create'), meta, 1, later)).toEqual({ ok: false, code: 'room-exists' })
  })
  it('버전이 다르면 version', () => {
    expect(judgeHello({ ...hello('join'), v: 99 }, meta, 0, 0)).toEqual({ ok: false, code: 'version' })
  })
})

describe('handleMemberMsg', () => {
  const s: NetState = { p: [0, 1, 0], f: 0, v: 0, rest: false, fish: null, rod: 0.5, rodOn: true, bob: null, act: { emote: null, emoteAge: 30, airAge: null, landedAge: 30, eat: null, eatAge: 30 } }
  const me: Member = memberFrom({ id: 'm1', nick: '혜린', look: DEFAULT_LOOK, joinedAt: 0, s: null, stateWin: NEW_WINDOW, lastChat: -Infinity, lastProfile: -Infinity })

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
  it('sleep 은 잠 표시만 바꾸고 바로 나눠 주지 않는다 (room.ts 가 세서 sleepers 로)', () => {
    const on = handleMemberMsg(me, { type: 'sleep', on: true }, 1)
    expect(on).toEqual({ member: { ...me, sleeping: true, sleepWin: { start: 1, count: 1 } }, out: null })
  })
  it('sleep 이 초당 4번을 넘으면 세지 않지만(quiet) 마지막 표시는 남긴다', () => {
    let m = handleMemberMsg(me, { type: 'sleep', on: true }, 1).member
    for (let i = 0; i < 3; i++) m = handleMemberMsg(m, { type: 'sleep', on: i % 2 === 0 ? false : true }, 1.1).member
    expect(m.sleeping).toBe(false)
    const limited = handleMemberMsg(m, { type: 'sleep', on: true }, 1.2)
    expect(limited).toEqual({ member: { ...m, sleeping: true }, out: null, quiet: true })
    const again = handleMemberMsg(limited.member, { type: 'sleep', on: false }, 1.3)
    expect(again.member.sleeping).toBe(false)
    expect(again.quiet).toBe(true)
    const next = handleMemberMsg(again.member, { type: 'sleep', on: true }, 2.1)
    expect(next.member.sleeping).toBe(true)
    expect(next.quiet).toBeUndefined()
  })
})

describe('memberFrom', () => {
  it('3-3 전 붙임 정보(lastHit 없음)는 한 번도 안 때린 사람', () => {
    const old = { id: 'o1', nick: '옛', look: DEFAULT_LOOK, joinedAt: 1, s: null, stateWin: NEW_WINDOW, lastChat: 2, lastProfile: 3, sleeping: true, sleepWin: NEW_WINDOW }
    expect(memberFrom(old).lastHit).toBe(-Infinity)
    expect(memberFrom({ ...old, lastHit: 7 }).lastHit).toBe(7)
  })
  it('마지막 공격 종류(lastW)·명중 창(hitWin)이 없으면 null·새 창', () => {
    const old = { id: 'o1', nick: '옛', look: DEFAULT_LOOK, joinedAt: 1, s: null, stateWin: NEW_WINDOW, lastChat: 2, lastProfile: 3, lastHit: 7 }
    expect(memberFrom(old)).toMatchObject({ lastW: null, hitWin: NEW_WINDOW })
    expect(memberFrom({ ...old, lastW: 'stab', hitWin: { start: 1, count: 2 } })).toMatchObject({ lastW: 'stab', hitWin: { start: 1, count: 2 } })
  })
  it('3-1 전 붙임 정보(잠 필드 없음)는 안 자는 사람·새 창으로 읽고, phase 같은 다른 필드는 버린다', () => {
    const old = { phase: 'in', id: 'o1', nick: '옛', look: DEFAULT_LOOK, joinedAt: 1, s: null, stateWin: NEW_WINDOW, lastChat: 2, lastProfile: 3 }
    expect(memberFrom(old)).toEqual({ id: 'o1', nick: '옛', look: DEFAULT_LOOK, joinedAt: 1, s: null, stateWin: NEW_WINDOW, lastChat: 2, lastProfile: 3, sleeping: false, sleepWin: NEW_WINDOW, lastHit: -Infinity, lastW: null, hitWin: NEW_WINDOW, hitShot: null, pvpLast: null, pvpWin: NEW_WINDOW, pvpShot: null, pvpBy: null, lastShot: -Infinity, lastDied: -Infinity })
    expect(memberFrom({ ...old, sleeping: true, sleepWin: { start: 5, count: 2 } })).toMatchObject({ sleeping: true, sleepWin: { start: 5, count: 2 } })
  })
})

describe('tallySleep', () => {
  it('방 인원의 절반(올림) 이상이 자면 아침', () => {
    expect(tallySleep([true])).toEqual({ n: 1, need: 1, morning: true })
    expect(tallySleep([true, false])).toEqual({ n: 1, need: 1, morning: true })
    expect(tallySleep([true, false, false])).toEqual({ n: 1, need: 2, morning: false })
    expect(tallySleep([true, true, false])).toEqual({ n: 2, need: 2, morning: true })
    expect(tallySleep([false, false, false, false])).toEqual({ n: 0, need: 2, morning: false })
  })
  it('아무도 없거나 아무도 안 자면 아침이 아니다', () => {
    expect(tallySleep([])).toEqual({ n: 0, need: 1, morning: false })
    expect(tallySleep([false])).toEqual({ n: 0, need: 1, morning: false })
  })
})

describe('justAfterMorning', () => {
  it('잠 투표 아침(2일차 이상 기준점) 뒤 3초 안이면 true (늦게 닿은 눕기를 버린다)', () => {
    expect(justAfterMorning({ epoch: 10_000, day0: 2 }, 10_000)).toBe(true)
    expect(justAfterMorning({ epoch: 10_000, day0: 2 }, 12_999)).toBe(true)
    expect(justAfterMorning({ epoch: 10_000, day0: 2 }, 13_000)).toBe(false)
  })
  it('새로 만든 방(1일차 기준점)은 아침이 아니다: 들어오자마자 누워도 센다', () => {
    expect(justAfterMorning({ epoch: 10_000, day0: 1 }, 10_500)).toBe(false)
  })
  it('기준점보다 이른 시각(서버 시계가 뒤로 감)은 아침 직후로 보지 않는다', () => {
    expect(justAfterMorning({ epoch: 10_000, day0: 3 }, 9_000)).toBe(false)
  })
})

describe('judgeAnimalHit', () => {
  const s: NetState = { p: [180, 1, -40], f: 0, v: 0, rest: false, fish: null, rod: 0.5, rodOn: true, bob: null, act: { emote: null, emoteAge: 30, airAge: null, landedAge: 30, eat: null, eatAge: 30 } }
  const me = memberFrom({ id: 'm1', nick: '혜린', look: DEFAULT_LOOK, joinedAt: 0, s, stateWin: NEW_WINDOW, lastChat: -Infinity, lastProfile: -Infinity })
  const cow: AnimalView = { id: 4, sp: 'cow', x: 181.5, z: -40, h: 0, pose: 'idle', hp: 3 }
  const hit = (w: 'fists' | 'knife' | 'stab', dmg = 9): Extract<ClientMsg, { type: 'animalHit' }> => ({ type: 'animalHit', id: 4, dmg, w })

  it('가까운 살아 있는 동물: 피해는 공격 표 값 (보낸 dmg 는 믿지 않는다), 마지막 명중 시각을 남긴다', () => {
    expect(judgeAnimalHit(me, hit('knife'), cow, 10)).toEqual({ ok: true, dmg: 1, member: { ...me, lastHit: 10, lastW: 'knife', hitWin: { start: 10, count: 1 } } })
    expect(judgeAnimalHit(me, hit('stab'), cow, 10)).toMatchObject({ ok: true, dmg: 2 })
    expect(judgeAnimalHit(me, hit('fists'), cow, 10)).toMatchObject({ ok: true, dmg: 1 })
  })
  it('공격 종류별 최소 간격 안에 또 오면 버린다 (주먹 0.3·칼 0.4·찌르기 0.7초)', () => {
    expect(judgeAnimalHit({ ...me, lastHit: 10, lastW: 'fists' }, hit('fists'), cow, 10.29)).toMatchObject({ ok: false })
    expect(judgeAnimalHit({ ...me, lastHit: 10, lastW: 'fists' }, hit('fists'), cow, 10.31)).toMatchObject({ ok: true })
    expect(judgeAnimalHit({ ...me, lastHit: 10, lastW: 'knife' }, hit('knife'), cow, 10.39)).toMatchObject({ ok: false })
    expect(judgeAnimalHit({ ...me, lastHit: 10, lastW: 'stab' }, hit('stab'), cow, 10.69)).toMatchObject({ ok: false })
    expect(judgeAnimalHit({ ...me, lastHit: 10, lastW: 'stab' }, hit('stab'), cow, 10.71)).toMatchObject({ ok: true })
    // 3-3 전 붙임 정보(lastW 없음)는 이번 공격 종류로 본다
    expect(judgeAnimalHit({ ...me, lastHit: 10 }, hit('stab'), cow, 10.69)).toMatchObject({ ok: false })
    expect(judgeAnimalHit({ ...me, lastHit: 10 }, hit('stab'), cow, 10.71)).toMatchObject({ ok: true })
  })
  it('공격 종류를 바꾸면 화면 시간 그대로: 앞 공격 간격 + 새 맞는 순간 − 앞 맞는 순간 − 0.1초 (같은 종류 최소 간격보다 길지 않게)', () => {
    // 주먹(간격 0.45, 맞는 순간 0.152) → 찌르기(0.2852): 0.483. 예전엔 찌르기 0.7 로 늘 버렸다
    expect(minHitGap('fists', 'stab')).toBeCloseTo(0.45 + 0.2852 - 0.152 - 0.1, 4)
    expect(minHitGap('knife', 'stab')).toBeCloseTo(60 / 110 + 0.2852 - 0.126 - 0.1, 4)
    // 찌르기 → 베기는 0.59 지만 베기 최소 간격 0.4 를 넘지 않는다
    expect(minHitGap('stab', 'knife')).toBeCloseTo(0.4, 4)
    expect(minHitGap('fists', 'fists')).toBeCloseTo(0.3, 4)
    expect(minHitGap('knife', 'knife')).toBeCloseTo(0.4, 4)
    expect(minHitGap('stab', 'stab')).toBeCloseTo(0.7, 4)
    const knifeHand = { ...me, s: { ...me.s!, tool: 'knife' as const } }
    const fistsAt10 = { ...me, lastHit: 10, lastW: 'fists' as const }
    expect(judgeAnimalHit(fistsAt10, hit('stab'), cow, 10.47)).toMatchObject({ ok: false })
    expect(judgeAnimalHit(fistsAt10, hit('stab'), cow, 10.49)).toMatchObject({ ok: true })
    const knifeAt10 = { ...knifeHand, lastHit: 10, lastW: 'knife' as const }
    expect(judgeAnimalHit(knifeAt10, hit('stab'), cow, 10.6)).toMatchObject({ ok: false })
    expect(judgeAnimalHit(knifeAt10, hit('stab'), cow, 10.61)).toMatchObject({ ok: true })
    const stabAt10 = { ...knifeHand, lastHit: 10, lastW: 'stab' as const }
    expect(judgeAnimalHit(stabAt10, hit('knife'), cow, 10.39)).toMatchObject({ ok: false })
    expect(judgeAnimalHit(stabAt10, hit('knife'), cow, 10.41)).toMatchObject({ ok: true, member: { lastW: 'knife' } })
  })
  it('든 도구가 알려져 있으면 공격 종류가 맞아야 한다 (낚싯대로 베기·주먹으로 찌르기는 버린다)', () => {
    const holding = (tool: 'rod' | 'fists' | 'knife') => ({ ...me, s: { ...me.s!, tool } })
    expect(judgeAnimalHit(holding('rod'), hit('knife'), cow, 10)).toMatchObject({ ok: false })
    expect(judgeAnimalHit(holding('fists'), hit('stab'), cow, 10)).toMatchObject({ ok: false })
    expect(judgeAnimalHit(holding('fists'), hit('knife'), cow, 10)).toMatchObject({ ok: false })
    expect(judgeAnimalHit(holding('fists'), hit('fists'), cow, 10)).toMatchObject({ ok: true })
    expect(judgeAnimalHit(holding('knife'), hit('stab'), cow, 10)).toMatchObject({ ok: true })
    expect(judgeAnimalHit(holding('knife'), hit('fists'), cow, 10)).toMatchObject({ ok: false })
  })
  it('animalHit 은 버린 것까지 초당 4번까지만 본다 (창은 버려도 남긴다)', () => {
    let m: Member = me
    for (let i = 0; i < 4; i++) {
      const r = judgeAnimalHit(m, hit('knife'), undefined, 10 + i * 0.01)
      expect(r.ok).toBe(false)
      m = r.member
    }
    expect(m.hitWin.count).toBe(4)
    expect(judgeAnimalHit(m, hit('knife'), cow, 10.5)).toMatchObject({ ok: false })
    expect(judgeAnimalHit(m, hit('knife'), cow, 11.01)).toMatchObject({ ok: true })
  })
  it('사거리 + 판정 원 + 여유 2.5m 보다 멀면 버린다', () => {
    // 칼 1.8 + 소 0.52 + 2.5 = 4.82
    expect(judgeAnimalHit(me, hit('knife'), { ...cow, x: 180 + 4.8 }, 10)).toMatchObject({ ok: true })
    expect(judgeAnimalHit(me, hit('knife'), { ...cow, x: 180 + 4.9 }, 10)).toMatchObject({ ok: false })
  })
  it('모습을 안 보낸 사람, 없는 동물, 쓰러진 동물은 버린다', () => {
    expect(judgeAnimalHit({ ...me, s: null }, hit('knife'), cow, 10)).toMatchObject({ ok: false })
    expect(judgeAnimalHit(me, hit('knife'), undefined, 10)).toMatchObject({ ok: false })
    expect(judgeAnimalHit(me, hit('knife'), { ...cow, pose: 'dead', hp: 0 }, 10)).toMatchObject({ ok: false })
  })
  it('handleMemberMsg 는 animalHit 을 남에게 넘기지 않는다', () => {
    expect(handleMemberMsg(me, hit('knife'), 10)).toEqual({ member: me, out: null })
  })
})

describe('herdStepDt', () => {
  it('처음(무리 없음)은 0초로 바로 만든다', () => {
    expect(herdStepDt(null, 5000)).toBe(0)
  })
  it('지난번부터 0.15초(0.75 × animalEvery)가 안 됐으면 null (5Hz 메시지와 어긋나 건너뛰지 않게 0.2초보다 조금 짧게)', () => {
    expect(HERD_STEP_MIN).toBeCloseTo(0.15, 6)
    expect(herdStepDt(1000, 1149)).toBeNull()
    expect(herdStepDt(1000, 1150)).toBeCloseTo(0.15, 6)
    expect(herdStepDt(1000, 1200)).toBeCloseTo(0.2, 6)
  })
  it('오래 멈췄으면 1초까지만', () => {
    expect(herdStepDt(1000, 60_000)).toBe(1)
  })
  it('서버 시계가 뒤로 가면 0초 (지금부터 다시 잰다)', () => {
    expect(herdStepDt(5000, 1000)).toBe(0)
  })
  it('force (명중 판정·새로 온 사람): 0.15초가 안 됐어도 지난 만큼 움직인다', () => {
    expect(herdStepDt(1000, 1050, true)).toBeCloseTo(0.05, 6)
    expect(herdStepDt(1000, 60_000, true)).toBe(1)
    expect(herdStepDt(null, 1000, true)).toBe(0)
  })
})

describe('sleepGuardEnd', () => {
  it('아침 직후 3초 안이면 그 끝(ms), 아니면 null', () => {
    expect(sleepGuardEnd({ epoch: 10_000, day0: 2 }, 11_000)).toBe(13_000)
    expect(sleepGuardEnd({ epoch: 10_000, day0: 2 }, 13_000)).toBeNull()
    expect(sleepGuardEnd({ epoch: 10_000, day0: 1 }, 10_500)).toBeNull()
  })
})

describe('총으로 사냥 (3-4 animalHit)', () => {
  const s: NetState = { p: [180, 1, -40], f: 0, v: 0, rest: false, fish: null, rod: 0.5, rodOn: true, bob: null, act: { emote: null, emoteAge: 30, airAge: null, landedAge: 30, eat: null, eatAge: 30 } }
  const me = memberFrom({ id: 'm1', nick: '혜린', look: DEFAULT_LOOK, joinedAt: 0, s, stateWin: NEW_WINDOW, lastChat: -Infinity, lastProfile: -Infinity })
  const gunner = (w: 'pistol' | 'rifle' | 'shotgun' | 'sniper'): Member => ({ ...me, s: { ...s, tool: w } })
  const cow: AnimalView = { id: 4, sp: 'cow', x: 230, z: -40, h: 0, pose: 'idle', hp: 3 }
  const shot = (w: 'pistol' | 'rifle' | 'shotgun' | 'sniper', n?: number): Extract<ClientMsg, { type: 'animalHit' }> => ({ type: 'animalHit', id: 4, dmg: 99, w, ...(n ? { n } : {}) })

  it('피해는 알마다 은지 값 × 맞은 알 수 (산탄총만, 최대 8): 저격 3, 산탄 5알 5, 권총 1', () => {
    expect(judgeAnimalHit(gunner('sniper'), shot('sniper'), cow, 10)).toMatchObject({ ok: true, dmg: 3 })
    expect(judgeAnimalHit(gunner('shotgun'), shot('shotgun', 5), cow, 10)).toMatchObject({ ok: true, dmg: 5 })
    expect(judgeAnimalHit(gunner('pistol'), shot('pistol', 5), cow, 10)).toMatchObject({ ok: true, dmg: 1 })
  })
  it('총 사거리 80m + 판정 원 + 여유 2.5m 까지 (50m 떨어진 소도 맞는다)', () => {
    expect(judgeAnimalHit(gunner('rifle'), shot('rifle'), { ...cow, x: 180 + 83 }, 10)).toMatchObject({ ok: true })
    expect(judgeAnimalHit(gunner('rifle'), shot('rifle'), { ...cow, x: 180 + 83.1 }, 10)).toMatchObject({ ok: false })
  })
  it('총마다 최소 간격 (권총 0.15·소총 0.07·산탄 0.6·저격 1.2초), 총이 끼면 다음 무기 간격', () => {
    expect(hitGap('rifle', 'rifle')).toBeCloseTo(0.07)
    expect(hitGap('knife', 'sniper')).toBeCloseTo(1.2)
    expect(hitGap('sniper', 'knife')).toBeCloseTo(0.4)
    const at10 = { ...gunner('sniper'), lastHit: 10, lastW: 'sniper' as const }
    expect(judgeAnimalHit(at10, shot('sniper'), cow, 11.1)).toMatchObject({ ok: false })
    expect(judgeAnimalHit(at10, shot('sniper'), cow, 11.21)).toMatchObject({ ok: true })
  })
  it('총은 초당 12번까지 (소총 분당 650발), 든 총이 알려져 있으면 그 총이어야 한다', () => {
    let m: Member = gunner('rifle')
    let ok = 0
    for (let i = 0; i < 14; i++) {
      const r = judgeAnimalHit(m, shot('rifle'), cow, 10 + i * 0.071)
      if (r.ok) ok++
      m = r.member
    }
    expect(ok).toBe(12)
    const holding = { ...me, s: { ...s, tool: 'pistol' as const } }
    expect(judgeAnimalHit(holding, shot('rifle'), cow, 10)).toMatchObject({ ok: false })
    expect(judgeAnimalHit(holding, shot('pistol'), cow, 10)).toMatchObject({ ok: true })
  })
})

describe('명중 간격 여유 (nextHitAt)', () => {
  it('근접은 간격이 지나야 받고 지금 시각을 남긴다', () => {
    expect(nextHitAt(10, 0.4, 10.39, false)).toBeNull()
    expect(nextHitAt(10, 0.4, 10.4, false)).toBe(10.4)
  })
  it('총은 늦게 닿은 메시지 다음에 제때 온 것도 받는다 (0.04초 여유), 시각은 앞 + 간격으로 쳐서 평균 빠르기는 그대로', () => {
    // 소총 0.07: 앞 것이 30ms 늦게 닿아 다음 것과 0.04초 차이
    expect(nextHitAt(10, 0.07, 10.04, true)).toBeCloseTo(10.07)
    expect(nextHitAt(10, 0.07, 10.02, true)).toBeNull()
    expect(nextHitAt(10, 0.07, 10.2, true)).toBe(10.2)
    expect(nextHitAt(-Infinity, 0.07, 3, true)).toBe(3)
    // 0.035초마다 쏟아부어도 1초에 받는 건 1 / 0.07 남짓
    let last = -Infinity
    let ok = 0
    for (let i = 0; i < 30; i++) {
      const t = nextHitAt(last, 0.07, 10 + i * 0.035, true)
      if (t !== null) {
        last = t
        ok++
      }
    }
    expect(ok).toBeLessThanOrEqual(Math.ceil(1.05 / 0.07) + 1)
  })
})

describe('동물 명중 먼저 거르기 (screenAnimalHit, 3-4)', () => {
  const s: NetState = { p: [180, 1, -40], f: 0, v: 0, rest: false, fish: null, rod: 0.5, rodOn: true, bob: null, act: { emote: null, emoteAge: 30, airAge: null, landedAge: 30, eat: null, eatAge: 30 } }
  const me = memberFrom({ id: 'm1', nick: '혜린', look: DEFAULT_LOOK, joinedAt: 0, s: { ...s, tool: 'shotgun' }, stateWin: NEW_WINDOW, lastChat: -Infinity, lastProfile: -Infinity })
  const cow: AnimalView = { id: 4, sp: 'cow', x: 185, z: -40, h: 0, pose: 'idle', hp: 30 }
  const pig: AnimalView = { ...cow, id: 5, x: 186 }
  const shot = (id: number, n: number, sid?: number): Extract<ClientMsg, { type: 'animalHit' }> => ({ type: 'animalHit', id, dmg: 1, w: 'shotgun', n, ...(sid ? { shot: sid } : {}) })

  it('동물을 보기 전에 창·모습·든 도구·간격을 본다 (버리면 무리를 움직이지 않는다): 넘치는 메시지는 창만 센다', () => {
    let m = me
    for (let i = 0; i < 12; i++) m = screenAnimalHit(m, shot(4, 1), 10 + i * 0.001).member
    const r = screenAnimalHit(m, shot(4, 1), 10.5)
    expect(r.ok).toBe(false)
    expect(r.member.hitWin).toEqual(m.hitWin)
    expect(screenAnimalHit({ ...me, s: null }, shot(4, 1), 10).ok).toBe(false)
    expect(screenAnimalHit({ ...me, lastHit: 10, lastW: 'shotgun' }, shot(4, 1), 10.3).ok).toBe(false)
    expect(screenAnimalHit(me, shot(4, 1), 10).ok).toBe(true)
  })
  it('든 도구를 모르는 사람의 총 명중은 버린다 (근접은 3-3 클라이언트라 믿는다)', () => {
    const free = { ...me, s }
    expect(judgeAnimalHit(free, shot(4, 1), cow, 10)).toMatchObject({ ok: false })
    expect(judgeAnimalHit(free, { type: 'animalHit', id: 4, dmg: 1, w: 'knife' }, { ...cow, x: 181 }, 10)).toMatchObject({ ok: true })
  })
  it('산탄총 한 발(같은 shot 번호)이 동물 여럿을 맞히면 모두 받는다 (알 수 합 8 까지)', () => {
    const r1 = judgeAnimalHit(me, shot(4, 5, 9), cow, 10)
    expect(r1).toMatchObject({ ok: true, dmg: 5 })
    const r2 = judgeAnimalHit(r1.member, shot(5, 3, 9), pig, 10.01)
    expect(r2).toMatchObject({ ok: true, dmg: 3 })
    expect(judgeAnimalHit(r1.member, shot(5, 4, 9), pig, 10.01)).toMatchObject({ ok: false })
    expect(judgeAnimalHit(r1.member, shot(5, 3, 10), pig, 10.01)).toMatchObject({ ok: false })
    expect(judgeAnimalHit(r1.member, shot(5, 3), pig, 10.01)).toMatchObject({ ok: false })
  })
})

describe('PvP (3-4 judgePvpHit·judgeDied)', () => {
  type Tool = 'pistol' | 'rifle' | 'shotgun' | 'sniper' | 'knife' | 'fists'
  const at = (x: number, tool?: Tool): NetState => ({ p: [x, 1, -10], f: 0, v: 0, rest: false, fish: null, rod: 0.5, rodOn: true, bob: null, act: { emote: null, emoteAge: 30, airAge: null, landedAge: 30, eat: null, eatAge: 30 }, ...(tool ? { tool } : {}) })
  const person = (id: string, s: NetState | null) => memberFrom({ id, nick: id, look: DEFAULT_LOOK, joinedAt: 0, s, stateWin: NEW_WINDOW, lastChat: -Infinity, lastProfile: -Infinity })
  const a = person('a', at(180, 'pistol'))
  const b = person('b', at(190))
  const hit = (weapon: Extract<ClientMsg, { type: 'pvpHit' }>['weapon'], n = 1, extra: { target?: string; shot?: number } = {}): Extract<ClientMsg, { type: 'pvpHit' }> => ({ type: 'pvpHit', target: 'b', weapon, n, ...extra })
  const holding = (tool: Tool) => person('a', at(180, tool))
  const shooterOf = (r: ReturnType<typeof judgePvpHit>) => r.shooter

  it('은지 피해표: 권총 20 · 소총 14 · 산탄 9×알 수(최대 8) · 저격 70 · 칼 15 · 찌르기 30 · 주먹 5', () => {
    const near = person('b', at(181))
    expect(judgePvpHit(holding('pistol'), hit('pistol'), b, 10)).toMatchObject({ ok: true, dmg: 20 })
    expect(judgePvpHit(holding('rifle'), hit('rifle'), b, 10)).toMatchObject({ ok: true, dmg: 14 })
    expect(judgePvpHit(holding('shotgun'), hit('shotgun', 3), b, 10)).toMatchObject({ ok: true, dmg: 27 })
    expect(judgePvpHit(holding('shotgun'), hit('shotgun', 12), b, 10)).toMatchObject({ ok: true, dmg: 72 })
    expect(judgePvpHit(holding('sniper'), hit('sniper'), b, 10)).toMatchObject({ ok: true, dmg: 70 })
    expect(judgePvpHit(holding('knife'), hit('stab'), near, 10)).toMatchObject({ ok: true, dmg: 30 })
    expect(judgePvpHit(holding('fists'), hit('fists'), near, 10)).toMatchObject({ ok: true, dmg: 5 })
  })
  it('같은 무기는 최소 간격 안에 또 오면 버린다', () => {
    const r = judgePvpHit(a, hit('pistol'), b, 10)
    expect(r).toMatchObject({ ok: true, shooter: { pvpLast: { w: 'pistol', at: 10 } } })
    expect(judgePvpHit(shooterOf(r), hit('pistol'), b, 10.1)).toMatchObject({ ok: false })
    expect(judgePvpHit(shooterOf(r), hit('pistol'), b, 10.16)).toMatchObject({ ok: true })
  })
  it('든 도구를 모르는 사람(모습에 tool 이 없음)은 총·칼·주먹 모두 버린다 (PvP 는 3-4 클라이언트만 보낸다)', () => {
    const free = person('a', at(180))
    const near = person('b', at(181))
    for (const w of ['pistol', 'rifle', 'shotgun', 'sniper'] as const) expect(judgePvpHit(free, hit(w), b, 10)).toMatchObject({ ok: false })
    for (const w of ['knife', 'stab', 'fists'] as const) expect(judgePvpHit(free, hit(w), near, 10)).toMatchObject({ ok: false })
  })
  it('무기를 바꿔도 간격은 사람마다 하나: 다른 무기를 바로 이어 보내 피해를 쌓을 수 없다', () => {
    // 칼 들고 베기 → 곧바로 찌르기 (같은 칼, 화면에선 베기 간격이 지나야 찌른다)
    const knife = person('a', at(180, 'knife'))
    const near = person('b', at(181))
    const slashed = shooterOf(judgePvpHit(knife, hit('knife'), near, 10))
    expect(judgePvpHit(slashed, hit('stab'), near, 10.07)).toMatchObject({ ok: false })
    expect(judgePvpHit(slashed, hit('stab'), near, 10.61)).toMatchObject({ ok: true })
    // 소총 → 권총 (모습의 도구가 바뀌어도 총 바꾸는 0.25초 안은 버린다)
    const rifled = shooterOf(judgePvpHit(holding('rifle'), hit('rifle'), b, 10))
    const swapped = { ...rifled, s: at(180, 'pistol') }
    expect(judgePvpHit(swapped, hit('pistol'), b, 10.07)).toMatchObject({ ok: false })
    expect(judgePvpHit(swapped, hit('pistol'), b, 10.25)).toMatchObject({ ok: true })
    // 간격: 같은 무기는 그 무기, 근접끼리는 화면 시간, 다른 총으로는 바꾸는 시간 이상
    expect(pvpGap('rifle', 'rifle')).toBeCloseTo(0.07)
    expect(pvpGap('rifle', 'pistol')).toBeCloseTo(0.25)
    expect(pvpGap('knife', 'sniper')).toBeCloseTo(1.2)
    expect(pvpGap('knife', 'stab')).toBeCloseTo(minHitGap('knife', 'stab'))
  })
  it('바꿔 가며 보내도 1초 피해는 한 무기를 계속 쏜 것보다 많지 않다 (소총 연사 ≈ 14 / 0.07)', () => {
    const tools: [Tool, Extract<ClientMsg, { type: 'pvpHit' }>['weapon']][] = [['rifle', 'rifle'], ['pistol', 'pistol'], ['shotgun', 'shotgun'], ['sniper', 'sniper'], ['knife', 'knife'], ['knife', 'stab'], ['fists', 'fists']]
    let m = holding('rifle')
    let dmg = 0
    // 3초 동안 0.03초마다 무기를 바꿔 가며 (총은 산탄 8알)
    for (let i = 0; i < 100; i++) {
      const [tool, w] = tools[i % tools.length]
      const r = judgePvpHit({ ...m, s: at(180, tool) }, hit(w, 8), person('b', at(181)), 10 + i * 0.03)
      if (r.ok) dmg += r.dmg
      m = r.shooter
    }
    expect(dmg).toBeLessThanOrEqual((3 * 14) / 0.07 + 72)
  })
  it('pvpHit 은 버린 것까지 초당 20번까지만 본다 (창은 버려도 남긴다)', () => {
    let m = a
    for (let i = 0; i < 20; i++) {
      const r = judgePvpHit(m, hit('pistol'), undefined, 10 + i * 0.01)
      expect(r.ok).toBe(false)
      m = r.shooter
    }
    expect(m.pvpWin).toEqual({ start: 10, count: 20 })
    expect(judgePvpHit(m, hit('pistol'), b, 10.5)).toMatchObject({ ok: false })
    expect(judgePvpHit(m, hit('pistol'), b, 11.01)).toMatchObject({ ok: true })
  })
  it('산탄총 한 발(같은 shot 번호)이 여럿을 맞히면 모두 받는다. 알 수 합은 8 까지, 같은 사람은 한 번', () => {
    const shotgun = holding('shotgun')
    const c = person('c', at(191))
    const d = person('d', at(192))
    const r1 = judgePvpHit(shotgun, hit('shotgun', 3, { shot: 7 }), b, 10)
    expect(r1).toMatchObject({ ok: true, dmg: 27 })
    const r2 = judgePvpHit(shooterOf(r1), hit('shotgun', 5, { target: 'c', shot: 7 }), c, 10.01)
    expect(r2).toMatchObject({ ok: true, dmg: 45 })
    // 알 수 합이 8 을 넘는다, 같은 사람 또, 번호가 다르면 다음 발 (간격 안이라 버린다)
    expect(judgePvpHit(shooterOf(r2), hit('shotgun', 1, { target: 'd', shot: 7 }), d, 10.02)).toMatchObject({ ok: false })
    expect(judgePvpHit(shooterOf(r1), hit('shotgun', 1, { target: 'b', shot: 7 }), b, 10.02)).toMatchObject({ ok: false })
    expect(judgePvpHit(shooterOf(r1), hit('shotgun', 1, { target: 'd', shot: 8 }), d, 10.02)).toMatchObject({ ok: false })
    // 너무 늦게 온 같은 번호는 다른 발로 본다
    expect(judgePvpHit(shooterOf(r1), hit('shotgun', 1, { target: 'd', shot: 7 }), d, 10.3)).toMatchObject({ ok: false })
    // 한 알 총은 한 발에 한 사람
    const rifled = shooterOf(judgePvpHit(holding('rifle'), hit('rifle', 1, { shot: 3 }), b, 10))
    expect(judgePvpHit(rifled, hit('rifle', 1, { target: 'c', shot: 3 }), c, 10.01)).toMatchObject({ ok: false })
    // 같은 발의 다른 사람은 간격을 다시 재지 않는다 (다음 발은 첫 명중에서 0.6초)
    expect(shooterOf(r2).pvpLast).toEqual({ w: 'shotgun', at: 10 })
  })
  it('나 자신·없는 사람·모습이 없는 사람·든 도구와 다른 무기·너무 먼 사람은 버린다', () => {
    expect(judgePvpHit(a, { ...hit('pistol'), target: 'a' }, a, 10)).toMatchObject({ ok: false })
    expect(judgePvpHit(a, hit('pistol'), undefined, 10)).toMatchObject({ ok: false })
    expect(judgePvpHit(a, hit('pistol'), person('b', null), 10)).toMatchObject({ ok: false })
    expect(judgePvpHit(a, hit('sniper'), b, 10)).toMatchObject({ ok: false })
    // 칼: 1.8 + 몸 0.32 + 여유 2.5 = 4.62m
    const knife = person('a', at(180, 'knife'))
    expect(judgePvpHit(knife, hit('knife'), person('b', at(184.6)), 10)).toMatchObject({ ok: true })
    expect(judgePvpHit(knife, hit('knife'), person('b', at(184.7)), 10)).toMatchObject({ ok: false })
  })
  it('쓰러짐: 10초 안에 나를 맞힌 사람이 방에 있으면 그 사람이 쓰러뜨린 것. 아니면 혼자 쓰러짐. 5초에 한 번', () => {
    const hitByA = { ...b, pvpBy: { id: 'a', at: 20 } }
    expect(judgeDied(hitByA, 'a', true, 25)).toEqual({ ok: true, member: { ...hitByA, lastDied: 25, pvpBy: null }, out: { type: 'kill', victim: 'b', killer: 'a' } })
    expect(judgeDied(hitByA, 'c', true, 25)).toMatchObject({ out: { type: 'kill', victim: 'b' } })
    expect(judgeDied(hitByA, 'a', true, 31)).toEqual(expect.objectContaining({ out: { type: 'kill', victim: 'b' } }))
    expect(judgeDied(hitByA, 'a', false, 25)).toEqual(expect.objectContaining({ out: { type: 'kill', victim: 'b' } }))
    expect(judgeDied(b, undefined, false, 25)).toMatchObject({ ok: true, out: { type: 'kill', victim: 'b' } })
    expect(judgeDied({ ...b, lastDied: 22 }, undefined, false, 25)).toEqual({ ok: false })
  })
  it('shot 은 쏜 사람 id 를 붙여 남에게 넘긴다 (0.05초에 한 번, 내 자리에서 6m 넘는 총구는 버린다)', () => {
    const msg = { type: 'shot' as const, o: [180.123, 1.5, -10] as [number, number, number], d: [0, 0, -1] as [number, number, number], w: 'rifle' as const }
    const r = handleMemberMsg(a, msg, 10)
    expect(r.out).toEqual({ type: 'shot', id: 'a', o: [180.12, 1.5, -10], d: [0, 0, -1], w: 'rifle' })
    expect(handleMemberMsg(r.member, msg, 10.03).out).toBeNull()
    expect(handleMemberMsg(r.member, msg, 10.06).out).not.toBeNull()
    expect(handleMemberMsg(a, { ...msg, o: [190, 1.5, -10] }, 10).out).toBeNull()
  })
  it('pvpHit·died 는 handleMemberMsg 가 넘기지 않는다 (room.ts 가 맞은 사람을 본다)', () => {
    expect(handleMemberMsg(a, hit('pistol'), 10)).toEqual({ member: a, out: null })
    expect(handleMemberMsg(a, { type: 'died' }, 10)).toEqual({ member: a, out: null })
  })
})
