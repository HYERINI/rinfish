import { DurableObject } from 'cloudflare:workers'
import { isIndoor } from '../../src/game/data/meadow'
import { rollDrops } from '../../src/game/data/meadowItems'
import { NET } from '../../src/game/data/net'
import { herdViews, hitAnimal, newHerd, stepHerd, type Herd, type HerdPlayer } from '../../src/game/logic/animalSim'
import { newRoomClock, roomMorning, roomTime, type RoomClock } from '../../src/game/logic/dayClock'
import { packAnimals, parseClientMsg, type ClientMsg, type ErrorCode, type PeerInfo, type ServerMsg } from '../../src/game/logic/netProtocol'
import { NEW_WINDOW } from '../../src/game/logic/rateLimit'
import { handleMemberMsg, herdStepDt, judgeAnimalHit, judgeDied, judgeHello, judgePvpHit, memberFrom, screenAnimalHit, sleepGuardEnd, tallySleep, type Member, type RoomMeta } from './roomRules'

/** 웹소켓 붙임 정보: 아직 hello 전이거나, 들어온 사람 */
type Attachment = { phase: 'hello' } | ({ phase: 'in' } & Member)

export type Env = { ROOM: DurableObjectNamespace<Room> }

const toMember = (a: Extract<Attachment, { phase: 'in' }>): Member => memberFrom(a)

/**
 * 방 하나. 웹소켓 Hibernation API 를 써서 조용할 땐 잠들어 요금이 들지 않는다.
 * 사람 정보는 웹소켓마다 붙임 정보(attachment)에, 방 암호 해시와 시계 기준점은 저장소(meta, clock)에 둔다 (잠들면 메모리는 사라진다).
 * 들판 동물은 alarm 없이 사람 메시지가 올 때 지난번부터 지난 만큼(0.15초에 한 번까지, 최대 1초) 움직여 모두에게 보낸다:
 * 들판 근처 사람은 가만히 있어도 5Hz 로 모습을 보내므로 그동안 5Hz 로 움직이고, 아무도 안 보내면 멈춘다 (메시지는 alarm 보다 20배 싸다).
 * alarm 은 사람이 있는 동안만 30초마다 건다 (시계 확인·잠 표시 다시 세기). 미룬 잠 표시가 있으면 그때 잠깐 당겨 건다.
 * 동물은 메모리에만 둔다 (방이 비거나 메모리가 사라지면 버리고 다음 메시지에 새로 만든다).
 * PvP (3-4): 쏜 사람의 pvpHit 를 무기 표·간격으로 검사해 맞은 사람에게만 hurt, 쓰러진 사람의 died 로 모두에게 kill
 */
