// 그리기 측정 (헤드리스 Chrome): 자리 몇 곳에서 드로우 콜·삼각형·프레임 시간을 재고, 그림자를 끄거나 구역을 숨기면 얼마나 줄어드는지,
// 어떤 물체가 드로우 콜을 많이 쓰는지 순위를 낸다. 결과는 콘솔 표와 JSON 파일, 자리마다 화면 캡처(PNG).
// 준비: npx vite --port 5190 --strictPort --host 127.0.0.1   (개발 모드, 또는 배포 주소 끝에 ?probe)
// 사용: node tools/render-measure.mjs [게임 주소] [결과 JSON] [mobile|desktop]
//   mobile: 390×844 화면·DPR 3·터치(폰 화질 자동 선택), 프레임 시간은 CPU 4배 느리게 해서 잰다
//   GPU 는 이 맥의 것이라 폰보다 빠르다: 숫자는 고치기 전후 비교용. 폰의 실제 FPS 는 폰에서 ?probe 로 확인한다
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import WebSocket from 'ws'

const GAME = process.argv[2] ?? 'http://127.0.0.1:5190'
const OUT = process.argv[3] ?? join(tmpdir(), 'render-measure.json')
const MODE = process.argv[4] ?? 'mobile'
const CPU_SLOWDOWN = MODE === 'mobile' ? 4 : 1
const CHROME = process.env.CHROME ?? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p))
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

/** 잴 자리 [이름, x, z]. 처음 서는 자리는 초원 START_SPOT (160, -12) */
const SPOTS = [
  ['초원 시작 자리', 160, -12],
  ['초원 한가운데', 140, 20],
  ['초원 서쪽 물가', 95.5, -3],
  ['섬 가운데', 0, 12],
  ['섬 동쪽 끝', 24, 0],
]

