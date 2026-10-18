import { SaxesParser, type SaxesTagNS } from 'saxes';
import { buildWorkout, sampledSpeed, WorkoutError, type GPSPoint, type HealthSummary, type Workout, type SpeedSample } from './workout';

const numeric = (value?: string) => value?.trim() ? Number(value) : NaN;
const attributes = (tag: SaxesTagNS) => Object.fromEntries(Object.values(tag.attributes).map(a => [a.local, a.value]));
export function timestamp(value?: string) {
  if (!value || !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value.trim())) return NaN;
  return Date.parse(value.trim().replace(/^(\d{4}-\d{2}-\d{2}) /, '$1T').replace(/ ([+-]\d{2})(\d{2})$/, '$1:$2'));
}
function distanceMeters(value?: string, unit?: string) {
  const factors: Record<string, number> = { m: 1, km: 1000, mi: 1609.344, ft: .3048 };
  const result = numeric(value) * (factors[unit ?? ''] ?? NaN);
  return Number.isFinite(result) && result >= 0 ? result : undefined;
}
function speedKmh(value?: string, unit?: string) {
  const factors: Record<string, number> = { 'm/s': 3.6, 'km/h': 1, 'km/hr': 1, 'mi/hr': 1.609344, 'mi/h': 1.609344, mph: 1.609344 };
  const result = numeric(value) * (factors[unit ?? ''] ?? NaN);
  return Number.isFinite(result) && result >= 0 ? result : undefined;
}

export function parseWorkoutXML(text: string, format: 'gpx' | 'tcx'): GPSPoint[] {
  const parser = new SaxesParser({ xmlns: true });
  const points: GPSPoint[] = [];
  let point: GPSPoint | undefined; let content = ''; let groups = 0; let firstInGroup = false; let tracks = 0;
  parser.on('error', () => { throw new WorkoutError('invalid'); });
  parser.on('opentag', tag => {
    content = '';
    if (tag.local === (format === 'gpx' ? 'trk' : 'Activity') && ++tracks > 1) throw new WorkoutError('multiple');
    if (tag.local === (format === 'gpx' ? 'trkseg' : 'Track')) { groups++; firstInGroup = true; }
    if (tag.local === (format === 'gpx' ? 'trkpt' : 'Trackpoint')) {
      const attrs = attributes(tag);
      point = { lat: numeric(attrs.lat), lon: numeric(attrs.lon), time: NaN, breakBefore: groups > 1 && firstInGroup };
      firstInGroup = false;
    }
  });
  parser.on('text', text => { content += text; });
  parser.on('closetag', tag => {
    if (!point) return;
    if (tag.local === 'time' || tag.local === 'Time') { point.time = timestamp(content); point.timeProvided = true; }
    if (tag.local === 'LatitudeDegrees') point.lat = numeric(content);
    if (tag.local === 'LongitudeDegrees') point.lon = numeric(content);
    if (tag.local === 'speed' || tag.local === 'Speed') point.recordedSpeed = speedKmh(content, 'm/s');
    if (tag.local === (format === 'gpx' ? 'trkpt' : 'Trackpoint')) {
      points.push(point); point = undefined;
      if (points.length > 100000) throw new WorkoutError('size');
    }
    content = '';
  });
  parser.write(text).close();
  return points;
}

export type HealthData = { workouts: HealthSummary[]; speeds: SpeedSample[] };
function healthParser(range?: { start: number; end: number }) {
  const parser = new SaxesParser({ xmlns: true });
  const result: HealthData = { workouts: [], speeds: [] };
  let current: HealthSummary | undefined; let root = '';
  parser.on('error', () => { throw new WorkoutError('invalid'); });
  parser.on('opentag', tag => {
    if (!root) root = tag.local;
    const a = attributes(tag);
    if (tag.local === 'Workout' && a.workoutActivityType === 'HKWorkoutActivityTypeRunning') {
      const unit = a.durationUnit === 'hr' ? 3600 : a.durationUnit === 'min' ? 60 : a.durationUnit === 's' ? 1 : NaN;
      current = { start: timestamp(a.startDate), end: timestamp(a.endDate), distance: distanceMeters(a.totalDistance, a.totalDistanceUnit), activeSeconds: numeric(a.duration) * unit, source: a.sourceName ?? '', routes: [] };
    }
    if (current && tag.local === 'FileReference' && a.path) current.routes.push(a.path.replaceAll('\\', '/').split('/').at(-1)!);
    if (current && tag.local === 'WorkoutStatistics' && a.type === 'HKQuantityTypeIdentifierDistanceWalkingRunning') current.distance = distanceMeters(a.sum, a.unit) ?? current.distance;
    if (tag.local === 'Record' && a.type === 'HKQuantityTypeIdentifierRunningSpeed') {
      const start = timestamp(a.startDate); const end = timestamp(a.endDate); const speed = speedKmh(a.value, a.unit);
      if (Number.isFinite(start) && end >= start && speed !== undefined && (!range || (end >= range.start && start <= range.end))) result.speeds.push({ start, end, speed, source: a.sourceName ?? '' });
    }
    if (result.speeds.length > 200000 || result.workouts.length > 100000) throw new WorkoutError('size');
  });
  parser.on('closetag', tag => {
    if (tag.local === 'Workout' && current) {
      if (Number.isFinite(current.start) && current.end > current.start && (!range || current.end >= range.start && current.start <= range.end)) result.workouts.push(current);
      current = undefined;
    }
  });
  return { parser, finish: () => { parser.close(); if (root !== 'HealthData') throw new WorkoutError('health'); return result; } };
}

