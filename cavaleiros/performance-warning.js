export function createLowFpsMonitor({ thresholdMs = 36, requiredMs = 5000 } = {}) {
  let slowMs = 0;
  let warned = false;
  return {
    sample(frameMs, active) {
      if (warned) return false;
      if (!active || !Number.isFinite(frameMs) || frameMs <= 0 || frameMs > 1000) {
        slowMs = 0;
        return false;
      }
      if (frameMs >= thresholdMs) slowMs += frameMs;
      else slowMs = Math.max(0, slowMs - frameMs * 1.5);
      if (slowMs < requiredMs) return false;
      warned = true;
      return true;
    },
  };
}
