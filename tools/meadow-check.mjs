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
  // 진짜 키보드 이벤트처럼 막을 수 있게(cancelable) 보낸다 (T 바퀴가 쓴 숫자를 preventDefault 로 막는다)
  const key = (type, code, keyName = code) => evaluate(`window.dispatchEvent(new KeyboardEvent('${type}', { code: '${code}', key: '${keyName}', bubbles: true, cancelable: true })), true`)
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
// ── 3-2 도구 칸·가방·요리·상인 (18~27) ──
const M = await open(9739, 0)
await M.evaluate(`__click('혼자 하기')`)
await wait(3000)
const S = `(await __mod('/src/game/stores/sessionStore.ts')).useSessionStore.getState()`
const P = `(await __mod('/src/game/stores/progressStore.ts')).useProgressStore.getState()`
const W = `(await __mod('/src/meadow/meadowSingleton.ts')).meadowWorld()`
const sess = (expr) => M.evaluate(`(async () => { const s = ${S}; return ${expr} })()`)
const prog = (expr) => M.evaluate(`(async () => { const p = ${P}; return ${expr} })()`)
const press = async (code, k = code) => { await M.key('keydown', code, k); await M.key('keyup', code, k); await wait(300) }
// 처음 떨어지는 중엔 감정 표현을 받지 않으니 땅에 설 때까지 기다린다
await wait(2000)

// 18) T 를 누르고 있으면 감정 표현 바퀴, 숫자로 고르면 바로 한다
await M.key('keydown', 'KeyT', 't')
await wait(300)
check((await sess('s.mode')) === 'emote' && (await M.evaluate(`!!document.querySelector('[aria-label="감정 표현 바퀴"]')`)), '18) T 를 누르고 있으면 감정 표현 바퀴')
await M.shot('18-wheel')
await M.key('keydown', 'Digit1', '1')
await M.key('keyup', 'Digit1', '1')
check(await M.until(`(async () => { const s = ${S}; return s.mode === 'explore' && s.playerAction.emote === 'dance' })()`, 3000), `18) 바퀴에서 1 → 춤 (${await sess('[s.mode, s.playerAction.emote].join()')})`)
await M.key('keyup', 'KeyT', 't')
// 바퀴에서 고른 숫자는 도구 칸으로 이어지지 않는다 (2 = 수다, 도구는 그대로)
const tool18 = await sess('s.tool')
await M.key('keydown', 'KeyT', 't')
await wait(200)
await M.key('keydown', 'Digit2', '2')
await M.key('keyup', 'Digit2', '2')
await M.key('keyup', 'KeyT', 't')
check(await M.until(`(async () => { const s = ${S}; return s.mode === 'explore' && s.playerAction.emote === 'chat' })()`, 3000) && (await sess('s.tool')) === tool18, `18) 바퀴에서 2 → 수다, 도구는 그대로 (${await sess('[s.playerAction.emote, s.tool].join()')})`)
await walk(M, 'KeyW', 300)
// 마우스 방향으로 고르고 떼면 한다 (잠금 없이: 화면 가운데에서 커서 쪽)
await M.key('keydown', 'KeyT', 't')
await M.evaluate(`window.dispatchEvent(new PointerEvent('pointermove', { clientX: innerWidth / 2 + 110, clientY: innerHeight / 2 - 35 })), true`)
await wait(200)
await M.shot('18-wheel-aim')
await M.key('keyup', 'KeyT', 't')
check(await M.until(`(async () => ${S}.playerAction.emote === 'chat')()`, 3000), `18) 오른쪽 위를 가리키고 떼면 수다 (${await sess('s.playerAction.emote')})`)
await press('Digit2', '2')
check((await sess('[s.playerAction.emote, s.tool].join()')) === 'chat,fists', `18) 탐험 중 숫자 키는 도구 칸이지 감정 표현이 아니다 (${await sess('[s.playerAction.emote, s.tool].join()')})`)
// 바퀴를 연 채 창 밖으로 포커스가 나가면(떼는 키를 못 받는다) 아무것도 하지 않고 닫힌다. ESC 도 닫기만
await M.key('keydown', 'KeyT', 't')
await wait(200)
await M.evaluate(`window.dispatchEvent(new Event('blur')), true`)
await wait(200)
check((await sess('s.mode')) === 'explore', '18) 바퀴를 연 채 포커스를 잃으면 닫힌다')
await M.key('keyup', 'KeyT', 't')
await M.key('keydown', 'KeyT', 't')
await wait(200)
await press('Escape')
check((await sess('s.mode')) === 'explore', '18) 바퀴에서 ESC 는 닫기만 (메뉴를 열지 않는다)')
await M.key('keyup', 'KeyT', 't')

