import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, PlaneGeometry, ShaderMaterial, Vector3 } from 'three'
import { ISLAND_RADIUS, WATER_Y } from '../data/zones'
import { WAVES } from '../logic/waves'

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

    // 섬에서 멀어질수록 얕은 청록 → 깊은 파랑
    float dist = length(vWorld.xz);
    float shallow = 1.0 - smoothstep(uShore, uShore + 14.0, dist);
    vec3 color = mix(uDeep, uShallow, shallow);

    // 비스듬히 볼수록 하늘이 비친다
    float fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
    color = mix(color, uSky, fresnel * 0.6);

    // 햇빛 반짝임
    vec3 halfDir = normalize(uSunDir + viewDir);
    float spec = pow(max(dot(n, halfDir), 0.0), 160.0);
    color += vec3(1.0) * spec * 1.4;

    // 해안선 거품: 섬 가장자리에서 밀려왔다 빠지는 흰 띠
    float edge = dist - uShore;
    float wobble = sin(atan(vWorld.z, vWorld.x) * 14.0 + uTime * 1.5) * 0.25 + sin(uTime * 1.2) * 0.3;
    float foam = 1.0 - smoothstep(0.0, 1.0, edge - wobble);
    foam *= step(0.0, edge + 0.3);
    color = mix(color, uFoam, foam * 0.85);

    float alpha = mix(0.93, 0.62, shallow);
    alpha = max(alpha, foam);

    // 먼 바다는 하늘색으로 흐려져 수평선이 자연스럽게 보인다
    float far = smoothstep(70.0, 150.0, length(cameraPosition.xz - vWorld.xz));
    color = mix(color, uSky, far);

    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

/** 물결치는 바다. 섬 둘레는 얕고 밝게, 멀리는 깊고 어둡게 보인다 */
export function Ocean() {
  const geometry = useMemo(() => {
    // 처음부터 바닥(xz)에 눕힌 평면을 만들어서 셰이더에서 position.xz 를 그대로 쓴다
    const g = new PlaneGeometry(320, 320, 220, 220)
    g.rotateX(-Math.PI / 2)
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
          uSky: { value: new Color('#9fd8ff') },
          uFoam: { value: new Color('#ffffff') },
          uSunDir: { value: new Vector3(20, 30, 10).normalize() },
          uShore: { value: ISLAND_RADIUS },
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
