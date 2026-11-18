// 초원 + 배 + 은지 기능(3-1 시간·생존, 3-2 도구·가방·상인, 3-3 동물·사냥, 3-4 총·사격장·PvP) 점검 (헤드리스 Chrome). 스크린샷을 남긴다
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


// 26) 폰: 도구 칸은 쓰는 칸만 (총은 한 칸), 오른쪽 아래 점프 위에 가방 버튼. 세로(390·360)·가로 화면에서 겹치지 않는지 스크린샷
await M.evaluate(`(async () => { (await __mod('/src/game/input/touchDevice.ts')).useTouchUiStore.setState({ touchUi: true }); return true })()`)
await M.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
await wait(1200)
check(await M.evaluate(`document.querySelectorAll('[aria-label="도구 칸"] button').length === 4`), '26) 폰 도구 칸은 4칸 (총은 마지막에 든 한 칸)')
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

// ── 3-3 동물과 사냥 (28~) ──
const H = await open(9742, 0)
await H.evaluate(`__click('혼자 하기')`)
await wait(3000)
const HS = `(await __mod('/src/game/stores/sessionStore.ts')).useSessionStore.getState()`
const HP = `(await __mod('/src/game/stores/progressStore.ts')).useProgressStore.getState()`
const RIG = `(await __mod('/src/game/hunt/animalRig.ts'))`
const hev = (expr) => H.evaluate(`(async () => { const r = ${RIG}; const s = ${HS}; const p = ${HP}; return ${expr} })()`)
const hpress = async (code, k = code) => { await H.key('keydown', code, k); await H.key('keyup', code, k); await wait(300) }
const herd = () => hev(`r.animalViews(false, 0)`)

// 28) 혼자: 들판(세계 x 166..206, z -52..-26)에 동물 12마리, 은지 Cube Pets 모델을 받는다
await H.evaluate(teleport(186, -23))
await wait(1500)
await turnTo(H, 0, -40)
check(await H.until(`(async () => ${RIG}.herdDrawn.count === 12)()`, 30000), '28) 동물 모델을 받아 12마리를 그린다')
const herd28 = await herd()
check(herd28.length === 12 && herd28.every((a) => a.x >= 155 && a.x <= 217 && a.z >= -59 && a.z <= -23), `28) 혼자 하면 들판에 동물 12마리 (${herd28.length})`)
await wait(1500)
await H.shot('28-animals')

// 29) 혼자 시뮬레이션이 돈다: 2초 뒤 누군가는 움직였다
const moved = await H.until(`(async () => { const r = ${RIG}; const now = r.animalViews(false, 0); return now.some((a) => { const b = ${JSON.stringify(herd28)}.find((x) => x.id === a.id); return b && Math.hypot(a.x - b.x, a.z - b.z) > 0.3 }) })()`, 8000)
check(moved, '29) 동물이 돌아다닌다')

// 30) 발밑 전리품: E "소고기 줍기" → 가방
const me = await H.evaluate(pos)
await hev(`(r.spawnLoot(['beef', 'bone'], ${me[0] + 0.4}, ${me[2]}, performance.now() / 1000 - 2), true)`)
check(await H.until(`document.body.innerText.includes('줍기')`, 4000), '30) 전리품 앞 "줍기" 안내')
await H.shot('30-loot')
const before30 = await hev(`[p.items.beef, p.items.bone]`)
await hpress('KeyE', 'e')
await hpress('KeyE', 'e')
const after30 = await hev(`[p.items.beef, p.items.bone, r.lootList().length]`)
check(after30[0] === before30[0] + 1 && after30[1] === before30[1] + 1 && after30[2] === 0, `30) E 두 번에 소고기·뼈가 가방으로 (${before30} → ${after30})`)
// 31) 칼(3)을 들고 소 바로 남쪽에서 북쪽을 보고 클릭(베기) → 소 체력 3 → 2, 때린 나를 쫓는다
const attack = (kind) => H.evaluate(`(async () => { (await __mod('/src/game/input/pointer.ts')).pressAttack('${kind}'); return true })()`)
const cowNow = `(async () => { const r = ${RIG}; return r.animalViews(false, 0).find((a) => a.sp === 'cow' && a.pose !== 'dead') ?? null })()`
await hpress('Digit3', '3')
check((await hev(`s.tool`)) === 'knife', '31) 3 → 칼')
await turnTo(H, 0, -30)
const cow0 = await H.evaluate(cowNow)
const stamina31 = await hev(`p.survival.stamina`)
const cowById = `(async () => { const r = ${RIG}; return r.soloHerd().animals.find((a) => a.id === ${cow0.id}) })()`
// 다가가면 달아나므로(7m) 바로 뒤에 서서 곧장 휘두른다. 헤드리스는 프레임이 느려 빗나가면 몇 번 더
let cow1 = cow0
for (let i = 0; i < 4 && cow1.hp === 3; i++) {
  await H.evaluate(teleport(cow1.x, cow1.z + 0.8))
  await wait(100)
  await attack('primary')
  await wait(120)
  if (i === 0) await H.shot('31-slash')
  await wait(400)
  cow1 = await H.evaluate(cowById)
}
check(cow1?.hp === 2 && cow1.state === 'attack' && cow1.target === 'me', `31) 베기 한 번에 소 체력 2, 나를 쫓는다 (${cow1?.hp}, ${cow1?.state})`)