// 19) Tab 으로 큰 지도 열고 닫기
await press('Tab')
check((await sess('s.mode')) === 'map', '19) Tab 으로 큰 지도')
await press('Tab')
check((await sess('s.mode')) === 'explore', '19) 다시 Tab 으로 닫기')

// 20) 도구 칸: 1 낚싯대 · 2 주먹 · 3 칼 · X 넣기
check(await M.evaluate(`!!document.querySelector('[aria-label="도구 칸"]')`), '20) 도구 칸이 보인다')
const rig = `(async () => { const { playerRig } = await __mod('/src/game/scene/Player.tsx'); return playerRig.rodShown })()`
await press('Digit3', '3')
await wait(300)
check((await sess('s.tool')) === 'knife' && !(await M.evaluate(rig)), '20) 3 → 칼, 낚싯대는 숨긴다')
await M.evaluate(`(async () => { ${S}.zoomBy(-3000); return true })()`)
await wait(800)
await M.shot('20-knife')
await M.evaluate(`(async () => { ${S}.zoomBy(600); return true })()`)
await press('KeyX', 'x')
check((await sess('s.tool')) === null, '20) X → 빈손')
await press('Digit1', '1')
check((await sess('s.tool')) === 'rod', '20) 1 → 낚싯대')
// 물가에서 E 를 누르면 저절로 낚싯대
await press('Digit2', '2')
await M.evaluate(teleport(0, 27))
check(await M.until(`document.body.innerText.includes('낚시하기')`, 6000), '20) 섬 선착장 끝 낚시 안내')
await press('KeyE', 'e')
check((await sess('[s.mode, s.tool].join()')) === 'fishing,rod', `20) 주먹을 든 채 E → 낚싯대로 낚시 (${await sess('[s.mode, s.tool].join()')})`)
await press('Escape')

// 21) 가방·먹기
await press('KeyF', 'f')
check(await M.until(`document.body.innerText.includes('먹을 음식이 없어요')`, 3000), '21) 먹을 게 없으면 F 는 알림만')
await prog(`(p.addItem('steak', 1), p.addItem('mushroom', 2), true)`)
await press('KeyI', 'i')
check((await sess('s.mode')) === 'bag' && (await M.evaluate(`document.body.innerText.includes('스테이크')`)), '21) I → 가방에 스테이크')
await M.shot('21-bag')
await M.evaluate(`__click('요리법')`)
await wait(300)
await M.shot('21-recipes')
await press('KeyI', 'i')
check((await sess('s.mode')) === 'explore', '21) I 로 닫기')
const h0 = await prog('p.survival.hunger')
await press('KeyF', 'f')
await wait(400)
check((await prog('p.items.steak')) === 0 && (await sess('s.playerAction.eat')) === 'steak', `21) F → 스테이크를 먹는다 (배고픔 ${h0.toFixed(0)} → ${(await prog('p.survival.hunger')).toFixed(0)})`)
await M.evaluate(`(async () => { ${S}.zoomBy(-3000); return true })()`)
await wait(500)
await M.shot('21-eating')


// 22) 텃밭 호박 따기: 은지 (6.5, -15.2) → 세계 (193.5, 15.2)
check(await M.until(`(async () => ${W}.outdoor.pickups.length >= 20)()`, 30000), `22) 버섯·호박이 놓였다 (${await M.evaluate(`(async () => ${W}.outdoor.pickups.length)()`)}개)`)
await M.evaluate(teleport(193.5, 14.2))
check(await M.until(`document.body.innerText.includes('호박 따기')`, 6000), '22) 호박 앞에서 "호박 따기" 안내')
await M.shot('22-pumpkin')
await press('KeyE', 'e')
check((await prog('p.items.pumpkin')) === 1, '22) E → 가방에 호박 1개')
check(await M.until(`(async () => ${W}.outdoor.pickups.filter((p) => !p.obj.visible).length === 1)()`, 2000), '22) 딴 호박은 숨긴다')

