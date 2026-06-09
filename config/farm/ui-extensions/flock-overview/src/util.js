export const DAY_MS = 24 * 60 * 60 * 1000;

export const has = (v) => v !== null && v !== undefined;
export const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const daysBetween = (laterMs, earlierMs) => Math.floor((laterMs - earlierMs) / DAY_MS);
export const kg = (g) => (g / 1000).toFixed(2);
export const pct = (n) => `${Math.round(n * 100)}%`;
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
));
export const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
export const std = (xs) => {
  if (xs.length < 2) { return 0; }
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};

/** Linear-interpolate the target liveweight (g) for a given age in days. */
export const targetWeightAt = (curve, ageDays) => {
  if (!curve.length) { return 0; }
  if (ageDays <= curve[0].day) { return curve[0].g; }
  const last = curve[curve.length - 1];
  if (ageDays >= last.day) { return last.g; }
  for (let i = 1; i < curve.length; i++) {
    const a = curve[i - 1];
    const b = curve[i];
    if (ageDays <= b.day) {
      const t = (ageDays - a.day) / (b.day - a.day);
      return Math.round(a.g + t * (b.g - a.g));
    }
  }
  return last.g;
};
