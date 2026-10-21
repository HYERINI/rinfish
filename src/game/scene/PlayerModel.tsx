import { useGLTF, useTexture } from '@react-three/drei'
import { forwardRef, Suspense, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef } from 'react'
import { AnimationMixer, LoopOnce, Quaternion, SRGBColorSpace, Vector3, type AnimationAction, type Object3D, type Texture } from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { CHARACTER_CLIPS, CHARACTER_FILES, OUTFIT_ALT_TEXTURES, type CharacterClip } from '../data/characters'
import type { CharacterLook, OutfitId } from '../data/types'
import { CHARACTER_POSES, characterPose, clipTimeScale, leanBack, poseClips, type CharacterPose } from '../logic/characterPose'
import type { FishingState } from '../logic/fishingSession'
import { applyLook, prepareCharacter } from './characterAppearance'

/** Player 가 매 프레임 부르는 조종 손잡이 */
export type PlayerModelHandle = {
  /** 자세 고르기 → 애니메이션 섞기 → 줄다리기 상체 젖힘 덧입히기 */
  update(delta: number, now: number, fishing: FishingState | null, speed: number, rodAngle: number, resting: boolean): void
  /** 낚싯대를 쥔 손(주먹 가운데)의 월드 위치 */
  gripPosition(target: Vector3): void
}

const modelUrl = (file: string) => `${import.meta.env.BASE_URL}models/${file}`
// 성별을 바꾸면 다른 파일이 필요하므로 둘 다 미리 받아 둔다
for (const file of Object.values(CHARACTER_FILES)) useGLTF.preload(modelUrl(file))
const ALT_URLS = Object.values(OUTFIT_ALT_TEXTURES).map(modelUrl)

/** 자세가 바뀔 때 섞이는 속도. 클수록 빨리 바뀐다 */
const FADE_SPEED = 8
/** 끌려갈 때 물 쪽으로 미끄러지는 거리 */
const DRAG_SLIDE = 0.25
/** 넘어지는 클립에서 멈출 지점(비율). 벌러덩 누워 두 다리가 하늘로 들린 순간 */
const FALL_HOLD = 0.55
/** 신나서 깡충깡충 뛰는 높이 */
const HOP_HEIGHT = 0.3
/** 넘어진 원본 클립은 등이 바닥에 조금 파묻혀서 그만큼 띄운다 */
const FALL_LIFT = 0.15

// 매 프레임 new 하지 않도록 재사용
const axis = new Vector3()
const knuckle = new Vector3()
const rootQ = new Quaternion()
const parentQ = new Quaternion()
const turn = new Quaternion()

/** 뼈를 모델 기준 x축(오른쪽 → 왼쪽 축)으로 더 돌린다. 음수면 뒤로 젖혀진다 */
function bendBone(bone: Object3D, root: Object3D, angle: number) {
  root.getWorldQuaternion(rootQ)
  bone.parent!.getWorldQuaternion(parentQ)
  // 모델의 x축을 뼈의 부모 좌표계로 옮겨서 그 축으로 돌린다
  axis.set(1, 0, 0).applyQuaternion(rootQ).applyQuaternion(parentQ.invert())
  bone.quaternion.premultiply(turn.setFromAxisAngle(axis, angle))
}

