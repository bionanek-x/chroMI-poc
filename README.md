# HMI PoC

A Vite + React + Three.js performance test scene for evaluating WebGL/HMI stack suitability in a kiosk environment.

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/) — install with `npm install -g pnpm`
- Chromium or Google Chrome

## Running the project

### Development

Use this during active development — hot module reload, no build step needed.

```bash
pnpm install
pnpm dev
```

Open `http://localhost:5173` in a browser.

### Production (kiosk)

Build the app once, serve it statically, then launch Chromium in kiosk mode. Requires two terminals.

**Terminal 1 — build and serve:**

```bash
pnpm install       # skip if already done
pnpm build         # compiles to dist/
pnpm serve         # serves dist/ on http://localhost:8080
```

**Terminal 2 — launch kiosk:**

```bash
pnpm kiosk:vm       # VM / no GPU (SwiftShader, CPU-rendered WebGL)
pnpm kiosk:physical # Physical device with a real GPU (native OpenGL)
```

Both scripts accept optional arguments: `./kiosk-vm.sh [url] [display]`, defaulting to `http://localhost:8080` and `:0`.

## Kiosk launch

Two scripts are provided depending on the target machine.

### VM (no GPU passthrough)

```bash
pnpm kiosk:vm
# or: ./kiosk-vm.sh [url] [display]
```

Uses `--use-angle=swiftshader` — WebGL is rendered on the CPU via SwiftShader. FPS numbers reflect CPU performance, not GPU. Good for testing UI/UX and interaction patterns; not representative of real-GPU throughput.

### Physical Linux device

```bash
pnpm kiosk:physical
# or: ./kiosk-physical.sh [url] [display]
```

Uses `--use-angle=gl` — native OpenGL via ANGLE. Requires a working GPU driver (see below). FPS numbers are representative of real hardware.

## GPU driver prerequisites (physical Linux device)

Before running `kiosk-physical.sh`, verify the GPU driver is correctly installed and active.

### 1. Check the current OpenGL renderer

```bash
glxinfo | grep "OpenGL renderer"
```

The output must show a real GPU, **not** a software fallback:

| Output | Meaning |
|---|---|
| `NVIDIA GeForce ...` / `AMD Radeon ...` / `Intel ...` | Hardware driver active — good |
| `llvmpipe` / `softpipe` / `SwiftShader` | Software fallback — driver missing or broken |

### 2. Install drivers

**Nvidia (proprietary — recommended for performance)**

```bash
sudo apt install nvidia-driver-535   # or whichever version matches your card
sudo reboot
nvidia-smi                           # verify after reboot
```

**AMD (open-source Mesa)**

```bash
sudo apt install mesa-vulkan-drivers mesa-utils
```

**Intel (open-source Mesa)**

```bash
sudo apt install intel-media-va-driver mesa-utils
```

### 3. Verify Chromium sees the GPU

Launch Chromium normally (not kiosk) and open `chrome://gpu`. Confirm:

- **WebGL: Hardware accelerated**
- **WebGL2: Hardware accelerated**

If either shows `SwiftShader` or `Software only`, the driver is not being picked up — re-check the installation and confirm there are no entries in the GPU blocklist (`chrome://gpu` → "Driver Bug Workarounds").

### 4. Optional: allow GPU access without a display server

On a headless or Wayland-only setup, Chromium may need an explicit display or `--ozone-platform` flag:

```bash
# X11
DISPLAY=:0 ./kiosk-physical.sh

# Wayland
./kiosk-physical.sh  # then add --ozone-platform=wayland to the script if needed
```

## Debug / instrumentation

Append query params to the URL:

| Param | Effect |
|---|---|
| `?debug=1` | Shows leva control panel (scene knobs) |
| `?perf=1` | Shows r3f-perf overlay (FPS, draw calls, triangles) |
| `?export=1` | Shows CSV export button in HUD |

## Test matrix

Run each combination for 60 s; export CSV; note p1/p5/p99 FPS.

| Preset | productCount | shadowMapSize | postFX | pixelRatio |
|---|---|---|---|---|
| Low | 30 | 0 | none | 1.0 |
| Medium | 100 | 1024 | none | 1.0 |
| High | 250 | 2048 | bloom | 1.25 |

Interaction states per preset: **Idle** / **Animating** / **Interacting** (keyboard open while scene animates).
