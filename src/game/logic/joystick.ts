/**
 * 가상 조이스틱과 키보드(WASD) 이동 입력을 같은 모양으로 바꾼다.
 * forward·right 는 카메라 기준 (앞 = 화면 위쪽), 길이는 1 (안 움직이면 0). scale 은 걷기 속도 배율 (0~1)
 */
export type MoveInput = { forward: number; right: number; scale: number; sprint: boolean }

export type StickConfig = { deadzone: number; sprintAt: number; minWalk: number }

/** 조이스틱 손잡이 위치: x 오른쪽, y 앞(화면 위). 길이는 받침 반지름 대비 0~1 */
export type Stick = { x: number; y: number }

export const NO_STICK: Stick = { x: 0, y: 0 }

export const NO_MOVE: MoveInput = { forward: 0, right: 0, scale: 0, sprint: false }

/**
 * 받침 가운데에서 손가락까지 (화면 px, dy 는 아래로 +) → 손잡이 위치. 반지름 밖으로 나가면 가장자리에 붙인다.
 * 이상한 값이면 가운데
 */
export function stickFromDrag(dx: number, dy: number, radius: number): Stick {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || !(radius > 0)) return NO_STICK
  const len = Math.hypot(dx, dy)
  const k = len > radius ? 1 / len : 1 / radius
  return { x: dx * k, y: -dy * k }
}

export type MoveKeys = { forward: boolean; back: boolean; left: boolean; right: boolean }

/**
 * 키보드가 먼저: 이동 키를 하나라도 누르고 있으면 키보드 방향으로 걷는다 (속도 배율 1, 달리기는 Shift 가 정한다).
 * 아니면 조이스틱: 데드존 안이면 멈추고, 밀수록 빨라져 sprintAt 에서 걷기 최고 속도, 그 너머는 달리기
 */
export function moveInput(keys: MoveKeys, stick: Stick, config: StickConfig): MoveInput {
  const kf = Number(keys.forward) - Number(keys.back)
  const kr = Number(keys.right) - Number(keys.left)
  if (kf !== 0 || kr !== 0) {
    const len = Math.hypot(kf, kr)
    return { forward: kf / len, right: kr / len, scale: 1, sprint: false }
  }
  const m = Math.min(1, Math.hypot(stick.x, stick.y))
  if (!(m > config.deadzone)) return NO_MOVE
  const t = (m - config.deadzone) / Math.max(1e-6, config.sprintAt - config.deadzone)
  return {
    forward: stick.y / Math.hypot(stick.x, stick.y),
    right: stick.x / Math.hypot(stick.x, stick.y),
    scale: Math.min(1, Math.max(config.minWalk, t)),
    sprint: m >= config.sprintAt,
  }
}
