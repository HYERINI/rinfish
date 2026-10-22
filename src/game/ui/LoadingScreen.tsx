import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useProgress } from '@react-three/drei'
import { useTouchUi } from '../input/touchDevice'

/** 다 불러온 뒤에도 물고기 떼를 잠깐은 보여 준다 (너무 빨리 깜빡이지 않게) */
const MIN_SHOW_MS = 1500
/** 불러올 게 하나도 안 잡히면 이 시간 뒤엔 그냥 닫는다 */
const NOTHING_TO_LOAD_MS = 6000
const FADE_MS = 700
/** 모델은 여러 묶음으로 나눠 불러온다. 한 묶음이 끝나고 다음 묶음이 시작되기 전 틈에 닫히지 않게 조금 더 기다린다 */
const SETTLE_MS = 600

const FISH_COLORS = [
  ['#ffb74d', '#f4511e'],
  ['#81d4fa', '#0288d1'],
  ['#fff176', '#f9a825'],
  ['#f48fb1', '#d81b60'],
  ['#a5d6a7', '#2e7d32'],
  ['#ce93d8', '#7b1fa2'],
  ['#ffffff', '#90a4ae'],
  ['#ffcc80', '#6d4c41'],
]

/** 조작 팁. touch: 터치 화면에서 대신 보여 줄 말 (키보드·마우스 이야기가 들어간 팁만) */
const TIPS: { text: string; touch?: string }[] = [
  { text: '찌가 크게 잠길 때 클릭하면 챔질!', touch: '찌가 크게 잠길 때 챔질 버튼을 누르세요!' },
  { text: '텐션이 빨개지면 손을 떼세요' },
  { text: 'Shift 달리기 · Space 점프 · 1~5 감정 표현', touch: '스틱을 끝까지 밀면 달려요 · 점프·표현 버튼도 눌러 보세요' },
  { text: '휠을 당기면 얼굴까지 확대돼요', touch: '두 손가락으로 벌리면 얼굴까지 확대돼요' },
  { text: '희귀한 물고기는 멀리 던질수록 잘 문다' },
  { text: '동굴 깊은 곳엔 전설의 물고기가…' },
  { text: '개멸치뼈인식을 잡으면 낚싯바늘이 더 무겁다' },
]

type SwimFish = { top: number; size: number; duration: number; delay: number; flip: boolean; colors: string[] }

function makeSchool(count: number): SwimFish[] {
  return Array.from({ length: count }, (_, i) => ({
    top: 4 + Math.random() * 88,
    size: 28 + Math.random() * 70,
    duration: 7 + Math.random() * 10,
    delay: -Math.random() * 16,
    flip: i % 3 === 0,
    colors: FISH_COLORS[i % FISH_COLORS.length],
  }))
}

/** 처음 3D 모델들을 받는 동안 덮어 두는 화면. 한 번 닫히면 다시 뜨지 않는다. */
export function LoadingScreen() {
  const { active, progress, total } = useProgress()
  const [startedAt] = useState(() => performance.now())
  const [closing, setClosing] = useState(false)
  const [gone, setGone] = useState(false)
  const school = useMemo(() => makeSchool(26), [])
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)])
  const touchUi = useTouchUi()

  const [best, setBest] = useState(0)
  if (progress > best) setBest(progress)
  const finished = total > 0 && !active && progress >= 100

  useEffect(() => {
    if (closing) return
    const wait = finished ? Math.max(SETTLE_MS, MIN_SHOW_MS - (performance.now() - startedAt)) : total === 0 ? NOTHING_TO_LOAD_MS : null
    if (wait === null) return
    const id = setTimeout(() => setClosing(true), wait)
    return () => clearTimeout(id)
  }, [finished, total, closing, startedAt])

  useEffect(() => {
    if (!closing) return
    const id = setTimeout(() => setGone(true), FADE_MS)
    return () => clearTimeout(id)
  }, [closing])

  if (gone) return null
  // 다음 묶음이 시작되면 drei 진행률이 0부터 다시 세므로, 화면에는 줄어들지 않는 값을 보여 준다
  const percent = finished ? 100 : Math.min(99, Math.round(best))

  return (
    <div style={{ ...screen, opacity: closing ? 0 : 1, pointerEvents: closing ? 'none' : 'auto' }}>
      <style>{KEYFRAMES}</style>
      {school.map((f, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: `${f.top}%`,
            left: 0,
            animation: `${f.flip ? 'ls-swim-left' : 'ls-swim-right'} ${f.duration}s linear ${f.delay}s infinite`,
          }}
        >
          <div style={{ animation: `ls-bob ${1.2 + (i % 5) * 0.3}s ease-in-out infinite alternate` }}>
            <Fish size={f.size} colors={f.colors} flip={f.flip} />
          </div>
        </div>
      ))}
      {Array.from({ length: 18 }, (_, i) => (
        <div
          key={`b${i}`}
          style={{
            ...bubble,
            left: `${(i * 37) % 100}%`,
            width: 6 + (i % 4) * 4,
            height: 6 + (i % 4) * 4,
            animation: `ls-bubble ${5 + (i % 6)}s linear ${-i * 0.7}s infinite`,
          }}
        />
      ))}

      <div style={center}>
        <div style={{ fontSize: 'clamp(48px, 12vw, 96px)', fontWeight: 900, letterSpacing: 4, textShadow: '0 4px 0 #01579b, 0 8px 24px rgba(0,0,0,0.35)' }}>
          낚시섬
        </div>
        <div style={{ fontSize: 16, opacity: 0.9, marginTop: 4 }}>물고기들이 섬으로 헤엄쳐 오는 중…</div>
        <div style={barOuter}>
          <div style={{ ...barInner, width: `${percent}%` }} />
        </div>
        <div style={{ fontSize: 14, opacity: 0.85 }}>{percent}%</div>
        <div style={{ fontSize: 13, opacity: 0.75, marginTop: 18 }}>💡 {(touchUi && tip.touch) || tip.text}</div>
      </div>
    </div>
  )
}

