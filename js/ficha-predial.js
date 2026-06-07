/**
 * VERTEX RD — Ficha Predial 360° + drawer en mapa
 */
(function () {
  let densidades = [];
  let densRen = [];
  let retiros = [];
  let prediosLookup = {};
  let apiOnline = false;

  async function loadData() {
    const h = await window.VertexAPI?.health();
    apiOnline = h?.status === 'ok';
    updateApiBadge(h);
    window.VERTEX_API_DEGRADED = h?.status === 'degraded';

    const [d, dr, r] = await Promise.all([
      fetch('data/densidades.json').then((x) => x.json()),
      fetch('data/densidades_renacimiento.json').then((x) => x.json()),
      fetch('data/retiros.json').then((x) => x.json()),
    ]);
    densidades = d;
    densRen = dr;
    retiros = r;

    if (!apiOnline) {
      try {
        prediosLookup = await fetch('data/predios_lookup.json').then((x) => x.json());
      } catch { prediosLookup = {}; }
    }
  }

  function updateApiBadge(h) {
    const el = document.getElementById('api-status');
    if (!el) return;
    if (h?.status === 'ok') {
      el.textContent = `API ${h.backend} · ${Number(h.predios).toLocaleString('es-DO')} predios`;
      el.className = 'api-badge online';
    } else if (h?.status === 'degraded') {
      el.textContent = 'Sin SQLite en nube · modo JSON';
      el.className = 'api-badge degraded';
    } else {
      el.textContent = 'API offline — modo local';
      el.className = 'api-badge offline';
    }
  }

  function setField(id, value) {
    document.querySelectorAll(`#${id}`).forEach((el) => {
      el.textContent = (value !== null && value !== undefined && value !== '') ? value : '—';
    });
  }

  function findDensidad(id) { return densidades.find((x) => x.ID_DENSIDADES === id) || null; }
  function findDensRen(id) { return densRen.find((x) => x.ID_DENSIDADES === id) || null; }
  function findRetiro(id) { return retiros.find((x) => x.ID_RETIROS === id) || null; }

  function renderFromPredio(predio, dens, ren, retList) {
    const idDens = predio.id_densidades || predio['ID_DENSIDADES *'] || predio.ID_DENSIDA || predio.TIPOS || '';
    const idRet = predio.id_retiros || predio['ID_RETIROS *'] || predio.ID_RETIROS || '';

    if (!dens) dens = findDensidad(idDens);
    const renItem = ren?.[0] || findDensRen(idDens);
    const ret = retList?.[0] || findRetiro(idRet);

    const catastro = predio.catastro || predio.CATASTRO || predio.CODIGO;
    const codigo = predio.codigo || predio.CODIGO || (catastro ? String(catastro).slice(-8) : '');
    const barrio = predio.barrio || predio.BARRIO_;
    const uso = predio.uso || predio.USO;
    const area = predio.areapredio || predio.AREAPREDIO;

    setField('fp-codigo', codigo ? `Ref. ${codigo}` : catastro);
    setField('fp-catastro-full', catastro);
    setField('fp-barrio', barrio);
    setField('fp-subbarrio', predio.sub_barrio || predio.SUB_BARRIO);
    setField('fp-poligono', predio.poligono || predio.POLIGONO);
    setField('fp-uso', uso);
    setField('fp-estado', predio.estado_des || predio.ESTADO_DES);
    setField('fp-actividad', predio.actividad || predio.ACTIVIDAD);
    setField('fp-ut', predio.ut || predio.UT);
    setField('fp-nombre-ut', predio.nombre_ut || predio.NOMBRE_UT);
    setField('fp-area', area ? Number(area).toLocaleString('es-DO') + ' m²' : '—');
    setField('fp-categoria', predio.categoria || predio.CATEGORIA || dens?.CATEGORIA);
    setField('fp-usos-permitidos', dens?.USOS_PERMITIDOS);

    if (dens) {
      setField('fp-solar-300', dens.SOLARES_MENORES_DE_300_M2);
      setField('fp-solar-301-7', dens.SOLARES_MAYORES_DE_301_M2_EN_VIAS_MAYORES_DE_70);
      setField('fp-solar-301-6', dens.OLARES_MAYORES_DE_301_M2_N_VIAS_ENTRE_60_Y_70_M);
      setField('fp-solar-601', dens.OLARES_MAYORES_A_601_M2_EN_VIAS_MAYORES_DE_70_M);
      setField('fp-niveles', dens.ALTURA_MAX_NIVELES);
      setField('fp-altura-m', dens.ALTURA_MAX_METROS);
    }

    if (renItem) {
      setField('dr-edificabilidad', renItem.Edificabilidad);
      setField('dr-ocupacion', renItem['Ocupación_%']);
      setField('dr-densidad', renItem['Densidad_hab/ha']);
      setField('dr-niveles', renItem['Niveles_Máx']);
      setField('dr-altura', renItem['Altura_Máx_m']);
      setField('dr-rango-area', renItem.Rango_Area_m2);
      setField('dr-ret-frente', renItem.Retiro_Frente_m);
      setField('dr-ret-lateral', renItem.Retiro_Laterales_m);
      setField('dr-ret-posterior', renItem.Retiro_Posterior_m);
      setField('dr-obs', renItem.Observaciones_Retiros);
    }

    if (ret) {
      setField('ind-densidad', ret.Densidad);
      setField('ind-niveles', ret.Rango_Niveles);
      setField('ind-lote-min', ret['Lote_Mínimo_m2']);
      setField('ind-ret-frontal', ret.Retiro_Frontal_ML);
      setField('ind-ret-lateral', ret.Retiro_Lateral_ML);
      setField('ind-ret-posterior', ret.Retiro_Posterior_ML);
      setField('ind-ret-edificios', ret.Retiro_Entre_Edificios_ML);
    }

    showMapDrawer({
      catastro: codigo ? `Ref. ${codigo}` : catastro,
      catastroFull: catastro,
      barrio, uso, area,
      categoria: predio.categoria || predio.CATEGORIA || dens?.CATEGORIA,
      idDens,
    });
  }

  function showMapDrawer(info) {
    const drawer = document.getElementById('map-ficha-drawer');
    if (!drawer) return;
    drawer.classList.remove('hidden');
    window.VertexMap?.setDrawerPadding?.(true);
    document.getElementById('drawer-catastro').textContent = info.catastro || '—';
    document.getElementById('drawer-barrio').textContent = info.barrio || '—';
    document.getElementById('drawer-uso').textContent = info.uso || '—';
    document.getElementById('drawer-area').textContent = info.area
      ? Number(info.area).toLocaleString('es-DO') + ' m²' : '—';
    document.getElementById('drawer-densidad').textContent = info.categoria
      ? `${info.categoria}${info.idDens ? ` (${info.idDens})` : ''}`
      : (info.idDens || '—');
  }

  function focusPredioOnMap(catastro, centroid, mapFeature) {
    if (!window.VertexMap?.highlightPredio) return;
    const lng = centroid?.lng;
    const lat = centroid?.lat;
    window.VertexMap.highlightPredio(catastro, lng, lat, mapFeature);
  }

  async function searchByCatastro(code) {
    const key = String(code).trim();
    if (!key) return null;

    if (apiOnline) {
      try {
        const data = await window.VertexAPI.getPredio(key);
        renderFromPredio(data.predio, data.densidad, data.renacimiento, data.retiros);
        focusPredioOnMap(key, data.centroid);
        window.VertexMap?.closeActivePopup?.();
        return data.predio;
      } catch (e) {
        console.warn('API miss', e);
      }
    }

    const predio = prediosLookup[key];
    if (!predio) {
      alert('Código catastral no encontrado.');
      return null;
    }
    renderFromPredio(predio);
    focusPredioOnMap(key, null);
    return predio;
  }

  function loadFromMapProps(props, mapFeature) {
    const catastro = props.CATASTRO;
    renderFromPredio({
      catastro, codigo: props.id || props.CODIGO,
      barrio: props.BARRIO_, sub_barrio: props.SUB_BARRIO, poligono: props.POLIGONO,
      uso: props.USO || props.ACT_USO_CO, actividad: props.ACTIVIDAD, estado_des: props.ESTADO_DES,
      ut: props.UT, nombre_ut: props.NOMBRE_UT, areapredio: props.AREAPREDIO,
      categoria: props.CATEGORIA, tipos: props.TIPOS,
      id_densidades: props.ID_DENSIDA || props.TIPOS, id_retiros: props.ID_RETIROS,
    });
    focusPredioOnMap(catastro, null, mapFeature);
    const inp = document.getElementById('header-catastro-search');
    if (inp && catastro) { inp.value = catastro; syncSearchClearBtn(); }
  }

  let searchTimeout;

  function renderSuggestions(results) {
    const box = document.getElementById('search-suggestions');
    if (!box) return;
    if (!results.length) { box.style.display = 'none'; return; }
    box.innerHTML = results.map((r) => {
      const label = r.label || {};
      const title = label.title || `${r.barrio || ''} · ${r.uso || ''}`;
      const sub = label.subtitle || `Ref. ${r.codigo || '—'}`;
      return `<div class="suggestion-item" data-catastro="${r.catastro}">
        <span class="sug-icon">📍</span>
        <div class="sug-body">
          <strong>${title}</strong>
          <small>${sub}</small>
        </div>
      </div>`;
    }).join('');
    box.style.display = 'block';
    box.querySelectorAll('.suggestion-item').forEach((el) => {
      el.addEventListener('click', () => {
        document.getElementById('header-catastro-search').value = el.dataset.catastro;
        syncSearchClearBtn();
        box.style.display = 'none';
        searchByCatastro(el.dataset.catastro);
      });
    });
  }

  async function fetchSearchResults(q) {
    let results = [];
    if (apiOnline) {
      try { results = await window.VertexAPI.searchPredios(q, 12); } catch { /* */ }
    }
    if (!results.length) {
      results = Object.entries(prediosLookup)
        .filter(([k, v]) => k.includes(q) || String(v.BARRIO_ || '').toUpperCase().includes(q.toUpperCase()))
        .slice(0, 10)
        .map(([k, v]) => ({ catastro: k, barrio: v.BARRIO_, uso: v.USO, codigo: v.CODIGO }));
    }
    return results;
  }

  function onSearchInput(q) {
    const box = document.getElementById('search-suggestions');
    if (!box) return;
    if (q.length < 2) { box.innerHTML = ''; box.style.display = 'none'; return; }

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      renderSuggestions(await fetchSearchResults(q));
    }, 280);
  }

  function looksLikeCatastro(s) {
    return /^\d{8,}/.test(s) || (s.includes('-') && /\d/.test(s));
  }

  const FICHA_FIELD_IDS = [
    'fp-codigo', 'fp-catastro-full', 'fp-barrio', 'fp-subbarrio', 'fp-poligono', 'fp-uso',
    'fp-estado', 'fp-actividad', 'fp-ut', 'fp-nombre-ut', 'fp-area', 'fp-categoria',
    'fp-usos-permitidos', 'fp-solar-300', 'fp-solar-301-7', 'fp-solar-301-6', 'fp-solar-601',
    'fp-niveles', 'fp-altura-m',
  ];

  function syncSearchClearBtn() {
    const input = document.getElementById('header-catastro-search');
    const wrap = document.getElementById('search-input-wrap');
    const btn = document.getElementById('header-search-clear-btn');
    const hasValue = Boolean(input?.value?.trim());
    wrap?.classList.toggle('has-value', hasValue);
    btn?.classList.toggle('hidden', !hasValue);
  }

  function clearFichaDisplay() {
    FICHA_FIELD_IDS.forEach((id) => setField(id, '—'));
  }

  function clearSearchInput() {
    const input = document.getElementById('header-catastro-search');
    if (input) input.value = '';
    syncSearchClearBtn();
    const box = document.getElementById('search-suggestions');
    if (box) { box.innerHTML = ''; box.style.display = 'none'; }
    window.VertexMap?.clearPredioSelection?.();
    clearFichaDisplay();
    input?.focus();
  }

  function bindSearch() {
    const doSearch = async () => {
      const input = document.getElementById('header-catastro-search');
      const q = input?.value?.trim();
      if (!q) return;
      if (looksLikeCatastro(q)) {
        searchByCatastro(q);
        return;
      }
      let results = [];
      if (apiOnline) {
        try { results = await window.VertexAPI.searchPredios(q, 10); } catch { /* */ }
      }
      if (results.length === 1) {
        searchByCatastro(results[0].catastro);
        return;
      }
      if (results.length > 1) {
        renderSuggestions(results);
        return;
      }
      alert('No se encontraron predios. Prueba "barrio + uso" (ej. Gazcue residencial) o el explorador del mapa.');
    };
    document.getElementById('header-search-btn')?.addEventListener('click', doSearch);
    const input = document.getElementById('header-catastro-search');
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { doSearch(); document.getElementById('search-suggestions').style.display = 'none'; }
    });
    input?.addEventListener('input', (e) => {
      syncSearchClearBtn();
      onSearchInput(e.target.value.trim());
    });
    syncSearchClearBtn();
    document.getElementById('header-search-clear-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      clearSearchInput();
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.header-search-wrap')) {
        const box = document.getElementById('search-suggestions');
        if (box) box.style.display = 'none';
      }
    });

    document.getElementById('drawer-close')?.addEventListener('click', () => {
      window.VertexMap?.clearPredioSelection?.();
    });
    document.getElementById('drawer-full-ficha')?.addEventListener('click', () => {
      document.querySelector('[data-view="ficha"]')?.click();
    });
  }

  window.VertexFicha = {
    loadData, bindSearch, searchByCatastro, loadFromMapProps, renderFicha: renderFromPredio,
    clearSearchInput, syncSearchClearBtn,
  };
})();
