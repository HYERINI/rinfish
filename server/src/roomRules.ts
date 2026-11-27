import { hitRadius } from '../../src/game/data/animals'
import { GUNS, GUN_RANGE, GUN_SWAP, PEER_HIT, PVP, isGun, type GunId, type PvpWeapon } from '../../src/game/data/guns'
import { MELEE, MELEE_IDS, hitDelay, meleeFor, type MeleeId } from '../../src/game/data/melee'
import { NET } from '../../src/game/data/net'
import type { CharacterLook } from '../../src/game/data/types'
import type { AnimalView } from '../../src/game/logic/animalSim'
import type { RoomClock } from '../../src/game/logic/dayClock'
import { roundShot, type ClientMsg, type ErrorCode, type HitWeapon, type NetState, type ServerMsg } from '../../src/game/logic/netProtocol'
import { NEW_WINDOW, allowEvery, allowPerSecond, type RateWindow } from '../../src/game/logic/rateLimit'

/** 방 저장소에 두는 것: 암호 해시와 만든·마지막으로 쓴 시각(ms) */
export type RoomMeta = { passHash: string; createdAt: number; lastActive: number }

/**
 * 한 발(shot 번호)에 받은 명중: 같은 발의 다른 대상은 간격을 다시 재지 않고 받는다 (산탄총이 여럿을 맞힘).
 * at: 첫 명중을 받은 때(초), n: 받은 알 수 합, ids: 받은 대상
 */
export type ShotGroup<K> = { shot: number; w: GunId; at: number; n: number; ids: K[] }

/**
 * 방에 들어온 사람 (웹소켓 붙임 정보). 시각은 초. sleeping: 잠 투표 중 (침대에 누워 있다).
 * lastHit·lastW: 마지막으로 받은 동물 명중과 그 무기, hitWin: animalHit 메시지 1초 창 (버린 것도 센다), hitShot: 마지막 총 명중의 한 발.
 * 3-4: pvpLast: 마지막으로 받은 PvP 명중의 무기와 시각 (무기를 바꿔도 사람마다 하나), pvpWin: pvpHit 1초 창 (버린 것도 센다), pvpShot: 마지막 PvP 총 명중의 한 발,
 * pvpBy: 마지막으로 나를 맞힌 사람과 때 (쓰러뜨린 사람 알림), lastShot·lastDied: 마지막 shot·died
 */
export type Member = {
  id: string
  nick: string
  look: CharacterLook
  joinedAt: number
  s: NetState | null
  stateWin: RateWindow
  lastChat: number
  lastProfile: number
  sleeping: boolean
  sleepWin: RateWindow
  lastHit: number
  lastW: HitWeapon | null
  hitWin: RateWindow
  hitShot: ShotGroup<number> | null
  pvpLast: { w: PvpWeapon; at: number } | null
  pvpWin: RateWindow
  pvpShot: ShotGroup<string> | null
  pvpBy: { id: string; at: number } | null
  lastShot: number
  lastDied: number
}

/**
 * 웹소켓 붙임 정보 → 사람. 3-1 전에 붙은 소켓(배포 중 살아 있던 방)엔 잠 필드가 없다: 안 자는 사람·새 창으로 본다.
 * 3-3 전 소켓엔 lastHit 이 없다: 한 번도 안 때린 사람. lastW·hitWin 이 없으면 모르는 종류·새 창. 3-4 전 소켓은 PvP·사격을 한 적 없는 사람.
 * 3-4 첫 배포의 무기마다 간격(pvpAt)은 버린다 (다음 명중부터 사람마다 하나로 잰다)
 */
