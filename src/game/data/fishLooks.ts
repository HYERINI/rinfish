/** 물고기 3D 모델 (public/models/fish/ 아래 CC0 glb). 머리는 +z */
export type FishModelId =
  | 'puffer' | 'tuna' | 'blue-tang' | 'cardinal' | 'tang' | 'tetra' | 'armored-catfish' | 'trout' | 'koi'
  | 'red-snapper' | 'blobfish' | 'goblin-shark' | 'goldfish' | 'mackerel' | 'yellow-tang' | 'flatfish'
  | 'blue-goldfish' | 'flowerhorn' | 'lionfish' | 'anglerfish' | 'manta' | 'betta' | 'squid'

export const FISH_MODEL_FILES: Record<FishModelId, string> = {
  puffer: 'fish/puffer.glb',
  tuna: 'fish/tuna.glb',
  'blue-tang': 'fish/blue-tang.glb',
  cardinal: 'fish/cardinal.glb',
  tang: 'fish/tang.glb',
  tetra: 'fish/tetra.glb',
  'armored-catfish': 'fish/armored-catfish.glb',
  trout: 'fish/trout.glb',
  koi: 'fish/koi.glb',
  'red-snapper': 'fish/red-snapper.glb',
  blobfish: 'fish/blobfish.glb',
  'goblin-shark': 'fish/goblin-shark.glb',
  goldfish: 'fish/goldfish.glb',
  mackerel: 'fish/mackerel.glb',
  'yellow-tang': 'fish/yellow-tang.glb',
  flatfish: 'fish/flatfish.glb',
  'blue-goldfish': 'fish/blue-goldfish.glb',
  flowerhorn: 'fish/flowerhorn.glb',
  lionfish: 'fish/lionfish.glb',
  anglerfish: 'fish/anglerfish.glb',
  manta: 'fish/manta.glb',
  betta: 'fish/betta.glb',
  squid: 'fish/squid.glb',
}

export type FishAccessoryKind =
  | 'sunglasses' | 'eyepatch' | 'crown' | 'frogCrown' | 'roundGlasses' | 'headband' | 'nightcap'
  | 'lifebuoy' | 'spaceHelmet' | 'ninjaMask' | 'dreadlocks' | 'crystal' | 'selfieStick'
  | 'spoons' | 'googlyEyes' | 'sadBrows' | 'digit3' | 'digits31' | 'darkCircles' | 'priceTag3' | 'furPerm'
  | 'bossChain' | 'bossScar' | 'bread' | 'grandpaBeard' | 'magnifierGlasses' | 'sheepTowel' | 'cane' | 'bowlCut'

export type FishLook = {
  model: FishModelId
  /** 몸 색. 부위별 밝기 차이는 남기고 이 색으로 물들인다 (눈은 그대로) */
  tint?: string
  /** 스스로 빛나는 색 (발광) */
  glow?: string
  /** 몸길이 배율 (기본 1) */
  size: number
  /** 몸 비율 [두께 x, 높이 y, 길이 z]. 곱한 뒤 가장 긴 쪽을 몸길이로 다시 맞추므로 비율만 남는다 (기본 [1, 1, 1]) */
  stretch?: [number, number, number]
  /** 모델 자체 회전 [x, y, z] 라디안. 머리가 +z 가 아닌 모델을 돌린다 (몸길이를 맞추기 전에 넣는다) */
  rotate?: [number, number, number]
  /** 헤엄칠 때 몸을 좌우로 휘청거리는 세기 0~1 (사진에는 넣지 않는다) */
  wobble?: number
  /** 소품들. 머리(또는 몸)에 붙는다 */
  accessories?: FishAccessoryKind[]
  /** 첫 소품의 위치 [x, y, z] (몸길이 1.2로 맞춘 물고기 기준, 머리 +z). 없으면 모델의 눈·머리 위치에서 정한 기본 위치 */
  accessoryAt?: [number, number, number]
}

export const DEFAULT_FISH_LOOK: FishLook = { model: 'blue-tang', size: 1 }

