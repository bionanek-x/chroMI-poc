# PoC Plan: Industrial HMI on Chromium Kiosk + React Three Fiber for NVIDIA Jetson

This document is a step‑by‑step plan to validate, on an Ubuntu VM (UTM/Apple M1 Pro) and later on NVIDIA Jetson hardware, the viability of a React‑based, Chromium‑kiosk HMI for a robotic packaging cell. It is organized as: (1) recommended stack with rationale, (2) full setup procedure from a fresh OS install, (3) the minimal-but-representative 3D test scene to build, (4) measurement & reporting methodology, and (5) Jetson/embedded-Linux pitfalls to plan around.

A note on dates and versions: the target dev environment in the brief is "Ubuntu 26.04 VM." Ubuntu 26.04 LTS is the upcoming April 2026 LTS; if the official ISO is not yet available at PoC start, plan to use Ubuntu 24.04.3 LTS as a fallback — none of the PoC-relevant tooling depends on 26.04-only features, and JetPack 6.2 (the current Jetson production release) is built on Ubuntu 22.04, so dev/prod parity will be limited regardless.

---

## 1. Recommended Tech Stack and Justification

### Frontend framework: **React 18 + Vite + TypeScript (SPA, no SSR)**
For a kiosk HMI there is no SEO benefit, no public web traffic, no need for server-rendered HTML, and ideally no Node runtime on the embedded device at all. The HMI should ship as a folder of static assets (HTML/CSS/JS/WASM/textures/glTF), which is exactly what `vite build` produces. Concretely:

- **Vite** gives sub-second HMR (Esbuild dev server, Rollup production build), a tiny config surface, and a static `dist/` output that can be served from `file://` or any minimal static server (`nginx`, `python -m http.server`, or even bundled inside an Electron/Tauri shell later). This matches every embedded-device deployment pattern (no Node process, no port 3000, atomic A/B image swaps).
- **Next.js is the wrong choice here.** Its strengths — SSR, ISR, file-based routing optimized around server components, image optimization tied to a Node runtime — are dead weight on a kiosk. Next.js's static export (`output: 'export'`) works but you would be paying Next's complexity tax for nothing, and you'd lose features (middleware, image optimization) when you do go static. Industry consensus in 2026 (Strapi, Rollbar, DesignRevision comparisons) is "Vite for SPAs, dashboards, internal tools; Next.js for public/SEO sites." HMI is the canonical SPA/internal-tool case.
- **CRA (Create React App) is deprecated** by the React team; do not start a new project on it in 2026.

### 3D / graphics: **React Three Fiber (R3F) + drei + three.js (WebGL2)**
- R3F is the de-facto declarative wrapper for three.js in React, with first-class support from drei (helpers, controls, performance utilities) and a documented `performance` regression API for downscaling pixel ratio under load.
- **Stay on WebGL2 for v1.** WebGPU offers real CPU-overhead reductions and compute-shader features, but Chromium WebGPU on ARM64 Jetson is not a supported target — even WebGL hardware acceleration in Chromium on Jetson required workarounds as recently as JetPack 6, and hardware video decode in browser is still broken. Plan a WebGPU re-evaluation milestone for a later release once `chrome://gpu` reports WebGPU as hardware-accelerated on the chosen Jetson.
- Optional companions: **react-three/rapier** for rigid-body physics if the box-packing scene needs collisions; **leva** for runtime tweaking during the PoC; **r3f-perf** for in-app metrics.

### UI framework / styling
- **Tailwind CSS 4 + Radix UI primitives** (or shadcn/ui) for accessible, large-target touch components. Kiosk UI should use ≥ 48 px hit targets and high-contrast theming.
- **Animation: Framer Motion (motion/react).** GPU-friendly transforms; the React Three Fiber `useFrame` loop handles 3D animations directly.

### On-screen keyboard: **react-simple-keyboard (in-app), with onboard as a system fallback**
After comparing the candidates from the brief:

