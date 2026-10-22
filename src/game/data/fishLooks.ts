/** 물고기 3D 모델 (public/models/fish/ 아래 CC0 glb). 머리는 +z */
export type FishModelId =
  | 'puffer' | 'tuna' | 'blue-tang' | 'cardinal' | 'tang' | 'tetra' | 'armored-catfish' | 'trout' | 'koi'
  | 'red-snapper' | 'blobfish' | 'goblin-shark' | 'goldfish' | 'mackerel' | 'yellow-tang' | 'flatfish'
  | 'blue-goldfish' | 'flowerhorn' | 'lionfish' | 'anglerfish' | 'manta' | 'betta'

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
}

export type FishAccessoryKind =
  | 'sunglasses' | 'eyepatch' | 'crown' | 'frogCrown' | 'roundGlasses' | 'headband' | 'nightcap'
  | 'lifebuoy' | 'spaceHelmet' | 'ninjaMask' | 'dreadlocks' | 'crystal' | 'selfieStick'

export type FishLook = {
  model: FishModelId
  /** 몸 색. 부위별 밝기 차이는 남기고 이 색으로 물들인다 (눈은 그대로) */
  tint?: string
  /** 스스로 빛나는 색 (발광) */
  glow?: string
  /** 몸길이 배율 (기본 1) */
  size: number
  accessory?: FishAccessoryKind
  /** 소품 위치 [x, y, z] (몸길이 1.2로 맞춘 물고기 기준, 머리 +z). 없으면 모델의 눈·머리 위치에서 정한 기본 위치 */
  accessoryAt?: [number, number, number]
}

export const DEFAULT_FISH_LOOK: FishLook = { model: 'blue-tang', size: 1 }

export const FISH_LOOKS: Record<string, FishLook> = {
  'sleepy-sardine': { model: 'cardinal', tint: '#8fa3b5', size: 0.8 },
  'chatty-mackerel': { model: 'tang', size: 0.9 },
  'bubble-puffer': { model: 'puffer', size: 0.9 },
  'sunglasses-mackerel': { model: 'blue-tang', tint: '#7d9bb5', size: 1, accessory: 'sunglasses' },
  'selfie-flyingfish': { model: 'yellow-tang', size: 0.9, accessory: 'selfieStick' },
  'lifeguard-flounder': { model: 'flatfish', size: 1.1, accessory: 'lifebuoy' },
  'firefly-minnow': { model: 'tetra', glow: '#c6ff00', size: 0.8 },
  'ribbit-catfish': { model: 'armored-catfish', tint: '#4e5a26', size: 1 },
  'rainbow-trout': { model: 'trout', size: 1 },
  'moss-carp': { model: 'koi', tint: '#7cb342', size: 1.2 },
  'professor-crucian': { model: 'blue-goldfish', tint: '#a1887f', size: 0.9, accessory: 'roundGlasses' },
  'frog-prince-carp': { model: 'flowerhorn', tint: '#9ccc65', size: 1, accessory: 'frogCrown' },
  'sleepy-catfish-king': { model: 'armored-catfish', tint: '#455a64', size: 1.4, accessory: 'nightcap' },
  'buff-seabream': { model: 'red-snapper', size: 1, accessory: 'headband' },
  'disco-jelly': { model: 'blobfish', tint: '#e1bee7', glow: '#ff4fd8', size: 0.9 },
  'pirate-tuna': { model: 'tuna', size: 1.3, accessory: 'eyepatch' },
  'thunder-eel': { model: 'goblin-shark', tint: '#ffee58', glow: '#ffd600', size: 1.2 },
  'reggae-lionfish': { model: 'lionfish', size: 1, accessory: 'dreadlocks', accessoryAt: [0, 0.02, 0.2] },
  'astronaut-angler': { model: 'anglerfish', size: 1.2, accessory: 'spaceHelmet' },
  'ninja-ray': { model: 'manta', tint: '#7d88a8', size: 1.3, accessory: 'ninjaMask' },
  'golden-crown-carp': { model: 'goldfish', tint: '#ffd54f', glow: '#ff8f00', size: 1.2, accessory: 'crown' },
  'crystal-eye-cavefish': { model: 'betta', tint: '#e0f7fa', size: 1, accessory: 'crystal' },
  'lost-anchovy': { model: 'mackerel', tint: '#b0bec5', size: 0.6 },
}

export function fishLookFor(speciesId: string | null): FishLook {
  return (speciesId && FISH_LOOKS[speciesId]) || DEFAULT_FISH_LOOK
}
