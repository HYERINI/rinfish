import { create } from 'zustand'
import type { CloudStatus } from '../net/cloudSave'

/** 서버 저장 화면 상태. ready: 로딩 화면이 더 기다리지 않아도 된다 (시작 동기화가 끝났거나 3초가 지남) */
type CloudState = { status: CloudStatus; ready: boolean; code: string | null }

export const useCloudStore = create<CloudState>()(() => ({ status: 'off', ready: true, code: null }))
