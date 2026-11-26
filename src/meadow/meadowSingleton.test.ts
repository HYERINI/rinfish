// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { stubCanvas2d } from './canvasStub'
import { Vector3, type Light, type Object3D } from 'three'

// 모델 파일은 테스트에서 받지 않는다
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

const isLight = (o: Object3D): o is Light => (o as Light).isLight === true
/** 은지 좌표: 침실 가운데, 마당 */
const BEDROOM = new Vector3(0, 1, 0)
const YARD = new Vector3(12, 1, 12)

describe('초원 조명 (빛 개수가 처음부터 같게)', () => {
  it('방 조명 4 + 가로등 4 + 섬 등불 2 = 10개를 은지 group 밖으로 꺼내 둔다 (group 이 나중에 붙어도 빛이 늘지 않는다)', async () => {
    const { islandLanterns, meadowReady, meadowRoomLamps, meadowWorld } = await import('./meadowSingleton')
    const { ROOMS } = await import('./vendor/world.js')
    const w = meadowWorld()
    expect(meadowRoomLamps().length).toBe(ROOMS.length)
    const lamps = [...meadowRoomLamps(), ...w.lights.lamps, ...islandLanterns()]
    expect(lamps.length).toBe(10)
    for (const l of lamps) {
      expect(l.isLight).toBe(true)
      expect(l.parent).toBeNull()
      expect(l.visible).toBe(true)
    }
    // 해·하늘빛은 MeadowLighting 이 따로 붙이므로 빼고, group 안에 빛이 없다
    const inside: Light[] = []
    w.group.traverse((o) => {
      if (isLight(o) && o !== w.lights.sun && o !== w.lights.hemi) inside.push(o)
    })
    expect(inside).toEqual([])
    // 모델 받기(실패)를 다 기다린다 (테스트가 끝난 뒤 진짜 fetch 로 가지 않게)
    await meadowReady()
  })
})

describe('낮과 밤', () => {
  it('낮(12:00)엔 가로등·섬 등불 세기 0, 밤(00:00)엔 켜진다', async () => {
    const { followMeadowSun, islandLanterns, meadowWorld } = await import('./meadowSingleton')
    const lamps = [...meadowWorld().lights.lamps, ...islandLanterns()]
    followMeadowSun(YARD, 0.25)
    for (const l of lamps) expect(l.intensity).toBeCloseTo(0)
    followMeadowSun(YARD, 0.75)
    for (const l of lamps) expect(l.intensity).toBeCloseTo(7)
  })

  it('하늘: 낮엔 은지 낮 하늘, 밤엔 밤 하늘. 바다도 같은 색을 비춘다', async () => {
    const { followMeadowSun } = await import('./meadowSingleton')
    const { skyNow } = await import('../game/scene/skyNow')
    followMeadowSun(YARD, 0.25)
    expect(skyNow.background.getHexString()).toBe('a9d4f5')
    expect(skyNow.sea.getHexString()).toBe('a9d4f5')
    followMeadowSun(YARD, 0.75)
    expect(skyNow.background.getHexString()).toBe('0d1326')
    expect(skyNow.sea.getHexString()).toBe('0d1326')
  })

  it('실내에선 배경만 흰빛(밤엔 어둡게), 바다는 바깥 하늘 그대로', async () => {
    const { followMeadowSun } = await import('./meadowSingleton')
    const { skyNow } = await import('../game/scene/skyNow')
    followMeadowSun(BEDROOM, 0.25)
    expect(skyNow.background.getHexString()).toBe('ffffff')
    expect(skyNow.sea.getHexString()).toBe('a9d4f5')
    followMeadowSun(BEDROOM, 0.75)
    expect(skyNow.background.r).toBeLessThan(0.5)
  })

  it('해 방향은 은지 좌표를 180° 돌린 세계 방향 (아침 해는 은지 +x = 세계 -x 쪽)', async () => {
    const { followMeadowSun } = await import('./meadowSingleton')
    const { skyNow } = await import('../game/scene/skyNow')
    followMeadowSun(YARD, 0.05)
    expect(skyNow.sunDir.x).toBeLessThan(0)
    expect(skyNow.sunDir.y).toBeGreaterThan(0)
    expect(skyNow.sunDir.length()).toBeCloseTo(1)
  })

  it('폰(low)은 내가 있는 방 조명만 켜고, 보통은 모두 켠다 (빛 개수는 그대로)', async () => {
    const { meadowRoomLamps, updateRoomLamps } = await import('./meadowSingleton')
    const lamps = meadowRoomLamps()
    const bedroomLamp = lamps.find((l) => l.position.x === 0 && l.position.z === 0)!
    updateRoomLamps(true, BEDROOM)
    expect(bedroomLamp.intensity).toBe(5)
    expect(lamps.filter((l) => l.intensity > 0)).toEqual([bedroomLamp])
    updateRoomLamps(true, YARD)
    expect(lamps.every((l) => l.intensity === 0)).toBe(true)
    updateRoomLamps(false, YARD)
    expect(lamps.every((l) => l.intensity === 5)).toBe(true)
  })
})

describe('버섯·호박 따기', () => {
  it('따면 숨기고 respawn 초 뒤 다시 보인다. 숨긴 걸 또 딸 수 없다', async () => {
    const { harvestPickup, meadowPickups, meadowSpots, regrowPickups } = await import('./meadowSingleton')
    const { Object3D } = await import('three')
    const list = meadowPickups()
    const index = list.length
    list.push({ obj: new Object3D(), id: 'pumpkin', label: '호박', center: new Vector3(6.5, 1, -15.2), respawn: 90, timer: 0 })
    expect(meadowSpots().some((s) => s.target.kind === 'pickup' && s.target.index === index && s.x === 6.5)).toBe(true)
    expect(harvestPickup(index)).toBe('pumpkin')
    expect(list[index].obj.visible).toBe(false)
    expect(harvestPickup(index)).toBeNull()
    regrowPickups(89)
    expect(list[index].obj.visible).toBe(false)
    regrowPickups(1)
    expect(list[index].obj.visible).toBe(true)
    expect(harvestPickup(999)).toBeNull()
    list.pop()
  })
})

describe('문', () => {
  it('저장된 상태로 처음엔 바로(돌아가는 중 없이), 그 뒤엔 은지처럼 돌아가며 맞춘다. 충돌 상자는 목표 자리', async () => {
    const { applyDoors, doorCuboid, meadowWorld } = await import('./meadowSingleton')
    const doors = meadowWorld().doors
    applyDoors([true, false, false, false], true)
    expect(doors[0].open).toBe(true)
    expect(doors[0].angle).toBeCloseTo(Math.PI / 2)
    applyDoors([false, false, false, false], false)
    expect(doors[0].open).toBe(false)
    // 문짝은 아직 열린 자리 (update 로 돌아간다)
    expect(doors[0].angle).toBeCloseTo(Math.PI / 2)
    for (let i = 0; i < 60; i++) doors[0].update(1 / 30)
    expect(doors[0].angle).toBeCloseTo(0)
    // 거실 문(은지 x 5, z -0.5~0.5 → 세계 x 167): 닫히면 얇은 판이 세계 z 축을 따라, 열리면 x 축을 따라
    const closed = doorCuboid(0, false)!
    const open = doorCuboid(0, true)!
    expect(closed.center[0]).toBeCloseTo(167)
    expect(closed.half[2]).toBeCloseTo(0.5)
    expect(open.half[0]).toBeCloseTo(0.5)
    expect(doorCuboid(9, true)).toBeNull()
  })
})
