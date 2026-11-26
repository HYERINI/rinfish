# 진행 서버 저장 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 섬마을 진행(`progressStore`)을 복구 코드별 Cloudflare Durable Object(`Save`)에 저장해, 브라우저를 지우거나 기기·주소가 바뀌어도 복구 코드로 되찾게 한다.

**Architecture:** 방 서버 워커(`rinfish-rooms`)에 `/save` 주소와 `Save` 객체를 더한다. 브라우저는 지금처럼 localStorage 사본으로 바로 돌고, `cloudSave` 모듈이 사본이 바뀔 때마다 모아서 서버에 올린다. 충돌은 저장 번호(`rev`)로 판정하고 서버가 최신이면 서버 것을 받는다.

**Tech Stack:** React 19, zustand 5 (persist), Cloudflare Workers + Durable Objects (SQLite), vitest 5, TypeScript 6.

**Spec:** `docs/superpowers/specs/2026-11-26-server-save-design.md`

## Global Constraints

- 복구 코드 글자 `23456789ABCDEFGHJKMNPQRSTVWXYZ` (30자), 길이 **20**, 보일 때 4자씩 `-` 로 끊는다.
- 코드는 `Authorization: Bearer <코드>` 머리말로만 보낸다. URL 에 넣지 않는다. 서버는 `sha256(코드)` 만 쓰고 원문을 저장하지 않는다.
- 진행 크기 한도 **256KB** (`SAVE_MAX_BYTES = 256 * 1024`).
- 올리기: 마지막 변경 뒤 **3초** 조용하면, 계속 바뀌어도 **15초**에 한 번. 실패 재시도 **5초 → 15초 → 30초**. 시작할 때 서버 대기 **3초**, 시작 실패 재시도 **30초**.
- 브라우저 키: `seommaeul-cloud-v1` = `{ code, syncedRev, dirty }`. 진행 사본 키 `fishing-island-save-v1` 는 그대로.
- `VITE_ROOM_SERVER` 가 없으면 서버 저장 전체가 꺼지고(`off`) 화면도 숨긴다.
- CORS 허용: `https://seommaeul.vercel.app`, `https://seommaeul-<무엇>.vercel.app`(미리보기), `http://localhost:<포트>`, `http://127.0.0.1:<포트>`.
- 서버(`server/`)가 import 하는 `src/` 파일은 three·vendor 를 import 하면 안 된다.
- 화면 글은 한국어. 코드 주석은 주변 코드처럼 한국어로 짧게.
- 커밋: `feat:`/`fix:`/`docs:`/`test:` 만, 괄호 스코프 금지, Co-Authored-By·AI 표기 금지, 제목 짧게·상세는 body.
- 식별(누구인지)은 브라우저 `authHeader()` 하나, 워커 `saveObjectName()` 하나에만 둔다 (허브 로그인 전환 때 갈아끼울 곳).

## Review Focus

1. **플레이 중 `서버 것 받기` 직후 persist 가 다시 저장** → 그 저장이 "안 올린 변경" 으로 잡혀 같은 내용을 또 올리면 안 된다. (Task 5 `adopt 중 저장은 dirty 로 안 잡힌다`)
2. **올리는 도중 새 변경** → 응답이 성공이어도 그사이 바뀐 것은 여전히 "안 올린 변경" 이어야 한다. (Task 5 `올리는 중 바뀌면 성공 뒤에도 dirty`)
3. **오프라인으로 하다가 새로고침** → "안 올린 변경" 이 저장소에 남아 다음 시작 때 올라가야 한다. (Task 5 `dirty 는 새로고침 뒤에도 남는다`)
4. **서버에 저장이 없는데 브라우저는 맞춘 번호 5** (서버 초기화·코드 바뀜) → 서버가 받아 줘야 한다. (Task 2 `저장이 없으면 baseRev 와 상관없이 받는다`)
5. **복구 코드 입력에 소문자·공백·하이픈·다른 글자(O, 0)** → 정리해서 받고, 헷갈리는 글자는 거절. (Task 1 테스트)

---

## 파일 구조

| 파일 | 할 일 |
|---|---|
| `src/game/logic/recoveryCode.ts` (새) | 복구 코드 만들기·정리·보이기. 서버도 import |
| `server/src/saveRules.ts` (새) | 순수 규칙: 요청 → 응답·저장할 것, CORS 허용, Bearer 코드 읽기 |
| `server/src/save.ts` (새) | `Save` Durable Object (저장소 읽고 쓰기만) |
| `server/src/index.ts` | `/save` 길 더하기, CORS 머리말, 객체 이름 |
| `server/src/room.ts` | `Env` 에 `SAVE` 더하기 |
| `server/wrangler.toml` | `SAVE` 바인딩·마이그레이션 v2 |
| `src/game/logic/cloudSync.ts` (새) | 순수 판단: 저장 주소, 시작할 때 할 일, 올릴 때까지 기다릴 시간, 재시도 간격, 진행 요약 |
| `src/game/net/cloudSave.ts` (새) | 서버와 주고받는 본체 (`createCloudSave`, 의존성 주입) |
| `src/game/stores/cloudStore.ts` (새) | 화면용 상태: `status`, `ready`, `code` |
| `src/game/net/cloudBoot.ts` (새) | 실제 의존성으로 만들고 시작, 탭 숨김 처리, `cloud` 내보내기 |
| `src/game/stores/progressStore.ts` | 사본 저장 때 알림(`onProgressSaved`) |
| `src/App.tsx` | `startCloud()` 호출 |
| `src/game/ui/LoadingScreen.tsx` | `ready` 까지 닫지 않기 |
| `src/game/ui/CloudBadge.tsx` (새) | 화면 구석 `☁️ 저장됨` |
| `src/game/ui/CloudRestore.tsx` (새) | 코드 보기·복사·코드로 이어 하기 |
| `src/game/ui/MenuPanel.tsx`, `Lobby.tsx`, `CharacterCreator.tsx`, `src/game/Game.tsx` | 화면 연결 |
| `tools/save-smoke.mjs` (새) | 로컬 서버 통합 확인 |
| `tools/cloud-check.mjs` (새) | 헤드리스 브라우저 확인 |
| `README.md` | 서버 저장·복구 코드·허브 전환 예정 |

---

### Task 1: 복구 코드

**Files:**
- Create: `src/game/logic/recoveryCode.ts`
- Test: `src/game/logic/recoveryCode.test.ts`

**Interfaces:**
- Produces: `CODE_ALPHABET: string`, `CODE_LENGTH = 20`, `makeCode(random?: (n: number) => Uint8Array): string`, `normalizeCode(input: string): string | null`, `formatCode(code: string): string`

- [ ] **Step 1: 실패하는 테스트**

```ts
import { describe, expect, it } from 'vitest'
import { CODE_ALPHABET, CODE_LENGTH, formatCode, makeCode, normalizeCode } from './recoveryCode'

describe('makeCode', () => {
  it('정한 글자로 20자를 만든다', () => {
    const code = makeCode()
    expect(code).toHaveLength(CODE_LENGTH)
    expect([...code].every((c) => CODE_ALPHABET.includes(c))).toBe(true)
  })

  it('240 이상 바이트는 버려 글자가 고르게 나온다', () => {
    const batches = [new Uint8Array(20).fill(250), Uint8Array.from({ length: 20 }, (_, i) => i)]
    let call = 0
    expect(makeCode(() => batches[call++])).toBe(CODE_ALPHABET.slice(0, 20))
  })

  it('두 번 만들면 다르다', () => {
    expect(makeCode()).not.toBe(makeCode())
  })
})

describe('normalizeCode', () => {
  const code = 'QX7K29PMH4TB8WNC5RDA'
  it('소문자·하이픈·공백을 정리한다', () => {
    expect(normalizeCode(' qx7k-29pm-h4tb 8wnc-5rda ')).toBe(code)
  })
  it('헷갈리는 글자(O, 0, 1, I, L, U)가 있으면 거절한다', () => {
    expect(normalizeCode('QX7K29PMH4TB8WNC5RD0')).toBeNull()
    expect(normalizeCode('QX7K29PMH4TB8WNC5RDO')).toBeNull()
    expect(normalizeCode('QX7K29PMH4TB8WNC5RDU')).toBeNull()
  })
  it('길이가 틀리면 거절한다', () => {
    expect(normalizeCode(code.slice(1))).toBeNull()
    expect(normalizeCode(code + 'A')).toBeNull()
    expect(normalizeCode('')).toBeNull()
  })
})

describe('formatCode', () => {
  it('4자씩 끊는다', () => {
    expect(formatCode('QX7K29PMH4TB8WNC5RDA')).toBe('QX7K-29PM-H4TB-8WNC-5RDA')
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/game/logic/recoveryCode.test.ts`
Expected: FAIL — `Failed to resolve import "./recoveryCode"`

- [ ] **Step 3: 구현**