const Model = forwardRef<PlayerModelHandle, { look: CharacterLook }>(function Model({ look }, ref) {
  const { scene, animations } = useGLTF(modelUrl(CHARACTER_FILES[look.gender]))
  const [peasantAlt, rangerAlt] = useTexture(ALT_URLS)
  const altMaps = useMemo(() => {
    for (const t of [peasantAlt, rangerAlt]) {
      t.flipY = false // glTF 텍스처와 같은 방향
      t.colorSpace = SRGBColorSpace
      t.needsUpdate = true
    }
    return { peasant: peasantAlt, ranger: rangerAlt } as Record<OutfitId, Texture>
  }, [peasantAlt, rangerAlt])
  const object = useMemo(() => cloneSkinned(scene), [scene])
  // 기본 자세에서 축·길이를 재야 하므로 믹서가 돌기 전에 준비한다
  const rig = useMemo(() => prepareCharacter(object), [object])
  useLayoutEffect(() => applyLook(rig, look, altMaps), [rig, look, altMaps])
  // 인스턴스마다 복제한 재질은 내려갈 때 정리한다 (텍스처는 원본과 같이 쓰므로 그대로 둔다)
  useEffect(
    () => () => {
      for (const mat of [...rig.skin, ...rig.hair, ...rig.outfits.peasant.map((o) => o.material), ...rig.outfits.ranger.map((o) => o.material)]) mat.dispose()
    },
    [rig],
  )
  // drei useAnimations 는 자기 useFrame 에서 mixer 를 돌려서, 그 뒤에 뼈를 덧돌리는 순서를 보장할 수 없다. 직접 만든다
  const mixer = useMemo(() => new AnimationMixer(object), [object])

  /** 클립별 재생 손잡이. StrictMode 에서 정리(cleanup) 후 다시 만들어지도록 effect 안에서 만든다 */
  const actionsRef = useRef<Record<CharacterClip, AnimationAction> | null>(null)
  useEffect(() => {
    const map = {} as Record<CharacterClip, AnimationAction>
    for (const [key, name] of Object.entries(CHARACTER_CLIPS) as [CharacterClip, string][]) {
      const clip = animations.find((a) => a.name === name)
      if (!clip) throw new Error(`캐릭터 애니메이션이 없다: ${name}`)
      const action = mixer.clipAction(clip)
      if (key === 'fallBack' || key === 'sitEnter' || key === 'sitExit') {
        // 넘어지기·앉기·일어나기는 한 번만, 끝난 자세로 멈춘다
        action.setLoop(LoopOnce, 1)
        action.clampWhenFinished = true
      }
      // 모든 클립을 계속 틀어 두고 비율(weight)만 바꿔서 섞는다
      action.setEffectiveWeight(0).play()
      map[key] = action
    }
    actionsRef.current = map
    return () => {
      actionsRef.current = null
      mixer.stopAllAction()
      mixer.uncacheRoot(object)
    }
  }, [animations, mixer, object])

  const bones = useMemo(
    () => ({
      spine: object.getObjectByName('spine_01'),
      hand: object.getObjectByName('hand_r'),
      knuckle: object.getObjectByName('middle_01_r'),
    }),
    [object],
  )

  const anim = useRef({
    pose: 'idle' as CharacterPose,
    /** 자세별 현재 비율. 합은 늘 1 */
    weights: Object.fromEntries(CHARACTER_POSES.map((p) => [p, p === 'idle' ? 1 : 0])) as Record<CharacterPose, number>,
    lean: 0,
    /** 앉기 시작 / 일어나기 시작 시각 */
    sitAt: -1,
    standAt: -1,
  })

  useLayoutEffect(() => {
    object.traverse((o) => {
      o.castShadow = true
      o.frustumCulled = false // 스킨 메시는 애니메이션 중 경계가 달라져 깜빡일 수 있다
    })
  }, [object])

  useImperativeHandle(
    ref,
    () => ({
      update(delta, now, fishing, speed, rodAngle, resting) {
        const actions = actionsRef.current
        if (!actions) return
        const a = anim.current
        const standingUp = a.standAt >= 0 && now - a.standAt < actions.sitExit.getClip().duration
        const pose = characterPose(fishing, speed, resting, standingUp)
        if (pose !== a.pose) {
          // 넘어지기·앉기는 처음부터 다시
          if (pose === 'fallBack') actions.fallBack.reset().play()
          if (pose === 'sit') {
            actions.sitEnter.reset().play()
            a.sitAt = now
          }
          // 앉아 있다가 다른 자세가 되면(일어선 자세가 오기 전 idle 로 바로 바뀌는 프레임 포함) 늘 일어나기부터 시작한다
          if (a.pose === 'sit') {
            actions.sitExit.reset().play()
            a.standAt = now
          }
          a.pose = pose
        }
        const sitEntering = pose === 'sit' && now - a.sitAt < actions.sitEnter.getClip().duration

        // 1) 자세 비율을 목표(지금 자세 1, 나머지 0)로 부드럽게 옮긴다
        const k = 1 - Math.exp(-delta * FADE_SPEED)
        for (const p of CHARACTER_POSES) a.weights[p] += ((p === pose ? 1 : 0) - a.weights[p]) * k

        // 2) 자세 비율 → 클립 비율. 조준 자세는 낚싯대 각도에 따라 팔 높이 클립 셋을 섞는다
        const clipWeight = {} as Record<CharacterClip, number>
        for (const clip of Object.keys(actions) as CharacterClip[]) clipWeight[clip] = 0
        for (const p of CHARACTER_POSES) {
          if (a.weights[p] < 1e-3) continue
          for (const [clip, share] of poseClips(p, rodAngle, sitEntering)) clipWeight[clip] += a.weights[p] * share
        }
        for (const clip of Object.keys(actions) as CharacterClip[]) {
          actions[clip].setEffectiveWeight(clipWeight[clip])
          actions[clip].setEffectiveTimeScale(clipTimeScale(clip, speed))
        }
        mixer.update(delta)
        // 벌러덩: 다리가 하늘로 들린 채 그대로 굳는다
        const fall = actions.fallBack
        if (pose === 'fallBack' && fall.time >= fall.getClip().duration * FALL_HOLD) fall.paused = true

        // 3) 줄다리기: 상체를 뒤로 젖히고 "영차영차" 들썩인다
        a.lean += (leanBack(fishing) - a.lean) * k
        if (bones.spine && a.lean > 1e-3) {
          const heave = Math.sin(now * 7) * 0.08 * Math.min(1, a.lean * 4)
          bendBone(bones.spine, object, -(a.lean + heave))
        }

        // 4) 끌려갈 땐 물 쪽으로 질질 미끄러지며 덜덜 떤다
        const drag = a.weights.dragged
        object.position.z = drag * (DRAG_SLIDE + Math.sin(now * 30) * 0.03)
        // 5) 잡았을 땐 춤추면서 깡충깡충
        object.position.y = rig.lift + a.weights.celebrate * Math.abs(Math.sin(now * 7)) * HOP_HEIGHT + a.weights.fallBack * FALL_LIFT
      },
      gripPosition(target) {
        if (!bones.hand || !bones.knuckle) return
        bones.hand.getWorldPosition(target)
        bones.knuckle.getWorldPosition(knuckle)
        // 손목과 손가락 뿌리 사이 = 주먹 가운데
        target.lerp(knuckle, 0.6)
      },
    }),
    [bones, mixer, object, rig],
  )

  return <primitive object={object} />
})

/**
 * 플레이어 캐릭터 모델 (Quaternius, CC0). 발이 원점, 얼굴이 +z 쪽. look 대로 꾸민다.
 * 모델을 받는 동안엔 ref 가 비어 있다
 */
export const PlayerModel = forwardRef<PlayerModelHandle, { look: CharacterLook }>(function PlayerModel({ look }, ref) {
  return (
    <Suspense fallback={null}>
      {/* 성별이 바뀌면 다른 파일이라 새로 만든다 */}
      <Model key={look.gender} ref={ref} look={look} />
    </Suspense>
  )
})
