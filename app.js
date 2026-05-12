// ============================================================
// app.js - RECIRCULA 360 COMPLETO (PARTE 1)
// ============================================================

// ==================== CONSTANTES ====================
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzoOqPPbbOGh894CiDXny-8l44vp7JhluXcdORGz6s4dx_JDgOSX2ZXsPpGxfBJ59XK/exec';
const G_CLIENT_ID = '783730193199-d7nhahv3ou4rmps7nrpoop5cpor079ej.apps.googleusercontent.com';
const DOMAIN = 'redesconrostro.org';
const DRIVE_FOLDER_ROOT = '1AQyBa9AAdVzukBaZxWa7jpSN2DYkoFhv';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const PROVINCIAS = ['El Oro','Guayas','Manabí','Sucumbíos','Pichincha','Chimborazo'];
const COLORES_PROV = {
  'El Oro': '#002343',
  'Guayas': '#00bda4',
  'Manabí': '#079fff',
  'Sucumbíos': '#f5ad21',
  'Pichincha': '#9fda60',
  'Chimborazo': '#f82d72'
};
const METAS = { PET: 811, Suave: 248, Duro: 377 };

// ==================== ESTADO GLOBAL ====================
let SESSION = null;
let ACCESS_TOKEN = null;
let TOKEN_EXPIRY = 0;

let CAT = { asociaciones: [], compradores: [], materiales: [], accesos: [], todasAsociaciones: [] };
let ENTREGAS_DATA = [];
let ENTREGAS_FILTROS = { anio: '', mes: '', asociacion: '' };
let ASOC_DATA = [];
let ASOC_BUSCAR = '';
let ASOC_ESTADO = '';
let ACCESOS_CAT_ACTIVA = 'Todos';
let CONFIG_TAB = 'usuarios';
let USUARIOS_DATA = [];
let DASH_FILTROS = { anio: '', mes: '', provincia: '', ciudad: '', asociacion: '' };
let DASH_DATA = null;
let DASH_TAB = 'operativo';

// ==================== FUNÇÕES DE CACHE ====================
const CACHE_TTL = 30 * 60 * 1000; // 30 minutos
function cacheSet(key, data) {
  try { localStorage.setItem('rcr_'+key, JSON.stringify({ data, ts: Date.now() })); } catch(e) {}
}
function cacheGet(key) {
  try {
    const raw = localStorage.getItem('rcr_'+key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) {
      localStorage.removeItem('rcr_'+key);
      return null;
    }
    return data;
  } catch(e) { return null; }
}
function cacheClear(key) { try { localStorage.removeItem('rcr_'+key); } catch(e) {} }
function invalidarCache() {
  cacheClear('cat_todos');
  cacheClear('entregas');
  cacheClear('asociaciones');
  cacheClear('dashboard');
}

// ==================== API HELPERS ====================
async function apiGet(params) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(SCRIPT_URL + '?' + qs);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}
async function apiPost(body) {
  const res = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify(body) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

// ==================== SUBIR ARQUIVOS CONCORRENTES ====================
async function subirArchivosConcurrente(files, folderId, onProgress) {
  const CONCURRENCIA = 3;
  for (let i = 0; i < files.length; i += CONCURRENCIA) {
    const lote = files.slice(i, i + CONCURRENCIA);
    await Promise.all(lote.map(async (file) => {
      const form = new FormData();
      const metadata = { name: file.name, parents: [folderId] };
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', file);
      await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + ACCESS_TOKEN },
        body: form
      });
    }));
    if (onProgress) onProgress(Math.min(i + CONCURRENCIA, files.length), files.length);
  }
}

// ==================== FUNÇÕES UI E FORMATAÇÃO ====================
function fmtNum(n, dec = 2) {
  if (!n && n !== 0) return '—';
  return parseFloat(n).toLocaleString('es-EC', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function fmtMoney(n) {
  if (!n && n !== 0) return '—';
  return '$' + parseFloat(n).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtTN(n) {
  if (!n && n !== 0) return '—';
  return fmtNum(n) + ' TN';
}
function fmtFecha(f) {
  if (!f) return '—';
  const d = new Date(f);
  if (isNaN(d)) return f;
  return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
}
function nivelBadge(nivel) {
  const map = {
    'Nivel 1': 'badge-blue',
    'Nivel 2': 'badge-green',
    'Nivel 3': 'badge-warn',
    'Transformador': 'badge-cyan'
  };
  const cls = map[nivel] || 'badge-blue';
  return `<span class="badge ${cls}">${nivel || '—'}</span>`;
}
function debounce(fn, delay) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}
function mostrarLogin() {
  document.getElementById('screen-login').classList.remove('hidden');
  document.getElementById('screen-loading').classList.add('hidden');
  document.getElementById('screen-app').classList.add('hidden');
}
function mostrarLoading() {
  document.getElementById('screen-login').classList.add('hidden');
  document.getElementById('screen-loading').classList.remove('hidden');
  document.getElementById('screen-app').classList.add('hidden');
}
function mostrarApp() {
  document.getElementById('screen-login').classList.add('hidden');
  document.getElementById('screen-loading').classList.add('hidden');
  document.getElementById('screen-app').classList.remove('hidden');
}
function showToast(msg, dur = 3500) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), dur);
}
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}
function cerrarModal() {
  const m = document.getElementById('modal-overlay');
  if (m) m.remove();
}
function abrirModal(html) {
  cerrarModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modal-overlay';
  overlay.innerHTML = html;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrarModal(); });
  document.body.appendChild(overlay);
}
// ============================================================
// PARTE 2: LOGIN, SESIÓN, NAVEGACIÓN Y CATÁLOGOS
// ============================================================

// ==================== LOGIN / OAUTH ====================
function iniciarLogin() {
  const client = google.accounts.oauth2.initTokenClient({
    client_id: G_CLIENT_ID,
    scope: 'email profile https://www.googleapis.com/auth/drive.file',
    callback: async (resp) => {
      if (resp.error) { showToast('Error al iniciar sesión'); return; }
      ACCESS_TOKEN = resp.access_token;
      TOKEN_EXPIRY = Date.now() + (resp.expires_in - 60) * 1000;
      await verificarUsuario();
    }
  });
  client.requestAccessToken();
}

async function verificarUsuario() {
  mostrarLoading();
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: 'Bearer ' + ACCESS_TOKEN }
    });
    const info = await res.json();
    if (!info.email.endsWith('@' + DOMAIN)) {
      showToast('Solo cuentas @' + DOMAIN);
      mostrarLogin();
      return;
    }
    const data = await apiGet({ action: 'getUsuario', email: info.email });
    if (!data.ok) {
      showToast('Usuario no autorizado. Contacta al administrador.');
      mostrarLogin();
      return;
    }
    SESSION = {
      nombre: data.data.nombre || info.given_name,
      email: info.email,
      rol: data.data.rol,
      foto: info.picture
    };
    sessionStorage.setItem('rcr_session', JSON.stringify(SESSION));
    sessionStorage.setItem('rcr_token', ACCESS_TOKEN);
    sessionStorage.setItem('rcr_token_exp', TOKEN_EXPIRY);
    await iniciarApp();
  } catch (e) {
    console.error(e);
    showToast('Error de conexión. Intenta de nuevo.');
    mostrarLogin();
  }
}

function recuperarSesion() {
  const s = sessionStorage.getItem('rcr_session');
  const t = sessionStorage.getItem('rcr_token');
  const exp = sessionStorage.getItem('rcr_token_exp');
  if (s && t && exp && Date.now() < parseInt(exp)) {
    SESSION = JSON.parse(s);
    ACCESS_TOKEN = t;
    TOKEN_EXPIRY = parseInt(exp);
    return true;
  }
  return false;
}

function cerrarSesion() {
  sessionStorage.clear();
  invalidarCache();
  SESSION = null;
  ACCESS_TOKEN = null;
  CAT = { asociaciones: [], compradores: [], materiales: [], accesos: [], todasAsociaciones: [] };
  mostrarLogin();
  try { google.accounts.id.disableAutoSelect(); } catch(e) {}
}

// ==================== INICIAR APP ====================
async function iniciarApp() {
  const iniciales = SESSION.nombre
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
  document.getElementById('user-avatar').textContent = iniciales;
  document.getElementById('user-name').textContent = SESSION.nombre;
  document.getElementById('user-role').textContent = SESSION.rol;
  if (SESSION.rol === 'Admin') {
    document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
  }
  await cargarCatalogos();
  mostrarApp();
  navTo('dashboard');
}

// ==================== CATÁLOGOS (CON CACHÉ) ====================
async function cargarCatalogos() {
  const cached = cacheGet('cat_todos');
  if (cached) {
    CAT = cached;
    return;
  }
  await actualizarCatalogos();
}

async function actualizarCatalogos() {
  try {
    const res = await apiGet({ action: 'getCatalogos', rol: SESSION.rol });
    if (res.ok) {
      CAT = res.data;
      cacheSet('cat_todos', res.data);
    }
  } catch (e) {
    console.error('Error actualizando catálogos:', e);
  }
}

// ==================== NAVEGACIÓN ====================
function navTo(seccion) {
  // En móvil: cerrar sidebar automáticamente
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.remove('open');
  }
  document.querySelectorAll('.sb-item').forEach(el => el.classList.remove('active'));
  const navEl = document.getElementById('nav-' + seccion);
  if (navEl) navEl.classList.add('active');

  const titulos = {
    dashboard: 'Dashboard ambiental',
    entregas: 'Entregas',
    asociaciones: 'Asociaciones',
    accesos: 'Accesos',
    configuracion: 'Configuración'
  };
  document.getElementById('topbar-title').textContent = titulos[seccion] || seccion;
  document.getElementById('topbar-sub').innerHTML =
    seccion === 'dashboard' ? 'Bienvenido, ' + SESSION.nombre.split(' ')[0] + ' 👋' : '';

  document.getElementById('main-content').innerHTML = '';
  document.getElementById('topbar-actions').innerHTML = '';

  switch (seccion) {
    case 'dashboard':
      renderDashboard();
      break;
    case 'entregas':
      renderEntregas();
      break;
    case 'asociaciones':
      renderAsociaciones();
      break;
    case 'accesos':
      renderAccesos();
      break;
    case 'configuracion':
      renderConfiguracion();
      break;
    default:
      document.getElementById('main-content').innerHTML = '<div class="card"><p>Sección no encontrada.</p></div>';
  }
}
// ============================================================
// PARTE 3: DASHBOARD COMPLETO (OPERATIVO + HISTÓRICO)
// ============================================================

