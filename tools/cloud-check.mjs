// 진행 서버 저장 확인: 헤드리스 Chrome 으로 복구 코드 생성·같은 프로필 두 번째 탭 막힘·올리기·코드로 되찾기·두 곳 충돌 안내와 백업·서버 주소 없을 때 꺼짐을 본다.
// 준비: npm run server:dev (8787), VITE_ROOM_SERVER=ws://127.0.0.1:8787 npx vite --host 127.0.0.1 --port 5190 --strictPort,
//       (6번) VITE_ROOM_SERVER 없이 npx vite --host 127.0.0.1 --port 5191 --strictPort
// 사용: node tools/cloud-check.mjs [게임 주소] [스크린샷 폴더] [서버 없는 게임 주소]
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import WebSocket from 'ws'

const GAME = process.argv[2] ?? 'http://127.0.0.1:5190'
const OUT = process.argv[3] ?? join(tmpdir(), 'cloud-check')
const GAME_OFF = process.argv[4] ?? 'http://127.0.0.1:5191'
const SAVE_URL = process.env.SAVE_URL ?? 'http://127.0.0.1:8787/save'
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
mkdirSync(OUT, { recursive: true })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
let failed = 0
const check = (ok, label) => {
  console.log(ok ? 'OK  ' : 'FAIL', label)
  if (!ok) failed++
}

/** CDP 로 탭 하나에 붙는다 */
async function attach(target) {
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
  await send('Page.enable')
  await send('Runtime.enable')
  const tab = { send, evaluate, until, shot, closeWs: () => ws.close() }
  tab.goto = async (url) => {
    await send('Page.navigate', { url })
    await until(`document.readyState === 'complete'`)
    await evaluate(HELPERS)
  }
  return tab
}

/** Chrome 하나를 띄우고 첫 탭에 CDP 로 붙는다 (프로필은 매번 새것 = 빈 저장소) */
async function browser(port) {
  const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'cc-'))}`, '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1000,700', '--no-first-run', 'about:blank'], { stdio: 'ignore' })
  let target
  for (let i = 0; i < 50 && !target; i++) {
    await wait(200)
    target = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json()).then((l) => l.find((t) => t.type === 'page')).catch(() => undefined)
  }
  const tab = await attach(target)
  const b = { ...tab, proc, close: () => { tab.closeWs(); proc.kill() } }
  /** 같은 프로필(같은 localStorage)에 탭을 하나 더 연다 */
  b.newTab = async (url) => {
    const t = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' }).then((r) => r.json())
    const other = await attach(t)
    return { ...other, close: async () => { other.closeWs(); await fetch(`http://127.0.0.1:${port}/json/close/${t.id}`).catch(() => {}) } }
  }
  return b
}

const HELPERS = `
window.__click = (text) => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === text)
  if (!b) return false
  b.click()
  return true
};
window.__hasButton = (text) => [...document.querySelectorAll('button')].some((x) => x.textContent.trim().includes(text));
true`
const RESTORE_BUTTON = '이미 하던 진행이 있어요'
const cloudKey = `JSON.parse(localStorage.getItem('seommaeul-cloud-v1') ?? 'null')`
const copy = `JSON.parse(localStorage.getItem('fishing-island-save-v1') ?? 'null')`
/** 게임 안 진행 상태에서 코인을 바꾼다 (저장·올리기가 평소처럼 돈다) */
const setCoins = (b, n) => b.evaluate(`import('/src/game/stores/progressStore.ts').then((m) => (m.useProgressStore.setState({ coins: ${n} }), true))`)
/** 꾸미기를 마친 진행처럼 생김새도 넣는다 (받은 진행에 생김새가 있어야 꾸미기가 닫힌다) */
const setLook = (b) => b.evaluate(`Promise.all([import('/src/game/stores/progressStore.ts'), import('/src/game/data/characterParts.ts')]).then(([m, c]) => (m.useProgressStore.getState().setLook(c.LOOK_PRESETS[0].look), true))`)
const serverGet = (code) => fetch(SAVE_URL, { headers: { Authorization: `Bearer ${code}`, Origin: new URL(GAME).origin } }).then((r) => (r.ok ? r.json() : null)).catch(() => null)

