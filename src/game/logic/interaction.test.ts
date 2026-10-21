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

  it('어시장·어항은 패널을 열고, 벤치는 앉는다', () => {
    expect(resolveKeyAction('KeyE', 'explore', { kind: 'market' })).toEqual({ type: 'openMode', mode: 'market' })
    expect(resolveKeyAction('KeyE', 'explore', { kind: 'aquarium' })).toEqual({ type: 'openMode', mode: 'aquarium' })
    expect(resolveKeyAction('KeyE', 'explore', { kind: 'bench' })).toEqual({ type: 'openMode', mode: 'rest' })
  })

  it('앉아 있을 때 E나 ESC를 누르면 일어난다', () => {
    expect(resolveKeyAction('KeyE', 'rest', { kind: 'bench' })).toEqual({ type: 'closePanel' })
    expect(resolveKeyAction('Escape', 'rest', { kind: 'bench' })).toEqual({ type: 'closePanel' })
  })

  it('패널이 열려 있을 때 E는 아무 일도 하지 않는다', () => {
    expect(resolveKeyAction('KeyE', 'market', { kind: 'market' })).toEqual({ type: 'none' })
  })

  it('옷장에서 E를 누르면 꾸미기 화면을 연다', () => {
    expect(resolveKeyAction('KeyE', 'explore', { kind: 'wardrobe' })).toEqual({ type: 'openMode', mode: 'wardrobe' })
  })

  it('처음 캐릭터를 만드는 중(잠금)엔 ESC로 닫히지 않는다', () => {
    expect(resolveKeyAction('Escape', 'wardrobe', null, true)).toEqual({ type: 'none' })
    expect(resolveKeyAction('Escape', 'wardrobe', null, false)).toEqual({ type: 'closePanel' })
  })
})
