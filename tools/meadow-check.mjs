// 초원 + 배 점검 (헤드리스 Chrome). 스크린샷을 남긴다
// 준비: npm run server:dev (8787) 와 VITE_ROOM_SERVER=ws://127.0.0.1:8787 npx vite --port 5190 --strictPort
// 사용: node tools/meadow-check.mjs [게임 주소] [스크린샷 폴더]
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import WebSocket from 'ws'

const GAME = process.argv[2] ?? 'http://127.0.0.1:5190'
const OUT = process.argv[3] ?? join(tmpdir(), 'meadow-check')
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
mkdirSync(OUT, { recursive: true })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
let failed = 0
const check = (ok, label) => {
  console.log(ok ? 'OK  ' : 'FAIL', label)
  if (!ok) failed++
}
/** 페이지 콘솔에 찍힌 오류·경고 */
const consoleErrors = []

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
    // 페이지 콘솔 오류 (셰이더 컴파일 오류 등)
    if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) {
      consoleErrors.push(`[${m.params.type}] ${m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 400)}`)
    }
    if (m.method === 'Runtime.exceptionThrown') consoleErrors.push(`[exception] ${(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text).slice(0, 400)}`)
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

async function open(port, presetIndex, query = '') {
  const b = await browser(port)
  await b.send('Page.enable')
  await b.send('Runtime.enable')
  await b.send('Page.navigate', { url: GAME })
  await b.until(`document.readyState === 'complete'`)
  await b.evaluate(`(async () => {
    const { LOOK_PRESETS } = await import('/src/game/data/characterParts.ts')
    localStorage.setItem('fishing-island-save-v1', JSON.stringify({ state: { look: LOOK_PRESETS[${presetIndex}].look }, version: 2 }))
    localStorage.removeItem('fishing-island-place-v1')
    return true
  })()`)
  await b.send('Page.navigate', { url: `${GAME}/${query}` })
  await b.until(`document.readyState === 'complete'`)
  await b.evaluate(HELPERS)
  await b.until(`document.body.innerText.includes('혼자 하기')`, 90000)
  await b.until(`!document.body.innerText.includes('헤엄쳐 오는 중')`, 180000)
  return b
}
const pos = `(async () => { const { playerRig } = await __mod('/src/game/scene/Player.tsx'); return [playerRig.position.x, playerRig.position.y, playerRig.position.z] })()`
const teleport = (x, z) => `(async () => { const { useSessionStore } = await __mod('/src/game/stores/sessionStore.ts'); useSessionStore.getState().requestTeleport([${x}, ${z}]); return true })()`
const walk = async (b, code, ms) => { await b.key('keydown', code); await wait(ms); await b.key('keyup', code); await wait(400) }

// 점검은 키로 걷는다 (순간이동은 충돌을 무시해서 벽 점검에 못 쓴다). 카메라 각도로 원하는 방향에 가장 가까운 키를 고른다
const camYaw = `(async () => { const { playerRig } = await __mod('/src/game/scene/Player.tsx'); return playerRig.yaw })()`
async function keyToward(b, dx, dz) {
  const yaw = await b.evaluate(camYaw)
  const dirs = { KeyW: [-Math.sin(yaw), -Math.cos(yaw)], KeyS: [Math.sin(yaw), Math.cos(yaw)], KeyD: [Math.cos(yaw), -Math.sin(yaw)], KeyA: [-Math.cos(yaw), Math.sin(yaw)] }
  return Object.entries(dirs).sort((a, b2) => (b2[1][0] * dx + b2[1][1] * dz) - (a[1][0] * dx + a[1][1] * dz))[0][0]
}

/** 캔버스를 끈 것처럼 카메라를 돌린다 (yaw 를 target 으로, 위아래는 py 만큼 끈다. 음수면 고개를 든다) */
async function turnTo(b, target, py = 0) {
  const yaw = await b.evaluate(camYaw)
  let d = yaw - target
  d = Math.atan2(Math.sin(d), Math.cos(d))
  return b.evaluate(`(async () => {
    const { pressPointer } = await __mod('/src/game/input/pointer.ts')
    pressPointer({ button: 0, pointerId: 77, clientX: 500, clientY: 350 })
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 77, clientX: 500 + ${d / 0.005}, clientY: 350 + ${py} }))
    await new Promise((r) => setTimeout(r, 300))
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 77 }))
    return true
  })()`)
}

