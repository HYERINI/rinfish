import { GUNS, type GunId } from '../data/guns'

/** 총 상태 한 줄 (은지 setWeaponHud): 장전 중 / 탄약 없음 / R 장전 / 연사 안내 */
export function gunStatus(gun: GunId, mag: number, reserve: number, reloading: boolean): string {
  if (reloading) return '장전 중…'
  if (mag === 0 && reserve === 0) return '탄약 없음 · 마을 잡화점에서 사요'
  if (mag === 0) return 'R 장전'
  return GUNS[gun].auto ? '누르고 있으면 연사' : ''
}
