import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { EMOTES } from '../data/emotes'
import { isGun } from '../data/guns'
import { TOUCH } from '../data/touch'
import { resetStick, setStick } from '../input/move'
import { pressAttack, pressFishingButton } from '../input/pointer'
import { useMediaQuery, useTouchUi } from '../input/touchDevice'
import { runKeyAction } from '../input/useInteractionKeys'
import { pressEmote, pressJump } from '../input/usePlayerActionKeys'
import { stickFromDrag, type Stick } from '../logic/joystick'
import { useFishingStore } from '../stores/fishingStore'
import { useSessionStore } from '../stores/sessionStore'
import { interactLabel } from './interactLabel'
import { TapButton } from './TapButton'
import { AimButton, CycleButton, FireButton, KnifeButton, ReloadButton } from './WeaponTouchControls'
import { overlayLayer, touchHint } from './styles'

const { joystick: JOY, buttons: BTN } = TOUCH

/**
 * 휴대폰·태블릿 조작: 왼쪽 아래 조이스틱, 오른쪽 아래 버튼(상호작용·점프·감정 표현·가방, 낚시 중엔 던지기·감기).
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
  const tool = useSessionStore((s) => s.tool)
  const [emotesOpen, setEmotesOpen] = useState(false)
  const portrait = useMediaQuery('(orientation: portrait)')
  /** 총·칼을 들면 무기 버튼 줄 */
  const weapon = isGun(tool) ? 'gun' : tool === 'knife' ? 'knife' : null
  const bag = (
    <TapButton className="tc-btn tc-small" ariaLabel="가방" onTap={() => useSessionStore.getState().setMode('bag')}>
      <span style={{ fontSize: 22, lineHeight: 1 }}>🎒</span>
      <span style={{ fontSize: 11 }}>가방</span>
    </TapButton>
  )
  // 주먹을 들면 휘두르기 (누르는 순간 바로). 세로 화면은 가방 줄에
  const attack = tool === 'fists' && (
    <button
      className="tc-btn tc-small"
      aria-label="휘두르기"
      onPointerDown={(e) => {
        e.preventDefault()
        pressAttack('primary')
      }}
    >
      <span style={{ fontSize: 22, lineHeight: 1 }}>✊</span>
      <span style={{ fontSize: 11 }}>치기</span>
    </button>
  )
  const emote = (
    <TapButton className={`tc-btn tc-small${emotesOpen ? ' on' : ''}`} ariaLabel="감정 표현" onTap={() => setEmotesOpen((o) => !o)}>
      <span style={{ fontSize: 22, lineHeight: 1 }}>😀</span>
      <span style={{ fontSize: 11 }}>표현</span>
    </TapButton>
  )
  // 점프는 누르는 순간 바로
  const jump = (
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
  )
  const action = nearby && (
    <TapButton className={`tc-btn tc-pill tc-action${weapon && !portrait ? ' tc-side' : ''}`} onTap={() => runKeyAction('KeyE')}>
      {interactLabel(nearby)}
    </TapButton>
  )
  const emotes = emotesOpen && (
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
  )
  if (weapon) {
    // 총·칼 (3-4): 은지 touch.js 처럼 쏘기(크게, 끌면 시점)·조준·장전·무기 바꾸기 / 베기(크게)·찌르기.
    // 세로 화면은 세 줄 (표현·무기·가방 / 장전·쏘기 / 조준·점프), 가로 화면은 두 줄 (가방·무기·장전·조준 / 표현·쏘기·점프).
    // 가로 화면은 키가 낮아(360) 위 줄을 미니맵 왼쪽에 두고, 상호작용 버튼은 그 왼쪽에
    const gun = weapon === 'gun'
    const top = gun ? (
      <>
        {bag}
        <CycleButton />
        <ReloadButton />
        {isGun(tool) && <AimButton key={tool} gun={tool} />}
      </>
    ) : (
      <>
        {bag}
        <CycleButton />
        <KnifeButton stab />
      </>
    )
    return (
      <>
        <Joystick />
        {!portrait && (
          <>
            <div className="tc-row tc-weapon-top">{top}</div>
            {action && <div style={{ display: 'contents' }} className={gun ? 'tc-side-gun' : 'tc-side-knife'}>{action}</div>}
          </>
        )}
        <div className="tc-right">
          {emotes}
          {portrait ? (
            <>
              {action}
              <div className="tc-row">
                {emote}
                <CycleButton />
                {bag}
              </div>
              <div className="tc-row">
                {gun ? <ReloadButton /> : <KnifeButton stab />}
                {gun ? <FireButton /> : <KnifeButton />}
              </div>
              <div className="tc-row">
                {isGun(tool) && <AimButton key={tool} gun={tool} />}
                {jump}
              </div>
            </>
          ) : (
            <>
              <div className="tc-row">
                {emote}
                {gun ? <FireButton /> : <KnifeButton />}
                {jump}
              </div>
            </>
          )}
        </div>
        {!emotesOpen && <TouchHelp weapon={weapon} />}
      </>
    )
  }
  return (
    <>
      <Joystick />
      <div className="tc-right">
        {emotes}
        {/* 가까이 있는 대상이 있을 때만: E 와 같은 길로 (낚시 시작·가게 열기·구역 문 살펴보기). 글이 길어도 조이스틱 위에 오도록 가방 줄 위 */}
        {action}
        {/* 세로 화면은 좁아서 가방(과 휘두르기)을 점프 위 오른쪽 끝에 둔다 (한 줄에 셋이면 조이스틱 자리와 겹친다). 가로 화면은 한 줄 그대로 */}
        {portrait && (
          <div className="tc-row">
            {attack}
            {bag}
          </div>
        )}
        <div className="tc-row">
          {!portrait && bag}
          {emote}
          {!portrait && attack}
          {jump}
        </div>
      </div>
      {/* 감정 표현 메뉴를 펼치면 안내 글씨와 겹치므로 잠깐 숨긴다 */}
      {!emotesOpen && <TouchHelp />}
    </>
  )
}

