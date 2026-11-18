// 로컬 방 서버(npm run server:dev) 확인: 만들기·틀린 암호·들어가기·state·chat·나가기, 방 시계·잠 투표·잠 표시 횟수 제한·아침 직후 눕기 미루기, 들판 동물(메시지에 맞춰 움직임)·명중·전리품·반격
// 사용: node tools/room-smoke.mjs [ws://127.0.0.1:8787]
import { createHash } from 'node:crypto'

const base = process.argv[2] ?? 'ws://127.0.0.1:8787'
const sha = (s) => createHash('sha256').update(s).digest('hex')
const roomId = sha(`rinfish-room|smoke-${Date.now()}`).slice(0, 32)
const look = { gender: 'male', skinColor: '#e0b089', hair: 'short', hairColor: '#3e2723', beard: false, top: 'peasant', bottom: 'peasant', shoes: 'peasant', hood: false }
const state = { p: [1, 1, 1], f: 0, v: 0, rest: false, fish: null, rod: 0.5, rodOn: true, bob: null, act: { emote: null, emoteAge: 30, airAge: null, landedAge: 30, eat: null, eatAge: 30 } }

function open(mode, pass, nick, id = roomId) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`${base}/rooms/${id}`)
    const inbox = []
    ws.onopen = () => ws.send(JSON.stringify({ type: 'hello', v: 1, mode, passHash: sha(`${id}|${pass}`), nick, look }))
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data)
      inbox.push(m)
      if (m.type === 'welcome' || m.type === 'error') resolve({ ws, first: m, inbox })
    }
  })
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const assert = (ok, label) => {
  console.log(ok ? 'OK  ' : 'FAIL', label)
  if (!ok) process.exitCode = 1
}