function Fish({ size, colors, flip }: { size: number; colors: string[]; flip: boolean }) {
  const [light, dark] = colors
  const id = `g${light.slice(1)}${dark.slice(1)}`
  return (
    <svg width={size} height={size * 0.62} viewBox="0 0 64 40" style={{ transform: flip ? 'scaleX(-1)' : undefined, display: 'block' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
      </defs>
      {/* 오른쪽을 보고 헤엄치는 물고기: 꼬리는 왼쪽 */}
      <path d="M16 20 L2 8 L5 20 L2 32 Z" fill={dark} style={{ transformOrigin: '16px 20px', animation: 'ls-tail 0.35s ease-in-out infinite alternate' }} />
      <ellipse cx="35" cy="20" rx="22" ry="14" fill={`url(#${id})`} />
      <path d="M30 7 Q36 -1 44 8 Z" fill={dark} />
      <path d="M30 14 Q26 20 30 26" stroke={dark} strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="47" cy="17" r="4.2" fill="#fff" />
      <circle cx="48.2" cy="17" r="2.2" fill="#212121" />
      <path d="M50 25 Q53 27 56 25" stroke={dark} strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  )
}

const KEYFRAMES = `
@keyframes ls-swim-right { from { transform: translateX(-140px) } to { transform: translateX(calc(100vw + 40px)) } }
@keyframes ls-swim-left { from { transform: translateX(calc(100vw + 40px)) } to { transform: translateX(-140px) } }
@keyframes ls-bob { from { transform: translateY(-8px) } to { transform: translateY(8px) } }
@keyframes ls-tail { from { transform: scaleY(0.75) } to { transform: scaleY(1.1) } }
@keyframes ls-bubble { from { transform: translateY(0); opacity: 0 } 10% { opacity: 0.7 } to { transform: translateY(-110vh); opacity: 0 } }
`

const screen: CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 2000,
  overflow: 'hidden',
  background: 'linear-gradient(#4fc3f7 0%, #0288d1 55%, #01579b 100%)',
  color: '#fff',
  transition: `opacity ${FADE_MS}ms ease`,
  userSelect: 'none',
}

const bubble: CSSProperties = {
  position: 'absolute',
  bottom: -20,
  borderRadius: '50%',
  border: '2px solid rgba(255,255,255,0.6)',
  background: 'rgba(255,255,255,0.15)',
}

const center: CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  textAlign: 'center',
  padding: '28px 36px',
  borderRadius: 24,
  background: 'rgba(1, 87, 155, 0.35)',
  backdropFilter: 'blur(4px)',
  width: 'min(420px, 86vw)',
  boxSizing: 'border-box',
}

const barOuter: CSSProperties = {
  height: 14,
  borderRadius: 7,
  background: 'rgba(255,255,255,0.25)',
  overflow: 'hidden',
  margin: '20px 0 6px',
}

const barInner: CSSProperties = {
  height: '100%',
  background: 'linear-gradient(90deg, #ffd166, #ff8a65)',
  transition: 'width 0.3s ease',
}
