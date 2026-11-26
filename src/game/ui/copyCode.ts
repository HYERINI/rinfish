/** 복구 코드 복사. 클립보드가 없거나 막히면 직접 적어 두라고 알린다 */
export async function copyCode(text: string, clipboard: Pick<Clipboard, 'writeText'> | undefined, notify: (t: string) => void) {
  try {
    if (!clipboard) throw new Error('no clipboard')
    await clipboard.writeText(text)
    notify('복구 코드를 복사했어요')
  } catch {
    notify('복사하지 못했어요. 코드를 직접 적어 두세요')
  }
}
