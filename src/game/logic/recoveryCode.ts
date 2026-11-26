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
