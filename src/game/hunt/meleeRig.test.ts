import { describe, expect, it } from 'vitest'
import { MELEE_IDLE } from '../logic/melee'
import { meleeRig, resetMeleeRig } from './meleeRig'

describe('resetMeleeRig', () => {
  it('Game 을 다시 그리면(새 캔버스 시계는 0부터) 전 시계로 잡은 다음 공격 시각·휘두르기를 지운다', () => {
    Object.assign(meleeRig, { swing: { kind: 'knife', startedAt: 500, hitDone: false }, readyAt: 500.5, yaw: 1 })
    resetMeleeRig()
    expect(meleeRig).toMatchObject(MELEE_IDLE)
  })
})
