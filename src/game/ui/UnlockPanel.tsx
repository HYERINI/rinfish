import type { CSSProperties, ReactNode } from 'react'
import { GEAR } from '../data/gear'
import { REPAIR_PLANS } from '../data/repair'
import type { ZoneId } from '../data/types'
import { getZone } from '../data/zones'
import { unlockStatus } from '../logic/zoneUnlock'
import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'
import { BigButton, KioskStyle } from './Kiosk'

const TEXT: Record<Exclude<ZoneId, 'beach'>, { title: string; story: string; action: string }> = {
  pond: { title: '무너진 다리', story: '개울 위 나무다리가 무너져 숲속 연못에 갈 수 없어요. 수리기사님께 맡기면 바로 고쳐 주신대요.', action: '수리 맡기기' },
  reef: { title: '부서진 보트', story: '구멍 난 보트를 고쳐야 암초 앞바다로 나갈 수 있어요. 수리기사님께 맡겨 볼까요?', action: '수리 맡기기' },
  cave: { title: '동굴을 막은 바위', story: '커다란 바위가 동굴 입구를 막고 있어요. 낚시 실력을 인정받으면 수리기사님들이 둘이서 치워 주신대요.', action: '수리기사님 부르기' },
}

/** 잠긴 구역 문 앞에서 E: 무엇이 막혀 있는지, 얼마나 드는지(또는 동굴 조건 진행도)를 보여 주고 수리를 맡긴다 */
export function UnlockPanel() {
  const nearby = useSessionStore((s) => s.nearby)
  const coins = useProgressStore((s) => s.coins)
  const dexCount = useProgressStore((s) => Object.keys(s.dex).length)
  const lineLevel = useProgressStore((s) => s.gear.line)
  const unlocked = useProgressStore((s) => s.unlockedZones)
  if (nearby?.kind !== 'zoneGate' || nearby.zoneId === 'beach') return null
  const zoneId = nearby.zoneId
  const zone = getZone(zoneId)
  const status = unlockStatus(zone, { coins, dexCount, lineLevel, unlocked })
  const text = TEXT[zoneId]
  const u = zone.unlock

  const start = () => {
    if (!useProgressStore.getState().unlockZone(zoneId)) return
    // 구역은 지금 열렸다(저장됨). 연출은 보여 주기만 한다
    const session = useSessionStore.getState()
    session.requestTeleport(REPAIR_PLANS[zoneId].watchFrom)
    session.startCutscene(zoneId)
  }

  let body: ReactNode
  if (u?.kind === 'clear') {
    const lineName = GEAR.line.levels[u.minLineLevel - 1]?.label ?? ''
    body = (
      <>
        <Meter label="도감에 올린 물고기" value={dexCount} goal={u.minDex} unit="종" />
        <Meter label={`낚싯줄 (${lineName} 필요)`} value={lineLevel + 1} goal={u.minLineLevel} unit="" prefix="Lv" />
        {status.state === 'short' && status.reason === 'conditions' && <p style={{ margin: '6px 0 0', fontSize: 13, color: '#66737f' }}>{status.progress}</p>}
      </>
    )
  } else if (u) {
    body = (
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, padding: '10px 12px', background: '#f1f5f9', borderRadius: 10 }}>
        <span>수리비</span>
        <strong style={{ color: '#c25e00' }}>{u.price} 코인</strong>
      </div>
    )
  }

  const ready = status.state === 'ready'
  const sub = ready
    ? status.cost > 0
      ? `${status.cost} 코인 · 갖고 있는 코인 ${coins}`
      : '조건을 모두 채웠어요!'
    : status.state === 'short' && status.reason === 'coins'
      ? `코인이 ${status.missing} 모자라요`
      : '조건을 채우면 부를 수 있어요'

  return (
    <div style={box}>
      <KioskStyle />
      <div style={{ ...head, background: zone.color }}>
        <h2 style={{ margin: 0, fontSize: 19, flex: 1 }}>
          {zone.name} · {text.title}
        </h2>
        <button style={close} onClick={() => useSessionStore.getState().setMode('explore')}>
          닫기 <small style={{ opacity: 0.6 }}>ESC</small>
        </button>
      </div>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'center', background: '#e3f2fd', borderRadius: 14, padding: 8 }}>
          <Illustration zoneId={zoneId} />
        </div>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: '#37474f' }}>{text.story}</p>
        {body}
        <BigButton label={text.action} sub={sub} disabled={!ready} onClick={start} />
      </div>
    </div>
  )
}

