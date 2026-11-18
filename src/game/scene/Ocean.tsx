import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, PlaneGeometry, ShaderMaterial, Vector2, Vector3 } from 'three'
import { MEADOW_RECT, SKY_DAY } from '../data/meadow'
import { ISLAND_RADIUS, WATER_Y } from '../data/zones'
import { WAVES } from '../logic/waves'

/** 바다 판: 섬(원점)과 초원(x 90..290)을 다 덮는다 (x -90..360, z -180..160). 격자 한 칸 1.5m */
const SEA = { width: 450, depth: 340, centerX: 135, centerZ: -10, segX: 300, segZ: 230 }
/** 판 가장자리에서 이만큼(m) 안쪽부터 하늘색·투명으로 흐려져 판 끝이 하늘에 선으로 보이지 않는다 */
const EDGE_FADE = 40

// logic/waves.ts 의 waveHeight 와 같은 식을 GLSL 로 만든다 (찌가 물결을 따라가도록)
const waveGlsl = WAVES.map((w) => {
  const len = Math.hypot(w.dirX, w.dirZ)
  const dx = (w.dirX / len).toFixed(4)
  const dz = (w.dirZ / len).toFixed(4)
  const k = ((2 * Math.PI) / w.length).toFixed(4)
  // 높이와, 기울기(법선 계산용)를 함께 더한다
  return `
    phase = ${k} * (${dx} * p.x + ${dz} * p.y) + ${w.speed.toFixed(4)} * uTime;
    h += ${w.amp.toFixed(4)} * sin(phase);
    slope += ${w.amp.toFixed(4)} * ${k} * cos(phase) * vec2(${dx}, ${dz});`
}).join('')

