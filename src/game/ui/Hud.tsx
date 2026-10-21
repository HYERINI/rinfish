import { useEffect, useState } from 'react'
import { STAMINA } from '../data/balance'
import { BUFF_LABEL } from '../data/dishes'
import type { Interactable } from '../logic/interaction'
import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'
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

      <Notice />

      {mode === 'rest' && <div style={hint}>벤치에서 쉬는 중… 체력 회복 · E / ESC 일어나기</div>}

      {mode === 'explore' && (
        <>
          <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 8 }}>
            <button style={button} onClick={() => setMode('dex')}>
              도감
            </button>
            <button style={button} onClick={() => setMode('menu')}>
              메뉴 (ESC)
            </button>
          </div>
          {nearby && <div style={hint}>{PROMPT[nearby.kind]}</div>}
          <div style={{ position: 'absolute', bottom: 16, left: 16, opacity: 0.7, fontSize: 13 }}>
            WASD 이동 · 마우스 드래그로 카메라 회전
          </div>
        </>
      )}
    </div>
  )
}

/** 쓰러짐·어항 알림. 새 알림이 오면 처음부터 다시 센다 */
function Notice() {
  const notice = useSessionStore((s) => s.notice)
  const [hiddenId, setHiddenId] = useState<number | null>(null)
  useEffect(() => {
    if (!notice) return
    const id = setTimeout(() => setHiddenId(notice.id), NOTICE_MS)
    return () => clearTimeout(id)
  }, [notice])

  if (!notice || hiddenId === notice.id) return null
  return (
    <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.75)', padding: '10px 18px', borderRadius: 8, fontSize: 15, maxWidth: '80vw', textAlign: 'center' }}>
      {notice.text}
    </div>
  )
}
