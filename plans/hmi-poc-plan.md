# PoC Plan: Industrial HMI on Chromium Kiosk + React Three Fiber for NVIDIA Jetson

**Last updated:** April 2026 — incorporates findings from UTM/VM GPU setup sessions.

---

## Context and Goals

Validate on an Ubuntu VM (UTM/QEMU on Apple M1 Pro) and later on NVIDIA Jetson hardware the viability of a React-based, Chromium-kiosk HMI for a robotic packaging cell. Goals:

1. Decide which React framework/setup to use
2. Validate Chromium kiosk mode setup on Ubuntu
3. Performance testing (especially 3D + animations on embedded Linux hardware)
4. On-screen keyboard testing and validation on touchscreen

**Primary metric: rendering performance (FPS/frame time under realistic 3D load).**

---

## Important Note on Ubuntu Version

The target dev environment is Ubuntu 26.04 LTS ("Resolute Raccoon"). Note that JetPack 6.2 (current Jetson production release) is built on Ubuntu 22.04, so dev/prod OS parity is limited regardless. None of the PoC-relevant tooling depends on 26.04-only features. If the 26.04 ISO is unavailable, Ubuntu 24.04.3 LTS is an acceptable fallback.

---

## 1. Recommended Tech Stack and Justification

### Frontend framework: React 18 + Vite + TypeScript (SPA, no SSR)

For a kiosk HMI there is no SEO benefit, no server-rendered HTML, and no Node runtime needed on the embedded device. The HMI ships as a folder of static assets (`dist/`) served by nginx or a simple HTTP server.

- **Vite** — sub-second HMR, tiny config, static `dist/` output deployable from `file://` or any minimal static server. Correct tool for SPAs, dashboards, and internal tools.
- **Next.js is the wrong choice here.** SSR, ISR, image optimization, and file-based routing are dead weight on a kiosk. Its static export mode works but you pay full Next.js complexity for none of the benefits.
- **CRA is deprecated** by the React team. Do not start new projects on it.

### 3D / graphics: React Three Fiber + drei + three.js (WebGL2)

- R3F is the standard declarative wrapper for three.js in React, with first-class support from drei and documented performance scaling APIs.
- **Stay on WebGL2.** WebGPU on ARM64 Jetson is not a supported/stable target. Plan a WebGPU re-evaluation milestone for a later release.
- Companions: **r3f-perf** for in-app metrics, **leva** for runtime tweaking during PoC, optionally **@react-three/postprocessing** for bloom/SMAA.

### UI framework / styling

- **Tailwind CSS 4 + Radix UI primitives** (or shadcn/ui). Use ≥ 48px hit targets and high-contrast theming for touch.
- **Framer Motion** for UI animations (GPU-friendly transforms). R3F's `useFrame` handles 3D animations directly.

### On-screen keyboard: react-simple-keyboard (in-app)

| Option | Verdict |
|---|---|
| **react-simple-keyboard** | ✅ **Recommended.** Fully React-native, customizable layouts (numpad/QWERTY/custom), themeable, ~30 KB, works regardless of OS, predictable z-index over R3F canvas. |
| KioskBoard | Acceptable backup. Less idiomatic for React. |
| Onboard (system, X11) | Install as recovery escape hatch only. Doesn't auto-pop reliably above Chromium kiosk. |
| Squeekboard (Wayland) | ❌ Avoid. Sits below fullscreen Chromium by default due to layer-shell ordering bug. |
| Florence | ❌ Largely unmaintained. Skip. |
| Chromium `--enable-virtual-keyboard` | ❌ Wired for ChromeOS, not desktop Linux. Does not work. |

Build the production keyboard via a global `KeyboardOverlay` React context: any `<TouchInput/>` focuses → broadcasts event → overlay mounts with numpad or QWERTY layout based on `data-input-type` prop.

### OS / kiosk runtime

- **Ubuntu 26.04 Desktop**, X11 session (better parity with Jetson L4T 36.x which defaults to X11; Chromium GPU process is more reliable on X11 than Wayland on ARM).
- **Chromium from xtradeb/apps PPA** — not the Ubuntu Snap. The Snap has chronic GPU-acceleration regressions on ARM and confinement issues that break kiosk deployments.
- **Do not use Ubuntu Frame / Mir-Kiosk for the PoC.** Chromium's Wayland backend on Jetson is fragile and adds XWayland overhead. Stay on X11 + LightDM autologin → startup script launches Chromium fullscreen.

