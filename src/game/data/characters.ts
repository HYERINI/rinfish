import type { Gender, OutfitId } from './types'

/** 캐릭터가 쓰는 동작 종류 */
export type CharacterClip =
  | 'idle'
  | 'walk'
  | 'run'
  | 'aimUp'
  | 'aimNeutral'
  | 'aimDown'
  | 'dragged'
  | 'celebrate'
  | 'fallBack'
  | 'dejected'
  | 'sitEnter'
  | 'sitIdle'
  | 'sitExit'

/** 동작 → glb 안의 애니메이션 이름 (Quaternius Universal Animation Library). 남녀 파일이 같다 */
export const CHARACTER_CLIPS: Record<CharacterClip, string> = {
  idle: 'Idle_Loop',
  walk: 'Walk_Loop',
  run: 'Jog_Fwd_Loop',
  aimUp: 'Pistol_Aim_Up',
  aimNeutral: 'Pistol_Aim_Neutral',
  aimDown: 'Pistol_Aim_Down',
  dragged: 'Push_Loop',
  celebrate: 'Dance_Loop',
  fallBack: 'Death01',
  dejected: 'Crouch_Idle_Loop',
  sitEnter: 'Sitting_Enter',
  sitIdle: 'Sitting_Idle_Loop',
  sitExit: 'Sitting_Exit',
}

/** public/models 아래 파일 */
export const CHARACTER_FILES: Record<Gender, string> = {
  male: 'characters/male.glb',
  female: 'characters/female.glb',
}

/** 옷 색 변형 텍스처 (public/models 아래) */
export const OUTFIT_ALT_TEXTURES: Record<OutfitId, string> = {
  peasant: 'characters/textures/peasant_alt.jpg',
  ranger: 'characters/textures/ranger_alt.jpg',
}
