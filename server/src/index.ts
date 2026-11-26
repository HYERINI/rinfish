import type { Env } from './room'
import { allowOrigin, bearerCode, contentTooLarge, saveObjectName } from './saveRules'

export { Room } from './room'
export { Save } from './save'

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
  // 남용 막기: IP 마다 1분에 60번 (바인딩이 없는 곳에서는 건너뛴다)
  if (env.SAVE_LIMIT) {
    const { success } = await env.SAVE_LIMIT.limit({ key: request.headers.get('CF-Connecting-IP') ?? 'unknown' })
    if (!success) return withCors(Response.json({}, { status: 429 }), origin)
  }
  // 큰 본문은 읽기 전에 거절한다 (길이를 속여도 Save 객체가 한도까지만 읽는다)
  if (contentTooLarge(request.headers.get('Content-Length'))) return withCors(Response.json({}, { status: 413 }), origin)
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
