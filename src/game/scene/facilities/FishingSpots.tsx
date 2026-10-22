import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh, MeshBasicMaterial } from 'three'
import type { FishingSpot } from '../../data/zones'
import { openFishingSpots } from '../../logic/zoneUnlock'
import { useProgressStore } from '../../stores/progressStore'

/**
 * 열린 구역의 낚시 명당 표시. 낚시는 물가 어디서나 할 수 있고(FishingEdgeWatcher) 여기는 물결 고리로 자리만 알려 준다
 */
export function FishingSpots() {
  const unlocked = useProgressStore((s) => s.unlockedZones)
  return (
    <>
      {openFishingSpots(unlocked).map((spot) => (
        <FishingSpotMarker key={spot.id} spot={spot} />
      ))}
    </>
  )
}

/** 물 위에 퍼지는 물결 고리로 낚시 포인트를 알려 준다 */
function FishingSpotMarker({ spot }: { spot: FishingSpot }) {
  const ring = useRef<Mesh>(null)
  const material = useRef<MeshBasicMaterial>(null)
  const [x, z] = spot.position
  const [fx, fz] = spot.facing

  useFrame(({ clock }) => {
    const t = (clock.elapsedTime * 0.8) % 1 // 0 → 1 반복
    const scale = 1 + t * 1.5
    ring.current?.scale.set(scale, scale, scale)
    if (material.current) material.current.opacity = 1 - t
  })

  return (
    <>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position={[x + fx * 4, spot.surfaceY + 0.02, z + fz * 4]}>
        <ringGeometry args={[0.5, 0.65, 32]} />
        <meshBasicMaterial ref={material} color="white" transparent />
      </mesh>
    </>
  )
}
