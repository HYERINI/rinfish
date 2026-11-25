import { GUN_IDS, type GunId } from './guns'

/** 손에 드는 도구: 낚싯대·주먹·칼 (3-2·3-3), 총 4종 (3-4), 곡괭이 (광산) */
export type ToolId = 'rod' | 'fists' | 'knife' | GunId | 'pickaxe'

/** short: 도구 칸에 적는 짧은 이름 (총은 모양이 같은 그림이라 이름으로 가른다) */
export const TOOLS: { id: ToolId; name: string; icon: string; short?: string }[] = [
  { id: 'rod', name: '낚싯대', icon: '🎣' },
  { id: 'fists', name: '주먹', icon: '✊' },
  { id: 'knife', name: '칼', icon: '🔪' },
  { id: 'pistol', name: '권총', icon: '🔫', short: '권총' },
  { id: 'rifle', name: '소총', icon: '🔫', short: '소총' },
  { id: 'shotgun', name: '산탄총', icon: '🔫', short: '산탄' },
  { id: 'sniper', name: '저격총', icon: '🔫', short: '저격' },
  { id: 'pickaxe', name: '곡괭이', icon: '⛏️' },
]
export const TOOL_IDS: ToolId[] = TOOLS.map((t) => t.id)
export const toolDef = (id: ToolId) => TOOLS.find((t) => t.id === id)!

/** 도구 칸 9개 (숫자 키 1~9). 1 = 낚싯대, 2 = 주먹, 3 = 칼, 4 = 권총, 5 = 소총, 6 = 산탄총, 7 = 저격총, 8 = 곡괭이 */
export const HOTBAR: (ToolId | null)[] = ['rod', 'fists', 'knife', ...GUN_IDS, 'pickaxe', null]

/** 숫자 키(e.code) → 칸 번호 (0부터). 숫자 키가 아니면 null */
export function hotbarSlot(code: string): number | null {
  const m = /^Digit([1-9])$/.exec(code)
  return m ? Number(m[1]) - 1 : null
}

/**
 * 폰 도구 칸: 좁아서 총은 한 칸만 (지금 든 총, 아니면 마지막에 든 총). 총끼리는 무기 바꾸기 버튼(⇄)으로 넘긴다. 곡괭이는 맨 끝
 */
export function touchHotbar(lastGun: GunId): ToolId[] {
  return ['rod', 'fists', 'knife', lastGun, 'pickaxe']
}

/** 폰 무기 바꾸기(⇄): 주먹 → 칼 → 권총 → 소총 → 산탄총 → 저격총 → 주먹 (은지 CYCLE 처럼 돈다. 낚싯대·빈손은 건너뛴다) */
export function nextWeapon(tool: ToolId | null): ToolId {
  const cycle: ToolId[] = ['fists', 'knife', ...GUN_IDS]
  const i = tool ? cycle.indexOf(tool) : -1
  return cycle[(i + 1) % cycle.length]
}