### Process supervision

**systemd user service** with `Restart=always`, watchdog, and a pre-start step that scrubs Chromium's "didn't shut down correctly" preference keys.

---

## 2. Step-by-Step PoC Setup

### Phase A — Set up the dev VM (UTM on Apple M1 Pro)

#### A1. Create the UTM VM correctly

> ⚠️ **Critical learnings from setup:**
> - You **must** use the **QEMU backend**, not Apple Virtualization framework. Apple's Virtualization.framework does not support VirtIO-GPU-GL — it produces `llvmpipe` (software rendering) regardless of display settings.
> - When creating the VM: **uncheck "Use Apple Virtualization"** on the Linux setup screen.
> - After install, the Ubuntu installer will fail to unmount the CD-ROM on shutdown — this is harmless. Force-stop the VM in UTM, remove the ISO from the Drives config, then restart.

UTM VM settings:
- **Backend:** QEMU (not Apple Virtualization)
- **Architecture:** ARM64 (aarch64) — match the Jetson
- **RAM:** 8 GB
- **vCPUs:** 4
- **Display / Emulated Display Card:** `virtio-gpu-gl-pci` ← the `-gl` suffix is mandatory. `virtio-gpu-pci` without `-gl` gives software rendering.
- **Disk:** 40 GB

#### A2. Verify GPU passthrough is working

After booting into Ubuntu, run:

```bash
sudo apt install -y mesa-utils
glxinfo | grep -E "OpenGL renderer|direct rendering"
```

**Expected output (correct):**
```
direct rendering: Yes
OpenGL renderer string: virgl (ANGLE (Apple, Apple M1 Pro, OpenGL 4.1 Metal - 89.4))
```

If you see `llvmpipe` instead of `virgl`, the display card is wrong in UTM — stop the VM, change it to `virtio-gpu-gl-pci`, restart.

#### A3. System update + base tooling

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential ca-certificates
```

#### A4. Install Node via fnm

```bash
curl -fsSL https://fnm.vercel.app/install | bash
source ~/.bashrc
fnm install 20 && fnm default 20
corepack enable && corepack prepare pnpm@latest --activate
node -v && npm -v   # verify
```

#### A5. Install Chromium without Snap

> ⚠️ **Do not use `apt install chromium-browser` directly** — on Ubuntu 26.04 this installs a Snap wrapper, not a real .deb. The `saiarcot895` PPA does not have a `resolute` (26.04) release. Use the **xtradeb/apps PPA** instead.

```bash
# Remove saiarcot895 if you added it by mistake
sudo add-apt-repository --remove ppa:saiarcot895/chromium-beta 2>/dev/null || true

# Add the correct PPA
sudo add-apt-repository ppa:xtradeb/apps
sudo apt update

# Pin the PPA so it only overrides chromium* packages
printf '%s\n' \
  'Package: *' \
  'Pin: release o=LP-PPA-xtradeb-apps' \
  'Pin-Priority: 100' \
  '' \
  'Package: chromium*' \
  'Pin: release o=LP-PPA-xtradeb-apps' \
  'Pin-Priority: 700' | sudo tee /etc/apt/preferences.d/chromium-xtradeb > /dev/null

# Install — note: package name is 'chromium', not 'chromium-browser'
sudo apt install -y chromium chromium-codecs-ffmpeg-extra

# Verify it's the deb, not a snap wrapper
apt policy chromium
# Should show xtradeb URL with priority 700, NOT "installed-size: 0"
```

#### A6. Verify Chromium WebGL

> ⚠️ **virgl is on Chromium's GPU blocklist by default.** You must pass specific flags to override this, or Chromium will disable all GPU features even though virgl works fine for WebGL.
>
> Also: if Chromium has previously crashed with GPU enabled, it permanently disables GPU acceleration. Clear the crash record before relaunching:

```bash
rm -rf ~/.config/chromium/Default/GPUCache
rm -rf ~/.config/chromium/ShaderCache
```

Launch Chromium with the required flags:

```bash
chromium \
  --ignore-gpu-blocklist \
  --use-gl=angle \
  --use-angle=swiftshader \
  --enable-webgl \
  --webgl-msaa-sample-count=0 \
  --disable-gpu-driver-bug-workarounds
