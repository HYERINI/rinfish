import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Color, DodecahedronGeometry, ExtrudeGeometry, MeshStandardMaterial, Shape, SphereGeometry } from 'three'
import type { BufferGeometry, InstancedMesh } from 'three'
import type { Placement } from '../../logic/decor'
import { fillInstances } from './instancing'

/** 조개 색(변형 번호 순): 하양·살구·분홍 */
const SHELL_COLORS = ['#fff4e2', '#ffc9a8', '#f7b6cf']
/** 불가사리 색: 주황·산호·노랑 */
const STAR_COLORS = ['#ff8a4c', '#f2647a', '#ffb43c']
const PEBBLE_COLORS = ['#cfc8bd', '#9e9a93']

/** 지름 1, 두께 약 0.15 의 다섯 갈래 불가사리 (바닥에 눕힘) */
function starfishGeometry(): BufferGeometry {
  const shape = new Shape()
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2
    const r = i % 2 === 0 ? 0.5 : 0.2
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r)
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  shape.closePath()
  const g = new ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.05, bevelSegments: 1 })
  g.rotateX(-Math.PI / 2)
  g.translate(0, 0.04, 0)
  return g
}

/** 지름 1 의 납작한 가리비 (반구를 눌러 펴고 골을 낸다) */
function shellGeometry(): BufferGeometry {
  const g = new SphereGeometry(0.5, 9, 3, 0, Math.PI * 2, 0, Math.PI / 2)
  g.scale(1, 0.45, 0.85)
  return g
}

function pebbleGeometry(): BufferGeometry {
  const g = new DodecahedronGeometry(0.5)
  g.scale(1, 0.5, 0.8)
  g.translate(0, 0.12, 0)
  return g
}

type Props = { shells: Placement[]; starfish: Placement[]; pebbles: Placement[] }

/** 해변 모래 위 조개·불가사리·조약돌 (작아서 충돌 없음) */
export function BeachBits({ shells, starfish, pebbles }: Props) {
  return (
    <>
      <Colored make={shellGeometry} placements={shells} palette={SHELL_COLORS} />
      <Colored make={starfishGeometry} placements={starfish} palette={STAR_COLORS} />
      <Colored make={pebbleGeometry} placements={pebbles} palette={PEBBLE_COLORS} />
    </>
  )
}

function Colored({ make, placements, palette }: { make: () => BufferGeometry; placements: Placement[]; palette: string[] }) {
  const ref = useRef<InstancedMesh>(null)
  const geometry = useMemo(() => make(), [make])
  const material = useMemo(() => new MeshStandardMaterial({ roughness: 0.8, flatShading: true }), [])
  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    fillInstances(mesh, placements, 0.01)
    const color = new Color()
    placements.forEach((p, i) => mesh.setColorAt(i, color.set(palette[p.variant % palette.length])))
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [placements, palette])
  if (placements.length === 0) return null
  return <instancedMesh ref={ref} args={[geometry, material, placements.length]} receiveShadow />
}
