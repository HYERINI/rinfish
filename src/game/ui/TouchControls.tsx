import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { EMOTES } from '../data/emotes'
import { TOUCH } from '../data/touch'
import { resetStick, setStick } from '../input/move'
import { pressFishingButton } from '../input/pointer'
import { useMediaQuery, useTouchUi } from '../input/touchDevice'
import { runKeyAction } from '../input/useInteractionKeys'
import { pressEmote, pressJump } from '../input/usePlayerActionKeys'
import { stickFromDrag, type Stick } from '../logic/joystick'
import { useFishingStore } from '../stores/fishingStore'
import { useSessionStore } from '../stores/sessionStore'
import { interactLabel } from './interactLabel'
import { overlayLayer, touchHint } from './styles'

const { joystick: JOY, buttons: BTN } = TOUCH

/**
 * 휴대폰·태블릿 조작: 왼쪽 아래 조이스틱, 오른쪽 아래 버튼(상호작용·점프·감정 표현, 낚시 중엔 던지기·감기).
 * 손가락마다 따로 받아서 조이스틱을 밀면서 버튼을 누르거나 화면을 끌어 시점을 돌릴 수 있다.
 * 터치 화면을 쓰는 중에만 보인다 (컴퓨터에선 아무것도 그리지 않는다)
 */
export function TouchControls() {
  const touchUi = useTouchUi()
  const mode = useSessionStore((s) => s.mode)
  if (!touchUi) return null
  return (
    <div style={overlayLayer} className="tc">
      <TouchStyle />
      {mode === 'explore' && <ExploreControls />}
      {mode === 'fishing' && <FishingControls />}
      {mode === 'rest' && (
        <div className="tc-right">
          <TapButton className="tc-btn tc-pill" onTap={() => runKeyAction('KeyE')}>
            일어나기
          </TapButton>
        </div>
      )}
    </div>
  )
}

function ExploreControls() {
  const nearby = useSessionStore((s) => s.nearby)
  const [emotesOpen, setEmotesOpen] = useState(false)
  return (
    <>
      <Joystick />
      <div className="tc-right">
        {emotesOpen && (
          <div className="tc-emotes" role="menu" aria-label="감정 표현">
            {EMOTES.map((em) => (
              <TapButton
                key={em.id}
                className="tc-btn tc-emote"
                ariaLabel={em.label}
                onTap={() => {
                  pressEmote(em.id)
                  setEmotesOpen(false)
                }}
              >
                <span style={{ fontSize: 22, lineHeight: 1 }}>{em.icon}</span>
                <span style={{ fontSize: 11 }}>{em.label}</span>
              </TapButton>
            ))}
          </div>
        )}
        {/* 가까이 있는 대상이 있을 때만: E 와 같은 길로 (낚시 시작·가게 열기·구역 문 살펴보기) */}
        {nearby && (
          <TapButton className="tc-btn tc-pill tc-action" onTap={() => runKeyAction('KeyE')}>
            {interactLabel(nearby)}
          </TapButton>
        )}
        <div className="tc-row">
          <TapButton className={`tc-btn tc-small${emotesOpen ? ' on' : ''}`} ariaLabel="감정 표현" onTap={() => setEmotesOpen((o) => !o)}>
            <span style={{ fontSize: 22, lineHeight: 1 }}>😀</span>
            <span style={{ fontSize: 11 }}>표현</span>
          </TapButton>
          {/* 점프는 누르는 순간 바로 */}
          <button
            className="tc-btn tc-jump"
            aria-label="점프"
            onPointerDown={(e) => {
              e.preventDefault()
              pressJump()
            }}
          >
            <span style={{ fontSize: 26, lineHeight: 1 }}>⤒</span>
            <span style={{ fontSize: 12 }}>점프</span>
          </button>
        </div>
      </div>
      {/* 감정 표현 메뉴를 펼치면 안내 글씨와 겹치므로 잠깐 숨긴다 */}
      {!emotesOpen && <TouchHelp />}
    </>
  )
}

