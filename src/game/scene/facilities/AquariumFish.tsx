import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, type ReactNode } from 'react'
import { Vector3 } from 'three'
import type { Group } from 'three'
import { swimPose } from '../../logic/aquariumSwim'
import { fishLookFor } from '../../data/fishLooks'
import { localRestBox } from '../modelBounds'
import { FISH_LENGTH } from '../fishing/fishAppearance'
import { FishModel } from '../fishing/FishModel'

/** 어항 안 물고기 크기 (FishModel 기본 몸길이 1.2 에 곱한다) */
const FISH_SCALE = 0.48
/** 배고파 누운 물고기와 바닥 사이 여유 */
const FLOOR_MARGIN = 0.03

type Props = {
  speciesId: string
  /** 헤엄 범위의 절반 크기 [x, y, z] */
  half: [number, number, number]
  /** 물고기마다 다른 헤엄 경로를 만드는 값 (swimSeed(id)) */
  seed: number
  hungry: boolean
  /** 먹이를 준 뒤 지난 플레이 시간(초) */
  sinceFed: number
  /** 바닥 윗면 높이 (수조 가운데 기준). 배고프면 여기에 몸 두께만큼 띄워 눕는다 */
  floorY: number
  /** 몸길이 배율 (기본: 게임 속 작은 어항 크기) */
  scale?: number
  /** 몸길이 상한. 아주 큰 어종(XXL)이 수조를 뚫고 나가지 않게 이 길이로 줄인다 */
  maxLength?: number
  /** 물고기와 같이 움직이는 것 (클릭 판정용 투명 메시 등) */
  children?: ReactNode
}

/** 어항 안을 8자로 헤엄친다. 배고프면 바닥에 가라앉고, 먹이를 주면 수면으로 몰려든다. 게임 속 어항과 크게 보기가 같이 쓴다 */
export function AquariumFish({ speciesId, half, seed, hungry, sinceFed, floorY, scale: baseScale = FISH_SCALE, maxLength = Infinity, children }: Props) {
  const scale = Math.min(baseScale, maxLength / (FISH_LENGTH * fishLookFor(speciesId).size))
  const ref = useRef<Group>(null)
  const model = useRef<Group>(null)
  /** 옆으로 누웠을 때 위아래 반 두께 (모델의 좌우 반폭). 모델을 받은 뒤 한 번 잰다 */
  const lyingHalf = useRef<number | null>(null)
  const target = useMemo(() => new Vector3(), [])
  useFrame(({ clock }) => {
    const fish = ref.current
    if (!fish) return
    if (lyingHalf.current === null && model.current) {
      const box = localRestBox(model.current)
      if (!box.isEmpty()) lyingHalf.current = Math.max(-box.min.x, box.max.x) * scale
    }
    const restY = floorY + (lyingHalf.current ?? 0.15 * scale) + FLOOR_MARGIN
    const pose = swimPose(clock.elapsedTime, seed, half, hungry, sinceFed, restY)
    // 목표 위치로 부드럽게 따라가서 배고픔·먹이 연출이 툭 끊기지 않게 한다
    fish.position.lerp(target.set(pose.x, pose.y, pose.z), 0.08)
    fish.rotation.y = pose.heading
    fish.rotation.z = pose.tilt
  })
  return (
    <group ref={ref}>
      <FishModel ref={model} speciesId={speciesId} scale={scale} />
      {children}
    </group>
  )
}
