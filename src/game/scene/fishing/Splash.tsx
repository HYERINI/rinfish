import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MeshBasicMaterial, Object3D, type InstancedMesh, type Mesh } from 'three'

const SLOTS = 4
const DROPS = 12
const LIFE = 0.9
const GRAVITY = 9

type Slot = { start: number; x: number; y: number; z: number; strength: number; seeds: number[] }

const slots: Slot[] = Array.from({ length: SLOTS }, () => ({ start: -10, x: 0, y: 0, z: 0, strength: 1, seeds: [] }))
let nextSlot = 0
let pending: Omit<Slot, 'start' | 'seeds'>[] = []

/** 물보라를 하나 띄운다. strength 1 = 찌가 떨어지는 정도, 2 이상 = 물고기가 튀는 정도 */
export function spawnSplash(x: number, y: number, z: number, strength = 1) {
  pending.push({ x, y, z, strength })
}

const dummy = new Object3D()

/** 물보라 묶음: 퍼지는 물결 고리 + 튀어 오르는 물방울 */
export function Splashes() {
  const drops = useRef<InstancedMesh>(null)
  const rings = useRef<(Mesh | null)[]>([])
  const ringMaterials = useMemo(
    () => Array.from({ length: SLOTS }, () => new MeshBasicMaterial({ color: 'white', transparent: true, depthWrite: false })),
    [],
  )

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    for (const p of pending) {
      const slot = slots[nextSlot]
      nextSlot = (nextSlot + 1) % SLOTS
      Object.assign(slot, p, { start: t, seeds: Array.from({ length: DROPS * 3 }, Math.random) })
    }
    pending = []

    slots.forEach((slot, i) => {
      const age = t - slot.start
      const alive = age >= 0 && age < LIFE
      const ring = rings.current[i]
      if (ring) {
        ring.visible = alive
        const r = 0.3 + age * 2.2 * slot.strength
        ring.position.set(slot.x, slot.y + 0.03, slot.z)
        ring.scale.set(r, r, r)
        ringMaterials[i].opacity = alive ? 0.7 * (1 - age / LIFE) : 0
      }
      for (let d = 0; d < DROPS; d++) {
        const k = i * DROPS + d
        const angle = slot.seeds[d * 3] * Math.PI * 2
        const out = (0.8 + slot.seeds[d * 3 + 1] * 1.4) * slot.strength
        const up = (2.5 + slot.seeds[d * 3 + 2] * 2.5) * Math.sqrt(slot.strength)
        const y = slot.y + up * age - 0.5 * GRAVITY * age * age
        if (!alive || y < slot.y - 0.1) {
          dummy.scale.setScalar(0)
        } else {
          dummy.position.set(slot.x + Math.cos(angle) * out * age, y, slot.z + Math.sin(angle) * out * age)
          dummy.scale.setScalar(0.06 + 0.04 * slot.strength)
        }
        dummy.updateMatrix()
        drops.current?.setMatrixAt(k, dummy.matrix)
      }
    })
    if (drops.current) drops.current.instanceMatrix.needsUpdate = true
  })

  return (
    <>
      <instancedMesh ref={drops} args={[undefined, undefined, SLOTS * DROPS]} frustumCulled={false} renderOrder={2}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshBasicMaterial color="#e8f7ff" />
      </instancedMesh>
      {ringMaterials.map((m, i) => (
        <mesh
          key={i}
          ref={(el) => {
            rings.current[i] = el
          }}
          material={m}
          rotation-x={-Math.PI / 2}
          visible={false}
          renderOrder={2}
        >
          <ringGeometry args={[0.85, 1, 32]} />
        </mesh>
      ))}
    </>
  )
}