const a = await open('create', 'secret1', 'A')
assert(a.first.type === 'welcome' && a.first.players.length === 0, '방 만들기')
const again = await open('create', 'secret1', 'X')
assert(again.first.code === 'room-exists', '같은 이름 다시 만들기 → room-exists')
const wrong = await open('join', 'nope1234', 'X')
assert(wrong.first.code === 'bad-password', '틀린 암호 → bad-password')
const b = await open('join', 'secret1', 'B')
assert(b.first.type === 'welcome' && b.first.players.length === 1 && b.first.players[0].nick === 'A', '들어가기 → 먼저 온 사람이 보인다')
await wait(200)
assert(a.inbox.some((m) => m.type === 'join' && m.nick === 'B'), '먼저 온 사람에게 join')
a.ws.send(JSON.stringify({ type: 'state', s: state }))
a.ws.send(JSON.stringify({ type: 'chat', text: '안녕' }))
await wait(300)
assert(b.inbox.some((m) => m.type === 'state' && m.id === a.first.you), 'state 중계')
assert(b.inbox.some((m) => m.type === 'chat' && m.text === '안녕'), 'chat 중계')
assert(!a.inbox.some((m) => m.type === 'chat'), '보낸 사람에게는 되돌려 보내지 않는다')
a.ws.send(JSON.stringify({ type: 'chat', text: '도배' }))
await wait(300)
assert(b.inbox.filter((m) => m.type === 'chat').length === 1, '1초 안에 또 보낸 chat 은 버림')
await wait(800)
a.ws.send(JSON.stringify({ type: 'chat', text: '1초 뒤' }))
a.ws.send('x'.repeat(5000))
await wait(300)
assert(b.inbox.some((m) => m.type === 'chat' && m.text === '1초 뒤'), '1초 지나면 다시 chat')
const c = await open('join', 'secret1', 'C')
assert(c.first.players.some((p) => p.nick === 'A' && p.s && p.s.p[0] === 1), '나중에 온 사람도 마지막 모습을 받는다')
c.ws.close()
a.ws.close()
await wait(300)
assert(b.inbox.some((m) => m.type === 'leave' && m.id === a.first.you), '나가면 leave')
b.ws.close()
// 방 시계·잠 투표 (새 방). 셋이면 둘이 자야 아침, 사람이 나가면 다시 센다
const room2 = sha(`rinfish-room|smoke-sleep-${Date.now()}`).slice(0, 32)
const s1 = await open('create', 'secret1', 'S1', room2)
assert(s1.first.time?.day === 1 && s1.first.time.tm < 5, 'welcome 에 방 시계 (새 방은 1일차 06:00)')
const s2 = await open('join', 'secret1', 'S2', room2)
const s3 = await open('join', 'secret1', 'S3', room2)
s1.ws.send(JSON.stringify({ type: 'sleep', on: true }))
await wait(300)
assert(s3.inbox.some((m) => m.type === 'sleepers' && m.n === 1 && m.need === 2), '셋 중 한 명이 자면 모두에게 sleepers 1/2')
s2.ws.send(JSON.stringify({ type: 'sleep', on: true }))
await wait(300)
assert(s3.inbox.some((m) => m.type === 'morning' && m.day === 2), '둘이 자면 모두에게 2일차 morning')
const s4 = await open('join', 'secret1', 'S4', room2)
assert(s4.first.time?.day === 2 && s4.first.time.tm < 5, '아침 뒤에 온 사람은 2일차 06:00 근처를 받는다')
s4.ws.close()
// 아침 바로 뒤(3초 안)에 닿은 눕기는 바로 세지 않고(아침이 또 오지 않는다) 3초가 지나면 센다
s3.ws.send(JSON.stringify({ type: 'sleep', on: true }))
s2.ws.send(JSON.stringify({ type: 'sleep', on: true }))
await wait(400)
const afterMorning = s1.inbox.slice(s1.inbox.findIndex((m) => m.type === 'morning' && m.day === 2) + 1)
assert(!afterMorning.some((m) => m.type === 'morning'), '아침 직후 3초 안의 눕기로 아침이 또 오지 않는다 (표시는 남아 sleepers 로 보인다)')
await wait(3200)
assert(s1.inbox.some((m) => m.type === 'morning' && m.day === 3), '아침 직후 눕기도 버리지 않고 3초가 지나면 센다 (둘이 자서 3일차)')
// 아침 직후 누웠다가 곧 일어나면(늦게 닿은 눕기의 주인이 morning 을 받고 sleep false) 3초 뒤에도 아침이 오지 않는다
s2.ws.send(JSON.stringify({ type: 'sleep', on: true }))
s3.ws.send(JSON.stringify({ type: 'sleep', on: true }))
await wait(100)
s2.ws.send(JSON.stringify({ type: 'sleep', on: false }))
s3.ws.send(JSON.stringify({ type: 'sleep', on: false }))
await wait(3400)
assert(!s1.inbox.some((m) => m.type === 'morning' && m.day === 4), '아침 직후 누웠다 일어난 표시는 세지 않는다')
s3.ws.send(JSON.stringify({ type: 'sleep', on: true }))
await wait(300)
s2.ws.close()
await wait(500)
assert(s1.inbox.some((m) => m.type === 'morning' && m.day === 4), '사람이 나가 필요한 수가 줄면(2명 중 1명) 아침')
s1.ws.close()
s3.ws.close()
// 잠 표시를 너무 자주 바꿔(초당 4번 넘게) 세지 않은 마지막 표시도 남는다: 다음에 누가 자면 같이 센다
const room3 = sha(`rinfish-room|smoke-rate-${Date.now()}`).slice(0, 32)
const r1 = await open('create', 'secret1', 'R1', room3)
const r2 = await open('join', 'secret1', 'R2', room3)
await open('join', 'secret1', 'R3', room3)
for (const on of [true, false, true, false, true]) r1.ws.send(JSON.stringify({ type: 'sleep', on }))
await wait(300)
r2.ws.send(JSON.stringify({ type: 'sleep', on: true }))
await wait(300)
assert(r2.inbox.some((m) => m.type === 'morning' && m.day === 2), '초당 4번 넘게 바꾼 잠 표시도 마지막 값(잔다)으로 센다')
// 들판 동물 (3-3): 서버는 alarm 없이 사람 메시지가 올 때(0.15초에 한 번까지) 움직여 모두에게 같은 동물을 보낸다.
// 들판 근처 사람은 가만히 있어도 5Hz 로 모습을 보낸다 (pump). 때리면 서버가 검사해 체력을 깎고, 반격은 때린 사람에게만 hurt, 쓰러뜨리면 잡은 사람에게만 loot
const hstate = (x, z) => ({ ...state, p: [x, 1, z] })
const animalsOf = (c) => c.inbox.filter((m) => m.type === 'animals')
const lastAnimals = (c) => animalsOf(c).at(-1)?.list ?? []
/** ms 동안 0.2초마다 각자 자리에서 모습을 보낸다 (들판 근처 클라이언트처럼) */
async function pump(ms, ...who) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    for (const [c, x, z] of who) c.ws.send(JSON.stringify({ type: 'state', s: hstate(typeof x === 'function' ? x() : x, typeof z === 'function' ? z() : z) }))
    await wait(200)
  }
}
const room4 = sha(`rinfish-room|smoke-animals-${Date.now()}`).slice(0, 32)
const h1 = await open('create', 'secret1', 'H1', room4)
await wait(100)
assert(animalsOf(h1).length >= 1 && lastAnimals(h1).length === 12, '들어오자마자 동물 12마리를 받는다')
const h2 = await open('join', 'secret1', 'H2', room4)
await wait(100)
const l1 = lastAnimals(h1)
const l2 = lastAnimals(h2)
assert(l1.length === 12 && l2.length === 12, `둘 다 동물 12마리를 받는다 (${l1.length}, ${l2.length})`)
assert(JSON.stringify(l1.map((a) => [a[0], a[1]])) === JSON.stringify(l2.map((a) => [a[0], a[1]])), '둘이 같은 동물(번호·종)을 본다')
// 둘 다 들판 근처(울타리 바깥 옆)에서 5Hz 로 보내면 동물은 약 5Hz 로 움직여 온다
const before = animalsOf(h2).length
await pump(2000, [h1, 160, -40], [h2, 212, -40])
const ticks = animalsOf(h2).length - before
assert(ticks >= 8 && ticks <= 14, `둘이 들판 근처에 있으면 animals 가 약 5Hz (2초에 ${ticks}번)`)
assert(JSON.stringify(lastAnimals(h2).map((a) => [a[2], a[3]])) !== JSON.stringify(l2.map((a) => [a[2], a[3]])), '그동안 동물이 움직인다')
const cow = lastAnimals(h1).find((a) => a[0] === 1)
assert(cow && cow[1] === 0 && cow[6] === 3, '1번은 소, 체력 3')
h2.ws.send(JSON.stringify({ type: 'state', s: hstate(0, 15) }))
h1.ws.send(JSON.stringify({ type: 'state', s: hstate(cow[2] + 1, cow[3]) }))
await wait(50)
h1.ws.send(JSON.stringify({ type: 'animalHit', id: 1, dmg: 1, w: 'knife' }))
h1.ws.send(JSON.stringify({ type: 'animalHit', id: 1, dmg: 1, w: 'knife' }))
await wait(150)
assert(lastAnimals(h2).find((a) => a[0] === 1)?.[6] === 2, '칼로 때리면 체력 3 → 2, 바로 모두에게 (곧바로 또 보낸 것은 버린다)')
// 소가 쫓아오는 동안 h1 은 소 바로 옆에서 5Hz 로 보낸다 (h2 는 섬에서 가만히: 보내지 않는다)
const cowNow = () => lastAnimals(h1).find((a) => a[0] === 1)
await pump(1500, [h1, () => cowNow()[2] + 0.5, () => cowNow()[3]])
assert(h1.inbox.some((m) => m.type === 'hurt' && m.dmg === 15 && m.by === 'animal'), '맞은 소가 때린 사람을 들이받는다 (hurt 15)')
assert(!h2.inbox.some((m) => m.type === 'hurt'), '다른 사람은 hurt 를 받지 않는다')
const near = cowNow()
h1.ws.send(JSON.stringify({ type: 'state', s: hstate(near[2] + 0.5, near[3]) }))
await wait(50)
h1.ws.send(JSON.stringify({ type: 'animalHit', id: 1, dmg: 2, w: 'stab' }))
await wait(150)
const loot = h1.inbox.find((m) => m.type === 'loot')
assert(loot && JSON.stringify(loot.items) === '["beef","beef","bone"]', `찌르기(2)로 쓰러뜨리면 잡은 사람에게 소 전리품 (${JSON.stringify(loot?.items)})`)
assert(!h2.inbox.some((m) => m.type === 'loot'), '다른 사람은 전리품을 받지 않는다')
assert(lastAnimals(h2).find((a) => a[0] === 1)?.[5] === 5, '모두에게 쓰러진 모습(dead)')
const far = lastAnimals(h1).filter((a) => a[5] !== 5).sort((a, b) => Math.hypot(b[2] - near[2], b[3] - near[3]) - Math.hypot(a[2] - near[2], a[3] - near[3]))[0]
await wait(800)
h1.ws.send(JSON.stringify({ type: 'animalHit', id: far[0], dmg: 1, w: 'knife' }))
await wait(150)
assert(lastAnimals(h2).find((a) => a[0] === far[0])?.[6] === far[6], '먼 동물을 때린 것은 버린다')
await pump(1500, [h1, near[2] + 0.5, near[3]])
assert(!lastAnimals(h2).some((a) => a[0] === 1), '쓰러진 소는 1.4초 뒤 목록에서 빠진다')
// 아무도 보내지 않으면 서버는 동물을 보내지 않는다 (alarm 이 없다): 창을 뒤로 보낸 사람·가만히 있는 섬 사람
const quiet = animalsOf(h2).length
await wait(1500)
assert(animalsOf(h2).length === quiet, `아무도 보내지 않는 1.5초 동안 animals 0번 (${animalsOf(h2).length - quiet})`)
h1.ws.close()
h2.ws.close()
// 섬에 혼자 가만히 있는 사람: 2초마다 보내는 모습 한 번에 animals 도 한 번까지만 (alarm 으로 5Hz 로 보내지 않는다)
const room5 = sha(`rinfish-room|smoke-idle-${Date.now()}`).slice(0, 32)
const i1 = await open('create', 'secret1', 'I1', room5)
await wait(100)
const idle0 = animalsOf(i1).length
i1.ws.send(JSON.stringify({ type: 'state', s: hstate(0, 15) }))
await wait(1900)
i1.ws.send(JSON.stringify({ type: 'state', s: hstate(0, 15) }))
await wait(1900)
const idleN = animalsOf(i1).length - idle0
assert(idleN <= 2, `섬에 혼자 가만히(2초마다 state) 4초 동안 animals ${idleN}번 (예전 alarm 이면 20번)`)
i1.ws.close()
await wait(100)
process.exit()
