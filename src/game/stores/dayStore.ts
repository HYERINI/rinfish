import { create } from 'zustand'
import { FIRST_MORNING, advanceClock, anchoredClock, clockText, isNight, toClockTime, type Clock, type ClockAnchor, type ClockTime } from '../logic/dayClock'
import type { SeqKind } from '../logic/restSeq'
import { useProgressStore } from './progressStore'
import { useSessionStore } from './sessionStore'

/** 지금 시각. 매 프레임 바뀌어서 스토어 밖 모듈 변수로 둔다 (조명·바다·1초 저장이 읽는다) */
export const liveClock: Clock = { ...FIRST_MORNING }
/** 같이 하는 중: 마지막으로 받은 방 시각과 받은 때 (performance.now() 초). 그 사이는 내 시계로 센다 */
let anchor: ClockAnchor | null = null

const nowSec = () => performance.now() / 1000
const setLive = (c: Clock) => {
  liveClock.t = c.t
  liveClock.day = c.day
}

/** 화면이 어두워지는 중인 일. startedAt: performance.now() 초, switched: 다 어두워진 순간의 일(잠·깨어나기)을 이미 했다 */
export type RestSeq = { kind: SeqKind; startedAt: number; switched: boolean }

type DayState = {
  /** HUD 시계 글자 ("☀️ 3일차 14:20") */
  clockText: string
  night: boolean
  /** 같이 하는 중: 방(서버) 시계를 따른다. 저장된 혼자 시계는 건드리지 않는다 */
  roomClock: boolean
  seq: RestSeq | null
  /** 같이 하기: 침대에 누워 아침을 기다리는 중 (잠 투표) */
  voting: boolean
  /** 같이 하기: 자는 사람 수 / 아침에 필요한 수. 아무도 안 자면 null */
  sleepers: { n: number; need: number } | null
  /** 매 프레임: 혼자면 dt 만큼 (paused 면 멈춤), 같이면 방 시각에서 계산. 글자·밤이 바뀔 때만 알린다 */
  stepClock: (dt: number, paused: boolean) => void
  /** 혼자 시계로: 저장값에서 이어서. 잠 투표 중이었으면 깬다 */
  toSoloClock: () => void
  /** 혼자 잠·혼자 죽음으로 시계를 옮긴다 */
  setSoloClock: (c: Clock) => void
  /** 방에 들어왔다 (welcome). time 이 없으면(옛 서버) 지금 시각에서 이어 돌린다 */
  toRoomClock: (time?: ClockTime) => void
  /** 방 시계 확인 (time) */
  syncRoomClock: (time: ClockTime) => void
  roomSleepers: (n: number, need: number) => void
  /** 방에 아침이 왔다: 잠 투표 중이었으면 자고 일어난 것으로, 모두 짧게 화면이 어두워진다 */
  roomMorning: (day: number) => void
  startSeq: (kind: SeqKind) => void
  markSeqSwitched: () => void
  endSeq: () => void
  setVoting: (on: boolean) => void
  /** 게임을 새로 열 때 */
  reset: () => void
}

const notify = (text: string) => useSessionStore.getState().notify(text)

export const useDayStore = create<DayState>((set, get) => {
  /** liveClock 이 바뀐 뒤 HUD 글자·밤을 알린다 (바뀐 때만) */
  const publish = () => {
    const text = clockText(liveClock)
    const night = isNight(liveClock.t)
    if (text !== get().clockText || night !== get().night) set({ clockText: text, night })
  }
  /** 잠 투표 화면을 닫는다 (아직 어두워지는 중이 아니면 탐험으로) */
  const stopVoting = () => {
    if (!get().voting) return
    set({ voting: false })
    const session = useSessionStore.getState()
    if (session.mode === 'sleep' && !get().seq) session.setMode('explore')
  }

  return {
    clockText: clockText(FIRST_MORNING),
    night: false,
    roomClock: false,
    seq: null,
    voting: false,
    sleepers: null,

    stepClock: (dt, paused) => {
      if (get().roomClock && anchor) setLive(anchoredClock(anchor, nowSec()))
      else if (!paused) setLive(advanceClock(liveClock, dt))
      publish()
    },

    toSoloClock: () => {
      anchor = null
      stopVoting()
      setLive(useProgressStore.getState().clock)
      set({ roomClock: false, sleepers: null })
      publish()
    },

    setSoloClock: (c) => {
      setLive(c)
      publish()
    },

    toRoomClock: (time) => {
      const now = nowSec()
      anchor = { ...(time ?? toClockTime(liveClock)), at: now }
      // 다시 붙었으면 서버의 잠 표시가 지워져 있다: 내 쪽도 깬다
      stopVoting()
      setLive(anchoredClock(anchor, now))
      set({ roomClock: true, sleepers: null })
      publish()
    },

    syncRoomClock: (time) => {
      if (!get().roomClock) return
      anchor = { ...time, at: nowSec() }
      setLive(anchoredClock(anchor, anchor.at))
      publish()
    },

    roomSleepers: (n, need) => {
      const before = get().sleepers?.n ?? 0
      set({ sleepers: n > 0 ? { n, need } : null })
      if (!get().voting && n > before) notify(`😴 ${n} / ${need}명이 자고 있어요. 침대에서 E 로 같이 자면 아침이 와요`)
    },

    roomMorning: (day) => {
      get().syncRoomClock({ tm: 0, day })
      if (get().voting) {
        useProgressStore.getState().sleepWell(null)
        stopVoting()
        notify(`잘 잤어요. ${day}일차 아침, 체력 회복!`)
      } else {
        notify(`${day}일차 아침이 됐어요`)
      }
      set({ sleepers: null })
      if (!get().seq) get().startSeq('morning')
    },

    startSeq: (kind) => set({ seq: { kind, startedAt: nowSec(), switched: false } }),
    markSeqSwitched: () => set((s) => (s.seq ? { seq: { ...s.seq, switched: true } } : {})),
    endSeq: () => set({ seq: null }),
    setVoting: (on) => set({ voting: on }),

    reset: () => {
      set({ seq: null, voting: false, sleepers: null })
      get().toSoloClock()
    },
  }
})
