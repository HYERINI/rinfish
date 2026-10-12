import { describe, expect, it } from 'vitest'
import { isSameInteractable } from './interaction'

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