type Optional = 'sleeping' | 'sleepWin' | 'lastHit' | 'lastW' | 'hitWin' | 'hitShot' | 'pvpLast' | 'pvpWin' | 'pvpShot' | 'pvpBy' | 'lastShot' | 'lastDied'
export function memberFrom(a: Omit<Member, Optional> & Partial<Pick<Member, Optional>>): Member {
  return {
    id: a.id,
    nick: a.nick,
    look: a.look,
    joinedAt: a.joinedAt,
    s: a.s,
    stateWin: a.stateWin,
    lastChat: a.lastChat,
    lastProfile: a.lastProfile,
    sleeping: a.sleeping === true,
    sleepWin: a.sleepWin ?? NEW_WINDOW,
    lastHit: a.lastHit ?? -Infinity,
    lastW: a.lastW ?? null,
    hitWin: a.hitWin ?? NEW_WINDOW,
    hitShot: a.hitShot ?? null,
    pvpLast: a.pvpLast ?? null,
    pvpWin: a.pvpWin ?? NEW_WINDOW,
    pvpShot: a.pvpShot ?? null,
    pvpBy: a.pvpBy ?? null,
    lastShot: a.lastShot ?? -Infinity,
    lastDied: a.lastDied ?? -Infinity,
  }
}

const DAY_MS = 86_400_000

/** 입장 판정. players: 지금 방에 들어와 있는 사람 수. fresh: 방을 새로 만들었다 (옛 방 시계를 버린다) */
export function judgeHello(hello: Extract<ClientMsg, { type: 'hello' }>, meta: RoomMeta | null, players: number, nowMs: number): { ok: true; meta: RoomMeta; fresh?: true } | { ok: false; code: ErrorCode } {
  if (hello.v !== NET.protocolVersion) return { ok: false, code: 'version' }
  // 아무도 없는 채 오래된 방은 없는 방으로 본다 (이름을 다시 쓸 수 있게)
  const live = meta && (players > 0 || nowMs - meta.lastActive <= NET.roomExpireDays * DAY_MS) ? meta : null
  if (hello.mode === 'create') {
    if (live) return { ok: false, code: 'room-exists' }
    return { ok: true, fresh: true, meta: { passHash: hello.passHash, createdAt: nowMs, lastActive: nowMs } }
  }
  if (!live) return { ok: false, code: 'no-room' }
  if (live.passHash !== hello.passHash) return { ok: false, code: 'bad-password' }
  if (players >= NET.maxPlayers) return { ok: false, code: 'full' }
  return { ok: true, meta: { ...live, lastActive: nowMs } }
}

/**
 * 들어온 사람의 메시지 하나 처리: 바뀐 사람 정보와 다른 사람들에게 보낼 메시지(없으면 null).
 * quiet: 너무 잦은 sleep 이라 표시만 바꾸고 세지 않는다 (room.ts 가 다음 alarm 에 센다)
 */
export function handleMemberMsg(member: Member, msg: ClientMsg, nowSec: number): { member: Member; out: ServerMsg | null; quiet?: true } {
  switch (msg.type) {
    case 'state': {
      const r = allowPerSecond(member.stateWin, nowSec, NET.serverStatePerSecond)
      if (!r.ok) return { member, out: null }
      return { member: { ...member, s: msg.s, stateWin: r.w }, out: { type: 'state', id: member.id, s: msg.s } }
    }
    case 'chat':
      if (!allowEvery(member.lastChat, nowSec, NET.serverChatEvery)) return { member, out: null }
      return { member: { ...member, lastChat: nowSec }, out: { type: 'chat', id: member.id, text: msg.text } }
    case 'profile':
      if (!allowEvery(member.lastProfile, nowSec, NET.serverProfileEvery)) return { member, out: null }
      return { member: { ...member, nick: msg.nick, look: msg.look, lastProfile: nowSec }, out: { type: 'profile', id: member.id, nick: msg.nick, look: msg.look } }
    case 'sleep': {
      // 자는 사람 수는 방 전체를 봐야 해서 room.ts 가 센다 (tallySleep). 여기서는 표시만 바꾼다.
      // 너무 잦아도 마지막 표시는 남긴다 (버리면 서버와 클라이언트의 잠 표시가 어긋난다)
      const r = allowPerSecond(member.sleepWin, nowSec, NET.serverSleepPerSecond)
      if (!r.ok) return { member: { ...member, sleeping: msg.on }, out: null, quiet: true }
      return { member: { ...member, sleeping: msg.on, sleepWin: r.w }, out: null }
    }
    case 'shot': {
      // 남의 화면에 궤적만 그린다 (판정 없음, 은지 그대로). 너무 잦거나 내 자리에서 먼 총구는 버린다
      if (!allowEvery(member.lastShot, nowSec, NET.serverShotEvery)) return { member, out: null }
      const p = member.s?.p
      if (p && Math.hypot(msg.o[0] - p[0], msg.o[1] - p[1], msg.o[2] - p[2]) > NET.shotOriginSlack) return { member, out: null }
      return { member: { ...member, lastShot: nowSec }, out: { type: 'shot', id: member.id, ...roundShot(msg.o, msg.d), w: msg.w } }
    }
    case 'hello':
    case 'animalHit':
    case 'pvpHit':
    case 'died':
      // 동물 명중은 방의 동물을, PvP·쓰러짐은 맞은 사람을 봐야 해서 room.ts 가 judgeAnimalHit·judgePvpHit·judgeDied 로 본다
      return { member, out: null }
    case 'ping':
      // 보낸 사람에게만 pong 으로 답한다 (room.ts). 남에게 보낼 것은 없다
      return { member, out: null }
  }
}