// ==================== DASHBOARD PRINCIPAL ====================
async function renderDashboard() {
  const content = document.getElementById('main-content');
  content.innerHTML = `
    <div class="filters-bar" id="dash-filters">
      <span class="filter-label-inline"><i class="ti ti-adjustments-horizontal"></i> Filtros</span>
      <div class="filter-divider"></div>
      <select class="filter-select-sm" id="f-anio" onchange="aplicarFiltro('anio',this.value)"><option value="">Todos los años</option></select>
      <select class="filter-select-sm" id="f-mes" onchange="aplicarFiltro('mes',this.value)"><option value="">Todos los meses</option>${MESES.map(m => `<option value="${m}">${m}</option>`).join('')}</select>
      <select class="filter-select-sm" id="f-provincia" onchange="aplicarFiltro('provincia',this.value)"><option value="">Todas las provincias</option>${PROVINCIAS.map(p => `<option value="${p}">${p}</option>`).join('')}</select>
      <select class="filter-select-sm" id="f-ciudad" onchange="aplicarFiltro('ciudad',this.value)"><option value="">Todas las ciudades</option></select>
      <select class="filter-select-sm" id="f-asociacion" onchange="aplicarFiltro('asociacion',this.value)"><option value="">Todas las asociaciones</option>${CAT.asociaciones.map(a => `<option value="${a.ID_Asociacion}">${a.Nombre}</option>`).join('')}</select>
      <button class="btn-reset-filters" onclick="resetFiltros()"><i class="ti ti-x"></i> Limpiar</button>
    </div>
    <div class="tabs-bar">
      <button class="tab-btn active" id="tab-operativo" onclick="switchDashTab('operativo')"><i class="ti ti-chart-bar"></i> Operativo</button>
      <button class="tab-btn" id="tab-historico" onclick="switchDashTab('historico')"><i class="ti ti-history"></i> Histórico</button>
    </div>
    <div id="dash-tab-content"><div style="display:flex;justify-content:center;padding:60px"><div class="spinner"></div></div></div>
  `;
  await cargarDashboard();
}

async function cargarDashboard() {
  try {
    const cacheKey = 'dashboard_' + JSON.stringify(DASH_FILTROS);
    const cached = cacheGet(cacheKey);
    if (cached) {
      DASH_DATA = cached;
      renderDashTab();
      return;
    }
    const res = await apiGet({ action: 'getDashboard', ...DASH_FILTROS });
    if (res.ok) {
      DASH_DATA = res.data;
      cacheSet(cacheKey, res.data);
      renderDashTab();
      poblarFiltrosDisponibles(DASH_DATA.filtrosDisponibles);
    } else {
      showToast('Error cargando dashboard');
    }
  } catch (e) {
    showToast('Error de conexión');
  }
}

function poblarFiltrosDisponibles(f) {
  if (!f) return;
  const selAnio = document.getElementById('f-anio');
  if (selAnio && f.anios) {
    const cur = DASH_FILTROS.anio;
    selAnio.innerHTML = '<option value="">Todos los años</option>' +
      f.anios.map(a => `<option value="${a}" ${a === cur ? 'selected' : ''}>${a}</option>`).join('');
  }
  const selCiudad = document.getElementById('f-ciudad');
  if (selCiudad && f.ciudades) {
    const cur = DASH_FILTROS.ciudad;
    selCiudad.innerHTML = '<option value="">Todas las ciudades</option>' +
      f.ciudades.map(c => `<option value="${c}" ${c === cur ? 'selected' : ''}>${c}</option>`).join('');
  }
}

function aplicarFiltro(campo, valor) {
  DASH_FILTROS[campo] = valor;
  cargarDashboard();
}

function resetFiltros() {
  DASH_FILTROS = { anio: '', mes: '', provincia: '', ciudad: '', asociacion: '' };
  ['f-anio', 'f-mes', 'f-provincia', 'f-ciudad', 'f-asociacion'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  cargarDashboard();
}

function switchDashTab(tab) {
  DASH_TAB = tab;
  document.getElementById('tab-operativo').className = 'tab-btn' + (tab === 'operativo' ? ' active' : '');
  document.getElementById('tab-historico').className = 'tab-btn' + (tab === 'historico' ? ' active' : '');
  renderDashTab();
}

function renderDashTab() {
  if (!DASH_DATA) return;
  if (DASH_TAB === 'operativo') renderOperativo();
  else renderHistorico();
}

// ==================== OPERATIVO ====================
function renderOperativo() {
  const d = DASH_DATA;
  const k = d.kpis;
  const pctPET = METAS.PET > 0 ? Math.min((k.tnPET / METAS.PET) * 100, 100) : 0;
  const pctSuave = METAS.Suave > 0 ? Math.min((k.tnSuave / METAS.Suave) * 100, 100) : 0;
  const pctDuro = METAS.Duro > 0 ? Math.min((k.tnDuro / METAS.Duro) * 100, 100) : 0;

  document.getElementById('dash-tab-content').innerHTML = `
    <div class="kpi-grid">
      <div class="kpi-card"><div class="kpi-label">Total TN recuperadas</div><div class="kpi-value">${fmtNum(k.totalTN)} <span class="kpi-unit">TN</span></div><div class="kpi-note">Todos los materiales</div></div>
      <div class="kpi-card"><div class="kpi-label">TN priorizables</div><div class="kpi-value">${fmtNum(k.tnPriorizables)} <span class="kpi-unit">TN</span></div><div class="kpi-note">PET + Suave + Duro</div></div>
      <div class="kpi-card"><div class="kpi-label">Ingresos venta PET</div><div class="kpi-value">${fmtMoney(k.ingresosPET)}</div><div class="kpi-note">Valor generado</div></div>
    </div>

    <div class="dash-charts-row">
      <div class="card"><div class="card-title">TN recuperadas por material</div>${renderDonutCanvas(d.distribucion)}</div>
      <div class="card"><div class="card-title">Avance vs meta anual</div><div class="cylinders-wrap">${renderCilindro('PET', k.tnPET, METAS.PET, pctPET, 'linear-gradient(180deg,#0778bf,#002343)')}${renderCilindro('Duro', k.tnDuro, METAS.Duro, pctDuro, 'linear-gradient(180deg,#079fff,#86d2da)')}${renderCilindro('Suave', k.tnSuave, METAS.Suave, pctSuave, 'linear-gradient(180deg,#5bbd70,#00bda4)')}</div></div>
      <div class="card"><div class="card-title">TN PET mensual por provincia</div><canvas id="lineChartCanvas" width="400" height="180" style="width:100%;height:auto;max-width:400px"></canvas><div id="chartLegend"></div></div>
    </div>

    <div class="dash-bottom-row">
      <div class="card"><div class="card-title">Ranking compradores · PET <span class="card-tag">${d.ranking.length} compradores</span></div>${renderRanking(d.ranking)}</div>
      <div class="card"><div class="card-title">Colectivos beneficiarios <span class="card-tag">${d.colectivos.length} asociaciones</span></div><div class="asoc-grid">${d.colectivos.map(c => `<div class="asoc-chip" title="${c}">${c}</div>`).join('')}</div></div>
    </div>
  `;
  setTimeout(() => dibujarLineChart(d.porProvMes, d.meses), 50);
}

function renderDonutCanvas(dist) {
  const total = Object.values(dist).reduce((s, v) => s + (v || 0), 0);
  if (total === 0) return '<p style="color:var(--tl)">Sin datos</p>';
  const canvasId = 'donutCanvas_' + Date.now();
  setTimeout(() => {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.parentElement.clientWidth > 150 ? 150 : canvas.parentElement.clientWidth;
    canvas.width = w;
    canvas.height = w;
    const colores = {
      'PET': '#002343', 'Plástico Duro': '#079fff', 'Plástico Suave': '#00bda4',
      'Cartón': '#f5ad21', 'Lata/Aluminio': '#86d2da', 'Vidrio': '#5bbd70',
      'Chatarra': '#f82d72', 'Cobre': '#9fda60', 'Papel Archivo': '#0778bf',
      'Periódico': '#00bda4', 'Soplado': '#86d2da', 'Tetrapak': '#9fda60',
      'Suela': '#f5ad21', 'Bronce': '#5bbd70', 'Batería': '#002343', 'Acero': '#079fff'
    };
    let start = -Math.PI / 2;
    const entries = Object.entries(dist).filter(([, v]) => v > 0);
    for (let [nombre, valor] of entries) {
      const angulo = (valor / total) * 2 * Math.PI;
      ctx.beginPath();
      ctx.fillStyle = colores[nombre] || '#ccc';
      ctx.moveTo(w / 2, w / 2);
      ctx.arc(w / 2, w / 2, w / 2 - 10, start, start + angulo);
      ctx.fill();
      start += angulo;
    }
  }, 50);
  const colores = {
    'PET': '#002343', 'Plástico Duro': '#079fff', 'Plástico Suave': '#00bda4',
    'Cartón': '#f5ad21', 'Lata/Aluminio': '#86d2da', 'Vidrio': '#5bbd70',
    'Chatarra': '#f82d72', 'Cobre': '#9fda60', 'Papel Archivo': '#0778bf',
    'Periódico': '#00bda4', 'Soplado': '#86d2da', 'Tetrapak': '#9fda60',
    'Suela': '#f5ad21', 'Bronce': '#5bbd70', 'Batería': '#002343', 'Acero': '#079fff'
  };
  const leyenda = Object.entries(dist).filter(([, v]) => v > 0).map(([n, v]) => `<div class="legend-item"><div class="legend-dot" style="background:${colores[n] || '#ccc'}"></div>${n} · ${fmtNum(v)} TN</div>`).join('');
  return `<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap"><canvas id="${canvasId}" width="150" height="150" style="width:150px;height:150px;flex-shrink:0"></canvas><div class="chart-legend" style="flex-direction:column;gap:5px">${leyenda}</div></div>`;
}

function renderCilindro(nombre, actual, meta, pct, gradient) {
  const pctLabel = meta > 0 ? ((actual / meta) * 100).toFixed(0) + '%' : '—';
  return `<div class="cyl-item"><div class="cyl-pct">${pctLabel}</div><div class="cyl-outer"><div class="cyl-fill" style="height:${Math.min(pct, 100)}%;background:${gradient}"></div></div><div class="cyl-name">${nombre}</div><div style="font-size:9px;color:var(--tl)">${fmtNum(actual)} / ${meta} TN</div></div>`;
}

function renderRanking(ranking) {
  if (!ranking?.length) return '<p style="color:var(--tl)">Sin datos</p>';
  const maxTN = ranking[0]?.tnPET || 1;
  const filas = ranking.map(c => `
    <tr>
      <td style="font-weight:700">${c.ranking}</td>
      <td>${c.nombre}</td>
      <td>${nivelBadge(c.nivel)}</td>
      <td><div style="display:flex;align-items:center;gap:8px"><div class="ranking-bar-bg"><div class="ranking-bar-fill" style="width:${(c.tnPET / maxTN) * 100}%"></div></div><span style="font-size:11.5px;font-weight:600">${fmtNum(c.tnPET)} TN</span></div></td>
      <td>$${fmtNum(c.precioPETprom, 2)}/kg</td>
    </tr>`).join('');
  return `<div class="table-wrap"><table><thead><tr><th>#</th><th>Comprador</th><th>Nivel</th><th>TN PET</th><th>Precio prom.</th></tr></thead><tbody>${filas}</tbody></table></div>`;
}

function dibujarLineChart(porProvMes, meses) {
  const canvas = document.getElementById('lineChartCanvas');
  if (!canvas) return;
  requestAnimationFrame(() => {
    const ctx = canvas.getContext('2d');
    const w = canvas.clientWidth;
    const h = 180;
    if (w === 0) return;
    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    const provConDatos = PROVINCIAS.filter(p => meses.some(m => porProvMes[p]?.[m] > 0));
    if (!provConDatos.length) {
      ctx.fillStyle = 'var(--tl)';
      ctx.font = '12px Outfit';
      ctx.fillText('Sin datos', 10, 20);
      return;
    }
    let max = 0;
    provConDatos.forEach(p => meses.forEach(m => { if ((porProvMes[p]?.[m] || 0) > max) max = porProvMes[p][m]; }));
    if (max === 0) max = 1;
    const stepX = w / (meses.length - 1);
    provConDatos.forEach(p => {
      ctx.beginPath();
      ctx.strokeStyle = COLORES_PROV[p];
      ctx.lineWidth = 2;
      let first = true;
      meses.forEach((m, i) => {
        const x = i * stepX;
        const y = h - 10 - ((porProvMes[p]?.[m] || 0) / max) * (h - 20);
        if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
      });
      ctx.stroke();
      meses.forEach((m, i) => {
        const x = i * stepX;
        const y = h - 10 - ((porProvMes[p]?.[m] || 0) / max) * (h - 20);
        ctx.fillStyle = COLORES_PROV[p];
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, 2 * Math.PI);
        ctx.fill();
      });
    });
    ctx.fillStyle = '#9aafbe';
    ctx.font = '9px Outfit';
    for (let i = 0; i < meses.length; i += Math.ceil(meses.length / 6)) {
      ctx.fillText(meses[i].substring(0, 3), i * stepX - 8, h - 2);
    }
    const leyendaDiv = document.getElementById('chartLegend');
    if (leyendaDiv) {
      leyendaDiv.innerHTML = `<div class="chart-legend">${provConDatos.map(p => `<div class="legend-item"><div class="legend-line" style="background:${COLORES_PROV[p]}"></div>${p}</div>`).join('')}</div>`;
    }
  });
}

