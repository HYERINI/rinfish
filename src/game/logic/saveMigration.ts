import { TANK_LEVEL_FROM_V1 } from '../data/aquarium'
import { GEAR_LEVEL_FROM_V1 } from '../data/gear'

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** 옛 단계 번호를 지금 단계 번호로. 표에 없는 값은 그대로 둬서 저장본 검증(merge)이 걸러 내게 한다 */
const remap = (level: unknown, table: number[]) => (Number.isInteger(level) && table[level as number] !== undefined ? table[level as number] : level)

/**
 * 옛 저장본을 지금 모양으로. version 1(장비·어항 5단계) → 2(10단계): 같은 성능 자리로 단계 번호를 옮긴다
 */
export function migrateSave(saved: unknown, version: number): unknown {
  if (!isRecord(saved) || version >= 2) return saved
  const gear = isRecord(saved.gear) ? Object.fromEntries(Object.entries(saved.gear).map(([slot, level]) => [slot, remap(level, GEAR_LEVEL_FROM_V1)])) : saved.gear
  const aquarium = isRecord(saved.aquarium) ? { ...saved.aquarium, level: remap(saved.aquarium.level, TANK_LEVEL_FROM_V1) } : saved.aquarium
  return { ...saved, gear, aquarium }
}
