import { VIDEO, routeProjection, type MapImage } from './replay-render';
import type { Workout } from './workout';
import type { Language } from './i18n';
import { isNameLabel, nameExpression } from './map-language';

export async function exportBasemap(workout: Workout, language: Language, includeMap: boolean, signal: AbortSignal): Promise<MapImage> {
  const fallback: MapImage = { project: routeProjection(workout.points), attributed: false };
  if (!includeMap) return fallback;
  const container = document.createElement('div');
  container.style.cssText = `position:fixed;left:-10000px;top:0;width:${VIDEO.width}px;height:${VIDEO.mapHeight}px;pointer-events:none`;
  container.setAttribute('aria-hidden', 'true');
  document.body.append(container);
  let map: import('maplibre-gl').Map | undefined;
  try {
    await import('./basemap'); // Reuse the application's bundled worker configuration.
    const { Map, LngLatBounds } = await import('maplibre-gl');
    signal.throwIfAborted();
    map = new Map({ container, style: 'https://tiles.openfreemap.org/styles/bright', interactive: false, attributionControl: false, canvasContextAttributes: { preserveDrawingBuffer: true }, pixelRatio: 1 });
    const bounds = new LngLatBounds(); workout.points.forEach(p => bounds.extend([p.lon, p.lat]));
    await new Promise<void>((resolve, reject) => {
      const finish = (error?: Error) => { clearTimeout(timer); signal.removeEventListener('abort', abort); error ? reject(error) : resolve(); };
      const abort = () => finish(new DOMException('Cancelled', 'AbortError'));
      const timer = setTimeout(() => finish(new Error('map timeout')), 15000);
      signal.addEventListener('abort', abort, { once: true });
      map!.once('load', () => {
        for (const layer of map!.getStyle().layers) if (layer.type === 'symbol' && isNameLabel(layer.layout?.['text-field'])) map!.setLayoutProperty(layer.id, 'text-field', nameExpression(language));
        map!.fitBounds(bounds, { padding: 50, duration: 0, maxZoom: 16 });
        map!.once('idle', () => finish());
      });
    });
    signal.throwIfAborted();
    const image = document.createElement('canvas'); image.width = VIDEO.width; image.height = VIDEO.mapHeight;
    const ctx = image.getContext('2d')!; ctx.drawImage(map.getCanvas(), 0, 0); ctx.getImageData(0, 0, 1, 1); // Fail closed on a tainted canvas.
    const center = map.getCenter(), zoom = map.getZoom();
    // Frozen Web Mercator transform; export never moves or captures the interactive map.
    const scale = 512 * 2 ** zoom;
    const mercY = (lat: number) => (1 - Math.log(Math.tan(Math.PI / 4 + Math.max(-85.051129, Math.min(85.051129, lat)) * Math.PI / 360)) / Math.PI) / 2;
    return { image, attributed: true, project: p => ({ x: VIDEO.width / 2 + ((p.lon - center.lng + 540) % 360 - 180) / 360 * scale, y: VIDEO.mapHeight / 2 + (mercY(p.lat) - mercY(center.lat)) * scale }) };
  } catch (error) { if (signal.aborted) throw error; return fallback; }
  finally { map?.remove(); container.remove(); }
}