// 32) 맞은 소가 들이받으면 체력 15 가 줄고 화면 가장자리가 번쩍인다
check(await H.until(`(async () => ${HP}.survival.stamina <= ${stamina31 - 15 + 0.5})()`, 5000), '32) 소가 들이받으면 체력 −15')
check((await hev(`s.hurtAt`)) !== null, '32) 맞으면 화면 가장자리가 번쩍인다')
await H.shot('32-hurt')

// 33) 오른쪽 클릭(찌르기, 피해 2)으로 쓰러뜨리면 1.4초 뒤 전리품이 보이고 E 로 줍는다
let dead = false
for (let i = 0; i < 6 && !dead; i++) {
  const c = await H.evaluate(`(async () => { const r = ${RIG}; return r.soloHerd().animals.find((a) => a.id === ${cow0.id}) ?? null })()`)
  if (!c || c.state === 'dead') {
    dead = true
    break
  }
  await H.evaluate(teleport(c.x, c.z + 1))
  await wait(150)
  await attack('secondary')
  await wait(900)
  dead = await H.evaluate(`(async () => { const r = ${RIG}; const a = r.soloHerd().animals.find((x) => x.id === ${cow0.id}); return !a || a.state === 'dead' })()`)
}
check(dead, '33) 찌르기로 소를 쓰러뜨린다')
await H.shot('33-down')
check(await H.until(`document.body.innerText.includes('사냥 성공')`, 2000), '33) "소 사냥 성공!" 알림')
const lootPos = await hev(`r.lootList().map((l) => [l.x, l.z, l.item])`)
check(lootPos.length >= 3 && lootPos.filter((l) => l[2] === 'beef').length === 2, `33) 소고기 2·뼈 1 을 떨어뜨린다 (${lootPos.map((l) => l[2])})`)
await wait(1600)
await H.evaluate(teleport(lootPos[0][0], lootPos[0][1]))
check(await H.until(`document.body.innerText.includes('줍기')`, 4000), '33) 1.4초 뒤 전리품 줍기 안내')
await H.shot('33-loot')
const beef33 = await hev(`p.items.beef`)
for (let i = 0; i < 3; i++) await hpress('KeyE', 'e')
check((await hev(`p.items.beef`)) >= beef33 + 1, `33) E 로 주우면 가방에 소고기 (${beef33} → ${await hev('p.items.beef')})`)

// 34) 집 안(침실)으로 들어가면 쫓던 동물이 포기한다 (실내 판정: 은지 집 방 4개). 멧돼지(체력 3)를 찌르면(2) 살아남아 쫓아온다
const hog = await H.evaluate(`(async () => { const r = ${RIG}; return r.soloHerd().animals.find((a) => a.sp === 'hog' && a.state !== 'dead') ?? null })()`)
const hogById = `(async () => { const r = ${RIG}; return r.soloHerd().animals.find((a) => a.id === ${hog.id}) })()`
let chasing = hog.state
for (let i = 0; i < 4 && chasing !== 'attack'; i++) {
  const now34 = await H.evaluate(hogById)
  await H.evaluate(teleport(now34.x, now34.z + 0.9))
  await wait(150)
  await attack('secondary')
  await wait(900)
  chasing = (await H.evaluate(hogById))?.state
}
await H.evaluate(teleport(197, -2))
check(chasing === 'attack' && (await H.until(`(async () => { const r = ${RIG}; return r.soloHerd().animals.find((a) => a.id === ${hog.id})?.state !== 'attack' })()`, 3000)), `34) 실내로 들어가면 쫓던 멧돼지가 포기한다 (${chasing})`)
/**
 * 화면 위 UI 가 서로 겹치는 쌍 (이름 목록). 미니맵·휘두르기·점프·가방·표현·조이스틱·안내 글씨·방 표시(🔒)·채팅 줄(text 를 준 경우).
 * 보이는 것만 본다
 */
const layoutClash = (chatText = '') => `(() => {
  const pick = {
    minimap: document.querySelector('canvas[aria-label^="미니맵"]'),
    attack: document.querySelector('button[aria-label="휘두르기"]'),
    jump: document.querySelector('button[aria-label="점프"]'),
    bag: document.querySelector('button[aria-label="가방"]'),
    emote: document.querySelector('button[aria-label="감정 표현"]'),
    joy: document.querySelector('.tc-joy-base'),
    help: document.querySelector('.tc-help'),
    badge: [...document.querySelectorAll('div')].find((d) => getComputedStyle(d).position === 'absolute' && d.innerText.startsWith('🔒')),
    chat: ${JSON.stringify(chatText)} ? [...document.querySelectorAll('div,span')].filter((d) => d.children.length === 0 && d.textContent.includes(${JSON.stringify(chatText)})).at(-1) : null,
  }
  const r = Object.entries(pick).filter(([, e]) => e && e.getClientRects().length).map(([k, e]) => [k, e.getBoundingClientRect()])
  const out = []
  for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) {
    const [a, A] = r[i], [b, B] = r[j]
    if (A.left < B.right - 1 && A.right > B.left + 1 && A.top < B.bottom - 1 && A.bottom > B.top + 1) out.push(a + '/' + b)
  }
  return out
})()`
const LAYOUT_CLASH = layoutClash()

