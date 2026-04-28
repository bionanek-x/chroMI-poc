import { useEffect } from 'react';
import { PerfHeadless } from 'r3f-perf';
import { sampleTelemetry } from '../hooks/useTelemetry';

const isPerfOverlay = new URLSearchParams(window.location.search).get('perf') === '1';

export function TelemetrySampler() {
  useEffect(() => {
    const id = setInterval(sampleTelemetry, 1000);
    return () => clearInterval(id);
  }, []);

  // PerfHeadless populates the r3f-perf store without rendering the overlay.
  // When the full Perf overlay is active (?perf=1) it already populates the store,
  // so skip PerfHeadless to avoid double-registration.
  return isPerfOverlay ? null : <PerfHeadless />;
}
