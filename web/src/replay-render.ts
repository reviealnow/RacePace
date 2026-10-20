import { positionAt, sampledSpeed, speedColor, type GPSPoint, type Workout } from './workout';
import type { Language } from './i18n';

export const VIDEO = { width: 960, height: 720, fps: 30, frames: 150, seconds: 5, mapY: 136, mapHeight: 470 } as const;
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
  const scale = Math.min((VIDEO.width - 120) / Math.max(right - left, .0001), (VIDEO.mapHeight - 100) / Math.max(bottom - top, .0001));
  return p => { const v = xy(p); return { x: VIDEO.width / 2 + (v.x - (left + right) / 2) * scale, y: VIDEO.mapHeight / 2 + (v.y - (top + bottom) / 2) * scale }; };
}
export function createReplayPainter(workout: Workout, language: Language, map: MapImage) {
  const background = document.createElement('canvas'); background.width = VIDEO.width; background.height = VIDEO.height;
  const ctx = background.getContext('2d')!;
  const text = (en: string, zh: string) => language === 'en' ? en : zh;
  ctx.fillStyle = '#f4f5ef'; ctx.fillRect(0, 0, VIDEO.width, VIDEO.height);
  ctx.fillStyle = '#234e40'; ctx.font = 'bold 27px system-ui'; ctx.fillText('RacePace', 32, 44);
  ctx.font = '17px system-ui'; ctx.fillText(text('YOUR RUN · FIVE SECONDS', '你的跑程 · 精彩五秒'), 32, 74);
  if (workout.points.some(p => p.originalTime !== undefined)) {
    ctx.font = '13px system-ui'; ctx.fillText(text('Some GPS timing / speed estimated', '部分 GPS 時間／速度為估算值'), 32, 110);
  }
  ctx.textAlign = 'right'; ctx.fillText(workout.demo ? text('SYNTHETIC DEMO', '模擬示範') : text('WORKOUT REPLAY', '運動重播'), 928, 42);
  ctx.font = 'bold 24px system-ui'; ctx.fillText(`${(workout.distance / 1000).toFixed(2)} km   ·   ${paceLabel(workout.averageSpeed)} /km`, 928, 78);
  ctx.font = '16px system-ui'; ctx.fillText(`${text('Duration', '運動時間')} ${Math.floor(workout.duration / 60)}:${String(Math.floor(workout.duration % 60)).padStart(2, '0')}   ·   ${text('Average', '平均')} ${workout.averageSpeed.toFixed(1)} km/h`, 928, 110);
  ctx.textAlign = 'left'; ctx.save(); ctx.translate(0, VIDEO.mapY);
  if (map.image) ctx.drawImage(map.image, 0, 0, VIDEO.width, VIDEO.mapHeight);
  else {
    ctx.fillStyle = '#e7ece3'; ctx.fillRect(0, 0, VIDEO.width, VIDEO.mapHeight);
    ctx.strokeStyle = '#d4dece'; ctx.lineWidth = 1;
    for (let x = 0; x < VIDEO.width; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, VIDEO.mapHeight); ctx.stroke(); }
    for (let y = 0; y < VIDEO.mapHeight; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(VIDEO.width, y); ctx.stroke(); }
  }
  ctx.lineWidth = 6; ctx.lineCap = 'round';
  for (let i = 1; i < workout.points.length; i++) {
    const p = workout.points[i], a = workout.points[i - 1]; if (p.breakBefore) continue;
    const from = map.project(a), to = map.project(p);
    ctx.strokeStyle = speedColor(sampledSpeed(workout.speedSamples ?? [], (a.time + p.time) / 2) ?? p.speed);
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
  }
  for (const [p, label, color] of [[workout.points[0], 'S', '#24634e'], [workout.points.at(-1)!, 'F', '#b34536']] as const) {
    const v = map.project(p); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(v.x, v.y, 15, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'white'; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = 'white'; ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'center'; ctx.fillText(label, v.x, v.y + 5);
  }
  ctx.restore(); ctx.textAlign = 'left'; ctx.font = '13px system-ui'; ctx.fillStyle = '#526354';
  ctx.fillText(map.attributed ? 'OpenFreeMap © OpenMapTiles © OpenStreetMap contributors · openstreetmap.org/copyright' : text('Route-only map · no place labels', '純路線圖 · 無地名'), 32, 701);
  return (canvas: HTMLCanvasElement, elapsed: number) => {
    const c = canvas.getContext('2d')!; c.drawImage(background, 0, 0);
    const p = positionAt(workout, elapsed), v = map.project(p);
    c.fillStyle = '#ffffff88'; c.beginPath(); c.arc(v.x, v.y + VIDEO.mapY, 21, 0, Math.PI * 2); c.fill();
    c.fillStyle = speedColor(p.speed); c.beginPath(); c.arc(v.x, v.y + VIDEO.mapY, 11, 0, Math.PI * 2); c.fill(); c.lineWidth = 4; c.strokeStyle = 'white'; c.stroke();
    c.fillStyle = '#234e40'; c.font = 'bold 23px system-ui'; c.fillText(`${p.speed.toFixed(1)} km/h`, 32, 649);
    c.textAlign = 'right'; c.fillText(elapsed >= workout.duration ? text('FINISH', '抵達終點') : `${(elapsed / workout.duration * 5).toFixed(1)} / 5.0 s`, 928, 649); c.textAlign = 'left';
    c.fillStyle = '#d6dfd1'; c.fillRect(32, 667, 896, 5); c.fillStyle = '#285942'; c.fillRect(32, 667, 896 * elapsed / workout.duration, 5);
  };
}
