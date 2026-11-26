import { DurableObject } from 'cloudflare:workers'
import type { Env } from './room'
import { SAVE_MAX_BYTES, handleSave, readLimited, type StoredSave } from './saveRules'

/**
 * 복구 코드 하나의 진행 저장 (객체 이름 = 'code:' + 코드의 sha256). 요청을 하나씩 차례로 처리하므로 저장 번호 판정이 섞이지 않는다.
 * 규칙은 saveRules.handleSave 에 있고 여기서는 저장소를 읽고 쓰기만 한다
 */
export class Save extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    // 한도+1 바이트에서 읽기를 멈춘다 (본문 전체를 메모리에 올리지 않는다)
    const text = request.method === 'PUT' ? await readLimited(request.body, SAVE_MAX_BYTES) : ''
    if (text === null) return Response.json({}, { status: 413 })
    const stored = (await this.ctx.storage.get<StoredSave>('save')) ?? null
    const reply = handleSave(request.method, text, stored, Date.now())
    if (reply.store) await this.ctx.storage.put('save', reply.store)
    return Response.json(reply.body, { status: reply.status })
  }
}
