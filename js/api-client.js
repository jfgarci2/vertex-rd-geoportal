/**
 * VERTEX RD — Cliente API (PostGIS / SQLite fallback)
 */
(function () {
  const API_BASE = window.VERTEX_CONFIG?.apiBase ?? '';

  async function fetchJSON(path) {
    const url = API_BASE ? `${API_BASE}${path}` : path;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API ${res.status}`);
    return res.json();
  }

  async function health() {
    try {
      return await fetchJSON('/api/health');
    } catch {
      return { status: 'offline', backend: 'none' };
    }
  }

  async function searchPredios(q, limit = 15) {
    return fetchJSON(`/api/predios/search?q=${encodeURIComponent(q)}&limit=${limit}`);
  }

  async function browsePredios({ barrio, sub_barrio, uso, q, limit = 30 } = {}) {
    const p = new URLSearchParams();
    if (barrio) p.set('barrio', barrio);
    if (sub_barrio) p.set('sub_barrio', sub_barrio);
    if (uso) p.set('uso', uso);
    if (q) p.set('q', q);
    p.set('limit', String(limit));
    return fetchJSON(`/api/predios/browse?${p}`);
  }

  async function getTerritoryStats(barrio, sub_barrio) {
    const p = new URLSearchParams();
    if (barrio) p.set('barrio', barrio);
    if (sub_barrio) p.set('sub_barrio', sub_barrio);
    return fetchJSON(`/api/territorios/stats?${p}`);
  }

  async function listBarrios() {
    return fetchJSON('/api/territorios/barrios');
  }

  async function listSubBarrios(barrio) {
    const q = barrio ? `?barrio=${encodeURIComponent(barrio)}` : '';
    return fetchJSON(`/api/territorios/sub-barrios${q}`);
  }

  async function getTerritoryBounds(barrio, sub_barrio) {
    const p = new URLSearchParams();
    if (barrio) p.set('barrio', barrio);
    if (sub_barrio) p.set('sub_barrio', sub_barrio);
    return fetchJSON(`/api/territorios/bounds?${p}`);
  }

  async function getPredio(catastro) {
    return fetchJSON(`/api/predios/${encodeURIComponent(catastro)}`);
  }

  async function getKpis() {
    return fetchJSON('/api/kpis');
  }

  function barrioQuery(barrio) {
    return barrio ? `?barrio=${encodeURIComponent(barrio)}` : '';
  }

  async function getAnalyticsEstrato(barrio) {
    return fetchJSON(`/api/analytics/estrato${barrioQuery(barrio)}`);
  }

  async function getAnalyticsUso(barrio) {
    return fetchJSON(`/api/analytics/uso${barrioQuery(barrio)}`);
  }

  async function getAnalyticsEquipamiento(barrio) {
    return fetchJSON(`/api/analytics/equipamiento${barrioQuery(barrio)}`);
  }

  async function getAnalyticsCaracteristica(barrio) {
    return fetchJSON(`/api/analytics/caracteristica${barrioQuery(barrio)}`);
  }

  async function getAnalyticsDashboard(barrio) {
    return fetchJSON(`/api/analytics/dashboard${barrioQuery(barrio)}`);
  }

  async function getAnalyticsVias(barrio) {
    return fetchJSON(`/api/analytics/vias${barrioQuery(barrio)}`);
  }

  async function getAnalyticsEspacios(barrio) {
    return fetchJSON(`/api/analytics/espacios${barrioQuery(barrio)}`);
  }

  window.VertexAPI = {
    API_BASE, health, searchPredios, browsePredios, getPredio, getKpis,
    listBarrios, listSubBarrios, getTerritoryBounds, getTerritoryStats,
    getAnalyticsEstrato, getAnalyticsUso, getAnalyticsEquipamiento,
    getAnalyticsCaracteristica, getAnalyticsDashboard, getAnalyticsVias,
    getAnalyticsEspacios,
  };
})();
