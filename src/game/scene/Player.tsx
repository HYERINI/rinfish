import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { CapsuleCollider, RigidBody, useRapier, type RapierRigidBody } from '@react-three/rapier'
import { Vector3, type Group, type Object3D } from 'three'
import { CAMERA_ZOOM, MOVE, PLAYER_BODY } from '../data/balance'
import { CHARACTER_BASE_HEIGHT } from '../data/characters'
import { COOK_SCENE } from '../data/cooking'
import { REPAIR_PLANS, type RepairPlan } from '../data/repair'
import { BENCH_SEAT, ISLAND_RADIUS } from '../data/zones'
import { shortestAngleDelta, yawForFacing } from '../logic/cameraYaw'
import { isKeyDown } from '../input/keys'
import { isSprintHeld, takeActionPresses } from '../input/usePlayerActionKeys'
import { isPointerDown } from '../input/pointer'
import { isPointerLocked } from '../input/pointerLock'
import { MOUSE_LOOK } from '../data/settings'
import { applyMouseLook, pitchedOffset } from '../logic/mouseLook'
import { useSettingsStore } from '../stores/settingsStore'
import { castPowerFromHold } from '../logic/cast'
import type { FishingState } from '../logic/fishingSession'
import { cameraRig, moveSpeed, nextAction, rodVisible, shouldFaceCamera } from '../logic/playerMotion'
import { DEFAULT_LOOK } from '../data/characterParts'
import { useFishingStore } from '../stores/fishingStore'
import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'
import { BENCH_SEAT_SHAPE } from './facilities/benchShape'
import { fishingFx } from './fishing/fishingFx'
import { ChewChatter } from './ChewChatter'
import { FoodInHand } from './FoodInHand'
import { PlayerModel, type PlayerModelHandle } from './PlayerModel'

/** 다른 컴포넌트(낚싯줄 등)가 읽는 플레이어 정보. Player가 매 프레임 갱신한다 */
export const playerRig = {
  position: new Vector3(0, 1, 15),
  rodTip: new Vector3(0, 2, 15),
}

const PLAYER_LIMIT = ISLAND_RADIUS - 1
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
const FOOT_Y = -(PLAYER_BODY.halfHeight + PLAYER_BODY.radius)
/**
 * 땅 판정: 몸 가운데에서 공(반지름 GROUND_BALL)을 아래로 밀어 발바닥 아래 GROUND_PROBE 안에 닿는 게 있고 세로 속도가 작으면 땅에 서 있다.
 * 광선 하나는 상자 모서리에 걸터앉으면 빗나가서 공중 자세에 갇힌다
 */
const GROUND_BALL = 0.35
const GROUND_PROBE = 0.15
const GROUNDED_MAX_VY = 1
/** 카메라 거리·높이·방향(플레이어 기준 오프셋)이 따라가는 빠르기. 수평 위치는 플레이어에 바로 붙는다 */
const CAMERA_SMOOTH = 5
/** 수리 연출 카메라로 넘어가고 돌아오는 빠르기 */
const CUTSCENE_CAMERA_SMOOTH = 2.5

// 매 프레임 new Vector3()를 만들지 않도록 재사용
const moveDir = new Vector3()
const cameraTarget = new Vector3()
const grip = new Vector3()
const lookTarget = new Vector3()
const cutLook = new Vector3()

