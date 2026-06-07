/**
 * VERTEX RD — Dashboard analítico (Power BI → Web)
 */
(function () {
  let analytics = {};
  const charts = {};
  let statsBarrio = '';
  let viasBarrio = '';
  let espaciosBarrio = '';
  let apiOnline = false;
  let viasBarrioList = [];
  let espaciosBarrioList = [];

  async function loadAnalytics() {
    analytics = await fetch('data/analytics.json').then((r) => r.json());

    try {
      const h = await window.VertexAPI.health();
      apiOnline = h?.status === 'ok';
      if (apiOnline) {
        try {
          const [kpis, estrato, uso, equip, car] = await Promise.all([
            window.VertexAPI.getKpis(),
            window.VertexAPI.getAnalyticsEstrato(),
            window.VertexAPI.getAnalyticsUso(),
            window.VertexAPI.getAnalyticsEquipamiento(),
            window.VertexAPI.getAnalyticsCaracteristica(),
          ]);
          analytics.kpis = { ...analytics.kpis, ...kpis };
          if (estrato?.length) analytics.estrato = estrato;
          if (uso?.length) analytics.uso = uso;
          if (equip?.length) analytics.equipamiento = equip;
          if (car?.length) analytics.caracteristica = car;
        } catch (e) {
          console.warn('Carga parcial API analytics', e);
        }
      }
    } catch { /* fallback local JSON */ }

    renderKPIs();
    await loadGlobalStatsDashboard();
    renderAllCharts();
    await loadViasData();
    await loadEspaciosData();
    renderBarriosRanking();
    await populateFilters();
    bindStatsFilter();
    bindViasFilter();
    bindEspaciosFilter();
  }

  function tableBar(rank, cells, pct) {
    const bar = pct != null
      ? `<td class="tbl-bar"><div class="tbl-bar-track"><div class="tbl-bar-fill" style="width:${pct}%"></div></div></td>`
      : '<td></td>';
    return `<tr><td class="tbl-rank">${rank}</td>${cells}${bar}</tr>`;
  }

  function renderBarriosRanking() {
    const tbody = document.getElementById('barrios-ranking-body');
    if (!tbody || !analytics.barrios_ranking) return;
    const rows = analytics.barrios_ranking;
    const max = Math.max(...rows.map((r) => Number(r.predios) || 0), 1);
    tbody.innerHTML = rows.map((r, i) => {
      const n = Number(r.predios) || 0;
      const pct = Math.round((n / max) * 100);
      return tableBar(
        i + 1,
        `<td class="tbl-name">${r.BARRIO_ || r.barrio || ''}</td><td class="tbl-num">${n.toLocaleString('es-DO')}</td>`,
        pct
      );
    }).join('');
  }

  function fmt(n) {
    return Number(n).toLocaleString('es-DO');
  }

  let globalKpis = {};

  function renderKPIs() {
    const k = analytics.kpis;
    globalKpis = { ...k };
    restoreGlobalMapKPIs();
    const map = {
      'kpi-vias': k.vias,
      'vias-total': k.vias,
      'vias-km': k.longitud_vias_km,
      'sb-predios': k.predios,
    };
    Object.entries(map).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = fmt(val);
    });
  }

  function restoreGlobalMapKPIs() {
    const k = globalKpis;
    if (!k.predios) return;
    document.getElementById('map-kpi-panel')?.classList.remove('territory-active');
    document.getElementById('map-kpi-context')?.classList.add('hidden');
    document.getElementById('header-kpi-label').textContent = 'Predios DN';
    const map = {
      'kpi-predios': k.predios,
      'kpi-barrios': k.barrios,
      'kpi-manzanas': k.manzanas,
      'kpi-subbarrios': k.sub_barrios,
      'kpi-espacios': k.espacios_abiertos,
      'kpi-zonas-inf': k.zonas_informales,
      'kpi-residencial': '—',
      'kpi-comercial': '—',
      'header-predios': k.predios,
      'sidebar-predios': k.predios,
    };
    Object.entries(map).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = typeof val === 'number' ? fmt(val) : val;
    });
  }

  function destroyChart(id) {
    if (charts[id]) { charts[id].destroy(); delete charts[id]; }
  }

  function makeChart(canvasId, type, labels, data, colors) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    charts[canvasId] = new Chart(ctx, {
      type,
      data: {
        labels,
        datasets: [{
          label: 'Cantidad',
          data,
          backgroundColor: colors,
          borderColor: colors.map((c) => c),
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { labels: { color: '#f0f0f0', font: { size: 11 } } }
        },
        scales: type === 'bar' ? {
          x: { ticks: { color: '#9aa0b4', maxRotation: 45, minRotation: 0 }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { ticks: { color: '#9aa0b4' }, grid: { color: 'rgba(255,255,255,0.05)' } }
        } : {}
      }
    });
  }

  const COLORS = ['#c9a84c', '#4da3ff', '#2ecc71', '#e74c3c', '#9b59b6', '#1abc9c', '#f39c12', '#e67e22'];

  function renderChartsFromData(data) {
    const estrato = data.estrato || [];
    makeChart('chart-estrato', 'doughnut',
      estrato.map((x) => 'Estrato ' + x.estrato),
      estrato.map((x) => x.cantidad),
      COLORS
    );

    const uso = data.uso || [];
    makeChart('chart-uso', 'bar',
      uso.map((x) => x.uso || 'Sin definir'),
      uso.map((x) => x.cantidad),
      COLORS
    );

    const car = data.caracteristica || [];
    if (car.length) {
      makeChart('chart-caracteristica', 'bar',
        car.map((x) => x.caracteristica),
        car.map((x) => x.cantidad),
        ['#4da3ff', '#c9a84c', '#2ecc71']
      );
    } else {
      destroyChart('chart-caracteristica');
    }

    const equip = data.equipamiento || [];
    makeChart('chart-equipamiento', 'bar',
      equip.map((x) => x.equipamiento),
      equip.map((x) => x.cantidad),
      COLORS
    );
  }

  function renderAllCharts() {
    renderChartsFromData(analytics);
  }

  function matchBarrioRow(list, barrio) {
    if (!barrio || !list?.length) return null;
    const key = barrio.trim().toUpperCase();
    let m = list.find((r) => (r.barrio || '').trim().toUpperCase() === key);
    if (m) return m;
    return list.find((r) => {
      const n = (r.barrio || '').trim().toUpperCase();
      return n.includes(key) || key.includes(n);
    }) || null;
  }

  function renderEspaciosCharts(data) {
    const parques = data.parques_categoria || [];
    if (parques.length) {
      makeChart('chart-parques', 'doughnut',
        parques.map((x) => x.categoria),
        parques.map((x) => x.cantidad),
        COLORS
      );
    } else {
      destroyChart('chart-parques');
    }

    const esp = data.espacios_clasificacion || [];
    if (esp.length) {
      makeChart('chart-espacios', 'bar',
        esp.map((x) => x.clasificacion),
        esp.map((x) => x.cantidad),
        COLORS
      );
    } else {
      destroyChart('chart-espacios');
    }
  }

  function renderStatsDashboard(data) {
    const k = data.kpis || {};
    const zone = Boolean(data.barrio || statsBarrio);
    const label = data.label || (zone ? statsBarrio : 'Distrito Nacional');

    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val == null ? '—' : fmt(val);
    };

    set('stats-kpi-predios', k.predios);
    set('stats-kpi-manzanas', k.manzanas);
    set('stats-kpi-barrios', k.barrios);
    set('stats-kpi-subbarrios', k.sub_barrios);

    const lblBarrios = document.getElementById('stats-lbl-barrios');
    if (lblBarrios) lblBarrios.textContent = zone ? 'Barrio' : 'Barrios';

    const subWrap = document.getElementById('stats-kpi-subbarrios-wrap');
    if (subWrap) subWrap.classList.toggle('hidden', !zone);

    const badge = document.getElementById('stats-filter-badge');
    if (badge) {
      badge.classList.toggle('hidden', !zone);
      badge.textContent = zone ? `📍 ${label}` : '';
    }

    const suffix = zone ? ` — ${label}` : ' — DN completo';
    const predTotal = k.predios ? ` (${fmt(k.predios)})` : '';
    const titleMap = {
      'chart-title-estrato': `Predios por Estrato${predTotal}`,
      'chart-title-uso': `Predios por Uso${suffix}`,
      'chart-title-caracteristica': `Densidad de actividad${suffix}`,
      'chart-title-equipamiento': `Predios por Equipamiento${suffix}`,
    };
    Object.entries(titleMap).forEach(([id, text]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    });
  }

  function setStatsLoading(loading) {
    document.getElementById('view-estadisticas')?.classList.toggle('stats-loading', loading);
    const sel = document.getElementById('stats-filter-barrio');
    if (sel) sel.disabled = loading;
  }

  function showStatsError(msg) {
    const badge = document.getElementById('stats-filter-badge');
    if (!badge) return;
    badge.classList.remove('hidden');
    badge.textContent = msg;
    badge.classList.add('stats-error');
  }

  function clearStatsError() {
    document.getElementById('stats-filter-badge')?.classList.remove('stats-error');
  }

  async function fetchBarrioDashboard(barrio) {
    const [stats, estrato, uso, equipamiento, caracteristica] = await Promise.all([
      window.VertexAPI.getTerritoryStats(barrio),
      window.VertexAPI.getAnalyticsEstrato(barrio),
      window.VertexAPI.getAnalyticsUso(barrio),
      window.VertexAPI.getAnalyticsEquipamiento(barrio),
      window.VertexAPI.getAnalyticsCaracteristica(barrio),
    ]);
    return {
      barrio,
      label: stats.label || barrio,
      kpis: {
        predios: stats.predios,
        barrios: 1,
        manzanas: stats.manzanas ?? stats.predios,
        sub_barrios: stats.sub_barrios,
      },
      estrato: estrato || [],
      uso: uso || [],
      equipamiento: equipamiento || [],
      caracteristica: caracteristica || [],
    };
  }

  async function loadGlobalStatsDashboard() {
    if (apiOnline) {
      try {
        const dash = await window.VertexAPI.getAnalyticsDashboard();
        renderStatsDashboard(dash);
        renderChartsFromData(dash);
        return;
      } catch { /* fallback abajo */ }
    }
    renderStatsDashboard({ ...analytics, barrio: null, label: 'Distrito Nacional' });
    renderChartsFromData(analytics);
  }

  async function applyStatsBarrio(barrio) {
    statsBarrio = barrio || '';
    clearStatsError();

    if (!barrio) {
      await loadGlobalStatsDashboard();
      return;
    }

    if (!apiOnline) {
      showStatsError('API no disponible — reinicia el servidor');
      return;
    }

    setStatsLoading(true);
    try {
      let dash;
      try {
        dash = await window.VertexAPI.getAnalyticsDashboard(barrio);
      } catch {
        dash = await fetchBarrioDashboard(barrio);
      }
      renderStatsDashboard(dash);
      renderChartsFromData(dash);
    } catch (e) {
      console.warn('Dashboard barrio', e);
      showStatsError('Error al filtrar — reinicia el servidor (Ctrl+C y uvicorn)');
    } finally {
      setStatsLoading(false);
    }
  }

  function bindStatsFilter() {
    const sel = document.getElementById('stats-filter-barrio');
    if (!sel || sel.dataset.bound) return;
    sel.dataset.bound = '1';
    sel.addEventListener('change', () => applyStatsBarrio(sel.value));
  }

  async function loadViasData() {
    if (apiOnline) {
      try {
        const data = await window.VertexAPI.getAnalyticsVias();
        viasBarrioList = data.items || [];
        analytics.vias_por_barrio = data.items || [];
        renderViasDashboard(data);
        return;
      } catch (e) {
        console.warn('Vías API', e);
      }
    }
    try {
      const local = await fetch('data/vias_por_barrio.json').then((r) => r.json());
      viasBarrioList = local;
      analytics.vias_por_barrio = local.slice(0, 15);
      const totalM = local.reduce((s, r) => s + (Number(r.longitud_m) || 0), 0);
      renderViasDashboard({
        barrio: null,
        label: 'Distrito Nacional',
        kpis: {
          vias: local.reduce((s, r) => s + (Number(r.vias) || 0), 0),
          longitud_m: totalM,
          longitud_km: totalM / 1000,
        },
        items: local.slice(0, 15),
      });
    } catch {
      renderViasDashboard({ kpis: {}, items: [] });
    }
  }

  function renderViasDashboard(data) {
    const k = data.kpis || {};
    const zone = Boolean(data.barrio || viasBarrio);
    const label = data.label || (zone ? viasBarrio : 'Distrito Nacional');

    const set = (id, val, raw) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (raw) el.textContent = val;
      else el.textContent = val == null ? '—' : fmt(val);
    };

    set('vias-total', k.vias);
    set('vias-metros', k.longitud_m);
    set('vias-km', k.longitud_km != null ? Number(k.longitud_km).toLocaleString('es-DO', { maximumFractionDigits: 3 }) : null, true);

    const lbl = document.getElementById('vias-lbl-count');
    if (lbl) lbl.textContent = zone ? 'Vías en barrio' : 'Vías analizadas';

    const badge = document.getElementById('vias-filter-badge');
    if (badge) {
      badge.classList.toggle('hidden', !zone);
      badge.classList.remove('stats-error');
      badge.textContent = zone ? `📍 ${label}` : '';
    }

    const title = document.getElementById('vias-table-title');
    if (title) {
      title.textContent = zone
        ? `Longitud vial — ${label}`
        : 'Longitud por Barrio — Top 15';
    }

    const tbody = document.getElementById('vias-table-body');
    if (!tbody) return;
    const rows = data.items || [];
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="tbl-empty">Sin datos para este barrio</td></tr>';
      return;
    }
    const max = Math.max(...rows.map((r) => Number(r.longitud_m) || 0), 1);
    tbody.innerHTML = rows.map((r, i) => {
      const m = Number(r.longitud_m) || 0;
      const pct = Math.round((m / max) * 100);
      const km = Number(r.longitud_km).toLocaleString('es-DO', { maximumFractionDigits: 3 });
      return tableBar(
        i + 1,
        `<td class="tbl-name">${r.barrio}</td><td class="tbl-num">${fmt(m)}</td><td class="tbl-num">${km}</td>`,
        pct
      );
    }).join('');
  }

  function resolveViasLocally(barrio) {
    if (!viasBarrioList.length) return null;
    if (!barrio) {
      const totalM = viasBarrioList.reduce((s, r) => s + (Number(r.longitud_m) || 0), 0);
      return {
        barrio: null,
        label: 'Distrito Nacional',
        kpis: {
          vias: viasBarrioList.reduce((s, r) => s + (Number(r.vias) || 0), 0),
          longitud_m: totalM,
          longitud_km: totalM / 1000,
        },
        items: viasBarrioList.slice(0, 15),
      };
    }
    const match = matchBarrioRow(viasBarrioList, barrio);
    if (!match) {
      return {
        barrio,
        label: barrio,
        kpis: { vias: 0, longitud_m: 0, longitud_km: 0 },
        items: [],
      };
    }
    return {
      barrio: match.barrio,
      label: match.barrio,
      kpis: {
        vias: match.vias,
        longitud_m: match.longitud_m,
        longitud_km: match.longitud_km,
      },
      items: [match],
    };
  }

  async function applyViasBarrio(barrio) {
    viasBarrio = barrio || '';
    document.getElementById('view-vias')?.classList.toggle('stats-loading', true);

    try {
      if (apiOnline) {
        try {
          const data = await window.VertexAPI.getAnalyticsVias(barrio || undefined);
          renderViasDashboard(data);
          return;
        } catch (e) {
          console.warn('Vías API — usando datos locales', e);
        }
      }
      if (!viasBarrioList.length) {
        try {
          viasBarrioList = await fetch('data/vias_por_barrio.json').then((r) => r.json());
        } catch { /* */ }
      }
      const local = resolveViasLocally(barrio);
      if (local) renderViasDashboard(local);
    } finally {
      document.getElementById('view-vias')?.classList.remove('stats-loading');
    }
  }

  function bindViasFilter() {
    const sel = document.getElementById('vias-filter-barrio');
    if (!sel || sel.dataset.bound) return;
    sel.dataset.bound = '1';
    sel.addEventListener('change', () => applyViasBarrio(sel.value));
  }

  function renderEspaciosDashboard(data) {
    const k = data.kpis || {};
    const zone = Boolean(data.barrio || espaciosBarrio);
    const label = data.label || (zone ? espaciosBarrio : 'Distrito Nacional');

    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val == null ? '—' : fmt(val);
    };

    set('esp-kpi-parques', k.parques);
    set('esp-kpi-espacios', k.espacios_abiertos);
    set('esp-kpi-barrios', zone ? 1 : (k.barrios ?? 70));

    const lblBarrios = document.getElementById('esp-lbl-barrios');
    if (lblBarrios) lblBarrios.textContent = zone ? 'Barrio' : 'Barrios';

    const badge = document.getElementById('espacios-filter-badge');
    if (badge) {
      badge.classList.toggle('hidden', !zone);
      badge.classList.remove('stats-error');
      badge.textContent = zone ? `📍 ${label}` : '';
    }

    const suffix = zone ? ` — ${label}` : ' — DN completo';
    const titleParques = document.getElementById('chart-title-parques');
    if (titleParques) titleParques.textContent = `Categoría Parques y Plazas${suffix}`;
    const titleEsp = document.getElementById('chart-title-espacios');
    if (titleEsp) titleEsp.textContent = `Clasificación Espacios Abiertos${suffix}`;

    renderEspaciosCharts(data);
  }

  function resolveEspaciosLocally(barrio) {
    if (!espaciosBarrioList.length) return null;
    if (!barrio) {
      const cat = {};
      const cls = {};
      espaciosBarrioList.forEach((r) => {
        (r.parques_categoria || []).forEach((x) => {
          cat[x.categoria] = (cat[x.categoria] || 0) + Number(x.cantidad);
        });
        (r.espacios_clasificacion || []).forEach((x) => {
          cls[x.clasificacion] = (cls[x.clasificacion] || 0) + Number(x.cantidad);
        });
      });
      const sortEntries = (obj, key) => Object.entries(obj)
        .sort((a, b) => b[1] - a[1])
        .map(([name, cantidad]) => ({ [key]: name, cantidad }));
      return {
        barrio: null,
        label: 'Distrito Nacional',
        kpis: {
          parques: espaciosBarrioList.reduce((s, r) => s + (Number(r.parques) || 0), 0),
          espacios_abiertos: espaciosBarrioList.reduce((s, r) => s + (Number(r.espacios_abiertos) || 0), 0),
          barrios: espaciosBarrioList.length,
        },
        parques_categoria: sortEntries(cat, 'categoria'),
        espacios_clasificacion: sortEntries(cls, 'clasificacion'),
      };
    }
    const match = matchBarrioRow(espaciosBarrioList, barrio);
    if (!match) {
      return {
        barrio,
        label: barrio,
        kpis: { parques: 0, espacios_abiertos: 0, barrios: 1 },
        parques_categoria: [],
        espacios_clasificacion: [],
      };
    }
    return {
      barrio: match.barrio,
      label: match.barrio,
      kpis: {
        parques: match.parques,
        espacios_abiertos: match.espacios_abiertos,
        barrios: 1,
      },
      parques_categoria: match.parques_categoria || [],
      espacios_clasificacion: match.espacios_clasificacion || [],
    };
  }

  async function loadEspaciosData() {
    if (apiOnline) {
      try {
        const data = await window.VertexAPI.getAnalyticsEspacios();
        espaciosBarrioList = await fetch('data/espacios_por_barrio.json').then((r) => r.json()).catch(() => []);
        renderEspaciosDashboard(data);
        return;
      } catch (e) {
        console.warn('Espacios API', e);
      }
    }
    try {
      espaciosBarrioList = await fetch('data/espacios_por_barrio.json').then((r) => r.json());
      const local = resolveEspaciosLocally('');
      if (local) renderEspaciosDashboard(local);
    } catch {
      renderEspaciosDashboard({
        kpis: analytics.kpis || {},
        parques_categoria: analytics.parques_categoria || [],
        espacios_clasificacion: analytics.espacios_clasificacion || [],
      });
    }
  }

  async function applyEspaciosBarrio(barrio) {
    espaciosBarrio = barrio || '';
    document.getElementById('view-espacios')?.classList.toggle('stats-loading', true);

    try {
      if (apiOnline) {
        try {
          const data = await window.VertexAPI.getAnalyticsEspacios(barrio || undefined);
          renderEspaciosDashboard(data);
          return;
        } catch (e) {
          console.warn('Espacios API — usando datos locales', e);
        }
      }
      if (!espaciosBarrioList.length) {
        try {
          espaciosBarrioList = await fetch('data/espacios_por_barrio.json').then((r) => r.json());
        } catch { /* */ }
      }
      const local = resolveEspaciosLocally(barrio);
      if (local) renderEspaciosDashboard(local);
    } finally {
      document.getElementById('view-espacios')?.classList.remove('stats-loading');
    }
  }

  function bindEspaciosFilter() {
    const sel = document.getElementById('espacios-filter-barrio');
    if (!sel || sel.dataset.bound) return;
    sel.dataset.bound = '1';
    sel.addEventListener('change', () => applyEspaciosBarrio(sel.value));
  }

  function fillBarrioSelect(sel, list, countKey) {
    if (!sel) return;
    const defaultLabel = sel.id === 'vias-filter-barrio'
      ? 'Distrito Nacional — Todos (Top 15)'
      : 'Distrito Nacional — Todos';
    sel.innerHTML = `<option value="">${defaultLabel}</option>`;
    list
      .sort((a, b) => (a.nombre || a.barrio || '').localeCompare(b.nombre || b.barrio || '', 'es'))
      .forEach((b) => {
        const name = b.nombre || b.barrio || b.DESCRIPCIO || '';
        const opt = document.createElement('option');
        opt.value = name;
        const n = b[countKey] != null ? ` (${fmt(b[countKey])})` : '';
        opt.textContent = `${name}${n}`;
        sel.appendChild(opt);
      });
  }

  async function populateFilters() {
    const statsSel = document.getElementById('stats-filter-barrio');
    const viasSel = document.getElementById('vias-filter-barrio');
    const espSel = document.getElementById('espacios-filter-barrio');

    let barrioList = [];
    if (apiOnline) {
      try {
        barrioList = await window.VertexAPI.listBarrios();
      } catch { /* */ }
    }
    if (!barrioList.length && analytics.barrios) {
      barrioList = analytics.barrios.map((b) => ({
        nombre: b.DESCRIPCIO || b.barrio,
        predios: b.predios,
      }));
    }
    fillBarrioSelect(statsSel, barrioList, 'predios');

    const viasList = viasBarrioList.length
      ? viasBarrioList.map((r) => ({ barrio: r.barrio, vias: r.vias, longitud_km: r.longitud_km }))
      : [];
    if (viasList.length) {
      fillBarrioSelect(viasSel, viasList.map((r) => ({
        nombre: r.barrio,
        vias: r.vias,
      })), 'vias');
    } else {
      fillBarrioSelect(viasSel, barrioList, 'predios');
    }

    const espList = espaciosBarrioList.length
      ? espaciosBarrioList.map((r) => ({
        nombre: r.barrio,
        espacios: (Number(r.parques) || 0) + (Number(r.espacios_abiertos) || 0),
      }))
      : [];
    if (espList.length) {
      fillBarrioSelect(espSel, espList, 'espacios');
    } else {
      fillBarrioSelect(espSel, barrioList, 'predios');
    }
  }

  window.VertexAnalytics = {
    loadAnalytics, restoreGlobalMapKPIs, getGlobalKpis: () => globalKpis,
    applyStatsBarrio, applyViasBarrio, loadViasData,
    applyEspaciosBarrio, loadEspaciosData,
  };
})();
