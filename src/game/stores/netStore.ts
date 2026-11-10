import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { NET, NET_SAVE_KEY } from '../data/net'
import type { CharacterLook } from '../data/types'
import type { ClientMsg, ErrorCode, JoinMode, NetState, ServerMsg } from '../logic/netProtocol'
import { hubRoomName, hubRoomPassword } from '../logic/hubParams'
import { allowEvery } from '../logic/rateLimit'
import { cleanText, normalizeNick, normalizeRoomName, passHashFor, roomIdFor, textLength } from '../logic/roomKey'
import { connectSocket, type Connection, type Connector } from '../net/connection'
import { forgetRemote, netNow, receiveState, selfBubble, showBubble } from '../net/remoteRig'
import { roomUrl } from '../net/serverUrl'
import { useFishingStore } from './fishingStore'
import { useSessionStore } from './sessionStore'

export type NetPhase = 'off' | 'connecting' | 'online' | 'reconnecting'
export type Peer = { nick: string; look: CharacterLook }
/** 로비에 띄울 실패 이유: 서버가 거절한 이유, 또는 서버에 닿지 못함 */
export type NetError = ErrorCode | 'unreachable'
export type ChatLine = { key: number; from: string; text: string; at: number; mine: boolean }
type JoinInput = { mode: JoinMode; room: string; password: string; nick: string; look: CharacterLook }

type NetStore = {
  phase: NetPhase
  /** 들어간 방 이름 (정리한 값) */
  room: string | null
  you: string | null
  peers: Record<string, Peer>
  chat: ChatLine[]
  /** 마지막으로 서버가 거절한 이유 (로비에 띄운다) */
  error: NetError | null
  /** 저장: 마지막 방 이름·닉네임 */
  lastRoom: string
  nick: string
  join: (input: JoinInput) => Promise<void>
  /** 허브 방 코드로 들어간다. 방이 없으면 만들고, 동시에 만들어 겹치면 다시 들어간다 */
  joinHub: (input: { code: string; nick: string; look: CharacterLook }) => Promise<void>
  leave: () => void
  sendChat: (text: string) => boolean
  sendState: (s: NetState) => void
  sendProfile: (nick: string, look: CharacterLook) => void
  /** 테스트에서 가짜 연결로 바꾼다 */
  _setConnector: (c: Connector) => void
}

// 연결과 다시 보낼 hello 는 화면에 그리는 값이 아니라 스토어 밖에 둔다
let connector: Connector = connectSocket
let conn: Connection | null = null
let chatKey = 0
let lastChatAt = -Infinity
/** join 할 때마다 늘린다. 해시 계산을 기다리는 동안 나가거나 다시 들어가면 앞의 join 은 연결하지 않는다 */
let joinSeq = 0
let lastProfileAt = -Infinity
let profileTimer: ReturnType<typeof setTimeout> | undefined
/** (다시) 연결될 때 보낼 hello 재료. 첫 welcome 뒤엔 mode 를 join 으로 바꾼다 (방이 이미 있으니) */
const hello: { mode: JoinMode; passHash: string; nick: string; look: CharacterLook | null } = { mode: 'join', passHash: '', nick: '', look: null }
/** 허브 방 들어가기 중: 없는 방·이미 있는 방 거절을 몇 번까지 만들기·들어가기로 바꿔 다시 해 본다 */
let hubRetry: { input: JoinInput; left: number } | null = null
const HUB_RETRIES = 3

const notify = (text: string) => useSessionStore.getState().notify(text)