/** 조작 안내 (키보드 안내 대신) + 세로 화면이면 가로로 돌려 보라는 안내. weapon: 총·칼 버튼 줄 (세로 화면은 도구 칸이 더 위) */
function TouchHelp({ weapon = null }: { weapon?: 'gun' | 'knife' | null }) {
  const portrait = useMediaQuery('(orientation: portrait)')
  const [hintGone, setHintGone] = useState(false)
  useEffect(() => {
    if (!portrait || hintGone) return
    const id = setTimeout(() => setHintGone(true), TOUCH.portraitHintMs)
    return () => clearTimeout(id)
  }, [portrait, hintGone])
  return (
    <>
      <div className={`tc-help${weapon ? ' tc-weapon' : ''}`}>
        {weapon === 'gun'
          ? '쏘기 버튼을 누른 채 끌면 시점 회전 · ⌖ 조준(누를 때마다 배율) · R 장전 · ⇄ 무기 바꾸기'
          : weapon === 'knife'
            ? '베기 · 찌르기 · ⇄ 무기 바꾸기 · 화면을 끌어 시점 회전'
            : '왼쪽 스틱으로 이동 · 끝까지 밀면 달리기 · 화면을 끌어 시점 회전 · 두 손가락으로 확대·축소'}
      </div>
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
/** 가로 화면 오른쪽 아래 버튼 줄의 가장 넓은 폭: 가방·표현·휘두르기 + 점프 (안내 글씨가 이 왼쪽에서 끝나게) */
const ROW_WIDTH = BTN.margin + BTN.big + 3 * (BTN.small + BTN.gap)
/** 조이스틱 오른쪽 끝 */
const JOY_RIGHT = JOY.margin + JOY.radius * 2
/** 폰 가로 화면 미니맵 왼쪽 끝 (오른쪽 16 + 지름 110, ui/MiniMap) */
const MINIMAP_LEFT = 16 + 110
/** 가로 화면 무기 위 줄(총: 가방·무기·장전·조준, 칼: 가방·무기·찌르기)의 왼쪽 끝. 상호작용 버튼은 이 왼쪽에 */
const GUN_TOP_LEFT = MINIMAP_LEFT + BTN.gap + 4 * BTN.small + 3 * BTN.gap + BTN.gap
const KNIFE_TOP_LEFT = MINIMAP_LEFT + BTN.gap + 3 * BTN.small + 2 * BTN.gap + BTN.gap

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
.tc-fire { width: ${px(BTN.big)}; height: ${px(BTN.big)}; border-radius: 50%; background: rgba(239, 83, 80, 0.85); color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.4); }
.tc-fire.on, .tc-fire:active { background: rgba(255, 138, 128, 0.95); }
.tc-weapon-top { position: absolute; pointer-events: none; bottom: ${safe('bottom', BTN.margin + BTN.big + BTN.gap)}; right: ${safe('right', MINIMAP_LEFT + BTN.gap)}; }
.tc-side { position: absolute; bottom: ${safe('bottom', BTN.margin + BTN.big + BTN.gap)}; overflow: hidden; text-overflow: ellipsis; display: block; line-height: 52px; }
.tc-side-gun .tc-side { right: ${safe('right', GUN_TOP_LEFT)}; max-width: calc(100vw - ${px(GUN_TOP_LEFT + JOY_RIGHT + 24)}); }
.tc-side-knife .tc-side { right: ${safe('right', KNIFE_TOP_LEFT)}; max-width: calc(100vw - ${px(KNIFE_TOP_LEFT + JOY_RIGHT + 24)}); }
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
.tc-help { position: absolute; left: ${safe('left', JOY_RIGHT + 16)}; right: ${safe('right', ROW_WIDTH + 8)};
  bottom: ${safe('bottom', TOUCH.hotbarBottom.landscape + 56)}; font-size: 12px; opacity: 0.75; text-align: center;
  text-shadow: 0 1px 2px #000; }
.tc-x { pointer-events: auto; border: none; background: rgba(255,255,255,0.2); color: #fff; border-radius: 50%; width: 30px; height: 30px; font-size: 14px; }
@media (orientation: portrait) {
  .tc-help { left: ${safe('left', 16)}; right: auto; text-align: left; max-width: 60%;
    bottom: ${safe('bottom', TOUCH.hotbarBottom.portrait + 54)}; }
  .tc-help.tc-weapon { bottom: ${safe('bottom', TOUCH.hotbarBottom.portraitWeapon + 54)}; }
}
`

function TouchStyle() {
  return <style>{CSS}</style>
}