function Meter({ label, value, goal, unit, prefix = '' }: { label: string; value: number; goal: number; unit: string; prefix?: string }) {
  const done = value >= goal
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}>
        <span>{label}</span>
        <strong style={{ color: done ? '#2e7d32' : '#c25e00' }}>
          {prefix}
          {Math.min(value, goal)}
          {unit} / {prefix}
          {goal}
          {unit} {done && '✓'}
        </strong>
      </div>
      <div style={{ height: 10, background: '#e3e8ee', borderRadius: 5, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(1, value / goal) * 100}%`, height: '100%', background: done ? '#43a047' : '#ffa726' }} />
      </div>
    </div>
  )
}

/** 막힌 모습 그림 (SVG) */
function Illustration({ zoneId }: { zoneId: Exclude<ZoneId, 'beach'> }) {
  return (
    <svg width="240" height="120" viewBox="0 0 240 120" aria-hidden>
      {zoneId === 'pond' && (
        <g>
          <rect x="0" y="62" width="240" height="40" fill="#4db6ac" />
          <path d="M0 62 h240" stroke="#8d6e63" strokeWidth="4" />
          <path d="M0 102 h240" stroke="#8d6e63" strokeWidth="4" />
          {[20, 44, 68].map((x) => (
            <rect key={x} x={x} y="56" width="20" height="8" fill="#a1887f" stroke="#6d4c41" />
          ))}
          {[152, 176, 200].map((x) => (
            <rect key={x} x={x} y="56" width="20" height="8" fill="#a1887f" stroke="#6d4c41" />
          ))}
          <rect x="96" y="72" width="34" height="8" fill="#a1887f" stroke="#6d4c41" transform="rotate(24 113 76)" />
          <rect x="122" y="80" width="28" height="8" fill="#a1887f" stroke="#6d4c41" transform="rotate(-18 136 84)" />
          <path d="M20 56 v-26 h70 l10 18" stroke="#6d4c41" strokeWidth="5" fill="none" />
          <path d="M220 56 v-26 h-60 l-12 22" stroke="#6d4c41" strokeWidth="5" fill="none" />
          <circle cx="115" cy="34" r="16" fill="#fbc02d" />
          <text x="115" y="41" textAnchor="middle" fontSize="20" fontWeight="900" fill="#3e2723">!</text>
        </g>
      )}
      {zoneId === 'reef' && (
        <g>
          <rect x="0" y="88" width="240" height="32" fill="#e9d8a6" />
          <g transform="rotate(10 120 70)">
            <path d="M50 58 h120 l26 14 l-26 16 h-110 z" fill="#9e958a" stroke="#5d4037" strokeWidth="3" />
            <path d="M52 66 h124" stroke="#7b5e57" strokeWidth="5" />
            <circle cx="110" cy="78" r="8" fill="#2b1d16" />
            <path d="M138 74 l14 8 l-10 4" fill="#2b1d16" />
          </g>
          {[30, 190].map((x) => (
            <rect key={x} x={x} y="98" width="30" height="5" fill="#8d7b6c" transform={`rotate(${x > 100 ? -12 : 15} ${x + 15} 100)`} />
          ))}
          <circle cx="200" cy="30" r="16" fill="#fbc02d" />
          <text x="200" y="37" textAnchor="middle" fontSize="20" fontWeight="900" fill="#3e2723">!</text>
        </g>
      )}
      {zoneId === 'cave' && (
        <g>
          <path d="M20 112 C 30 20, 210 20, 220 112 z" fill="#4e342e" />
          <path d="M60 112 C 66 50, 174 50, 180 112 z" fill="#1a1a2e" />
          <path d="M70 112 l 6 -40 l 30 -22 l 36 4 l 28 26 l 4 32 z" fill="#8d8478" stroke="#5d564d" strokeWidth="3" />
          <path d="M100 70 l 14 10 M140 64 l -6 18" stroke="#5d564d" strokeWidth="3" />
          <rect x="0" y="108" width="240" height="12" fill="#e9d8a6" />
        </g>
      )}
    </svg>
  )
}

const box: CSSProperties = {
  pointerEvents: 'auto',
  zIndex: 1000,
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 'min(420px, 92vw)',
  maxHeight: '88vh',
  overflowY: 'auto',
  background: '#fff',
  color: '#1f2933',
  borderRadius: 16,
  boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
}

const head: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.4)', borderRadius: '16px 16px 0 0' }

const close: CSSProperties = { border: 'none', borderRadius: 8, padding: '7px 12px', background: 'rgba(255,255,255,0.9)', color: '#222', fontWeight: 700, cursor: 'pointer', textShadow: 'none' }
