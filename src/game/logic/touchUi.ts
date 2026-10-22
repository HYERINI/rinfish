/**
 * 터치 조작 화면(조이스틱·버튼)을 보일까. 처음엔 기기가 손가락 포인터(coarse)인지로 정하고, 그 뒤엔 마지막으로 쓴 입력을 따른다:
 * 화면을 손가락으로 누르면 켜고, 마우스로 누르면 끈다. 단 손가락 기기에서는 마우스를 써도 끄지 않는다
 */
export function nextTouchUi(current: boolean, pointerType: string, coarse: boolean): boolean {
  if (pointerType === 'touch') return true
  if (pointerType === 'mouse' && !coarse) return false
  return current
}

export type Point = { x: number; y: number }

/**
 * 캔버스를 누르고 있는 손가락(포인터)들 중 하나가 움직였을 때 무엇을 할지.
 * 하나만 누르고 있으면 그만큼 시점 돌리기(dx 좌우, dy 위아래), 둘 이상이면 처음 두 손가락 사이 거리로 확대·축소(pinch).
 * points: 움직이기 전 위치들 (누른 순서), id: 움직인 포인터, to: 새 위치
 */
export function gestureStep(points: Map<number, Point>, id: number, to: Point): { dx: number; dy: number; pinch: { prevSpan: number; span: number } | null } {
  const from = points.get(id)
  if (!from) return { dx: 0, dy: 0, pinch: null }
  if (points.size === 1) return { dx: to.x - from.x, dy: to.y - from.y, pinch: null }
  const ids = [...points.keys()].slice(0, 2)
  if (!ids.includes(id)) return { dx: 0, dy: 0, pinch: null }
  const other = points.get(ids[0] === id ? ids[1] : ids[0])!
  return {
    dx: 0,
    dy: 0,
    pinch: { prevSpan: Math.hypot(from.x - other.x, from.y - other.y), span: Math.hypot(to.x - other.x, to.y - other.y) },
  }
}
