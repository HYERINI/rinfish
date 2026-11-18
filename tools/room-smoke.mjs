// 로컬 방 서버(npm run server:dev) 확인: 만들기·틀린 암호·들어가기·state·chat·나가기, 방 시계·잠 투표·잠 표시 횟수 제한
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
s3.ws.send(JSON.stringify({ type: 'sleep', on: true }))
await wait(300)
s2.ws.close()
await wait(500)
assert(s1.inbox.some((m) => m.type === 'morning' && m.day === 3), '사람이 나가 필요한 수가 줄면(2명 중 1명) 아침')
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
await wait(100)
process.exit()
