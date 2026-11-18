import { useEffect, useState, type CSSProperties } from 'react'
import { gunRig } from '../guns/gunRig'
import { playerRig } from '../scene/Player'

const svg = (name: string) => `url(${import.meta.env.BASE_URL}meadow/models/crosshair/${name}.svg)`
/** 조준경 구멍 반지름 (화면 짧은 변 대비) */
const LENS = '44vmin'

/** 가운데 둥근 구멍만 비운 가림막 */
const lensHole = `radial-gradient(circle at center, transparent ${LENS}, #fff calc(${LENS} + 1px))`

type Optic = { kind: 'scope' | 'holo'; label: string } | null

/**
 * 소총·저격총으로 조준하는 동안 (1인칭): 배율 단계(2.5x·4x·8x)면 둥근 조준경 화면 + 십자선 (Kenney Crosshair Pack, CC0),
 * 소총 홀로(1x)면 화면 가운데 빨간 고리. 은지는 렌즈에 확대 화면을 따로 그렸지만 우리는 FOV 를 좁히고 화면을 덮는다 (한 번만 그린다)
 */
export function ScopeOverlay() {
  const [optic, setOptic] = useState<Optic>(null)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const o = gunRig.optic && playerRig.firstPerson ? gunRig.optic : null
      const next: Optic = o ? { kind: o.mag > 1 ? 'scope' : 'holo', label: o.label } : null
      setOptic((prev) => (prev?.kind === next?.kind && prev?.label === next?.label ? prev : next))
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  if (!optic) return null
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 998 }} aria-label={`조준경 ${optic.label}`}>
      {optic.kind === 'scope' ? (
        <>
          {/* 둥근 구멍 바깥을 까맣게 덮는다 */}
          <div style={{ position: 'absolute', inset: 0, background: '#0a0a0a', mask: lensHole, WebkitMask: lensHole }} />
          <div style={{ ...centered, width: `calc(2 * ${LENS})`, height: `calc(2 * ${LENS})`, background: 'rgba(0,0,0,0.92)', mask: `${svg('scope')} center / contain no-repeat`, WebkitMask: `${svg('scope')} center / contain no-repeat` }} />
          <div style={{ ...centered, width: 6, height: 6, borderRadius: '50%', background: 'rgba(200,0,0,0.9)' }} />
        </>
      ) : (
        <div style={{ ...centered, width: 96, height: 96, background: '#ff4040', filter: 'drop-shadow(0 0 4px rgba(255,70,70,1))', mask: `${svg('holo')} center / contain no-repeat`, WebkitMask: `${svg('holo')} center / contain no-repeat` }} />
      )}
      <div style={{ position: 'absolute', left: '50%', bottom: '12%', transform: 'translateX(-50%)', color: '#fff', fontSize: 14, textShadow: '0 1px 2px #000' }}>배율 {optic.label} · 휠로 바꾸기</div>
    </div>
  )
}

const centered: CSSProperties = { position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
