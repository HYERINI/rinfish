import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { setGunFx } from '../../guns/gunFx'
import { createGunEffects } from './gunEffectsPool'

/**
 * 총알 효과 (은지 weapons.js Effects): 궤적 선·총알 자국·총구 불꽃. 빛 개수를 바꾸지 않도록 총구 불꽃은 빛 없이 더해지는 판(Sprite)만 쓴다.
 * 다른 사람이 쏜 것(같이 하기 shot)도 같은 효과로 그린다
 */
export function GunEffects() {
  const fx = useMemo(() => createGunEffects(), [])

  useEffect(() => {
    setGunFx(fx.api)
    return () => {
      setGunFx(null)
      fx.dispose()
    }
  }, [fx])

  useFrame(() => fx.step())
  return <primitive object={fx.group} />
}
