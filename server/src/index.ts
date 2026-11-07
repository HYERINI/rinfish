import type { Env } from './room'

export { Room } from './room'

/** /rooms/<방 id 32자> 만 받아 그 방(Durable Object)으로 넘긴다 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const match = new URL(request.url).pathname.match(/^\/rooms\/([0-9a-f]{32})$/)
    if (!match) return new Response('not found', { status: 404 })
    return env.ROOM.get(env.ROOM.idFromName(match[1])).fetch(request)
  },
} satisfies ExportedHandler<Env>
