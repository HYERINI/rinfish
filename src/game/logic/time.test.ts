import { describe, expect, it } from 'vitest'
import type { Mode } from './interaction'
import { clampDelta, restStops, timeStops } from './time'

describe('clampDelta', () => {
  it('보통 프레임 시간은 그대로', () => {
    expect(clampDelta(0.016)).toBe(0.016)
  })

  it('탭을 오래 비웠다 돌아와도 0.1초까지만 인정한다', () => {
    expect(clampDelta(30)).toBe(0.1)
  })

  it('음수나 NaN은 0으로 본다', () => {
    expect(clampDelta(-1)).toBe(0)
    expect(clampDelta(Number.NaN)).toBe(0)
  })
})

describe('timeStops', () => {
  it('메뉴·꾸미기·로비에서만 시간이 멈춘다 (잠 투표 중엔 흐른다)', () => {
    const stop: Mode[] = ['menu', 'wardrobe', 'lobby']
    const flow: Mode[] = ['explore', 'fishing', 'boat', 'sleep', 'shop']
    expect(stop.every(timeStops)).toBe(true)
    expect(flow.some(timeStops)).toBe(false)
  })
})

describe('restStops', () => {
  it('잠·죽음으로 화면이 어두워지는 동안도 멈춘다 (방 아침은 흐른다)', () => {
    expect(restStops('sleep', 'sleep')).toBe(true)
    expect(restStops('sleep', 'death')).toBe(true)
    expect(restStops('explore', 'morning')).toBe(false)
    expect(restStops('sleep', null)).toBe(false)
    expect(restStops('menu', null)).toBe(true)
  })
})
