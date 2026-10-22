import { CylinderCollider, RigidBody } from '@react-three/rapier'
import { useMemo } from 'react'
import type { TreeKind } from '../../data/decor'
import type { Placement } from '../../logic/decor'
import { TRUNK_RADIUS_PER_HEIGHT } from '../../logic/decorLayout'
import { TREE_URL } from './decorAssets'
import { ModelInstances } from './ModelInstances'

type Tree = Placement & { kind: TreeKind }

/** 나무: 종류별로 한 번에 그리고, 밑동에만 가는 원기둥 콜라이더를 둔다 (가지·잎은 지나갈 수 있다) */
export function Trees({ trees }: { trees: Tree[] }) {
  const byKind = useMemo(() => (Object.keys(TREE_URL) as TreeKind[]).map((kind) => ({ kind, list: trees.filter((t) => t.kind === kind) })), [trees])
  return (
    <>
      {byKind.map(({ kind, list }) => (
        <ModelInstances key={kind} url={TREE_URL[kind]} placements={list} castShadow />
      ))}
      <RigidBody type="fixed" colliders={false}>
        {trees.map((t) => (
          <CylinderCollider key={`${t.x},${t.z}`} args={[1, t.height * TRUNK_RADIUS_PER_HEIGHT]} position={[t.x, 1, t.z]} />
        ))}
      </RigidBody>
    </>
  )
}
