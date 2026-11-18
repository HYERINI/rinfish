import { describe, expect, it } from 'vitest'
import { FULL_MAGS, START_ROUNDS, ammoPacksThatFit, buyAmmoPacks, canReload, readRounds, reloadRounds, spendRound } from './ammo'

describe('탄약', () => {
  it('쏘면 탄창에서 1발, 비었으면 null', () => {
    expect(spendRound(FULL_MAGS, 'pistol')?.pistol).toBe(11)
    expect(spendRound({ ...FULL_MAGS, sniper: 0 }, 'sniper')).toBeNull()
  })
  it('장전: 예비에서 모자란 만큼만. 탄창이 가득이거나 예비가 없으면 못 한다', () => {
    const mag = { ...FULL_MAGS, rifle: 4 }
    expect(reloadRounds(mag, START_ROUNDS, 'rifle')).toEqual({ mag: { ...mag, rifle: 30 }, reserve: { ...START_ROUNDS, rifle: 94 } })
    expect(reloadRounds(mag, { ...START_ROUNDS, rifle: 10 }, 'rifle')).toEqual({ mag: { ...mag, rifle: 14 }, reserve: { ...START_ROUNDS, rifle: 0 } })
    expect(canReload(FULL_MAGS, START_ROUNDS, 'pistol')).toBe(false)
    expect(reloadRounds(mag, { ...START_ROUNDS, rifle: 0 }, 'rifle')).toBeNull()
  })
  it('탄약 묶음 사기: 코인을 내고 예비에 더한다. 코인이 모자라거나 개수가 틀리면 그대로', () => {
    expect(buyAmmoPacks(200, START_ROUNDS, 'pistol', 2)).toEqual({ ok: true, coins: 40, reserve: { ...START_ROUNDS, pistol: 72 } })
    expect(buyAmmoPacks(249, START_ROUNDS, 'sniper', 1)).toEqual({ ok: false, reason: 'coins' })
    expect(buyAmmoPacks(1000, START_ROUNDS, 'rifle', 0)).toEqual({ ok: false, reason: 'qty' })
    expect(buyAmmoPacks(1000, START_ROUNDS, 'rifle', 1.5)).toEqual({ ok: false, reason: 'qty' })
  })
  it('예비 상한(9999)에 다 차면 더 팔지 않는다: 버려질 탄에 코인을 받지 않는다 (상한에 들어가는 묶음까지만)', () => {
    expect(ammoPacksThatFit({ ...START_ROUNDS, rifle: 9999 }, 'rifle')).toBe(0)
    expect(ammoPacksThatFit({ ...START_ROUNDS, rifle: 9940 }, 'rifle')).toBe(1)
    expect(ammoPacksThatFit({ ...START_ROUNDS, rifle: 9939 }, 'rifle')).toBe(2)
    expect(buyAmmoPacks(1000, { ...START_ROUNDS, rifle: 9999 }, 'rifle', 1)).toEqual({ ok: false, reason: 'full' })
    expect(buyAmmoPacks(1000, { ...START_ROUNDS, rifle: 9940 }, 'rifle', 2)).toEqual({ ok: false, reason: 'full' })
    expect(buyAmmoPacks(1000, { ...START_ROUNDS, rifle: 9940 }, 'rifle', 1)).toEqual({ ok: true, coins: 850, reserve: { ...START_ROUNDS, rifle: 9970 } })
  })
  it('저장본 읽기: 총마다 0 ~ 상한 정수만, 나머지는 기본값', () => {
    expect(readRounds({ pistol: 3, rifle: 99, shotgun: -1, sniper: 'x' }, FULL_MAGS, (id) => FULL_MAGS[id])).toEqual({ ...FULL_MAGS, pistol: 3 })
    expect(readRounds(null, START_ROUNDS, () => 9999)).toEqual(START_ROUNDS)
  })
})
