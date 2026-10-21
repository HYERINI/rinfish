# 캐릭터 빌드 도구

Quaternius 무료(Standard, CC0) 팩 세 개를 합쳐 꾸미기용 캐릭터 파일을 만든다.

- 결과: `public/models/characters/male.glb`, `female.glb`, `textures/peasant_alt.jpg`, `textures/ranger_alt.jpg`
- 쓰는 팩: Universal Base Characters, Modular Character Outfits - Fantasy, Universal Animation Library

## 순서

```bash
cd tools/build-characters
npm install
npm run fetch    # itch.io 에서 세 팩 zip 을 .cache/ 로 받아 푼다(로그인 없음, 이미 있으면 건너뜀). 합계 약 440MB
npm run build    # 성별마다 glb 를 만든다
npm run inspect  # 이름·뼈대·클립·크기를 검사한다. 실패하면 종료 코드 1
```

`.cache/`, `node_modules/` 는 git 에 올리지 않는다. 이 도구의 의존성은 이 폴더 `package.json` 에만 둔다.

## 만드는 방식

1. 그 성별 `*_Peasant_Body` 의 65개 뼈대를 파일의 유일한 뼈대(skin 1개)로 삼는다.
2. 몸(머리·목만 남김), 머리카락 5종(+남자 수염), 농부·레인저 옷 부위를 합치고, 각 부위 꼭짓점을 자기 역바인드 행렬 기준 자리로 옮겨 둔 뒤 기준 뼈대에 다시 묶는다. 다른 성별 머리카락도 Head 뼈에만 붙어 있어 그대로 맞는다(남자 `Hair_Buzzed` 는 여자 파일에서 5mm 부풀린다).
3. 재질 이름을 정리하고 노멀·ORM 텍스처를 뺀다. 피부 텍스처는 거의 흰색으로 밝힌다(게임이 `material.color` 로 피부색을 곱한다).
4. UAL 클립 13개만 남기고 크기 트랙과 골반 외 이동 트랙을 지운다. 골반 이동은 높이 비율로 맞춘다. 게임은 `bone.scale` 을 키(`root` 뼈 균일 배율)에만 쓰고, 몸 부위 배율은 인스턴스마다 복제한 역바인드 행렬에 뼈 로컬 축 배율을 곱해서, 팔·다리 길이와 어깨 너비는 자식 뼈(`lowerarm`·`hand`·`calf`·`foot`·`clavicle`)의 `position` 을 옮겨서 준다(`src/game/scene/characterAppearance.ts`). 크기·이동 트랙이 남아 있으면 애니메이션이 매 프레임 이 값들을 덮어써서 키와 길이 조절이 풀리므로 꼭 지운 채로 둔다.
5. 텍스처 1024 jpg, 꼭짓점 양자화(KHR_mesh_quantization)로 줄인다.

## 주의: 이름이 게임 코드와 맞물린다

노드·재질·클립 이름은 게임 코드(`src/game/data/characterParts.ts`)가 그대로 쓴다. `build.mjs` 의 이름을 바꾸면 그쪽도 함께 바꾸고 `inspect.mjs` 의 기대값도 고친다.

- 노드: `head`, `eyes`, `eyebrows`, `hair_simpleParted`, `hair_buzzed`, `hair_long`, `hair_buns`, `hair_buzzedFemale`, `beard`(남자만), `peasant_arms`, `peasant_body`, `peasant_legs`, `peasant_feet`, `ranger_arms`, `ranger_bracer`, `ranger_body`, `ranger_belt1`, `ranger_belt2`, `ranger_pauldron`, `ranger_legs`, `ranger_feet`, `ranger_hood`
  - `peasant_arms`, `ranger_arms` 는 옷+맨손 두 재질이라 three.js 에서 Group(자식 `*_1`, `*_2`)으로 읽힌다. 켜고 끄기는 이름 붙은 Group 에 한다
- 재질: `skin`, `skin_hands`, `hair`(머리카락 텍스처가 둘이라 같은 이름 재질이 2개), `peasant`, `ranger`, `eyes`
- 클립: `Idle_Loop`, `Walk_Loop`, `Jog_Fwd_Loop`, `Pistol_Aim_Up`, `Pistol_Aim_Neutral`, `Pistol_Aim_Down`, `Push_Loop`, `Dance_Loop`, `Death01`, `Crouch_Idle_Loop`, `Sitting_Enter`, `Sitting_Idle_Loop`, `Sitting_Exit`
- 대체 텍스처(`textures/*_alt.jpg`)는 `flipY = false`, sRGB 로 읽어 `peasant`/`ranger` 재질의 `map` 에 넣는다
