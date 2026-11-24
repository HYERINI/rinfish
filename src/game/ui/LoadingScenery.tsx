import type { CSSProperties } from 'react'

/** 하늘과 바다가 만나는 높이 (화면 위에서 %). 가운데 카드(LoadingScreen)는 이보다 아래에 둔다 */
export const HORIZON = 34

/**
 * 로딩 화면 풍경: 왼쪽 낚시섬(야자수·선착장), 오른쪽 초원(은지 집·울타리·나무·소), 그 사이를 오가는 배.
 * 하늘·바다 색은 LoadingScreen 배경이 칠하고, 여기선 수평선 위에 얹는 것만 그린다
 */
export function LoadingScenery() {
  return (
    <>
      <svg viewBox="0 0 100 100" style={sun} aria-hidden>
        <circle cx="50" cy="50" r="22" fill="#fff59d" />
        <circle cx="50" cy="50" r="34" fill="#fff59d" opacity="0.25" />
      </svg>
      {[0, 1, 2].map((i) => (
        <svg key={i} viewBox="0 0 120 40" style={{ ...cloud, top: `${6 + i * 8}%`, animation: `ls-cloud ${60 + i * 25}s linear ${-i * 23}s infinite` }} aria-hidden>
          <ellipse cx="40" cy="26" rx="28" ry="12" fill="#fff" opacity="0.9" />
          <ellipse cx="66" cy="18" rx="24" ry="15" fill="#fff" opacity="0.9" />
          <ellipse cx="88" cy="27" rx="22" ry="10" fill="#fff" opacity="0.9" />
        </svg>
      ))}
      <Island />
      <Meadow />
      <Boat />
    </>
  )
}

/** 수평선에 바닥을 붙인 풍경 조각 */
const onHorizon = (side: 'left' | 'right', width: string): CSSProperties => ({
  position: 'absolute',
  bottom: `${100 - HORIZON - 1}%`,
  [side]: '1.5%',
  width,
  display: 'block',
})

function Island() {
  return (
    <svg viewBox="0 0 300 120" style={onHorizon('left', 'clamp(150px, 34vw, 400px)')} aria-hidden>
      {/* 선착장 */}
      <rect x="205" y="92" width="80" height="6" fill="#8d6e63" />
      {[215, 240, 265, 282].map((x) => (
        <rect key={x} x={x} y="92" width="4" height="16" fill="#6d4c41" />
      ))}
      {/* 모래섬과 풀 */}
      <path d="M10 112 Q40 70 120 66 Q190 64 230 100 L230 112 Z" fill="#f2dca2" />
      <path d="M45 86 Q80 62 130 62 Q175 62 200 86 Q150 76 45 86 Z" fill="#81c784" />
      {/* 야자수 */}
      <path d="M96 72 Q92 46 104 24" stroke="#795548" strokeWidth="5" fill="none" strokeLinecap="round" />
      {[-60, -20, 20, 60, 100].map((a) => (
        <ellipse key={a} cx="104" cy="24" rx="22" ry="6" fill="#43a047" transform={`rotate(${a} 104 24) translate(18 0)`} />
      ))}
      {/* 작은 오두막 */}
      <rect x="140" y="56" width="26" height="18" fill="#ffe0b2" />
      <path d="M136 58 L153 44 L170 58 Z" fill="#e53935" />
      <rect x="150" y="63" width="7" height="11" fill="#8d6e63" />
      {/* 낚싯대 든 사람 (선착장 끝) */}
      <circle cx="276" cy="78" r="4" fill="#ffcc80" />
      <rect x="272" y="82" width="8" height="10" rx="2" fill="#1e88e5" />
      <path d="M279 84 L298 62" stroke="#5d4037" strokeWidth="1.5" />
      <path d="M298 62 L298 104" stroke="#eceff1" strokeWidth="0.6" />
      {/* 물결 */}
      <path d="M0 114 Q20 108 40 114 T80 114 T120 114 T160 114 T200 114 T240 114 T280 114 T320 114" stroke="#b3e5fc" strokeWidth="2" fill="none" opacity="0.8" />
    </svg>
  )
}

