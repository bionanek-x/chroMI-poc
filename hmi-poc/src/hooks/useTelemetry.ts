import { getPerf } from 'r3f-perf';

const RING_SIZE = 3600; // 1 hour at 1 sample/s
const buffer: string[] = [];

export function sampleTelemetry() {
  const state = getPerf();
  const log = state?.log;
  const gl = state?.accumulated?.gl;
  if (!log) return;

  const row = [
    Date.now(),
    (log.fps ?? 0).toFixed(1),
    (log.duration ?? 0).toFixed(2),
    gl?.calls ?? 0,
    gl?.triangles ?? 0,
    (log.gpu ?? 0).toFixed(2),
  ].join(',');

  buffer.push(row);
  if (buffer.length > RING_SIZE) buffer.shift();

  try {
    localStorage.setItem('hmi_telemetry', buffer.join('\n'));
  } catch {
    // localStorage quota — non-fatal
  }
  window.postMessage({ type: 'hmi_telemetry_sample', row }, '*');
}

export function exportTelemetryCsv(): string {
  const header = 'timestamp,fps,frameTime,drawCalls,triangles,gpuMemMB';
  return header + '\n' + buffer.join('\n');
}

export function getTelemetryRowCount(): number {
  return buffer.length;
}
