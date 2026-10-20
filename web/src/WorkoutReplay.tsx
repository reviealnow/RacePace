import WorkoutLibrary from './WorkoutLibrary';
import BasemapNotice from './BasemapNotice';
import type { BasemapStatus } from './basemap-recovery';
import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import course from './data/course.json';
import type { Language } from './i18n';
import { importWorkout, readAppleHealth } from './workout-import';
import { demoWorkout, positionAt, sampledSpeed, speedColor, replayElapsed, REPLAY_MS, WorkoutError, type Workout, type WorkoutErrorCode } from './workout';
import './workout-replay.css';
import ReplayExport from './ReplayExport';
import { paceLabel } from './replay-render';
import StaticRoute from './StaticRoute';
import { importUntimedGPX } from './workout-import';
import type { GPSPoint } from './workout';

const clock = (seconds: number) => `${Math.floor(seconds / 3600).toString().padStart(2, '0')}:${Math.floor(seconds / 60 % 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;

export default function WorkoutReplay({ language }: { language: Language }) {
  const text = (en: string, zh: string) => language === 'en' ? en : zh;
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [staticRoute, setStaticRoute] = useState<GPSPoint[] | null>(null);
  const [healthFile, setHealthFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<WorkoutErrorCode | ''>('');
  const [dragging, setDragging] = useState(false);
  const requestId = useRef(0);
  useEffect(() => () => { requestId.current++; }, []);
  async function loadFiles(files: File[]) {
    if (!files.length) return;
    const id = ++requestId.current;
    setLoading(true); setError('');
    try {
      const xml = files.filter(f => /\.xml$/i.test(f.name));
      const routes = files.filter(f => /\.(gpx|tcx|fit)$/i.test(f.name));
      if (xml.length > 1 || routes.length > 1) throw new WorkoutError('multiple');
      if (xml.length + routes.length !== files.length) throw new WorkoutError('format');
      const selectedHealth = xml[0] ?? healthFile;
      let next = workout && !workout.demo ? workout : null;
      if (routes[0]) {
        try { next = await importWorkout(routes[0]); }
        catch (error) {
          if (error instanceof WorkoutError && error.code === 'timestamps' && /\.gpx$/i.test(routes[0].name)) {
            const points = await importUntimedGPX(routes[0]);
            if (id === requestId.current) { setStaticRoute(points); setWorkout(null); setHealthFile(selectedHealth); }
            return;
          }
          throw error;
        }
      }
      if (selectedHealth && next) {
        try { next = await readAppleHealth(selectedHealth, next); }
        catch (error) {
          // Optional XML must not prevent replay of an otherwise valid new GPX.
          if (routes[0] && id === requestId.current) { setWorkout(next); setStaticRoute(null); setHealthFile(null); setError(error instanceof WorkoutError ? error.code : 'invalid'); return; }
          throw error;
        }
      }
      if (id !== requestId.current) return;
      setHealthFile(selectedHealth); setWorkout(next); setStaticRoute(null);
    } catch (e) { if (id === requestId.current) setError(e instanceof WorkoutError ? e.code : 'invalid'); }
    finally { if (id === requestId.current) setLoading(false); }
  }
  const errors = {
    format: text('Choose one GPX route, optionally with Apple Health export.xml. TCX and FIT are also supported.', '請選擇一個 GPX 路線，可搭配 Apple Health export.xml，亦支援 TCX 與 FIT。'),
    size: text('Route limit: 25 MB / 100,000 points. Apple Health XML limit: 1 GB.', '路線上限：25 MB／100,000 點；Apple Health XML 上限：1 GB。'),
    invalid: text('The file is malformed or unreadable. Export it again and retry.', '檔案格式損壞或無法讀取，請重新匯出後再試。'),
    points: text('A route needs at least two valid GPS points. XML workout summaries alone do not contain a replayable route.', '路線至少需兩個有效 GPS 點。僅有 XML 運動摘要無法重播路線。'),
    duration: text('The route must have a positive duration of at most seven days.', '路線須有有效時間，且不超過七天。'),
    timestamps: text('This route contains missing, out-of-order, or ambiguous GPS times that cannot be safely estimated. Try another workout export.', '此路線的 GPS 時間有缺漏、順序錯誤或無法安全估算的重複紀錄，請嘗試重新匯出運動檔案。'),
    health: text('Choose an Apple Health HealthData XML export and its matching GPX route.', '請選擇 Apple Health 的 HealthData XML 匯出檔及對應 GPX 路線。'),
    mismatch: text('No unique matching run was found in the XML. Use the original GPX filename and the full route from the same workout.', 'XML 中找不到唯一對應的跑步紀錄，請使用同次運動的完整 GPX，並保留原始檔名。'),
    multiple: text('Import one workout route at a time, with at most one Apple Health XML export.', '每次請匯入一個運動路線，最多搭配一個 Apple Health XML 匯出檔。'),
  };
  return <div className="workout-replay">
    <WorkoutLibrary language={language} workout={workout} onOpen={next => {requestId.current++;setLoading(false);setWorkout(next);setStaticRoute(null);setHealthFile(null);setError('');}}/>
    <section className={`replay-import ${dragging ? 'is-dragging' : ''}`} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); void loadFiles(Array.from(e.dataTransfer.files)); }} aria-label={text('Import workout', '匯入運動紀錄')}>
      <div className="replay-import-icon" aria-hidden="true">↥</div>
      <div className="replay-import-copy"><strong>{text('Your whole run. Five seconds.', '完整跑程，五秒呈現。')}</strong><p>{text('Choose a GPX route, with Apple Health export.xml if available. Files stay on this device unless you choose Save to my library.', '選擇 GPX 路線，可一併加入 Apple Health export.xml。檔案在此裝置處理，選擇「儲存到我的紀錄」才會上傳。')}</p></div>
      <label className={`primary replay-file ${loading ? 'is-loading' : ''}`}>{loading ? text('Reading…', '讀取中…') : text('Choose workout files', '選擇運動檔案')}<input type="file" multiple accept=".gpx,.xml,.tcx,.fit" disabled={loading} onChange={e => { void loadFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }} aria-label={text('Choose workout files', '選擇運動檔案')}/></label>
    </section>
    {healthFile && <p className="replay-health-file">{text('Apple Health XML selected:', '已選擇 Apple Health XML：')} {healthFile.name} <button className="text-button" onClick={() => { requestId.current++; setLoading(false); setHealthFile(null); setWorkout(null); setStaticRoute(null); }}>{text('Clear files', '清除檔案')}</button></p>}
    {error && <p role="alert" className="error replay-error">{errors[error]}</p>}
    {staticRoute && !workout ? <StaticRoute points={staticRoute} language={language}/> : workout ? <ReplayPlayer key={`${workout.name}-${workout.health?.source ?? ''}-${workout.recordedSpeedCount}`} workout={workout} language={language} loading={loading} onClear={() => { setWorkout(null); setError(''); }}/>
      : <section className="panel replay-empty"><span className="eyebrow">{text('GPS → YOUR FIVE-SECOND STORY', 'GPS → 你的五秒跑程')}</span><h2>{healthFile ? text('Now add the matching GPX route.', '接著加入對應的 GPX 路線。') : text('Real route. Real rhythm.', '真實路線，真實節奏。')}</h2><p>{text('Your recorded timestamps set the rhythm. Every timed GPS point stays in the route. Faster sections move faster; stops remain stops.', '紀錄時間決定節奏，保留每個有時間的 GPS 點。快跑段移動更快，停留段維持停留。')}</p><p>{text('Apple Health XML provides workout metrics; GPS locations come from the matching GPX. No route is invented from summary data.', 'Apple Health XML 提供運動數據，GPS 座標來自對應 GPX，不會從摘要虛構路線。')}</p><button className="text-button" disabled={loading} onClick={() => { setWorkout(demoWorkout(course.coordinates)); setError(''); }}>{text('Preview with clearly labelled demo data ↗', '使用明確標示的示範資料預覽 ↗')}</button></section>}
  </div>;
}

function ReplayPlayer({ workout, language, loading, onClear }: { workout: Workout; language: Language; loading: boolean; onClear: () => void }) {
  const text = (en: string, zh: string) => language === 'en' ? en : zh;
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [basemapStatus, setBasemapStatus] = useState<BasemapStatus>('loading');
  const [baseAttempt, setBaseAttempt] = useState(0);
  const canvas = useRef<HTMLDivElement>(null);
  const dot = useRef<L.CircleMarker | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseRef = useRef<ReturnType<typeof import('./basemap').createBasemap> | null>(null);
  const languageRef = useRef(language);
  const endpoints = useRef<L.Marker[]>([]);
  const position = positionAt(workout, elapsed);
  const estimatedTimes = workout.points.filter(p => p.originalTime !== undefined).length;
  const progress = elapsed / workout.duration;
  const colour = speedColor(position.speed);
  const finished = elapsed >= workout.duration;
  const playbackSeconds = progress * REPLAY_MS / 1000;

  useEffect(() => { setElapsed(0); setPlaying(false); }, [workout]);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const started = performance.now();
    const resumeAt = elapsed;
    const tick = (now: number) => {
      const next = replayElapsed(workout.duration, now - started, resumeAt);
      setElapsed(next);
      if (next < workout.duration) frame = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, workout]);
  useEffect(() => { if (loading) setPlaying(false); }, [loading]);
  useEffect(() => { if (finished) setPlaying(false); }, [finished]);

  useEffect(() => {
    if (!canvas.current) return;
    setBasemapStatus('loading');
    let disposed = false;
    const map = L.map(canvas.current, { scrollWheelZoom: false, zoomControl: false, zoomAnimation: false, preferCanvas: true });
    mapRef.current = map;
    const runnerPane = map.createPane('replay-runner');
    runnerPane.style.zIndex = '650'; runnerPane.style.pointerEvents = 'none';
    L.control.zoom({ position: 'bottomleft' }).addTo(map);
    import('./basemap').then(({ createBasemap }) => {
      if (!disposed) baseRef.current = createBasemap(map, languageRef.current, status => { if (!disposed) setBasemapStatus(status); });
    }).catch(status => { if (!disposed) setBasemapStatus(status); });
    const groups = new Map<string, L.LatLngTuple[][]>();
    for (let i = 1; i < workout.points.length; i++) {
      const p = workout.points[i]; const prev = workout.points[i - 1];
      if (p.breakBefore) continue;
      const color = speedColor(Math.round(sampledSpeed(workout.speedSamples ?? [], (prev.time + p.time) / 2) ?? p.speed));
      if (!groups.has(color)) groups.set(color, []);
      groups.get(color)!.push([[prev.lat, prev.lon], [p.lat, p.lon]]);
    }
    groups.forEach((segments, color) => L.polyline(segments, { color, weight: 5, opacity: 0.85, interactive: false, smoothFactor: 0 }).addTo(map));
    const first = workout.points[0]; const last = workout.points.at(-1)!;
    const pin = (p: typeof first, label: string, finish: boolean) => L.marker([p.lat, p.lon], {
      icon: L.divIcon({ className: '', html: `<span class="replay-pin ${finish ? 'replay-finish' : ''}">${label}</span>`, iconSize: [30, 30], iconAnchor: [15, 15] }),
      zIndexOffset: -100,
    }).addTo(map);
    endpoints.current = [pin(first, 'S', false), pin(last, 'F', true)];
    dot.current = L.circleMarker([first.lat, first.lon], { radius: 10, color: '#fff', weight: 3, fillColor: speedColor(0), fillOpacity: 1, className: 'runner-dot', interactive: false, renderer: L.svg({ pane: 'replay-runner' }) }).addTo(map);
    const bounds = L.latLngBounds(workout.points.map(p => [p.lat, p.lon] as L.LatLngTuple));
    const fit = () => map.fitBounds(bounds, { paddingTopLeft: [38, 100], paddingBottomRight: [38, 80], maxZoom: 16 });
    fit();
    const observer = new ResizeObserver(() => { map.invalidateSize(); fit(); }); observer.observe(canvas.current);
    return () => { disposed = true; observer.disconnect(); baseRef.current?.destroy(); baseRef.current = null; dot.current = null; endpoints.current = []; map.remove(); mapRef.current = null; };
  }, [workout, baseAttempt]);

  useEffect(() => {
    languageRef.current = language;
    baseRef.current?.setLanguage(language);
    endpoints.current.forEach((marker, i) => {
      const label = i ? text('Finish', '終點') : text('Start', '起點');
      marker.bindTooltip(label); marker.getElement()?.setAttribute('aria-label', label);
    });
    const container = mapRef.current?.getContainer();
    for (const [selector, label] of [['.leaflet-control-zoom-in', text('Zoom in', '放大')], ['.leaflet-control-zoom-out', text('Zoom out', '縮小')]]) {
      container?.querySelector(selector)?.setAttribute('title', label);
      container?.querySelector(selector)?.setAttribute('aria-label', label);
    }
  }, [language, workout, baseAttempt]);
  useEffect(() => {
    dot.current?.setLatLng([position.lat, position.lon]).setStyle({ fillColor: colour });
  }, [position.lat, position.lon, colour, workout, baseAttempt]);

  const chartPoints = useMemo(() => workout.points.filter((_, i) => i % Math.max(1, Math.floor(workout.points.length / 240)) === 0 || i === workout.points.length - 1).map(p => ({ ...p, speed: sampledSpeed(workout.speedSamples ?? [], p.time) ?? p.speed })), [workout]);
  const maxSpeed = Math.max(18, ...chartPoints.map(p => p.speed));
  const chart = chartPoints.map(p => `${p.elapsed / workout.duration * 1000},${64 - p.speed / maxSpeed * 56}`).join(' ');

  return <>
    <section className="panel replay-panel">
      <div className="replay-heading"><div><div className="eyebrow">{text('WORKOUT REPLAY', '運動路線重播')}</div><h2>{workout.demo ? text('A lap through Taipei', '沿著台北，跑一趟') : workout.name}</h2></div><span className={`replay-badge ${workout.demo ? 'demo' : ''}`}>{workout.demo ? text('DEMO · SIMULATED SPEED', '示範 · 模擬速度') : text('IMPORTED WORKOUT', '已匯入紀錄')}</span></div>
      <div className="replay-map-wrap">
        <div ref={canvas} className="replay-map" role="region" aria-label={text('Workout route with a runner dot coloured by speed', '依速度變色的跑者動態路線圖')}/>
        <button className="replay-fit" onClick={() => mapRef.current?.fitBounds(L.latLngBounds(workout.points.map(p => [p.lat, p.lon] as L.LatLngTuple)), { paddingTopLeft: [38, 100], paddingBottomRight: [38, 80], maxZoom: 16, animate: false })}>{text('Fit full route', '顯示完整路線')}</button>
        <div className="replay-map-status" data-playback-seconds={playbackSeconds.toFixed(3)}><i style={{ background: colour }}/>{position.gap ? text('GPS gap', 'GPS 缺口') : finished ? text('Finished', '已抵達終點') : playing ? `${text('Running', '重播中')} · ${playbackSeconds.toFixed(1)} / 5.0s` : text('Ready to replay', '準備重播')}</div>
        <div className="replay-average"><span>{text('AVERAGE SPEED', '平均速度')}</span><strong>{workout.averageSpeed.toFixed(1)} <small>km/h</small></strong><p>{text('Route distance / elapsed time', '路線距離 ÷ 經過時間')}</p></div>
        <div className="replay-speed-key"><span>{text('SPEED', '速度')} <small>km/h</small></span><div className="replay-gradient"/><div className="replay-scale"><span>0</span><span>6</span><span>12</span><span>18+</span></div></div>
      </div>
      <BasemapNotice status={basemapStatus} language={language} retry={() => baseRef.current ? baseRef.current.retry() : setBaseAttempt(n => n + 1)} />
      <div className="replay-dashboard"><div className="replay-current"><span>{text('CURRENT SPEED', '目前速度')}</span><strong style={{ color: colour }}>{position.gap ? '—' : position.speed.toFixed(1)} <small>km/h</small></strong></div><div><span>{text('DISTANCE', '距離')}</span><strong>{(position.distance / 1000).toFixed(2)} <small>/ {(workout.distance / 1000).toFixed(2)} km</small></strong></div><div><span>{text('ELAPSED', '經過時間')}</span><strong>{clock(elapsed)} <small>/ {clock(workout.duration)}</small></strong></div></div>
      <p className="replay-recorded-summary">{text('Average pace', '平均配速')}: {paceLabel(workout.averageSpeed)} /km · {text('Recorded start (UTC)', '紀錄起始時間（UTC）')}: {new Date(workout.points[0].time).toISOString().replace('T', ' ').replace('.000Z', '')}</p>
      <div className="replay-timeline"><svg viewBox="0 0 1000 72" preserveAspectRatio="none" role="img" aria-label={text('Speed over the workout timeline', '運動速度時間軸')}><defs><linearGradient id="speed-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4d987c" stopOpacity=".28"/><stop offset="100%" stopColor="#4d987c" stopOpacity=".02"/></linearGradient></defs><polygon points={`0,72 ${chart} 1000,72`} fill="url(#speed-area)"/><polyline points={chart} fill="none" stroke="#74a58d" strokeWidth="2" vectorEffect="non-scaling-stroke"/><line x1={progress * 1000} y1="0" x2={progress * 1000} y2="72" stroke="#234e40" strokeWidth="2"/></svg><input aria-label={text('Workout timeline', '運動時間軸')} type="range" min="0" max={workout.duration} step="0.1" value={elapsed} onChange={e => { setPlaying(false); setElapsed(Number(e.target.value)); }}/><div className="replay-timeline-labels"><span>{text('START', '起點')}</span><span>{text('Drag to explore your run', '拖曳以查看沿途速度')}</span><span>{text('FINISH', '終點')}</span></div></div>
      <div className="replay-controls"><div className="replay-actions"><button className="primary replay-play" disabled={loading} onClick={() => { if (finished) setElapsed(0); setPlaying(value => !value); }} aria-label={playing ? text('Pause replay', '暫停重播') : text('Play replay', '播放重播')}><span aria-hidden="true">{playing ? 'Ⅱ' : '▶'}</span>{playing ? text('Pause', '暫停') : finished ? text('Replay', '再播一次') : text('Play run', '播放路線')}</button><button className="replay-reset" onClick={() => { setElapsed(0); setPlaying(false); }} aria-label={text('Return to start', '返回起點')}>↺</button></div><span className="replay-five"><b>5.00 s</b> {text('full-run replay', '完整跑程重播')}</span><span className="replay-rate-note">{estimatedTimes ? text('Some timing estimated · fixed timeline', '部分時間經估算 · 固定時間軸') : text('Original timestamps · one fixed timeline', '原始時間戳記 · 固定時間軸')}</span></div>
      {workout.health && <div className="replay-health-summary"><strong>Apple Health · {workout.health.source}</strong><span>{text('Recorded distance', '紀錄距離')}: {workout.health.distance === undefined ? '—' : `${(workout.health.distance / 1000).toFixed(2)} km`}</span><span>{text('Active duration', '活動時間')}: {Number.isFinite(workout.health.activeSeconds) ? clock(workout.health.activeSeconds!) : '—'}</span></div>}
      {estimatedTimes > 0 && <p className="hint" role="status">{text(`${estimatedTimes} repeated GPS timestamp(s) adjusted using the next valid time. All route points and total duration are preserved. Timing and GPS-derived speed around these points are estimates. Your original file is unchanged.`, `${estimatedTimes} 個重複 GPS 時間已依下一筆有效時間補正。保留全部路線點及總時長；這些點附近的時間與 GPS 計算速度為估算值。原始檔案未變更。`)}</p>}
      <ReplayExport workout={workout} language={language}/>
      <div className="replay-note">{workout.demo ? text('DEMO ONLY — simulated timestamps on the Taipei course. Import your files for a real, data-driven replay.', '僅為示範：台北路線搭配模擬時間。匯入檔案後才會呈現真實資料重播。') : text('Position follows every original GPS point along the workout timeline. The full recorded timeline is compressed into 5 seconds, including stops.', '位置依循每個原始 GPS 點與運動時間軸，完整紀錄時間壓縮為五秒，包含停留時間。')}<p>{workout.recordedSpeedCount > 0 ? text('Colour uses recorded speed where available, otherwise GPS distance / time. Average uses GPS distance / elapsed time, including stops.', '顏色優先採用紀錄速度，缺少時以 GPS 距離／時間估算。平均速度使用 GPS 距離／經過時間，包含停留。') : text('Speed and colour use GPS distance / time. Average includes stops. Playback duration never changes these values.', '速度與顏色依 GPS 距離／時間計算，平均包含停留，播放時長不影響數值。')}</p>{workout.gaps > 0 && <p>{text(`${workout.gaps} sparse, disconnected or jumpy intervals detected. All coordinates are retained. Separate track segments hold position until the next segment; no missing route is invented.`, `偵測到 ${workout.gaps} 處稀疏、斷開或跳動的紀錄，保留全部座標。分段間停留至下一段，不會虛構缺漏路線。`)}</p>}<p>{text('Imported files stay in browser memory unless you save the replay to your library. Map tiles load from OpenFreeMap.', '匯入檔案保留於瀏覽器記憶體，選擇儲存才會將重播資料上傳。底圖由 OpenFreeMap 載入。')}</p><button className="text-button" onClick={onClear}>{text('Choose another workout', '選擇其他運動紀錄')}</button></div>
    </section>
  </>;
}
