/**
 * 은지 게임 식재료·요리·배합법 (은지 `src/meadow/vendor/items.js` 값을 그대로 옮긴 것. 같은지 meadowItems.test 가 본다).
 * 서버(3-3 전리품)와 같이 하기 메시지(먹는 요리)도 쓰므로 은지 JS 가 아닌 TS 데이터로 둔다
 */

export type RawItemId = 'beef' | 'pork' | 'boar' | 'venison' | 'rabbit' | 'foxmeat' | 'chicken' | 'egg' | 'bone' | 'fat' | 'pumpkin' | 'mushroom'
export type MeadowDishId =
  | 'roast'
  | 'skewer'
  | 'steak'
  | 'porkbelly'
  | 'boarstew'
  | 'venisonstew'
  | 'rabbitbraise'
  | 'chickensoup'
  | 'bonebroth'
  | 'pumpkinsoup'
  | 'mushroomfry'
  | 'friedegg'
  | 'omelet'
/** 가방에 들어가는 은지 물건 25종 (재료 12 + 요리 13. 스펙의 "22종" 은 잘못 센 수) */
export type ItemId = RawItemId | MeadowDishId
export type ItemTag = 'meat' | 'dish'

export type ItemDef = {
  name: string
  /** 그림 대신 쓰는 이모지 (은지 그대로) */
  icon: string
  tags: ItemTag[]
  /** 요리만: 포만감 2~6. 먹으면 배고픔 sate × 8, 체력 sate × 2 */
  sate?: number
  desc: string
}

export const ITEMS: Record<ItemId, ItemDef> = {
  beef: { name: '소고기', icon: '🥩', tags: ['meat'], desc: '소에서 2개. 스테이크·꼬치의 재료' },
  pork: { name: '돼지고기', icon: '🥓', tags: ['meat'], desc: '돼지에서 2개. 삼겹살 구이' },
  boar: { name: '멧돼지고기', icon: '🍖', tags: ['meat'], desc: '멧돼지에서 2개. 스튜에 어울린다' },
  venison: { name: '사슴고기', icon: '🦌', tags: ['meat'], desc: '사슴에서 2개. 담백해서 스튜·꼬치' },
  rabbit: { name: '토끼고기', icon: '🐇', tags: ['meat'], desc: '토끼에서 1개. 조림' },
  foxmeat: { name: '여우고기', icon: '🦊', tags: ['meat'], desc: '여우에서 1개. 구이' },
  chicken: { name: '닭고기', icon: '🍗', tags: ['meat'], desc: '병아리에서 1개. 수프' },
  egg: { name: '달걀', icon: '🥚', tags: [], desc: '병아리가 가끔 떨어뜨린다. 프라이·오믈렛' },
  bone: { name: '뼈', icon: '🦴', tags: [], desc: '소·멧돼지·사슴에서. 사골 국물' },
  fat: { name: '비계', icon: '🧈', tags: [], desc: '돼지·멧돼지에서. 스테이크에 풍미를' },
  pumpkin: { name: '호박', icon: '🎃', tags: [], desc: '주방 뒤 텃밭. 90초 뒤 다시 자란다' },
  mushroom: { name: '버섯', icon: '🍄', tags: [], desc: '울타리 밖 숲 바닥. 2분 뒤 다시 자란다' },
  roast: { name: '구운 고기', icon: '🍖', tags: ['dish'], sate: 2, desc: '아무 고기나 구운 것' },
  skewer: { name: '꼬치구이', icon: '🍢', tags: ['dish'], sate: 4, desc: '고기와 버섯을 꿰어 구웠다' },
  steak: { name: '스테이크', icon: '🥩', tags: ['dish'], sate: 5, desc: '소고기를 비계로 구운 것' },
  porkbelly: { name: '삼겹살 구이', icon: '🥓', tags: ['dish'], sate: 4, desc: '돼지고기 두 덩이' },
  boarstew: { name: '멧돼지 스튜', icon: '🍲', tags: ['dish'], sate: 6, desc: '멧돼지고기·호박·버섯' },
  venisonstew: { name: '사슴 스튜', icon: '🍲', tags: ['dish'], sate: 5, desc: '사슴고기와 버섯' },
  rabbitbraise: { name: '토끼 조림', icon: '🥘', tags: ['dish'], sate: 4, desc: '토끼고기와 호박' },
  chickensoup: { name: '닭고기 수프', icon: '🍜', tags: ['dish'], sate: 6, desc: '닭고기·달걀·뼈' },
  bonebroth: { name: '사골 국물', icon: '🍵', tags: ['dish'], sate: 3, desc: '뼈 두 개를 오래 끓인 것' },
  pumpkinsoup: { name: '호박죽', icon: '🥣', tags: ['dish'], sate: 3, desc: '호박 두 개' },
  mushroomfry: { name: '버섯 볶음', icon: '🍄', tags: ['dish'], sate: 3, desc: '버섯 세 개' },
  friedegg: { name: '달걀 프라이', icon: '🍳', tags: ['dish'], sate: 2, desc: '달걀 하나' },
  omelet: { name: '호박 오믈렛', icon: '🍳', tags: ['dish'], sate: 5, desc: '달걀 두 개와 호박' },
}

