import { describe, expect, it } from 'vitest'
import { AIM_VIEW, GUNS } from '../data/guns'
import { NET } from '../data/net'
import { FIRE_CARRY_MAX, GUN_IDLE, cameraShoulder, finishReload, heatNow, pullTrigger, recoilOf, reloadProgress, spreadOf, startReload, swapGun } from './gun'

describe('방아쇠 (은지 cool·heat)', () => {
  it('쏘면 다음 발까지 60/rpm 초, 그 전엔 busy', () => {
    const a = pullTrigger(GUN_IDLE, 'pistol', 10, 12)
    expect(a.kind).toBe('fire')
    expect(a.state.readyAt).toBeCloseTo(10 + 60 / 320)
    expect(pullTrigger(a.state, 'pistol', 10.1, 11).kind).toBe('busy')
    expect(pullTrigger(a.state, 'pistol', 10.19, 11).kind).toBe('fire')
  })
  /** 방아쇠를 누른 채 seconds 초 동안 fps 로 돌린다: 쏜 시각들 */
  const hold = (fps: number, seconds: number): number[] => {
    const fired: number[] = []
    let state = GUN_IDLE
    for (let frame = 0; frame / fps < seconds; frame++) {
      const t = pullTrigger(state, 'rifle', 100 + frame / fps, 999)
      state = t.state
      if (t.kind === 'fire') fired.push(100 + frame / fps)
    }
    return fired
  }
  it('연사 빠르기가 화면 fps 에 매이지 않는다: 60fps·144fps 모두 10초에 설계(650rpm)만큼', () => {
    const design = Math.floor((10 * GUNS.rifle.rpm) / 60)
    expect(design).toBe(108)
    // 늦은 시간을 버리던 때는 60fps 에서 100발이었다
    expect(Math.abs(hold(60, 10).length - design)).toBeLessThanOrEqual(1)
    expect(Math.abs(hold(144, 10).length - design)).toBeLessThanOrEqual(1)
    // 30fps 는 그대로 100발이다: 프레임이 33ms 라 두 발 사이가 67ms 아니면 100ms 인데, 67ms 는 한도(간격 − 0.02초 = 72ms)보다 짧아 못 쓴다
    expect(hold(30, 10).length).toBe(100)
  })
  it('당겨 쏘는 폭은 서버 여유의 절반까지: 어떤 fps 에서도 두 발 사이가 간격 − 0.02초보다 짧지 않다', () => {
    expect(FIRE_CARRY_MAX).toBeCloseTo(NET.gunTimingSlack / 2)
    const interval = 60 / GUNS.rifle.rpm
    for (const fps of [20, 30, 45, 60, 90, 120, 144, 240]) {
      const fired = hold(fps, 5)
      const gaps = fired.slice(1).map((t, i) => t - fired[i])
      expect(Math.min(...gaps)).toBeGreaterThanOrEqual(interval - FIRE_CARRY_MAX - 1e-9)
    }
  })
  it('한참 쉬었다 쏘면 지금부터 센다 (밀린 만큼 몰아 쏘지 않는다)', () => {
    const a = pullTrigger(GUN_IDLE, 'rifle', 10, 30).state
    const b = pullTrigger(a, 'rifle', 13, 29)
    expect(b.kind).toBe('fire')
    expect(b.state.readyAt).toBeCloseTo(13 + 60 / GUNS.rifle.rpm)
    // 이어 쏘면 늦은 0.005초만큼 다음 발이 당겨진다
    const c = pullTrigger(a, 'rifle', a.readyAt + 0.005, 29)
    expect(c.state.readyAt).toBeCloseTo(a.readyAt + 60 / GUNS.rifle.rpm)
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
