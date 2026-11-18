import { useEffect, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { SPECIES_IDS, type SpeciesId } from '../../data/animals'
import { animalViews, herdDrawn } from '../../hunt/animalRig'
import { clampDelta } from '../../logic/time'
import { netNow } from '../../net/remoteRig'
import { useNetStore } from '../../stores/netStore'
import { disposeAnimal, makeAnimal, updateAnimal, type AnimalObject } from './animalModel'

const petUrl = (id: SpeciesId) => `${import.meta.env.BASE_URL}meadow/models/pets/animal-${id}.glb`
const URLS = SPECIES_IDS.map(petUrl)
for (const url of URLS) useGLTF.preload(url)

/**
 * 들판 동물 그리기 (은지 Kenney Cube Pets, CC0). 혼자면 내 화면 무리, 같이면 서버 목록을 이어 그린 값 (hunt/animalRig).
 * 동물은 번호·종마다 한 번 복제해 두고 매 프레임 자리만 바꾼다. 목록에서 빠지면(쓰러진 뒤 1.4초) 장면에서 뺀다.
 * 혼자 무리와 방 무리는 번호가 겹치므로(둘 다 1번부터) 종까지 열쇠로 쓴다
 */
export function Animals() {
  const gltfs = useGLTF(URLS)
  const group = useRef<Group>(null)
  const pool = useRef(new Map<string, AnimalObject>())

  // 들판을 떠나 그리지 않게 되면 복제해 둔 동물을 모두 버린다
  useEffect(() => {
    const p = pool.current
    return () => {
      for (const a of p.values()) disposeAnimal(a)
      p.clear()
      herdDrawn.count = 0
    }
  }, [])

  useFrame((_, delta) => {
    const g = group.current
    if (!g) return
    const dt = clampDelta(delta)
    const views = animalViews(useNetStore.getState().phase !== 'off', netNow())
    const seen = new Set<string>()
    for (const v of views) {
      const key = `${v.sp}:${v.id}`
      seen.add(key)
      let a = pool.current.get(key)
      if (!a) {
        const gltf = gltfs[SPECIES_IDS.indexOf(v.sp)]
        a = makeAnimal(v.sp, gltf.scene, gltf.animations, v)
        pool.current.set(key, a)
        g.add(a.obj)
      }
      updateAnimal(a, v, dt)
    }
    for (const [key, a] of pool.current) {
      if (seen.has(key)) continue
      g.remove(a.obj)
      disposeAnimal(a)
      pool.current.delete(key)
    }
    herdDrawn.count = pool.current.size
  })

  return <group ref={group} />
}
