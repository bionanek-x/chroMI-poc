import { useState } from 'react';
import { useSceneStore } from '../stores/sceneStore';
import { TouchInput } from './TouchInput';
import { StatusPanel } from './StatusPanel';

export function HUD() {
  const robotRunning = useSceneStore((s) => s.robotRunning);
  const conveyorSpeed = useSceneStore((s) => s.conveyorSpeed);
  const setParam = useSceneStore((s) => s.setParam);
  const [numericValue, setNumericValue] = useState('');

  return (
    <>
      <StatusPanel />

      {/* Bottom control bar */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(8px)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        zIndex: 10,
      }}>
        {/* Run / Stop */}
        <button
          onClick={() => setParam('robotRunning', !robotRunning)}
          style={{
            minWidth: 100,
            minHeight: 48,
            borderRadius: 8,
            border: 'none',
            fontFamily: 'system-ui, sans-serif',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            background: robotRunning ? '#dc2626' : '#16a34a',
            color: '#fff',
            flexShrink: 0,
          }}
        >
          {robotRunning ? '⏹ Stop' : '▶ Run'}
        </button>

        {/* Conveyor speed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 180 }}>
          <label style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Conveyor speed: {conveyorSpeed.toFixed(1)}×
          </label>
          <input
            type="range"
            min={0}
            max={3}
            step={0.1}
            value={conveyorSpeed}
            onChange={(e) => setParam('conveyorSpeed', parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#6366f1', cursor: 'pointer' }}
          />
        </div>

        {/* Numeric TouchInput — exercises keyboard over canvas */}
        <TouchInput
          label="Numeric input"
          value={numericValue}
          onChange={setNumericValue}
          layout="numeric"
          placeholder="0.00"
          style={{ minWidth: 140 }}
        />
      </div>
    </>
  );
}
