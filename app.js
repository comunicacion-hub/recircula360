// ============================================================
// RECIRCULA 360 — app.js
// Constantes, API, navegación, helpers globales
// ============================================================

const SCRIPT_URL        = 'https://script.google.com/macros/s/AKfycbzoOqPPbbOGh894CiDXny-8l44vp7JhluXcdORGz6s4dx_JDgOSX2ZXsPpGxfBJ59XK/exec';
const G_CLIENT_ID       = '783730193199-d7nhahv3ou4rmps7nrpoop5cpor079ej.apps.googleusercontent.com';
const DOMAIN            = 'redesconrostro.org';
const DRIVE_FOLDER_ROOT = '1AQyBa9AAdVzukBaZxWa7jpSN2DYkoFhv';
const SHEET_ID          = '1WwvL0kna3SiFrByvlV4kJjJ1An7Dz4OYMDb6SCz8VD0';
const SHEETS_API        = 'https://sheets.googleapis.com/v4/spreadsheets';
const HUB_URL           = 'https://comunicacion-hub.github.io/recirculaapp/';

let SESSION      = null;
let ACCESS_TOKEN = null;
let TOKEN_EXPIRY = 0;

let CAT = {
  asociaciones:      [],
  todasAsociaciones: [],
  compradores:       [],
  materiales:        [],
  accesos:           [],
};

// ============================================================
// SESIÓN — viene del hub
// ============================================================

function recuperarSesion() {
  const s   = sessionStorage.getItem('rcr_session');
  const t   = sessionStorage.getItem('rcr_token');
  const exp = sessionStorage.getItem('rcr_token_exp');
  if (s && t && exp && Date.now() < parseInt(exp)) {
    SESSION      = JSON.parse(s);
    ACCESS_TOKEN = t;
    TOKEN_EXPIRY = parseInt(exp);
    return true;
  }
  return false;
}

function cerrarSesion() {
  const tok = ACCESS_TOKEN;
  sessionStorage.clear();
  cacheClearAll();
  SESSION = null; ACCESS_TOKEN = null;
  CAT = { asociaciones: [], todasAsociaciones: [], compradores: [], materiales: [], accesos: [] };
  try {
    if (tok && window.google?.accounts?.oauth2) {
      google.accounts.oauth2.revoke(tok, () => {});
    }
  } catch(e) {}
  window.location.href = HUB_URL;
}

// ============================================================
// INICIAR APP
// ============================================================

async function iniciarApp() {
  const iniciales = SESSION.nombre.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  document.getElementById('user-avatar').textContent = iniciales;
  document.getElementById('user-name').textContent   = SESSION.nombre;
  document.getElementById('user-role').textContent   = SESSION.rol;

  if (SESSION.rol === 'Admin') {
    document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
  }

  await cargarCatalogos();
  mostrarApp();
  navTo('dashboard');
}

// ============================================================
// CACHÉ
// ============================================================
const CACHE_TTL = 30 * 60 * 1000;

function cacheSet(key, data) {
  try { localStorage.setItem('rcr_' + key, JSON.stringify({ data, ts: Date.now() })); } catch(e) {}
}

function cacheGet(key) {
  try {
    const raw = localStorage.getItem('rcr_' + key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) { localStorage.removeItem('rcr_' + key); return null; }
    return data;
  } catch(e) { return null; }
}

function cacheClear(key) {
  try { localStorage.removeItem('rcr_' + key); } catch(e) {}
}

function cacheClearAll() { cacheClear('cat_todos'); }
function invalidarCache() { cacheClear('cat_todos'); }

async function cargarCatalogos() {
  try {
    const cached = cacheGet('cat_todos');
    if (cached) {
      CAT.asociaciones      = cached.asociaciones      || [];
      CAT.todasAsociaciones = cached.todasAsociaciones || [];
      CAT.compradores       = cached.compradores       || [];
      CAT.materiales        = cached.materiales        || [];
      CAT.accesos           = cached.accesos           || [];
      setTimeout(() => actualizarCatalogos(), 200);
      return;
    }
    await actualizarCatalogos();
  } catch(e) {
    console.error('Error cargando catálogos:', e);
  }
}

async function actualizarCatalogos() {
  try {
    const res = await apiGet({ action: 'getCatalogos', rol: SESSION.rol });
    if (res.ok) {
      CAT.asociaciones      = res.data.asociaciones      || [];
      CAT.todasAsociaciones = res.data.todasAsociaciones || [];
      CAT.compradores       = res.data.compradores       || [];
      CAT.materiales        = res.data.materiales        || [];
      CAT.accesos           = res.data.accesos           || [];
      cacheSet('cat_todos', res.data);
    }
  } catch(e) {
    console.error('Error actualizando catálogos:', e);
  }
}

// ============================================================
// SHEETS API DIRECTA
// ============================================================

async function sheetsGet(sheetName) {
  try {
    const url = `${SHEETS_API}/${SHEET_ID}/values/${encodeURIComponent(sheetName)}`;
    const res = await fetch(url, {
      headers: { Authorization: 'Bearer ' + ACCESS_TOKEN }
    });
    if (!res.ok) throw new Error('Error Sheets API ' + res.status);
    const json = await res.json();
    const rows = json.values || [];
    if (rows.length < 2) return [];
    const headers = rows[0];
    return rows.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i] || ''; });
      return obj;
    });
  } catch(e) {
    console.warn('Sheets API falló:', e.message);
    return null;
  }
}

async function subirDrive(file, folderId, nombre) {
  const metadata = { name: nombre || file.name, parents: [folderId] };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);
  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    { method: 'POST', headers: { Authorization: 'Bearer ' + ACCESS_TOKEN }, body: form }
  );
  return res.json();
}

