import { afterEach, describe, expect, it, vi } from 'vitest'
import { Group, Matrix4, Vector3, type InstancedMesh, type LineSegments, type Sprite } from 'three'
import { createGunEffects } from './gunEffectsPool'

afterEach(() => vi.restoreAllMocks())

const at = (ms: number) => vi.spyOn(performance, 'now').mockReturnValue(ms)

const parts = (group: Group) => ({
  holes: group.children.find((o): o is InstancedMesh => (o as InstancedMesh).isInstancedMesh === true)!,
  lines: group.children.find((o): o is LineSegments => (o as LineSegments).isLineSegments === true)!,
  flashes: group.children.filter((o): o is Sprite => (o as Sprite).isSprite === true),
})

/** 길이가 0 이 아닌(보이는) 선분 수 */
function liveSegments(lines: LineSegments): number {
  const a = lines.geometry.getAttribute('position').array
  let n = 0
  for (let i = 0; i < a.length; i += 6) if (a[i] !== a[i + 3] || a[i + 1] !== a[i + 4] || a[i + 2] !== a[i + 5]) n++
  return n
}

describe('총알 효과 묶음', () => {
  it('궤적은 0.05초, 총구 불꽃은 0.04초 보였다 사라진다', () => {
    const fx = createGunEffects()
    const { lines, flashes } = parts(fx.group)
    expect(lines.visible).toBe(false)
    at(1000)
    fx.api.tracer(new Vector3(0, 0, 0), new Vector3(0, 0, -10))
    fx.api.flash(new Vector3(0, 1, 0))
    expect(lines.visible).toBe(true)
    expect(liveSegments(lines)).toBe(1)
    expect(flashes.filter((f) => f.visible)).toHaveLength(1)
    at(1045)
    fx.step()
    expect(flashes.filter((f) => f.visible)).toHaveLength(0)
    expect(liveSegments(lines)).toBe(1)
    at(1051)
    fx.step()
    expect(liveSegments(lines)).toBe(0)
    // 보이는 궤적이 없으면 묶음째 숨긴다
    expect(lines.visible).toBe(false)
    fx.dispose()
  })
  it('궤적은 선분 묶음 하나, 벽 자국은 인스턴스 묶음 하나로 그린다 (몇 개를 그려도 장면의 물체 수는 그대로)', () => {
    const fx = createGunEffects()
    const before = fx.group.children.length
    at(1000)
    for (let i = 0; i < 64; i++) fx.api.tracer(new Vector3(i, 0, 0), new Vector3(i, 0, -10))
    for (let i = 0; i < 50; i++) fx.api.hole(new Vector3(i, 0, 0), new Vector3(0, 1, 0))
    expect(fx.group.children).toHaveLength(before)
    expect(liveSegments(parts(fx.group).lines)).toBe(64)
    expect(parts(fx.group).holes.count).toBe(50)
    fx.dispose()
  })
  it('여럿이 같이 쏴도 불꽃을 서로 뺏지 않는다 (8개까지)', () => {
    const fx = createGunEffects()
    at(1000)
    for (let i = 0; i < 8; i++) fx.api.flash(new Vector3(i, 1, 0))
    const lit = parts(fx.group).flashes.filter((f) => f.visible)
    expect(lit).toHaveLength(8)
    expect(new Set(lit.map((f) => f.position.x)).size).toBe(8)
    fx.dispose()
  })
  it('벽 자국: 맞은 자리에서 면 쪽으로 살짝 띄우고 면을 본다. 120개를 돌려 쓴다', () => {
    const fx = createGunEffects()
    const { holes } = parts(fx.group)
    expect(holes.count).toBe(0)
    fx.api.hole(new Vector3(1, 2, 3), new Vector3(0, 0, 1))
    expect(holes.count).toBe(1)
    const m = new Matrix4()
    holes.getMatrixAt(0, m)
    // 행렬은 32비트 실수로 들어간다
    const pos = new Vector3().setFromMatrixPosition(m)
    expect([pos.x, pos.y]).toEqual([1, 2])
    expect(pos.z).toBeCloseTo(3.004, 5)
    // 바닥(법선 +y)에 찍으면 원판의 앞(+z)이 위를 본다
    fx.api.hole(new Vector3(0, 0, 0), new Vector3(0, 1, 0))
    holes.getMatrixAt(1, m)
    const front = new Vector3(0, 0, 1).transformDirection(m)
    expect(front.y).toBeCloseTo(1)
    for (let i = 0; i < 200; i++) fx.api.hole(new Vector3(i, 0, 0), new Vector3(0, 1, 0))
    expect(holes.count).toBe(120)
    // 202개째(i = 199)는 (2 + 199) % 120 = 81번 칸을 덮어썼다
    holes.getMatrixAt(81, m)
    expect(new Vector3().setFromMatrixPosition(m).x).toBe(199)
    fx.dispose()
  })
  it('표적판 자국은 판에 붙어 같이 움직인다. 40개를 돌려 쓰고 벽 자국과 따로 센다', () => {
    const fx = createGunEffects()
    const board = new Group()
    board.position.set(5, 0, 0)
    board.updateMatrixWorld()
    fx.api.hole(new Vector3(5.1, 0.2, 0), new Vector3(0, 0, 1), board)
    expect(board.children).toHaveLength(1)
    expect(board.children[0].position.x).toBeCloseTo(0.1)
    expect(board.children[0].position.z).toBe(0.003)
    expect(parts(fx.group).holes.count).toBe(0)
    // 벽에 아무리 쏴도 표적판 자국은 남는다
    for (let i = 0; i < 300; i++) fx.api.hole(new Vector3(0, 0, 0), new Vector3(0, 1, 0))
    expect(board.children).toHaveLength(1)
    for (let i = 0; i < 60; i++) fx.api.hole(new Vector3(5, 0, 0), new Vector3(0, 0, 1), board)
    expect(board.children).toHaveLength(40)
    fx.dispose()
    expect(board.children).toHaveLength(0)
  })
})
