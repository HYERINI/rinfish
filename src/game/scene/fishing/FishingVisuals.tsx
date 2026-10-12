import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferGeometry, Line, LineBasicMaterial, Vector3, type Mesh } from 'three'
import { FIGHT } from '../../data/balance'
import { getSpot } from '../../data/zones'
import { castDistance } from '../../logic/cast'
import { useFishingStore } from '../../stores/fishingStore'
import { playerRig } from '../Player'

export function FishingVisuals() {
  const bobber = useRef<Mesh>(null)
  // 낚싯줄: 두 점(낚싯대 끝, 찌)을 잇는 선. 매 프레임 점 위치만 바꾼다
  const line = useMemo(() => {
    const geometry = new BufferGeometry().setFromPoints([new Vector3(), new Vector3()])
    const l = new Line(geometry, new LineBasicMaterial({ color: 'white' }))
    l.frustumCulled = false
    return l
  }, [])

  useFrame(({ clock }) => {
    const { state, spotId } = useFishingStore.getState()
    if (!bobber.current) return
    // 던지기 전(aiming)·결과 카드(done)·낚시 중이 아닐 때는 찌와 줄을 숨긴다
    if (!state || !spotId || state.stage === 'aiming' || state.stage === 'done') {
      bobber.current.visible = false
      line.visible = false
      return
    }
    bobber.current.visible = true
    line.visible = true

    const spot = getSpot(spotId)
    const t = clock.elapsedTime
    let distance = castDistance(state.castPower)
    let dip = Math.sin(t * 2) * 0.03 // 둥실둥실
    let shake = 0

    if (state.stage === 'waiting') {
      if (state.bite.phase === 'nibble') dip = -0.08 // 톡톡
      if (state.bite.phase === 'bite') dip = -0.3 // 쑥!
    }
    if (state.stage === 'fighting') {
      const f = state.fight
      // 물고기가 가까워질수록 찌도 다가온다
      distance = 1 + (castDistance(state.castPower) - 1) * Math.min(1.5, f.distance / FIGHT.startDistance)
      dip = -0.25
      shake = f.pull.active ? Math.sin(t * 40) * 0.15 : 0
    }

    const [fx, fz] = spot.facing
    bobber.current.position.set(
      playerRig.position.x + fx * distance - fz * shake,
      spot.surfaceY + dip,
      playerRig.position.z + fz * distance + fx * shake,
    )

    const positions = line.geometry.attributes.position
    positions.setXYZ(0, playerRig.rodTip.x, playerRig.rodTip.y, playerRig.rodTip.z)
    positions.setXYZ(1, bobber.current.position.x, bobber.current.position.y, bobber.current.position.z)
    positions.needsUpdate = true
  })

  return (
    <>
      <mesh ref={bobber} visible={false}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color="#e63946" />
      </mesh>
      {/* primitive: 직접 만든 three.js 객체를 씬에 넣을 때 쓴다 */}
      <primitive object={line} />
    </>
  )
}
