import { describe, expect, it } from 'vitest'
import { AIM_VIEW } from '../data/guns'
import { GUN_IDLE, cameraShoulder, finishReload, heatNow, pullTrigger, recoilOf, reloadProgress, spreadOf, startReload, swapGun } from './gun'

describe('방아쇠 (은지 cool·heat)', () => {
  it('쏘면 다음 발까지 60/rpm 초, 그 전엔 busy', () => {
    const a = pullTrigger(GUN_IDLE, 'pistol', 10, 12)
    expect(a.kind).toBe('fire')
    expect(a.state.readyAt).toBeCloseTo(10 + 60 / 320)
    expect(pullTrigger(a.state, 'pistol', 10.1, 11).kind).toBe('busy')
    expect(pullTrigger(a.state, 'pistol', 10.19, 11).kind).toBe('fire')
  })
  it('빈 탄창은 딸깍 (empty), 0.3초 쉰다', () => {
    const e = pullTrigger(GUN_IDLE, 'rifle', 5, 0)
    expect(e.kind).toBe('empty')
    expect(e.state.readyAt).toBeCloseTo(5.3)
    expect(pullTrigger(e.state, 'rifle', 5.2, 30).kind).toBe('busy')
  })
  it('연사 총만 열기가 한 발에 0.15 오르고(최대 1) 초당 2 씩 식는다. 퍼짐에 열기 × 0.01', () => {
    const s = pullTrigger(GUN_IDLE, 'rifle', 1, 30).state
    expect(s.heat).toBeCloseTo(0.15)
    expect(heatNow(s, 1.05)).toBeCloseTo(0.05)
    expect(heatNow(s, 2)).toBe(0)
    expect(pullTrigger({ ...GUN_IDLE, heat: 0.95, heatAt: 3 }, 'rifle', 3, 30).state.heat).toBe(1)
    expect(pullTrigger(GUN_IDLE, 'pistol', 1, 12).state.heat).toBe(0)
    expect(spreadOf('rifle', false, 0.5)).toBeCloseTo(0.025)
    expect(spreadOf('rifle', true, 0)).toBeCloseTo(0.006)
  })
  it('반동: 조준 0.6배, 조준경 0.5배 더', () => {
    expect(recoilOf('sniper', false, false)).toBeCloseTo(0.06)
    expect(recoilOf('sniper', true, true)).toBeCloseTo(0.018)
  })
})

describe('장전', () => {
  it('장전 시간(권총 1.3초) 동안 쏠 수 없고, 끝나면 그 총을 돌려준다', () => {
    const s = startReload(GUN_IDLE, 'pistol', 2, true)!
    expect(s.reload).toEqual({ gun: 'pistol', until: 3.3 })
    expect(pullTrigger(s, 'pistol', 2.5, 5).kind).toBe('busy')
    expect(reloadProgress(s, 2.65)).toBeCloseTo(0.5)
    expect(finishReload(s, 3.2)).toBeNull()
    const done = finishReload(s, 3.3)!
    expect(done.gun).toBe('pistol')
    expect(done.state.reload).toBeNull()
  })
  it('이미 장전 중이거나 할 수 없으면(탄창 가득·예비 없음) 시작하지 않는다', () => {
    const s = startReload(GUN_IDLE, 'pistol', 2, true)!
    expect(startReload(s, 'pistol', 2.1, true)).toBeNull()
    expect(startReload(GUN_IDLE, 'pistol', 2, false)).toBeNull()
  })
  it('도구를 바꾸면 장전·열기를 지우고 0.25초 뒤부터 쏜다', () => {
    const s = swapGun({ ...startReload(GUN_IDLE, 'rifle', 1, true)!, heat: 0.7, heatAt: 1 }, 1.5)
    expect(s.reload).toBeNull()
    expect(s.heat).toBe(0)
    expect(pullTrigger(s, 'sniper', 1.7, 5).kind).toBe('busy')
    expect(pullTrigger(s, 'sniper', 1.75, 5).kind).toBe('fire')
  })
})

describe('3인칭 카메라 어깨 너머', () => {
  it('총을 들고 돌아다니면 조준하지 않아도 오른쪽 어깨 너머로 비킨다 (조준점이 내 몸에 겹치지 않게)', () => {
    expect(cameraShoulder('explore', 'pistol')).toBe(AIM_VIEW.shoulder)
    expect(cameraShoulder('explore', 'sniper')).toBe(AIM_VIEW.shoulder)
  })
  it('총이 아니거나 돌아다니는 중이 아니면 가운데', () => {
    expect(cameraShoulder('explore', 'knife')).toBe(0)
    expect(cameraShoulder('explore', null)).toBe(0)
    expect(cameraShoulder('fishing', 'pistol')).toBe(0)
  })
})
