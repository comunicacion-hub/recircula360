// ============================================================
// RECIRCULA 360 — entregas.js
// ============================================================

let ENTREGAS_DATA    = [];
let ENTREGAS_FILTROS = { anio: '', mes: '', asociacion: '', provincia: '' };
let EVIDENCIAS_LISTA = [];

// ============================================================
// RENDER PRINCIPAL
// ============================================================

async function renderEntregas() {
  document.getElementById('topbar-actions').innerHTML = `
    <button class="btn btn-glass" onclick="verCompradoresModal()">
      <i class="ti ti-eye"></i> Ver compradores
    </button>
    <button class="btn btn-primary" onclick="abrirFormEntrega()">
      <i class="ti ti-plus"></i> Nueva entrega
    </button>
  `;

  document.getElementById('main-content').innerHTML = `
    <div class="filters-bar">
      <span class="filter-label-inline"><i class="ti ti-adjustments-horizontal"></i> Filtros</span>
      <div class="filter-divider"></div>
      <select class="filter-select-sm" id="ef-anio" onchange="filtrarEntregas('anio',this.value)">
        <option value="">Todos los años</option>
        ${['2024','2025','2026','2027','2028'].map(a => `<option value="${a}">${a}</option>`).join('')}
      </select>
      <select class="filter-select-sm" id="ef-mes" onchange="filtrarEntregas('mes',this.value)">
        <option value="">Todos los meses</option>
        ${['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].map(m => `<option value="${m}">${m}</option>`).join('')}
      </select>
      <select class="filter-select-sm" id="ef-provincia" onchange="filtrarEntregas('provincia',this.value)">
        <option value="">Todas las provincias</option>
        ${['El Oro','Guayas','Manabí','Sucumbíos','Pichincha','Chimborazo'].map(p => `<option value="${p}">${p}</option>`).join('')}
      </select>
      <select class="filter-select-sm" id="ef-asociacion" onchange="filtrarEntregas('asociacion',this.value)">
        <option value="">Todas las asociaciones</option>
        ${CAT.asociaciones.map(a => `<option value="${a['ID_Asociacion']}">${a['Nombre']}</option>`).join('')}
      </select>
      <button class="btn-reset-filters" onclick="resetFiltrosEntregas()">
        <i class="ti ti-x"></i> Limpiar
      </button>
    </div>
    <div class="card" style="padding:0">
      <div id="entregas-table-wrap" style="padding:20px">
        <div style="display:flex;align-items:center;gap:14px;padding:40px;justify-content:center">
          <div class="spinner"></div>
          <span style="color:var(--tm)">Cargando entregas...</span>
        </div>
      </div>
    </div>
  `;

  await cargarEntregas();
}

// ============================================================
// CARGAR ENTREGAS — solo Apps Script (sin Sheets API directa)
// ============================================================

async function cargarEntregas() {
  try {
    const res = await apiGet({ action: 'getEntregas', ...ENTREGAS_FILTROS });
    if (!res.ok) { showToast('Error cargando entregas'); return; }
    ENTREGAS_DATA = res.data;
    renderTablaEntregas();
  } catch(e) {
    console.error(e);
    showToast('Error de conexión');
  }
}

function filtrarEntregas(campo, valor) {
  ENTREGAS_FILTROS[campo] = valor;
  cargarEntregas();
}

