// dashboard.js
// ============================================================
// ============================================================
// RECIRCULA 360 — dashboard.js
// Dashboard ambiental — Chart.js Canvas
// ============================================================

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const PROVINCIAS = ['El Oro','Guayas','Manabí','Sucumbíos','Pichincha','Chimborazo'];
const COLORES_PROV = {
  'El Oro':     '#33A8DE', 'Guayas':    '#00bda4',
  'Manabí':     '#506CFF', 'Sucumbíos': '#F5AD21',
  'Pichincha':  '#9FDA60', 'Chimborazo':'#FF376F',
};

// Metas editables
let METAS = { PET: 811, Suave: 248, Duro: 377 };

// Materiales que aparecen en torta
const MATS_TORTA = ['PET','Plástico Duro','Plástico Suave','Cartón','Lata/Aluminio','Vidrio'];
let MATS_FILTRO_ACTIVOS = [...MATS_TORTA];

// Charts activos
let chartTorta = null;
let chartLineas = null;

// Estado filtros
let DASH_FILTROS = { anio: '', mes: '', provincia: '', ciudad: '', asociacion: '' };
let DASH_DATA    = null;

// ============================================================
// RENDER PRINCIPAL
// ============================================================

async function renderDashboard() {
  const content = document.getElementById('main-content');

  // Cargar Chart.js si no está
  if (typeof Chart === 'undefined') {
    await new Promise(resolve => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
      s.onload = resolve;
      document.head.appendChild(s);
    });
  }

  content.innerHTML = `
    <!-- Filtros superiores -->
    <div class="filters-bar">
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
      <select class="filter-select-sm" id="f-asociacion" onchange="aplicarFiltro('asociacion',this.value)">
        <option value="">Todas las asociaciones</option>
        ${CAT.asociaciones.map(a => `<option value="${a['ID_Asociacion']}">${a['Nombre']}</option>`).join('')}
      </select>
      <button class="btn-reset-filters" onclick="resetFiltros()">
        <i class="ti ti-x"></i> Limpiar
      </button>
      <div class="filter-divider"></div>
      <button class="btn btn-glass btn-sm" onclick="abrirTopCompradores()">
        <i class="ti ti-trophy"></i> Top compradores
      </button>
      <button class="btn btn-glass btn-sm" onclick="abrirTopAsociaciones()">
        <i class="ti ti-building-community"></i> Top asociaciones
      </button>
    </div>

    <!-- Contenido -->
    <div id="dash-content">
      <div style="display:flex;align-items:center;justify-content:center;padding:60px;gap:16px">
        <div class="spinner"></div>
        <span style="color:var(--tm)">Cargando dashboard...</span>
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
    renderContenidoDashboard();
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
}

function aplicarFiltro(campo, valor) {
  DASH_FILTROS[campo] = valor;
  cargarDashboard();
}

function resetFiltros() {
  DASH_FILTROS = { anio: '', mes: '', provincia: '', ciudad: '', asociacion: '' };
  ['f-anio','f-mes','f-provincia','f-asociacion'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  cargarDashboard();
}

// ============================================================
// RENDER CONTENIDO
// ============================================================

function renderContenidoDashboard() {
  const d = DASH_DATA;
  const k = d.kpis;
  const pctPET   = METAS.PET   > 0 ? Math.min((k.tnPET   / METAS.PET)   * 100, 150) : 0;
  const pctSuave = METAS.Suave > 0 ? Math.min((k.tnSuave / METAS.Suave) * 100, 150) : 0;
  const pctDuro  = METAS.Duro  > 0 ? Math.min((k.tnDuro  / METAS.Duro)  * 100, 150) : 0;

  // Destruir charts anteriores
  if (chartTorta)  { chartTorta.destroy();  chartTorta  = null; }
  if (chartLineas) { chartLineas.destroy(); chartLineas = null; }

  document.getElementById('dash-content').innerHTML = `
    <!-- KPIs -->
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

    <!-- Fila gráficos -->
    <div class="dash-charts-row">

      <!-- Torta -->
      <div class="card">
        <div class="card-title">
          TN recuperadas por material
          <button class="btn btn-glass btn-sm" onclick="abrirFiltroMateriales()" title="Filtrar materiales">
            <i class="ti ti-filter"></i>
          </button>
        </div>
        <div style="position:relative;height:220px">
          <canvas id="chart-torta"></canvas>
        </div>
      </div>

      <!-- Cilindros avance vs meta -->
      <div class="card">
        <div class="card-title">
          Avance vs meta anual
          <button class="btn btn-glass btn-sm" onclick="abrirEditarMetas()" title="Editar metas">
            <i class="ti ti-settings"></i>
          </button>
        </div>
        <div class="cylinders-wrap">
          ${renderCilindro('PET', k.tnPET, METAS.PET, pctPET, 'linear-gradient(180deg,#506CFF,#33A8DE)')}
          ${renderCilindro('Duro', k.tnDuro, METAS.Duro, pctDuro, 'linear-gradient(180deg,#0BC3FF,#18AE97)')}
          ${renderCilindro('Suave', k.tnSuave, METAS.Suave, pctSuave, 'linear-gradient(180deg,#9FDA60,#18AE97)')}
        </div>
      </div>

      <!-- Líneas por provincia -->
      <div class="card">
        <div class="card-title">TN PET mensual por provincia</div>
        <div style="position:relative;height:200px">
          <canvas id="chart-lineas"></canvas>
        </div>
      </div>

    </div>
  `;

  // Inicializar Chart.js
  setTimeout(() => {
    initChartTorta(d.distribucion);
    initChartLineas(d.porProvMes, d.meses);
  }, 50);
}

// ============================================================
// CHART: TORTA
// ============================================================

function initChartTorta(distribucion) {
  const ctx = document.getElementById('chart-torta');
  if (!ctx) return;

  const colores = {
    'PET': '#33A8DE', 'Plástico Duro': '#506CFF', 'Plástico Suave': '#18AE97',
    'Cartón': '#F5AD21', 'Lata/Aluminio': '#0BC3FF', 'Vidrio': '#9FDA60',
    'Otros materiales': '#D0D0D8',
  };

  // Agrupar según filtro activo
  const labels = [], datos = [], bgs = [];
  let otros = 0;

  Object.entries(distribucion).forEach(([nombre, val]) => {
    if (val <= 0) return;
    const nombreTorta = nombre === 'Lata/Aluminio' ? 'Lata/Aluminio' : nombre;
    if (MATS_FILTRO_ACTIVOS.includes(nombreTorta)) {
      labels.push(nombre);
      datos.push(parseFloat(val.toFixed(2)));
      bgs.push(colores[nombreTorta] || '#ccc');
    } else {
      otros += val;
    }
  });

  if (otros > 0) {
    labels.push('Otros materiales');
    datos.push(parseFloat(otros.toFixed(2)));
    bgs.push(colores['Otros materiales']);
  }

  chartTorta = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: datos, backgroundColor: bgs, borderWidth: 2, borderColor: '#fff' }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { font: { family: 'Outfit', size: 11 }, padding: 12, boxWidth: 12 } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${fmtNum(ctx.raw)} TN`
          }
        }
      },
      cutout: '60%',
    }
  });
}

