import { describe, expect, it } from 'vitest'
import { FEEDING_SHOW_SECONDS, swimPose, swimSeed } from './aquariumSwim'

const half: [number, number, number] = [2, 1, 1]
/** makeId() 처럼 생긴 물고기 id 12개 */
const IDS = ['mh1k2a0x9fq3', 'mh1k2a3bd81z', 'mh1k2b7c0kpa', 'mh1k2c1x5o2m', 'mh1k2d9qk3vt', 'mh1k2f0a7wn4', 'mh1k2g2ze1rb', 'mh1k2h5mm8yc', 'mh1k2j8tq0ud', 'mh1k2k1bv6se', 'mh1k2m4hx2pf', 'mh1k2n7cz9lg']

describe('swimSeed', () => {
  it('0 이상 1 미만이고 같은 id 면 같은 값이다', () => {
    for (const id of IDS) {
      const s = swimSeed(id)
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThan(1)
      expect(swimSeed(id)).toBe(s)
    }
    expect(new Set(IDS.map(swimSeed)).size).toBe(IDS.length)
  })
})

describe('swimPose', () => {
  it('늘 어항 안에 있다', () => {
    for (const id of IDS) {
      const seed = swimSeed(id)
      for (let t = 0; t < 120; t += 0.37) {
        for (const sinceFed of [999, 1]) {
          const p = swimPose(t, seed, half, false, sinceFed)
          expect(Math.abs(p.x)).toBeLessThanOrEqual(half[0])
          expect(Math.abs(p.y)).toBeLessThanOrEqual(half[1])
          expect(Math.abs(p.z)).toBeLessThanOrEqual(half[2])
        }
      }
    }
  })

  it('두 마리가 같은 길을 겹쳐 돌지 않는다', () => {
    const seeds = IDS.map(swimSeed)
    let total = 0
    let pairs = 0
    for (let a = 0; a < seeds.length; a++) {
      for (let b = a + 1; b < seeds.length; b++) {
        let close = 0
        let samples = 0
        for (let t = 0; t < 300; t += 0.5) {
          const p = swimPose(t, seeds[a], half, false, 999)
          const q = swimPose(t, seeds[b], half, false, 999)
          // 어항 크기로 나눈 앞뒤·좌우 거리가 0.3 보다 가까우면 겹친 것으로 본다
          if (Math.hypot((p.x - q.x) / half[0], (p.z - q.z) / half[2]) < 0.3) close++
          samples++
        }
        // 지나치며 잠깐 스치는 것은 괜찮지만 계속 붙어 다니면 안 된다
        expect(close / samples).toBeLessThan(0.3)
        total += close / samples
        pairs++
      }
    }
    expect(total / pairs).toBeLessThan(0.15)
  })

  it('배고프면 restY 높이로 가라앉아 옆으로 눕는다', () => {
    const p = swimPose(5, swimSeed('a'), half, true, 999, -0.7)
    expect(p.y).toBeCloseTo(-0.7)
    expect(p.tilt).toBeCloseTo(Math.PI / 2)
  })

  it('먹이를 막 주면 수면 가까이 물고기마다 다른 자리에 모인다', () => {
    const poses = IDS.map((id) => swimPose(5, swimSeed(id), half, false, FEEDING_SHOW_SECONDS / 2))
    for (const p of poses) expect(p.y).toBeGreaterThan(half[1] * 0.6)
    // 한 점에 뭉치지 않는다: 가장 가까운 짝끼리도 대부분 떨어져 있다
    const spread = poses.map((p, i) =>
      Math.min(...poses.filter((_, j) => j !== i).map((q) => Math.hypot(p.x - q.x, p.z - q.z))),
    )
    expect(spread.filter((d) => d > 0.05).length).toBeGreaterThanOrEqual(IDS.length - 2)
    const xs = poses.map((p) => p.x)
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(half[0] * 0.5)
  })
})