| Option | Layer | Pros | Cons / Verdict for this PoC |
|---|---|---|---|
| **react-simple-keyboard** | In-React (DOM) | Tight React integration, fully customizable layouts (numpad, QWERTY, custom robot symbols), themeable, lightweight (~30 KB), works regardless of OS, predictable z-index over R3F canvas, no IPC. 67+ dependents on npm, actively maintained. | **Recommended primary.** You control everything (focus, layout, theming, language, dispatching to your input state). |
| **KioskBoard** | In-DOM (vanilla JS) | Auto-attaches to inputs, several themes. | Less idiomatic for React; less customizable than react-simple-keyboard. Acceptable backup. |
| **Onboard** | System (X11, GTK) | Mature GNOME OSK, dwell-click, scanning, word completion, AT-SPI integration. | Python + GTK deps; doesn't auto-pop reliably above Chromium kiosk; visual style won't match HMI; X11-only (Jetson uses X11, so OK there, but 26.04 default session is Wayland). Use only as a fallback for emergency text entry, not as primary HMI keyboard. |
| **Squeekboard** | System (Wayland, layer-shell) | Designed for Phosh/Wayland, touch-first. | Documented bug: by default uses the `top` layer-shell layer, which sits **below** fullscreen Chromium in kiosk; only works if Chromium runs maximized (not true `--kiosk`) or if a custom labwc patch promotes it to `overlay`. Brittle and platform-coupled. Avoid for this PoC. |
| **Florence** | System (X11) | Long-standing OSK. | Largely unmaintained; does not auto-show on Chromium focus events. Skip. |
| **Chromium `--enable-virtual-keyboard`** | Browser flag | Built-in. | Repeatedly reported as non-functional on Linux desktop Chromium (NXP forums, Yocto reports); it is wired for ChromeOS, not desktop Linux. Do **not** rely on it. |
| **xontab/chrome-virtual-keyboard** | Chrome extension | Drop-in. | Unreliable on cross-origin iframes, focus loss bugs. Skip. |

**Decision:** build the production HMI keyboard with `react-simple-keyboard`. Use it via a global "input controller" React context: any `<TouchInput/>` component focuses → broadcasts focus event → `KeyboardOverlay` mounts a `Keyboard` instance with a numpad or alphanumeric layout depending on `data-kioskboard-type` props. Keep `onboard` (apt-installable) configured on the system as a recovery escape hatch reachable through a hidden gesture for field service.

### OS / kiosk runtime
- **Ubuntu 24.04 LTS or 26.04 LTS Desktop** with a dedicated unprivileged `kiosk` user (X11 session for the PoC — gives best parity with Jetson L4T 36.x, which currently ships X11 by default).
- **Chromium installed from the Linux Mint / Phd Chromium PPA (saiarcot895) or from `.deb` directly**, *not* the Ubuntu Snap. The Snap version has a long history of GPU-acceleration regressions on ARM and confinement issues that bite kiosk deployments; on Jetson Orin with JetPack 6, the Snap+snapd 2.70 combination has actively broken browser launches and has required downgrading snapd to recover. Plan for `chromium-browser` from `apt`/PPA on dev, and on Jetson use either NVIDIA's pre-built Chromium or Firefox-from-Mozilla-PPA as a parallel test.
- **Do not** wrap this in Ubuntu Frame / Mir-Kiosk for the PoC. Ubuntu Frame is a clean Wayland kiosk compositor, but Chromium's Wayland backend on Jetson is fragile (Wayland socket discovery issues are well-documented in Canonical's own Discourse), and it adds an XWayland translation layer that hurts performance — exactly what you don't want when GPU is the constraint. Stay on plain X11 + a minimal session manager (LightDM autologin → Openbox or no WM at all → startup script launches Chromium fullscreen).

### Process supervision
- **systemd user service** (`chromium-kiosk.service` under `--user`) with `Restart=always`, watchdog timer, and a pre-start step that scrubs `~/.config/chromium/Default/Preferences` to clear the "Chrome didn't shut down correctly" bubble (sed `exited_cleanly`/`exit_type` keys).

---

## 2. Step-by-Step PoC Setup Plan (Fresh Ubuntu → Running Tests)

### Phase A — Set up the dev VM (UTM on Apple M1 Pro)