const A = await open(9731, 0)
await A.evaluate(`__click('혼자 하기')`)
await wait(3000)
const p0 = await A.evaluate(pos)
check(Math.hypot(p0[0] - 188, p0[2] + 12) < 2, `1) 새 저장본은 초원 마당에서 시작 (${p0.map((v) => v.toFixed(1))})`)
await A.shot('1-start')

// 2) 침실 서쪽 벽은 은지 x -5 → 세계 x 205. 그 바깥 세계 (207, -2) = 은지 (-7, 2) 는 집 밖 마당이다. 세계 서쪽(-x)으로 걸으면 그 벽에 막힌다
await A.evaluate(teleport(207, -2))
await wait(1500)
await walk(A, await keyToward(A, -1, 0), 2500)
const p2 = await A.evaluate(pos)
check(p2[0] > 205, `2) 집 벽을 넘지 않는다 (x ${p2[0].toFixed(2)} > 205)`)
await A.shot('2-wall')

// 3) 초원 남쪽 끝(세계 z 89) 근처에서 남쪽(+z)으로 계속 걸어도 바다에 빠지지 않는다
await A.evaluate(teleport(150, 86))
await wait(1500)
await walk(A, await keyToward(A, 0, 1), 3000)
const p3 = await A.evaluate(pos)
check(p3[2] <= 89.01 && p3[1] > -0.5, `3) 초원 끝에서 멈춘다 (z ${p3[2].toFixed(2)}, y ${p3[1].toFixed(2)})`)
await A.shot('3-edge')

// 섬 색 비교용 (스펙 "낚시섬 색 맞추기")
await A.evaluate(teleport(0, 15))
await wait(2000)
await A.shot('0-island')

