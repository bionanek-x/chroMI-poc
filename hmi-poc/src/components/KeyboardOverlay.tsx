import Keyboard from 'react-simple-keyboard';
import 'react-simple-keyboard/build/css/index.css';
import { useKeyboardStore } from '../stores/keyboardStore';

const numericLayout = {
  default: ['1 2 3', '4 5 6', '7 8 9', '. 0 {bksp}', '{cancel} {done}'],
};

const numericDisplay = {
  '{bksp}': '⌫',
  '{done}': 'Done',
  '{cancel}': 'Cancel',
};

export function KeyboardOverlay() {
  const { visible, layout, value, setValue, close, onCommit } = useKeyboardStore();

  if (!visible) return null;

  const handleDone = () => {
    onCommit?.(value);
    close();
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      background: '#1a1a2e',
      borderTop: '1px solid #333',
      padding: '8px 12px 12px',
    }}>
      {layout === 'numeric' ? (
        <Keyboard
          layoutName="default"
          layout={numericLayout}
          display={numericDisplay}
          onChange={setValue}
          inputName="keyboard"
          input={{ keyboard: value }}
          onKeyPress={(btn) => {
            if (btn === '{done}') handleDone();
            if (btn === '{cancel}') close();
          }}
        />
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 6 }}>
            <button
              onClick={close}
              style={btnStyle('#444')}
            >
              Cancel
            </button>
            <button
              onClick={handleDone}
              style={btnStyle('#2563eb')}
            >
              Done
            </button>
          </div>
          <Keyboard
            layoutName="default"
            onChange={setValue}
            inputName="keyboard"
            input={{ keyboard: value }}
          />
        </>
      )}
    </div>
  );
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    background: bg,
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '10px 20px',
    fontSize: 16,
    minHeight: 48,
    cursor: 'pointer',
  };
}
