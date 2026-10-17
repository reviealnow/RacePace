import { maplibreGL } from '@maplibre/maplibre-gl-leaflet';
import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Map as LeafletMap } from 'leaflet';
import type { Language } from './i18n';
import { isNameLabel, nameExpression } from './map-language';

setWorkerUrl(workerUrl);

export function createBasemap(map: LeafletMap, initialLanguage: Language, onError: () => void) {
  let language = initialLanguage;
  const layer = maplibreGL({
    style: 'https://tiles.openfreemap.org/styles/bright',
    attributionControl: { customAttribution: '<a href="https://openfreemap.org/">OpenFreeMap</a> © <a href="https://openmaptiles.org/">OpenMapTiles</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' },
  }).addTo(map);
  const renderer = layer.getMaplibreMap();
  function applyLanguage() {
    for (const item of renderer.getStyle()?.layers ?? []) {
      if (item.type === 'symbol' && isNameLabel(item.layout?.['text-field'])) {
        renderer.setLayoutProperty(item.id, 'text-field', nameExpression(language));
      }
    }
  }
  renderer.on('style.load', applyLanguage);
  renderer.on('error', onError);
  return {
    setLanguage(next: Language) { language = next; applyLanguage(); },
    destroy() {
      renderer.off('style.load', applyLanguage);
      renderer.off('error', onError);
      layer.remove();
    },
  };
}
