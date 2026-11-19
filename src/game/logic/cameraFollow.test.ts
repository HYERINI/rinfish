import { describe, expect, it } from 'vitest'
import { CAMERA_ZOOM, NEAR_VIEW } from '../data/balance'
import { AIM_VIEW } from '../data/guns'
import { MEADOW_DOCK, MEADOW_RECT } from '../data/meadow'
import { ISLAND_RADIUS } from '../data/zones'
import { cameraView, followCamera, inMeadowView, isArmed, orbitOffset, type CameraViewInput } from './cameraFollow'
import { cameraRig } from './playerMotion'

const view = (over: Partial<CameraViewInput> = {}) =>
  cameraView({ inMeadow: false, mode: 'explore', tool: 'rod', zoom: CAMERA_ZOOM.initial, meadowZoom: NEAR_VIEW.meadowInitial, aiming: false, ...over })

describe('초원·무기 가까운 시점 (cameraView)', () => {
  it('섬에서 낚싯대를 들면 예전 그대로 (섬 줌, 높게)', () => {
    expect(view()).toEqual({ distance: CAMERA_ZOOM.initial, low: 0 })
    expect(view({ mode: 'fishing', tool: 'pistol' })).toEqual({ distance: CAMERA_ZOOM.initial, low: 0 })
  })
  it('초원에선 초원 줌(기본 4m)으로 낮게. 섬 줌은 상관없다', () => {
    expect(view({ inMeadow: true })).toEqual({ distance: NEAR_VIEW.meadowInitial, low: 1 })
    expect(view({ inMeadow: true, zoom: 2, meadowZoom: 7 })).toEqual({ distance: 7, low: 1 })
  })
  it('주먹·칼·총을 들고 돌아다니면 4m 보다 멀지 않게, 낮게 (섬에서도)', () => {
    for (const tool of ['fists', 'knife', 'pistol', 'sniper'] as const) {
      expect(view({ tool })).toEqual({ distance: NEAR_VIEW.armedMax, low: 1 })
      expect(view({ tool, inMeadow: true, meadowZoom: 8 }).distance).toBe(NEAR_VIEW.armedMax)
    }
    // 이미 더 가까이 당겼으면 그대로
    expect(view({ tool: 'knife', zoom: 2.5 }).distance).toBe(2.5)
  })
  it('총으로 조준하면 조준 거리까지 당긴다 (칼은 조준이 없다)', () => {
    expect(view({ tool: 'pistol', aiming: true }).distance).toBe(AIM_VIEW.aimDistance)
    expect(view({ tool: 'knife', aiming: true }).distance).toBe(NEAR_VIEW.armedMax)
  })
  it('무기는 돌아다닐 때만 (낚시·배·쉬기 중엔 아니다)', () => {
    expect(isArmed('explore', 'pistol')).toBe(true)
    expect(isArmed('boat', 'pistol')).toBe(false)
    expect(isArmed('explore', 'rod')).toBe(false)
    expect(isArmed('explore', null)).toBe(false)
  })
  it('초원 카메라는 섬과 초원 사이 바다 가운데부터 (초원 선착장 포함, 섬은 아니다)', () => {
    expect(inMeadowView(MEADOW_RECT.x0 + 10)).toBe(true)
    expect(inMeadowView(MEADOW_DOCK.x0)).toBe(true)
    expect(inMeadowView(ISLAND_RADIUS)).toBe(false)
    expect(inMeadowView(0)).toBe(false)
  })
})

describe('카메라 따라가기', () => {
  it('마우스로 돌린 방향은 그 프레임에 바로: 오프셋은 지금 yaw 쪽, 거리는 그대로 (현을 따라 몸 쪽으로 파고들지 않는다)', () => {
    const h = 1.8
    const a = orbitOffset(0, 0, 4, 1, h)
    const b = orbitOffset(Math.PI / 2, 0, 4, 1, h)
    expect(Math.hypot(a.x, a.z)).toBeCloseTo(4)
    expect(Math.hypot(b.x, b.z)).toBeCloseTo(4)
    expect(b.x).toBeCloseTo(4)
    expect(b.z).toBeCloseTo(0)
    expect(b.y).toBeCloseTo(a.y)
  })
  it('거리·낮춤·발 높이·어깨만 부드럽게 따라간다. 첫 프레임은 바로', () => {
    const target = { distance: 4, low: 1, feetY: 1, shoulder: 0.65 }
    expect(followCamera(null, target, 1 / 60)).toEqual(target)
    const prev = { distance: 10, low: 0, feetY: 0, shoulder: 0 }
    const next = followCamera(prev, target, 1 / 60)
    expect(next.distance).toBeLessThan(10)
    expect(next.distance).toBeGreaterThan(4)
    expect(next.low).toBeGreaterThan(0)
    expect(next.low).toBeLessThan(1)
    // 1초면 거의 다 왔다
    let s = prev
    for (let i = 0; i < 60; i++) s = followCamera(s, target, 1 / 60)
    expect(s.distance).toBeCloseTo(4, 1)
  })
  it('가까운 시점(low 1)은 같은 거리에서 카메라가 더 낮다 (은지 어깨 높이 쪽)', () => {
    const high = cameraRig(4, 1.8, 0)
    const low = cameraRig(4, 1.8, 1)
    expect(low.lookAtY).toBeCloseTo(high.lookAtY)
    expect(low.height).toBeLessThan(high.height)
    // 내려다보는 각도가 은지(0.35 rad) 근처
    const pitch = Math.atan2(low.height - low.lookAtY, 4)
    expect(pitch).toBeGreaterThan(0.2)
    expect(pitch).toBeLessThan(0.4)
  })
})