// ============================================================
// API HELPERS
// ============================================================

async function apiGet(params) {
  const qs  = new URLSearchParams(params).toString();
  const res = await fetch(SCRIPT_URL + '?' + qs);
  if (!res.ok) throw new Error('Error HTTP ' + res.status);
  return res.json();
}

async function apiPost(body) {
  const res = await fetch(SCRIPT_URL, {
    method: 'POST',
    body:   JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Error HTTP ' + res.status);
  return res.json();
}

// ============================================================
// NAVEGACIÓN
// ============================================================

function navTo(seccion) {
  closeSidebarOnNav();
  document.querySelectorAll('.sb-item').forEach(el => el.classList.remove('active'));
  const navEl = document.getElementById('nav-' + seccion);
  if (navEl) navEl.classList.add('active');

  const titulos = {
    dashboard:     { titulo: '' },
    entregas:      { titulo: 'Entregas' },
    asociaciones:  { titulo: 'Asociaciones' },
    accesos:       { titulo: 'Accesos' },
    configuracion: { titulo: 'Configuración' },
  };

  const info = titulos[seccion] || { titulo: seccion };
  document.getElementById('topbar-title').textContent = info.titulo;
  document.getElementById('topbar-sub').textContent   =
    seccion === 'dashboard' ? 'Bienvenido, ' + SESSION.nombre.split(' ')[0] + ' 👋' : '';

  document.getElementById('main-content').innerHTML   = '';
  document.getElementById('topbar-actions').innerHTML = '';

  switch (seccion) {
    case 'dashboard':     renderDashboard();     break;
    case 'entregas':      renderEntregas();      break;
    case 'asociaciones':  renderAsociaciones();  break;
    case 'accesos':       renderAccesos();       break;
    case 'configuracion': renderConfiguracion(); break;
    default:
      document.getElementById('main-content').innerHTML =
        '<div class="card"><p style="color:var(--tm)">Sección no encontrada.</p></div>';
  }
}

// ============================================================
// UI HELPERS
// ============================================================

function mostrarLoading() {
  const el  = document.getElementById('screen-loading');
  const app = document.getElementById('screen-app');
  if (el)  el.classList.remove('hidden');
  if (app) app.classList.add('hidden');
}

function mostrarApp() {
  const el  = document.getElementById('screen-loading');
  const app = document.getElementById('screen-app');
  if (el)  el.classList.add('hidden');
  if (app) app.classList.remove('hidden');
}

function showToast(msg, dur = 3500) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  if (showToast._tid) clearTimeout(showToast._tid);
  showToast._tid = setTimeout(() => t.classList.remove('show'), dur);
}

function toggleSidebar(forceState) {
  const sb = document.getElementById('sidebar');
  const bd = document.getElementById('sidebar-backdrop');
  if (!sb) return;
  const willOpen = forceState !== undefined ? forceState : !sb.classList.contains('open');
  sb.classList.toggle('open', willOpen);
  if (bd) {
    if (willOpen) {
      bd.style.display = 'block';
      requestAnimationFrame(() => { bd.style.opacity = '1'; bd.style.pointerEvents = 'auto'; });
    } else {
      bd.style.opacity = '0';
      bd.style.pointerEvents = 'none';
      setTimeout(() => { bd.style.display = 'none'; }, 260);
    }
  }
}

function closeSidebarOnNav() {
  if (window.matchMedia('(max-width: 768px)').matches) toggleSidebar(false);
}

function abrirModal(html) {
  cerrarModal(true);
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id        = 'modal-overlay';
  overlay.innerHTML = html;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrarModal(); });
  document.body.appendChild(overlay);
  setTimeout(() => {
    const first = overlay.querySelector('input:not([readonly]):not([type="file"]), select, textarea');
    if (first) try { first.focus({ preventScroll: true }); } catch(e) {}
  }, 60);
}

function cerrarModal(immediate = false) {
  const m = document.getElementById('modal-overlay');
  if (!m) return;
  if (immediate) { m.remove(); return; }
  m.classList.add('closing');
  setTimeout(() => m.remove(), 180);
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (document.getElementById('modal-overlay')) cerrarModal();
    else if (document.getElementById('sidebar')?.classList.contains('open')) toggleSidebar(false);
  }
});

// ── Formateo ─────────────────────────────────────────────────
function fmtNum(n, dec = 2) {
  if (!n && n !== 0) return '—';
  return parseFloat(n).toLocaleString('es-EC', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}

function fmtMoney(n) {
  if (!n && n !== 0) return '—';
  return '$' + parseFloat(n).toLocaleString('es-EC', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtFecha(f) {
  if (!f) return '—';
  if (typeof f === 'string' && /^\d{4}-\d{2}-\d{2}/.test(f)) {
    const [y, m, d] = f.substring(0,10).split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    if (!isNaN(dt)) return dt.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  const d = new Date(f);
  if (isNaN(d)) return f;
  return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
}

function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function debounce(fn, ms = 250) {
  let t;
  return function(...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}

function nivelBadge(nivel) {
  const map = {
    'Nivel 1': 'badge-blue', 'Nivel 2': 'badge-green',
    'Nivel 3': 'badge-warn', 'Transformador': 'badge-cyan',
  };
  return `<span class="badge ${map[nivel]||'badge-blue'}">${nivel || '—'}</span>`;
}

// ============================================================
// INICIO
// ============================================================
window.addEventListener('load', async () => {
  if (recuperarSesion()) {
    mostrarLoading();
    await iniciarApp();
  } else {
    window.location.href = HUB_URL;
  }
});
