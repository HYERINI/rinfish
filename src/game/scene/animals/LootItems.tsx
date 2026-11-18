import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { lootList } from '../../hunt/animalRig'
import { netNow } from '../../net/remoteRig'
import { makeLootMesh } from './lootMesh'

/** 바닥에 떨어진 전리품: 둥실거리며 돈다 (은지 그대로). 쓰러진 동물이 사라진 뒤 보이고, 주우면 빠진다 */
export function LootItems() {
  const group = useRef<Group>(null)
  const pool = useRef(new Map<number, Group>())

  useFrame(({ clock }, delta) => {
    const g = group.current
    if (!g) return
    const now = netNow()
    const t = clock.elapsedTime
    const seen = new Set<number>()
    for (const l of lootList()) {
      if (now < l.showAt) continue
      seen.add(l.key)
      let m = pool.current.get(l.key)
      if (!m) {
        m = makeLootMesh(l.item)
        m.position.set(l.x, 0.15, l.z)
        pool.current.set(l.key, m)
        g.add(m)
      }
      m.position.y = 0.15 + Math.sin(t * 3 + l.phase) * 0.04
      m.rotation.y += delta
    }
    for (const [key, m] of pool.current) {
      if (seen.has(key)) continue
      g.remove(m)
      pool.current.delete(key)
    }
  })

  return <group ref={group} />
}
