// app.js
// ============================================================
// ============================================================
// RECIRCULA 360 — app.js
// Constantes, API, navegación, helpers globales
// ============================================================

// ── Constantes ───────────────────────────────────────────────
const SCRIPT_URL   = 'https://script.google.com/macros/s/AKfycbzoOqPPbbOGh894CiDXny-8l44vp7JhluXcdORGz6s4dx_JDgOSX2ZXsPpGxfBJ59XK/exec';
const G_CLIENT_ID  = '783730193199-d7nhahv3ou4rmps7nrpoop5cpor079ej.apps.googleusercontent.com';
const DOMAIN       = 'redesconrostro.org';
const DRIVE_FOLDER_ROOT = '1AQyBa9AAdVzukBaZxWa7jpSN2DYkoFhv';
const SHEET_ID = '1WwvL0kna3SiFrByvlV4kJjJ1An7Dz4OYMDb6SCz8VD0';
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

// ── Estado global ────────────────────────────────────────────
let SESSION      = null;
let ACCESS_TOKEN = null;
let TOKEN_EXPIRY = 0;

// Catálogos en memoria (se cargan al iniciar)
let CAT = {
  asociaciones: [],
  compradores:  [],
  materiales:   [],
  accesos:      [],
};

// ============================================================
// LOGIN / OAUTH
// ============================================================

function iniciarLogin() {
  if (!window.google?.accounts?.oauth2) {
    showToast('Google aún no carga. Espera un momento.');
    return;
  }
  const client = google.accounts.oauth2.initTokenClient({
    client_id: G_CLIENT_ID,
    // ↳ se añade scope de Sheets readonly para que sheetsGet() funcione
    scope: 'email profile https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets.readonly',
    callback: async (resp) => {
      if (resp.error) { showToast('Error al iniciar sesión'); return; }
      ACCESS_TOKEN = resp.access_token;
      TOKEN_EXPIRY = Date.now() + (resp.expires_in - 60) * 1000;
      await verificarUsuario();
    },
  });
  client.requestAccessToken();
}

async function verificarUsuario() {
  mostrarLoading();
  try {
    // Obtener info del usuario desde Google
    const res  = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: 'Bearer ' + ACCESS_TOKEN }
    });
    const info = await res.json();

    // Validar dominio
    if (!info.email.endsWith('@' + DOMAIN)) {
      showToast('Solo cuentas @' + DOMAIN + ' tienen acceso');
      mostrarLogin();
      return;
    }

    // Verificar usuario en el Sheet
    const data = await apiGet({ action: 'getUsuario', email: info.email });
    if (!data.ok) {
      showToast('Usuario no autorizado. Contacta al administrador.');
      mostrarLogin();
      return;
    }

    SESSION = {
      nombre: data.data.nombre || info.given_name,
      email:  info.email,
      rol:    data.data.rol,
      foto:   info.picture,
    };

    // Guardar sesión
    sessionStorage.setItem('rcr_session',   JSON.stringify(SESSION));
    sessionStorage.setItem('rcr_token',     ACCESS_TOKEN);
    sessionStorage.setItem('rcr_token_exp', TOKEN_EXPIRY);

    await iniciarApp();
  } catch (e) {
    console.error(e);
    showToast('Error de conexión. Intenta de nuevo.');
    mostrarLogin();
  }
}

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
  SESSION      = null;
  ACCESS_TOKEN = null;
  CAT          = { asociaciones: [], compradores: [], materiales: [], accesos: [] };
  mostrarLogin();
  try {
    if (tok && window.google?.accounts?.oauth2) {
      google.accounts.oauth2.revoke(tok, () => {});
    }
  } catch(e) {}
}

// ============================================================
// INICIAR APP
// ============================================================

async function iniciarApp() {
  // Iniciales del avatar
  const iniciales = SESSION.nombre
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  document.getElementById('user-avatar').textContent = iniciales;
  document.getElementById('user-name').textContent   = SESSION.nombre;
  document.getElementById('user-role').textContent   = SESSION.rol;

  // Mostrar Configuración solo para Admin
  if (SESSION.rol === 'Admin') {
    document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
  }

  // Cargar catálogos
  await cargarCatalogos();

  // Mostrar app e ir al dashboard
  mostrarApp();
  navTo('dashboard');
}

