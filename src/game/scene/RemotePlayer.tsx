import { useMemo, useRef, useState } from 'react'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { BufferGeometry, Line, LineBasicMaterial, Vector3, type Group, type Mesh, type Object3D } from 'three'
import { BOAT_FLOOR, BOAT_SEAT_SHAPE } from '../data/boat'
import { CHARACTER_BASE_HEIGHT } from '../data/characters'
import { isGun, type GunId } from '../data/guns'
import { NET } from '../data/net'
import type { CharacterLook } from '../data/types'
import { saggingLinePoint } from '../logic/castArc'
import { sampleAt } from '../logic/interpolate'
import { remoteMode } from '../logic/netProtocol'
import { shownTool } from '../logic/playerMotion'
import { netNow, remoteRig } from '../net/remoteRig'
import { BoatModel } from './boat/BoatModel'
import { BENCH_SEAT_SHAPE } from './facilities/benchShape'
import { bubbleStyle, nameTagStyle } from './nameTag'
import { FOOT_Y } from './Player'
import { PlayerModel, type PlayerModelHandle } from './PlayerModel'
import { GunModel } from './tools/GunModel'
import { KnifeModel } from './tools/KnifeModel'

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
  const knife = useRef<Group>(null)
  const gun = useRef<Group>(null)
  /** 남이 든 총 (바뀔 때만 React 상태를 바꾼다) */
  const [gunId, setGunId] = useState<GunId | null>(null)
  const boatRef = useRef<Group>(null)
  const rodTip = useRef<Object3D>(null)
  const bobber = useRef<Mesh>(null)
  const lineRef = useRef<Line>(null)
  const [bubble, setBubble] = useState('')
  /** 이름표 아래 체력 막대 (모습의 hp. 옛 클라이언트면 없다) */
  const [hp, setHp] = useState<number | null>(null)
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
    if (boatRef.current) boatRef.current.visible = s.boat !== undefined
    root.current.position.set(cur.x, cur.y, cur.z)
    visual.current.rotation.y = cur.f
    // 말풍선: 바뀌었을 때만 React 상태를 바꾼다
    const text = e.bubble && now - e.bubble.at < NET.bubbleSeconds ? e.bubble.text : ''
    if (text !== bubble) setBubble(text)
    const life = s.hp ?? null
    if (life !== hp) setHp(life)

    const m = model.current
    if (!m || !rod.current) return
    // 골반은 벤치·배 가로대에 붙인다(앉아 있으면). 내 캐릭터와 같은 값으로 그린다
    m.update(delta, now, s.fish, e.action, cur.v, s.rod, s.rest, s.boat ? BOAT_SEAT_SHAPE : BENCH_SEAT_SHAPE)
    rod.current.visible = s.rodOn
    rod.current.rotation.x = s.rod
    visual.current.updateWorldMatrix(true, false)
    m.gripPosition(grip)
    rod.current.position.copy(visual.current.worldToLocal(grip))
    // 남이 든 칼·총 (낚싯대는 rodOn 이 정한다). 앉았거나 침대에 누웠거나 감정 표현·점프·먹는 중엔 숨긴다
    const held = shownTool(remoteMode(s), Infinity, e.action, s.tool ?? null)
    if (knife.current) {
      knife.current.visible = held === 'knife'
      knife.current.position.copy(rod.current.position)
      knife.current.rotation.x = s.rod
    }
    const nextGun = isGun(s.tool) ? s.tool : null
    if (nextGun !== gunId) setGunId(nextGun)
    if (gun.current) {
      gun.current.visible = isGun(held)
      gun.current.position.copy(rod.current.position)
    }
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
          {/* 배 타는 사람은 배째로 (원점 = 물 높이, 발에서 배 바닥만큼 아래) */}
          <group ref={boatRef} position={[0, FOOT_Y - BOAT_FLOOR, 0]} visible={false}>
            <BoatModel />
          </group>
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
          <group ref={knife} visible={false}>
            <KnifeModel />
          </group>
          {gunId && (
            <group ref={gun} visible={false}>
              <GunModel id={gunId} />
            </group>
          )}
        </group>
        {drawn && (
          <Html center position={[0, headY, 0]} zIndexRange={[50, 0]}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {bubble && <div style={bubbleStyle}>{bubble}</div>}
              <div style={nameTagStyle}>{nick}</div>
              {hp !== null && (
                <div style={hpTrack} aria-label={`체력 ${hp}`}>
                  <div style={{ width: `${hp}%`, height: '100%', background: hpColor(hp) }} />
                </div>
              )}
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

/** 은지 이름표 체력 막대: 50 넘으면 초록, 25 넘으면 노랑, 그 아래 빨강 */
const hpColor = (hp: number) => (hp > 50 ? '#6fdc6f' : hp > 25 ? '#ffc94d' : '#ff5a5a')
const hpTrack = { width: 48, height: 5, marginTop: 2, borderRadius: 3, overflow: 'hidden', background: 'rgba(0,0,0,0.5)' } as const
