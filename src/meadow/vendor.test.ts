// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { stubCanvas2d } from './canvasStub'

// 모델 파일은 테스트에서 받지 않는다 (로딩 실패는 allSettled 로 넘긴다)
let restoreCanvas = () => {}
beforeAll(() => {
  vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')))
  // 사격장 글씨·과녁 그림 (jsdom 엔 2D 캔버스가 없다)
  restoreCanvas = stubCanvas2d()
})
afterAll(() => {
  vi.unstubAllGlobals()
  restoreCanvas()
})

describe('은지 맵 복사본', () => {
  it('createWorld 가 사격장·동물·상인·거울 파일 없이 만들어지고 충돌 상자가 땅 안에 있다', async () => {
    const { createWorld } = await import('./vendor/world.js')
    const { GROUND } = await import('./vendor/outdoor.js')
    const w = createWorld()
    await Promise.allSettled([w.furnitureReady, w.outdoor.ready, w.town.ready])
    const boxes = w.allColliders()
    expect(boxes.length).toBeGreaterThan(10)
    for (const b of boxes) {
      if (!Number.isFinite(b.min.x)) continue
      expect(b.min.x).toBeGreaterThanOrEqual(GROUND.minX - 1)
      expect(b.max.z).toBeLessThanOrEqual(GROUND.maxZ + 1)
    }
    expect(w.lights.sun.isDirectionalLight).toBe(true)
  })

  it('초원 땅(MEADOW_RECT)은 은지 GROUND 와 같고, 나무·바위와 집·광장·동물 들판이 모두 그 안에 있다', async () => {
    const { createWorld } = await import('./vendor/world.js')
    const { GROUND, YARD, ANIMAL_ZONE } = await import('./vendor/outdoor.js')
    const { TOWN } = await import('./vendor/town.js')
    const { MEADOW_RECT, areaToWorld } = await import('../game/data/meadow')
    expect(MEADOW_RECT).toEqual(areaToWorld(GROUND))
    // 줄인 땅: 원본(200m)보다 훨씬 작다
    expect(GROUND.maxX - GROUND.minX).toBeLessThan(120)
    expect(GROUND.maxZ - GROUND.minZ).toBeLessThan(120)
    for (const a of [YARD, TOWN, ANIMAL_ZONE]) {
      expect(a.minX).toBeGreaterThanOrEqual(GROUND.minX + 10)
      expect(a.maxX).toBeLessThanOrEqual(GROUND.maxX - 10)
      expect(a.minZ).toBeGreaterThanOrEqual(GROUND.minZ + 10)
      expect(a.maxZ).toBeLessThanOrEqual(GROUND.maxZ - 10)
    }
    const w = createWorld()
    await Promise.allSettled([w.furnitureReady, w.outdoor.ready, w.town.ready])
    expect(w.outdoor.decor.length).toBeGreaterThan(20)
    for (const d of w.outdoor.decor) {
      expect(d.x).toBeGreaterThanOrEqual(GROUND.minX)
      expect(d.x).toBeLessThanOrEqual(GROUND.maxX)
      expect(d.z).toBeGreaterThanOrEqual(GROUND.minZ)
      expect(d.z).toBeLessThanOrEqual(GROUND.maxZ)
    }
    for (const b of w.allColliders()) {
      if (!Number.isFinite(b.min.x)) continue
      expect(b.max.x).toBeLessThanOrEqual(GROUND.maxX + 1)
      expect(b.min.z).toBeGreaterThanOrEqual(GROUND.minZ - 1)
    }
  })

  it('모델을 못 받아도 들판·마을 ready 는 거절하지 않는다 (나머지를 다 기다린다)', async () => {
    const { createWorld } = await import('./vendor/world.js')
    const w = createWorld()
    await expect(w.outdoor.ready).resolves.toBeDefined()
    await expect(w.town.ready).resolves.toBeDefined()
    // 가구 받기(실패)도 기다린다 (테스트가 끝난 뒤 진짜 fetch 로 가지 않게)
    await Promise.allSettled([w.furnitureReady])
  })

  it('침대 자리·깨어나는 자리는 은지 침대와 침실이다 (감지 상자도 침실 안)', async () => {
    const { createWorld } = await import('./vendor/world.js')
    const { BED_SPOT, BED_WAKE, BED_ZONE, toMeadowLocal } = await import('../game/data/meadow')
    const w = createWorld()
    expect(toMeadowLocal(...BED_SPOT)).toEqual([w.bedSpot.center.x, w.bedSpot.center.z])
    expect(w.roomAt(...toMeadowLocal(...BED_WAKE)).id).toBe('bedroom')
    const [cx, cz] = BED_ZONE.center
    const [hx, , hz] = BED_ZONE.half
    for (const [x, z] of [[cx - hx, cz - hz], [cx + hx, cz + hz]]) expect(w.roomAt(...toMeadowLocal(x, z)).id).toBe('bedroom')
    await Promise.allSettled([w.furnitureReady, w.outdoor.ready, w.town.ready])
  })
  it('문 4개는 MEADOW_DOORS 순서이고, doorBox 로 잰 상자가 은지 door.collider 와 같다 (group 이 변환 아래에 없을 때)', async () => {
    const { createWorld } = await import('./vendor/world.js')
    const { MEADOW_DOORS } = await import('../game/data/meadow')
    const { doorBox } = await import('../game/logic/meadowColliders')
    const w = createWorld()
    expect(w.doors.map((d) => d.label)).toEqual(MEADOW_DOORS)
    for (const d of w.doors) {
      for (const open of [false, true]) {
        d.setOpen(open, true)
        const b = doorBox({ x: d.group.position.x, z: d.group.position.z, yaw: d.base + (open ? Math.PI / 2 : 0), width: d.width, height: d.panel.geometry.parameters.height })
        for (const k of ['x', 'y', 'z'] as const) {
          expect(b.min[k]).toBeCloseTo(d.collider.min[k], 5)
          expect(b.max[k]).toBeCloseTo(d.collider.max[k], 5)
        }
      }
    }
    await Promise.allSettled([w.furnitureReady, w.outdoor.ready, w.town.ready])
  })
  it('상인 3곳 자리·이름·E 거리가 은지 town.js 와 같다', async () => {
    const { VENDORS, VENDOR_DIST } = await import('./vendor/town.js')
    const { MEADOW_VENDORS } = await import('../game/data/meadow')
    const { MEADOW_REACH } = await import('../game/logic/meadowInteract')
    expect(MEADOW_VENDORS.map((v) => [v.id, v.name, ...v.at])).toEqual(VENDORS.map((v) => [v.id, v.name, v.x, v.z]))
    expect(MEADOW_REACH.vendor).toBe(VENDOR_DIST)
  })
  it('총 수치가 은지 weapons.js WEAPONS 와 같고, 총마다 모델에 총구가 있다', async () => {
    const { WEAPONS, buildWeaponModel } = await import('./vendor/weapons.js')
    const { GUNS, GUN_IDS } = await import('../game/data/guns')
    const pick = (w: Record<string, unknown>) => [w.id, w.name, w.auto, w.rpm, w.mag, w.reload, w.pellets, w.dmg, w.spread, w.aimSpread, w.recoil, w.aimFov, w.zoom]
    expect(GUN_IDS.map((id) => pick(GUNS[id]))).toEqual(WEAPONS.filter((w) => w.type === 'gun').map((w) => pick(w)))
    for (const id of GUN_IDS) expect(buildWeaponModel(id, { shadows: false }).userData.muzzle.position.z).toBeLessThan(0)
  })
  it('사격장: 표적 3개(은지 x 25.6)와 무기 선반이 사격장 방 안에 있고, 사격장 빛은 더하지 않는다', async () => {
    const { createWorld } = await import('./vendor/world.js')
    const { inRangeRoom, toWorld } = await import('../game/data/meadow')
    const w = createWorld()
    expect(w.range.targets.map((t) => [t.lane, t.pivot.position.x])).toEqual([
      [1, 25.6],
      [2, 25.6],
      [3, 25.6],
    ])
    expect(inRangeRoom(...toWorld(w.range.rack.center.x, w.range.rack.center.z))).toBe(true)
    expect(inRangeRoom(...toWorld(10, 0))).toBe(false)
    expect(w.group.children.filter((o) => (o as { isPointLight?: boolean }).isPointLight).length).toBe(4 + w.lights.lamps.length)
    await Promise.allSettled([w.furnitureReady, w.outdoor.ready, w.town.ready])
  })
  it('모델 주소는 meadow/ 아래', async () => {
    const { asset } = await import('./vendor/paths.js')
    expect(asset('models/kenney/desk.glb')).toBe('/meadow/models/kenney/desk.glb')
  })
})