// 4) 초원 선착장에서 E → 배 → 15초 안에 섬 선착장
await A.evaluate(teleport(88.5, -2))
await wait(1500)
check(await A.until(`document.body.innerText.includes('배 타기 (섬으로)')`, 5000), '4) 선착장에서 "배 타기 (섬으로)" 안내')
await A.key('keydown', 'KeyE', 'e')
await A.key('keyup', 'KeyE', 'e')
await wait(5000)
const mid = await A.evaluate(pos)
check(Math.hypot(mid[0], mid[2]) > 31 && mid[0] < 90, `4) 가는 중엔 바다 위 (${mid.map((v) => v.toFixed(1))})`)
await A.shot('4-boat')
// 타는 중 새로고침해도 출발한 쪽에서 시작하도록 저장하지 않는다
const savedMid = await A.evaluate(`JSON.parse(localStorage.getItem('fishing-island-place-v1') || 'null')?.state?.place`)
check(!savedMid || savedMid.x > 84, `4) 타는 중 자리는 저장하지 않는다 (${JSON.stringify(savedMid && [savedMid.x, savedMid.z])})`)
const arrived = await A.until(`(async () => { const { playerRig } = await __mod('/src/game/scene/Player.tsx'); return Math.hypot(playerRig.position.x, playerRig.position.z) < 29 })()`, 15000)
const pa = await A.evaluate(pos)
check(arrived && pa[1] > -0.2, `4) 섬 선착장에 내렸다 (${pa.map((v) => v.toFixed(1))})`)
await A.shot('4-arrived')
// 11) 미니맵이 보이고, 섬에 오면 섬(모래색)을 그린다
check(await A.evaluate(`!!document.querySelector('canvas[aria-label^="미니맵"]')`), '11) 미니맵이 있다')
const sandAtCenter = await A.evaluate(`(() => {
  const c = document.querySelector('canvas[aria-label^="미니맵"]')
  const d = c.getContext('2d').getImageData(c.width / 2 + 12, c.height / 2 + 12, 1, 1).data
  return [d[0], d[1], d[2]]
})()`)
check(sandAtCenter[0] > 150 && sandAtCenter[2] < 200, `11) 섬에서 미니맵 가운데가 땅색 (${sandAtCenter})`)
await A.shot('11-minimap-island')
await A.evaluate(`document.querySelector('canvas[aria-label^="미니맵"]').click(), true`)
await wait(600)
check(await A.evaluate(`!!document.querySelector('canvas[aria-label^="큰 지도"]')`), '11) 미니맵을 누르면 큰 지도')
await A.shot('11-bigmap')
await A.evaluate(`document.querySelector('canvas[aria-label^="큰 지도"]').parentElement.click(), true`)
await wait(300)
check(await A.evaluate(`!document.querySelector('canvas[aria-label^="큰 지도"]')`), '11) 큰 지도를 누르면 닫힌다')
// 12) 큰 지도가 열린 동안엔 걷기·E 가 막히고, ESC 는 지도만 닫는다 (메뉴를 열지 않는다). 메뉴의 지도 버튼으로도 연다
const mode = `(async () => (await __mod('/src/game/stores/sessionStore.ts')).useSessionStore.getState().mode)()`
await A.evaluate(teleport(0, 23.5))
check(await A.until(`document.body.innerText.includes('배 타기 (초원으로)')`, 5000), '12) 섬 선착장 안내')
await A.evaluate(`document.querySelector('canvas[aria-label^="미니맵"]').click(), true`)
await wait(400)
check((await A.evaluate(mode)) === 'map', '12) 큰 지도를 열면 지도 모드')
const pm0 = await A.evaluate(pos)
await walk(A, 'KeyW', 1500)
const pm1 = await A.evaluate(pos)
check(Math.hypot(pm1[0] - pm0[0], pm1[2] - pm0[2]) < 0.05, `12) 지도 중엔 W 를 눌러도 안 움직인다 (${Math.hypot(pm1[0] - pm0[0], pm1[2] - pm0[2]).toFixed(3)}m)`)
await A.key('keydown', 'KeyE', 'e')
await A.key('keyup', 'KeyE', 'e')
await wait(400)
check(await A.evaluate(`(async () => (await __mod('/src/game/stores/sessionStore.ts')).useSessionStore.getState().boat === null)()`), '12) 지도 중엔 E 로 배를 타지 않는다')
await A.key('keydown', 'Escape')
await A.key('keyup', 'Escape')
await wait(400)
check((await A.evaluate(mode)) === 'explore' && (await A.evaluate(`!document.querySelector('canvas[aria-label^="큰 지도"]')`)), `12) ESC 는 지도만 닫고 메뉴를 열지 않는다 (${await A.evaluate(mode)})`)
check(await A.until(`document.body.innerText.includes('배 타기 (초원으로)')`, 3000), '12) 닫으면 선착장 안내가 그대로 있다')
await A.key('keydown', 'Escape')
await A.key('keyup', 'Escape')
await wait(400)
check((await A.evaluate(mode)) === 'menu', '12) 탐험 중 ESC 는 메뉴')
check(await A.evaluate(`__click('🗺️ 지도')`), '12) 메뉴에 지도 버튼')
await wait(400)
check((await A.evaluate(mode)) === 'map' && (await A.evaluate(`!!document.querySelector('canvas[aria-label^="큰 지도"]')`)) && !(await A.evaluate(`document.body.innerText.includes('계속하기')`)), '12) 메뉴의 지도 버튼은 메뉴를 닫고 큰 지도를 연다')
await A.shot('12-map-from-menu')
await A.evaluate(`document.querySelector('canvas[aria-label^="큰 지도"]').parentElement.click(), true`)
await wait(300)
check((await A.evaluate(mode)) === 'explore', '12) 큰 지도를 누르면 닫히고 탐험')

// 바다 가장자리: 섬 서쪽 물가에서 서쪽을, 초원 동쪽 끝에서 동쪽을 본다 (판 끝이 하늘에 선으로 보이면 안 된다)
await turnTo(A, Math.PI / 2, -80)
await A.evaluate(teleport(-27, 0))
await wait(2500)
await A.shot('13-ocean-island-west')
await A.evaluate(teleport(287, -10))
await wait(2500)
await turnTo(A, -Math.PI / 2)
await wait(800)
await A.shot('13-ocean-meadow-east')

