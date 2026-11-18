import { PointLight, type Object3D, type Vector3 } from 'three'
import { ISLAND_LANTERNS } from '../game/data/zones'
import { skyNow } from '../game/scene/skyNow'
import { DayNight } from './vendor/daynight.js'
import { ROOMS, createWorld, type EunjiWorld } from './vendor/world.js'

let world: EunjiWorld | null = null
let daynight: DayNight | null = null
let roomLamps: PointLight[] = []
/** 방 조명마다 그 방 id (roomLamps 와 같은 순서) */
let roomLampRooms: string[] = []
let lanterns: PointLight[] | null = null
/** 은지 방 조명 세기 */
const ROOM_LAMP = 5

const isPointLight = (o: Object3D): o is PointLight => (o as PointLight).isPointLight === true

/**
 * 은지 맵. 한 번만 만든다 (모델을 내려받기 시작한다). 문은 3-2 전까지 열어 둔다.
 * group 은 모델이 다 온 뒤에 붙으므로 그 안의 빛은 미리 꺼낸다 (빛 개수가 중간에 바뀌면 모든 재질을 다시 컴파일해 끊긴다):
 * 방 조명·가로등은 group 에서 꺼내 MeadowLighting 이 처음부터 붙이고, 밤낮은 세기로만 바꾼다
 */
export function meadowWorld(): EunjiWorld {
  if (!world) {
    world = createWorld()
    for (const d of world.doors) d.setOpen(true, true)
    // 가로등도 같은 group 에 바로 붙어 있다 (처음 세기 0, DayNight 가 밤에 올린다)
    const town = new Set<Object3D>(world.lights.lamps)
    roomLamps = world.group.children.filter((o): o is PointLight => isPointLight(o) && !town.has(o))
    roomLampRooms = roomLamps.map((l) => ROOMS.find((r) => l.position.x >= r.minX && l.position.x <= r.maxX && l.position.z >= r.minZ && l.position.z <= r.maxZ)?.id ?? '')
    for (const l of [...roomLamps, ...world.lights.lamps]) world.group.remove(l)
  }
  return world
}

/** 방 조명 (은지 좌표). MeadowLighting 이 변환 그룹 아래에 붙인다 */
export function meadowRoomLamps(): PointLight[] {
  meadowWorld()
  return roomLamps
}

/** 섬 등불 빛 2개 (세계 좌표). 처음 세기 0 */
export function islandLanterns(): PointLight[] {
  lanterns ??= ISLAND_LANTERNS.map(([x, y, z]) => {
    const l = new PointLight(0xffc070, 0, 12, 2)
    l.position.set(x, y, z)
    return l
  })
  return lanterns
}

/** 은지 낮과 밤 (해·하늘빛·가로등·섬 등불을 움직인다) */
export function meadowDayNight(): DayNight {
  if (!daynight) {
    const { lights } = meadowWorld()
    daynight = new DayNight({ ...lights, lamps: [...lights.lamps, ...islandLanterns()] })
  }
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

/**
 * 지금 시각(t)으로 해·하늘빛·등불을 맞추고 플레이어(은지 좌표 local)를 따라 해를 옮긴다.
 * 하늘(skyNow): 배경은 실내면 흰빛을 어둡게(은지 roomAt), 바다는 늘 바깥 하늘. 해 방향은 180° 돌려 세계 좌표로
 */
export function followMeadowSun(local: Vector3, t: number) {
  const dn = meadowDayNight()
  dn.t = t
  dn.update(0, local)
  const outdoor = meadowWorld().roomAt(local.x, local.z).outdoor === true
  skyNow.background.copy(dn.skyFor(outdoor).color)
  skyNow.sea.copy(dn.skyFor(true).color)
  skyNow.sunDir.set(-dn.offset.x, dn.offset.y, -dn.offset.z).normalize()
}

/** 방 조명 세기: 보통은 모두 켠다. 폰(low)은 내가 있는 방만 (빛 개수는 그대로, 세기만) */
export function updateRoomLamps(low: boolean, local: Vector3) {
  const here = low ? meadowWorld().roomAt(local.x, local.z).id : null
  roomLamps.forEach((l, i) => {
    l.intensity = here === null || roomLampRooms[i] === here ? ROOM_LAMP : 0
  })
}

/** 해 그림자 지도 크기를 바꾼다 (지도를 새로 만든다) */
export function setMeadowShadowSize(size: number) {
  const { sun } = meadowWorld().lights
  sun.shadow.mapSize.set(size, size)
  sun.shadow.map?.dispose()
  sun.shadow.map = null
}
