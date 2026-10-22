import { CHOP_PERIOD, COOK_TIMING, SERVE_WALK, STALL } from '../data/cooking'
import type { Vec2 } from '../data/repair'
import type { WorkerFrame } from './repairTimeline'
import { phaseAt, timelineLength } from './timeline'

/** 생선이 어디 있나: 도마 위 → 손에 → 냄비로 떨어지는 중(drop 0~1) → 냄비 속(안 보임) */
export type FishAt = 'board' | 'hand' | 'drop' | 'gone'

export type CookFrame = {
  phase: (typeof COOK_TIMING)[number][0] | 'end'
  /** 사장님 (가게 안쪽 좌표). swing/strikes 는 칼질 */
  chef: WorkerFrame
  fish: { at: FishAt; drop: number }
  /** 냄비 김 세기 0~1 */
  steam: number
  /** 다 된 요리가 조리대에 놓였나 */
  served: boolean
  /** 연출이 끝났나 */
  done: boolean
}

export const COOK_LENGTH = timelineLength(COOK_TIMING)

const ease = (k: number) => {
  const c = Math.min(1, Math.max(0, k))
  return c * c * (3 - 2 * c)
}
const heading = (a: Vec2, b: Vec2) => Math.atan2(b[0] - a[0], b[1] - a[1])

function walk(from: Vec2, to: Vec2, k: number): WorkerFrame {
  const e = ease(k)
  return { x: from[0] + (to[0] - from[0]) * e, z: from[1] + (to[1] - from[1]) * e, facing: heading(from, to), pose: 'walk', bubble: null, swing: null, strikes: 0 }
}

const stand = (at: Vec2, bubble: string | null = null): WorkerFrame => ({ x: at[0], z: at[1], facing: 0, pose: 'idle', bubble, swing: null, strikes: 0 })

/** 손님을 기다릴 때 사장님 모습 */
export const CHEF_IDLE: WorkerFrame = stand(STALL.serve)

/**
 * 요리 연출 시각 t(초) → 그 순간 모습. line 은 내올 때 사장님이 하는 말.
 * 같은 t 면 늘 같은 결과라서 시작 시각만 있으면 어디서든 다시 그릴 수 있다
 */
export function cookTimeline(t: number, line: string): CookFrame {
  const { phase, k, at } = phaseAt(COOK_TIMING, t)
  const base = { fish: { at: 'board' as FishAt, drop: 0 }, steam: 0, served: false, done: false }
  switch (phase) {
    case 'take': {
      const chef = k < 0.5 ? { ...stand(STALL.serve, '주문 들어왔습니다~!') } : { ...walk(STALL.serve, STALL.board, (k - 0.5) * 2), bubble: '주문 들어왔습니다~!' }
      return { phase, chef, ...base }
    }
    case 'chop': {
      const beats = at / CHOP_PERIOD
      return { phase, chef: { ...stand(STALL.board), pose: 'chop', swing: beats % 1, strikes: Math.floor(beats) }, ...base }
    }
    case 'carry':
      return { phase, chef: walk(STALL.board, STALL.pot, k), ...base, fish: { at: 'hand', drop: 0 } }
    case 'drop':
      return { phase, chef: stand(STALL.pot, '퐁당!'), ...base, fish: { at: 'drop', drop: ease(k) } }
    case 'boil':
      return { phase, chef: stand(STALL.pot, '보글보글~'), ...base, fish: { at: 'gone', drop: 1 }, steam: ease(k * 3) }
    case 'serve': {
      const walking = k < SERVE_WALK
      const chef = walking ? walk(STALL.pot, STALL.serve, k / SERVE_WALK) : stand(STALL.serve, line)
      return { phase, chef, fish: { at: 'gone', drop: 1 }, steam: 1 - k, served: !walking, done: false }
    }
    case 'end':
      return { phase, chef: stand(STALL.serve), fish: { at: 'gone', drop: 1 }, steam: 0, served: true, done: true }
  }
}
