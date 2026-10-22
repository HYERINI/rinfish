import { useEffect } from 'react'
import { canZoom } from '../logic/cameraZoom'
import type { FishingInput } from '../logic/fishingSession'
import { gestureStep, type Point } from '../logic/touchUi'
import { useSessionStore } from '../stores/sessionStore'

/**
 * 지금 누르고 있는 게임 포인터들 (마우스·손가락마다 pointerId 로 따로 센다).
 * - canvas: 캔버스 위를 누른 포인터. 낚시 입력이자, 탐험 중 한 손가락은 시점 돌리기·두 손가락은 확대·축소
 * - button: 터치 낚시 버튼(던지기·감기)을 누른 포인터. 낚시 입력만
 * 조이스틱·다른 버튼을 누른 손가락은 여기 들어오지 않아서 같이 눌러도 시점이 돌지 않는다
 */
const canvasPointers = new Map<number, Point>()
const buttonPointers = new Set<number>()
/** 이번에 새로 눌렀는지 (챔질). 낚시가 매 프레임 가져가며 비운다 */
let pressed = false
/** 한 손가락(또는 마우스) 드래그로 쌓인 가로 이동(px). Player 가 매 프레임 가져가며 비운다 */
let dragX = 0

type PointerLike = { button: number; pointerId: number; clientX: number; clientY: number }

/** 캔버스 영역에서 눌렀을 때 호출 (UI 버튼 클릭은 여기로 오지 않는다) */
export function pressPointer(e: PointerLike) {
  // 우클릭·휠 클릭은 입력으로 보지 않는다 (컨텍스트 메뉴가 pointerup을 삼켜 입력이 고착될 수 있다)
  if (e.button !== 0) return
  canvasPointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  pressed = true
}

/** 터치 낚시 버튼을 눌렀을 때. 캔버스를 누른 것과 똑같이 낚시 입력이 된다 (떼는 건 창 전체 pointerup 이 처리) */
export function pressFishingButton(pointerId: number) {
  buttonPointers.add(pointerId)
  pressed = true
}

/** 낚시 입력(누르고 있음): 캔버스나 터치 낚시 버튼을 누르고 있다 */
export function isPointerDown(): boolean {
  return canvasPointers.size > 0 || buttonPointers.size > 0
}

/** 현재 입력을 읽고 '이번에 새로 눌림' 신호를 비운다. 매 프레임 한 번만 호출 */
export function readPointer(): FishingInput {
  const input = { pointerDown: isPointerDown(), pressed }
  pressed = false
  return input
}

/** 쌓인 드래그(px)를 가져가고 비운다 */
export function takeDragX(): number {
  const dx = dragX
  dragX = 0
  return dx
}

function releaseAll() {
  canvasPointers.clear()
  buttonPointers.clear()
  dragX = 0
}

/** 포인터를 떼거나 움직일 때를 창 전체에서 듣는다: 떼면 그 포인터만 빼고, 움직이면 드래그·두 손가락 확대를 계산한다 */
export function usePointerTracking() {
  useEffect(() => {
    const release = (e: PointerEvent) => {
      canvasPointers.delete(e.pointerId)
      buttonPointers.delete(e.pointerId)
    }
    const move = (e: PointerEvent) => {
      if (!canvasPointers.has(e.pointerId)) return
      const to = { x: e.clientX, y: e.clientY }
      const step = gestureStep(canvasPointers, e.pointerId, to)
      canvasPointers.set(e.pointerId, to)
      dragX += step.dx
      if (step.pinch) {
        const session = useSessionStore.getState()
        if (canZoom(session.mode)) session.pinchZoom(step.pinch.prevSpan, step.pinch.span)
      }
    }
    window.addEventListener('pointerup', release)
    window.addEventListener('pointercancel', release)
    window.addEventListener('pointermove', move)
    window.addEventListener('blur', releaseAll)
    return () => {
      window.removeEventListener('pointerup', release)
      window.removeEventListener('pointercancel', release)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('blur', releaseAll)
      releaseAll()
    }
  }, [])
}
