import { useMemo, useRef, useState } from 'react'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { BufferGeometry, Line, LineBasicMaterial, Vector3, type Group, type Mesh, type Object3D } from 'three'
import { CHARACTER_BASE_HEIGHT } from '../data/characters'
import { NET } from '../data/net'
import type { CharacterLook } from '../data/types'
import { saggingLinePoint } from '../logic/castArc'
import { sampleAt } from '../logic/interpolate'
import { netNow, remoteRig } from '../net/remoteRig'
import { BENCH_SEAT_SHAPE } from './facilities/benchShape'
import { bubbleStyle, nameTagStyle } from './nameTag'
import { FOOT_Y } from './Player'
import { PlayerModel, type PlayerModelHandle } from './PlayerModel'

const LINE_POINTS = 16
// 매 프레임 new 하지 않도록 재사용
const grip = new Vector3()
const tip = new Vector3()
const point = new Vector3()


/**
 * 다른 사람 한 명. 받은 state 를 조금 늦은 시점(NET.interpDelay)에서 이어 그리고, 내 캐릭터와 같은 PlayerModel 로 자세를 잡는다.
 * shown(): 폰에서 가까운 몇 명만 그릴 때 이 사람을 그릴지
 */
export function RemotePlayer({ id, nick, look, shown }: { id: string; nick: string; look: CharacterLook; shown: () => boolean }) {
  const root = useRef<Group>(null)
  const visual = useRef<Group>(null)
  const model = useRef<PlayerModelHandle>(null)
  const rod = useRef<Group>(null)
  const rodTip = useRef<Object3D>(null)
  const bobber = useRef<Mesh>(null)
  const lineRef = useRef<Line>(null)
  const [bubble, setBubble] = useState('')
  /** 지금 그리는 중인가. drei Html 은 부모가 숨겨져도 글씨가 남아서, 그리지 않을 땐 이름표를 아예 빼야 한다 */
  const [drawn, setDrawn] = useState(false)
  const line = useMemo(() => {
    const l = new Line(new BufferGeometry().setFromPoints(Array.from({ length: LINE_POINTS }, () => new Vector3())), new LineBasicMaterial({ color: 'white' }))
    l.frustumCulled = false
    l.visible = false
    return l
  }, [])

  useFrame((_, delta) => {
    const e = remoteRig.get(id)
    const now = netNow()
    const cur = e && shown() ? sampleAt(e.buf, now - NET.interpDelay) : null
    const ln = lineRef.current
    if (!root.current || !visual.current || !ln) return
    root.current.visible = cur !== null
    if ((cur !== null) !== drawn) setDrawn(cur !== null)
    ln.visible = false
    if (bobber.current) bobber.current.visible = false
    if (!cur || !e) return
    const s = cur.s
    root.current.position.set(cur.x, cur.y, cur.z)
    visual.current.rotation.y = cur.f
    // 말풍선: 바뀌었을 때만 React 상태를 바꾼다
    const text = e.bubble && now - e.bubble.at < NET.bubbleSeconds ? e.bubble.text : ''
    if (text !== bubble) setBubble(text)

    const m = model.current
    if (!m || !rod.current) return
    // 골반은 벤치 자리에 붙인다(앉아 있으면). 내 캐릭터와 같은 값으로 그린다
    m.update(delta, now, s.fish, e.action, cur.v, s.rod, s.rest, BENCH_SEAT_SHAPE)
    rod.current.visible = s.rodOn
    rod.current.rotation.x = s.rod
    visual.current.updateWorldMatrix(true, false)
    m.gripPosition(grip)
    rod.current.position.copy(visual.current.worldToLocal(grip))
    // 찌와 낚싯줄 (낚싯대 끝 → 찌)
    if (s.bob && bobber.current && rodTip.current) {
      bobber.current.position.set(s.bob[0], s.bob[1], s.bob[2])
      bobber.current.visible = true
      rodTip.current.getWorldPosition(tip)
      const positions = ln.geometry.attributes.position
      for (let i = 0; i < LINE_POINTS; i++) {
        saggingLinePoint(tip, bobber.current.position, i / (LINE_POINTS - 1), 0.2, point)
        positions.setXYZ(i, point.x, point.y, point.z)
      }
      positions.needsUpdate = true
      ln.visible = true
    }
  })

  const headY = FOOT_Y + CHARACTER_BASE_HEIGHT * look.height + 0.35
  return (
    <>
      <group ref={root} visible={false}>
        <group ref={visual}>
          <group position={[0, FOOT_Y, 0]}>
            <PlayerModel ref={model} look={look} />
          </group>
          {/* 낚싯대: 내 캐릭터와 같은 모양. 위치는 매 프레임 손으로 옮긴다 */}
          <group ref={rod}>
            <mesh position={[0, 0.85, 0]} castShadow>
              <cylinderGeometry args={[0.015, 0.035, 2.3]} />
              <meshStandardMaterial color="#6d4c41" />
            </mesh>
            <object3D ref={rodTip} position={[0, 2, 0]} />
          </group>
        </group>
        {drawn && (
          <Html center position={[0, headY, 0]} zIndexRange={[50, 0]}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {bubble && <div style={bubbleStyle}>{bubble}</div>}
              <div style={nameTagStyle}>{nick}</div>
            </div>
          </Html>
        )}
      </group>
      <mesh ref={bobber} visible={false}>
        <sphereGeometry args={[0.15, 12, 12]} />
        <meshStandardMaterial color="#e63946" />
      </mesh>
      <primitive ref={lineRef} object={line} />
    </>
  )
}
