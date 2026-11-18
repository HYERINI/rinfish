/** 감정 표현 바퀴: 가운데에서 이만큼(px) 안쪽이면 아무것도 고르지 않는다 */
export const WHEEL_DEAD = 24
/** 마우스 잠금 중 움직인 만큼 모으는 최대 길이(px). 이 이상 밀어도 방향만 바뀐다 */
export const WHEEL_REACH = 120

/**
 * 화면 방향(dx 오른쪽 +, dy 아래 +) → 바퀴 칸 번호. 0번이 맨 위, 시계 방향으로 count 칸. 가운데 근처면 null
 */
export function wheelPick(dx: number, dy: number, count: number, dead = WHEEL_DEAD): number | null {
  if (count < 1 || Math.hypot(dx, dy) < dead) return null
  const angle = Math.atan2(dx, -dy)
  const step = (Math.PI * 2) / count
  return ((Math.round(angle / step) % count) + count) % count
}

/** 마우스 잠금 중 움직임(movementX/Y)을 모은다. 길이는 WHEEL_REACH 까지 */
export function addAim(aim: { x: number; y: number }, mx: number, my: number): { x: number; y: number } {
  const x = aim.x + mx
  const y = aim.y + my
  const len = Math.hypot(x, y)
  return len > WHEEL_REACH ? { x: (x / len) * WHEEL_REACH, y: (y / len) * WHEEL_REACH } : { x, y }
}

/** 바퀴 위 칸 i 의 자리 (가운데 기준 px, 반지름 r) */
export function wheelSlot(i: number, count: number, r: number): { x: number; y: number } {
  const a = (i / count) * Math.PI * 2
  return { x: Math.sin(a) * r, y: -Math.cos(a) * r }
}