1. **Create the UTM VM.**
   - Architecture: **ARM64 (aarch64)** — match the Jetson, do not use x86_64 emulation. Use UTM's "Virtualize" mode (Apple Hypervisor.framework), not Emulate.
   - RAM: 8 GB (M1 Pro can spare it; R3F builds and Chromium are RAM-hungry).
   - vCPUs: 4.
   - Display: VirtIO-GPU GL (this is critical — without it, Chromium inside the VM will fall back to SwiftShader and your "performance" numbers will be meaningless software rendering). Enable "Hardware OpenGL acceleration" in UTM display settings.
   - Disk: 40 GB.
   - Install Ubuntu Server ARM64 ISO, then `sudo apt install ubuntu-desktop-minimal` to get a desktop session, *or* install Ubuntu Desktop ARM64 directly if a 26.04 desktop ISO is available.

2. **Caveat to socialize early with the team:** the M1/UTM VM is an *aarch64-with-software-translated-Metal* environment. WebGL on this VM ≠ WebGL on Jetson Orin's Ampere GPU. Use the VM for functional/UX validation only; treat all FPS numbers as provisional and re-baseline on real Jetson hardware before any go/no-go decision.

3. **System update + base tooling.**
   ```bash
   sudo apt update && sudo apt upgrade -y
   sudo apt install -y curl git build-essential ca-certificates
   # Node via fnm (fast, no sudo needed)
   curl -fsSL https://fnm.vercel.app/install | bash
   fnm install 20 && fnm default 20
   corepack enable && corepack prepare pnpm@latest --activate
   ```

4. **Install Chromium without Snap.**
   ```bash
   sudo snap remove --purge chromium 2>/dev/null || true
   sudo add-apt-repository -y ppa:saiarcot895/chromium-beta
   sudo apt update && sudo apt install -y chromium-browser chromium-codecs-ffmpeg-extra
   ```
   Verify hardware acceleration: launch chromium, navigate to `chrome://gpu`, confirm "WebGL: Hardware accelerated" and "WebGL2: Hardware accelerated." If they say "Software only," investigate `chrome://flags` (`Override software rendering list`, `GPU rasterization`) and the UTM "Hardware OpenGL acceleration" toggle before going further — fix this before performance testing or your numbers will be garbage.

5. **Create the kiosk user (mirrors prod layout).**
   ```bash
   sudo useradd -m -s /bin/bash kiosk
   sudo passwd kiosk    # set a known password
   sudo usermod -aG video,input,render kiosk
   ```

6. **Configure auto-login (LightDM).**
   ```
   /etc/lightdm/lightdm.conf.d/50-kiosk.conf
   ---
   [Seat:*]
   autologin-user=kiosk
   autologin-user-timeout=0
   user-session=ubuntu
   ```
   For Wayland default sessions (26.04), use `user-session=ubuntu-xorg` to force X11 for the PoC.

7. **Disable everything that interrupts a 24/7 display.**
   ```bash
   # As the kiosk user, after first login:
   gsettings set org.gnome.desktop.session idle-delay 0
   gsettings set org.gnome.desktop.screensaver lock-enabled false
   gsettings set org.gnome.desktop.screensaver idle-activation-enabled false
   gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-ac-type 'nothing'
   gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-battery-type 'nothing'
   gsettings set org.gnome.desktop.notifications show-banners false
   # And at the X level:
   xset s off ; xset -dpms ; xset s noblank
   ```
   Add the `xset` commands and `unclutter -idle 0.1 -root &` (hides cursor) to the session autostart.

8. **Install on-screen keyboard fallback (optional).**
   ```bash
   sudo apt install -y onboard
   ```
   Don't autostart it; it is the recovery path only.

### Phase B — Scaffold the React project

9. **Create the Vite + React + TS app.**
   ```bash
   pnpm create vite@latest hmi-poc --template react-ts
   cd hmi-poc
   pnpm add three @react-three/fiber @react-three/drei
   pnpm add react-simple-keyboard
   pnpm add -D r3f-perf stats.js leva
   pnpm add framer-motion zustand
   pnpm add -D @types/three vite-plugin-checker
   ```

