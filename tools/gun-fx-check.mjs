// 총알 효과 그리기 측정 (헤드리스 Chrome): 자국·궤적·총구 불꽃을 화면 앞에 그려 놓고 드로우 콜 수(window.__render)를 잰다
// 준비: npx vite --port 5190 --strictPort --host 127.0.0.1   (개발 모드여야 RenderProbe 가 붙는다)
// 사용: node tools/gun-fx-check.mjs [게임 주소] [스크린샷 파일]   (Chrome 자리는 CHROME 환경 변수)
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

const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'gunfx-'))}`, '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1000,700', '--no-first-run', 'about:blank'], { stdio: 'ignore' })
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
// 초원 서쪽 물가 (광산 입구에서 남쪽으로 조금). 카메라는 북쪽(-z)을 본다
const SPOT = [95.5, -3]
await evaluate(teleport(SPOT))
await wait(3000)

// 화면 앞 2.5m 에 효과를 놓는 도우미 (자국은 지름 4.4cm 라 가까워야 보인다). 궤적·불꽃은 0.05초만 보여서, 재는 동안 10ms 마다 다시 그린다
await evaluate(`(async () => {
  const { gunFx } = await __mod('/src/game/guns/gunFx.ts')
  const { playerRig } = await __mod('/src/game/scene/Player.tsx')
  // 페이지 밖에서는 three 를 이름으로 못 불러와서, 있는 벡터를 복제해 만든다
  const vec = (x, y, z) => playerRig.position.clone().set(x, y, z)
  const at = (i) => vec(playerRig.position.x - 0.8 + (1.6 * (i % 12)) / 11, playerRig.position.y + 0.9 + Math.floor(i / 12) * 0.1, playerRig.position.z - 2.5)
  const normal = vec(0, 0, 1)
  window.__fx = {
    holes: (n) => { for (let i = 0; i < n; i++) gunFx.hole(at(i), normal) },
    live: null,
    tracers: (n, flashes) => {
      clearInterval(window.__fx.live)
      if (!n) return
      window.__fx.live = setInterval(() => {
        const from = vec(playerRig.position.x, playerRig.position.y + 1.2, playerRig.position.z - 1)
        for (let i = 0; i < n; i++) gunFx.tracer(from, at(i))
        for (let i = 0; i < flashes; i++) gunFx.flash(at(i * 3))
      }, 10)
    },
  }
  return true
})()`)
// 여러 프레임 가운데 가장 많이 나온 값 (그림자·시간대에 따라 조금 흔들린다)
const calls = async () => {
  let best = 0
  for (let i = 0; i < 12; i++) {
    await wait(150)
    best = Math.max(best, await evaluate('window.__render ? window.__render.calls : -1'))
  }
  return best
}
check((await evaluate('!!window.__render')), '측정 장치(RenderProbe)가 붙어 있다')
const base = await calls()
await evaluate('__fx.holes(120), true')
const holes = await calls()
await evaluate('__fx.tracers(16, 1), true')
const all = await calls()
if (process.argv[3]) {
  // 1인칭으로 찍는다 (3인칭은 내 몸이 효과를 가린다)
  await key('KeyV')
  await wait(1500)
  const r = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(process.argv[3], Buffer.from(r.result.data, 'base64'))
  await key('KeyV')
}
await evaluate('__fx.tracers(0), true')
const mem = await evaluate('JSON.stringify(window.__render)')
console.log(`기준 ${base} · 자국 120개 뒤 ${holes} (+${holes - base}) · 궤적 16개·불꽃까지 ${all} (+${all - base})`)
console.log('마지막 프레임:', mem)
check(consoleErrors.length === 0, `페이지 오류 없음${consoleErrors.length ? `: ${consoleErrors.slice(0, 3).join(' | ')}` : ''}`)
ws.close()
proc.kill()
process.exit(failed ? 1 : 0)
