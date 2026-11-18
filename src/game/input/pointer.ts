import { useEffect } from 'react'
import { canZoom } from '../logic/cameraZoom'
import type { FishingInput } from '../logic/fishingSession'
import { gestureStep, type Point } from '../logic/touchUi'
import { useSessionStore } from '../stores/sessionStore'
import { canUseMouseLook, isPointerLocked } from './pointerLock'

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
/** 한 손가락(또는 마우스) 드래그로 쌓인 이동(px). Player 가 매 프레임 가져가며 비운다 */
let dragX = 0
let dragY = 0

/** 휘두르기 입력: primary = 마우스 왼쪽 (베기·주먹), secondary = 오른쪽 (칼 찌르기) */
export type AttackPress = 'primary' | 'secondary'
/** 지난 프레임 뒤로 새로 누른 휘두르기·쏘기. 손에 든 것에 따라 MeleeController 나 GunController 가 매 프레임 가져가며 비운다 */
let attackPress: AttackPress | null = null
/**
 * 총: 누르고 있는 마우스 버튼 (e.buttons 비트: 1 왼쪽 = 방아쇠, 2 오른쪽 = 조준). 캔버스에서 쏘기로 누른 것부터 센다.
 * 마우스 잠금 중엔 창 전체의 pointermove·pointerup 으로 따라간다 (왼쪽을 누른 채 오른쪽을 눌러도 pointerdown 이 오지 않는다)
 */
let mouseButtons = 0
/** 폰: 쏘기 버튼을 누르고 있다 · 조준 버튼을 켰다 */
let touchTrigger = false
let touchAim = false
/** R (장전). GunController 가 가져가며 비운다 */
let reloadPressed = false

type PointerLike = { button: number; pointerId: number; clientX: number; clientY: number; pointerType?: string; buttons?: number }

/**
 * 마우스로 캔버스를 누른 게 휘두르기인가: 왼쪽·오른쪽 버튼, 마우스 잠금 중(잠금을 못 쓰는 환경이면 늘).
 * 잠기기 전 클릭은 시점 잠금용이라 휘두르지 않는다. 손가락은 시점 돌리기라 휘두르지 않는다 (폰은 휘두르기 버튼)
 */
export function attackFromPointer(e: Pick<PointerLike, 'button' | 'pointerType'>, locked: boolean, mouseLook: boolean): AttackPress | null {
  if (e.pointerType !== 'mouse' || (mouseLook && !locked)) return null
  if (e.button === 0) return 'primary'
  if (e.button === 2) return 'secondary'
  return null
}

/** 휘두르기 버튼 (폰) */
export function pressAttack(kind: AttackPress = 'primary') {
  attackPress = kind
}

/** 새로 누른 휘두르기를 가져가고 비운다 */
export function takeAttackPress(): AttackPress | null {
  const a = attackPress
  attackPress = null
  return a
}

/** 마우스로 쏠 수 있는 때: 잠금 중 (잠금을 못 쓰는 환경이면 늘) */
const mouseAims = () => isPointerLocked() || !canUseMouseLook()

/** 방아쇠를 당기고 있다 (연사 총은 누르고 있는 동안 계속 쏜다) */
export function isTriggerHeld(): boolean {
  return ((mouseButtons & 1) !== 0 && mouseAims()) || touchTrigger
}

/** 조준 중 (마우스 오른쪽을 누르고 있거나 폰 조준 버튼을 켰다) */
export function isAimHeld(): boolean {
  return ((mouseButtons & 2) !== 0 && mouseAims()) || touchAim
}

/** 폰 쏘기 버튼: 누를 때 한 발(pressAttack) + 누르고 있는 동안 연사 */
export function holdTrigger(on: boolean) {
  touchTrigger = on
}

/** 폰 조준 버튼 (누를 때마다 켜고 끈다) */
export function setTouchAim(on: boolean) {
  touchAim = on
}

export function isTouchAim(): boolean {
  return touchAim
}

/** 폰 쏘기 버튼을 누른 채 끈 만큼 시점을 돌린다 (은지 touch.js 쏘기 버튼 drag). 캔버스를 끈 것과 같은 드래그로 쌓는다 */
export function addLookDrag(dx: number, dy: number) {
  dragX += dx
  dragY += dy
}

/** R: 장전 */
export function pressReload() {
  reloadPressed = true
}

export function takeReloadPress(): boolean {
  const r = reloadPressed
  reloadPressed = false
  return r
}

/** 누른 버튼 비트 (e.buttons 가 없으면 누른 버튼 하나로) */
const buttonsOf = (e: PointerLike) => e.buttons ?? (e.button === 0 ? 1 : e.button === 2 ? 2 : 0)

/** 캔버스 영역에서 눌렀을 때 호출 (UI 버튼 클릭은 여기로 오지 않는다) */
export function pressPointer(e: PointerLike) {
  const attack = attackFromPointer(e, isPointerLocked(), canUseMouseLook())
  if (attack) mouseButtons = buttonsOf(e)
  attackPress = attack ?? attackPress
  // 우클릭·휠 클릭은 낚시 입력으로 보지 않는다 (컨텍스트 메뉴가 pointerup을 삼켜 입력이 고착될 수 있다)
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
export function takeDrag(): { dx: number; dy: number } {
  const d = { dx: dragX, dy: dragY }
  dragX = 0
  dragY = 0
  return d
}

function releaseAll() {
  canvasPointers.clear()
  buttonPointers.clear()
  attackPress = null
  mouseButtons = 0
  touchTrigger = false
  touchAim = false
  reloadPressed = false
  dragX = 0
  dragY = 0
}

/** 포인터를 떼거나 움직일 때를 창 전체에서 듣는다: 떼면 그 포인터만 빼고, 움직이면 드래그·두 손가락 확대를 계산한다 */
export function usePointerTracking() {
  useEffect(() => {
    // 마우스 버튼: 잠금 중엔 그대로 따라가고(왼쪽을 누른 채 오른쪽을 누르는 것도), 아니면 뗀 버튼만 지운다 (UI 를 누른 건 세지 않는다)
    const trackButtons = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      mouseButtons = isPointerLocked() ? e.buttons : mouseButtons & e.buttons
    }
    const release = (e: PointerEvent) => {
      trackButtons(e)
      canvasPointers.delete(e.pointerId)
      buttonPointers.delete(e.pointerId)
    }
    const move = (e: PointerEvent) => {
      trackButtons(e)
      if (!canvasPointers.has(e.pointerId)) return
      const to = { x: e.clientX, y: e.clientY }
      const step = gestureStep(canvasPointers, e.pointerId, to)
      canvasPointers.set(e.pointerId, to)
      dragX += step.dx
      dragY += step.dy
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
