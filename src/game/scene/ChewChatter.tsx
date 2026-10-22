import { useState } from 'react'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { CHEW_WORDS } from '../data/balance'
import { playChew } from '../audio/sfx'
import { chewBite } from '../logic/characterPose'
import { useSessionStore } from '../stores/sessionStore'

/** 한 입마다 바뀌는 글자 위치 (머리 위 좌우로 번갈아) */
const OFFSETS = [-34, 30, -18, 40]

/**
 * 먹는 동안 머리 위에 "아구작 아구작 냠냠 쩝쩝"을 한 입마다 하나씩 띄우고 씹는 소리를 낸다.
 * 한 입 순서는 순수 함수 chewBite 가 정한다
 */
export function ChewChatter() {
  const [bite, setBite] = useState(-1)
  useFrame(() => {
    const next = chewBite(useSessionStore.getState().playerAction, performance.now() / 1000)
    if (next === bite) return
    setBite(next)
    if (next >= 0) playChew(CHEW_WORDS[next % CHEW_WORDS.length] === '쩝쩝' ? 0.5 : 1)
  })

  // 지금 한 입 + 바로 전 한 입까지 보여 줘서 "아구작 아구작" 처럼 이어져 보이게
  const shown = bite < 0 ? [] : [bite - 1, bite].filter((i) => i >= 0)
  return (
    <Html position={[0, 1.15, 0]} center zIndexRange={[100, 0]} style={{ pointerEvents: 'none' }}>
      <style>{'@keyframes chew-pop { 0% { transform: translate(-50%, 0) scale(0.6); opacity: 1 } 35% { transform: translate(-50%, -10px) scale(1.25); opacity: 1 } 100% { transform: translate(-50%, -22px) scale(1); opacity: 1 } }'}</style>
      <div style={{ position: 'relative', width: 0, height: 0 }}>
        {shown.map((i) => (
          <div
            key={i}
            style={{
              ...wordStyle,
              left: OFFSETS[i % OFFSETS.length],
              top: i === bite ? -6 : 8,
              fontSize: i === bite ? 22 : 16,
              opacity: i === bite ? 1 : 0.6,
            }}
          >
            {CHEW_WORDS[i % CHEW_WORDS.length]}
          </div>
        ))}
      </div>
    </Html>
  )
}

const wordStyle = {
  position: 'absolute' as const,
  whiteSpace: 'nowrap' as const,
  color: '#fff',
  fontWeight: 900,
  textShadow: '0 0 3px #e65100, 2px 2px 0 #e65100',
  animation: 'chew-pop 0.45s ease-out forwards',
}
