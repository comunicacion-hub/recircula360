// accesos.js
// ============================================================
// ============================================================
// RECIRCULA 360 — accesos.js
// Panel de links y recursos del equipo
// ============================================================

let ACCESOS_CAT_ACTIVA = 'Todos';

// ============================================================
// RENDER PRINCIPAL
// ============================================================

async function renderAccesos() {
  // Botón agregar (solo admin)
  if (SESSION.rol === 'Admin') {
    document.getElementById('topbar-actions').innerHTML = `
      <button class="btn btn-primary" onclick="abrirFormAcceso()">
        <i class="ti ti-plus"></i> Nuevo acceso
      </button>
    `;
  }

  const content = document.getElementById('main-content');

  // Obtener categorías únicas
  const categorias = ['Todos', ...new Set(CAT.accesos.map(a => a['Categoría']).filter(Boolean))];

  content.innerHTML = `
    <!-- Chips de categoría -->
    <div class="cat-chips">
      ${categorias.map(c => `
        <div class="cat-chip ${c === ACCESOS_CAT_ACTIVA ? 'active' : ''}"
          onclick="filtrarAccesos('${c}')">
          ${c}
        </div>
      `).join('')}
    </div>

    <!-- Grid de accesos -->
    <div id="accesos-grid-wrap">
      ${renderGridAccesos()}
    </div>
  `;
}

// ============================================================
// FILTRAR POR CATEGORÍA
// ============================================================

function filtrarAccesos(cat) {
  ACCESOS_CAT_ACTIVA = cat;

  // Actualizar chips
  document.querySelectorAll('.cat-chip').forEach(el => {
    el.classList.toggle('active', el.textContent.trim() === cat);
  });

  const wrap = document.getElementById('accesos-grid-wrap');
  if (wrap) wrap.innerHTML = renderGridAccesos();
}

// ============================================================
// GRID DE ACCESOS
// ============================================================

function renderGridAccesos() {
  const filtrados = ACCESOS_CAT_ACTIVA === 'Todos'
    ? CAT.accesos
    : CAT.accesos.filter(a => a['Categoría'] === ACCESOS_CAT_ACTIVA);

  if (!filtrados.length) {
    return `
      <div style="text-align:center;padding:60px;color:var(--tl)">
        <i class="ti ti-link" style="font-size:40px;display:block;margin-bottom:12px"></i>
        No hay accesos en esta categoría
      </div>`;
  }

  const tarjetas = filtrados.map(a => `
    <a class="acceso-card" href="${a['URL']}" target="_blank" rel="noopener noreferrer">
      <div class="acceso-emoji">${a['Emoji'] || '🔗'}</div>
      <div class="acceso-nombre">${a['Nombre']}</div>
      <div class="acceso-cat">${a['Categoría'] || ''}</div>
      ${SESSION.rol === 'Admin' ? `
        <div style="display:flex;gap:6px;margin-top:4px" onclick="event.preventDefault()">
          <button class="btn btn-glass btn-sm" onclick="abrirFormAcceso('${a['ID']}')">
            <i class="ti ti-pencil"></i>
          </button>
          <button class="btn btn-danger btn-sm" onclick="eliminarAcceso('${a['ID']}','${a['Nombre']}')">
            <i class="ti ti-trash"></i>
          </button>
        </div>` : ''}
    </a>
  `).join('');

  return `<div class="accesos-grid">${tarjetas}</div>`;
}

// ============================================================
// FORMULARIO NUEVO / EDITAR ACCESO
// ============================================================

