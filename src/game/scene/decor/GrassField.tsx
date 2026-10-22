import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Color, DoubleSide, MeshStandardMaterial } from 'three'
import type { InstancedMesh } from 'three'
import { GRASS } from '../../data/decor'
import { groundMix, type Placement } from '../../logic/decor'
import { groundColor } from './groundGeometry'
import { buildTuftGeometry } from './grassGeometry'
import { fillInstances } from './instancing'
import { addWind } from './wind'

type Props = {
  placements: Placement[]
  /** 다발 색: 'ground' = 그 자리 바닥 색을 따라감, 아니면 고정 색 */
  tint: 'ground' | string
  /** 바람 세기 배율 */
  wind?: number
}

/** 바람에 흔들리는 풀 다발 수천 개를 한 번에 그린다 (그림자는 받기만, 충돌 없음) */
export function GrassField({ placements, tint, wind = 1 }: Props) {
  const ref = useRef<InstancedMesh>(null)
  const geometry = useMemo(() => buildTuftGeometry(GRASS.blades), [])
  const material = useMemo(() => addWind(new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: 1 }), wind), [wind])
  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    fillInstances(mesh, placements)
    const color = new Color()
    const fixed = tint === 'ground' ? null : new Color(tint)
    placements.forEach((p, i) => {
      if (fixed) color.copy(fixed).offsetHSL(0, 0, (p.variant - 0.5) * 0.04 + (p.height % 0.05) - 0.025)
      else groundColor(p.x, p.z, groundMix(p.x, p.z), color)
      mesh.setColorAt(i, color)
    })
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [placements, tint])

  if (placements.length === 0) return null
  return <instancedMesh ref={ref} args={[geometry, material, placements.length]} receiveShadow />
}