```

Navigate to `chrome://gpu`. **Expected result:**

```
WebGL:      Hardware accelerated  ✅
Canvas:     Hardware accelerated  ✅
Compositing: Hardware accelerated ✅
OpenGL:     Enabled               ✅
```

Video decode/encode being software-only is fine — no video playback needed. WebGPU unavailable is fine — using WebGL2.

#### A7. Save Chromium flags permanently

```bash
cat > ~/launch-chromium.sh << 'EOF'
#!/usr/bin/env bash
export DISPLAY=:0

# Clear GPU crash record to prevent Chromium disabling GPU after any crash
PREFS="$HOME/.config/chromium/Default/Preferences"
[ -f "$PREFS" ] && sed -i \
  's/"exited_cleanly":false/"exited_cleanly":true/; s/"exit_type":"Crashed"/"exit_type":"Normal"/' \
  "$PREFS"

exec chromium \
  --ignore-gpu-blocklist \
  --use-gl=angle \
  --use-angle=swiftshader \
  --enable-webgl \
  --webgl-msaa-sample-count=0 \
  --disable-gpu-driver-bug-workarounds \
  "$@"
EOF
chmod +x ~/launch-chromium.sh
```

#### A8. Configure kiosk user + auto-login

```bash
sudo useradd -m -s /bin/bash kiosk
sudo passwd kiosk
sudo usermod -aG video,input,render kiosk
```

LightDM autologin config at `/etc/lightdm/lightdm.conf.d/50-kiosk.conf`:

```ini
[Seat:*]
autologin-user=kiosk
autologin-user-timeout=0
user-session=ubuntu-xorg
```

Use `ubuntu-xorg` to force X11 session (not Wayland) for the PoC.

#### A9. Disable display sleep and interruptions

Run as the `kiosk` user after first login:

```bash
gsettings set org.gnome.desktop.session idle-delay 0
gsettings set org.gnome.desktop.screensaver lock-enabled false
gsettings set org.gnome.desktop.screensaver idle-activation-enabled false
gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-ac-type 'nothing'
gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-battery-type 'nothing'
gsettings set org.gnome.desktop.notifications show-banners false
```

Add to session autostart:

```bash
xset s off; xset -dpms; xset s noblank
sudo apt install -y unclutter
unclutter -idle 0.5 -root &
```

---

### Phase B — Scaffold the React project

#### B1. Create the Vite + React + TS app

```bash
pnpm create vite@latest hmi-poc --template react-ts
cd hmi-poc
pnpm add three @react-three/fiber @react-three/drei
pnpm add react-simple-keyboard
pnpm add framer-motion zustand
pnpm add -D r3f-perf leva @types/three vite-plugin-checker
```

#### B2. Vite config for static kiosk deploy

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',           // safe for file:// and arbitrary deploy paths
  build: {
    target: 'es2022',
    sourcemap: true,    // keep for field debugging
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three', '@react-three/fiber', '@react-three/drei']
        }
      }
    }
  }
})
```

#### B3. Touch hardening (add to main.tsx or App.tsx)

```ts
// Prevent pinch-zoom and overscroll gestures
document.addEventListener('touchmove', (e) => {
  if (e.touches.length > 1) e.preventDefault()
}, { passive: false })
```

```css
/* index.css */
body {
  touch-action: manipulation;
  overscroll-behavior: none;
  user-select: none;
}
```

---

### Phase C — Kiosk launch pipeline

#### C1. Serve the build

```bash
pnpm build
# Option A: quick dev server
python3 -m http.server 8080 --directory dist