// 35) 폰: 주먹·칼을 들면 휘두르기 버튼. 세로 화면은 가방 줄(점프 위)에 있어 조이스틱과 겹치지 않는다. 누르면 휘두른다
await H.evaluate(teleport(188, -12))
await wait(1000)
await H.evaluate(`(async () => { (await __mod('/src/game/input/touchDevice.ts')).useTouchUiStore.setState({ touchUi: true }); return true })()`)
const overlapJoy = `(() => { const a = document.querySelector('button[aria-label="휘두르기"]')?.getBoundingClientRect(); const j = document.querySelector('.tc-joy')?.getBoundingClientRect(); if (!a || !j) return null; return a.left < j.right && a.right > j.left && a.top < j.bottom && a.bottom > j.top })()`
for (const [w, h, name] of [[390, 844, 'portrait'], [844, 390, 'landscape']]) {
  await H.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true })
  await wait(1200)
  check((await H.evaluate(overlapJoy)) === false, `35) 폰 ${name}: 휘두르기 버튼이 있고 조이스틱과 겹치지 않는다`)
  const clash = await H.evaluate(LAYOUT_CLASH)
  check(Array.isArray(clash) && clash.length === 0, `35) 폰 ${name}: 미니맵·버튼·안내 글씨가 서로 겹치지 않는다 (${JSON.stringify(clash)})`)
  await H.shot(`35-phone-${name}`)
}
const ready35 = await H.evaluate(`(async () => (await __mod('/src/game/hunt/meleeRig.ts')).meleeRig.readyAt)()`)
await H.evaluate(`(document.querySelector('button[aria-label="휘두르기"]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })), true)`)
check(await H.until(`(async () => (await __mod('/src/game/hunt/meleeRig.ts')).meleeRig.readyAt !== ${ready35})()`, 3000), '35) 폰 휘두르기 버튼을 누르면 휘두른다')
await H.send('Emulation.clearDeviceMetricsOverride')
await H.evaluate(`(async () => { (await __mod('/src/game/input/touchDevice.ts')).useTouchUiStore.setState({ touchUi: false }); return true })()`)
H.close()

