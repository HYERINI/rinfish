import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh, MeshBasicMaterial } from 'three'
import { FISHING_SPOTS, type FishingSpot } from '../../data/zones'
import { InteractionZone } from './InteractionZone'

export function FishingSpots() {
  return (
    <>
      {FISHING_SPOTS.map((spot) => (
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
      <InteractionZone position={[x, 1, z]} halfSize={[2.5, 1.5, 2.5]} target={{ kind: 'fishingSpot', spotId: spot.id }} />
    </>
  )
}
