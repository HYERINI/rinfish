import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import { Vector3 } from 'three'
import type { Mesh } from 'three'
import { restBox } from './modelBounds'

type Props = {
  url: string
  /** 이 높이에 맞춰 크기를 정한다 */
  height: number
  position?: [number, number, number]
  rotationY?: number
}

/** 움직이지 않는 장식용 glb. 바닥면이 position 의 y 에 오도록 세운다 */
export function Prop({ url, height, position = [0, 0, 0], rotationY = 0 }: Props) {
  const { scene } = useGLTF(url)
  const { object, scale, lift } = useMemo(() => {
    const object = scene.clone(true)
    object.traverse((o) => {
      const mesh = o as Mesh
      if (mesh.isMesh) {
        mesh.castShadow = true
        mesh.receiveShadow = true
      }
    })
    const box = restBox(object)
    const size = box.getSize(new Vector3())
    const scale = size.y > 0 ? height / size.y : 1
    return { object, scale, lift: -box.min.y * scale }
  }, [scene, height])

  return (
    <group position={position} rotation-y={rotationY}>
      <primitive object={object} scale={scale} position-y={lift} />
    </group>
  )
}