// 36) 같이 하기: 두 사람이 같은 동물을 본다 (서버가 돌린다). A 가 소를 때리면 B 화면에서도 체력이 줄고, 쓰러뜨리면 전리품은 A 에게만
const RUN33 = Date.now().toString(36)
const A5 = await open(9743, 0, `?room=hunt-${RUN33}`)
await A5.evaluate(`__click('🔒 방 만들기')`)
await A5.evaluate(`__fill('암호', 'secret1') && __fill('닉네임', '에이')`)
await A5.evaluate(`__click('방 만들고 들어가기')`)
check(await A5.until(`document.body.innerText.includes('👥 1명')`, 20000), '36) A 방 만들기')
const B5 = await open(9744, 1, `?room=hunt-${RUN33}`)
await B5.evaluate(`__fill('암호', 'secret1') && __fill('닉네임', '비이')`)
await B5.evaluate(`__click('들어가기')`)
check(await B5.until(`document.body.innerText.includes('👥 2명')`, 20000), '36) B 들어가기')
const roomHerd = (b) => b.evaluate(`(async () => { const r = ${RIG}; return r.animalViews(true, performance.now() / 1000) })()`)
await A5.evaluate(teleport(186, -23))
await B5.evaluate(teleport(180, -23))
await wait(2500)
// 두 화면을 거의 같은 때 읽는다 (달리는 동물은 초당 5m 까지 움직인다). 번호·종은 모두 같고, 자리는 대부분 1.5m 안
const [ha, hb] = await Promise.all([roomHerd(A5), roomHerd(B5)])
const gaps = ha.map((a) => { const b = hb.find((x) => x.id === a.id && x.sp === a.sp); return b ? Math.hypot(b.x - a.x, b.z - a.z) : Infinity }).sort((x, y) => x - y)
check(ha.length === 12 && hb.length === 12 && gaps.every(Number.isFinite) && gaps[6] < 1.5, `36) 두 사람이 같은 동물 12마리를 본다 (${ha.length}, ${hb.length}, 가운데 거리 ${gaps[6]?.toFixed(2)}m)`)
await turnTo(A5, 0, -30)
await A5.shot('36-room-A')
await B5.shot('36-room-B')
await A5.key('keydown', 'Digit3', '3')
await A5.key('keyup', 'Digit3', '3')
await wait(300)
const attackA = (kind) => A5.evaluate(`(async () => { (await __mod('/src/game/input/pointer.ts')).pressAttack('${kind}'); return true })()`)
const roomCow = (b, id) => b.evaluate(`(async () => { const r = ${RIG}; return r.animalViews(true, performance.now() / 1000).find((a) => ${id === undefined ? "a.sp === 'cow' && a.pose !== 'dead'" : `a.id === ${id}`}) ?? null })()`)
const rc0 = await roomCow(A5)
let rcB = rc0
for (let i = 0; i < 6 && rcB && rcB.hp === 3; i++) {
  const c = await roomCow(A5, rc0.id)
  await A5.evaluate(teleport(c.x, c.z + 0.8))
  await wait(400)
  await attackA('primary')
  await wait(900)
  rcB = await roomCow(B5, rc0.id)
}
check(rcB?.hp === 2, `36) A 가 베면 B 화면의 소도 체력 2 (${rcB?.hp})`)
const staminaA = await A5.evaluate(`(async () => ${HP}.survival.stamina)()`)
check(await A5.until(`(async () => ${HP}.survival.stamina < ${staminaA})()`, 6000), '36) 서버의 소가 A 를 들이받으면 A 체력이 준다 (hurt)')
let downB = false
for (let i = 0; i < 6 && !downB; i++) {
  const c = await roomCow(A5, rc0.id)
  if (!c || c.pose === 'dead') break
  await A5.evaluate(teleport(c.x, c.z + 0.8))
  await wait(400)
  await attackA('secondary')
  await wait(1000)
  const b = await roomCow(B5, rc0.id)
  downB = !b || b.pose === 'dead'
}
check(downB, '36) A 가 찔러 쓰러뜨리면 B 화면에서도 쓰러진다')
const lootA = await A5.evaluate(`(async () => ${RIG}.lootList().map((l) => l.item))()`)
const lootB = await B5.evaluate(`(async () => ${RIG}.lootList().length)()`)
check(lootA.filter((x) => x === 'beef').length === 2 && lootB === 0, `36) 전리품은 잡은 A 에게만 (${lootA} / B ${lootB})`)
await A5.shot('36-room-loot')
// 폰 가로(844×390)로 같이 하기: 방 표시·채팅 줄·미니맵·버튼이 겹치지 않는다
await B5.evaluate(`(async () => { (await __mod('/src/game/input/touchDevice.ts')).useTouchUiStore.setState({ touchUi: true }); return true })()`)
await B5.key('keydown', 'Digit3', '3')
await B5.key('keyup', 'Digit3', '3')
await B5.send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 2, mobile: true })
await A5.evaluate(`(async () => (await __mod('/src/game/stores/netStore.ts')).useNetStore.getState().sendChat('사냥 가자'))()`)
await B5.until(`document.body.innerText.includes('사냥 가자')`, 5000)
await wait(1200)
const clash36 = await B5.evaluate(layoutClash('사냥 가자'))
check(Array.isArray(clash36) && clash36.length === 0, `36) 폰 가로 같이 하기: 방 표시·채팅·미니맵·휘두르기 버튼이 겹치지 않는다 (${JSON.stringify(clash36)})`)
await B5.shot('36-phone-landscape-room')
A5.close()
B5.close()

// ── 3-4 총·사격장·PvP ──
const GSESS = `(await __mod('/src/game/stores/sessionStore.ts')).useSessionStore`
const GPROG = `(await __mod('/src/game/stores/progressStore.ts')).useProgressStore`
const GRIG = `(await __mod('/src/game/guns/gunRig.ts')).gunRig`
const GRANGE = `(await __mod('/src/meadow/meadowSingleton.ts')).meadowRange()`
const gkey = async (b, code, k = code) => { await b.key('keydown', code, k); await b.key('keyup', code, k); await wait(200) }
const gequip = (b, tool) => b.evaluate(`(async () => { ${GSESS}.getState().equip('${tool}'); return true })()`)
/**
 * 쏘고 그 한 발을 처리할 때까지 기다린다 (헤드리스는 몇 fps 라). 쏘지 못했으면 false.
 * 총을 바꾼 뒤 0.25초·연사 간격·장전 중엔 누른 것이 버려지므로(은지 그대로) 쏠 수 있을 때까지 먼저 기다린다
 */
const gfire = async (b) => {
  await b.until(`(async () => { const g = ${GRIG}; return g.gun !== null && g.gun === ${GSESS}.getState().tool && !g.reload && performance.now() / 1000 > g.readyAt + 0.05 })()`, 20000)
  const before = JSON.stringify(await b.evaluate(`(async () => ${GRIG}.lastShot)()`))
  await b.evaluate(`(async () => { (await __mod('/src/game/input/pointer.ts')).pressAttack('primary'); return true })()`)
  return b.until(`(async () => JSON.stringify(${GRIG}.lastShot) !== ${JSON.stringify(before)})()`, 20000)
}
const gammo = (b, gun) => b.evaluate(`(async () => ${GPROG}.getState().ammo.${gun})()`)

