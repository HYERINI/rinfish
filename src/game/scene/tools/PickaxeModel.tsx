import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import type { Mesh } from 'three'
import { ASSET } from '../assets'

/** Kenney 곡괭이는 키 0.24. 이만큼 키워 0.72m */
const SCALE = 3
/** 자루 아래쪽을 쥔다 (주먹 아래로 이만큼 나온다) */
const GRIP = 0.14

/**
 * 손에 든 곡괭이 (원점이 주먹 가운데, 머리가 위로. 칼처럼 그룹을 x 축으로 기울이면 앞으로 숙여진다).
 * 모델의 머리는 x 쪽으로 뻗어 있어 90° 돌려 앞뒤(z)로 둔다. 내 캐릭터와 다른 사람이 같이 쓴다
 */
export function PickaxeModel() {
  const { scene } = useGLTF(ASSET.pickaxe)
  const object = useMemo(() => {
    const o = scene.clone(true)
    o.traverse((c) => {
      if ((c as Mesh).isMesh) c.castShadow = true
    })
    return o
  }, [scene])
  return <primitive object={object} scale={SCALE} position={[0, -GRIP, 0]} rotation-y={Math.PI / 2} />
}
