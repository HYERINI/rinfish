import { TOUCH } from '../data/touch'
import { moveInput, NO_STICK, type MoveInput, type Stick } from '../logic/joystick'
import { isKeyDown } from './keys'

/** 가상 조이스틱 손잡이 위치. 조이스틱이 매번 바꾸고 Player 가 매 프레임 읽는다 (리렌더 없음) */
let stick: Stick = NO_STICK

export function setStick(next: Stick) {
  stick = next
}

export function resetStick() {
  stick = NO_STICK
}

/** 지금 이동 입력: WASD 를 누르고 있으면 키보드, 아니면 조이스틱 */
export function readMoveInput(): MoveInput {
  return moveInput(
    { forward: isKeyDown('KeyW'), back: isKeyDown('KeyS'), left: isKeyDown('KeyA'), right: isKeyDown('KeyD') },
    stick,
    TOUCH.joystick,
  )
}
