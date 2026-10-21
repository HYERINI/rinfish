import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Vector3 } from 'three'
import type { Group } from 'three'
import { FishModel } from '../fishing/FishModel'

/** 어항 안 물고기 크기 (FishModel 기본 몸길이 1.2 에 곱한다) */
const FISH_SCALE = 0.32
/** 먹이를 준 뒤 물고기들이 수면 가운데로 몰려드는 시간(초) */
const FEEDING_SECONDS = 5

type Props = {
  speciesId: string
  /** 어항 안쪽 절반 크기 [x, y, z] */
  half: [number, number, number]
  /** 물고기마다 다른 헤엄 경로를 만드는 값 */
  seed: number
  hungry: boolean
  /** 먹이를 준 뒤 지난 플레이 시간(초) */
  sinceFed: number
}

/** 어항 안을 8자로 헤엄친다. 배고프면 바닥에 가라앉고, 먹이를 주면 수면으로 몰려든다 */
export function AquariumFish({ speciesId, half, seed, hungry, sinceFed }: Props) {
  const ref = useRef<Group>(null)
  const target = useMemo(() => new Vector3(), [])
  useFrame(({ clock }) => {
    const fish = ref.current
    if (!fish) return
    const t = clock.elapsedTime * (hungry ? 0.15 : 0.5) + seed * 2.1
    const [hx, hy, hz] = half
    let x = Math.sin(t) * hx * 0.75
    let z = Math.sin(t * 2) * hz * 0.5
    let y = Math.sin(t * 0.7 + seed) * hy * 0.4
    if (hungry) y = -hy * 0.8
    if (sinceFed < FEEDING_SECONDS) {
      // 수면 가운데로 몰려들어 입을 대는 연출
      x *= 0.25
      z *= 0.25
      y = hy * 0.75
    }
    // 다음 위치를 바라보게 해서 머리(+z)가 헤엄치는 방향을 향하게 한다
    const dx = Math.cos(t) * hx * 0.75
    const dz = Math.cos(t * 2) * 2 * hz * 0.5
    // 목표 위치로 부드럽게 따라가서 배고픔·먹이 연출이 툭 끊기지 않게 한다
    fish.position.lerp(target.set(x, y, z), 0.08)
    fish.rotation.y = Math.atan2(dx, dz)
    fish.rotation.z = hungry ? Math.PI / 2 : 0
  })
  return <FishModel ref={ref} speciesId={speciesId} scale={FISH_SCALE} />
}
