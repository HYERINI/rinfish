// 로컬 방 서버(npm run server:dev)의 진행 저장 확인: 없음 404 → 저장 → 읽기 → 낡은 번호 409 → 코드 틀림 401 → CORS
// 사용: node tools/save-smoke.mjs [http://127.0.0.1:8787]
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
