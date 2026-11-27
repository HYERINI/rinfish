import { Raycaster, Vector3, type Mesh, type Object3D } from 'three'
import type { useRapier } from '@react-three/rapier'
import { meadowRange } from '../../../meadow/meadowSingleton'
import { GUN_RANGE } from '../../data/guns'
import { animalViews } from '../../hunt/animalRig'
import { rayPoint, type AimRay } from '../../logic/aimAnchor'
import { firstBodyHit, type V3 } from '../../logic/hitscan'
import { netNow, peerBodies } from '../../net/remoteRig'
import { useNetStore } from '../../stores/netStore'

type Rapier = ReturnType<typeof useRapier>

const boardHit = new Raycaster()
const from = new Vector3()
const along = new Vector3()

function inScene(o: Object3D): boolean {
  for (let p: Object3D | null = o; p; p = p.parent) if ((p as { isScene?: boolean }).isScene) return true
  return false
}

/**
 * 화면 가운데 광선이 처음 닿는 점: 벽·땅(고정 충돌체), 동물, 다른 사람, 사격장 표적판 가운데 가장 가까운 것 (총알이 맞는 것과 같다).
 * 아무것도 없으면 사거리 끝. 조준할 때 카메라가 바뀌어도 같은 곳을 보게 하는 데 쓴다 (logic/aimAnchor)
 */
export function aimPoint({ world, rapier }: Rapier, ray: AimRay): V3 {
  const r = new rapier.Ray(ray.o, ray.d)
  const wall = world.castRay(r, GUN_RANGE, true, rapier.QueryFilterFlags.ONLY_FIXED | rapier.QueryFilterFlags.EXCLUDE_SENSORS)
  let t = wall ? wall.timeOfImpact : GUN_RANGE
  const online = useNetStore.getState().phase !== 'off'
  const body = firstBodyHit(ray.o, ray.d, 0, t, animalViews(online, netNow()), online ? peerBodies(netNow()) : [])
  if (body) t = Math.min(t, body.t)
  const boards: Mesh[] = meadowRange().targets.map((x) => x.board).filter(inScene)
  if (boards.length) {
    boardHit.set(from.set(ray.o.x, ray.o.y, ray.o.z), along.set(ray.d.x, ray.d.y, ray.d.z))
    boardHit.far = t
    const board = boardHit.intersectObjects(boards, false)[0]
    if (board) t = Math.min(t, board.distance)
  }
  return rayPoint(ray, t)
}
