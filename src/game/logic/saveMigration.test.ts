import { describe, expect, it } from 'vitest'
import { TANK_LEVELS } from '../data/aquarium'
import { GEAR } from '../data/gear'
import { migrateSave } from './saveMigration'

describe('migrateSave', () => {
  it('5단계 시절 장비·어항 단계를 같은 성능의 10단계 자리로 옮긴다', () => {
    const out = migrateSave({ coins: 50, gear: { line: 2, reel: 4, rod: 1 }, aquarium: { level: 3, displayed: [] } }, 1) as {
      coins: number
      gear: { line: number; reel: number; rod: number }
      aquarium: { level: number; displayed: unknown[] }
    }
    expect(out.coins).toBe(50)
    expect(GEAR.line.levels[out.gear.line].value).toBe(190)
    expect(GEAR.reel.levels[out.gear.reel].value).toBe(14)
    expect(GEAR.rod.levels[out.gear.rod].value).toBe(0.75)
    expect(TANK_LEVELS[out.aquarium.level].slots).toBe(15)
    expect(out.aquarium.displayed).toEqual([])
  })

  it('이미 지금 버전이거나 모양이 틀린 저장본은 건드리지 않는다', () => {
    const now = { gear: { line: 7 } }
    expect(migrateSave(now, 2)).toBe(now)
    expect(migrateSave(null, 1)).toBeNull()
    expect(migrateSave({ gear: { line: 'x' } }, 1)).toEqual({ gear: { line: 'x' }, aquarium: undefined })
  })
})
