export const REPLAY_MS = 5000;
export type GPSPoint = { lat: number; lon: number; time: number; timeProvided?: boolean; breakBefore?: boolean; recordedSpeed?: number };
export type ReplayPoint = GPSPoint & { elapsed: number; distance: number; speed: number; gap: boolean };
export type HealthSummary = { start: number; end: number; distance?: number; activeSeconds?: number; source: string; routes: string[] };
export type SpeedSample = { start: number; end: number; speed: number; source: string };
export type Workout = { name: string; demo: boolean; points: ReplayPoint[]; duration: number; distance: number; averageSpeed: number; gaps: number; health?: HealthSummary; speedSamples?: SpeedSample[]; recordedSpeedCount: number };
export type WorkoutErrorCode = 'format' | 'size' | 'invalid' | 'points' | 'duration' | 'timestamps' | 'health' | 'mismatch' | 'multiple';
export class WorkoutError extends Error {
  constructor(public code: WorkoutErrorCode) { super(code); }
}

export function metersBetween(a: Pick<GPSPoint, 'lat' | 'lon'>, b: Pick<GPSPoint, 'lat' | 'lon'>) {
  const rad = Math.PI / 180;
  const h = Math.sin((b.lat - a.lat) * rad / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lon - a.lon) * rad / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

export function buildWorkout(raw: GPSPoint[], name: string, demo = false): Workout {
  if (raw.length > 100000) throw new WorkoutError('size');
  if (raw.some(p => !Number.isFinite(p.lat) || Math.abs(p.lat) > 90 || !Number.isFinite(p.lon) || Math.abs(p.lon) > 180)) throw new WorkoutError('points');
  if (raw.some(p => !Number.isFinite(p.time))) throw new WorkoutError('timestamps');
  // Preserve GPX recording order; sorting would silently rewrite an out-of-order route.
  if (raw.some((p, i) => i > 0 && p.time < raw[i - 1].time)) throw new WorkoutError('timestamps');
  const ordered = raw;
  if (ordered.some((p, i) => i > 0 && p.time === ordered[i - 1].time && (p.lat !== ordered[i - 1].lat || p.lon !== ordered[i - 1].lon))) throw new WorkoutError('timestamps');
  const sorted = ordered.filter((p, i) => i === 0 || p.time !== ordered[i - 1].time);
  if (sorted.length < 2) throw new WorkoutError('points');
  const duration = (sorted.at(-1)!.time - sorted[0].time) / 1000;
  if (duration <= 0 || duration > 7 * 86400) throw new WorkoutError('duration');
  let distance = 0; let gaps = 0;
  const points = sorted.map((p, i): ReplayPoint => {
    const previous = sorted[Math.max(0, i - 1)];
    const seconds = (p.time - previous.time) / 1000;
    const meters = metersBetween(previous, p);
    // Flag sparse/jumpy data without deleting its vertices or changing its timeline.
    const gap = i > 0 && (Boolean(p.breakBefore) || seconds > 120 || meters / seconds > 20);
    if (gap) gaps++;
    if (!p.breakBefore) distance += meters;
    const speed = Number.isFinite(p.recordedSpeed) && p.recordedSpeed! >= 0 ? p.recordedSpeed! : seconds > 0 ? meters / seconds * 3.6 : 0;
    return { ...p, elapsed: (p.time - sorted[0].time) / 1000, distance, speed, gap };
  });
  return { name, demo, points, duration, distance, averageSpeed: distance / duration * 3.6, gaps, recordedSpeedCount: sorted.filter(p => Number.isFinite(p.recordedSpeed) && p.recordedSpeed! >= 0).length };
}

// Wall-clock mapping; frame drops never lengthen or reshape the workout timeline.
export function replayElapsed(duration: number, wallMilliseconds: number, resumeAt = 0) {
  return Math.min(duration, Math.max(0, resumeAt) + Math.max(0, wallMilliseconds) / REPLAY_MS * duration);
}

export function sampledSpeed(samples: SpeedSample[], time: number): number | undefined {
  let low = 0; let high = samples.length;
  while (low < high) { const middle = (low + high) >> 1; if (samples[middle].start <= time) low = middle + 1; else high = middle; }
  const current = samples[low - 1]; const next = samples[low];
  if (!current) return undefined;
  if (current.start === current.end && next && next.start > current.start && next.start - current.start <= 120000) {
    return current.speed + (next.speed - current.speed) * (time - current.start) / (next.start - current.start);
  }
  return time <= current.end ? current.speed : undefined;
}

export function positionAt(workout: Workout, seconds: number) {
  const points = workout.points;
  const elapsed = Math.max(0, Math.min(workout.duration, seconds));
  let lo = 1; let hi = points.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (points[mid].elapsed < elapsed) lo = mid + 1; else hi = mid; }
  const a = points[lo - 1]; const b = points[lo];
  const ratio = Math.max(0, Math.min(1, (elapsed - a.elapsed) / (b.elapsed - a.elapsed)));
  const gap = Boolean(b.breakBefore) && ratio < 1;
  const speed = sampledSpeed(workout.speedSamples ?? [], points[0].time + elapsed * 1000) ?? (Number.isFinite(a.recordedSpeed) && Number.isFinite(b.recordedSpeed)
    ? a.recordedSpeed! + (b.recordedSpeed! - a.recordedSpeed!) * ratio : b.speed);
  return {
    lat: gap ? a.lat : a.lat + (b.lat - a.lat) * ratio,
    // Short-segment interpolation with shortest longitude arc across the dateline.
    lon: gap || ratio === 0 ? a.lon : ratio === 1 ? b.lon : ((a.lon + ((b.lon - a.lon + 540) % 360 - 180) * ratio + 540) % 360) - 180,
    distance: gap ? a.distance : a.distance + (b.distance - a.distance) * ratio,
    speed: gap || elapsed === workout.duration ? 0 : speed,
    gap, elapsed, index: lo,
  };
}

// Fixed km/h scale makes colours comparable between different workouts.
export function speedColor(kmh: number) {
  const stops = [[0, 59, 130, 246], [6, 20, 184, 166], [12, 245, 158, 11], [18, 239, 68, 68]];
  const speed = Math.max(0, Math.min(18, kmh));
  const right = stops.findIndex(s => s[0] >= speed);
  const b = stops[Math.max(1, right)]; const a = stops[Math.max(0, right - 1)];
  const t = (speed - a[0]) / (b[0] - a[0]);
  return `rgb(${a.slice(1).map((v, i) => Math.round(v + (b[i + 1] - v) * t)).join(', ')})`;
}

export function demoWorkout(coordinates: number[][]) {
  let time = Date.UTC(2026, 9, 18, 0, 0, 0);
  const raw = coordinates.map(([lon, lat], i) => {
    if (i) {
      const [prevLon, prevLat] = coordinates[i - 1];
      const speed = 2.5 + 0.8 * Math.sin(i / 75) + 0.5 * Math.cos(i / 31);
      time += metersBetween({ lat: prevLat, lon: prevLon }, { lat, lon }) / speed * 1000;
    }
    return { lat, lon, time };
  });
  return buildWorkout(raw, 'Taipei course demo', true);
}
