import { useAnimations, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, CanvasTexture, Vector3 } from 'three'
import type { AnimationAction, Group, Mesh, SpriteMaterial } from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { ISLAND_VISITOR } from '../../data/aquariumVisitors'
import { FACILITY } from '../../data/zones'
import { visitorPose, type VisitorAct, type VisitorPhase } from '../../logic/aquariumVisitors'
import { ASSET } from '../assets'
import { restBox } from '../modelBounds'

const VISITOR_URLS = [ASSET.visitorA, ASSET.visitorB, ASSET.visitorC]
/** 구경꾼 키(m) */
const VISITOR_HEIGHT = 1.5
/** 몸 돌리는 빠르기 (클수록 빨리 돈다) */
const TURN_RATE = 8
/** 동작 바꿀 때 섞는 시간(초) */
const FADE = 0.25
/** 걷기 동작 재생 배율 = 걷는 빠르기(m/s) × 이 값. 발이 미끄러지지 않게 맞춘 값 */
const WALK_CLIP_RATE = 1.1

/** 상태별 Kenney 미니 캐릭터 동작 이름 */
function clipFor(phase: VisitorPhase, act: VisitorAct): string {
  if (phase === 'arrive' || phase === 'leave') return 'walk'
  switch (act) {
    case 'nod':
      return 'emote-yes'
    case 'point':
      return 'interact-right'
    case 'photo':
      return 'holding-both'
    default:
      return 'idle'
  }
}

/** 사진 찍을 때 휴대폰 자리 (구경꾼 발밑 기준 m. 큰 머리 앞, 앞으로 뻗은 두 손 위) */
const PHONE_AT: [number, number, number] = [0, 0.62, 0.42]

/** 찰칵 빛 무늬 (가운데가 밝고 가장자리로 사라지는 동그라미). 처음 쓸 때 한 번 만든다 */
let flashTex: CanvasTexture | null = null
function flashTexture(): CanvasTexture {
  if (flashTex) return flashTex
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.25, 'rgba(255,255,255,0.8)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 64, 64)
  }
  flashTex = new CanvasTexture(canvas)
  return flashTex
}

/** -π~π 로 맞춘 각도 차 */
const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b))

/**
 * 섬 어항 구경꾼들. lane 6개를 늘 띄워 두고 앞의 count 명만 손님을 받는다.
 * 손님 수가 줄어도 지금 손님은 끝까지 구경하고 나가고, 늘면 새 lane 의 다음 손님부터 걸어 들어온다
 */
export function AquariumVisitors({ count, size }: { count: number; size: [number, number, number] }) {
  return (
    <>
      {Array.from({ length: ISLAND_VISITOR.max }, (_, lane) => (
        <StrollingVisitor key={lane} lane={lane} url={VISITOR_URLS[lane % VISITOR_URLS.length]} active={lane < count} size={size} />
      ))}
    </>
  )
}

function StrollingVisitor({ lane, url, active, size }: { lane: number; url: string; active: boolean; size: [number, number, number] }) {
  const { scene, animations } = useGLTF(url)
  const object = useMemo(() => cloneSkinned(scene), [scene])
  const { actions } = useAnimations(animations, object)
  const ref = useRef<Group>(null)
  const scale = useMemo(() => {
    const s = restBox(object).getSize(new Vector3())
    return s.y > 0 ? VISITOR_HEIGHT / s.y : 1
  }, [object])

  // 사진 찍을 때 두 손으로 얼굴 앞에 드는 휴대폰과 찰칵 빛
  const phone = useRef<Mesh>(null)
  const flash = useRef<SpriteMaterial>(null)

  useEffect(() => {
    object.traverse((o) => {
      o.castShadow = true
      o.frustumCulled = false
    })
  }, [object])

  /** 지금 손님을 보이는가 (손님이 바뀔 때만 active 를 다시 본다) */
  const shown = useRef<{ visit: number; on: boolean } | null>(null)
  const activeRef = useRef(active)
  useEffect(() => {
    activeRef.current = active
  }, [active])
  const current = useRef<{ name: string; action: AnimationAction } | null>(null)
  const heading = useRef<number | null>(null)

  useFrame(({ clock }, delta) => {
    const group = ref.current
    if (!group) return
    const pose = visitorPose(ISLAND_VISITOR.seed, lane, clock.elapsedTime, FACILITY.aquarium, size)
    if (!shown.current || shown.current.visit !== pose.visit) shown.current = { visit: pose.visit, on: activeRef.current }
    const visible = pose.visible && shown.current.on
    group.visible = visible
    if (!visible) {
      heading.current = null
      return
    }
    group.position.set(pose.x, pose.y, pose.z)
    // 꺾을 때 부드럽게 돈다. 처음 나타날 때는 바로 그 방향
    if (heading.current === null) heading.current = pose.heading
    else heading.current += angleDiff(pose.heading, heading.current) * Math.min(1, delta * TURN_RATE)
    group.rotation.y = heading.current

    const name = clipFor(pose.phase, pose.act)
    if (current.current?.name !== name) {
      const next = actions[name] ?? actions.idle
      if (next) {
        current.current?.action.fadeOut(FADE)
        next.reset().fadeIn(FADE).play()
        current.current = { name, action: next }
      }
    }
    const action = current.current?.action
    if (action) action.timeScale = name === 'walk' ? pose.speed * WALK_CLIP_RATE : 1

    if (phone.current) phone.current.visible = pose.phase === 'watch' && pose.act === 'photo'
    if (flash.current) flash.current.opacity = pose.flash
  })

  return (
    <group ref={ref} visible={false}>
      <group scale={scale}>
        <primitive object={object} />
      </group>
      {/* 휴대폰은 가로로 눕혀 어항 쪽(앞)을 향한다. 빛은 휴대폰 앞에서 동그랗게 번진다 */}
      <mesh ref={phone} position={PHONE_AT} visible={false}>
        <boxGeometry args={[0.2, 0.11, 0.02]} />
        <meshStandardMaterial color="#263238" roughness={0.4} />
        {/* 뒤에서 봐도 번쩍인 게 보이게 크게, 몸에 가리지 않게 맨 위에 그린다 */}
        <sprite position={[0, 0, 0.06]} scale={1.8} renderOrder={10}>
          <spriteMaterial ref={flash} map={flashTexture()} color="#ffffff" transparent opacity={0} blending={AdditiveBlending} depthWrite={false} depthTest={false} />
        </sprite>
      </mesh>
    </group>
  )
}
