import { NET } from '../data/net'
import { cleanText } from './roomKey'

/**
 * 팀 허브 로비에서 들어올 때 주소에 붙는 값 (game-entry-contract v3).
 * back: 나갈 때 그대로 이동할 주소, name: 이름 힌트, room: 허브 방 코드. 없으면 null (혼자 실행)
 */
export type HubEntry = { back: string | null; name: string | null; room: string | null }

type TabStorage = Pick<Storage, 'getItem' | 'setItem'>

/** 이번 탭에서 받은 복귀 주소 (주소창에서 쿼리가 빠져도 끝까지 쓴다) */
const BACK_KEY = 'rinfish-hub-return'
/** 허브 방 코드: 6자, 헷갈리는 0·o·1·l·i 를 뺀 숫자+소문자 */
const ROOM_CODE = /^[23456789abcdefghjkmnpqrstuvwxyz]{6}$/

const isHttp = (s: string) => /^https?:/i.test(s)

function tryGet(storage: TabStorage | null): string | null {
  try {
    return storage?.getItem(BACK_KEY) ?? null
  } catch {
    return null
  }
}

function trySet(storage: TabStorage | null, value: string) {
  try {
    storage?.setItem(BACK_KEY, value)
  } catch {
    // 막힌 저장소: 주소의 값만 쓴다
  }
}

/** 주소 쿼리(와 이번 탭 저장소)에서 허브 값을 읽는다. 복귀 주소는 해석하거나 고치지 않는다 */
export function readHubEntry(search: string, storage: TabStorage | null): HubEntry {
  const q = new URLSearchParams(search)
  const fresh = q.get('hub_return')
  let back: string | null = null
  if (fresh && isHttp(fresh)) {
    back = fresh
    trySet(storage, fresh)
  } else {
    const saved = tryGet(storage)
    back = saved && isHttp(saved) ? saved : null
  }
  const name = [...cleanText(q.get('hub_name') ?? '')].slice(0, NET.nick[1]).join('').trim() || null
  const code = q.get('hub_room') ?? ''
  return { back, name, room: ROOM_CODE.test(code) ? code : null }
}

/** 허브 방 코드로 만드는 낚시섬 방 이름 */
export const hubRoomName = (code: string) => `hub-${code}`
/** 허브 방 암호. 코드는 비밀이 아니라 암호도 비밀이 아니다 — 같은 허브 방 사람끼리 모이게 할 뿐 */
export const hubRoomPassword = (code: string) => `rinfish-hub-${code}`