const PORT = 9300 + Math.floor(Math.random() * 600)
const proc = spawn(
  CHROME,
  ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'rmeasure-'))}`, '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal', '--window-size=1000,800', '--no-first-run', 'about:blank'],
  { stdio: 'ignore' },
)
let target
for (let i = 0; i < 200 && !target; i++) {
  await wait(200)
  target = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json()).then((l) => l.find((t) => t.type === 'page')).catch(() => undefined)
}
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((r) => ws.once('open', r))
let seq = 0
const pending = new Map()
const errors = []
ws.on('message', (raw) => {
  const m = JSON.parse(raw)
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m)
    pending.delete(m.id)
  }
  if (m.method === 'Runtime.exceptionThrown') errors.push((m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text).slice(0, 200))
})
const send = (method, params = {}) =>
  new Promise((resolve) => {
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

await send('Page.enable')
await send('Runtime.enable')
if (MODE === 'mobile') {
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true })
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
  await send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' })
}
// 받은 파일 기록이 기본 250개에서 차지 않게
await send('Page.addScriptToEvaluateOnNewDocument', { source: 'performance.setResourceTimingBufferSize(10000)' })

const probeUrl = GAME.includes('?') ? `${GAME}&probe` : `${GAME}?probe`
await send('Page.navigate', { url: probeUrl })
await until(`document.readyState === 'complete'`)
await evaluate(`(async () => {
  const { LOOK_PRESETS } = await import('/src/game/data/characterParts.ts')
  localStorage.setItem('fishing-island-save-v1', JSON.stringify({ state: { look: LOOK_PRESETS[0].look }, version: 5 }))
  localStorage.removeItem('fishing-island-place-v1')
  return true
})()`)
await send('Page.navigate', { url: probeUrl })
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
const glbAtStart = await evaluate(`performance.getEntriesByType('resource').filter((e) => e.name.endsWith('.glb')).length`)
await evaluate(`__click('혼자 하기')`)
await until(`!!window.__three && !!window.__render && window.__render.calls > 0`, 60000)
await wait(3000)

const gpu = await evaluate(`(() => {
  const gl = window.__three.gl.getContext()
  const ext = gl.getExtension('WEBGL_debug_renderer_info')
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
})()`)
const env = await evaluate(`JSON.stringify({ w: innerWidth, h: innerHeight, dpr: devicePixelRatio, pixelRatio: window.__three.gl.getPixelRatio(), coarse: matchMedia('(pointer: coarse)').matches, shadows: window.__three.gl.shadowMap.enabled })`)

// 장면 들여다보기 도우미 (페이지 안). three 를 불러오지 않고 행렬로 시야(절두체) 안인지 판정한다
await evaluate(`
window.__m = (() => {
  const T = () => window.__three
  /** 4×4 행렬(열 우선 elements)에서 시야 평면 6개 */
  function planes(e) {
    const p = [
      [e[3] - e[0], e[7] - e[4], e[11] - e[8], e[15] - e[12]],
      [e[3] + e[0], e[7] + e[4], e[11] + e[8], e[15] + e[12]],
      [e[3] + e[1], e[7] + e[5], e[11] + e[9], e[15] + e[13]],
      [e[3] - e[1], e[7] - e[5], e[11] - e[9], e[15] - e[13]],
      [e[3] - e[2], e[7] - e[6], e[11] - e[10], e[15] - e[14]],
      [e[3] + e[2], e[7] + e[6], e[11] + e[10], e[15] + e[14]],
    ]
    return p.map(([a, b, c, d]) => { const l = Math.hypot(a, b, c); return [a / l, b / l, c / l, d / l] })
  }
  function mul(a, b) {
    const o = new Array(16).fill(0)
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]
    return o
  }
  function sphere(o) {
    let s
    if (o.isInstancedMesh || o.isBatchedMesh) { if (!o.boundingSphere) o.computeBoundingSphere(); s = o.boundingSphere }
    else { const g = o.geometry; if (!g) return null; if (!g.boundingSphere) g.computeBoundingSphere(); s = g.boundingSphere }
    if (!s) return null
    const e = o.matrixWorld.elements
    const c = s.center
    const x = e[0] * c.x + e[4] * c.y + e[8] * c.z + e[12]
    const y = e[1] * c.x + e[5] * c.y + e[9] * c.z + e[13]
    const z = e[2] * c.x + e[6] * c.y + e[10] * c.z + e[14]
    const sc = Math.max(Math.hypot(e[0], e[1], e[2]), Math.hypot(e[4], e[5], e[6]), Math.hypot(e[8], e[9], e[10]))
    return { x, y, z, r: s.radius * sc }
  }
  const inside = (pl, s) => pl.every(([a, b, c, d]) => a * s.x + b * s.y + c * s.z + d >= -s.r)
  const drawable = (o) => o.isMesh || o.isLine || o.isPoints || o.isSprite
  const shown = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true }
  const groupsOf = (o) => (Array.isArray(o.material) ? Math.max(1, o.geometry?.groups?.length || o.material.length) : 1)
  const region = (s) => (s.y < -12 ? '광산' : s.x < 45 ? '섬' : s.x < 86 ? '바다' : '초원')
  function label(o) {
    const names = []
    for (let p = o; p && p !== T().scene && names.length < 2; p = p.parent) if (p.name) names.push(p.name)
    const kind = o.isInstancedMesh ? '묶음' : o.isSkinnedMesh ? '뼈대' : o.isMesh ? '메시' : o.type
    // 이름 없는 물체(코드로 만든 상자·판 등)는 모양과 색으로 구분한다
    const anon = () => '(이름 없음 ' + (o.geometry?.type ?? '?').replace('Geometry', '') + ' #' + (o.material?.color?.getHexString?.() ?? '-') + ')'
    return (names.reverse().join('/') || anon()) + ' [' + kind + ']'
  }
  /** 이번 시점의 드로우 콜 추정: 본 그리기 + 그림자 그리기, 구역·이름별 */
  function breakdown() {
    const { scene, camera } = T()
    camera.updateMatrixWorld()
    const main = planes(mul(camera.projectionMatrix.elements, camera.matrixWorldInverse.elements))
    const shadowCams = []
    scene.traverse((o) => {
      if (o.isLight && o.castShadow && o.shadow?.camera && shown(o)) {
        const c = o.shadow.camera
        c.updateMatrixWorld()
        const faces = o.isPointLight ? 6 : 1
        shadowCams.push({ pl: planes(mul(c.projectionMatrix.elements, c.matrixWorldInverse.elements)), faces, type: o.type })
      }
    })
    const rows = new Map()
    const regions = {}
    let mainCalls = 0, shadowCalls = 0, objects = 0, casters = 0, instanced = 0
    scene.traverse((o) => {
      if (!drawable(o) || !shown(o)) return
      const s = sphere(o)
      if (!s) return
      const g = groupsOf(o)
      const inMain = o.frustumCulled === false || inside(main, s)
      let sh = 0
      if (o.castShadow) for (const c of shadowCams) if (o.frustumCulled === false || inside(c.pl, s)) sh += g * c.faces
      if (!inMain && !sh) return
      const m = inMain ? g : 0
      mainCalls += m; shadowCalls += sh; objects++
      if (o.castShadow) casters++
      if (o.isInstancedMesh) instanced++
      const rg = region(s)
      const R = (regions[rg] ??= { main: 0, shadow: 0 })
      R.main += m; R.shadow += sh
      const key = rg + ' · ' + label(o)
      const row = rows.get(key) ?? { key, n: 0, main: 0, shadow: 0 }
      row.n++; row.main += m; row.shadow += sh
      rows.set(key, row)
    })
    const top = [...rows.values()].sort((a, b) => b.main + b.shadow - (a.main + a.shadow)).slice(0, 15)
    return { mainCalls, shadowCalls, objects, casters, instanced, shadowLights: shadowCams.map((c) => c.type), regions, top }
  }
  /** 구역(섬·초원·광산)의 그릴 물체를 숨기거나 되돌린다 */
  const hidden = []
  function hideRegion(name) {
    T().scene.traverse((o) => {
      if (!drawable(o) || !o.visible) return
      const s = sphere(o)
      if (s && region(s) === name) { o.visible = false; hidden.push(o) }
    })
    return hidden.length
  }
  function restore() { for (const o of hidden.splice(0)) o.visible = true }
  const lightsOff = []
  function shadowsOff() { T().scene.traverse((o) => { if (o.isLight && o.castShadow) { o.castShadow = false; lightsOff.push(o) } }); return lightsOff.length }
  function shadowsOn() { for (const l of lightsOff.splice(0)) l.castShadow = true }
  /**
   * ms 동안 프레임 간격(FPS)과 그리기 한 번(gl.render)에 CPU 가 쓴 시간을 모은다.
   * 화면 주사율(60)에 막혀 FPS 가 같아도, 그리기 CPU 시간은 드로우 콜이 줄면 준다
   */
  function frames(ms) {
    const gl = T().gl
    const orig = gl.render
    const cost = []
    gl.render = function (...a) { const t = performance.now(); const r = orig.apply(this, a); cost.push(performance.now() - t); return r }
    return new Promise((resolve) => {
      const d = []
      let last = performance.now()
      const end = last + ms
      const tick = (t) => {
        d.push(t - last); last = t
        if (t < end) requestAnimationFrame(tick)
        else {
          d.sort((a, b) => a - b)
          const avg = d.reduce((a, b) => a + b, 0) / d.length
          gl.render = orig
          cost.sort((a, b) => a - b)
          const q = (arr, f) => +(arr[Math.floor(arr.length * f)] ?? 0).toFixed(2)
          resolve({ fps: Math.round(1000 / avg), p50: q(d, 0.5), p95: q(d, 0.95), renderMs: q(cost, 0.5), renderP95: q(cost, 0.95) })
        }
      }
      requestAnimationFrame((t) => { last = t; requestAnimationFrame(tick) })
    })
  }
  return { breakdown, hideRegion, restore, shadowsOff, shadowsOn, frames }
})();
true`)

/** 여러 프레임의 __render 가운데값 */
const calls = async () => {
  const rows = []
  for (let i = 0; i < 9; i++) {
    await wait(120)
    rows.push(JSON.parse(await evaluate('JSON.stringify(window.__render)')))
  }
  rows.sort((a, b) => a.calls - b.calls)
  return rows[4]
}
const frames = async () => {
  await send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN })
  await wait(500)
  const f = await evaluate(`__m.frames(3000)`)
  await send('Emulation.setCPUThrottlingRate', { rate: 1 })
  return f
}
const teleport = (x, z) => evaluate(`(async () => { const { useSessionStore } = await __mod('/src/game/stores/sessionStore.ts'); useSessionStore.getState().requestTeleport([${x}, ${z}]); return true })()`)

/** 자리마다 화면 캡처 (그림자를 고치기 전후 눈으로 비교): 결과 JSON 옆에 이름-번호.png */
const shot = async (i) => {
  const data = (await send('Page.captureScreenshot', { format: 'png' })).result?.data ?? ''
  const file = OUT.replace(/\.json$/, '') + `-${i + 1}.png`
  writeFileSync(file, Buffer.from(data, 'base64'))
  return file
}

const results = []
for (const [i, [name, x, z]] of SPOTS.entries()) {
  await teleport(x, z)
  await wait(6000)
  const r = { name, base: await calls(), frames: await frames(), est: JSON.parse(await evaluate('JSON.stringify(__m.breakdown())')), shot: await shot(i) }
  await evaluate('__m.shadowsOff()')
  await wait(400)
  r.noShadow = { ...(await calls()), frames: await frames() }
  await evaluate('__m.shadowsOn()')
  for (const zone of ['초원', '섬']) {
    await evaluate(`__m.hideRegion('${zone}')`)
    await wait(400)
    r[`hide${zone}`] = { ...(await calls()), frames: await frames() }
    await evaluate('__m.restore()')
  }
  await wait(400)
  results.push(r)
  console.log(`\n■ ${name}`)
  const line = (label, c, f) => console.log(`  ${label.padEnd(8)} ${String(c.calls).padStart(4)} 콜 · 그리기 CPU ${f.renderMs}ms (느린 5% ${f.renderP95}) · FPS ${f.fps}`)
  console.log(`  삼각형 ${r.base.triangles.toLocaleString()}`)
  line('지금', r.base, r.frames)
  line('그림자 끔', r.noShadow, r.noShadow.frames)
  line('초원 숨김', r.hide초원, r.hide초원.frames)
  line('섬 숨김', r.hide섬, r.hide섬.frames)
  console.log(`  추정: 본 그리기 ${r.est.mainCalls} + 그림자 ${r.est.shadowCalls} (물체 ${r.est.objects}, 그림자 만드는 것 ${r.est.casters}, 묶음 ${r.est.instanced})`)
  console.log(`  구역별: ${Object.entries(r.est.regions).map(([k, v]) => `${k} ${v.main}+${v.shadow}`).join(' · ')}`)
  for (const t of r.est.top.slice(0, 8)) console.log(`    ${String(t.main + t.shadow).padStart(4)}  ${t.key} ×${t.n}`)
}
const glbAfter = await evaluate(`performance.getEntriesByType('resource').filter((e) => e.name.endsWith('.glb')).length`)
const summary = { note: 'FPS 는 화면 주사율(60)에 막힌다. 비교는 드로우 콜과 그리기 CPU 시간(renderMs)으로', at: new Date().toISOString(), game: GAME, mode: MODE, cpuSlowdown: CPU_SLOWDOWN, gpu, env: JSON.parse(env), glbAtStart, glbAfter, results, errors }
writeFileSync(OUT, JSON.stringify(summary, null, 2))
console.log(`\nGPU: ${gpu}\n환경: ${env}\n처음 받은 모델 ${glbAtStart}개 → 다 돌고 ${glbAfter}개 · 오류 ${errors.length}\n결과: ${OUT}`)
ws.close()
proc.kill()
process.exit(0)
