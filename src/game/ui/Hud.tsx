import { useEffect, useState, type CSSProperties } from 'react'
import { STAMINA } from '../data/balance'
import { BUFF_LABEL, getDish } from '../data/dishes'
import { MARKET } from '../data/market'
import { SNACKS } from '../data/snacks'
import { pressEat } from '../input/usePlayerActionKeys'
import { finishCooking } from '../scene/cooking/finishCooking'
import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'
import { useSettingsStore } from '../stores/settingsStore'
import { canUseMouseLook, usePointerLockStore } from '../input/pointerLock'
import { useTouchUi } from '../input/touchDevice'
import { interactLabel } from './interactLabel'
import { ItemIcon } from './ItemIcon'
import { button, hint, overlayLayer, safeLeft, safeRight, safeTop, touchHint } from './styles'

/** 연출 중 아래 자막 */
const CUTSCENE_CAPTION: Record<string, string> = {
  pond: '수리기사님들이 다리를 고치는 중…',
  reef: '수리기사님들이 보트를 고치는 중…',
  cave: '수리기사님들이 바위를 치우는 중…',
}

/** 알림을 띄워 두는 시간 */
const NOTICE_MS = 4000

export function Hud() {
  const coins = useProgressStore((s) => s.coins)
  const survival = useProgressStore((s) => s.survival)
  const mode = useSessionStore((s) => s.mode)
  const nearby = useSessionStore((s) => s.nearby)
  const setMode = useSessionStore((s) => s.setMode)
  const locked = usePointerLockStore((s) => s.locked)
  const touchUi = useTouchUi()
  // 터치 화면을 쓰는 중이면 마우스 안내는 숨긴다 (터치 화면 노트북 등)
  const mouseLook = canUseMouseLook() && !touchUi
  const cutscene = useSessionStore((s) => s.cutscene)
  const cooking = useSessionStore((s) => s.cooking)

  const ratio = survival.stamina / STAMINA.max
  return (
    <div style={overlayLayer}>
      <div style={{ position: 'absolute', top: safeTop(16), left: safeLeft(16), fontSize: 18, width: 'min(200px, 42vw)', display: mode === 'cutscene' ? 'none' : undefined }}>
        <strong>코인 {coins}</strong>
        <div style={{ fontSize: 13, marginTop: 6 }}>
          체력 {Math.ceil(survival.stamina)} <span style={{ fontSize: 11, opacity: 0.75 }}>· 음식·벤치로 회복</span>
        </div>
        <div style={{ height: 8, background: '#333', borderRadius: 4, overflow: 'hidden', marginTop: 2 }}>
          <div style={{ width: `${ratio * 100}%`, height: '100%', background: ratio < 0.25 ? '#ef5350' : '#66bb6a' }} />
        </div>
        {survival.stamina < STAMINA.lowHint && (
          <div style={{ fontSize: 12, marginTop: 4, color: '#ffab91', textShadow: '0 1px 2px #000' }}>배고파요! {MARKET.name}에서 음식을 사 먹거나 벤치에서 쉬세요</div>
        )}
        {mode === 'explore' && <SnackBag />}
        {survival.buffs.map((b) => (
          <div key={b.kind} style={{ fontSize: 12, marginTop: 4, color: '#ffd166' }}>
            {BUFF_LABEL[b.kind]} {Math.ceil(b.remaining)}초
          </div>
        ))}
      </div>

      {/* 연출 중: 위아래 검은 띠(영화처럼) + 자막 */}
      {/* 요리 연출: 화면 아무 데나 누르거나 E·Space 로 건너뛴다 */}
      {mode === 'cutscene' && cooking && (
        <>
          <div style={{ ...letterbox, top: 0 }} />
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'auto', cursor: 'pointer' }} onPointerDown={() => finishCooking()} />
          <div style={{ ...letterbox, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, fontSize: 16 }}>
            {MARKET.owner}이 {getDish(cooking.dish).name}을(를) 만드는 중…
            <span style={{ fontSize: 12, opacity: 0.7 }}>{touchUi ? '화면을 누르면 건너뛰기' : '클릭·E·Space 건너뛰기'}</span>
          </div>
        </>
      )}
      {mode === 'cutscene' && cutscene && (
        <>
          <div style={{ ...letterbox, top: 0 }} />
          <div style={{ ...letterbox, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{CUTSCENE_CAPTION[cutscene.zoneId]}</div>
        </>
      )}

      {mode === 'rest' && (touchUi ? <div style={touchHint}>벤치에서 쉬는 중… 체력 회복</div> : <div style={hint}>벤치에서 쉬는 중… 체력 회복 · E / ESC 일어나기</div>)}

      {mode === 'explore' && (
        <>
          <div style={{ position: 'absolute', top: safeTop(16), right: safeRight(16), display: 'flex', gap: 8 }}>
            <MusicButton />
            <button style={button} onClick={() => setMode('dex')}>
              도감
            </button>
            <button style={button} onClick={() => setMode('menu')}>
              {touchUi ? '메뉴' : '메뉴 (ESC)'}
            </button>
          </div>
          {/* 터치 화면에선 상호작용 버튼에 글씨가 나오고, 조작 안내는 TouchControls 가 그린다 */}
          {nearby && !touchUi && <div style={hint}>E  {interactLabel(nearby)}</div>}
          {mouseLook && !locked && <div style={lookHint}>클릭하면 마우스로 시점 회전 · ESC 해제</div>}
          {!touchUi && (
            <div style={{ position: 'absolute', bottom: 16, left: 16, opacity: 0.7, fontSize: 13 }}>
              WASD 이동 · Shift 달리기 · Space 점프 · 1~5 감정 표현 · 휠 확대 · M 음악 · {mouseLook ? (locked ? '마우스로 시점 회전 · ESC 메뉴' : '클릭 후 마우스로 시점 회전') : '드래그로 카메라 회전'}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/** 화면 아래 가운데, E 안내 바로 위: 마우스 잠금 안내 (위쪽은 구역 이름표·알림과 겹친다) */
const lookHint: CSSProperties = {
  position: 'absolute',
  bottom: 80,
  left: '50%',
  transform: 'translateX(-50%)',
  background: 'rgba(0, 0, 0, 0.45)',
  padding: '5px 12px',
  borderRadius: 999,
  fontSize: 13,
  opacity: 0.85,
  whiteSpace: 'nowrap',
}

/** 배경 음악 켜기/끄기 (M 키와 같다). 설정은 저장된다 */
function MusicButton() {
  const muted = useSettingsStore((s) => s.musicMuted)
  const toggle = useSettingsStore((s) => s.toggleMusicMuted)
  return (
    <button style={{ ...button, display: 'flex', alignItems: 'center', padding: '6px 10px' }} onClick={toggle} title={muted ? '음악 켜기 (M)' : '음악 끄기 (M)'} aria-label={muted ? '음악 켜기' : '음악 끄기'} aria-pressed={!muted}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
        {muted ? (
          <path d="M17 9l5 6M22 9l-5 6" />
        ) : (
          <>
            <path d="M16.5 8.5a5 5 0 0 1 0 7" />
            <path d="M19.5 5.5a9 9 0 0 1 0 13" />
          </>
        )}
      </svg>
    </button>
  )
}

/** 가방 속 간식 빠른 먹기 (탐험 중). 누르면 바로 먹는 동작 */
function SnackBag() {
  const snacks = useProgressStore((s) => s.snacks)
  const owned = SNACKS.filter((s) => snacks[s.id] > 0)
  if (owned.length === 0) return null
  return (
    <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
      {owned.map((s) => (
        <button
          key={s.id}
          title={`${s.name} 먹기 (체력 +${s.heal})`}
          style={{ ...button, display: 'flex', alignItems: 'center', gap: 2, padding: '2px 6px', background: 'rgba(255,255,255,0.88)', fontSize: 12 }}
          onClick={(e) => {
            e.currentTarget.blur()
            if (!useProgressStore.getState().eatSnack(s.id)) return
            useSessionStore.getState().notify(`냠냠! ${s.name} · 체력 +${s.heal}`)
            pressEat(s.id)
          }}
        >
          <ItemIcon id={s.id} size={24} />×{snacks[s.id]}
        </button>
      ))}
    </div>
  )
}

const letterbox = { position: 'absolute' as const, left: 0, right: 0, height: '9vh', background: '#000', opacity: 0.85 }

/**
 * 쓰러짐·어항 알림. 패널·어항 크게 보기보다 위 층에 띄워서 어느 화면에서든 보인다 (Game 에서 Panels 다음에 둔다).
 * 새 알림이 오면 처음부터 다시 센다
 */
export function NoticeLayer() {
  const notice = useSessionStore((s) => s.notice)
  const mode = useSessionStore((s) => s.mode)
  const [hiddenId, setHiddenId] = useState<number | null>(null)
  useEffect(() => {
    if (!notice) return
    const id = setTimeout(() => setHiddenId(notice.id), NOTICE_MS)
    return () => clearTimeout(id)
  }, [notice])

  if (!notice || hiddenId === notice.id) return null
  return (
    <div style={{ ...overlayLayer, zIndex: 1001 }}>
      {/* 크게 보기에서는 위쪽 막대(어항 정보·버튼) 아래에 띄운다 */}
      <div style={{ position: 'absolute', top: safeTop(mode === 'aquariumView' ? 68 : 16), left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.75)', padding: '10px 18px', borderRadius: 8, fontSize: 15, maxWidth: '80vw', textAlign: 'center' }}>
        {notice.text}
      </div>
    </div>
  )
}
