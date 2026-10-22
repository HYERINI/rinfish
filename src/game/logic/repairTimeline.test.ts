import { describe, expect, it } from 'vitest'
import { CAVE_ROCK, HAMMER_TIMING, PUSH_TIMING, REPAIR_PLANS } from '../data/repair'
import { repairDuration, repairTimeline } from './repairTimeline'

const bridge = REPAIR_PLANS.pond
const rock = REPAIR_PLANS.cave
const dist = (a: { x: number; z: number }, b: [number, number]) => Math.hypot(a.x - b[0], a.z - b[1])

describe('repairTimeline (망치질)', () => {
  it('걸어오기 → 망치질 → 다 됐다 → 걸어 나가기 → 끝 순서로 진행한다', () => {
    const phases = [0, 1, 3, 5, 6.2, 7.2, 9, 10, 20].map((t) => repairTimeline(bridge, t).phase)
    expect(phases).toEqual(['arrive', 'arrive', 'work', 'work', 'work', 'done', 'leave', 'end', 'end'])
    expect(repairDuration('hammer')).toBeCloseTo(9.8)
    expect(repairDuration('hammer')).toBeGreaterThanOrEqual(6)
    expect(repairDuration('push')).toBeLessThanOrEqual(10.5)
  })

  it('처음과 끝엔 기사님이 나타나는 자리(from)에 있고, 망치질 중엔 작업 자리에서 무릎 꿇는다', () => {
    const start = repairTimeline(bridge, 0)
    const work = repairTimeline(bridge, HAMMER_TIMING.arrive + 1)
    const end = repairTimeline(bridge, 30)
    bridge.workers.forEach((w, i) => {
      expect(dist(start.workers[i], w.from)).toBeCloseTo(0)
      expect(dist(work.workers[i], w.work!)).toBeCloseTo(0)
      expect(work.workers[i].pose).toBe('fix')
      expect(dist(end.workers[i], w.from)).toBeCloseTo(0)
    })
    expect(start.workers[0].pose).toBe('walk')
  })

  it('fixAt 초부터 고친 모습이고 그 뒤로는 계속 고친 모습이다', () => {
    const fixT = HAMMER_TIMING.arrive + HAMMER_TIMING.fixAt
    expect(repairTimeline(bridge, fixT - 0.01).fixed).toBe(false)
    for (const t of [fixT, fixT + 1, 9, 50]) expect(repairTimeline(bridge, t).fixed).toBe(true)
  })

  it('망치는 hitPeriod 마다 한 번씩 내리치고, 두 분이 반 박자 엇갈린다', () => {
    const t0 = HAMMER_TIMING.arrive
    const a = repairTimeline(bridge, t0 + HAMMER_TIMING.hitPeriod * 2.25)
    expect(a.workers[0].strikes).toBe(2)
    expect(a.workers[0].swing).toBeCloseTo(0.25)
    expect(a.workers[1].swing).toBeCloseTo(0.75)
    expect(repairTimeline(bridge, 0.5).workers[0].swing).toBeNull()
  })

  it('망치질 중엔 "뚝딱뚝딱", 끝나면 다 고쳤다고 말한다', () => {
    expect(repairTimeline(bridge, HAMMER_TIMING.arrive + 0.5).workers[0].bubble).toBe('뚝딱뚝딱!')
    expect(repairTimeline(bridge, HAMMER_TIMING.arrive + HAMMER_TIMING.work + 0.3).workers[0].bubble).toBe('다 고쳤어요!')
  })
})

describe('repairTimeline (바위 밀기)', () => {
  const pushStart = PUSH_TIMING.arrive + PUSH_TIMING.brace
  const pushEnd = pushStart + PUSH_TIMING.push

  it('바위는 미는 동안에만 0 → 1 로 늘 앞으로 움직이고, 끝나면 rockTo 에 있다', () => {
    expect(repairTimeline(rock, pushStart).progress).toBe(0)
    let last = -1
    for (let t = pushStart; t <= pushEnd; t += 0.2) {
      const p = repairTimeline(rock, t).progress
      expect(p).toBeGreaterThanOrEqual(last)
      last = p
    }
    const after = repairTimeline(rock, pushEnd + 0.1)
    expect(after.progress).toBe(1)
    expect(after.fixed).toBe(true)
    expect(dist(after.rock, rock.rockTo!)).toBeCloseTo(0)
    expect(after.rock.roll).toBeGreaterThan(0)
    expect(repairTimeline(rock, pushEnd - 0.1).fixed).toBe(false)
  })

  it('둘이 바위 뒤(미는 방향 반대쪽)에 붙어 바위와 같이 움직인다', () => {
    for (const t of [pushStart + 0.5, pushStart + 2, pushEnd - 0.1]) {
      const f = repairTimeline(rock, t)
      for (const w of f.workers) {
        expect(w.pose).toBe('push')
        expect(Math.hypot(w.x - f.rock.x, w.z - f.rock.z)).toBeGreaterThan(CAVE_ROCK.radius)
        expect(Math.hypot(w.x - f.rock.x, w.z - f.rock.z)).toBeLessThan(CAVE_ROCK.radius + 1.5)
        // 바위 쪽을 본다
        const toRock = Math.atan2(f.rock.x - w.x, f.rock.z - w.z)
        expect(Math.abs(Math.atan2(Math.sin(toRock - w.facing), Math.cos(toRock - w.facing)))).toBeLessThan(0.6)
      }
    }
  })

  it('둘이 번갈아 "영차!" 를 외친다', () => {
    const a = repairTimeline(rock, pushStart + 0.1).workers.map((w) => w.bubble)
    const b = repairTimeline(rock, pushStart + PUSH_TIMING.heavePeriod + 0.1).workers.map((w) => w.bubble)
    expect(a).toEqual(['영차!', null])
    expect(b).toEqual([null, '영차!'])
  })

  it('다 끝나면 기사님들은 나타났던 자리로 돌아가 phase 가 end 가 된다', () => {
    const end = repairTimeline(rock, repairDuration('push') + 0.01)
    expect(end.phase).toBe('end')
    rock.workers.forEach((w, i) => expect(dist(end.workers[i], w.from)).toBeCloseTo(0))
  })
})
