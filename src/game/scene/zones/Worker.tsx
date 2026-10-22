import { Html, useGLTF, useTexture } from '@react-three/drei'
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef } from 'react'
import { AnimationMixer, Quaternion, SRGBColorSpace, Vector3, type AnimationAction, type Group, type Object3D, type Texture } from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { CHARACTER_FILES, OUTFIT_ALT_TEXTURES } from '../../data/characters'
import { WORKER_WALK_TIMESCALE } from '../../data/repair'
import type { CharacterLook, OutfitId } from '../../data/types'
import type { WorkerFrame, WorkerPose } from '../../logic/repairTimeline'
import { applyLook, measureLift, prepareCharacter } from '../characterAppearance'

/** 자세 → glb 안의 애니메이션 이름 (캐릭터 빌드 도구가 넣은 UAL 클립) */
const WORKER_CLIPS: Record<WorkerPose, string> = {
  walk: 'Jog_Fwd_Loop',
  fix: 'Fixing_Kneeling',
  push: 'Push_Loop',
  cheer: 'Idle_Talking_Loop',
}
const POSES = Object.keys(WORKER_CLIPS) as WorkerPose[]
const FADE_SPEED = 7

const modelUrl = (file: string) => `${import.meta.env.BASE_URL}models/${file}`
const ALT_URLS = Object.values(OUTFIT_ALT_TEXTURES).map(modelUrl)

export type WorkerHandle = {
  /** 연출 한 프레임: 위치·방향·자세·말풍선·망치 휘두르기 */
  update(frame: WorkerFrame, delta: number): void
  /** 망치 머리의 월드 위치 (먼지를 띄울 자리) */
  hammerHead(target: Vector3): void
}

const axis = new Vector3()
const rootQ = new Quaternion()
const parentQ = new Quaternion()
const turn = new Quaternion()

/** 뼈를 모델 기준 x축(오른쪽 → 왼쪽 축)으로 더 돌린다. 음수면 앞·위로 들린다 (PlayerModel 과 같은 방식) */
function bendBone(bone: Object3D, root: Object3D, angle: number) {
  root.getWorldQuaternion(rootQ)
  bone.parent!.getWorldQuaternion(parentQ)
  axis.set(1, 0, 0).applyQuaternion(rootQ).applyQuaternion(parentQ.invert())
  bone.quaternion.premultiply(turn.setFromAxisAngle(axis, angle))
}

/** 망치 휘두르기 0 → 1: 천천히 들어 올렸다가(0 ~ 0.7) 확 내리친다(0.7 ~ 1). 돌려주는 값은 아래팔을 드는 각도 */
function hammerLift(swing: number): number {
  const RAISE = 1.1
  if (swing < 0.7) {
    const k = swing / 0.7
    return RAISE * k * k * (3 - 2 * k)
  }
  return RAISE * (1 - (swing - 0.7) / 0.3)
}

/**
 * 수리기사님 (플레이어와 같은 캐릭터 glb 에 작업복을 입힌다). 노란 안전모를 쓰고 오른손에 망치를 든다.
 * 움직임은 부모(RepairCutscene)가 repairTimeline 으로 계산해서 update 로 넘겨 준다
 */
