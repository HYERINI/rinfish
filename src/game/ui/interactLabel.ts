import { MARKET } from '../data/market'
import type { Interactable } from '../logic/interaction'

const LABEL: Record<Exclude<Interactable['kind'], 'zoneGate'>, string> = {
  fishingSpot: '낚시하기',
  sellBox: '물고기 팔기',
  gearShop: '장비 상점',
  market: MARKET.name,
  bench: '앉아서 쉬기',
  aquarium: '어항 (관리 · 크게 보기)',
  wardrobe: '옷장 (꾸미기)',
}

const GATE_LABEL: Record<string, string> = {
  pond: '무너진 다리 살펴보기',
  reef: '부서진 보트 살펴보기',
  cave: '바위 살펴보기',
}

/** 가까이 있는 대상에 할 수 있는 일 (E 안내·터치 상호작용 버튼 글씨) */
export function interactLabel(target: Interactable): string {
  return target.kind === 'zoneGate' ? (GATE_LABEL[target.zoneId] ?? '살펴보기') : LABEL[target.kind]
}
