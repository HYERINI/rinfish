import { describe, expect, it } from 'vitest'
import { ORES, PICK } from '../data/mine'
import { PICK_IDLE, freshNodes, hitOre, nearestOre, pickHitDue, pickProgress, regrowOres, startPick, type OreSpot } from './mining'

const SPOTS: OreSpot[] = [
  { ore: 'stone', x: 0, z: 2 },
  { ore: 'gold', x: 0, z: -1 },
  { ore: 'iron', x: 10, z: 0 },
]

describe('nearestOre', () => {
  it('닿는 것 중 가장 가까운 광맥', () => {
    expect(nearestOre(0, 0, SPOTS, freshNodes(SPOTS), 2.2)).toBe(1)
    expect(nearestOre(0, 1.5, SPOTS, freshNodes(SPOTS), 2.2)).toBe(0)
  })
  it('멀면 없다', () => {
    expect(nearestOre(5, 5, SPOTS, freshNodes(SPOTS), 2.2)).toBeNull()
  })
  it('다 캔 광맥은 건너뛴다', () => {
    const states = freshNodes(SPOTS)
    states[1] = { left: 0, respawnAt: 100 }
    expect(nearestOre(0, 0, SPOTS, states, 2.2)).toBe(0)
  })
  it('보는 쪽을 주면 등 뒤 광맥은 안 맞는다', () => {
    expect(nearestOre(0, 0, SPOTS, freshNodes(SPOTS), 2.2, { dx: 0, dz: 1 })).toBe(0)
    expect(nearestOre(0, 0, SPOTS, freshNodes(SPOTS), 2.2, { dx: 0, dz: -1 })).toBe(1)
    expect(nearestOre(0, 0, SPOTS, freshNodes(SPOTS), 2.2, { dx: 1, dz: 0 })).toBe(1)
  })
})

describe('hitOre · regrowOres', () => {
  it('정해진 횟수만큼 치면 캐지고 다시 생길 때가 걸린다', () => {
    let s = freshNodes(SPOTS)[0]
    for (let i = 0; i < ORES.stone.hits - 1; i++) {
      const r = hitOre(s, 'stone', 10)
      expect(r.mined).toBe(false)
      s = r.state
    }
    const last = hitOre(s, 'stone', 10)
    expect(last.mined).toBe(true)
    expect(last.state).toEqual({ left: 0, respawnAt: 10 + ORES.stone.respawn })
    // 다 캔 뒤엔 더 쳐도 그대로
    expect(hitOre(last.state, 'stone', 11)).toEqual({ state: last.state, mined: false })
  })
  it('시간이 되면 다시 가득, 아니면 같은 배열', () => {
    const states = freshNodes(SPOTS)
    states[1] = { left: 0, respawnAt: 50 }
    expect(regrowOres(states, SPOTS, 49)).toBe(states)
    const grown = regrowOres(states, SPOTS, 50)
    expect(grown[1]).toEqual({ left: ORES.gold.hits, respawnAt: null })
    expect(grown[0]).toBe(states[0])
  })
})

describe('곡괭이질', () => {
  it('간격 안에는 다시 못 휘두른다', () => {
    const a = startPick(PICK_IDLE, 2, 1)
    expect(a?.swing).toEqual({ startedAt: 1, target: 2, hitDone: false })
    expect(startPick(a!, 2, 1 + PICK.cool - 0.01)).toBeNull()
    expect(startPick(a!, null, 1 + PICK.cool)).not.toBeNull()
  })
  it('진행도와 맞는 순간', () => {
    const { swing } = startPick(PICK_IDLE, 0, 0)!
    expect(pickProgress(swing, PICK.dur / 2)).toBeCloseTo(0.5)
    expect(pickProgress(swing, PICK.dur)).toBe(-1)
    expect(pickProgress(null, 0)).toBe(-1)
    expect(pickHitDue(swing, PICK.dur * PICK.hitAt - 0.01)).toBe(false)
    expect(pickHitDue(swing, PICK.dur * PICK.hitAt)).toBe(true)
    expect(pickHitDue({ ...swing!, hitDone: true }, 1)).toBe(false)
  })
})
