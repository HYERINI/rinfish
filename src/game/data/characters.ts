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

export type CharacterDef = {
  name: string
  /** public/models 아래 파일 이름 */
  file: string
  /** 동작 → glb 안의 애니메이션 이름 */
  clips: Record<CharacterClip, string>
}

/** Quaternius Universal Animation Library 의 클립 이름. 같은 뼈대(UE 마네킹식 65개 뼈)를 쓰는 캐릭터는 이걸 그대로 쓴다 */
const UAL_CLIPS: Record<CharacterClip, string> = {
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
}

export const CHARACTERS = {
  fisherman: { name: '어부 할아버지', file: 'fisherman.glb', clips: UAL_CLIPS },
} satisfies Record<string, CharacterDef>

/** 지금 플레이어가 쓰는 캐릭터. 캐릭터 선택이 생기면 여기만 바꾸면 된다 */
export const PLAYER_CHARACTER: CharacterDef = CHARACTERS.fisherman
