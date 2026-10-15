/** Spectrum ramp: cold kiln to white heat. Luminance rises monotonically. */
const STOPS = ['#141826', '#2b2f6e', '#6b3a8a', '#c2524a', '#f0a63a', '#fbe7b5'].map((hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
});

export function kilnColor(t: number): string {
  const x = Math.min(1, Math.max(0, t)) * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(x));
  const f = x - i;
  const rgb = STOPS[i].map((a, c) => Math.round(a + (STOPS[i + 1][c] - a) * f));
  return `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Magnitude on a log scale, 1e-4 .. 1 mapped to 0 .. 1. */
export function magnitudeToT(mag: number): number {
  if (mag <= 0) return 0;
  return Math.min(1, Math.max(0, (Math.log10(mag) + 4) / 4));
}
