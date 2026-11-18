import { useEffect, useMemo } from 'react'
import type { Material, Mesh } from 'three'
import { buildWeaponModel } from '../../../meadow/vendor/weapons.js'
import type { GunId } from '../../data/guns'

/**
 * 손에 든 총 (은지 buildWeaponModel, 기본 도형). 은지 모델은 총열이 -Z 라서 캐릭터 앞(+Z)을 보게 돌린다.
 * 원점이 손잡이 위쪽이라 주먹 가운데에 바로 둔다. 내 캐릭터와 다른 사람이 같이 쓴다
 */
export function GunModel({ id }: { id: GunId }) {
  const model = useMemo(() => buildWeaponModel(id), [id])
  useEffect(
    () => () => {
      model.traverse((o) => {
        const m = o as Mesh
        if (!m.isMesh) return
        m.geometry.dispose()
        for (const mat of ([] as Material[]).concat(m.material)) mat.dispose()
      })
    },
    [model],
  )
  return <primitive object={model} rotation-y={Math.PI} />
}
