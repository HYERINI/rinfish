import { FISH_MODEL_FILES, type FishModelId } from '../../data/fishLooks'

/** 물고기 모델 파일 주소. 어종 → 모델은 data/fishLooks 의 fishLookFor 로 찾는다 */
export const fishModelUrl = (model: FishModelId) => `${import.meta.env.BASE_URL}models/${FISH_MODEL_FILES[model]}`
