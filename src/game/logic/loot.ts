import { ANIMAL } from '../data/animals'
import type { RawItemId } from '../data/meadowItems'
import type { Rng } from './rng'

/** 바닥에 떨어진 전리품 하나 (세계 좌표). showAt: 보이기 시작하는 때 (쓰러진 동물이 사라질 때), phase: 둥실거리는 박자 */
export type Loot = { key: number; item: RawItemId; x: number; z: number; showAt: number; phase: number }

/**
 * 쓰러뜨린 자리(x, z) 둘레 1m 안에 흩어 떨어뜨린다 (은지 그대로). 쓰러진 동물이 사라지는 ANIMAL.corpse 초 뒤에 보인다.
 * firstKey 부터 번호를 붙인다
 */
export function dropLoot(items: readonly RawItemId[], x: number, z: number, now: number, firstKey: number, rng: Rng = Math.random): Loot[] {
  return items.map((item, i) => ({ key: firstKey + i, item, x: x + (rng() - 0.5), z: z + (rng() - 0.5), showAt: now + ANIMAL.corpse, phase: rng() * Math.PI * 2 }))
}

/** 보이는 것 중 (x, z) 에서 바닥 거리 ANIMAL.pickDist 안의 가장 가까운 것 (없으면 null) */
export function nearestLoot(list: readonly Loot[], x: number, z: number, now: number): Loot | null {
  let best: Loot | null = null
  let bestD: number = ANIMAL.pickDist
  for (const l of list) {
    if (now < l.showAt) continue
    const d = Math.hypot(l.x - x, l.z - z)
    if (d < bestD) {
      bestD = d
      best = l
    }
  }
  return best
}
