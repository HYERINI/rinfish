import { afterEach, describe, expect, it, vi } from 'vitest'
import { Group, Vector3, type Line, type Mesh, type Sprite } from 'three'
import { createGunEffects } from './gunEffectsPool'

afterEach(() => vi.restoreAllMocks())

const at = (ms: number) => vi.spyOn(performance, 'now').mockReturnValue(ms)

describe('총알 효과 묶음', () => {
  it('궤적은 0.05초, 총구 불꽃은 0.04초 보였다 사라진다', () => {
    const fx = createGunEffects()
    at(1000)
    fx.api.tracer(new Vector3(0, 0, 0), new Vector3(0, 0, -10))
    fx.api.flash(new Vector3(0, 1, 0))
    const lines = fx.group.children.filter((o): o is Line => (o as Line).isLine === true)
    const flash = fx.group.children.find((o): o is Sprite => (o as Sprite).isSprite === true)!
    expect(lines.filter((l) => l.visible)).toHaveLength(1)
    expect(flash.visible).toBe(true)
    at(1045)
    fx.step()
    expect(flash.visible).toBe(false)
    expect(lines.filter((l) => l.visible)).toHaveLength(1)
    at(1051)
    fx.step()
    expect(lines.filter((l) => l.visible)).toHaveLength(0)
    fx.dispose()
  })
  it('자국: 벽은 맞은 자리에서 면 쪽으로 살짝 띄우고, 표적판에 맞으면 판에 붙는다. 120개를 돌려 쓴다', () => {
    const fx = createGunEffects()
    fx.api.hole(new Vector3(1, 2, 3), new Vector3(0, 0, 1))
    const hole = fx.group.children.at(-1) as Mesh
    expect(hole.position.toArray()).toEqual([1, 2, 3.004])
    const board = new Group()
    board.position.set(5, 0, 0)
    board.updateMatrixWorld()
    fx.api.hole(new Vector3(5.1, 0.2, 0), new Vector3(0, 0, 1), board)
    expect(board.children).toHaveLength(1)
    expect(board.children[0].position.x).toBeCloseTo(0.1)
    expect(board.children[0].position.z).toBe(0.003)
    for (let i = 0; i < 120; i++) fx.api.hole(new Vector3(0, 0, 0), new Vector3(0, 1, 0))
    expect(fx.group.children.filter((o) => (o as Mesh).isMesh && !(o as Sprite).isSprite)).toHaveLength(120)
    expect(board.children).toHaveLength(0)
    fx.dispose()
  })
})
