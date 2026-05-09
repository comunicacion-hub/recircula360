// ============================================================
// RECIRCULA 360 — dashboard.js
// Dashboard ambiental: Operativo e Histórico
// ============================================================

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const PROVINCIAS = ['El Oro','Guayas','Manabí','Sucumbíos','Pichincha','Chimborazo'];

const COLORES_PROV = {
  'El Oro':     '#002343',
  'Guayas':     '#00bda4',
  'Manabí':     '#079fff',
  'Sucumbíos':  '#f5ad21',
  'Pichincha':  '#9fda60',
  'Chimborazo': '#f82d72',
};

// Metas anuales
const METAS = { PET: 811, Suave: 248, Duro: 377 };

// Estado del dashboard
let DASH_FILTROS = { anio: '', mes: '', provincia: '', ciudad: '', asociacion: '' };
let DASH_DATA    = null;
let DASH_TAB     = 'operativo';

// ============================================================
// RENDER PRINCIPAL
// ============================================================

async function renderDashboard() {
  const content = document.getElementById('main-content');

  content.innerHTML = `
    <div class="filters-bar" id="dash-filters">
      <span class="filter-label-inline"><i class="ti ti-adjustments-horizontal"></i> Filtros</span>
      <div class="filter-divider"></div>
      <select class="filter-select-sm" id="f-anio" onchange="aplicarFiltro('anio',this.value)">
        <option value="">Todos los años</option>
      </select>
      <select class="filter-select-sm" id="f-mes" onchange="aplicarFiltro('mes',this.value)">
        <option value="">Todos los meses</option>
        ${MESES.map(m => `<option value="${m}">${m}</option>`).join('')}
      </select>
      <select class="filter-select-sm" id="f-provincia" onchange="aplicarFiltro('provincia',this.value)">
        <option value="">Todas las provincias</option>
        ${PROVINCIAS.map(p => `<option value="${p}">${p}</option>`).join('')}
      </select>
      <select class="filter-select-sm" id="f-ciudad" onchange="aplicarFiltro('ciudad',this.value)">
        <option value="">Todas las ciudades</option>
      </select>
      <select class="filter-select-sm" id="f-asociacion" onchange="aplicarFiltro('asociacion',this.value)">
        <option value="">Todas las asociaciones</option>
        ${CAT.asociaciones.map(a => `<option value="${a['ID_Asociacion']}">${a['Nombre']}</option>`).join('')}
      </select>
      <button class="btn-reset-filters" onclick="resetFiltros()">
        <i class="ti ti-x"></i> Limpiar
      </button>
    </div>

    <div class="tabs-bar">
      <button class="tab-btn active" id="tab-operativo" onclick="switchDashTab('operativo')">
        <i class="ti ti-chart-bar"></i> Operativo
      </button>
      <button class="tab-btn" id="tab-historico" onclick="switchDashTab('historico')">
        <i class="ti ti-history"></i> Histórico
      </button>
    </div>

    <div id="dash-tab-content">
      <div style="display:flex;align-items:center;justify-content:center;padding:60px;gap:16px">
        <div class="spinner"></div>
        <span style="color:var(--tm);font-size:14px">Cargando datos...</span>
      </div>
    </div>
  `;

  await cargarDashboard();
}

// ============================================================
// CARGAR DATOS
// ============================================================

async function cargarDashboard() {
  try {
    const res = await apiGet({ action: 'getDashboard', ...DASH_FILTROS });
    if (!res.ok) { showToast('Error cargando dashboard'); return; }
    DASH_DATA = res.data;
    poblarFiltrosDisponibles(DASH_DATA.filtrosDisponibles);
    renderDashTab();
  } catch(e) {
    console.error(e);
    showToast('Error de conexión');
  }
}

function poblarFiltrosDisponibles(f) {
  if (!f) return;
  const selAnio = document.getElementById('f-anio');
  if (selAnio && f.anios) {
    const cur = DASH_FILTROS.anio;
    selAnio.innerHTML = '<option value="">Todos los años</option>' +
      f.anios.map(a => `<option value="${a}" ${a===cur?'selected':''}>${a}</option>`).join('');
  }
  const selCiudad = document.getElementById('f-ciudad');
  if (selCiudad && f.ciudades) {
    const cur = DASH_FILTROS.ciudad;
    selCiudad.innerHTML = '<option value="">Todas las ciudades</option>' +
      f.ciudades.map(c => `<option value="${c}" ${c===cur?'selected':''}>${c}</option>`).join('');
  }
}

function aplicarFiltro(campo, valor) {
  DASH_FILTROS[campo] = valor;
  cargarDashboard();
}

