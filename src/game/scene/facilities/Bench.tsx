import { CylinderCollider, RigidBody } from '@react-three/rapier'
import { FACILITY } from '../../data/zones'
import { ASSET } from '../assets'
import { Prop } from '../Prop'
import { BENCH_HEIGHT } from './benchShape'
import { InteractionZone } from './InteractionZone'

const [X, Z] = FACILITY.bench
/**
 * 벤치 옆 파라솔 탁자. detail-parasol-a.glb(원래 높이 0.45)를 이 높이로 키우면
 * 탁자 윗면 0.59·반지름 0.78, 차양 아래 1.47·반지름 0.98 (차양이 탁자보다 조금만 넓어서 머리가 차양에 닿을 만큼 다가갈 수 없다)
 */
const PARASOL_HEIGHT = 2.2
const PARASOL_AT: [number, number, number] = [1.75, 0, 0.1]
/** 파라솔 탁자 상판 반지름·높이 (위 배율로 잰 값) */
const TABLE_RADIUS = 0.78
const TABLE_TOP = 0.59

/** 바다를 바라보는 공원 벤치와 파라솔 탁자. 벤치에 앉으면 체력이 천천히 찬다 */
export function Bench() {
  return (
    <group position={[X, 0, Z]}>
      {/* holiday-kit bench.glb 는 원점이 벤치 한가운데이고 등받이가 -z, 앉는 쪽이 +z(바다) */}
      <Prop url={ASSET.bench} height={BENCH_HEIGHT} />
      <Prop url={ASSET.parasol} height={PARASOL_HEIGHT} position={PARASOL_AT} />
      <RigidBody type="fixed" colliders={false} position={PARASOL_AT}>
        <CylinderCollider args={[TABLE_TOP / 2, TABLE_RADIUS]} position={[0, TABLE_TOP / 2, 0]} />
      </RigidBody>
      <InteractionZone position={[0, 0.8, 0]} halfSize={[1.4, 1, 1.2]} target={{ kind: 'bench' }} />
    </group>
  )
}
