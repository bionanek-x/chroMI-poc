# HMI PoC — App Implementation Plan

Scope: everything from `pnpm create vite` to a fully instrumented test scene running in Chromium kiosk. VM/OS provisioning is out of scope here — see `hmi_poc_plan.md` Phase A.

---

## Phase 1 — Project Scaffold

**Goal:** a Vite + React + TS app that builds, runs, and passes type-checking.

### 1.1 Create the project

```bash
pnpm create vite@latest hmi-poc --template react-ts
cd hmi-poc
```

### 1.2 Install dependencies

```bash
# 3D
pnpm add three @react-three/fiber @react-three/drei

# On-screen keyboard
pnpm add react-simple-keyboard

# UI / animation
pnpm add framer-motion zustand

# State (for keyboard + scene params)
pnpm add zustand

# Dev / instrumentation
pnpm add -D r3f-perf leva stats.js
pnpm add -D @types/three vite-plugin-checker
```

### 1.3 Vite config

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',           // safe for file:// and arbitrary deploy paths
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three', '@react-three/fiber', '@react-three/drei'],
        },
      },
    },
  },
});
```

### 1.4 Global kiosk CSS

In `src/index.css` — add these at the top:

```css
*, *::before, *::after { box-sizing: border-box; }

html, body, #root {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #0a0a0a;

  /* Kiosk touch hardening */
  touch-action: manipulation;
  overscroll-behavior: none;
  user-select: none;
  -webkit-user-select: none;
}
```

### 1.5 Touch hardening provider

```tsx
// src/providers/TouchHardeningProvider.tsx
import { useEffect } from 'react';

export function TouchHardeningProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const handler = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault(); // block pinch-zoom
    };
    document.addEventListener('touchmove', handler, { passive: false });
    return () => document.removeEventListener('touchmove', handler);
  }, []);

  return <>{children}</>;
}
```

Wrap `<App />` with this in `main.tsx`.

**Exit criterion:** `pnpm dev` serves the app; `pnpm build` produces a clean `dist/`.

---

## Phase 2 — On-Screen Keyboard

**Goal:** any `<TouchInput>` component opens a context-aware keyboard overlay above the canvas without focus fighting.

### 2.1 Keyboard store (Zustand)

```ts
// src/stores/keyboardStore.ts
import { create } from 'zustand';

type Layout = 'default' | 'numeric';

interface KeyboardState {
  visible: boolean;
  layout: Layout;
  value: string;
  onCommit: ((v: string) => void) | null;
  open: (opts: { layout?: Layout; initial?: string; onCommit: (v: string) => void }) => void;
  close: () => void;
  setValue: (v: string) => void;
}

export const useKeyboardStore = create<KeyboardState>((set) => ({
  visible: false,
  layout: 'default',
  value: '',
  onCommit: null,
  open: ({ layout = 'default', initial = '', onCommit }) =>
    set({ visible: true, layout, value: initial, onCommit }),
  close: () => set({ visible: false, onCommit: null }),
  setValue: (value) => set({ value }),
}));
```

### 2.2 Keyboard overlay

```tsx
// src/components/KeyboardOverlay.tsx
import Keyboard from 'react-simple-keyboard';
import 'react-simple-keyboard/build/css/index.css';
import { useKeyboardStore } from '../stores/keyboardStore';

export function KeyboardOverlay() {
  const { visible, layout, value, setValue, close, onCommit } = useKeyboardStore();

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: '#1a1a1a', padding: '8px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
        <button onClick={() => { onCommit?.(value); close(); }}>Done</button>
        <button onClick={close} style={{ marginLeft: 8 }}>Cancel</button>
      </div>
      <Keyboard
        layoutName={layout}
        onChange={setValue}
        input={value}
      />
    </div>
  );
}
```

### 2.3 TouchInput component

```tsx
// src/components/TouchInput.tsx
import { useKeyboardStore } from '../stores/keyboardStore';

interface Props {
  value: string;
  onChange: (v: string) => void;
  layout?: 'default' | 'numeric';
  placeholder?: string;
}

export function TouchInput({ value, onChange, layout = 'default', placeholder }: Props) {
  const open = useKeyboardStore((s) => s.open);

  return (
    <input
      readOnly
      value={value}
      placeholder={placeholder}
      onFocus={() => open({ layout, initial: value, onCommit: onChange })}
      style={{ minHeight: 48, fontSize: 18, padding: '0 12px', cursor: 'pointer' }}
    />
  );
}
```

Mount `<KeyboardOverlay />` once at the app root, next to the canvas.

**Exit criterion:** tapping a `<TouchInput>` opens the keyboard overlay; Done commits the value; Cancel discards.

---

## Phase 3 — Performance Test Scene

**Goal:** a representative 3D scene of the packaging cell with adjustable load knobs and live telemetry.

### 3.1 Scene structure

```
src/
  scene/
    PackagingScene.tsx     — <Canvas> root, Perf overlay, scene graph
    Conveyor.tsx           — long box with scrolling UV animation
    ProductInstances.tsx   — instanced boxes via drei <Instances>
    RobotArm.tsx           — 6-joint kinematic chain (primitive meshes)
    PackingBox.tsx         — open cardboard box with texture
    SceneLighting.tsx      — HDRI env + directional light with shadow
    PostFX.tsx             — optional bloom + SMAA
