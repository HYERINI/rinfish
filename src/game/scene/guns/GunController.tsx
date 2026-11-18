import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { Raycaster, Vector3, type Mesh, type Object3D } from 'three'
import { meadowRange } from '../../../meadow/meadowSingleton'
import { countRangeShot } from '../../../meadow/rangeActions'
import { weaponSfx } from '../../audio/weaponSfx'
import { GUNS, GUN_RANGE, VIEW_MODEL, isGun, type GunId } from '../../data/guns'
import { gunFx } from '../../guns/gunFx'
import { newShotId, setShotHandler } from '../../guns/gunNet'
import { gunRig, markHit, type LastShot } from '../../guns/gunRig'
import { animalViews } from '../../hunt/animalRig'
import { shootAnimal } from '../../hunt/huntActions'
import { holdTrigger, isAimHeld, isTriggerHeld, takeAttackPress, takeReloadPress } from '../../input/pointer'
import { canReload } from '../../logic/ammo'
import { finishReload, heatNow, pullTrigger, recoilOf, spreadOf, startReload, swapGun } from '../../logic/gun'
import { countHits, firstBodyHit, pelletDirs } from '../../logic/hitscan'
import { netNow, peerBodies } from '../../net/remoteRig'
import { useNetStore } from '../../stores/netStore'
import { useProgressStore } from '../../stores/progressStore'
import { useSessionStore } from '../../stores/sessionStore'
import { FOOT_Y, playerRig } from '../Player'

/** 3인칭: 카메라 ~ 눈 사이(내 몸)는 건너뛰고, 눈보다 이만큼 앞에서부터 맞는다 (은지 aimRay) */
const EYE_SKIP = 0.35
/** 남이 쏜 소리는 이만큼(m) 안에서만 (은지 remoteShot) */
const REMOTE_SOUND = 60
/** 남이 쏜 궤적은 쏜 사람 몸을 건너뛰고 그린다 (은지 ray.near 0.6) */
const REMOTE_SKIP = 0.6

// 매 프레임 new 하지 않도록 재사용
const origin = new Vector3()
const dir = new Vector3()
const eye = new Vector3()
const end = new Vector3()
const from = new Vector3()
const normal = new Vector3()
const start = new Vector3()
const along = new Vector3()
const boardHit = new Raycaster()

/** 장면에 붙어 있나 (초원 모델이 다 오기 전엔 사격장이 은지 좌표 그대로라 섬 근처에 유령 표적이 생긴다) */
function inScene(o: Object3D): boolean {
  for (let p: Object3D | null = o; p; p = p.parent) if ((p as { isScene?: boolean }).isScene) return true
  return false
}

/** 쏠 수 있는 때: 탐험 중, 먹거나 감정 표현 중이 아닐 때 (낚시·배·잠·패널·T 바퀴는 mode 가 explore 가 아니다) */
function canShoot(): boolean {
  const s = useSessionStore.getState()
  return s.mode === 'explore' && !s.playerAction.eat && !s.playerAction.emote
}

/** 장전 시작 (R 이나 빈 탄창). manual: R 을 눌렀다 (예비가 없으면 알린다) */
function tryReload(gun: GunId, now: number, manual: boolean) {
  const { ammo, reserve } = useProgressStore.getState()
  const next = startReload(gunRig, gun, now, canReload(ammo, reserve, gun))
  if (next) {
    Object.assign(gunRig, next)
    weaponSfx.reload(GUNS[gun].reload)
  } else if (manual && reserve[gun] === 0 && !gunRig.reload) {
    useSessionStore.getState().notify('예비 탄약이 없어요 · 마을 잡화점에서 사요')
  }
}

