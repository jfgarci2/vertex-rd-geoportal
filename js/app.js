/**
 * VERTEX RD — Navegación y arranque
 */
function waitForMapboxToken(maxMs = 4000) {
  return new Promise((resolve) => {
    const start = Date.now();
    (function tick() {
      if (window.VERTEX_CONFIG?.mapboxToken || Date.now() - start > maxMs) resolve();
      else setTimeout(tick, 40);
    })();
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const navBtns = document.querySelectorAll('.nav-btn');
  const views = document.querySelectorAll('.view');

  navBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const viewId = btn.dataset.view;
      navBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      views.forEach((v) => v.classList.toggle('active', v.id === 'view-' + viewId));
      if (viewId === 'presentacion' && window.VertexMap) {
        setTimeout(() => window.VertexMap.getMap()?.resize(), 100);
      }
      if (viewId === 'estadisticas') {
        const barrio = document.getElementById('stats-filter-barrio')?.value;
        window.VertexAnalytics?.applyStatsBarrio?.(barrio || '');
      }
      if (viewId === 'vias') {
        const barrio = document.getElementById('vias-filter-barrio')?.value;
        window.VertexAnalytics?.applyViasBarrio?.(barrio || '');
      }
      if (viewId === 'espacios') {
        const barrio = document.getElementById('espacios-filter-barrio')?.value;
        window.VertexAnalytics?.applyEspaciosBarrio?.(barrio || '');
      }
    });
  });

  await window.VertexFicha.loadData();
  window.VertexFicha.bindSearch();
  await window.VertexAnalytics.loadAnalytics();
  await waitForMapboxToken();
  window.VertexMap.init();
  await window.VertexExplorer?.init?.();

  document.querySelectorAll('.side-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const panel = tab.dataset.panel;
      document.querySelectorAll('.side-tab').forEach((t) => t.classList.toggle('active', t === tab));
      document.getElementById('panel-capas')?.classList.toggle('active', panel === 'capas');
      document.getElementById('panel-tools')?.classList.toggle('active', panel === 'tools');
    });
  });

  document.querySelectorAll('.layer-chip').forEach((chip) => {
    const toggleId = chip.dataset.toggle;
    const cb = document.getElementById(toggleId);
    if (cb) chip.classList.toggle('on', cb.checked);
    chip.addEventListener('click', () => {
      const input = document.getElementById(chip.dataset.toggle);
      if (!input) return;
      input.checked = !input.checked;
      chip.classList.toggle('on', input.checked);
      input.dispatchEvent(new Event('change'));
    });
  });

  document.getElementById('msp-collapse')?.addEventListener('click', () => {
    document.getElementById('map-side-panel')?.classList.toggle('collapsed');
    const btn = document.getElementById('msp-collapse');
    if (btn) btn.textContent = document.getElementById('map-side-panel')?.classList.contains('collapsed') ? '+' : '−';
  });

  document.getElementById('btn-activar-subbarrios')?.addEventListener('click', () => {
    document.querySelector('[data-view="presentacion"]')?.click();
    const cb = document.getElementById('toggleSubBarrios');
    if (cb) { cb.checked = true; cb.dispatchEvent(new Event('change')); }
  });
});
