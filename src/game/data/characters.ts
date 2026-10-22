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
  | 'sprint'
  | 'jumpStart'
  | 'jumpLoop'
  | 'jumpLand'
  | 'dance'
  | 'chat'
  | 'roll'
  | 'punch'
  | 'spell'

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
  sprint: 'Sprint_Loop',
  jumpStart: 'Jump_Start',
  jumpLoop: 'Jump_Loop',
  jumpLand: 'Jump_Land',
  // 낚아 올렸을 때(celebrate)와 같은 춤
  dance: 'Dance_Loop',
  chat: 'Idle_Talking_Loop',
  roll: 'Roll',
  punch: 'Punch_Jab',
  spell: 'Spell_Simple_Shoot',
}

/** 한 번만 재생하고 끝난 자세로 멈추는 클립. 그 자세가 될 때마다 처음부터 다시 튼다 */
export const ONE_SHOT_CLIPS: CharacterClip[] = ['fallBack', 'sitEnter', 'sitExit', 'jumpStart', 'jumpLand', 'roll', 'punch', 'spell']

/** 점프 자세 시간(초). 뛰어오른 뒤 startTime 동안 도약 자세, 그 뒤 착지까지 공중 자세, 착지 후 landTime 동안 착지 자세 */
export const JUMP_POSE = { startTime: 0.45, landTime: 0.55 }

/** 이 속도(m/s)부터 질주 자세. 걷기 속도(MOVE.walkSpeed)보다 빠르고 질주 속도보다 느린 사이 */
export const SPRINT_MIN_SPEED = 10.5

/** 키 배율 1 일 때 캐릭터 키(m, 발바닥 → 정수리). 카메라 시선 높이를 잴 때 쓴다 */
export const CHARACTER_BASE_HEIGHT = 1.8

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
