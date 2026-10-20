import { buildWorkout, type GPSPoint, type SpeedSample } from '../src/workout';
export const MAX_BYTES = 1_500_000;
export function validateWorkout(input: unknown) {
  if (!input || typeof input !== 'object') throw new Error('invalid');
  const data = input as Record<string, unknown>;
  if (typeof data.name !== 'string' || !data.name.trim() || data.name.length > 200 || !Array.isArray(data.points) || data.points.length > 100000) throw new Error('invalid');
  const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
  const points: GPSPoint[] = data.points.map(p => {
    if (!p || !finite(p.lat) || !finite(p.lon) || !finite(p.time) || Math.abs(p.time) > 8640000000000000) throw new Error('invalid');
    if (p.recordedSpeed !== undefined && (!finite(p.recordedSpeed) || p.recordedSpeed < 0 || p.recordedSpeed > 500)) throw new Error('invalid');
    if (p.originalTime !== undefined && (!finite(p.originalTime) || p.originalTime > p.time || p.time - p.originalTime > 2000)) throw new Error('invalid');
    return {lat:p.lat, lon:p.lon, time:p.time, ...(p.breakBefore ? {breakBefore:true} : {}), ...(p.recordedSpeed !== undefined ? {recordedSpeed:p.recordedSpeed} : {}), ...(p.originalTime !== undefined ? {originalTime:p.originalTime} : {})};
  });
  const workout = buildWorkout(points, data.name.trim());
  const samples: SpeedSample[] = [];
  if (data.speedSamples !== undefined) {
    if (!Array.isArray(data.speedSamples) || data.speedSamples.length > 200000) throw new Error('invalid');
    for (const sample of data.speedSamples) {
      if (!sample || !finite(sample.start) || !finite(sample.end) || !finite(sample.speed) || sample.speed < 0 || sample.speed > 500 || sample.end < sample.start || sample.start < points[0].time || sample.end > points.at(-1)!.time || (samples.length && sample.start < samples.at(-1)!.start)) throw new Error('invalid');
      samples.push({start:sample.start,end:sample.end,speed:sample.speed,source:''});
    }
  }
  const payload = JSON.stringify({name:workout.name,points:workout.points.map(({lat,lon,time,breakBefore,recordedSpeed,originalTime})=>({lat,lon,time,breakBefore,recordedSpeed,originalTime})),speedSamples:samples});
  if (new TextEncoder().encode(payload).byteLength > MAX_BYTES) throw new Error('size');
  return {payload, workout:{...workout,speedSamples:samples}};
}
