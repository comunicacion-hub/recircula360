// ============================================================
// RECIRCULA 360 — asociaciones.js
// Gestión de asociaciones recicladores
// ============================================================

let ASOC_DATA   = [];
let ASOC_BUSCAR = '';
let ASOC_ESTADO = '';

// ============================================================
// RENDER PRINCIPAL
// ============================================================

async function renderAsociaciones() {
  document.getElementById('topbar-actions').innerHTML = `
    <button class="btn btn-primary" onclick="abrirFormAsociacion()">
      <i class="ti ti-plus"></i> Nueva asociación
    </button>
  `;

  const content = document.getElementById('main-content');
  content.innerHTML = `
    <!-- Filtros -->
    <div class="filters-bar">
      <span class="filter-label-inline"><i class="ti ti-adjustments-horizontal"></i> Filtros</span>
      <div class="filter-divider"></div>
      <input type="text" class="filter-select-sm" id="asoc-buscar"
        placeholder="Buscar asociación..." oninput="buscarAsociacion(this.value)"
        style="min-width:200px">
      <select class="filter-select-sm" id="asoc-estado-f" onchange="filtrarEstadoAsoc(this.value)">
        <option value="">Todos los estados</option>
        <option value="Activa">Activa</option>
        <option value="Inactiva">Inactiva</option>
      </select>
      <button class="btn-reset-filters" onclick="resetFiltrosAsoc()">
        <i class="ti ti-x"></i> Limpiar
      </button>
    </div>

    <!-- Contenido -->
    <div id="asoc-content">
      <div style="display:flex;align-items:center;justify-content:center;padding:60px;gap:16px">
        <div class="spinner"></div>
        <span style="color:var(--tm)">Cargando asociaciones...</span>
      </div>
    </div>
  `;

  await cargarAsociaciones();
}

// ============================================================
// CARGAR DATOS
// ============================================================

async function cargarAsociaciones() {
  try {
    const res = await apiGet({ action: 'getAsociaciones' });
    // También traer inactivas para admin
    const resAll = await apiGet({ action: 'getAllAsociaciones' });
    ASOC_DATA = resAll.ok ? resAll.data : (res.ok ? res.data : []);
    if (res.ok) CAT.asociaciones = res.data; // actualizar catálogo activas
    renderTablaAsociaciones();
  } catch(e) {
    console.error(e);
    showToast('Error cargando asociaciones');
  }
}

function buscarAsociacion(val) {
  ASOC_BUSCAR = val.toLowerCase();
  renderTablaAsociaciones();
}

function filtrarEstadoAsoc(val) {
  ASOC_ESTADO = val;
  renderTablaAsociaciones();
}

function resetFiltrosAsoc() {
  ASOC_BUSCAR = '';
  ASOC_ESTADO = '';
  const b = document.getElementById('asoc-buscar');
  const e = document.getElementById('asoc-estado-f');
  if (b) b.value = '';
  if (e) e.value = '';
  renderTablaAsociaciones();
}

// ============================================================
// TABLA
// ============================================================

