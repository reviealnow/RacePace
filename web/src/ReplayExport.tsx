import { useEffect, useRef, useState } from 'react';
import type { Workout } from './workout';
import type { Language } from './i18n';

export default function ReplayExport({ workout, language }: { workout: Workout; language: Language }) {
  const text = (en: string, zh: string) => language === 'en' ? en : zh;
  const [supported, setSupported] = useState<boolean | null>(null);
  const [includeMap, setIncludeMap] = useState(true);
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<{ url: string; file: File; mapIncluded: boolean } | null>(null);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => { let alive = true; import('./replay-video').then(m => m.supportsMP4()).then(value => { if (alive) setSupported(value); }).catch(() => { if (alive) setSupported(false); }); return () => { alive = false; }; }, []);
  useEffect(() => { controller.current?.abort(); setProgress(null); setResult(null); setError(''); return () => controller.current?.abort(); }, [workout, language, includeMap]);
  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);
  async function start() {
    const control = new AbortController(); controller.current = control; setError(''); setResult(null); setProgress(0);
    try {
      const { exportReplay } = await import('./replay-video');
      const exported = await exportReplay(workout, language, includeMap, control.signal, value => { if (!control.signal.aborted && controller.current === control) setProgress(value); });
      if (control.signal.aborted) return;
      setResult({ url: URL.createObjectURL(exported.blob), file: new File([exported.blob], 'racepace-replay-vertical.mp4', { type: 'video/mp4' }), mapIncluded: exported.mapIncluded });
    } catch (e) {
      if (!control.signal.aborted) setError(e instanceof Error && e.message === 'unsupported' ? 'unsupported' : 'failed');
    } finally { if (controller.current === control) { setProgress(null); controller.current = null; } }
  }
  async function share() {
    if (!result) return;
    try { await navigator.share({ files: [result.file], title: 'RacePace' }); }
    catch (e) { if (!(e instanceof DOMException && e.name === 'AbortError')) setError('share'); }
  }
  const canShare = result && typeof navigator.canShare === 'function' && navigator.canShare({ files: [result.file] });
  return <section className="replay-export" aria-label={text('Video export', '影片匯出')}>
    <div><span className="eyebrow">{text('TAKE YOUR RUN WITH YOU', '帶走你的跑步精彩')}</span><h3>{text('Five seconds. Ready to share.', '五秒精彩，隨時分享。')}</h3><p>{text('Vertical MP4 · 1080 × 1920 · 30 fps · no audio. Rendering can take longer than five seconds.', '直式 MP4 · 1080 × 1920 · 每秒 30 格 · 無音訊。製作可能超過五秒。')}</p></div>
    <label className="replay-export-option"><input type="checkbox" checked={!includeMap} disabled={progress !== null} onChange={e => setIncludeMap(!e.target.checked)}/>{text('Hide place labels: export a route-only map', '隱藏地名：匯出純路線圖')}</label>
    <p className="hint">{text('Your video reveals your route, including start and finish. Hiding labels does not anonymize its shape. The workout date appears in the video; filename, GPS metadata and Health source are omitted. To add local historical weather, export sends the rounded start area and date to Open-Meteo. The MP4 stays on this device until you share it.', '影片會顯示路線、起終點及運動日期，隱藏地名不代表路線已匿名。影片不含原始檔名、GPS 中繼資料或健康來源。為加入當地歷史天氣，匯出時會將概略起點區域與日期傳送至 Open-Meteo。MP4 會留在此裝置，直到你選擇分享。')}</p>
    {supported === false && <p role="status">{text('This browser cannot encode H.264 MP4. Try a current Chrome, Edge or Safari browser on a device with an H.264 encoder. Route replay still works.', '此瀏覽器無法編碼 H.264 MP4。請使用具備 H.264 編碼能力的裝置及新版 Chrome、Edge 或 Safari，路線重播仍可使用。')}</p>}
    {progress === null ? <button className="primary" disabled={!supported} onClick={() => void start()}>{supported === null ? text('Checking video support…', '檢查影片支援…') : text('Export MP4', '匯出 MP4')}</button> : <div className="replay-export-progress"><progress max="100" value={progress}/><span role="status">{progress === 0 ? text('Preparing map…', '準備底圖…') : `${text('Rendering', '製作中')} ${progress}%`}</span><button onClick={() => { controller.current?.abort(); setProgress(null); }}>{text('Cancel export', '取消匯出')}</button></div>}
    {error && <p role="alert">{error === 'share' ? text('Sharing is unavailable. Download the MP4 instead.', '無法分享，請改為下載 MP4。') : text('MP4 export failed. Close other busy tabs and retry, or try another supported browser.', 'MP4 匯出失敗，請關閉其他忙碌分頁後重試，或改用其他支援的瀏覽器。')}</p>}
    {result && <div className="replay-export-result"><video controls playsInline preload="metadata" src={result.url} aria-label={text('Exported five-second vertical video', '已匯出的五秒直式影片')}/><p>{result.mapIncluded ? text('Map attribution is embedded in every frame.', '每一格影片均包含底圖來源標示。') : text('Route-only background used. No external map imagery is included.', '使用純路線背景，未包含外部底圖影像。')}</p><a className="primary" href={result.url} download="racepace-replay-vertical.mp4">{text('Download MP4', '下載 MP4')}</a>{canShare && <button onClick={() => void share()}>{text('Share video', '分享影片')}</button>}</div>}
  </section>;
}