export class Room extends DurableObject<Env> {
  /** 들판 동물과 마지막으로 움직인 때(ms, 무리가 없으면 null) */
  private herd: Herd | null = null
  private herdAt: number | null = null
  /** 마지막으로 시계 확인(time)을 보낸 때(ms) */
  private clockAt = 0

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
        lastHit: -Infinity,
        lastW: null,
        hitWin: NEW_WINDOW,
        hitShot: null,
        pvpLast: null,
        pvpWin: NEW_WINDOW,
        pvpShot: null,
        pvpBy: null,
        lastShot: -Infinity,
        lastDied: -Infinity,
      }
      ws.serializeAttachment({ phase: 'in', ...me } satisfies Attachment)
      const players: PeerInfo[] = this.members(ws).map(({ m }) => ({ id: m.id, nick: m.nick, look: m.look, s: m.s }))
      const time = roomTime(await this.clock(), Date.now())
      send(ws, { type: 'welcome', you: me.id, players, time })
      this.broadcast({ type: 'join', id: me.id, nick: me.nick, look: me.look }, ws)
      // 사람이 늘면 필요한 수가 바뀐다 (자는 사람이 있을 때만 알린다)
      await this.checkSleep(false)
      // 새로 온 사람도 바로 동물을 본다 (무리가 없으면 만들어 모두에게)
      this.stepAnimals(Date.now(), true)
      // 시계 확인 alarm 은 들어올 때만 확인해 건다 (메시지마다 부르지 않는다)
      if ((await this.ctx.storage.getAlarm()) === null) await this.ctx.storage.setAlarm(Date.now() + NET.clockEvery * 1000)
      return
    }
    const member = toMember(att)
    const now = Date.now()
    if (msg.type === 'animalHit') return this.hitAnimal(ws, member, msg, now)
    if (msg.type === 'pvpHit') return this.hitPeer(ws, member, msg, now)
    if (msg.type === 'died') return this.died(ws, member, msg.by, now)
    const r = handleMemberMsg(member, msg, now / 1000)
    if (r.member !== member) ws.serializeAttachment({ phase: 'in', ...r.member } satisfies Attachment)
    if (r.out) this.broadcast(r.out, ws)
    // 너무 잦은 잠 표시는 잠깐 뒤에 센다 (아침 직후 눕기는 checkSleep 이 미룬다)
    if (r.quiet) await this.recountSleepAt(now + NET.sleepRetry * 1000)
    else if (msg.type === 'sleep' && r.member.sleeping !== member.sleeping) await this.checkSleep(true)
    // alarm 대신: 사람 메시지가 올 때 동물을 움직인다 (0.15초에 한 번까지)
    this.stepAnimals(now)
  }

  /**
   * 동물 명중: 먼저 창·모습·도구·간격을 보고(screenAnimalHit) 버리면 무리를 움직이지도 보내지도 않는다 (메시지를 쏟아부어도 방이 바빠지지 않게).
   * 거르기를 지나면 무리를 때가 됐을 때만 움직이고 검사해서, 맞으면 체력을 깎고 쓰러뜨렸으면 잡은 사람에게만 전리품.
   * 움직였거나 맞았을 때만 모두에게 새 목록
   */
  private hitAnimal(ws: WebSocket, member: Member, msg: Extract<ClientMsg, { type: 'animalHit' }>, now: number) {
    const sc = screenAnimalHit(member, msg, now / 1000)
    if (!sc.ok) {
      if (sc.member !== member) ws.serializeAttachment({ phase: 'in', ...sc.member } satisfies Attachment)
      return
    }
    const all = this.members()
    const stepped = this.advanceHerd(all, now, false) !== null
    const herd = this.herd
    if (!herd) return
    const v = judgeAnimalHit(member, msg, herd.animals.find((a) => a.id === msg.id), now / 1000)
    if (v.member !== member) ws.serializeAttachment({ phase: 'in', ...v.member } satisfies Attachment)
    let changed = false
    if (v.ok) {
      const r = hitAnimal(herd, msg.id, v.dmg, member.id)
      this.herd = r.herd
      changed = r.result !== 'miss'
      if (r.result === 'killed' && r.animal) send(ws, { type: 'loot', items: rollDrops(r.animal.sp), x: Math.round(r.animal.x * 100) / 100, z: Math.round(r.animal.z * 100) / 100 })
    }
    if (stepped || changed) this.sendAnimals(all)
  }

  /** PvP 명중: 검사해서 맞은 사람에게만 hurt (그 사람 화면이 체력을 깎는다). 맞은 사람에게 누가 맞혔는지 남긴다 (kill 알림) */
  private hitPeer(ws: WebSocket, member: Member, msg: Extract<ClientMsg, { type: 'pvpHit' }>, now: number) {
    const target = this.members().find(({ m }) => m.id === msg.target)
    const v = judgePvpHit(member, msg, target?.m, now / 1000)
    // 버려도 1초 창은 남긴다 (버린 것도 센다)
    if (v.shooter !== member) ws.serializeAttachment({ phase: 'in', ...v.shooter } satisfies Attachment)
    if (!v.ok || !target) return
    target.ws.serializeAttachment({ phase: 'in', ...target.m, pvpBy: { id: member.id, at: now / 1000 } } satisfies Attachment)
    send(target.ws, { type: 'hurt', dmg: v.dmg, by: 'pvp', from: member.id })
  }

  /** 쓰러짐: 모두에게 kill (쓰러뜨린 사람은 정말 방금 맞힌 사람일 때만) */
  private died(ws: WebSocket, member: Member, by: string | undefined, now: number) {
    const v = judgeDied(member, by, by !== undefined && this.members(ws).some(({ m }) => m.id === by), now / 1000)
    if (!v.ok) return
    ws.serializeAttachment({ phase: 'in', ...v.member } satisfies Attachment)
    this.broadcastAll(v.out)
  }

  /** 동물을 움직일 때가 됐으면(force 면 늘) 움직이고 모두에게 보낸다 */
  private stepAnimals(now: number, force = false) {
    const all = this.members()
    if (this.advanceHerd(all, now, force)) this.sendAnimals(all)
  }

  /**
   * 무리를 지난번부터 지난 만큼(herdStepDt: 0.15초에 한 번까지, 최대 1초) 움직인다. 없으면 만든다. 들이받힌 사람에게만 hurt.
   * 움직였으면 무리, 아직 때가 아니거나 아무도 없으면 null
   */
  private advanceHerd(all: { ws: WebSocket; m: Member }[], now: number, force: boolean): Herd | null {
    if (all.length === 0) return null
    const dt = herdStepDt(this.herd ? this.herdAt : null, now, force)
    if (dt === null) return null
    this.herd ??= newHerd()
    this.herdAt = now
    const players: HerdPlayer[] = all.flatMap(({ m }) => (m.s ? [{ id: m.id, x: m.s.p[0], z: m.s.p[2], indoor: isIndoor(m.s.p[0], m.s.p[2]) }] : []))
    const r = stepHerd(this.herd, players, dt)
    this.herd = r.herd
    for (const e of r.events) {
      if (e.type !== 'attack') continue
      const target = all.find(({ m }) => m.id === e.target)
      if (target) send(target.ws, { type: 'hurt', dmg: e.dmg, by: 'animal' })
    }
    return this.herd
  }

  private sendAnimals(all: { ws: WebSocket; m: Member }[]) {
    if (!this.herd) return
    const msg: ServerMsg = { type: 'animals', list: packAnimals(herdViews(this.herd)) }
    for (const { ws } of all) send(ws, msg)
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.leave(ws)
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.leave(ws)
  }

  /**
   * 30초마다(미룬 잠 표시가 있으면 그 전에도): 시계를 확인해 보내고 잠 표시를 다시 센다.
   * 다음 alarm 을 먼저 건다 (아래에서 오류가 나도 멈추지 않게). 아무도 없으면 동물을 버리고 다시 걸지 않는다 (방이 잠든다)
   */
  async alarm(): Promise<void> {
    const all = this.members()
    if (all.length === 0) {
      this.herd = null
      this.herdAt = null
      return
    }
    const now = Date.now()
    await this.ctx.storage.setAlarm(now + NET.clockEvery * 1000)
    // 미룬 잠 표시 때문에 당겨 온 alarm 이면 시계 확인은 건너뛴다 (1초 여유)
    if (now - this.clockAt >= (NET.clockEvery - 1) * 1000) {
      this.clockAt = now
      this.broadcastAll({ type: 'time', ...roomTime(await this.clock(), now) })
    }
    await this.checkSleep(true)
  }

  /** 미룬 잠 표시를 at(ms)에 센다: 걸린 alarm 이 그보다 늦으면 당긴다 (alarm 이 다시 30초로 건다) */
  private async recountSleepAt(at: number) {
    const cur = await this.ctx.storage.getAlarm()
    if (cur === null || cur > at) await this.ctx.storage.setAlarm(at)
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
   * 방금 아침이 왔으면(NET.morningGuard 안) 아침을 또 부르지 않고 그 끝에 다시 센다 (늦게 닿은 눕기의 주인은 morning 을 받고 sleep false 로 지운다).
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
    const clock = await this.clock()
    const guardEnd = sleepGuardEnd(clock, Date.now())
    if (guardEnd !== null) return this.recountSleepAt(Math.max(guardEnd, Date.now() + NET.sleepRetry * 1000))
    const next = roomMorning(clock, Date.now())
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
    if (this.members().length === 0) {
      this.herd = null
      this.herdAt = null
      await this.ctx.storage.deleteAlarm()
    } else await this.checkSleep(a.sleeping === true)
  }
}

function send(ws: WebSocket, msg: ServerMsg) {
  try {
    ws.send(JSON.stringify(msg))
  } catch {
    // 닫히는 중인 소켓
  }
}
