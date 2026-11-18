/** 은지 아이템 사전 (우리 TS 복사본 data/meadowItems.ts 와 같은지 테스트에서만 비교한다) */
export const ITEMS: Record<string, { name: string; icon: string; tags: string[]; sate?: number; desc: string }>
export const RECIPES: { id: string; name: string; time: number; ingredients: ({ id: string; n: number } | { tag: string; n: number })[]; result: string }[]
export function hasTag(id: string, tag: string): boolean
