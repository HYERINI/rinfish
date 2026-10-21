export type FishModelId = 'clownfish' | 'blue-tang' | 'puffer' | 'tuna' | 'shark' | 'swordfish' | 'dolphin'

export const FISH_MODEL_IDS: FishModelId[] = ['clownfish', 'blue-tang', 'puffer', 'tuna', 'shark', 'swordfish', 'dolphin']

const DEFAULT_MODEL: FishModelId = 'blue-tang'

/** 어종 → 모델. 목록에 없는 어종은 기본 모델을 쓴다 */
const SPECIES_MODEL: Record<string, FishModelId> = {
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

export function fishModelFor(speciesId: string | null): FishModelId {
  return (speciesId && SPECIES_MODEL[speciesId]) || DEFAULT_MODEL
}

export const fishModelUrl = (id: FishModelId) => `${import.meta.env.BASE_URL}models/${id}.glb`
