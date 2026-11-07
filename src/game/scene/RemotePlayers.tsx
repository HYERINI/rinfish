import { useRef, useState } from 'react'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { CHARACTER_BASE_HEIGHT } from '../data/characters'
import { NET } from '../data/net'
import { useQualityLevel } from '../input/touchDevice'
import { netNow, remoteRig, selfBubble } from '../net/remoteRig'
import { useNetStore } from '../stores/netStore'
import { useProgressStore } from '../stores/progressStore'
import { FOOT_Y, playerRig } from './Player'
import { bubbleStyle } from './nameTag'
import { RemotePlayer } from './RemotePlayer'

/** 그릴 사람을 다시 고르는 간격(초) */
const PICK_EVERY = 1

/** 방에 있는 다른 사람들과 내 말풍선. 폰(quality low)에선 가까운 NET.lowQualityMaxRemote 명만 그린다 */
export function RemotePlayers() {
  const peers = useNetStore((s) => s.peers)
  const low = useQualityLevel() === 'low'
  const picked = useRef({ at: -Infinity, ids: new Set<string>() })

  useFrame(() => {
    const now = netNow()
    if (now - picked.current.at < PICK_EVERY) return
    picked.current.at = now
    const dist = (id: string) => {
      const last = remoteRig.get(id)?.buf.at(-1)?.s.p
      return last ? Math.hypot(last[0] - playerRig.position.x, last[2] - playerRig.position.z) : Infinity
    }
    const ids = Object.keys(useNetStore.getState().peers).sort((a, b) => dist(a) - dist(b))
    picked.current.ids = new Set(low ? ids.slice(0, NET.lowQualityMaxRemote) : ids)
  })

  return (
    <>
      {Object.entries(peers).map(([id, p]) => (
        // 성별이 바뀌면 다른 모델 파일이라 새로 만든다
        <RemotePlayer key={`${id}:${p.look.gender}`} id={id} nick={p.nick} look={p.look} shown={() => picked.current.ids.has(id) || !picked.current.ids.size} />
      ))}
      <SelfBubble />
    </>
  )
}

/** 내가 한 말 말풍선 (내 머리 위) */
function SelfBubble() {
  const group = useRef<Group>(null)
  const [text, setText] = useState('')
  const height = useProgressStore((s) => s.look?.height ?? 1)
  useFrame(() => {
    const t = netNow() - selfBubble.at < NET.bubbleSeconds ? selfBubble.text : ''
    if (t !== text) setText(t)
    group.current?.position.set(playerRig.position.x, playerRig.position.y + FOOT_Y + CHARACTER_BASE_HEIGHT * height + 0.45, playerRig.position.z)
  })
  return (
    <group ref={group}>
      {text && (
        <Html center zIndexRange={[50, 0]}>
          <div style={bubbleStyle}>{text}</div>
        </Html>
      )}
    </group>
  )
}