/**
 * 화면엔 아무것도 그리지 않는다. 총을 든 채 마우스 왼쪽(연사 총은 누르고 있는 동안)·폰 쏘기 버튼으로 쏘고, 오른쪽으로 조준, R 로 장전한다 (은지 WeaponSystem).
 * 화면 가운데(카메라)에서 광선: 알마다 처음 닿는 것 = 동물(판정 기둥) · 다른 사람(캡슐, PvP) · 사격장 표적판(점수, 판에 자국) · 벽(Rapier 고정 충돌체, 총알 자국).
 * 반동·퍼짐·연사는 은지 수치. 같이 하는 중엔 동물·사람 명중을 서버에 알리고(맞은 알 수를 모아 한 번), 남들 화면에 궤적(shot)을 보낸다.
 * 남이 쏜 것도 여기서 그린다 (벽에 닿는 곳까지 궤적, 총구 불꽃, 60m 안이면 소리)
 */
export function GunController() {
  const { world, rapier } = useRapier()
  const camera = useThree((s) => s.camera)
  const ray = useRef<InstanceType<typeof rapier.Ray> | null>(null)

  // 남이 쏜 것 (같이 하기 shot): 판정 없이 궤적·불꽃·소리만
  useEffect(() => {
    const seen = new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 })
    setShotHandler((o, d, w) => {
      seen.origin = { x: o[0] + d[0] * REMOTE_SKIP, y: o[1] + d[1] * REMOTE_SKIP, z: o[2] + d[2] * REMOTE_SKIP }
      seen.dir = { x: d[0], y: d[1], z: d[2] }
      const wall = world.castRay(seen, GUN_RANGE, true, rapier.QueryFilterFlags.ONLY_FIXED | rapier.QueryFilterFlags.EXCLUDE_SENSORS)
      const t = REMOTE_SKIP + (wall ? wall.timeOfImpact : GUN_RANGE)
      const at = new Vector3(o[0], o[1], o[2])
      gunFx.tracer(at, new Vector3(o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t))
      gunFx.flash(at)
      if (at.distanceTo(playerRig.position) < REMOTE_SOUND) weaponSfx.shot(w)
    })
    return () => setShotHandler(() => {})
  }, [world, rapier])

  /** 한 발 쏘기 (산탄총은 여덟 알) */
  const shoot = (gun: GunId, now: number, spread: number) => {
    camera.getWorldPosition(origin)
    camera.getWorldDirection(dir)
    eye.set(playerRig.position.x, playerRig.position.y + FOOT_Y + playerRig.eyeHeight, playerRig.position.z)
    const near = Math.max(0, origin.distanceTo(eye) - EYE_SKIP)
    // 총구 (없으면 눈 앞 0.3m: 조준경으로 볼 때. 남들이 보는 궤적도 내 몸에서 나가게)
    const muzzle = gunRig.muzzle ? from.copy(gunRig.muzzle) : from.copy(eye).addScaledVector(dir, 0.3)
    const net = useNetStore.getState()
    const online = net.phase !== 'off'
    const animals = animalViews(online, netNow())
    const peers = online ? peerBodies(netNow()) : []
    const hitPeers: string[] = []
    const r = (ray.current ??= new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }))
    const struck: number[] = []
    let first: LastShot['hit'] | undefined
    const range = meadowRange()
    const boards: Mesh[] = range.targets.map((t) => t.board).filter(inScene)
    let best = 0
    for (const d of pelletDirs(dir, spread, GUNS[gun].pellets, Math.random)) {
      const body = firstBodyHit(origin, d, near, GUN_RANGE, animals, peers)
      r.origin = { x: origin.x + d.x * near, y: origin.y + d.y * near, z: origin.z + d.z * near }
      r.dir = d
      const wall = world.castRayAndGetNormal(r, GUN_RANGE - near, true, rapier.QueryFilterFlags.ONLY_FIXED | rapier.QueryFilterFlags.EXCLUDE_SENSORS)
      const wallT = wall ? near + wall.timeOfImpact : Infinity
      boardHit.set(start.set(r.origin.x, r.origin.y, r.origin.z), along.set(d.x, d.y, d.z))
      boardHit.far = GUN_RANGE - near
      const board = boards.length ? boardHit.intersectObjects(boards, false)[0] : undefined
      const boardT = board ? near + board.distance : Infinity
      const t = Math.min(body?.t ?? Infinity, wallT, boardT, GUN_RANGE)
      end.set(origin.x + d.x * t, origin.y + d.y * t, origin.z + d.z * t)
      let hit: LastShot['hit'] = null
      if (body && body.t <= Math.min(wallT, boardT)) {
        hit = body.kind
        if (body.kind === 'animal') struck.push(body.id)
        else hitPeers.push(body.id)
      } else if (board && boardT <= wallT) {
        hit = 'target'
        const target = range.targets.find((x) => x.board === board.object)
        if (target) {
          best = Math.max(best, range.hit(target, board.point, 0))
          gunFx.hole(board.point, normal.set(0, 0, 1), target.board)
        }
      } else if (wall) {
        hit = 'wall'
        gunFx.hole(end, normal.set(wall.normal.x, wall.normal.y, wall.normal.z))
      }
      first ??= hit
      gunFx.tracer(muzzle, end)
    }
    gunRig.lastShot = { o: { x: origin.x, y: origin.y, z: origin.z }, d: { x: dir.x, y: dir.y, z: dir.z }, hit: first ?? null }
    // 한 발이 여럿을 맞히면 같은 번호로 보낸다 (서버가 간격에 걸지 않고 모두 받는다)
    const shotId = newShotId()
    for (const [id, n] of countHits(struck)) shootAnimal(id, gun, n, shotId)
    for (const [id, n] of countHits(hitPeers)) net.sendPvpHit(id, gun, n, shotId)
    countRangeShot(best)
    if (best > 0) markHit(now, `+${best}`)
    else if (struck.length || hitPeers.length) markHit(now)
    net.sendShot([muzzle.x, muzzle.y, muzzle.z], [dir.x, dir.y, dir.z], gun)
    gunFx.flash(muzzle)
    weaponSfx.shot(gun)
    gunRig.kick += recoilOf(gun, gunRig.aiming, (gunRig.optic?.mag ?? 1) > 1)
    gunRig.viewKick = VIEW_MODEL.kick
  }

  useFrame(() => {
    const now = performance.now() / 1000
    const session = useSessionStore.getState()
    const gun = isGun(session.tool) ? session.tool : null
    // 총을 바꾸면 장전·열기를 지우고 0.25초 뒤부터 쏜다
    if (gun !== gunRig.gun) Object.assign(gunRig, swapGun(gunRig, now), { gun })
    const done = finishReload(gunRig, now)
    if (done) {
      Object.assign(gunRig, done.state)
      useProgressStore.getState().reloadGun(done.gun)
    }
    const reloadKey = takeReloadPress()
    if (!gun) {
      gunRig.aiming = false
      gunRig.optic = null
      // 폰 쏘기 버튼을 누른 채 칼로 바꿨다: 다음에 총을 들 때 저절로 쏘지 않게
      holdTrigger(false)
      return
    }
    // 총을 들었을 때만 누른 것을 가져간다 (아니면 MeleeController 가 휘두르기로 가져간다)
    const press = takeAttackPress()
    const ready = canShoot()
    gunRig.aiming = ready && isAimHeld()
    // 조준 중인 소총·저격총은 고른 배율로 조준경을 본다 (휠로 바꾼다)
    const zoom = GUNS[gun].zoom
    gunRig.optic = gunRig.aiming && zoom ? zoom[gunRig.zoomStep[gun]] : null
    if (!ready) {
      // 쏠 수 없는 때(잠·창·먹기)에 폰 쏘기 버튼이 눌린 채 남지 않게 (쓰러진 뒤 일어나 소총이 저절로 쏘던 것)
      holdTrigger(false)
      return
    }
    if (reloadKey) tryReload(gun, now, true)
    const want = GUNS[gun].auto ? isTriggerHeld() || press === 'primary' : press === 'primary'
    if (!want) return
    const heat = heatNow(gunRig, now)
    const progress = useProgressStore.getState()
    const t = pullTrigger(gunRig, gun, now, progress.ammo[gun])
    Object.assign(gunRig, t.state)
    if (t.kind === 'empty') {
      weaponSfx.dry()
      tryReload(gun, now, false)
    } else if (t.kind === 'fire' && progress.fireRound(gun)) {
      shoot(gun, now, spreadOf(gun, gunRig.aiming, heat))
    }
  })
  return null
}
