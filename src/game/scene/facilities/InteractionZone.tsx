import { CuboidCollider, RigidBody } from '@react-three/rapier'
import type { Interactable } from '../../logic/interaction'
import { useSessionStore } from '../../stores/sessionStore'

type Props = {
  position: [number, number, number]
  /** 상자 크기의 절반 [x, y, z] */
  halfSize: [number, number, number]
  target: Interactable
}

/**
 * 눈에 보이지 않는 감지 상자(sensor). 부딪히지 않고 "들어왔다/나갔다"만 알려 준다.
 * 움직이는 물체는 플레이어뿐이라 상대가 누구인지 따로 확인하지 않는다.
 */
export function InteractionZone({ position, halfSize, target }: Props) {
  return (
    <RigidBody type="fixed" colliders={false} position={position}>
      <CuboidCollider
        sensor
        args={halfSize}
        onIntersectionEnter={() => useSessionStore.getState().setNearby(target)}
        onIntersectionExit={() => useSessionStore.getState().clearNearby(target)}
      />
    </RigidBody>
  )
}
