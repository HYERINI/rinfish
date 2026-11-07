import { DurableObject } from 'cloudflare:workers'
import { NET } from '../../src/game/data/net'
import { parseClientMsg, type ErrorCode, type PeerInfo, type ServerMsg } from '../../src/game/logic/netProtocol'
import { NEW_WINDOW } from '../../src/game/logic/rateLimit'
import { handleMemberMsg, judgeHello, type Member, type RoomMeta } from './roomRules'

/** 웹소켓 붙임 정보: 아직 hello 전이거나, 들어온 사람 */
type Attachment = { phase: 'hello' } | ({ phase: 'in' } & Member)

export type Env = { ROOM: DurableObjectNamespace<Room> }

const toMember = (a: Extract<Attachment, { phase: 'in' }>): Member => ({
  id: a.id,
  nick: a.nick,
  look: a.look,
  joinedAt: a.joinedAt,
  s: a.s,
  stateWin: a.stateWin,
  lastChat: a.lastChat,
  lastProfile: a.lastProfile,
})

/**
 * 방 하나. 웹소켓 Hibernation API 를 써서 조용할 땐 잠들어 요금이 들지 않는다.
 * 사람 정보는 웹소켓마다 붙임 정보(attachment)에, 방 암호 해시는 저장소(meta)에 둔다
 */
export class Room extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('websocket only', { status: 426 })
    const [client, server] = Object.values(new WebSocketPair())
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ phase: 'hello' } satisfies Attachment)
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer): Promise<void> {
    if (typeof data !== 'string' || data.length > NET.maxMessageLength) return
    const msg = parseClientMsg(data)
    if (!msg) return
    const att = ws.deserializeAttachment() as Attachment
    if (att.phase === 'hello') {
      if (msg.type !== 'hello') return this.reject(ws, 'bad-hello')
      const meta = (await this.ctx.storage.get<RoomMeta>('meta')) ?? null
      const verdict = judgeHello(msg, meta, this.members(ws).length, Date.now())
      if (!verdict.ok) return this.reject(ws, verdict.code)
      await this.ctx.storage.put('meta', verdict.meta)
      const me: Member = { id: crypto.randomUUID().slice(0, 8), nick: msg.nick, look: msg.look, joinedAt: Date.now() / 1000, s: null, stateWin: NEW_WINDOW, lastChat: -Infinity, lastProfile: -Infinity }
      ws.serializeAttachment({ phase: 'in', ...me } satisfies Attachment)
      const players: PeerInfo[] = this.members(ws).map(({ m }) => ({ id: m.id, nick: m.nick, look: m.look, s: m.s }))
      send(ws, { type: 'welcome', you: me.id, players })
      this.broadcast({ type: 'join', id: me.id, nick: me.nick, look: me.look }, ws)
      return
    }
    const member = toMember(att)
    const r = handleMemberMsg(member, msg, Date.now() / 1000)
    if (r.member !== member) ws.serializeAttachment({ phase: 'in', ...r.member } satisfies Attachment)
    if (r.out) this.broadcast(r.out, ws)
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.leave(ws)
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.leave(ws)
  }

  /** 들어와 있는 사람들 (except 는 뺀다) */
  private members(except?: WebSocket): { ws: WebSocket; m: Member }[] {
    const out: { ws: WebSocket; m: Member }[] = []
    for (const w of this.ctx.getWebSockets()) {
      if (w === except) continue
      const a = w.deserializeAttachment() as Attachment | null
      if (a?.phase === 'in') out.push({ ws: w, m: toMember(a) })
    }
    return out
  }

  private broadcast(msg: ServerMsg, except: WebSocket) {
    for (const { ws } of this.members(except)) send(ws, msg)
  }

  private reject(ws: WebSocket, code: ErrorCode) {
    send(ws, { type: 'error', code })
    ws.serializeAttachment({ phase: 'hello' } satisfies Attachment)
    try {
      ws.close(4000, code)
    } catch {
      // 이미 닫혔다
    }
  }

  private async leave(ws: WebSocket) {
    const a = ws.deserializeAttachment() as Attachment | null
    ws.serializeAttachment({ phase: 'hello' } satisfies Attachment)
    try {
      ws.close(1000, 'bye')
    } catch {
      // 이미 닫혔다
    }
    if (a?.phase !== 'in') return
    this.broadcast({ type: 'leave', id: a.id }, ws)
    const meta = await this.ctx.storage.get<RoomMeta>('meta')
    if (meta) await this.ctx.storage.put('meta', { ...meta, lastActive: Date.now() })
  }
}

function send(ws: WebSocket, msg: ServerMsg) {
  try {
    ws.send(JSON.stringify(msg))
  } catch {
    // 닫히는 중인 소켓
  }
}