// ==================== HISTÓRICO ====================
async function renderHistorico() {
  document.getElementById('dash-tab-content').innerHTML = '<div style="text-align:center;padding:40px"><div class="spinner"></div></div>';
  try {
    const res = await apiGet({ action: 'getHistorico' });
    if (!res.ok) { showToast('Error histórico'); return; }
    const h = res.data;
    document.getElementById('dash-tab-content').innerHTML = `
      <div class="dash-hist-grid">
        ${renderBarrasAnio(h.anios, h.porAnio, 'PET', '#5bbd70')}
        ${renderBarrasAnio(h.anios, h.porAnio, 'Suave', '#0778bf')}
        ${renderBarrasAnio(h.anios, h.porAnio, 'Duro', '#079fff')}
      </div>
      <div class="card">
        <div class="card-title">TN PET por provincia · evolución histórica</div>
        <canvas id="histCanvas" width="500" height="200" style="width:100%;height:auto"></canvas>
        <div id="histLegend"></div>
      </div>`;
    setTimeout(() => dibujarHistoricoLine(h.anios, h.porProvAnio), 50);
  } catch (e) {
    showToast('Error cargando histórico');
  }
}

function renderBarrasAnio(anios, porAnio, material, color) {
  if (!anios?.length) return `<div class="card"><div class="card-title">TN ${material}</div><p>Sin datos</p></div>`;
  const maxVal = Math.max(...anios.map(a => porAnio[a]?.[material] || 0), 1);
  const titulo = material === 'Suave' ? 'Plástico suave' : (material === 'Duro' ? 'Plástico duro' : 'PET');
  return `<div class="card"><div class="card-title">TN ${titulo}</div><div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">${anios.map(a => {
    const val = porAnio[a]?.[material] || 0;
    const h = (val / maxVal) * 90;
    return `<div style="display:flex;flex-direction:column;align-items:center"><div style="height:90px;display:flex;align-items:flex-end"><div style="width:18px;height:${h}px;border-radius:3px 3px 0 0;background:${color}"></div></div><div style="font-size:8.5px;color:var(--tl)">${a}</div><div style="font-size:9.5px;font-weight:600">${fmtNum(val, 0)}</div></div>`;
  }).join('')}</div></div>`;
}

function dibujarHistoricoLine(anios, porProvAnio) {
  const canvas = document.getElementById('histCanvas');
  if (!canvas || !anios?.length) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.clientWidth;
  const h = 200;
  canvas.width = w;
  canvas.height = h;
  ctx.clearRect(0, 0, w, h);
  const provConDatos = PROVINCIAS.filter(p => anios.some(a => (porProvAnio[p]?.[a] || 0) > 0));
  if (!provConDatos.length) return;
  let max = 0;
  provConDatos.forEach(p => anios.forEach(a => { if ((porProvAnio[p]?.[a] || 0) > max) max = porProvAnio[p][a]; }));
  if (max === 0) max = 1;
  const stepX = w / (anios.length - 1);
  provConDatos.forEach(p => {
    ctx.beginPath();
    ctx.strokeStyle = COLORES_PROV[p];
    ctx.lineWidth = 2;
    let first = true;
    anios.forEach((a, i) => {
      const x = i * stepX;
      const y = h - 15 - ((porProvAnio[p]?.[a] || 0) / max) * (h - 25);
      if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
    });
    ctx.stroke();
    anios.forEach((a, i) => {
      const x = i * stepX;
      const y = h - 15 - ((porProvAnio[p]?.[a] || 0) / max) * (h - 25);
      ctx.fillStyle = COLORES_PROV[p];
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, 2 * Math.PI);
      ctx.fill();
    });
  });
  ctx.fillStyle = '#9aafbe';
  ctx.font = '9px Outfit';
  for (let i = 0; i < anios.length; i++) {
    ctx.fillText(anios[i], i * stepX - 8, h - 3);
  }
  const leg = document.getElementById('histLegend');
  if (leg) {
    leg.innerHTML = `<div class="chart-legend">${provConDatos.map(p => `<div class="legend-item"><div class="legend-line" style="background:${COLORES_PROV[p]}"></div>${p}</div>`).join('')}</div>`;
  }
}
// ============================================================
// PARTE 4: ENTREGAS, ASOCIACIONES, ACCESOS, CONFIGURACIÓN
// ============================================================

// ==================== ENTREGAS ====================
async function renderEntregas() {
  document.getElementById('topbar-actions').innerHTML = `
    <button class="btn btn-glass" onclick="verCompradoresModal()"><i class="ti ti-eye"></i> Ver compradores</button>
    <button class="btn btn-success" onclick="abrirFormCompradorUnificado()"><i class="ti ti-plus"></i> Nuevo comprador</button>
    <button class="btn btn-primary" onclick="abrirFormEntrega()"><i class="ti ti-plus"></i> Nueva entrega</button>
  `;
  const content = document.getElementById('main-content');
  content.innerHTML = `
    <div class="filters-bar">
      <span class="filter-label-inline"><i class="ti ti-adjustments-horizontal"></i> Filtros</span>
      <div class="filter-divider"></div>
      <select class="filter-select-sm" id="ef-anio" onchange="filtrarEntregas('anio',this.value)"><option value="">Todos los años</option></select>
      <select class="filter-select-sm" id="ef-mes" onchange="filtrarEntregas('mes',this.value)"><option value="">Todos los meses</option>${MESES.map(m => `<option value="${m}">${m}</option>`).join('')}</select>
      <select class="filter-select-sm" id="ef-asociacion" onchange="filtrarEntregas('asociacion',this.value)"><option value="">Todas las asociaciones</option>${CAT.asociaciones.map(a => `<option value="${a.ID_Asociacion}">${a.Nombre}</option>`).join('')}</select>
      <button class="btn-reset-filters" onclick="resetFiltrosEntregas()"><i class="ti ti-x"></i> Limpiar</button>
    </div>
    <div class="card" style="padding:0">
      <div id="entregas-table-wrap" style="padding:20px;text-align:center"><div class="spinner"></div></div>
    </div>
  `;
  await cargarEntregas();
}

