// ============================================================
// RECIRCULA 360 — configuracion.js
// Gestión admin: asociaciones, compradores, materiales, usuarios
// ============================================================

let CONFIG_TAB = 'asociaciones';

// ============================================================
// RENDER PRINCIPAL
// ============================================================

function renderConfiguracion() {
  if (SESSION.rol !== 'Admin') {
    document.getElementById('main-content').innerHTML = `
      <div class="card" style="text-align:center;padding:60px">
        <i class="ti ti-lock" style="font-size:40px;color:var(--tl);display:block;margin-bottom:12px"></i>
        <div style="font-size:15px;font-weight:600;color:var(--tm)">Acceso restringido</div>
        <div style="font-size:13px;color:var(--tl);margin-top:6px">Solo los administradores pueden acceder a esta sección</div>
      </div>`;
    return;
  }

  const content = document.getElementById('main-content');
  content.innerHTML = `
    <div class="tabs-bar">
      <button class="tab-btn active" id="cfg-tab-asociaciones" onclick="switchConfigTab('asociaciones')">
        <i class="ti ti-building-community"></i> Asociaciones
      </button>
      <button class="tab-btn" id="cfg-tab-compradores" onclick="switchConfigTab('compradores')">
        <i class="ti ti-truck"></i> Compradores
      </button>
      <button class="tab-btn" id="cfg-tab-materiales" onclick="switchConfigTab('materiales')">
        <i class="ti ti-recycle"></i> Materiales
      </button>
      <button class="tab-btn" id="cfg-tab-usuarios" onclick="switchConfigTab('usuarios')">
        <i class="ti ti-users"></i> Usuarios
      </button>
    </div>
    <div id="config-tab-content"></div>
  `;

  switchConfigTab('asociaciones');
}

function switchConfigTab(tab) {
  CONFIG_TAB = tab;
  document.querySelectorAll('[id^="cfg-tab-"]').forEach(el => el.classList.remove('active'));
  const el = document.getElementById('cfg-tab-' + tab);
  if (el) el.classList.add('active');

  switch (tab) {
    case 'asociaciones': renderAsociaciones(); break;
    case 'compradores':  renderCompradores();  break;
    case 'materiales':   renderMateriales();   break;
    case 'usuarios':     renderUsuarios();      break;
  }
}

// ============================================================
// ASOCIACIONES
// ============================================================