/** 사전 순서 (가방·상점 카드 순서) */
export const ITEM_IDS = Object.keys(ITEMS) as ItemId[]
export const MEADOW_DISH_IDS = ITEM_IDS.filter((id) => ITEMS[id].tags.includes('dish')) as MeadowDishId[]

export const TAGS: Record<ItemTag, { name: string; icon: string }> = { meat: { name: '아무 고기', icon: '🥩' }, dish: { name: '요리', icon: '🍽️' } }

/** 배합법 재료 한 줄: 정해진 물건 n 개 또는 태그(아무 고기) n 개 */
export type Ingredient = { id: ItemId; n: number } | { tag: ItemTag; n: number }
export type Recipe = { id: MeadowDishId; name: string; /** 요리 시간(초) */ time: number; ingredients: Ingredient[]; result: MeadowDishId }

export const RECIPES: Recipe[] = [
  { id: 'roast', name: '구운 고기', time: 2.5, ingredients: [{ tag: 'meat', n: 1 }], result: 'roast' },
  { id: 'friedegg', name: '달걀 프라이', time: 2, ingredients: [{ id: 'egg', n: 1 }], result: 'friedegg' },
  { id: 'skewer', name: '꼬치구이', time: 3, ingredients: [{ tag: 'meat', n: 2 }, { id: 'mushroom', n: 1 }], result: 'skewer' },
  { id: 'steak', name: '스테이크', time: 4, ingredients: [{ id: 'beef', n: 1 }, { id: 'fat', n: 1 }], result: 'steak' },
  { id: 'porkbelly', name: '삼겹살 구이', time: 3.5, ingredients: [{ id: 'pork', n: 2 }], result: 'porkbelly' },
  { id: 'mushroomfry', name: '버섯 볶음', time: 2.5, ingredients: [{ id: 'mushroom', n: 3 }], result: 'mushroomfry' },
  { id: 'pumpkinsoup', name: '호박죽', time: 4, ingredients: [{ id: 'pumpkin', n: 2 }], result: 'pumpkinsoup' },
  { id: 'omelet', name: '호박 오믈렛', time: 3.5, ingredients: [{ id: 'egg', n: 2 }, { id: 'pumpkin', n: 1 }], result: 'omelet' },
  { id: 'bonebroth', name: '사골 국물', time: 6, ingredients: [{ id: 'bone', n: 2 }], result: 'bonebroth' },
  { id: 'rabbitbraise', name: '토끼 조림', time: 4, ingredients: [{ id: 'rabbit', n: 1 }, { id: 'pumpkin', n: 1 }], result: 'rabbitbraise' },
  { id: 'venisonstew', name: '사슴 스튜', time: 5, ingredients: [{ id: 'venison', n: 1 }, { id: 'mushroom', n: 2 }], result: 'venisonstew' },
  { id: 'boarstew', name: '멧돼지 스튜', time: 6, ingredients: [{ id: 'boar', n: 1 }, { id: 'pumpkin', n: 1 }, { id: 'mushroom', n: 1 }], result: 'boarstew' },
  { id: 'chickensoup', name: '닭고기 수프', time: 5, ingredients: [{ id: 'chicken', n: 1 }, { id: 'egg', n: 1 }, { id: 'bone', n: 1 }], result: 'chickensoup' },
]

export function getRecipe(id: MeadowDishId): Recipe {
  const r = RECIPES.find((x) => x.id === id)
  if (!r) throw new Error(`알 수 없는 배합법: ${id}`)
  return r
}

export const hasTag = (id: ItemId, tag: ItemTag): boolean => ITEMS[id].tags.includes(tag)
export const isMeadowDish = (id: string): id is MeadowDishId => (MEADOW_DISH_IDS as string[]).includes(id)
