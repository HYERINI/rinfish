// 광산 금 간 벽 점검 (헤드리스 Chrome): 광맥을 캐면 벽에 금이 가고, 곡괭이로 치면 무너져 깊은 굴로 지나갈 수 있는지, 새로 고쳐도 열려 있는지.
// 준비: npx vite --port 5190 --strictPort --host 127.0.0.1
// 사용: node tools/mine-wall-check.mjs [게임 주소] [스크린샷 폴더]   (Chrome 자리는 CHROME 환경 변수)
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

const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'wall-'))}`, '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1000,700', '--no-first-run', 'about:blank'], { stdio: 'ignore' })
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




const OUT = process.argv[3]
const shot = async (name) => {
  if (!OUT) return
  const r = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(OUT, name), Buffer.from(r.result.data, 'base64'))
}
const setup = `(async () => {
  const { useSessionStore } = await __mod('/src/game/stores/sessionStore.ts')
  const { useProgressStore } = await __mod('/src/game/stores/progressStore.ts')
  const { playerRig } = await __mod('/src/game/scene/Player.tsx')
  const mine = await __mod('/src/game/data/mine.ts')
  const { mineRig } = await __mod('/src/game/mine/mineRig.ts')
  const actions = await __mod('/src/game/mine/mineActions.ts')
  const { addLookDrag } = await __mod('/src/game/input/pointer.ts')
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  window.__w = {
    mine, mineRig, actions,
    session: () => useSessionStore.getState(),
    progress: () => useProgressStore.getState(),
    pos: () => [playerRig.position.x, playerRig.position.y, playerRig.position.z].map((n) => Math.round(n * 100) / 100),
    go: async (x, z) => { useSessionStore.getState().requestTeleport([x, z, mine.MINE_ARRIVE_Y]); await sleep(1500) },
    // 동쪽(+x)을 보게 시점을 돌린다 (끌기 감도 0.005 rad/px)
    faceEast: async () => {
      for (let i = 0; i < 6; i++) {
        const d = ((playerRig.yaw + Math.PI / 2 + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI
        if (Math.abs(d) < 0.02) break
        addLookDrag(d / 0.005, 0)
        await sleep(400)
      }
      return playerRig.yaw
    },
    sleep,
  }
  return true
})()`
await evaluate(setup)
const W = (expr) => evaluate(`(async () => { const w = window.__w; return (${expr}) })()`)

const wall = await W('w.mine.MINE_WALLS[0]')
// 1) 처음: 벽은 멀쩡하다. 앞에 서도 E 대상이 아니고, 벽 자리로 들어갈 수 없다
await W(`(w.session().equip('pickaxe'), w.go(${wall.x - 1.6}, ${wall.z}))`)
await W('w.faceEast()')
await wait(800)
check((await W('w.actions.mineWallStage(0)')) === 'solid', '1) 처음엔 벽이 멀쩡하다')
check((await W('w.session().nearby?.kind ?? null')) !== 'mineWall', '2) 멀쩡한 벽 앞에서는 부수기 안내가 안 뜬다')
await shot('1-solid.png')
await W(`w.go(${wall.x + 3}, ${wall.z})`)
const pushed = await W('w.pos()')
// 벽이 막고 있어도 순간이동은 깊은 굴 안으로 들어간다 (충돌체는 벽 자리에만): 여기서는 벽 자리 한가운데를 본다
await W(`w.go(${wall.x}, ${wall.z})`)
const inWall = await W('w.pos()')
check(Math.abs(inWall[0] - wall.x) > 0.3, `3) 벽 자리에는 설 수 없다 (밀려난다: x ${inWall[0]})`)

// 2) 광맥을 캐서 금 가게 한다: 7번은 수만 올리고, 마지막 하나는 진짜로 캔다 (돌 광맥, 곡괭이질 2번)
await W('(() => { for (let i = 0; i < w.mine.MINE_WALLS[0].need - 1; i++) w.progress().countOreMined() })()')
const stone = await W('w.mine.ORE_NODES[0]')
await W(`w.go(${stone.x}, ${stone.z - 2.2})`)
for (let i = 0; i < 6 && (await W('w.mineRig.nodes[0].left')) > 0; i++) {
  await W('w.actions.requestPick(0)')
  await wait(1200)
}
check((await W('w.progress().oreMined')) === wall.need, `4) 광맥을 ${wall.need}번 캤다`)
check((await W('w.actions.mineWallStage(0)')) === 'cracked', '5) 벽에 금이 갔다')
check(String(await W('w.session().notice?.text ?? w.session().notice ?? ""')).includes('금이 갔어요'), '6) 금이 갔다고 알린다')

// 3) 금 간 벽 앞: 부수기 안내가 뜨고, E 로 hits 번 치면 무너진다
await W(`w.go(${wall.x - 1.6}, ${wall.z})`)
await W('w.faceEast()')
await wait(800)
const near = await W('w.session().nearby')
check(near?.kind === 'mineWall' && near.index === 0, `7) 금 간 벽 앞에서 부수기 안내가 뜬다 (${JSON.stringify(near)})`)
await shot('2-cracked.png')
await W('w.actions.requestPickWall(0)')
await wait(1200)
check((await W('w.mineRig.walls[0]')) === wall.hits - 1, '8) 한 번 치면 남은 수가 하나 준다')
check((await W('w.actions.mineWallStage(0)')) === 'cracked', '9) 다 치기 전에는 아직 막혀 있다')
for (let i = 0; i < wall.hits + 3 && (await W('w.actions.mineWallStage(0)')) !== 'open'; i++) {
  await W('w.actions.requestPickWall(0)')
  await wait(1200)
}
check((await W('w.actions.mineWallStage(0)')) === 'open', `10) ${wall.hits}번 치면 무너진다`)
check((await W('w.progress().mineWalls[0]')) === true, '11) 열린 벽을 저장한다')
await wait(800)
check((await W('w.session().nearby?.kind ?? null')) !== 'mineWall', '12) 무너진 뒤에는 부수기 안내가 사라진다')
await shot('3-open.png')

// 4) 통로: 벽 자리에 설 수 있고, 깊은 굴 바닥에 선다 (떨어지지 않는다)
await W(`w.go(${wall.x}, ${wall.z})`)
const inGap = await W('w.pos()')
check(Math.abs(inGap[0] - wall.x) < 0.2 && Math.abs(inGap[1] - (await W('w.mine.MINE.floorY')) - 1) < 0.6, `13) 무너진 자리에 설 수 있다 (${inGap})`)
await W(`w.go(${wall.x + 6}, ${wall.z})`)
await wait(1500)
const deep = await W('w.pos()')
check(Math.abs(deep[1] - (await W('w.mine.MINE.floorY')) - 1) < 0.6, `14) 깊은 굴 바닥에 선다 (${deep})`)
await W('w.faceEast()')
await wait(800)
await shot('4-deep.png')
// 깊은 굴 광맥도 캘 수 있다
const deepIndex = await W('w.mine.ORE_NODES.findIndex((n) => n.deep)')
const deepNode = await W(`w.mine.ORE_NODES[${deepIndex}]`)
await W(`w.go(${deepNode.x}, ${deepNode.z - 2.2})`)
await wait(600)
const nearOre = await W('w.session().nearby')
check(nearOre?.kind === 'ore' && nearOre.index === deepIndex, `15) 깊은 굴 광맥 앞에서 캐기 안내가 뜬다 (${JSON.stringify(nearOre)})`)
const before = await W(`w.mineRig.nodes[${deepIndex}].left`)
await W(`w.actions.requestPick(${deepIndex})`)
await wait(1200)
check((await W(`w.mineRig.nodes[${deepIndex}].left`)) === before - 1, '16) 깊은 굴 광맥이 캐진다')

// 5) 새로 고쳐도 열려 있다
await evaluate(`(async () => { const { flushProgressSave } = await __mod('/src/game/stores/progressStore.ts'); await flushProgressSave(); return true })()`)
await send('Page.navigate', { url: GAME })
await until(`document.readyState === 'complete'`)
await evaluate(`
window.__mod = async (path) => {
  const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes(path))
  return import(url ?? path)
};
true`)
await until(`document.body.innerText.includes('혼자 하기')`, 120000)
const saved = await evaluate(`(async () => { const s = (await __mod('/src/game/stores/progressStore.ts')).useProgressStore.getState(); return [s.oreMined, s.mineWalls[0]] })()`)
check(saved[0] >= wall.need && saved[1] === true, `17) 새로 고쳐도 캔 수와 열린 벽이 남아 있다 (${saved})`)

check(consoleErrors.length === 0, `페이지 오류 없음 ${consoleErrors.slice(0, 3).join(' | ')}`)
ws.close()
proc.kill()
process.exit(failed ? 1 : 0)