```ts
/**
 * 복구 코드: 서버에 저장된 내 진행을 찾는 열쇠 (비밀번호와 같다).
 * 헷갈리는 0·O·1·I·L·U 를 뺀 30글자로 20자 (약 98비트). 서버(server/src)도 이 파일을 import 한다 — three 를 import 하지 말 것.
 * 허브 로그인이 생기면 로그인으로 바꾼다 (docs/superpowers/specs/2026-11-26-server-save-design.md "허브 로그인 전환")
 */
export const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ'
export const CODE_LENGTH = 20
/** 256 을 30 으로 나눈 나머지가 고르지 않으니 30×8 = 240 이상은 버린다 */
const BYTE_LIMIT = CODE_ALPHABET.length * 8

const secureRandom = (n: number) => crypto.getRandomValues(new Uint8Array(n))

export function makeCode(random: (n: number) => Uint8Array = secureRandom): string {
  let out = ''
  while (out.length < CODE_LENGTH) {
    for (const b of random(CODE_LENGTH)) {
      if (b < BYTE_LIMIT && out.length < CODE_LENGTH) out += CODE_ALPHABET[b % CODE_ALPHABET.length]
    }
  }
  return out
}

/** 입력을 대문자로 바꾸고 하이픈·공백을 지운다. 글자·길이가 틀리면 null */
export function normalizeCode(input: string): string | null {
  const s = input.toUpperCase().replace(/[\s-]/g, '')
  return s.length === CODE_LENGTH && [...s].every((c) => CODE_ALPHABET.includes(c)) ? s : null
}

export function formatCode(code: string): string {
  return code.match(/.{1,4}/g)?.join('-') ?? code
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/game/logic/recoveryCode.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/game/logic/recoveryCode.ts src/game/logic/recoveryCode.test.ts
git commit -m "feat: 복구 코드 만들기·정리" -m "30글자 20자 코드. 서버 저장 식별에 쓰고 서버도 같은 검사를 import 한다."
```

---

### Task 2: 서버 저장 규칙 (순수 함수)

**Files:**
- Create: `server/src/saveRules.ts`
- Test: `server/src/saveRules.test.ts`

**Interfaces:**
- Consumes: `normalizeCode` (Task 1)
- Produces:
  - `type StoredSave = { rev: number; data: Record<string, unknown>; savedAt: number }`
  - `SAVE_MAX_BYTES = 262144`
  - `type SaveReply = { status: number; body: unknown; store?: StoredSave }`
  - `handleSave(method: string, text: string, stored: StoredSave | null, now: number): SaveReply`
  - `allowOrigin(origin: string | null): string | null`
  - `bearerCode(header: string | null): string | null`

- [ ] **Step 1: 실패하는 테스트**

```ts
import { describe, expect, it } from 'vitest'
import { SAVE_MAX_BYTES, allowOrigin, bearerCode, handleSave, type StoredSave } from './saveRules'

const saved: StoredSave = { rev: 3, data: { state: { coins: 10 }, version: 5 }, savedAt: 100 }
const put = (baseRev: number, data: unknown = { state: { coins: 20 }, version: 5 }) => JSON.stringify({ baseRev, data })

describe('handleSave GET', () => {
  it('없으면 404', () => {
    expect(handleSave('GET', '', null, 0)).toEqual({ status: 404, body: {} })
  })
  it('있으면 200 과 저장본', () => {
    expect(handleSave('GET', '', saved, 0)).toEqual({ status: 200, body: saved })
  })
})

describe('handleSave PUT', () => {
  it('맞춘 번호가 같으면 저장하고 번호를 올린다', () => {
    const r = handleSave('PUT', put(3), saved, 500)
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ rev: 4 })
    expect(r.store).toEqual({ rev: 4, data: { state: { coins: 20 }, version: 5 }, savedAt: 500 })
  })
  it('맞춘 번호가 다르면 409 와 서버 최신본, 저장하지 않는다', () => {
    const r = handleSave('PUT', put(2), saved, 500)
    expect(r).toEqual({ status: 409, body: saved })
  })
  it('첫 저장은 baseRev 0 으로 번호 1', () => {
    expect(handleSave('PUT', put(0), null, 7).store).toEqual({ rev: 1, data: { state: { coins: 20 }, version: 5 }, savedAt: 7 })
  })
  it('저장이 없으면 baseRev 와 상관없이 받는다 (서버가 비었으면 무엇이든 더 최신)', () => {
    const r = handleSave('PUT', put(5), null, 7)
    expect(r.status).toBe(200)
    expect(r.store?.rev).toBe(1)
  })
  it('너무 크면 413', () => {
    const big = put(3, { pad: 'x'.repeat(SAVE_MAX_BYTES) })
    expect(handleSave('PUT', big, saved, 0).status).toBe(413)
  })
  it('한글은 바이트로 센다', () => {
    const big = put(3, { pad: '가'.repeat(Math.ceil(SAVE_MAX_BYTES / 3)) })
    expect(handleSave('PUT', big, saved, 0).status).toBe(413)
  })
  it('JSON 이 아니거나 모양이 틀리면 400', () => {
    expect(handleSave('PUT', '{망가짐', saved, 0).status).toBe(400)
    expect(handleSave('PUT', JSON.stringify({ baseRev: 'a', data: {} }), saved, 0).status).toBe(400)
    expect(handleSave('PUT', JSON.stringify({ baseRev: 1, data: [1] }), saved, 0).status).toBe(400)
    expect(handleSave('PUT', JSON.stringify({ baseRev: -1, data: {} }), saved, 0).status).toBe(400)
    expect(handleSave('PUT', JSON.stringify({ baseRev: 1.5, data: {} }), saved, 0).status).toBe(400)
  })
})

describe('handleSave 그 밖', () => {
  it('다른 메서드는 405', () => {
    expect(handleSave('DELETE', '', saved, 0).status).toBe(405)
  })
})

describe('allowOrigin', () => {
  it('게임 주소·미리보기·로컬만', () => {
    expect(allowOrigin('https://seommaeul.vercel.app')).toBe('https://seommaeul.vercel.app')
    expect(allowOrigin('https://seommaeul-git-feat-x-hyerini.vercel.app')).toBe('https://seommaeul-git-feat-x-hyerini.vercel.app')
    expect(allowOrigin('http://localhost:5173')).toBe('http://localhost:5173')
    expect(allowOrigin('http://127.0.0.1:5190')).toBe('http://127.0.0.1:5190')
    expect(allowOrigin('https://evil.example')).toBeNull()
    expect(allowOrigin('https://seommaeul.vercel.app.evil.example')).toBeNull()
    expect(allowOrigin('http://seommaeul.vercel.app')).toBeNull()
    expect(allowOrigin(null)).toBeNull()
  })
})

describe('bearerCode', () => {
  it('Bearer 뒤 코드를 정리해 돌려준다', () => {
    expect(bearerCode('Bearer qx7k-29pm-h4tb-8wnc-5rda')).toBe('QX7K29PMH4TB8WNC5RDA')
  })
  it('없거나 틀리면 null', () => {
    expect(bearerCode(null)).toBeNull()
    expect(bearerCode('Basic QX7K29PMH4TB8WNC5RDA')).toBeNull()
    expect(bearerCode('Bearer short')).toBeNull()
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run server/src/saveRules.test.ts`
Expected: FAIL — `Failed to resolve import "./saveRules"`

- [ ] **Step 3: 구현**

```ts
import { normalizeCode } from '../../src/game/logic/recoveryCode'

/** Save 객체 저장소의 'save' 칸 */
export type StoredSave = { rev: number; data: Record<string, unknown>; savedAt: number }
/** 진행 크기 한도 (바이트). 지금 저장본은 몇 KB */
export const SAVE_MAX_BYTES = 256 * 1024
/** 응답 상태·본문, 그리고 저장해야 하면 store */
export type SaveReply = { status: number; body: unknown; store?: StoredSave }

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function parsePut(text: string): { baseRev: number; data: Record<string, unknown> } | null {
  let v: unknown
  try {
    v = JSON.parse(text)
  } catch {
    return null
  }
  if (!isRecord(v) || !Number.isInteger(v.baseRev) || (v.baseRev as number) < 0 || !isRecord(v.data)) return null
  return { baseRev: v.baseRev as number, data: v.data }
}

/**
 * 저장 요청 하나를 판정한다. GET: 저장본. PUT {baseRev, data}: baseRev 가 서버 번호와 같으면(저장이 없으면 무엇이든) 저장하고 번호 +1,
 * 다르면 그사이 다른 곳에서 저장한 것이라 409 와 서버 최신본. 1단계는 data 내용을 검사하지 않는다 (게임이 불러올 때 검증)
 */
export function handleSave(method: string, text: string, stored: StoredSave | null, now: number): SaveReply {
  if (method === 'GET') return stored ? { status: 200, body: stored } : { status: 404, body: {} }
  if (method !== 'PUT') return { status: 405, body: {} }
  if (new TextEncoder().encode(text).length > SAVE_MAX_BYTES) return { status: 413, body: {} }
  const req = parsePut(text)
  if (!req) return { status: 400, body: {} }
  if (stored && req.baseRev !== stored.rev) return { status: 409, body: stored }
  const next: StoredSave = { rev: (stored?.rev ?? 0) + 1, data: req.data, savedAt: now }
  return { status: 200, body: { rev: next.rev }, store: next }
}

const PREVIEW = /^https:\/\/seommaeul(-[a-z0-9-]+)?\.vercel\.app$/
const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/

/** 저장 요청을 받아 줄 게임 주소 (CORS). 아니면 null */
export function allowOrigin(origin: string | null): string | null {
  return origin && (PREVIEW.test(origin) || LOCAL.test(origin)) ? origin : null
}

/** Authorization: Bearer <복구 코드> 에서 코드를 꺼낸다. 허브 로그인 전환 때 이 자리를 토큰 검증으로 바꾼다 */
export function bearerCode(header: string | null): string | null {
  const m = header?.match(/^Bearer (.+)$/)
  return m ? normalizeCode(m[1]) : null
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run server/src/saveRules.test.ts`
Expected: PASS (13 tests)