export const useNetStore = create<NetStore>()(
  persist(
    (set, get) => {
      const addChat = (line: Omit<ChatLine, 'key'>) => set((s) => ({ chat: [...s.chat, { ...line, key: ++chatKey }].slice(-NET.chatLog) }))

      const onMessage = (m: ServerMsg) => {
        const now = netNow()
        switch (m.type) {
          case 'welcome': {
            forgetRemote()
            const peers: Record<string, Peer> = {}
            for (const p of m.players) {
              peers[p.id] = { nick: p.nick, look: p.look }
              if (p.s) receiveState(p.id, p.s, now)
            }
            hello.mode = 'join'
            hubRetry = null
            set({ phase: 'online', you: m.you, peers, error: null })
            return
          }
          case 'error': {
            if (hubRetry && hubRetry.left > 0 && get().phase === 'connecting' && (m.code === 'no-room' || m.code === 'room-exists')) {
              hubRetry.left--
              void connect({ ...hubRetry.input, mode: m.code === 'no-room' ? 'create' : 'join' })
              return
            }
            hubRetry = null
            conn = null
            forgetRemote()
            set({ phase: 'off', room: null, you: null, peers: {}, error: m.code })
            // 같이 하던 중 거절당했으면(다시 붙다가 꽉 참 등) 이유를 볼 수 있게 로비로 돌아간다
            const session = useSessionStore.getState()
            if (session.mode !== 'lobby') {
              useFishingStore.getState().end()
              session.setMode('lobby')
            }
            return
          }
          case 'join':
            set((s) => ({ peers: { ...s.peers, [m.id]: { nick: m.nick, look: m.look } } }))
            notify(`${m.nick}님이 들어왔어요`)
            return
          case 'leave': {
            const peer = get().peers[m.id]
            forgetRemote(m.id)
            if (!peer) return
            const peers = { ...get().peers }
            delete peers[m.id]
            set({ peers })
            notify(`${peer.nick}님이 나갔어요`)
            return
          }
          case 'profile':
            if (get().peers[m.id]) set((s) => ({ peers: { ...s.peers, [m.id]: { nick: m.nick, look: m.look } } }))
            return
          case 'state':
            if (get().peers[m.id]) receiveState(m.id, m.s, now)
            return
          case 'chat': {
            const peer = get().peers[m.id]
            if (!peer) return
            addChat({ from: peer.nick, text: m.text, at: now, mine: false })
            showBubble(m.id, m.text, now)
            return
          }
        }
      }

      /** 지금 이름·옷을 보낸다. 서버는 5초에 한 번만 받으므로, 그 안이면 창이 열릴 때 마지막 값을 보낸다 */
      const flushProfile = () => {
        if (get().phase !== 'online' || !conn || !hello.look || profileTimer) return
        const now = netNow()
        if (allowEvery(lastProfileAt, now, NET.profileEvery)) {
          lastProfileAt = now
          conn.send({ type: 'profile', nick: hello.nick, look: hello.look })
          return
        }
        profileTimer = setTimeout(() => {
          profileTimer = undefined
          flushProfile()
        }, (lastProfileAt + NET.profileEvery - now) * 1000)
      }

      /** 연결을 끊고 다른 사람을 지운다 (허브 다시 시도 상태는 그대로) */
      const disconnect = () => {
        joinSeq++
        clearTimeout(profileTimer)
        profileTimer = undefined
        const c = conn
        conn = null
        c?.close()
        forgetRemote()
        set({ phase: 'off', room: null, you: null, peers: {} })
      }

      const connect = async ({ mode, room, password, nick, look }: JoinInput) => {
        disconnect()
        const seq = joinSeq
        const name = normalizeRoomName(room)
        const roomId = await roomIdFor(name)
        const passHash = await passHashFor(roomId, password)
        // 기다리는 동안 나갔거나 다시 들어갔으면 이 join 은 그만둔다
        if (seq !== joinSeq) return
        Object.assign(hello, { mode, passHash, nick: normalizeNick(nick), look })
        lastProfileAt = -Infinity
        set({ phase: 'connecting', room: name, error: null, lastRoom: name, nick: hello.nick, chat: [] })
        let mine: Connection | null = null
        mine = connector(
          roomUrl(roomId),
          (): ClientMsg => ({ type: 'hello', v: NET.protocolVersion, mode: hello.mode, passHash: hello.passHash, nick: hello.nick, look: hello.look ?? look }),
          onMessage,
          (status) => {
            // 끊겨서 다시 붙는 중엔 다른 사람을 숨긴다 (다시 붙으면 welcome 으로 채운다)
            if (status === 'connecting' && get().phase === 'online') {
              forgetRemote()
              set({ phase: 'reconnecting', peers: {} })
            }
            // 처음부터 끝내 안 붙었다 (서버가 꺼져 있음 등)
            if (status === 'closed' && conn === mine && get().phase === 'connecting') {
              conn = null
              hubRetry = null
              set({ phase: 'off', room: null, error: 'unreachable' })
            }
          },
        )
        conn = mine
      }

      return {
        phase: 'off',
        room: null,
        you: null,
        peers: {},
        chat: [],
        error: null,
        lastRoom: '',
        nick: '',

        join(input) {
          hubRetry = null
          return connect(input)
        },

        joinHub({ code, nick, look }) {
          const input: JoinInput = { mode: 'join', room: hubRoomName(code), password: hubRoomPassword(code), nick, look }
          hubRetry = { input, left: HUB_RETRIES }
          return connect(input)
        },

        leave() {
          hubRetry = null
          disconnect()
        },

        sendChat(raw) {
          const text = cleanText(raw)
          const now = netNow()
          if (!conn || get().phase !== 'online' || textLength(text) < 1 || textLength(text) > NET.chatLength) return false
          if (!allowEvery(lastChatAt, now, NET.chatEvery)) return false
          lastChatAt = now
          conn.send({ type: 'chat', text })
          addChat({ from: get().nick, text, at: now, mine: true })
          selfBubble.text = text
          selfBubble.at = now
          return true
        },

        sendState(s) {
          if (get().phase === 'online') conn?.send({ type: 'state', s })
        },

        sendProfile(nick, look) {
          hello.nick = normalizeNick(nick)
          hello.look = look
          set({ nick: hello.nick })
          flushProfile()
        },

        _setConnector(c) {
          connector = c
          lastChatAt = -Infinity
        },
      }
    },
    {
      name: NET_SAVE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // 암호는 어디에도 두지 않는다. 방 이름·닉네임만
      partialize: (s) => ({ lastRoom: s.lastRoom, nick: s.nick }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as { lastRoom?: unknown; nick?: unknown }
        return { ...current, lastRoom: typeof p.lastRoom === 'string' ? p.lastRoom : '', nick: typeof p.nick === 'string' ? p.nick : '' }
      },
    },
  ),
)
