import { describe, expect, it } from 'vitest'
import { attackFromPointer, holdTrigger, isAimHeld, isTriggerHeld, pressAttack, pressPointer, pressReload, setTouchAim, takeAttackPress, takeReloadPress } from './pointer'

describe('휘두르기 입력', () => {
  it('마우스 잠금 중 왼쪽 = 베기·주먹, 오른쪽 = 찌르기, 가운데는 없다', () => {
    expect(attackFromPointer({ button: 0, pointerType: 'mouse' }, true, true)).toBe('primary')
    expect(attackFromPointer({ button: 2, pointerType: 'mouse' }, true, true)).toBe('secondary')
    expect(attackFromPointer({ button: 1, pointerType: 'mouse' }, true, true)).toBeNull()
  })
  it('잠기기 전 클릭은 시점 잠금용이라 휘두르지 않는다 (잠금을 못 쓰는 환경이면 늘 휘두른다)', () => {
    expect(attackFromPointer({ button: 0, pointerType: 'mouse' }, false, true)).toBeNull()
    expect(attackFromPointer({ button: 0, pointerType: 'mouse' }, false, false)).toBe('primary')
  })
  it('손가락은 시점 돌리기라 휘두르지 않는다 (폰은 휘두르기 버튼)', () => {
    expect(attackFromPointer({ button: 0, pointerType: 'touch' }, true, false)).toBeNull()
  })
  it('누른 휘두르기는 한 번만 가져간다', () => {
    pressAttack('secondary')
    expect(takeAttackPress()).toBe('secondary')
    expect(takeAttackPress()).toBeNull()
  })
})

describe('총 입력', () => {
  it('잠금을 못 쓰는 환경: 캔버스에서 왼쪽을 누르면 방아쇠, 오른쪽은 조준 (누른 채로)', () => {
    pressPointer({ button: 0, buttons: 1, pointerId: 1, clientX: 0, clientY: 0, pointerType: 'mouse' })
    expect(isTriggerHeld()).toBe(true)
    expect(isAimHeld()).toBe(false)
    pressPointer({ button: 2, buttons: 2, pointerId: 1, clientX: 0, clientY: 0, pointerType: 'mouse' })
    expect(isAimHeld()).toBe(true)
    expect(takeAttackPress()).toBe('secondary')
  })
  it('폰: 쏘기 버튼을 누르고 있는 동안 방아쇠, 조준 버튼은 켜고 끈다', () => {
    pressPointer({ button: 0, buttons: 0, pointerId: 2, clientX: 0, clientY: 0, pointerType: 'mouse' })
    holdTrigger(true)
    expect(isTriggerHeld()).toBe(true)
    holdTrigger(false)
    expect(isTriggerHeld()).toBe(false)
    setTouchAim(true)
    expect(isAimHeld()).toBe(true)
    setTouchAim(false)
    takeAttackPress()
  })
  it('R 은 한 번만 가져간다', () => {
    pressReload()
    expect(takeReloadPress()).toBe(true)
    expect(takeReloadPress()).toBe(false)
  })
})
