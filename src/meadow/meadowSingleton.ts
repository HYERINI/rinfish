import type { Color, Object3D, PointLight, Vector3 } from 'three'
import { DayNight } from './vendor/daynight.js'
import { createWorld, type EunjiWorld } from './vendor/world.js'

/** 하루 진행도 0.25 = 정오. 낮과 밤은 3단계에서 서버 시계와 함께 켠다 */
export const NOON_T = 0.25

let world: EunjiWorld | null = null
let daynight: DayNight | null = null
let roomLamps: PointLight[] = []

const isPointLight = (o: Object3D): o is PointLight => (o as PointLight).isPointLight === true

/**
 * 은지 맵. 한 번만 만든다 (모델을 내려받기 시작한다). 문은 3단계 전까지 열어 둔다.
 * group 은 모델이 다 온 뒤에 붙으므로 그 안의 빛은 미리 정리한다 (빛 개수가 중간에 바뀌면 모든 재질을 다시 컴파일해 끊긴다):
 * 방 조명은 group 에서 꺼내 MeadowLighting 이 처음부터 붙이고, 가로등은 낮 고정인 동안 숨긴다 (3단계 낮과 밤에서 켠다)
 */
export function meadowWorld(): EunjiWorld {
  if (!world) {
    world = createWorld()
    for (const d of world.doors) d.setOpen(true, true)
    // 가로등도 같은 group 에 바로 붙어 있어서 뺀다
    const town = new Set<Object3D>(world.lights.lamps)
    roomLamps = world.group.children.filter((o): o is PointLight => isPointLight(o) && !town.has(o))
    for (const l of roomLamps) world.group.remove(l)
    for (const l of world.lights.lamps) l.visible = false
  }
  return world
}

/** 방 조명 (은지 좌표). MeadowLighting 이 변환 그룹 아래에 붙인다 */
export function meadowRoomLamps(): PointLight[] {
  meadowWorld()
  return roomLamps
}

/** 은지 낮과 밤 (해·하늘빛을 움직인다) */
export function meadowDayNight(): DayNight {
  daynight ??= new DayNight(meadowWorld().lights)
  return daynight
}

/**
 * 가구·들판·마을 모델이 다 들어왔을 때 (실패한 모델은 빼고).
 * 은지 코드는 모델이 올 때 부모까지 포함한 좌표로 충돌 상자를 재므로, 이게 끝나기 전엔 group 을 장면(변환 그룹)에 붙이지 않는다
 */
export function meadowReady(): Promise<void> {
  const w = meadowWorld()
  return Promise.allSettled([w.furnitureReady, w.outdoor.ready, w.town.ready]).then(() => undefined)
}

/** 해·하늘빛을 플레이어(은지 좌표)에 맞춘다. 낮(정오) 고정, 3단계에서 서버 시계로 바꾼다 */
export function followMeadowSun(local: Vector3) {
  const dn = meadowDayNight()
  dn.t = NOON_T
  dn.update(0, local)
}

/** 해 그림자 지도 크기를 바꾼다 (지도를 새로 만든다) */
export function setMeadowShadowSize(size: number) {
  const { sun } = meadowWorld().lights
  sun.shadow.mapSize.set(size, size)
  sun.shadow.map?.dispose()
  sun.shadow.map = null
}

/** 지금 바깥 하늘색 (복사본) */
export function meadowSkyColor(): Color {
  return meadowDayNight().skyFor(true).color.clone()
}
