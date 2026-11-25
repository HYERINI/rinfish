// 광산 점검 (헤드리스 Chrome): 입구에서 E 로 들어가기, 곡괭이로 광맥 캐기, E 로 나오기. 스크린샷을 남긴다
// 준비: npx vite --port 5190 --strictPort
// 사용: node tools/mine-check.mjs [게임 주소] [스크린샷 폴더]   (Chrome 자리는 CHROME 환경 변수)
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import WebSocket from 'ws'

const GAME = process.argv[2] ?? 'http://127.0.0.1:5190'
const OUT = process.argv[3] ?? join(tmpdir(), 'mine-check')
const CHROME = process.env.CHROME ?? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p))
mkdirSync(OUT, { recursive: true })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
let failed = 0
const check = (ok, label) => {
  console.log(ok ? 'OK  ' : 'FAIL', label)
  if (!ok) failed++
}
const consoleErrors = []
// 점검마다 다른 포트 (앞 점검의 브라우저가 덜 꺼졌어도 겹치지 않게)
const PORT = 9300 + Math.floor(Math.random() * 600)

const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'mine-'))}`, '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1000,700', '--no-first-run', 'about:blank'], { stdio: 'ignore' })
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
const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(r.result.data, 'base64'))
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

const pos = `(async () => { const { playerRig } = await __mod('/src/game/scene/Player.tsx'); return [playerRig.position.x, playerRig.position.y, playerRig.position.z] })()`
const teleport = (p) => `(async () => { const { useSessionStore } = await __mod('/src/game/stores/sessionStore.ts'); useSessionStore.getState().requestTeleport(${JSON.stringify(p)}); return true })()`
const nearby = `(async () => { const { useSessionStore } = await __mod('/src/game/stores/sessionStore.ts'); return JSON.stringify(useSessionStore.getState().nearby) })()`
const items = `(async () => { const { useProgressStore } = await __mod('/src/game/stores/progressStore.ts'); return useProgressStore.getState().items })()`
const mine = await evaluate(`(async () => { const m = await __mod('/src/game/data/mine.ts'); return { ENT: m.MINE_ENTRANCE, EXIT: m.MINE_EXIT, Y: m.MINE_ARRIVE_Y, NODES: m.ORE_NODES, ORES: m.ORES } })()`)

// 1) 입구 앞에 서면 E 안내가 뜬다
await evaluate(teleport(mine.ENT.out))
await wait(2500)
await shot('1-entrance')
await evaluate(teleport(mine.ENT.spot))
check(await until(`(async () => (await ${nearby}) === '{"kind":"mineEntrance"}')()`, 8000), '1) 입구의 빛나는 자리에서 E 대상 = 광산 입구')
check(await evaluate(`document.body.innerText.includes('광산 들어가기')`), '2) "광산 들어가기" 안내')

// 2) E → 광산 안
await key('KeyE')
check(await until(`(async () => (await ${pos})[1] < -20)()`, 8000), '3) E 를 누르면 광산 안(땅속)으로')
await wait(2500)
const inside = await evaluate(pos)
check(Math.abs(inside[0] - mine.EXIT.arrive[0]) < 1 && Math.abs(inside[2] - mine.EXIT.arrive[1]) < 1 && inside[1] > -30 && inside[1] < -28, `4) 들어온 자리에 서 있다 (${inside.map((v) => v.toFixed(1))})`)
await shot('2-inside')

// 3) 광맥 앞에서 E: 곡괭이를 들고 캔다 (돌은 두 번)
const stone = mine.NODES.findIndex((n) => n.ore === 'stone')
const n0 = mine.NODES[stone]
// 광맥의 서쪽에 선다: 카메라는 북쪽을 보므로 광맥 쪽(동)과 카메라 쪽(남)이 달라야 5b 가 돌아섬을 잡는다
await evaluate(teleport([n0.x - 2.2, n0.z, mine.Y]))
check(await until(`(async () => (await ${nearby}) === '{"kind":"ore","index":${stone}}')()`, 8000), '5) 광맥 앞에서 E 대상 = 그 광맥')
// 카메라를 가깝게 당긴다 (3m 안쪽이면 멈춰 있을 때 캐릭터가 카메라 쪽으로 돌아선다: 5b 가 그 조건에서 본다)
await evaluate(`(async () => { const { useSessionStore } = await __mod('/src/game/stores/sessionStore.ts'); useSessionStore.setState({ meadowZoom: 2 }); return true })()`)
await wait(800)
for (let i = 0; i < mine.ORES.stone.hits; i++) {
  await key('KeyE')
  await wait(1100)
  if (i === 0) {
    await shot('3-mining')
    // 한 번 치고 가만히 있어도 광맥을 본 채로 있다 (가까운 카메라의 "멈추면 카메라 쪽으로 돌아서기"에 끌려가지 않는다)
    const turned = await evaluate(`(async () => { const { playerRig } = await __mod('/src/game/scene/Player.tsx'); const want = Math.atan2(${n0.x} - playerRig.position.x, ${n0.z} - playerRig.position.z); return Math.abs(Math.atan2(Math.sin(playerRig.facing - want), Math.cos(playerRig.facing - want))) })()`)
    check(turned < 0.2, `5b) 치고 난 뒤에도 광맥을 본다 (어긋난 각도 ${turned.toFixed(2)} rad)`)
  }
}
const bag = await evaluate(items)
check(bag.stone === mine.ORES.stone.n, `6) 돌을 ${mine.ORES.stone.hits}번 치면 가방에 돌 ${mine.ORES.stone.n}개 (지금 ${bag.stone})`)
check(await evaluate(`(async () => { const { useSessionStore } = await __mod('/src/game/stores/sessionStore.ts'); return useSessionStore.getState().tool === 'pickaxe' })()`), '7) 저절로 곡괭이를 들었다')
check(await until(`(async () => (await ${nearby}) !== '{"kind":"ore","index":${stone}}')()`, 5000), '8) 다 캔 광맥은 E 대상에서 빠진다')
await shot('4-mined')

// 4) 모양 확인용: 광석마다 광맥 하나와 바위 기둥. 카메라가 보는 쪽(-sin yaw, -cos yaw) 앞에 대상이 오게, 대상에서 카메라 쪽으로 물러선 자리에 선다
const yaw = await evaluate(`(async () => { const { playerRig } = await __mod('/src/game/scene/Player.tsx'); return playerRig.yaw })()`)
const bounds = await evaluate(`(async () => { const m = await __mod('/src/game/data/mine.ts'); return { M: m.MINE, P: m.MINE_PILLARS } })()`)
const stand = (x, z, back) => [x + Math.sin(yaw) * back, z + Math.cos(yaw) * back]
const inMine = ([x, z]) => x > bounds.M.x0 + 0.8 && x < bounds.M.x1 - 0.8 && z > bounds.M.z0 + 0.8 && z < bounds.M.z1 - 0.8
const views = []
for (const ore of Object.keys(mine.ORES)) {
  const n = mine.NODES.filter((v) => v.ore === ore).find((v) => inMine(stand(v.x, v.z, 4)))
  if (n) views.push([`5-${ore}`, stand(n.x, n.z, 4)])
}
views.push(['5-pillar', stand(bounds.P[0][0], bounds.P[0][1], 4.5)])
// 1인칭(V)으로 찍는다: 3인칭은 대상이 내 몸 뒤에 가린다
await key('KeyV')
for (const [name, [x, z]] of views) {
  await evaluate(teleport([x, z, mine.Y]))
  await wait(2200)
  await shot(name)
}
await key('KeyV')
console.log('모양 스크린샷:', views.map((v) => v[0]).join(' '))

// 5) 나가는 자리에서 E → 지상 입구 앞
await evaluate(teleport([mine.EXIT.spot[0], mine.EXIT.spot[1], mine.Y]))
check(await until(`(async () => (await ${nearby}) === '{"kind":"mineExit"}')()`, 8000), '9) 나가는 자리에서 E 대상 = 나가기')
await key('KeyE')
check(await until(`(async () => (await ${pos})[1] > 0)()`, 8000), '10) E 를 누르면 지상으로')
await wait(2000)
const out = await evaluate(pos)
check(Math.abs(out[0] - mine.ENT.out[0]) < 1 && Math.abs(out[2] - mine.ENT.out[1]) < 1, `11) 입구 앞에 서 있다 (${out.map((v) => v.toFixed(1))})`)
await shot('6-out')

check(consoleErrors.length === 0, `12) 페이지 오류 없음${consoleErrors.length ? `: ${consoleErrors.slice(0, 3).join(' | ')}` : ''}`)
console.log(`스크린샷: ${OUT}`)
ws.close()
proc.kill()
process.exit(failed ? 1 : 0)
