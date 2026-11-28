import { Box3, PointLight, type Mesh, type Object3D, type Vector3 } from 'three'
import { MEADOW_VENDORS } from '../game/data/meadow'
import { ISLAND_LANTERNS } from '../game/data/zones'
import { skyNow } from '../game/scene/skyNow'
import { DayNight } from './vendor/daynight.js'
import { boxesToCuboids, doorBox, type Cuboid } from '../game/logic/meadowColliders'
import { MEADOW_REACH, type MeadowSpot } from '../game/logic/meadowInteract'
import { SHADOW_HALF } from '../game/logic/shadowFocus'
import { insideRoom } from '../game/logic/indoorShadow'
import type { EunjiRange } from './vendor/range.js'
import { ROOMS, WALL_H, createWorld, type EunjiPickup, type EunjiWorld } from './vendor/world.js'

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
 * 은지 맵. 한 번만 만든다 (모델을 내려받기 시작한다). 문은 닫힌 채로 만들어지고 MeadowDoors 가 저장된 상태로 맞춘다.
 * group 은 모델이 다 온 뒤에 붙으므로 그 안의 빛은 미리 꺼낸다 (빛 개수가 중간에 바뀌면 모든 재질을 다시 컴파일해 끊긴다):
 * 방 조명·가로등은 group 에서 꺼내 MeadowLighting 이 처음부터 붙이고, 밤낮은 세기로만 바꾼다
 */
export function meadowWorld(): EunjiWorld {
  if (!world) {
    world = createWorld()
    // 가로등도 같은 group 에 바로 붙어 있다 (처음 세기 0, DayNight 가 밤에 올린다)
    const town = new Set<Object3D>(world.lights.lamps)
    roomLamps = world.group.children.filter((o): o is PointLight => isPointLight(o) && !town.has(o))
    roomLampRooms = roomLamps.map((l) => ROOMS.find((r) => l.position.x >= r.minX && l.position.x <= r.maxX && l.position.z >= r.minZ && l.position.z <= r.maxZ)?.id ?? '')
    for (const l of [...roomLamps, ...world.lights.lamps]) world.group.remove(l)
    // 그림자 범위: 은지 ±22m 대신 보는 쪽 앞으로 옮긴 ±SHADOW_HALF (MeadowLighting 이 가운데를 정한다)
    const cam = world.lights.sun.shadow.camera
    cam.left = cam.bottom = -SHADOW_HALF
    cam.right = cam.top = SHADOW_HALF
    cam.updateProjectionMatrix()
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
  ready ??= Promise.allSettled([w.furnitureReady, w.outdoor.ready, w.town.ready]).then(() => dropIndoorShadows(w))
  return ready
}
let ready: Promise<void> | null = null

/** 방 안에 다 들어 있는 물체는 그림자를 안 만든다 (지붕·바깥벽 그림자에 가려 안 보이고 그림자 그리기만 는다). 모델이 다 온 뒤 한 번 */
function dropIndoorShadows(w: EunjiWorld) {
  const box = new Box3()
  w.group.updateMatrixWorld(true)
  w.group.traverse((o) => {
    if (!(o as Mesh).isMesh || !o.castShadow) return
    // group 이 아직 장면에 안 붙어 있어 월드 좌표 = 은지 좌표
    if (insideRoom(box.setFromObject(o), ROOMS, WALL_H)) o.castShadow = false
  })
}

/**
 * 지금 시각(t)으로 해·하늘빛·등불을 맞추고 그림자 범위 가운데(은지 좌표 focus, 없으면 플레이어 local)를 따라 해를 옮긴다.
 * 하늘(skyNow): 배경은 실내면 흰빛을 어둡게(플레이어 자리로 은지 roomAt), 바다는 늘 바깥 하늘. 해 방향은 180° 돌려 세계 좌표로
 */
export function followMeadowSun(local: Vector3, t: number, focus: Vector3 = local) {
  const dn = meadowDayNight()
  dn.t = t
  dn.update(0, focus)
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

/** 버섯·호박 (은지 좌표). 모델이 들어오는 대로 늘어난다 */
export function meadowPickups(): EunjiPickup[] {
  return meadowWorld().outdoor.pickups
}

/** 따기: 숨기고 다시 자랄 시간을 건다. 이미 숨겼거나 없는 번호면 null */
export function harvestPickup(index: number): EunjiPickup['id'] | null {
  const p = meadowPickups()[index]
  if (!p || !p.obj.visible) return null
  p.obj.visible = false
  p.timer = p.respawn
  return p.id
}

/** 숨긴 것의 남은 시간을 줄이고, 다 되면 다시 보인다 (은지 그대로 내 화면만) */
export function regrowPickups(dt: number) {
  for (const p of meadowPickups()) {
    if (p.obj.visible) continue
    p.timer -= dt
    if (p.timer <= 0) p.obj.visible = true
  }
}

let spots: MeadowSpot[] = []
let spotsKey = ''

/** 사격장 표적·무기 선반·연습 게임 (은지 range.js) */
export function meadowRange(): EunjiRange {
  return meadowWorld().range
}

/** 초원 E 대상 (은지 좌표): 가스레인지·문·상인·사격장 무기 선반·버섯·호박. 모델이 들어와 자리·개수가 바뀔 때만 다시 만든다 */
export function meadowSpots(): MeadowSpot[] {
  const w = meadowWorld()
  const pickups = w.outdoor.pickups
  const key = `${pickups.length}:${w.stove.center.x}:${w.stove.center.z}`
  if (key !== spotsKey) {
    spotsKey = key
    spots = [
      { target: { kind: 'stove' }, x: w.stove.center.x, z: w.stove.center.z, reach: MEADOW_REACH.stove },
      ...w.doors.map((d, index): MeadowSpot => ({ target: { kind: 'door', index }, x: d.center.x, z: d.center.z, reach: MEADOW_REACH.door })),
      ...MEADOW_VENDORS.map((v): MeadowSpot => ({ target: { kind: 'vendor', id: v.id }, x: v.at[0], z: v.at[1], reach: MEADOW_REACH.vendor })),
      { target: { kind: 'rack' }, x: w.range.rack.center.x, z: w.range.rack.center.z, reach: MEADOW_REACH.rack },
      ...pickups.map((p, index): MeadowSpot => ({ target: { kind: 'pickup', index, item: p.id }, x: p.center.x, z: p.center.z, reach: MEADOW_REACH.pickup })),
    ]
  }
  return spots
}

/** 문 하나의 Rapier 상자 (세계 좌표). 문짝이 다 돌아간 뒤(열림 90°·닫힘 0°) 자리로 잰다 */
export function doorCuboid(index: number, open: boolean): Cuboid | null {
  const d = meadowWorld().doors[index]
  if (!d) return null
  const box = doorBox({ x: d.group.position.x, z: d.group.position.z, yaw: d.base + (open ? Math.PI / 2 : 0), width: d.width, height: d.panel.geometry.parameters.height })
  return boxesToCuboids([box])[0] ?? null
}

/** 저장된 문 상태로 맞춘다. instant 면 애니메이션 없이 바로 (처음 붙일 때) */
export function applyDoors(opens: readonly boolean[], instant: boolean) {
  meadowWorld().doors.forEach((d, i) => {
    const open = opens[i] === true
    if (d.open !== open) d.setOpen(open, instant)
  })
}