// ============================================================
// CACHÉ LOCAL CON TTL
// ============================================================
const CACHE_TTL = 30 * 60 * 1000; // 30 minutos

function cacheSet(key, data) {
  try {
    localStorage.setItem('rcr_' + key, JSON.stringify({ data, ts: Date.now() }));
  } catch(e) {}
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

function cacheClearAll() {
  cacheClear('cat_todos');
}

async function cargarCatalogos() {
  try {
    // Leer desde caché primero
    const cached = cacheGet('cat_todos');
    if (cached) {
      CAT.asociaciones      = cached.asociaciones      || [];
      CAT.todasAsociaciones = cached.todasAsociaciones || [];
      CAT.compradores       = cached.compradores       || [];
      CAT.materiales        = cached.materiales        || [];
      CAT.accesos           = cached.accesos           || [];
      // Actualizar en segundo plano
      setTimeout(() => actualizarCatalogosBackground(), 200);
      return;
    }
    // Sin caché — cargar una sola llamada
    await actualizarCatalogos();
  } catch(e) {
    console.error('Error cargando catálogos:', e);
  }
}

async function actualizarCatalogos() {
  try {
    // Una sola llamada para todos los catálogos
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

async function actualizarCatalogosBackground() {
  await actualizarCatalogos();
}

// Invalidar caché después de guardar datos
function invalidarCache(tipo) {
  cacheClear('cat_todos'); // Invalida todo para que recargue fresco
}

// ============================================================
// SHEETS API DIRECTA — Lectura rápida
// ============================================================

async function sheetsGet(sheetName, filtros = {}) {
  try {
    const url = `${SHEETS_API}/${SHEET_ID}/values/${encodeURIComponent(sheetName)}`;
    const res = await fetch(url, {
      headers: { Authorization: 'Bearer ' + ACCESS_TOKEN }
    });
    if (!res.ok) throw new Error('Error Sheets API');
    const json = await res.json();
    const rows = json.values || [];
    if (rows.length < 2) return [];
    const headers = rows[0];
    let data = rows.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i] || ''; });
      return obj;
    });
    // Aplicar filtros
    Object.entries(filtros).forEach(([key, val]) => {
      if (val) data = data.filter(r => r[key] === val);
    });
    return data;
 } catch(e) {
    console.warn('Sheets API falló, renovando token...');
    await renovarToken();
    return null;
  }
}
function renovarToken() {
  return new Promise((resolve) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: G_CLIENT_ID,
      scope: 'email profile https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets.readonly',
      callback: (resp) => {
        if (!resp.error) {
          ACCESS_TOKEN = resp.access_token;
          TOKEN_EXPIRY = Date.now() + (resp.expires_in - 60) * 1000;
          sessionStorage.setItem('rcr_token', ACCESS_TOKEN);
          sessionStorage.setItem('rcr_token_exp', TOKEN_EXPIRY);
        }
        resolve();
      },
    });
    client.requestAccessToken();
  });
}
// ============================================================
// NAVEGACIÓN
// ============================================================

function navTo(seccion) {
  // En móvil, cerrar el sidebar al navegar
  closeSidebarOnNav();

  // Actualizar sidebar
  document.querySelectorAll('.sb-item').forEach(el => el.classList.remove('active'));
  const navEl = document.getElementById('nav-' + seccion);
  if (navEl) navEl.classList.add('active');

  // Títulos por sección
  const titulos = {
    dashboard:     { titulo: '', sub: null },
    entregas:      { titulo: 'Entregas',                   sub: 'Registro de entregas de material' },
    asociaciones:  { titulo: 'Asociaciones',               sub: 'Gestión de asociaciones recicladores' },
    accesos:       { titulo: 'Accesos',                    sub: 'Links y recursos del equipo' },
    configuracion: { titulo: 'Configuración',              sub: 'Solo administradores' },
  };

  const info = titulos[seccion] || { titulo: seccion, sub: '' };
  document.getElementById('topbar-title').textContent = info.titulo;
  document.getElementById('topbar-sub').textContent   =
    seccion === 'dashboard'
      ? 'Bienvenido, ' + SESSION.nombre.split(' ')[0] + ' 👋'
      : '';

  // Limpiar contenido y acciones
  document.getElementById('main-content').innerHTML    = '';
  document.getElementById('topbar-actions').innerHTML  = '';

  // Renderizar sección
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

// Subir archivo directo a Drive con token OAuth
async function subirDrive(file, folderId, nombre) {
  const metadata = {
    name:    nombre || file.name,
    parents: [folderId],
  };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method:  'POST',
      headers: { Authorization: 'Bearer ' + ACCESS_TOKEN },
      body:    form,
    }
  );
  return res.json();
}

