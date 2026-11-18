// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DAY_LENGTH } from '../data/balance'
import { INITIAL_PROGRESS, useProgressStore } from './progressStore'
import { liveClock, useDayStore } from './dayStore'
import { useSessionStore } from './sessionStore'

const day = () => useDayStore.getState()
let nowMs = 0

beforeEach(() => {
  nowMs = 1_000_000
  vi.spyOn(performance, 'now').mockImplementation(() => nowMs)
  localStorage.clear()
  useProgressStore.setState({ ...INITIAL_PROGRESS, clock: { t: 0.25, day: 3 } })
  useSessionStore.setState({ mode: 'explore', notice: null })
  day().reset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('혼자 시계', () => {
  it('저장된 시계에서 이어서, 프레임마다 흐르고 멈춤(메뉴)이면 멈춘다', () => {
    expect(liveClock).toEqual({ t: 0.25, day: 3 })
    expect(day().clockText).toBe('☀️ 3일차 12:00')
    day().stepClock(DAY_LENGTH / 4, false)
    expect(liveClock.t).toBeCloseTo(0.5)
    day().stepClock(60, true)
    expect(liveClock.t).toBeCloseTo(0.5)
  })

  it('20시가 되면 밤', () => {
    useProgressStore.setState({ clock: { t: 0.58, day: 1 } })
    day().toSoloClock()
    expect(day().night).toBe(false)
    day().stepClock(DAY_LENGTH * 0.01, false)
    expect(day().night).toBe(true)
    expect(day().clockText.startsWith('🌙')).toBe(true)
  })
})

describe('방 시계', () => {
  it('받은 시각에서 내 시계로 이어 가고, 멈춤과 상관없이 흐른다', () => {
    day().toRoomClock({ tm: 240, day: 2 })
    expect(day().roomClock).toBe(true)
    expect(liveClock).toEqual({ t: 0.5, day: 2 })
    nowMs += 48_000
    day().stepClock(0, true)
    expect(liveClock.t).toBeCloseTo(0.6)
    day().syncRoomClock({ tm: 0, day: 5 })
    expect(liveClock).toEqual({ t: 0, day: 5 })
  })

  it('옛 서버(시각 없음)면 지금 시각에서 이어 돌린다', () => {
    day().toRoomClock()
    expect(liveClock).toEqual({ t: 0.25, day: 3 })
    nowMs += DAY_LENGTH * 1000
    day().stepClock(0, false)
    expect(liveClock.day).toBe(4)
  })

  it('방을 나오면 저장된 혼자 시계로 돌아간다 (방 시계는 저장하지 않는다)', () => {
    day().toRoomClock({ tm: 100, day: 9 })
    day().toSoloClock()
    expect(day().roomClock).toBe(false)
    expect(liveClock).toEqual({ t: 0.25, day: 3 })
    expect(useProgressStore.getState().clock).toEqual({ t: 0.25, day: 3 })
  })

  it('혼자일 땐 방 시계 확인을 무시한다', () => {
    day().syncRoomClock({ tm: 0, day: 8 })
    expect(liveClock).toEqual({ t: 0.25, day: 3 })
  })
})

describe('잠 투표', () => {
  it('누가 자기 시작하면 알리고 수를 보인다. 내가 자는 중이면 알리지 않는다', () => {
    day().toRoomClock({ tm: 10, day: 1 })
    day().roomSleepers(1, 2)
    expect(day().sleepers).toEqual({ n: 1, need: 2 })
    expect(useSessionStore.getState().notice?.text).toContain('1 / 2명이 자고 있어요')
    useSessionStore.setState({ notice: null })
    day().setVoting(true)
    day().roomSleepers(2, 3)
    expect(useSessionStore.getState().notice).toBeNull()
    day().roomSleepers(0, 3)
    expect(day().sleepers).toBeNull()
  })

  it('아침이 오면: 자던 사람은 체력 가득·배고픔 −15 로 깨고, 모두 짧게 어두워진다', () => {
    day().toRoomClock({ tm: 300, day: 1 })
    useProgressStore.setState({ survival: { stamina: 20, hunger: 50, graceLeft: null, buffs: [] } })
    day().setVoting(true)
    useSessionStore.setState({ mode: 'sleep' })
    day().roomMorning(2)
    expect(liveClock).toEqual({ t: 0, day: 2 })
    expect(day().voting).toBe(false)
    expect(useSessionStore.getState().mode).toBe('explore')
    expect(useProgressStore.getState().survival).toMatchObject({ stamina: 100, hunger: 35 })
    expect(day().seq?.kind).toBe('morning')
    // 방 시계로 맞춘 아침은 저장된 혼자 시계를 바꾸지 않는다
    expect(useProgressStore.getState().clock).toEqual({ t: 0.25, day: 3 })
  })

  it('안 자던 사람은 알림만, 체력·배고픔 그대로', () => {
    day().toRoomClock({ tm: 300, day: 1 })
    useProgressStore.setState({ survival: { stamina: 20, hunger: 50, graceLeft: null, buffs: [] } })
    day().roomMorning(2)
    expect(useProgressStore.getState().survival).toMatchObject({ stamina: 20, hunger: 50 })
    expect(useSessionStore.getState().notice?.text).toBe('2일차 아침이 됐어요')
  })

  it('다시 연결(welcome)되면 서버의 잠 표시가 지워졌으니 내 쪽도 깬다', () => {
    day().toRoomClock({ tm: 300, day: 1 })
    day().setVoting(true)
    useSessionStore.setState({ mode: 'sleep' })
    day().toRoomClock({ tm: 320, day: 1 })
    expect(day().voting).toBe(false)
    expect(useSessionStore.getState().mode).toBe('explore')
  })
})
