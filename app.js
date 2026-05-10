// ============================================================
// RECIRCULA 360 — app.js
// Constantes, API, navegación, helpers globales
// ============================================================

// ── Constantes ───────────────────────────────────────────────
const SCRIPT_URL   = 'https://script.google.com/macros/s/AKfycbzoOqPPbbOGh894CiDXny-8l44vp7JhluXcdORGz6s4dx_JDgOSX2ZXsPpGxfBJ59XK/exec';
const G_CLIENT_ID  = '783730193199-d7nhahv3ou4rmps7nrpoop5cpor079ej.apps.googleusercontent.com';
const DOMAIN       = 'redesconrostro.org';
const DRIVE_FOLDER_ROOT = '1AQyBa9AAdVzukBaZxWa7jpSN2DYkoFhv';

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
  const client = google.accounts.oauth2.initTokenClient({
    client_id: G_CLIENT_ID,
    scope: 'email profile https://www.googleapis.com/auth/drive.file',
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
  sessionStorage.clear();
  SESSION      = null;
  ACCESS_TOKEN = null;
  CAT          = { asociaciones: [], compradores: [], materiales: [], accesos: [] };
  mostrarLogin();
  try { google.accounts.id.disableAutoSelect(); } catch(e) {}
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

async function cargarCatalogos() {
  try {
    const [asos, coms, mats, accs] = await Promise.all([
      apiGet({ action: 'getAsociaciones' }),
      apiGet({ action: 'getCompradores' }),
      apiGet({ action: 'getMateriales' }),
      apiGet({ action: 'getAccesos', rol: SESSION.rol }),
    ]);
    if (asos.ok) CAT.asociaciones = asos.data;
    if (coms.ok) CAT.compradores  = coms.data;
    if (mats.ok) CAT.materiales   = mats.data;
    if (accs.ok) CAT.accesos      = accs.data;
  } catch(e) {
    console.error('Error cargando catálogos:', e);
  }
}

// ============================================================
// NAVEGACIÓN
// ============================================================

function navTo(seccion) {
  // Actualizar sidebar
  document.querySelectorAll('.sb-item').forEach(el => el.classList.remove('active'));
  const navEl = document.getElementById('nav-' + seccion);
  if (navEl) navEl.classList.add('active');

  // Títulos por sección
  const titulos = {
    dashboard:     { titulo: 'Dashboard ambiental',        sub: null },
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
      : (info.sub || '');

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
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), dur);
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ── Modales ──────────────────────────────────────────────────
function abrirModal(html) {
  cerrarModal(); // cerrar cualquier modal abierto
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id        = 'modal-overlay';
  overlay.innerHTML = html;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) cerrarModal();
  });
  document.body.appendChild(overlay);
}

function cerrarModal() {
  const m = document.getElementById('modal-overlay');
  if (m) m.remove();
}

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
  const d = new Date(f);
  if (isNaN(d)) return f;
  return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
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

    // Reconstruir UI del usuario
    const iniciales = SESSION.nombre.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    document.getElementById('user-avatar').textContent = iniciales;
    document.getElementById('user-name').textContent   = SESSION.nombre;
    document.getElementById('user-role').textContent   = SESSION.rol;
    if (SESSION.rol === 'Admin') {
      document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
    }

    navTo('dashboard');
  } else {
    mostrarLogin();
  }
});