/** 조작 안내 (키보드 안내 대신) + 세로 화면이면 가로로 돌려 보라는 안내 */
function TouchHelp() {
  const portrait = useMediaQuery('(orientation: portrait)')
  const [hintGone, setHintGone] = useState(false)
  useEffect(() => {
    if (!portrait || hintGone) return
    const id = setTimeout(() => setHintGone(true), TOUCH.portraitHintMs)
    return () => clearTimeout(id)
  }, [portrait, hintGone])
  return (
    <>
      <div className="tc-help">왼쪽 스틱으로 이동 · 끝까지 밀면 달리기 · 화면을 끌어 시점 회전 · 두 손가락으로 확대·축소</div>
      {portrait && !hintGone && (
        <div style={{ ...touchHint, pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
          <span>📱↻ 가로로 돌리면 더 넓게 볼 수 있어요</span>
          <button className="tc-x" aria-label="안내 닫기" onClick={() => setHintGone(true)}>
            ✕
          </button>
        </div>
      )}
    </>
  )
}

function FishingControls() {
  const stage = useFishingStore((s) => s.state?.stage)
  const biting = useFishingStore((s) => s.state?.stage === 'waiting' && s.state.bite.phase === 'bite')
  return (
    <>
      <TapButton className="tc-btn tc-pill tc-quit" onTap={() => runKeyAction('Escape')}>
        ✕ 그만하기
      </TapButton>
      {stage && stage !== 'done' && (
        <div className="tc-right">
          <FishingButton stage={stage} biting={biting} />
        </div>
      )}
    </>
  )
}

/** 던지기(꾹 눌렀다 떼기)·챔질(누르기)·감기(누르고 있기). 캔버스를 누르는 것과 같은 낚시 입력이다 */
function FishingButton({ stage, biting }: { stage: 'aiming' | 'waiting' | 'fighting'; biting: boolean }) {
  const [held, setHeld] = useState(false)
  const label = stage === 'aiming' ? (held ? '놓으면 던지기' : '던지기') : stage === 'waiting' ? '챔질!' : held ? '감는 중' : '감기'
  const sub = stage === 'aiming' ? (held ? '' : '꾹 눌러 힘 모으기') : stage === 'waiting' ? (biting ? '지금!' : '크게 잠기면') : '떼면 풀기'
  return (
    <button
      className={`tc-btn tc-fish${held ? ' on' : ''}${biting ? ' bite' : ''}`}
      onPointerDown={(e) => {
        e.preventDefault()
        // 손가락이 버튼 밖으로 나가도 뗄 때까지 감는다
        e.currentTarget.setPointerCapture(e.pointerId)
        pressFishingButton(e.pointerId)
        setHeld(true)
      }}
      onPointerUp={() => setHeld(false)}
      onPointerCancel={() => setHeld(false)}
      onLostPointerCapture={() => setHeld(false)}
    >
      <span style={{ fontSize: 19, fontWeight: 800 }}>{label}</span>
      {sub && <span style={{ fontSize: 11, opacity: 0.85 }}>{sub}</span>}
    </button>
  )
}

/**
 * 손가락을 뗄 때 버튼 위면 누른 것으로 친다 (누르는 순간 바로 패널이 열리면, 떼는 손가락이 새로 열린 패널 버튼을 누를 수 있다).
 * 다른 손가락이 조이스틱을 밀고 있어도 따로 받는다
 */
function TapButton({ className, onTap, ariaLabel, children }: { className: string; onTap: () => void; ariaLabel?: string; children: ReactNode }) {
  const down = useRef<number | null>(null)
  return (
    <button
      className={className}
      aria-label={ariaLabel}
      onPointerDown={(e) => {
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        down.current = e.pointerId
      }}
      onPointerUp={(e) => {
        if (down.current !== e.pointerId) return
        down.current = null
        const r = e.currentTarget.getBoundingClientRect()
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) onTap()
      }}
      onPointerCancel={() => (down.current = null)}
      onClick={(e) => {
        // 키보드(Enter·Space)로 누른 경우만. 포인터는 위에서 처리했다
        if (e.detail === 0) onTap()
      }}
    >
      {children}
    </button>
  )
}

/** 왼쪽 아래 가상 조이스틱. 받침 어디를 눌러도 되고, 누른 손가락 하나만 따라간다 */
function Joystick() {
  const base = useRef<HTMLDivElement>(null)
  const active = useRef<number | null>(null)
  const [knob, setKnob] = useState<Stick>({ x: 0, y: 0 })

  // 화면이 바뀌어(낚시·패널) 조이스틱이 사라지면 멈춘다
  useEffect(() => () => resetStick(), [])

  const update = (e: ReactPointerEvent) => {
    const r = base.current!.getBoundingClientRect()
    const stick = stickFromDrag(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2), JOY.radius)
    setStick(stick)
    setKnob(stick)
  }
  const end = (e: ReactPointerEvent) => {
    if (active.current !== e.pointerId) return
    active.current = null
    resetStick()
    setKnob({ x: 0, y: 0 })
  }
  const sprinting = Math.hypot(knob.x, knob.y) >= JOY.sprintAt

  return (
    <div
      className="tc-joy"
      onPointerDown={(e) => {
        if (active.current !== null) return
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        active.current = e.pointerId
        update(e)
      }}
      onPointerMove={(e) => {
        if (active.current === e.pointerId) update(e)
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
    >
      <div ref={base} className="tc-joy-base">
        <div
          className={`tc-joy-knob${sprinting ? ' run' : ''}`}
          style={{ transform: `translate(${knob.x * JOY.radius}px, ${-knob.y * JOY.radius}px)` }}
        />
        {sprinting && <span className="tc-joy-run">달리기</span>}
      </div>
    </div>
  )
}

const px = (n: number) => `${n}px`
const safe = (side: 'top' | 'bottom' | 'left' | 'right', n: number) => `calc(${n}px + env(safe-area-inset-${side}, 0px))`
/** 조이스틱을 누를 수 있는 영역은 받침보다 조금 넓게 */
const JOY_PAD = 18

const CSS = `
.tc button { font-family: inherit; -webkit-tap-highlight-color: transparent; }
.tc-btn { pointer-events: auto; touch-action: none; user-select: none; -webkit-user-select: none; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 1px; border: 2px solid rgba(255,255,255,0.55); color: #222; cursor: pointer;
  background: rgba(255, 209, 102, 0.82); box-shadow: 0 3px 10px rgba(0,0,0,0.3); font-weight: 700; padding: 0; }
.tc-btn:active, .tc-btn.on { background: rgba(255, 224, 150, 0.95); transform: scale(0.96); }
.tc-right { position: absolute; right: ${safe('right', BTN.margin)}; bottom: ${safe('bottom', BTN.margin)};
  display: flex; flex-direction: column; align-items: flex-end; gap: ${px(BTN.gap)}; }
.tc-row { display: flex; align-items: flex-end; gap: ${px(BTN.gap)}; }
.tc-small { width: ${px(BTN.small)}; height: ${px(BTN.small)}; border-radius: 50%; background: rgba(20, 30, 45, 0.55); color: #fff; }
.tc-small.on { background: rgba(255, 209, 102, 0.85); color: #222; }
.tc-jump { width: ${px(BTN.big)}; height: ${px(BTN.big)}; border-radius: 50%; }
.tc-pill { min-height: 56px; min-width: ${px(BTN.big)}; padding: 0 20px; border-radius: 999px; font-size: 17px; white-space: nowrap; }
.tc-action { background: rgba(102, 187, 106, 0.88); color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.35); max-width: calc(100vw - 2 * ${px(BTN.margin)}); }
.tc-quit { position: absolute; top: ${safe('top', 16)}; right: ${safe('right', 16)}; min-height: 44px; font-size: 15px; background: rgba(20, 30, 45, 0.7); color: #fff; }
.tc-fish { width: 112px; height: 112px; border-radius: 50%; }
.tc-fish.on { background: rgba(255, 171, 64, 0.95); }
.tc-fish.bite { animation: tc-pulse 0.35s ease-in-out infinite alternate; border-color: #fff59d; }
@keyframes tc-pulse { from { transform: scale(1); } to { transform: scale(1.08); } }
.tc-emotes { display: flex; gap: 8px; padding: 8px; border-radius: 16px; background: rgba(20, 30, 45, 0.6); pointer-events: auto; }
.tc-emote { width: 52px; height: 52px; border-radius: 14px; background: rgba(255,255,255,0.9); }
.tc-joy { position: absolute; left: ${safe('left', JOY.margin - JOY_PAD)}; bottom: ${safe('bottom', JOY.margin - JOY_PAD)};
  padding: ${px(JOY_PAD)}; pointer-events: auto; touch-action: none; user-select: none; -webkit-user-select: none; }
.tc-joy-base { position: relative; width: ${px(JOY.radius * 2)}; height: ${px(JOY.radius * 2)}; border-radius: 50%;
  background: rgba(20, 30, 45, 0.35); border: 2px solid rgba(255,255,255,0.45); box-sizing: border-box; }
.tc-joy-knob { position: absolute; left: 50%; top: 50%; width: ${px(JOY.knob * 2)}; height: ${px(JOY.knob * 2)};
  margin: ${px(-JOY.knob)} 0 0 ${px(-JOY.knob)}; border-radius: 50%; background: rgba(255,255,255,0.85); box-shadow: 0 2px 8px rgba(0,0,0,0.35); }
.tc-joy-knob.run { background: rgba(255, 209, 102, 0.95); }
.tc-joy-run { position: absolute; left: 50%; top: -22px; transform: translateX(-50%); font-size: 12px; font-weight: 700; text-shadow: 0 1px 2px #000; }
.tc-help { position: absolute; left: 50%; transform: translateX(-50%); bottom: ${safe('bottom', 16)}; width: max-content;
  max-width: calc(100% - 2 * ${px(JOY.margin + JOY.radius * 2 + 24)}); font-size: 12px; opacity: 0.75; text-align: center;
  text-shadow: 0 1px 2px #000; }
.tc-x { pointer-events: auto; border: none; background: rgba(255,255,255,0.2); color: #fff; border-radius: 50%; width: 30px; height: 30px; font-size: 14px; }
@media (orientation: portrait) {
  .tc-help { left: ${safe('left', 16)}; transform: none; text-align: left; max-width: 60%;
    bottom: ${safe('bottom', JOY.margin + JOY.radius * 2 + 34)}; }
}
`

function TouchStyle() {
  return <style>{CSS}</style>
}
