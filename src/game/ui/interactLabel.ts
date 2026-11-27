import { MEADOW_DOORS, MEADOW_VENDORS } from '../data/meadow'
import { MARKET } from '../data/market'
import { ITEMS } from '../data/meadowItems'
import { ORE_NODES } from '../data/mine'
import type { Interactable } from '../logic/interaction'

const LABEL: Record<Exclude<Interactable['kind'], 'zoneGate' | 'dock' | 'pickup' | 'door' | 'vendor' | 'loot' | 'ore' | 'mineWall'>, string> = {
  fishingSpot: '낚시하기',
  sellBox: '물고기 팔기',
  gearShop: '장비 상점',
  market: MARKET.name,
  bench: '앉아서 쉬기',
  aquarium: '어항 (관리 · 크게 보기)',
  wardrobe: '옷장 (꾸미기)',
  bed: '🛏️ 잠자기',
  stove: '🍳 요리하기 (요리법 보기)',
  rack: '🔫 무기 고르기',
  mineEntrance: '⛏️ 광산 들어가기',
  mineExit: '🪜 밖으로 나가기',
}

const GATE_LABEL: Record<string, string> = {
  pond: '무너진 다리 살펴보기',
  reef: '부서진 보트 살펴보기',
  cave: '바위 살펴보기',
}

/** 가까이 있는 대상에 할 수 있는 일 (E 안내·터치 상호작용 버튼 글씨) */
export function interactLabel(target: Interactable): string {
  if (target.kind === 'zoneGate') return GATE_LABEL[target.zoneId] ?? '살펴보기'
  if (target.kind === 'vendor') {
    const v = MEADOW_VENDORS.find((x) => x.id === target.id)
    return `🛒 ${v?.name} — ${v?.greet}`
  }
  if (target.kind === 'door') return `🚪 ${MEADOW_DOORS[target.index] ?? '문'} 여닫기`
  if (target.kind === 'pickup') return `${ITEMS[target.item].icon} ${ITEMS[target.item].name} 따기`
  if (target.kind === 'loot') return `${ITEMS[target.item].icon} ${ITEMS[target.item].name} 줍기`
  if (target.kind === 'ore') {
    const ore = ORE_NODES[target.index]?.ore
    return ore ? `⛏️ ${ITEMS[ore].name} 캐기` : '⛏️ 캐기'
  }
  if (target.kind === 'mineWall') return '⛏️ 금 간 벽 부수기'
  if (target.kind === 'dock') return target.dir === 'toIsland' ? '⛵ 배 타기 (섬으로)' : '⛵ 배 타기 (초원으로)'
  return LABEL[target.kind]
}