// 폰 크기에서 미니맵이 위쪽 버튼·방 배지와 겹치지 않는지 보려고 한 장
await A.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
await wait(800)
await A.shot('11-minimap-phone')
await A.send('Emulation.clearDeviceMetricsOverride')
await wait(500)
// 키네마틱으로 감지 상자를 떠났다 돌아와도 안내가 다시 뜬다 (섬 쪽, 출발했던 초원 쪽 둘 다)
await A.evaluate(teleport(0, 23.5))
check(await A.until(`document.body.innerText.includes('배 타기 (초원으로)')`, 5000), '4) 섬 선착장에서 "배 타기 (초원으로)" 안내')
await A.evaluate(teleport(88.5, -2))
check(await A.until(`document.body.innerText.includes('배 타기 (섬으로)')`, 5000), '4) 출발했던 초원 선착장에서도 안내가 다시 뜬다')

// 5) 섬 물가에선 낚시 안내, 초원 안쪽에선 없다
await A.evaluate(teleport(0, 27))
await wait(1500)
check(await A.until(`document.body.innerText.includes('낚시하기')`, 5000), '5) 섬 선착장 끝에서 낚시 안내')
await A.evaluate(teleport(150, 0))
await wait(1500)
check(await A.evaluate(`!document.body.innerText.includes('낚시하기')`), '5) 초원에서는 낚시 안내 없음')

// 6) 선착장에 오자마자(1초 저장 전에) 타도 출발한 선착장을 저장한다
await A.evaluate(teleport(88.5, -2))
check(await A.until(`document.body.innerText.includes('배 타기 (섬으로)')`, 5000), '6) 다시 초원 선착장 안내')
await A.evaluate(`localStorage.removeItem('fishing-island-place-v1'), true`)
await A.key('keydown', 'KeyE', 'e')
await A.key('keyup', 'KeyE', 'e')
await wait(2500)
const savedBoard = await A.evaluate(`JSON.parse(localStorage.getItem('fishing-island-place-v1') || 'null')?.state?.place`)
check(!!savedBoard && savedBoard.x >= 84 && savedBoard.x <= 90 && savedBoard.z >= -3.5 && savedBoard.z <= -0.5, `6) 탈 때 출발 선착장을 저장한다 (${JSON.stringify(savedBoard && [savedBoard.x, savedBoard.z])})`)

// 7) 타는 중 쓰러지면 (PlayTimeTicker 와 같은 순서로) 배에서 내려 진료소에서 깨어난다
const session = `(await __mod('/src/game/stores/sessionStore.ts')).useSessionStore.getState()`
const clinic = await A.evaluate(`(async () => { const { CLINIC_SPAWN } = await __mod('/src/game/data/zones.ts'); const s = ${session}; s.setMode('explore'); s.requestTeleport(CLINIC_SPAWN); return CLINIC_SPAWN })()`)
await wait(4000)
const pf = await A.evaluate(pos)
const st7 = await A.evaluate(`(async () => { const s = ${session}; return [s.mode, s.boat] })()`)
check(Math.hypot(pf[0] - clinic[0], pf[2] - clinic[1]) < 2 && pf[1] > -0.2, `7) 쓰러지면 진료소에 있다 (${pf.map((v) => v.toFixed(1))}, 진료소 ${clinic})`)
check(st7[0] === 'explore' && st7[1] === null, `7) 배에서 내려 탐험 모드 (${JSON.stringify(st7)})`)
await A.shot('7-clinic')

// 8) 같이 하기: A 가 초원에서 걷고 배를 타는 게 B 에게 보인다
const RUN = Date.now().toString(36)
const A2 = await open(9733, 0, `?room=meadow-${RUN}`)
await A2.evaluate(`__click('🔒 방 만들기')`)
await A2.evaluate(`__fill('암호', 'secret1') && __fill('닉네임', '에이')`)
await A2.evaluate(`__click('방 만들고 들어가기')`)
check(await A2.until(`document.body.innerText.includes('👥 1명')`, 20000), '8) A 방 만들기')
const B2 = await open(9734, 1, `?room=meadow-${RUN}`)
await B2.evaluate(`__fill('암호', 'secret1') && __fill('닉네임', '비이')`)
await B2.evaluate(`__click('들어가기')`)
check(await B2.until(`document.body.innerText.includes('👥 2명')`, 20000), '8) B 들어가기')
const remote = `(async () => { const { remoteRig } = await __mod('/src/game/net/remoteRig.ts'); const e = [...remoteRig.values()][0]; return e ? e.buf.at(-1).s : null })()`
await wait(2500)
const r0 = await B2.evaluate(remote)
check(r0 && r0.p[0] > 90, `8) B 가 초원에 있는 A 를 받는다 (${r0 && r0.p.map((v) => v.toFixed(1))})`)
// (카메라는 처음 -z 쪽을 본다: 선착장 끝에 서서 멀리 물러나 보면 막 출발한 배가 왼쪽 아래에 보인다. 배는 곧 시야를 벗어나니 정보를 받자마자 찍는다)
await B2.evaluate(teleport(88, -1))
await B2.evaluate(`(async () => { (await __mod('/src/game/stores/sessionStore.ts')).useSessionStore.getState().zoomBy(3000); return true })()`)
await A2.evaluate(teleport(88.5, -2))
await wait(1500)
await A2.key('keydown', 'KeyE', 'e')
await A2.key('keyup', 'KeyE', 'e')
check(await B2.until(`${remote}.then((s) => !!s && !!s.boat)`, 8000), '8) A 가 배를 타면 B 가 배 정보를 받는다')
await wait(200)
await B2.shot('8-b-sees-boat')
A2.close()
B2.close()

