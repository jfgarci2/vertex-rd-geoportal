/**
 * VERTEX RD — Núcleo Mapbox GL JS
 * Evolución de html59.html — capas, popups, mediciones y rutas
 */
(function () {
  const cfg = window.VERTEX_CONFIG;

  let map;
  let currentBasemapId = cfg.map.defaultBasemap || 'satellite';
  let savedRouteGeojson = null;
  let savedToolLines = { type: 'FeatureCollection', features: [] };
  let savedToolPois = { type: 'FeatureCollection', features: [] };
  let globalMapEventsBound = false;
  let measureBound = false;
  let selectedPredioCenter = null;
  let selectedPredioGeometry = null;
  let selectedPredioMarker = null;
  let selectedPredioCatastro = null;
  let geocoderMarker = null;
  let activePopup = null;
  let measureActive = false;
  let measureCoords = [];
  const measureData = {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {} }]
  };

  const LAYER_PAINT = {
    'barrios-layer': { 'fill-color': 'rgba(255, 80, 80, 0.15)', 'fill-outline-color': '#ff5050' },
    'predios-layer': {
      'fill-color': 'rgba(120, 100, 180, 0.12)',
      'fill-outline-color': 'rgba(255,255,255,0.06)',
      'fill-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0, 14, 0.35, 17, 0.55],
    },
    'estaciones-metro-layer': { 'circle-radius': 7, 'circle-color': '#FF8800', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' },
    'parques-plazas-layer': { 'fill-color': 'rgba(46, 204, 113, 0.25)', 'fill-outline-color': '#2ecc71' },
    'areas-protegidas-layer': { 'fill-color': 'rgba(0, 128, 128, 0.3)', 'fill-outline-color': '#008080' },
    'rios-layer': { 'fill-color': 'rgba(52, 152, 219, 0.25)', 'fill-outline-color': '#3498db' },
    'zonas-amort-layer': { 'fill-color': 'rgba(255, 153, 0, 0.2)', 'fill-outline-color': '#FF9900' },
    'vias-layer': { 'line-color': '#e056fd', 'line-width': 2 },
    'drenajes-layer': { 'line-color': '#3498db', 'line-width': 2 },
    'troncales-layer': { 'line-color': '#9900cc', 'line-width': 2.5 }
  };

  function initMap() {
    if (!cfg.mapboxToken) {
      console.error(
        'VERTEX RD: Mapbox token missing. Set MAPBOX_ACCESS_TOKEN in .env and run: python scripts/generate_local_config.py'
      );
      return;
    }
    mapboxgl.accessToken = cfg.mapboxToken;
    map = new mapboxgl.Map({
      container: 'map',
      style: cfg.map.style,
      center: cfg.map.center,
      zoom: cfg.map.zoom
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.addControl(new mapboxgl.FullscreenControl(), 'top-right');
    map.addControl(new mapboxgl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true }));

    const geocoder = new MapboxGeocoder({
      accessToken: mapboxgl.accessToken,
      mapboxgl: mapboxgl,
      placeholder: 'Buscar dirección en RD...',
      marker: false
    });
    map.addControl(geocoder, 'top-left');

    geocoder.on('result', (e) => {
      if (geocoderMarker) geocoderMarker.remove();
      geocoderMarker = new mapboxgl.Marker({ color: '#9b59b6' })
        .setLngLat(e.result.geometry.coordinates)
        .addTo(map);
    });

    map.on('load', handleMapStyleReady);
    bindToggles();
    bindTools();
    bindMeasure();
    bindHomeButton();
    bindBasemapSwitcher();
  }

  const LAYER_TOGGLE_MAP = {
    toggleBarrios: 'barrios-layer',
    togglePredios: 'predios-layer',
    toggleEstacionesMetro: 'estaciones-metro-layer',
    toggleParques: 'parques-plazas-layer',
    toggleAreasProtegidas: 'areas-protegidas-layer',
    toggleRios: 'rios-layer',
    toggleZonasAmort: 'zonas-amort-layer',
    toggleVias: 'vias-layer',
    toggleDrenajes: 'drenajes-layer',
    toggleTroncales: 'troncales-layer',
    toggleSubBarrios: 'sub-barrios-layer',
  };

  function handleMapStyleReady() {
    setupVertexLayers();
    bindLayerPopups();
    applyLayerVisibilityFromToggles();
    restoreOverlayState();
  }

  function applyLayerVisibilityFromToggles() {
    Object.entries(LAYER_TOGGLE_MAP).forEach(([toggleId, layerId]) => {
      const el = document.getElementById(toggleId);
      if (el && map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', el.checked ? 'visible' : 'none');
      }
    });
  }

  function bindToggles() {
    if (bindToggles._bound) return;
    bindToggles._bound = true;
    Object.entries(LAYER_TOGGLE_MAP).forEach(([toggleId, layerId]) => {
      const el = document.getElementById(toggleId);
      if (!el) return;
      el.addEventListener('change', () => {
        if (map?.getLayer(layerId)) {
          map.setLayoutProperty(layerId, 'visibility', el.checked ? 'visible' : 'none');
        }
        document.querySelector(`.layer-chip[data-toggle="${toggleId}"]`)
          ?.classList.toggle('on', el.checked);
      });
    });
  }

  function addRouteLayer(routeGeom) {
    if (!routeGeom) return;
    savedRouteGeojson = routeGeom;
    if (map.getLayer('routeLayer')) map.removeLayer('routeLayer');
    if (map.getSource('routeSource')) map.removeSource('routeSource');
    map.addSource('routeSource', { type: 'geojson', data: { type: 'Feature', geometry: routeGeom } });
    map.addLayer({
      id: 'routeLayer', type: 'line', source: 'routeSource',
      paint: { 'line-color': '#ff4d4d', 'line-width': 4, 'line-opacity': 0.88 },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    });
    rebalanceLayerOrder();
  }

  function restoreOverlayState() {
    if (selectedPredioCatastro) ensurePredioHighlightActive();
    if (savedRouteGeojson) addRouteLayer(savedRouteGeojson);
    map.getSource('measureSource')?.setData(measureData);
    map.getSource('toolLinesSource')?.setData(savedToolLines);
    map.getSource('toolPoiSource')?.setData(savedToolPois);
    if (savedToolLines.features?.length || savedRouteGeojson) boostPredioHighlight(true);
    rebalanceLayerOrder();
  }

  function updateBasemapButtons(activeId) {
    document.querySelectorAll('.basemap-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.basemap === activeId);
      btn.classList.remove('loading');
    });
  }

  function switchBasemap(basemapId) {
    const basemap = (cfg.basemaps || []).find((b) => b.id === basemapId);
    if (!basemap || basemapId === currentBasemapId || !map) return;

    document.querySelectorAll('.basemap-btn').forEach((btn) => {
      btn.classList.toggle('loading', btn.dataset.basemap === basemapId);
    });

    const camera = {
      center: map.getCenter(),
      zoom: map.getZoom(),
      bearing: map.getBearing(),
      pitch: map.getPitch(),
    };
    const padding = map.getPadding();

    currentBasemapId = basemapId;
    map.setStyle(basemap.style);
    map.once('style.load', () => {
      map.jumpTo({ ...camera, padding });
      handleMapStyleReady();
      updateBasemapButtons(basemapId);
    });
  }

  function bindBasemapSwitcher() {
    const wrap = document.getElementById('basemap-switch');
    if (!wrap || wrap.dataset.bound) return;
    wrap.dataset.bound = '1';
    wrap.addEventListener('click', (e) => {
      const btn = e.target.closest('.basemap-btn');
      if (!btn?.dataset.basemap) return;
      switchBasemap(btn.dataset.basemap);
    });
    updateBasemapButtons(currentBasemapId);
  }

  function closeActivePopup() {
    if (activePopup) {
      activePopup.remove();
      activePopup = null;
    }
  }

  function popupCard(title, icon, fields) {
    const rows = fields
      .filter(([, v]) => v != null && v !== '')
      .map(([k, v]) => `<div class="vx-row"><span>${k}</span><strong>${v}</strong></div>`)
      .join('');
    return `<div class="vx-popup">
      <div class="vx-popup-head"><span class="vx-popup-icon">${icon}</span><span>${title}</span></div>
      <div class="vx-popup-body">${rows}</div>
    </div>`;
  }

  function predioRef(props) {
    const ref = props.CODIGO ?? props.id ?? props.codigo;
    return ref != null && ref !== '' ? String(ref) : null;
  }

  function showPredioPopup(props, lngLat) {
    const ref = predioRef(props);
    const title = ref ? `Predio Ref. ${ref}` : 'Predio seleccionado';
    const area = props.AREAPREDIO != null && props.AREAPREDIO !== ''
      ? `${Number(props.AREAPREDIO).toLocaleString('es-DO')} m²` : null;
    showPopup(title, '🏠', [
      ['Nº predio', ref || '—'],
      ['Catastro', props.CATASTRO],
      ['Barrio', props.BARRIO_],
      ['Uso', props.USO || props.ACT_USO_CO],
      ['Área', area],
    ], lngLat);
  }

  function showPopup(title, icon, fields, lngLat) {
    closeActivePopup();
    activePopup = new mapboxgl.Popup({
      closeButton: true,
      closeOnClick: true,
      maxWidth: '300px',
      offset: 14,
      className: 'vx-mapbox-popup',
    })
      .setLngLat(lngLat)
      .setHTML(popupCard(title, icon, fields))
      .addTo(map);
    activePopup.on('close', () => { activePopup = null; });
  }

  function setupVertexLayers() {
    cfg.tilesets.forEach((t) => {
      map.addSource(t.sourceId, { type: 'vector', url: t.url });

      const layerDef = {
        id: t.id,
        source: t.sourceId,
        'source-layer': t.layer
      };

      if (t.type === 'fill') {
        layerDef.type = 'fill';
        layerDef.paint = LAYER_PAINT[t.id];
      } else if (t.type === 'circle') {
        layerDef.type = 'circle';
        layerDef.paint = LAYER_PAINT[t.id];
      } else {
        layerDef.type = 'line';
        layerDef.layout = { 'line-join': 'round', 'line-cap': 'round' };
        layerDef.paint = LAYER_PAINT[t.id];
      }

      map.addLayer(layerDef);
    });

    // Resaltado del predio seleccionado (solo el lote activo)
    const predioSourceLayer = cfg.tilesets.find((t) => t.id === 'predios-layer')?.layer;
    map.addLayer({
      id: 'predio-highlight-glow',
      type: 'line',
      source: 'predios',
      'source-layer': predioSourceLayer,
      layout: { visibility: 'none' },
      paint: { 'line-color': '#c9a84c', 'line-width': 9, 'line-opacity': 0.45 },
      filter: ['==', ['get', 'CATASTRO'], ''],
    });
    map.addLayer({
      id: 'predio-highlight-fill',
      type: 'fill',
      source: 'predios',
      'source-layer': predioSourceLayer,
      layout: { visibility: 'none' },
      paint: { 'fill-color': '#e8c96a', 'fill-opacity': 0.72, 'fill-outline-color': '#fff9c4' },
      filter: ['==', ['get', 'CATASTRO'], ''],
    });
    map.addLayer({
      id: 'predio-highlight-line',
      type: 'line',
      source: 'predios',
      'source-layer': predioSourceLayer,
      layout: { visibility: 'none' },
      paint: { 'line-color': '#ffe566', 'line-width': 4, 'line-opacity': 1 },
      filter: ['==', ['get', 'CATASTRO'], ''],
    });

    map.addSource('measureSource', { type: 'geojson', data: measureData });
    map.addLayer({ id: 'measureLine', type: 'line', source: 'measureSource', paint: { 'line-color': '#00BCD4', 'line-width': 3 } });
    map.addLayer({
      id: 'measurePoints', type: 'circle', source: 'measureSource',
      paint: { 'circle-radius': 5, 'circle-color': '#00BCD4', 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' },
      filter: ['==', '$type', 'Point']
    });

    map.addSource('toolLinesSource', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({
      id: 'toolLinesLayer', type: 'line', source: 'toolLinesSource',
      paint: { 'line-color': '#4da3ff', 'line-width': 2.5, 'line-dasharray': [2, 2], 'line-opacity': 0.9 },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    });
    map.addSource('toolPoiSource', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({
      id: 'toolPoiLayer', type: 'circle', source: 'toolPoiSource',
      paint: { 'circle-radius': 7, 'circle-color': '#4da3ff', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' },
    });
    map.addSource('toolPredioBoundarySource', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    map.addLayer({
      id: 'toolPredioBoundaryFill', type: 'fill', source: 'toolPredioBoundarySource',
      paint: { 'fill-color': '#e8c96a', 'fill-opacity': 0.42 },
    });
    map.addLayer({
      id: 'toolPredioBoundaryLine', type: 'line', source: 'toolPredioBoundarySource',
      paint: { 'line-color': '#ffe566', 'line-width': 4.5, 'line-opacity': 1 },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    });

    // Sub-barrios (GeoJSON local — 253 polígonos)
    map.addSource('sub-barrios', { type: 'geojson', data: 'data/sub_barrios.geojson' });
    map.addLayer({
      id: 'sub-barrios-layer',
      type: 'fill',
      source: 'sub-barrios',
      layout: { visibility: 'none' },
      paint: {
        'fill-color': [
          'match', ['get', 'DISTRITO'],
          'DISTRITO NACIONAL', '#4da3ff',
          'SANTO DOMINGO ESTE', '#2ecc71',
          'SANTO DOMINGO OESTE', '#e74c3c',
          'SANTO DOMINGO NORTE', '#9b59b6',
          '#c9a84c'
        ],
        'fill-opacity': 0.35,
        'fill-outline-color': '#ffffff'
      }
    });

    const barrioSourceLayer = cfg.tilesets.find((t) => t.id === 'barrios-layer')?.layer;
    map.addLayer({
      id: 'barrio-highlight-fill',
      type: 'fill',
      source: 'barrios',
      'source-layer': barrioSourceLayer,
      paint: { 'fill-color': '#4da3ff', 'fill-opacity': 0.45, 'fill-outline-color': '#fff' },
      filter: ['==', ['get', 'DESCRIPCIO'], ''],
    });
    map.addLayer({
      id: 'subbarrio-highlight-fill',
      type: 'fill',
      source: 'sub-barrios',
      paint: { 'fill-color': '#2ecc71', 'fill-opacity': 0.5, 'fill-outline-color': '#fff' },
      filter: ['==', ['get', 'DESCRIPCIO'], ''],
    });

    ['predio-highlight-glow', 'predio-highlight-fill', 'predio-highlight-line',
      'barrio-highlight-fill', 'subbarrio-highlight-fill'].forEach((id) => {
      if (map.getLayer(id)) map.moveLayer(id);
    });
  }

  function bindLayerPopups() {
    if (globalMapEventsBound) return;
    globalMapEventsBound = true;

    map.on('click', 'sub-barrios-layer', (e) => {
      if (measureActive) return;
      const p = e.features[0].properties;
      showPopup(p.DESCRIPCIO || 'Sub-barrio', '📍', [
        ['Barrio', p.BARRIO_],
        ['Distrito', p.DISTRITO],
      ], e.lngLat);
    });
    map.on('mouseenter', 'sub-barrios-layer', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'sub-barrios-layer', () => { map.getCanvas().style.cursor = ''; });

    map.on('click', 'barrios-layer', (e) => {
      if (measureActive) return;
      const p = e.features[0].properties;
      showPopup(p.DESCRIPCIO || 'Barrio', '🗺️', [
        ['Área km²', p.AREA_EN_KM],
        ['Densidad', p.DENSIDAD],
        ['Población 2010', p.POB_2010],
      ], e.lngLat);
    });

    map.on('click', 'predios-layer', (e) => {
      if (measureActive) return;
      const feat = e.features[0];
      const p = feat.properties;
      closeActivePopup();
      if (window.VertexFicha) window.VertexFicha.loadFromMapProps(p, feat);
    });

    map.on('click', (e) => {
      if (measureActive || !selectedPredioCatastro) return;
      const hit = map.queryRenderedFeatures(e.point, {
        layers: ['predios-layer', 'predio-highlight-fill', 'predio-highlight-line'],
      });
      if (!hit.length) clearPredioSelection();
    });

    map.on('click', 'estaciones-metro-layer', (e) => {
      if (measureActive) return;
      const p = e.features[0].properties;
      showPopup(p.NOMBRE || 'Estación Metro', '🚇', [['Uso', p.USO]], e.lngLat);
    });

    map.on('click', 'parques-plazas-layer', (e) => {
      if (measureActive) return;
      const p = e.features[0].properties;
      showPopup(p.NOMBRE || 'Parque / Plaza', '🌳', [
        ['Categoría', p.CATEGORIA],
        ['Clasificación', p.CLASIF_POT],
        ['Superficie', p.SUPERCIFIE],
      ], e.lngLat);
    });

    map.on('click', 'areas-protegidas-layer', (e) => {
      if (measureActive) return;
      showPopup(e.features[0].properties.Name || 'Área protegida', '🛡️', [], e.lngLat);
    });

    map.on('click', 'rios-layer', (e) => {
      if (measureActive) return;
      showPopup(e.features[0].properties.Descripcio || 'Río', '💧', [], e.lngLat);
    });

    map.on('click', 'zonas-amort-layer', (e) => {
      if (measureActive) return;
      showPopup(e.features[0].properties.Name || 'Zona amortiguamiento', '⚠️', [], e.lngLat);
    });

    map.on('click', 'vias-layer', (e) => {
      if (measureActive) return;
      const p = e.features[0].properties;
      showPopup(p.DESCRIPCIO || 'Vía', '🛣️', [
        ['Tipo', p.TIPO],
        ['Largo m', p.LARGO],
      ], e.lngLat);
    });

    map.on('click', 'drenajes-layer', (e) => {
      if (measureActive) return;
      showPopup(e.features[0].properties.Descripcio || 'Drenaje', '🌊', [], e.lngLat);
    });

    map.on('click', 'troncales-layer', (e) => {
      if (measureActive) return;
      const p = e.features[0].properties;
      showPopup(p.Descripcio || p.NOMBRE || 'Troncal', '🛤️', [['Tipo', p.TIPO]], e.lngLat);
    });

    const hoverLayers = ['barrios-layer', 'predios-layer', 'parques-plazas-layer', 'vias-layer', 'sub-barrios-layer'];
    hoverLayers.forEach((layer) => {
      map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
    });
  }

  const POI_QUERIES = [
    { key: 'parque', label: 'Parque más cercano', layerId: 'parques-plazas-layer', tileset: 'jfgarci2.clgaxnds', color: '#2ecc71' },
    { key: 'metro', label: 'Metro más cercano', layerId: 'estaciones-metro-layer', tileset: 'jfgarci2.6apbbsy0', color: '#ff8800' },
    { key: 'drenaje', label: 'Drenaje más cercano', layerId: 'drenajes-layer', tileset: 'jfgarci2.aod4qwdu', color: '#3498db' },
    { key: 'rio', label: 'Río más cercano', layerId: 'rios-layer', tileset: 'jfgarci2.6uurg8h1', color: '#5dade2' },
  ];

  const TOOL_FIT_PADDING = { top: 80, bottom: 100, left: 220, right: 160 };

  function getPredioFitGeometries() {
    if (selectedPredioGeometry) return [selectedPredioGeometry];
    if (selectedPredioCenter) return [selectedPredioCenter];
    return [];
  }

  function drawPredioBoundaryOverlay() {
    const geom = selectedPredioGeometry
      || (selectedPredioCenter ? selectedPredioCenter : null);
    if (!geom || !map.getSource('toolPredioBoundarySource')) return;
    map.getSource('toolPredioBoundarySource').setData({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: geom, properties: { catastro: selectedPredioCatastro } }],
    });
  }

  function clearPredioBoundaryOverlay() {
    map.getSource('toolPredioBoundarySource')?.setData({ type: 'FeatureCollection', features: [] });
  }

  function rebalanceLayerOrder() {
    if (!map) return;
    [
      'routeLayer', 'toolLinesLayer', 'toolPoiLayer',
      'predio-highlight-glow', 'predio-highlight-fill', 'predio-highlight-line',
      'toolPredioBoundaryFill', 'toolPredioBoundaryLine',
    ].forEach((id) => {
      if (map.getLayer(id)) map.moveLayer(id);
    });
  }

  function boostPredioHighlight(active) {
    if (!map) return;
    if (map.getLayer('predio-highlight-line')) {
      map.setPaintProperty('predio-highlight-line', 'line-width', active ? 5 : 4);
    }
    if (map.getLayer('predio-highlight-glow')) {
      map.setPaintProperty('predio-highlight-glow', 'line-width', active ? 11 : 9);
      map.setPaintProperty('predio-highlight-glow', 'line-opacity', active ? 0.65 : 0.45);
    }
    if (map.getLayer('predio-highlight-fill')) {
      map.setPaintProperty('predio-highlight-fill', 'fill-opacity', active ? 0.82 : 0.72);
    }
    if (map.getLayer('toolPredioBoundaryLine')) {
      map.setPaintProperty('toolPredioBoundaryLine', 'line-width', active ? 5.5 : 4.5);
    }
  }

  function ensurePredioHighlightActive() {
    if (!selectedPredioCatastro) return;
    enablePredioSelection();
    setPredioHighlightFilter(selectedPredioCatastro);
    drawPredioBoundaryOverlay();
    rebalanceLayerOrder();
  }

  function featureLabel(props = {}) {
    return props.NOMBRE || props.Name || props.DESCRIPCIO || props.Descripcio
      || props.descripcio || props.nombre || props.Nombre || 'Sin nombre';
  }

  function featureAnchor(feature, fromCoords) {
    const gj = { type: 'Feature', geometry: feature.geometry, properties: feature.properties || {} };
    const from = turf.point(fromCoords);
    if (gj.geometry.type === 'Point') return gj.geometry;
    if (gj.geometry.type === 'LineString' || gj.geometry.type === 'MultiLineString') {
      try { return turf.nearestPointOnLine(gj, from).geometry; } catch { /* */ }
    }
    try { return turf.nearestPoint(from, gj).geometry; } catch { /* */ }
    return turf.center(gj).geometry;
  }

  function dedupeFeatures(features) {
    const seen = new Set();
    return (features || []).filter((f) => {
      if (!f?.geometry) return false;
      const key = f.id != null ? String(f.id) : JSON.stringify(f.geometry.coordinates?.slice?.(0, 2) ?? f.geometry.coordinates);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function queryLayerFeatures(layerId) {
    const t = cfg.tilesets.find((x) => x.id === layerId);
    if (!t || !map.getSource(t.sourceId)) return [];
    try {
      return dedupeFeatures(map.querySourceFeatures(t.sourceId, { sourceLayer: t.layer }));
    } catch {
      return [];
    }
  }

  function nearestFromFeatures(features, originCoords) {
    if (!features.length) return null;
    const from = turf.point(originCoords);
    let best = null;
    features.forEach((feat) => {
      const anchor = featureAnchor(feat, originCoords);
      const dist = turf.distance(from, anchor, { units: 'kilometers' });
      if (!best || dist < best.distance) {
        best = {
          distance: dist,
          name: featureLabel(feat.properties),
          geometry: anchor,
          feature: feat,
        };
      }
    });
    return best;
  }

  async function nearestViaTilequery(tilesetId, originCoords, radiusM = 25000) {
    const [lng, lat] = originCoords;
    const url = `https://api.mapbox.com/v4/${tilesetId}/tilequery/${lng},${lat}.json`
      + `?radius=${radiusM}&limit=1&dedupe&access_token=${mapboxgl.accessToken}`;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      const feat = data.features?.[0];
      if (!feat) return null;
      const distM = feat.properties?.tilequery?.distance ?? 0;
      return {
        distance: distM / 1000,
        name: featureLabel(feat.properties),
        geometry: featureAnchor(feat, originCoords),
        feature: feat,
      };
    } catch {
      return null;
    }
  }

  async function findNearestPoi(query, originCoords) {
    let hit = nearestFromFeatures(queryLayerFeatures(query.layerId), originCoords);
    if (!hit) hit = await nearestViaTilequery(query.tileset, originCoords);
    return hit;
  }

  function clearRouteLayer() {
    savedRouteGeojson = null;
    if (map.getLayer('routeLayer')) map.removeLayer('routeLayer');
    if (map.getSource('routeSource')) map.removeSource('routeSource');
  }

  function clearToolOverlays() {
    clearRouteLayer();
    savedToolLines = { type: 'FeatureCollection', features: [] };
    savedToolPois = { type: 'FeatureCollection', features: [] };
    map.getSource('toolLinesSource')?.setData(savedToolLines);
    map.getSource('toolPoiSource')?.setData(savedToolPois);
    boostPredioHighlight(false);
  }

  function drawToolLines(originCoords, targets) {
    const lines = targets.filter(Boolean).map((t) => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [originCoords, t.geometry.coordinates] },
      properties: { label: t.name, color: t.color },
    }));
    savedToolLines = { type: 'FeatureCollection', features: lines };
    map.getSource('toolLinesSource')?.setData(savedToolLines);
    const pois = targets.filter(Boolean).map((t) => ({
      type: 'Feature',
      geometry: t.geometry,
      properties: { name: t.name, color: t.color },
    }));
    savedToolPois = { type: 'FeatureCollection', features: pois };
    map.getSource('toolPoiSource')?.setData(savedToolPois);
  }

  function fitMapToGeometries(geometries, maxZoom = 16) {
    const feats = geometries.filter(Boolean).map((g) => ({ type: 'Feature', geometry: g, properties: {} }));
    if (!feats.length) return;
    const bbox = turf.bbox({ type: 'FeatureCollection', features: feats });
    if (!bbox || bbox.some((v) => !Number.isFinite(v))) return;
    map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], {
      padding: TOOL_FIT_PADDING,
      duration: 1400,
      maxZoom,
      essential: true,
    });
  }

  function setToolButtonLoading(id, loading) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.classList.toggle('tool-loading', loading);
    btn.disabled = loading;
  }

  function bindTools() {
    document.getElementById('calcDistanceBtn')?.addEventListener('click', async () => {
      if (!selectedPredioCenter) { alert('Haz clic en un predio primero.'); return; }
      const origin = selectedPredioCenter.coordinates;
      setToolButtonLoading('calcDistanceBtn', true);
      clearToolOverlays();
      try {
        const results = await Promise.all(
          POI_QUERIES.map(async (q) => {
            const hit = await findNearestPoi(q, origin);
            return hit ? { ...hit, label: q.label, color: q.color } : null;
          })
        );
        const hits = results.filter(Boolean);
        if (!hits.length) {
          alert('No se encontraron parques, metro ni hidrografía cercanos.');
          return;
        }
        drawToolLines(origin, hits);
        const fields = hits.map((h) => [h.label, `${h.name} — ${h.distance.toFixed(2)} km`]);
        const geoms = [...getPredioFitGeometries(), ...hits.map((h) => h.geometry)];
        fitMapToGeometries(geoms, 16);
        ensurePredioHighlightActive();
        boostPredioHighlight(true);
        showPopup('Distancias desde predio', '📏', fields, origin);
      } catch (err) {
        console.error(err);
        alert('Error al calcular distancias.');
      } finally {
        setToolButtonLoading('calcDistanceBtn', false);
      }
    });

    document.getElementById('calcRouteBtn')?.addEventListener('click', async () => {
      if (!selectedPredioCenter) { alert('Haz clic en un predio primero.'); return; }
      const origin = selectedPredioCenter.coordinates;
      setToolButtonLoading('calcRouteBtn', true);
      clearToolOverlays();
      try {
        const [np, nm] = await Promise.all([
          findNearestPoi(POI_QUERIES[0], origin),
          findNearestPoi(POI_QUERIES[1], origin),
        ]);
        if (!np && !nm) {
          alert('No se encontró parque ni estación de metro cercanos.');
          return;
        }
        const target = (np && (!nm || np.distance < nm.distance)) ? np : nm;
        const from = origin;
        const to = target.geometry.coordinates;
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${from[0]},${from[1]};${to[0]},${to[1]}`
          + `?geometries=geojson&overview=full&access_token=${mapboxgl.accessToken}`;
        const res = await fetch(url);
        const data = await res.json();
        if (!data.routes?.length) {
          alert(data.message || 'Sin ruta disponible para este destino.');
          return;
        }
        const routeGeom = data.routes[0].geometry;
        map.addSource('routeSource', { type: 'geojson', data: { type: 'Feature', geometry: routeGeom } });
        map.addLayer({
          id: 'routeLayer', type: 'line', source: 'routeSource',
          paint: { 'line-color': '#ff4d4d', 'line-width': 4, 'line-opacity': 0.88 },
          layout: { 'line-cap': 'round', 'line-join': 'round' },
        });
        map.getSource('toolPoiSource')?.setData({
          type: 'FeatureCollection',
          features: [{ type: 'Feature', geometry: target.geometry, properties: { name: target.name } }],
        });
        ensurePredioHighlightActive();
        rebalanceLayerOrder();
        boostPredioHighlight(true);
        fitMapToGeometries([...getPredioFitGeometries(), routeGeom, target.geometry], 15);
        map.once('moveend', () => {
          ensurePredioHighlightActive();
          rebalanceLayerOrder();
        });
        showPopup('Ruta calculada', '🚗', [
          ['Destino', target.name],
          ['Distancia', `${(data.routes[0].distance / 1000).toFixed(2)} km`],
          ['Tiempo', `~${Math.round(data.routes[0].duration / 60)} min`],
        ], to);
      } catch (err) {
        console.error(err);
        alert('Error al calcular la ruta.');
      } finally {
        setToolButtonLoading('calcRouteBtn', false);
      }
    });
  }

  function bindMeasure() {
    document.getElementById('measureBtn')?.addEventListener('click', () => {
      measureActive = !measureActive;
      const btn = document.getElementById('measureBtn');
      const label = btn?.querySelector('.ta-body strong');
      const hint = btn?.querySelector('.ta-body small');
      btn?.classList.toggle('tool-active', measureActive);
      if (label) label.textContent = measureActive ? 'Salir' : 'Medir';
      if (hint) hint.textContent = measureActive ? 'Clic en el mapa' : 'Distancia en el mapa';
      if (!measureActive) {
        measureCoords = [];
        measureData.features = [{ type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {} }];
        map.getSource('measureSource')?.setData(measureData);
        closeActivePopup();
      } else {
        clearToolOverlays();
      }
    });

    map.on('click', (e) => {
      if (!measureActive) return;
      e.preventDefault?.();
      const lngLat = [e.lngLat.lng, e.lngLat.lat];
      measureCoords.push(lngLat);
      measureData.features[0].geometry.coordinates = measureCoords;
      if (measureCoords.length === 1) {
        measureData.features = [
          measureData.features[0],
          { type: 'Feature', geometry: { type: 'Point', coordinates: lngLat }, properties: {} },
        ];
      } else {
        measureData.features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: lngLat }, properties: {} });
      }
      const total = turf.length(measureData.features[0], { units: 'kilometers' });
      map.getSource('measureSource')?.setData(measureData);
      showPopup('Medición', '📐', [['Distancia total', `${(total * 1000).toFixed(2)} m`]], lngLat);
      if (measureCoords.length >= 2) {
        fitMapToGeometries([measureData.features[0].geometry], 17);
      }
    });
  }

  const predioFilter = (catastro) => ['any',
    ['==', ['get', 'CATASTRO'], catastro],
    ['==', ['get', 'catastro'], catastro],
    ['==', ['to-string', ['get', 'CODIGO']], catastro],
    ['==', ['to-string', ['get', 'id']], catastro]
  ];

  const PREDIO_FIT_PADDING = { top: 90, bottom: 95, left: 240, right: 155 };

  function predioSourceLayer() {
    return cfg.tilesets.find((t) => t.id === 'predios-layer')?.layer;
  }

  function findPredioFeature(catastro, hintFeature) {
    if (hintFeature?.geometry) {
      return { type: 'Feature', geometry: hintFeature.geometry, properties: hintFeature.properties || {} };
    }
    const sourceLayer = predioSourceLayer();
    if (!sourceLayer) return null;
    const feats = map.querySourceFeatures('predios', { sourceLayer, filter: predioFilter(catastro) });
    return feats[0] ? { type: 'Feature', geometry: feats[0].geometry, properties: feats[0].properties } : null;
  }

  function enablePredioSelection() {
    const cb = document.getElementById('togglePredios');
    if (cb && !cb.checked) {
      cb.checked = true;
      const chip = document.querySelector('.layer-chip[data-toggle="togglePredios"]');
      if (chip) chip.classList.add('on');
      cb.dispatchEvent(new Event('change'));
    }
    ['predio-highlight-glow', 'predio-highlight-fill', 'predio-highlight-line'].forEach((id) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible');
    });
    if (map.getLayer('predios-layer')) {
      map.setPaintProperty('predios-layer', 'fill-opacity', 0.08);
      map.setPaintProperty('predios-layer', 'fill-outline-color', 'rgba(255,255,255,0.04)');
    }
    document.getElementById('map-clear-predio-btn')?.classList.remove('hidden');
  }

  function setPredioHighlightFilter(catastro) {
    const f = predioFilter(catastro);
    ['predio-highlight-glow', 'predio-highlight-fill', 'predio-highlight-line'].forEach((id) => {
      if (map.getLayer(id)) map.setFilter(id, f);
    });
  }

  function fitToPredioFeature(feature, lng, lat) {
    if (selectedPredioMarker) {
      selectedPredioMarker.remove();
      selectedPredioMarker = null;
    }

    if (feature?.geometry) {
      const gj = { type: 'Feature', geometry: feature.geometry, properties: feature.properties || {} };
      const bbox = turf.bbox(gj);
      const hasArea = (bbox[2] - bbox[0]) > 0.000008 && (bbox[3] - bbox[1]) > 0.000008;
      if (hasArea) {
        map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], {
          padding: PREDIO_FIT_PADDING,
          pitch: 50,
          bearing: -14,
          duration: 2200,
          maxZoom: 19,
          essential: true,
        });
        selectedPredioCenter = turf.center(gj).geometry;
        selectedPredioGeometry = feature.geometry;
        drawPredioBoundaryOverlay();
        rebalanceLayerOrder();
        return true;
      }
    }

    if (lng != null && lat != null) {
      map.flyTo({
        center: [lng, lat], zoom: 18.5, pitch: 50, bearing: -14,
        essential: true, duration: 2200,
      });
      selectedPredioCenter = { type: 'Point', coordinates: [lng, lat] };
      selectedPredioGeometry = null;
      clearPredioBoundaryOverlay();
      const el = document.createElement('div');
      el.className = 'predio-pulse-marker';
      selectedPredioMarker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([lng, lat]).addTo(map);
      return true;
    }
    return false;
  }

  function highlightPredio(catastro, lng, lat, mapFeature) {
    if (!map || !catastro) return;

    selectedPredioCatastro = catastro;
    document.querySelector('[data-view="presentacion"]')?.click();
    setTimeout(() => map.resize(), 150);

    enablePredioSelection();
    setPredioHighlightFilter(catastro);

    const tryFit = (hint) => {
      const feat = findPredioFeature(catastro, hint);
      if (fitToPredioFeature(feat, lng, lat)) return true;
      return false;
    };

    if (tryFit(mapFeature)) return;

    if (lng != null && lat != null) {
      map.flyTo({ center: [lng, lat], zoom: 16, pitch: 45, duration: 900, essential: true });
      map.once('moveend', () => tryFit(null));
      return;
    }

    map.flyTo({ center: cfg.map.center, zoom: 14, duration: 800 });
    map.once('moveend', () => tryFit(null));
  }

  function clearPredioHighlight() {
    if (!map) return;
    const empty = ['==', ['get', 'CATASTRO'], ''];
    ['predio-highlight-glow', 'predio-highlight-fill', 'predio-highlight-line'].forEach((id) => {
      if (map.getLayer(id)) {
        map.setFilter(id, empty);
        map.setLayoutProperty(id, 'visibility', 'none');
      }
    });
    if (map.getLayer('predios-layer')) {
      const p = LAYER_PAINT['predios-layer'];
      map.setPaintProperty('predios-layer', 'fill-color', p['fill-color']);
      map.setPaintProperty('predios-layer', 'fill-outline-color', p['fill-outline-color']);
      map.setPaintProperty('predios-layer', 'fill-opacity', p['fill-opacity']);
    }
    if (selectedPredioMarker) { selectedPredioMarker.remove(); selectedPredioMarker = null; }
    selectedPredioCatastro = null;
    selectedPredioGeometry = null;
    clearPredioBoundaryOverlay();
    boostPredioHighlight(false);
    document.getElementById('map-clear-predio-btn')?.classList.add('hidden');
  }

  function setDrawerPadding(open) {
    const view = document.getElementById('view-presentacion');
    view?.classList.toggle('drawer-open', Boolean(open));
    if (!map) return;
    const bottom = open ? 78 : 36;
    map.setPadding({
      top: 52,
      bottom,
      left: 220,
      right: 148,
    });
  }

  function clearPredioSelection() {
    closeActivePopup();
    clearPredioHighlight();
    clearToolOverlays();
    document.getElementById('map-ficha-drawer')?.classList.add('hidden');
    setDrawerPadding(false);
  }

  function flyTo(lng, lat, zoom = 18) {
    if (!map || lng == null || lat == null) return;
    document.querySelector('[data-view="presentacion"]')?.click();
    map.flyTo({ center: [lng, lat], zoom, pitch: 40, essential: true, duration: 2000 });
    if (selectedPredioMarker) selectedPredioMarker.remove();
    const el = document.createElement('div');
    el.className = 'predio-pulse-marker';
    selectedPredioMarker = new mapboxgl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
  }

  function flyToTerritory(bounds, meta = {}) {
    if (!map || !bounds) return;
    document.querySelector('[data-view="presentacion"]')?.click();
    setTimeout(() => map.resize(), 120);

    const { min_lng, min_lat, max_lng, max_lat } = bounds;
    map.fitBounds(
      [[min_lng, min_lat], [max_lng, max_lat]],
      { padding: { top: 80, bottom: 140, left: 280, right: 200 }, duration: 2000, maxZoom: 16 }
    );

    clearTerritoryHighlight();
    const { level, barrio, subBarrio, label } = meta;
    if (level === 'subbarrio' && label) {
      const cb = document.getElementById('toggleSubBarrios');
      if (cb && !cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change')); }
      if (map.getLayer('subbarrio-highlight-fill')) {
        map.setFilter('subbarrio-highlight-fill', ['==', ['get', 'DESCRIPCIO'], label]);
      }
    } else if (barrio || label) {
      const name = label || barrio;
      const cb = document.getElementById('toggleBarrios');
      if (cb && !cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change')); }
      if (map.getLayer('barrio-highlight-fill')) {
        map.setFilter('barrio-highlight-fill', ['==', ['get', 'DESCRIPCIO'], name]);
      }
    }
  }

  function clearTerritoryHighlight() {
    if (!map) return;
    if (map.getLayer('barrio-highlight-fill')) {
      map.setFilter('barrio-highlight-fill', ['==', ['get', 'DESCRIPCIO'], '']);
    }
    if (map.getLayer('subbarrio-highlight-fill')) {
      map.setFilter('subbarrio-highlight-fill', ['==', ['get', 'DESCRIPCIO'], '']);
    }
  }

  function recenterMap() {
    if (!map) return;
    clearPredioSelection();
    clearTerritoryHighlight();
    document.getElementById('map-predios-panel')?.classList.add('hidden');
    const sug = document.getElementById('search-suggestions');
    if (sug) sug.style.display = 'none';
    window.VertexExplorer?.clearTerritory?.();
    map.flyTo({
      center: cfg.map.center,
      zoom: cfg.map.zoom,
      pitch: 0,
      bearing: 0,
      duration: 2200,
      essential: true,
    });
  }

  function bindHomeButton() {
    document.getElementById('map-home-btn')?.addEventListener('click', recenterMap);
    document.getElementById('map-clear-predio-btn')?.addEventListener('click', clearPredioSelection);
  }

  window.VertexMap = {
    init: initMap, getMap: () => map, flyTo, highlightPredio, clearPredioHighlight,
    clearPredioSelection, flyToTerritory, clearTerritoryHighlight, recenterMap, closeActivePopup,
    showPredioPopup, setDrawerPadding,
  };
})();
