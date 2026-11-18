import { describe, expect, it } from 'vitest'
import type { AnimalView } from './animalSim'
import { countHits, firstBodyHit, pelletDirs, rayCapsule, rayCylinder, raySphere, type V3 } from './hitscan'

/** 정해 둔 수를 차례로 돌려주는 난수 */
const seq = (...v: number[]) => {
  let i = 0
  return () => v[i++ % v.length]
}
const o: V3 = { x: 0, y: 1, z: 0 }
const east: V3 = { x: 1, y: 0, z: 0 }
const cow = (id: number, x: number, z: number, pose: AnimalView['pose'] = 'idle'): AnimalView => ({ id, sp: 'cow', x, z, h: 0, pose, hp: 3 })

describe('광선 판정', () => {
  it('기둥: 옆면에 닿는 첫 거리, 높이 밖이나 near..far 밖이면 null', () => {
    expect(rayCylinder(o, east, 5, 0, 0.5, 0, 2, 0, 80)).toBeCloseTo(4.5)
    expect(rayCylinder(o, east, 5, 0, 0.5, 1.5, 2, 0, 80)).toBeNull()
    expect(rayCylinder(o, east, 5, 0, 0.5, 0, 2, 0, 4)).toBeNull()
    expect(rayCylinder(o, east, 5, 0, 0.5, 0, 2, 4.8, 80)).toBeCloseTo(5.5)
    // 위에서 내려다보며 쏘면 뚜껑에 닿는다
    expect(rayCylinder({ x: 5, y: 3, z: 0 }, { x: 0, y: -1, z: 0 }, 5, 0, 0.5, 0, 1.2, 0, 80)).toBeCloseTo(1.8)
  })
  it('캡슐·공', () => {
    expect(rayCapsule(o, east, { x: 3, y: 0.5, z: 0 }, { x: 3, y: 1.8, z: 0 }, 0.32, 0, 80)).toBeCloseTo(2.68)
    expect(rayCapsule({ x: 0, y: 2.0, z: 0 }, east, { x: 3, y: 0.5, z: 0 }, { x: 3, y: 1.8, z: 0 }, 0.32, 0, 80)).toBeCloseTo(3 - Math.sqrt(0.32 ** 2 - 0.2 ** 2))
    expect(raySphere(o, east, { x: 2, y: 1, z: 0 }, 0.5, 0, 80)).toBeCloseTo(1.5)
    expect(raySphere(o, east, { x: 2, y: 2, z: 0 }, 0.5, 0, 80)).toBeNull()
  })
  it('처음 닿는 몸: 가까운 동물이나 사람. 쓰러진 동물은 건너뛴다', () => {
    const animals = [cow(1, 10, 0), cow(2, 6, 0, 'dead')]
    expect(firstBodyHit(o, east, 0, 80, animals, [])).toEqual({ kind: 'animal', id: 1, t: expect.closeTo(10 - 0.52) })
    expect(firstBodyHit(o, east, 0, 80, animals, [{ id: 'b', x: 7, y: 1, z: 0 }])).toEqual({ kind: 'peer', id: 'b', t: expect.closeTo(6.68) })
    expect(firstBodyHit(o, { x: 0, y: 0, z: 1 }, 0, 80, animals, [])).toBeNull()
  })
})

describe('산탄·퍼짐', () => {
  it('알마다 방향이 단위 벡터이고 원뿔(반각 spread) 안. 퍼짐 0 이면 그대로', () => {
    const dirs = pelletDirs(east, 0.05, 8, seq(0.1, 0.99, 0.5, 0.3, 0.8, 0.05, 0.7, 0.6))
    expect(dirs).toHaveLength(8)
    for (const d of dirs) {
      expect(Math.hypot(d.x, d.y, d.z)).toBeCloseTo(1)
      expect(Math.acos(d.x)).toBeLessThanOrEqual(0.0501)
    }
    expect(pelletDirs({ x: 0, y: -1, z: 0 }, 0, 1, seq(0.4))[0]).toEqual({ x: 0, y: -1, z: 0 })
  })
  it('맞은 알 수 세기', () => {
    expect([...countHits(['a', 'b', 'a'])]).toEqual([
      ['a', 2],
      ['b', 1],
    ])
  })
})
