import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import course from './data/course.json';
import { csvExport, durationLabel, predict, riskLabels, clockLabel, type Settings } from './engine';
import { translate, checkpointName, historyLabel, type Language, type TranslationKey } from './i18n';
import './style.css';

function initialLanguage(): Language {
  try { return localStorage.getItem('racepace-language-v1') === 'en' ? 'en' : 'zh'; } catch { return 'zh'; }
}

const defaults: Settings = { pace: '6:30', delay: 0, start: course.startTime, cutoffs: course.checkpoints.map(g => g.closeTime) };
const key = 'racepace-settings-v1';
function initialSettings(): Settings {
  try { const saved = JSON.parse(localStorage.getItem(key) || 'null'); if (saved) { predict(course.checkpoints, saved); return saved; } } catch { /* Ignore stale or unavailable storage. */ }
  return defaults;
}
function RouteMap({ language }: { language: Language }) {
  const t = (text: TranslationKey) => translate(language, text);
  const languageRef = useRef(language);
  const basemapRef = useRef<ReturnType<typeof import('./basemap').createBasemap> | null>(null);
  const [basemapError, setBasemapError] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  useEffect(() => {
    if (!ref.current) return;
    const map = L.map(ref.current, { scrollWheelZoom: false, zoomControl: false, zoomAnimation: false }).setView([25.055, 121.54], 13);
    mapRef.current = map;
    let disposed = false;
    // Load the vector renderer separately so pace controls remain quick to load.
    import('./basemap').then(({ createBasemap }) => {
      if (!disposed) basemapRef.current = createBasemap(map, languageRef.current, () => { if (!disposed) setBasemapError(true); });
    }).catch(() => { if (!disposed) setBasemapError(true); });
    const route = L.polyline(course.coordinates.map(([lon, lat]) => [lat, lon] as [number, number]), { color: '#216857', weight: 5, opacity: 0.95 }).addTo(map);
    map.fitBounds(route.getBounds(), { padding: [32, 32] });
    const marker = (lat: number, lon: number, label: string, title: string, finish = false) => L.marker([lat, lon], { title, icon: L.divIcon({ className: '', html: `<span class="map-pin ${finish ? 'finish' : ''}">${label}</span>`, iconSize: [28, 28], iconAnchor: [14, 14] }) }).bindPopup(title).addTo(map);
    markersRef.current = [
      marker(course.coordinates[0][1], course.coordinates[0][0], 'S', 'Start'),
      ...course.checkpoints.map((g, i) => marker(g.lat, g.lon, i === 3 ? 'F' : g.id, g.name, i === 3)),
    ];
    const observer = new ResizeObserver(() => map.invalidateSize()); observer.observe(ref.current);
    return () => { disposed = true; observer.disconnect(); basemapRef.current?.destroy(); basemapRef.current = null; map.remove(); mapRef.current = null; markersRef.current = []; };
  }, []);
  useEffect(() => {
    languageRef.current = language;
    basemapRef.current?.setLanguage(language);
    const map = mapRef.current;
    if (!map) return;
    const zoom = L.control.zoom({ zoomInTitle: t('放大'), zoomOutTitle: t('縮小') }).addTo(map);
    const titles = [t('起點 · 市民廣場'), ...course.checkpoints.map(g => `${checkpointName(g.name, language)} · ${t('標記')} ${g.declaredKm} km · KML ${g.geometryKm.toFixed(3)} km`)];
    markersRef.current.forEach((marker, i) => {
      marker.setPopupContent(titles[i]);
      marker.getElement()?.setAttribute('title', titles[i]);
      marker.getElement()?.setAttribute('aria-label', titles[i]);
    });
    return () => { zoom.remove(); };
  }, [language]);
  return <><div ref={ref} className="map" role="region" aria-label={t("台北半馬 KML 路線地圖，可使用縮放按鈕與標記查看關門點")} />{basemapError && <p className="hint" role="status">{t('部分底圖無法載入，請重新整理頁面；賽道路線仍可查看。')}</p>}</>;
}
function App() {
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const t = (text: TranslationKey) => translate(language, text);
  useEffect(() => {
    document.documentElement.lang = language === 'en' ? 'en' : 'zh-Hant';
    document.title = `RacePace · ${translate(language, '把每一公里，跑進計畫。')}`;
    try { localStorage.setItem('racepace-language-v1', language); } catch { /* Switching still works without persistence. */ }
  }, [language]);
  const [settings, setSettings] = useState(initialSettings);
  const [active, setActive] = useState('plan');
  const [notice, setNotice] = useState<TranslationKey | ''>('');
  const [history, setHistory] = useState<string[]>(() => { try { const h = JSON.parse(localStorage.getItem('racepace-history-v1') || '[]'); return Array.isArray(h) ? h.filter(x => typeof x === 'string').slice(0, 10) : []; } catch { return []; } });
  const [draft, setDraft] = useState({ start: settings.start, cutoffs: settings.cutoffs });
  let error = ''; let rows: ReturnType<typeof predict> = [];
  try { rows = predict(course.checkpoints, settings); } catch (e) { error = (e as Error).message; }
  useEffect(() => { if (!error) { try { localStorage.setItem(key, JSON.stringify(settings)); } catch { setNotice('瀏覽器無法儲存設定；本次操作仍可使用。'); } } }, [settings, error]);
  const finish = rows.at(-1); const closest = rows.length ? rows.reduce((a, b) => a.margin < b.margin ? a : b) : undefined;
  const patch = (value: Partial<Settings>) => setSettings(s => ({ ...s, ...value }));
  function saveConfig(reset = false) {
    const next = reset ? defaults : { ...settings, ...draft };
    try {
      predict(course.checkpoints, next); setSettings(next); setDraft({ start: next.start, cutoffs: next.cutoffs });
      const timestamp = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });
      const entry = `${timestamp} · ${reset ? '還原原始設定' : '手動調整'} · 起跑 ${next.start} / 關門 ${next.cutoffs.join('、')}`;
      const updated = [entry, ...history].slice(0, 10); setHistory(updated);
      try { localStorage.setItem('racepace-history-v1', JSON.stringify(updated)); setNotice('賽事設定已儲存在此瀏覽器。'); } catch { setNotice('設定已套用；瀏覽器儲存不可用。'); }
    } catch (e) { setNotice((e as Error).message as TranslationKey); }
  }
  function download() {
    if (!rows.length) return;
    const url = URL.createObjectURL(new Blob([csvExport(rows, language)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'racepace-pace-plan.csv'; a.click(); URL.revokeObjectURL(url);
  }
  return <><a className="skip" href="#main">{t("跳至主要內容")}</a><header className="header"><a className="brand" href="#" aria-label={t("RacePace 首頁")}><span className="brand-mark">R<span>↗</span></span>RacePace<span className="edition">RUN WITH A PLAN</span></a><div className="header-actions"><div className="language-switch" role="group" aria-label={t("語言")}>{(["en", "zh"] as const).map(lang => <button key={lang} type="button" lang={lang === "zh" ? "zh-Hant" : "en"} aria-label={lang === "en" ? "English" : "繁體中文"} aria-pressed={language === lang} onClick={() => setLanguage(lang)}>{lang.toUpperCase()}</button>)}</div><span className="private"><i /> {t("個人規劃空間")}</span></div></header>
    <div className="shell"><aside className="sidebar"><div className="nav-caption">{t("你的賽事計畫")}</div><nav aria-label={t("主要導覽")}>{[['plan', '◫', t('配速總覽')], ['route', '⌁', t('賽道路線')], ['import', '↑', t('訓練匯入')]].map(([id, icon, label]) => <button key={id} className={active === id ? 'nav-item selected' : 'nav-item'} onClick={() => setActive(id)} aria-current={active === id ? 'page' : undefined}><span>{icon}</span>{label}{id === 'import' && <small>{t("即將推出")}</small>}</button>)}</nav><div className="side-race"><span className="eyebrow">NEXT CHALLENGE</span><strong>{t("台北半程馬拉松")}</strong><span>21.0975 <small>KM</small></span><div className="side-line"/><p>{t("追蹤你自己，帶你破PB")}</p></div><div className="side-footer">RACEPACE / v0.1<br/>Asia/Taipei · UTC+08:00</div></aside>
    <main id="main"><div className="page-heading"><div><div className="eyebrow">2026 TAIPEI · HALF MARATHON</div><h1>{active === 'import' ? t('每一次跑步，都有下一步。') : active === 'route' ? t('先熟悉路線，再安心出發。') : t('把每一公里，跑進計畫。')}</h1><p>{t("台北半馬配速計畫")} <span className="dot">·</span> {active === 'import' ? t('Apple Watch 訓練分析') : t('以自己的節奏，掌握每一個關門點。')}</p></div><span className="version">{t("第一版 · 配速模擬")}</span></div>
    {active === 'import' ? <section className="empty panel"><div className="empty-icon">↑</div><div className="eyebrow">YOUR NEXT RUN</div><h2>{t("訓練紀錄，準備就緒再出發")}</h2><p>{t("此版本提供賽道與配速模擬。FIT、TCX、GPX 匯入與 GPS 分段比對將在下一階段開放。")}</p><div className="file-types">FIT <span>·</span> TCX <span>·</span> GPX</div><p className="muted">{t("目前沒有訓練紀錄，也尚未讀取或上傳任何運動檔案。")}</p><button className="primary" onClick={() => setActive('plan')}>{t("先建立配速計畫 ↗")}</button></section> : <>
    {active === 'plan' && <><section className="metrics" aria-label={t("模擬摘要")} aria-live="polite"><div className="metric primary-metric"><span>{t("預估完賽耗時")} <small>{t("固定配速")}</small></span><strong>{finish ? durationLabel(finish.elapsed) : '—'}</strong><p>{t("抵達時刻")} <b>{finish ? clockLabel(finish.arrival, language) : '—'}</b></p><div className="metric-track"/></div><div className="metric"><span>{t("最緊迫關門點")}</span><strong>{closest ? checkpointName(closest.name, language) : '—'} <small>{closest ? `${closest.declaredKm} km` : ''}</small></strong><p>{closest ? language === 'en' ? `Closes at ${closest.closeTime}` : `於 ${closest.closeTime} 關門` : t('請檢查輸入設定')}</p></div><div className="metric"><span>{t("最小安全餘裕")}</span><strong className={closest && closest.margin < 0 ? 'red' : ''}>{closest ? `${closest.margin < 0 ? '−' : '+'}${(Math.abs(closest.margin) / 60).toFixed(1)}` : '—'} <small>{t("分鐘")}</small></strong><p><span className={`status ${closest?.risk || 'safe'}`}>{closest ? t(riskLabels[closest.risk]) : t('尚無結果')}</span></p></div></section>
    <section className="panel simulator"><div className="section-heading"><div><span className="step">01</span><h2>{t("找到你的比賽節奏")}</h2></div><span className="muted">{t("調整後即時更新")}</span></div><div className="controls"><fieldset><legend>{t("目標配速")} <span>MIN / KM</span></legend><div className="presets">{['5:30', '6:30', '7:00'].map(p => <button key={p} aria-pressed={settings.pace === p} className={settings.pace === p ? 'pace active' : 'pace'} onClick={() => patch({ pace: p })}>{p}<small>/ km</small></button>)}</div></fieldset><label className="field">{t("自訂配速")}<div className="input-wrap"><input aria-label={t("自訂配速")} value={settings.pace} onChange={e => patch({ pace: e.target.value })} placeholder="6:30" maxLength={5} inputMode="text"/><span>/ km</span></div></label><label className="field">{t("通過起跑線延遲")}<div className="input-wrap"><input aria-label={t("起跑延遲分鐘")} type="number" min="0" max="180" value={Number.isNaN(settings.delay) ? '' : settings.delay} onChange={e => patch({ delay: e.target.value === '' ? NaN : Number(e.target.value) })}/><span>{t("分鐘")}</span></div></label></div><div className="hint">{t("ⓘ 以標記里程 × 固定配速計算；補給、坡度與後段疲勞請自行納入目標配速。")}</div>{error && <p role="alert" className="error">{t(error as TranslationKey)}</p>}</section></>}
    <div className={active === 'route' ? 'route-layout wide' : 'route-layout'}><section className="panel map-panel"><div className="section-heading"><div><span className="step">02</span><h2>{t("賽道，一目了然")}</h2></div><span className="map-badge">{t("KML 路線")}</span></div><RouteMap language={language}/><div className="map-legend"><span><i className="route-line"/>{t("半馬路線")}</span><span><i className="legend-dot"/>{t("關門點")}</span><span><i className="legend-dot coral"/>{t("終點")}</span><a href="/course/route.geojson" download>{t("下載路線 ↗")}</a></div></section><section className="course-note"><div className="eyebrow">KNOW YOUR COURSE</div><h2>{t("同一條路線，")}<br/>{t("兩種里程。")}</h2><div className="distance"><span>{t("賽事標記里程")}</span><strong>21.0975 <small>km</small></strong><p>{t("用於配速與抵達時間預測")}</p></div><div className="distance"><span>{t("KML 幾何長度")}</span><strong>21.719 <small>km</small></strong><p>{t("用於 GPS 位置與路線比對")}</p></div><p className="note-bottom">{t("路線來自你提供的 KML，並非認證賽道測量。兩種里程不可互換。")}</p></section></div>
    <section className="panel checkpoints"><div className="section-heading"><div><span className="step">03</span><h2>{t("每一站，都心中有數")}</h2></div><button className="text-button" onClick={download} disabled={!rows.length}>{t("匯出 CSV ↓")}</button></div>{error && <p className="error" role="alert">{t(error as TranslationKey)}</p>}<div className="table-scroll"><table><thead><tr><th>{t("關門點")}</th><th>{t("標記 / KML 里程")}</th><th>{t("關門時間")}</th><th>{t("預估抵達")}</th><th>{t("安全餘裕")}</th><th>{t("風險")}</th></tr></thead><tbody>{rows.map((r, i) => <tr key={r.id}><td><span className={`checkpoint-number ${i === 3 ? 'last' : ''}`}>{i === 3 ? 'F' : r.id}</span><b>{checkpointName(r.name, language)}</b></td><td><b>{r.declaredKm}</b><span className="muted"> / {r.geometryKm.toFixed(3)} km</span></td><td>{r.closeTime}</td><td className="arrival">{clockLabel(r.arrival, language)}</td><td className={r.margin < 0 ? 'red' : ''}>{r.margin >= 0 ? '+' : '−'}{(Math.abs(r.margin) / 60).toFixed(1)} {t("分")}</td><td><span className={`status ${r.risk}`}>{t(riskLabels[r.risk])}</span></td></tr>)}</tbody></table></div><p className="table-foot">{t("全部為情境預估，非實測成績。低風險 ≥10 分鐘；留意 5–10 分鐘；高風險 0–5 分鐘；逾時 <0。此為產品提示，非大會規定。")}</p></section>
    <details className="panel settings" id="race-settings"><summary>{t("賽事時間與資料來源")} <span>{t("編輯設定 ＋")}</span></summary><p className="muted">{t("起跑與前三個關門點來自 KML；終點 10:00 為使用者確認。修改僅保留於此瀏覽器，顯示時區 Asia/Taipei。")}</p><div className="settings-fields"><label className="field">{t("起跑時間")}<input type="time" value={draft.start} onInput={e => { const value = e.currentTarget.value; setDraft(d => ({ ...d, start: value })); }}/></label>{course.checkpoints.map((g, i) => <label className="field" key={g.id}>{checkpointName(g.name, language)}<input type="time" value={draft.cutoffs[i]} onInput={e => { const value = e.currentTarget.value; setDraft(d => ({ ...d, cutoffs: d.cutoffs.map((v, j) => i === j ? value : v) })); }}/><small>{t(g.source as TranslationKey)}</small></label>)}</div><div className="settings-actions"><button className="primary" onClick={() => saveConfig()}>{t("儲存賽事設定")}</button><button className="text-button" onClick={() => saveConfig(true)}>{t("還原原始設定")}</button></div>{history.length > 0 && <div className="history"><h3>{t("最近設定變更")}</h3>{history.map((h, i) => <p key={i}>{historyLabel(h, language)}</p>)}</div>}</details></>}
    {notice && <p className="notice" role="status">{t(notice)}<button aria-label={t("關閉提示")} onClick={() => setNotice('')}>×</button></p>}
    <footer><span><b>RacePace</b>　{t("每一步，都有方向。")}</span><span>{t("使用者提供之賽事資料 · 請以大會最終公告為準")}</span></footer></main></div></>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>);