// 23) 가스레인지 요리: 달걀 1개로 달걀 프라이 (2초)
const stove = await M.evaluate(`(async () => { const c = ${W}.stove.center; return [200 - c.x, -c.z] })()`)
await prog(`(p.addItem('egg', 1), true)`)
await M.evaluate(teleport(stove[0], stove[1]))
check(await M.until(`document.body.innerText.includes('요리하기 (요리법 보기)')`, 6000), `23) 가스레인지 앞 안내 (${stove.map((v) => v.toFixed(1))})`)
await press('KeyE', 'e')
check((await sess('s.mode')) === 'bag' && (await M.evaluate(`document.querySelector('.kiosk-tabs .on')?.textContent`)) === '요리법', '23) E → 가방 요리법 탭')
await M.evaluate(`[...document.querySelectorAll('.kiosk-card')].find((b) => b.textContent.includes('달걀 프라이')).click(), true`)
await wait(300)
await M.shot('23-recipe')
check(await M.evaluate(`__click('요리하기2초 뒤 가방에 들어와요') || __click('요리하기')`), '23) 요리하기 버튼')
await wait(400)
check((await sess('s.mode')) === 'explore' && (await prog('p.items.egg')) === 0 && (await M.evaluate(`document.body.innerText.includes('달걀 프라이 요리 중')`)), '23) 창이 닫히고 HUD 에 요리 중')
await M.shot('23-cooking')
check(await M.until(`(async () => ${P}.items.friedegg === 1)()`, 5000), '23) 2초 뒤 가방에 달걀 프라이')


// 24) 침실 문(거실 문, 은지 x 5 → 세계 x 195): 닫혀 있으면 거실에서 침실로 못 간다. E 로 열면 지나간다. 상태는 저장된다
check(JSON.stringify(await prog('p.doors')) === '[false,false,false,false]', '24) 처음엔 문이 모두 닫혀 있다')
await M.evaluate(teleport(193, 0))
await wait(1500)
await walk(M, await keyToward(M, 1, 0), 2000)
const d0 = await M.evaluate(pos)
check(d0[0] > 193.5 && d0[0] < 195, `24) 문 쪽으로 걸어가서 닫힌 문에 막힌다 (193.5 < x ${d0[0].toFixed(2)} < 195)`)
check(await M.until(`document.body.innerText.includes('거실 문 여닫기')`, 3000), '24) 문 앞 "거실 문 여닫기" 안내')
await press('KeyE', 'e')
await wait(800)
check((await prog('p.doors[0]')) === true, '24) E 로 열었다')
await M.shot('24-door-open')
await walk(M, await keyToward(M, 1, 0), 2000)
const d1 = await M.evaluate(pos)
check(d1[0] > 195.5, `24) 열린 문으로 지나간다 (x ${d1[0].toFixed(2)})`)
const savedDoors = await M.evaluate(`JSON.parse(localStorage.getItem('fishing-island-save-v1')).state.doors`)
check(savedDoors?.[0] === true, `24) 문 상태를 저장한다 (${JSON.stringify(savedDoors)})`)


// 25) 농산물 가게 (은지 58, 11.5): 앞(은지 58, 9.5 → 세계 142, -9.5)에서 E → 팔기·사기
await prog(`(p.addItem('pumpkin', 2), true)`)
const before25 = await prog('[p.coins, p.items.pumpkin, p.items.mushroom]')
await M.evaluate(teleport(142, -9.5))
check(await M.until(`document.body.innerText.includes('농산물 가게 —')`, 6000), '25) 농산물 가게 앞 안내')
await turnTo(M, 0, -60)
await M.evaluate(`(async () => { ${S}.zoomBy(-200); return true })()`)
await wait(1500)
await M.shot('25-vendors')
await press('KeyE', 'e')
check((await sess('[s.mode, s.vendor].join()')) === 'vendor,grocer', '25) E → 농산물 가게 창')
await M.shot('25-sell')
const sellOne = `(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.startsWith('1개 팔기')); b?.click(); return !!b })()`
check(await M.evaluate(sellOne), '25) 팔기 버튼')
await wait(200)
await M.evaluate(sellOne)
await wait(200)
const afterSell = await prog('[p.coins, p.items.pumpkin]')
check(afterSell[0] === before25[0] + 12 && afterSell[1] === before25[1] - 2, `25) 호박 2개를 팔면 12 코인 (${before25} → ${afterSell})`)
await M.evaluate(`__click('사기')`)
await wait(300)
await M.evaluate(`[...document.querySelectorAll('.kiosk-card')].find((b) => b.textContent.includes('버섯')).click(), true`)
await wait(200)
await M.evaluate(`[...document.querySelectorAll('button')].find((b) => b.textContent.startsWith('1개 사기')).click(), true`)
await wait(300)
const afterBuy = await prog('[p.coins, p.items.mushroom]')
check(afterBuy[1] === before25[2] + 1 && afterBuy[0] === afterSell[0] - 8, `25) 버섯을 사면 8 코인 (${afterBuy})`)
check(await M.evaluate(`document.body.innerText.includes('오늘 남은 수량 2')`), '25) 사기 탭에 오늘 남은 수량 (버섯 3 → 2)')
await M.shot('25-buy')
await press('Escape')
check((await sess('s.mode')) === 'explore', '25) ESC 로 닫기')


