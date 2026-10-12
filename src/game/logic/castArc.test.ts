import { describe, expect, it } from 'vitest'
import { arcPoint, castArcHeight, castFlightTime, saggingLinePoint, type Vec3 } from './castArc'

const from: Vec3 = { x: 0, y: 2, z: 0 }
const to: Vec3 = { x: 0, y: -0.3, z: 10 }
const out = (): Vec3 => ({ x: 0, y: 0, z: 0 })

function expectNear(a: Vec3, b: Vec3) {
  expect(a.x).toBeCloseTo(b.x)
  expect(a.y).toBeCloseTo(b.y)
  expect(a.z).toBeCloseTo(b.z)
}

describe('arcPoint', () => {
  it('t=0 이면 출발점, t=1 이면 도착점', () => {
    expectNear(arcPoint(from, to, 0, 3, out()), from)
    expectNear(arcPoint(from, to, 1, 3, out()), to)
  })

  it('중간에서는 두 점을 잇는 직선보다 height 만큼 높다', () => {
    const p = arcPoint(from, to, 0.5, 3, out())
    expect(p.z).toBeCloseTo(5)
    expect(p.y).toBeCloseTo((from.y + to.y) / 2 + 3)
  })

  it('t가 범위를 벗어나면 끝점에 머문다', () => {
    expectNear(arcPoint(from, to, 1.7, 3, out()), to)
    expectNear(arcPoint(from, to, -1, 3, out()), from)
  })
})

describe('saggingLinePoint', () => {
  it('양 끝은 두 점과 같다', () => {
    expectNear(saggingLinePoint(from, to, 0, 1, out()), from)
    expectNear(saggingLinePoint(from, to, 1, 1, out()), to)
  })

  it('가운데가 sag 만큼 아래로 처진다', () => {
    expect(saggingLinePoint(from, to, 0.5, 1, out()).y).toBeCloseTo((from.y + to.y) / 2 - 1)
    expect(saggingLinePoint(from, to, 0.5, 0, out()).y).toBeCloseTo((from.y + to.y) / 2)
  })
})

describe('비행 시간과 높이', () => {
  it('멀리 던질수록 오래, 높이 난다', () => {
    expect(castFlightTime(16)).toBeGreaterThan(castFlightTime(4))
    expect(castArcHeight(16)).toBeGreaterThan(castArcHeight(4))
  })
})
