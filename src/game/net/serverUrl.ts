/** 방 서버 주소 (예: wss://rinfish-rooms.xxx.workers.dev). 없으면 같이 하기를 숨기고 혼자 하기만 */
const raw = import.meta.env.VITE_ROOM_SERVER as string | undefined
export const ROOM_SERVER: string | null = raw ? raw.replace(/\/+$/, '') : null

export const roomUrl = (roomId: string) => `${ROOM_SERVER}/rooms/${roomId}`