10. **Vite config tuned for kiosk static deploy:**
    ```ts
    // vite.config.ts
    export default defineConfig({
      plugins: [react()],
      base: './',                       // file:// or arbitrary path safe
      build: {
        target: 'es2022',
        sourcemap: true,                // keep for field debugging
        rollupOptions: {
          output: { manualChunks: { three: ['three', '@react-three/fiber', '@react-three/drei'] } }
        }
      }
    });
    ```

11. **Add a `--strict-touch` provider** that, on app mount, attaches the global `touchmove` `event.preventDefault()` for `e.touches.length > 1` (block pinch zoom in JS in addition to the Chromium flag) and sets `body { touch-action: manipulation; overscroll-behavior: none; user-select: none; }`.

### Phase C — Build the kiosk launch pipeline

12. **Static-host the build.** Two options, pick one:
    - `pnpm build` then `python3 -m http.server 8080 --directory dist` (simplest).
    - Or place `dist/` at `/var/www/hmi/` and serve via `nginx` (closer to prod, supports gzip/brotli).

13. **Chromium kiosk launch script** at `/home/kiosk/start-hmi.sh`:
    ```bash
    #!/usr/bin/env bash
    export DISPLAY=:0
    # Recover from "Chrome didn't shut down correctly" banner
    PREFS="$HOME/.config/chromium/Default/Preferences"
    [ -f "$PREFS" ] && sed -i 's/"exited_cleanly":false/"exited_cleanly":true/; s/"exit_type":"Crashed"/"exit_type":"Normal"/' "$PREFS"

    xset s off; xset -dpms; xset s noblank
    unclutter -idle 0.5 -root &

    # Detect the touchscreen device id for explicit binding
    TOUCH_ID=$(xinput --list --id-only 'Touchscreen' 2>/dev/null | head -1)

    exec chromium-browser \
      --kiosk \
      --incognito \
      --noerrdialogs \
      --disable-infobars \
      --disable-session-crashed-bubble \
      --disable-features=TranslateUI,Translate,InfiniteSessionRestore \
      --no-first-run \
      --start-maximized \
      --window-position=0,0 \
      --window-size=1920,1080 \
      --autoplay-policy=no-user-gesture-required \
      --check-for-update-interval=31536000 \
      --disable-pinch \
      --overscroll-history-navigation=0 \
      --touch-events=enabled \
      ${TOUCH_ID:+--touch-devices=$TOUCH_ID} \
      --enable-features=OverlayScrollbar \
      --use-gl=angle --use-angle=gl \
      --enable-gpu-rasterization \
      --enable-zero-copy \
      --ignore-gpu-blocklist \
      --enable-features=VaapiVideoDecoder \
      --password-store=basic \
      --disable-pinch \
      --user-data-dir=/home/kiosk/.config/chromium-kiosk \
      "http://localhost:8080/"
    ```
    Notes:
    - `--use-gl=angle --use-angle=gl` forces ANGLE-on-OpenGL on Linux which is the most stable WebGL2 backend across Mesa and NVIDIA drivers (on Jetson with the proprietary L4T driver, you may end up dropping `--use-angle=gl` and using native `--use-gl=desktop` — measure both).
    - `--check-for-update-interval=31536000` (1 year) keeps Chromium from triggering self-update during a production shift.
    - Do **not** add `--disable-gpu` or `--disable-software-rasterizer` "to be safe" — both are widely copy-pasted and *kill* hardware acceleration. Verify in `chrome://gpu`.

14. **systemd user service** at `/home/kiosk/.config/systemd/user/hmi-kiosk.service`:
    ```ini
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
    ```
    `systemctl --user enable hmi-kiosk.service`, `loginctl enable-linger kiosk`.

### Phase D — Wire up performance instrumentation

15. **Add R3F-Perf** for in-canvas overlay:
    ```tsx
    import { Perf } from 'r3f-perf';
    <Canvas>
      <Perf position="top-left" deepAnalyze matrixUpdate showGraph />
      ...
    </Canvas>
    ```
    Toggle visibility with a `?perf=1` query param so it's not shipped on by default.

16. **Add a custom `<Telemetry/>` hook** that, every 1 s, reports `{fps, frameTime, drawCalls, triangles, memory}` (all from `usePerf`) to a small ring buffer and dumps it to `localStorage` and over `window.postMessage` so it can be scraped by a Puppeteer/Playwright harness. This is the single most valuable artifact of the PoC — a CSV per scene per device.

