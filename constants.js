// ============================================================
// CONSTANTES GLOBALES Y FUNCIONES DE FORMATO (helpers puras)
// ============================================================

// URLs y config
export const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzoOqPPbbOGh894CiDXny-8l44vp7JhluXcdORGz6s4dx_JDgOSX2ZXsPpGxfBJ59XK/exec';
export const G_CLIENT_ID = '783730193199-d7nhahv3ou4rmps7nrpoop5cpor079ej.apps.googleusercontent.com';
export const DOMAIN = 'redesconrostro.org';
export const DRIVE_FOLDER_ROOT = '1AQyBa9AAdVzukBaZxWa7jpSN2DYkoFhv';

// Metadatos
export const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
export const PROVINCIAS = ['El Oro','Guayas','Manabí','Sucumbíos','Pichincha','Chimborazo'];
export const COLORES_PROV = {
  'El Oro': '#002343',
  'Guayas': '#00bda4',
  'Manabí': '#079fff',
  'Sucumbíos': '#f5ad21',
  'Pichincha': '#9fda60',
  'Chimborazo': '#f82d72'
};
export const METAS = { PET: 811, Suave: 248, Duro: 377 };

// Funciones de formato (no dependen del DOM)
export function fmtNum(n, dec = 2) {
  if (!n && n !== 0) return '—';
  return parseFloat(n).toLocaleString('es-EC', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export function fmtMoney(n) {
  if (!n && n !== 0) return '—';
  return '$' + parseFloat(n).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtTN(n) {
  if (!n && n !== 0) return '—';
  return fmtNum(n) + ' TN';
}

export function fmtFecha(f) {
  if (!f) return '—';
  const d = new Date(f);
  if (isNaN(d)) return f;
  return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function nivelBadge(nivel) {
  const map = {
    'Nivel 1': 'badge-blue',
    'Nivel 2': 'badge-green',
    'Nivel 3': 'badge-warn',
    'Transformador': 'badge-cyan'
  };
  const cls = map[nivel] || 'badge-blue';
  return `<span class="badge ${cls}">${nivel || '—'}</span>`;
}

// Debounce helper
export function debounce(fn, delay) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}
