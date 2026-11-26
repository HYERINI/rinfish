import { useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'

/** 그리기 측정을 붙일지: 개발 모드이거나, 배포된 주소 끝에 ?probe 를 붙였을 때 (예: .../?probe) */
export const PROBE = import.meta.env.DEV || new URLSearchParams(window.location.search).has('probe')
/** 화면에 측정 창(ProbeOverlay)을 띄울지: 주소에 ?probe 가 있을 때만 (개발 모드라도 주소에 붙여야 보인다) */
export const PROBE_OVERLAY = new URLSearchParams(window.location.search).has('probe')

/**
 * 직전 프레임에 그린 양. 브라우저 콘솔에 __render 라고 치면 보인다 (개발 모드, 또는 배포 주소에 ?probe 를 붙였을 때).
 * renderMs: 그리기 한 번(gl.render)에 CPU 가 쓴 시간. 화면 주사율에 막혀 FPS 가 같아도 드로우 콜이 줄면 준다
 */
export type RenderStats = { calls: number; triangles: number; lines: number; geometries: number; textures: number; renderMs: number }

declare global {
  interface Window {
    __render?: RenderStats
    /** 측정 도구(tools/render-measure.mjs)가 장면을 직접 살펴볼 때 쓴다: 그림자 끄기·구역 숨기기·물체별 집계 */
    __three?: { gl: unknown; scene: unknown; camera: unknown }
  }
}

/**
 * 그리기 측정 (개발 모드이거나 주소에 ?probe 가 있을 때만 붙인다): 직전 프레임의 드로우 콜·삼각형 수와 GPU 에 올라가 있는 형상·텍스처 수를 window.__render 에 적는다.
 * useFrame 은 그리기 전에 돌아서, 이때 읽는 renderer.info 는 직전 프레임 것이다. 화면엔 아무것도 그리지 않는다
 */
export function RenderProbe() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  window.__three = { gl, scene, camera }
  useEffect(() => {
    // 그리기 한 번의 CPU 시간을 잰다 (원래 함수를 감싸고, 떼면 되돌린다)
    const orig = gl.render
    gl.render = function (...args) {
      const t = performance.now()
      orig.apply(this, args)
      if (window.__render) window.__render.renderMs = performance.now() - t
    }
    return () => {
      gl.render = orig
    }
  }, [gl])
  useFrame(() => {
    const { render, memory } = gl.info
    const out = (window.__render ??= { calls: 0, triangles: 0, lines: 0, geometries: 0, textures: 0, renderMs: 0 })
    out.calls = render.calls
    out.triangles = render.triangles
    out.lines = render.lines
    out.geometries = memory.geometries
    out.textures = memory.textures
  })
  return null
}
