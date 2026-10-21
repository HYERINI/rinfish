import { AmbientLight, DirectionalLight, OrthographicCamera, Scene, SRGBColorSpace, Vector3, WebGLRenderer } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { restBox } from '../modelBounds'
import { fishModelFor, fishModelUrl } from './fishModels'

/** 썸네일 이미지 크기(px). 화면에는 이보다 작게 그려서 선명하게 보이게 한다 */
const WIDTH = 320
const HEIGHT = 180

const cache = new Map<string, Promise<string>>()
let renderer: WebGLRenderer | null = null

/**
 * 결과 카드·도감용 물고기 사진. 3D 모델을 옆모습으로 한 번 그려서 PNG data URL 로 돌려준다.
 * 패널마다 Canvas 를 띄우면 WebGL 컨텍스트가 모자라므로 렌더러 하나를 돌려 쓰고 결과는 모델별로 캐시한다
 */
export function fishThumbnail(speciesId: string): Promise<string> {
  const url = fishModelUrl(fishModelFor(speciesId))
  let image = cache.get(url)
  if (!image) {
    image = renderThumbnail(url)
    cache.set(url, image)
  }
  return image
}

async function renderThumbnail(url: string): Promise<string> {
  const { scene: model } = await new GLTFLoader().loadAsync(url)
  renderer ??= new WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true })
  renderer.setSize(WIDTH, HEIGHT, false)
  renderer.outputColorSpace = SRGBColorSpace

  const scene = new Scene()
  scene.add(new AmbientLight(0xffffff, 1.4))
  const sun = new DirectionalLight(0xffffff, 2.2)
  sun.position.set(1, 3, 4)
  scene.add(sun)

  // 머리(+z)가 화면 오른쪽(+x)을 보게 돌린다
  model.rotation.y = Math.PI / 2
  scene.add(model)

  // 물고기가 화면을 꽉 채우도록 경계 상자에 맞춘 직교 카메라
  const box = restBox(model)
  const size = box.getSize(new Vector3())
  const center = box.getCenter(new Vector3())
  const aspect = WIDTH / HEIGHT
  const half = Math.max(size.y, size.x / aspect) * 0.6
  const camera = new OrthographicCamera(-half * aspect, half * aspect, half, -half, 0.01, 1000)
  camera.position.set(center.x, center.y, center.z + size.z + 10)
  camera.lookAt(center)

  renderer.render(scene, camera)
  return renderer.domElement.toDataURL('image/png')
}