- [ ] **Step 5: Commit**

```bash
git add server/src/saveRules.ts server/src/saveRules.test.ts
git commit -m "feat: 서버 저장 규칙" -m "저장 번호로 충돌 판정, 256KB 한도, CORS 허용 주소, Bearer 복구 코드 읽기."
```

---

### Task 3: Save 객체·워커 길·로컬 통합 확인

**Files:**
- Create: `server/src/save.ts`, `tools/save-smoke.mjs`
- Modify: `server/src/index.ts`, `server/src/room.ts:14`, `server/wrangler.toml`

**Interfaces:**
- Consumes: `handleSave`, `allowOrigin`, `bearerCode`, `StoredSave` (Task 2)
- Produces: HTTP `GET|PUT|OPTIONS <서버>/save` (머리말 `Authorization: Bearer <코드>`), 응답 JSON 은 Task 2 `SaveReply.body`. CORS 머리말 `Access-Control-Allow-Origin`, `Vary: Origin`.

- [ ] **Step 1: 실패하는 통합 확인 스크립트**

`tools/save-smoke.mjs`:

```js
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
```

- [ ] **Step 2: 실패 확인**

Run (터미널 1): `npm run server:dev`
Run (터미널 2): `node tools/save-smoke.mjs`
Expected: `FAIL 처음엔 404` 등 (지금 `/save` 는 404 만 돌려주고 CORS 머리말이 없다)

- [ ] **Step 3: `Save` 객체**

`server/src/save.ts`:

```ts
import { DurableObject } from 'cloudflare:workers'
import type { Env } from './room'
import { handleSave, type StoredSave } from './saveRules'

/**
 * 복구 코드 하나의 진행 저장 (객체 이름 = 코드의 sha256). 요청을 하나씩 차례로 처리하므로 저장 번호 판정이 섞이지 않는다.
 * 규칙은 saveRules.handleSave 에 있고 여기서는 저장소를 읽고 쓰기만 한다
 */
export class Save extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const text = request.method === 'PUT' ? await request.text() : ''
    const stored = (await this.ctx.storage.get<StoredSave>('save')) ?? null
    const reply = handleSave(request.method, text, stored, Date.now())
    if (reply.store) await this.ctx.storage.put('save', reply.store)
    return Response.json(reply.body, { status: reply.status })
  }
}
```

`room.ts` 와 같이 `DurableObject` 는 `cloudflare:workers` 에서 import 한다. `Env` 를 바꾼다 (`server/src/room.ts:14`):

```ts
import type { Save } from './save'
export type Env = { ROOM: DurableObjectNamespace<Room>; SAVE: DurableObjectNamespace<Save> }
```

- [ ] **Step 4: 워커 길**

`server/src/index.ts` 전체:

```ts
import type { Env } from './room'
import { allowOrigin, bearerCode } from './saveRules'

export { Room } from './room'
export { Save } from './save'

/** 복구 코드 → Save 객체 이름. 코드 원문은 남기지 않는다. 허브 로그인 전환 때 이 함수를 허브 유저 ID 로 바꾼다 */
async function saveObjectName(code: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code))
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function withCors(res: Response, origin: string | null): Response {
  const out = new Response(res.body, res)
  out.headers.set('Vary', 'Origin')
  if (origin) {
    out.headers.set('Access-Control-Allow-Origin', origin)
    out.headers.set('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS')
    out.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type')
    out.headers.set('Access-Control-Max-Age', '86400')
  }
  return out
}

/** /save: 진행 저장 (복구 코드별 Save 객체) */
async function save(request: Request, env: Env): Promise<Response> {
  const origin = allowOrigin(request.headers.get('Origin'))
  if (request.method === 'OPTIONS') return withCors(new Response(null, { status: 204 }), origin)
  const code = bearerCode(request.headers.get('Authorization'))
  if (!code) return withCors(Response.json({}, { status: 401 }), origin)
  const stub = env.SAVE.get(env.SAVE.idFromName(await saveObjectName(code)))
  return withCors(await stub.fetch(request), origin)
}

/** /rooms/<방 id 32자> 는 그 방(Durable Object)으로, /save 는 진행 저장으로 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname
    if (path === '/save') return save(request, env)
    const match = path.match(/^\/rooms\/([0-9a-f]{32})$/)
    if (!match) return new Response('not found', { status: 404 })
    return env.ROOM.get(env.ROOM.idFromName(match[1])).fetch(request)
  },
} satisfies ExportedHandler<Env>
```

`server/wrangler.toml` 끝에 더한다:

```toml
[[durable_objects.bindings]]
name = "SAVE"
class_name = "Save"

[[migrations]]
tag = "v2"
new_sqlite_classes = ["Save"]
```

- [ ] **Step 5: 통과 확인**

Run (터미널 1): `npm run server:dev` (다시 시작)
Run (터미널 2): `node tools/save-smoke.mjs && node tools/room-smoke.mjs`
Expected: save-smoke 의 10줄 모두 `OK`, room-smoke 50/50 `OK`
Run: `npx tsc -b && npm test`
Expected: 오류 없음, 전체 통과

- [ ] **Step 6: Commit**

```bash
git add server/src/save.ts server/src/index.ts server/src/room.ts server/wrangler.toml tools/save-smoke.mjs
git commit -m "feat: 서버에 진행 저장 주소" -m "/save 를 복구 코드 해시 이름의 Save Durable Object 로 넘긴다. CORS 는 게임 주소만. 마이그레이션 v2. tools/save-smoke.mjs 로 확인."
```

---

### Task 4: 브라우저 동기화 판단 (순수 함수)

**Files:**
- Create: `src/game/logic/cloudSync.ts`
- Test: `src/game/logic/cloudSync.test.ts`

**Interfaces:**
- Produces:
  - `type ServerSave = { rev: number; data: unknown; savedAt: number }`
  - `type StartupStep = { kind: 'adopt' } | { kind: 'push'; baseRev: number; always: boolean }`
  - `saveUrl(roomServer: string): string`
  - `startupStep(server: ServerSave | null, syncedRev: number): StartupStep`
  - `pushDelay(firstDirtyAt: number, lastChangeAt: number, now: number): number`
  - `retryDelay(attempt: number): number`
  - `summarize(data: unknown): { coins: number; dex: number } | null`
  - 상수 `PUSH_QUIET_MS = 3000`, `PUSH_MAX_WAIT_MS = 15000`, `STARTUP_WAIT_MS = 3000`, `STARTUP_RETRY_MS = 30000`

- [ ] **Step 1: 실패하는 테스트**

```ts
import { describe, expect, it } from 'vitest'
import { pushDelay, retryDelay, saveUrl, startupStep, summarize } from './cloudSync'

describe('saveUrl', () => {
  it('웹소켓 주소를 http 저장 주소로', () => {
    expect(saveUrl('wss://rinfish-rooms.x.workers.dev')).toBe('https://rinfish-rooms.x.workers.dev/save')
    expect(saveUrl('ws://127.0.0.1:8787')).toBe('http://127.0.0.1:8787/save')
    expect(saveUrl('wss://a.dev/')).toBe('https://a.dev/save')
  })
})

describe('startupStep', () => {
  const s = (rev: number) => ({ rev, data: {}, savedAt: 0 })
  it('서버에 없으면 0번부터 꼭 올린다 (기존 진행이 서버로 옮겨짐)', () => {
    expect(startupStep(null, 0)).toEqual({ kind: 'push', baseRev: 0, always: true })
    expect(startupStep(null, 4)).toEqual({ kind: 'push', baseRev: 0, always: true })
  })
  it('서버가 더 최신이면 받는다', () => {
    expect(startupStep(s(5), 4)).toEqual({ kind: 'adopt' })
  })
  it('같으면 안 올린 변경이 있을 때만 올린다', () => {
    expect(startupStep(s(4), 4)).toEqual({ kind: 'push', baseRev: 4, always: false })
  })
  it('서버가 더 낡았으면(서버가 되돌아감) 서버 번호로 꼭 올린다', () => {
    expect(startupStep(s(2), 4)).toEqual({ kind: 'push', baseRev: 2, always: true })
  })
})

describe('pushDelay', () => {
  it('마지막 변경 뒤 3초', () => {
    expect(pushDelay(0, 0, 0)).toBe(3000)
    expect(pushDelay(0, 1000, 1000)).toBe(3000)
  })
  it('계속 바뀌어도 처음 변경 뒤 15초는 넘지 않는다', () => {
    expect(pushDelay(0, 14000, 14000)).toBe(1000)
    expect(pushDelay(0, 20000, 20000)).toBe(0)
  })
})

describe('retryDelay', () => {
  it('5 → 15 → 30초, 그 뒤로 30초', () => {
    expect([0, 1, 2, 3, 9].map(retryDelay)).toEqual([5000, 15000, 30000, 30000, 30000])
  })
})

describe('summarize', () => {
  it('저장본에서 코인·도감 수', () => {
    expect(summarize({ state: { coins: 12, dex: { a: {}, b: {} } }, version: 5 })).toEqual({ coins: 12, dex: 2 })
  })
  it('모양이 틀리면 null 이나 0', () => {
    expect(summarize(null)).toBeNull()
    expect(summarize({ state: {} })).toEqual({ coins: 0, dex: 0 })
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/game/logic/cloudSync.test.ts`
Expected: FAIL — `Failed to resolve import "./cloudSync"`