const isMelee = (w: HitWeapon | PvpWeapon): w is MeleeId => (MELEE_IDS as string[]).includes(w)

/**
 * 든 도구로 할 수 있는 공격인가. 총은 그 총을 들고 있어야 한다.
 * 도구를 모르면(모습에 tool 이 없다) 3-3 클라이언트의 근접 동물 명중만 믿는다: 총과 PvP 는 3-4 클라이언트만 보내고, 3-4 는 늘 도구를 보낸다
 */
function toolAllows(s: NetState, w: HitWeapon | PvpWeapon, pvp: boolean): boolean {
  if (!s.tool) return !pvp && isMelee(w)
  return isMelee(w) ? meleeFor(s.tool, w === 'stab') === w : s.tool === w
}

/** 무기 사거리 (m): 근접은 공격 표, 총은 은지 MAX_RANGE */
const reachOf = (w: HitWeapon | PvpWeapon) => (isMelee(w) ? MELEE[w].reach : GUN_RANGE)

/** 산탄총 알 수 (1 ~ 그 총의 알 수). 다른 무기는 1 */
const pellets = (w: HitWeapon | PvpWeapon, n: number | undefined) => (isGun(w) ? Math.min(GUNS[w].pellets, Math.max(1, Math.floor(n ?? 1))) : 1)

/**
 * 앞 명중(prev)에서 다음 명중(next)까지 받는 최소 간격(초). 화면에선 앞 공격 간격(cool)이 지나야 다시 휘두르고
 * 맞는 순간은 공격마다 달라서, 종류를 바꾸면 cool(prev) + 맞는 순간(next) − 맞는 순간(prev) 이 된다 (여유 NET.hitTimingSlack 을 뺀다).
 * 같은 종류 최소 간격(serverCool, 스펙 주먹 0.3·칼 0.4·찌르기 0.7초)보다 길게 잡지는 않는다
 */
export function minHitGap(prev: MeleeId, next: MeleeId): number {
  return Math.min(MELEE[next].serverCool, MELEE[prev].cool + hitDelay(next) - hitDelay(prev) - NET.hitTimingSlack)
}

/**
 * 앞 명중(prev 무기)에서 다음 명중(next)까지 받는 동물 명중 최소 간격(초). 근접끼리는 minHitGap,
 * 총이 끼면 다음 무기의 간격 (총은 은지 HIT_COOL: 권총 0.15·소총 0.07·산탄 0.6·저격 1.2초, 근접은 serverCool)
 */
export function hitGap(prev: HitWeapon, next: HitWeapon): number {
  if (isMelee(prev) && isMelee(next)) return minHitGap(prev, next)
  return isMelee(next) ? MELEE[next].serverCool : PVP[next].cool
}

