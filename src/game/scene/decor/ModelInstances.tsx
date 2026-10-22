import { useGLTF } from '@react-three/drei'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import type { InstancedMesh } from 'three'
import type { Placement } from '../../logic/decor'
import { bakeModel, fillInstances, type ModelPart } from './instancing'

type Props = {
  url: string
  placements: Placement[]
  /** 바람에 흔들리는 세기 (0 = 안 흔들림) */
  wind?: number
  castShadow?: boolean
  /** 바닥에서 띄울 높이 (연잎은 물 위) */
  y?: number
}

/** 같은 glb 를 여러 자리에 한 번에 그린다 (조각마다 InstancedMesh 하나). 충돌 없음 */
export function ModelInstances({ url, placements, wind = 0, castShadow = false, y = 0 }: Props) {
  const { scene } = useGLTF(url)
  const parts = useMemo(() => bakeModel(scene, wind), [scene, wind])
  useEffect(
    () => () => {
      for (const part of parts) {
        part.geometry.dispose()
        part.material.dispose()
      }
    },
    [parts],
  )
  if (placements.length === 0) return null
  return (
    <>
      {parts.map((part, i) => (
        <PartInstances key={i} part={part} placements={placements} castShadow={castShadow} y={y} />
      ))}
    </>
  )
}

function PartInstances({ part, placements, castShadow, y }: { part: ModelPart; placements: Placement[]; castShadow: boolean; y: number }) {
  const ref = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    if (ref.current) fillInstances(ref.current, placements, y)
  }, [placements, y])
  return <instancedMesh ref={ref} args={[part.geometry, part.material, placements.length]} castShadow={castShadow} receiveShadow />
}
