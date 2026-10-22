import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { MeshStandardMaterial } from 'three'
import { DECOR_VARIANTS, buildDecorLayout } from '../../logic/decorLayout'
import { GROUND_Y } from '../../data/decor'
import { INLAND_WATER_Y } from '../../data/zones'
import type { Placement } from '../../logic/decor'
import { BeachBits } from './BeachBits'
import { BUSH_URLS, FLOWER_URLS, MUSHROOM_URLS, NATURE, ROCK_URLS, preloadDecorAssets } from './decorAssets'
import { GrassField } from './GrassField'
import { buildGroundGeometry } from './groundGeometry'
import { ModelInstances } from './ModelInstances'
import { Trees } from './Trees'
import { windUniforms } from './wind'

preloadDecorAssets()

/** 모래 경계 갈대 색 */
const DUNE_TINT = '#b9c46e'

/** 섬 바닥 꾸미기: 풀밭·모래·흙길 바닥, 흔들리는 풀, 꽃밭, 덤불, 바위, 나무, 조개. 배치는 씨앗으로 정해져 늘 같다 */
export function IslandDecor() {
  const layout = useMemo(() => buildDecorLayout(), [])
  return (
    <group>
      <WindClock />
      <Ground />
      <GrassField placements={layout.grass} tint="ground" />
      <GrassField placements={layout.dune} tint={DUNE_TINT} wind={1.3} />
      <ByVariant urls={FLOWER_URLS} placements={layout.flowers} count={DECOR_VARIANTS.flower} wind={1} />
      <ByVariant urls={BUSH_URLS} placements={layout.bushes} count={DECOR_VARIANTS.bush} wind={0.25} castShadow />
      <ByVariant urls={ROCK_URLS} placements={layout.rocks} count={DECOR_VARIANTS.rock} castShadow />
      <ByVariant urls={MUSHROOM_URLS} placements={layout.mushrooms} count={DECOR_VARIANTS.mushroom} />
      <ModelInstances url={NATURE.lily} placements={layout.lilies} y={INLAND_WATER_Y + 0.005} />
      <BeachBits shells={layout.shells} starfish={layout.starfish} pebbles={layout.pebbles} />
      <Trees trees={layout.trees} />
    </group>
  )
}

/** 바람 셰이더 시간을 올린다 */
function WindClock() {
  useFrame(({ clock }) => {
    windUniforms.uWindTime.value = clock.elapsedTime
  })
  return null
}

/** 풀밭·모래·흙길 색을 칠한 바닥 (충돌은 Island 의 원기둥이 맡는다) */
function Ground() {
  const geometry = useMemo(() => buildGroundGeometry(), [])
  const material = useMemo(() => new MeshStandardMaterial({ vertexColors: true, roughness: 1 }), [])
  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )
  return <mesh geometry={geometry} material={material} position-y={GROUND_Y} receiveShadow />
}

/** 종류(variant)별로 나눠 같은 모델끼리 한 번에 그린다 */
function ByVariant({ urls, placements, count, wind = 0, castShadow = false }: { urls: string[]; placements: Placement[]; count: number; wind?: number; castShadow?: boolean }) {
  const groups = useMemo(() => Array.from({ length: count }, (_, v) => placements.filter((p) => p.variant === v)), [placements, count])
  return (
    <>
      {groups.map((list, v) => (
        <ModelInstances key={urls[v]} url={urls[v]} placements={list} wind={wind} castShadow={castShadow} />
      ))}
    </>
  )
}