function resetFiltrosEntregas() {
  ENTREGAS_FILTROS = { anio: '', mes: '', asociacion: '', provincia: '' };
  ['ef-anio','ef-mes','ef-provincia','ef-asociacion'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  cargarEntregas();
}

// ============================================================
// TABLA
// ============================================================

function renderTablaEntregas() {
  const wrap = document.getElementById('entregas-table-wrap');
  if (!wrap) return;

  if (!ENTREGAS_DATA.length) {
    wrap.innerHTML = `
      <div style="text-align:center;padding:50px;color:var(--tl)">
        <i class="ti ti-package" style="font-size:40px;display:block;margin-bottom:12px"></i>
        No hay entregas registradas
      </div>`;
    return;
  }

  const filas = ENTREGAS_DATA.map(e => {
    const petKg    = parseFloat(e['PET Kilos'] || 0);
    const suaveKg  = parseFloat(e['Plástico Suave Kilos'] || 0);
    const duroKg   = parseFloat(e['Plástico Duro Kilos'] || 0);
    const total    = parseFloat(e['Valor Total'] || 0);
    const carpeta  = e['ID_Carpeta_Evidencia'];
    const idEnt    = e['ID_Entrega'] || '';
    const idCarpeta = carpeta || '';

    return `
      <tr>
        <td style="font-size:12px;color:var(--tm)">${e['Mes']||''} ${e['Año']||''}</td>
        <td style="font-weight:500">${e['_nombreAsociacion']||'—'}</td>
        <td>${e['_nombreComprador']||'—'}</td>
        <td>${nivelBadge(e['_nivelComprador']||e['Nivel Intermediacion'])}</td>
        <td style="text-align:right;font-weight:600">${fmtNum(petKg)} kg</td>
        <td style="text-align:right">${fmtNum(suaveKg)} kg</td>
        <td style="text-align:right">${fmtNum(duroKg)} kg</td>
        <td style="text-align:right;font-weight:700;color:var(--g1)">${fmtMoney(total)}</td>
        <td>
          ${carpeta
            ? `<a href="https://drive.google.com/drive/folders/${carpeta}" target="_blank" class="btn btn-glass btn-sm"><i class="ti ti-folder"></i></a>`
            : '<span style="color:var(--tl);font-size:12px">—</span>'}
        </td>
        <td>
          <div class="td-actions">
            <button class="btn btn-glass btn-sm" data-id="${idEnt}" onclick="verEntrega(this.dataset.id)">
              <i class="ti ti-eye"></i>
            </button>
            ${SESSION.rol !== 'Visualizador' ? `
            <button class="btn btn-primary btn-sm" data-id="${idEnt}" onclick="editarEntrega(this.dataset.id)">
              <i class="ti ti-pencil"></i>
            </button>
            <button class="btn btn-danger btn-sm" data-id="${idEnt}" data-folder="${idCarpeta}"
              onclick="confirmarEliminarEntrega(this.dataset.id, this.dataset.folder)">
              <i class="ti ti-x"></i>
            </button>` : ''}
          </div>
        </td>
      </tr>`;
  }).join('');

  wrap.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Período</th><th>Asociación</th><th>Comprador</th><th>Nivel</th>
            <th style="text-align:right">PET kg</th>
            <th style="text-align:right">Suave kg</th>
            <th style="text-align:right">Duro kg</th>
            <th style="text-align:right">Valor total</th>
            <th>Evidencia</th><th></th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
    <div style="margin-top:12px;font-size:12px;color:var(--tl);text-align:right">
      ${ENTREGAS_DATA.length} registro${ENTREGAS_DATA.length !== 1 ? 's' : ''}
    </div>`;
}

// ============================================================
// ELIMINAR
// ============================================================

function confirmarEliminarEntrega(id, folderId) {
  abrirModal(`
    <div class="modal" style="max-width:420px">
      <div class="modal-head">
        <div class="modal-title">Eliminar entrega</div>
        <button class="modal-close" onclick="cerrarModal()"><i class="ti ti-x"></i></button>
      </div>
      <div class="modal-body">
        <p style="color:var(--tm);font-size:14px">
          ¿Seguro que quieres eliminar esta entrega?
          ${folderId ? 'Se eliminará la fila y la carpeta de evidencias en Drive.' : 'Se eliminará la fila del registro.'}
          Esta acción no se puede deshacer.
        </p>
      </div>
      <div class="modal-foot">
        <button class="btn btn-glass" onclick="cerrarModal()">Cancelar</button>
        <button class="btn btn-danger" data-id="${id}" data-folder="${folderId}"
          onclick="eliminarEntrega(this.dataset.id, this.dataset.folder)">
          <i class="ti ti-trash"></i> Eliminar
        </button>
      </div>
    </div>
  `);
}

async function eliminarEntrega(id, folderId) {
  try {
    const res = await apiPost({ action: 'deleteEntrega', id, folderId });
    if (!res.ok) { showToast('Error al eliminar: ' + (res.error||'')); return; }
    showToast('Entrega eliminada ✓');
    cerrarModal();
    await cargarEntregas();
  } catch(e) {
    console.error(e);
    showToast('Error de conexión');
  }
}

// ============================================================
// VER ENTREGA
// ============================================================

function verEntrega(id) {
  const e = ENTREGAS_DATA.find(r => r['ID_Entrega'] === id);
  if (!e) { showToast('Entrega no encontrada'); return; }

  const MATS = ['PET','Plástico Suave','Plástico Duro','Lata Aluminio','Vidrio','Cartón',
    'Chatarra','Cobre','Papel Archivo','Periódico','Soplado','Tetrapak','Suela','Bronce','Batería','Acero'];

  const filasMat = MATS.filter(m => parseFloat(e[m+' Kilos']||0) > 0).map(m => {
    const kg    = parseFloat(e[m+' Kilos']||0);
    const precio = parseFloat(e[m+' Precio']||0);
    const venta  = parseFloat(e[m+' Valor Venta']||0) || kg*precio;
    const prio   = ['PET','Plástico Suave','Plástico Duro'].includes(m);
    return `<tr>
      <td style="${prio?'font-weight:600;color:var(--b1)':''}">${m}</td>
      <td style="text-align:right">${fmtNum(kg)} kg</td>
      <td style="text-align:right">$${fmtNum(precio,2)}/kg</td>
      <td style="text-align:right;font-weight:600;color:var(--g1)">${fmtMoney(venta)}</td>
    </tr>`;
  }).join('');

  abrirModal(`
    <div class="modal">
      <div class="modal-head">
        <div class="modal-title">Detalle de entrega</div>
        <button class="modal-close" onclick="cerrarModal()"><i class="ti ti-x"></i></button>
      </div>
      <div class="modal-body">
        <div class="form-grid-2" style="margin-bottom:16px">
          <div><div class="form-label">Año</div><div style="font-size:14px">${e['Año']||'—'}</div></div>
          <div><div class="form-label">Mes</div><div style="font-size:14px">${e['Mes']||'—'}</div></div>
          <div><div class="form-label">Fecha</div><div style="font-size:14px">${fmtFecha(e['Fecha'])}</div></div>
          <div><div class="form-label">Asociación</div><div style="font-size:14px;font-weight:500">${e['_nombreAsociacion']||'—'}</div></div>
          <div><div class="form-label">Provincia</div><div style="font-size:14px">${e['Provincia']||e['_provinciaAsociacion']||'—'}</div></div>
          <div><div class="form-label">Comprador</div><div style="font-size:14px">${e['_nombreComprador']||'—'}</div></div>
          <div><div class="form-label">Nivel</div><div>${nivelBadge(e['Nivel Intermediacion'])}</div></div>
          <div><div class="form-label">Actividad fuente</div><div style="font-size:14px">${e['Actividad Fuente']||'—'}</div></div>
          <div><div class="form-label">Destino final</div><div style="font-size:14px">${e['Destino Final']||'—'}</div></div>
          <div><div class="form-label">Valor total</div><div style="font-size:18px;font-weight:700;color:var(--g1)">${fmtMoney(e['Valor Total'])}</div></div>
        </div>
        <div class="materiales-section">
          <div class="materiales-section-title">Materiales entregados</div>
          <div class="table-wrap"><table>
            <thead><tr><th>Material</th><th style="text-align:right">Kilos</th><th style="text-align:right">Precio</th><th style="text-align:right">Valor venta</th></tr></thead>
            <tbody>${filasMat||'<tr><td colspan="4" style="text-align:center;color:var(--tl)">Sin materiales</td></tr>'}</tbody>
          </table></div>
        </div>
        ${e['Observaciones']?`<div style="margin-top:14px"><div class="form-label">Observaciones</div><div style="font-size:13px;color:var(--tm)">${e['Observaciones']}</div></div>`:''}
        ${e['ID_Carpeta_Evidencia']?`
          <div style="margin-top:14px">
            <a href="https://drive.google.com/drive/folders/${e['ID_Carpeta_Evidencia']}" target="_blank" class="btn btn-glass">
              <i class="ti ti-folder"></i> Ver evidencias en Drive
            </a>
          </div>`:''}
      </div>
    </div>
  `);
}

function editarEntrega(id) { abrirFormEntrega(id); }

// ============================================================
// FORMULARIO
// ============================================================

function abrirFormEntrega(id = null) {
  const e = id ? ENTREGAS_DATA.find(r => r['ID_Entrega'] === id) : null;
  EVIDENCIAS_LISTA = [];

  const MATS_DEFAULT = [
    { Nombre:'PET', Priorizable:'Sí' },{ Nombre:'Plástico Suave', Priorizable:'Sí' },
    { Nombre:'Plástico Duro', Priorizable:'Sí' },{ Nombre:'Lata Aluminio', Priorizable:'No' },
    { Nombre:'Vidrio', Priorizable:'No' },{ Nombre:'Cartón', Priorizable:'No' },
    { Nombre:'Chatarra', Priorizable:'No' },{ Nombre:'Cobre', Priorizable:'No' },
    { Nombre:'Papel Archivo', Priorizable:'No' },{ Nombre:'Periódico', Priorizable:'No' },
    { Nombre:'Soplado', Priorizable:'No' },{ Nombre:'Tetrapak', Priorizable:'No' },
    { Nombre:'Suela', Priorizable:'No' },{ Nombre:'Bronce', Priorizable:'No' },
    { Nombre:'Batería', Priorizable:'No' },{ Nombre:'Acero', Priorizable:'No' },
  ];

  const mats       = CAT.materiales.length > 0 ? CAT.materiales : MATS_DEFAULT;
  const priorizables = mats.filter(m => m['Priorizable']==='Sí'||m['Priorizable']===true);
  const otros        = mats.filter(m => m['Priorizable']!=='Sí'&&m['Priorizable']!==true);

  const filaMaterial = (mat) => {
    const n    = mat['Nombre'];
    const prio = mat['Priorizable']==='Sí'||mat['Priorizable']===true;
    const kg   = e ? (e[n+' Kilos']||'') : '';
    const prec = e ? (e[n+' Precio']||'') : '';
    const vent = e ? parseFloat(e[n+' Valor Venta']||0) : 0;
    const mid  = n.replace(/[^a-zA-Z0-9]/g,'_');
    return `
      <div class="material-row${prio?' material-priorizable':''}">
        <div class="material-row-label">${n}${prio?` <span class="badge badge-cyan" style="font-size:9px;padding:1px 6px">Priorizable</span>`:''}</div>
        <input type="number" class="form-input" id="mat-kg-${mid}" placeholder="Kilos" value="${kg}" min="0" step="0.01" oninput="calcularValorMaterial('${mid}')">
        <input type="number" class="form-input" id="mat-precio-${mid}" placeholder="$/kg" value="${prec}" min="0" step="0.01" oninput="calcularValorMaterial('${mid}')">
        <div class="material-valor" id="mat-venta-${mid}">${vent>0?fmtMoney(vent):'—'}</div>
      </div>`;
  };

  abrirModal(`
    <div class="modal" style="max-width:700px">
      <div class="modal-head">
        <div class="modal-title">${e?'Editar entrega':'Nueva entrega'}</div>
        <button class="modal-close" onclick="cerrarModal()"><i class="ti ti-x"></i></button>
      </div>
      <div class="modal-body">

        <div class="form-grid-3">
          <div class="form-group">
            <label class="form-label">Fecha</label>
            <input type="date" class="form-input" id="ent-fecha" readonly
              style="background:#f8fbfd;color:var(--tm)"
              value="${e?.['Fecha']?String(e.Fecha).substring(0,10):new Date().toISOString().substring(0,10)}">
          </div>
          <div class="form-group">
            <label class="form-label">Año *</label>
            <select class="form-select" id="ent-anio">
              <option value="">Selecciona...</option>
              ${['2024','2025','2026','2027','2028'].map(a=>`<option value="${a}" ${String(e?.['Año'])===a?'selected':''}>${a}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Mes *</label>
            <select class="form-select" id="ent-mes">
              <option value="">Selecciona...</option>
              ${['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].map(m=>`<option value="${m}" ${e?.['Mes']===m?'selected':''}>${m}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">Asociación *</label>
            <select class="form-select" id="ent-asociacion" onchange="autocompletarProvincia(this.value)">
              <option value="">Selecciona una asociación</option>
              ${CAT.asociaciones.map(a=>`<option value="${a['ID_Asociacion']}" ${e?.['ID_Asociacion']===a['ID_Asociacion']?'selected':''}>${a['Nombre']}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Provincia</label>
            <input type="text" class="form-input" id="ent-provincia" readonly
              style="background:#f8fbfd;color:var(--tm)"
              value="${e?.['Provincia']||e?.['_provinciaAsociacion']||''}">
          </div>
        </div>

        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">Comprador *</label>
            <select class="form-select" id="ent-comprador">
              <option value="">Selecciona un comprador</option>
              ${CAT.compradores.map(c=>`<option value="${c['ID_Comprador']}" ${e?.['ID_Comprador']===c['ID_Comprador']?'selected':''}>${c['Nombre']}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Nivel intermediación</label>
            <select class="form-select" id="ent-nivel">
              ${['Nivel 1','Nivel 2','Nivel 3','Transformador'].map(n=>`<option value="${n}" ${e?.['Nivel Intermediacion']===n?'selected':''}>${n}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">Actividad fuente</label>
            <select class="form-select" id="ent-actividad">
              <option value="">Selecciona...</option>
              ${['Recuperación a pie de Vereda / Fuente','Recuperación en Relleno','Recuperación GIRA','Otros'].map(a=>`<option value="${a}" ${e?.['Actividad Fuente']===a?'selected':''}>${a}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="materiales-section" style="margin-bottom:14px">
          <div class="materiales-section-title">Materiales priorizables</div>
          <div class="material-row" style="font-size:10px;font-weight:600;color:var(--tl);text-transform:uppercase;margin-bottom:6px">
            <div>Material</div><div>Kilos</div><div>Precio $/kg</div><div style="text-align:right">Valor venta</div>
          </div>
          ${priorizables.map(filaMaterial).join('')}
        </div>

        <div class="materiales-section">
          <div class="materiales-section-title">Otros materiales</div>
          <div class="material-row" style="font-size:10px;font-weight:600;color:var(--tl);text-transform:uppercase;margin-bottom:6px">
            <div>Material</div><div>Kilos</div><div>Precio $/kg</div><div style="text-align:right">Valor venta</div>
          </div>
          ${otros.map(filaMaterial).join('')}
        </div>

        <div style="margin-top:14px;display:flex;justify-content:flex-end;align-items:center;gap:12px">
          <span style="font-size:13px;color:var(--tm);font-weight:600">VALOR TOTAL:</span>
          <span id="ent-total" style="font-size:22px;font-weight:700;color:var(--g1)">${e?fmtMoney(e['Valor Total']):'$0,00'}</span>
        </div>

        <div class="form-group" style="margin-top:14px">
          <label class="form-label">Observaciones</label>
          <textarea class="form-textarea" id="ent-obs" placeholder="Notas adicionales...">${e?.['Observaciones']||''}</textarea>
        </div>

      </div>
      <div class="modal-foot">
        <button class="btn btn-glass" onclick="cerrarModal()">Cancelar</button>
        <button class="btn btn-primary" id="btn-guardar-entrega" data-id="${id||''}" onclick="guardarEntrega(this.dataset.id)">
          <i class="ti ti-check"></i> ${e?'Actualizar':'Guardar entrega'}
        </button>
      </div>
    </div>
  `);

  if (e?.['ID_Asociacion']) autocompletarProvincia(e['ID_Asociacion']);
}

// ============================================================
// EVIDENCIAS
// ============================================================

function agregarEvidencias(files) {
  Array.from(files).forEach(file => {
    if (!EVIDENCIAS_LISTA.find(f => f.name === file.name)) EVIDENCIAS_LISTA.push(file);
  });
  renderEvidenciasLista();
  document.getElementById('ent-ev-input').value = '';
}

function quitarEvidencia(nombre) {
  EVIDENCIAS_LISTA = EVIDENCIAS_LISTA.filter(f => f.name !== nombre);
  renderEvidenciasLista();
}

function renderEvidenciasLista() {
  const wrap = document.getElementById('evidencias-lista');
  if (!wrap) return;
  wrap.innerHTML = EVIDENCIAS_LISTA.map(f => {
    const pdf   = f.type === 'application/pdf';
    const icono = pdf ? 'ti-file-type-pdf' : 'ti-photo';
    const color = pdf ? '#c91a44' : '#33A8DE';
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:#f8fbfd;border-radius:var(--radius-sm);border:1px solid var(--border)">
        <i class="ti ${icono}" style="font-size:20px;color:${color};flex-shrink:0"></i>
        <span style="font-size:12.5px;font-weight:500;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${f.name}</span>
        <span style="font-size:11px;color:var(--tl);flex-shrink:0">${(f.size/1024).toFixed(0)} KB</span>
        <button data-nombre="${f.name}" onclick="quitarEvidencia(this.dataset.nombre)"
          style="border:none;background:none;cursor:pointer;color:var(--tl);font-size:16px;flex-shrink:0;padding:0;display:flex;align-items:center">
          <i class="ti ti-x"></i>
        </button>
      </div>`;
  }).join('');
}

// ============================================================
// AUTOCOMPLETE PROVINCIA
// ============================================================

function autocompletarProvincia(idAsociacion) {
  const aso   = CAT.asociaciones.find(a => a['ID_Asociacion'] === idAsociacion);
  const input = document.getElementById('ent-provincia');
  if (input) input.value = aso?.['Provincia'] || '';
}

// ============================================================
// CALCULAR VALOR EN TIEMPO REAL
// ============================================================

function calcularValorMaterial(mid) {
  const kg    = parseFloat(document.getElementById('mat-kg-'+mid)?.value||0);
  const precio = parseFloat(document.getElementById('mat-precio-'+mid)?.value||0);
  const venta  = kg * precio;
  const el = document.getElementById('mat-venta-'+mid);
  if (el) el.textContent = venta > 0 ? fmtMoney(venta) : '—';

  let t = 0;
  document.querySelectorAll('[id^="mat-kg-"]').forEach(inp => {
    const m2 = inp.id.replace('mat-kg-','');
    const k2 = parseFloat(inp.value||0);
    const p2 = parseFloat(document.getElementById('mat-precio-'+m2)?.value||0);
    t += k2 * p2;
  });
  const elTotal = document.getElementById('ent-total');
  if (elTotal) elTotal.textContent = fmtMoney(t);
}

// ============================================================
// GUARDAR ENTREGA
// ============================================================

async function guardarEntrega(id) {
  const fecha     = document.getElementById('ent-fecha')?.value;
  const anio      = document.getElementById('ent-anio')?.value;
  const mes       = document.getElementById('ent-mes')?.value;
  const idAsoc    = document.getElementById('ent-asociacion')?.value;
  const provincia = document.getElementById('ent-provincia')?.value;
  const idComp    = document.getElementById('ent-comprador')?.value;
  const nivel     = document.getElementById('ent-nivel')?.value;
  const actividad = document.getElementById('ent-actividad')?.value;
  const destino   = document.getElementById('ent-destino')?.value;
  const obs       = document.getElementById('ent-obs')?.value;

  if (!idAsoc || !idComp || !anio || !mes) {
    showToast('Completa los campos obligatorios');
    return;
  }

  const MATS = (CAT.materiales.length > 0 ? CAT.materiales : [
    {Nombre:'PET'},{Nombre:'Plástico Suave'},{Nombre:'Plástico Duro'},{Nombre:'Lata Aluminio'},
    {Nombre:'Vidrio'},{Nombre:'Cartón'},{Nombre:'Chatarra'},{Nombre:'Cobre'},
    {Nombre:'Papel Archivo'},{Nombre:'Periódico'},{Nombre:'Soplado'},{Nombre:'Tetrapak'},
    {Nombre:'Suela'},{Nombre:'Bronce'},{Nombre:'Batería'},{Nombre:'Acero'},
  ]).map(m => m['Nombre']);

  const data = {
    'ID_Entrega': id || '',
    'Fecha': fecha, 'Año': anio, 'Mes': mes,
    'ID_Asociacion': idAsoc, 'Provincia': provincia,
    'ID_Comprador': idComp, 'Nivel Intermediacion': nivel,
    'Actividad Fuente': actividad, 'Destino Final': destino,
    'Observaciones': obs, 'ID_Usuario': SESSION.email,
  };

  MATS.forEach(n => {
    const mid = n.replace(/[^a-zA-Z0-9]/g,'_');
    data[n+' Kilos']  = parseFloat(document.getElementById('mat-kg-'+mid)?.value||0);
    data[n+' Precio'] = parseFloat(document.getElementById('mat-precio-'+mid)?.value||0);
  });

  const btn = document.getElementById('btn-guardar-entrega');
  if (btn) { btn.disabled=true; btn.innerHTML='<i class="ti ti-loader"></i> Guardando...'; }

  try {
    const res = await apiPost({ action: 'saveEntrega', data });
    if (!res.ok) { showToast('Error: '+(res.error||'desconocido')); return; }

    if (EVIDENCIAS_LISTA.length > 0 && res.folderId) {
      showToast('Subiendo evidencias...');
      for (const archivo of EVIDENCIAS_LISTA) {
        await subirDrive(archivo, res.folderId, archivo.name);
      }
    }

    showToast(id ? 'Entrega actualizada ✓' : 'Entrega guardada ✓');
    EVIDENCIAS_LISTA = [];
    cerrarModal();
    await cargarEntregas();
  } catch(e) {
    console.error(e);
    showToast('Error al guardar');
  } finally {
    if (btn) { btn.disabled=false; btn.innerHTML='<i class="ti ti-check"></i> Guardar entrega'; }
  }
}

// ============================================================
// COMPRADORES
// ============================================================

function verCompradoresModal() {
  const filas = CAT.compradores.length ? CAT.compradores.map(c => `
    <tr>
      <td style="font-weight:500">${c['Nombre']}</td>
      <td>${nivelBadge(c['Nivel Intermediacion'])}</td>
      <td>${c['Provincia']||'—'}</td>
      <td><span class="badge ${c['Activo']===true||c['Activo']==='TRUE'||c['Activo']==='Sí'?'badge-green':'badge-warn'}">
        ${c['Activo']===true||c['Activo']==='TRUE'||c['Activo']==='Sí'?'Sí':'No'}
      </span></td>
      <td>
        <div class="td-actions">
          <button class="btn btn-primary btn-sm" data-id="${c['ID_Comprador']}" onclick="abrirFormComprador(this.dataset.id)">
            <i class="ti ti-pencil"></i>
          </button>
        </div>
      </td>
    </tr>`).join('')
    : '<tr><td colspan="5" style="text-align:center;color:var(--tl);padding:30px">No hay compradores</td></tr>';

  abrirModal(`
    <div class="modal" style="max-width:600px">
      <div class="modal-head">
        <div class="modal-title">Compradores</div>
        <button class="modal-close" onclick="cerrarModal()"><i class="ti ti-x"></i></button>
      </div>
      <div class="modal-body" style="padding:0">
        <div class="table-wrap" style="border:none;border-radius:0"><table>
          <thead><tr><th>Nombre</th><th>Nivel</th><th>Provincia</th><th>Activo</th><th></th></tr></thead>
          <tbody>${filas}</tbody>
        </table></div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-success" onclick="cerrarModal();abrirFormComprador()">
          <i class="ti ti-plus"></i> Nuevo comprador
        </button>
        <button class="btn btn-glass" onclick="cerrarModal()">Cerrar</button>
      </div>
    </div>
  `);
}

function abrirFormComprador(id = null) {
  const c = id ? CAT.compradores.find(x => x['ID_Comprador'] === id) : null;
  abrirModal(`
    <div class="modal" style="max-width:440px">
      <div class="modal-head">
        <div class="modal-title">${c?'Editar comprador':'Nuevo comprador'}</div>
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
              ${['Nivel 1','Nivel 2','Nivel 3','Transformador'].map(n=>`<option value="${n}" ${c?.['Nivel Intermediacion']===n?'selected':''}>${n}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Provincia</label>
            <input type="text" class="form-input" id="com-provincia" value="${c?.['Provincia']||''}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Activo</label>
          <select class="form-select" id="com-activo">
            <option value="Sí" ${c?.['Activo']==='Sí'||c?.['Activo']===true||c?.['Activo']==='TRUE'?'selected':''}>Sí</option>
            <option value="No" ${c?.['Activo']==='No'||c?.['Activo']===false?'selected':''}>No</option>
          </select>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-glass" onclick="cerrarModal()">Cancelar</button>
        <button class="btn btn-primary" id="btn-guardar-com" data-id="${id||''}" onclick="guardarCompradorEntregas(this.dataset.id)">
          <i class="ti ti-check"></i> ${c?'Actualizar':'Guardar'}
        </button>
      </div>
    </div>
  `);
}

async function guardarCompradorEntregas(id) {
  const nombre    = document.getElementById('com-nombre')?.value?.trim();
  const nivel     = document.getElementById('com-nivel')?.value;
  const provincia = document.getElementById('com-provincia')?.value?.trim();
  const activo    = document.getElementById('com-activo')?.value;
  if (!nombre) { showToast('El nombre es obligatorio'); return; }
  const btn = document.getElementById('btn-guardar-com');
  if (btn) { btn.disabled=true; btn.innerHTML='<i class="ti ti-loader"></i> Guardando...'; }
  try {
    const res = await apiPost({ action:'saveComprador', data:{
      ID_Comprador:id||'', Nombre:nombre,
      'Nivel Intermediacion':nivel, Provincia:provincia, Activo:activo
    }});
    if (!res.ok) { showToast('Error: '+(res.error||'desconocido')); return; }
    showToast(id?'Comprador actualizado ✓':'Comprador creado ✓');
    invalidarCache();
    const coms = await apiGet({ action:'getCompradores' });
    if (coms.ok) CAT.compradores = coms.data;
    cerrarModal();
    verCompradoresModal();
  } catch(e) { showToast('Error al guardar'); }
  finally { if (btn) { btn.disabled=false; btn.innerHTML='<i class="ti ti-check"></i> Guardar'; } }
}
