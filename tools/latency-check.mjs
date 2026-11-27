// 통신 지연 점검 (방 서버에 웹소켓 둘을 붙여 잰다): 왕복 시간(ping·pong), 모습(state)이 남에게 닿는 시간, 초당 20번 보내도 서버가 버리지 않는지.
// 준비: npm run server:dev (8787)
// 사용: node tools/latency-check.mjs [ws://127.0.0.1:8787]
import { createHash } from 'node:crypto'
import { performance } from 'node:perf_hooks'

const base = process.argv[2] ?? 'ws://127.0.0.1:8787'
const sha = (s) => createHash('sha256').update(s).digest('hex')
const roomId = sha(`rinfish-room|latency-${Date.now()}`).slice(0, 32)
const look = { gender: 'male', skinColor: '#e0b089', hair: 'short', hairColor: '#3e2723', beard: false, top: 'peasant', bottom: 'peasant', shoes: 'peasant', hood: false }
const state = (x) => ({ p: [x, 1, 1], f: 0, v: 8, rest: false, fish: null, rod: 0.5, rodOn: true, bob: null, act: { emote: null, emoteAge: 30, airAge: null, landedAge: 30, eat: null, eatAge: 30 } })

function open(mode, nick) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`${base}/rooms/${roomId}`)
    const on = []
    ws.onopen = () => ws.send(JSON.stringify({ type: 'hello', v: 1, mode, passHash: sha(`${roomId}|secret1`), nick, look }))
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data)
      for (const f of on) f(m)
      if (m.type === 'welcome' || m.type === 'error') resolve({ ws, first: m, on })
    }
  })
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const check = (ok, label) => {
  console.log(ok ? 'OK  ' : 'FAIL', label)
  if (!ok) process.exitCode = 1
}
const mid = (list) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)]
const top = (list) => [...list].sort((a, b) => a - b)[Math.min(list.length - 1, Math.floor(list.length * 0.95))]
const ms = (n) => `${n.toFixed(1)}ms`

const a = await open('create', 'A')
const b = await open('join', 'B')
check(a.first.type === 'welcome' && b.first.type === 'welcome', '둘이 방에 들어간다')

// 1) 왕복 시간: ping 을 20번 보내 pong 이 돌아오는 시간
const rtts = []
a.on.push((m) => {
  if (m.type === 'pong') rtts.push(performance.now() - m.t)
})
const others = []
b.on.push((m) => {
  if (m.type === 'pong') others.push(m)
})
for (let i = 0; i < 20; i++) {
  a.ws.send(JSON.stringify({ type: 'ping', t: performance.now() }))
  await wait(50)
}
await wait(300)
check(rtts.length === 20, `ping 20번에 pong 20번 (${rtts.length})`)
check(others.length === 0, 'pong 은 보낸 사람에게만 간다')
if (rtts.length) console.log(`  왕복 시간: 가운데 ${ms(mid(rtts))} · 느린 5% ${ms(top(rtts))}`)

// 2) 모습 중계: A 가 초당 20번(0.05초마다) 3초 동안 보내고, B 가 받은 수·간격·걸린 시간을 잰다 (보낸 시각은 x 좌표 순서로 맞춘다)
const sentAt = new Map()
const got = []
b.on.push((m) => {
  if (m.type === 'state') got.push({ x: m.s.p[0], at: performance.now() })
})
const N = 60
for (let i = 0; i < N; i++) {
  const x = Math.round((10 + i * 0.4) * 100) / 100
  sentAt.set(x, performance.now())
  a.ws.send(JSON.stringify({ type: 'state', s: state(x) }))
  await wait(50)
}
await wait(500)
check(got.length === N, `초당 20번 보낸 모습 ${N}개를 서버가 하나도 버리지 않는다 (${got.length})`)
const relay = got.filter((g) => sentAt.has(g.x)).map((g) => g.at - sentAt.get(g.x))
const gaps = got.slice(1).map((g, i) => g.at - got[i].at)
if (relay.length) console.log(`  모습이 남에게 닿기까지: 가운데 ${ms(mid(relay))} · 느린 5% ${ms(top(relay))}`)
if (gaps.length) console.log(`  받는 간격: 가운데 ${ms(mid(gaps))} · 느린 5% ${ms(top(gaps))}`)
check(relay.length > 0 && top(relay) < 150, '모습 중계가 150ms 안 (느린 5% 기준)')

// 3) 너무 잦으면(초당 30번 넘게) 버린다: 한꺼번에 50개
const before = got.length
for (let i = 0; i < 50; i++) a.ws.send(JSON.stringify({ type: 'state', s: state(100 + i) }))
await wait(500)
check(got.length - before <= 30, `한꺼번에 50개를 보내면 30개까지만 받는다 (${got.length - before})`)

a.ws.close()
b.ws.close()
await wait(200)
process.exit(process.exitCode ?? 0)