const vertexShader = /* glsl */ `
  uniform float uTime;
  varying vec3 vWorld;
  varying vec3 vNormal;

  void main() {
    vec2 p = position.xz;
    float h = 0.0;
    float phase;
    vec2 slope = vec2(0.0);
    ${waveGlsl}
    vec3 pos = vec3(position.x, position.y + h, position.z);
    vNormal = normalize(vec3(-slope.x, 1.0, -slope.y));
    vec4 world = modelMatrix * vec4(pos, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uSky;
  uniform vec3 uFoam;
  uniform vec3 uSunDir;
  uniform float uShore;
  uniform vec2 uMeadowCenter;
  uniform vec2 uMeadowHalf;
  uniform vec2 uSeaCenter;
  uniform vec2 uSeaHalf;
  uniform float uEdgeFade;
  varying vec3 vWorld;
  varying vec3 vNormal;

  void main() {
    // 잔물결: 화면에 보이는 반짝임용으로 법선만 살짝 흔든다
    vec2 q = vWorld.xz;
    // 방향이 서로 엇갈린 잔물결을 겹쳐 바둑판무늬가 생기지 않게 하고, 멀리서는 줄인다
    vec2 ripple = vec2(0.0);
    ripple += vec2(0.83, 0.56) * sin(dot(q, vec2(0.83, 0.56)) * 1.9 + uTime * 2.1);
    ripple += vec2(-0.39, 0.92) * sin(dot(q, vec2(-0.39, 0.92)) * 2.7 - uTime * 1.7);
    ripple += vec2(0.97, -0.24) * sin(dot(q, vec2(0.97, -0.24)) * 3.6 + uTime * 2.6);
    ripple += vec2(-0.71, -0.70) * sin(dot(q, vec2(-0.71, -0.70)) * 1.3 + uTime * 1.2);
    float near = 1.0 - smoothstep(20.0, 90.0, length(cameraPosition - vWorld));
    ripple *= 0.07 * near;
    vec3 n = normalize(vNormal + vec3(ripple.x, 0.0, ripple.y));
    vec3 viewDir = normalize(cameraPosition - vWorld);

    // 가장 가까운 땅(섬 원·초원 사각형)의 가장자리까지 거리. 멀어질수록 얕은 청록 → 깊은 파랑
    float island = length(vWorld.xz) - uShore;
    vec2 q2 = abs(vWorld.xz - uMeadowCenter) - uMeadowHalf;
    float meadow = length(max(q2, 0.0)) + min(max(q2.x, q2.y), 0.0);
    float edge = min(island, meadow);
    float shallow = 1.0 - smoothstep(0.0, 14.0, edge);
    vec3 color = mix(uDeep, uShallow, shallow);

    // 비스듬히 볼수록 하늘이 비친다
    float fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
    color = mix(color, uSky, fresnel * 0.6);

    // 햇빛 반짝임
    vec3 halfDir = normalize(uSunDir + viewDir);
    float spec = pow(max(dot(n, halfDir), 0.0), 160.0);
    color += vec3(1.0) * spec * 1.4;

    // 해안선 거품: 땅 가장자리에서 밀려왔다 빠지는 흰 띠
    float wobble = sin(atan(vWorld.z, vWorld.x) * 14.0 + uTime * 1.5) * 0.25 + sin(uTime * 1.2) * 0.3;
    float foam = 1.0 - smoothstep(0.0, 1.0, edge - wobble);
    foam *= step(0.0, edge + 0.3);
    color = mix(color, uFoam, foam * 0.85);

    float alpha = mix(0.93, 0.62, shallow);
    alpha = max(alpha, foam);

    // 먼 바다는 하늘색으로 흐려져 수평선이 자연스럽게 보인다
    float far = smoothstep(70.0, 150.0, length(cameraPosition.xz - vWorld.xz));
    // 판 가장자리 가까이는 카메라가 가까워도 하늘색으로 흐려지고 투명해진다 (톤 매핑을 안 거치는 배경색과 끝에서 딱 맞게)
    vec2 toEdge = uSeaHalf - abs(vWorld.xz - uSeaCenter);
    float rim = 1.0 - smoothstep(0.0, uEdgeFade, min(toEdge.x, toEdge.y));
    color = mix(color, uSky, max(far, rim));
    alpha *= 1.0 - rim;

    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

/** 물결치는 바다. 섬 둘레는 얕고 밝게, 멀리는 깊고 어둡게 보인다 */
export function Ocean() {
  const geometry = useMemo(() => {
    // 처음부터 바닥(xz)에 눕힌 평면을 만들어서 셰이더에서 position.xz 를 그대로 쓴다.
    // 메시는 원점에 두고 판만 옮겨서 position.xz 가 곧 세계 좌표다
    const g = new PlaneGeometry(SEA.width, SEA.depth, SEA.segX, SEA.segZ)
    g.rotateX(-Math.PI / 2)
    g.translate(SEA.centerX, 0, SEA.centerZ)
    return g
  }, [])

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        uniforms: {
          uTime: { value: 0 },
          uDeep: { value: new Color('#0b5ea8') },
          uShallow: { value: new Color('#36c9cf') },
          uSky: { value: new Color(SKY_DAY) },
          uFoam: { value: new Color('#ffffff') },
          // 은지 해(정오): 은지 좌표 (0, 18, 6) → 180° 돌려 세계 (0, 18, -6)
          uSunDir: { value: new Vector3(0, 18, -6).normalize() },
          uShore: { value: ISLAND_RADIUS },
          uMeadowCenter: { value: new Vector2((MEADOW_RECT.x0 + MEADOW_RECT.x1) / 2, (MEADOW_RECT.z0 + MEADOW_RECT.z1) / 2) },
          uMeadowHalf: { value: new Vector2((MEADOW_RECT.x1 - MEADOW_RECT.x0) / 2, (MEADOW_RECT.z1 - MEADOW_RECT.z0) / 2) },
          uSeaCenter: { value: new Vector2(SEA.centerX, SEA.centerZ) },
          uSeaHalf: { value: new Vector2(SEA.width / 2, SEA.depth / 2) },
          uEdgeFade: { value: EDGE_FADE },
        },
      }),
    [],
  )

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime
  })

  // renderOrder: 물속 물고기 그림자(0)를 먼저 그리고 물을 위에 덮는다
  return <mesh geometry={geometry} material={material} position={[0, WATER_Y, 0]} renderOrder={1} />
}