// 9) E 를 누르고 첫 프레임 전에 탭을 닫아도(같은 틱의 pagehide) 출발 선착장이 저장된다
await A.evaluate(teleport(88.5, -2))
check(await A.until(`document.body.innerText.includes('배 타기 (섬으로)')`, 5000), '9) 다시 초원 선착장 안내')
const savedHide = await A.evaluate(`(() => {
  localStorage.removeItem('fishing-island-place-v1')
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e', bubbles: true }))
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE', key: 'e', bubbles: true }))
  window.dispatchEvent(new Event('pagehide'))
  return JSON.parse(localStorage.getItem('fishing-island-place-v1') || 'null')?.state?.place
})()`)
check(!!savedHide && savedHide.x >= 84 && savedHide.x <= 90 && savedHide.z >= -3.5 && savedHide.z <= -0.5, `9) 타자마자 닫아도 출발 선착장 (${JSON.stringify(savedHide && [savedHide.x, savedHide.z])})`)

// 10) 타는 중 쓰러진 바로 그 순간 탭을 닫아도 바다 자리를 저장하지 않고, 결국 진료소가 남는다
await wait(3000)
const savedFaint = await A.evaluate(`(async () => {
  const { CLINIC_SPAWN } = await __mod('/src/game/data/zones.ts')
  const s = ${session}
  localStorage.removeItem('fishing-island-place-v1')
  s.setMode('explore')
  s.requestTeleport(CLINIC_SPAWN)
  window.dispatchEvent(new Event('pagehide'))
  return JSON.parse(localStorage.getItem('fishing-island-place-v1') || 'null')?.state?.place ?? null
})()`)
const onLand = (p) => `(async () => { const { landAt } = await __mod('/src/game/logic/land.ts'); return landAt(${p.x}, ${p.z}) !== null })()`
check(!savedFaint || (await A.evaluate(onLand(savedFaint))), `10) 쓰러진 순간 바다 자리를 저장하지 않는다 (${JSON.stringify(savedFaint && [savedFaint.x, savedFaint.z])})`)
await wait(3000)
const savedAfter = await A.evaluate(`JSON.parse(localStorage.getItem('fishing-island-place-v1') || 'null')?.state?.place ?? null`)
check(!!savedAfter && Math.hypot(savedAfter.x - clinic[0], savedAfter.z - clinic[1]) < 2, `10) 그 뒤 진료소 자리가 저장된다 (${JSON.stringify(savedAfter && [savedAfter.x, savedAfter.z])})`)

// --- 3-1 시간과 생존 ---
const dayStore = `(await __mod('/src/game/stores/dayStore.ts')).useDayStore.getState()`
const progress = `(await __mod('/src/game/stores/progressStore.ts')).useProgressStore`
const live = `(await __mod('/src/game/stores/dayStore.ts')).liveClock`
const BED = [197.8, -2.4]
const nearBed = (p) => Math.hypot(p[0] - BED[0], p[2] - BED[1]) < 1.5