/**
 * PvP 명중 사이 최소 간격(초). 사람마다 하나로 재서 무기를 바꿔 가며 보내도 피해가 쌓이지 않는다.
 * 같은 무기는 그 무기 간격(은지 HIT_COOL), 근접끼리는 화면 시간(minHitGap), 다른 총으로는 총 바꾸는 시간(GUN_SWAP) 이상,
 * 총에서 근접으로는 도구를 바꿔 바로 휘두른 맞는 순간 − 여유(NET.hitTimingSlack)
 */
export function pvpGap(prev: PvpWeapon, next: PvpWeapon): number {
  if (prev === next) return PVP[next].cool
  if (isMelee(next)) return isMelee(prev) ? minHitGap(prev, next) : Math.max(0, hitDelay(next) - NET.hitTimingSlack)
  return Math.max(PVP[next].cool, GUN_SWAP)
}

/**
 * 간격 검사: 앞 명중 시각(last)에서 gap 초가 지났으면 남길 시각, 아니면 null.
 * 총(gun)은 NET.gunTimingSlack 만큼 일찍 와도 받는다 (앞 메시지가 늦게 닿으면 제때 온 다음 것과 가까워진다).
 * 이때 남길 시각은 앞 + 간격이라 계속 일찍 보내도 평균 빠르기는 1 / gap 을 넘지 않는다
 */
export function nextHitAt(last: number, gap: number, nowSec: number, gun: boolean): number | null {
  if (!gun) return nowSec - last >= gap ? nowSec : null
  if (nowSec - last < gap - NET.gunTimingSlack) return null
  return Math.max(nowSec, last + gap)
}

/** 같은 한 발의 다른 대상인가: 같은 총·같은 번호, NET.shotGroupWindow 초 안, 아직 안 받은 대상, 알 수 합이 그 총 알 수 이하 */
function sameShot<K>(g: ShotGroup<K> | null, shot: number | undefined, w: HitWeapon | PvpWeapon, id: K, n: number, nowSec: number): g is ShotGroup<K> {
  return g !== null && shot !== undefined && g.shot === shot && g.w === w && nowSec - g.at <= NET.shotGroupWindow && !g.ids.includes(id) && g.n + n <= GUNS[g.w].pellets
}

/** 받은 명중의 한 발 기록: 같은 발이면 대상·알 수를 더하고, 새 발이면 새로 (번호가 없거나 근접이면 null) */
function shotAfter<K>(g: ShotGroup<K> | null, follow: boolean, shot: number | undefined, w: HitWeapon | PvpWeapon, id: K, n: number, nowSec: number): ShotGroup<K> | null {
  if (follow && g) return { ...g, n: g.n + n, ids: [...g.ids, id] }
  return shot !== undefined && isGun(w) ? { shot, w, at: nowSec, n, ids: [id] } : null
}

type AnimalHitMsg = Extract<ClientMsg, { type: 'animalHit' }>

/**
 * 동물을 보기 전에 거르기 (room.ts 가 무리를 움직이기 전에 부른다: 버리면 움직이지도 보내지도 않는다).
 * 초당 NET.serverHitPerSecond 번(총은 serverGunHitPerSecond) 넘게 온 것(버린 것도 센다), 모습을 아직 안 보낸 사람,
 * 든 도구로 할 수 없는 공격, 앞 명중에서 hitGap 안에 또 온 것(같은 한 발의 다른 동물은 빼고)을 버린다.
 * member: 창을 센 사람 (버려도 남긴다), next: 받으면 고칠 마지막 명중
 */
export function screenAnimalHit(member: Member, msg: AnimalHitMsg, nowSec: number): { ok: false; member: Member } | { ok: true; member: Member; next: Pick<Member, 'lastHit' | 'lastW' | 'hitShot'> } {
  const rate = allowPerSecond(member.hitWin, nowSec, isMelee(msg.w) ? NET.serverHitPerSecond : NET.serverGunHitPerSecond)
  if (!rate.ok) return { ok: false, member }
  const counted: Member = { ...member, hitWin: rate.w }
  const no = { ok: false as const, member: counted }
  if (!member.s || !toolAllows(member.s, msg.w, false)) return no
  const n = pellets(msg.w, msg.n)
  const follow = sameShot(member.hitShot, msg.shot, msg.w, msg.id, n, nowSec)
  const at = follow ? member.lastHit : nextHitAt(member.lastHit, hitGap(member.lastW ?? msg.w, msg.w), nowSec, isGun(msg.w))
  if (at === null) return no
  return { ok: true, member: counted, next: { lastHit: at, lastW: msg.w, hitShot: shotAfter(member.hitShot, follow, msg.shot, msg.w, msg.id, n, nowSec) } }
}

