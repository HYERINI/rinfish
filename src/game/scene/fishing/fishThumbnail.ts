import { AmbientLight, Box3, DirectionalLight, Group, OrthographicCamera, Scene, SRGBColorSpace, Vector3, WebGLRenderer } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { fishLookFor, type FishModelId } from '../../data/fishLooks'
import { restBox } from '../modelBounds'
import { disposeObject, dressFish } from './fishAppearance'
import { fishModelUrl } from './fishModels'

/** 썸네일 이미지 크기(px). 화면에는 이보다 작게 그려서 선명하게 보이게 한다 */
const WIDTH = 320
const HEIGHT = 180

/** 옆모습으로는 납작해서 잘 안 보이는 모델은 등이 보이게 앞으로 기울인다 (라디안) */
const THUMB_TILT: Partial<Record<FishModelId, number>> = { manta: 0.9 }

/** 소품이 틀을 넓힐 수 있는 한도 (몸 크기 대비, 각 방향) */
const ACCESSORY_ROOM = 0.25

const cache = new Map<string, Promise<string>>()
let renderer: WebGLRenderer | null = null

/**
 * 결과 카드·도감용 물고기 사진. 3D 모델을 생김새(색·소품)대로 옆모습으로 한 번 그려서 PNG data URL 로 돌려준다.
 * 패널마다 Canvas 를 띄우면 WebGL 컨텍스트가 모자라므로 렌더러 하나를 돌려 쓰고 결과는 어종별로 캐시한다
 */
export function fishThumbnail(speciesId: string): Promise<string> {
  let image = cache.get(speciesId)
  if (!image) {
    const pending = renderThumbnail(speciesId)
    image = pending
    cache.set(speciesId, pending)
    // 실패한 결과는 남기지 않아서 다음에 다시 그려 보게 한다
    pending.catch(() => {
      if (cache.get(speciesId) === pending) cache.delete(speciesId)
    })
  }
  return image
}

async function renderThumbnail(speciesId: string): Promise<string> {
  const look = fishLookFor(speciesId)
  const { scene: model } = await new GLTFLoader().loadAsync(fishModelUrl(look.model))
  renderer ??= new WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true })
  renderer.setSize(WIDTH, HEIGHT, false)
  renderer.outputColorSpace = SRGBColorSpace

  const scene = new Scene()
  scene.add(new AmbientLight(0xffffff, 1.4))
  const sun = new DirectionalLight(0xffffff, 2.2)
  sun.position.set(1, 3, 4)
  scene.add(sun)

  // 3D 장면(FishModel)과 같은 생김새·배치: 색·소품을 입히고 몸길이를 맞춘다
  const { scale, offset, accessory } = dressFish(model, look)
  model.scale.setScalar(scale)
  model.position.copy(offset)
  const fish = new Group()
  fish.add(model)
  // 머리(+z)가 화면 오른쪽(+x)을 보게 돌린다
  fish.rotation.set(THUMB_TILT[look.model] ?? 0, Math.PI / 2, 0)
  scene.add(fish)

  // 물고기가 화면을 꽉 채우도록 경계 상자에 맞춘 직교 카메라. 소품(셀카봉·왕관 등)이 크게 튀어나와도
  // 물고기가 작아 보이지 않도록, 소품은 몸 둘레 조금 바깥(ACCESSORY_ROOM)까지만 틀에 넣는다
  const box = framingBox(fish, accessory)
  const size = box.getSize(new Vector3())
  const center = box.getCenter(new Vector3())
  const aspect = WIDTH / HEIGHT
  const half = Math.max(size.y, size.x / aspect) * 0.6
  const camera = new OrthographicCamera(-half * aspect, half * aspect, half, -half, 0.01, 1000)
  camera.position.set(center.x, center.y, center.z + size.z + 10)
  camera.lookAt(center)

  renderer.render(scene, camera)
  const image = renderer.domElement.toDataURL('image/png')
  disposeObject(fish) // 사진마다 새로 불러온 모델이라 지오메트리까지 정리한다
  return image
}

/** 몸을 기준으로 잡은 틀. 소품은 몸 둘레 ACCESSORY_ROOM 만큼까지만 반영한다 */
function framingBox(fish: Group, accessory: Group | null): Box3 {
  if (!accessory?.parent) return restBox(fish)
  const parent = accessory.parent
  parent.remove(accessory)
  const body = restBox(fish)
  parent.add(accessory)
  const room = body.getSize(new Vector3()).multiplyScalar(ACCESSORY_ROOM)
  const limit = body.clone().expandByVector(room)
  return restBox(fish).intersect(limit).union(body)
}
