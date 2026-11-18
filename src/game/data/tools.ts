/** 손에 드는 도구. 3-2 에서는 낚싯대·주먹·칼 (휘두르기는 3-3, 총 4~7 칸은 3-4) */
export type ToolId = 'rod' | 'fists' | 'knife'

export const TOOLS: { id: ToolId; name: string; icon: string }[] = [
  { id: 'rod', name: '낚싯대', icon: '🎣' },
  { id: 'fists', name: '주먹', icon: '✊' },
  { id: 'knife', name: '칼', icon: '🔪' },
]
export const TOOL_IDS: ToolId[] = TOOLS.map((t) => t.id)

/** 도구 칸 9개 (숫자 키 1~9). 1 = 낚싯대, 2 = 주먹, 3 = 칼, 4~7 = 총 (3-4 에서 채운다) */
export const HOTBAR: (ToolId | null)[] = ['rod', 'fists', 'knife', null, null, null, null, null, null]

/** 숫자 키(e.code) → 칸 번호 (0부터). 숫자 키가 아니면 null */
export function hotbarSlot(code: string): number | null {
  const m = /^Digit([1-9])$/.exec(code)
  return m ? Number(m[1]) - 1 : null
}
