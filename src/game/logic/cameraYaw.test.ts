import { describe, expect, it } from 'vitest'
import { FISHING_SPOTS } from '../data/zones'
import { shortestAngleDelta, yawForFacing } from './cameraYaw'

/** 카메라 위치 오프셋(플레이어 기준)에서 플레이어를 보는 시선 방향 */
function viewDir(yaw: number): [number, number] {
  return [-Math.sin(yaw), -Math.cos(yaw)]
}

describe('yawForFacing', () => {
  it('facing (0,1) 이면 π: 카메라가 플레이어 뒤(z가 작은 쪽)에 선다', () => {
    expect(yawForFacing([0, 1])).toBeCloseTo(Math.PI)
    expect(Math.cos(yawForFacing([0, 1]))).toBeCloseTo(-1) // 카메라 오프셋 z = -D
  })

  it('모든 낚시 포인트에서 시선이 facing과 일치한다', () => {
    for (const spot of FISHING_SPOTS) {
      const [vx, vz] = viewDir(yawForFacing(spot.facing))
      expect(vx).toBeCloseTo(spot.facing[0])
      expect(vz).toBeCloseTo(spot.facing[1])
    }
  })
})

describe('shortestAngleDelta', () => {
  it('2π 경계를 넘어도 가까운 쪽으로 돈다', () => {
    expect(shortestAngleDelta(0.1, Math.PI * 2 - 0.1)).toBeCloseTo(-0.2)
    expect(shortestAngleDelta(0, 1)).toBeCloseTo(1)
  })
})
