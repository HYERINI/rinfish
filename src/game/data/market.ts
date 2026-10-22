/** 찜 가게 (시설 id 는 그대로 'market') */
export const MARKET = {
  name: '미스터찜',
  owner: '사장님 배정빈',
  /** 키오스크를 열면 사장님이 하는 인사 */
  greeting: '어서 오세요~ 오늘도 푸짐하게!',
  /**
   * 간판 그림 (public 아래). 파일이 있으면 그 그림을, 없으면 "미스터찜" 글씨 간판을 그린다.
   * 가로:세로 = signSize 비율로 맞추면 늘어나지 않는다
   */
  signImage: 'signs/market.png',
  /** 글씨 간판 왼쪽에 넣는 사장님 얼굴 (배경을 지운 PNG) */
  signEmblem: 'signs/market-face.png',
  /** 간판 크기 [가로, 세로] (m) */
  signSize: [2.6, 0.8] as [number, number],
}