function resetFiltros() {
  DASH_FILTROS = { anio: '', mes: '', provincia: '', ciudad: '', asociacion: '' };
  ['f-anio','f-mes','f-provincia','f-ciudad','f-asociacion'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  cargarDashboard();
}

// ============================================================
// PESTAÑAS
// ============================================================

function switchDashTab(tab) {
  DASH_TAB = tab;
  document.getElementById('tab-operativo').className = 'tab-btn' + (tab==='operativo'?' active':'');
  document.getElementById('tab-historico').className = 'tab-btn' + (tab==='historico'?' active':'');
  renderDashTab();
}

function renderDashTab() {
  if (!DASH_DATA) return;
  if (DASH_TAB === 'operativo') renderOperativo();
  else renderHistorico();
}

// ============================================================
// OPERATIVO
// ============================================================

function renderOperativo() {
  const d = DASH_DATA;
  const k = d.kpis;
  const pctPET   = METAS.PET   > 0 ? Math.min((k.tnPET   / METAS.PET)   * 100, 100) : 0;
  const pctSuave = METAS.Suave > 0 ? Math.min((k.tnSuave / METAS.Suave) * 100, 100) : 0;
  const pctDuro  = METAS.Duro  > 0 ? Math.min((k.tnDuro  / METAS.Duro)  * 100, 100) : 0;

  document.getElementById('dash-tab-content').innerHTML = `
    <div class="kpi-grid" style="grid-template-columns:repeat(3,minmax(0,1fr))">
      <div class="kpi-card">
        <div class="kpi-label">Total TN recuperadas</div>
        <div class="kpi-value">${fmtNum(k.totalTN)} <span class="kpi-unit">TN</span></div>
        <div class="kpi-note">Todos los materiales</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">TN priorizables</div>
        <div class="kpi-value">${fmtNum(k.tnPriorizables)} <span class="kpi-unit">TN</span></div>
        <div class="kpi-note">PET + Suave + Duro</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Ingresos venta PET</div>
        <div class="kpi-value">${fmtMoney(k.ingresosPET)}</div>
        <div class="kpi-note">Valor generado</div>
      </div>
    </div>

    <div class="dash-charts-row">
      <div class="card">
        <div class="card-title">TN recuperadas por material</div>
        ${renderDonut(d.distribucion)}
      </div>
      <div class="card">
        <div class="card-title">Avance vs meta anual</div>
        <div class="cylinders-wrap">
          ${renderCilindro('PET', k.tnPET, METAS.PET, pctPET, 'linear-gradient(180deg,#0778bf,#002343)')}
          ${renderCilindro('Duro', k.tnDuro, METAS.Duro, pctDuro, 'linear-gradient(180deg,#079fff,#86d2da)')}
          ${renderCilindro('Suave', k.tnSuave, METAS.Suave, pctSuave, 'linear-gradient(180deg,#5bbd70,#00bda4)')}
        </div>
      </div>
      <div class="card">
        <div class="card-title">TN PET mensual por provincia</div>
        ${renderLineChart(d.porProvMes, d.meses)}
      </div>
    </div>

    <div class="dash-bottom-row">
      <div class="card">
        <div class="card-title">
          Ranking compradores · PET
          <span class="card-tag">${d.ranking.length} compradores</span>
        </div>
        ${renderRanking(d.ranking)}
      </div>
      <div class="card">
        <div class="card-title">
          Colectivos beneficiarios
          <span class="card-tag">${d.colectivos.length} asociaciones</span>
        </div>
        <div class="asoc-grid">
          ${d.colectivos.map(c => `<div class="asoc-chip" title="${c}">${c}</div>`).join('')}
        </div>
      </div>
    </div>
  `;
}

// ── Donut ──────────────────────────────────────────────────
function renderDonut(dist) {
  const colores = {
    'PET': '#002343', 'Plástico Duro': '#079fff', 'Plástico Suave': '#00bda4',
    'Cartón': '#f5ad21', 'Lata/Aluminio': '#9fda60', 'Vidrio': '#86d2da',
    'Chatarra': '#5bbd70', 'Cobre': '#f82d72', 'Otros': '#dde4ea',
  };
  const total = Object.values(dist).reduce((s, v) => s + (v || 0), 0);
  if (total === 0) return '<p style="color:var(--tl);font-size:13px">Sin datos</p>';

  const r = 55, cx = 65, cy = 65, circum = 2 * Math.PI * r;
  let offset = 0;
  const segs = Object.entries(dist).filter(([,v]) => v > 0).map(([nombre, valor]) => {
    const dash = (valor / total) * circum;
    const seg  = { nombre, valor, dash, offset, color: colores[nombre] || '#ccc' };
    offset += dash;
    return seg;
  });

  const circles = segs.map(s =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}"
      stroke-width="20" stroke-dasharray="${s.dash} ${circum - s.dash}"
      stroke-dashoffset="${-s.offset}" transform="rotate(-90 ${cx} ${cy})"/>`
  ).join('');

  const leyenda = segs.map(s =>
    `<div class="legend-item"><div class="legend-dot" style="background:${s.color}"></div>${s.nombre} · ${fmtNum(s.valor)} TN</div>`
  ).join('');

  return `
    <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
      <div style="position:relative;flex-shrink:0">
        <svg width="130" height="130" viewBox="0 0 130 130">
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#eef2f6" stroke-width="20"/>
          ${circles}
        </svg>
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center">
          <div style="font-size:14px;font-weight:700;color:var(--b1)">${fmtNum(total)}</div>
          <div style="font-size:9px;color:var(--tm)">TN total</div>
        </div>
      </div>
      <div class="chart-legend" style="flex-direction:column;gap:5px">${leyenda}</div>
    </div>`;
}

// ── Cilindro ──────────────────────────────────────────────
function renderCilindro(nombre, actual, meta, pct, gradient) {
  const pctLabel = meta > 0 ? ((actual / meta) * 100).toFixed(0) + '%' : '—';
  return `
    <div class="cyl-item">
      <div class="cyl-pct">${pctLabel}</div>
      <div class="cyl-outer">
        <div class="cyl-fill" style="height:${Math.min(pct,100)}%;background:${gradient}"></div>
      </div>
      <div class="cyl-name">${nombre}</div>
      <div style="font-size:9px;color:var(--tl);margin-top:2px">${fmtNum(actual)} / ${meta} TN</div>
    </div>`;
}

// ── Líneas por provincia ──────────────────────────────────
function renderLineChart(porProvMes, meses) {
  const W = 280, H = 85;
  const provConDatos = PROVINCIAS.filter(p => meses.some(m => porProvMes[p]?.[m] > 0));
  if (!provConDatos.length) return '<p style="color:var(--tl);font-size:13px">Sin datos</p>';

  let max = 0;
  provConDatos.forEach(p => meses.forEach(m => { if ((porProvMes[p]?.[m]||0) > max) max = porProvMes[p][m]; }));
  if (max === 0) max = 1;
  const stepX = W / (meses.length - 1);

  const lineas = provConDatos.map(p => {
    const pts = meses.map((m,i) => `${i*stepX},${H - ((porProvMes[p]?.[m]||0)/max)*(H-8)-4}`).join(' ');
    return `<polyline points="${pts}" fill="none" stroke="${COLORES_PROV[p]}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  }).join('');

  const labels = [0,2,4,6,8,10,11].map(i =>
    `<text x="${i*stepX}" y="${H+13}" font-size="8" fill="#9aafbe" text-anchor="middle">${(meses[i]||'').substring(0,3)}</text>`
  ).join('');

  const leyenda = provConDatos.map(p =>
    `<div class="legend-item"><div class="legend-line" style="background:${COLORES_PROV[p]}"></div>${p}</div>`
  ).join('');

  return `
    <svg width="100%" viewBox="0 0 ${W} ${H+18}" style="overflow:visible">${lineas}${labels}</svg>
    <div class="chart-legend" style="margin-top:8px">${leyenda}</div>`;
}

// ── Ranking ───────────────────────────────────────────────
function renderRanking(ranking) {
  if (!ranking?.length) return '<p style="color:var(--tl);font-size:13px">Sin datos</p>';
  const maxTN = ranking[0]?.tnPET || 1;
  const filas = ranking.map(c => `
    <tr>
      <td style="font-weight:700;color:var(--b1)">${c.ranking}</td>
      <td>${c.nombre}</td>
      <td>${nivelBadge(c.nivel)}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="ranking-bar-bg"><div class="ranking-bar-fill" style="width:${(c.tnPET/maxTN)*100}%"></div></div>
          <span style="font-size:11.5px;font-weight:600;white-space:nowrap">${fmtNum(c.tnPET)} TN</span>
        </div>
      </td>
      <td style="font-size:12px;color:var(--tm)">$${fmtNum(c.precioPETprom,2)}/kg</td>
    </tr>`).join('');

  return `<div class="table-wrap"><table>
    <thead><tr><th>#</th><th>Comprador</th><th>Nivel</th><th>TN PET</th><th>Precio prom.</th></tr></thead>
    <tbody>${filas}</tbody>
  </table></div>`;
}

// ============================================================
// HISTÓRICO
// ============================================================

async function renderHistorico() {
  document.getElementById('dash-tab-content').innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;padding:40px;gap:16px">
      <div class="spinner"></div><span style="color:var(--tm)">Cargando histórico...</span>
    </div>`;

  try {
    const res = await apiGet({ action: 'getHistorico' });
    if (!res.ok) { showToast('Error cargando histórico'); return; }
    const h = res.data;

    document.getElementById('dash-tab-content').innerHTML = `
      <div style="background:#fff;border-radius:var(--radius-md);padding:10px 16px;border:1px solid var(--border);text-align:center">
        <div style="font-size:11px;font-weight:700;color:var(--b1);text-transform:uppercase;letter-spacing:.06em">
          Ficha de información primaria comercial histórica de materiales priorizables
        </div>
      </div>
      <div class="dash-hist-grid">
        ${renderBarrasAnio(h.anios, h.porAnio, 'PET', '#5bbd70')}
        ${renderBarrasAnio(h.anios, h.porAnio, 'Suave', '#0778bf')}
        ${renderBarrasAnio(h.anios, h.porAnio, 'Duro', '#079fff')}
      </div>
      <div class="card">
        <div class="card-title">TN PET por provincia · evolución histórica</div>
        ${renderLineHistorico(h.anios, h.porProvAnio)}
      </div>`;
  } catch(e) {
    console.error(e);
    showToast('Error cargando histórico');
  }
}

function renderBarrasAnio(anios, porAnio, material, color) {
  if (!anios?.length) return `<div class="card"><div class="card-title">TN ${material}</div><p style="color:var(--tl)">Sin datos</p></div>`;
  const H  = 90;
  const maxVal = Math.max(...anios.map(a => porAnio[a]?.[material] || 0), 1);
  const titulo = material === 'Suave' ? 'Plástico suave' : material === 'Duro' ? 'Plástico duro' : 'PET';

  const grupos = anios.map(a => {
    const val = porAnio[a]?.[material] || 0;
    const h   = (val / maxVal) * H;
    return `
      <div style="display:flex;flex-direction:column;align-items:center;gap:3px">
        <div style="height:${H}px;display:flex;align-items:flex-end">
          <div style="width:18px;height:${h}px;border-radius:3px 3px 0 0;background:${color}"></div>
        </div>
        <div style="font-size:8.5px;color:var(--tl)">${a}</div>
        <div style="font-size:9.5px;font-weight:600;color:var(--b1)">${fmtNum(val,0)}</div>
      </div>`;
  }).join('');

  return `
    <div class="card">
      <div class="card-title">TN ${titulo}</div>
      <div style="display:flex;align-items:flex-end;gap:12px;justify-content:center;flex-wrap:wrap">${grupos}</div>
    </div>`;
}

function renderLineHistorico(anios, porProvAnio) {
  if (!anios || anios.length < 2) return '<p style="color:var(--tl);font-size:13px">Se necesitan al menos 2 años de datos</p>';
  const W = 500, H = 90;
  const stepX = W / (anios.length - 1);
  const provConDatos = PROVINCIAS.filter(p => anios.some(a => (porProvAnio[p]?.[a] || 0) > 0));

  let max = 0;
  provConDatos.forEach(p => anios.forEach(a => { if ((porProvAnio[p]?.[a]||0) > max) max = porProvAnio[p][a]; }));
  if (max === 0) max = 1;

  const lineas = provConDatos.map(p => {
    const pts = anios.map((a,i) => `${i*stepX},${H - ((porProvAnio[p]?.[a]||0)/max)*(H-8)-4}`).join(' ');
    const dots = anios.map((a,i) => `<circle cx="${i*stepX}" cy="${H-((porProvAnio[p]?.[a]||0)/max)*(H-8)-4}" r="3.5" fill="${COLORES_PROV[p]}"/>`).join('');
    return `<polyline points="${pts}" fill="none" stroke="${COLORES_PROV[p]}" stroke-width="2" stroke-linejoin="round"/>${dots}`;
  }).join('');

  const labels = anios.map((a,i) =>
    `<text x="${i*stepX}" y="${H+14}" font-size="9" fill="#9aafbe" text-anchor="middle">${a}</text>`
  ).join('');

  const leyenda = provConDatos.map(p =>
    `<div class="legend-item"><div class="legend-line" style="background:${COLORES_PROV[p]}"></div>${p}</div>`
  ).join('');

  return `
    <svg width="100%" viewBox="0 0 ${W} ${H+20}" style="overflow:visible">${lineas}${labels}</svg>
    <div class="chart-legend" style="margin-top:10px">${leyenda}</div>`;
}
