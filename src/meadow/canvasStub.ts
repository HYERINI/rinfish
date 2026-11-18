/**
 * 테스트용: jsdom 캔버스엔 2D 그리기가 없어서(getContext 가 null) 은지 사격장 글씨·과녁 그림이 깨진다.
 * 무엇을 불러도 아무 일도 없는 가짜 2D 를 돌려준다. 되돌리는 함수를 돌려준다
 */
export function stubCanvas2d(): () => void {
  const proto = HTMLCanvasElement.prototype
  const original = proto.getContext
  const fake = new Proxy({}, { get: (_, key) => (key === 'measureText' ? () => ({ width: 0 }) : () => undefined), set: () => true })
  proto.getContext = (() => fake) as unknown as typeof proto.getContext
  return () => {
    proto.getContext = original
  }
}
