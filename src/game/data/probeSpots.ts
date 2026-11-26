/**
 * 그리기 측정 자리 [이름, x, z]. 측정 창(?probe)의 이동 버튼과 tools/render-measure.mjs 가 같은 자리를 쓴다 (바꾸면 둘 다).
 * 처음 서는 자리(START_SPOT)는 초원 (160, -12)
 */
export const PROBE_SPOTS: [string, number, number][] = [
  ['초원 시작', 160, -12],
  ['초원 가운데', 140, 20],
  ['초원 물가', 95.5, -3],
  ['섬 가운데', 0, 12],
  ['섬 동쪽', 24, 0],
]