// ============================================================
// UI HELPERS
// ============================================================

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
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  if (showToast._tid) clearTimeout(showToast._tid);
  showToast._tid = setTimeout(() => t.classList.remove('show'), dur);
}

function toggleSidebar(forceState) {
  const sb = document.getElementById('sidebar');
  const bd = document.getElementById('sidebar-backdrop');
  const willOpen = forceState !== undefined ? forceState : !sb.classList.contains('open');
  sb.classList.toggle('open', willOpen);
  if (bd) {
    if (willOpen) { bd.style.display = 'block'; requestAnimationFrame(() => bd.style.opacity = '1'); bd.style.pointerEvents = 'auto'; }
    else { bd.style.opacity = '0'; bd.style.pointerEvents = 'none'; setTimeout(() => { bd.style.display = 'none'; }, 260); }
  }
}
function closeSidebarOnNav() {
  if (window.matchMedia('(max-width: 768px)').matches) toggleSidebar(false);
}

// ── Modales ──────────────────────────────────────────────────
function abrirModal(html) {
  cerrarModal(true);
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id        = 'modal-overlay';
  overlay.innerHTML = html;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) cerrarModal();
  });
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

// Esc cierra modal o sidebar móvil
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

function fmtTN(n) {
  if (!n && n !== 0) return '—';
  return fmtNum(n) + ' TN';
}

function fmtFecha(f) {
  if (!f) return '—';
  // Manejar 'YYYY-MM-DD' como fecha local (evita salto de día por zona horaria)
  if (typeof f === 'string' && /^\d{4}-\d{2}-\d{2}/.test(f)) {
    const [y, m, d] = f.substring(0,10).split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    if (!isNaN(dt)) return dt.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  const d = new Date(f);
  if (isNaN(d)) return f;
  return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Escape seguro para inserción en HTML (previene XSS y crashes con comillas)
function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Debounce
function debounce(fn, ms = 250) {
  let t;
  return function(...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}

// ── Helpers de listas ─────────────────────────────────────────
function optionsFromArray(arr, valField, labelField, selectedVal = '') {
  return arr.map(item =>
    `<option value="${item[valField]}" ${item[valField] === selectedVal ? 'selected' : ''}>
      ${item[labelField]}
    </option>`
  ).join('');
}

// ── Nivel de intermediación → badge ──────────────────────────
function nivelBadge(nivel) {
  const map = {
    'Nivel 1': 'badge-blue',
    'Nivel 2': 'badge-green',
    'Nivel 3': 'badge-warn',
    'Transformador': 'badge-cyan',
  };
  const cls = map[nivel] || 'badge-blue';
  return `<span class="badge ${cls}">${nivel || '—'}</span>`;
}

// ============================================================
// INICIO — verificar sesión al cargar
// ============================================================
window.addEventListener('load', async () => {
  if (recuperarSesion()) {
    mostrarLoading();
    await cargarCatalogos();
    mostrarApp();
    const iniciales = SESSION.nombre.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();
    document.getElementById('user-avatar').textContent = iniciales;
    document.getElementById('user-name').textContent   = SESSION.nombre;
    document.getElementById('user-role').textContent   = SESSION.rol;
    if (SESSION.rol === 'Admin') {
      document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
    }
    navTo('dashboard');
  } else {
    // Sin sesión → redirigir al hub
    window.location.href = 'https://comunicacion-hub.github.io/recirculaapp/';
  }
});
