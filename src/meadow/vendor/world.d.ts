import type { Box3, BoxGeometry, DirectionalLight, Group, HemisphereLight, Light, Mesh, Object3D, Vector3 } from 'three'

/** outdoor: 마당·광장·들판 (실내 방엔 없다) */
export type EunjiRoom = { id: string; name: string; minX: number; maxX: number; minZ: number; maxZ: number; outdoor?: boolean }
export const ROOMS: EunjiRoom[]
/** 실내 천장 높이 (m) */
export const WALL_H: number

/** 은지 문. group 은 경첩 자리에 서서 rotation.y = base + angle. 문짝 상자는 logic/meadowColliders.doorBox 로 은지 좌표에서 잰다 */
export type EunjiDoor = {
  group: Group
  panel: Mesh<BoxGeometry>
  base: number
  angle: number
  width: number
  open: boolean
  label: string
  /** 상호작용 기준점 (문 가운데) */
  center: Vector3
  /** 은지가 세계 행렬로 잰 상자. 초원에선 세계 좌표라 쓰지 않는다 (테스트에서 doorBox 와 비교만) */
  collider: Box3
  setOpen(open: boolean, instant?: boolean): void
  /** 열리고 닫히는 애니메이션 (매 프레임) */
  update(dt: number): void
}

/** 따는 것 (버섯·호박). 모델이 들어온 순서대로 쌓인다. timer: 다시 보일 때까지 남은 초 */
export type EunjiPickup = { obj: Object3D; id: 'mushroom' | 'pumpkin'; label: string; center: Vector3; respawn: number; timer: number }

export type EunjiWorld = {
  group: Group
  /** 움직이지 않는 충돌 상자 (문 빼고, 은지 좌표) */
  colliders: Box3[]
  allColliders(): Box3[]
  doors: EunjiDoor[]
  furnitureReady: Promise<unknown>
  outdoor: { ready: Promise<unknown>; pickups: EunjiPickup[] }
  /** 부엌 가스레인지 (가구가 들어오면 자리가 정해진다) */
  stove: { center: Vector3; label: string }
  town: { ready: Promise<unknown> }
  lights: { sun: DirectionalLight; hemi: HemisphereLight; lamps: Light[] }
  /** 은지 좌표 (x, z) 의 방: 실내 방 → 마당 → 광장 → 들판 순 */
  roomAt(x: number, z: number): EunjiRoom
  bedSpot: { center: Vector3; label: string }
}

export function createWorld(): EunjiWorld
