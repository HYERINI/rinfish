import { useRef } from 'react'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { DEFAULT_LOOK, LOOK_PRESETS } from '../game/data/characterParts'
import { MEADOW_VENDORS, toWorld } from '../game/data/meadow'
import { IDLE_ACTION } from '../game/logic/playerMotion'
import { PlayerModel, type PlayerModelHandle } from '../game/scene/PlayerModel'
import { useSessionStore } from '../game/stores/sessionStore'

/** 상인 팔 각도 (낚싯대 기본 자세와 같은 값. 들고 있는 건 없다) */
const ARM_REST = 0.5

/** 상인 한 명: 노점 뒤에 서서 분수 쪽(세계 +z)을 보고 숨 쉬는 자세. 가게 앞에 오면 이름표 */
function Vendor({ vendor }: { vendor: (typeof MEADOW_VENDORS)[number] }) {
  const model = useRef<PlayerModelHandle>(null)
  const look = LOOK_PRESETS.find((p) => p.id === vendor.look)?.look ?? DEFAULT_LOOK
  const near = useSessionStore((s) => s.nearby?.kind === 'vendor' && s.nearby.id === vendor.id)
  const [x, z] = toWorld(...vendor.npc)
  useFrame(({ clock }, delta) => model.current?.update(delta, clock.elapsedTime, null, IDLE_ACTION, 0, ARM_REST, false))
  return (
    <group position={[x, 0, z]}>
      <PlayerModel ref={model} look={look} />
      {near && (
        <Html center position={[0, 2.1, 0]} zIndexRange={[100, 0]} style={nameTag}>
          {vendor.name}
        </Html>
      )}
    </group>
  )
}

/** 마을 상인 3명 (은지 상인 모델 대신 낚시섬 캐릭터 프리셋) */
export function MeadowVendors() {
  return (
    <>
      {MEADOW_VENDORS.map((v) => (
        <Vendor key={v.id} vendor={v} />
      ))}
    </>
  )
}

const nameTag = {
  pointerEvents: 'none' as const,
  whiteSpace: 'nowrap' as const,
  background: 'rgba(255,255,255,0.9)',
  color: '#33691e',
  padding: '2px 8px',
  borderRadius: 10,
  fontSize: 12,
  fontWeight: 800,
}
