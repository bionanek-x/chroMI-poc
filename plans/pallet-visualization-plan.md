# Plan: 3D Pallet-Stack Visualization

## Context

The chroMI-poc HMI project currently shows an animated packaging scene (robot arm, conveyor, instanced products). The goal is to add a second scene that re-creates the pallet-stack 3D visualization from `recipe_builder_frontend_new` — a stack of cardboard boxes on a wooden pallet, viewable from any angle via orbit controls. All Three.js dependencies already exist in chroMI-poc; no new npm installs are needed. The data pipeline is simplified to a flat `PositionedBox[]` array with a hardcoded demo layout.

---

## New Files to Create

### `src/scene/pallet/palletColors.ts`
Color constants (box fill, edge, pallet slats/stringers, slipsheet). Inlined from source — no external deps.

### `src/scene/pallet/palletGeometry.ts`
Physical mm constants: `DECK_THICKNESS=18`, `STRINGER_HEIGHT=90`, `SLAT_COUNT=7`, `STRINGER_COUNT=3`, `PALLET_STRUCTURE_HEIGHT=126`.

### `src/scene/pallet/palletTypes.ts`
Simplified data types replacing the source's complex Recipe/Pattern/Layer hierarchy:
```ts
interface PositionedBox { id, centerX, centerY, centerZ, sizeX, sizeY, sizeZ }
interface SlipsheetPosition { y }
interface StackedPalletLayout { boxes, slipsheets, palletLength, palletWidth, slipsheetThickness }
```

### `src/scene/pallet/demoLayout.ts`
Hardcoded EUR pallet (1200×1000 mm), box 300×200×150 mm, 3 layers:
- Layer 0 & 2: 4 cols × 5 rows at 300×200 mm → fills 1200×1000 exactly
- Layer 1: 6 cols × 3 rows at 200×300 mm (rotated, fills 1200×900)
- Box centerY = `PALLET_STRUCTURE_HEIGHT + layerIndex * boxHeight + boxHeight/2`
- No slipsheets in demo

### `src/scene/pallet/BoxMesh.tsx`
Ported from source. Uses inline JSX `<meshStandardMaterial>` instead of module-level singleton to avoid disposal issues on Canvas remount. `<Edges>` wireframe from `@react-three/drei`.

### `src/scene/pallet/PalletMesh.tsx`
Ported from source. `useMemo` to compute slat/stringer positions from `length` and `width`. Two material colors (slats beige `#e6e0d9`, stringers `#d3cbc2`) with `<Edges>` per piece. Inline JSX materials.

### `src/scene/pallet/SlipsheetMesh.tsx`
Ported from source. Thin flat box with `polygonOffset` to prevent z-fighting. Inline JSX material.

### `src/scene/PalletScene.tsx`
Top-level scene component:
- Outer `div` (position: relative, 100%×100%) containing `<Canvas>` + `<HUD>` + `<KeyboardOverlay>`
- Canvas: `fov:35, near:1, far:50000` (mm scale), `background:'#1a1a2e'`, `antialias:true`
- Lights: ambient 0.6 + directional [2000,3000,1000] 0.8 + directional [-1000,2000,-1500] 0.3
- Inner `PalletSceneContent` component (accesses `useThree`):
  - `useEffect` auto-fits camera: `distance = radius / sin(35°/2)`, azimuth 45°, elevation 36°
  - `<OrbitControls target={[cx,cy,cz]} enableZoom={false} enablePan={false} minPolarAngle={π/6} maxPolarAngle={π/2.2} />`
  - Renders `<PalletMesh>`, `<SlipsheetMesh>` (per slipsheet), `<BoxMesh>` (per box)

---

## Files to Modify

### `src/stores/sceneStore.ts`
- Add `export type ActiveScene = 'packaging' | 'pallet'`
- Add `activeScene: ActiveScene` to `SceneState` interface
- Set `activeScene: 'packaging'` as initial state
- The existing generic `setParam` setter covers this field automatically

### `src/App.tsx`
Replace single `<PackagingScene />` with conditional render:
```tsx
const activeScene = useSceneStore(s => s.activeScene);
return activeScene === 'pallet' ? <PalletScene /> : <PackagingScene />;
```

### `src/components/HUD.tsx`
1. Add `activeScene` selector from store
2. Add scene-toggle button as first element in the control bar:
   - Label: "Pallet View" when packaging active, "Robot View" when pallet active
   - Calls `setParam('activeScene', activeScene === 'packaging' ? 'pallet' : 'packaging')`
3. Conditionally hide Run/Stop, conveyor speed, and `<StatusPanel>` when `activeScene === 'pallet'`

---

## Key Implementation Notes

- **No MobX**: `observer()` wrapper removed everywhere; plain React functions throughout
- **Material disposal safety**: Use inline JSX `<meshStandardMaterial>` in all mesh components (not module-level singletons) so materials are recreated cleanly on Canvas remount after scene switch
- **Demo layout geometry**: Layer 0 — col 3 centerX=1050, edge=1050+150=1200 ✓; row 4 centerZ=900, edge=900+100=1000 ✓
- **`isRzSideways`**: Not needed in demoLayout (footprints hardcoded per layer)

---

## Verification

1. `npm run build` in `hmi-poc/` — no TypeScript errors
2. Scene toggle: click button → pallet scene mounts, packaging unmounts; scene-specific controls disappear
3. Pallet view: boxes sit flush on pallet structure (bottom of layer-0 boxes at Y=126 mm)
4. Orbit: drag rotates; zoom and pan disabled; polar angle clamped (no top-down/bottom-up)
5. Camera: full stack visible on first load without manual zoom
