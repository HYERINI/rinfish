// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Light, Object3D } from 'three'

// 모델 파일은 테스트에서 받지 않는다
beforeAll(() => vi.stubGlobal('fetch', () => Promise.reject(new Error('offline'))))
afterAll(() => vi.unstubAllGlobals())

const isLight = (o: Object3D): o is Light => (o as Light).isLight === true

describe('초원 조명 (빛 개수가 처음부터 같게)', () => {
  it('방 조명은 은지 group 밖으로 꺼내고, 가로등은 숨긴다 (group 이 나중에 붙어도 켜진 빛이 늘지 않는다)', async () => {
    const { meadowReady, meadowWorld, meadowRoomLamps } = await import('./meadowSingleton')
    const { ROOMS } = await import('./vendor/world.js')
    const w = meadowWorld()
    const lamps = meadowRoomLamps()
    expect(lamps.length).toBe(ROOMS.length)
    for (const l of lamps) {
      expect(l.isPointLight).toBe(true)
      expect(l.parent).toBeNull()
    }
    for (const l of w.lights.lamps) expect(l.visible).toBe(false)
    // 해·하늘빛은 MeadowLighting 이 따로 붙이므로 빼고, group 안에 켜진 빛이 없다
    const lit: Light[] = []
    w.group.traverseVisible((o) => {
      if (isLight(o) && o !== w.lights.sun && o !== w.lights.hemi) lit.push(o)
    })
    expect(lit).toEqual([])
    // 모델 받기(실패)를 다 기다린다 (테스트가 끝난 뒤 진짜 fetch 로 가지 않게)
    await meadowReady()
  })
})