```

### 3.2 Scene params store

```ts
// src/stores/sceneStore.ts
import { create } from 'zustand';

interface SceneParams {
  productCount: number;
  shadowMapSize: 0 | 512 | 1024 | 2048;
  pixelRatio: number;
  postFX: 'none' | 'bloom' | 'bloom+ssao';
  materialQuality: 'basic' | 'standard' | 'physical';
  frameloop: 'always' | 'demand';
  setParam: <K extends keyof SceneParams>(key: K, value: SceneParams[K]) => void;
}

export const useSceneStore = create<SceneParams>((set) => ({
  productCount: 30,
  shadowMapSize: 1024,
  pixelRatio: 1.0,
  postFX: 'none',
  materialQuality: 'standard',
  frameloop: 'always',
  setParam: (key, value) => set({ [key]: value }),
}));
```

Expose all params via a **leva** panel (toggle with `?debug=1` query param).

### 3.3 Conveyor

- `BoxGeometry` (long, flat).
- PBR `MeshStandardMaterial` with a normal map.
- Animate UV offset in `useFrame` to simulate belt motion.

### 3.4 Product instances

- `<Instances>` from drei — single draw call for N boxes.
- Randomize position/rotation on mount; add subtle per-product oscillation in `useFrame`.
- Count driven by `sceneStore.productCount`.

### 3.5 Robot arm

- 6 segments: base → shoulder → upper arm → forearm → wrist → gripper.
- Each segment is a `CylinderGeometry` + `BoxGeometry` for joint.
- Animate each joint angle with `Math.sin(elapsed * freq + phase)` in `useFrame`.
- Use nested `<group>` with a pivot transform per joint (no skeletal rig needed for PoC).

### 3.6 Packing box

- Open-top `BoxGeometry` with custom UVs.
- Cardboard texture (≤ 512×512).
- Products tween into it on a 1 s arc using `useFrame` lerp or Framer Motion 3D.

### 3.7 Lighting

```tsx
// src/scene/SceneLighting.tsx
import { Environment } from '@react-three/drei';

export function SceneLighting({ shadowMapSize }: { shadowMapSize: number }) {
  return (
    <>
      <Environment preset="warehouse" />
      {shadowMapSize > 0 && (
        <directionalLight
          castShadow
          position={[10, 20, 10]}
          intensity={1.5}
          shadow-mapSize={[shadowMapSize, shadowMapSize]}
          shadow-camera-near={0.1}
          shadow-camera-far={200}
        />
      )}
    </>
  );
}
```

### 3.8 Post-processing (optional)

```tsx
// src/scene/PostFX.tsx
import { EffectComposer, Bloom, SMAA } from '@react-three/postprocessing';

export function PostFX({ mode }: { mode: 'bloom' | 'bloom+ssao' | 'none' }) {
  if (mode === 'none') return null;
  return (
    <EffectComposer>
      <Bloom luminanceThreshold={0.8} intensity={0.4} />
      <SMAA />
    </EffectComposer>
  );
}
```

### 3.9 HUD overlay (DOM, not canvas)

DOM layer on top of the `<Canvas>`:

| Element | Purpose |
|---|---|
| Run / Stop button | Starts/stops robot animation |
| Conveyor speed slider | Updates UV scroll speed in scene store |
| Numeric `<TouchInput>` | Exercises on-screen keyboard |
| Status panel | Shows live FPS + current param values, updates at 5 Hz |

**Exit criterion:** scene renders at a stable FPS with all knobs working; keyboard opens over the 3D canvas without disrupting rendering.

---

## Phase 4 — Telemetry & Instrumentation

**Goal:** produce a CSV of `{timestamp, fps, frameTime, drawCalls, triangles, gpuMemory}` per test run.

### 4.1 R3F-Perf overlay

```tsx
import { Perf } from 'r3f-perf';
// Inside <Canvas>, gated on ?perf=1:
<Perf position="top-left" deepAnalyze matrixUpdate showGraph />
```

### 4.2 Telemetry hook

```ts
// src/hooks/useTelemetry.ts
import { usePerf } from 'r3f-perf';
import { useRef } from 'react';

