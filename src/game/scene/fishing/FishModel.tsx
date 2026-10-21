import { useGLTF, useAnimations } from '@react-three/drei'
import { forwardRef, Suspense, useEffect, useLayoutEffect, useMemo } from 'react'
import { Vector3 } from 'three'
import type { Group } from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { restBox } from '../modelBounds'

type ModelId = 'clownfish' | 'blue-tang' | 'puffer' | 'tuna' | 'shark' | 'swordfish' | 'dolphin'

const MODEL_IDS: ModelId[] = ['clownfish', 'blue-tang', 'puffer', 'tuna', 'shark', 'swordfish', 'dolphin']

const DEFAULT_MODEL: ModelId = 'blue-tang'

/** 어종 → 모델. 목록에 없는 어종은 기본 모델을 쓴다 */
const SPECIES_MODEL: Record<string, ModelId> = {
  'sleepy-sardine': 'blue-tang',
  'chatty-mackerel': 'tuna',
  'bubble-puffer': 'puffer',
  'sunglasses-mackerel': 'tuna',
  'firefly-minnow': 'clownfish',
  'ribbit-catfish': 'swordfish',
  'rainbow-trout': 'blue-tang',
  'moss-carp': 'dolphin',
  'buff-seabream': 'clownfish',
  'disco-jelly': 'puffer',
  'pirate-tuna': 'shark',
  'thunder-eel': 'swordfish',
  'golden-crown-carp': 'dolphin',
  'lost-anchovy': 'clownfish',
}

const modelUrl = (id: ModelId) => `${import.meta.env.BASE_URL}models/${id}.glb`

// 모델은 전부 머리가 +z 를 향해 만들어져 있어 따로 돌릴 필요가 없다. 씬이 처음 그려지기 전에 미리 받아 둔다
for (const id of MODEL_IDS) useGLTF.preload(modelUrl(id))

/** 몸길이를 1.2 로 맞춘다. 기존 도형 물고기와 같은 크기 */
const FISH_LENGTH = 1.2

function Model({ id }: { id: ModelId }) {
  const { scene, animations } = useGLTF(modelUrl(id))
  // 낚을 때마다 같은 모델이 여러 마리 나올 수 있으니 인스턴스마다 복제한다 (뼈대 포함)
  const object = useMemo(() => cloneSkinned(scene), [scene])
  const { actions } = useAnimations(animations, object)

  // 크기를 몸길이 기준으로 맞추고 중심을 원점에 둔다
  const { scale, offset } = useMemo(() => {
    const box = restBox(object)
    const size = box.getSize(new Vector3())
    const k = FISH_LENGTH / Math.max(size.x, size.y, size.z)
    return { scale: k, offset: box.getCenter(new Vector3()).multiplyScalar(-k) }
  }, [object])

  useLayoutEffect(() => {
    object.traverse((o) => {
      o.castShadow = true
      o.frustumCulled = false // 스킨 메시는 애니메이션 중 경계가 달라져 깜빡일 수 있다
    })
  }, [object])

  useEffect(() => {
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
 * 물고기 모델 (Quaternius, CC0). 머리가 +z 쪽.
 * 크기는 부모가 group.scale 로 정한다. 모델을 받는 동안에도 group 은 항상 있어서 ref 를 바로 쓸 수 있다
 */
export const FishModel = forwardRef<Group, { speciesId: string | null; scale?: number }>(function FishModel({ speciesId, scale = 1 }, ref) {
  const id = (speciesId && SPECIES_MODEL[speciesId]) || DEFAULT_MODEL
  return (
    <group ref={ref} scale={scale}>
      <Suspense fallback={null}>
        <Model key={id} id={id} />
      </Suspense>
    </group>
  )
})
