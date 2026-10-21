import { FACILITY } from '../../data/zones'
import { ASSET } from '../assets'
import { Prop } from '../Prop'
import { InteractionZone } from './InteractionZone'

const [X, Z] = FACILITY.bench
/** bench.glb 의 원점은 모서리라서(x 0~0.4, z -0.2~0 → 높이 0.9로 키우면 약 0.77 x 0.38) 벤치 한가운데가 FACILITY.bench 에 오도록 옮긴다 */
const CENTER_SHIFT: [number, number] = [-0.383, 0.191]

/** 바다를 바라보는 벤치. 앉으면 체력이 천천히 찬다 */
export function Bench() {
  return (
    <>
      <Prop url={ASSET.bench} height={0.9} position={[X + CENTER_SHIFT[0], 0, Z + CENTER_SHIFT[1]]} rotationY={0} />
      <InteractionZone position={[X, 0.8, Z]} halfSize={[1.4, 1, 1.2]} target={{ kind: 'bench' }} />
    </>
  )
}
