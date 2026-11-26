import { useFrame, useThree } from '@react-three/fiber'

/** 직전 프레임에 그린 양. 브라우저 콘솔에 __render 라고 치면 보인다 (개발 모드, 또는 배포 주소에 ?probe 를 붙였을 때) */
export type RenderStats = { calls: number; triangles: number; lines: number; geometries: number; textures: number }

declare global {
  interface Window {
    __render?: RenderStats
  }
}

/**
 * 그리기 측정 (개발 모드이거나 주소에 ?probe 가 있을 때만 붙인다): 직전 프레임의 드로우 콜·삼각형 수와 GPU 에 올라가 있는 형상·텍스처 수를 window.__render 에 적는다.
 * useFrame 은 그리기 전에 돌아서, 이때 읽는 renderer.info 는 직전 프레임 것이다. 화면엔 아무것도 그리지 않는다
 */
export function RenderProbe() {
  const gl = useThree((s) => s.gl)
  useFrame(() => {
    const { render, memory } = gl.info
    const out = (window.__render ??= { calls: 0, triangles: 0, lines: 0, geometries: 0, textures: 0 })
    out.calls = render.calls
    out.triangles = render.triangles
    out.lines = render.lines
    out.geometries = memory.geometries
    out.textures = memory.textures
  })
  return null
}