export const FISH_LOOKS: Record<string, FishLook> = {
  'sleepy-sardine': { model: 'cardinal', tint: '#8fa3b5', size: 0.8 },
  'chatty-mackerel': { model: 'tang', size: 0.9 },
  'bubble-puffer': { model: 'puffer', size: 0.9 },
  'sunglasses-mackerel': { model: 'blue-tang', tint: '#7d9bb5', size: 1, accessories: ['sunglasses'] },
  'selfie-flyingfish': { model: 'yellow-tang', size: 0.9, accessories: ['selfieStick'] },
  'lifeguard-flounder': { model: 'flatfish', size: 1.1, accessories: ['lifebuoy'] },
  'firefly-minnow': { model: 'tetra', glow: '#c6ff00', size: 0.8 },
  'ribbit-catfish': { model: 'armored-catfish', tint: '#4e5a26', size: 1 },
  'rainbow-trout': { model: 'trout', size: 1 },
  'moss-carp': { model: 'koi', tint: '#7cb342', size: 1.2 },
  'professor-crucian': { model: 'blue-goldfish', tint: '#a1887f', size: 0.9, accessories: ['roundGlasses'] },
  'frog-prince-carp': { model: 'flowerhorn', tint: '#9ccc65', size: 1, accessories: ['frogCrown'] },
  'sleepy-catfish-king': { model: 'armored-catfish', tint: '#455a64', size: 1.4, accessories: ['nightcap'] },
  'buff-seabream': { model: 'red-snapper', size: 1, accessories: ['headband'] },
  'disco-jelly': { model: 'blobfish', tint: '#e1bee7', glow: '#ff4fd8', size: 0.9 },
  'pirate-tuna': { model: 'tuna', size: 1.3, accessories: ['eyepatch'] },
  'thunder-eel': { model: 'goblin-shark', tint: '#ffee58', glow: '#ffd600', size: 1.2 },
  'reggae-lionfish': { model: 'lionfish', size: 1, accessories: ['dreadlocks'], accessoryAt: [0, 0.02, 0.2] },
  'astronaut-angler': { model: 'anglerfish', size: 1.2, accessories: ['spaceHelmet'] },
  'ninja-ray': { model: 'manta', tint: '#7d88a8', size: 1.3, accessories: ['ninjaMask'] },
  'golden-crown-carp': { model: 'goldfish', tint: '#ffd54f', glow: '#ff8f00', size: 1.2, accessories: ['crown'] },
  'crystal-eye-cavefish': { model: 'betta', tint: '#e0f7fa', size: 1, accessories: ['crystal'] },
  'lost-anchovy': { model: 'mackerel', tint: '#b0bec5', size: 0.6 },
  // 스터디원
  'skinny-anchovy-insik': { model: 'mackerel', tint: '#cfd8dc', size: 1.1, stretch: [0.35, 0.4, 1.6], wobble: 0.8 },
  'nurungji-eunji': { model: 'goldfish', tint: '#c8913a', size: 1.15, stretch: [1.3, 1, 0.75], accessories: ['sunglasses', 'bossChain', 'bossScar', 'bread'] },
  'ugeok-kimugeok': { model: 'puffer', tint: '#f48fb1', size: 1.3, stretch: [1.5, 1.4, 1.1], accessories: ['spoons'] },
  'squid-ojeonghun': { model: 'squid', tint: '#f2d7a6', size: 1, stretch: [0.6, 1, 1], rotate: [0, Math.PI / 2, Math.PI / 2], accessories: ['sadBrows'] },
  'eelgas-baejeongbin': { model: 'goblin-shark', tint: '#4e342e', size: 2.4, stretch: [0.8, 0.8, 1.4], accessories: ['digits31'] },
  'bigeye-kimgaeun': { model: 'cardinal', tint: '#ffe0b2', size: 1, accessories: ['googlyEyes'] },
  'three-wonjun': { model: 'tang', tint: '#90a4ae', size: 0.9, accessories: ['digit3', 'darkCircles', 'priceTag3', 'bowlCut'] },
  'hairy-ajumma-jongheon': { model: 'red-snapper', tint: '#8d6e63', size: 1, accessories: ['furPerm'] },
  'grandpa-escapee': { model: 'koi', tint: '#e53935', size: 1, accessories: ['grandpaBeard', 'magnifierGlasses', 'sheepTowel', 'cane'] },
}

export function fishLookFor(speciesId: string | null): FishLook {
  return (speciesId && FISH_LOOKS[speciesId]) || DEFAULT_FISH_LOOK
}
