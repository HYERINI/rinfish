import { describe, expect, it } from 'vitest'
import { MAP_BOUNDS, MAP_PX_PER_M, fitBigMap, mapPixel, miniMapPoint } from './mapView'

const close = (a: [number, number], b: [number, number]) => {
  expect(a[0]).toBeCloseTo(b[0])
  expect(a[1]).toBeCloseTo(b[1])
}

describe('정적 지도 픽셀', () => {
  it('왼쪽 위가 MAP_BOUNDS 의 (x0, z0), 위 = 북(-z), 오른쪽 = 동(+x)', () => {
    expect(mapPixel(MAP_BOUNDS.x0, MAP_BOUNDS.z0)).toEqual([0, 0])
    expect(mapPixel(MAP_BOUNDS.x0 + 10, MAP_BOUNDS.z0 + 5)).toEqual([10 * MAP_PX_PER_M, 5 * MAP_PX_PER_M])
  })
  it('섬과 초원이 모두 들어간다', () => {
    expect(MAP_BOUNDS.x0).toBeLessThan(-30)
    expect(MAP_BOUNDS.x1).toBeGreaterThan(290)
    expect(MAP_BOUNDS.z0).toBeLessThan(-110)
    expect(MAP_BOUNDS.z1).toBeGreaterThan(90)
  })
})

describe('미니맵 (카메라 방향이 위)', () => {
  it('카메라 yaw 0 이면 카메라가 -z(북)를 보므로 북이 위, 동이 오른쪽', () => {
    close(miniMapPoint(0, -10, 0, 1), [0, -10])
    close(miniMapPoint(10, 0, 0, 1), [10, 0])
  })
  it('카메라가 동쪽을 보면(yaw -π/2) 동쪽이 위', () => {
    // 앞 = (-sin yaw, -cos yaw) = (1, 0) 동쪽
    close(miniMapPoint(10, 0, -Math.PI / 2, 1), [0, -10])
  })
  it('캔버스 rotate(yaw) 와 같은 변환이다 (그림과 점이 같이 돈다)', () => {
    const yaw = 0.7
    const [dx, dz] = [3, -4]
    const canvas: [number, number] = [dx * Math.cos(yaw) - dz * Math.sin(yaw), dx * Math.sin(yaw) + dz * Math.cos(yaw)]
    close(miniMapPoint(dx, dz, yaw, 1), canvas)
  })
})

describe('큰 지도', () => {
  it('화면에 맞게 줄이고 가운데에 둔다', () => {
    const w = MAP_BOUNDS.x1 - MAP_BOUNDS.x0
    const h = MAP_BOUNDS.z1 - MAP_BOUNDS.z0
    const f = fitBigMap(w, h * 2)
    expect(f.scale).toBeCloseTo(1)
    expect(f.ox).toBeCloseTo(0)
    expect(f.oy).toBeCloseTo(h / 2)
  })
})
