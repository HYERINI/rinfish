// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BED_WAKE } from '../../data/meadow'
import { seqEnd, seqSwitchAt } from '../../logic/restSeq'
import { liveClock, useDayStore } from '../../stores/dayStore'
import { useNetStore } from '../../stores/netStore'
import { INITIAL_PROGRESS, useProgressStore } from '../../stores/progressStore'
import { useSessionStore } from '../../stores/sessionStore'
import { ME, calmSolo, resetAnimalRig, setSoloHerd, soloHerd } from '../../hunt/animalRig'
import { hitAnimal } from '../../logic/animalSim'
import { startDeath, startSleep, stepRest, takeHit, wake } from './dayActions'

const day = () => useDayStore.getState()
const session = () => useSessionStore.getState()
const sendSleep = vi.fn()
const realSendSleep = useNetStore.getState().sendSleep

/** 화면이 다 어두워진 때와 끝난 때를 조금 넘겨 진행 (시작 시각 + 1.6 - 시작 시각 이 1.6 보다 작을 수 있다) */
const AFTER = 0.01
function runSeq() {
  const seq = day().seq!
  stepRest(seq.startedAt + seqSwitchAt(seq.kind) + AFTER)
  stepRest(seq.startedAt + seqEnd(seq.kind) + AFTER)
}

beforeEach(() => {
  localStorage.clear()
  sendSleep.mockClear()
  useNetStore.setState({ phase: 'off', sendSleep })
  useProgressStore.setState({ ...INITIAL_PROGRESS, clock: { t: 0.6, day: 2 }, survival: { stamina: 20, hunger: 50, graceLeft: null, buffs: [] } })
  session().resetSession()
  day().reset()
})

afterEach(() => {
  useNetStore.setState({ phase: 'off', sendSleep: realSendSleep })
})

describe('혼자 잠', () => {
  it('화면이 1초 어두워졌다가 다음 날 06:00, 체력 100, 배고픔 −15 (저장)', () => {
    startSleep()
    expect(session().mode).toBe('sleep')
    expect(day().seq?.kind).toBe('sleep')
    const seq = day().seq!
    stepRest(seq.startedAt + 0.5)
    expect(liveClock.day).toBe(2)
    stepRest(seq.startedAt + seqSwitchAt('sleep') + AFTER)
    expect(liveClock).toEqual({ t: 0, day: 3 })
    expect(useProgressStore.getState().clock).toEqual({ t: 0, day: 3 })
    expect(useProgressStore.getState().survival).toMatchObject({ stamina: 100, hunger: 35 })
    stepRest(seq.startedAt + seqEnd('sleep') + AFTER)
    expect(day().seq).toBeNull()
    expect(session().mode).toBe('explore')
  })

  it('어두워지는 중에 또 E 를 눌러도 한 번만, 일어나기(E·ESC)도 아무 일 없다', () => {
    startSleep()
    const first = day().seq
    startSleep()
    wake()
    expect(day().seq).toBe(first)
    expect(session().mode).toBe('sleep')
  })
})

describe('같이 하기 잠 투표', () => {
  it('누우면 sleep true 를 보내고 기다린다 (화면은 어두워지지 않는다). 일어나면 false', () => {
    useNetStore.setState({ phase: 'online' })
    day().toRoomClock({ tm: 100, day: 1 })
    startSleep(10)
    expect(sendSleep).toHaveBeenLastCalledWith(true)
    expect(day().voting).toBe(true)
    expect(day().seq).toBeNull()
    expect(session().mode).toBe('sleep')
    wake(11)
    expect(sendSleep).toHaveBeenLastCalledWith(false)
    expect(day().voting).toBe(false)
    expect(session().mode).toBe('explore')
  })

  it('눕기·일어나기는 0.3초에 한 번만 (서버는 초당 4번까지 센다)', () => {
    useNetStore.setState({ phase: 'online' })
    day().toRoomClock({ tm: 100, day: 1 })
    startSleep(10)
    wake(10.1)
    expect(day().voting).toBe(true)
    expect(sendSleep).toHaveBeenCalledTimes(1)
    wake(10.35)
    expect(day().voting).toBe(false)
    startSleep(10.5)
    expect(day().voting).toBe(false)
    startSleep(10.7)
    expect(day().voting).toBe(true)
    expect(sendSleep.mock.calls).toEqual([[true], [false], [true]])
  })

  it('다시 붙는 중엔 잘 수 없다', () => {
    day().toRoomClock({ tm: 100, day: 1 })
    useNetStore.setState({ phase: 'reconnecting' })
    startSleep()
    expect(day().seq).toBeNull()
    expect(day().voting).toBe(false)
    expect(session().notice?.text).toContain('잘 수 없어요')
  })
})

