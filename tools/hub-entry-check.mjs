// 허브 로비 연결 확인 (game-entry-contract v3 자가 점검): 헤드리스 Chrome 으로 hub_return·hub_name·hub_room 을 붙여 연다.
// 준비: npm run server:dev (8787) 와 VITE_ROOM_SERVER=ws://127.0.0.1:8787 npx vite --port 5190 --strictPort
// 사용: node tools/hub-entry-check.mjs [게임 주소] [스크린샷 폴더]
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import WebSocket from 'ws'

const GAME = process.argv[2] ?? 'http://127.0.0.1:5190'
const OUT = process.argv[3] ?? join(tmpdir(), 'hub-entry-check')
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

const HELPERS = `
window.__click = (text) => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === text)
  if (!b) return false
  b.click()
  return true
};
window.__hasButton = (text) => [...document.querySelectorAll('button')].some((x) => x.textContent.trim() === text);
true`
const HUB_BUTTON = '👥 허브 방 친구들과 같이 하기'
const BACK_BUTTON = '🏠 허브 로비로'

/** 캐릭터를 만들어 둔 Chrome 하나를 열고 query 를 붙인 게임 주소로 간다 */
async function open(port, presetIndex, query) {
  const b = await browser(port)
  await b.send('Page.enable')
  await b.send('Runtime.enable')
  await b.send('Page.navigate', { url: GAME })
  await b.until(`document.readyState === 'complete'`)
  await b.evaluate(`(async () => {
    const { LOOK_PRESETS } = await import('/src/game/data/characterParts.ts')
    localStorage.setItem('fishing-island-save-v1', JSON.stringify({ state: { look: LOOK_PRESETS[${presetIndex}].look }, version: 2 }))
    return true
  })()`)
  b.goto = async (q) => {
    await b.send('Page.navigate', { url: `${GAME}/${q}` })
    await b.until(`document.readyState === 'complete'`)
    await b.evaluate(HELPERS)
    await b.until(`document.body.innerText.includes('혼자 하기')`, 90000)
    await b.until(`!document.body.innerText.includes('헤엄쳐 오는 중')`, 120000)
  }
  await b.goto(query)
  return b
}

const ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz'
const code = Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('')
// 돌아갈 주소: 게임 자기 주소에 표식을 붙인 것 (밖으로 나가지 않고 그대로 이동했는지 본다)
const BACK = `${GAME}/?came=back&x=%20y#frag`
const enc = encodeURIComponent

// 1) 허브에서 온 사람: 이름이 글자 그대로 채워지고, 허브 방·돌아가기 버튼이 있다
const A = await open(9721, 0, `?hub_return=${enc(BACK)}&hub_name=${enc('<b>철수</b>')}&hub_room=${code}`)
check(await A.evaluate(`document.querySelector('input[aria-label="닉네임"]').value === '<b>철수</b>'`), 'A: hub_name 이 닉네임 칸에 글자 그대로')
check(await A.evaluate(`!document.querySelector('b')`), 'A: 이름이 HTML 로 해석되지 않는다')
check(await A.evaluate(`__hasButton('${HUB_BUTTON}') && __hasButton('${BACK_BUTTON}')`), 'A: 허브 방 버튼과 돌아가기 버튼이 있다')
await A.shot('a-lobby')
// 이름이 10자를 넘으면 안 되니 짧은 이름으로 바꾸지 않아도 '<b>철수</b>' 는 10자 안
await A.evaluate(`__click('${HUB_BUTTON}')`)
check(await A.until(`document.body.innerText.includes('👥 1명')`, 20000), 'A: 허브 방 버튼 하나로 방을 만들고 들어갔다')

// 2) 같은 허브 방 코드로 온 B 는 같은 방으로
const B = await open(9722, 1, `?hub_return=${enc(BACK)}&hub_name=${enc('영희')}&hub_room=${code}`)
await B.evaluate(`__click('${HUB_BUTTON}')`)
check(await B.until(`document.body.innerText.includes('👥 2명')`, 20000), 'B: 같은 hub_room 이면 같은 방 (👥 2명)')
check(await A.until(`document.body.innerText.includes('영희님이 들어왔어요')`, 10000), 'A: "영희님이 들어왔어요"')
await B.shot('b-joined')

// 3) 메뉴의 돌아가기는 hub_return 으로 그대로 이동한다
await B.key('keydown', 'Escape', 'Escape')
await B.key('keyup', 'Escape', 'Escape')
check(await B.until(`__hasButton('${BACK_BUTTON}')`, 5000), 'B: ESC 메뉴에 허브 로비로 버튼')
await B.shot('b-menu')
await B.evaluate(`__click('${BACK_BUTTON}')`)
check(await B.until(`location.href === ${JSON.stringify(BACK)}`, 15000), `B: 복귀 주소로 고치지 않고 이동 (${BACK})`)
check(await A.until(`document.body.innerText.includes('영희님이 나갔어요')`, 15000), 'A: 돌아가면 방에서 나간다')

// 4) 허브 없이 열면 허브 버튼이 없다 (그 탭에서 이미 받은 hub_return 은 sessionStorage 에 남으므로 새 Chrome 으로)
const C = await open(9723, 2, '')
check(await C.evaluate(`!__hasButton('${HUB_BUTTON}') && !__hasButton('${BACK_BUTTON}')`), 'C: 허브 없이 열면 허브 버튼이 없다')
// 5) 이상한 방 코드는 무시, 자기 쿼리(?room=) 와 함께 와도 된다
await C.goto(`?room=study&hub_return=${enc(BACK)}&hub_room=..%2F..`)
check(await C.evaluate(`!__hasButton('${HUB_BUTTON}') && __hasButton('${BACK_BUTTON}')`), 'C: hub_room=../.. 은 무시, 돌아가기는 있다')
check(await C.evaluate(`document.querySelector('input[aria-label="방 이름"]').value === 'study'`), 'C: 게임 자기 쿼리(?room=)도 그대로 동작')
// 6) javascript: 복귀 주소는 무시
const D = await open(9724, 3, `?hub_return=${enc('javascript:alert(1)')}`)
check(await D.evaluate(`!__hasButton('${BACK_BUTTON}')`), 'D: javascript: 복귀 주소는 무시')

for (const b of [A, B, C, D]) b.close()
console.log(`스크린샷: ${OUT}`)
process.exit(failed ? 1 : 0)
