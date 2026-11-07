import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { NET } from '../data/net'
import { fishingLook } from '../logic/characterPose'
import { roundState, stateKey, toNetAct, type NetState } from '../logic/netProtocol'
import { playerRig } from '../scene/Player'
import { fishingFx } from '../scene/fishing/fishingFx'
import { useFishingStore } from '../stores/fishingStore'
import { useNetStore } from '../stores/netStore'
import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'

/**
 * 캔버스 안에서 내 모습을 방에 보낸다: 바뀐 게 있으면 초당 최대 NET.sendHz 번, 없으면 NET.idleSendEvery 초마다.
 * 옷을 바꾸면 profile 도 보낸다. 같이 하는 중이 아니면 아무것도 하지 않는다
 */
export function NetBridge() {
  const last = useRef({ at: -Infinity, key: '' })

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
      return
    }
    const now = clock.elapsedTime
    const bob = fishingFx.bobber
    const s: NetState = roundState({
      p: [playerRig.position.x, playerRig.position.y, playerRig.position.z],
      f: playerRig.facing,
      v: playerRig.speed,
      rest: playerRig.resting,
      fish: fishingLook(useFishingStore.getState().state),
      rod: playerRig.rodAngle,
      rodOn: playerRig.rodShown,
      bob: bob?.visible ? [bob.position.x, bob.position.y, bob.position.z] : null,
      act: toNetAct(useSessionStore.getState().playerAction, now),
    })
    const key = stateKey(s)
    const since = now - last.current.at
    if ((key !== last.current.key && since >= 1 / NET.sendHz) || since >= NET.idleSendEvery) {
      last.current = { at: now, key }
      useNetStore.getState().sendState(s)
    }
  })
  return null
}
