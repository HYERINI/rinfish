import { describe, expect, it } from 'vitest'
import { CAMERA_ZOOM } from '../data/balance'
import { canZoom, nextZoom, pinchZoom } from './cameraZoom'

describe('nextZoom', () => {
  it('휠을 아래로 굴리면(양수) 멀어지고, 위로 굴리면 가까워진다', () => {
    expect(nextZoom(10, 100)).toBeGreaterThan(10)
    expect(nextZoom(10, -100)).toBeLessThan(10)
  })

  it('범위를 넘지 않는다', () => {
    expect(nextZoom(10, 100000)).toBe(CAMERA_ZOOM.max)
    expect(nextZoom(10, -100000)).toBe(CAMERA_ZOOM.min)
  })

  it('이상한 입력이면 그대로 둔다', () => {
    expect(nextZoom(10, Number.NaN)).toBe(10)
  })
})

describe('pinchZoom', () => {
  it('손가락을 벌리면 가까이, 오므리면 멀리 (사이 거리에 반비례)', () => {
    expect(pinchZoom(10, 100, 200)).toBeCloseTo(5)
    expect(pinchZoom(5, 200, 100)).toBeCloseTo(10)
  })

  it('범위를 넘지 않고, 이상한 값이면 그대로', () => {
    expect(pinchZoom(10, 10, 1000)).toBe(CAMERA_ZOOM.min)
    expect(pinchZoom(10, 1000, 10)).toBe(CAMERA_ZOOM.max)
    expect(pinchZoom(10, 0, 100)).toBe(10)
    expect(pinchZoom(10, 100, Number.NaN)).toBe(10)
  })
})

describe('canZoom', () => {
  it('탐험·낚시·휴식 중에만 줌한다 (패널이 열려 있으면 휠은 패널 스크롤)', () => {
    expect(canZoom('explore')).toBe(true)
    expect(canZoom('fishing')).toBe(true)
    expect(canZoom('rest')).toBe(true)
    for (const mode of ['menu', 'dex', 'sell', 'shop', 'market', 'aquarium', 'aquariumView', 'wardrobe'] as const) expect(canZoom(mode)).toBe(false)
  })
})