// 37) 잡화점: 탄약 묶음을 코인으로 산다 (예비 탄약에 더한다)
const G = await open(9745, 0)
await G.evaluate(`__click('혼자 하기')`)
await wait(3000)
await G.evaluate(`(async () => { ${GPROG}.setState({ coins: 300 }); return true })()`)
await G.evaluate(teleport(148, -12.6))
check(await G.until(`document.body.innerText.includes('잡화점 — 탄약을 팝니다')`, 5000), '37) 잡화점 앞 "탄약을 팝니다"')
await gkey(G, 'KeyE', 'e')
await G.evaluate(`__click('사기')`)
await wait(300)
await G.shot('37-ammo-shop')
const res0 = await G.evaluate(`(async () => ${GPROG}.getState().reserve.pistol)()`)
await G.evaluate(`[...document.querySelectorAll('button')].find((b) => b.textContent.startsWith('1묶음 사기')).click(), true`)
await wait(300)
const bought = await G.evaluate(`(async () => { const p = ${GPROG}.getState(); return [p.coins, p.reserve.pistol] })()`)
check(bought[0] === 220 && bought[1] === res0 + 12, `37) 권총 탄약 12발을 80 코인에 산다 (${bought})`)
await gkey(G, 'Escape')

// 38) 총: 쏘면 탄창이 줄고 R 로 장전, 동물을 맞히면 체력이 준다 (혼자), 벽엔 총알 자국. 소총 조준은 1인칭 조준경, 휠로 배율
await G.evaluate(teleport(186, -20))
await wait(1500)
await gkey(G, 'Digit4', '4')
check((await G.evaluate(`(async () => ${GSESS}.getState().tool)()`)) === 'pistol', '38) 4 → 권총')
await turnTo(G, 0, -110)
await wait(600)
check(await gfire(G), '38) 권총을 쏜다')
check((await gammo(G, 'pistol')) === 11, '38) 탄창 12 → 11')
await gkey(G, 'KeyR', 'r')
check(await G.until(`(async () => ${GPROG}.getState().ammo.pistol === 12)()`, 15000), '38) R 장전 (권총 1.3초) → 탄창 12, 예비에서 1')
await G.shot('38-pistol')
// 광선이 높이 0.6m 를 지나는 곳에 소(1번)를 세우고 산탄총으로 쏜다
await gkey(G, 'Digit6', '6')
await wait(500)
const cowAt = await G.evaluate(`(async () => {
  const r = (await __mod('/src/game/hunt/animalRig.ts')); const s = ${GRIG}.lastShot
  const t = (s.o.y - 0.6) / -s.d.y
  const x = s.o.x + s.d.x * t, z = s.o.z + s.d.z * t
  const h = r.soloHerd()
  r.setSoloHerd({ ...h, animals: h.animals.map((a) => a.id === 1 ? { ...a, x, z, state: 'idle', target: null } : a) })
  return [x, z, t]
})()`)
await wait(600)
check(await gfire(G), '38) 산탄총을 쏜다')
const cow38 = await G.evaluate(`(async () => (await __mod('/src/game/hunt/animalRig.ts')).soloHerd().animals.find((a) => a.id === 1))()`)
check(cow38.hp < 3, `38) 산탄 여러 알이 소에 맞아 체력이 준다 (${cowAt[2].toFixed(1)}m, 체력 ${cow38.hp}, ${cow38.state})`)
await G.shot('38-shotgun-cow')
await G.evaluate(teleport(201, -8))
await wait(1200)
await gequip(G, 'pistol')
await turnTo(G, -Math.PI / 2, 0)
await wait(600)
await gfire(G)
check((await G.evaluate(`(async () => ${GRIG}.lastShot.hit)()`)) === 'wall', '38) 집 벽을 쏘면 벽에 맞는다 (총알 자국)')
await G.shot('38-wall-hole')
await gkey(G, 'Digit5', '5')
await gkey(G, 'KeyV', 'v')
check(await G.until(`(async () => (await __mod('/src/game/scene/Player.tsx')).playerRig.firstPerson)()`, 3000), '38) V → 1인칭')
await G.shot('38-first-person')
await gkey(G, 'KeyV', 'v')
await G.evaluate(`(async () => { (await __mod('/src/game/input/pointer.ts')).setTouchAim(true); return true })()`)
check(await G.until(`(async () => (await __mod('/src/game/scene/Player.tsx')).playerRig.firstPerson && ${GRIG}.optic?.label === '홀로')()`, 3000), '38) 3인칭에서 소총으로 조준하면 그동안 1인칭 홀로 조준기')
await G.evaluate(`(async () => { document.querySelector('canvas').parentElement.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true })); return true })()`)
check(await G.until(`(async () => ${GRIG}.optic?.label === '2.5x' && !!document.querySelector('[aria-label="조준경 2.5x"]'))()`, 3000), '38) 휠을 올리면 2.5x 조준경 화면')
await G.shot('38-scope')
await G.evaluate(`(async () => { (await __mod('/src/game/input/pointer.ts')).setTouchAim(false); return true })()`)
check(await G.until(`(async () => !(await __mod('/src/game/scene/Player.tsx')).playerRig.firstPerson)()`, 3000), '38) 조준을 놓으면 3인칭으로')

