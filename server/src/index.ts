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
