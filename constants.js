// ============================================================
// CONSTANTES GLOBALES Y FUNCIONES DE FORMATO
// ============================================================

// URLs y config (YA CON TU URL REAL)
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzoOqPPbbOGh894CiDXny-8l44vp7JhluXcdORGz6s4dx_JDgOSX2ZXsPpGxfBJ59XK/exec';
const G_CLIENT_ID = '783730193199-d7nhahv3ou4rmps7nrpoop5cpor079ej.apps.googleusercontent.com';
const DOMAIN = 'redesconrostro.org';
const DRIVE_FOLDER_ROOT = '1AQyBa9AAdVzukBaZxWa7jpSN2DYkoFhv';

// Metadatos
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

// Funciones de formato (puras)
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
