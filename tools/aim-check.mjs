// 조준점 점검 (헤드리스 Chrome): 조준하기 전·조준한 채·조준을 푼 뒤 화면 가운데가 같은 곳을 가리키는지 본다 (권총·소총·저격총)
// 준비: npx vite --port 5190 --strictPort --host 127.0.0.1
// 사용: node tools/aim-check.mjs [게임 주소]   (Chrome 자리는 CHROME 환경 변수)
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

const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'aim-'))}`, '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1000,700', '--no-first-run', 'about:blank'], { stdio: 'ignore' })
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



const teleport = (p) => `(async () => { const { useSessionStore } = await __mod('/src/game/stores/sessionStore.ts'); useSessionStore.getState().requestTeleport(${JSON.stringify(p)}); return true })()`
// 초원 서쪽 물가. 카메라는 북쪽(-z)을 보고, 기본 기울기에선 몇 m 앞 땅을 겨눈다
await evaluate(teleport([95.5, -3]))
await wait(3000)

// 한 발 쏘고 그 광선(카메라 자리·방향)을 읽는다. 반동을 0 으로 둬서 쏜 뒤에도 시점이 그대로다
await evaluate(`(async () => {
  const { GUNS } = await __mod('/src/game/data/guns.ts')
  for (const g of Object.values(GUNS)) g.recoil = 0
  const { gunRig } = await __mod('/src/game/guns/gunRig.ts')
  const { pressAttack, setTouchAim } = await __mod('/src/game/input/pointer.ts')
  const { useSessionStore } = await __mod('/src/game/stores/sessionStore.ts')
  const { playerRig, FOOT_Y } = await __mod('/src/game/scene/Player.tsx')
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  window.__aim = {
    equip: (tool) => useSessionStore.getState().equip(tool),
    aim: (on) => setTouchAim(on),
    first: () => playerRig.firstPerson,
    feetY: () => playerRig.position.y + FOOT_Y,
    shot: async () => {
      gunRig.lastShot = null
      for (let i = 0; i < 40 && !gunRig.lastShot; i++) {
        pressAttack('primary')
        await sleep(150)
      }
      return gunRig.lastShot && { o: gunRig.lastShot.o, d: gunRig.lastShot.d, hit: gunRig.lastShot.hit }
    },
  }
  return true
})()`)

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z
const at = (r, t) => ({ x: r.o.x + r.d.x * t, y: r.o.y + r.d.y * t, z: r.o.z + r.d.z * t })
const len = (v) => Math.hypot(v.x, v.y, v.z)
/** 두 광선이 가장 가까워지는 곳: 벌어진 거리(m)와 그 점 (광선 a 위), a·b 에서 간 거리 */
function meet(a, b) {
  const w = sub(a.o, b.o)
  const bd = dot(a.d, b.d)
  const den = 1 - bd * bd
  if (den < 1e-9) return { gap: len(sub(w, { x: b.d.x * dot(w, b.d), y: b.d.y * dot(w, b.d), z: b.d.z * dot(w, b.d) })), ta: Infinity, tb: Infinity, p: null }
  const ta = (bd * dot(b.d, w) - dot(a.d, w)) / den
  const tb = (dot(b.d, w) - bd * dot(a.d, w)) / den
  const p = at(a, ta)
  return { gap: len(sub(p, at(b, tb))), ta, tb, p }
}
const deg = (a, b) => (Math.acos(Math.min(1, dot(a.d, b.d))) * 180) / Math.PI
const f = (n) => (Number.isFinite(n) ? n.toFixed(2) : String(n))

for (const [gun, name, scope] of [['pistol', '권총', false], ['sniper', '저격총', true], ['rifle', '소총', true]]) {
  await evaluate(`__aim.equip('${gun}'), __aim.aim(false), true`)
  await wait(1500)
  const feet = await evaluate('__aim.feetY()')
  const hip = await evaluate('__aim.shot()')
  await evaluate('__aim.aim(true), true')
  await wait(2500)
  const firstPerson = await evaluate('__aim.first()')
  const aimed = await evaluate('__aim.shot()')
  await evaluate('__aim.aim(false), true')
  await wait(2500)
  const back = await evaluate('__aim.shot()')
  if (!hip || !aimed || !back) {
    check(false, `${name}: 쏘지 못했다 (${!!hip} ${!!aimed} ${!!back})`)
    continue
  }
  check(firstPerson === scope, `${name}: 조준하면 ${scope ? '1인칭 조준경' : '3인칭 그대로'}`)
  // 조준 전 광선과 조준 중 광선이 한 점에서 만나고, 그 점이 겨누던 땅이다 (발 높이 근처, 몇 m 앞)
  const m = meet(hip, aimed)
  console.log(`  ${name} 조준 전→조준: 벌어짐 ${f(m.gap)}m · 만나는 곳 ${f(m.ta)}m 앞 · 높이 ${m.p ? f(m.p.y - feet) : '-'}m (발 기준) · 방향 차이 ${f(deg(hip, aimed))}°`)
  check(m.gap < 0.08 && m.ta > 1.5 && m.tb > 0.5 && m.p && Math.abs(m.p.y - feet) < 0.5, `${name}: 조준해도 조준 전에 겨눈 곳(땅)을 본다`)
  // 조준을 풀면 처음 시점으로
  const o = len(sub(hip.o, back.o))
  console.log(`  ${name} 조준을 푼 뒤: 카메라 ${f(o)}m 옮겨짐 · 방향 차이 ${f(deg(hip, back))}°`)
  check(o < 0.08 && deg(hip, back) < 0.5, `${name}: 조준을 풀면 처음 보던 곳으로 돌아온다`)
}
check(consoleErrors.length === 0, `페이지 오류 없음 ${consoleErrors.slice(0, 3).join(' | ')}`)
ws.close()
proc.kill()
process.exit(failed ? 1 : 0)
