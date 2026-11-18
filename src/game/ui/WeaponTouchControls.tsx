import { useEffect, useRef, useState } from 'react'
import { GUNS, isGun, type GunId } from '../data/guns'
import { nextWeapon } from '../data/tools'
import { gunRig } from '../guns/gunRig'
import { addLookDrag, holdTrigger, isTouchAim, pressAttack, setTouchAim } from '../input/pointer'
import { runKeyAction } from '../input/useInteractionKeys'
import { reloadProgress } from '../logic/gun'
import { nextTouchAim } from '../logic/view'
import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'
import { TapButton } from './TapButton'

/**
 * 폰 쏘기 (은지 touch.js tFire): 누르는 순간 한 발, 누르고 있으면 연사, 누른 채 끌면 시점이 돈다 (손가락이 버튼 밖으로 나가도).
 * 탄창/예비와 장전 중을 버튼에 적는다
 */
export function FireButton() {
  const tool = useSessionStore((s) => s.tool)
  const mag = useProgressStore((s) => (isGun(tool) ? s.ammo[tool] : 0))
  const reserve = useProgressStore((s) => (isGun(tool) ? s.reserve[tool] : 0))
  const [held, setHeld] = useState(false)
  const [reloading, setReloading] = useState(false)
  const last = useRef<{ id: number; x: number; y: number } | null>(null)
  useEffect(() => {
    const id = setInterval(() => setReloading(reloadProgress(gunRig, performance.now() / 1000) >= 0), 150)
    return () => clearInterval(id)
  }, [])
  // 누른 채 버튼이 사라지면(쓰러짐·창 열림·무기 바꿈) 손을 뗀 이벤트가 오지 않는다: 방아쇠를 놓는다
  useEffect(() => () => holdTrigger(false), [])
  const release = () => {
    last.current = null
    holdTrigger(false)
    setHeld(false)
  }
  return (
    <button
      className={`tc-btn tc-fire${held ? ' on' : ''}`}
      aria-label="쏘기"
      onPointerDown={(e) => {
        e.preventDefault()
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          // 진짜 손가락이 아닌 이벤트(헤드리스 점검)는 붙잡을 수 없다
        }
        last.current = { id: e.pointerId, x: e.clientX, y: e.clientY }
        pressAttack('primary')
        holdTrigger(true)
        setHeld(true)
      }}
      onPointerMove={(e) => {
        const l = last.current
        if (!l || l.id !== e.pointerId) return
        addLookDrag(e.clientX - l.x, e.clientY - l.y)
        last.current = { id: l.id, x: e.clientX, y: e.clientY }
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >
      <span style={{ fontSize: 24, lineHeight: 1 }}>🔫</span>
      <span style={{ fontSize: 12 }}>{reloading ? '장전 중' : `${mag} / ${reserve}`}</span>
    </button>
  )
}

/** 폰 조준 (은지 tAim 토글): 누를 때마다 조준 → 조준경 총은 다음 배율 → 끄기. 총을 바꾸면 새로 그린다 (key) */
export function AimButton({ gun }: { gun: GunId }) {
  const [on, setOn] = useState(false)
  // 새 총을 들거나 이 버튼이 사라지면 조준을 끈다
  useEffect(() => {
    setTouchAim(false)
    return () => setTouchAim(false)
  }, [])
  const zoom = GUNS[gun].zoom
  const label = on && zoom ? zoom[gunRig.zoomStep[gun]].label : '조준'
  return (
    <TapButton
      className={`tc-btn tc-small${on ? ' on' : ''}`}
      ariaLabel="조준"
      onTap={() => {
        const next = nextTouchAim(isTouchAim(), gunRig.zoomStep[gun], zoom?.length ?? 0)
        gunRig.zoomStep[gun] = next.step
        setTouchAim(next.aiming)
        setOn(next.aiming)
      }}
    >
      <span style={{ fontSize: 22, lineHeight: 1 }}>⌖</span>
      <span style={{ fontSize: 11 }}>{label}</span>
    </TapButton>
  )
}

/** 폰 장전 (R 과 같다) */
export function ReloadButton() {
  return (
    <TapButton className="tc-btn tc-small" ariaLabel="장전" onTap={() => runKeyAction('KeyR')}>
      <span style={{ fontSize: 20, lineHeight: 1, fontWeight: 900 }}>R</span>
      <span style={{ fontSize: 11 }}>장전</span>
    </TapButton>
  )
}

/** 폰 무기 바꾸기 (은지 tWeapon): 주먹 → 칼 → 권총 → 소총 → 산탄총 → 저격총 → 주먹 */
export function CycleButton() {
  return (
    <TapButton
      className="tc-btn tc-small"
      ariaLabel="무기 바꾸기"
      onTap={() => {
        const session = useSessionStore.getState()
        session.equip(nextWeapon(session.tool))
      }}
    >
      <span style={{ fontSize: 22, lineHeight: 1 }}>⇄</span>
      <span style={{ fontSize: 11 }}>무기</span>
    </TapButton>
  )
}

/** 폰 칼: 베기 (크게, 마우스 왼쪽) · 찌르기 (마우스 오른쪽, 3-3 이 미룬 버튼). 누르는 순간 바로 */
export function KnifeButton({ stab }: { stab?: boolean }) {
  return (
    <button
      className={stab ? 'tc-btn tc-small' : 'tc-btn tc-fire'}
      aria-label={stab ? '찌르기' : '휘두르기'}
      onPointerDown={(e) => {
        e.preventDefault()
        pressAttack(stab ? 'secondary' : 'primary')
      }}
    >
      <span style={{ fontSize: stab ? 20 : 24, lineHeight: 1 }}>{stab ? '🗡️' : '🔪'}</span>
      <span style={{ fontSize: stab ? 11 : 12 }}>{stab ? '찌르기' : '베기'}</span>
    </button>
  )
}