// 26) 폰: 도구 칸은 쓰는 칸만, 오른쪽 아래 점프 위에 가방 버튼. 세로(390·360)·가로 화면에서 겹치지 않는지 스크린샷
await M.evaluate(`(async () => { (await __mod('/src/game/input/touchDevice.ts')).useTouchUiStore.setState({ touchUi: true }); return true })()`)
await M.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
await wait(1200)
check(await M.evaluate(`document.querySelectorAll('[aria-label="도구 칸"] button').length === 3`), '26) 폰 도구 칸은 3칸')
await M.shot('26-phone-portrait')
await M.evaluate(`[...document.querySelectorAll('[aria-label="도구 칸"] button')][2].click(), true`)
await wait(300)
check((await M.evaluate(`(async () => ${S}.tool)()`)) === 'knife', '26) 칸을 누르면 칼')
await M.send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 2, mobile: true })
await wait(1200)
await M.shot('26-phone-landscape')
check(await M.evaluate(`(document.querySelector('button[aria-label="가방"]').click(), true)`), '26) 폰 가방 버튼 (오른쪽 아래)')
await wait(500)
check((await sess('s.mode')) === 'bag', '26) 가방 버튼을 누르면 가방 창')
await M.shot('26-phone-bag')
await press('Escape')
await wait(300)
// 좁은 세로 화면(360): 가방 버튼이 조이스틱 자리와 겹치지 않고, 도구 칸·채팅·안내도 서로 겹치지 않는다
await M.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 780, deviceScaleFactor: 2, mobile: true })
await wait(1200)
await M.shot('26-phone-360')
const overlap360 = await M.evaluate(`(() => {
  const box = (sel) => document.querySelector(sel)?.getBoundingClientRect()
  const hit = (a, b) => !!(a && b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom)
  const joy = box('.tc-joy'), hot = box('[aria-label="도구 칸"]'), help = box('.tc-help')
  const right = [...document.querySelectorAll('.tc-right .tc-btn')].map((b) => b.getBoundingClientRect())
  return right.some((b) => hit(b, joy) || hit(b, hot)) || hit(help, hot) || hit(help, joy)
})()`)
check(overlap360 === false, '26) 360 세로: 오른쪽 버튼이 조이스틱·도구 칸과, 안내가 도구 칸과 겹치지 않는다')
check(await M.evaluate(`(document.querySelector('button[aria-label="가방"]').click(), true)`), '26) 360 세로 가방 버튼')
await wait(500)
check((await sess('s.mode')) === 'bag', '26) 360 세로: 가방 버튼을 누르면 가방 창')
await M.shot('26-phone-360-bag')
await press('Escape')
await M.send('Emulation.clearDeviceMetricsOverride')

M.close()

// 27) 같이 하기: A 가 칼을 들면 B 가 받은 모습에 tool 이 있다 (서버도 같은 netProtocol 로 tool 을 넘긴다)
const RUN32 = Date.now().toString(36)
const A4 = await open(9740, 0, `?room=tools-${RUN32}`)
await A4.evaluate(`__click('🔒 방 만들기')`)
await A4.evaluate(`__fill('암호', 'secret1') && __fill('닉네임', '에이')`)
await A4.evaluate(`__click('방 만들고 들어가기')`)
check(await A4.until(`document.body.innerText.includes('👥 1명')`, 20000), '27) A 방 만들기')
const B4 = await open(9741, 1, `?room=tools-${RUN32}`)
await B4.evaluate(`__fill('암호', 'secret1') && __fill('닉네임', '비이')`)
await B4.evaluate(`__click('들어가기')`)
check(await B4.until(`document.body.innerText.includes('👥 2명')`, 20000), '27) B 들어가기')
await A4.key('keydown', 'Digit3', '3')
await A4.key('keyup', 'Digit3', '3')
const remoteTool = `(async () => { const { remoteRig } = await __mod('/src/game/net/remoteRig.ts'); const e = [...remoteRig.values()][0]; return e?.buf.at(-1)?.s.tool ?? null })()`
check(await B4.until(`${remoteTool}.then((t) => t === 'knife')`, 8000), '27) A 가 칼을 들면 B 가 tool knife 를 받는다')
A4.close()
B4.close()

check(!consoleErrors.some((e) => /shader|WebGLProgram/i.test(e)), '셰이더 컴파일 오류가 없다')
if (consoleErrors.length) console.log(`콘솔 오류·경고 ${consoleErrors.length}개:\n${consoleErrors.slice(0, 20).join('\n')}`)

A.close()
console.log(`스크린샷: ${OUT}`)
process.exit(failed ? 1 : 0)
