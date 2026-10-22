import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferGeometry, Line, LineBasicMaterial, Vector3, type Group, type Mesh, type MeshBasicMaterial } from 'three'
import { FIGHT } from '../../data/balance'
import { getSpecies } from '../../data/fish'
import { fishLookFor } from '../../data/fishLooks'
import type { Rarity } from '../../data/types'
import { WATER_Y, getSpot } from '../../data/zones'
import { arcPoint, castArcHeight, castFlightTime, saggingLinePoint } from '../../logic/castArc'
import { castDistance } from '../../logic/cast'
import type { FishingState } from '../../logic/fishingSession'
import { waveHeight } from '../../logic/waves'
import { useFishingStore } from '../../stores/fishingStore'
import { playerRig } from '../Player'
import { FishModel } from './FishModel'
import { fishingFx } from './fishingFx'
import { Splashes, spawnSplash } from './Splash'

const LINE_POINTS = 24
/** 잡은 물고기가 물에서 튀어나와 손까지 날아오는 시간 */
const JUMP_TIME = 0.8
/** 놓쳤을 때 찌를 감아 들이는 시간 */
const REEL_BACK_TIME = 0.6
/** 물고기 그림자가 찌 아래 얼마나 깊이 있는지 */
const SHADOW_DEPTH = 0.35

const RARITY_SIZE: Record<Rarity, number> = { junk: 0.45, common: 0.7, rare: 0.95, epic: 1.3, legendary: 1.9 }
/** 낚싯대에 매달린 물고기에 반영하는 어종 몸길이 배율(look.size) 상한. XXL 처럼 아주 큰 어종이 발판까지 늘어지지 않게 */
const MAX_HOOKED_LOOK_SIZE = 1.6

/** 물고기 크기: 등급 기본 크기에 무게(어종 범위 안에서의 위치)를 조금 더한다 */
function fishSize(speciesId: string, weight?: number): number {
  const s = getSpecies(speciesId)
  const [lo, hi] = s.weightRange
  const k = weight === undefined || hi === lo ? 0.5 : (weight - lo) / (hi - lo)
  return RARITY_SIZE[s.rarity] * (0.85 + 0.3 * k)
}

function speciesOf(state: FishingState | null): string | null {
  return state && 'speciesId' in state ? state.speciesId : null
}

// 매 프레임 new 하지 않도록 재사용하는 벡터들
const tmp = new Vector3()
const linePoint = new Vector3()