/**
 * 동물 명중 검사 (같이 하기). 받아들이면 피해(무기 표의 값, 보낸 dmg 는 믿지 않는다)와 마지막 명중 시각·무기·한 발을 고친 사람.
 * 피해: 근접은 공격 표, 총은 알마다 은지 피해(저격 3, 나머지 1) × 맞은 알 수 (산탄총만 여럿, 최대 8).
 * 버리는 것: screenAnimalHit 이 버리는 것, 없거나 쓰러진 동물, 내 마지막 모습에서 사거리 + 판정 원 + 여유(NET.hitSlack) 보다 먼 동물.
 * 버려도 member 를 돌려준다 (1초 창을 남긴다)
 */
export function judgeAnimalHit(member: Member, msg: AnimalHitMsg, animal: AnimalView | undefined, nowSec: number): { ok: true; dmg: number; member: Member } | { ok: false; member: Member } {
  const sc = screenAnimalHit(member, msg, nowSec)
  if (!sc.ok) return sc
  const no = { ok: false as const, member: sc.member }
  if (!member.s || !animal || animal.pose === 'dead') return no
  const d = Math.hypot(member.s.p[0] - animal.x, member.s.p[2] - animal.z)
  if (d > reachOf(msg.w) + hitRadius(animal.sp) + NET.hitSlack) return no
  const dmg = isMelee(msg.w) ? MELEE[msg.w].dmg : GUNS[msg.w].dmg * pellets(msg.w, msg.n)
  return { ok: true, dmg, member: { ...sc.member, ...sc.next } }
}

/**
 * PvP 명중 검사 (은지 server hit). 쏜 사람 화면이 판정한 것을 무기 피해표(PVP)와 사람마다 하나인 최소 간격(pvpGap)으로 본다.
 * 받아들이면 피해(권총 20 · 소총 14 · 산탄 9×알 수(최대 8) · 저격 70 · 칼 15 · 찌르기 30 · 주먹 5)와 마지막 명중을 고친 쏜 사람.
 * 버리는 것: 초당 NET.serverPvpHitPerSecond 번 넘게 온 것(버린 것도 센다), 없거나 나 자신인 사람, 모습을 아직 안 보낸 사람(쏜 사람·맞은 사람),
 * 든 도구를 모르거나 그 도구로 할 수 없는 무기, 앞 명중에서 간격 안에 또 온 것(같은 한 발의 다른 사람은 빼고),
 * 서로의 마지막 모습이 사거리 + 몸 반지름 + 여유(NET.hitSlack) 보다 먼 것. 버려도 shooter 를 돌려준다 (1초 창을 남긴다)
 */
export function judgePvpHit(shooter: Member, msg: Extract<ClientMsg, { type: 'pvpHit' }>, victim: Member | undefined, nowSec: number): { ok: true; dmg: number; shooter: Member } | { ok: false; shooter: Member } {
  const rate = allowPerSecond(shooter.pvpWin, nowSec, NET.serverPvpHitPerSecond)
  if (!rate.ok) return { ok: false, shooter }
  const counted: Member = { ...shooter, pvpWin: rate.w }
  const no = { ok: false as const, shooter: counted }
  const w = msg.weapon
  if (!victim || victim.id === shooter.id || !shooter.s || !victim.s) return no
  if (!toolAllows(shooter.s, w, true)) return no
  const [a, b] = [shooter.s.p, victim.s.p]
  if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) > reachOf(w) + PEER_HIT.radius + NET.hitSlack) return no
  const n = pellets(w, msg.n)
  const last = shooter.pvpLast
  const follow = sameShot(shooter.pvpShot, msg.shot, w, victim.id, n, nowSec)
  const at = follow && last ? last.at : nextHitAt(last?.at ?? -Infinity, last ? pvpGap(last.w, w) : 0, nowSec, isGun(w))
  if (at === null) return no
  const pvpLast = follow && last ? last : { w, at }
  return { ok: true, dmg: PVP[w].dmg * n, shooter: { ...counted, pvpLast, pvpShot: shotAfter(shooter.pvpShot, follow, msg.shot, w, victim.id, n, nowSec) } }
}

