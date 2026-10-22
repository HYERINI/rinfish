import type { Material } from 'three'
import { WIND } from '../../data/decor'

/** 모든 흔들리는 풀·꽃이 함께 쓰는 시간. WindClock 이 매 프레임 올린다 */
export const windUniforms = { uWindTime: { value: 0 } }

/**
 * 재질에 바람을 넣는다. 정점 셰이더에서 높이(y)에 비례해 옆으로 밀어서 밑동은 그대로, 끝만 흔들린다.
 * 인스턴스마다 자리(instanceMatrix 의 이동값)로 위상을 달리해 물결처럼 지나간다
 * strength: 1 = WIND.sway (높이 1m 당 밀리는 거리)
 */
export function addWind<T extends Material>(material: T, strength = 1): T {
  const sway = (WIND.sway * strength).toFixed(4)
  const speed = WIND.speed.toFixed(4)
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = windUniforms.uWindTime
    shader.vertexShader = `uniform float uWindTime;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      /* glsl */ `#include <begin_vertex>
      // 바람은 섬 전체에서 같은 방향(월드 +x 쪽)으로 분다
      vec3 windDir = vec3(1.0, 0.0, 0.35);
      #ifdef USE_INSTANCING
        vec2 windAt = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
        // 인스턴스마다 돌린 만큼 되돌려서, 모델 좌표에서 밀어도 월드에선 같은 쪽으로 눕게 한다
        windDir = transpose(mat3(instanceMatrix)) * windDir / length(instanceMatrix[0].xyz);
      #else
        vec2 windAt = vec2(0.0);
      #endif
      float windT = uWindTime * ${speed};
      // 큰 물결(섬을 가로질러 지나감) + 잔떨림
      float gust = sin(windT - windAt.x * 0.35 - windAt.y * 0.12) * 0.7 + sin(windT * 2.3 + windAt.x * 1.7 - windAt.y * 1.3) * 0.3;
      transformed += windDir * (gust + 0.4) * max(position.y, 0.0) * ${sway};`,
    )
  }
  material.customProgramCacheKey = () => `wind-${sway}`
  return material
}
