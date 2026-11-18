import { DAY_LENGTH } from '../data/balance'

/** 하루 진행도 t (0 이상 1 미만, 0 = 06:00, 0.5 = 18:00) 와 날짜 (1일차부터) */
export type Clock = { t: number; day: number }
export const FIRST_MORNING: Clock = { t: 0, day: 1 }

/** dt초 흐른 시계. 06:00 를 지나면 다음 날 */
export function advanceClock(c: Clock, dt: number): Clock {
  const t = c.t + Math.max(0, dt) / DAY_LENGTH
  const days = Math.floor(t)
  return { t: t - days, day: c.day + days }
}

/** 다음 날 06:00 (잠·혼자 죽음) */
export function nextMorning(c: Clock): Clock {
  return { t: 0, day: c.day + 1 }
}

/** 시각 (0 이상 24 미만) */
export function clockHour(t: number): number {
  return (6 + t * 24) % 24
}

/** 밤: 20시부터 5시 전까지 (은지 daynight.js night) */
export function isNight(t: number): boolean {
  const h = clockHour(t)
  return h >= 20 || h < 5
}

/** HUD 글자 "☀️ 3일차 14:20" (은지 timeText). 밤 🌙, 해가 높으면 ☀️, 낮게 뜨거나 지는 중이면 🌅 */
export function clockText(c: Clock): string {
  const h = clockHour(c.t)
  const hh = Math.floor(h)
  const mm = Math.floor((h - hh) * 60)
  const icon = isNight(c.t) ? '🌙' : Math.sin(c.t * Math.PI * 2) > 0.45 ? '☀️' : '🌅'
  return `${icon} ${c.day}일차 ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

/** 저장본의 시계. 모양이 틀리면 null */
export function readClock(v: unknown): Clock | null {
  if (typeof v !== 'object' || v === null) return null
  const { t, day } = v as Record<string, unknown>
  if (typeof t !== 'number' || !Number.isFinite(t) || t < 0 || t >= 1) return null
  if (typeof day !== 'number' || !Number.isInteger(day) || day < 1) return null
  return { t, day }
}

// --- 같이 하기: 방(서버) 시계 ---

/** 서버가 보내는 시각: tm = 하루 안에서 지난 초 (0 이상 DAY_LENGTH 미만), day = 날짜 */
export type ClockTime = { tm: number; day: number }

/** 방 저장소에 두는 시계 기준점: epoch(ms) 때가 day0 일차 06:00. 시각은 저장하지 않고 계산한다 */
export type RoomClock = { epoch: number; day0: number }

export function newRoomClock(nowMs: number): RoomClock {
  return { epoch: nowMs, day0: 1 }
}

/** 기준점에서 지난 시간으로 지금 날짜·시각 (틱 없이도 맞다). tm 은 0.1초 단위로 내림 */
export function roomTime(rc: RoomClock, nowMs: number): ClockTime {
  const elapsed = Math.max(0, (nowMs - rc.epoch) / 1000)
  const days = Math.floor(elapsed / DAY_LENGTH)
  return { tm: Math.floor((elapsed - days * DAY_LENGTH) * 10) / 10, day: rc.day0 + days }
}

/** 잠 투표가 이기면: 지금이 다음 날 06:00 이 되게 기준점을 옮긴다 */
export function roomMorning(rc: RoomClock, nowMs: number): RoomClock {
  return { epoch: nowMs, day0: roomTime(rc, nowMs).day + 1 }
}

/** 받은 방 시각과 받은 때(내 시계, 초). 그 뒤로는 내 시계로 센다 */
export type ClockAnchor = ClockTime & { at: number }

/** 기준점에서 지금(nowSec) 시계. 탭을 숨겼다 와도 지난 시간만큼 맞게 간다 */
export function anchoredClock(a: ClockAnchor, nowSec: number): Clock {
  return advanceClock({ t: a.tm / DAY_LENGTH, day: a.day }, nowSec - a.at)
}

/** 내 시계 → 방 시각 모양 */
export function toClockTime(c: Clock): ClockTime {
  return { tm: c.t * DAY_LENGTH, day: c.day }
}
