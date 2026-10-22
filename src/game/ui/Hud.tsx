import { useEffect, useState, type CSSProperties } from 'react'
import { STAMINA } from '../data/balance'
import { BUFF_LABEL } from '../data/dishes'
import type { Interactable } from '../logic/interaction'
import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'
import { useSettingsStore } from '../stores/settingsStore'
import { canUseMouseLook, usePointerLockStore } from '../input/pointerLock'
import { button, hint, overlayLayer } from './styles'

const PROMPT: Record<Interactable['kind'], string> = {
  fishingSpot: 'E  낚시하기',
  sellBox: 'E  물고기 팔기',
  gearShop: 'E  장비 상점',
  market: 'E  어시장',
  bench: 'E  앉아서 쉬기',
  aquarium: 'E  어항',
  wardrobe: 'E  옷장 (꾸미기)',
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
  const mouseLook = canUseMouseLook()

  const ratio = survival.stamina / STAMINA.max
  return (
    <div style={overlayLayer}>
      <div style={{ position: 'absolute', top: 16, left: 16, fontSize: 18, width: 200 }}>
        <strong>코인 {coins}</strong>
        <div style={{ fontSize: 13, marginTop: 6 }}>체력 {Math.ceil(survival.stamina)}</div>
        <div style={{ height: 8, background: '#333', borderRadius: 4, overflow: 'hidden', marginTop: 2 }}>
          <div style={{ width: `${ratio * 100}%`, height: '100%', background: ratio < 0.25 ? '#ef5350' : '#66bb6a' }} />
        </div>
        {survival.buffs.map((b) => (
          <div key={b.kind} style={{ fontSize: 12, marginTop: 4, color: '#ffd166' }}>
            {BUFF_LABEL[b.kind]} {Math.ceil(b.remaining)}초
          </div>
        ))}
      </div>

      {mode === 'rest' && <div style={hint}>벤치에서 쉬는 중… 체력 회복 · E / ESC 일어나기</div>}

      {mode === 'explore' && (
        <>
          <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 8 }}>
            <MusicButton />
            <button style={button} onClick={() => setMode('dex')}>
              도감
            </button>
            <button style={button} onClick={() => setMode('menu')}>
              메뉴 (ESC)
            </button>
          </div>
          {nearby && <div style={hint}>{PROMPT[nearby.kind]}</div>}
          {mouseLook && !locked && <div style={lookHint}>클릭하면 마우스로 시점 회전 · ESC 해제</div>}
          <div style={{ position: 'absolute', bottom: 16, left: 16, opacity: 0.7, fontSize: 13 }}>
            WASD 이동 · Shift 달리기 · Space 점프 · 1~5 감정 표현 · 휠 확대 · M 음악 · {mouseLook ? (locked ? '마우스로 시점 회전 · ESC 메뉴' : '클릭 후 마우스로 시점 회전') : '드래그로 카메라 회전'}
          </div>
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
      <div style={{ position: 'absolute', top: mode === 'aquariumView' ? 68 : 16, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.75)', padding: '10px 18px', borderRadius: 8, fontSize: 15, maxWidth: '80vw', textAlign: 'center' }}>
        {notice.text}
      </div>
    </div>
  )
}