export function Player() {
  const body = useRef<RapierRigidBody>(null)
  const visual = useRef<Group>(null)
  const rod = useRef<Group>(null)
  const rodTip = useRef<Object3D>(null)
  const model = useRef<PlayerModelHandle>(null)
  /** 카메라가 플레이어 주위를 도는 각도 */
  const yaw = useRef(0)
  /** 카메라 위아래 기울기 (마우스 잠금 중 위아래로 움직여서). 0 = 줌 리그 기본 높이 */
  const pitch = useRef(0)
  /** 캐릭터가 바라보는 각도 (0 = +z 방향) */
  const facing = useRef(Math.PI)
  const camera = useThree((s) => s.camera)
  const { world, rapier } = useRapier()
  /** 땅 판정용 공 모양 */
  const groundBall = useRef<InstanceType<typeof rapier.Ball> | null>(null)
  /** 마지막으로 움직인 시각 (가까이 당겼을 때 카메라 쪽으로 돌아서기용) */
  const movedAt = useRef(0)
  /**
   * 카메라: 플레이어 기준 오프셋(거리·높이·방향)과 시선 높이, 따라가는 발 높이만 부드럽게 바꾼다.
   * 위치 전체를 늦게 따라가면 가까이 당긴 채 카메라 쪽으로 걸을 때 카메라가 몸을 뚫는다
   */
  const cam = useRef({ offset: new Vector3(), lookY: 0, feetY: 0, ready: false })
  /** 수리 연출 카메라 비율(0 = 보통 카메라, 1 = 연출 자리)과 마지막 연출 카메라 (끝난 뒤 부드럽게 돌아오도록 기억한다) */
  const cut = useRef<{ blend: number; camera: RepairPlan['camera'] | null }>({ blend: 0, camera: null })
  const look = useProgressStore((s) => s.look) ?? DEFAULT_LOOK
  /** 먹고 있는 요리 (손에 든 음식과 "아구작 냠냠") */
  const eating = useSessionStore((s) => s.playerAction.eat)
  const food = useRef<Group>(null)

  // 탐험 중 카메라 회전: 마우스가 잠겨 있으면 움직이는 만큼(감도), 아니면(터치 등) 드래그로
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (useSessionStore.getState().mode !== 'explore') return
      if (isPointerLocked()) {
        const { lookSensitivity, invertY } = useSettingsStore.getState()
        const next = applyMouseLook({ yaw: yaw.current, pitch: pitch.current }, e.movementX, e.movementY, lookSensitivity, invertY)
        yaw.current = next.yaw
        pitch.current = next.pitch
      } else if (isPointerDown()) {
        // 드래그: 좌우로 돌리고 위아래로 기울인다 (감도는 드래그용, 위아래 반전 설정은 그대로 따른다)
        const next = applyMouseLook({ yaw: yaw.current, pitch: pitch.current }, e.movementX, e.movementY, MOUSE_LOOK.dragSensitivity, useSettingsStore.getState().invertY)
        yaw.current = next.yaw
        pitch.current = next.pitch
      }
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  useFrame(({ clock }, delta) => {
    // 쓰러진 뒤 진료소로 옮기기
    const teleport = useSessionStore.getState().teleport
    if (teleport && body.current) {
      body.current.setTranslation({ x: teleport[0], y: 1, z: teleport[1] }, true)
      body.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
      useSessionStore.getState().clearTeleport()
    }

    const rb = body.current
    if (!rb) return
    const mode = useSessionStore.getState().mode
    const spot = useFishingStore.getState().spot

    // 0) 낚시 중엔 카메라를 플레이어 뒤로 돌려 물 쪽(찌가 떨어지는 곳)이 보이게 한다.
    //    탐험으로 돌아오면 이 값에서 이어서 마우스로 자유롭게 돌릴 수 있다
    if (mode === 'fishing' && spot) {
      const target = yawForFacing(spot.facing)
      yaw.current += shortestAngleDelta(yaw.current, target) * (1 - Math.exp(-delta * FISHING_YAW_SPEED))
      // 기울기도 기본 높이로 되돌려 찌가 늘 같은 자리에 보이게
      pitch.current *= Math.exp(-delta * MOUSE_LOOK.pitchResetSpeed)
    }

    // 1) WASD → 카메라 기준 이동 방향
    const forward = mode === 'explore' ? Number(isKeyDown('KeyW')) - Number(isKeyDown('KeyS')) : 0
    const right = mode === 'explore' ? Number(isKeyDown('KeyD')) - Number(isKeyDown('KeyA')) : 0
    const sin = Math.sin(yaw.current)
    const cos = Math.cos(yaw.current)
    moveDir.set(-sin * forward + cos * right, 0, -cos * forward - sin * right)
    if (moveDir.lengthSq() > 0) moveDir.normalize()

    const velocity = rb.linvel()
    // 애니메이션용: 지난 스텝에 실제로 움직인 수평 속도 (벽에 막히면 0에 가깝다)
    const speed = Math.hypot(velocity.x, velocity.z)

    // 1-1) 동작 상태(감정 표현·점프) 갱신. 땅 판정: 발바닥 바로 아래에 땅이 있고 뛰어오르는 중이 아니다
    const now = clock.elapsedTime
    const sprint = isSprintHeld()
    const t = rb.translation()
    const ball = (groundBall.current ??= new rapier.Ball(GROUND_BALL))
    const hit = world.castShape(t, { x: 0, y: 0, z: 0, w: 1 }, { x: 0, y: -1, z: 0 }, ball, 0, -FOOT_Y - GROUND_BALL + GROUND_PROBE, true, rapier.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, rb)
    const grounded = hit !== null && Math.abs(velocity.y) < GROUNDED_MAX_VY
    const session = useSessionStore.getState()
    const prevAction = session.playerAction
    const action = nextAction(
      prevAction,
      { moving: moveDir.lengthSq() > 0, sprint, ...takeActionPresses(), grounded, mode, now },
      (id) => model.current?.emoteLength(id) ?? 1,
    )
    if (action !== prevAction) session.setPlayerAction(action)

    // 속도를 직접 정해 준다. y(중력에 의한 낙하)는 물리 엔진 값을 그대로 두고, 막 뛰어올랐으면 위로 찬다
    const jumped = action.airborne && action.jumpAt !== prevAction.jumpAt
    const vy = jumped ? MOVE.jumpSpeed : velocity.y
    if (action.emote === 'roll') {
      // 구르기 클립은 제자리에서 구른다. 몸을 바라보는 쪽으로 밀어서 앞으로 굴러 나가게 한다
      rb.setLinvel({ x: Math.sin(facing.current) * MOVE.rollSpeed, y: vy, z: Math.cos(facing.current) * MOVE.rollSpeed }, true)
    } else {
      const v = moveSpeed(sprint)
      rb.setLinvel({ x: moveDir.x * v, y: vy, z: moveDir.z * v }, true)
    }

    // 벤치에서 쉬는 동안엔 앉는 자리에 고정하고 바다를 본다
    if (mode === 'rest') {
      const [sx, sz] = BENCH_SEAT.position
      rb.setTranslation({ x: sx, y: rb.translation().y, z: sz }, true)
      rb.setLinvel({ x: 0, y: velocity.y, z: 0 }, true)
    }

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
    if (mode === 'fishing' && spot) {
      const [fx, fz] = spot.facing
      facing.current = Math.atan2(fx, fz)
    } else if (mode === 'rest') {
      facing.current = BENCH_SEAT.facing
    } else if (mode === 'cutscene' && session.cooking) {
      // 요리 연출 중엔 가게를 바라본다
      facing.current = Math.atan2(COOK_SCENE.site[0] - x, COOK_SCENE.site[1] - z)
    } else if (mode === 'cutscene' && session.cutscene && session.cutscene.zoneId !== 'beach') {
      // 연출 중엔 고치는 곳을 바라보며 구경한다
      const [sx, sz] = REPAIR_PLANS[session.cutscene.zoneId].site
      facing.current = Math.atan2(sx - x, sz - z)
    } else if (moveDir.lengthSq() > 0) {
      facing.current = Math.atan2(moveDir.x, moveDir.z)
    }
    // 가까이 당긴 채 멈춰 있으면 얼굴이 보이게 카메라 쪽으로 천천히 돌아선다 (카메라는 그대로)
    if (mode !== 'explore' || moveDir.lengthSq() > 0) movedAt.current = now
    if (shouldFaceCamera(mode, session.zoom, now - movedAt.current, action)) {
      facing.current += shortestAngleDelta(facing.current, yaw.current) * (1 - Math.exp(-delta * CAMERA_ZOOM.faceTurnSpeed))
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
      // 낚시 중이 아니면 서 있거나 걸을 때만 보인다 (앉기·감정 표현·점프 중엔 몸을 뚫고, 가까운 줌에선 화면을 가린다)
      rod.current.visible = rodVisible(mode, session.zoom, action)
      const m = model.current
      if (m && visual.current) {
        // 골반은 벤치 자리에 붙인다(앉기·일어나기 중엔 진행만큼). 몸이 앉는 자리에 고정되므로 모델 기준 좌표가 곧 벤치 기준 좌표다
        // 캐릭터는 동작 상태와 속도로만 그린다 (다른 사람 캐릭터도 같은 값으로 그릴 수 있게)
        m.update(delta, now, fishing, action, speed, rod.current.rotation.x, mode === 'rest', BENCH_SEAT_SHAPE)
        visual.current.updateWorldMatrix(true, false)
        m.gripPosition(grip)
        rod.current.position.copy(visual.current.worldToLocal(grip))
        // 먹는 음식도 같은 손에 든다
        if (food.current) food.current.position.copy(grip)
      }
    }
    rodTip.current?.getWorldPosition(playerRig.rodTip)

    // 6) 3인칭 카메라: 가까이 당길수록 얼굴 높이로 내려와 얼굴을 본다.
    //    수평 위치는 플레이어에 바로 붙이고, 오프셋(방향·거리·높이)·발 높이(점프)만 부드럽게 따라간다
    const distance = session.zoom
    const rig = cameraRig(distance, CHARACTER_BASE_HEIGHT * look.height)
    const orbit = pitchedOffset(distance, rig.height, rig.lookAtY, pitch.current)
    cameraTarget.set(sin * orbit.horizontal, orbit.height, cos * orbit.horizontal)
    const c = cam.current
    const k = c.ready ? 1 - Math.exp(-delta * CAMERA_SMOOTH) : 1
    c.ready = true
    c.offset.lerp(cameraTarget, k)
    c.lookY += (rig.lookAtY - c.lookY) * k
    c.feetY += (p.y + FOOT_Y - c.feetY) * k
    camera.position.set(x + c.offset.x, c.feetY + c.offset.y, z + c.offset.z)
    lookTarget.set(x, c.feetY + c.lookY, z)

    // 7) 수리 연출 중엔 연출 자리를 비추는 카메라로 옮겨 가고, 끝나면 부드럽게 돌아온다
    const cs = session.cutscene
    const cutZone = mode === 'cutscene' && cs && cs.zoneId !== 'beach' ? cs.zoneId : null
    const cooking = mode === 'cutscene' && session.cooking !== null
    if (cutZone) cut.current.camera = REPAIR_PLANS[cutZone].camera
    else if (cooking) cut.current.camera = COOK_SCENE.camera
    cut.current.blend += (Number(cutZone !== null || cooking) - cut.current.blend) * (1 - Math.exp(-delta * CUTSCENE_CAMERA_SMOOTH))
    const shot = cut.current.camera
    if (shot && cut.current.blend > 1e-3) {
      const b = cut.current.blend
      camera.position.lerp(cutLook.fromArray(shot.position), b)
      lookTarget.lerp(cutLook.fromArray(shot.lookAt), b)
    }
    camera.lookAt(lookTarget)
  })

  return (
    // dynamic 물체지만 회전은 막아서 넘어지지 않게 한다
    <RigidBody ref={body} colliders={false} position={[0, 2, 15]} enabledRotations={[false, false, false]}>
      <CapsuleCollider args={[PLAYER_BODY.halfHeight, PLAYER_BODY.radius]} />
      <group ref={visual}>
        <group position={[0, FOOT_Y, 0]}>
          <PlayerModel ref={model} look={look} />
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
        {eating && (
          <>
            <group ref={food}>
              <FoodInHand dish={eating} />
            </group>
            <ChewChatter />
          </>
        )}
      </group>
    </RigidBody>
  )
}
