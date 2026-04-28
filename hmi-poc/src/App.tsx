import { useSceneStore } from './stores/sceneStore';
import { PalletScene } from './scene/PalletScene';
import { HUD } from './components/HUD';
import { KeyboardOverlay } from './components/KeyboardOverlay';

export default function App() {
  const stacks = useSceneStore((s) => s.stacks);
  const removeStack = useSceneStore((s) => s.removeStack);
  const mountGeneration = useSceneStore((s) => s.mountGeneration);
  const remounting = useSceneStore((s) => s.remounting);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh' }}>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `repeat(${Math.ceil(Math.sqrt(stacks.length))}, 1fr)`, gridAutoRows: '1fr', minHeight: 0, gap: 6, padding: 6, background: '#0d0d1a' }}>
        {!remounting && stacks.map((stack) => (
          <div key={`${stack.id}-${mountGeneration}`} style={{ flex: 1, position: 'relative', minWidth: 0, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
            <PalletScene sceneId={stack.id} />
            <button
              onClick={() => removeStack(stack.id)}
              title="Remove this stack"
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                width: 32,
                height: 32,
                borderRadius: '50%',
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(0,0,0,0.55)',
                color: '#9ca3af',
                fontSize: 16,
                lineHeight: 1,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(4px)',
                zIndex: 10,
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <KeyboardOverlay />
      <HUD />
    </div>
  );
}
