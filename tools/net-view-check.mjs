// 통신 지연 화면 점검 (헤드리스 Chrome + 가짜 상대): 게임 화면이 왕복 시간을 재는지, 상대가 보내는 빠르기에 맞춰 덜 늦게 그리는지, 실제로 얼마나 늦게 보이는지.
// 준비: npm run server:dev (8787) 와 VITE_ROOM_SERVER=ws://127.0.0.1:8787 npx vite --port 5190 --strictPort --host 127.0.0.1
// 사용: node tools/net-view-check.mjs [게임 주소]   (Chrome 자리는 CHROME 환경 변수)
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import WebSocket from 'ws'

const GAME = process.argv[2] ?? 'http://127.0.0.1:5190'
const CHROME = process.env.CHROME ?? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p))
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
let failed = 0
const check = (ok, label) => {
  console.log(ok ? 'OK  ' : 'FAIL', label)
  if (!ok) failed++
}
const consoleErrors = []
// 점검마다 다른 포트 (앞 점검의 브라우저가 덜 꺼졌어도 겹치지 않게)
const PORT = 9300 + Math.floor(Math.random() * 600)

const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'net-'))}`, '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1000,700', '--no-first-run', 'about:blank'], { stdio: 'ignore' })
let target
for (let i = 0; i < 200 && !target; i++) {
  await wait(200)
  target = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json()).then((l) => l.find((t) => t.type === 'page')).catch(() => undefined)
}
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((r) => ws.once('open', r))
let seq = 0
const pending = new Map()
ws.on('message', (raw) => {
  const m = JSON.parse(raw)
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m)
    pending.delete(m.id)
  }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') consoleErrors.push(m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 300))
  if (m.method === 'Runtime.exceptionThrown') consoleErrors.push(`[exception] ${(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text).slice(0, 300)}`)
})
const send = (method, params = {}) => new Promise((resolve) => {
  const id = ++seq
  pending.set(id, resolve)
  ws.send(JSON.stringify({ id, method, params }))
})
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (r.result?.exceptionDetails) throw new Error(`${expression.slice(0, 80)} → ${JSON.stringify(r.result.exceptionDetails).slice(0, 300)}`)
  return r.result?.result?.value
}
const until = async (expression, ms = 60000) => {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (await evaluate(expression).catch(() => false)) return true
    await wait(300)
  }
  return false
}
const key = (code) => evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: '${code}', key: '${code}', bubbles: true, cancelable: true })), window.dispatchEvent(new KeyboardEvent('keyup', { code: '${code}', key: '${code}', bubbles: true })), true`)

await send('Page.enable')
await send('Runtime.enable')
await send('Page.navigate', { url: GAME })
await until(`document.readyState === 'complete'`)
await evaluate(`(async () => {
  const { LOOK_PRESETS } = await import('/src/game/data/characterParts.ts')
  localStorage.setItem('fishing-island-save-v1', JSON.stringify({ state: { look: LOOK_PRESETS[0].look }, version: 2 }))
  localStorage.removeItem('fishing-island-place-v1')
  return true
})()`)
await send('Page.navigate', { url: GAME })
await until(`document.readyState === 'complete'`)
await evaluate(`
window.__mod = async (path) => {
  const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes(path))
  return import(url ?? path)
};
window.__click = (text) => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === text)
  if (!b) return false
  b.click()
  return true
};
true`)
await until(`document.body.innerText.includes('혼자 하기')`, 120000)
await until(`!document.body.innerText.includes('헤엄쳐 오는 중')`, 240000)
await evaluate(`__click('혼자 하기')`)
await wait(1500)




const SERVER = 'ws://127.0.0.1:8787'
const ROOM = 'lat-' + Date.now().toString(36)
// 게임 화면이 방을 만든다. 방 번호·암호 해시는 화면과 같은 식으로 구해 가짜 상대가 쓴다
const keys = await evaluate(`(async () => {
  const { roomIdFor, passHashFor, normalizeRoomName } = await __mod('/src/game/logic/roomKey.ts')
  const { useNetStore } = await __mod('/src/game/stores/netStore.ts')
  const { useProgressStore } = await __mod('/src/game/stores/progressStore.ts')
  const id = await roomIdFor(normalizeRoomName('${ROOM}'))
  const passHash = await passHashFor(id, 'secret1')
  await useNetStore.getState().join({ mode: 'create', room: '${ROOM}', password: 'secret1', nick: 'me', look: useProgressStore.getState().look })
  return { id, passHash, look: useProgressStore.getState().look }
})()`)
check(await until(`(async () => (await __mod('/src/game/stores/netStore.ts')).useNetStore.getState().phase === 'online')()`, 20000), '게임 화면이 방에 들어간다')

const st = (x, v) => ({ p: [x, 1, -3], f: 0, v, rest: false, fish: null, rod: 0.5, rodOn: true, bob: null, act: { emote: null, emoteAge: 30, airAge: null, landedAge: 30, eat: null, eatAge: 30 } })
const bot = new WebSocket(`${SERVER}/rooms/${keys.id}`)
const botIn = []
await new Promise((r) => bot.once('open', r))
bot.on('message', (raw) => botIn.push(JSON.parse(raw)))
bot.send(JSON.stringify({ type: 'hello', v: 1, mode: 'join', passHash: keys.passHash, nick: 'bot', look: keys.look }))
await wait(1500)
check(botIn.some((m) => m.type === 'welcome'), '가짜 상대가 같은 방에 들어간다')

