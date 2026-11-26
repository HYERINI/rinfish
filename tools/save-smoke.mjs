// 로컬 방 서버(npm run server:dev)의 진행 저장 확인: 없음 404 → 저장 → 읽기 → 낡은 번호 409 → 코드 틀림 401 → CORS
// → 쓰기 요청 ID → 큰 본문 413 → 호출 수 제한 429(로컬이 흉내 내면)
// 사용: node tools/save-smoke.mjs [http://127.0.0.1:8787]
import { request as httpRequest } from 'node:http'

const base = (process.argv[2] ?? 'http://127.0.0.1:8787') + '/save'
const ALPHA = '23456789ABCDEFGHJKMNPQRSTVWXYZ'
const code = Array.from({ length: 20 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('')
const origin = 'http://127.0.0.1:5190'
const call = (method, body, auth = `Bearer ${code}`, o = origin) =>
  fetch(base, { method, headers: { Authorization: auth, Origin: o, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) })
const assert = (ok, label) => {
  console.log(ok ? 'OK  ' : 'FAIL', label)
  if (!ok) process.exitCode = 1
}

const none = await call('GET')
assert(none.status === 404, '처음엔 404')
assert(none.headers.get('access-control-allow-origin') === origin, 'CORS 허용 머리말')
const first = await call('PUT', { baseRev: 0, data: { state: { coins: 7 }, version: 5 } })
assert(first.status === 200 && (await first.json()).rev === 1, '첫 저장 → 1번')
const read = await call('GET')
const got = await read.json()
assert(read.status === 200 && got.rev === 1 && got.data.state.coins === 7, '읽기 → 저장한 진행')
const second = await call('PUT', { baseRev: 1, data: { state: { coins: 9 }, version: 5 } })
assert(second.status === 200 && (await second.json()).rev === 2, '이어 저장 → 2번')
const stale = await call('PUT', { baseRev: 1, data: { state: { coins: 1 }, version: 5 } })
const staleBody = await stale.json()
assert(stale.status === 409 && staleBody.rev === 2 && staleBody.data.state.coins === 9, '낡은 번호 → 409 와 최신본')
assert((await call('GET', undefined, 'Bearer nope')).status === 401, '코드 틀림 → 401')
const pre = await fetch(base, { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'authorization,content-type' } })
assert(pre.status === 204 && /PUT/.test(pre.headers.get('access-control-allow-methods') ?? ''), 'OPTIONS 미리 요청')
const evil = await call('GET', undefined, `Bearer ${code}`, 'https://evil.example')
assert(evil.headers.get('access-control-allow-origin') === null, '다른 주소는 CORS 허용 안 함')
const other = await fetch(base.replace('/save', '/nothing'))
assert(other.status === 404, '없는 주소 → 404')

// 쓰기 요청 ID: 저장과 함께 보관되고, 409 본문에도 온다 (응답을 못 받은 브라우저가 제 쓰기인지 알아본다)
const withId = await call('PUT', { baseRev: 2, data: { state: { coins: 11 }, version: 5 }, writeId: 'smoke-1' })
assert(withId.status === 200 && (await withId.json()).rev === 3, '쓰기 요청 ID 와 저장 → 3번')
const again = await call('PUT', { baseRev: 2, data: { state: { coins: 11 }, version: 5 }, writeId: 'smoke-1' })
const againBody = await again.json()
assert(again.status === 409 && againBody.rev === 3 && againBody.writeId === 'smoke-1', '같은 쓰기를 다시 보내면 409 와 그 쓰기 ID')
assert((await call('PUT', { baseRev: 3, data: {}, writeId: 'x'.repeat(65) })).status === 400, '쓰기 ID 가 너무 길면 400')

// 큰 본문: Content-Length 가 한도를 넘으면 413 (CORS 머리말 포함).
// 워커는 본문을 읽기 전에 거절하지만, 로컬 wrangler dev 는 본문을 다 받은 뒤에야 응답을 보내서 "읽기 전" 은 여기서 볼 수 없다
const early = await new Promise((resolve) => {
  const u = new URL(base)
  const req = httpRequest({ host: u.hostname, port: u.port, path: u.pathname, method: 'PUT', headers: { Authorization: `Bearer ${code}`, Origin: origin, 'Content-Type': 'application/json', 'Content-Length': String(1024 * 1024) } }, (res) => {
    resolve({ status: res.statusCode, cors: res.headers['access-control-allow-origin'] })
    res.resume()
  })
  req.on('error', () => resolve({ status: 0 }))
  req.setTimeout(10000, () => {
    resolve({ status: 'timeout' })
    req.destroy()
  })
  req.end(Buffer.alloc(1024 * 1024, 0x20))
})
assert(early.status === 413 && early.cors === origin, `큰 Content-Length → 413 (${early.status})`)
const big = await call('PUT', { baseRev: 3, data: { pad: 'x'.repeat(256 * 1024) } })
assert(big.status === 413, '실제로 큰 본문 → 413')

// 호출 수 제한: 다른 IP 하나로 70번. 로컬(wrangler dev)이 흉내 내지 않으면 건너뛴다
const ip = `10.9.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`
let limited = null
for (let i = 0; i < 70 && !limited; i++) {
  const r = await fetch(base, { headers: { Authorization: `Bearer ${code}`, Origin: origin, 'CF-Connecting-IP': ip } })
  if (r.status === 429) limited = { i, cors: r.headers.get('access-control-allow-origin') }
}
if (limited) assert(limited.i >= 59 && limited.cors === origin, `호출 수 제한 → ${limited.i + 1}번째에 429 (CORS 머리말 있음)`)
else console.log('SKIP 호출 수 제한 (로컬 서버가 흉내 내지 않음)')