describe('죽음 → 침대', () => {
  it('혼자: 침대 옆으로, 체력 100·배고픔 60, 다음 날 06:00. 가방·코인·물고기는 그대로', () => {
    useProgressStore.setState({ coins: 77 })
    useProgressStore.getState().addCatch('sleepy-sardine', 0.2)
    startDeath()
    expect(session().mode).toBe('sleep')
    runSeq()
    expect(session().teleport).toEqual(BED_WAKE)
    expect(useProgressStore.getState().survival).toEqual({ stamina: 100, hunger: 60, graceLeft: null, buffs: [] })
    expect(useProgressStore.getState()).toMatchObject({ coins: 77, clock: { t: 0, day: 3 } })
    expect(useProgressStore.getState().inventory).toHaveLength(1)
    expect(session().mode).toBe('explore')
  })

  it('배 타는 중 죽으면 깨어날 때 배에서 내려 침대로 (순간이동이 배를 끝낸다)', () => {
    session().startBoat('toIsland')
    startDeath()
    expect(session().boat).not.toBeNull()
    runSeq()
    expect(session().boat).toBeNull()
    expect(session().teleport).toEqual(BED_WAKE)
    expect(session().mode).toBe('explore')
  })

  it('같이: 시간은 그대로 (방 시계·저장된 혼자 시계 모두), 잠 투표 중이었으면 깬다고 알린다', () => {
    useNetStore.setState({ phase: 'online' })
    day().toRoomClock({ tm: 100, day: 4 })
    startSleep()
    startDeath()
    expect(sendSleep).toHaveBeenLastCalledWith(false)
    expect(day().voting).toBe(false)
    runSeq()
    expect(liveClock.day).toBe(4)
    expect(useProgressStore.getState().clock).toEqual({ t: 0.6, day: 2 })
    expect(useProgressStore.getState().survival.hunger).toBe(60)
  })

  it('방 아침(화면 어두워짐) 중에 방을 나와도 혼자 시계·저장은 그대로', () => {
    day().toRoomClock({ tm: 100, day: 4 })
    day().roomMorning(5)
    expect(day().seq?.kind).toBe('morning')
    day().toSoloClock()
    runSeq()
    expect(liveClock).toEqual({ t: 0.6, day: 2 })
    expect(useProgressStore.getState().clock).toEqual({ t: 0.6, day: 2 })
    expect(useProgressStore.getState().survival).toMatchObject({ stamina: 20, hunger: 50 })
  })

  it('죽는 중에 또 죽어도 한 번만', () => {
    startDeath()
    const first = day().seq
    startDeath()
    expect(day().seq).toBe(first)
  })
})

describe('동물에게 맞기 (3-3)', () => {
  beforeEach(() => resetAnimalRig())

  it('맞으면 체력이 줄고 화면이 번쩍인다. 0 이 되면 죽음 (침대)', () => {
    takeHit(15)
    expect(useProgressStore.getState().survival.stamina).toBe(5)
    expect(session().hurtAt).not.toBeNull()
    expect(day().seq).toBeNull()
    takeHit(15)
    expect(day().seq?.kind).toBe('death')
    expect(session().mode).toBe('sleep')
  })
  it('피해가 0 이하·숫자가 아니면 번쩍이지 않는다', () => {
    for (const dmg of [0, -3, NaN]) takeHit(dmg)
    expect(session().hurtAt).toBeNull()
    expect(useProgressStore.getState().survival.stamina).toBe(20)
  })
  it('잠·죽음으로 어두워지는 동안엔 맞지 않는다', () => {
    startDeath()
    useProgressStore.setState({ survival: { stamina: 40, hunger: 50, graceLeft: null, buffs: [] } })
    takeHit(15)
    expect(useProgressStore.getState().survival.stamina).toBe(40)
  })
  it('죽으면 나를 쫓던 혼자 동물이 진정한다', () => {
    const cow = soloHerd().animals.find((a) => a.sp === 'cow')!
    setSoloHerd(hitAnimal(soloHerd(), cow.id, 1, ME).herd)
    expect(soloHerd().animals.find((a) => a.id === cow.id)?.state).toBe('attack')
    startDeath()
    expect(soloHerd().animals.find((a) => a.id === cow.id)?.state).toBe('idle')
    calmSolo()
  })
})