let A, B, C
try {
  // 1) 처음 열면 복구 코드가 생긴다
  A = await browser(9731)
  await A.goto(GAME)
  check(await A.until(`/^[2-9A-HJKMNP-TV-Z]{20}$/.test((${cloudKey})?.code ?? '')`, 60000), '처음 열면 복구 코드')
  const CODE = await A.evaluate(`(${cloudKey}).code`)
  await A.shot('1-first')

  // 1-2) 같은 프로필에 두 번째 탭을 열면 게임 대신 막힘 안내 (진행 사본을 나눠 쓰므로 탭은 하나만)
  const second = await A.newTab(GAME)
  check(await second.until(`document.body.innerText.includes('다른 탭에서 섬마을을 하고 있어요')`, 30000), '같은 프로필 두 번째 탭 → 막힘 안내')
  check(!(await second.evaluate(`!!document.querySelector('canvas')`)), '  (두 번째 탭엔 게임이 없다)')
  await second.shot('1-second-tab-blocked')
  await second.close()

  // 2) 코인을 바꾸면 서버에 올라간다
  await A.until(`document.body.innerText.length > 0`)
  await wait(5000) // 시작 올리기가 끝나기를 기다린다
  await setLook(A)
  await setCoins(A, 1234)
  let server = null
  for (let i = 0; i < 20 && server?.data?.state?.coins !== 1234; i++) {
    await wait(1000)
    server = await serverGet(CODE)
  }
  check(server?.data?.state?.coins === 1234, '진행이 서버에 올라간다')
  check((await A.evaluate(copy))?.state?.coins === 1234, '  (브라우저 사본도 1234)')
  await A.shot('2-uploaded')

  // 3) 새 브라우저에 코드로 이어 하기 버튼
  B = await browser(9732)
  await B.goto(GAME)
  check(await B.until(`__hasButton('${RESTORE_BUTTON}')`, 60000), '새 브라우저에 코드로 이어 하기 버튼')
  await B.shot('3-restore-button')

  // 4) 코드 입력 → 찾기 → 코인 1234 → 바꾸기
  await B.evaluate(`__click('🔑 이미 하던 진행이 있어요 (코드로 이어 하기)')`)
  await B.until(`!!document.querySelector('input[aria-label="복구 코드"]')`, 10000)
  await B.evaluate(`(() => {
    const i = document.querySelector('input[aria-label="복구 코드"]')
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    set.call(i, ${JSON.stringify(CODE)})
    i.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()`)
  await wait(300)
  await B.evaluate(`__click('찾기')`)
  check(await B.until(`document.body.innerText.includes('코인 1234')`, 15000), '  확인 창에 코인 1234')
  await B.shot('4-confirm')
  await B.evaluate(`__click('바꾸기')`)
  const gotCoins = await B.until(`(${copy})?.state?.coins === 1234`, 15000)
  const closed = await B.until(`!document.querySelector('.cc') && !__hasButton('${RESTORE_BUTTON}')`, 15000)
  check(gotCoins && closed, '코드로 진행을 되찾는다')
  check((await B.evaluate(cloudKey))?.code === CODE, '  (브라우저 코드도 같은 코드)')
  await B.shot('4-restored')

  // 5) 같은 코드의 두 곳: 한쪽이 먼저 올리면 늦게 올린 쪽이 최신을 받고 안내가 뜬다
  //    B 는 4번에서 이미 같은 코드로 맞춰져 있다. A 가 바꿔 올린 뒤, B 가 (모르고) 바꾼다.
  await setCoins(A, 2222)
  let s2 = null
  for (let i = 0; i < 20 && s2?.data?.state?.coins !== 2222; i++) {
    await wait(1000)
    s2 = await serverGet(CODE)
  }
  await setCoins(B, 3333)
  const notice = await B.until(`document.body.innerText.includes('다른 곳에서 한 진행으로 바꿨어요')`, 25000)
  await B.shot('5-conflict')
  check(notice && (await B.evaluate(copy))?.state?.coins === 2222, '두 곳 충돌 안내')
  const backup = await B.evaluate(`JSON.parse(localStorage.getItem('seommaeul-cloud-backup-v1') ?? 'null')`)
  check(JSON.parse(backup?.raw ?? 'null')?.state?.coins === 3333, '  (덮어쓰기 전 진행 3333 을 백업)')

  // 6) 서버 주소가 없으면 꺼진다
  C = await browser(9733)
  await C.goto(GAME_OFF)
  await C.until(`document.body.innerText.length > 0`, 60000)
  await wait(5000)
  check((await C.evaluate(`localStorage.getItem('seommaeul-cloud-v1')`)) === null && (await C.evaluate(`!document.body.innerText.includes('☁️')`)), '서버 주소가 없으면 꺼짐')
} catch (e) {
  console.log('FAIL', e.message)
  failed++
} finally {
  // 중간에 실패해도 헤드리스 Chrome 을 남기지 않는다
  for (const b of [A, B, C]) b?.close()
}
console.log(`스크린샷: ${OUT}`)
process.exit(failed ? 1 : 0)