function renderAsociaciones() {
  const wrap = document.getElementById('config-tab-content');
  wrap.innerHTML = `
    <div class="config-section">
      <div class="config-section-head">
        <div class="config-section-title">
          <i class="ti ti-building-community"></i> Asociaciones
          <span class="badge badge-blue">${CAT.asociaciones.length}</span>
        </div>
        <button class="btn btn-primary btn-sm" onclick="abrirFormAsociacion()">
          <i class="ti ti-plus"></i> Nueva asociación
        </button>
      </div>
      <div class="config-section-body" style="padding:0">
        <div class="table-wrap" style="border:none;border-radius:0">
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
            <tbody>
              ${CAT.asociaciones.length ? CAT.asociaciones.map(a => `
                <tr>
                  <td style="font-weight:500">${a['Nombre']}</td>
                  <td>${a['Provincia'] || '—'}</td>
                  <td>${a['Ciudad'] || '—'}</td>
                  <td>${a['Tipo'] || '—'}</td>
                  <td style="text-align:center">${a['Numero de Recicladores'] || '—'}</td>
                  <td><span class="badge ${a['Estado']==='Activa'?'badge-green':'badge-warn'}">${a['Estado'] || '—'}</span></td>
                  <td>
                    ${a['ID_Carpeta_Drive']
                      ? `<a href="https://drive.google.com/drive/folders/${a['ID_Carpeta_Drive']}" target="_blank" class="btn btn-glass btn-sm"><i class="ti ti-folder"></i></a>`
                      : `<button class="btn btn-glass btn-sm" onclick="crearCarpetaAsoc('${a['ID_Asociacion']}','${a['Nombre']}')"><i class="ti ti-folder-plus"></i> Crear</button>`
                    }
                  </td>
                  <td>
                    <div class="td-actions">
                      <button class="btn btn-primary btn-sm" onclick="abrirFormAsociacion('${a['ID_Asociacion']}')">
                        <i class="ti ti-pencil"></i>
                      </button>
                    </div>
                  </td>
                </tr>`).join('')
              : '<tr><td colspan="8" style="text-align:center;color:var(--tl);padding:30px">No hay asociaciones registradas</td></tr>'
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
}

function abrirFormAsociacion(id = null) {
  const a = id ? CAT.asociaciones.find(x => x['ID_Asociacion'] === id) : null;

  abrirModal(`
    <div class="modal">
      <div class="modal-head">
        <div class="modal-title">${a ? 'Editar asociación' : 'Nueva asociación'}</div>
        <button class="modal-close" onclick="cerrarModal()"><i class="ti ti-x"></i></button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Nombre *</label>
          <input type="text" class="form-input" id="aso-nombre" value="${a?.['Nombre']||''}">
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
            <input type="text" class="form-input" id="aso-ciudad" value="${a?.['Ciudad']||''}">
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
              <option value="Activa" ${a?.['Estado']==='Activa'?'selected':''}>Activa</option>
              <option value="Inactiva" ${a?.['Estado']==='Inactiva'?'selected':''}>Inactiva</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Número de recicladores</label>
          <input type="number" class="form-input" id="aso-recicladores" min="0"
            value="${a?.['Numero de Recicladores']||''}">
        </div>
        <div class="form-group">
          <label class="form-label">Observaciones</label>
          <textarea class="form-textarea" id="aso-obs">${a?.['Observaciones']||''}</textarea>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-glass" onclick="cerrarModal()">Cancelar</button>
        <button class="btn btn-primary" id="btn-guardar-aso" onclick="guardarAsociacion('${id||''}')">
          <i class="ti ti-check"></i> ${a ? 'Actualizar' : 'Guardar'}
        </button>
      </div>
    </div>
  `);
}

async function guardarAsociacion(id) {
  const nombre      = document.getElementById('aso-nombre')?.value?.trim();
  const provincia   = document.getElementById('aso-provincia')?.value;
  const ciudad      = document.getElementById('aso-ciudad')?.value?.trim();
  const tipo        = document.getElementById('aso-tipo')?.value;
  const estado      = document.getElementById('aso-estado')?.value;
  const recicladores = document.getElementById('aso-recicladores')?.value;
  const obs         = document.getElementById('aso-obs')?.value;

  if (!nombre) { showToast('El nombre es obligatorio'); return; }

  const btn = document.getElementById('btn-guardar-aso');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader"></i> Guardando...'; }

  try {
    const data = {
      ID_Asociacion: id || '',
      Nombre: nombre, Provincia: provincia, Ciudad: ciudad,
      Tipo: tipo, Estado: estado,
      'Numero de Recicladores': recicladores,
      Observaciones: obs,
      'Fecha Ingreso': id ? '' : new Date().toISOString().substring(0,10),
    };
    const res = await apiPost({ action: 'saveAsociacion', data });
    if (!res.ok) { showToast('Error: ' + (res.error||'desconocido')); return; }

    // Si es nueva, crear carpeta en Drive automáticamente
    if (!id && res.id) {
      await apiPost({ action: 'crearCarpetaAsoc', idAsociacion: res.id, nombre });
    }

    showToast(id ? 'Asociación actualizada ✓' : 'Asociación creada ✓');
    cerrarModal();
    await recargarAsociaciones();
    renderAsociaciones();
  } catch(e) {
    console.error(e);
    showToast('Error al guardar');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-check"></i> Guardar'; }
  }
}

async function crearCarpetaAsoc(idAsociacion, nombre) {
  showToast('Creando carpeta en Drive...');
  try {
    const res = await apiPost({ action: 'crearCarpetaAsoc', idAsociacion, nombre });
    if (res.ok) {
      showToast('Carpeta creada ✓');
      await recargarAsociaciones();
      renderAsociaciones();
    } else {
      showToast('Error al crear carpeta');
    }
  } catch(e) {
    showToast('Error de conexión');
  }
}

async function recargarAsociaciones() {
  const res = await apiGet({ action: 'getAsociaciones' });
  if (res.ok) CAT.asociaciones = res.data;
}

// ============================================================
// COMPRADORES
// ============================================================

function renderCompradores() {
  const wrap = document.getElementById('config-tab-content');
  wrap.innerHTML = `
    <div class="config-section">
      <div class="config-section-head">
        <div class="config-section-title">
          <i class="ti ti-truck"></i> Compradores
          <span class="badge badge-blue">${CAT.compradores.length}</span>
        </div>
        <button class="btn btn-primary btn-sm" onclick="abrirFormComprador()">
          <i class="ti ti-plus"></i> Nuevo comprador
        </button>
      </div>
      <div class="config-section-body" style="padding:0">
        <div class="table-wrap" style="border:none;border-radius:0">
          <table>
            <thead>
              <tr><th>Nombre</th><th>Nivel</th><th>Destino final</th><th>Provincia</th><th>Activo</th><th></th></tr>
            </thead>
            <tbody>
              ${CAT.compradores.length ? CAT.compradores.map(c => `
                <tr>
                  <td style="font-weight:500">${c['Nombre']}</td>
                  <td>${nivelBadge(c['Nivel Intermediacion'])}</td>
                  <td style="font-size:12px;color:var(--tm)">${c['Destino Final']||'—'}</td>
                  <td>${c['Provincia']||'—'}</td>
                  <td><span class="badge ${c['Activo']===true||c['Activo']==='TRUE'?'badge-green':'badge-warn'}">${c['Activo']===true||c['Activo']==='TRUE'?'Sí':'No'}</span></td>
                  <td>
                    <div class="td-actions">
                      <button class="btn btn-primary btn-sm" onclick="abrirFormComprador('${c['ID_Comprador']}')">
                        <i class="ti ti-pencil"></i>
                      </button>
                    </div>
                  </td>
                </tr>`).join('')
              : '<tr><td colspan="6" style="text-align:center;color:var(--tl);padding:30px">No hay compradores registrados</td></tr>'
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
}

function abrirFormComprador(id = null) {
  const c = id ? CAT.compradores.find(x => x['ID_Comprador'] === id) : null;

  abrirModal(`
    <div class="modal">
      <div class="modal-head">
        <div class="modal-title">${c ? 'Editar comprador' : 'Nuevo comprador'}</div>
        <button class="modal-close" onclick="cerrarModal()"><i class="ti ti-x"></i></button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Nombre *</label>
          <input type="text" class="form-input" id="com-nombre" value="${c?.['Nombre']||''}">
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">Nivel intermediación</label>
            <select class="form-select" id="com-nivel">
              ${['Nivel 1','Nivel 2','Nivel 3','Transformador'].map(n =>
                `<option value="${n}" ${c?.['Nivel Intermediacion']===n?'selected':''}>${n}</option>`
              ).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Provincia</label>
            <input type="text" class="form-input" id="com-provincia" value="${c?.['Provincia']||''}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Destino final</label>
          <input type="text" class="form-input" id="com-destino" placeholder="Ej: Se vende a INTERCIA S.A."
            value="${c?.['Destino Final']||''}">
        </div>
        <div class="form-group">
          <label class="form-label">Activo</label>
          <select class="form-select" id="com-activo">
            <option value="true" ${c?.['Activo']!==false?'selected':''}>Sí</option>
            <option value="false" ${c?.['Activo']===false?'selected':''}>No</option>
          </select>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-glass" onclick="cerrarModal()">Cancelar</button>
        <button class="btn btn-primary" id="btn-guardar-com" onclick="guardarComprador('${id||''}')">
          <i class="ti ti-check"></i> ${c ? 'Actualizar' : 'Guardar'}
        </button>
      </div>
    </div>
  `);
}

async function guardarComprador(id) {
  const nombre   = document.getElementById('com-nombre')?.value?.trim();
  const nivel    = document.getElementById('com-nivel')?.value;
  const provincia = document.getElementById('com-provincia')?.value?.trim();
  const destino  = document.getElementById('com-destino')?.value?.trim();
  const activo   = document.getElementById('com-activo')?.value === 'true';

  if (!nombre) { showToast('El nombre es obligatorio'); return; }

  const btn = document.getElementById('btn-guardar-com');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader"></i> Guardando...'; }

  try {
    const res = await apiPost({ action: 'saveComprador', data: {
      ID_Comprador: id||'', Nombre: nombre,
      'Nivel Intermediacion': nivel,
      Provincia: provincia, 'Destino Final': destino, Activo: activo,
    }});
    if (!res.ok) { showToast('Error: ' + (res.error||'desconocido')); return; }

    showToast(id ? 'Comprador actualizado ✓' : 'Comprador creado ✓');
    cerrarModal();
    const coms = await apiGet({ action: 'getCompradores' });
    if (coms.ok) CAT.compradores = coms.data;
    renderCompradores();
  } catch(e) {
    console.error(e);
    showToast('Error al guardar');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-check"></i> Guardar'; }
  }
}

// ============================================================
// MATERIALES
// ============================================================

function renderMateriales() {
  const wrap = document.getElementById('config-tab-content');
  wrap.innerHTML = `
    <div class="config-section">
      <div class="config-section-head">
        <div class="config-section-title">
          <i class="ti ti-recycle"></i> Materiales
          <span class="badge badge-blue">${CAT.materiales.length}</span>
        </div>
        <button class="btn btn-primary btn-sm" onclick="abrirFormMaterial()">
          <i class="ti ti-plus"></i> Nuevo material
        </button>
      </div>
      <div class="config-section-body" style="padding:0">
        <div class="table-wrap" style="border:none;border-radius:0">
          <table>
            <thead>
              <tr><th>Nombre</th><th>Priorizable</th><th>Activo</th><th></th></tr>
            </thead>
            <tbody>
              ${CAT.materiales.length ? CAT.materiales.map(m => `
                <tr>
                  <td style="font-weight:500">${m['Nombre']}</td>
                  <td>${m['Priorizable']==='Sí'||m['Priorizable']===true
                    ? '<span class="badge badge-cyan">Sí</span>'
                    : '<span style="color:var(--tl);font-size:12px">No</span>'}</td>
                  <td><span class="badge ${m['Activo']===true||m['Activo']==='TRUE'?'badge-green':'badge-warn'}">${m['Activo']===true||m['Activo']==='TRUE'?'Activo':'Inactivo'}</span></td>
                  <td>
                    <div class="td-actions">
                      <button class="btn btn-primary btn-sm" onclick="abrirFormMaterial('${m['ID_Material']}')">
                        <i class="ti ti-pencil"></i>
                      </button>
                    </div>
                  </td>
                </tr>`).join('')
              : '<tr><td colspan="4" style="text-align:center;color:var(--tl);padding:30px">No hay materiales registrados</td></tr>'
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
}

function abrirFormMaterial(id = null) {
  const m = id ? CAT.materiales.find(x => x['ID_Material'] === id) : null;

  abrirModal(`
    <div class="modal" style="max-width:420px">
      <div class="modal-head">
        <div class="modal-title">${m ? 'Editar material' : 'Nuevo material'}</div>
        <button class="modal-close" onclick="cerrarModal()"><i class="ti ti-x"></i></button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Nombre *</label>
          <input type="text" class="form-input" id="mat-nombre" value="${m?.['Nombre']||''}">
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">Priorizable</label>
            <select class="form-select" id="mat-prio">
              <option value="Sí" ${m?.['Priorizable']==='Sí'?'selected':''}>Sí</option>
              <option value="No" ${m?.['Priorizable']!=='Sí'?'selected':''}>No</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Activo</label>
            <select class="form-select" id="mat-activo">
              <option value="true" ${m?.['Activo']!==false?'selected':''}>Sí</option>
              <option value="false" ${m?.['Activo']===false?'selected':''}>No</option>
            </select>
          </div>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-glass" onclick="cerrarModal()">Cancelar</button>
        <button class="btn btn-primary" id="btn-guardar-mat" onclick="guardarMaterial('${id||''}')">
          <i class="ti ti-check"></i> ${m ? 'Actualizar' : 'Guardar'}
        </button>
      </div>
    </div>
  `);
}

async function guardarMaterial(id) {
  const nombre = document.getElementById('mat-nombre')?.value?.trim();
  const prio   = document.getElementById('mat-prio')?.value;
  const activo = document.getElementById('mat-activo')?.value === 'true';

  if (!nombre) { showToast('El nombre es obligatorio'); return; }

  const btn = document.getElementById('btn-guardar-mat');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader"></i> Guardando...'; }

  try {
    const res = await apiPost({ action: 'saveMaterial', data: {
      ID_Material: id||'', Nombre: nombre, Priorizable: prio, Activo: activo,
    }});
    if (!res.ok) { showToast('Error: ' + (res.error||'desconocido')); return; }

    showToast(id ? 'Material actualizado ✓' : 'Material creado ✓');
    cerrarModal();
    const mats = await apiGet({ action: 'getMateriales' });
    if (mats.ok) CAT.materiales = mats.data;
    renderMateriales();
  } catch(e) {
    console.error(e);
    showToast('Error al guardar');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-check"></i> Guardar'; }
  }
}

// ============================================================
// USUARIOS
// ============================================================

let USUARIOS_DATA = [];

async function renderUsuarios() {
  const wrap = document.getElementById('config-tab-content');
  wrap.innerHTML = `
    <div class="config-section">
      <div class="config-section-head">
        <div class="config-section-title"><i class="ti ti-users"></i> Usuarios</div>
        <button class="btn btn-primary btn-sm" onclick="abrirFormUsuario()">
          <i class="ti ti-plus"></i> Nuevo usuario
        </button>
      </div>
      <div class="config-section-body" style="padding:20px;text-align:center">
        <div class="spinner" style="margin:0 auto"></div>
      </div>
    </div>`;

  try {
    const res = await apiGet({ action: 'getUsuarios' });
    USUARIOS_DATA = res.ok ? res.data : [];
    renderTablaUsuarios();
  } catch(e) {
    showToast('Error cargando usuarios');
  }
}

function renderTablaUsuarios() {
  const wrap = document.getElementById('config-tab-content');
  wrap.innerHTML = `
    <div class="config-section">
      <div class="config-section-head">
        <div class="config-section-title">
          <i class="ti ti-users"></i> Usuarios
          <span class="badge badge-blue">${USUARIOS_DATA.length}</span>
        </div>
        <button class="btn btn-primary btn-sm" onclick="abrirFormUsuario()">
          <i class="ti ti-plus"></i> Nuevo usuario
        </button>
      </div>
      <div class="config-section-body" style="padding:0">
        <div class="table-wrap" style="border:none;border-radius:0">
          <table>
            <thead>
              <tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Activo</th><th></th></tr>
            </thead>
            <tbody>
              ${USUARIOS_DATA.length ? USUARIOS_DATA.map(u => `
                <tr>
                  <td style="font-weight:500">${u['Nombre']}</td>
                  <td style="font-size:12px;color:var(--tm)">${u['Email']}</td>
                  <td><span class="badge ${u['Rol']==='Admin'?'badge-blue':u['Rol']==='Editor'?'badge-green':'badge-cyan'}">${u['Rol']}</span></td>
                  <td><span class="badge ${u['Activo']===true||u['Activo']==='TRUE'?'badge-green':'badge-warn'}">${u['Activo']===true||u['Activo']==='TRUE'?'Activo':'Inactivo'}</span></td>
                  <td>
                    <div class="td-actions">
                      <button class="btn btn-primary btn-sm" onclick="abrirFormUsuario('${u['ID_Usuario']}')">
                        <i class="ti ti-pencil"></i>
                      </button>
                    </div>
                  </td>
                </tr>`).join('')
              : '<tr><td colspan="5" style="text-align:center;color:var(--tl);padding:30px">No hay usuarios registrados</td></tr>'
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
}

function abrirFormUsuario(id = null) {
  const u = id ? USUARIOS_DATA.find(x => x['ID_Usuario'] === id) : null;

  abrirModal(`
    <div class="modal" style="max-width:440px">
      <div class="modal-head">
        <div class="modal-title">${u ? 'Editar usuario' : 'Nuevo usuario'}</div>
        <button class="modal-close" onclick="cerrarModal()"><i class="ti ti-x"></i></button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Nombre *</label>
          <input type="text" class="form-input" id="usr-nombre" value="${u?.['Nombre']||''}">
        </div>
        <div class="form-group">
          <label class="form-label">Email *</label>
          <input type="email" class="form-input" id="usr-email" value="${u?.['Email']||''}"
            placeholder="nombre@redesconrostro.org" ${u?'readonly':''}>
          <div class="form-hint">Solo cuentas @redesconrostro.org</div>
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">Rol</label>
            <select class="form-select" id="usr-rol">
              <option value="Admin"        ${u?.['Rol']==='Admin'?'selected':''}>Admin</option>
              <option value="Editor"       ${u?.['Rol']==='Editor'?'selected':''}>Editor</option>
              <option value="Visualizador" ${u?.['Rol']==='Visualizador'?'selected':''}>Visualizador</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Activo</label>
            <select class="form-select" id="usr-activo">
              <option value="true"  ${u?.['Activo']!==false?'selected':''}>Sí</option>
              <option value="false" ${u?.['Activo']===false?'selected':''}>No</option>
            </select>
          </div>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-glass" onclick="cerrarModal()">Cancelar</button>
        <button class="btn btn-primary" id="btn-guardar-usr" onclick="guardarUsuario('${id||''}')">
          <i class="ti ti-check"></i> ${u ? 'Actualizar' : 'Guardar'}
        </button>
      </div>
    </div>
  `);
}

async function guardarUsuario(id) {
  const nombre = document.getElementById('usr-nombre')?.value?.trim();
  const email  = document.getElementById('usr-email')?.value?.trim();
  const rol    = document.getElementById('usr-rol')?.value;
  const activo = document.getElementById('usr-activo')?.value === 'true';

  if (!nombre || !email) { showToast('Nombre y email son obligatorios'); return; }
  if (!email.endsWith('@' + DOMAIN)) { showToast('Solo cuentas @' + DOMAIN); return; }

  const btn = document.getElementById('btn-guardar-usr');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader"></i> Guardando...'; }

  try {
    const res = await apiPost({ action: 'saveUsuario', data: {
      ID_Usuario: id||'', Nombre: nombre, Email: email, Rol: rol, Activo: activo,
    }});
    if (!res.ok) { showToast('Error: ' + (res.error||'desconocido')); return; }

    showToast(id ? 'Usuario actualizado ✓' : 'Usuario creado ✓');
    cerrarModal();
    await renderUsuarios();
  } catch(e) {
    console.error(e);
    showToast('Error al guardar');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-check"></i> Guardar'; }
  }
}
