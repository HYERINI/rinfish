import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Suspense, useRef } from 'react'
import { Vector3, type Group, type Mesh, type MeshStandardMaterial } from 'three'
import { CHEF_LOOK, STALL } from '../../data/cooking'
import { CHEF_IDLE, COOK_LENGTH, cookTimeline } from '../../logic/cookTimeline'
import { useSessionStore } from '../../stores/sessionStore'
import { ASSET } from '../assets'
import { Prop } from '../Prop'
import { Worker, type WorkerHandle } from '../zones/Worker'
import { cookingTime, finishCooking } from './finishCooking'

const STEAM_COUNT = 9
const hand = new Vector3()
const knife = new Vector3()

/**
 * 미스터찜 조리대 위 요리 연출 (Market 그룹 안쪽 좌표). 평소엔 사장님 배정빈이 가운데 서 있고,
 * 주문이 들어오면 cookTimeline 대로 생선을 썰고(탕탕탕) 냄비에 넣고(퐁당) 끓여서(보글보글) 내온다
 */
export function CookingStation() {
  const chef = useRef<WorkerHandle>(null)
  const fish = useRef<Group>(null)
  const plate = useRef<Group>(null)
  const steam = useRef<(Mesh | null)[]>([])
  const bang = useRef<HTMLDivElement>(null)
  const bangAt = useRef<Group>(null)
  const strikes = useRef(0)
  const self = useRef<Group>(null)

  useFrame((state, delta) => {
    const t = cookingTime()
    const frame = t === null ? null : cookTimeline(t, useSessionStore.getState().cooking?.line ?? '')
    if (t !== null && t >= COOK_LENGTH) finishCooking()
    const c = chef.current
    c?.update(frame?.chef ?? CHEF_IDLE, Math.min(delta, 0.1))

    // 생선: 도마 위 → 손에 → 냄비로 퐁당 → 사라짐 (연출이 없을 땐 도마 위에 늘 한 마리)
    const g = fish.current
    const root = self.current
    if (g && root) {
      const at = frame?.fish.at ?? 'board'
      g.visible = at !== 'gone'
      if (at === 'board') g.position.set(...STALL.boardTop)
      if (at === 'hand' && c) {
        c.handPosition(hand)
        g.position.copy(root.worldToLocal(hand))
        g.position.y -= 0.05
      }
      if (at === 'drop' && frame) {
        const k = frame.fish.drop
        const [px, py, pz] = STALL.potTop
        g.position.set(px, py + 0.5 * (1 - k * k), pz)
        g.rotation.z = k * 2
      } else g.rotation.z = 0
    }

    // 칼질한 순간 "탕!"
    if (frame && frame.phase === 'chop' && c && frame.chef.strikes > strikes.current) {
      c.hammerHead(knife)
      const el = bang.current
      if (el && bangAt.current && root) {
        bangAt.current.position.copy(root.worldToLocal(knife))
        bangAt.current.position.y += 0.35
        el.textContent = '탕!'
        el.animate(
          [
            { opacity: 0, transform: 'scale(0.6)' },
            { opacity: 1, transform: 'scale(1.2)', offset: 0.2 },
            { opacity: 0, transform: 'translateY(-18px) scale(1)' },
          ],
          { duration: 420, easing: 'ease-out' },
        )
      }
    }
    strikes.current = frame?.phase === 'chop' ? frame.chef.strikes : 0

    // 김: 냄비 위로 피어오른다
    const amount = frame?.steam ?? 0
    steam.current.forEach((m, i) => {
      if (!m) return
      const life = (state.clock.elapsedTime * 0.8 + i / STEAM_COUNT) % 1
      m.visible = amount > 0.02
      const [px, py, pz] = STALL.potTop
      m.position.set(px + Math.sin(i * 2.4) * 0.15 * (1 + life), py + 0.1 + life * 0.9, pz + Math.cos(i * 1.7) * 0.12)
      m.scale.setScalar(0.5 + life * 1.2)
      ;(m.material as MeshStandardMaterial).opacity = amount * 0.7 * (1 - life)
    })

    if (plate.current) plate.current.visible = frame?.served ?? false
  })

  return (
    <group ref={self}>
      <Suspense fallback={null}>
        <Worker ref={chef} look={CHEF_LOOK} gear="chef" />
      </Suspense>
      <group ref={fish} position={STALL.boardTop}>
        <Prop url={ASSET.fish} height={0.15} rotationY={0.4} />
      </group>
      {Array.from({ length: STEAM_COUNT }, (_, i) => (
        <mesh key={i} ref={(m) => void (steam.current[i] = m)} visible={false}>
          <sphereGeometry args={[0.09, 8, 6]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.6} depthWrite={false} />
        </mesh>
      ))}
      {/* 다 된 찜 한 접시 */}
      <group ref={plate} position={STALL.plate} visible={false}>
        <Prop url={ASSET.plate} height={0.05} />
        <mesh position={[0, 0.08, 0]} scale={[1, 0.55, 0.8]} castShadow>
          <sphereGeometry args={[0.16, 14, 10]} />
          <meshStandardMaterial color="#d84315" />
        </mesh>
        <mesh position={[0.05, 0.15, 0]} scale={[1.8, 0.6, 0.7]}>
          <sphereGeometry args={[0.05, 10, 6]} />
          <meshStandardMaterial color="#b0bec5" />
        </mesh>
      </group>
      <group ref={bangAt}>
        <Html center zIndexRange={[100, 0]} style={{ pointerEvents: 'none' }}>
          <div ref={bang} style={bangStyle} />
        </Html>
      </group>
    </group>
  )
}

const bangStyle = {
  opacity: 0,
  whiteSpace: 'nowrap' as const,
  color: '#fff59d',
  fontSize: 22,
  fontWeight: 900,
  textShadow: '0 0 3px #b71c1c, 2px 2px 0 #b71c1c',
}
