// 같이 하기 끝까지 확인: 헤드리스 Chrome 두 개로 방 만들기·틀린 암호·들어가기·서로 보이기·채팅·채팅 중 이동 막기·나가기.
// 준비: npm run server:dev (8787) 와 VITE_ROOM_SERVER=ws://127.0.0.1:8787 npx vite --port 5190 --strictPort
// 사용: node tools/multiplayer-check.mjs [게임 주소] [스크린샷 폴더]
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import WebSocket from 'ws'

const GAME = process.argv[2] ?? 'http://127.0.0.1:5190'
const OUT = process.argv[3] ?? join(tmpdir(), 'multiplayer-check')
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
mkdirSync(OUT, { recursive: true })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
let failed = 0
const check = (ok, label) => {
  console.log(ok ? 'OK  ' : 'FAIL', label)
  if (!ok) failed++
}

/** Chrome 하나를 띄우고 첫 탭에 CDP 로 붙는다 */
async function browser(port) {
  const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'mp-'))}`, '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1000,700', '--no-first-run', 'about:blank'], { stdio: 'ignore' })
  let target
  for (let i = 0; i < 50 && !target; i++) {
    await wait(200)
    target = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json()).then((l) => l.find((t) => t.type === 'page')).catch(() => undefined)
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
  const key = (type, code, keyName = code) => evaluate(`window.dispatchEvent(new KeyboardEvent('${type}', { code: '${code}', key: '${keyName}', bubbles: true })), true`)
  return { proc, send, evaluate, until, shot, key, close: () => { ws.close(); proc.kill() } }
}

// 페이지 안 도우미: 개발 서버 모듈을 같은 인스턴스로 가져오기, React 입력 칸 채우기, 글씨로 버튼 누르기
const HELPERS = `
window.__mod = async (path) => {
  const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes(path))
  return import(url ?? path)
};
window.__fill = (label, value) => {
  const el = document.querySelector('input[aria-label="' + label + '"]')
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  setter.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  return true
};
window.__click = (text) => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === text)
  if (!b) return false
  b.click()
  return true
};
true`

async function open(port, presetIndex, name) {
  const b = await browser(port)
  await b.send('Page.enable')
  await b.send('Runtime.enable')
  await b.send('Page.navigate', { url: GAME })
  await b.until(`document.readyState === 'complete'`)
  // 캐릭터를 미리 만들어 둔다 (옷장 대신 바로 로비)
  await b.evaluate(`(async () => {
    const { LOOK_PRESETS } = await import('/src/game/data/characterParts.ts')
    localStorage.setItem('fishing-island-save-v1', JSON.stringify({ state: { look: LOOK_PRESETS[${presetIndex}].look }, version: 2 }))
    return true
  })()`)
  await b.send('Page.navigate', { url: `${GAME}/?room=check-${RUN}` })
  await b.until(`document.readyState === 'complete'`)
  await b.evaluate(HELPERS)
  const lobby = await b.until(`document.body.innerText.includes('혼자 하기')`, 90000)
  check(lobby, `${name}: 로비가 뜬다`)
  // 로딩 화면이 걷힐 때까지 (헤드리스는 느리다)
  await b.until(`!document.body.innerText.includes('헤엄쳐 오는 중')`, 120000)
  return b
}

const RUN = Date.now().toString(36)
const A = await open(9711, 0, 'A')
await A.shot('a-lobby')
check(await A.evaluate(`document.querySelector('input[aria-label="방 이름"]').value === 'check-${RUN}'`), 'A: 링크의 방 이름이 채워져 있다')
await A.evaluate(`__click('🔒 방 만들기')`)
await A.evaluate(`__fill('암호', 'secret1') && __fill('닉네임', '에이')`)
await A.evaluate(`__click('방 만들고 들어가기')`)
check(await A.until(`document.body.innerText.includes('👥 1명')`, 20000), 'A: 방을 만들고 들어갔다 (👥 1명)')

const B = await open(9712, 1, 'B')
await B.evaluate(`__fill('암호', 'nope1234') && __fill('닉네임', '비이')`)
await B.evaluate(`__click('들어가기')`)
check(await B.until(`document.body.innerText.includes('암호가 틀렸어요')`, 20000), 'B: 틀린 암호 → "암호가 틀렸어요"')
await B.shot('b-wrong-password')
await B.evaluate(`__fill('암호', 'secret1')`)
await B.evaluate(`__click('들어가기')`)
check(await B.until(`document.body.innerText.includes('👥 2명')`, 20000), 'B: 들어갔다 (👥 2명)')
check(await A.until(`document.body.innerText.includes('👥 2명')`, 10000), 'A: 👥 2명')
check(await A.until(`document.body.innerText.includes('비이님이 들어왔어요')`, 5000), 'A: "비이님이 들어왔어요" 알림')

// A 가 걸으면 B 화면의 A 위치가 바뀐다
const remoteX = `(async () => { const { remoteRig } = await __mod('/src/game/net/remoteRig.ts'); const e = [...remoteRig.values()][0]; return e ? e.buf.at(-1).s.p : null })()`
await wait(2500)
const before = await B.evaluate(remoteX)
check(Array.isArray(before), 'B: A 의 모습을 받고 있다')
await A.key('keydown', 'KeyW', 'w')
await wait(1200)
await A.key('keyup', 'KeyW', 'w')
await wait(1500)
const after = await B.evaluate(remoteX)
check(before && after && Math.hypot(after[0] - before[0], after[2] - before[2]) > 1, `B: A 가 걸어간 게 보인다 (${JSON.stringify(before)} → ${JSON.stringify(after)})`)
await B.shot('b-sees-a')

// 채팅
await A.key('keydown', 'Enter', 'Enter')
check(await A.until(`document.activeElement?.getAttribute('aria-label') === '채팅'`, 3000), 'A: Enter 로 채팅 칸이 열린다')
const myPos = `(async () => { const { playerRig } = await __mod('/src/game/scene/Player.tsx'); return [playerRig.position.x, playerRig.position.z] })()`
const p0 = await A.evaluate(myPos)
// 입력 칸에서 W 를 눌러도 움직이지 않는다
await A.evaluate(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w', bubbles: true })), true`)
await wait(800)
await A.evaluate(`document.activeElement.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', key: 'w', bubbles: true })), true`)
const p1 = await A.evaluate(myPos)
check(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) < 0.05, 'A: 채팅 입력 중엔 W 를 눌러도 움직이지 않는다')
await A.evaluate(`__fill('채팅', '안녕 낚시하자')`)
await A.evaluate(`document.querySelector('input[aria-label="채팅"]').form.requestSubmit(), true`)
check(await B.until(`document.body.innerText.includes('안녕 낚시하자')`, 5000), 'B: A 의 채팅이 보인다')
await wait(400)
await B.shot('b-chat')
await A.shot('a-chat')
check(await A.evaluate(`document.body.innerText.includes('메뉴 (ESC)')`), 'A: 채팅을 보낸 뒤에도 탐험 화면 그대로 (메뉴가 열리지 않았다)')

// B 가 나가면 A 에 알림
B.close()
check(await A.until(`document.body.innerText.includes('비이님이 나갔어요')`, 15000), 'A: B 가 나가면 "비이님이 나갔어요"')
check(await A.until(`document.body.innerText.includes('👥 1명')`, 5000), 'A: 다시 👥 1명')
await A.shot('a-wide')
// 폰 크기 화면: 방 배지가 작게 접혀 있다
await A.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
await wait(1500)
await A.shot('a-phone')
A.close()
console.log(`스크린샷: ${OUT}`)
process.exit(failed ? 1 : 0)