// 14) 밤이 온다: 혼자 시계를 22:00 으로 옮기면 HUD 가 🌙, 하늘이 어둡고 광장 가로등·섬 등불이 켜진다
// 광장 분수 앞 (카메라가 분수·가로등 쪽을 본다)
await A.evaluate(teleport(150, 0))
await wait(1500)
await A.evaluate(`(async () => { ${dayStore}.setSoloClock({ t: 16 / 24, day: 1 }); return true })()`)
await wait(800)
check(await A.until(`document.body.innerText.includes('🌙 1일차 22:')`, 3000), '14) HUD 시계가 🌙 1일차 22:xx')
const night = await A.evaluate(`(async () => {
  const { skyNow } = await __mod('/src/game/scene/skyNow.ts')
  const m = await __mod('/src/meadow/meadowSingleton.ts')
  return { sky: skyNow.background.r, lamp: m.meadowWorld().lights.lamps[0].intensity, lantern: m.islandLanterns()[0].intensity }
})()`)
check(night.sky < 0.05 && night.lamp > 5 && night.lantern > 5, `14) 밤 하늘이 어둡고 가로등·섬 등불이 켜진다 (${JSON.stringify(night)})`)
await A.shot('14-night-town')
await A.evaluate(teleport(0, 18))
await wait(2000)
await A.shot('14-night-island')
await A.evaluate(`(async () => { ${dayStore}.setSoloClock({ t: 0.25, day: 1 }); return true })()`)
await wait(800)
check(await A.until(`document.body.innerText.includes('☀️ 1일차 12:')`, 3000), '14) 낮으로 돌리면 ☀️')

// 15) 혼자 잠: 침대 옆에서 E → 화면이 어두워졌다가 다음 날 06:00, 체력 100, 배고픔 −15
await A.evaluate(teleport(BED[0], BED[1]))
check(await A.until(`document.body.innerText.includes('잠자기')`, 5000), '15) 침대 옆에서 "잠자기" 안내')
await A.evaluate(`(async () => { ${progress}.setState({ survival: { stamina: 40, hunger: 50, graceLeft: null, buffs: [] } }); return true })()`)
await A.key('keydown', 'KeyE', 'e')
await A.key('keyup', 'KeyE', 'e')
await wait(500)
await A.shot('15-sleep-fade')
await wait(2500)
const slept = await A.evaluate(`(async () => { const p = ${progress}.getState(); return [p.survival.stamina, p.survival.hunger, p.clock.day, (${dayStore}).clockText] })()`)
check(slept[0] > 99 && slept[1] > 33 && slept[1] < 36 && slept[2] === 2 && slept[3].includes('2일차 06:'), `15) 다음 날 아침, 체력 100·배고픔 35 (${JSON.stringify(slept)})`)
check((await A.evaluate(mode)) === 'explore', '15) 깨면 탐험 모드')

// 16) 굶어 죽음: 배고픔 0 이면 경고, 체력이 다 떨어지면 침대 옆에서 깨어난다 (다음 날, 체력 100·배고픔 60). 그 자리를 저장한다
await A.evaluate(teleport(150, 0))
await wait(1500)
await A.evaluate(`(async () => { ${progress}.setState({ survival: { stamina: 3, hunger: 0, graceLeft: null, buffs: [] } }); return true })()`)
check(await A.until(`document.body.innerText.includes('배고파요! 뭐라도 먹어야 해요')`, 1500), '16) 배고픔 0 이면 "배고파요" 경고')
await A.shot('16-starving')
await wait(7000)
const woke = await A.evaluate(`(async () => { const p = ${progress}.getState(); const { playerRig } = await __mod('/src/game/scene/Player.tsx'); return { pos: [playerRig.position.x, playerRig.position.y, playerRig.position.z], s: p.survival, day: p.clock.day } })()`)
check(nearBed(woke.pos) && woke.s.stamina > 99 && woke.s.hunger > 58 && woke.day === 3, `16) 침대 옆에서 깨어남 (${JSON.stringify(woke)})`)
await wait(1500)
const savedBed = await A.evaluate(`JSON.parse(localStorage.getItem('fishing-island-place-v1') || 'null')?.state?.place ?? null`)
check(!!savedBed && Math.hypot(savedBed.x - BED[0], savedBed.z - BED[1]) < 2, `16) 깨어난 침대 옆을 저장한다 (${JSON.stringify(savedBed && [savedBed.x, savedBed.z])})`)
await A.shot('16-woke-bed')
// 배 타는 중 굶어 죽어도 배에서 내려 침대로
await A.evaluate(teleport(88.5, -2))
check(await A.until(`document.body.innerText.includes('배 타기 (섬으로)')`, 5000), '16) 선착장 안내')
await A.key('keydown', 'KeyE', 'e')
await A.key('keyup', 'KeyE', 'e')
await wait(1500)
await A.evaluate(`(async () => { ${progress}.setState({ survival: { stamina: 1, hunger: 0, graceLeft: null, buffs: [] } }); return true })()`)
await wait(7000)
const wokeBoat = await A.evaluate(`(async () => { const s = ${session}; const { playerRig } = await __mod('/src/game/scene/Player.tsx'); return { pos: [playerRig.position.x, playerRig.position.y, playerRig.position.z], boat: s.boat, mode: s.mode } })()`)
check(nearBed(wokeBoat.pos) && wokeBoat.boat === null && wokeBoat.mode === 'explore', `16) 배 타다 죽어도 침대 옆, 배에서 내림 (${JSON.stringify(wokeBoat)})`)

