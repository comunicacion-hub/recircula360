// ============================================================
// RECIRCULA 360 — entregas.js
// Registro y tabla de entregas de material
// ============================================================

let ENTREGAS_DATA = [];
let ENTREGAS_FILTROS = { anio: '', mes: '', asociacion: '' };

// ============================================================
// RENDER PRINCIPAL
// ============================================================

async function renderEntregas() {
  // Botón nueva entrega en topbar
  document.getElementById('topbar-actions').innerHTML = `
    <button class="btn btn-primary" onclick="abrirFormEntrega()">
      <i class="ti ti-plus"></i> Nueva entrega
    </button>
  `;

  const content = document.getElementById('main-content');
  content.innerHTML = `
    <!-- Filtros -->
    <div class="filters-bar">
      <span class="filter-label-inline"><i class="ti ti-adjustments-horizontal"></i> Filtros</span>
      <div class="filter-divider"></div>
      <select class="filter-select-sm" id="ef-anio" onchange="filtrarEntregas('anio',this.value)">
        <option value="">Todos los años</option>
      </select>
      <select class="filter-select-sm" id="ef-mes" onchange="filtrarEntregas('mes',this.value)">
        <option value="">Todos los meses</option>
        ${['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
          .map(m => `<option value="${m}">${m}</option>`).join('')}
      </select>
      <select class="filter-select-sm" id="ef-asociacion" onchange="filtrarEntregas('asociacion',this.value)">
        <option value="">Todas las asociaciones</option>
        ${CAT.asociaciones.map(a => `<option value="${a['ID_Asociacion']}">${a['Nombre']}</option>`).join('')}
      </select>
      <button class="btn-reset-filters" onclick="resetFiltrosEntregas()">
        <i class="ti ti-x"></i> Limpiar
      </button>
    </div>

    <!-- Tabla -->
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
// CARGAR ENTREGAS
// ============================================================

async function cargarEntregas() {
  try {
    const res = await apiGet({ action: 'getEntregas', ...ENTREGAS_FILTROS });
    if (!res.ok) { showToast('Error cargando entregas'); return; }
    ENTREGAS_DATA = res.data;

    // Poblar filtro de años
    const anios = [...new Set(ENTREGAS_DATA.map(r => String(r['Año'])).filter(Boolean))].sort();
    const selAnio = document.getElementById('ef-anio');
    if (selAnio) {
      const cur = ENTREGAS_FILTROS.anio;
      selAnio.innerHTML = '<option value="">Todos los años</option>' +
        anios.map(a => `<option value="${a}" ${a===cur?'selected':''}>${a}</option>`).join('');
    }

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
  ENTREGAS_FILTROS = { anio: '', mes: '', asociacion: '' };
  ['ef-anio','ef-mes','ef-asociacion'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  cargarEntregas();
}

// ============================================================
// TABLA DE ENTREGAS
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
    const tieneCarpeta = e['ID_Carpeta_Evidencia'];

    return `
      <tr>
        <td style="font-size:12px;color:var(--tm)">${fmtFecha(e['Fecha'])}</td>
        <td style="font-weight:500">${e['_nombreAsociacion'] || '—'}</td>
        <td>${e['_nombreComprador'] || '—'}</td>
        <td>${nivelBadge(e['_nivelComprador'] || e['Nivel Intermediacion'])}</td>
        <td style="text-align:right;font-weight:600">${fmtNum(petKg)} kg</td>
        <td style="text-align:right">${fmtNum(suaveKg)} kg</td>
        <td style="text-align:right">${fmtNum(duroKg)} kg</td>
        <td style="text-align:right;font-weight:700;color:var(--g2)">${fmtMoney(total)}</td>
        <td>
          ${tieneCarpeta
            ? `<a href="https://drive.google.com/drive/folders/${e['ID_Carpeta_Evidencia']}" target="_blank" class="btn btn-glass btn-sm"><i class="ti ti-folder"></i></a>`
            : '<span style="color:var(--tl);font-size:12px">—</span>'
          }
        </td>
        <td>
          <div class="td-actions">
            <button class="btn btn-glass btn-sm" onclick="verEntrega('${e['ID_Entrega']}')">
              <i class="ti ti-eye"></i>
            </button>
            ${SESSION.rol !== 'Visualizador' ? `
            <button class="btn btn-primary btn-sm" onclick="editarEntrega('${e['ID_Entrega']}')">
              <i class="ti ti-pencil"></i>
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
            <th>Fecha</th>
            <th>Asociación</th>
            <th>Comprador</th>
            <th>Nivel</th>
            <th style="text-align:right">PET kg</th>
            <th style="text-align:right">Suave kg</th>
            <th style="text-align:right">Duro kg</th>
            <th style="text-align:right">Valor total</th>
            <th>Evidencia</th>
            <th></th>
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
// VER ENTREGA (modal detalle)
// ============================================================

function verEntrega(id) {
  const e = ENTREGAS_DATA.find(r => r['ID_Entrega'] === id);
  if (!e) return;

  const materiales = [
    'PET','Plástico Suave','Plástico Duro','Lata Aluminio',
    'Vidrio','Cartón','Chatarra','Cobre','Papel Archivo','Periódico','Soplado','Tetrapak'
  ];

  const filasMat = materiales
    .filter(m => parseFloat(e[m + ' Kilos'] || 0) > 0)
    .map(m => {
      const kg    = parseFloat(e[m + ' Kilos'] || 0);
      const precio = parseFloat(e[m + ' Precio'] || 0);
      const venta  = parseFloat(e[m + ' Valor Venta'] || 0);
      const esPrio = ['PET','Plástico Suave','Plástico Duro'].includes(m);
      return `
        <tr>
          <td style="${esPrio ? 'font-weight:600;color:var(--b1)' : ''}">${m}</td>
          <td style="text-align:right">${fmtNum(kg)} kg</td>
          <td style="text-align:right">$${fmtNum(precio,2)}/kg</td>
          <td style="text-align:right;font-weight:600;color:var(--g2)">${fmtMoney(venta)}</td>
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
          <div>
            <div class="form-label">Fecha</div>
            <div style="font-size:14px">${fmtFecha(e['Fecha'])}</div>
          </div>
          <div>
            <div class="form-label">Año / Mes</div>
            <div style="font-size:14px">${e['Año']} · ${e['Mes']}</div>
          </div>
          <div>
            <div class="form-label">Asociación</div>
            <div style="font-size:14px;font-weight:500">${e['_nombreAsociacion'] || '—'}</div>
          </div>
          <div>
            <div class="form-label">Comprador</div>
            <div style="font-size:14px">${e['_nombreComprador'] || '—'}</div>
          </div>
          <div>
            <div class="form-label">Nivel intermediación</div>
            <div>${nivelBadge(e['Nivel Intermediacion'])}</div>
          </div>
          <div>
            <div class="form-label">Valor total</div>
            <div style="font-size:18px;font-weight:700;color:var(--g2)">${fmtMoney(e['Valor Total'])}</div>
          </div>
        </div>

        <div class="materiales-section">
          <div class="materiales-section-title">Materiales entregados</div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>Material</th><th style="text-align:right">Kilos</th><th style="text-align:right">Precio</th><th style="text-align:right">Valor venta</th></tr>
              </thead>
              <tbody>${filasMat}</tbody>
            </table>
          </div>
        </div>

        ${e['Observaciones'] ? `
          <div style="margin-top:14px">
            <div class="form-label">Observaciones</div>
            <div style="font-size:13px;color:var(--tm)">${e['Observaciones']}</div>
          </div>` : ''}

        ${e['ID_Carpeta_Evidencia'] ? `
          <div style="margin-top:14px">
            <a href="https://drive.google.com/drive/folders/${e['ID_Carpeta_Evidencia']}" target="_blank" class="btn btn-glass">
              <i class="ti ti-folder"></i> Ver evidencias en Drive
            </a>
          </div>` : ''}
      </div>
    </div>
  `);
}

// ============================================================
// FORMULARIO NUEVA / EDITAR ENTREGA
// ============================================================

function abrirFormEntrega(id = null) {
  const e = id ? ENTREGAS_DATA.find(r => r['ID_Entrega'] === id) : null;
  const titulo = e ? 'Editar entrega' : 'Nueva entrega';

  const materialesActivos = CAT.materiales.length > 0
    ? CAT.materiales
    : [
        { Nombre: 'PET',             Priorizable: 'Sí' },
        { Nombre: 'Plástico Suave',  Priorizable: 'Sí' },
        { Nombre: 'Plástico Duro',   Priorizable: 'Sí' },
        { Nombre: 'Lata Aluminio',   Priorizable: 'No' },
        { Nombre: 'Vidrio',          Priorizable: 'No' },
        { Nombre: 'Cartón',          Priorizable: 'No' },
        { Nombre: 'Chatarra',        Priorizable: 'No' },
        { Nombre: 'Cobre',           Priorizable: 'No' },
        { Nombre: 'Papel Archivo',   Priorizable: 'No' },
        { Nombre: 'Periódico',       Priorizable: 'No' },
        { Nombre: 'Soplado',         Priorizable: 'No' },
        { Nombre: 'Tetrapak',        Priorizable: 'No' },
      ];

  // Separar priorizables del resto
  const priorizables = materialesActivos.filter(m => m['Priorizable'] === 'Sí' || m['Priorizable'] === true);
  const otros        = materialesActivos.filter(m => m['Priorizable'] !== 'Sí' && m['Priorizable'] !== true);

  function filaMaterial(mat) {
    const nombre = mat['Nombre'];
    const esPrio = mat['Priorizable'] === 'Sí' || mat['Priorizable'] === true;
    const kg     = e ? (e[nombre + ' Kilos']  || '') : '';
    const precio = e ? (e[nombre + ' Precio'] || '') : '';
    const venta  = e ? (e[nombre + ' Valor Venta'] || 0) : 0;
    const mid    = nombre.replace(/\s/g,'_').replace(/[^a-zA-Z0-9_]/g,'');
    return `
      <div class="material-row ${esPrio ? 'material-priorizable' : ''}">
        <div class="material-row-label">${nombre}${esPrio ? ' <span class="badge badge-cyan" style="font-size:9px;padding:1px 6px">Priorizable</span>' : ''}</div>
        <input type="number" class="form-input" id="mat-kg-${mid}" placeholder="Kilos" value="${kg}" min="0" step="0.01"
          oninput="calcularValorMaterial('${mid}','${nombre}')">
        <input type="number" class="form-input" id="mat-precio-${mid}" placeholder="$/kg" value="${precio}" min="0" step="0.01"
          oninput="calcularValorMaterial('${mid}','${nombre}')">
        <div class="material-valor" id="mat-venta-${mid}">${venta > 0 ? fmtMoney(venta) : '—'}</div>
      </div>`;
  }

  abrirModal(`
    <div class="modal" style="max-width:680px">
      <div class="modal-head">
        <div class="modal-title">${titulo}</div>
        <button class="modal-close" onclick="cerrarModal()"><i class="ti ti-x"></i></button>
      </div>
      <div class="modal-body">

        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">Fecha *</label>
            <input type="date" class="form-input" id="ent-fecha" value="${e?.Fecha ? String(e.Fecha).substring(0,10) : new Date().toISOString().substring(0,10)}">
          </div>
          <div class="form-group">
            <label class="form-label">Asociación *</label>
            <select class="form-select" id="ent-asociacion">
              <option value="">Selecciona una asociación</option>
              ${CAT.asociaciones.map(a =>
                `<option value="${a['ID_Asociacion']}" ${e?.['ID_Asociacion']===a['ID_Asociacion']?'selected':''}>${a['Nombre']}</option>`
              ).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Comprador *</label>
            <select class="form-select" id="ent-comprador">
              <option value="">Selecciona un comprador</option>
              ${CAT.compradores.map(c =>
                `<option value="${c['ID_Comprador']}" ${e?.['ID_Comprador']===c['ID_Comprador']?'selected':''}>${c['Nombre']}</option>`
              ).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Nivel intermediación</label>
            <select class="form-select" id="ent-nivel">
              ${['Nivel 1','Nivel 2','Nivel 3','Transformador'].map(n =>
                `<option value="${n}" ${e?.['Nivel Intermediacion']===n?'selected':''}>${n}</option>`
              ).join('')}
            </select>
          </div>
        </div>

        <!-- Materiales priorizables -->
        <div class="materiales-section" style="margin-bottom:14px">
          <div class="materiales-section-title">Materiales priorizables</div>
          <div class="material-row" style="font-size:10px;font-weight:600;color:var(--tl);text-transform:uppercase;margin-bottom:6px">
            <div>Material</div><div>Kilos</div><div>Precio $/kg</div><div style="text-align:right">Valor venta</div>
          </div>
          ${priorizables.map(filaMaterial).join('')}
        </div>

        <!-- Otros materiales -->
        <div class="materiales-section">
          <div class="materiales-section-title">Otros materiales</div>
          <div class="material-row" style="font-size:10px;font-weight:600;color:var(--tl);text-transform:uppercase;margin-bottom:6px">
            <div>Material</div><div>Kilos</div><div>Precio $/kg</div><div style="text-align:right">Valor venta</div>
          </div>
          ${otros.map(filaMaterial).join('')}
        </div>

        <!-- Total calculado -->
        <div style="margin-top:14px;display:flex;justify-content:flex-end;align-items:center;gap:12px">
          <span style="font-size:13px;color:var(--tm);font-weight:600">VALOR TOTAL:</span>
          <span id="ent-total" style="font-size:22px;font-weight:700;color:var(--g2)">${e ? fmtMoney(e['Valor Total']) : '$0.00'}</span>
        </div>

        <!-- Observaciones -->
        <div class="form-group" style="margin-top:14px">
          <label class="form-label">Observaciones</label>
          <textarea class="form-textarea" id="ent-obs" placeholder="Notas adicionales...">${e?.Observaciones || ''}</textarea>
        </div>

        <!-- Evidencias -->
        <div class="form-group">
          <label class="form-label">Evidencias (actas, fotos de pesaje)</label>
          <input type="file" id="ent-evidencias" multiple accept=".pdf,.jpg,.jpeg,.png,.webp"
            style="font-size:13px;color:var(--tm)">
          <div class="form-hint">Se subirán automáticamente a la carpeta Drive de la asociación</div>
          ${e?.['ID_Carpeta_Evidencia'] ? `
            <a href="https://drive.google.com/drive/folders/${e['ID_Carpeta_Evidencia']}" target="_blank"
              class="btn btn-glass btn-sm" style="margin-top:8px">
              <i class="ti ti-folder"></i> Ver evidencias actuales
            </a>` : ''}
        </div>
      </div>

      <div class="modal-foot">
        <button class="btn btn-glass" onclick="cerrarModal()">Cancelar</button>
        <button class="btn btn-primary" id="btn-guardar-entrega" onclick="guardarEntrega('${id || ''}')">
          <i class="ti ti-check"></i> ${e ? 'Actualizar' : 'Guardar entrega'}
        </button>
      </div>
    </div>
  `);
}

function editarEntrega(id) {
  abrirFormEntrega(id);
}

// ── Calcular valor en tiempo real ─────────────────────────
function calcularValorMaterial(mid, nombre) {
  const kg     = parseFloat(document.getElementById('mat-kg-' + mid)?.value || 0);
  const precio = parseFloat(document.getElementById('mat-precio-' + mid)?.value || 0);
  const venta  = kg * precio;

  const el = document.getElementById('mat-venta-' + mid);
  if (el) el.textContent = venta > 0 ? fmtMoney(venta) : '—';

  // Recalcular total general
  let total = 0;
  document.querySelectorAll('[id^="mat-venta-"]').forEach(el => {
    const v = parseFloat(el.textContent.replace(/[$,]/g,'')) || 0;
    total += v;
  });
  const elTotal = document.getElementById('ent-total');
  if (elTotal) elTotal.textContent = fmtMoney(total);
}

// ============================================================
// GUARDAR ENTREGA
// ============================================================

async function guardarEntrega(id) {
  const fecha     = document.getElementById('ent-fecha')?.value;
  const idAsoc    = document.getElementById('ent-asociacion')?.value;
  const idComp    = document.getElementById('ent-comprador')?.value;
  const nivel     = document.getElementById('ent-nivel')?.value;
  const obs       = document.getElementById('ent-obs')?.value;
  const archivos  = document.getElementById('ent-evidencias')?.files;

  if (!fecha || !idAsoc || !idComp) {
    showToast('Completa los campos obligatorios');
    return;
  }

  // Construir objeto de datos
  const data = {
    'ID_Entrega':          id || '',
    'Fecha':               fecha,
    'ID_Asociacion':       idAsoc,
    'ID_Comprador':        idComp,
    'Nivel Intermediacion': nivel,
    'Observaciones':       obs,
    'ID_Usuario':          SESSION.email,
  };

  // Recoger materiales
  const materiales = CAT.materiales.length > 0
    ? CAT.materiales.map(m => m['Nombre'])
    : ['PET','Plástico Suave','Plástico Duro','Lata Aluminio','Vidrio','Cartón','Chatarra','Cobre','Papel Archivo','Periódico','Soplado','Tetrapak'];

  materiales.forEach(nombre => {
    const mid    = nombre.replace(/\s/g,'_').replace(/[^a-zA-Z0-9_]/g,'');
    const kg     = parseFloat(document.getElementById('mat-kg-' + mid)?.value || 0);
    const precio = parseFloat(document.getElementById('mat-precio-' + mid)?.value || 0);
    data[nombre + ' Kilos']  = kg;
    data[nombre + ' Precio'] = precio;
  });

  // Deshabilitar botón
  const btn = document.getElementById('btn-guardar-entrega');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader"></i> Guardando...'; }

  try {
    const res = await apiPost({ action: 'saveEntrega', data });
    if (!res.ok) { showToast('Error: ' + (res.error || 'desconocido')); return; }

    // Subir evidencias a Drive si las hay
    if (archivos && archivos.length > 0 && res.folderId) {
      showToast('Subiendo evidencias...');
      for (const archivo of archivos) {
        await subirDrive(archivo, res.folderId, archivo.name);
      }
    }

    showToast(id ? 'Entrega actualizada ✓' : 'Entrega guardada ✓');
    cerrarModal();
    await cargarEntregas();
  } catch(e) {
    console.error(e);
    showToast('Error al guardar');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-check"></i> Guardar entrega'; }
  }
}
