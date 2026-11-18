import { useEffect, useState } from 'react'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { MEADOW_POS, MEADOW_YAW } from '../game/data/meadow'
import { boxesToCuboids, type Cuboid } from '../game/logic/meadowColliders'
import { MeadowDoors } from './MeadowDoors'
import { MeadowGround } from './MeadowGround'
import { meadowReady, meadowWorld } from './meadowSingleton'

/** 초원(은지 맵). 바닥은 바로, 은지 모델·충돌체·문은 모델이 다 들어온 뒤에 붙인다 */
export function MeadowWorld() {
  const world = meadowWorld()
  const [cuboids, setCuboids] = useState<Cuboid[] | null>(null)

  useEffect(() => {
    let alive = true
    void meadowReady().then(() => {
      // 아직 장면에 붙이기 전이라 상자가 모두 은지 좌표다. 문은 MeadowDoors 가 따로 (여닫을 때 바뀐다)
      if (alive) setCuboids(boxesToCuboids(world.colliders))
    })
    return () => {
      alive = false
    }
  }, [world])

  return (
    <>
      <MeadowGround />
      {cuboids && (
        <>
          <group position={MEADOW_POS} rotation-y={MEADOW_YAW}>
            <primitive object={world.group} />
          </group>
          <RigidBody type="fixed" colliders={false}>
            {cuboids.map((c, i) => (
              <CuboidCollider key={i} args={c.half} position={c.center} />
            ))}
          </RigidBody>
          <MeadowDoors />
        </>
      )}
    </>
  )
}
