import { describe, expect, it } from 'vitest'
import { CHOP_PERIOD, COOK_TIMING, STALL } from '../data/cooking'
import { CHEF_IDLE, COOK_LENGTH, cookTimeline } from './cookTimeline'
import { phaseAt, timelineLength } from './timeline'

/** 단계 시작 시각 */
const startOf = (name: string) => {
  let t = 0
  for (const [p, d] of COOK_TIMING) {
    if (p === name) return t
    t += d
  }
  throw new Error(name)
}
const near = (f: { x: number; z: number }, at: [number, number]) => Math.hypot(f.x - at[0], f.z - at[1]) < 1e-6

describe('phaseAt / timelineLength', () => {
  const segs = [['a', 1], ['b', 2]] as const
  it('구간 이름과 진행도(0~1)를 돌려주고, 넘으면 end', () => {
    expect(timelineLength(segs)).toBe(3)
    expect(phaseAt(segs, 0.5)).toEqual({ phase: 'a', k: 0.5, at: 0.5 })
    expect(phaseAt(segs, 2)).toEqual({ phase: 'b', k: 0.5, at: 1 })
    expect(phaseAt(segs, 3.5).phase).toBe('end')
    expect(phaseAt(segs, -1)).toEqual({ phase: 'a', k: 0, at: 0 })
  })
})

describe('cookTimeline', () => {
  it('주문 → 썰기 → 가져가기 → 퐁당 → 보글보글 → 내오기 → 끝, 전체 5~8초', () => {
    const phases = COOK_TIMING.map(([p]) => cookTimeline(startOf(p) + 0.05, '').phase)
    expect(phases).toEqual(['take', 'chop', 'carry', 'drop', 'boil', 'serve'])
    expect(cookTimeline(COOK_LENGTH + 0.01, '')).toMatchObject({ phase: 'end', done: true, served: true })
    expect(COOK_LENGTH).toBeGreaterThanOrEqual(5)
    expect(COOK_LENGTH).toBeLessThanOrEqual(8)
  })

  it('도마에서 썰고(칼질 박자마다 strikes 증가), 냄비 앞에서 끓이고, 가운데에서 내온다', () => {
    const chop = cookTimeline(startOf('chop') + CHOP_PERIOD * 2.5, '')
    expect(near(chop.chef, STALL.board)).toBe(true)
    expect(chop.chef).toMatchObject({ pose: 'chop', strikes: 2 })
    expect(chop.chef.swing).toBeCloseTo(0.5)
    const boil = cookTimeline(startOf('boil') + 0.8, '')
    expect(near(boil.chef, STALL.pot)).toBe(true)
    expect(boil.chef.bubble).toBe('보글보글~')
    expect(boil.steam).toBeGreaterThan(0.9)
    const end = cookTimeline(COOK_LENGTH + 1, '')
    expect(near(end.chef, STALL.serve)).toBe(true)
  })

  it('생선: 도마 → 손 → 냄비로 떨어짐 → 사라짐', () => {
    expect(cookTimeline(startOf('chop') + 0.1, '').fish.at).toBe('board')
    expect(cookTimeline(startOf('carry') + 0.1, '').fish.at).toBe('hand')
    const dropping = cookTimeline(startOf('drop') + 0.3, '').fish
    expect(dropping.at).toBe('drop')
    expect(dropping.drop).toBeGreaterThan(0)
    expect(dropping.drop).toBeLessThan(1)
    expect(cookTimeline(startOf('boil') + 0.1, '').fish.at).toBe('gone')
  })

  it('내올 때 접시를 놓고 정해진 한마디를 한다', () => {
    const serveEnd = startOf('serve') + COOK_TIMING[COOK_TIMING.length - 1][1] - 0.05
    const f = cookTimeline(serveEnd, '손님 이건 서비스예요 (아님)')
    expect(f.served).toBe(true)
    expect(f.chef.bubble).toBe('손님 이건 서비스예요 (아님)')
    expect(cookTimeline(startOf('serve') + 0.05, 'x').served).toBe(false)
  })

  it('기다릴 땐 가운데에서 손님 쪽을 보고 서 있다', () => {
    expect(near(CHEF_IDLE, STALL.serve)).toBe(true)
    expect(CHEF_IDLE).toMatchObject({ pose: 'idle', facing: 0 })
  })
})
