// 로컬 방 서버(npm run server:dev) 확인: 만들기·틀린 암호·들어가기·state·chat·나가기
// 사용: node tools/room-smoke.mjs [ws://127.0.0.1:8787]
import { createHash } from 'node:crypto'

const base = process.argv[2] ?? 'ws://127.0.0.1:8787'
const sha = (s) => createHash('sha256').update(s).digest('hex')
const roomId = sha(`rinfish-room|smoke-${Date.now()}`).slice(0, 32)
const look = { gender: 'male', skinColor: '#e0b089', hair: 'short', hairColor: '#3e2723', beard: false, top: 'peasant', bottom: 'peasant', shoes: 'peasant', hood: false }
const state = { p: [1, 1, 1], f: 0, v: 0, rest: false, fish: null, rod: 0.5, rodOn: true, bob: null, act: { emote: null, emoteAge: 30, airAge: null, landedAge: 30, eat: null, eatAge: 30 } }

function open(mode, pass, nick) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`${base}/rooms/${roomId}`)
    const inbox = []
    ws.onopen = () => ws.send(JSON.stringify({ type: 'hello', v: 1, mode, passHash: sha(`${roomId}|${pass}`), nick, look }))
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
await wait(100)
process.exit()