const read = () => evaluate(`(async () => {
  const { netStats, sendRate } = await __mod('/src/game/net/netStats.ts')
  const { remoteRig, remoteView, netNow } = await __mod('/src/game/net/remoteRig.ts')
  const e = [...remoteRig.values()][0]
  const v = e ? remoteView(e, netNow()) : null
  return { rtt: netStats.rtt, fast: netStats.fast, hz: sendRate(), delay: e ? e.delay : null, gap: e ? e.gap : null, x: v ? v.x : null }
})()`)

// 가짜 상대가 hz 번/초로 초당 8m 걸어간다. sec 초 뒤 화면 값을 읽고, 그때 상대의 진짜 자리와 화면에 그린 자리의 차이로 실제로 늦는 시간을 잰다
async function walk(hz, sec, from) {
  const t0 = performance.now()
  let x = from
  const timer = setInterval(() => {
    x = from + ((performance.now() - t0) / 1000) * 8
    bot.send(JSON.stringify({ type: 'state', s: st(Math.round(x * 100) / 100, 8) }))
  }, 1000 / hz)
  await wait(sec * 1000)
  const lags = []
  for (let i = 0; i < 10; i++) {
    const r = await read()
    const real = from + ((performance.now() - t0) / 1000) * 8
    if (r.x !== null) lags.push(((real - r.x) / 8) * 1000)
    await wait(100)
  }
  const r = await read()
  clearInterval(timer)
  lags.sort((a, b) => a - b)
  return { ...r, lag: lags[Math.floor(lags.length / 2)], end: x }
}
const f = (n) => (n === null || n === undefined ? '?' : (n * 1000).toFixed(0) + 'ms')

// 먼저 화면이 보내는 빠르기: 게임 화면을 걷게 하고 가짜 상대가 받은 state 수를 센다
const fast = await read()
console.log(`  화면: 왕복 ${f(fast.rtt)} · 새 서버로 봄 ${fast.fast} · 보내기 ${fast.hz}/초`)
check(fast.fast === true && fast.rtt !== null, '화면이 왕복 시간을 재고, 서버가 답하니 빠르게 보낸다 (헤드리스는 프레임이 느려 왕복 시간이 길게 나온다)')
check(fast.hz === 20, '보내는 빠르기 초당 20번')

const slow = await walk(5, 6, 96)
console.log(`  옛 화면처럼 초당 5번 보내는 상대: 간격 ${f(slow.gap)} · 늦게 그리기 ${f(slow.delay)} · 실제로 늦은 시간 ${slow.lag.toFixed(0)}ms`)
check(slow.delay > 0.19 && slow.delay <= 0.25, '초당 5번 보내는 상대는 예전처럼 0.2초 남짓 늦게 그린다')

const quick = await walk(20, 8, slow.end)
console.log(`  새 화면처럼 초당 20번 보내는 상대: 간격 ${f(quick.gap)} · 늦게 그리기 ${f(quick.delay)} · 실제로 늦은 시간 ${quick.lag.toFixed(0)}ms`)
check(quick.delay < 0.1, '초당 20번 보내는 상대는 0.1초 안으로 늦게 그린다')
check(quick.lag < 150, '상대 움직임이 화면에 보이기까지 150ms 안 (로컬 서버, 통신 시간은 거의 0)')

// 화면이 실제로 보내는 수: 걷는 것처럼 자리를 계속 옮기며 2초 동안 가짜 상대가 받은 state 를 센다
botIn.length = 0
await evaluate(`(async () => {
  const { useSessionStore } = await __mod('/src/game/stores/sessionStore.ts')
  let i = 0
  window.__walk = setInterval(() => useSessionStore.getState().requestTeleport([95.5 + (i++ % 20) * 0.05, -3]), 16)
  window.__frames = 0
  const tick = () => { window.__frames++; requestAnimationFrame(tick) }
  requestAnimationFrame(tick)
  return true
})()`)
await wait(1000)
botIn.length = 0
const f0 = await evaluate('window.__frames')
await wait(2000)
const fps = ((await evaluate('window.__frames')) - f0) / 2
const sent = botIn.filter((m) => m.type === 'state').length / 2
await evaluate('clearInterval(window.__walk), true')
console.log(`  화면이 움직이는 동안 보낸 모습: 초당 ${sent.toFixed(1)}번 (화면은 초당 ${fps.toFixed(1)}프레임)`)
check(sent >= 0.7 * Math.min(fps, 20) && sent <= 21, '화면이 움직이면 프레임마다, 많아야 초당 20번 보낸다')
const late = await read()
console.log(`  끝날 때 왕복 시간 ${f(late.rtt)}`)

check(consoleErrors.length === 0, `페이지 오류 없음 ${consoleErrors.slice(0, 3).join(' | ')}`)
bot.close()
ws.close()
proc.kill()
process.exit(failed ? 1 : 0)
