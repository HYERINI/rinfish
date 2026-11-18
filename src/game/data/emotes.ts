import type { CharacterClip } from './characters'

export type EmoteId = 'dance' | 'chat' | 'roll' | 'punch' | 'spell'

/**
 * 감정 표현 (탐험 중 T 를 누르고 있으면 바퀴, 폰은 😀 메뉴). loop: 이동 키를 누를 때까지 계속, 아니면 클립 한 번 뒤 저절로 끝난다.
 * icon: 바퀴·터치 메뉴에 보이는 그림. key: 바퀴가 열린 동안 숫자 키로 바로 고르기 (바퀴 칸 순서와 같다)
 */
export const EMOTES: { id: EmoteId; key: string; label: string; icon: string; clip: CharacterClip; loop: boolean }[] = [
  { id: 'dance', key: 'Digit1', label: '춤', icon: '💃', clip: 'dance', loop: true },
  { id: 'chat', key: 'Digit2', label: '수다', icon: '💬', clip: 'chat', loop: true },
  { id: 'roll', key: 'Digit3', label: '구르기', icon: '🤸', clip: 'roll', loop: false },
  { id: 'punch', key: 'Digit4', label: '펀치', icon: '👊', clip: 'punch', loop: false },
  { id: 'spell', key: 'Digit5', label: '마법', icon: '✨', clip: 'spell', loop: false },
]

/** 플레이어 동작 키 (e.code) */
export const ACTION_KEYS = { sprint: ['ShiftLeft', 'ShiftRight'], jump: 'Space' }
