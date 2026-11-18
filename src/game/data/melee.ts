import type { ToolId } from './tools'

/** 근접 공격: 주먹, 칼 베기(마우스 왼쪽), 칼 찌르기(마우스 오른쪽) */
export type MeleeId = 'fists' | 'knife' | 'stab'
export const MELEE_IDS: MeleeId[] = ['fists', 'knife', 'stab']

/**
 * 은지 weapons.js 값. dur: 동작 시간(초), hitAt: 맞는 순간 (동작 진행도, 휘두른 뒤 칼이 뻗는 때 판정한다),
 * reach: 사거리(m), cool: 다음 공격까지(초. 주먹 0.45, 칼 rpm 110, 찌르기 0.85), dmg: 동물 피해 (찌르기 2, 나머지 1).
 * serverCool: 같이 하기 서버가 받는 최소 간격(초, 스펙: 주먹 300ms·칼 400ms·찌르기 700ms)
 */
export const MELEE: Record<MeleeId, { name: string; dur: number; hitAt: number; reach: number; cool: number; dmg: number; serverCool: number }> = {
  fists: { name: '주먹', dur: 0.38, hitAt: 0.4, reach: 1.3, cool: 0.45, dmg: 1, serverCool: 0.3 },
  knife: { name: '베기', dur: 0.3, hitAt: 0.42, reach: 1.8, cool: 60 / 110, dmg: 1, serverCool: 0.4 },
  stab: { name: '찌르기', dur: 0.62, hitAt: 0.46, reach: 2.3, cool: 0.85, dmg: 2, serverCool: 0.7 },
}

/** 손에 든 도구와 누른 버튼(secondary = 오른쪽) → 공격. 휘두를 수 없으면 null (낚싯대·빈손, 주먹 오른쪽) */
export function meleeFor(tool: ToolId | null, secondary: boolean): MeleeId | null {
  if (tool === 'fists') return secondary ? null : 'fists'
  if (tool === 'knife') return secondary ? 'stab' : 'knife'
  return null
}

/** 공격 시작부터 맞는 순간까지(초) */
export const hitDelay = (id: MeleeId): number => MELEE[id].dur * MELEE[id].hitAt