- [ ] **Step 3: 구현**

```ts
/** 서버 저장 판단 (순수). 설계: docs/superpowers/specs/2026-11-26-server-save-design.md */

/** 서버에 있는 저장 (rev = 저장 번호) */
export type ServerSave = { rev: number; data: unknown; savedAt: number }
/** 시작할 때 할 일: 서버 것 받기, 또는 baseRev 로 올리기 (always 가 아니면 안 올린 변경이 있을 때만) */
export type StartupStep = { kind: 'adopt' } | { kind: 'push'; baseRev: number; always: boolean }

/** 마지막 변경 뒤 이만큼 조용하면 올린다 */
export const PUSH_QUIET_MS = 3000
/** 계속 바뀌어도 처음 변경 뒤 이만큼이면 올린다 */
export const PUSH_MAX_WAIT_MS = 15000
/** 로딩 화면이 서버 응답을 기다리는 최대 시간 */
export const STARTUP_WAIT_MS = 3000
/** 시작할 때 서버에 못 닿으면 다시 시도하는 간격 */
export const STARTUP_RETRY_MS = 30000
const RETRY_MS = [5000, 15000, 30000]

/** 방 서버 주소(wss://…)에서 저장 주소(https://…/save) */
export function saveUrl(roomServer: string): string {
  return roomServer.replace(/\/+$/, '').replace(/^ws(s?):\/\//, 'http$1://') + '/save'
}

/** syncedRev: 이 브라우저가 서버와 마지막으로 맞춘 번호 */
export function startupStep(server: ServerSave | null, syncedRev: number): StartupStep {
  if (!server) return { kind: 'push', baseRev: 0, always: true }
  if (server.rev > syncedRev) return { kind: 'adopt' }
  return { kind: 'push', baseRev: server.rev, always: server.rev < syncedRev }
}

/** 지금부터 올리기까지 기다릴 시간(ms) */
export function pushDelay(firstDirtyAt: number, lastChangeAt: number, now: number): number {
  return Math.max(0, Math.min(lastChangeAt + PUSH_QUIET_MS, firstDirtyAt + PUSH_MAX_WAIT_MS) - now)
}

/** attempt 번째(0부터) 실패 뒤 다시 시도까지 */
export function retryDelay(attempt: number): number {
  return RETRY_MS[Math.min(attempt, RETRY_MS.length - 1)]
}

/** 확인 창에 보일 요약. 저장본({state, version})이 아니면 null */
export function summarize(data: unknown): { coins: number; dex: number } | null {
  if (typeof data !== 'object' || data === null) return null
  const state = (data as { state?: unknown }).state
  if (typeof state !== 'object' || state === null) return null
  const { coins, dex } = state as { coins?: unknown; dex?: unknown }
  return {
    coins: typeof coins === 'number' && coins >= 0 ? coins : 0,
    dex: typeof dex === 'object' && dex !== null ? Object.keys(dex).length : 0,
  }
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/game/logic/cloudSync.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add src/game/logic/cloudSync.ts src/game/logic/cloudSync.test.ts
git commit -m "feat: 서버 저장 동기화 판단" -m "저장 주소, 시작할 때 받을지 올릴지, 올리기까지 기다릴 시간(3초·최대 15초), 재시도 간격, 확인 창 요약."
```

---

### Task 5: 서버와 주고받는 본체 (`createCloudSave`)

**Files:**
- Create: `src/game/net/cloudSave.ts`
- Test: `src/game/net/cloudSave.test.ts`

**Interfaces:**
- Consumes: Task 1 `makeCode`, `normalizeCode`; Task 4 전부
- Produces:
  - `CLOUD_KEY = 'seommaeul-cloud-v1'`
  - `type CloudStatus = 'off' | 'syncing' | 'saved' | 'pending'`
  - `type CloudDeps` (아래 코드)
  - `createCloudSave(deps: CloudDeps): CloudSave`
  - `type CloudSave = { start(): Promise<void>; markDirty(): void; hide(): void; code(): string; preview(input: string): Promise<'bad' | 'none' | 'error' | ServerSave>; switchTo(code: string, save: ServerSave): Promise<void> }`

- [ ] **Step 1: 실패하는 테스트**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CLOUD_KEY, createCloudSave, type CloudDeps, type CloudStatus } from './cloudSave'

type Call = { method: string; auth: string; body: unknown; keepalive: boolean }

/** 가짜 서버: 저장 번호 판정을 서버처럼 한다 */
function fakeServer() {
  const saves = new Map<string, { rev: number; data: unknown; savedAt: number }>()
  const calls: Call[] = []
  let down = false
  const fetch = vi.fn(async (_url: string, init: RequestInit) => {
    const auth = (init.headers as Record<string, string>).Authorization
    const body = init.body ? JSON.parse(init.body as string) : undefined
    calls.push({ method: init.method ?? 'GET', auth, body, keepalive: !!init.keepalive })
    if (down) throw new TypeError('network')
    const cur = saves.get(auth)
    if (init.method === 'PUT') {
      if (cur && body.baseRev !== cur.rev) return new Response(JSON.stringify(cur), { status: 409 })
      const next = { rev: (cur?.rev ?? 0) + 1, data: body.data, savedAt: 0 }
      saves.set(auth, next)
      return new Response(JSON.stringify({ rev: next.rev }), { status: 200 })
    }
    return cur ? new Response(JSON.stringify(cur), { status: 200 }) : new Response('{}', { status: 404 })
  })
  return { saves, calls, fetch, setDown: (v: boolean) => (down = v) }
}

