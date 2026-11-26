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
