'use client';
import { useEffect, useState, type ComponentType } from 'react';
// Leaflet and workout imports remain browser-only; the existing application is
// unchanged apart from its mounting point and the private library integration.
export default function ClientApp() {
  const [App, setApp] = useState<ComponentType | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { let alive = true; import('../src/main').then(m => {if (alive) setApp(() => m.default);}).catch(() => {if (alive) setFailed(true);}); return () => {alive = false;}; }, []);
  return <div id="root">{App ? <App/> : <p role="status">{failed ? 'RacePace could not load. Please refresh this page.' : 'Loading RacePace…'}</p>}</div>;
}
