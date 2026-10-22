import { useEffect, useRef } from 'react'
import { SPECTATOR } from '../data/aquariumVisitors'
import { spectatorPose } from '../logic/aquariumSpectators'

/** 관람객 그림자 색과 불투명도 (줄마다 조금씩 다른 어둠. 앞줄일수록 진하다). 팔·몸이 겹친 곳이 진해지지 않게 색은 불투명하게 칠하고 사람 전체에 불투명도를 준다 */
const SHADES = ['#030a16', '#06101f', '#040c1a', '#081426']
const OPACITY = [0.88, 0.76, 0.82, 0.72]
/** 줄마다 크기 (뒷줄은 조금 작다) */
const DEPTH = [1, 0.86, 0.94, 0.8]
/** 아이 키 배율 */
const KID = 0.64
/** 팔을 올리는 각도(도): 가리키기는 한 팔을 비스듬히 위로, 유리에 손 대기는 두 팔을 어깨 위로 */
const POINT_DEG = 135
const GLASS_DEG = 115

type FigureRefs = {
  root: HTMLDivElement | null
  body: SVGGElement | null
  armL: SVGRectElement | null
  armR: SVGRectElement | null
  legL: SVGRectElement | null
  legR: SVGRectElement | null
}

/**
 * 크게 보기 화면 아래쪽, 유리 앞을 지나가는 관람객 그림자. 실제 수족관처럼 등 돌린 어두운 사람 모양이 천천히 걷다가
 * 멈춰서 물고기를 보거나 가리키거나 유리에 손을 댄다. 화면 위에 얹은 SVG 라서 3D 비용이 없고, 누르기는 그대로 통과한다
 */
export function AquariumSpectators({ narrow }: { narrow: boolean }) {
  const lanes = narrow ? SPECTATOR.narrowLanes : SPECTATOR.lanes
  const figures = useRef<FigureRefs[]>([])

  useEffect(() => {
    let frame = 0
    const tick = () => {
      const time = performance.now() / 1000
      for (let lane = 0; lane < lanes; lane++) {
        const f = figures.current[lane]
        if (!f?.root) continue
        const p = spectatorPose(SPECTATOR.seed, lane, time)
        f.root.style.display = p.visible ? '' : 'none'
        if (!p.visible) continue
        const scale = DEPTH[lane % DEPTH.length] * (p.kid ? KID : 1)
        const bob = p.act === 'walk' ? -Math.abs(Math.sin(p.step)) * 3 : 0
        f.root.style.left = `${p.x * 100}%`
        f.root.style.height = `${scale * 100}%`
        f.root.dataset.kid = p.kid ? '1' : '0'
        f.root.dataset.variant = String(p.variant)
        f.body?.setAttribute('transform', `translate(0 ${bob})`)
        // 걸을 때 팔은 앞뒤로(뒤에서 보면 살짝 좌우로) 흔들고, 다리는 번갈아 든다
        const swing = p.act === 'walk' ? Math.sin(p.step) * 10 : 0
        // 가리키는 팔은 화면 가운데 쪽 팔
        const pointRight = p.x < 0.5
        let armL = swing
        let armR = -swing
        if (p.act === 'point') {
          if (pointRight) armR = -POINT_DEG * p.lift
          else armL = POINT_DEG * p.lift
        } else if (p.act === 'glass') {
          armL = GLASS_DEG * p.lift
          armR = -GLASS_DEG * p.lift
        }
        f.armL?.setAttribute('transform', `rotate(${armL} -27 50)`)
        f.armR?.setAttribute('transform', `rotate(${armR} 27 50)`)
        const lift = p.act === 'walk' ? Math.sin(p.step) * 7 : 0
        f.legL?.setAttribute('transform', `translate(0 ${-Math.max(0, lift)})`)
        f.legR?.setAttribute('transform', `translate(0 ${-Math.max(0, -lift)})`)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [lanes])

  return (
    <div style={{ ...layer, height: narrow ? '24%' : '34%' }} aria-hidden>
      <style>{SPECTATOR_CSS}</style>
      {/* 관람석 바닥 쪽이 어둡게 가라앉는 그림자 */}
      <div style={floorShade} />
      {Array.from({ length: lanes }, (_, lane) => (
        <Figure
          key={lane}
          lane={lane}
          bind={(refs) => {
            figures.current[lane] = refs
          }}
        />
      ))}
    </div>
  )
}

/** 사람 하나 (등 돌린 그림자). 모양 갈래는 variant 로 CSS 에서 고른다 */
function Figure({ lane, bind }: { lane: number; bind: (refs: FigureRefs) => void }) {
  const refs = useRef<FigureRefs>({ root: null, body: null, armL: null, armR: null, legL: null, legR: null })
  useEffect(() => bind(refs.current), [bind])
  const fill = SHADES[lane % SHADES.length]
  const set = <K extends keyof FigureRefs>(key: K) => (el: FigureRefs[K]) => {
    refs.current[key] = el
  }
  return (
    <div ref={set('root')} className="aq-spectator" style={{ ...figure, display: 'none', opacity: OPACITY[lane % OPACITY.length], filter: lane % 2 === 1 ? 'blur(0.8px)' : undefined }}>
      <svg viewBox="-45 0 90 200" style={{ height: '100%', overflow: 'visible', display: 'block' }} fill={fill}>
        <g ref={set('body')}>
          <rect ref={set('legL')} x={-21} y={112} width={18} height={92} rx={7} />
          <rect ref={set('legR')} x={3} y={112} width={18} height={92} rx={7} />
          <rect ref={set('armL')} x={-34} y={46} width={13} height={70} rx={6.5} />
          <rect ref={set('armR')} x={21} y={46} width={13} height={70} rx={6.5} />
          {/* 몸통: 어깨가 넓고 허리로 좁아진다 */}
          <path d="M -29 56 Q -29 42 -15 40 L 15 40 Q 29 42 29 56 L 24 122 L -24 122 Z" />
          <rect x={-7} y={30} width={14} height={14} />
          <circle cx={0} cy={21} r={17} />
          {/* 모양 갈래: 0 짧은 머리, 1 올린 머리, 2 모자, 3 배낭 */}
          <circle className="v1" cx={0} cy={1} r={8} />
          <path className="v2" d="M -19 16 Q -18 -2 0 -2 Q 18 -2 19 16 Z" />
          <rect className="v3" x={-19} y={52} width={38} height={46} rx={10} style={{ fill: 'rgba(60, 95, 125, 0.45)' }} />
        </g>
      </svg>
    </div>
  )
}

const layer = {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  pointerEvents: 'none',
  overflow: 'hidden',
} as const

const floorShade = {
  position: 'absolute',
  inset: 0,
  background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(2,8,18,0.28) 60%, rgba(2,8,18,0.5) 100%)',
} as const

const figure = {
  position: 'absolute',
  // 발끝은 화면 아래로 조금 잘려 나가서 바로 앞에 선 사람처럼 보인다
  bottom: '-14%',
  transform: 'translateX(-50%)',
} as const

/** 모양 갈래 CSS. variant 에 맞는 장식만 보인다 */
const SPECTATOR_CSS = `
.aq-spectator .v1, .aq-spectator .v2, .aq-spectator .v3 { display: none; }
.aq-spectator[data-variant="1"] .v1 { display: inline; }
.aq-spectator[data-variant="2"] .v2 { display: inline; }
.aq-spectator[data-variant="3"] .v3 { display: inline; }
`