// ============================================================
// CHART: LÍNEAS POR PROVINCIA
// ============================================================

function initChartLineas(porProvMes, meses) {
  const ctx = document.getElementById('chart-lineas');
  if (!ctx) return;

  const provConDatos = PROVINCIAS.filter(p => meses.some(m => (porProvMes[p]?.[m] || 0) > 0));
  if (!provConDatos.length) {
    ctx.parentElement.innerHTML = '<p style="color:var(--tl);font-size:13px;padding:20px">Sin datos por provincia</p>';
    return;
  }

  const datasets = provConDatos.map(p => ({
    label: p,
    data: meses.map(m => parseFloat((porProvMes[p]?.[m] || 0).toFixed(2))),
    borderColor: COLORES_PROV[p],
    backgroundColor: COLORES_PROV[p] + '20',
    borderWidth: 2,
    tension: 0.3,
    pointRadius: 3,
    pointHoverRadius: 5,
    fill: false,
  }));

  chartLineas = new Chart(ctx, {
    type: 'line',
    data: { labels: meses.map(m => m.substring(0,3)), datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { family: 'Outfit', size: 10 }, padding: 8, boxWidth: 10 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmtNum(ctx.raw)} TN` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { family: 'Outfit', size: 10 } } },
        y: { grid: { color: '#f0f4f8' }, ticks: { font: { family: 'Outfit', size: 10 } } }
      }
    }
  });
}

// ============================================================
// CILINDROS (mantener SVG — son únicos)
// ============================================================

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

// ============================================================
// FILTRO DE MATERIALES (multi-select)
// ============================================================

function abrirFiltroMateriales() {
  const todosLosMats = ['PET','Plástico Duro','Plástico Suave','Cartón','Lata/Aluminio','Vidrio',
    'Chatarra','Cobre','Papel Archivo','Periódico','Soplado','Tetrapak','Suela','Bronce','Batería','Acero'];

  const checks = todosLosMats.map(m => `
    <label style="display:flex;align-items:center;gap:8px;padding:7px 0;cursor:pointer;font-size:13px">
      <input type="checkbox" value="${m}" ${MATS_FILTRO_ACTIVOS.includes(m)?'checked':''}>
      ${m}
    </label>`).join('');

  abrirModal(`
    <div class="modal" style="max-width:380px">
      <div class="modal-head">
        <div class="modal-title">Filtrar materiales en gráfico</div>
        <button class="modal-close" onclick="cerrarModal()"><i class="ti ti-x"></i></button>
      </div>
      <div class="modal-body">
        <div style="display:flex;gap:8px;margin-bottom:14px">
          <button class="btn btn-glass btn-sm" onclick="selTodosMats(true)">Todos</button>
          <button class="btn btn-glass btn-sm" onclick="selTodosMats(false)">Ninguno</button>
        </div>
        <div id="mats-checks">${checks}</div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-glass" onclick="cerrarModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="aplicarFiltroMateriales()">
          <i class="ti ti-check"></i> Aplicar
        </button>
      </div>
    </div>
  `);
}

function selTodosMats(todos) {
  document.querySelectorAll('#mats-checks input[type=checkbox]').forEach(cb => cb.checked = todos);
}

function aplicarFiltroMateriales() {
  MATS_FILTRO_ACTIVOS = [...document.querySelectorAll('#mats-checks input:checked')].map(cb => cb.value);
  cerrarModal();
  if (DASH_DATA) {
    if (chartTorta) { chartTorta.destroy(); chartTorta = null; }
    initChartTorta(DASH_DATA.distribucion);
  }
}

// ============================================================
// EDITAR METAS
// ============================================================

function abrirEditarMetas() {
  abrirModal(`
    <div class="modal" style="max-width:380px">
      <div class="modal-head">
        <div class="modal-title">Editar metas anuales</div>
        <button class="modal-close" onclick="cerrarModal()"><i class="ti ti-x"></i></button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Meta PET (TN)</label>
          <input type="number" class="form-input" id="meta-pet" value="${METAS.PET}" min="0">
        </div>
        <div class="form-group">
          <label class="form-label">Meta Plástico Suave (TN)</label>
          <input type="number" class="form-input" id="meta-suave" value="${METAS.Suave}" min="0">
        </div>
        <div class="form-group">
          <label class="form-label">Meta Plástico Duro (TN)</label>
          <input type="number" class="form-input" id="meta-duro" value="${METAS.Duro}" min="0">
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-glass" onclick="cerrarModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="guardarMetas()">
          <i class="ti ti-check"></i> Guardar
        </button>
      </div>
    </div>
  `);
}

function guardarMetas() {
  METAS.PET   = parseFloat(document.getElementById('meta-pet')?.value)   || METAS.PET;
  METAS.Suave = parseFloat(document.getElementById('meta-suave')?.value) || METAS.Suave;
  METAS.Duro  = parseFloat(document.getElementById('meta-duro')?.value)  || METAS.Duro;
  cerrarModal();
  showToast('Metas actualizadas ✓');
  if (DASH_DATA) renderContenidoDashboard();
}

// ============================================================
// TOP COMPRADORES
// ============================================================

function abrirTopCompradores() {
  if (!DASH_DATA?.ranking?.length) { showToast('Sin datos de compradores'); return; }
  const maxTN = DASH_DATA.ranking[0]?.tnPET || 1;
  const filas = DASH_DATA.ranking.map(c => `
    <tr>
      <td style="font-weight:700;color:var(--b1)">${c.ranking}</td>
      <td style="font-weight:500">${c.nombre}</td>
      <td>${nivelBadge(c.nivel)}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="ranking-bar-bg"><div class="ranking-bar-fill" style="width:${(c.tnPET/maxTN)*100}%"></div></div>
          <span style="font-size:11.5px;font-weight:600;white-space:nowrap">${fmtNum(c.tnPET)} TN</span>
        </div>
      </td>
      <td style="font-size:12px;color:var(--tm)">$${fmtNum(c.precioPETprom,2)}/kg</td>
    </tr>`).join('');

  abrirModal(`
    <div class="modal" style="max-width:680px">
      <div class="modal-head">
        <div class="modal-title"><i class="ti ti-trophy"></i> Top compradores · PET</div>
        <button class="modal-close" onclick="cerrarModal()"><i class="ti ti-x"></i></button>
      </div>
      <div class="modal-body" style="padding:0">
        <div class="table-wrap" style="border:none;border-radius:0">
          <table>
            <thead><tr><th>#</th><th>Comprador</th><th>Nivel</th><th>TN PET</th><th>Precio prom.</th></tr></thead>
            <tbody>${filas}</tbody>
          </table>
        </div>
      </div>
    </div>
  `);
}

// ============================================================
// TOP ASOCIACIONES
// ============================================================

function abrirTopAsociaciones() {
  if (!DASH_DATA) { showToast('Sin datos'); return; }

  // Calcular TN por asociación desde las entregas
  const ranking = DASH_DATA.colectivos.map(nombre => {
    return { nombre };
  });

  // Si no hay datos de ranking por asociación, mostrar lista simple
  const items = DASH_DATA.colectivos.map((nombre, i) => `
    <tr>
      <td style="font-weight:700;color:var(--b1)">${i+1}</td>
      <td style="font-weight:500">${nombre}</td>
    </tr>`).join('');

  abrirModal(`
    <div class="modal" style="max-width:500px">
      <div class="modal-head">
        <div class="modal-title"><i class="ti ti-building-community"></i> Top asociaciones</div>
        <button class="modal-close" onclick="cerrarModal()"><i class="ti ti-x"></i></button>
      </div>
      <div class="modal-body" style="padding:0">
        <div class="table-wrap" style="border:none;border-radius:0">
          <table>
            <thead><tr><th>#</th><th>Asociación</th></tr></thead>
            <tbody>${items}</tbody>
          </table>
        </div>
      </div>
    </div>
  `);
}


// ============================================================