const RING_SIZE = 3600; // 1 hour at 1 sample/s

export function useTelemetry() {
  const { log } = usePerf();
  const buffer = useRef<string[]>([]);

  // Call once per second from a useEffect interval
  const sample = () => {
    if (!log) return;
    const row = [
      Date.now(),
      log.fps?.toFixed(1),
      log.frameTime?.toFixed(2),
      log.calls,
      log.triangles,
      log.mem?.geometry?.toFixed(2),
    ].join(',');

    buffer.current.push(row);
    if (buffer.current.length > RING_SIZE) buffer.current.shift();

    localStorage.setItem('hmi_telemetry', buffer.current.join('\n'));
    window.postMessage({ type: 'hmi_telemetry_sample', row }, '*');
  };

  const exportCsv = () => {
    const header = 'timestamp,fps,frameTime,drawCalls,triangles,gpuMemMB';
    return header + '\n' + buffer.current.join('\n');
  };

  return { sample, exportCsv };
}
```

Attach to a `setInterval(sample, 1000)` inside the `<PackagingScene>` component.

### 4.3 Browser Performance API hooks

```ts
// In a top-level useEffect:
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.duration > 50) {
      console.warn('[LongTask]', entry.duration.toFixed(1), 'ms');
    }
  }
});
observer.observe({ entryTypes: ['longtask', 'event'] });
```

### 4.4 CSV export UI

Add a hidden button (long-press or `?export=1` param) that calls `exportCsv()` and triggers a file download — useful for pulling data off the VM without SSH.

**Exit criterion:** after 60 s of scene animation, `localStorage.getItem('hmi_telemetry')` returns a valid CSV with ≥ 60 rows.

---

## Phase 5 — Static Build & Kiosk Wiring

**Goal:** the app runs from a local static server and Chromium launches it in kiosk mode.

### 5.1 Build and serve

```bash
pnpm build
python3 -m http.server 8080 --directory dist
# or: nginx serving dist/ at localhost:8080
```

### 5.2 Chromium kiosk launch (summary)

Key flags (full script is in `hmi_poc_plan.md` step 13):

```
--kiosk
--incognito
--noerrdialogs
--disable-infobars
--use-gl=angle --use-angle=gl
--enable-gpu-rasterization
--enable-zero-copy
--ignore-gpu-blocklist
--disable-pinch
--overscroll-history-navigation=0
--touch-events=enabled
```

After launch: verify `chrome://gpu` shows **WebGL: Hardware accelerated** and **WebGL2: Hardware accelerated** before treating any FPS numbers as real.

### 5.3 Verify end-to-end

Checklist:
- [ ] App loads and 3D scene renders
- [ ] `chrome://gpu` shows hardware-accelerated WebGL2
- [ ] Tapping a `<TouchInput>` opens the keyboard overlay
- [ ] All leva knobs change scene behaviour in real time
- [ ] Telemetry CSV accumulates in localStorage

---

## Test Matrix

Run each combination for **60 seconds**; export CSV; note p1/p5/p99 FPS.

| Preset | productCount | shadowMapSize | postFX | pixelRatio |
|---|---|---|---|---|
| Low | 30 | 0 | none | 1.0 |
| Medium | 100 | 1024 | none | 1.0 |
| High | 250 | 2048 | bloom | 1.25 |

Interaction states per preset:
- **Idle** — camera still, no animation
- **Animating** — robot moving, products tweening
- **Interacting** — keyboard open while scene animates

---

## File Structure (target)

```
hmi-poc/
  src/
    main.tsx
    App.tsx
    index.css
    providers/
      TouchHardeningProvider.tsx
    stores/
      keyboardStore.ts
      sceneStore.ts
    components/
      TouchInput.tsx
      KeyboardOverlay.tsx
      StatusPanel.tsx
      HUD.tsx
    scene/
      PackagingScene.tsx
      Conveyor.tsx
      ProductInstances.tsx
      RobotArm.tsx
      PackingBox.tsx
      SceneLighting.tsx
      PostFX.tsx
    hooks/
      useTelemetry.ts
  public/
    textures/
      cardboard.jpg
      belt_normal.jpg
  vite.config.ts
  tsconfig.json
```

---

## Done Definition

The PoC app is complete when:

1. Scene renders in Chromium kiosk at `localhost:8080` with hardware-accelerated WebGL2.
2. All 6 load knobs change scene behaviour with no crashes.
3. On-screen keyboard opens over the canvas, commits values correctly, and does not disrupt the render loop.
4. Telemetry CSV is produced for all 9 test matrix cells (3 presets × 3 interaction states).
5. No three.js memory leak detected over a 10-minute continuous run (GPU memory stable in r3f-perf).
