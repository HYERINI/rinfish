import { HOTBAR, type ToolId } from '../data/tools'

/** 휠로 도구 바꾸기: 이만큼(deltaY) 모이면 한 칸, 한 칸 넘긴 뒤 이 시간(초)은 더 넘기지 않고, 이만큼 쉬면 모은 값을 버린다 */
export const WHEEL_TOOL = { threshold: 40, cooldown: 0.12, reset: 0.4 }

/** 도구 칸 순서 (빈 칸은 뺀다) */
const ORDER = HOTBAR.filter((t): t is ToolId => t !== null)

/** 휠 한 칸 → 다음 도구. dir > 0 (아래로 굴림) = 다음 칸, < 0 = 이전 칸. 끝에서 처음으로 돈다. 빈손이면 첫 칸·마지막 칸부터 */
export function wheelTool(tool: ToolId | null, dir: number): ToolId {
  const i = tool ? ORDER.indexOf(tool) : -1
  if (i < 0) return dir > 0 ? ORDER[0] : ORDER[ORDER.length - 1]
  return ORDER[(i + (dir > 0 ? 1 : -1) + ORDER.length) % ORDER.length]
}

/** acc: 모은 deltaY, at: 마지막 휠 시각, stepAt: 마지막으로 한 칸 넘긴 시각 (초) */
export type WheelState = { acc: number; at: number; stepAt: number }
export const WHEEL_IDLE: WheelState = { acc: 0, at: -Infinity, stepAt: -Infinity }

/**
 * 휠 입력 하나 → 넘길 칸 (-1·0·1). 마우스 휠은 한 번에 100 쯤 와서 바로 넘기고,
 * 트랙패드는 잘게 여러 번 와서 모아서 넘긴다. 넘긴 직후 잠깐은 관성으로 계속 오는 값을 버린다
 */
export function wheelStep(s: WheelState, deltaY: number, now: number): { state: WheelState; step: -1 | 0 | 1 } {
  if (!Number.isFinite(deltaY) || deltaY === 0) return { state: s, step: 0 }
  if (now - s.stepAt < WHEEL_TOOL.cooldown) return { state: { ...s, acc: 0, at: now }, step: 0 }
  const kept = now - s.at > WHEEL_TOOL.reset || Math.sign(s.acc) !== Math.sign(deltaY) ? 0 : s.acc
  const acc = kept + deltaY
  if (Math.abs(acc) < WHEEL_TOOL.threshold) return { state: { ...s, acc, at: now }, step: 0 }
  return { state: { acc: 0, at: now, stepAt: now }, step: acc > 0 ? 1 : -1 }
}
