import { describe, expect, it } from 'vitest'
import { GUNS, GUN_IDS, PVP, PVP_WEAPONS, START_RESERVE } from './guns'
import { MELEE } from './melee'
import { AMMO_PACKS } from './meadowPrices'
import { HOTBAR, nextWeapon, touchHotbar } from './tools'

describe('총 (은지 WEAPONS)', () => {
  it('은지 숫자 그대로: 탄창·연사·알 수·피해', () => {
    expect(GUN_IDS.map((id) => [GUNS[id].mag, GUNS[id].rpm, GUNS[id].pellets, GUNS[id].dmg])).toEqual([
      [12, 320, 1, 1],
      [30, 650, 1, 1],
      [6, 70, 8, 1],
      [5, 40, 1, 3],
    ])
    expect(GUNS.rifle.auto && !GUNS.pistol.auto).toBe(true)
    expect(GUNS.sniper.zoom?.map((z) => z.mag)).toEqual([4, 8])
    expect(START_RESERVE).toEqual({ pistol: 48, rifle: 120, shotgun: 24, sniper: 20 })
  })
  it('잡화점 탄약 묶음: 권총 12발 80 · 소총 30발 150 · 산탄 6발 120 · 저격 5발 250', () => {
    expect(AMMO_PACKS).toEqual({ pistol: { n: 12, price: 80 }, rifle: { n: 30, price: 150 }, shotgun: { n: 6, price: 120 }, sniper: { n: 5, price: 250 } })
  })
  it('PvP 피해표 (권총 20 · 소총 14 · 산탄 9 · 저격 70 · 칼 15 · 찌르기 30 · 주먹 5). 서버 간격은 내 화면 간격보다 짧다', () => {
    expect(PVP_WEAPONS.map((w) => PVP[w].dmg)).toEqual([20, 14, 9, 70, 15, 30, 5])
    for (const id of GUN_IDS) expect(PVP[id].cool).toBeLessThan(60 / GUNS[id].rpm)
    for (const id of ['knife', 'stab', 'fists'] as const) expect(PVP[id].cool).toBeLessThan(MELEE[id].cool)
  })
})

describe('도구 칸', () => {
  it('1 낚싯대 · 2 주먹 · 3 칼 · 4 권총 · 5 소총 · 6 산탄총 · 7 저격총', () => {
    expect(HOTBAR).toEqual(['rod', 'fists', 'knife', 'pistol', 'rifle', 'shotgun', 'sniper', null, null])
  })
  it('폰은 총을 한 칸만 (마지막에 든 총), 무기 바꾸기는 주먹 → 칼 → 총 4종 → 주먹', () => {
    expect(touchHotbar('rifle')).toEqual(['rod', 'fists', 'knife', 'rifle'])
    expect(nextWeapon('fists')).toBe('knife')
    expect(nextWeapon('knife')).toBe('pistol')
    expect(nextWeapon('sniper')).toBe('fists')
    expect(nextWeapon('rod')).toBe('fists')
    expect(nextWeapon(null)).toBe('fists')
  })
})
