import { KeyboardOverlay } from './components/KeyboardOverlay';
import { TouchInput } from './components/TouchInput';
import { useState } from 'react';

export default function App() {
  const [textValue, setTextValue] = useState('');
  const [numValue, setNumValue] = useState('');

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: 24,
      color: '#f9fafb',
      fontFamily: 'system-ui, sans-serif',
      padding: 32,
    }}>
      <h1 style={{ margin: 0, fontSize: 24, color: '#6366f1' }}>HMI PoC — Phase 1</h1>
      <p style={{ margin: 0, color: '#9ca3af', fontSize: 14 }}>
        Scaffold, keyboard, and touch hardening
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', maxWidth: 400 }}>
        <TouchInput
          label="Text input"
          value={textValue}
          onChange={setTextValue}
          placeholder="Tap to type..."
          layout="default"
        />
        <TouchInput
          label="Numeric input"
          value={numValue}
          onChange={setNumValue}
          placeholder="Tap to enter number..."
          layout="numeric"
        />
      </div>

      <div style={{ color: '#4b5563', fontSize: 12, marginTop: 16 }}>
        text: "{textValue}" &nbsp;&nbsp; num: "{numValue}"
      </div>

      <KeyboardOverlay />
    </div>
  );
}
