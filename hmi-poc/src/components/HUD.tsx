import { useState, useEffect, useRef, useCallback } from 'react';
import { TouchInput } from './TouchInput';
import { exportTelemetryCsv, getTelemetryRowCount } from '../hooks/useTelemetry';

const isExportMode = new URLSearchParams(window.location.search).get('export') === '1';
const LONG_PRESS_MS = 2000;

function downloadCsv() {
  const csv = exportTelemetryCsv();
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `hmi_telemetry_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function HUD() {
  const [numericValue, setNumericValue] = useState('');
  const [rowCount, setRowCount] = useState(0);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refresh row count every 5 s so the export label stays accurate
  useEffect(() => {
    const id = setInterval(() => setRowCount(getTelemetryRowCount()), 5000);
    return () => clearInterval(id);
  }, []);

  const onLongPressStart = useCallback(() => {
    longPressTimer.current = setTimeout(downloadCsv, LONG_PRESS_MS);
  }, []);

  const onLongPressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  return (
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
      {/* Numeric TouchInput — exercises keyboard over canvas */}
      <TouchInput
        label="Numeric input"
        value={numericValue}
        onChange={setNumericValue}
        layout="numeric"
        placeholder="0.00"
        style={{ minWidth: 140 }}
      />

      {/* CSV export — visible via ?export=1 or triggered by 2-second long press */}
      <button
        onPointerDown={onLongPressStart}
        onPointerUp={onLongPressEnd}
        onPointerLeave={onLongPressEnd}
        onClick={isExportMode ? downloadCsv : undefined}
        title={isExportMode ? `Export CSV (${rowCount} rows)` : 'Hold 2 s to export telemetry CSV'}
        style={{
          marginLeft: 'auto',
          minHeight: 48,
          minWidth: isExportMode ? 120 : 48,
          borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.12)',
          background: 'rgba(255,255,255,0.05)',
          color: rowCount > 0 ? '#a3e635' : '#6b7280',
          fontFamily: 'system-ui, sans-serif',
          fontSize: isExportMode ? 13 : 18,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        {isExportMode ? `↓ CSV (${rowCount})` : '⏺'}
      </button>
    </div>
  );
}
