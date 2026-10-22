import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Vector3 } from 'three'
import type { Group } from 'three'
import { swimPose } from '../../logic/aquariumSwim'
import { FishModel } from '../fishing/FishModel'

/** 어항 안 물고기 크기 (FishModel 기본 몸길이 1.2 에 곱한다) */
const FISH_SCALE = 0.48

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
    const pose = swimPose(clock.elapsedTime, seed, half, hungry, sinceFed)
    // 목표 위치로 부드럽게 따라가서 배고픔·먹이 연출이 툭 끊기지 않게 한다
    fish.position.lerp(target.set(pose.x, pose.y, pose.z), 0.08)
    fish.rotation.y = pose.heading
    fish.rotation.z = pose.tilt
  })
  return <FishModel ref={ref} speciesId={speciesId} scale={FISH_SCALE} />
}