// 39) 사격장: 표적판을 맞히면 점수, G 60초 연습 게임 (사격장 안에서만), 최고 점수 저장, 무기 선반 E → 고르기
await G.evaluate(teleport(181.5, 0))
await wait(1500)
await gequip(G, 'pistol')
await gkey(G, 'KeyV', 'v')
// 기울기를 끝(1.2)까지 내린 뒤 1.2 만큼 올려 수평(0)으로 맞춘다 (앞 점검에서 고개를 든 채로 남아 있다)
await turnTo(G, Math.PI / 2, 400)
await turnTo(G, Math.PI / 2, -240)
await wait(600)
await G.shot('39-range')
check(await gfire(G), '39) 사격장에서 쏜다')
/**
 * 마지막 한 발의 광선이 표적판 면(세계 x 174.4)을 지나는 곳으로 표적(lane 0..2)을 옮긴다.
 * hold: 게임 중엔 표적이 좌우로 움직이므로, 사격장 update 가 끝날 때마다 그 자리로 되돌린다 (게임 시간·점수는 그대로)
 */
const holdTarget = (lane, hold) => G.evaluate(`(async () => {
  const s = ${GRIG}.lastShot; const r = ${GRANGE}; const tg = r.targets[${lane}]
  const t = (174.4 - s.o.x) / s.d.x
  const y = s.o.y + s.d.y * t, z = -(s.o.z + s.d.z * t)
  const put = () => { tg.homeZ = z; tg.phase = 0; tg.down = false; tg.pivot.position.y = y - 1.3; tg.pivot.position.z = z }
  put()
  if (${hold} && !r.__held) {
    const update = r.update
    r.update = (dt) => { update(dt); if (r.game.state === 'running') put() }
    r.__held = true
  }
  return true
})()`)
await holdTarget(1, false)
await wait(1500)
await gfire(G)
check((await G.evaluate(`(async () => ${GRIG}.lastShot.hit)()`)) === 'target', '39) 표적판에 맞는다')
await G.shot('39-target')
await G.evaluate(teleport(188, -12))
await wait(800)
await gkey(G, 'KeyG', 'g')
check((await G.evaluate(`(async () => ${GRANGE}.game.state)()`)) === 'idle' && (await G.evaluate(`document.body.innerText.includes('사격장 안에서')`)), '39) 사격장 밖에선 G 를 눌러도 시작하지 않는다')
await G.evaluate(teleport(181.5, 0))
await wait(1500)
await gkey(G, 'KeyG', 'g')
check((await G.evaluate(`(async () => ${GRANGE}.game.state)()`)) === 'countdown', '39) G → 3초 카운트다운')
check(await G.until(`(async () => ${GRANGE}.game.state === 'running')()`, 30000), '39) 연습 게임 시작 (움직이는 표적)')
await gfire(G)
await holdTarget(0, true)
await wait(1500)
// 표적은 매 프레임 광선 위로 되돌리지만 프레임 사이에 조금 움직인다: 맞을 때까지 몇 발
for (let i = 0; i < 8; i++) {
  await gfire(G)
  if ((await G.evaluate(`(async () => ${GRANGE}.game.score)()`)) > 0) break
}
const game39 = await G.evaluate(`(async () => { const g = ${GRANGE}.game; return { score: g.score, hits: g.hits, shots: g.shots } })()`)
check(game39.score > 0 && game39.hits > 0 && game39.shots >= game39.hits, `39) 게임 중 맞히면 점수 (${JSON.stringify(game39)})`)
await G.shot('39-running')
await gkey(G, 'KeyG', 'g')
check((await G.evaluate(`(async () => ${GRANGE}.game.state)()`)) === 'over', '39) G 로 그만 → 결과')
check(await G.until(`(async () => ${GPROG}.getState().rangeBest === ${GRANGE}.game.score && ${GRANGE}.game.score > 0)()`, 10000), '39) 최고 점수를 저장한다')
await G.shot('39-result')
await gkey(G, 'KeyV', 'v')
await G.evaluate(teleport(183.3, 4.0))
check(await G.until(`document.body.innerText.includes('무기 고르기')`, 15000), '39) 무기 선반 앞 "E 무기 고르기"')
await gkey(G, 'KeyE', 'e')
check((await G.evaluate(`(async () => ${GSESS}.getState().mode)()`)) === 'rack', '39) E → 무기 선반 창')
await G.shot('39-rack')
await G.evaluate(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('저격총')).click(), true`)
await wait(300)
const rack39 = await G.evaluate(`(async () => { const s = ${GSESS}.getState(); return [s.mode, s.tool] })()`)
check(rack39[0] === 'explore' && rack39[1] === 'sniper', `39) 저격총을 고르면 들고 창을 닫는다 (${rack39})`)
const saved39 = await G.evaluate(`(() => { const s = JSON.parse(localStorage.getItem('fishing-island-save-v1')); return [s.version, s.state.ammo, s.state.reserve, s.state.rangeBest] })()`)
check(saved39[0] === 5 && saved39[1]?.pistol >= 0 && saved39[2]?.pistol >= 0 && saved39[3] > 0, `39) 저장본 version 5 에 탄창·예비·사격장 최고 점수 (${JSON.stringify(saved39)})`)

// 40) 폰: 총·칼을 들면 쏘기·조준·장전·무기 바꾸기 / 베기·찌르기 버튼. 세로·가로(360·390·780·844)에서 미니맵·조이스틱·도구 칸·안내·상호작용과 겹치지 않는다
const weaponClash = `(() => {
  const q = (s) => document.querySelector(s)
  const pick = {
    minimap: q('canvas[aria-label^="미니맵"]'), joy: q('.tc-joy-base'), help: q('.tc-help'), hotbar: q('[aria-label="도구 칸"]'),
    action: q('.tc-action'), jump: q('button[aria-label="점프"]'), bag: q('button[aria-label="가방"]'), emote: q('button[aria-label="감정 표현"]'),
    fire: q('button[aria-label="쏘기"]'), aim: q('button[aria-label="조준"]'), reload: q('button[aria-label="장전"]'), cycle: q('button[aria-label="무기 바꾸기"]'),
    slash: q('button[aria-label="휘두르기"]'), stab: q('button[aria-label="찌르기"]'),
  }
  const r = Object.entries(pick).filter(([, e]) => e && e.getClientRects().length).map(([k, e]) => [k, e.getBoundingClientRect()])
  const out = []
  for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) {
    const [a, A] = r[i], [b, B] = r[j]
    if (A.left < B.right - 1 && A.right > B.left + 1 && A.top < B.bottom - 1 && A.bottom > B.top + 1) out.push(a + '/' + b)
  }
  return [...out, ...r.filter(([, R]) => R.left < -1 || R.right > innerWidth + 1).map(([k]) => k + ':밖')]
})()`
await G.evaluate(`(async () => { (await __mod('/src/game/input/touchDevice.ts')).useTouchUiStore.setState({ touchUi: true }); return true })()`)
for (const near of [false, true]) {
  await G.evaluate(teleport(near ? 148 : 160, near ? -12.6 : -25))
  await wait(1500)
  for (const tool of ['pistol', 'knife']) {
    await gequip(G, tool)
    for (const [w, h] of [[390, 844], [360, 780], [844, 390], [780, 360]]) {
      await G.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true })
      // 화면 크기가 바뀐 뒤 다시 그릴 때까지 (바쁜 기계에선 몇 초) 기다린다
      await G.until(`innerWidth === ${w} && JSON.stringify(${weaponClash}) === '[]'`, 8000)
      const clash = await G.evaluate(weaponClash)
      check(Array.isArray(clash) && clash.length === 0, `40) 폰 ${w}×${h} ${tool}${near ? ' + 상호작용' : ''}: 버튼이 서로·미니맵·도구 칸과 겹치지 않는다 (${JSON.stringify(clash)})`)
      if (near && (w === 360 || w === 780)) await G.shot(`40-phone-${tool}-${w}x${h}`)
    }
  }
}
await G.send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 2, mobile: true })
await G.evaluate(teleport(160, -25))
await gequip(G, 'pistol')
await wait(1000)
await G.evaluate(`(async () => { ${GPROG}.setState({ ammo: { ...${GPROG}.getState().ammo, pistol: 12 } }); return true })()`)
await G.until(`(async () => { const g = ${GRIG}; return g.gun === 'pistol' && !g.reload && performance.now() / 1000 > g.readyAt + 0.05 })()`, 20000)
const yaw40 = await G.evaluate(camYaw)
const ammo40 = await gammo(G, 'pistol')
await G.evaluate(`(() => {
  const b = document.querySelector('button[aria-label="쏘기"]'); const r = b.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2
  b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 31, clientX: x, clientY: y }))
  b.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 31, clientX: x - 120, clientY: y }))
  return true
})()`)
await wait(800)
check(await G.until(`(async () => ${GPROG}.getState().ammo.pistol === ${ammo40 - 1})()`, 15000), '40) 폰 쏘기 버튼을 누르면 한 발')
check(await G.until(`(async () => Math.abs((await __mod('/src/game/scene/Player.tsx')).playerRig.yaw - ${yaw40}) > 0.3)()`, 15000), '40) 쏘기 버튼을 누른 채 끌면 시점이 돈다')
await G.evaluate(`(document.querySelector('button[aria-label="쏘기"]').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 31 })), true)`)
await wait(300)
await gequip(G, 'sniper')
await wait(500)
const optic40 = []
for (const want of ['4x', '8x', null]) {
  await G.evaluate(`(document.querySelector('button[aria-label="조준"]').click(), true)`)
  await G.until(`(async () => (${GRIG}.optic?.label ?? null) === ${JSON.stringify(want)})()`, 10000)
  optic40.push(await G.evaluate(`(async () => ${GRIG}.optic?.label ?? null)()`))
  if (want === '4x') await G.shot('40-phone-scope')
}
check(JSON.stringify(optic40) === '["4x","8x",null]', `40) 폰 조준 버튼: 4x → 8x → 끄기 (${optic40})`)
await G.evaluate(`(document.querySelector('button[aria-label="무기 바꾸기"]').click(), true)`)
await wait(300)
check((await G.evaluate(`(async () => ${GSESS}.getState().tool)()`)) === 'fists', '40) 무기 바꾸기: 저격총 → 주먹 (한 바퀴)')
await G.send('Emulation.clearDeviceMetricsOverride')
await G.evaluate(`(async () => { (await __mod('/src/game/input/touchDevice.ts')).useTouchUiStore.setState({ touchUi: false }); return true })()`)
G.close()

// 41) PvP 두 사람: A 의 권총이 B 의 몸에 맞으면 B 체력 −20, A 화면의 B 이름표 체력 막대가 줄고, B 화면엔 A 의 궤적. 쓰러뜨리면 모두에게 알림, B 는 침대에서
const RUN34 = Date.now().toString(36)
const A6 = await open(9746, 0, `?room=pvp-${RUN34}`)
await A6.evaluate(`__click('🔒 방 만들기')`)
await A6.evaluate(`__fill('암호', 'secret1') && __fill('닉네임', '에이')`)
await A6.evaluate(`__click('방 만들고 들어가기')`)
check(await A6.until(`document.body.innerText.includes('👥 1명')`, 20000), '41) A 방 만들기')
const B6 = await open(9747, 1, `?room=pvp-${RUN34}`)
await B6.evaluate(`__fill('암호', 'secret1') && __fill('닉네임', '비이')`)
await B6.evaluate(`__click('들어가기')`)
check(await B6.until(`document.body.innerText.includes('👥 2명')`, 20000), '41) B 들어가기')
await A6.evaluate(teleport(150, -5))
await B6.evaluate(teleport(150, 5))
await wait(1500)
await gkey(A6, 'Digit4', '4')
await gkey(A6, 'KeyV', 'v')
await turnTo(A6, 0, 25)
await wait(800)
check(await gfire(A6), '41) A 첫 발')
const ray41 = await A6.evaluate(`(async () => ${GRIG}.lastShot)()`)
// 광선이 B 의 허리(땅 + 1m)를 지나는 곳에 B 를 세운다
const t41 = ray41.d.y < -0.02 ? Math.min(14, Math.max(3, (1.0 - ray41.o.y) / ray41.d.y)) : 6
await B6.evaluate(teleport(ray41.o.x + ray41.d.x * t41, ray41.o.z + ray41.d.z * t41))
await wait(2500)
await B6.evaluate(`(async () => { const fx = (await __mod('/src/game/guns/gunFx.ts')).gunFx; const t = fx.tracer; window.__tracers = 0; fx.tracer = (a, b) => { window.__tracers++; t(a, b) }; return true })()`)
const hp41 = await B6.evaluate(`(async () => ${GPROG}.getState().survival.stamina)()`)
await gfire(A6)
check((await A6.evaluate(`(async () => ${GRIG}.lastShot.hit)()`)) === 'peer', '41) A 의 총알이 B 의 몸(보이지 않는 캡슐)에 맞는다')
// 배가 부르면 초당 0.8 씩 회복하므로(3-1) 바쁜 기계에서 늦게 보면 조금 차 있다: 15 넘게 줄었으면 권총 한 발(20)
check(await B6.until(`(async () => ${GPROG}.getState().survival.stamina < ${hp41 - 15})()`, 8000), `41) B 체력이 권총 피해 20 만큼 준다 (서버가 무기 표로 정한다)`)
check(await B6.until(`window.__tracers > 0`, 3000), '41) B 화면에 A 의 총알 궤적 (shot)')
check(await A6.until(`!!document.querySelector('[aria-label^="체력 "]') && Number(document.querySelector('[aria-label^="체력 "]').getAttribute('aria-label').slice(3)) < 85`, 8000), '41) A 화면에서 B 이름표 아래 체력 막대가 준다')
await A6.shot('41-pvp-A')
await B6.shot('41-pvp-B')
for (let i = 0; i < 6; i++) {
  if (await B6.evaluate(`(async () => (await __mod('/src/game/stores/dayStore.ts')).useDayStore.getState().seq?.kind === 'death')()`)) break
  await wait(250)
  await gfire(A6)
}
check(await B6.until(`(async () => (await __mod('/src/game/stores/dayStore.ts')).useDayStore.getState().seq?.kind === 'death')()`, 5000), '41) B 가 쓰러진다')
check(await A6.until(`document.body.innerText.includes('에이 님이 비이 님을 쓰러뜨렸어요')`, 5000), '41) A 화면에 "에이 님이 비이 님을 쓰러뜨렸어요"')
check(await B6.until(`(async () => (await __mod('/src/game/stores/netStore.ts')).useNetStore.getState().chat.some((l) => l.text === '에이 님이 비이 님을 쓰러뜨렸어요'))()`, 5000), '41) B 채팅 기록에도')
await A6.shot('41-kill')
check(await B6.until(`(async () => { const { playerRig } = await __mod('/src/game/scene/Player.tsx'); return !(await __mod('/src/game/stores/dayStore.ts')).useDayStore.getState().seq && Math.hypot(playerRig.position.x - 197.8, playerRig.position.z + 2.4) < 1.5 })()`, 15000), '41) B 는 침대 옆에서 깨어난다 (체력 100)')
A6.close()
B6.close()

check(!consoleErrors.some((e) => /shader|WebGLProgram/i.test(e)), '셰이더 컴파일 오류가 없다')
if (consoleErrors.length) console.log(`콘솔 오류·경고 ${consoleErrors.length}개:\n${consoleErrors.slice(0, 20).join('\n')}`)

A.close()
console.log(`스크린샷: ${OUT}`)
process.exit(failed ? 1 : 0)