# Option B: nginx (closer to prod)
sudo apt install -y nginx
sudo cp -r dist/* /var/www/html/
```

#### C2. Full kiosk launch script at `/home/kiosk/start-hmi.sh`

```bash
#!/usr/bin/env bash
export DISPLAY=:0

# Clear Chromium crash flags
PREFS="$HOME/.config/chromium/Default/Preferences"
[ -f "$PREFS" ] && sed -i \
  's/"exited_cleanly":false/"exited_cleanly":true/; s/"exit_type":"Crashed"/"exit_type":"Normal"/' \
  "$PREFS"

xset s off; xset -dpms; xset s noblank
unclutter -idle 0.5 -root &

# Pin touchscreen to display (important for multi-monitor / after suspend)
TOUCH_ID=$(xinput --list --id-only 'Touchscreen' 2>/dev/null | head -1)

exec chromium \
  --kiosk \
  --incognito \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-features=TranslateUI,Translate,InfiniteSessionRestore \
  --no-first-run \
  --window-position=0,0 \
  --window-size=1920,1080 \
  --autoplay-policy=no-user-gesture-required \
  --check-for-update-interval=31536000 \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  --touch-events=enabled \
  ${TOUCH_ID:+--touch-devices=$TOUCH_ID} \
  --ignore-gpu-blocklist \
  --use-gl=angle \
  --use-angle=swiftshader \
  --enable-webgl \
  --webgl-msaa-sample-count=0 \
  --disable-gpu-driver-bug-workarounds \
  --password-store=basic \
  --user-data-dir=/home/kiosk/.config/chromium-kiosk \
  "http://localhost:8080/"
```

```bash
chmod +x /home/kiosk/start-hmi.sh
```

> **Note on Jetson:** On the real Jetson hardware with NVIDIA proprietary drivers, replace `--use-angle=swiftshader` with `--use-angle=gl` or remove the ANGLE flags entirely and use `--use-gl=desktop`. Measure both on Jetson — the VM flags are tuned specifically for virgl/Mesa.

#### C3. systemd user service

```bash
mkdir -p ~/.config/systemd/user
cat > ~/.config/systemd/user/hmi-kiosk.service << 'EOF'
[Unit]
Description=HMI Kiosk
After=graphical-session.target
PartOf=graphical-session.target

[Service]
ExecStart=/home/kiosk/start-hmi.sh
Restart=always
RestartSec=2

[Install]
WantedBy=graphical-session.target
EOF

systemctl --user enable hmi-kiosk.service
loginctl enable-linger kiosk
```

---

### Phase D — Performance instrumentation

#### D1. r3f-perf in-canvas overlay

```tsx
import { Perf } from 'r3f-perf'

// Inside <Canvas>, enabled via ?perf=1 query param
{new URLSearchParams(location.search).has('perf') && (
  <Perf position="top-left" deepAnalyze matrixUpdate showGraph />
)}
```

#### D2. Custom telemetry hook

Collect metrics every 1s, write to `localStorage` and `window.postMessage` for Playwright scraping:

```ts
// hooks/useTelemetry.ts
import { usePerf } from 'r3f-perf'
import { useEffect } from 'react'

export function useTelemetry() {
  const { log } = usePerf()
  useEffect(() => {
    const id = setInterval(() => {
      const entry = {
        ts: Date.now(),
        fps: log.fps,
        frameTime: log.frameTime,
        drawCalls: log.calls,
        triangles: log.triangles,
        memory: (performance as any).memory?.usedJSHeapSize,
      }
      const buf = JSON.parse(localStorage.getItem('hmi_telemetry') || '[]')
      buf.push(entry)
      if (buf.length > 3600) buf.shift()   // 1-hour ring buffer
      localStorage.setItem('hmi_telemetry', JSON.stringify(buf))
      window.postMessage({ type: 'HMI_TELEMETRY', ...entry }, '*')
    }, 1000)
    return () => clearInterval(id)
  }, [log])
}
```

#### D3. Input latency measurement

```ts
// Measures touch → paint latency using PerformanceObserver
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.entryType === 'event') {
      console.log('Input latency:', entry.duration, 'ms')
    }
  }
})
observer.observe({ type: 'event', buffered: true, durationThreshold: 16 })
```

#### D4. System-level metrics (Jetson only)

```bash
# tegrastats — logs CPU, GPU, memory, thermals every 1s
sudo tegrastats --interval 1000 --logfile ~/tegrastats-$(date +%s).log

# jtop (install once)
sudo pip3 install jetson-stats
sudo jtop
```

On the dev VM use Chromium's built-in Task Manager (`Shift+Esc`) and `htop`.

---

## 3. The Performance Test Scene

One scene representative of the real HMI, with load knobs to scale complexity up/down.

### Scene composition

- **Conveyor belt** — extruded box with scrolling animated UVs (simulates motion). One mesh, one PBR material.
- **Products on belt** — 30–500 instanced boxes via drei `<Instances>` (single draw call). Drives many-objects load.
- **Robot arm** — 6-DOF kinematic chain from primitive cylinders/boxes, animated with per-joint sine waves. Stresses matrix updates per frame.
- **Box being packed** — open cardboard box (`BoxGeometry` + ≤512×512 texture). Products tween into it over 1s arcs.
- **Environment** — `<Environment preset="warehouse" />` for IBL + one directional shadow-casting light (1024×1024 shadow map to start).
- **Post-processing** — optional bloom + SMAA via `@react-three/postprocessing`. **Test with and without** — postFX is the single biggest perf cliff on embedded GPUs.
- **HUD overlay** — DOM React UI on top: Run/Stop button, numeric input (exercises react-simple-keyboard), conveyor speed slider, status panel updating at 5 Hz.

### Load knobs (via leva or URL params)

| Knob | Range | Purpose |
|---|---|---|
| `productCount` | 0 – 500 | Draw-call / triangle ceiling |
| `shadowMapSize` | 0 / 512 / 1024 / 2048 | Shadows are usually #1 GPU cost |
| `pixelRatio` | 0.5 – 2.0 | Dynamic resolution strategy |
| `postFX` | none / bloom / bloom+SSAO | Quantify postprocessing cost |
| `materialQuality` | basic / standard / physical | Material complexity cost |
| `frameloop` | `always` / `demand` | Validate on-demand rendering for idle states |

### Test matrix

Run each cell for 60 seconds, collect telemetry CSV.

| | Low preset | Medium preset | High preset |
|---|---|---|---|
| **Definition** | No shadows, no postFX, 30 products | 1024 shadows, no postFX, 100 products | 2048 shadows, bloom, 250 products |
| Dev VM | ✓ | ✓ | ✓ |
| Jetson Orin Nano | ✓ | ✓ | ✓ |
| Jetson Orin NX/AGX | ✓ | ✓ | ✓ |

For each cell, test both **idle** (camera still) and **active** (robot moving + user typing on keyboard).

---

## 4. Metrics to Capture and Report

### Rendering

- **FPS** — mean, p1, p5, p99. p1 matters more than mean for perceived jank.
- **Frame time histogram** — target 16.6 ms (60 Hz) or 33.3 ms (30 Hz).
- **Draw calls, triangle count, shader programs** — from r3f-perf.
- **GPU memory** (textures + geometries) — from `r3f-perf` `gl.memory`.
- **Shader compile stalls** — visible as freeze on first material instantiation.

### Interactivity

- **Input latency** — touchstart → first visible reaction. Target ≤ 100 ms. Via PerformanceObserver `event` entries.
- **Time-to-interactive after boot** — power-on → first usable frame. Target < 15 s.
- **UI animation smoothness** — Framer Motion transitions at 60 Hz, via Chromium DevTools Performance tab.

### System (Jetson)

- CPU% per core, GPU% (GR3D_FREQ from tegrastats)
- RAM used (process RSS), EMC bandwidth
- Temperatures (CPU, GPU, SOC) — thermal throttle is a real risk in a sealed robot cage
- **4-hour soak test** at chosen quality preset — watch for FPS decay or memory growth

### Report format per device

1. Hardware ID (`uname -a`, `cat /etc/nv_tegra_release`, `chrome://gpu` excerpt)
2. Chromium version + flags used + ANGLE backend
3. CSV telemetry per preset
4. Frame-time histogram charts
5. Grade per (preset × interaction): 🟢 ≥60 FPS p1≥50 / 🟡 ≥30 FPS p1≥25 / 🔴 below 30 or visible jank
6. Recommended "ship-it" preset for that device

### Tooling

- **r3f-perf** — live overlay and programmatic logging
- **Chromium DevTools → Performance tab** — long tasks, GPU bars, compositing
- **Spector.js** extension — per-frame WebGL call inspection
- **Playwright** — scripted deterministic test scenarios (open, click, type, drag slider)
- **tegrastats** — system metrics on Jetson, aligned to FPS dips

---

## 5. Known Pitfalls

### VM-specific (confirmed during this PoC setup)

1. **Apple Virtualization framework does not support GPU passthrough.** You will get `llvmpipe` (CPU software rendering) regardless of display card setting. Always use the QEMU backend in UTM.
2. **`virtio-gpu-pci` without `-gl` suffix gives software rendering.** Must use `virtio-gpu-gl-pci`.
3. **virgl is on Chromium's GPU blocklist.** Always pass `--ignore-gpu-blocklist` in the VM. Without it, all GPU features are disabled even though virgl works.
4. **Chromium permanently disables GPU after a crash.** Clear `~/.config/chromium/Default/GPUCache` and `~/.config/chromium/ShaderCache` before relaunching after any crash.
5. **`saiarcot895` PPA has no Ubuntu 26.04 (resolute) release.** Use `xtradeb/apps` PPA instead. Package name is `chromium`, not `chromium-browser`.
6. **Ubuntu 26.04's `chromium-browser` apt package is a Snap wrapper**, not a real deb. Always install from xtradeb PPA.
7. **VM GPU numbers are not production numbers.** The virgl → Metal → M1 chain is not representative of Jetson Ampere. Use the VM for functional/UX validation only; all performance decisions must be based on Jetson measurements.

### Jetson / embedded Linux

8. **Snap Chromium is broken for hardware-accelerated WebGL on Jetson.** Install from apt/PPA. JetPack 6 + Firefox-from-Mozilla-PPA was the first combo to "just work" for hardware WebGL on Orin — test both browsers on Jetson and measure.
9. **snapd 2.70 + JetPack 6 silently breaks browser launch.** Pin a known-good snapd version in provisioning scripts.
10. **Hardware video decode in browser on Jetson does not work.** Use native overlay processes for camera feeds.
11. **Chromium's Wayland backend is fragile on Jetson.** Use X11 for the PoC.
12. **`--in-process-gpu` flag** — sometimes improves 1%-low FPS on Jetson by removing IPC overhead, sometimes crashes on shader compile. Make it configurable, not default.
13. **Three.js memory leaks on unmount.** Geometries/materials/textures created outside JSX won't be auto-disposed by R3F. Always call `.dispose()` in cleanup functions.
14. **Shader compile stalls.** Pre-compile all materials at boot using `gl.compile(scene, camera)` and re-use materials across instances.
15. **Touchscreen unbinds after suspend/resume.** Use `xinput --map-to-output` at startup and pass `--touch-devices=<id>` to Chromium.
16. **Pinch-zoom escapes `--kiosk`.** Pass `--disable-pinch` + `--overscroll-history-navigation=0` AND add JS-level `touchmove` prevention. CSS `touch-action: none` on the canvas root closes the last gap.
17. **Thermal throttling in sealed enclosure.** Always run a 4-hour soak test at expected enclosure temperature with `tegrastats` logging before any go/no-go.
18. **Anti-aliasing is expensive on Jetson.** Prefer FXAA/SMAA in postprocessing over MSAA. Or disable AA entirely at `pixelRatio: 1.0–1.25` for 1080p.

---

## 6. Recommended PoC Strategy: Split by Task

Given the VM GPU limitations, divide work across environments:

| Task | Environment |
|---|---|
| Kiosk shell, systemd, auto-login, touch config | Ubuntu VM |
| React app dev, UI components, react-simple-keyboard | Ubuntu VM or Mac |
| WebGL functional testing (scene loads, interactions) | Ubuntu VM (virgl, software-ish) |
| **Performance benchmarking** | Mac natively in Chrome + Jetson hardware |
| Final go/no-go metrics | Jetson only |

---

## 7. Suggested Timeline

| Week | Deliverable |
|---|---|
| 1 | VM provisioned, Vite+R3F skeleton booting in Chromium kiosk, systemd service running, telemetry plumbing live |
| 2 | Full test scene with all load knobs; react-simple-keyboard integrated; first VM baseline numbers |
| 3 | Jetson Orin Nano provisioned; `chrome://gpu` hardware acceleration verified; Jetson baseline numbers; thermal soak test |
| 4 | Comparison report; recommended quality preset per Jetson SKU; go/no-go memo on Vite+R3F+Chromium for production |

---

## Summary

Use **React 18 + Vite + TypeScript** (static SPA), **Chromium from xtradeb PPA** (not Snap) in `--kiosk` mode under **X11**, **React Three Fiber + drei** for 3D, **react-simple-keyboard** for touch text entry, and **r3f-perf + Chromium DevTools + tegrastats** for measurement. Skip Next.js, Ubuntu Frame, Wayland, squeekboard, and Chromium's built-in virtual keyboard. Base all performance decisions on Jetson hardware numbers, not VM numbers.
