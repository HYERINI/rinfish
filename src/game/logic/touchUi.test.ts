import { describe, expect, it } from 'vitest'
import { gestureStep, nextTouchUi, type Point } from './touchUi'

describe('nextTouchUi', () => {
  it('손가락으로 누르면 켜고, 마우스 컴퓨터에서 마우스를 쓰면 끈다', () => {
    expect(nextTouchUi(false, 'touch', false)).toBe(true)
    expect(nextTouchUi(true, 'mouse', false)).toBe(false)
  })

  it('손가락 기기에선 마우스를 써도 그대로, 펜도 그대로', () => {
    expect(nextTouchUi(true, 'mouse', true)).toBe(true)
    expect(nextTouchUi(false, 'pen', false)).toBe(false)
  })
})

describe('gestureStep', () => {
  const at = (...pts: [number, Point][]) => new Map(pts)

  it('한 손가락: 움직인 만큼 시점 돌리기 (좌우·위아래)', () => {
    expect(gestureStep(at([1, { x: 100, y: 100 }]), 1, { x: 130, y: 90 })).toEqual({ dx: 30, dy: -10, pinch: null })
  })

  it('누르지 않은 포인터는 무시', () => {
    expect(gestureStep(at([1, { x: 0, y: 0 }]), 2, { x: 50, y: 0 })).toEqual({ dx: 0, dy: 0, pinch: null })
  })

  it('두 손가락: 사이 거리로 확대·축소, 시점은 돌리지 않는다', () => {
    const step = gestureStep(at([1, { x: 0, y: 0 }], [2, { x: 100, y: 0 }]), 2, { x: 200, y: 0 })
    expect(step.dx).toBe(0)
    expect(step.pinch).toEqual({ prevSpan: 100, span: 200 })
  })

  it('세 번째 손가락은 무시한다', () => {
    const step = gestureStep(at([1, { x: 0, y: 0 }], [2, { x: 100, y: 0 }], [3, { x: 50, y: 50 }]), 3, { x: 80, y: 80 })
    expect(step).toEqual({ dx: 0, dy: 0, pinch: null })
  })
})
