import { describe, expect, it } from 'vitest'
import { aimFov, isFirstPerson, nextTouchAim, scopeFov, stepZoom } from './view'

describe('1인칭·조준 카메라', () => {
  it('V 로 고른 1인칭은 탐험·패널에서만. 낚시·벤치·배·연출·잠은 3인칭', () => {
    expect(isFirstPerson('first', 'explore', false)).toBe(true)
    expect(isFirstPerson('first', 'bag', false)).toBe(true)
    for (const m of ['fishing', 'rest', 'boat', 'cutscene', 'sleep', 'wardrobe', 'aquariumView', 'lobby'] as const) expect(isFirstPerson('first', m, true)).toBe(false)
    expect(isFirstPerson('third', 'explore', false)).toBe(false)
  })
  it('3인칭에서 조준경 총으로 조준하면 그동안 1인칭 (은지 그대로)', () => {
    expect(isFirstPerson('third', 'explore', true)).toBe(true)
  })
  it('조준 FOV: 배율 조준경은 가운데가 mag 배, 그 밖엔 은지 aimFov 비율 (권총 50/60)', () => {
    expect(Math.tan((scopeFov(50, 4) * Math.PI) / 360)).toBeCloseTo(Math.tan((25 * Math.PI) / 180) / 4)
    expect(aimFov('pistol', null)).toBeCloseTo(41.67, 1)
    expect(aimFov('rifle', { label: '홀로', mag: 1 })).toBeCloseTo(37.5)
    expect(aimFov('sniper', { label: '8x', mag: 8 })).toBeCloseTo(scopeFov(50, 8))
  })
  it('휠: 위로 굴리면 더 크게, 아래로 굴리면 작게, 끝에서 멈춘다', () => {
    expect(stepZoom(0, 2, -100)).toBe(1)
    expect(stepZoom(1, 2, -100)).toBe(1)
    expect(stepZoom(1, 2, 100)).toBe(0)
    expect(stepZoom(0, 2, 100)).toBe(0)
    expect(stepZoom(0, 2, Number.NaN)).toBe(0)
  })
})

describe('폰 조준 버튼', () => {
  it('누를 때마다: 조준 → (조준경 총은) 다음 배율 → 끄기', () => {
    expect(nextTouchAim(false, 0, 2)).toEqual({ aiming: true, step: 0 })
    expect(nextTouchAim(true, 0, 2)).toEqual({ aiming: true, step: 1 })
    expect(nextTouchAim(true, 1, 2)).toEqual({ aiming: false, step: 0 })
    // 권총·산탄총 (배율 없음): 켜고 끄기
    expect(nextTouchAim(true, 0, 0)).toEqual({ aiming: false, step: 0 })
  })
})
