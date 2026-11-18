import { describe, expect, it } from 'vitest'
import { MAX_SHOT_ID } from '../logic/netProtocol'
import { newShotId } from './gunNet'

describe('newShotId (한 발 번호)', () => {
  it('쏠 때마다 다른 1 이상 정수, 상한을 넘으면 1 로 돌아간다', () => {
    const a = newShotId()
    const b = newShotId()
    expect(Number.isInteger(a) && a >= 1 && a <= MAX_SHOT_ID).toBe(true)
    expect(b).not.toBe(a)
  })
})