export const Worker = forwardRef<WorkerHandle, { look: CharacterLook; hammer: boolean }>(function Worker({ look, hammer }, ref) {
  const { scene, animations } = useGLTF(modelUrl(CHARACTER_FILES[look.gender]))
  const [peasantAlt, rangerAlt] = useTexture(ALT_URLS)
  const altMaps = useMemo(() => {
    for (const t of [peasantAlt, rangerAlt]) {
      t.flipY = false
      t.colorSpace = SRGBColorSpace
      t.needsUpdate = true
    }
    return { peasant: peasantAlt, ranger: rangerAlt } as Record<OutfitId, Texture>
  }, [peasantAlt, rangerAlt])
  const object = useMemo(() => cloneSkinned(scene), [scene])
  const rig = useMemo(() => prepareCharacter(object), [object])
  useLayoutEffect(() => applyLook(rig, look, altMaps), [rig, look, altMaps])
  useEffect(
    () => () => {
      for (const mat of rig.materials) mat.dispose()
    },
    [rig],
  )
  const mixer = useMemo(() => new AnimationMixer(object), [object])
  const actionsRef = useRef<Record<WorkerPose, AnimationAction> | null>(null)
  useEffect(() => {
    const map = {} as Record<WorkerPose, AnimationAction>
    for (const pose of POSES) {
      const clip = animations.find((a) => a.name === WORKER_CLIPS[pose])
      if (!clip) throw new Error(`수리기사 애니메이션이 없다: ${WORKER_CLIPS[pose]}`)
      const action = mixer.clipAction(clip)
      action.setEffectiveWeight(pose === 'walk' ? 1 : 0).play()
      map[pose] = action
    }
    map.walk.setEffectiveTimeScale(WORKER_WALK_TIMESCALE)
    actionsRef.current = map
    return () => {
      actionsRef.current = null
      mixer.stopAllAction()
      mixer.uncacheRoot(object)
    }
  }, [animations, mixer, object])

  const bones = useMemo(
    () => ({
      head: object.getObjectByName('Head'),
      hand: object.getObjectByName('hand_r'),
      lowerarm: object.getObjectByName('lowerarm_r'),
      upperarm: object.getObjectByName('upperarm_r'),
    }),
    [object],
  )

  // 안전모·망치를 뼈에 붙인다. 기본 자세에서 월드 기준으로 놓을 자리를 정해 뼈 좌표로 옮겨 두면 뼈를 따라 움직인다
  const hat = useRef<Group>(null)
  const tool = useRef<Group>(null)
  const toolHead = useRef<Object3D>(null)
  useLayoutEffect(() => {
    object.updateWorldMatrix(true, true)
    const attach = (part: Group | null, bone: Object3D | undefined, offset: Vector3) => {
      if (!part || !bone) return
      const at = bone.getWorldPosition(new Vector3()).add(offset)
      bone.add(part)
      part.position.copy(bone.worldToLocal(at))
      // 뼈가 돌아가 있어도 기본 자세에서 똑바로 서 있게
      part.quaternion.copy(bone.getWorldQuaternion(new Quaternion()).invert())
    }
    attach(hat.current, bones.head, new Vector3(0, 0.12, 0.01))
    attach(tool.current, bones.hand, new Vector3(0, 0, 0))
    object.traverse((o) => {
      o.castShadow = true
      o.frustumCulled = false
    })
  }, [object, bones])

  const root = useRef<Group>(null)
  const bubble = useRef<HTMLDivElement>(null)
  const anim = useRef({ weights: { walk: 1, fix: 0, push: 0, cheer: 0 } as Record<WorkerPose, number>, bubble: null as string | null })

  useImperativeHandle(
    ref,
    () => ({
      update(frame, delta) {
        const actions = actionsRef.current
        const g = root.current
        if (!actions || !g) return
        g.position.set(frame.x, 0, frame.z)
        g.rotation.y = frame.facing
        const a = anim.current
        const k = 1 - Math.exp(-delta * FADE_SPEED)
        for (const p of POSES) {
          a.weights[p] += ((p === frame.pose ? 1 : 0) - a.weights[p]) * k
          actions[p].setEffectiveWeight(a.weights[p])
        }
        mixer.update(delta)
        // 망치질: 클립(무릎 꿇고 고치기) 위에 오른팔을 들었다 내리치는 동작을 덧입힌다
        if (frame.swing !== null && bones.upperarm && bones.lowerarm) {
          const lift = hammerLift(frame.swing) * a.weights.fix
          bendBone(bones.upperarm, object, -lift * 0.8)
          bendBone(bones.lowerarm, object, -lift * 0.6)
        }
        object.position.y = measureLift(rig)
        if (a.bubble !== frame.bubble && bubble.current) {
          a.bubble = frame.bubble
          bubble.current.textContent = frame.bubble ?? ''
          bubble.current.style.display = frame.bubble ? 'block' : 'none'
        }
      },
      hammerHead(target) {
        toolHead.current?.getWorldPosition(target)
      },
    }),
    [bones, mixer, object, rig],
  )

  return (
    <group ref={root}>
      <primitive object={object} />
      {/* 노란 안전모 (머리뼈에 붙는다) */}
      <group ref={hat}>
        <mesh castShadow scale={[1, 0.78, 1.08]}>
          <sphereGeometry args={[0.15, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#fdd835" roughness={0.45} />
        </mesh>
        <mesh position={[0, 0.005, 0.04]} castShadow>
          <cylinderGeometry args={[0.19, 0.19, 0.018, 20]} />
          <meshStandardMaterial color="#fbc02d" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.1, 0]} scale={[0.25, 0.25, 1.1]}>
          <sphereGeometry args={[0.12, 8, 6]} />
          <meshStandardMaterial color="#f9a825" />
        </mesh>
      </group>
      {/* 망치 (오른손뼈에 붙는다). 손잡이는 앞쪽(+z)으로 */}
      <group ref={tool} visible={hammer}>
        <group rotation-x={Math.PI / 2}>
          <mesh position={[0, 0.12, 0]} castShadow>
            <cylinderGeometry args={[0.018, 0.022, 0.34, 8]} />
            <meshStandardMaterial color="#8d6e63" />
          </mesh>
          <mesh position={[0, 0.28, 0]} rotation-z={Math.PI / 2} castShadow>
            <boxGeometry args={[0.07, 0.17, 0.07]} />
            <meshStandardMaterial color="#607d8b" metalness={0.6} roughness={0.35} />
          </mesh>
          <object3D ref={toolHead} position={[0, 0.28, 0]} />
        </group>
      </group>
      <Html position={[0, 2.25, 0]} center zIndexRange={[100, 0]} style={{ pointerEvents: 'none' }}>
        <div ref={bubble} style={bubbleStyle} />
      </Html>
    </group>
  )
})

const bubbleStyle = {
  display: 'none',
  whiteSpace: 'nowrap' as const,
  background: '#fff',
  color: '#3e2723',
  padding: '4px 10px',
  borderRadius: 12,
  fontSize: 15,
  fontWeight: 800,
  boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
  border: '2px solid #ef6c00',
}