export function FishingVisuals() {
  const bobber = useRef<Mesh>(null)
  const shadow = useRef<Mesh>(null)
  const fish = useRef<Group>(null)
  const speciesId = useFishingStore((s) => speciesOf(s.state))

  // 단계가 바뀐 순간의 위치들을 기억해 둔다
  const memo = useRef({
    prev: null as FishingState | null,
    castFrom: new Vector3(),
    landing: new Vector3(),
    landed: false,
    endFrom: new Vector3(),
    shadowAngle: 0,
    lastPullSplash: 0,
  })

  // 낚싯줄: 여러 점을 이어 휘어진 줄을 그린다. 매 프레임 점 위치만 바꾼다
  const line = useMemo(() => {
    const geometry = new BufferGeometry().setFromPoints(Array.from({ length: LINE_POINTS }, () => new Vector3()))
    const l = new Line(geometry, new LineBasicMaterial({ color: 'white' }))
    l.frustumCulled = false
    return l
  }, [])

  useFrame(({ clock }, delta) => {
    const { state, spotId } = useFishingStore.getState()
    const m = memo.current
    const t = clock.elapsedTime
    if (!bobber.current || !shadow.current || !fish.current) return
    const shadowMat = shadow.current.material as MeshBasicMaterial

    bobber.current.visible = false
    shadow.current.visible = false
    fish.current.visible = false
    line.visible = false

    if (!state || !spotId) {
      m.prev = null
      fishingFx.castAt = -1
      fishingFx.doneAt = -1
      return
    }
    const spot = getSpot(spotId)
    const isSea = spot.surfaceY === WATER_Y
    const surface = (x: number, z: number) => spot.surfaceY + (isSea ? waveHeight(x, z, t) : 0)
    const [fx, fz] = spot.facing
    const prev = m.prev
    m.prev = state

    // --- 단계가 바뀌는 순간 ---
    if (state.stage === 'aiming') {
      fishingFx.castAt = -1
      fishingFx.doneAt = -1
      return // 던지기 전엔 찌·줄을 숨긴다
    }
    if (state.stage === 'waiting' && prev?.stage !== 'waiting') {
      fishingFx.castAt = t
      m.castFrom.copy(playerRig.rodTip)
      const d = castDistance(state.castPower)
      m.landing.set(playerRig.position.x + fx * d, 0, playerRig.position.z + fz * d)
      m.landed = false
      m.shadowAngle = Math.random() * Math.PI * 2
    }
    if (state.stage === 'done' && prev && prev.stage !== 'done') {
      fishingFx.doneAt = t
      m.endFrom.copy(bobber.current.position)
      if (state.result !== 'missed') spawnSplash(m.endFrom.x, surface(m.endFrom.x, m.endFrom.z), m.endFrom.z, state.result === 'caught' ? 2.2 : 1.4)
    }

    const tip = playerRig.rodTip
    let sag = 0.35

    // --- 찌 위치 ---
    if (state.stage === 'waiting') {
      const flight = castFlightTime(castDistance(state.castPower))
      const k = (t - fishingFx.castAt) / flight
      tmp.set(m.landing.x, surface(m.landing.x, m.landing.z), m.landing.z)
      if (k < 1) {
        // 포물선을 그리며 날아가는 중
        arcPoint(m.castFrom, tmp, k, castArcHeight(castDistance(state.castPower)), bobber.current.position)
        sag = 0.1 * k
      } else {
        if (!m.landed) {
          m.landed = true
          spawnSplash(tmp.x, tmp.y, tmp.z, 1)
        }
        let dip = 0
        if (state.bite.phase === 'nibble') dip = -0.08 // 톡톡
        if (state.bite.phase === 'bite') dip = -0.3 // 쑥!
        bobber.current.position.set(tmp.x, tmp.y + dip, tmp.z)
        updateWaitingShadow(state, t)
      }
      bobber.current.visible = true
    } else if (state.stage === 'fighting') {
      const f = state.fight
      // 물고기가 가까워질수록 찌도 다가온다
      const distance = 1 + (castDistance(state.castPower) - 1) * Math.min(1.5, f.distance / FIGHT.startDistance)
      const shake = f.pull.active ? Math.sin(t * 40) * 0.15 : 0
      const x = playerRig.position.x + fx * distance - fz * shake
      const z = playerRig.position.z + fz * distance + fx * shake
      bobber.current.position.set(x, surface(x, z) - 0.25, z)
      bobber.current.visible = true
      sag = 0.3 * (1 - Math.min(1, f.tension / f.gear.maxTension))

      // 물고기 그림자가 찌 아래에서 좌우로 몸부림친다. 당길 때는 더 세게
      const wiggle = Math.sin(t * (f.pull.active ? 14 : 5)) * (f.pull.active ? 0.5 : 0.25)
      placeShadow(x + fx * 0.6 - fz * wiggle, z + fz * 0.6 + fx * wiggle, Math.atan2(fx, fz) + wiggle * 0.8, 0.75)
      if (f.pull.active && t - m.lastPullSplash > 0.35) {
        m.lastPullSplash = t
        spawnSplash(x + fx * 0.4, surface(x, z), z + fz * 0.4, 0.8 + 0.6 * f.pull.intensity)
      }
    } else if (state.stage === 'done') {
      const since = t - fishingFx.doneAt
      if (state.result === 'caught') {
        // 물 밖으로 튀어나와 낚싯대 끝 아래로 포물선을 그리며 날아온다
        tmp.set(tip.x, tip.y - 0.9, tip.z)
        const k = since / JUMP_TIME
        arcPoint(m.endFrom, tmp, k, 2.2, fish.current.position)
        if (k >= 1) fish.current.position.x += Math.sin(t * 2.5) * 0.08 // 매달려 대롱대롱
        const lookSize = fishLookFor(state.speciesId).size
        const size = fishSize(state.speciesId, state.weight) * Math.min(1, MAX_HOOKED_LOOK_SIZE / lookSize)
        fish.current.scale.setScalar(size)
        fish.current.rotation.order = 'YXZ' // 몸을 먼저 세우고(x) 그다음 바다 쪽으로 돌린다(y)
        // 날아오는 동안은 공중제비, 매달린 뒤엔 옆모습이 카메라를 향하게 돌려 둔다
        const heading = Math.atan2(fx, fz) + (k < 1 ? 0 : Math.PI / 2)
        fish.current.rotation.set(k < 1 ? -k * Math.PI * 2 : -Math.PI / 2 + Math.sin(t * 6) * 0.25, heading, 0)
        fish.current.visible = true
        // 줄은 물고기 입(머리 끝)까지
        bobber.current.position.copy(fish.current.position)
        bobber.current.position.y += k < 1 ? 0 : size * 0.5
        sag = 0
      } else if (state.result === 'snapped') {
        // 줄이 끊어지면 찌만 둥둥 떠서 멀어진다
        const x = m.endFrom.x + fx * since * 0.4
        const z = m.endFrom.z + fz * since * 0.4
        bobber.current.position.set(x, surface(x, z), z)
        bobber.current.visible = true
        fleeShadow(since)
        return // 줄은 그리지 않는다
      } else {
        // 놓침·도망: 찌를 낮은 포물선으로 감아 들인다
        arcPoint(m.endFrom, tip, since / REEL_BACK_TIME, 0.8, bobber.current.position)
        bobber.current.visible = since < REEL_BACK_TIME
        sag = 0.05
        if (state.result === 'escaped') fleeShadow(since)
        if (since >= REEL_BACK_TIME) return
      }
    }

    // --- 낚싯줄: 낚싯대 끝 → 찌 ---
    line.visible = true
    const positions = line.geometry.attributes.position
    for (let i = 0; i < LINE_POINTS; i++) {
      saggingLinePoint(tip, bobber.current.position, i / (LINE_POINTS - 1), sag, linePoint)
      positions.setXYZ(i, linePoint.x, linePoint.y, linePoint.z)
    }
    positions.needsUpdate = true

    function placeShadow(x: number, z: number, heading: number, opacity: number) {
      const s = shadow.current!
      const id = speciesOf(state)
      // 잡혔을 때 모델처럼 어종 몸길이 배율(look.size)도 곱한다
      const size = id ? fishSize(id) * fishLookFor(id).size : 0.7
      s.position.set(x, surface(x, z) - SHADOW_DEPTH, z)
      s.rotation.set(-Math.PI / 2, 0, heading)
      s.scale.set(size * 0.9, size * 2, 1) // 물속에서 퍼져 보이도록 실제 몸보다 크게
      shadowMat.opacity = opacity
      s.visible = true
    }

    /** 입질 기다리는 중: 찌 주위를 맴돌다 점점 다가오고, 톡톡/쑥 때는 찌로 달려든다 */
    function updateWaitingShadow(s: Extract<FishingState, { stage: 'waiting' }>, now: number) {
      const b = s.bite
      let radius = 1.2 + Math.min(2.2, b.timer * 0.6)
      if (b.phase === 'nibble') radius = 0.35
      if (b.phase === 'bite') radius = 0.15
      m.shadowAngle += (b.phase === 'waiting' ? 0.7 : 3) * Math.min(delta, 0.1)
      const a = m.shadowAngle
      const x = m.landing.x + Math.cos(a) * radius
      const z = m.landing.z + Math.sin(a) * radius
      // 원을 따라 도는 방향(접선)을 바라본다
      placeShadow(x, z, -a, b.phase === 'waiting' ? 0.55 + 0.1 * Math.sin(now * 2) : 0.75)
    }

    /** 놓친 물고기 그림자가 먼 바다로 사라진다 */
    function fleeShadow(since: number) {
      if (since > 1.5) return
      const d = 0.6 + since * 5
      placeShadow(m.endFrom.x + fx * d, m.endFrom.z + fz * d, Math.atan2(fx, fz) + Math.sin(t * 16) * 0.3, 0.55 * (1 - since / 1.5))
    }
  })

  return (
    <>
      <mesh ref={bobber} visible={false}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color="#e63946" />
      </mesh>
      {/* 물속 물고기 그림자: 물(renderOrder 1)보다 먼저 그려서 물 아래에 있는 것처럼 보인다 */}
      <mesh ref={shadow} visible={false} renderOrder={0}>
        <circleGeometry args={[0.5, 24]} />
        <meshBasicMaterial color="#041a2c" transparent opacity={0.5} depthWrite={false} />
      </mesh>
      <FishModel ref={fish} speciesId={speciesId} />
      {/* primitive: 직접 만든 three.js 객체를 씬에 넣을 때 쓴다 */}
      <primitive object={line} />
      <Splashes />
    </>
  )
}
