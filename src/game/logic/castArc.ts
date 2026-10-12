export type Vec3 = { x: number; y: number; z: number }

/** 찌가 날아가는 시간(초). 멀리 던질수록 조금 더 오래 난다 */
export function castFlightTime(distance: number): number {
  return 0.35 + distance * 0.04
}

/** 포물선 꼭대기가 출발점·도착점 중 높은 쪽보다 얼마나 위에 있는지 */
export function castArcHeight(distance: number): number {
  return 1.2 + distance * 0.2
}

/**
 * 출발점 → 도착점 포물선 위의 점 (t: 0~1, 범위를 벗어나면 잘라 낸다).
 * 수평은 일정한 속도로, 높이는 직선 + 4h·t(1-t) 로 올라갔다 내려온다
 */
export function arcPoint(from: Vec3, to: Vec3, t: number, height: number, out: Vec3): Vec3 {
  const k = Math.min(1, Math.max(0, t))
  out.x = from.x + (to.x - from.x) * k
  out.z = from.z + (to.z - from.z) * k
  out.y = from.y + (to.y - from.y) * k + 4 * height * k * (1 - k)
  return out
}

/**
 * 낚싯줄 처짐: 두 점을 잇는 2차 베지어 곡선 위의 점 (t: 0~1).
 * 가운데 조절점을 sag 만큼 아래로 내려 줄이 늘어진 것처럼 보이게 한다
 */
export function saggingLinePoint(from: Vec3, to: Vec3, t: number, sag: number, out: Vec3): Vec3 {
  const mx = (from.x + to.x) / 2
  const my = (from.y + to.y) / 2 - sag * 2
  const mz = (from.z + to.z) / 2
  const a = (1 - t) * (1 - t)
  const b = 2 * (1 - t) * t
  const c = t * t
  out.x = a * from.x + b * mx + c * to.x
  out.y = a * from.y + b * my + c * to.y
  out.z = a * from.z + b * mz + c * to.z
  return out
}
