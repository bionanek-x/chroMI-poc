import { create } from 'zustand';

export type PostFXMode = 'none' | 'bloom' | 'bloom+ssao';
export type MaterialQuality = 'basic' | 'standard' | 'physical';
export type FrameLoop = 'always' | 'demand';
export type ShadowMapSize = 0 | 512 | 1024 | 2048;

export interface PalletStack {
  id: string;
}

let nextStackId = 2;

interface SceneState {
  productCount: number;
  palletLayers: number;
  stacks: PalletStack[];
  shadowMapSize: ShadowMapSize;
  pixelRatio: number;
  postFX: PostFXMode;
  materialQuality: MaterialQuality;
  frameloop: FrameLoop;
  robotRunning: boolean;
  conveyorSpeed: number;
  fps: number;
  setParam: <K extends keyof Omit<SceneState, 'setParam' | 'setFps' | 'addStack' | 'removeStack'>>(key: K, value: SceneState[K]) => void;
  setFps: (fps: number) => void;
  addStack: () => void;
  removeStack: (id: string) => void;
  mountGeneration: number;
  remounting: boolean;
  remountAll: () => void;
}

export const useSceneStore = create<SceneState>((set) => ({
  productCount: 30,
  palletLayers: 3,
  stacks: [{ id: '1' }],
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
  addStack: () => set((s) => ({ stacks: [...s.stacks, { id: String(nextStackId++) }] })),
  removeStack: (id) => set((s) => ({ stacks: s.stacks.filter((st) => st.id !== id) })),
  mountGeneration: 0,
  remounting: false,
  remountAll: () => {
    set({ remounting: true });
    requestAnimationFrame(() =>
      set((s) => ({ remounting: false, mountGeneration: s.mountGeneration + 1 })),
    );
  },
}));
