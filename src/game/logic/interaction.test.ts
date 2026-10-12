import { describe, expect, it } from 'vitest'
import { isSameInteractable, resolveKeyAction } from './interaction'

describe('isSameInteractable', () => {
  it('같은 낚시 포인트면 true, 다른 포인트면 false', () => {
    const a = { kind: 'fishingSpot' as const, spotId: 'beach-dock' }
    expect(isSameInteractable(a, { kind: 'fishingSpot', spotId: 'beach-dock' })).toBe(true)
    expect(isSameInteractable(a, { kind: 'fishingSpot', spotId: 'beach-rocks' })).toBe(false)
  })

  it('종류가 다르거나 비어 있으면 false', () => {
    expect(isSameInteractable({ kind: 'sellBox' }, { kind: 'gearShop' })).toBe(false)
    expect(isSameInteractable(null, { kind: 'sellBox' })).toBe(false)
    expect(isSameInteractable({ kind: 'sellBox' }, { kind: 'sellBox' })).toBe(true)
  })
})

describe('resolveKeyAction', () => {
  const spot = { kind: 'fishingSpot' as const, spotId: 'beach-dock' }

  it('탐험 중 낚시 포인트에서 E를 누르면 낚시를 시작한다', () => {
    expect(resolveKeyAction('KeyE', 'explore', spot)).toEqual({ type: 'startFishing', spotId: 'beach-dock' })
  })

  it('판매함·상점에서 E를 누르면 해당 패널을 연다', () => {
    expect(resolveKeyAction('KeyE', 'explore', { kind: 'sellBox' })).toEqual({ type: 'openMode', mode: 'sell' })
    expect(resolveKeyAction('KeyE', 'explore', { kind: 'gearShop' })).toEqual({ type: 'openMode', mode: 'shop' })
  })

  it('주변에 아무것도 없거나 이미 다른 일을 하는 중이면 E는 무시한다', () => {
    expect(resolveKeyAction('KeyE', 'explore', null)).toEqual({ type: 'none' })
    expect(resolveKeyAction('KeyE', 'fishing', spot)).toEqual({ type: 'none' })
    expect(resolveKeyAction('KeyE', 'shop', { kind: 'gearShop' })).toEqual({ type: 'none' })
  })

  it('ESC: 탐험 중이면 메뉴, 낚시 중이면 낚시 중단, 패널이면 닫기', () => {
    expect(resolveKeyAction('Escape', 'explore', null)).toEqual({ type: 'openMode', mode: 'menu' })
    expect(resolveKeyAction('Escape', 'fishing', spot)).toEqual({ type: 'stopFishing' })
    expect(resolveKeyAction('Escape', 'menu', null)).toEqual({ type: 'closePanel' })
  })

  it('다른 키는 무시한다', () => {
    expect(resolveKeyAction('KeyW', 'explore', spot)).toEqual({ type: 'none' })
  })
})