function Meadow() {
  return (
    <svg viewBox="0 0 360 120" style={onHorizon('right', 'clamp(170px, 40vw, 470px)')} aria-hidden>
      {/* 모래 가장자리와 초원 */}
      <path d="M0 112 L8 92 L360 86 L360 112 Z" fill="#f2dca2" />
      <path d="M14 92 L22 78 L360 72 L360 90 Z" fill="#7cb342" />
      {/* 뒤쪽 숲 */}
      {[200, 228, 300, 330, 352].map((x, i) => (
        <g key={x}>
          <rect x={x - 2} y={58 - (i % 2) * 6} width="4" height="16" fill="#6d4c41" />
          <path d={`M${x - 14} ${62 - (i % 2) * 6} L${x} ${30 - (i % 2) * 8} L${x + 14} ${62 - (i % 2) * 6} Z`} fill={i % 2 ? '#2e7d32' : '#388e3c'} />
        </g>
      ))}
      {/* 은지 집 */}
      <rect x="92" y="46" width="66" height="30" fill="#fafafa" />
      <path d="M86 48 L125 24 L164 48 Z" fill="#8d6e63" />
      <rect x="118" y="58" width="12" height="18" fill="#6d4c41" />
      <rect x="100" y="54" width="12" height="10" fill="#81d4fa" />
      <rect x="138" y="54" width="12" height="10" fill="#81d4fa" />
      {/* 마당 울타리 */}
      <path d="M40 80 L250 76" stroke="#a1887f" strokeWidth="2" />
      <path d="M40 74 L250 70" stroke="#a1887f" strokeWidth="2" />
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x={40 + i * 19} y={68 - i * 0.4} width="3" height="14" fill="#8d6e63" />
      ))}
      {/* 소 */}
      <g transform="translate(272 66)">
        <ellipse cx="0" cy="0" rx="13" ry="8" fill="#fff" />
        <ellipse cx="-4" cy="-2" rx="4" ry="3" fill="#424242" />
        <ellipse cx="6" cy="2" rx="3" ry="2.5" fill="#424242" />
        <rect x="-10" y="5" width="3" height="7" fill="#fff" />
        <rect x="7" y="5" width="3" height="7" fill="#fff" />
        <circle cx="15" cy="-4" r="5" fill="#fff" />
        <ellipse cx="18" cy="-2" rx="3" ry="2" fill="#f8bbd0" />
      </g>
      <path d="M0 114 Q20 108 40 114 T80 114 T120 114 T160 114 T200 114 T240 114 T280 114 T320 114 T360 114" stroke="#b3e5fc" strokeWidth="2" fill="none" opacity="0.8" />
    </svg>
  )
}

/** 섬과 초원 사이를 천천히 오가는 배 */
function Boat() {
  return (
    <div style={{ position: 'absolute', bottom: `${100 - HORIZON - 2}%`, left: 0, right: 0, height: 0, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', bottom: 0, animation: 'ls-boat 26s ease-in-out infinite alternate' }}>
        <svg viewBox="0 0 80 50" style={{ width: 'clamp(46px, 7vw, 80px)', display: 'block', animation: 'ls-bob 1.6s ease-in-out infinite alternate' }} aria-hidden>
          <path d="M36 6 L36 34" stroke="#5d4037" strokeWidth="2.5" />
          <path d="M38 8 L60 30 L38 30 Z" fill="#fffde7" />
          <path d="M6 34 L74 34 L64 46 L16 46 Z" fill="#fafafa" />
          <path d="M8 37 L72 37" stroke="#e53935" strokeWidth="3" />
        </svg>
      </div>
    </div>
  )
}

export const SCENERY_KEYFRAMES = `
@keyframes ls-cloud { from { transform: translateX(-30vw) } to { transform: translateX(110vw) } }
@keyframes ls-boat { from { transform: translateX(36vw) } to { transform: translateX(56vw) } }
`

const sun: CSSProperties = { position: 'absolute', top: '3%', right: '8%', width: 'clamp(60px, 10vw, 120px)' }
const cloud: CSSProperties = { position: 'absolute', left: 0, width: 'clamp(90px, 14vw, 180px)' }
