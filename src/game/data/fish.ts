import type { FishSpecies, Rarity } from './types'

export const RARITY_LABEL: Record<Rarity, string> = {
  junk: '잡어',
  common: '일반',
  rare: '희귀',
  epic: '에픽',
  legendary: '전설',
}

export const RARITY_COLOR: Record<Rarity, string> = {
  junk: '#9e9e9e',
  common: '#e0e0e0',
  rare: '#4fc3f7',
  epic: '#ba68c8',
  legendary: '#ffd54f',
}

// 순서가 곧 도감 순서이자 추첨 순서다
export const FISH_SPECIES: FishSpecies[] = [
  // ① 선착장 해변
  { id: 'sleepy-sardine', name: '졸린 정어리', description: '늘 반쯤 감긴 눈. 잡혀도 크게 저항하지 않는다.', zones: ['beach'], rarity: 'common', pattern: 'endurance', strength: 2, weightRange: [0.1, 0.3], basePrice: 10, color: '#90a4ae' },
  { id: 'chatty-mackerel', name: '수다쟁이 전갱이', description: '입을 쉬지 않는다. 가끔 확 튀어 오른다.', zones: ['beach'], rarity: 'common', pattern: 'dasher', strength: 3, weightRange: [0.2, 0.6], basePrice: 14, color: '#80cbc4' },
  { id: 'bubble-puffer', name: '뽀글 복어', description: '놀라면 부풀었다 줄었다, 종잡을 수 없다.', zones: ['beach'], rarity: 'common', pattern: 'erratic', strength: 3, weightRange: [0.3, 0.8], basePrice: 16, color: '#fff176' },
  { id: 'sunglasses-mackerel', name: '선글라스 고등어', description: '바다에서 제일 힙한 녀석. 순간 가속이 엄청나다.', zones: ['beach'], rarity: 'rare', pattern: 'dasher', strength: 4, weightRange: [0.5, 1.5], basePrice: 40, color: '#37474f' },
  // ② 숲속 연못
  { id: 'firefly-minnow', name: '반딧불 송사리', description: '밤마다 꼬리가 깜빡인다.', zones: ['pond'], rarity: 'common', pattern: 'endurance', strength: 2, weightRange: [0.05, 0.2], basePrice: 12, color: '#c6ff00' },
  { id: 'ribbit-catfish', name: '개굴 메기', description: '개구리 소리를 흉내 낸다. 이유는 아무도 모른다.', zones: ['pond'], rarity: 'common', pattern: 'erratic', strength: 3, weightRange: [1, 3], basePrice: 20, color: '#8d6e63' },
  { id: 'rainbow-trout', name: '무지개 송어', description: '비늘이 일곱 빛깔로 반짝인다.', zones: ['pond'], rarity: 'rare', pattern: 'dasher', strength: 5, weightRange: [1, 2.5], basePrice: 45, color: '#f48fb1' },
  { id: 'moss-carp', name: '이끼 거북잉어', description: '등에 이끼가 자랄 만큼 오래 산 잉어. 지치지 않는다.', zones: ['pond'], rarity: 'epic', pattern: 'endurance', strength: 7, weightRange: [3, 6], basePrice: 120, color: '#558b2f' },
  // ③ 암초 앞바다
  { id: 'buff-seabream', name: '근육 도미', description: '매일 파도를 상대로 운동한다.', zones: ['reef'], rarity: 'common', pattern: 'endurance', strength: 4, weightRange: [1, 3], basePrice: 25, color: '#ef9a9a' },
  { id: 'disco-jelly', name: '디스코 해파리', description: '물속에서 혼자 조명을 켜고 춤춘다.', zones: ['reef'], rarity: 'rare', pattern: 'erratic', strength: 5, weightRange: [0.5, 2], basePrice: 60, color: '#e1bee7' },
  { id: 'pirate-tuna', name: '해적 참치', description: '안대를 찼다. 낚싯줄을 노리고 돌진한다.', zones: ['reef'], rarity: 'epic', pattern: 'dasher', strength: 8, weightRange: [10, 30], basePrice: 200, color: '#1a237e' },
  { id: 'thunder-eel', name: '번개 장어', description: '몸에서 찌릿찌릿 전기가 흐른다.', zones: ['reef'], rarity: 'epic', pattern: 'erratic', strength: 8, weightRange: [2, 5], basePrice: 180, color: '#ffee58' },
  // ④ 동굴 지하호수
  { id: 'golden-crown-carp', name: '왕관 쓴 황금 잉어', description: '섬의 전설. 세 가지 얼굴로 낚시꾼을 시험한다.', zones: ['cave'], rarity: 'legendary', pattern: 'mixed', strength: 10, weightRange: [8, 12], basePrice: 1000, color: '#ffc107' },
  // 잡어
  { id: 'lost-anchovy', name: '길 잃은 멸치', description: '무리에서 떨어진 작은 멸치. 어항 먹이로 쓸 수 있다.', zones: ['beach', 'pond', 'reef'], rarity: 'junk', pattern: 'endurance', strength: 1, weightRange: [0.01, 0.05], basePrice: 1, color: '#b0bec5' },
]

export function findSpecies(id: string): FishSpecies | undefined {
  return FISH_SPECIES.find((s) => s.id === id)
}

export function getSpecies(id: string): FishSpecies {
  const species = findSpecies(id)
  if (!species) throw new Error(`알 수 없는 물고기: ${id}`)
  return species
}
