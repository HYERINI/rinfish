import { NET } from '../data/net'

/** 줄바꿈·탭 같은 제어문자인가 (U+0000~U+001F, U+007F) */
const isControl = (ch: string) => {
  const code = ch.charCodeAt(0)
  return code < 0x20 || code === 0x7f
}

/** 제어문자(줄바꿈 포함)를 지우고 앞뒤 공백을 자른다 (채팅·닉네임·방 이름 공통) */
export function cleanText(s: string): string {
  return [...s].filter((ch) => !isControl(ch)).join('').trim()
}

/** 글자 수 (이모지 같은 서로게이트 쌍도 한 글자) */
export const textLength = (s: string) => [...s].length

export const normalizeRoomName = (s: string) => cleanText(s).toLowerCase()
export const normalizeNick = (s: string) => cleanText(s)

const within = (s: string, [lo, hi]: [number, number]) => textLength(s) >= lo && textLength(s) <= hi

export type LobbyField = 'room' | 'password' | 'nick'

/** 로비 입력 중 범위를 벗어난 칸들. 암호는 정리하지 않고 그대로 센다 */
export function lobbyErrors(input: { room: string; password: string; nick: string }): LobbyField[] {
  const bad: LobbyField[] = []
  if (!within(normalizeRoomName(input.room), NET.roomName)) bad.push('room')
  if (!within(input.password, NET.password)) bad.push('password')
  if (!within(normalizeNick(input.nick), NET.nick)) bad.push('nick')
  return bad
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** 서버 주소에 쓰는 방 id. 방 이름을 그대로 드러내지 않는다 */
export async function roomIdFor(room: string): Promise<string> {
  return (await sha256Hex(`rinfish-room|${normalizeRoomName(room)}`)).slice(0, 32)
}

/** 서버에 보내는 암호 해시. 서버는 이 값을 저장·비교만 한다 */
export function passHashFor(roomId: string, password: string): Promise<string> {
  return sha256Hex(`${roomId}|${password}`)
}

/** 공유 링크의 ?room= 값 */
export function readRoomParam(search: string): string {
  return normalizeRoomName(new URLSearchParams(search).get('room') ?? '')
}
