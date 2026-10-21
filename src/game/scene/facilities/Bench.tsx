import { FACILITY } from '../../data/zones'
import { ASSET } from '../assets'
import { Prop } from '../Prop'
import { InteractionZone } from './InteractionZone'

const [X, Z] = FACILITY.bench

/** 바다를 바라보는 벤치. 앉으면 체력이 천천히 찬다 */
export function Bench() {
  return (
    <>
      <Prop url={ASSET.bench} height={0.9} position={[X, 0, Z]} rotationY={0} />
      <InteractionZone position={[X, 0.8, Z]} halfSize={[1.4, 1, 1.2]} target={{ kind: 'bench' }} />
    </>
  )
}