async function cargarEntregas() {
  try {
    const cacheKey = 'entregas_' + JSON.stringify(ENTREGAS_FILTROS);
    const cached = cacheGet(cacheKey);
    if (cached) {
      ENTREGAS_DATA = cached;
      renderTablaEntregas();
      return;
    }
    const res = await apiGet({ action: 'getEntregas', ...ENTREGAS_FILTROS });
    if (res.ok) {
      ENTREGAS_DATA = res.data;
      cacheSet(cacheKey, res.data);
      renderTablaEntregas();
    } else {
      showToast('Error cargando entregas');
    }
    const anios = [...new Set(ENTREGAS_DATA.map(r => String(r.Año)).filter(Boolean))].sort();
    const selAnio = document.getElementById('ef-anio');
    if (selAnio) {
      const cur = ENTREGAS_FILTROS.anio;
      selAnio.innerHTML = '<option value="">Todos los años</option>' + anios.map(a => `<option value="${a}" ${a === cur ? 'selected' : ''}>${a}</option>`).join('');
    }
  } catch (e) {
    showToast('Error de conexión');
  }
}

function filtrarEntregas(campo, valor) {
  ENTREGAS_FILTROS[campo] = valor;
  cargarEntregas();
}

function resetFiltrosEntregas() {
  ENTREGAS_FILTROS = { anio: '', mes: '', asociacion: '' };
  ['ef-anio', 'ef-mes', 'ef-asociacion'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  cargarEntregas();
}

function renderTablaEntregas() {
  const wrap = document.getElementById('entregas-table-wrap');
  if (!wrap) return;
  if (!ENTREGAS_DATA.length) {
    wrap.innerHTML = '<div style="text-align:center;padding:50px"><i class="ti ti-package" style="font-size:40px"></i><p>No hay entregas registradas</p></div>';
    return;
  }
  const filas = ENTREGAS_DATA.map(e => `
    <tr>
      <td data-label="Fecha">${fmtFecha(e.Fecha)}</td>
      <td data-label="Asociación">${e._nombreAsociacion || '—'}</td>
      <td data-label="Comprador">${e._nombreComprador || '—'}</td>
      <td data-label="Nivel">${nivelBadge(e._nivelComprador || e['Nivel Intermediacion'])}</td>
      <td data-label="PET kg" style="text-align:right">${fmtNum(parseFloat(e['PET Kilos'] || 0))} kg</td>
      <td data-label="Suave kg" style="text-align:right">${fmtNum(parseFloat(e['Plástico Suave Kilos'] || 0))} kg</td>
      <td data-label="Duro kg" style="text-align:right">${fmtNum(parseFloat(e['Plástico Duro Kilos'] || 0))} kg</td>
      <td data-label="Valor total" style="text-align:right;font-weight:700;color:var(--g2)">${fmtMoney(e['Valor Total'])}</td>
      <td data-label="Evidencia">${e.ID_Carpeta_Evidencia ? `<a href="https://drive.google.com/drive/folders/${e.ID_Carpeta_Evidencia}" target="_blank" class="btn btn-glass btn-sm"><i class="ti ti-folder"></i></a>` : '<span style="color:var(--tl)">—</span>'}</td>
      <td data-label="Acciones"><div class="td-actions"><button class="btn btn-glass btn-sm" onclick="verEntrega('${e.ID_Entrega}')"><i class="ti ti-eye"></i></button>${SESSION.rol !== 'Visualizador' ? `<button class="btn btn-primary btn-sm" onclick="editarEntrega('${e.ID_Entrega}')"><i class="ti ti-pencil"></i></button>` : ''}</div></td>
    </table>`).join('');
  wrap.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Fecha</th><th>Asociación</th><th>Comprador</th><th>Nivel</th><th style="text-align:right">PET kg</th><th style="text-align:right">Suave kg</th><th style="text-align:right">Duro kg</th><th style="text-align:right">Valor total</th><th>Evidencia</th><th></th></tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
    <div style="margin-top:12px;font-size:12px;color:var(--tl);text-align:right">${ENTREGAS_DATA.length} registro${ENTREGAS_DATA.length !== 1 ? 's' : ''}</div>`;
}

function verEntrega(id) {
  const e = ENTREGAS_DATA.find(r => r.ID_Entrega === id);
  if (!e) return;
  const materiales = ['PET', 'Plástico Suave', 'Plástico Duro', 'Lata Aluminio', 'Vidrio', 'Cartón', 'Chatarra', 'Cobre', 'Papel Archivo', 'Periódico', 'Soplado', 'Tetrapak'];
  const filasMat = materiales.filter(m => parseFloat(e[m + ' Kilos'] || 0) > 0).map(m => `
    <tr><td>${m}</td><td style="text-align:right">${fmtNum(e[m + ' Kilos'])} kg</td><td style="text-align:right">$${fmtNum(e[m + ' Precio'], 2)}/kg</td><td style="text-align:right;font-weight:600;color:var(--g2)">${fmtMoney(e[m + ' Valor Venta'])}</td></tr>`).join('');
  abrirModal(`
    <div class="modal">
      <div class="modal-head"><div class="modal-title">Detalle de entrega</div><button class="modal-close" onclick="cerrarModal()"><i class="ti ti-x"></i></button></div>
      <div class="modal-body">
        <div class="form-grid-2">
          <div><div class="form-label">Fecha</div><div>${fmtFecha(e.Fecha)}</div></div>
          <div><div class="form-label">Año / Mes</div><div>${e.Año} · ${e.Mes}</div></div>
          <div><div class="form-label">Asociación</div><div>${e._nombreAsociacion || '—'}</div></div>
          <div><div class="form-label">Comprador</div><div>${e._nombreComprador || '—'}</div></div>
          <div><div class="form-label">Nivel intermediación</div><div>${nivelBadge(e['Nivel Intermediacion'])}</div></div>
          <div><div class="form-label">Valor total</div><div style="font-size:18px;font-weight:700;color:var(--g2)">${fmtMoney(e['Valor Total'])}</div></div>
        </div>
        <div class="materiales-section"><div class="materiales-section-title">Materiales entregados</div><div class="table-wrap"><table><thead><tr><th>Material</th><th style="text-align:right">Kilos</th><th style="text-align:right">Precio</th><th style="text-align:right">Valor venta</th></tr></thead><tbody>${filasMat}</tbody></table></div></div>
        ${e.Observaciones ? `<div><div class="form-label">Observaciones</div><div>${e.Observaciones}</div></div>` : ''}
        ${e.ID_Carpeta_Evidencia ? `<div><a href="https://drive.google.com/drive/folders/${e.ID_Carpeta_Evidencia}" target="_blank" class="btn btn-glass"><i class="ti ti-folder"></i> Ver evidencias en Drive</a></div>` : ''}
      </div>
    </div>
  `);
}

function abrirFormEntrega(id = null) {
  const e = id ? ENTREGAS_DATA.find(r => r.ID_Entrega === id) : null;
  const materialesActivos = CAT.materiales.length ? CAT.materiales : [
    { Nombre: 'PET', Priorizable: 'Sí' }, { Nombre: 'Plástico Suave', Priorizable: 'Sí' }, { Nombre: 'Plástico Duro', Priorizable: 'Sí' },
    { Nombre: 'Lata Aluminio', Priorizable: 'No' }, { Nombre: 'Vidrio', Priorizable: 'No' }, { Nombre: 'Cartón', Priorizable: 'No' }
  ];
  const priorizables = materialesActivos.filter(m => m.Priorizable === 'Sí' || m.Priorizable === true);
  const otros = materialesActivos.filter(m => m.Priorizable !== 'Sí' && m.Priorizable !== true);
  const filaMaterial = (mat) => {
    const nombre = mat.Nombre;
    const esPrio = mat.Priorizable === 'Sí' || mat.Priorizable === true;
    const kg = e ? (e[nombre + ' Kilos'] || '') : '';
    const precio = e ? (e[nombre + ' Precio'] || '') : '';
    const venta = e ? (e[nombre + ' Valor Venta'] || 0) : 0;
    const mid = nombre.replace(/\s/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    return `<div class="material-row ${esPrio ? 'material-priorizable' : ''}">
      <div class="material-row-label">${nombre}${esPrio ? ' <span class="badge badge-cyan" style="font-size:9px;padding:1px 6px">Priorizable</span>' : ''}</div>
      <input type="number" class="form-input" id="mat-kg-${mid}" placeholder="Kilos" value="${kg}" min="0" step="0.01" oninput="calcularValorMaterial('${mid}','${nombre}')">
      <input type="number" class="form-input" id="mat-precio-${mid}" placeholder="$\/kg" value="${precio}" min="0" step="0.01" oninput="calcularValorMaterial('${mid}','${nombre}')">
      <div class="material-valor" id="mat-venta-${mid}">${venta > 0 ? fmtMoney(venta) : '—'}</div>
    </div>`;
  };
  abrirModal(`
    <div class="modal" style="max-width:680px">
      <div class="modal-head"><div class="modal-title">${e ? 'Editar entrega' : 'Nueva entrega'}</div><button class="modal-close" onclick="cerrarModal()"><i class="ti ti-x"></i></button></div>
      <div class="modal-body">
        <div class="form-grid-2">
          <div class="form-group"><label class="form-label">Fecha *</label><input type="date" class="form-input" id="ent-fecha" value="${e?.Fecha ? String(e.Fecha).substring(0, 10) : new Date().toISOString().substring(0, 10)}"></div>
          <div class="form-group"><label class="form-label">Asociación *</label><select class="form-select" id="ent-asociacion" onchange="autocompletarProvincia(this.value)"><option value="">Selecciona una asociación</option>${CAT.asociaciones.map(a => `<option value="${a.ID_Asociacion}" ${e?.['ID_Asociacion'] === a.ID_Asociacion ? 'selected' : ''}>${a.Nombre}</option>`).join('')}</select></div>
          <div class="form-group"><label class="form-label">Provincia</label><input type="text" class="form-input" id="ent-provincia" readonly style="background:#f8fbfd;color:var(--tm)" placeholder="Se completa automáticamente"></div>
          <div class="form-group"><label class="form-label">Comprador *</label><select class="form-select" id="ent-comprador"><option value="">Selecciona un comprador</option>${CAT.compradores.map(c => `<option value="${c.ID_Comprador}" ${e?.['ID_Comprador'] === c.ID_Comprador ? 'selected' : ''}>${c.Nombre}</option>`).join('')}</select></div>
          <div class="form-group"><label class="form-label">Nivel intermediación</label><select class="form-select" id="ent-nivel">${['Nivel 1', 'Nivel 2', 'Nivel 3', 'Transformador'].map(n => `<option value="${n}" ${e?.['Nivel Intermediacion'] === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
          <div class="form-group"><label class="form-label">Actividad Fuente</label><input type="text" class="form-input" id="ent-actividad" value="${e?.['Actividad Fuente'] || ''}" placeholder="Ej: Recolección urbana"></div>
          <div class="form-group"><label class="form-label">Destino Final</label><input type="text" class="form-input" id="ent-destino" value="${e?.['Destino Final'] || ''}" placeholder="Ej: Exportación"></div>
        </div>
        <div class="materiales-section" style="margin-bottom:14px"><div class="materiales-section-title">Materiales priorizables</div><div class="material-row" style="font-size:10px;font-weight:600;color:var(--tl);text-transform:uppercase;margin-bottom:6px"><div>Material</div><div>Kilos</div><div>Precio $/kg</div><div style="text-align:right">Valor venta</div></div>${priorizables.map(filaMaterial).join('')}</div>
        <div class="materiales-section"><div class="materiales-section-title">Otros materiales</div><div class="material-row" style="font-size:10px;font-weight:600;color:var(--tl);text-transform:uppercase;margin-bottom:6px"><div>Material</div><div>Kilos</div><div>Precio $/kg</div><div style="text-align:right">Valor venta</div></div>${otros.map(filaMaterial).join('')}</div>
        <div style="margin-top:14px;display:flex;justify-content:flex-end;align-items:center;gap:12px"><span style="font-size:13px;color:var(--tm);font-weight:600">VALOR TOTAL:</span><span id="ent-total" style="font-size:22px;font-weight:700;color:var(--g2)">${e ? fmtMoney(e['Valor Total']) : '$0.00'}</span></div>
        <div class="form-group" style="margin-top:14px"><label class="form-label">Observaciones</label><textarea class="form-textarea" id="ent-obs" placeholder="Notas adicionales...">${e?.Observaciones || ''}</textarea></div>
        <div class="form-group"><label class="form-label">Evidencias (actas, fotos de pesaje)</label><input type="file" id="ent-evidencias" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" style="font-size:13px;color:var(--tm)"><div class="form-hint">Se subirán automáticamente a la carpeta Drive de la asociación</div>${e?.['ID_Carpeta_Evidencia'] ? `<a href="https://drive.google.com/drive/folders/${e['ID_Carpeta_Evidencia']}" target="_blank" class="btn btn-glass btn-sm" style="margin-top:8px"><i class="ti ti-folder"></i> Ver evidencias actuales</a>` : ''}</div>
      </div>
      <div class="modal-foot"><button class="btn btn-glass" onclick="cerrarModal()">Cancelar</button><button class="btn btn-primary" id="btn-guardar-entrega" onclick="guardarEntrega('${id || ''}')"><i class="ti ti-check"></i> ${e ? 'Actualizar' : 'Guardar entrega'}</button></div>
    </div>
  `);
}

function editarEntrega(id) { abrirFormEntrega(id); }

function autocompletarProvincia(idAsociacion) {
  const aso = CAT.asociaciones.find(a => a.ID_Asociacion === idAsociacion);
  const input = document.getElementById('ent-provincia');
  if (input) input.value = aso?.Provincia || '';
}

function calcularValorMaterial(mid, nombre) {
  const kg = parseFloat(document.getElementById('mat-kg-' + mid)?.value || 0);
  const precio = parseFloat(document.getElementById('mat-precio-' + mid)?.value || 0);
  const venta = kg * precio;
  const el = document.getElementById('mat-venta-' + mid);
  if (el) el.textContent = venta > 0 ? fmtMoney(venta) : '—';
  let total = 0;
  document.querySelectorAll('[id^="mat-venta-"]').forEach(el => { total += parseFloat(el.textContent.replace(/[$,]/g, '')) || 0; });
  const elTotal = document.getElementById('ent-total');
  if (elTotal) elTotal.textContent = fmtMoney(total);
}

async function guardarEntrega(id) {
  const fecha = document.getElementById('ent-fecha')?.value;
  const idAsoc = document.getElementById('ent-asociacion')?.value;
  const idComp = document.getElementById('ent-comprador')?.value;
  const nivel = document.getElementById('ent-nivel')?.value;
  const obs = document.getElementById('ent-obs')?.value;
  const actividad = document.getElementById('ent-actividad')?.value;
  const destino = document.getElementById('ent-destino')?.value;
  const provincia = document.getElementById('ent-provincia')?.value;
  const archivos = document.getElementById('ent-evidencias')?.files;
  if (!fecha || !idAsoc || !idComp) { showToast('Completa los campos obligatorios'); return; }
  const data = {
    ID_Entrega: id || '', Fecha: fecha, ID_Asociacion: idAsoc, ID_Comprador: idComp,
    'Nivel Intermediacion': nivel, 'Actividad Fuente': actividad, 'Destino Final': destino,
    Provincia: provincia, Observaciones: obs, ID_Usuario: SESSION.email
  };
  const materiales = CAT.materiales.length ? CAT.materiales.map(m => m.Nombre) : ['PET', 'Plástico Suave', 'Plástico Duro', 'Lata Aluminio', 'Vidrio', 'Cartón', 'Chatarra', 'Cobre', 'Papel Archivo', 'Periódico', 'Soplado', 'Tetrapak'];
  materiales.forEach(nombre => {
    const mid = nombre.replace(/\s/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    data[nombre + ' Kilos'] = parseFloat(document.getElementById('mat-kg-' + mid)?.value || 0);
    data[nombre + ' Precio'] = parseFloat(document.getElementById('mat-precio-' + mid)?.value || 0);
  });
  const btn = document.getElementById('btn-guardar-entrega');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader"></i> Guardando...'; }
  try {
    const res = await apiPost({ action: 'saveEntrega', data });
    if (!res.ok) throw new Error(res.error || 'Error');
    if (archivos && archivos.length > 0 && res.folderId) {
      showToast('Subiendo evidencias...');
      await subirArchivosConcurrente(Array.from(archivos), res.folderId, (subidos, total) => showToast(`Subiendo ${subidos}/${total}...`));
    }
    showToast(id ? 'Entrega actualizada ✓' : 'Entrega guardada ✓');
    cerrarModal();
    invalidarCache();
    cacheClear('entregas_*');
    await cargarEntregas();
  } catch (e) { showToast('Error al guardar: ' + e.message); } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-check"></i> Guardar entrega'; }
  }
}

// ==================== COMPRADORES (unificado) ====================
async function verCompradoresModal() {
  const coms = CAT.compradores;
  const filas = coms.length ? coms.map(c => `
    <tr><td style="font-weight:500">${c.Nombre}</td><td>${nivelBadge(c['Nivel Intermediacion'])}</td><td>${c['Destino Final'] || '—'}</td><td>${c.Provincia || '—'}</td><td><span class="badge ${c.Activo === true || c.Activo === 'TRUE' ? 'badge-green' : 'badge-warn'}">${c.Activo === true || c.Activo === 'TRUE' ? 'Sí' : 'No'}</span></td><td><div class="td-actions"><button class="btn btn-primary btn-sm" onclick="abrirFormCompradorUnificado('${c.ID_Comprador}')"><i class="ti ti-pencil"></i></button></div></td></tr>`).join('') : '<tr><td colspan="6" style="text-align:center;color:var(--tl);padding:30px">No hay compradores registrados</td></tr>';
  abrirModal(`
    <div class="modal" style="max-width:700px">
      <div class="modal-head"><div class="modal-title">Compradores</div><button class="modal-close" onclick="cerrarModal()"><i class="ti ti-x"></i></button></div>
      <div class="modal-body" style="padding:0"><div class="table-wrap" style="border:none;border-radius:0"><table><thead><tr><th>Nombre</th><th>Nivel</th><th>Destino final</th><th>Provincia</th><th>Activo</th><th></th></tr></thead><tbody>${filas}</tbody></table></div></div>
      <div class="modal-foot"><button class="btn btn-success" onclick="cerrarModal();abrirFormCompradorUnificado()"><i class="ti ti-plus"></i> Nuevo comprador</button><button class="btn btn-glass" onclick="cerrarModal()">Cerrar</button></div>
    </div>
  `);
}

function abrirFormCompradorUnificado(id = null) {
  const c = id ? CAT.compradores.find(x => x.ID_Comprador === id) : null;
  abrirModal(`
    <div class="modal">
      <div class="modal-head"><div class="modal-title">${c ? 'Editar comprador' : 'Nuevo comprador'}</div><button class="modal-close" onclick="cerrarModal()"><i class="ti ti-x"></i></button></div>
      <div class="modal-body">
        <div class="form-group"><label class="form-label">Nombre *</label><input type="text" class="form-input" id="com-nombre" value="${c?.Nombre || ''}"></div>
        <div class="form-grid-2"><div class="form-group"><label class="form-label">Nivel intermediación</label><select class="form-select" id="com-nivel">${['Nivel 1', 'Nivel 2', 'Nivel 3', 'Transformador'].map(n => `<option value="${n}" ${c?.['Nivel Intermediacion'] === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div><div class="form-group"><label class="form-label">Provincia</label><input type="text" class="form-input" id="com-provincia" value="${c?.Provincia || ''}"></div></div>
        <div class="form-group"><label class="form-label">Destino final</label><input type="text" class="form-input" id="com-destino" placeholder="Ej: Se vende a INTERCIA S.A." value="${c?.['Destino Final'] || ''}"></div>
        <div class="form-group"><label class="form-label">Activo</label><select class="form-select" id="com-activo"><option value="true" ${c?.Activo !== false ? 'selected' : ''}>Sí</option><option value="false" ${c?.Activo === false ? 'selected' : ''}>No</option></select></div>
      </div>
      <div class="modal-foot"><button class="btn btn-glass" onclick="cerrarModal()">Cancelar</button><button class="btn btn-primary" id="btn-guardar-com" onclick="guardarCompradorUnificado('${id || ''}')"><i class="ti ti-check"></i> ${c ? 'Actualizar' : 'Guardar'}</button></div>
    </div>
  `);
}

async function guardarCompradorUnificado(id) {
  const nombre = document.getElementById('com-nombre')?.value?.trim();
  const nivel = document.getElementById('com-nivel')?.value;
  const provincia = document.getElementById('com-provincia')?.value?.trim();
  const destino = document.getElementById('com-destino')?.value?.trim();
  const activo = document.getElementById('com-activo')?.value === 'true';
  if (!nombre) { showToast('Nombre obligatorio'); return; }
  const btn = document.getElementById('btn-guardar-com');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader"></i> Guardando...'; }
  try {
    const res = await apiPost({ action: 'saveComprador', data: { ID_Comprador: id || '', Nombre: nombre, 'Nivel Intermediacion': nivel, Provincia: provincia, 'Destino Final': destino, Activo: activo } });
    if (!res.ok) throw new Error(res.error || 'desconocido');
    showToast(id ? 'Comprador actualizado ✓' : 'Comprador creado ✓');
    invalidarCache();
    const coms = await apiGet({ action: 'getCompradores' });
    if (coms.ok) CAT.compradores = coms.data;
    cerrarModal();
    if (document.getElementById('entregas-table-wrap')) await cargarEntregas();
  } catch (e) { showToast('Error al guardar'); } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-check"></i> Guardar'; }
  }
}

// ==================== ASOCIACIONES ====================
async function renderAsociaciones() {
  document.getElementById('topbar-actions').innerHTML = `<button class="btn btn-primary" onclick="abrirFormAsociacion()"><i class="ti ti-plus"></i> Nueva asociación</button>`;
  const content = document.getElementById('main-content');
  content.innerHTML = `<div class="filters-bar"><input type="text" class="filter-select-sm" id="asoc-buscar" placeholder="Buscar asociación..." oninput="debouncedBuscarAsociacion(this.value)" style="min-width:200px"><select class="filter-select-sm" id="asoc-estado-f" onchange="filtrarEstadoAsoc(this.value)"><option value="">Todos los estados</option><option value="Activa">Activa</option><option value="Inactiva">Inactiva</option></select><button class="btn-reset-filters" onclick="resetFiltrosAsoc()"><i class="ti ti-x"></i> Limpiar</button></div><div id="asoc-content"><div style="text-align:center;padding:60px"><div class="spinner"></div></div></div>`;
  await cargarAsociaciones();
}
const debouncedBuscarAsociacion = debounce((val) => { ASOC_BUSCAR = val.toLowerCase(); renderTablaAsociaciones(); }, 300);
function filtrarEstadoAsoc(val) { ASOC_ESTADO = val; renderTablaAsociaciones(); }
function resetFiltrosAsoc() { ASOC_BUSCAR = ''; ASOC_ESTADO = ''; const b = document.getElementById('asoc-buscar'); if (b) b.value = ''; const e = document.getElementById('asoc-estado-f'); if (e) e.value = ''; renderTablaAsociaciones(); }
async function cargarAsociaciones() {
  try {
    const cached = cacheGet('asociaciones');
    if (cached) { ASOC_DATA = cached; renderTablaAsociaciones(); return; }
    const res = await apiGet({ action: 'getAllAsociaciones' });
    if (res.ok) { ASOC_DATA = res.data; CAT.asociaciones = res.data.filter(a => a.Estado === 'Activa'); CAT.todasAsociaciones = res.data; cacheSet('asociaciones', res.data); renderTablaAsociaciones(); }
    else showToast('Error cargando asociaciones');
  } catch (e) { showToast('Error conexión'); }
}
function renderTablaAsociaciones() {
  const wrap = document.getElementById('asoc-content');
  if (!wrap) return;
  let data = ASOC_DATA;
  if (ASOC_BUSCAR) data = data.filter(a => (a.Nombre || '').toLowerCase().includes(ASOC_BUSCAR));
  if (ASOC_ESTADO) data = data.filter(a => a.Estado === ASOC_ESTADO);
  if (!data.length) { wrap.innerHTML = '<div style="text-align:center;padding:60px"><i class="ti ti-building-community" style="font-size:40px"></i><p>No hay asociaciones registradas</p></div>'; return; }
  const filas = data.map(a => `
    <tr><td data-label="Nombre" style="font-weight:600;color:var(--b1)">${a.Nombre || '—'}</td><td data-label="Provincia">${a.Provincia || '—'}</td><td data-label="Ciudad">${a.Ciudad || '—'}</td><td data-label="Tipo">${a.Tipo || '—'}</td><td data-label="Recicladores" style="text-align:center">${a['Numero de Recicladores'] || '—'}</td><td data-label="Estado">${a.Estado === 'Activa' ? '<span class="badge badge-green">Activa</span>' : '<span class="badge badge-warn">Inactiva</span>'}</td><td data-label="Drive">${a.ID_Carpeta_Drive ? `<a href="https://drive.google.com/drive/folders/${a.ID_Carpeta_Drive}" target="_blank" class="btn btn-glass btn-sm"><i class="ti ti-folder"></i> Ver Drive</a>` : `<button class="btn btn-glass btn-sm" onclick="crearCarpetaAsociacion('${a.ID_Asociacion}','${a.Nombre.replace(/'/g, "\\'")}')"><i class="ti ti-folder-plus"></i> Crear carpeta</button>`}</td><td data-label="Acciones"><div class="td-actions"><button class="btn btn-glass btn-sm" onclick="verAsociacion('${a.ID_Asociacion}')"><i class="ti ti-eye"></i></button><button class="btn btn-primary btn-sm" onclick="abrirFormAsociacion('${a.ID_Asociacion}')"><i class="ti ti-pencil"></i></button></div></td></td>`).join('');
  wrap.innerHTML = `<div class="card" style="padding:0"><div class="table-wrap" style="border:none;border-radius:var(--radius-lg)"><table><thead><tr><th>Nombre</th><th>Provincia</th><th>Ciudad</th><th>Tipo</th><th style="text-align:center">Recicladores</th><th>Estado</th><th>Carpeta Drive</th><th></th></tr></thead><tbody>${filas}</tbody></table></div></div><div style="font-size:12px;color:var(--tl);text-align:right">${data.length} asociación${data.length !== 1 ? 'es' : ''}</div>`;
}
function verAsociacion(id) { const a = ASOC_DATA.find(x => x.ID_Asociacion === id); if (!a) return; abrirModal(`<div class="modal"><div class="modal-head"><div class="modal-title">${a.Nombre}</div><button class="modal-close" onclick="cerrarModal()"><i class="ti ti-x"></i></button></div><div class="modal-body"><div class="form-grid-2">...</div>${a.Observaciones ? `<div><div class="form-label">Observaciones</div><div>${a.Observaciones}</div></div>` : ''}<div style="margin-top:20px;display:flex;gap:10px">${a.ID_Carpeta_Drive ? `<a href="https://drive.google.com/drive/folders/${a.ID_Carpeta_Drive}" target="_blank" class="btn btn-glass"><i class="ti ti-folder"></i> Ver carpeta Drive</a>` : `<button class="btn btn-glass" onclick="cerrarModal();crearCarpetaAsociacion('${a.ID_Asociacion}','${a.Nombre.replace(/'/g, "\\'")}')"><i class="ti ti-folder-plus"></i> Crear carpeta Drive</button>`}<button class="btn btn-primary" onclick="cerrarModal();abrirFormAsociacion('${a.ID_Asociacion}')"><i class="ti ti-pencil"></i> Editar</button></div></div></div>`); }
function abrirFormAsociacion(id = null) { const a = id ? ASOC_DATA.find(x => x.ID_Asociacion === id) : null; abrirModal(`<div class="modal"><div class="modal-head"><div class="modal-title">${a ? 'Editar asociación' : 'Nueva asociación'}</div><button class="modal-close" onclick="cerrarModal()"><i class="ti ti-x"></i></button></div><div class="modal-body"><div class="form-group"><label class="form-label">Nombre *</label><input type="text" class="form-input" id="aso-nombre" placeholder="Nombre de la asociación" value="${a?.Nombre || ''}"></div><div class="form-grid-2"><div class="form-group"><label class="form-label">Provincia</label><select class="form-select" id="aso-provincia">${['El Oro', 'Guayas', 'Manabí', 'Sucumbíos', 'Pichincha', 'Chimborazo', 'Otra'].map(p => `<option value="${p}" ${a?.Provincia === p ? 'selected' : ''}>${p}</option>`).join('')}</select></div><div class="form-group"><label class="form-label">Ciudad</label><input type="text" class="form-input" id="aso-ciudad" placeholder="Ciudad" value="${a?.Ciudad || ''}"></div><div class="form-group"><label class="form-label">Tipo</label><select class="form-select" id="aso-tipo">${['Formal', 'Colectivo', 'Grupo'].map(t => `<option value="${t}" ${a?.Tipo === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div><div class="form-group"><label class="form-label">Estado</label><select class="form-select" id="aso-estado"><option value="Activa" ${(!a || a.Estado === 'Activa') ? 'selected' : ''}>Activa</option><option value="Inactiva" ${a?.Estado === 'Inactiva' ? 'selected' : ''}>Inactiva</option></select></div></div><div class="form-group"><label class="form-label">Número de recicladores</label><input type="number" class="form-input" id="aso-recicladores" min="0" placeholder="0" value="${a?.['Numero de Recicladores'] || ''}"></div><div class="form-group"><label class="form-label">Observaciones</label><textarea class="form-textarea" id="aso-obs" placeholder="Notas adicionales...">${a?.Observaciones || ''}</textarea></div></div><div class="modal-foot"><button class="btn btn-glass" onclick="cerrarModal()">Cancelar</button><button class="btn btn-primary" id="btn-guardar-aso" onclick="guardarAsociacion('${id || ''}')"><i class="ti ti-check"></i> ${a ? 'Actualizar' : 'Guardar'}</button></div></div>`); }
async function guardarAsociacion(id) { const nombre = document.getElementById('aso-nombre')?.value?.trim(); if (!nombre) { showToast('Nombre obligatorio'); return; } const data = { ID_Asociacion: id || '', Nombre: nombre, Provincia: document.getElementById('aso-provincia')?.value, Ciudad: document.getElementById('aso-ciudad')?.value, Tipo: document.getElementById('aso-tipo')?.value, Estado: document.getElementById('aso-estado')?.value, 'Numero de Recicladores': document.getElementById('aso-recicladores')?.value, Observaciones: document.getElementById('aso-obs')?.value, 'Fecha Ingreso': id ? '' : new Date().toISOString().substring(0, 10) }; const btn = document.getElementById('btn-guardar-aso'); if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader"></i> Guardando...'; } try { const res = await apiPost({ action: 'saveAsociacion', data }); if (!res.ok) throw new Error(res.error); if (!id && res.id) await apiPost({ action: 'crearCarpetaAsoc', idAsociacion: res.id, nombre }); showToast(id ? 'Asociación actualizada ✓' : 'Asociación creada ✓'); cerrarModal(); invalidarCache(); cacheClear('asociaciones'); await cargarAsociaciones(); } catch (e) { showToast('Error al guardar'); } finally { if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-check"></i> Guardar'; } } }
async function crearCarpetaAsociacion(idAsociacion, nombre) { showToast('Creando carpeta...'); try { const res = await apiPost({ action: 'crearCarpetaAsoc', idAsociacion, nombre }); if (res.ok) { showToast('Carpeta creada ✓'); await cargarAsociaciones(); } else showToast('Error'); } catch (e) { showToast('Error de conexión'); } }

// ==================== ACCESOS ====================
async function renderAccesos() {
  if (SESSION.rol === 'Admin') document.getElementById('topbar-actions').innerHTML = `<button class="btn btn-primary" onclick="abrirFormAcceso()"><i class="ti ti-plus"></i> Nuevo acceso</button>`;
  const content = document.getElementById('main-content');
  const categorias = ['Todos', ...new Set(CAT.accesos.map(a => a.Categoría).filter(Boolean))];
  content.innerHTML = `<div class="cat-chips">${categorias.map(c => `<div class="cat-chip ${c === ACCESOS_CAT_ACTIVA ? 'active' : ''}" onclick="filtrarAccesos('${c}')">${c}</div>`).join('')}</div><div id="accesos-grid-wrap">${renderGridAccesos()}</div>`;
}
function filtrarAccesos(cat) { ACCESOS_CAT_ACTIVA = cat; document.querySelectorAll('.cat-chip').forEach(el => el.classList.toggle('active', el.textContent.trim() === cat)); document.getElementById('accesos-grid-wrap').innerHTML = renderGridAccesos(); }
function renderGridAccesos() {
  const filtrados = ACCESOS_CAT_ACTIVA === 'Todos' ? CAT.accesos : CAT.accesos.filter(a => a.Categoría === ACCESOS_CAT_ACTIVA);
  if (!filtrados.length) return `<div style="text-align:center;padding:60px"><i class="ti ti-link" style="font-size:40px"></i><p>No hay accesos en esta categoría</p></div>`;
  const tarjetas = filtrados.map(a => `<a class="acceso-card" href="${a.URL}" target="_blank"><div class="acceso-emoji">${a.Emoji || '🔗'}</div><div class="acceso-nombre">${a.Nombre}</div><div class="acceso-cat">${a.Categoría || ''}</div>${SESSION.rol === 'Admin' ? `<div style="display:flex;gap:6px;margin-top:4px" onclick="event.preventDefault()"><button class="btn btn-glass btn-sm" onclick="abrirFormAcceso('${a.ID}')"><i class="ti ti-pencil"></i></button><button class="btn btn-danger btn-sm" onclick="eliminarAcceso('${a.ID}','${a.Nombre}')"><i class="ti ti-trash"></i></button></div>` : ''}</a>`).join('');
  return `<div class="accesos-grid">${tarjetas}</div>`;
}
function abrirFormAcceso(id = null) { const a = id ? CAT.accesos.find(x => x.ID === id) : null; const categorias = ['Herramientas', 'Documentos', 'Redes sociales', 'Comunicación', 'Drive', 'Reportes', 'Otros']; abrirModal(`<div class="modal"><div class="modal-head"><div class="modal-title">${a ? 'Editar acceso' : 'Nuevo acceso'}</div><button class="modal-close" onclick="cerrarModal()"><i class="ti ti-x"></i></button></div><div class="modal-body"><div class="form-group"><label class="form-label">Nombre *</label><input type="text" class="form-input" id="acc-nombre" placeholder="Nombre del acceso" value="${a?.Nombre || ''}"></div><div class="form-group"><label class="form-label">URL *</label><input type="url" class="form-input" id="acc-url" placeholder="https://..." value="${a?.URL || ''}"></div><div class="form-grid-2"><div class="form-group"><label class="form-label">Emoji</label><input type="text" class="form-input" id="acc-emoji" placeholder="🔗" value="${a?.Emoji || ''}" maxlength="4"></div><div class="form-group"><label class="form-label">Categoría</label><select class="form-select" id="acc-categoria">${categorias.map(c => `<option value="${c}" ${a?.Categoría === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div></div><div class="form-grid-2"><div class="form-group"><label class="form-label">Visible para</label><select class="form-select" id="acc-visible"><option value="Todos" ${a?.['Visible para'] === 'Todos' ? 'selected' : ''}>Todos</option><option value="Solo admin" ${a?.['Visible para'] === 'Solo admin' ? 'selected' : ''}>Solo admin</option></select></div><div class="form-group"><label class="form-label">Activo</label><select class="form-select" id="acc-activo"><option value="true" ${a?.Activo !== false ? 'selected' : ''}>Sí</option><option value="false" ${a?.Activo === false ? 'selected' : ''}>No</option></select></div></div></div><div class="modal-foot"><button class="btn btn-glass" onclick="cerrarModal()">Cancelar</button><button class="btn btn-primary" id="btn-guardar-acceso" onclick="guardarAcceso('${id || ''}')"><i class="ti ti-check"></i> ${a ? 'Actualizar' : 'Guardar'}</button></div></div>`); }
async function guardarAcceso(id) { const nombre = document.getElementById('acc-nombre')?.value?.trim(); const url = document.getElementById('acc-url')?.value?.trim(); if (!nombre || !url) { showToast('Nombre y URL obligatorios'); return; } const data = { ID: id || '', Nombre: nombre, URL: url, Emoji: document.getElementById('acc-emoji')?.value || '🔗', Categoría: document.getElementById('acc-categoria')?.value, 'Visible para': document.getElementById('acc-visible')?.value, Activo: document.getElementById('acc-activo')?.value === 'true', email: SESSION.email }; const btn = document.getElementById('btn-guardar-acceso'); if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader"></i> Guardando...'; } try { const res = await apiPost({ action: 'saveAcceso', data }); if (!res.ok) throw new Error(res.error); showToast(id ? 'Acceso actualizado ✓' : 'Acceso guardado ✓'); cerrarModal(); const accs = await apiGet({ action: 'getAccesos', rol: SESSION.rol }); if (accs.ok) CAT.accesos = accs.data; renderAccesos(); } catch (e) { showToast('Error al guardar'); } finally { if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-check"></i> Guardar'; } } }
function eliminarAcceso(id, nombre) { abrirModal(`<div class="modal" style="max-width:420px"><div class="modal-head"><div class="modal-title">Eliminar acceso</div><button class="modal-close" onclick="cerrarModal()"><i class="ti ti-x"></i></button></div><div class="modal-body"><p>¿Seguro que quieres eliminar <strong>${nombre}</strong>? Esta acción no se puede deshacer.</p></div><div class="modal-foot"><button class="btn btn-glass" onclick="cerrarModal()">Cancelar</button><button class="btn btn-danger" onclick="confirmarEliminarAcceso('${id}')"><i class="ti ti-trash"></i> Eliminar</button></div></div>`); }
async function confirmarEliminarAcceso(id) { try { const res = await apiPost({ action: 'deleteRow', sheet: 'Accesos', id }); if (!res.ok) throw new Error(); showToast('Acceso eliminado ✓'); cerrarModal(); const accs = await apiGet({ action: 'getAccesos', rol: SESSION.rol }); if (accs.ok) CAT.accesos = accs.data; renderAccesos(); } catch (e) { showToast('Error al eliminar'); } }

// ==================== CONFIGURACIÓN (Admin) ====================
function renderConfiguracion() {
  if (SESSION.rol !== 'Admin') { document.getElementById('main-content').innerHTML = `<div class="card" style="text-align:center;padding:60px"><i class="ti ti-lock" style="font-size:40px"></i><div>Acceso restringido</div></div>`; return; }
  document.getElementById('main-content').innerHTML = `<div class="tabs-bar"><button class="tab-btn active" id="cfg-tab-usuarios" onclick="switchConfigTab('usuarios')">Usuarios</button><button class="tab-btn" id="cfg-tab-materiales" onclick="switchConfigTab('materiales')">Materiales</button><button class="tab-btn" id="cfg-tab-ajustes" onclick="switchConfigTab('ajustes')">Ajustes</button></div><div id="config-tab-content"></div>`;
  switchConfigTab('usuarios');
}
function switchConfigTab(tab) { CONFIG_TAB = tab; document.querySelectorAll('[id^="cfg-tab-"]').forEach(el => el.classList.remove('active')); document.getElementById('cfg-tab-' + tab)?.classList.add('active'); if (tab === 'usuarios') renderUsuarios(); else if (tab === 'materiales') renderMateriales(); else if (tab === 'ajustes') renderAjustes(); }
async function renderUsuarios() { document.getElementById('config-tab-content').innerHTML = `<div class="config-section"><div class="config-section-head"><div class="config-section-title"><i class="ti ti-users"></i> Usuarios</div><button class="btn btn-primary btn-sm" onclick="abrirFormUsuario()">Nuevo</button></div><div style="padding:30px;text-align:center"><div class="spinner"></div></div></div>`; try { const res = await apiGet({ action: 'getUsuariosTodos' }); USUARIOS_DATA = res.ok ? res.data : []; renderTablaUsuarios(); } catch (e) { showToast('Error cargando usuarios'); } }
function renderTablaUsuarios() { document.getElementById('config-tab-content').innerHTML = `<div class="config-section"><div class="config-section-head"><div class="config-section-title"><i class="ti ti-users"></i> Usuarios <span class="badge badge-blue">${USUARIOS_DATA.length}</span></div><button class="btn btn-primary btn-sm" onclick="abrirFormUsuario()">Nuevo</button></div><div class="config-section-body" style="padding:0"><div class="table-wrap"><table><thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Activo</th><th></th></tr></thead><tbody>${USUARIOS_DATA.length ? USUARIOS_DATA.map(u => `<tr><td style="font-weight:500">${u.Nombre}</td><td>${u.Email}</td><td><span class="badge ${u.Rol === 'Admin' ? 'badge-blue' : u.Rol === 'Editor' ? 'badge-green' : 'badge-cyan'}">${u.Rol}</span></td><td><span class="badge ${u.Activo === true || u.Activo === 'TRUE' ? 'badge-green' : 'badge-warn'}">${u.Activo === true || u.Activo === 'TRUE' ? 'Activo' : 'Inactivo'}</span></td><td><div class="td-actions"><button class="btn btn-primary btn-sm" onclick="abrirFormUsuario('${u.ID_Usuario}')"><i class="ti ti-pencil"></i></button></div></td></tr>`).join('') : '<tr><td colspan="5" style="text-align:center;color:var(--tl);padding:30px">No hay usuarios</td></tr>'}</tbody></table></div></div></div>`; }
function abrirFormUsuario(id = null) { const u = id ? USUARIOS_DATA.find(x => x.ID_Usuario === id) : null; abrirModal(`<div class="modal" style="max-width:440px"><div class="modal-head"><div class="modal-title">${u ? 'Editar usuario' : 'Nuevo usuario'}</div><button class="modal-close" onclick="cerrarModal()"><i class="ti ti-x"></i></button></div><div class="modal-body"><div class="form-group"><label class="form-label">Nombre *</label><input type="text" class="form-input" id="usr-nombre" value="${u?.Nombre || ''}"></div><div class="form-group"><label class="form-label">Email *</label><input type="email" class="form-input" id="usr-email" value="${u?.Email || ''}" placeholder="nombre@redesconrostro.org" ${u ? 'readonly style="background:#f8fbfd;color:var(--tm)"' : ''}><div class="form-hint">Solo cuentas @${DOMAIN}</div></div><div class="form-grid-2"><div class="form-group"><label class="form-label">Rol</label><select class="form-select" id="usr-rol"><option value="Admin" ${u?.Rol === 'Admin' ? 'selected' : ''}>Admin</option><option value="Editor" ${u?.Rol === 'Editor' ? 'selected' : ''}>Editor</option><option value="Visualizador" ${u?.Rol === 'Visualizador' ? 'selected' : ''}>Visualizador</option></select></div><div class="form-group"><label class="form-label">Activo</label><select class="form-select" id="usr-activo"><option value="true" ${u?.Activo !== false ? 'selected' : ''}>Sí</option><option value="false" ${u?.Activo === false ? 'selected' : ''}>No</option></select></div></div></div><div class="modal-foot"><button class="btn btn-glass" onclick="cerrarModal()">Cancelar</button><button class="btn btn-primary" id="btn-guardar-usr" onclick="guardarUsuario('${id || ''}')"><i class="ti ti-check"></i> ${u ? 'Actualizar' : 'Guardar'}</button></div></div>`); }
async function guardarUsuario(id) { const nombre = document.getElementById('usr-nombre')?.value?.trim(); const email = document.getElementById('usr-email')?.value?.trim(); const rol = document.getElementById('usr-rol')?.value; const activo = document.getElementById('usr-activo')?.value === 'true'; if (!nombre || !email) { showToast('Nombre y email obligatorios'); return; } if (!email.endsWith('@' + DOMAIN)) { showToast('Solo cuentas @' + DOMAIN); return; } const btn = document.getElementById('btn-guardar-usr'); if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader"></i> Guardando...'; } try { const res = await apiPost({ action: 'saveUsuario', data: { ID_Usuario: id || '', Nombre: nombre, Email: email, Rol: rol, Activo: activo } }); if (!res.ok) throw new Error(res.error); showToast(id ? 'Usuario actualizado ✓' : 'Usuario creado ✓'); cerrarModal(); await renderUsuarios(); } catch (e) { showToast('Error al guardar'); } finally { if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-check"></i> Guardar'; } } }
function renderMateriales() { document.getElementById('config-tab-content').innerHTML = `<div class="config-section"><div class="config-section-head"><div class="config-section-title"><i class="ti ti-recycle"></i> Materiales <span class="badge badge-blue">${CAT.materiales.length}</span></div><button class="btn btn-primary btn-sm" onclick="abrirFormMaterial()">Nuevo</button></div><div class="config-section-body" style="padding:0"><div class="table-wrap"><table><thead><tr><th>Nombre</th><th>Priorizable</th><th>Activo</th><th></th></tr></thead><tbody>${CAT.materiales.length ? CAT.materiales.map(m => `<tr><td style="font-weight:500">${m.Nombre}</td><td>${m.Priorizable === 'Sí' || m.Priorizable === true ? '<span class="badge badge-cyan">Sí</span>' : '<span style="color:var(--tl);font-size:12px">No</span>'}</td><td><span class="badge ${m.Activo === true || m.Activo === 'TRUE' ? 'badge-green' : 'badge-warn'}">${m.Activo === true || m.Activo === 'TRUE' ? 'Activo' : 'Inactivo'}</span></td><td><div class="td-actions"><button class="btn btn-primary btn-sm" onclick="abrirFormMaterial('${m.ID_Material}')"><i class="ti ti-pencil"></i></button></div></td></tr>`).join('') : '<tr><td colspan="4" style="text-align:center;color:var(--tl);padding:30px">No hay materiales</td></tr>'}</tbody></table></div></div></div>`; }
function abrirFormMaterial(id = null) { const m = id ? CAT.materiales.find(x => x.ID_Material === id) : null; abrirModal(`<div class="modal" style="max-width:400px"><div class="modal-head"><div class="modal-title">${m ? 'Editar material' : 'Nuevo material'}</div><button class="modal-close" onclick="cerrarModal()"><i class="ti ti-x"></i></button></div><div class="modal-body"><div class="form-group"><label class="form-label">Nombre *</label><input type="text" class="form-input" id="mat-nombre" value="${m?.Nombre || ''}"></div><div class="form-grid-2"><div class="form-group"><label class="form-label">Priorizable</label><select class="form-select" id="mat-prio"><option value="Sí" ${m?.Priorizable === 'Sí' ? 'selected' : ''}>Sí</option><option value="No" ${m?.Priorizable !== 'Sí' ? 'selected' : ''}>No</option></select></div><div class="form-group"><label class="form-label">Activo</label><select class="form-select" id="mat-activo"><option value="true" ${m?.Activo !== false ? 'selected' : ''}>Sí</option><option value="false" ${m?.Activo === false ? 'selected' : ''}>No</option></select></div></div></div><div class="modal-foot"><button class="btn btn-glass" onclick="cerrarModal()">Cancelar</button><button class="btn btn-primary" id="btn-guardar-mat" onclick="guardarMaterial('${id || ''}')"><i class="ti ti-check"></i> ${m ? 'Actualizar' : 'Guardar'}</button></div></div>`); }
async function guardarMaterial(id) { const nombre = document.getElementById('mat-nombre')?.value?.trim(); const prio = document.getElementById('mat-prio')?.value; const activo = document.getElementById('mat-activo')?.value === 'true'; if (!nombre) { showToast('El nombre es obligatorio'); return; } const btn = document.getElementById('btn-guardar-mat'); if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader"></i> Guardando...'; } try { const res = await apiPost({ action: 'saveMaterial', data: { ID_Material: id || '', Nombre: nombre, Priorizable: prio, Activo: activo } }); if (!res.ok) throw new Error(res.error); showToast(id ? 'Material actualizado ✓' : 'Material creado ✓'); cerrarModal(); const mats = await apiGet({ action: 'getMateriales' }); if (mats.ok) CAT.materiales = mats.data; renderMateriales(); } catch (e) { showToast('Error al guardar'); } finally { if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-check"></i> Guardar'; } } }
function renderAjustes() { document.getElementById('config-tab-content').innerHTML = `<div class="config-section"><div class="config-section-head"><div class="config-section-title"><i class="ti ti-settings-2"></i> Ajustes generales</div></div><div class="config-section-body"><div class="form-group"><label class="form-label">ID Carpeta raíz Drive</label><input type="text" class="form-input" value="${DRIVE_FOLDER_ROOT}" readonly style="background:#f8fbfd;color:var(--tm);font-size:12px;font-family:monospace"><div class="form-hint">Carpeta raíz donde se organizan las evidencias por asociación.</div></div><div style="margin-top:8px"><a href="https://drive.google.com/drive/folders/${DRIVE_FOLDER_ROOT}" target="_blank" class="btn btn-glass btn-sm"><i class="ti ti-folder"></i> Abrir en Drive</a></div><div style="margin-top:24px;padding-top:20px;border-top:1px solid var(--border)"><div class="form-label" style="margin-bottom:6px">Apps Script URL</div><div style="font-size:11px;font-family:monospace;color:var(--tm);word-break:break-all;background:#f8fbfd;padding:10px;border-radius:var(--radius-sm);border:1px solid var(--border)">${SCRIPT_URL}</div></div><div style="margin-top:24px;padding-top:20px;border-top:1px solid var(--border)"><div style="font-size:13px;font-weight:600;color:var(--tm)">ReCircula 360 · v2.0 · 2026</div><div style="font-size:12px;color:var(--tl);margin-top:2px">Redes Con Rostro</div></div></div></div>`; }

// ==================== INICIALIZACIÓN ====================
window.addEventListener('load', async () => {
  if (recuperarSesion()) {
    mostrarLoading();
    await cargarCatalogos();
    mostrarApp();
    const iniciales = SESSION.nombre.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    document.getElementById('user-avatar').textContent = iniciales;
    document.getElementById('user-name').textContent = SESSION.nombre;
    document.getElementById('user-role').textContent = SESSION.rol;
    if (SESSION.rol === 'Admin') document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
    navTo('dashboard');
  } else {
    mostrarLogin();
  }
});