17. **Browser-level metrics** via the Performance API:
    - `PerformanceObserver` for `event` entries → input latency (touch → next paint).
    - `performance.measure` around interaction handlers.
    - Long Tasks API for main-thread stalls > 50 ms.

18. **System-level metrics** (collected on Jetson, not VM):
    - `tegrastats` (Jetson native; logs CPU, GPU, memory, EMC bandwidth, thermals every 1 s).
    - `jtop` (jetson-stats package) for richer per-rail telemetry.
    - On the dev VM, `htop`, `intel_gpu_top` (irrelevant on M1 VM), or simply Chromium's own Task Manager (`Shift+Esc`).

---

## 3. The Performance Test Scene

Build **one** scene that is intentionally a near-replica of the eventual production HMI's 3D content, with knobs to scale complexity up and down. The scene should answer: "at what level of fidelity does the target Jetson hold a steady ≥ 30 FPS (target 60) at 1920×1080?"

### Scene composition (representative of the real packaging cell)

- **Conveyor belt**: a long extruded box (`BoxGeometry`) with a scrolling normal map / animated UVs to simulate motion (cheap, GPU-bound). One mesh, one PBR material.
- **Products on the belt**: 30 instanced boxes with subtle randomized rotation/position, using `<Instances>` from drei (single draw call). Drives "many small movers" load.
- **Robot arm**: a 6-DOF articulated kinematic chain built from primitive cylinders/boxes (no glTF needed for PoC), animated with a procedural sine-wave per joint. This stresses matrix updates per frame.
- **Box being packed**: an open cardboard box (`BoxGeometry` with custom UVs + cardboard texture, ≤ 512×512) into which products are tweened over 1 s arcs.
- **Environment**: a single HDRI from drei `<Environment preset="warehouse" />` for IBL, plus one directional light with shadow maps (1024×1024 — do not crank this to 2048+ on Jetson).
- **Post-processing**: optional bloom + SMAA via `@react-three/postprocessing`. **Test both with and without** — postFX is the single biggest perf cliff on embedded GPUs.
- **HUD overlay**: DOM-layered React UI on top: a "Run/Stop" button, a numeric input (to exercise `react-simple-keyboard`), a conveyor-speed slider, a status panel with values updating at 5 Hz.

### Adjustable load knobs (expose via leva or URL params)

| Knob | Range | Why |
|---|---|---|
| `productCount` | 0 – 500 | Find draw-call/triangle ceiling |
| `shadowMapSize` | 0 / 512 / 1024 / 2048 | Shadows are usually the #1 cost |
| `pixelRatio` | 0.5 – 2.0 | Test dynamic-resolution strategy |
| `postFX` | none / bloom / bloom+SSAO | Quantify postprocessing cost |
| `materialQuality` | basic / standard / physical | StandardMaterial vs PhysicalMaterial cost |
| `frameloop` | `always` / `demand` | Validate on-demand rendering for idle states |

### Test matrix (run each cell for 60 s, log telemetry)

For each (device × scene preset × interaction state):
- Devices: dev VM (UTM/M1), then Jetson Orin Nano, then Jetson Orin NX/AGX (whichever is in the bake-off).
- Scene presets: "low" (no shadows, no postFX, productCount=30), "medium" (1024 shadows, no postFX, 100 products), "high" (2048 shadows, bloom, 250 products).
- Interaction states: idle (camera still), animating (robot moving + products tweening), interacting (user touching keyboard while scene animates).

---

## 4. How to Measure and Report

### Metrics to capture (all of these are non-negotiable)

**Rendering / graphics:**
- **FPS (mean, p1, p5, p99)** — p1 matters more than mean for "feels janky?"
- **Frame time histogram** (16.6 ms target for 60 Hz, 33.3 ms for 30 Hz).
- **Draw calls per frame, triangle count, programs/shaders compiled.** All from r3f-perf.
- **GPU memory (textures + geometries)** from r3f-perf `gl.memory`.
- **Shader compile stalls** during initial scene load (one-time but visible as a freeze).

