import { describe, expect, it } from 'vitest'
import { TOUCH } from '../data/touch'
import { GOAL_HUD_LEFT_END, GOAL_MIN_WIDTH, GOAL_ROW_GAP, goalTrackerMode, goalTrackerPlace } from './goalPlace'

/** 컴퓨터 위쪽 버튼 줄 (🔊·가방 (I)·어항 구경·도감·메뉴 (ESC)) 의 실제 폭쯤 */
const ROW = 400

/** 목표 띠가 왼쪽 코인·체력 칸, 오른쪽 버튼 줄과 겹치지 않는다 */
const fits = (w: number, row: number) => {
  const p = goalTrackerPlace(w, row)
  if (p.kind === 'below') return true
  return p.left >= GOAL_HUD_LEFT_END && p.left + p.width <= w - 16 - row - GOAL_ROW_GAP && p.width >= GOAL_MIN_WIDTH
}

describe('목표 띠 자리 (컴퓨터)', () => {
  it('900~1600 px 어디서도 버튼 줄·코인 칸과 겹치지 않는다', () => {
    for (let w = 900; w <= 1600; w += 10) for (const row of [360, ROW, 440, 480]) expect(fits(w, row), `${w} / ${row}`).toBe(true)
  })
  it('넓으면 화면 가운데 400px 그대로', () => {
    expect(goalTrackerPlace(1600, ROW)).toEqual({ kind: 'top', left: 600, width: 400 })
  })
  it('1000·1150 px: 버튼 줄 왼쪽 빈 틈에 줄여서 둔다 (예전엔 🔊·가방을 덮었다)', () => {
    const a = goalTrackerPlace(1000, ROW)
    expect(a.kind).toBe('top')
    if (a.kind === 'top') expect(a.left + a.width).toBeLessThanOrEqual(1000 - 16 - ROW - GOAL_ROW_GAP)
    const b = goalTrackerPlace(1150, ROW)
    expect(b.kind === 'top' && b.width).toBe(400)
  })
  it('빈 틈이 너무 좁으면 버튼 줄 아래로', () => {
    expect(goalTrackerPlace(900, 480)).toEqual({ kind: 'below' })
  })
})

describe('목표 띠 자리 (폰)', () => {
  it('폰 가로는 컴퓨터처럼 위쪽 빈 틈에, 폰 세로·좁은 창은 버튼 줄 아래', () => {
    expect(goalTrackerMode({ touchUi: true, narrow: true, portrait: false })).toBe('gap')
    expect(goalTrackerMode({ touchUi: true, narrow: true, portrait: true })).toBe('below')
    expect(goalTrackerMode({ touchUi: false, narrow: true, portrait: false })).toBe('below')
    expect(goalTrackerMode({ touchUi: false, narrow: false, portrait: false })).toBe('gap')
  })
  it('폰 가로 780×360·844×390: 왼쪽 채팅 칸(코인 칸 아래)과 위쪽 버튼 줄 사이에 들어간다', () => {
    // 폰 가로 위쪽 버튼 줄 (🔊·어항 구경·도감·메뉴) 쯤
    for (const w of [780, 844]) {
      const p = goalTrackerPlace(w, 270)
      expect(p.kind).toBe('top')
      if (p.kind === 'top') expect(p.left).toBeGreaterThanOrEqual(16 + TOUCH.chatWidthLandscape)
    }
  })
})
