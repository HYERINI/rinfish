import { describe, expect, it } from 'vitest'
import { firstAimRay, rayPoint, solveFirst, solveThird, thirdAimRay, type AimRay, type AimRig } from './aimAnchor'
import type { V3 } from './hitscan'

const H = 1.8
/** 총을 들고 돌아다닐 때 (4m, 어깨 너머 0.65m) 와 권총으로 조준할 때 (1.9m) */
const HIP: AimRig = { distance: 4, low: 1, shoulder: 0.65 }
const AIM: AimRig = { distance: 1.9, low: 1, shoulder: 0.65 }

/** 점 p 가 광선에서 벗어난 거리 (m) */
function miss(ray: AimRay, p: V3): number {
  const v = { x: p.x - ray.o.x, y: p.y - ray.o.y, z: p.z - ray.o.z }
  const t = v.x * ray.d.x + v.y * ray.d.y + v.z * ray.d.z
  const q = rayPoint(ray, t)
  return Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z)
}

describe('조준점 지키기', () => {
  it('3인칭 광선은 길이 1 이고, pitch 를 올리면 더 아래를 본다', () => {
    const a = thirdAimRay(0, 0, 0, 0, 0, HIP, H)
    expect(Math.hypot(a.d.x, a.d.y, a.d.z)).toBeCloseTo(1)
    // yaw 0 이면 카메라는 +z 쪽에 있고 -z 를 본다. 시선점은 오른쪽(+x)으로 0.65m
    expect(a.d.z).toBeLessThan(0)
    expect(a.o.x).toBeCloseTo(0.65)
    expect(thirdAimRay(0, 0, 0, 0, 0.3, HIP, H).d.y).toBeLessThan(a.d.y)
  })
  it('고치기 전: 같은 yaw·pitch 로 조준경(1인칭)을 보면 20m 앞에서 몇 m 나 어긋난다', () => {
    const p = rayPoint(thirdAimRay(10, 0, -5, 0.7, 0.1, HIP, H), 20)
    const eye = { x: 10, y: H * 0.92, z: -5 }
    expect(miss(firstAimRay(eye, 0.7, -0.1), p)).toBeGreaterThan(3)
  })
  it('조준경으로 들어갈 때: 3인칭 조준선이 닿던 점을 1인칭 화면 가운데에 둔다', () => {
    for (const [yaw, pitch, far] of [[0.7, 0.1, 20], [-2.4, -0.3, 6], [3.5, 0.6, 60]] as const) {
      const p = rayPoint(thirdAimRay(10, 0, -5, yaw, pitch, HIP, H), far)
      const eye = { x: 10, y: H * 0.92, z: -5 }
      const s = solveFirst(eye, p, yaw)
      expect(miss(firstAimRay(eye, s.yaw, s.tilt), p)).toBeLessThan(1e-6)
      // 어깨 너머에서 눈으로 옮긴 만큼만 돈다 (한 바퀴 튀지 않는다)
      expect(Math.abs(s.yaw - yaw)).toBeLessThan(0.2)
    }
  })
  it('조준경에서 나올 때: 조준경 가운데가 닿던 점을 3인칭 조준선에 둔다', () => {
    for (const [yaw, tilt, far] of [[0.7, -0.1, 20], [-2.4, 0.2, 8], [9.1, -0.4, 45]] as const) {
      const eye = { x: 10, y: H * 0.92, z: -5 }
      const p = rayPoint(firstAimRay(eye, yaw, tilt), far)
      const s = solveThird(10, 0, -5, p, yaw, HIP, H)
      expect(miss(thirdAimRay(10, 0, -5, s.yaw, s.pitch, HIP, H), p)).toBeLessThan(1e-4)
      expect(Math.abs(s.yaw - yaw)).toBeLessThan(0.2)
    }
  })
  it('권총 조준 (카메라 4m → 1.9m): 고치기 전엔 어긋나고, 다시 풀면 같은 점을 본다', () => {
    const p = rayPoint(thirdAimRay(0, 0, 0, 1.2, 0.05, HIP, H), 15)
    expect(miss(thirdAimRay(0, 0, 0, 1.2, 0.05, AIM, H), p)).toBeGreaterThan(1)
    const s = solveThird(0, 0, 0, p, 1.2, AIM, H)
    expect(miss(thirdAimRay(0, 0, 0, s.yaw, s.pitch, AIM, H), p)).toBeLessThan(1e-4)
  })
  it('들어갔다 그대로 나오면 처음 yaw·pitch 로 돌아온다', () => {
    const p = rayPoint(thirdAimRay(3, 0.5, 4, 2.2, 0.15, HIP, H), 30)
    const eye = { x: 3, y: 0.5 + H * 0.92, z: 4 }
    const f = solveFirst(eye, p, 2.2)
    expect(miss(firstAimRay(eye, f.yaw, f.tilt), p)).toBeLessThan(1e-6)
    const back = solveThird(3, 0.5, 4, p, f.yaw, HIP, H)
    expect(back.yaw).toBeCloseTo(2.2, 6)
    expect(back.pitch).toBeCloseTo(0.15, 5)
  })
  it('점이 어깨 비킴보다 가까우면 yaw 를 그대로 둔다. pitch 는 돌릴 수 있는 범위 안', () => {
    const s = solveThird(0, 0, 0, { x: 0.1, y: 30, z: 0.1 }, 0.4, HIP, H)
    expect(s.yaw).toBe(0.4)
    expect(s.pitch).toBe(-1)
  })
})
