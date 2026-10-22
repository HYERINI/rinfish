import type { CharacterClip } from './characters'

export type EmoteId = 'dance' | 'chat' | 'roll' | 'punch' | 'spell'

/**
 * 숫자 키 감정 표현 (탐험 중에만). loop: 이동 키를 누를 때까지 계속, 아니면 클립 한 번 뒤 저절로 끝난다.
 * icon: 터치 감정 표현 메뉴에 보이는 그림. 숫자 키는 나중에 낚시 중 미끼 고르기에도 쓰이므로 탐험 모드에서만 받는다
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
