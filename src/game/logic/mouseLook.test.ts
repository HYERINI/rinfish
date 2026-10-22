import { describe, expect, it } from 'vitest'
import { MOUSE_LOOK } from '../data/settings'
import { applyMouseLook, canLockPointer, clampPitch, pitchedOffset, shouldOpenMenuOnUnlock } from './mouseLook'

describe('applyMouseLook', () => {
  it('마우스를 오른쪽으로 움직이면 yaw 가 감도만큼 줄어든다', () => {
    const v = applyMouseLook({ yaw: 1, pitch: 0 }, 100, 0, 0.0025, false)
    expect(v.yaw).toBeCloseTo(1 - 0.25)
    expect(v.pitch).toBe(0)
  })

  it('감도가 두 배면 두 배로 돈다', () => {
    const a = applyMouseLook({ yaw: 0, pitch: 0 }, 40, 0, 0.002, false)
    const b = applyMouseLook({ yaw: 0, pitch: 0 }, 40, 0, 0.004, false)
    expect(b.yaw).toBeCloseTo(a.yaw * 2)
  })

  it('마우스를 아래로 내리면 pitch 가 오르고, 반전하면 반대로', () => {
    expect(applyMouseLook({ yaw: 0, pitch: 0 }, 0, 40, 0.0025, false).pitch).toBeCloseTo(0.1)
    expect(applyMouseLook({ yaw: 0, pitch: 0 }, 0, 40, 0.0025, true).pitch).toBeCloseTo(-0.1)
  })

  it('pitch 는 범위 안에 머문다', () => {
    expect(applyMouseLook({ yaw: 0, pitch: 0 }, 0, 100000, 0.0025, false).pitch).toBe(MOUSE_LOOK.maxPitch)
    expect(applyMouseLook({ yaw: 0, pitch: 0 }, 0, -100000, 0.0025, false).pitch).toBe(MOUSE_LOOK.minPitch)
    expect(clampPitch(0.1)).toBe(0.1)
  })

  it('이상한 값(NaN)은 무시한다', () => {
    expect(applyMouseLook({ yaw: 0.5, pitch: 0.1 }, Number.NaN, Number.NaN, 0.0025, false)).toEqual({ yaw: 0.5, pitch: 0.1 })
  })
})

describe('pitchedOffset', () => {
  it('pitch 0 이면 줌 리그 자리 그대로', () => {
    expect(pitchedOffset(10, 8, 1, 0)).toEqual({ horizontal: 10, height: 8 })
  })

  it('pitch 를 올리면 더 높이, 수평으로는 더 가깝게. 시선까지 거리는 그대로', () => {
    const r = pitchedOffset(10, 8, 1, 0.3)
    expect(r.height).toBeGreaterThan(8)
    expect(r.horizontal).toBeLessThan(10)
    expect(Math.hypot(r.horizontal, r.height - 1)).toBeCloseTo(Math.hypot(10, 7))
  })

  it('pitch 를 내려도 땅을 뚫지 않는다', () => {
    const r = pitchedOffset(1.5, 1.4, 1.3, MOUSE_LOOK.minPitch)
    expect(r.height).toBeGreaterThanOrEqual(MOUSE_LOOK.minCameraHeight)
    const far = pitchedOffset(18, 13, 0.8, -10)
    expect(far.height).toBeGreaterThanOrEqual(MOUSE_LOOK.minCameraHeight)
  })

  it('머리 위로 넘어가지 않는다', () => {
    expect(pitchedOffset(1.5, 20, 1, 10).horizontal).toBeGreaterThan(0)
  })
})

describe('마우스 잠금', () => {
  it('탐험 중에만 잠글 수 있다', () => {
    expect(canLockPointer('explore')).toBe(true)
    expect(canLockPointer('rest')).toBe(true)
    expect(canLockPointer('fishing')).toBe(false)
    expect(canLockPointer('menu')).toBe(false)
    expect(canLockPointer('wardrobe')).toBe(false)
  })

  it('탐험 중 ESC 로 잠금이 풀리면 메뉴를 열고, 게임이 푼 거면 열지 않는다', () => {
    expect(shouldOpenMenuOnUnlock('explore', false)).toBe(true)
    expect(shouldOpenMenuOnUnlock('explore', true)).toBe(false)
    expect(shouldOpenMenuOnUnlock('shop', false)).toBe(false)
  })
})
