import { create } from 'zustand';

export type PostFXMode = 'none' | 'bloom' | 'bloom+ssao';
export type MaterialQuality = 'basic' | 'standard' | 'physical';
export type FrameLoop = 'always' | 'demand';
export type ShadowMapSize = 0 | 512 | 1024 | 2048;
interface SceneState {
  productCount: number;
  shadowMapSize: ShadowMapSize;
  pixelRatio: number;
  postFX: PostFXMode;
  materialQuality: MaterialQuality;
  frameloop: FrameLoop;
  robotRunning: boolean;
  conveyorSpeed: number;
  fps: number;
  setParam: <K extends keyof Omit<SceneState, 'setParam' | 'setFps'>>(key: K, value: SceneState[K]) => void;
  setFps: (fps: number) => void;
}

export const useSceneStore = create<SceneState>((set) => ({
  productCount: 30,
  shadowMapSize: 1024,
  pixelRatio: 1.0,
  postFX: 'none',
  materialQuality: 'standard',
  frameloop: 'always',
  robotRunning: true,
  conveyorSpeed: 1.0,
  fps: 0,
  setParam: (key, value) => set({ [key]: value } as Partial<SceneState>),
  setFps: (fps) => set({ fps }),
}));
