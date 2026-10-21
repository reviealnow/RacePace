import { positionAt, sampledSpeed, speedColor, type GPSPoint, type Workout } from './workout';
import type { Language } from './i18n';
import { workoutDateLabel, type WeatherKind, type WorkoutWeather } from './workout-weather';

export const VIDEO = { width: 1080, height: 1920, fps: 30, frames: 150, seconds: 5, mapY: 240, mapHeight: 1440 } as const;
export type Project = (p: Pick<GPSPoint, 'lat' | 'lon'>) => { x: number; y: number };
export type MapImage = { image?: HTMLCanvasElement; project: Project; attributed: boolean };
export const paceLabel = (speed: number) => {
  if (!(speed > 0)) return '—';
  const s = Math.round(3600 / speed); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
// 150 frame intervals occupy exactly 5 s. Explicit final endpoint in the final
// interval (one-frame endpoint convention), without stretching any earlier time.
export function videoFrame(index: number, duration: number) {
  if (!Number.isInteger(index) || index < 0 || index >= VIDEO.frames) throw new RangeError('frame');
  return { timestamp: index / VIDEO.fps, duration: 1 / VIDEO.fps, elapsed: index === VIDEO.frames - 1 ? duration : duration * index / VIDEO.frames };
}
export function routeProjection(points: Pick<GPSPoint, 'lat' | 'lon'>[]): Project {
  const origin = points[0].lon;
  const xy = (p: Pick<GPSPoint, 'lat' | 'lon'>) => ({ x: origin + ((p.lon - origin + 540) % 360 - 180), y: -Math.log(Math.tan(Math.PI / 4 + Math.max(-85, Math.min(85, p.lat)) * Math.PI / 360)) * 180 / Math.PI });
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
  for (const p of points) { const v = xy(p); left = Math.min(left, v.x); right = Math.max(right, v.x); top = Math.min(top, v.y); bottom = Math.max(bottom, v.y); }
  const scale = Math.min((VIDEO.width - 120) / Math.max(right - left, .0001), (VIDEO.mapHeight - 160) / Math.max(bottom - top, .0001));
  return p => { const v = xy(p); return { x: VIDEO.width / 2 + (v.x - (left + right) / 2) * scale, y: VIDEO.mapHeight / 2 + (v.y - (top + bottom) / 2) * scale }; };
}
function drawLogo(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#285942'; ctx.beginPath(); ctx.roundRect(60, 75, 62, 62, 10); ctx.fill();
  ctx.fillStyle = 'white'; ctx.font = 'bold 35px system-ui'; ctx.textAlign = 'center'; ctx.fillText('R↗', 91, 118);
  ctx.fillStyle = '#234e40'; ctx.font = 'bold 42px system-ui'; ctx.textAlign = 'left'; ctx.fillText('RacePace', 145, 119);
}
function drawWeather(ctx: CanvasRenderingContext2D, kind: WeatherKind, x: number, y: number) {
  ctx.save(); ctx.translate(x, y); ctx.strokeStyle = '#234e40'; ctx.fillStyle = '#f4f5ef'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const sun = () => {
    ctx.beginPath(); ctx.arc(-12, -8, 12, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(-12 + Math.cos(a) * 19, -8 + Math.sin(a) * 19); ctx.lineTo(-12 + Math.cos(a) * 25, -8 + Math.sin(a) * 25); ctx.stroke(); }
  };
  const cloud = () => {
    ctx.beginPath(); ctx.moveTo(-20, 14); ctx.bezierCurveTo(-32, 14, -32, -5, -18, -7); ctx.bezierCurveTo(-14, -26, 16, -24, 20, -6); ctx.bezierCurveTo(36, -5, 38, 14, 24, 14); ctx.closePath(); ctx.fill(); ctx.stroke();
  };
  if (kind === 'clear') sun();
  else if (kind === 'fog') { for (const offset of [-10, 2, 14]) { ctx.beginPath(); ctx.moveTo(-28, offset); ctx.lineTo(30, offset); ctx.stroke(); } }
  else {
    if (kind === 'partly-cloudy') sun();
    cloud();
    if (kind === 'rain') for (const offset of [-12, 4, 20]) { ctx.beginPath(); ctx.moveTo(offset, 23); ctx.lineTo(offset - 5, 34); ctx.stroke(); }
    if (kind === 'snow') { ctx.font = '25px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#234e40'; ctx.fillText('✳  ✳', 3, 39); }
    if (kind === 'storm') { ctx.beginPath(); ctx.moveTo(7, 20); ctx.lineTo(-2, 36); ctx.lineTo(9, 34); ctx.lineTo(2, 49); ctx.stroke(); }
  }
  ctx.restore();
}
export function createReplayPainter(workout: Workout, language: Language, map: MapImage, weather: WorkoutWeather | null = null) {
  const background = document.createElement('canvas'); background.width = VIDEO.width; background.height = VIDEO.height;
  const ctx = background.getContext('2d')!;
  const text = (en: string, zh: string) => language === 'en' ? en : zh;
  ctx.fillStyle = '#f4f5ef'; ctx.fillRect(0, 0, VIDEO.width, VIDEO.height);
  drawLogo(ctx);
  ctx.fillStyle = '#234e40'; ctx.textAlign = 'right'; ctx.font = '29px system-ui';
  ctx.fillText(workoutDateLabel(workout.points[0].time, weather?.timezone), weather ? 950 : 1020, 92);
  if (weather) drawWeather(ctx, weather.kind, 995, 80);
  ctx.font = 'bold 43px system-ui'; ctx.fillText(`${(workout.distance / 1000).toFixed(2)} km · ${paceLabel(workout.averageSpeed)} /km`, 1020, 164);
  ctx.textAlign = 'left'; ctx.save(); ctx.translate(0, VIDEO.mapY);
  if (map.image) ctx.drawImage(map.image, 0, 0, VIDEO.width, VIDEO.mapHeight);
  else {
    ctx.fillStyle = '#e7ece3'; ctx.fillRect(0, 0, VIDEO.width, VIDEO.mapHeight);
    ctx.strokeStyle = '#d4dece'; ctx.lineWidth = 1;
    for (let x = 0; x < VIDEO.width; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, VIDEO.mapHeight); ctx.stroke(); }
    for (let y = 0; y < VIDEO.mapHeight; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(VIDEO.width, y); ctx.stroke(); }
  }
  ctx.lineWidth = 10; ctx.lineCap = 'round';
  for (let i = 1; i < workout.points.length; i++) {
    const p = workout.points[i], a = workout.points[i - 1]; if (p.breakBefore) continue;
    const from = map.project(a), to = map.project(p);
    ctx.strokeStyle = speedColor(sampledSpeed(workout.speedSamples ?? [], (a.time + p.time) / 2) ?? p.speed);
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
  }
  for (const [p, label, color] of [[workout.points[0], 'S', '#24634e'], [workout.points.at(-1)!, 'F', '#b34536']] as const) {
    const v = map.project(p); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(v.x, v.y, 25, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'white'; ctx.lineWidth = 5; ctx.stroke(); ctx.fillStyle = 'white'; ctx.font = 'bold 23px system-ui'; ctx.textAlign = 'center'; ctx.fillText(label, v.x, v.y + 8);
  }
  ctx.restore(); ctx.textAlign = 'left'; ctx.fillStyle = '#234e40'; ctx.font = 'bold 31px system-ui';
  ctx.fillText(`${text('Time', '時間')} ${Math.floor(workout.duration / 60)}:${String(Math.floor(workout.duration % 60)).padStart(2, '0')} · AVG ${workout.averageSpeed.toFixed(1)} km/h`, 60, 1760);
  ctx.textAlign = 'right'; ctx.font = '10px system-ui'; ctx.fillStyle = '#526354';
  ctx.fillText(map.attributed ? 'OpenFreeMap © OpenMapTiles © OpenStreetMap contributors' : text('Route-only map · no place labels', '純路線圖 · 無地名'), 1020, 1778);
  if (weather) ctx.fillText('Weather: Open-Meteo', 1020, 1794);
  return (canvas: HTMLCanvasElement, elapsed: number) => {
    const c = canvas.getContext('2d')!; c.drawImage(background, 0, 0);
    const p = positionAt(workout, elapsed), v = map.project(p);
    c.fillStyle = '#ffffff88'; c.beginPath(); c.arc(v.x, v.y + VIDEO.mapY, 36, 0, Math.PI * 2); c.fill();
    c.fillStyle = speedColor(p.speed); c.beginPath(); c.arc(v.x, v.y + VIDEO.mapY, 20, 0, Math.PI * 2); c.fill(); c.lineWidth = 6; c.strokeStyle = 'white'; c.stroke();
    c.fillStyle = '#d6dfd1'; c.fillRect(60, 1850, 960, 6); c.fillStyle = '#285942'; c.fillRect(60, 1850, 960 * elapsed / workout.duration, 6);
  };
}