// Used by fixture tests; production streams the export in bounded chunks below.
export function parseAppleHealthXML(xml: string): HealthData {
  const state = healthParser(); state.parser.write(xml); return state.finish();
}
export async function readAppleHealth(file: File, workout: Workout) {
  if (file.size > 1024 * 1024 * 1024) throw new WorkoutError('size');
  const state = healthParser({ start: workout.points[0].time, end: workout.points.at(-1)!.time });
  const decoder = new TextDecoder('utf-8', { fatal: true });
  for (let offset = 0; offset < file.size; offset += 256 * 1024) {
    state.parser.write(decoder.decode(await file.slice(offset, offset + 256 * 1024).arrayBuffer(), { stream: true }));
  }
  state.parser.write(decoder.decode());
  return attachAppleHealth(workout, state.finish());
}

export function attachAppleHealth(workout: Workout, data: HealthData): Workout {
  const start = workout.points[0].time; const end = workout.points.at(-1)!.time;
  // Require matching endpoints as well as file reference, to avoid attaching a full-run summary to a partial GPX.
  const timeMatches = data.workouts.filter(w => Math.abs(w.start - start) <= 60000 && Math.abs(w.end - end) <= 60000);
  const named = timeMatches.filter(w => w.routes.includes(workout.name));
  const matches = named.length ? named : timeMatches.filter(w => !w.routes.length);
  if (matches.length !== 1) throw new WorkoutError('mismatch');
  const health = matches[0];
  const samples = data.speeds.filter(s => s.source === health.source && s.start >= health.start && s.end <= health.end).sort((a, b) => a.start - b.start);
  // Keep the route's own samples intact, so replacing an XML cannot retain speeds from the prior source.
  const base = buildWorkout(workout.points, workout.name);
  const healthSpeedCount = base.points.filter(p => sampledSpeed(samples, p.time) !== undefined).length;
  return { ...base, health, speedSamples: samples, recordedSpeedCount: base.recordedSpeedCount + healthSpeedCount };
}

export async function importWorkout(file: File) {
  if (file.size > 25 * 1024 * 1024) throw new WorkoutError('size');
  const extension = file.name.split('.').at(-1)?.toLowerCase();
  let raw: GPSPoint[];
  if (extension === 'gpx' || extension === 'tcx') raw = parseWorkoutXML(await file.text(), extension);
  else if (extension === 'fit') {
    const { Decoder, Stream } = await import('@garmin/fitsdk');
    const decoder = new Decoder(Stream.fromArrayBuffer(await file.arrayBuffer()));
    if (!decoder.isFIT() || !decoder.checkIntegrity()) throw new WorkoutError('invalid');
    const { messages, errors } = decoder.read();
    if (errors.length) throw new WorkoutError('invalid');
    raw = (messages.recordMesgs ?? []).filter(r => r.positionLat !== undefined && r.positionLong !== undefined).map(record => ({
      lat: typeof record.positionLat === 'number' ? record.positionLat * 180 / 2 ** 31 : NaN,
      lon: typeof record.positionLong === 'number' ? record.positionLong * 180 / 2 ** 31 : NaN,
      time: record.timestamp instanceof Date ? record.timestamp.getTime() : NaN,
      recordedSpeed: typeof record.enhancedSpeed === 'number' ? record.enhancedSpeed * 3.6 : typeof record.speed === 'number' ? record.speed * 3.6 : undefined,
    }));
  } else throw new WorkoutError('format');
  return buildWorkout(raw, file.name);
}

// Only truly absent timing gets a route-only preview; malformed or partial timing is rejected.
export async function importUntimedGPX(file: File) {
  if (file.size > 25 * 1024 * 1024) throw new WorkoutError('size');
  const points = parseWorkoutXML(await file.text(), 'gpx');
  if (points.some(p => p.timeProvided)) throw new WorkoutError('timestamps');
  if (points.length < 2 || points.some(p => !Number.isFinite(p.lat) || Math.abs(p.lat) > 90 || !Number.isFinite(p.lon) || Math.abs(p.lon) > 180)) throw new WorkoutError('points');
  return points;
}
