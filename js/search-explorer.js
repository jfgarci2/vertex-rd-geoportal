/**
 * VERTEX RD — Búsqueda intuitiva + explorador territorial + KPIs dinámicos
 */
(function () {
  let barrios = [];
  let subBarriosCache = {};
  let territoryActive = false;

  function fmt(n) {
    return Number(n).toLocaleString('es-DO');
  }

  function fmtArea(n) {
    if (n == null || n === '') return '';
    return `${Number(n).toLocaleString('es-DO')} m²`;
  }

  function renderPredioCard(r) {
    const label = r.label || {};
    const title = label.title || `${r.barrio || ''} · ${r.uso || ''}`.replace(/^ · | · $/g, '');
    const subtitle = label.subtitle || `Ref. ${r.codigo || '—'} · ${fmtArea(r.areapredio)}`;
    return `<button type="button" class="predio-result-card" data-catastro="${r.catastro}">
      <span class="prc-title">${title}</span>
      <span class="prc-sub">${subtitle}</span>
      ${r.sub_barrio && r.sub_barrio !== r.barrio ? `<span class="prc-tag">${r.sub_barrio}</span>` : ''}
    </button>`;
  }

  function bindPredioCards(container) {
    container.querySelectorAll('.predio-result-card').forEach((el) => {
      el.addEventListener('click', () => {
        const code = el.dataset.catastro;
        document.getElementById('header-catastro-search').value = code;
        window.VertexFicha?.syncSearchClearBtn?.();
        window.VertexFicha?.searchByCatastro?.(code);
      });
    });
  }

  function showPrediosPanel(title, subtitle) {
    const panel = document.getElementById('map-predios-panel');
    if (!panel) return;
    const sug = document.getElementById('search-suggestions');
    if (sug) sug.style.display = 'none';
    window.VertexMap?.closeActivePopup?.();
    panel.classList.remove('hidden');
    document.getElementById('mpp-title').textContent = title;
    document.getElementById('mpp-subtitle').textContent = subtitle || '';
  }

  function hidePrediosPanel() {
    document.getElementById('map-predios-panel')?.classList.add('hidden');
  }

  function setMapKpi(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val == null ? '—' : fmt(val);
  }

  function setTerritoryMode(active) {
    territoryActive = active;
    const panel = document.getElementById('map-kpi-panel');
    const ctx = document.getElementById('map-kpi-context');
    if (panel) panel.classList.toggle('territory-active', active);
    if (ctx) ctx.classList.toggle('hidden', !active);
  }

  async function updateTerritoryKPIs(barrio, subBarrio) {
    if (!barrio) {
      setTerritoryMode(false);
      window.VertexAnalytics?.restoreGlobalMapKPIs?.();
      return;
    }
    try {
      const stats = await window.VertexAPI.getTerritoryStats(barrio, subBarrio || undefined);
      setTerritoryMode(true);
      document.getElementById('map-kpi-context-label').textContent = stats.label || barrio;
      setMapKpi('kpi-predios', stats.predios);
      setMapKpi('kpi-subbarrios', stats.sub_barrios);
      setMapKpi('kpi-residencial', stats.residencial);
      setMapKpi('kpi-comercial', stats.comercial);
      document.querySelectorAll('.kpi-card.kpi-zone .kpi-value, .kpi-card.kpi-territory .kpi-value').forEach((el) => {
        el.classList.add('kpi-flash');
        setTimeout(() => el.classList.remove('kpi-flash'), 600);
      });
    } catch (e) {
      console.warn('Stats territorio', e);
    }
  }

  async function onTerritoryChange(barrio, subBarrio, fly) {
    if (barrio) await loadSubBarrios(barrio);
    await updateTerritoryKPIs(barrio, subBarrio);
    if (!fly || !barrio) return;
    let territory = findTerritoryBounds(barrio, subBarrio || null);
    if (!territory) {
      try {
        territory = await window.VertexAPI.getTerritoryBounds(barrio, subBarrio || undefined);
      } catch { /* */ }
    }
    if (territory?.bounds) {
      window.VertexMap?.flyToTerritory?.(territory.bounds, {
        level: subBarrio ? 'subbarrio' : 'barrio',
        barrio,
        subBarrio: subBarrio || null,
        label: subBarrio || barrio,
      });
    }
  }

  async function loadBarrios() {
    try {
      barrios = await window.VertexAPI.listBarrios();
    } catch {
      barrios = [];
    }
    const sel = document.getElementById('filter-barrio');
    const browseBarrio = document.getElementById('browse-barrio');
    const opts = '<option value="">Barrio…</option>'
      + barrios.map((b) => `<option value="${b.nombre}">${b.nombre}</option>`).join('');
    [sel, browseBarrio].forEach((el) => {
      if (!el) return;
      const prev = el.value;
      el.innerHTML = opts;
      if (prev) el.value = prev;
    });
  }

  async function loadSubBarrios(barrio) {
    if (!barrio) {
      const el = document.getElementById('filter-subbarrio');
      if (el) el.innerHTML = '<option value="">Sub-barrio…</option>';
      return [];
    }
    if (!subBarriosCache[barrio]) {
      try {
        subBarriosCache[barrio] = await window.VertexAPI.listSubBarrios(barrio);
      } catch {
        subBarriosCache[barrio] = [];
      }
    }
    const subs = subBarriosCache[barrio];
    const subOpts = '<option value="">Sub-barrio…</option>'
      + subs.map((s) => `<option value="${s.nombre}">${s.nombre}</option>`).join('');
    const el = document.getElementById('filter-subbarrio');
    if (el) el.innerHTML = subOpts;
    const browseSub = document.getElementById('browse-subbarrio');
    if (browseSub) browseSub.innerHTML = subOpts;
    return subs;
  }

  function findTerritoryBounds(barrio, subBarrio) {
    if (subBarrio && subBarriosCache[barrio]) {
      const s = subBarriosCache[barrio].find((x) => x.nombre === subBarrio);
      if (s?.bounds) return s;
    }
    if (barrio) {
      const b = barrios.find((x) => x.nombre === barrio);
      if (b?.bounds) return b;
    }
    return null;
  }

  async function goToTerritory() {
    const level = document.getElementById('filter-level')?.value || 'barrio';
    const barrio = document.getElementById('filter-barrio')?.value;
    const subBarrio = document.getElementById('filter-subbarrio')?.value;

    if (level === 'barrio' && !barrio) {
      alert('Seleccione un barrio.');
      return;
    }
    if (level === 'subbarrio' && !subBarrio) {
      alert('Seleccione un sub-barrio.');
      return;
    }
    await onTerritoryChange(barrio, level === 'subbarrio' ? subBarrio : null, true);
  }

  async function browsePrediosInZone() {
    const barrio = document.getElementById('filter-barrio')?.value
      || document.getElementById('browse-barrio')?.value;
    const subBarrio = document.getElementById('filter-subbarrio')?.value
      || document.getElementById('browse-subbarrio')?.value;
    const q = document.getElementById('browse-detail')?.value?.trim();
    const box = document.getElementById('map-predio-results');
    if (!box) return;
    if (!barrio && !q) {
      alert('Seleccione al menos un barrio o escriba un detalle (uso, actividad).');
      return;
    }

    showPrediosPanel('Cargando…', '');
    box.innerHTML = '<div class="explorer-loading">Buscando predios…</div>';

    let data = { total: 0, items: [], showing: 0, limit: 30 };
    try {
      data = await window.VertexAPI.browsePredios({ barrio, sub_barrio: subBarrio, q, limit: 30 });
    } catch {
      box.innerHTML = '<div class="explorer-empty">Sin resultados</div>';
      return;
    }

    const results = data.items || data;
    const total = data.total ?? (Array.isArray(results) ? results.length : 0);
    const showing = data.showing ?? results.length;

    if (!results.length) {
      box.innerHTML = '<div class="explorer-empty">No hay predios con esos criterios</div>';
      showPrediosPanel('Sin resultados', '');
      return;
    }

    const zoneLabel = subBarrio || barrio || 'zona';
    const more = total > showing ? ` · mostrando ${showing} más grandes` : '';
    showPrediosPanel(`${fmt(total)} predios`, `${zoneLabel}${more}`);

    box.innerHTML = results.map(renderPredioCard).join('');
    bindPredioCards(box);

    if (barrio) await onTerritoryChange(barrio, subBarrio || null, true);
  }

  function clearTerritory() {
    document.getElementById('filter-barrio').value = '';
    const sub = document.getElementById('filter-subbarrio');
    if (sub) sub.innerHTML = '<option value="">Sub-barrio…</option>';
    document.getElementById('browse-detail').value = '';
    hidePrediosPanel();
    window.VertexMap?.clearTerritoryHighlight?.();
    updateTerritoryKPIs(null);
  }

  function onFilterLevelChange() {
    const level = document.getElementById('filter-level')?.value;
    const subSel = document.getElementById('filter-subbarrio');
    if (subSel) subSel.style.display = level === 'subbarrio' ? '' : 'none';
  }

  function bindExplorer() {
    document.getElementById('filter-level')?.addEventListener('change', onFilterLevelChange);
    document.getElementById('filter-barrio')?.addEventListener('change', async (e) => {
      const barrio = e.target.value;
      await loadSubBarrios(barrio);
      const bb = document.getElementById('browse-barrio');
      if (bb) bb.value = barrio;
      if (barrio) await onTerritoryChange(barrio, null, false);
      else await updateTerritoryKPIs(null);
    });
    document.getElementById('filter-subbarrio')?.addEventListener('change', async (e) => {
      const bs = document.getElementById('browse-subbarrio');
      if (bs) bs.value = e.target.value;
      const barrio = document.getElementById('filter-barrio')?.value;
      if (barrio) await onTerritoryChange(barrio, e.target.value || null, false);
    });
    document.getElementById('filter-go-btn')?.addEventListener('click', goToTerritory);
    document.getElementById('filter-clear-btn')?.addEventListener('click', clearTerritory);
    document.getElementById('browse-predios-btn')?.addEventListener('click', browsePrediosInZone);
    document.getElementById('mpp-close')?.addEventListener('click', hidePrediosPanel);

    onFilterLevelChange();
  }

  async function init() {
    await loadBarrios();
    bindExplorer();
  }

  window.VertexExplorer = {
    init, loadBarrios, updateTerritoryKPIs, clearTerritory, renderPredioCard, bindPredioCards,
  };
})();
