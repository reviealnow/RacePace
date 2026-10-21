import { useEffect, useRef } from 'react';
import type { GPSPoint } from './workout';
import type { Language } from './i18n';
import { routeProjection, VIDEO } from './replay-render';
export default function StaticRoute({ points, language }: { points: GPSPoint[]; language: Language }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const text = (en: string, zh: string) => language === 'en' ? en : zh;
  useEffect(() => {
    const ctx = canvas.current!.getContext('2d')!, project = routeProjection(points);
    ctx.fillStyle = '#e7ece3'; ctx.fillRect(0, 0, VIDEO.width, VIDEO.mapHeight); ctx.strokeStyle = '#285942'; ctx.lineWidth = 5; ctx.beginPath();
    points.forEach((p, i) => { const v = project(p); if (!i || p.breakBefore) ctx.moveTo(v.x, v.y); else ctx.lineTo(v.x, v.y); }); ctx.stroke();
  }, [points]);
  return <section className="panel replay-empty"><h2>{text('Route only — timestamps missing', '僅有路線 — 缺少時間戳記')}</h2><p role="status">{text('This GPX has no timestamps. Pace, accurate replay and MP4 export are unavailable. Export the original timed GPX from your recording app.', '此 GPX 沒有時間戳記，無法計算配速、準確重播或匯出 MP4。請從紀錄應用程式匯出含時間的原始 GPX。')}</p><canvas ref={canvas} width={VIDEO.width} height={VIDEO.mapHeight} style={{ width: '100%' }} aria-label={text('Untimed GPS route', '無時間資料的 GPS 路線')}/><button disabled>{text('Pace-accurate replay unavailable', '無法進行準確配速重播')}</button> <button disabled>{text('Export MP4 unavailable', '無法匯出 MP4')}</button></section>;
}
