import type { Box3, DirectionalLight, Group, HemisphereLight, Light, Vector3 } from 'three'

/** outdoor: 마당·광장·들판 (실내 방엔 없다) */
export type EunjiRoom = { id: string; name: string; minX: number; maxX: number; minZ: number; maxZ: number; outdoor?: boolean }
export const ROOMS: EunjiRoom[]
/** 실내 천장 높이 (m) */
export const WALL_H: number

export type EunjiDoor = { setOpen(open: boolean, instant?: boolean): void; collider: Box3 }

export type EunjiWorld = {
  group: Group
  allColliders(): Box3[]
  doors: EunjiDoor[]
  furnitureReady: Promise<unknown>
  outdoor: { ready: Promise<unknown> }
  town: { ready: Promise<unknown> }
  lights: { sun: DirectionalLight; hemi: HemisphereLight; lamps: Light[] }
  /** 은지 좌표 (x, z) 의 방: 실내 방 → 마당 → 광장 → 들판 순 */
  roomAt(x: number, z: number): EunjiRoom
  bedSpot: { center: Vector3; label: string }
}

export function createWorld(): EunjiWorld
