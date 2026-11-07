/** 글자를 치는 칸(입력창·여러 줄 입력·선택 상자·편집 가능한 요소)에서 누른 키인가. 이 키는 게임 조작으로 쓰지 않는다 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target.getAttribute('contenteditable') === 'true' ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}