function renderTablaAsociaciones() {
  const wrap = document.getElementById('asoc-content');
  if (!wrap) return;

  let data = ASOC_DATA;
  if (ASOC_BUSCAR) data = data.filter(a => (a['Nombre']||'').toLowerCase().includes(ASOC_BUSCAR));
  if (ASOC_ESTADO) data = data.filter(a => a['Estado'] === ASOC_ESTADO);

  if (!data.length) {
    wrap.innerHTML = `
      <div style="text-align:center;padding:60px;color:var(--tl)">
        <i class="ti ti-building-community" style="font-size:40px;display:block;margin-bottom:12px"></i>
        No hay asociaciones registradas
      </div>`;
    return;
  }

  const filas = data.map(a => {
    const tieneCarpeta = a['ID_Carpeta_Drive'];
    const estadoBadge  = a['Estado'] === 'Activa'
      ? '<span class="badge badge-green">Activa</span>'
      : '<span class="badge badge-warn">Inactiva</span>';

    return `
      <tr>
        <td style="font-weight:600;color:var(--b1)">${a['Nombre'] || '—'}</td>
        <td>${a['Provincia'] || '—'}</td>
        <td>${a['Ciudad'] || '—'}</td>
        <td style="font-size:12px;color:var(--tm)">${a['Tipo'] || '—'}</td>
        <td style="text-align:center;font-weight:600">${a['Numero de Recicladores'] || '—'}</td>
        <td>${estadoBadge}</td>
        <td>
          ${tieneCarpeta
            ? `<a href="https://drive.google.com/drive/folders/${a['ID_Carpeta_Drive']}"
                target="_blank" class="btn btn-glass btn-sm">
                <i class="ti ti-folder"></i> Ver Drive
               </a>`
            : `<button class="btn btn-glass btn-sm" onclick="crearCarpetaAsociacion('${a['ID_Asociacion']}','${a['Nombre'].replace(/'/g,"\\'")}')">
                <i class="ti ti-folder-plus"></i> Crear carpeta
               </button>`
          }
        </td>
        <td>
          <div class="td-actions">
            <button class="btn btn-glass btn-sm" onclick="verAsociacion('${a['ID_Asociacion']}')">
              <i class="ti ti-eye"></i>
            </button>
            <button class="btn btn-primary btn-sm" onclick="abrirFormAsociacion('${a['ID_Asociacion']}')">
              <i class="ti ti-pencil"></i>
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');

  wrap.innerHTML = `
    <div class="card" style="padding:0">
      <div class="table-wrap" style="border:none;border-radius:var(--radius-lg)">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Provincia</th>
              <th>Ciudad</th>
              <th>Tipo</th>
              <th style="text-align:center">Recicladores</th>
              <th>Estado</th>
              <th>Carpeta Drive</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${filas}</tbody>
        </table>
      </div>
    </div>
    <div style="font-size:12px;color:var(--tl);text-align:right">
      ${data.length} asociación${data.length !== 1 ? 'es' : ''}
    </div>
  `;
}

// ============================================================
// VER DETALLE
// ============================================================

function verAsociacion(id) {
  const a = ASOC_DATA.find(x => x['ID_Asociacion'] === id);
  if (!a) return;

  abrirModal(`
    <div class="modal">
      <div class="modal-head">
        <div class="modal-title">${a['Nombre']}</div>
        <button class="modal-close" onclick="cerrarModal()"><i class="ti ti-x"></i></button>
      </div>
      <div class="modal-body">
        <div class="form-grid-2">
          <div>
            <div class="form-label">Provincia</div>
            <div style="font-size:14px;margin-top:4px">${a['Provincia'] || '—'}</div>
          </div>
          <div>
            <div class="form-label">Ciudad</div>
            <div style="font-size:14px;margin-top:4px">${a['Ciudad'] || '—'}</div>
          </div>
          <div>
            <div class="form-label">Tipo</div>
            <div style="font-size:14px;margin-top:4px">${a['Tipo'] || '—'}</div>
          </div>
          <div>
            <div class="form-label">Estado</div>
            <div style="margin-top:4px">
              ${a['Estado'] === 'Activa'
                ? '<span class="badge badge-green">Activa</span>'
                : '<span class="badge badge-warn">Inactiva</span>'}
            </div>
          </div>
          <div>
            <div class="form-label">Número de recicladores</div>
            <div style="font-size:20px;font-weight:700;color:var(--b1);margin-top:4px">
              ${a['Numero de Recicladores'] || '—'}
            </div>
          </div>
          <div>
            <div class="form-label">Fecha ingreso</div>
            <div style="font-size:14px;margin-top:4px">${fmtFecha(a['Fecha Ingreso']) || '—'}</div>
          </div>
        </div>

        ${a['Observaciones'] ? `
          <div style="margin-top:16px">
            <div class="form-label">Observaciones</div>
            <div style="font-size:13px;color:var(--tm);margin-top:4px">${a['Observaciones']}</div>
          </div>` : ''}

        <div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap">
          ${a['ID_Carpeta_Drive']
            ? `<a href="https://drive.google.com/drive/folders/${a['ID_Carpeta_Drive']}"
                target="_blank" class="btn btn-glass">
                <i class="ti ti-folder"></i> Ver carpeta Drive
               </a>`
            : `<button class="btn btn-glass" onclick="cerrarModal();crearCarpetaAsociacion('${a['ID_Asociacion']}','${a['Nombre'].replace(/'/g,"\\'")}')">
                <i class="ti ti-folder-plus"></i> Crear carpeta Drive
               </button>`}
          <button class="btn btn-primary" onclick="cerrarModal();abrirFormAsociacion('${a['ID_Asociacion']}')">
            <i class="ti ti-pencil"></i> Editar
          </button>
        </div>
      </div>
    </div>
  `);
}

// ============================================================
// FORMULARIO NUEVA / EDITAR
// ============================================================

function abrirFormAsociacion(id = null) {
  const a = id ? ASOC_DATA.find(x => x['ID_Asociacion'] === id) : null;

  abrirModal(`
    <div class="modal">
      <div class="modal-head">
        <div class="modal-title">${a ? 'Editar asociación' : 'Nueva asociación'}</div>
        <button class="modal-close" onclick="cerrarModal()"><i class="ti ti-x"></i></button>
      </div>
      <div class="modal-body">

        <div class="form-group">
          <label class="form-label">Nombre *</label>
          <input type="text" class="form-input" id="aso-nombre"
            placeholder="Nombre de la asociación" value="${a?.['Nombre'] || ''}">
        </div>

        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">Provincia</label>
            <select class="form-select" id="aso-provincia">
              ${['El Oro','Guayas','Manabí','Sucumbíos','Pichincha','Chimborazo','Otra'].map(p =>
                `<option value="${p}" ${a?.['Provincia']===p?'selected':''}>${p}</option>`
              ).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Ciudad</label>
            <input type="text" class="form-input" id="aso-ciudad"
              placeholder="Ciudad" value="${a?.['Ciudad'] || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Tipo</label>
            <select class="form-select" id="aso-tipo">
              ${['Formal','Colectivo','Grupo'].map(t =>
                `<option value="${t}" ${a?.['Tipo']===t?'selected':''}>${t}</option>`
              ).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Estado</label>
            <select class="form-select" id="aso-estado">
              <option value="Activa"   ${(!a || a?.['Estado']==='Activa')  ?'selected':''}>Activa</option>
              <option value="Inactiva" ${a?.['Estado']==='Inactiva'?'selected':''}>Inactiva</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Número de recicladores</label>
          <input type="number" class="form-input" id="aso-recicladores" min="0"
            placeholder="0" value="${a?.['Numero de Recicladores'] || ''}">
        </div>

        <div class="form-group">
          <label class="form-label">Observaciones</label>
          <textarea class="form-textarea" id="aso-obs"
            placeholder="Notas adicionales...">${a?.['Observaciones'] || ''}</textarea>
        </div>

      </div>
      <div class="modal-foot">
        <button class="btn btn-glass" onclick="cerrarModal()">Cancelar</button>
        <button class="btn btn-primary" id="btn-guardar-aso" onclick="guardarAsociacion('${id || ''}')">
          <i class="ti ti-check"></i> ${a ? 'Actualizar' : 'Guardar'}
        </button>
      </div>
    </div>
  `);
}

// ============================================================
// GUARDAR
// ============================================================

async function guardarAsociacion(id) {
  const nombre       = document.getElementById('aso-nombre')?.value?.trim();
  const provincia    = document.getElementById('aso-provincia')?.value;
  const ciudad       = document.getElementById('aso-ciudad')?.value?.trim();
  const tipo         = document.getElementById('aso-tipo')?.value;
  const estado       = document.getElementById('aso-estado')?.value;
  const recicladores = document.getElementById('aso-recicladores')?.value;
  const obs          = document.getElementById('aso-obs')?.value;

  if (!nombre) { showToast('El nombre es obligatorio'); return; }

  const btn = document.getElementById('btn-guardar-aso');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader"></i> Guardando...'; }

  try {
    const data = {
      ID_Asociacion: id || '',
      Nombre: nombre,
      Provincia: provincia,
      Ciudad: ciudad,
      Tipo: tipo,
      Estado: estado,
      'Numero de Recicladores': recicladores,
      Observaciones: obs,
      'Fecha Ingreso': id ? '' : new Date().toISOString().substring(0, 10),
    };

    const res = await apiPost({ action: 'saveAsociacion', data });
    if (!res.ok) { showToast('Error: ' + (res.error || 'desconocido')); return; }

    // Si es nueva, crear carpeta en Drive automáticamente
    if (!id && res.id) {
      showToast('Creando carpeta en Drive...');
      await apiPost({ action: 'crearCarpetaAsoc', idAsociacion: res.id, nombre });
    }

    showToast(id ? 'Asociación actualizada ✓' : 'Asociación creada ✓');
    cerrarModal();
    await cargarAsociaciones();
  } catch(e) {
    console.error(e);
    showToast('Error al guardar');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-check"></i> Guardar'; }
  }
}

// ============================================================
// CREAR CARPETA DRIVE
// ============================================================

async function crearCarpetaAsociacion(idAsociacion, nombre) {
  showToast('Creando carpeta en Drive...');
  try {
    const res = await apiPost({ action: 'crearCarpetaAsoc', idAsociacion, nombre });
    if (res.ok) {
      showToast('Carpeta creada ✓');
      await cargarAsociaciones();
    } else {
      showToast('Error al crear carpeta');
    }
  } catch(e) {
    showToast('Error de conexión');
  }
}
