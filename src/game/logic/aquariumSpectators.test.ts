import { describe, expect, it } from 'vitest'
import { SPECTATOR } from '../data/aquariumVisitors'
import { spectatorPeriod, spectatorPlan, spectatorPose } from './aquariumSpectators'

const SEED = 3

describe('spectatorPlan', () => {
  it('가장 느린 어른도 한 바퀴 안에 화면을 다 지나간다', () => {
    for (let lane = 0; lane < SPECTATOR.lanes; lane++) {
      for (let visit = 0; visit < 80; visit++) {
        const p = spectatorPlan(SEED, lane, visit)
        expect(p.walkIn + p.walkOut + p.stopFor).toBeLessThan(spectatorPeriod(lane))
        if (p.stopAt !== null) {
          expect(p.stopAt).toBeGreaterThanOrEqual(SPECTATOR.stopRange[0] - 1e-9)
          expect(p.stopAt).toBeLessThanOrEqual(SPECTATOR.stopRange[1] + 1e-9)
        }
      }
    }
  })

  it('아이도 있고 어른도 있고, 지나가기만 하는 사람도 있다', () => {
    const plans = Array.from({ length: 80 }, (_, v) => spectatorPlan(SEED, v % 4, v))
    expect(plans.some((p) => p.kid)).toBe(true)
    expect(plans.some((p) => !p.kid)).toBe(true)
    expect(plans.some((p) => p.stopAt === null)).toBe(true)
    expect(new Set(plans.map((p) => p.act)).size).toBe(3)
  })
})

describe('spectatorPose', () => {
  it('같은 시각이면 같은 모습', () => {
    expect(spectatorPose(SEED, 1, 77.7)).toEqual(spectatorPose(SEED, 1, 77.7))
  })

  it('화면 밖에서 들어와 멈췄다가 반대쪽으로 나간다', () => {
    for (let lane = 0; lane < 3; lane++) {
      let prev = spectatorPose(SEED, lane, 0)
      const acts = new Set<string>()
      for (let t = 0.1; t < 400; t += 0.1) {
        const p = spectatorPose(SEED, lane, t)
        if (p.visible && prev.visible && p.visit === prev.visit) {
          // 걷는 방향으로만 조금씩 움직인다 (뒤로 가거나 순간이동하지 않는다)
          const moved = (p.x - prev.x) * p.dir
          expect(moved).toBeGreaterThanOrEqual(-1e-9)
          expect(moved).toBeLessThan(0.01)
        }
        if (p.visible) {
          expect(p.x).toBeGreaterThanOrEqual(-SPECTATOR.edge - 1e-9)
          expect(p.x).toBeLessThanOrEqual(1 + SPECTATOR.edge + 1e-9)
          acts.add(p.act)
          if (p.act === 'walk') expect(p.lift).toBe(0)
          else expect(p.step).toBe(0)
        }
        prev = p
      }
      expect(acts.has('walk')).toBe(true)
    }
  })

  it('팔은 천천히 올렸다 내린다', () => {
    let found = false
    for (let t = 0; t < 2000 && !found; t += 0.05) {
      const p = spectatorPose(SEED, 0, t)
      if (p.act === 'point' || p.act === 'glass') {
        const q = spectatorPose(SEED, 0, t + 0.05)
        expect(Math.abs(q.lift - p.lift)).toBeLessThanOrEqual(0.05 / SPECTATOR.liftSeconds + 1e-9)
        if (p.lift === 1) found = true
      }
    }
    expect(found).toBe(true)
  })
})
