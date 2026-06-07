/**
 * VERTEX RD — Geoportal configuration
 * Mapbox token: set MAPBOX_ACCESS_TOKEN in .env → python scripts/generate_local_config.py
 * Cloud: injected via /js/config.runtime.js (FastAPI) or GitHub Actions secret (Pages)
 */
window.VERTEX_CONFIG = {
  apiBase: '',
  mapboxToken: '',
  map: {
    style: 'mapbox://styles/mapbox/standard-satellite',
    center: [-69.93, 18.48],
    zoom: 12,
    defaultBasemap: 'satellite',
  },
  basemaps: [
    {
      id: 'satellite',
      label: 'Satélite',
      icon: '🛰️',
      style: 'mapbox://styles/mapbox/standard-satellite',
      description: 'Imagen satelital',
    },
    {
      id: 'streets',
      label: 'Calles',
      icon: '🗺️',
      style: 'mapbox://styles/mapbox/streets-v12',
      description: 'Mapa callejero (estilo Google Maps)',
    },
    {
      id: 'hybrid',
      label: 'Híbrido',
      icon: '🌍',
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      description: 'Satélite + calles y nombres',
    },
  ],
  tilesets: [
    { sourceId: 'barrios', url: 'mapbox://jfgarci2.5ockhfhc', layer: 'barrios', id: 'barrios-layer', type: 'fill' },
    { sourceId: 'predios', url: 'mapbox://jfgarci2.1lozfrry', layer: 'PREDIOS_RD_V2-9pclyn', id: 'predios-layer', type: 'fill' },
    { sourceId: 'estaciones-metro', url: 'mapbox://jfgarci2.6apbbsy0', layer: 'ESTACIONES_DEL_METRO-4udoox', id: 'estaciones-metro-layer', type: 'circle' },
    { sourceId: 'parques-plazas', url: 'mapbox://jfgarci2.clgaxnds', layer: 'PARQUES_Y_PLAZAS_DN-8276ga', id: 'parques-plazas-layer', type: 'fill' },
    { sourceId: 'areas-protegidas', url: 'mapbox://jfgarci2.4zusxiqg', layer: 'SINAP-ai14fz', id: 'areas-protegidas-layer', type: 'fill' },
    { sourceId: 'rios', url: 'mapbox://jfgarci2.6uurg8h1', layer: 'RIOS-auy4gn', id: 'rios-layer', type: 'fill' },
    { sourceId: 'zonas-amort', url: 'mapbox://jfgarci2.ab8mrg55', layer: 'ZONAS_DE_AMORTIGUAMIENTO-8nxd1m', id: 'zonas-amort-layer', type: 'fill' },
    { sourceId: 'vias', url: 'mapbox://jfgarci2.aeph2ack', layer: 'VIAS_POT-5bdzr8', id: 'vias-layer', type: 'line' },
    { sourceId: 'drenajes', url: 'mapbox://jfgarci2.aod4qwdu', layer: 'DRENAJES-74kc9o', id: 'drenajes-layer', type: 'line' },
    { sourceId: 'troncales', url: 'mapbox://jfgarci2.0rzcdai9', layer: 'troncales', id: 'troncales-layer', type: 'line' }
  ]
};

window.VERTEX_applyRuntime = function () {
  const rt = window.VERTEX_RUNTIME;
  if (!rt) return;
  if (rt.mapboxToken) window.VERTEX_CONFIG.mapboxToken = rt.mapboxToken;
  if (rt.apiBase != null && rt.apiBase !== '') window.VERTEX_CONFIG.apiBase = rt.apiBase;
};

(function loadRuntimeSecrets() {
  function loadScript(src, done) {
    const s = document.createElement('script');
    s.src = src;
    s.onload = function () { window.VERTEX_applyRuntime(); done(); };
    s.onerror = done;
    document.head.appendChild(s);
  }
  loadScript('/js/config.local.js', function () {
    if (window.VERTEX_CONFIG.mapboxToken) return;
    loadScript('/js/config.runtime.js', function () {});
  });
})();
