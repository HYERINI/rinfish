import { DurableObject } from 'cloudflare:workers'
import { NET } from '../../src/game/data/net'
import { newRoomClock, roomMorning, roomTime, type RoomClock } from '../../src/game/logic/dayClock'
import { parseClientMsg, type ErrorCode, type PeerInfo, type ServerMsg } from '../../src/game/logic/netProtocol'
import { NEW_WINDOW } from '../../src/game/logic/rateLimit'
import { handleMemberMsg, judgeHello, memberFrom, tallySleep, type Member, type RoomMeta } from './roomRules'

/** 웹소켓 붙임 정보: 아직 hello 전이거나, 들어온 사람 */
type Attachment = { phase: 'hello' } | ({ phase: 'in' } & Member)

export type Env = { ROOM: DurableObjectNamespace<Room> }

const toMember = (a: Extract<Attachment, { phase: 'in' }>): Member => memberFrom(a)

/**
 * 방 하나. 웹소켓 Hibernation API 를 써서 조용할 땐 잠들어 요금이 들지 않는다.
 * 사람 정보는 웹소켓마다 붙임 정보(attachment)에, 방 암호 해시와 시계 기준점은 저장소(meta, clock)에 둔다 (잠들면 메모리는 사라진다).
 * 시계 확인 alarm 은 사람이 있는 동안만 다시 건다
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
      // 오래돼 없는 방으로 본 이름을 새로 만들었다: 옛 방 시계를 버리고 1일차 06:00 부터
      if (verdict.fresh) await this.ctx.storage.delete('clock')
      const me: Member = {
        id: crypto.randomUUID().slice(0, 8),
        nick: msg.nick,
        look: msg.look,
        joinedAt: Date.now() / 1000,
        s: null,
        stateWin: NEW_WINDOW,
        lastChat: -Infinity,
        lastProfile: -Infinity,
        sleeping: false,
        sleepWin: NEW_WINDOW,
      }
      ws.serializeAttachment({ phase: 'in', ...me } satisfies Attachment)
      const players: PeerInfo[] = this.members(ws).map(({ m }) => ({ id: m.id, nick: m.nick, look: m.look, s: m.s }))
      const time = roomTime(await this.clock(), Date.now())
      send(ws, { type: 'welcome', you: me.id, players, time })
      this.broadcast({ type: 'join', id: me.id, nick: me.nick, look: me.look }, ws)
      // 사람이 늘면 필요한 수가 바뀐다 (자는 사람이 있을 때만 알린다)
      await this.checkSleep(false)
      if ((await this.ctx.storage.getAlarm()) === null) await this.ctx.storage.setAlarm(Date.now() + NET.clockEvery * 1000)
      return
    }
    const member = toMember(att)
    const r = handleMemberMsg(member, msg, Date.now() / 1000)
    if (r.member !== member) ws.serializeAttachment({ phase: 'in', ...r.member } satisfies Attachment)
    if (r.out) this.broadcast(r.out, ws)
    if (msg.type === 'sleep' && !r.quiet && r.member.sleeping !== member.sleeping) await this.checkSleep(true)
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.leave(ws)
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.leave(ws)
  }

  /**
   * 시계 확인: 사람이 있으면 지금 시각을 보내고 다시 건다. 아무도 없으면 다시 걸지 않는다 (방이 잠든다).
   * 너무 잦아 세지 않은 잠 표시(quiet)도 여기서 센다
   */
  async alarm(): Promise<void> {
    if (this.members().length === 0) return
    this.broadcastAll({ type: 'time', ...roomTime(await this.clock(), Date.now()) })
    await this.checkSleep(true)
    await this.ctx.storage.setAlarm(Date.now() + NET.clockEvery * 1000)
  }

  /** 방 시계 기준점. 처음이면 지금을 1일차 06:00 으로 만들어 저장한다 */
  private async clock(): Promise<RoomClock> {
    const saved = await this.ctx.storage.get<RoomClock>('clock')
    if (saved) return saved
    const fresh = newRoomClock(Date.now())
    await this.ctx.storage.put('clock', fresh)
    return fresh
  }

  /**
   * 잠 투표를 센다. 절반(올림) 이상이 자면 시계를 다음 날 06:00 으로 옮기고 모두에게 morning, 자는 표시를 지운다.
   * tell: 자는 사람이 없어도 sleepers 를 보낸다 (누가 일어나 0명이 됐을 때 화면을 지우게)
   */
  private async checkSleep(tell: boolean) {
    const all = this.members()
    if (all.length === 0) return
    const t = tallySleep(all.map(({ m }) => m.sleeping))
    if (!t.morning) {
      if (tell || t.n > 0) this.broadcastAll({ type: 'sleepers', n: t.n, need: t.need })
      return
    }
    const next = roomMorning(await this.clock(), Date.now())
    await this.ctx.storage.put('clock', next)
    for (const { ws, m } of all) ws.serializeAttachment({ phase: 'in', ...m, sleeping: false } satisfies Attachment)
    this.broadcastAll({ type: 'morning', day: next.day0 })
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

  private broadcastAll(msg: ServerMsg) {
    for (const { ws } of this.members()) send(ws, msg)
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
    // 사람이 줄면 필요한 수가 줄어 아침이 올 수 있다. 마지막 사람이 나가면 alarm 을 지운다
    if (this.members().length === 0) await this.ctx.storage.deleteAlarm()
    else await this.checkSleep(a.sleeping === true)
  }
}

function send(ws: WebSocket, msg: ServerMsg) {
  try {
    ws.send(JSON.stringify(msg))
  } catch {
    // 닫히는 중인 소켓
  }
}