**Interactivity:**
- **Input latency**: touchstart → first paint with visible reaction. Use PerformanceObserver `event` entries, target ≤ 100 ms (industry usability threshold).
- **Time-to-interactive after boot**: power-on → kiosk URL loaded → first user-meaningful frame. Target < 15 s.
- **Animation smoothness** of UI transitions (Framer Motion 60 Hz check via Chromium DevTools Performance tab).

**System:**
- CPU% per core, total CPU%.
- GPU%, GR3D_FREQ% (Jetson-specific from tegrastats).
- RAM used (process RSS), GPU/EMC bandwidth.
- Temperatures (CPU, GPU, SOC). Thermal throttle is a real risk in a sealed robot-cage enclosure.
- Sustained-load test: 4 hours minimum at the chosen quality preset, watch for FPS decay or memory growth (look for leaks in geometries/materials not disposed on unmount — a classic R3F bug).

### Reporting format

Produce a single Markdown report per device with:
1. Hardware identification (`uname -a`, `nvidia-smi` or `cat /etc/nv_tegra_release`, `chrome://gpu` excerpt).
2. Chromium version, flags used, ANGLE backend.
3. CSVs of telemetry (one per scene preset).
4. Frame-time histogram graphs (matplotlib from the CSVs).
5. A grade per (preset × interaction state): green (≥ 60 FPS, p1 ≥ 50), yellow (≥ 30 FPS, p1 ≥ 25), red (below 30 FPS or visible jank).
6. **The recommended "ship-it" preset** for that device.
7. Known issues observed (e.g., shader-compile stall on first product spawn).

### Tooling

- **r3f-perf** for live in-app overlay; `usePerf`/`PerfHeadless` for programmatic logging to telemetry.
- **stats.js** as a sanity cross-check on FPS reading.
- **Chromium DevTools → Performance tab** (record 10 s sessions; analyze long tasks, GPU bars, layer compositing).
- **Spector.js** Chromium extension for per-frame WebGL call inspection when debugging draw-call counts.
- **Lighthouse** in performance category for boot time and TTI (run once on the static build via `chromium --headless`).
- **Playwright** to script a deterministic, repeatable scenario (open page, click button, type into input, drive sliders) so test runs are comparable.
- **tegrastats** logged to file in parallel to the in-browser telemetry so CPU/GPU%/thermals can be aligned to FPS dips.

---

## 5. Known Pitfalls — WebGL/Three.js on Jetson and Embedded Linux

These are documented issues from the NVIDIA Developer Forums and community sources. Plan around them:

1. **Snap Chromium has been chronically broken for hardware-accelerated WebGL on Jetson.** Multiple forum threads (including "WebGL support on Orin," "Chromium with WebGL support on JetPack 5.1.1") show users reporting software-only rendering or 100% CPU. JetPack 6 + Firefox-from-Mozilla-PPA was reported in late 2024 as the first combination to "just work" for hardware-accelerated WebGL on Orin. Plan to test both Chromium-from-deb and Firefox-from-PPA on the actual Jetson and pick a winner — do not assume Chromium will be the production browser until you've measured it.

2. **snapd 2.70 + JetPack 6 will silently break browser launch.** Cytron and others document that the lean Jetson kernel lacks security options that snapd 2.70 expects, causing Chromium/Firefox to fail to start with no error. Mitigation is to downgrade snapd or install browsers via apt/PPA — yet another reason to avoid Snap on Jetson. Pin a known-good snapd version in your provisioning script.

3. **Hardware video decode in Chromium/Firefox on Jetson does not work.** Even when WebGL is accelerated. If the HMI ever needs to play camera feeds or recorded video in the browser, plan on either software decode (CPU-expensive on Orin Nano) or a separate native overlay process. Don't rely on `<video>` performing well.

4. **WebGPU on Jetson is not yet a viable target.** Chromium's WebGPU on ARM/Linux outside of Pixel-class hardware is experimental. Stick to WebGL2.

5. **Chromium's Wayland backend is fragile on Jetson.** Wayland-socket discovery errors are well-documented under Ubuntu Frame + Mir. For an industrial PoC, use X11 — it's what Jetson's L4T BSP defaults to, what NVIDIA's drivers are best tested against, and what Chromium's GPU process is most reliable on.