function abrirFormAcceso(id = null) {
  const a = id ? CAT.accesos.find(x => x['ID'] === id) : null;
  const titulo = a ? 'Editar acceso' : 'Nuevo acceso';

  const categorias = ['Herramientas','Documentos','Redes sociales','Comunicación','Drive','Reportes','Otros'];

  abrirModal(`
    <div class="modal">
      <div class="modal-head">
        <div class="modal-title">${titulo}</div>
        <button class="modal-close" onclick="cerrarModal()"><i class="ti ti-x"></i></button>
      </div>
      <div class="modal-body">

        <div class="form-group">
          <label class="form-label">Nombre *</label>
          <input type="text" class="form-input" id="acc-nombre" placeholder="Nombre del acceso"
            value="${a?.['Nombre'] || ''}">
        </div>

        <div class="form-group">
          <label class="form-label">URL *</label>
          <input type="url" class="form-input" id="acc-url" placeholder="https://..."
            value="${a?.['URL'] || ''}">
        </div>

        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">Emoji</label>
            <input type="text" class="form-input" id="acc-emoji" placeholder="🔗"
              value="${a?.['Emoji'] || ''}" maxlength="4">
          </div>
          <div class="form-group">
            <label class="form-label">Categoría</label>
            <select class="form-select" id="acc-categoria">
              ${categorias.map(c =>
                `<option value="${c}" ${a?.['Categoría']===c?'selected':''}>${c}</option>`
              ).join('')}
            </select>
          </div>
        </div>

        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">Visible para</label>
            <select class="form-select" id="acc-visible">
              <option value="Todos" ${a?.['Visible para']==='Todos'?'selected':''}>Todos</option>
              <option value="Solo admin" ${a?.['Visible para']==='Solo admin'?'selected':''}>Solo admin</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Activo</label>
            <select class="form-select" id="acc-activo">
              <option value="true" ${a?.['Activo']!==false?'selected':''}>Sí</option>
              <option value="false" ${a?.['Activo']===false?'selected':''}>No</option>
            </select>
          </div>
        </div>

      </div>
      <div class="modal-foot">
        <button class="btn btn-glass" onclick="cerrarModal()">Cancelar</button>
        <button class="btn btn-primary" id="btn-guardar-acceso" onclick="guardarAcceso('${id || ''}')">
          <i class="ti ti-check"></i> ${a ? 'Actualizar' : 'Guardar'}
        </button>
      </div>
    </div>
  `);
}

// ============================================================
// GUARDAR ACCESO
// ============================================================

async function guardarAcceso(id) {
  const nombre    = document.getElementById('acc-nombre')?.value?.trim();
  const url       = document.getElementById('acc-url')?.value?.trim();
  const emoji     = document.getElementById('acc-emoji')?.value?.trim();
  const categoria = document.getElementById('acc-categoria')?.value;
  const visible   = document.getElementById('acc-visible')?.value;
  const activo    = document.getElementById('acc-activo')?.value === 'true';

  if (!nombre || !url) {
    showToast('Nombre y URL son obligatorios');
    return;
  }

  const btn = document.getElementById('btn-guardar-acceso');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader"></i> Guardando...'; }

  try {
    const data = {
      ID:            id || '',
      Nombre:        nombre,
      URL:           url,
      Emoji:         emoji || '🔗',
      'Categoría':   categoria,
      'Visible para': visible,
      Activo:        activo,
      email:         SESSION.email,
    };

    const res = await apiPost({ action: 'saveAcceso', data });
    if (!res.ok) { showToast('Error: ' + (res.error || 'desconocido')); return; }

    showToast(id ? 'Acceso actualizado ✓' : 'Acceso guardado ✓');
    cerrarModal();

    // Recargar catálogo de accesos
    const accs = await apiGet({ action: 'getAccesos', rol: SESSION.rol });
    if (accs.ok) CAT.accesos = accs.data;
    renderAccesos();
  } catch(e) {
    console.error(e);
    showToast('Error al guardar');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-check"></i> Guardar'; }
  }
}

// ============================================================
// ELIMINAR ACCESO
// ============================================================

function eliminarAcceso(id, nombre) {
  abrirModal(`
    <div class="modal" style="max-width:420px">
      <div class="modal-head">
        <div class="modal-title">Eliminar acceso</div>
        <button class="modal-close" onclick="cerrarModal()"><i class="ti ti-x"></i></button>
      </div>
      <div class="modal-body">
        <p style="color:var(--tm);font-size:14px">
          ¿Seguro que quieres eliminar <strong>${nombre}</strong>?
          Esta acción no se puede deshacer.
        </p>
      </div>
      <div class="modal-foot">
        <button class="btn btn-glass" onclick="cerrarModal()">Cancelar</button>
        <button class="btn btn-danger" onclick="confirmarEliminarAcceso('${id}')">
          <i class="ti ti-trash"></i> Eliminar
        </button>
      </div>
    </div>
  `);
}

async function confirmarEliminarAcceso(id) {
  try {
    const res = await apiPost({ action: 'deleteRow', sheet: 'Accesos', id });
    if (!res.ok) { showToast('Error al eliminar'); return; }

    showToast('Acceso eliminado ✓');
    cerrarModal();

    const accs = await apiGet({ action: 'getAccesos', rol: SESSION.rol });
    if (accs.ok) CAT.accesos = accs.data;
    renderAccesos();
  } catch(e) {
    console.error(e);
    showToast('Error al eliminar');
  }
}


// ============================================================
