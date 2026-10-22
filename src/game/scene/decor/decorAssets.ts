import { useGLTF } from '@react-three/drei'
import type { TreeKind } from '../../data/decor'

const base = `${import.meta.env.BASE_URL}models/kenney/nature`

/** 섬 꾸미기에 쓰는 Kenney Nature Kit 모델 (CC0) */
export const NATURE = {
  palm: `${base}/tree_palm.glb`,
  palmBend: `${base}/tree_palmBend.glb`,
  palmShort: `${base}/tree_palmShort.glb`,
  oak: `${base}/tree_oak.glb`,
  round: `${base}/tree_default.glb`,
  fat: `${base}/tree_fat.glb`,
  pine: `${base}/tree_pineRoundA.glb`,
  flowerRed: `${base}/flower_redA.glb`,
  flowerYellow: `${base}/flower_yellowA.glb`,
  flowerPurple: `${base}/flower_purpleA.glb`,
  flowerYellowB: `${base}/flower_yellowB.glb`,
  mushroomRed: `${base}/mushroom_red.glb`,
  mushroomTan: `${base}/mushroom_tanGroup.glb`,
  bush: `${base}/plant_bush.glb`,
  bushLarge: `${base}/plant_bushLarge.glb`,
  bushDetailed: `${base}/plant_bushDetailed.glb`,
  bushSmall: `${base}/plant_bushSmall.glb`,
  rockA: `${base}/rock_smallA.glb`,
  rockC: `${base}/rock_smallC.glb`,
  lily: `${base}/lily_small.glb`,
} as const satisfies Record<string, string>

export const TREE_URL: Record<TreeKind, string> = {
  palm: NATURE.palm,
  palmBend: NATURE.palmBend,
  palmShort: NATURE.palmShort,
  oak: NATURE.oak,
  round: NATURE.round,
  fat: NATURE.fat,
  pine: NATURE.pine,
}

/** 종류 번호(variant) 순서. logic/decorLayout 의 DECOR_VARIANTS 개수와 맞춘다 */
export const FLOWER_URLS = [NATURE.flowerRed, NATURE.flowerYellow, NATURE.flowerPurple, NATURE.flowerYellowB]
export const BUSH_URLS = [NATURE.bush, NATURE.bushLarge, NATURE.bushDetailed, NATURE.bushSmall]
export const ROCK_URLS = [NATURE.rockA, NATURE.rockC]
export const MUSHROOM_URLS = [NATURE.mushroomRed, NATURE.mushroomTan]

/**
 * Kenney 기본 색(민트빛 잎)을 섬의 연두 풀빛에 맞춘다. 재질 이름 → 색 (sRGB)
 * 덤불·꽃 줄기·잎은 풀밭과 어울리게, 나무껍질은 조금 진하게
 */
export const NATURE_COLORS: Record<string, string> = {
  leafsGreen: '#5bb04a',
  leafsDark: '#3f8c4a',
  grass: '#62b345',
  woodBark: '#a8714f',
  woodBarkDark: '#7a5240',
  colorRed: '#f05a6a',
  colorYellow: '#ffd23f',
  colorPurple: '#b08cf0',
  colorTan: '#e8c49a',
  dirt: '#b8ae9f',
}

/** 씬이 그려지기 전에 미리 받아 둔다 */
export function preloadDecorAssets() {
  for (const url of Object.values(NATURE)) useGLTF.preload(url)
}
