import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Suspense, useRef } from 'react'
import { Vector3, type Group, type Mesh, type MeshStandardMaterial } from 'three'
import { REPAIR_PLANS, WORKER_LOOKS } from '../../data/repair'
import type { ZoneId } from '../../data/types'
import { repairDuration, repairTimeline } from '../../logic/repairTimeline'
import { useSessionStore } from '../../stores/sessionStore'
import { cutsceneTime } from './cutsceneClock'
import { Worker, type WorkerHandle } from './Worker'

/** 먼지 알갱이 수 (돌려 쓴다) */
const DUST_COUNT = 18
const DUST_LIFE = 0.7
const hit = new Vector3()

/**
 * 수리기사님 두 분 + 망치질 먼지·"쾅!". 진행은 repairTimeline(지난 시간)으로만 정하고,
 * 끝나면 연출을 닫는다 (구역은 이미 열려 있다)
 */
export function RepairCutscene() {
  const cutscene = useSessionStore((s) => s.cutscene)
  if (!cutscene || cutscene.zoneId === 'beach') return null
  return <Crew key={`${cutscene.zoneId}-${cutscene.startedAt}`} zoneId={cutscene.zoneId} />
}

function Crew({ zoneId }: { zoneId: Exclude<ZoneId, 'beach'> }) {
  const plan = REPAIR_PLANS[zoneId]
  const workers = useRef<(WorkerHandle | null)[]>([])
  const strikes = useRef<number[]>([])
  const dust = useRef<(Mesh | null)[]>([])
  const dustState = useRef(Array.from({ length: DUST_COUNT }, () => ({ born: -1, vx: 0, vy: 0, vz: 0, x: 0, y: 0, z: 0 })))
  const nextDust = useRef(0)
  const bangs = useRef<(HTMLDivElement | null)[]>([])
  const bangGroups = useRef<(Group | null)[]>([])

  useFrame((_, delta) => {
    const t = cutsceneTime(zoneId)
    if (t === null) return
    if (t >= repairDuration(plan.kind)) {
      useSessionStore.getState().endCutscene()
      return
    }
    const frame = repairTimeline(plan, t)
    frame.workers.forEach((w, i) => {
      const handle = workers.current[i]
      if (!handle) return
      handle.update(w, Math.min(delta, 0.1))
      // 내리친 순간: 먼지 몇 알 + "쾅!"
      const prev = strikes.current[i] ?? w.strikes
      strikes.current[i] = w.strikes
      if (w.swing !== null && w.strikes > prev) {
        handle.hammerHead(hit)
        for (let n = 0; n < 4; n++) {
          const d = dustState.current[nextDust.current]
          nextDust.current = (nextDust.current + 1) % DUST_COUNT
          const a = Math.random() * Math.PI * 2
          Object.assign(d, { born: t, x: hit.x, y: Math.max(0.1, hit.y), z: hit.z, vx: Math.cos(a) * 0.9, vy: 0.8 + Math.random() * 0.8, vz: Math.sin(a) * 0.9 })
        }
        const el = bangs.current[i]
        const g = bangGroups.current[i]
        if (el && g) {
          g.position.set(hit.x, hit.y + 0.5, hit.z)
          el.textContent = w.strikes % 3 === 0 ? '뚝딱!' : '쾅!'
          el.animate(
            [
              { opacity: 0, transform: 'translateY(6px) scale(0.6)' },
              { opacity: 1, transform: 'translateY(-6px) scale(1.15)', offset: 0.25 },
              { opacity: 0, transform: 'translateY(-26px) scale(1)' },
            ],
            { duration: 650, easing: 'ease-out' },
          )
        }
      }
    })
    // 먼지: 위로 튀었다가 떨어지며 옅어진다
    dustState.current.forEach((d, n) => {
      const mesh = dust.current[n]
      if (!mesh) return
      const age = t - d.born
      if (d.born < 0 || age > DUST_LIFE) {
        mesh.visible = false
        return
      }
      mesh.visible = true
      mesh.position.set(d.x + d.vx * age, d.y + d.vy * age - 2.5 * age * age, d.z + d.vz * age)
      mesh.scale.setScalar(0.6 + age * 1.6)
      ;(mesh.material as MeshStandardMaterial).opacity = 0.85 * (1 - age / DUST_LIFE)
    })
  })

  return (
    <>
      {plan.workers.map((_, i) => (
        <Suspense key={i} fallback={null}>
          <Worker ref={(h) => void (workers.current[i] = h)} look={WORKER_LOOKS[i % WORKER_LOOKS.length]} hammer={plan.kind === 'hammer'} />
        </Suspense>
      ))}
      {Array.from({ length: DUST_COUNT }, (_, n) => (
        <mesh key={n} ref={(m) => void (dust.current[n] = m)} visible={false}>
          <sphereGeometry args={[0.07, 6, 4]} />
          <meshStandardMaterial color="#d7ccc8" transparent opacity={0.8} depthWrite={false} />
        </mesh>
      ))}
      {plan.workers.map((_, i) => (
        <group key={`bang${i}`} ref={(g) => void (bangGroups.current[i] = g)}>
          <Html center zIndexRange={[100, 0]} style={{ pointerEvents: 'none' }}>
            <div ref={(el) => void (bangs.current[i] = el)} style={bangStyle} />
          </Html>
        </group>
      ))}
    </>
  )
}

const bangStyle = {
  opacity: 0,
  whiteSpace: 'nowrap' as const,
  color: '#ffeb3b',
  fontSize: 22,
  fontWeight: 900,
  textShadow: '0 0 3px #bf360c, 2px 2px 0 #bf360c',
}
