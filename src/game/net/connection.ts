import { NET } from '../data/net'
import { parseServerMsg, type ClientMsg, type ServerMsg } from '../logic/netProtocol'

export type ConnStatus = 'connecting' | 'open' | 'closed'
export type Connection = { send(m: ClientMsg): void; close(): void }
/** 연결 만들기. hello 는 (다시) 연결될 때마다 불러서 보낸다. 테스트에선 가짜로 바꾼다 */
export type Connector = (url: string, hello: () => ClientMsg, onMessage: (m: ServerMsg) => void, onStatus: (s: ConnStatus) => void) => Connection

/**
 * 진짜 웹소켓. 끊기면 1·2·4·8·10초 간격으로 다시 붙는다.
 * 서버가 error 를 보내고 닫은 연결, 우리가 닫은 연결, 처음부터 끝내 안 붙은 연결은 다시 붙지 않는다 ('closed')
 */
export const connectSocket: Connector = (url, hello, onMessage, onStatus) => {
  let ws: WebSocket | null = null
  let attempt = 0
  /** 한 번이라도 붙었나. 처음부터 안 붙으면 몇 번만 해 보고 포기한다 */
  let opened = false
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | undefined

  const open = () => {
    onStatus('connecting')
    const socket = new WebSocket(url)
    ws = socket
    socket.onopen = () => {
      attempt = 0
      opened = true
      socket.send(JSON.stringify(hello()))
      onStatus('open')
    }
    socket.onmessage = (e) => {
      const m = typeof e.data === 'string' ? parseServerMsg(e.data) : null
      if (!m) return
      if (m.type === 'error') stopped = true
      onMessage(m)
    }
    socket.onclose = () => {
      if (ws !== socket) return
      if (stopped || (!opened && attempt + 1 >= NET.firstConnectTries)) {
        stopped = true
        onStatus('closed')
        return
      }
      const delays = NET.reconnectDelays
      const wait = delays[Math.min(attempt, delays.length - 1)]
      attempt++
      onStatus('connecting')
      timer = setTimeout(open, wait * 1000)
    }
  }
  open()

  return {
    send(m) {
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m))
    },
    close() {
      stopped = true
      clearTimeout(timer)
      const socket = ws
      ws = null
      socket?.close()
      onStatus('closed')
    },
  }
}
