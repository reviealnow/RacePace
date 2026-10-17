export type Checkpoint = { id: string; name: string; declaredKm: number; geometryKm: number; lat: number; lon: number; closeTime: string; source: string };
export type Settings = { pace: string; delay: number; start: string; cutoffs: string[] };
export type Risk = 'safe' | 'watch' | 'tight' | 'late';
export const riskLabels: Record<Risk, string> = { safe: '低風險', watch: '留意', tight: '高風險', late: '逾時' };
export function paceSeconds(value: string): number {
  if (!/^\d{1,2}:[0-5]\d$/.test(value)) throw new Error('請以 分:秒 輸入配速，例如 6:30。');
  const [m, s] = value.split(':').map(Number);
  const seconds = m * 60 + s;
  if (seconds < 120 || seconds > 1800) throw new Error('配速範圍為 2:00–30:00 /km。');
  return seconds;
}
export function clockSeconds(value: string): number {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error('請輸入有效的 24 小時時間。');
  const [h, m] = value.split(':').map(Number); return h * 3600 + m * 60;
}
export function clockLabel(seconds: number): string {
  const n = Math.floor(seconds + 1e-7); // Match legacy Python strftime: truncate fractional seconds.
  const day = Math.floor(n / 86400);
  return (day ? `+${day}日 ` : '') + [Math.floor(n / 3600) % 24, Math.floor(n / 60) % 60, n % 60].map(x => String(x).padStart(2, '0')).join(':');
}
export function durationLabel(seconds: number): string {
  const n = Math.floor(seconds + 1e-7);
  return `${Math.floor(n / 3600)}:${String(Math.floor(n / 60) % 60).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
}
export function riskLevel(margin: number): Risk {
  return margin < 0 ? 'late' : margin < 300 ? 'tight' : margin < 600 ? 'watch' : 'safe';
}
export function predict(gates: Checkpoint[], settings: Settings) {
  const pace = paceSeconds(settings.pace); const start = clockSeconds(settings.start);
  if (!Number.isFinite(settings.delay) || settings.delay < 0 || settings.delay > 180) throw new Error('起跑延遲範圍為 0–180 分鐘。');
  if (settings.cutoffs.length !== gates.length) throw new Error('關門點設定不完整。');
  let previous = start;
  return gates.map((g, i) => {
    const close = clockSeconds(settings.cutoffs[i]);
    if (close <= previous) throw new Error('關門時間須在起跑之後，並依序遞增（同一賽日）。');
    previous = close;
    const elapsed = g.declaredKm * pace;
    const arrival = start + settings.delay * 60 + elapsed;
    const margin = close - arrival;
    return { ...g, closeTime: settings.cutoffs[i], elapsed, arrival, arrivalLabel: clockLabel(arrival), margin, risk: riskLevel(margin) };
  });
}
export function csvExport(rows: ReturnType<typeof predict>): string {
  const table = [['關門點', '標記里程 km', 'KML 幾何里程 km', '關門時間 Asia/Taipei', '情境預估抵達 Asia/Taipei', '餘裕 秒', '風險'], ...rows.map(r => [r.name, r.declaredKm, r.geometryKm, r.closeTime, r.arrivalLabel, r.margin.toFixed(3), riskLabels[r.risk]])];
  return '\uFEFF' + table.map(row => row.map(v => `"${String(v).replaceAll('"', '""')}"`).join(',')).join('\r\n');
}
