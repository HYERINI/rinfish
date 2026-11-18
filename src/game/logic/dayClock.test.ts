import { describe, expect, it } from 'vitest'
import { DAY_LENGTH } from '../data/balance'
import { FIRST_MORNING, advanceClock, anchoredClock, clockText, isNight, nextMorning, readClock, roomMorning, roomTime, toClockTime } from './dayClock'

describe('advanceClock·nextMorning', () => {
  it('하루(480초)가 지나면 다음 날 같은 시각', () => {
    expect(advanceClock({ t: 0.25, day: 2 }, DAY_LENGTH)).toEqual({ t: 0.25, day: 3 })
  })
  it('06:00 를 지나면 날짜가 바뀐다', () => {
    const c = advanceClock({ t: 0.9, day: 1 }, DAY_LENGTH * 0.2)
    expect(c.day).toBe(2)
    expect(c.t).toBeCloseTo(0.1)
  })
  it('거꾸로 가지 않는다', () => {
    expect(advanceClock({ t: 0.5, day: 4 }, -10)).toEqual({ t: 0.5, day: 4 })
  })
  it('다음 날 06:00', () => {
    expect(nextMorning({ t: 0.7, day: 3 })).toEqual({ t: 0, day: 4 })
  })
})

describe('isNight·clockText', () => {
  it('20시부터 5시 전까지가 밤', () => {
    expect(isNight(14 / 24)).toBe(true) // 20:00
    expect(isNight(0.75)).toBe(true) // 00:00
    expect(isNight(23 / 24)).toBe(false) // 05:00
    expect(isNight(0.25)).toBe(false) // 12:00
  })
  it('은지 timeText 그대로: 아이콘·일차·두 자리 시각', () => {
    expect(clockText(FIRST_MORNING)).toBe('🌅 1일차 06:00')
    expect(clockText({ t: 0.125, day: 1 })).toBe('☀️ 1일차 09:00')
    expect(clockText({ t: 8.5 / 24, day: 3 })).toBe('☀️ 3일차 14:30')
    expect(clockText({ t: 0.5, day: 3 })).toBe('🌅 3일차 18:00')
    expect(clockText({ t: 0.75, day: 7 })).toBe('🌙 7일차 00:00')
  })
})

describe('readClock', () => {
  it('맞는 값만 읽는다', () => {
    expect(readClock({ t: 0.3, day: 5 })).toEqual({ t: 0.3, day: 5 })
    for (const bad of [null, 'x', { t: 1, day: 1 }, { t: -0.1, day: 1 }, { t: 0.2, day: 0 }, { t: 0.2, day: 1.5 }, { t: 'x', day: 2 }, { t: Number.NaN, day: 2 }]) {
      expect(readClock(bad)).toBeNull()
    }
  })
})

describe('방 시계', () => {
  const rc = { epoch: 1_000_000, day0: 1 }
  it('저장 없이 지난 시간으로 계산한다', () => {
    expect(roomTime(rc, rc.epoch)).toEqual({ tm: 0, day: 1 })
    expect(roomTime(rc, rc.epoch + 100_000)).toEqual({ tm: 100, day: 1 })
    expect(roomTime(rc, rc.epoch + (DAY_LENGTH * 2 + 30.25) * 1000)).toEqual({ tm: 30.2, day: 3 })
  })
  it('기준점보다 이른 시각이면 기준점 그대로', () => {
    expect(roomTime(rc, rc.epoch - 5000)).toEqual({ tm: 0, day: 1 })
  })
  it('아침: 지금이 다음 날 06:00 가 된다', () => {
    const now = rc.epoch + (DAY_LENGTH + 200) * 1000
    const next = roomMorning(rc, now)
    expect(next).toEqual({ epoch: now, day0: 3 })
    expect(roomTime(next, now + 1000)).toEqual({ tm: 1, day: 3 })
  })
  it('받은 시각에서 내 시계로 이어 간다 (탭을 숨겼다 와도)', () => {
    const a = { tm: 240, day: 2, at: 50 }
    expect(anchoredClock(a, 50)).toEqual({ t: 0.5, day: 2 })
    const later = anchoredClock(a, 50 + 240 + 48)
    expect(later.day).toBe(3)
    expect(later.t).toBeCloseTo(0.1)
    expect(toClockTime({ t: 0.5, day: 2 })).toEqual({ tm: 240, day: 2 })
  })
})
