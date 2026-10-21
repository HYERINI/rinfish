import { useAnimations, useGLTF } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import { Vector3 } from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { restBox } from './modelBounds'

/** 구경꾼 키 */
const VISITOR_HEIGHT = 1.5

type Props = {
  url: string
  position: [number, number, number]
  rotationY?: number
  /** Kenney 미니 캐릭터 애니메이션 이름 (idle, emote-yes, sit …) */
  clip?: string
}

/** 어항 구경꾼. 같은 모델을 여러 명 세우므로 뼈대까지 복제한다 */
export function Visitor({ url, position, rotationY = 0, clip = 'idle' }: Props) {
  const { scene, animations } = useGLTF(url)
  const object = useMemo(() => cloneSkinned(scene), [scene])
  const { actions } = useAnimations(animations, object)
  const scale = useMemo(() => {
    const size = restBox(object).getSize(new Vector3())
    return size.y > 0 ? VISITOR_HEIGHT / size.y : 1
  }, [object])

  useEffect(() => {
    object.traverse((o) => {
      o.castShadow = true
      o.frustumCulled = false
    })
    const action = actions[clip] ?? actions.idle
    action?.reset().fadeIn(0.2).play()
    return () => {
      action?.fadeOut(0.2)
    }
  }, [actions, clip, object])

  return (
    <group position={position} rotation-y={rotationY} scale={scale}>
      <primitive object={object} />
    </group>
  )
}
