import { describe, expect, it } from 'vitest'
import { MINE, MINE_DEEP, MINE_WALLS, ORES, ORE_NODES, ORE_RADIUS, PICK, WALL_REACH } from '../data/mine'
import { PICK_IDLE, freshNodes, hitOre, nearestOre, nearestWall, pickHitDue, pickProgress, regrowOres, startPick, wallDistance, wallStage, type OreSpot, type WallSpot } from './mining'

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
    expect(a?.swing).toEqual({ startedAt: 1, target: 2, wall: null, hitDone: false })
    // 금 간 벽을 노린 곡괭이질
    expect(startPick(PICK_IDLE, null, 1, 0)?.swing).toEqual({ startedAt: 1, target: null, wall: 0, hitDone: false })
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

describe('금 간 벽', () => {
  /** x 10 에 서 있는 폭 4m 벽 (z -2 ~ 2) */
  const WALLS: WallSpot[] = [{ x: 10, z: 0, width: 4 }]
  it('광맥을 need 번 캐면 금이 가고, 무너뜨리면 열린다', () => {
    expect(wallStage(7, 8, false)).toBe('solid')
    expect(wallStage(8, 8, false)).toBe('cracked')
    expect(wallStage(30, 8, false)).toBe('cracked')
    expect(wallStage(0, 8, true)).toBe('open')
  })
  it('벽면까지 거리: 통로 폭 안에서는 곧장, 옆으로 비키면 가까운 끝까지', () => {
    expect(wallDistance(8, 1, WALLS[0])).toBeCloseTo(2)
    expect(wallDistance(8, 5, WALLS[0])).toBeCloseTo(Math.hypot(2, 3))
  })
  it('닿는 거리 안의 칠 수 있는 벽만 잡는다 (금이 안 갔거나 무너진 벽은 아니다)', () => {
    expect(nearestWall(8, 0, WALLS, [true], 2.6)).toBe(0)
    expect(nearestWall(7, 0, WALLS, [true], 2.6)).toBeNull()
    expect(nearestWall(8, 0, WALLS, [false], 2.6)).toBeNull()
  })
  it('마우스로 칠 땐 보는 쪽 앞의 벽만', () => {
    expect(nearestWall(8, 0, WALLS, [true], 2.6, { dx: 1, dz: 0 })).toBe(0)
    expect(nearestWall(8, 0, WALLS, [true], 2.6, { dx: -1, dz: 0 })).toBeNull()
  })
})

describe('광산 자리 (data/mine)', () => {
  it('금 간 벽은 첫 방 동쪽 벽(x 124~125) 안에 있고, 통로는 깊은 굴 폭 안에 든다', () => {
    for (const w of MINE_WALLS) {
      expect(w.x).toBe(MINE.x1 + 0.5)
      expect(MINE_DEEP.x0).toBe(MINE.x1 + 1)
      expect(w.z - w.width / 2).toBeGreaterThanOrEqual(MINE_DEEP.z0)
      expect(w.z + w.width / 2).toBeLessThanOrEqual(MINE_DEEP.z1)
      expect(w.need).toBeGreaterThan(0)
      expect(w.hits).toBeGreaterThan(0)
    }
  })
  it('깊은 굴 광맥은 깊은 굴 안에, 나머지는 첫 방 안에 있다. 통로를 막지 않는다', () => {
    for (const n of ORE_NODES) {
      const room = n.deep ? MINE_DEEP : MINE
      expect(n.x).toBeGreaterThan(room.x0)
      expect(n.x).toBeLessThan(room.x1)
      expect(n.z).toBeGreaterThan(room.z0)
      expect(n.z).toBeLessThan(room.z1)
      // 통로 앞 2m 안에 광맥 바위(반지름 1m)가 걸치지 않는다
      for (const w of MINE_WALLS) {
        const inFront = Math.abs(n.x - w.x) < 2 + ORE_RADIUS && Math.abs(n.z - w.z) < w.width / 2 + ORE_RADIUS
        expect(inFront).toBe(false)
      }
    }
    expect(ORE_NODES.filter((n) => n.deep).length).toBeGreaterThan(0)
  })
  it('벽을 뚫기 전에는 첫 방에서 깊은 굴 광맥에 곡괭이가 닿지 않는다', () => {
    const states = freshNodes(ORE_NODES)
    // 첫 방 동쪽 벽에 바짝 붙어 선 자리들
    for (let z = MINE.z0 + 0.5; z <= MINE.z1 - 0.5; z += 0.5) {
      const near = nearestOre(MINE.x1 - 0.3, z, ORE_NODES, states, PICK.reach)
      if (near !== null) expect(ORE_NODES[near].deep).toBeUndefined()
    }
  })
  it('금 간 벽에 닿는 거리는 광맥보다 짧다 (벽면까지라서)', () => {
    expect(WALL_REACH).toBeLessThan(PICK.reach)
  })
})
