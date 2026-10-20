import { maplibreGL } from '@maplibre/maplibre-gl-leaflet';
import { setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Map as LeafletMap } from 'leaflet';
import type { Language } from './i18n';
import { isNameLabel, nameExpression } from './map-language';
import { basemapRecovery, type BasemapStatus } from './basemap-recovery';

setWorkerUrl('/map-worker.js');

export function createBasemap(map: LeafletMap, initialLanguage: Language, report: (status: BasemapStatus) => void) {
  let language = initialLanguage;
  let updateLanguage = () => {};
  const recovery = basemapRecovery((ready, failed) => {
    const layer = maplibreGL({
      style: 'https://tiles.openfreemap.org/styles/bright',
      attributionControl: { customAttribution: '<a href="https://openfreemap.org/">OpenFreeMap</a> © <a href="https://openmaptiles.org/">OpenMapTiles</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' },
    });
    try { layer.addTo(map); } catch (error) {
      try { layer.remove(); } catch { /* An incomplete WebGL renderer may have no cleanup state. */ }
      throw error;
    }
    const renderer = layer.getMaplibreMap();
    const applyLanguage = () => {
      for (const item of renderer.getStyle()?.layers ?? []) {
        if (item.type === 'symbol' && isNameLabel(item.layout?.['text-field'])) {
          renderer.setLayoutProperty(item.id, 'text-field', nameExpression(language));
        }
      }
    };
    updateLanguage = applyLanguage;
    // Idle confirms visible tiles finished loading, not merely the style JSON.
    renderer.on('style.load', applyLanguage);
    renderer.on('idle', ready);
    renderer.on('error', failed);
    renderer.on('webglcontextlost', failed);
    return () => {
      updateLanguage = () => {};
      renderer.off('style.load', applyLanguage);
      renderer.off('idle', ready);
      renderer.off('error', failed);
      renderer.off('webglcontextlost', failed);
      layer.remove();
    };
  }, report);
  return {
    setLanguage(next: Language) { language = next; updateLanguage(); },
    retry: recovery.retry,
    destroy: recovery.destroy,
  };
}
