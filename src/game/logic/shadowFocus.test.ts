import { describe, expect, it } from 'vitest'
import { SHADOW_AHEAD, shadowFocus } from './shadowFocus'

describe('shadowFocus (그림자 범위 가운데)', () => {
  it('카메라가 보는 쪽(땅 위 방향)으로 SHADOW_AHEAD 만큼 앞', () => {
    expect(shadowFocus(10, 5, 0, -1)).toEqual([10, 5 - SHADOW_AHEAD])
  })
  it('위아래 기울기는 빼고 땅 위 방향만 본다', () => {
    const [x, z] = shadowFocus(0, 0, 3, 0)
    expect(x).toBeCloseTo(SHADOW_AHEAD)
    expect(z).toBeCloseTo(0)
  })
  it('바로 아래를 보면 (땅 위 방향이 거의 없으면) 플레이어 자리 그대로', () => {
    expect(shadowFocus(4, -2, 0, 0)).toEqual([4, -2])
  })
})
