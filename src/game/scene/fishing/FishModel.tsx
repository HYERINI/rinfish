import { useGLTF, useAnimations } from '@react-three/drei'
import { forwardRef, Suspense, useEffect, useLayoutEffect, useMemo } from 'react'
import type { Group } from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { fishLookFor, type FishLook } from '../../data/fishLooks'
import { disposeFishMaterials, disposeObject, dressFish } from './fishAppearance'
import { fishModelUrl } from './fishModels'

// 모델이 많아 미리 받지 않는다. 처음 나올 때 받는다 (받는 동안은 빈 group)

function Model({ look }: { look: FishLook }) {
  const { scene, animations } = useGLTF(fishModelUrl(look.model))
  // 같은 모델이 여러 마리 나올 수 있으니 인스턴스마다 복제한다 (뼈대·재질 포함). 그다음 어종 생김새(색·소품)를 입히고
  // 몸길이 1.2·가운데 원점으로 맞추는 배율·이동을 받는다
  const { object, scale, offset, accessory } = useMemo(() => {
    const object = cloneSkinned(scene)
    return { object, ...dressFish(object, look) }
  }, [scene, look])
  const { actions } = useAnimations(animations, object)

  useLayoutEffect(() => {
    object.traverse((o) => {
      o.castShadow = true
      o.frustumCulled = false // 스킨 메시는 애니메이션 중 경계가 달라져 깜빡일 수 있다
    })
  }, [object])
  useEffect(
    () => () => {
      disposeFishMaterials(object)
      if (accessory) disposeObject(accessory)
    },
    [object, accessory],
  )

  useEffect(() => {
    // 정적 모델(애니메이션 없음)도 있다
    const clip = actions['Fish_Armature|Swimming_Fast'] ?? actions['Armature|Swim'] ?? Object.values(actions)[0]
    clip?.reset().play()
    return () => {
      clip?.stop()
    }
  }, [actions])

  return (
    <group position={offset} scale={scale}>
      <primitive object={object} />
    </group>
  )
}

/**
 * 물고기 모델 (Quaternius, CC0). 머리가 +z 쪽. 생김새(모델·색·크기·소품)는 어종 id 로 정해진다.
 * 크기는 부모가 group.scale 로 정한다(어종 배율은 안쪽 group 에 따로 둔다). 모델을 받는 동안에도 group 은 항상 있어서 ref 를 바로 쓸 수 있다
 */
export const FishModel = forwardRef<Group, { speciesId: string | null; scale?: number }>(function FishModel({ speciesId, scale = 1 }, ref) {
  const look = fishLookFor(speciesId)
  return (
    <group ref={ref} scale={scale}>
      <group scale={look.size}>
        <Suspense fallback={null}>
          <Model key={speciesId ?? ''} look={look} />
        </Suspense>
      </group>
    </group>
  )
})