function setup(server = fakeServer()) {
  let raw: string | null = JSON.stringify({ state: { coins: 1 }, version: 5 })
  const statuses: CloudStatus[] = []
  const notices: string[] = []
  const rehydrate = vi.fn(async () => {})
  const deps: CloudDeps = {
    base: 'https://x/save',
    fetch: server.fetch as unknown as typeof fetch,
    storage: localStorage,
    now: () => Date.now(),
    readSave: () => raw,
    writeSave: (t) => (raw = t),
    rehydrate,
    flushLocal: vi.fn(),
    onStatus: (s) => statuses.push(s),
    notify: (t) => notices.push(t),
  }
  const cloud = createCloudSave(deps)
  return { cloud, server, deps, statuses, notices, rehydrate, getRaw: () => raw, setRaw: (t: string) => (raw = t) }
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

describe('start', () => {
  it('코드를 만들어 저장하고, 서버에 없으면 지금 사본을 0번으로 올린다', async () => {
    const t = setup()
    await t.cloud.start()
    expect(t.cloud.code()).toHaveLength(20)
    expect(JSON.parse(localStorage.getItem(CLOUD_KEY)!)).toEqual({ code: t.cloud.code(), syncedRev: 1, dirty: false })
    const put = t.server.calls.find((c) => c.method === 'PUT')!
    expect(put.auth).toBe(`Bearer ${t.cloud.code()}`)
    expect(put.body).toEqual({ baseRev: 0, data: { state: { coins: 1 }, version: 5 } })
    expect(t.statuses.at(-1)).toBe('saved')
  })

  it('서버가 더 최신이면 서버 것을 사본에 쓰고 다시 읽는다', async () => {
    const server = fakeServer()
    localStorage.setItem(CLOUD_KEY, JSON.stringify({ code: 'QX7K29PMH4TB8WNC5RDA', syncedRev: 1, dirty: false }))
    server.saves.set('Bearer QX7K29PMH4TB8WNC5RDA', { rev: 3, data: { state: { coins: 99 }, version: 5 }, savedAt: 0 })
    const t = setup(server)
    await t.cloud.start()
    expect(JSON.parse(t.getRaw()!).state.coins).toBe(99)
    expect(t.rehydrate).toHaveBeenCalledOnce()
    expect(JSON.parse(localStorage.getItem(CLOUD_KEY)!).syncedRev).toBe(3)
    expect(t.server.calls.some((c) => c.method === 'PUT')).toBe(false)
  })

  it('서버에 못 닿으면 pending 이고 30초 뒤 다시 시도한다', async () => {
    const t = setup()
    t.server.setDown(true)
    await t.cloud.start()
    expect(t.statuses.at(-1)).toBe('pending')
    t.server.setDown(false)
    await vi.advanceTimersByTimeAsync(30000)
    expect(t.statuses.at(-1)).toBe('saved')
  })
})

describe('플레이 중', () => {
  it('변경 뒤 3초 조용하면 맞춘 번호로 올린다', async () => {
    const t = setup()
    await t.cloud.start()
    t.setRaw(JSON.stringify({ state: { coins: 2 }, version: 5 }))
    t.cloud.markDirty()
    await vi.advanceTimersByTimeAsync(2900)
    expect(t.server.calls.filter((c) => c.method === 'PUT')).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(200)
    const puts = t.server.calls.filter((c) => c.method === 'PUT')
    expect(puts).toHaveLength(2)
    expect(puts[1].body).toEqual({ baseRev: 1, data: { state: { coins: 2 }, version: 5 } })
    expect(JSON.parse(localStorage.getItem(CLOUD_KEY)!)).toMatchObject({ syncedRev: 2, dirty: false })
  })

  it('계속 바뀌어도 15초 안에는 올린다', async () => {
    const t = setup()
    await t.cloud.start()
    for (let i = 0; i < 16; i++) {
      t.cloud.markDirty()
      await vi.advanceTimersByTimeAsync(1000)
    }
    expect(t.server.calls.filter((c) => c.method === 'PUT').length).toBeGreaterThanOrEqual(2)
  })

  it('dirty 는 새로고침 뒤에도 남는다', async () => {
    const t = setup()
    await t.cloud.start()
    t.server.setDown(true)
    t.cloud.markDirty()
    expect(JSON.parse(localStorage.getItem(CLOUD_KEY)!).dirty).toBe(true)
    // 새로고침: 같은 저장소로 새로 만든다
    t.server.setDown(false)
    const again = setup(t.server)
    await again.cloud.start()
    const puts = t.server.calls.filter((c) => c.method === 'PUT')
    expect(puts.at(-1)!.body).toMatchObject({ baseRev: 1 })
    expect(JSON.parse(localStorage.getItem(CLOUD_KEY)!).dirty).toBe(false)
  })

  it('올리는 중 바뀌면 성공 뒤에도 dirty', async () => {
    const t = setup()
    await t.cloud.start()
    let release!: () => void
    t.server.fetch.mockImplementationOnce(
      (async () => {
        await new Promise<void>((r) => (release = r))
        return new Response(JSON.stringify({ rev: 2 }), { status: 200 })
      }) as never,
    )
    t.cloud.markDirty()
    await vi.advanceTimersByTimeAsync(3000)
    t.cloud.markDirty() // 올리는 도중 변경
    release()
    await vi.advanceTimersByTimeAsync(0)
    expect(JSON.parse(localStorage.getItem(CLOUD_KEY)!)).toMatchObject({ syncedRev: 2, dirty: true })
  })

  it('실패하면 pending, 5초 뒤 다시 시도한다', async () => {
    const t = setup()
    await t.cloud.start()
    t.server.setDown(true)
    t.cloud.markDirty()
    await vi.advanceTimersByTimeAsync(3000)
    expect(t.statuses.at(-1)).toBe('pending')
    t.server.setDown(false)
    await vi.advanceTimersByTimeAsync(5000)
    expect(t.statuses.at(-1)).toBe('saved')
  })

  it('거절(409)되면 서버 것을 받고 안내한다', async () => {
    const t = setup()
    await t.cloud.start()
    const auth = `Bearer ${t.cloud.code()}`
    t.server.saves.set(auth, { rev: 5, data: { state: { coins: 50 }, version: 5 }, savedAt: 0 })
    t.cloud.markDirty()
    await vi.advanceTimersByTimeAsync(3000)
    expect(JSON.parse(t.getRaw()!).state.coins).toBe(50)
    expect(t.notices).toContain('다른 곳에서 한 진행으로 바꿨어요')
    expect(JSON.parse(localStorage.getItem(CLOUD_KEY)!)).toMatchObject({ syncedRev: 5, dirty: false })
  })

  it('adopt 중 저장은 dirty 로 안 잡힌다', async () => {
    const t = setup()
    t.rehydrate.mockImplementation(async () => t.cloud.markDirty()) // persist 가 다시 쓰는 경우
    const auth = 'Bearer QX7K29PMH4TB8WNC5RDA'
    localStorage.setItem(CLOUD_KEY, JSON.stringify({ code: 'QX7K29PMH4TB8WNC5RDA', syncedRev: 0, dirty: false }))
    t.server.saves.set(auth, { rev: 2, data: { state: {}, version: 5 }, savedAt: 0 })
    await t.cloud.start()
    expect(JSON.parse(localStorage.getItem(CLOUD_KEY)!).dirty).toBe(false)
  })

  it('탭을 숨기면 사본을 먼저 쓰고 keepalive 로 바로 올린다', async () => {
    const t = setup()
    await t.cloud.start()
    t.cloud.markDirty()
    t.cloud.hide()
    expect(t.deps.flushLocal).toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(0)
    expect(t.server.calls.at(-1)).toMatchObject({ method: 'PUT', keepalive: true })
  })
})

describe('코드로 이어 하기', () => {
  it('모양이 틀리면 bad, 없으면 none, 있으면 저장본', async () => {
    const t = setup()
    await t.cloud.start()
    expect(await t.cloud.preview('abc')).toBe('bad')
    expect(await t.cloud.preview('QX7K-29PM-H4TB-8WNC-5RDA')).toBe('none')
    t.server.saves.set('Bearer QX7K29PMH4TB8WNC5RDA', { rev: 4, data: { state: { coins: 8 }, version: 5 }, savedAt: 0 })
    expect(await t.cloud.preview('qx7k29pmh4tb8wnc5rda')).toMatchObject({ rev: 4 })
  })

  it('바꾸기 전에 지금 진행을 지금 코드로 올리고, 코드를 바꾼 뒤 그 진행을 받는다', async () => {
    const t = setup()
    await t.cloud.start()
    const oldCode = t.cloud.code()
    t.setRaw(JSON.stringify({ state: { coins: 3 }, version: 5 }))
    t.cloud.markDirty()
    const other = { rev: 4, data: { state: { coins: 8 }, version: 5 }, savedAt: 0 }
    t.server.saves.set('Bearer QX7K29PMH4TB8WNC5RDA', other)
    await t.cloud.switchTo('QX7K29PMH4TB8WNC5RDA', other)
    expect((t.server.saves.get(`Bearer ${oldCode}`)!.data as { state: { coins: number } }).state.coins).toBe(3)
    expect(t.cloud.code()).toBe('QX7K29PMH4TB8WNC5RDA')
    expect(JSON.parse(t.getRaw()!).state.coins).toBe(8)
    expect(JSON.parse(localStorage.getItem(CLOUD_KEY)!)).toEqual({ code: 'QX7K29PMH4TB8WNC5RDA', syncedRev: 4, dirty: false })
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/game/net/cloudSave.test.ts`
Expected: FAIL — `Failed to resolve import "./cloudSave"`

- [ ] **Step 3: 구현**

```ts
import { STARTUP_RETRY_MS, pushDelay, retryDelay, startupStep, type ServerSave } from '../logic/cloudSync'
import { makeCode, normalizeCode } from '../logic/recoveryCode'

/** 브라우저에 두는 서버 저장 정보: 복구 코드, 맞춘 번호, 안 올린 변경 있음 */
export const CLOUD_KEY = 'seommaeul-cloud-v1'
export type CloudStatus = 'off' | 'syncing' | 'saved' | 'pending'

export type CloudDeps = {
  /** https://…/save */
  base: string
  fetch: typeof fetch
  storage: Storage | null
  now: () => number
  /** 진행 사본(localStorage fishing-island-save-v1) 원문 */
  readSave: () => string | null
  writeSave: (raw: string) => void
  /** 사본을 다시 읽어 게임 상태에 넣기 (progressStore.persist.rehydrate) */
  rehydrate: () => Promise<void>
  /** 미뤄 둔 사본 저장을 지금 쓰기 (flushProgressSave) */
  flushLocal: () => void
  onStatus: (s: CloudStatus) => void
  notify: (text: string) => void
}

export type CloudSave = {
  start(): Promise<void>
  /** 사본이 바뀌었다 (progressStore 가 저장할 때마다) */
  markDirty(): void
  /** 탭을 숨기거나 닫는다 */
  hide(): void
  code(): string
  /** 코드로 이어 하기: 확인 창에 보일 그 코드의 저장 */
  preview(input: string): Promise<'bad' | 'none' | 'error' | ServerSave>
  /** 지금 진행을 지금 코드로 올려 두고, 코드를 바꿔 그 저장을 받는다 */
  switchTo(code: string, save: ServerSave): Promise<void>
}

type Persisted = { code: string; syncedRev: number; dirty: boolean }

function readPersisted(storage: Storage | null): Persisted | null {
  try {
    const v = JSON.parse(storage?.getItem(CLOUD_KEY) ?? 'null') as Partial<Persisted> | null
    const code = typeof v?.code === 'string' ? normalizeCode(v.code) : null
    if (!code) return null
    return { code, syncedRev: Number.isInteger(v!.syncedRev) && v!.syncedRev! >= 0 ? v!.syncedRev! : 0, dirty: v!.dirty === true }
  } catch {
    return null
  }
}

export function createCloudSave(deps: CloudDeps): CloudSave {
  const saved = readPersisted(deps.storage)
  let st: Persisted = saved ?? { code: makeCode(), syncedRev: 0, dirty: false }
  /** 변경마다 1 씩: 올리는 도중 바뀌었는지 가린다 */
  let writeSeq = 0
  let firstDirtyAt: number | null = null
  let lastChangeAt = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let inflight: Promise<void> | null = null
  let failures = 0
  /** 서버 것을 받는 중 (그 사이 persist 저장은 변경으로 치지 않는다) */
  let applying = false

  const persist = () => {
    try {
      deps.storage?.setItem(CLOUD_KEY, JSON.stringify(st))
    } catch {
      // 저장소를 못 쓰면 이번 탭에서만 기억한다
    }
  }
  /** 누구인지 알리는 머리말. 허브 로그인 전환 때 이 함수를 허브 토큰으로 바꾼다 */
  const authHeader = (code: string) => `Bearer ${code}`
  const request = (code: string, init: RequestInit = {}) =>
    deps.fetch(deps.base, { ...init, headers: { Authorization: authHeader(code), 'Content-Type': 'application/json' } })

  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }
  const schedule = (ms: number) => {
    clearTimer()
    timer = setTimeout(() => void push(), ms)
  }

  async function getSave(code: string): Promise<ServerSave | null | 'error'> {
    try {
      const res = await request(code)
      if (res.status === 404) return null
      if (!res.ok) return 'error'
      return (await res.json()) as ServerSave
    } catch {
      return 'error'
    }
  }

  async function adopt(save: ServerSave) {
    applying = true
    try {
      deps.writeSave(JSON.stringify(save.data))
      await deps.rehydrate()
    } finally {
      applying = false
    }
    st = { ...st, syncedRev: save.rev, dirty: false }
    firstDirtyAt = null
    persist()
    deps.onStatus('saved')
  }

  function push(keepalive = false): Promise<void> {
    clearTimer()
    if (inflight) return inflight
    const raw = deps.readSave()
    if (!raw) return Promise.resolve()
    const seq = writeSeq
    const code = st.code
    deps.onStatus('syncing')
    inflight = (async () => {
      try {
        const res = await request(code, { method: 'PUT', body: JSON.stringify({ baseRev: st.syncedRev, data: JSON.parse(raw) }), keepalive })
        if (res.status === 409) {
          await adopt((await res.json()) as ServerSave)
          deps.notify('다른 곳에서 한 진행으로 바꿨어요')
        } else if (res.status === 401) {
          // 저장된 코드가 깨졌다: 새 코드로 처음부터 올린다
          st = { code: makeCode(), syncedRev: 0, dirty: true }
          persist()
          schedule(0)
        } else if (res.status === 413) {
          console.warn('[cloudSave] 진행이 너무 커서 올리지 못했어요')
          deps.onStatus('pending')
        } else if (!res.ok) {
          throw new Error(`save ${res.status}`)
        } else {
          const { rev } = (await res.json()) as { rev: number }
          failures = 0
          const changed = writeSeq !== seq
          st = { ...st, syncedRev: rev, dirty: changed }
          if (!changed) firstDirtyAt = null
          persist()
          deps.onStatus('saved')
          if (changed) schedule(pushDelay(firstDirtyAt ?? deps.now(), lastChangeAt, deps.now()))
        }
      } catch {
        deps.onStatus('pending')
        schedule(retryDelay(failures++))
      } finally {
        inflight = null
      }
    })()
    return inflight
  }

  async function start() {
    persist()
    deps.onStatus('syncing')
    const server = await getSave(st.code)
    if (server === 'error') {
      deps.onStatus('pending')
      clearTimer()
      timer = setTimeout(() => void start(), STARTUP_RETRY_MS)
      return
    }
    const step = startupStep(server, st.syncedRev)
    if (step.kind === 'adopt') return adopt(server!)
    st = { ...st, syncedRev: step.baseRev }
    persist()
    if (step.always || st.dirty) return push()
    deps.onStatus('saved')
  }

  return {
    start,
    markDirty() {
      if (applying) return
      writeSeq++
      const now = deps.now()
      firstDirtyAt ??= now
      lastChangeAt = now
      if (!st.dirty) {
        st = { ...st, dirty: true }
        persist()
      }
      deps.onStatus('pending')
      if (!inflight) schedule(pushDelay(firstDirtyAt, lastChangeAt, now))
    },
    hide() {
      deps.flushLocal()
      if (st.dirty) void push(true)
    },
    code: () => st.code,
    async preview(input) {
      const code = normalizeCode(input)
      if (!code) return 'bad'
      const save = await getSave(code)
      return save === null ? 'none' : save
    },
    async switchTo(code, save) {
      if (st.dirty) await push()
      await inflight
      st = { code, syncedRev: 0, dirty: false }
      persist()
      await adopt(save)
    },
  }
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/game/net/cloudSave.test.ts`
Expected: PASS (13 tests). 실패하는 테스트가 있으면 테스트 기대가 아니라 구현을 고친다. 단, 가짜 타이머와 `await` 순서 때문에 `advanceTimersByTimeAsync(0)` 을 한 번 더 넣어야 하는 경우는 테스트 쪽에서 고쳐도 된다 (ledger 에 Ruling 으로 남긴다).

- [ ] **Step 5: Commit**

```bash
git add src/game/net/cloudSave.ts src/game/net/cloudSave.test.ts
git commit -m "feat: 진행을 서버와 주고받기" -m "시작할 때 받기/올리기, 변경 뒤 3초(최대 15초) 모아 올리기, 실패 재시도, 409 면 서버 것 받기, 탭 숨기면 keepalive 로 올리기, 코드로 이어 하기."
```

---

### Task 6: 게임에 연결 (부팅·사본 저장 알림·로딩 화면)

**Files:**
- Create: `src/game/stores/cloudStore.ts`, `src/game/net/cloudBoot.ts`
- Modify: `src/game/stores/progressStore.ts:316-329`, `src/App.tsx`, `src/game/ui/LoadingScreen.tsx:55-73`
- Test: `src/game/stores/progressStore.test.ts` (테스트 추가)

**Interfaces:**
- Consumes: Task 5 `createCloudSave`, `CloudSave`, `CloudStatus`; Task 4 `saveUrl`, `STARTUP_WAIT_MS`
- Produces:
  - `onProgressSaved(listener: () => void): () => void` (progressStore)
  - `useCloudStore: { status: CloudStatus; ready: boolean; code: string | null }`
  - `cloud: CloudSave | null`, `startCloud(): void` (cloudBoot)

- [ ] **Step 1: 실패하는 테스트** (`src/game/stores/progressStore.test.ts` 끝에 더한다. 파일 위 import 에 `onProgressSaved` 를 더한다)

```ts
describe('onProgressSaved', () => {
  it('사본에 쓸 때마다 알린다', () => {
    const seen = vi.fn()
    const off = onProgressSaved(seen)
    useProgressStore.getState().addPlayTime(1)
    expect(seen).toHaveBeenCalled()
    off()
    seen.mockClear()
    useProgressStore.getState().addPlayTime(1)
    expect(seen).not.toHaveBeenCalled()
  })
})
```

(`vi` 가 import 돼 있지 않으면 `import { ..., vi } from 'vitest'` 로 더한다.)

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/game/stores/progressStore.test.ts`
Expected: FAIL — `onProgressSaved` is not exported

- [ ] **Step 3: progressStore 에 알림 더하기** (`src/game/stores/progressStore.ts` 의 `const saves = ...` 줄을 바꾼다)

```ts
/** 사본(localStorage)에 쓸 때마다 부를 것 (서버 저장이 "안 올린 변경" 을 표시한다) */
const savedListeners = new Set<() => void>()
export function onProgressSaved(listener: () => void): () => void {
  savedListeners.add(listener)
  return () => savedListeners.delete(listener)
}
const local = createJSONStorage<ProgressData & ProgressActions>(() => localStorage)
const saves = deferrableStorage<ProgressData & ProgressActions>(
  local && {
    ...local,
    setItem: (name, value) => {
      const r = local.setItem(name, value)
      savedListeners.forEach((f) => f())
      return r
    },
  },
  AMMO_SAVE_DELAY,
)
```

Run: `npx vitest run src/game/stores/progressStore.test.ts`
Expected: PASS

- [ ] **Step 4: 화면용 상태** `src/game/stores/cloudStore.ts`

```ts
import { create } from 'zustand'
import type { CloudStatus } from '../net/cloudSave'

/** 서버 저장 화면 상태. ready: 로딩 화면이 더 기다리지 않아도 된다 (시작 동기화가 끝났거나 3초가 지남) */
type CloudState = { status: CloudStatus; ready: boolean; code: string | null }

export const useCloudStore = create<CloudState>()(() => ({ status: 'off', ready: true, code: null }))
```

- [ ] **Step 5: 부팅** `src/game/net/cloudBoot.ts`

```ts
import { STARTUP_WAIT_MS, saveUrl } from '../logic/cloudSync'
import { SAVE_KEY, flushProgressSave, onProgressSaved, useProgressStore } from '../stores/progressStore'
import { useCloudStore } from '../stores/cloudStore'
import { useSessionStore } from '../stores/sessionStore'
import { createCloudSave, type CloudSave } from './cloudSave'
import { ROOM_SERVER } from './serverUrl'

function localStore(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** 서버 저장. 방 서버 주소가 없으면 null (지금처럼 브라우저에만 저장) */
export const cloud: CloudSave | null = ROOM_SERVER
  ? createCloudSave({
      base: saveUrl(ROOM_SERVER),
      fetch: (...a) => fetch(...a),
      storage: localStore(),
      now: () => Date.now(),
      readSave: () => localStore()?.getItem(SAVE_KEY) ?? null,
      writeSave: (raw) => localStore()?.setItem(SAVE_KEY, raw),
      rehydrate: () => Promise.resolve(useProgressStore.persist.rehydrate()),
      flushLocal: flushProgressSave,
      onStatus: (status) => useCloudStore.setState({ status }),
      notify: (text) => useSessionStore.getState().notify(text),
    })
  : null

let started = false

/** 한 번만: 서버와 맞추기 시작. 로딩 화면은 끝나거나 3초가 지나면 닫힐 수 있다 */
export function startCloud() {
  if (!cloud || started) return
  started = true
  useCloudStore.setState({ ready: false, code: cloud.code() })
  onProgressSaved(() => cloud.markDirty())
  const ready = () => useCloudStore.setState({ ready: true, code: cloud.code() })
  const wait = setTimeout(ready, STARTUP_WAIT_MS)
  void cloud.start().finally(() => {
    clearTimeout(wait)
    ready()
  })
  window.addEventListener('pagehide', () => cloud.hide())
  document.addEventListener('visibilitychange', () => document.hidden && cloud.hide())
}
```

- [ ] **Step 6: App 과 로딩 화면**

`src/App.tsx` — import 와 hub 줄 아래:

```ts
import { startCloud } from './game/net/cloudBoot'
```
```ts
// 진행을 서버와 맞추기 시작한다 (방 서버가 없으면 아무것도 안 한다)
startCloud()
```

`src/game/ui/LoadingScreen.tsx` — import 에 `import { useCloudStore } from '../stores/cloudStore'` 를 더하고, `finished` 를 바꾼다:

```ts
  // 서버 저장 맞추기도 기다린다 (최대 3초, cloudBoot)
  const cloudReady = useCloudStore((s) => s.ready)
  const finished = total > 0 && !active && progress >= 100 && cloudReady
```

- [ ] **Step 7: 확인**

Run: `npx tsc -b && npm test && npm run lint`
Expected: tsc 오류 없음, vitest 전체 통과, lint 경고 수 6 (기준선 그대로)
Run (터미널 1): `npm run server:dev`, (터미널 2): `VITE_ROOM_SERVER=ws://127.0.0.1:8787 npx vite --host 127.0.0.1 --port 5190`
브라우저에서 http://127.0.0.1:5190 을 열고 개발자 도구 Network 에 `/save` GET 다음 PUT 이 보이고, Application → localStorage 에 `seommaeul-cloud-v1` 이 생기는지 본다.

- [ ] **Step 8: Commit**

```bash
git add src/game/stores/cloudStore.ts src/game/net/cloudBoot.ts src/game/stores/progressStore.ts src/game/stores/progressStore.test.ts src/App.tsx src/game/ui/LoadingScreen.tsx
git commit -m "feat: 게임 시작 때 진행을 서버와 맞추기" -m "사본 저장마다 안 올린 변경으로 표시하고, 탭을 숨기면 바로 올린다. 로딩 화면은 서버 응답을 최대 3초 기다린다. 방 서버 주소가 없으면 꺼진다."
```

---

### Task 7: 화면 (저장 표시·복구 코드·코드로 이어 하기)

**Files:**
- Create: `src/game/ui/CloudBadge.tsx`, `src/game/ui/CloudRestore.tsx`
- Modify: `src/game/Game.tsx` (`<RoomBadge />` 아래), `src/game/ui/MenuPanel.tsx`, `src/game/ui/Lobby.tsx`, `src/game/ui/CharacterCreator.tsx`

**Interfaces:**
- Consumes: Task 6 `cloud`, `useCloudStore`; Task 1 `formatCode`; Task 4 `summarize`, `ServerSave`
- Produces: `CloudBadge()`, `CloudCodeSection()`, `CloudRestoreForm({ onDone }: { onDone: () => void })`

- [ ] **Step 1: 저장 표시** `src/game/ui/CloudBadge.tsx`

```tsx
import { useCloudStore } from '../stores/cloudStore'
import { useSessionStore } from '../stores/sessionStore'
import { safeLeft, safeBottom } from './styles'

const TEXT = { syncing: '☁️ 저장 중…', saved: '☁️ 저장됨', pending: '☁️ 저장 대기 중' } as const

/** 화면 왼쪽 아래 작게: 서버 저장 상태. 서버가 없으면(off) 안 보인다 */
export function CloudBadge() {
  const status = useCloudStore((s) => s.status)
  const mode = useSessionStore((s) => s.mode)
  if (status === 'off' || mode === 'cutscene' || mode === 'aquariumView') return null
  return (
    <div style={{ position: 'absolute', left: safeLeft(12), bottom: safeBottom(8), fontSize: 12, opacity: status === 'pending' ? 0.9 : 0.55, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.7)', pointerEvents: 'none', zIndex: 4 }}>
      {TEXT[status]}
    </div>
  )
}
```

`safeLeft`·`safeBottom` 은 `styles.ts` 에 이미 있다. 왼쪽 아래에 터치 스틱이 있으면 (`TouchControls.tsx` 확인) 터치 화면에서는 `top: safeTop(8)` 왼쪽 위로 옮긴다: `const touchUi = useTouchUi()` 로 가른다.

`src/game/Game.tsx` — `<RoomBadge />` 다음 줄에 `<CloudBadge />` 와 import 를 더한다.

- [ ] **Step 2: 복구 코드 보기·코드로 이어 하기** `src/game/ui/CloudRestore.tsx`

```tsx
import { useState, type CSSProperties } from 'react'
import { cloud } from '../net/cloudBoot'
import { summarize, type ServerSave } from '../logic/cloudSync'
import { formatCode, normalizeCode } from '../logic/recoveryCode'
import { useCloudStore } from '../stores/cloudStore'
import { useNetStore } from '../stores/netStore'
import { useProgressStore } from '../stores/progressStore'
import { useSessionStore } from '../stores/sessionStore'
import { button } from './styles'

const input: CSSProperties = { width: '100%', padding: '10px 12px', fontSize: 16, borderRadius: 8, border: '1px solid #ccc', boxSizing: 'border-box', pointerEvents: 'auto', letterSpacing: 1 }
const note: CSSProperties = { margin: 0, fontSize: 13, opacity: 0.75 }

/** ESC 메뉴: 내 복구 코드와 복사, 코드로 이어 하기. 서버 저장이 꺼져 있으면 없다 */
export function CloudCodeSection() {
  const code = useCloudStore((s) => s.code)
  const [open, setOpen] = useState(false)
  if (!cloud || !code) return null
  const copy = () => void navigator.clipboard?.writeText(formatCode(code)).then(() => useSessionStore.getState().notify('복구 코드를 복사했어요'))
  return (
    <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.15)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h3 style={{ margin: 0, fontSize: 15, opacity: 0.85 }}>☁️ 진행 저장</h3>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <code style={{ fontSize: 16, letterSpacing: 1, userSelect: 'all' }}>{formatCode(code)}</code>
        <button style={{ ...button, minHeight: 32 }} onClick={copy}>
          복사
        </button>
      </div>
      <p style={note}>브라우저를 지우거나 다른 기기에서 이어 하려면 이 코드가 필요해요. 남에게 보여 주지 마세요.</p>
      {open ? <CloudRestoreForm onDone={() => setOpen(false)} /> : (
        <button style={button} onClick={() => setOpen(true)}>
          🔑 코드로 이어 하기
        </button>
      )}
    </div>
  )
}

/** 코드 입력 → 그 진행 미리보기 → 확인하면 바꾼다. 같이 하기 방 안에서는 막는다 */
export function CloudRestoreForm({ onDone }: { onDone: () => void }) {
  const online = useNetStore((s) => s.phase !== 'off')
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [found, setFound] = useState<{ code: string; save: ServerSave } | null>(null)
  const [busy, setBusy] = useState(false)
  if (!cloud) return null
  if (online) return <p style={note}>같이 하기 방을 나온 뒤에 할 수 있어요.</p>

  const look = async () => {
    setBusy(true)
    setError(null)
    const r = await cloud!.preview(text)
    setBusy(false)
    if (r === 'bad') return setError('코드 모양이 틀렸어요 (20자)')
    if (r === 'none') return setError('그 코드로 저장된 진행이 없어요')
    if (r === 'error') return setError('서버에 연결할 수 없어요. 잠시 뒤 다시 해 주세요')
    if (normalizeCode(text) === cloud!.code()) return setError('지금 쓰고 있는 코드예요')
    setFound({ code: normalizeCode(text)!, save: r })
  }
  const confirm = async () => {
    if (!found) return
    setBusy(true)
    await cloud!.switchTo(found.code, found.save)
    useCloudStore.setState({ code: found.code })
    setBusy(false)
    useSessionStore.getState().notify('그 진행으로 바꿨어요')
    onDone()
  }

  if (found) {
    const now = useProgressStore.getState()
    const next = summarize(found.save.data) ?? { coins: 0, dex: 0 }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={{ margin: 0, fontSize: 14 }}>
          지금 이 브라우저의 진행(코인 {now.coins}, 도감 {Object.keys(now.dex).length}종)을 그 진행(코인 {next.coins}, 도감 {next.dex}종)으로 바꿀까요?
        </p>
        <p style={note}>지금 진행은 지금 코드로 서버에 남아 있어요.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ ...button, flex: 1 }} disabled={busy} onClick={() => void confirm()}>
            {busy ? '바꾸는 중…' : '바꾸기'}
          </button>
          <button style={{ ...button, flex: 1, opacity: 0.8 }} disabled={busy} onClick={() => setFound(null)}>
            취소
          </button>
        </div>
      </div>
    )
  }
  return (
    <form
      style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
      onSubmit={(e) => {
        e.preventDefault()
        void look()
      }}
    >
      <input style={input} placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" aria-label="복구 코드" value={text} maxLength={40} onChange={(e) => setText(e.target.value)} />
      {error && <p style={{ ...note, color: '#ff8a80', opacity: 1 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" style={{ ...button, flex: 1 }} disabled={busy}>
          {busy ? '찾는 중…' : '찾기'}
        </button>
        <button type="button" style={{ ...button, flex: 1, opacity: 0.8 }} onClick={onDone}>
          닫기
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 3: 메뉴·시작 창·캐릭터 만들기에 연결**

`src/game/ui/MenuPanel.tsx` — `import { CloudCodeSection } from './CloudRestore'`, 그리고 `<SettingsSection />` 바로 위에 `<CloudCodeSection />`.

`src/game/ui/Lobby.tsx` — `import { CloudRestoreForm } from './CloudRestore'` 와 `import { cloud } from '../net/cloudBoot'`, 상태 `const [restoring, setRestoring] = useState(false)`. 「혼자 하기」 버튼 아래에 넣는다:

```tsx
        {cloud &&
          (restoring ? (
            <CloudRestoreForm onDone={() => setRestoring(false)} />
          ) : (
            <button style={{ ...button, opacity: 0.85 }} onClick={() => setRestoring(true)}>
              🔑 코드로 이어 하기
            </button>
          ))}
```

`src/game/ui/CharacterCreator.tsx` — 처음 만들 때(`firstTime`)만, 맨 아래 버튼 줄 위에 같은 버튼과 `CloudRestoreForm` 을 넣는다. `onDone` 에서 바뀐 진행에 생김새가 있으면 꾸미기 화면을 닫는다:

```tsx
  const [restoring, setRestoring] = useState(false)
  const restored = () => {
    setRestoring(false)
    // 받은 진행에 생김새가 있으면 꾸미기를 건너뛰고 시작 창(방 서버가 있으면) 또는 탐험으로
    if (useProgressStore.getState().look) useSessionStore.getState().setMode(ROOM_SERVER ? 'lobby' : 'explore')
  }
```
```tsx
      {firstTime && cloud && (restoring ? <CloudRestoreForm onDone={restored} /> : (
        <button style={{ ...button, opacity: 0.85 }} onClick={() => setRestoring(true)}>
          🔑 이미 하던 진행이 있어요 (코드로 이어 하기)
        </button>
      ))}
```
(`CharacterCreator` 안에서 이 버튼을 둘 자리는 기존 「시작하기」류 버튼이 있는 JSX 바로 위다. `grep -n "firstTime" src/game/ui/CharacterCreator.tsx` 로 찾는다. `CloudRestoreForm` 의 `onDone` 은 취소 때도 불리므로, `restored` 는 생김새가 있을 때만 화면을 바꾼다.)

- [ ] **Step 4: 확인**

Run: `npx tsc -b && npm test && npm run lint && npm run build`
Expected: 모두 통과, lint 6

- [ ] **Step 5: Commit**

```bash
git add src/game/ui/CloudBadge.tsx src/game/ui/CloudRestore.tsx src/game/Game.tsx src/game/ui/MenuPanel.tsx src/game/ui/Lobby.tsx src/game/ui/CharacterCreator.tsx
git commit -m "feat: 복구 코드 화면과 코드로 이어 하기" -m "화면 구석 저장 상태, ESC 메뉴의 복구 코드·복사, 시작 창과 처음 꾸미기 화면의 코드로 이어 하기. 같이 하기 방 안에서는 막는다."
```

---

### Task 8: 헤드리스 확인·README

**Files:**
- Create: `tools/cloud-check.mjs`
- Modify: `README.md`

**Interfaces:**
- Consumes: 전부. `tools/hub-entry-check.mjs` 의 브라우저 띄우는 방식을 그대로 따른다 (`sed -n 1,60p tools/hub-entry-check.mjs` 로 먼저 읽는다).

- [ ] **Step 1: 확인 스크립트** `tools/cloud-check.mjs`

`hub-entry-check.mjs` 와 같은 방식(같은 헤드리스 브라우저 도구, 같은 `assert` 출력)으로 아래 시나리오를 쓴다. 서버는 `npm run server:dev`, 게임은 `VITE_ROOM_SERVER=ws://127.0.0.1:8787 npx vite --host 127.0.0.1 --port 5190`.

1. 새 브라우저 문맥(빈 저장소)에서 게임을 연다 → `seommaeul-cloud-v1` 에 20자 코드가 생긴다. → `OK 처음 열면 복구 코드`
2. localStorage `fishing-island-save-v1` 의 `state.coins` 를 1234 로 바꿔 쓰고 `useProgressStore` 를 다시 읽게 새로고침한 뒤, 5초 기다린다 → `fetch` 로 그 코드의 `/save` GET 이 `state.coins === 1234`. → `OK 진행이 서버에 올라간다`
3. 그 코드를 기억하고 브라우저 문맥을 새로 만든다(저장소 비움) → 게임을 열면 꾸미기 화면에 「🔑 이미 하던 진행이 있어요」 버튼이 있다. → `OK 새 브라우저에 코드로 이어 하기 버튼`
4. 버튼 → 코드 입력 → 찾기 → 확인 창에 `코인 1234` 가 보인다 → 바꾸기 → localStorage 사본의 `state.coins === 1234`, 꾸미기 화면이 닫힌다. → `OK 코드로 진행을 되찾는다`
5. 같은 코드로 탭 두 개를 연다. 탭 A 에서 코인을 바꾸고 5초 기다린다. 탭 B 에서 코인을 바꾸고 5초 기다린다 → 탭 B 화면에 "다른 곳에서 한 진행으로 바꿨어요" 가 보인다. → `OK 탭 두 개 충돌 안내`
6. 서버를 끄지 않고 `VITE_ROOM_SERVER` 없이 띄운 게임(포트 5191)에서는 `seommaeul-cloud-v1` 이 생기지 않고 「☁️」 표시가 없다. → `OK 서버 주소가 없으면 꺼짐`

- [ ] **Step 2: 실행**

Run: `node tools/cloud-check.mjs http://127.0.0.1:5190`
Expected: 6줄 모두 `OK`
Run: `node tools/save-smoke.mjs && node tools/room-smoke.mjs && node tools/multiplayer-check.mjs http://127.0.0.1:5190 && node tools/hub-entry-check.mjs http://127.0.0.1:5190 && node tools/meadow-check.mjs http://127.0.0.1:5190`
Expected: 모두 OK (room-smoke 50/50, multiplayer 18/18, hub-entry 13/13, meadow-check 202/202). 각 도구의 인자 형식은 파일 머리말에 적힌 대로 따른다.

- [ ] **Step 3: README** — "허브 로비 연결" 절 앞에 절을 더한다:

```markdown
## 진행 저장 (서버)

진행(코인·가방·도감·장비·어항 등, `progressStore`)은 브라우저에 사본을 두고 방 서버(`rinfish-rooms`)의 `/save` 에 정본을 저장한다. 설정·마지막 위치·닉네임은 브라우저에만 둔다.

- 처음 열면 **복구 코드**(20자)가 생긴다. ESC 메뉴 「☁️ 진행 저장」에서 보고 복사할 수 있고, 시작 창·처음 꾸미기 화면의 「🔑 코드로 이어 하기」로 다른 브라우저에서 되찾는다.
- 서버나 인터넷이 끊겨도 플레이는 계속되고, 돌아오면 밀린 저장을 올린다. 같은 코드로 두 곳에서 하면 늦게 올린 쪽이 최신을 받아 이어 한다.
- `VITE_ROOM_SERVER` 가 없으면 서버 저장이 꺼지고 지금처럼 브라우저에만 저장한다.
- ⚠️ 복구 코드는 허브 로그인이 생기기 전까지 쓰는 임시 방식이다. **허브 로그인이 구현되면 로그인 방식으로 바꾼다** (설계: `docs/superpowers/specs/2026-11-26-server-save-design.md` 「허브 로그인 전환」).
- 확인: `node tools/save-smoke.mjs` (서버), `node tools/cloud-check.mjs http://127.0.0.1:5190` (브라우저).
```

- [ ] **Step 4: Commit**

```bash
git add tools/cloud-check.mjs README.md
git commit -m "docs: 진행 서버 저장 안내와 헤드리스 확인" -m "README 에 복구 코드·장애 때 동작·허브 로그인 전환 예정을 적고, tools/cloud-check.mjs 로 올리기·되찾기·충돌·꺼짐을 확인한다."
```

---

## 배포 (사용자가 말할 때만)

1. `npx wrangler deploy --config server/wrangler.toml` — 마이그레이션 v2 로 `Save` 생성. 방 기능은 그대로라 먼저 올려도 된다.
2. PR 머지 → Vercel 자동 배포.
3. 배포 뒤 https://seommaeul.vercel.app 에서 Network 탭에 `/save` 200 확인.
