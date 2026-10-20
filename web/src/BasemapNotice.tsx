import type { BasemapStatus } from './basemap-recovery';
import type { Language } from './i18n';
export default function BasemapNotice({status, language, retry}: {status: BasemapStatus; language: Language; retry: () => void}) {
  if (status === 'ready') return null;
  const en = language === 'en';
  return <div className="hint" role="status">
    {status === 'loading' ? (en ? 'Loading map details… Your route is available.' : '底圖載入中⋯仍可查看跑步路線。')
      : status === 'retrying' ? (en ? 'Map loading was interrupted. Retrying automatically… Your route is preserved.' : '底圖載入中斷，正在自動重試⋯跑步路線已保留。')
      : (en ? 'Map details could not load. Your route is preserved.' : '底圖暫時無法載入，跑步路線已保留。')}
    {status === 'failed' && <> <button className="text-button" onClick={retry}>{en ? 'Reload map' : '重新載入底圖'}</button></>}
  </div>;
}
