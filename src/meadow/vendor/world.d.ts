import type { Box3, DirectionalLight, Group, HemisphereLight, Light } from 'three'

export type EunjiRoom = { id: string; name: string; minX: number; maxX: number; minZ: number; maxZ: number }
export const ROOMS: EunjiRoom[]

export type EunjiDoor = { setOpen(open: boolean, instant?: boolean): void; collider: Box3 }

export type EunjiWorld = {
  group: Group
  allColliders(): Box3[]
  doors: EunjiDoor[]
  furnitureReady: Promise<unknown>
  outdoor: { ready: Promise<unknown> }
  town: { ready: Promise<unknown> }
  lights: { sun: DirectionalLight; hemi: HemisphereLight; lamps: Light[] }
}

export function createWorld(): EunjiWorld
