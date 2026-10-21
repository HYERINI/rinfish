import type { BodyPart, CharacterLook, Gender, HairId, OutfitId } from './types'

export const GENDER_LABEL: Record<Gender, string> = { male: '남자', female: '여자' }

export const HAIRS: { id: HairId; name: string }[] = [
  { id: 'simpleParted', name: '가르마' },
  { id: 'buzzed', name: '짧은 머리' },
  { id: 'long', name: '긴 머리' },
  { id: 'buns', name: '올림머리' },
  { id: 'buzzedFemale', name: '숏컷' },
  { id: 'none', name: '민머리' },
]

export const OUTFITS: { id: OutfitId; name: string }[] = [
  { id: 'peasant', name: '농부' },
  { id: 'ranger', name: '레인저' },
]

/** 피부 견본 (밝게 만든 피부 텍스처에 곱한다) */
export const SKIN_COLORS = ['#ffe3cc', '#f7cfae', '#eab892', '#d9a274', '#c08457', '#9a6440', '#70462c', '#4a2f1f']
export const HAIR_COLORS = ['#1c1c1c', '#4a3020', '#7a4b2a', '#b07a45', '#e2c27c', '#bdbdbd', '#f4f4f4', '#b23a3a', '#d77fae', '#3d6fd6']

export const HEIGHT_RANGE: [number, number] = [0.75, 1.3]

export const BODY_PARTS: BodyPart[] = ['head', 'shoulders', 'chest', 'belly', 'armThickness', 'armLength', 'legThickness', 'legLength']

export const BODY_RANGES: Record<BodyPart, [number, number]> = {
  head: [0.7, 1.6],
  shoulders: [0.7, 1.5],
  chest: [0.7, 1.6],
  belly: [0.7, 1.8],
  armThickness: [0.6, 1.8],
  armLength: [0.8, 1.3],
  legThickness: [0.6, 1.8],
  legLength: [0.8, 1.3],
}

export const BODY_PART_LABEL: Record<BodyPart, string> = {
  head: '머리 크기',
  shoulders: '어깨 너비',
  chest: '가슴·등 두께',
  belly: '배',
  armThickness: '팔 굵기',
  armLength: '팔 길이',
  legThickness: '다리 굵기',
  legLength: '다리 길이',
}

export const DEFAULT_BODY: Record<BodyPart, number> = {
  head: 1, shoulders: 1, chest: 1, belly: 1, armThickness: 1, armLength: 1, legThickness: 1, legLength: 1,
}

/** 기본 꾸밈. 첫 번째가 처음 시작할 때의 모습 */
export const LOOK_PRESETS: { id: string; name: string; look: CharacterLook }[] = [
  {
    id: 'grandpa',
    name: '어부 할아버지',
    look: { gender: 'male', skinColor: '#eab892', hair: 'simpleParted', hairColor: '#bdbdbd', beard: true, top: 'peasant', bottom: 'peasant', shoes: 'peasant', hood: false, outfitColor: 'base', height: 1, body: DEFAULT_BODY },
  },
  {
    id: 'lady',
    name: '어부 아가씨',
    look: { gender: 'female', skinColor: '#f7cfae', hair: 'buns', hairColor: '#7a4b2a', beard: false, top: 'peasant', bottom: 'peasant', shoes: 'peasant', hood: false, outfitColor: 'alt', height: 1, body: DEFAULT_BODY },
  },
  {
    id: 'rangerMale',
    name: '레인저 (남)',
    look: { gender: 'male', skinColor: '#c08457', hair: 'buzzed', hairColor: '#1c1c1c', beard: false, top: 'ranger', bottom: 'ranger', shoes: 'ranger', hood: true, outfitColor: 'base', height: 1.05, body: DEFAULT_BODY },
  },
  {
    id: 'rangerFemale',
    name: '레인저 (여)',
    look: { gender: 'female', skinColor: '#d9a274', hair: 'long', hairColor: '#e2c27c', beard: false, top: 'ranger', bottom: 'ranger', shoes: 'ranger', hood: false, outfitColor: 'alt', height: 1, body: DEFAULT_BODY },
  },
]

export const DEFAULT_LOOK: CharacterLook = LOOK_PRESETS[0].look

/** 생김새 → glb 노드 이름 (tools/build-characters 가 붙인 이름) */
export const PART_NODES = {
  hair: {
    simpleParted: 'hair_simpleParted',
    buzzed: 'hair_buzzed',
    long: 'hair_long',
    buns: 'hair_buns',
    buzzedFemale: 'hair_buzzedFemale',
  } satisfies Record<Exclude<HairId, 'none'>, string>,
  beard: 'beard',
  top: {
    peasant: ['peasant_arms', 'peasant_body'],
    ranger: ['ranger_arms', 'ranger_bracer', 'ranger_body', 'ranger_belt1', 'ranger_belt2', 'ranger_pauldron'],
  } satisfies Record<OutfitId, string[]>,
  bottom: { peasant: ['peasant_legs'], ranger: ['ranger_legs'] } satisfies Record<OutfitId, string[]>,
  shoes: { peasant: ['peasant_feet'], ranger: ['ranger_feet'] } satisfies Record<OutfitId, string[]>,
  hood: 'ranger_hood',
}

/** 늘 보이는 부위 */
export const ALWAYS_VISIBLE_NODES = ['head', 'eyes', 'eyebrows']
