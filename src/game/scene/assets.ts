import { useGLTF } from '@react-three/drei'

const base = `${import.meta.env.BASE_URL}models/kenney`

/** 시설 장식에 쓰는 Kenney 에셋 (CC0) */
export const ASSET = {
  fish: `${base}/food/fish.glb`,
  potStew: `${base}/food/pot-stew.glb`,
  sushi: `${base}/food/sushi-salmon.glb`,
  bowlBroth: `${base}/food/bowl-broth.glb`,
  cuttingBoard: `${base}/food/cutting-board-japanese.glb`,
  plate: `${base}/food/plate-dinner.glb`,
  counter: `${base}/furniture/kitchenBar.glb`,
  stove: `${base}/furniture/kitchenStove.glb`,
  bed: `${base}/furniture/bedSingle.glb`,
  plant: `${base}/furniture/pottedPlant.glb`,
  rockA: `${base}/nature/rock_smallA.glb`,
  rockC: `${base}/nature/rock_smallC.glb`,
  rockTall: `${base}/nature/rock_tallA.glb`,
  bush: `${base}/nature/plant_bushSmall.glb`,
  lily: `${base}/nature/lily_small.glb`,
  stoneTall: `${base}/nature/stone_tallB.glb`,
  bench: `${base}/holiday/bench.glb`,
  parasol: `${base}/city-commercial/detail-parasol-a.glb`,
  visitorA: `${base}/characters/character-female-a.glb`,
  visitorB: `${base}/characters/character-male-c.glb`,
  visitorC: `${base}/characters/character-female-d.glb`,
} as const

/** 씬이 그려지기 전에 미리 받아 둔다 */
export function preloadFacilityAssets() {
  for (const url of Object.values(ASSET)) useGLTF.preload(url)
}