// 17) 같이 하기: 두 사람 시계가 같고, 한 사람이 자면(2명 중 1명 = 절반) 둘 다 아침. 같이 할 땐 죽어도 시간 그대로
const A3 = await open(9735, 0, `?room=night-${RUN}`)
await A3.evaluate(`__click('🔒 방 만들기')`)
await A3.evaluate(`__fill('암호', 'secret1') && __fill('닉네임', '에이')`)
await A3.evaluate(`__click('방 만들고 들어가기')`)
check(await A3.until(`document.body.innerText.includes('👥 1명')`, 20000), '17) A 방 만들기')
const B3 = await open(9736, 1, `?room=night-${RUN}`)
await B3.evaluate(`__fill('암호', 'secret1') && __fill('닉네임', '비이')`)
await B3.evaluate(`__click('들어가기')`)
check(await B3.until(`document.body.innerText.includes('👥 2명')`, 20000), '17) B 들어가기')
await wait(1500)
const clocks = [await A3.evaluate(`(async () => ({ ...${live} }))()`), await B3.evaluate(`(async () => ({ ...${live} }))()`)]
check(clocks[0].day === clocks[1].day && Math.abs(clocks[0].t - clocks[1].t) < 0.01, `17) 두 사람 시계가 같다 (${JSON.stringify(clocks)})`)
await A3.evaluate(teleport(BED[0], BED[1]))
check(await A3.until(`document.body.innerText.includes('잠자기')`, 5000), '17) A 침대 안내')
await A3.key('keydown', 'KeyE', 'e')
await A3.key('keyup', 'KeyE', 'e')
check(await B3.until(`document.body.innerText.includes('일차 아침이 됐어요')`, 5000), '17) A 가 자면 B 에게도 아침')
const mornings = [await A3.evaluate(`(async () => ({ ...${live} }))()`), await B3.evaluate(`(async () => ({ ...${live} }))()`)]
check(mornings.every((c) => c.day === clocks[0].day + 1 && c.t < 0.02), `17) 둘 다 다음 날 06:00 (${JSON.stringify(mornings)})`)
await wait(1500)
check((await A3.evaluate(mode)) === 'explore', '17) 잔 사람도 탐험으로 돌아온다')
const roomDay = mornings[0].day
const soloDay = await A3.evaluate(`(async () => ${progress}.getState().clock.day)()`)
await A3.evaluate(`(async () => { ${progress}.setState({ survival: { stamina: 1, hunger: 0, graceLeft: null, buffs: [] } }); return true })()`)
await wait(7000)
const roomDeath = await A3.evaluate(`(async () => ({ day: ${live}.day, solo: ${progress}.getState().clock.day }))()`)
check(roomDeath.day === roomDay && roomDeath.solo === soloDay, `17) 같이 할 땐 죽어도 날짜 그대로, 혼자 시계도 그대로 (${JSON.stringify(roomDeath)})`)
await A3.shot('17-room-woke')
A3.close()
B3.close()
check(!consoleErrors.some((e) => /shader|WebGLProgram/i.test(e)), '셰이더 컴파일 오류가 없다')
if (consoleErrors.length) console.log(`콘솔 오류·경고 ${consoleErrors.length}개:\n${consoleErrors.slice(0, 20).join('\n')}`)

A.close()
console.log(`스크린샷: ${OUT}`)
process.exit(failed ? 1 : 0)
