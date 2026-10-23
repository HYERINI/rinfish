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
  { id: 'selfie-flyingfish', name: '셀카 날치', description: '물 위로 튀어 오를 때마다 셀카를 찍는다.', zones: ['beach'], rarity: 'rare', pattern: 'dasher', strength: 4, weightRange: [0.3, 0.9], basePrice: 45, color: '#ffd54f' },
  { id: 'lifeguard-flounder', name: '구조대 가자미', description: '빨간 구명튜브를 두르고 해변을 순찰한다.', zones: ['beach'], rarity: 'epic', pattern: 'endurance', strength: 6, weightRange: [1, 4], basePrice: 140, color: '#a1887f' },
  // 스터디원 (해변 희귀)
  { id: 'skinny-anchovy-insik', name: '개멸치뼈인식', description: '잡으면 낚싯바늘이 더 무겁다. 구워 먹으려 했는데 이쑤시개가 됐다.', trivia: '체중 ★☆☆☆☆ / 자존심 ★★★★★', zones: ['beach'], rarity: 'rare', pattern: 'erratic', strength: 2, weightRange: [0.01, 0.03], basePrice: 40, color: '#cfd8dc' },
  { id: 'nurungji-eunji', name: '누룽지이은지', description: '노릇노릇 동글동글 형님. 빵 먹을 때 건드리면 손가락을 잘라 간다.', trivia: '서열 ★★★★★ / 빵 ★★★★★', zones: ['beach'], rarity: 'rare', pattern: 'dasher', strength: 6, weightRange: [1, 3], basePrice: 60, color: '#c8913a' },
  { id: 'ugeok-kimugeok', name: '또먹냐김우걱', description: '먹이를 주면 잡기 쉬워진다. 단, 먹이가 먼저 사라진다.', trivia: '포만감 측정불가', zones: ['beach'], rarity: 'rare', pattern: 'endurance', strength: 7, weightRange: [8, 15], basePrice: 70, color: '#f48fb1' },
  { id: 'squid-ojeonghun', name: '마른오징어정훈', description: '본인은 물고기라고 주장한다. 아무도 물어본 적 없다.', trivia: '물고기력 ★☆☆☆☆ / 억울함 ★★★★★', zones: ['beach'], rarity: 'rare', pattern: 'erratic', strength: 4, weightRange: [0.5, 1.5], basePrice: 50, color: '#d7b98e' },
  { id: 'eelgas-baejeongbin', name: 'XXL배정빈', description: '한 마리가 출현하면 수조 정원이 초과된다. 사이즈 선택은 불가능하다.', trivia: '1인분 기준 8인분', zones: ['beach'], rarity: 'rare', pattern: 'dasher', strength: 7, weightRange: [10, 25], basePrice: 80, color: '#4e342e' },
  { id: 'bigeye-kimgaeun', name: '눈밖에김가은', description: '시야각 340°. 코는 업데이트 예정.', trivia: '시야 ★★★★★ / 코 ★☆☆☆☆', zones: ['beach'], rarity: 'rare', pattern: 'endurance', strength: 3, weightRange: [0.5, 1.5], basePrice: 50, color: '#ffe0b2' },
  { id: 'three-wonjun', name: '연차3원준', description: '연차가 3개 남았다. 체력은 0개 남았다.', trivia: '남은 연차 3 / 헤어스타일 이해 불가', zones: ['beach'], rarity: 'rare', pattern: 'erratic', strength: 3, weightRange: [0.29, 0.31], basePrice: 3, color: '#90a4ae' },
  { id: 'hairy-ajumma-jongheon', name: '털밖에윤종헌', description: '털갈이 철에는 개체 수가 두 배로 보인다. 절반은 털이다.', trivia: '털 ★★★★★ / 지느러미 확인 불가', zones: ['beach'], rarity: 'rare', pattern: 'endurance', strength: 5, weightRange: [1, 3], basePrice: 55, color: '#8d6e63' },
  { id: 'grandpa-escapee', name: '할아범이적범', description: '싸사모(싸우나를 사랑하는 모임) 회장님. 오후 8시 이후 발견 기록이 없다.', trivia: '사우나 ★★★★★ / 주량 ★☆☆☆☆ / 활동시간 05:30~20:00', zones: ['beach'], rarity: 'rare', pattern: 'dasher', strength: 5, weightRange: [1, 2.5], basePrice: 60, color: '#e53935' },
  // 추멸치 파생 (해변 희귀·에픽)
  { id: 'stuck-anchovy-chu', name: '배정빈 이 사이에 낀 추멸치', description: 'XXL배정빈의 점심 메뉴였다. 이쑤시개로도 안 빠진다.', trivia: '탈출 시도 ★★★★★ / 성공률 ☆☆☆☆☆', zones: ['beach'], rarity: 'rare', pattern: 'erratic', strength: 2, weightRange: [0.01, 0.02], basePrice: 30, color: '#cfd8dc' },
  { id: 'anchovy-school-chu', name: '추멸치떼', description: '추멸치가 힘을 합쳤다. 합쳐도 멸치다.', trivia: '개체 수 ★★★★★ / 개체당 체중 ★☆☆☆☆', zones: ['beach'], rarity: 'epic', pattern: 'erratic', strength: 6, weightRange: [0.3, 0.8], basePrice: 120, color: '#b0bec5' },
  // ② 숲속 연못
  { id: 'firefly-minnow', name: '반딧불 송사리', description: '밤마다 꼬리가 깜빡인다.', zones: ['pond'], rarity: 'common', pattern: 'endurance', strength: 2, weightRange: [0.05, 0.2], basePrice: 12, color: '#c6ff00' },
  { id: 'ribbit-catfish', name: '개굴 메기', description: '개구리 소리를 흉내 낸다. 이유는 아무도 모른다.', zones: ['pond'], rarity: 'common', pattern: 'erratic', strength: 3, weightRange: [1, 3], basePrice: 20, color: '#8d6e63' },
  { id: 'rainbow-trout', name: '무지개 송어', description: '비늘이 일곱 빛깔로 반짝인다.', zones: ['pond'], rarity: 'rare', pattern: 'dasher', strength: 5, weightRange: [1, 2.5], basePrice: 45, color: '#f48fb1' },
  { id: 'moss-carp', name: '이끼 거북잉어', description: '등에 이끼가 자랄 만큼 오래 산 잉어. 지치지 않는다.', zones: ['pond'], rarity: 'epic', pattern: 'endurance', strength: 7, weightRange: [3, 6], basePrice: 120, color: '#558b2f' },
  { id: 'professor-crucian', name: '안경 박사 붕어', description: '동그란 안경을 쓴, 연못에서 제일 똑똑한 붕어.', zones: ['pond'], rarity: 'rare', pattern: 'erratic', strength: 4, weightRange: [0.3, 1.2], basePrice: 50, color: '#a1887f' },
  { id: 'frog-prince-carp', name: '개구리 왕자 잉어', description: '개구리 모자 위에 작은 왕관. 뽀뽀하면 뭐가 될까.', zones: ['pond'], rarity: 'rare', pattern: 'endurance', strength: 5, weightRange: [1, 3], basePrice: 55, color: '#9ccc65' },
  { id: 'sleepy-catfish-king', name: '잠꾸러기 메기왕', description: '수면 모자를 쓰고 졸다가 갑자기 돌진한다.', zones: ['pond'], rarity: 'epic', pattern: 'dasher', strength: 7, weightRange: [4, 10], basePrice: 160, color: '#455a64' },
  // ③ 암초 앞바다
  { id: 'buff-seabream', name: '근육 도미', description: '매일 파도를 상대로 운동한다.', zones: ['reef'], rarity: 'common', pattern: 'endurance', strength: 4, weightRange: [1, 3], basePrice: 25, color: '#ef9a9a' },
  { id: 'disco-jelly', name: '디스코 해파리', description: '물속에서 혼자 조명을 켜고 춤춘다.', zones: ['reef'], rarity: 'rare', pattern: 'erratic', strength: 5, weightRange: [0.5, 2], basePrice: 60, color: '#e1bee7' },
  { id: 'pirate-tuna', name: '해적 참치', description: '안대를 찼다. 낚싯줄을 노리고 돌진한다.', zones: ['reef'], rarity: 'epic', pattern: 'dasher', strength: 8, weightRange: [10, 30], basePrice: 200, color: '#1a237e' },
  { id: 'thunder-eel', name: '번개 장어', description: '몸에서 찌릿찌릿 전기가 흐른다.', zones: ['reef'], rarity: 'epic', pattern: 'erratic', strength: 8, weightRange: [2, 5], basePrice: 180, color: '#ffee58' },
  { id: 'reggae-lionfish', name: '레게 쏠배감펭', description: '지느러미가 레게 머리처럼 휘날린다.', zones: ['reef'], rarity: 'rare', pattern: 'erratic', strength: 5, weightRange: [0.5, 1.5], basePrice: 65, color: '#ef6c00' },
  { id: 'astronaut-angler', name: '우주비행사 아귀', description: '헬멧 속 초롱이 별처럼 빛난다.', zones: ['reef'], rarity: 'epic', pattern: 'endurance', strength: 8, weightRange: [3, 8], basePrice: 220, color: '#37474f' },
  { id: 'ninja-ray', name: '닌자 가오리', description: '검은 복면. 눈 깜짝할 새 사라진다.', zones: ['reef'], rarity: 'epic', pattern: 'erratic', strength: 8, weightRange: [5, 15], basePrice: 230, color: '#263238' },
  // ④ 동굴 지하호수
  { id: 'golden-crown-carp', name: '왕관 쓴 황금 잉어', description: '섬의 전설. 세 가지 얼굴로 낚시꾼을 시험한다.', zones: ['cave'], rarity: 'legendary', pattern: 'mixed', strength: 10, weightRange: [8, 12], basePrice: 1000, color: '#ffc107' },
  { id: 'crystal-eye-cavefish', name: '수정 눈 동굴어', description: '눈 대신 빛나는 수정. 동굴에만 산다.', zones: ['cave'], rarity: 'epic', pattern: 'erratic', strength: 8, weightRange: [1, 3], basePrice: 260, color: '#b2ebf2' },
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
