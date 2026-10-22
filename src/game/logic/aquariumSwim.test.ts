import { describe, expect, it } from 'vitest'
import { FEEDING_SHOW_SECONDS, swimPose } from './aquariumSwim'

const half: [number, number, number] = [2, 1, 1]

describe('swimPose', () => {
  it('늘 어항 안에 있다', () => {
    for (let t = 0; t < 50; t += 0.37) {
      const p = swimPose(t, 3, half, false, 999)
      expect(Math.abs(p.x)).toBeLessThanOrEqual(half[0])
      expect(Math.abs(p.y)).toBeLessThanOrEqual(half[1])
      expect(Math.abs(p.z)).toBeLessThanOrEqual(half[2])
    }
  })

  it('배고프면 바닥 가까이 가라앉아 옆으로 눕는다', () => {
    const p = swimPose(5, 1, half, true, 999)
    expect(p.y).toBeCloseTo(-0.8)
    expect(p.tilt).toBeCloseTo(Math.PI / 2)
  })

  it('먹이를 막 주면 수면 가운데로 몰려든다', () => {
    const p = swimPose(5, 1, half, false, FEEDING_SHOW_SECONDS / 2)
    expect(p.y).toBeCloseTo(0.75)
    expect(Math.abs(p.x)).toBeLessThanOrEqual(half[0] * 0.25)
  })
})
