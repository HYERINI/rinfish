import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { boatProgress } from '../logic/boatRoute'
import { fishingLook } from '../logic/characterPose'
import { netHp, roundState, stateKey, stateSendDue, toNetAct, type NetState } from '../logic/netProtocol'
import { NET } from '../data/net'
import { playerRig } from '../scene/Player'
import { sendRate } from './netStats'
import { fishingFx } from '../scene/fishing/fishingFx'
import { useFishingStore } from '../stores/fishingStore'
import { useNetStore } from '../stores/netStore'
import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'

/**
 * 캔버스 안에서 내 모습을 방에 보낸다: 바뀐 게 있으면 초당 최대 NET.sendHz 번(서버가 ping 에 답하면 NET.fastSendHz), 없으면 NET.idleSendEvery 초마다
 * (들판 근처는 그대로여도 동물 간격으로. 든 도구가 바뀌면 바로. stateSendDue). NET.pingEvery 초마다 왕복 시간도 잰다.
 * 옷을 바꾸면 profile 도 보낸다. 같이 하는 중이 아니면 아무것도 하지 않는다
 */
export function NetBridge() {
  const last = useRef<{ at: number; key: string; tool: string | null }>({ at: -Infinity, key: '', tool: null })
  const pingAt = useRef(-Infinity)

  useEffect(
    () =>
      useProgressStore.subscribe((s, prev) => {
        const net = useNetStore.getState()
        if (s.look && s.look !== prev.look && net.phase === 'online') net.sendProfile(net.nick, s.look)
      }),
    [],
  )

  useFrame(({ clock }) => {
    if (useNetStore.getState().phase !== 'online') {
      last.current.at = -Infinity
      pingAt.current = -Infinity
      return
    }
    const now = clock.elapsedTime
    if (now - pingAt.current >= NET.pingEvery) {
      pingAt.current = now
      useNetStore.getState().sendPing()
    }
    const bob = fishingFx.bobber
    const session = useSessionStore.getState()
    const raw: NetState = {
      p: [playerRig.position.x, playerRig.position.y, playerRig.position.z],
      f: playerRig.facing,
      v: playerRig.speed,
      rest: playerRig.resting,
      fish: fishingLook(useFishingStore.getState().state),
      rod: playerRig.rodAngle,
      rodOn: playerRig.rodShown,
      bob: bob?.visible ? [bob.position.x, bob.position.y, bob.position.z] : null,
      act: toNetAct(session.playerAction, now),
    }
    // 배 타는 동안 내내 보낸다 (mode 는 잠깐 lobby·menu 일 수 있어 session.boat 기준)
    if (session.boat) raw.boat = { dir: session.boat.dir, t: boatProgress(performance.now() / 1000 - session.boat.startedAt) }
    if (session.tool) raw.tool = session.tool
    // 침대에 누워 있으면 (잠 투표·쓰러져 깨어나는 중) 남의 화면에서도 든 도구를 숨긴다
    if (session.mode === 'sleep') raw.sleep = true
    // 이름표 아래 체력 막대 (5 단위로 보내서 회복 중에도 모습을 자주 다시 보내지 않는다)
    raw.hp = netHp(useProgressStore.getState().survival.stamina)
    const s = roundState(raw)
    const key = stateKey(s)
    const since = now - last.current.at
    const tool = s.tool ?? null
    if (stateSendDue(s, key !== last.current.key, since, tool !== last.current.tool, sendRate())) {
      last.current = { at: now, key, tool }
      useNetStore.getState().sendState(s)
    }
  })
  return null
}
