import { useKeyboardStore } from '../stores/keyboardStore';

interface Props {
  value: string;
  onChange: (v: string) => void;
  layout?: 'default' | 'numeric';
  placeholder?: string;
  label?: string;
  style?: React.CSSProperties;
}

export function TouchInput({ value, onChange, layout = 'default', placeholder, label, style }: Props) {
  const open = useKeyboardStore((s) => s.open);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, ...style }}>
      {label && (
        <label style={{ fontSize: 12, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </label>
      )}
      <input
        readOnly
        value={value}
        placeholder={placeholder}
        onFocus={() => open({ layout, initial: value, onCommit: onChange })}
        style={{
          minHeight: 48,
          fontSize: 18,
          padding: '0 12px',
          cursor: 'pointer',
          background: '#1f2937',
          border: '1px solid #374151',
          borderRadius: 6,
          color: '#f9fafb',
          outline: 'none',
          width: '100%',
        }}
      />
    </div>
  );
}
