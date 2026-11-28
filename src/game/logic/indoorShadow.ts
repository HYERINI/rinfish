/**
 * 실내 물체 그림자 (순수). 집 안은 지붕과 바깥벽이 해를 가려 이미 그림자 속이라, 방 안에 다 들어 있는 물체의 그림자는
 * 화면에 안 나온다 (그림자 그리기만 늘린다). 벽 두께 안에 걸친 벽·문, 천장보다 높은 지붕은 그림자가 밖으로 나갈 수 있어 남긴다
 */

type Rect = { minX: number; maxX: number; minZ: number; maxZ: number }
type Box = { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } }

/** 벽 두께(0.16)의 반보다 조금 더 안쪽부터 실내로 본다 */
const INSET = 0.12

/** 물체 상자(은지 좌표)가 어느 방 안쪽에 다 들어 있고 천장(ceiling) 아래인가 */
export function insideRoom(b: Box, rooms: Rect[], ceiling: number): boolean {
  if (b.max.y > ceiling + 0.01) return false
  return rooms.some((r) => b.min.x >= r.minX + INSET && b.max.x <= r.maxX - INSET && b.min.z >= r.minZ + INSET && b.max.z <= r.maxZ - INSET)
}
