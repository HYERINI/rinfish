import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { CapsuleCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier'
import { Vector3, type Group, type Object3D } from 'three'
import { ISLAND_RADIUS, getSpot } from '../data/zones'
import { shortestAngleDelta, yawForFacing } from '../logic/cameraYaw'
import { isKeyDown } from '../input/keys'
import { isPointerDown } from '../input/pointer'
import { castPowerFromHold } from '../logic/cast'
import type { FishingState } from '../logic/fishingSession'
import { useFishingStore } from '../stores/fishingStore'
import { useSessionStore } from '../stores/sessionStore'
import { fishingFx } from './fishing/fishingFx'
import { PlayerModel, type PlayerModelHandle } from './PlayerModel'

/** 다른 컴포넌트(낚싯줄 등)가 읽는 플레이어 정보. Player가 매 프레임 갱신한다 */
export const playerRig = {
  position: new Vector3(0, 1, 15),
  rodTip: new Vector3(0, 2, 15),
}

const MOVE_SPEED = 6
const PLAYER_LIMIT = ISLAND_RADIUS - 1
const CAMERA_DISTANCE = 10
const CAMERA_HEIGHT = 7
const DRAG_SENSITIVITY = 0.005
/** 낚시 시작 시 카메라가 물 쪽으로 돌아가는 속도 */
const FISHING_YAW_SPEED = 4

/** 낚싯대 기본 각도 (앞으로 살짝 숙임). 음수면 어깨 뒤로 젖혀진다 */
const ROD_REST = 0.5
/** 끝까지 모아 던질 때 뒤로 젖히는 각도 */
const ROD_WINDUP = -1.3
/** 휘두르는 순간: 앞으로 내리치는 시간과 그 뒤 출렁이며 자리 잡는 시간 */
const ROD_WHIP_TIME = 0.14
const ROD_SETTLE_TIME = 0.6

/** 낚시 단계에 맞는 낚싯대 목표 각도 */
function rodAngle(fishing: FishingState | null, now: number): number {
  if (!fishing) return ROD_REST
  switch (fishing.stage) {
    case 'aiming':
      // 누르고 있는 동안 힘이 모일수록 뒤로 젖힌다
      return fishing.holding ? ROD_REST + (ROD_WINDUP - ROD_REST) * castPowerFromHold(fishing.holdTime) : ROD_REST
    case 'waiting': {
      const since = fishingFx.castAt < 0 ? 0 : now - fishingFx.castAt
      if (since < ROD_WHIP_TIME) {
        // 젖힌 자리에서 앞으로 확 내리친다
        return fishingFx.windup + (1.3 - fishingFx.windup) * (since / ROD_WHIP_TIME)
      }
      if (since < ROD_SETTLE_TIME) {
        // 낚싯대 끝이 출렁이다 멈춘다
        const k = (since - ROD_WHIP_TIME) / (ROD_SETTLE_TIME - ROD_WHIP_TIME)
        return 0.7 + 0.6 * (1 - k) * Math.cos(k * Math.PI * 3)
      }
      if (fishing.bite.phase === 'nibble') return 0.78 // 톡톡
      if (fishing.bite.phase === 'bite') return 0.95 // 쑥!
      return 0.7
    }
    case 'fighting': {
      // 텐션이 높을수록 물 쪽으로 휜다. 물고기가 당길 땐 부르르 떤다
      const f = fishing.fight
      const bend = Math.min(f.tension / f.gear.maxTension, 1)
      return ROD_REST + bend * 0.7 + (f.pull.active ? Math.sin(now * 35) * 0.06 : 0)
    }
    case 'done':
      // 낚아 올리면 번쩍 들어 올린다. 줄이 끊기면 사람과 함께 뒤로 벌러덩, 놓치면 축 늘어진다
      if (fishing.result === 'caught') return 0.3
      return fishing.result === 'snapped' ? -1.45 : 1.1
  }
}

/** 캡슐 콜라이더 바닥(발바닥) 높이. 모델은 발이 원점이라 이만큼 내린다 */
const FOOT_Y = -0.9

// 매 프레임 new Vector3()를 만들지 않도록 재사용
const moveDir = new Vector3()
const cameraTarget = new Vector3()
const grip = new Vector3()

export function Player() {
  const body = useRef<RapierRigidBody>(null)
  const visual = useRef<Group>(null)
  const rod = useRef<Group>(null)
  const rodTip = useRef<Object3D>(null)
  const model = useRef<PlayerModelHandle>(null)
  /** 카메라가 플레이어 주위를 도는 각도 */
  const yaw = useRef(0)
  /** 캐릭터가 바라보는 각도 (0 = +z 방향) */
  const facing = useRef(Math.PI)
  const camera = useThree((s) => s.camera)

  // 탐험 중 마우스 드래그로 카메라 회전
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (isPointerDown() && useSessionStore.getState().mode === 'explore') {
        yaw.current -= e.movementX * DRAG_SENSITIVITY
      }
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  useFrame(({ clock }, delta) => {
    const rb = body.current
    if (!rb) return
    const mode = useSessionStore.getState().mode
    const spotId = useFishingStore.getState().spotId

    // 0) 낚시 중엔 카메라를 플레이어 뒤로 돌려 물 쪽(찌가 떨어지는 곳)이 보이게 한다.
    //    탐험으로 돌아오면 이 값에서 이어서 드래그로 자유롭게 돌릴 수 있다
    if (mode === 'fishing' && spotId) {
      const target = yawForFacing(getSpot(spotId).facing)
      yaw.current += shortestAngleDelta(yaw.current, target) * (1 - Math.exp(-delta * FISHING_YAW_SPEED))
    }

    // 1) WASD → 카메라 기준 이동 방향
    const forward = mode === 'explore' ? Number(isKeyDown('KeyW')) - Number(isKeyDown('KeyS')) : 0
    const right = mode === 'explore' ? Number(isKeyDown('KeyD')) - Number(isKeyDown('KeyA')) : 0
    const sin = Math.sin(yaw.current)
    const cos = Math.cos(yaw.current)
    moveDir.set(-sin * forward + cos * right, 0, -cos * forward - sin * right)
    if (moveDir.lengthSq() > 0) moveDir.normalize()

    // 속도를 직접 정해 준다. y(중력에 의한 낙하)는 물리 엔진 값을 그대로 둔다
    const velocity = rb.linvel()
    // 애니메이션용: 지난 스텝에 실제로 움직인 수평 속도 (벽에 막히면 0에 가깝다)
    const speed = Math.hypot(velocity.x, velocity.z)
    rb.setLinvel({ x: moveDir.x * MOVE_SPEED, y: velocity.y, z: moveDir.z * MOVE_SPEED }, true)

    // 2) 섬 밖으로 못 나가게 가장자리에서 붙잡는다
    const p = rb.translation()
    const dist = Math.hypot(p.x, p.z)
    let x = p.x
    let z = p.z
    if (dist > PLAYER_LIMIT) {
      x = (p.x * PLAYER_LIMIT) / dist
      z = (p.z * PLAYER_LIMIT) / dist
      rb.setTranslation({ x, y: p.y, z }, true)
    }
    playerRig.position.set(x, p.y, z)

    // 3) 바라보는 방향: 낚시 중엔 물 쪽, 아니면 이동 방향
    if (mode === 'fishing' && spotId) {
      const [fx, fz] = getSpot(spotId).facing
      facing.current = Math.atan2(fx, fz)
    } else if (moveDir.lengthSq() > 0) {
      facing.current = Math.atan2(moveDir.x, moveDir.z)
    }
    if (visual.current) visual.current.rotation.y = facing.current

    // 4) 낚싯대 각도: 젖혔다가 휘두르고, 줄다리기 땐 텐션만큼 휜다
    const fishing = useFishingStore.getState().state
    if (rod.current) {
      const target = rodAngle(fishing, clock.elapsedTime)
      // 휘두르는 순간은 빠르게, 그 밖에는 부드럽게 따라간다
      const swinging = fishing?.stage === 'waiting' && clock.elapsedTime - fishingFx.castAt < ROD_WHIP_TIME
      rod.current.rotation.x = swinging ? target : rod.current.rotation.x + (target - rod.current.rotation.x) * (1 - Math.exp(-delta * 12))
      if (fishing?.stage === 'aiming') fishingFx.windup = rod.current.rotation.x

      // 5) 캐릭터 애니메이션: 팔 높이는 낚싯대 각도를 따라가고, 낚싯대는 손에 붙인다
      const m = model.current
      if (m && visual.current) {
        m.update(delta, clock.elapsedTime, fishing, speed, rod.current.rotation.x)
        visual.current.updateWorldMatrix(true, false)
        m.gripPosition(grip)
        rod.current.position.copy(visual.current.worldToLocal(grip))
      }
    }
    rodTip.current?.getWorldPosition(playerRig.rodTip)

    // 6) 3인칭 카메라: 목표 위치로 부드럽게 따라간다
    cameraTarget.set(x + sin * CAMERA_DISTANCE, p.y + CAMERA_HEIGHT, z + cos * CAMERA_DISTANCE)
    camera.position.lerp(cameraTarget, 1 - Math.exp(-delta * 5))
    camera.lookAt(x, p.y + 1, z)
  })

  return (
    // dynamic 물체지만 회전은 막아서 넘어지지 않게 한다
    <RigidBody ref={body} colliders={false} position={[0, 2, 15]} enabledRotations={[false, false, false]}>
      <CapsuleCollider args={[0.5, 0.4]} />
      <group ref={visual}>
        <group position={[0, FOOT_Y, 0]}>
          <PlayerModel ref={model} />
        </group>
        {/* 낚싯대: 그룹을 x축으로 기울이면 앞(+z)으로 숙여진다. 위치는 매 프레임 손으로 옮긴다 (모델을 받기 전엔 이 자리) */}
        <group ref={rod} position={[-0.35, 0.1, 0.2]}>
          {/* 손잡이가 주먹 아래로 조금 나오게 */}
          <mesh position={[0, 0.85, 0]} castShadow>
            <cylinderGeometry args={[0.015, 0.035, 2.3]} />
            <meshStandardMaterial color="#6d4c41" />
          </mesh>
          <object3D ref={rodTip} position={[0, 2, 0]} />
        </group>
      </group>
    </RigidBody>
  )
}
