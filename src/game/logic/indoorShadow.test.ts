import { describe, expect, it } from 'vitest'
import { insideRoom } from './indoorShadow'

const ROOMS = [{ minX: -5, maxX: 5, minZ: -5, maxZ: 5 }]
const box = (minX: number, maxX: number, minZ: number, maxZ: number, maxY = 1) => ({ min: { x: minX, y: 0, z: minZ }, max: { x: maxX, y: maxY, z: maxZ } })

describe('insideRoom (그림자가 지붕·바깥벽 그림자에 가려 안 보이는 실내 물체)', () => {
  it('방 안에 다 들어 있는 가구는 실내', () => {
    expect(insideRoom(box(-1, 1, -1, 1), ROOMS, 3)).toBe(true)
  })
  it('방 경계(벽 두께 안)에 걸친 벽·문은 실내가 아니다 (그림자가 밖으로 나갈 수 있다)', () => {
    expect(insideRoom(box(4.9, 5.1, -5, 5), ROOMS, 3)).toBe(false)
    expect(insideRoom(box(-5.08, -4.92, -1, 1), ROOMS, 3)).toBe(false)
  })
  it('천장보다 높이 솟은 것(지붕)은 실내가 아니다', () => {
    expect(insideRoom(box(-1, 1, -1, 1, 3.3), ROOMS, 3)).toBe(false)
  })
  it('방 밖 물체는 실내가 아니다', () => {
    expect(insideRoom(box(8, 9, 0, 1), ROOMS, 3)).toBe(false)
  })
})