6. **`--in-process-gpu`** is sometimes recommended for embedded ARM as it removes the IPC overhead of a separate GPU process. Test it with and without; on some Jetson configurations it improves 1%-low FPS but on others it crashes on shader compile. Make it a configurable flag, not a default.

7. **Three.js memory leaks on unmount.** R3F's reconciler does dispose primitives, but custom geometries/materials/textures created outside of JSX (in refs, in `useMemo`) often leak. Use `useMemo` + cleanup `dispose()` patterns and watch GPU memory in r3f-perf during a long-running session.

8. **Shader compile stalls.** First-time material instantiation can cause a 200–500 ms freeze on Jetson. Solutions: pre-compile by rendering all materials once off-screen at boot (`gl.compile(scene, camera)`), and re-use materials across instanced objects (don't `new MeshStandardMaterial` per object).

9. **Touchscreen input mapping.** On multi-monitor or after suspend/resume, the touch device may unbind from the display. Use `xinput --map-to-output` in the start-up script to pin touch coordinates to the HMI display, and pass `--touch-devices=<id>` to Chromium.

10. **On-screen keyboard layering on Wayland.** Squeekboard, the leading Wayland OSK, defaults to the `top` layer, which on labwc/wlroots compositors sits *below* fullscreen surfaces — so a fullscreen `--kiosk` Chromium hides it. This is a real, open issue. Either keep an X11 session for the PoC, run Chromium maximized rather than truly fullscreen, or (the recommended path) avoid system OSKs entirely and use react-simple-keyboard inside the app.

11. **Pinch-zoom and history-swipe gestures escape `--kiosk`.** The `--disable-pinch` and `--overscroll-history-navigation=0` flags must both be set, *and* a JS-level `touchmove` preventDefault for `touches.length > 1` should be added belt-and-suspenders. CSS `touch-action: none` on the canvas root closes the last gap.

12. **Thermal throttling in robot-cage enclosure.** A bench Jetson can hit 60 FPS, but the same Jetson at 50 °C ambient inside a sealed enclosure may throttle to half clocks. Always include a 4-hour soak test at expected enclosure temperature, with `tegrastats` logging clocks and temperatures, before any go/no-go.

13. **Color management.** R3F since v8 applies sRGB output by default; combined with three.js's color-management changes since r152, your scene can look washed out or oversaturated until you align `THREE.ColorManagement.enabled = true` and material color spaces. Sort this before doing any visual review with stakeholders.

14. **Anti-aliasing trade-off.** MSAA in Chromium WebGL2 on Jetson is comparatively expensive. Prefer FXAA or SMAA in postprocessing, or simply disable AA and rely on a pixel-ratio of 1.0–1.25 — it costs less and looks acceptable on 1080p touchscreens.

---

## Suggested PoC Timeline (working back from "decision-ready")

| Week | Deliverable |
|---|---|
| 1 | Dev VM provisioned, Vite+R3F skeleton booting, chromium-kiosk launching from systemd, telemetry plumbing live. |
| 2 | Test scene with all knobs implemented; react-simple-keyboard integrated and working over Canvas; first VM-baseline numbers. |
| 3 | Jetson Orin Nano (and Orin NX if available) provisioned with the same image; chromium hardware acceleration verified at `chrome://gpu`; first Jetson numbers; thermal soak test running. |
| 4 | Comparison report; "ship-it" preset chosen per Jetson SKU; pitfalls documented; recommendation memo with go/no-go on Vite+R3F+Chromium for the production HMI. |

---

## Summary Recommendation

Use **React 18 + Vite + TypeScript** as a static SPA, rendered by **Chromium (from PPA, not Snap) in `--kiosk` mode under X11**, with **React Three Fiber + drei** for the 3D scene, **react-simple-keyboard** for touch text entry, and **r3f-perf + Chromium DevTools + tegrastats** as the measurement stack. Skip Next.js, skip Ubuntu Frame, skip Wayland, skip squeekboard, and skip Chromium's built-in virtual keyboard — none of them earn their complexity in this use case. Validate on the Apple Silicon UTM VM only as a functional sanity check, and base every performance decision on numbers measured on the actual Jetson SKU under realistic enclosure thermals.