/**
 * 쓰러짐 알림 (died). 너무 잦으면(NET.serverDiedEvery 안) 버린다. 쓰러뜨린 사람(killer)은 by 가 정말 NET.killCredit 초 안에
 * 나를 맞힌 사람이고 아직 방에 있을 때만 (거짓 알림을 막는다). 알린 뒤 맞힌 기록을 지운다
 */
export function judgeDied(member: Member, by: string | undefined, killerHere: boolean, nowSec: number): { ok: true; member: Member; out: ServerMsg } | { ok: false } {
  if (!allowEvery(member.lastDied, nowSec, NET.serverDiedEvery)) return { ok: false }
  const credited = by !== undefined && killerHere && member.pvpBy?.id === by && nowSec - member.pvpBy.at <= NET.killCredit
  return { ok: true, member: { ...member, lastDied: nowSec, pvpBy: null }, out: credited ? { type: 'kill', victim: member.id, killer: by } : { type: 'kill', victim: member.id } }
}

/** 동물을 움직이는 최소 간격(초): 사람 메시지(5Hz)가 올 때 움직이되, 0.2초에 조금 못 미쳐 와도 건너뛰지 않게 0.75 × NET.animalEvery */
export const HERD_STEP_MIN = 0.75 * NET.animalEvery

/**
 * 지난번 움직인 때(lastMs, 무리가 없으면 null)부터 지금 움직일지: 움직일 초(최대 1초) 또는 아직이면 null.
 * 무리가 없으면 0 (새로 만들어 바로 보낸다). 서버 시계가 뒤로 가면 0 (지금부터 다시 잰다).
 * force: 최소 간격을 보지 않는다 (새로 온 사람)
 */
export function herdStepDt(lastMs: number | null, nowMs: number, force = false): number | null {
  if (lastMs === null) return 0
  const since = (nowMs - lastMs) / 1000
  if (since < 0) return 0
  if (!force && since < HERD_STEP_MIN - 1e-9) return null
  return Math.min(1, since)
}

/** 잠 투표 세기: 방 인원의 절반(올림) 이상이 자면 아침. 아무도 안 자면 아침이 아니다 */
export function tallySleep(sleeping: boolean[]): { n: number; need: number; morning: boolean } {
  const n = sleeping.filter(Boolean).length
  const need = Math.max(1, Math.ceil(sleeping.length / 2))
  return { n, need, morning: n > 0 && n >= need }
}

/**
 * 방금 잠 투표로 아침이 왔나 (기준점에서 NET.morningGuard 초 안). 이때 닿은 "눕기"는 버린다:
 * 둘이 거의 같이 누우면 한 사람으로 아침이 오고, 늦게 닿은 다른 사람의 눕기가 다음 아침을 또 부른다.
 * 새로 만든 방(1일차 기준점)은 아침이 아니다
 */
export function justAfterMorning(clock: RoomClock, nowMs: number): boolean {
  const since = nowMs - clock.epoch
  return clock.day0 > 1 && since >= 0 && since < NET.morningGuard * 1000
}

/** 아침 직후(justAfterMorning)면 그 끝(ms). 그동안 닿은 눕기는 표시만 남기고 이때 센다. 아니면 null */
export function sleepGuardEnd(clock: RoomClock, nowMs: number): number | null {
  return justAfterMorning(clock, nowMs) ? clock.epoch + NET.morningGuard * 1000 : null
}
