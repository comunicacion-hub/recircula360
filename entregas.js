// ============================================================
// RECIRCULA 360 — Apps Script completo v2
// ============================================================

const SHEET_ID = '1WwvL0kna3SiFrByvIV4kJjJ1An7Dz4OYMDb6SCz8VD0';
const DRIVE_FOLDER_ROOT = '1AQyBa9AAdVzukBaZxWa7jpSN2DYkoFhv';
const DOMAIN            = 'redesconrostro.org';

const SHEET = {
  ASOCIACIONES: 'Asociaciones',
  ENTREGAS:     'Entregas',
  COMPRADORES:  'Compradores',
  MATERIALES:   'Materiales',
  ACCESOS:      'Accesos',
  USUARIOS:     'Usuarios',
  CONFIG:       'Configuracion',
};

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
];

const PROVINCIAS = [
  'El Oro','Guayas','Manabí','Sucumbíos','Pichincha','Chimborazo'
];

const MATERIALES_TODOS = [
  'PET','Plástico Suave','Plástico Duro','Lata Aluminio','Vidrio','Cartón',
  'Chatarra','Cobre','Papel Archivo','Periódico','Soplado','Tetrapak',
  'Suela','Bronce','Batería','Acero'
];

// ============================================================
// ROUTER — doGet
// ============================================================

function doGet(e) {
  const action = e.parameter.action;
  let result;
  try {
    switch (action) {
      case 'getUsuario':        result = getUsuario(e.parameter.email); break;
      case 'getCatalogos':      result = getCatalogos(e.parameter.rol); break;
      case 'getAsociaciones':   result = getAsociaciones(); break;
      case 'getAllAsociaciones': result = getAllAsociaciones(); break;
      case 'getCompradores':    result = getCompradores(); break;
      case 'getMateriales':     result = getMateriales(); break;
      case 'getAccesos':        result = getAccesos(e.parameter.rol); break;
      case 'getEntregas':       result = getEntregas(e.parameter); break;
      case 'getDashboard':      result = getDashboardData(e.parameter); break;
      case 'getUsuariosTodos':  result = getUsuariosTodos(); break;
      case 'getConfig':         result = getConfig(); break;
      default:
        result = { ok: false, error: 'Acción no reconocida: ' + action };
    }
  } catch (err) {
    Logger.log('doGet error: ' + err + '\n' + err.stack);
    result = { ok: false, error: err.message };
  }
  return jsonOut(result);
}

// ============================================================
// ROUTER — doPost
// ============================================================

function doPost(e) {
  let body = {};
  try { body = JSON.parse(e.postData.contents); }
  catch (err) { return jsonOut({ ok: false, error: 'Body no es JSON válido' }); }

  const action = body.action;
  let result;
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    switch (action) {
      case 'saveEntrega':      result = saveEntrega(body.data); break;
      case 'deleteEntrega':    result = deleteEntrega(body.id, body.folderId); break;
      case 'saveAsociacion':   result = saveAsociacion(body.data); break;
      case 'saveComprador':    result = saveComprador(body.data); break;
      case 'saveMaterial':     result = saveMaterial(body.data); break;
      case 'saveUsuario':      result = saveUsuario(body.data); break;
      case 'saveAcceso':       result = saveAcceso(body.data); break;
      case 'deleteRow':        result = deleteRow(body.sheet, body.id); break;
      case 'crearCarpetaAsoc': result = crearCarpetaAsociacion(body.idAsociacion, body.nombre); break;
      default:
        result = { ok: false, error: 'Acción no reconocida: ' + action };
    }
  } catch (err) {
    Logger.log('doPost error: ' + err + '\n' + err.stack);
    result = { ok: false, error: err.message };
  } finally {
    try { lock.releaseLock(); } catch(_) {}
  }
  return jsonOut(result);
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// UTILIDADES
// ============================================================

function getSheet(nombre) {
  const ws = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nombre);
  if (!ws) throw new Error('Hoja no encontrada: ' + nombre);
  return ws;
}

function sheetToObjects(nombre) {
  const ws   = getSheet(nombre);
  const data = ws.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { if (h) obj[h] = row[i]; });
    return obj;
  });
}

function generarID(prefijo) {
  return prefijo + '_' + new Date().getTime() + '_' + Math.floor(Math.random() * 1000);
}

function parseFechaLocal(fecha) {
  if (!fecha) return null;
  if (fecha instanceof Date) return fecha;
  if (typeof fecha === 'string') {
    const m = fecha.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  const d = new Date(fecha);
  return isNaN(d) ? null : d;
}

function toNum(row, campo) {
  const v = row[campo];
  if (v === '' || v === null || v === undefined) return 0;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function sumar(rows, campo) {
  return rows.reduce((s, r) => s + toNum(r, campo), 0);
}

function esTruthy(v) {
  if (v === true || v === 1) return true;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    return s === 'true' || s === 'sí' || s === 'si' || s === '1' || s === 'x';
  }
  return false;
}

function sumaTotalMateriales(rows) {
  return MATERIALES_TODOS.reduce((s, m) => s + sumar(rows, m + ' Kilos'), 0) / 1000;
}

// ============================================================
// CATÁLOGOS — una sola llamada al iniciar
// ============================================================

function getCatalogos(rol) {
  const asociaciones = sheetToObjects(SHEET.ASOCIACIONES);
  const compradores  = sheetToObjects(SHEET.COMPRADORES).filter(r => esTruthy(r['Activo']));
  const materiales   = sheetToObjects(SHEET.MATERIALES).filter(r => esTruthy(r['Activo']));
  const accesos      = sheetToObjects(SHEET.ACCESOS)
    .filter(r => esTruthy(r['Activo']))
    .filter(r => r['Visible para'] === 'Todos' ||
      (r['Visible para'] === 'Solo admin' && rol === 'Admin'));
  const activas = asociaciones.filter(r =>
    (r['Estado'] || '').toString().toLowerCase() === 'activa');

  return {
    ok: true,
    data: { asociaciones: activas, todasAsociaciones: asociaciones, compradores, materiales, accesos }
  };
}

// ============================================================
// USUARIOS
// ============================================================

function getUsuario(email) {
  if (!email) return { ok: false, error: 'Email requerido' };
  const usuarios = sheetToObjects(SHEET.USUARIOS);
  const u = usuarios.find(r => {
    const match = (r['Email'] || '').toString().toLowerCase() === email.toLowerCase();
    if (!match) return false;
    const activo = r.hasOwnProperty('Activo') ? esTruthy(r['Activo']) : true;
    return activo;
  });
  if (!u) return { ok: false, error: 'Usuario no autorizado' };
  return { ok: true, data: { nombre: u['Nombre'], email: u['Email'], rol: u['Rol'] } };
}

function getUsuariosTodos() {
  return { ok: true, data: sheetToObjects(SHEET.USUARIOS) };
}

function saveUsuario(data) {
  const ws      = getSheet(SHEET.USUARIOS);
  const rows    = ws.getDataRange().getValues();
  const headers = rows[0];
  const idIdx   = headers.indexOf('ID_Usuario');
  if (idIdx < 0) throw new Error('Falta columna ID_Usuario');

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][idIdx] === data.ID_Usuario) {
      const newRow = headers.map((h, k) => data[h] !== undefined ? data[h] : rows[i][k]);
      ws.getRange(i + 1, 1, 1, newRow.length).setValues([newRow]);
      return { ok: true, msg: 'Usuario actualizado' };
    }
  }
  const id  = data.ID_Usuario || generarID('USR');
  const row = headers.map(h => {
    if (h === 'ID_Usuario') return id;
    if (h === 'Activo') return data.Activo !== false;
    return data[h] !== undefined ? data[h] : '';
  });
  ws.appendRow(row);
  return { ok: true, id, msg: 'Usuario creado' };
}

// ============================================================
// ASOCIACIONES
// ============================================================

function getAsociaciones() {
  const data = sheetToObjects(SHEET.ASOCIACIONES)
    .filter(r => (r['Estado'] || '').toString().toLowerCase() === 'activa');
  return { ok: true, data };
}

function getAllAsociaciones() {
  return { ok: true, data: sheetToObjects(SHEET.ASOCIACIONES) };
}

function saveAsociacion(data) {
  const ws      = getSheet(SHEET.ASOCIACIONES);
  const rows    = ws.getDataRange().getValues();
  const headers = rows[0];
  const idIdx   = headers.indexOf('ID_Asociacion');
  if (idIdx < 0) throw new Error('Falta columna ID_Asociacion');

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][idIdx] === data.ID_Asociacion) {
      const newRow = headers.map((h, k) => data[h] !== undefined ? data[h] : rows[i][k]);
      ws.getRange(i + 1, 1, 1, newRow.length).setValues([newRow]);
      return { ok: true, msg: 'Asociación actualizada' };
    }
  }
  const id  = generarID('ASO');
  const row = headers.map(h => h === 'ID_Asociacion' ? id : (data[h] !== undefined ? data[h] : ''));
  ws.appendRow(row);
  return { ok: true, id, msg: 'Asociación creada' };
}

// ============================================================
// COMPRADORES
// ============================================================

function getCompradores() {
  const data = sheetToObjects(SHEET.COMPRADORES).filter(r => esTruthy(r['Activo']));
  return { ok: true, data };
}

function saveComprador(data) {
  const ws      = getSheet(SHEET.COMPRADORES);
  const rows    = ws.getDataRange().getValues();
  const headers = rows[0];
  const idIdx   = headers.indexOf('ID_Comprador');
  if (idIdx < 0) throw new Error('Falta columna ID_Comprador');

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][idIdx] === data.ID_Comprador) {
      const newRow = headers.map((h, k) => data[h] !== undefined ? data[h] : rows[i][k]);
      ws.getRange(i + 1, 1, 1, newRow.length).setValues([newRow]);
      return { ok: true, msg: 'Comprador actualizado' };
    }
  }
  const id  = generarID('COM');
  const row = headers.map(h => h === 'ID_Comprador' ? id : (data[h] !== undefined ? data[h] : ''));
  ws.appendRow(row);
  return { ok: true, id, msg: 'Comprador creado' };
}

// ============================================================
// MATERIALES
// ============================================================

function getMateriales() {
  const data = sheetToObjects(SHEET.MATERIALES).filter(r => esTruthy(r['Activo']));
  return { ok: true, data };
}

function saveMaterial(data) {
  const ws      = getSheet(SHEET.MATERIALES);
  const rows    = ws.getDataRange().getValues();
  const headers = rows[0];
  const idIdx   = headers.indexOf('ID_Material');
  if (idIdx < 0) throw new Error('Falta columna ID_Material');

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][idIdx] === data.ID_Material) {
      const newRow = headers.map((h, k) => data[h] !== undefined ? data[h] : rows[i][k]);
      ws.getRange(i + 1, 1, 1, newRow.length).setValues([newRow]);
      return { ok: true, msg: 'Material actualizado' };
    }
  }
  const id  = generarID('MAT');
  const row = headers.map(h => h === 'ID_Material' ? id : (data[h] !== undefined ? data[h] : ''));
  ws.appendRow(row);
  return { ok: true, id, msg: 'Material creado' };
}

// ============================================================
// ACCESOS
// ============================================================

function getAccesos(rol) {
  const data = sheetToObjects(SHEET.ACCESOS)
    .filter(r => esTruthy(r['Activo']))
    .filter(r => r['Visible para'] === 'Todos' ||
      (r['Visible para'] === 'Solo admin' && rol === 'Admin'));
  return { ok: true, data };
}

function saveAcceso(data) {
  const ws      = getSheet(SHEET.ACCESOS);
  const rows    = ws.getDataRange().getValues();
  const headers = rows[0];
  const idIdx   = headers.indexOf('ID');
  if (idIdx < 0) throw new Error('Falta columna ID en hoja Accesos');

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][idIdx] === data.ID) {
      const newRow = headers.map((h, k) => data[h] !== undefined ? data[h] : rows[i][k]);
      ws.getRange(i + 1, 1, 1, newRow.length).setValues([newRow]);
      return { ok: true, msg: 'Acceso actualizado' };
    }
  }
  const id  = generarID('ACC');
  const row = headers.map(h => {
    if (h === 'ID') return id;
    if (h === 'Creado por') return data.email || '';
    if (h === 'Fecha') return new Date();
    return data[h] !== undefined ? data[h] : '';
  });
  ws.appendRow(row);
  return { ok: true, id, msg: 'Acceso creado' };
}

// ============================================================
// ELIMINAR FILA GENÉRICA
// ============================================================

function deleteRow(sheetName, id) {
  const ws    = getSheet(sheetName);
  const rows  = ws.getDataRange().getValues();
  if (rows.length < 2) return { ok: false, error: 'Hoja vacía' };

  const ID_COLS = {
    'Accesos':      'ID',
    'Asociaciones': 'ID_Asociacion',
    'Compradores':  'ID_Comprador',
    'Materiales':   'ID_Material',
    'Usuarios':     'ID_Usuario',
    'Entregas':     'ID_Entrega',
  };
  const headers = rows[0];
  const idCol   = ID_COLS[sheetName] || headers[0];
  const idIdx   = headers.indexOf(idCol);
  if (idIdx < 0) return { ok: false, error: 'Columna ID no encontrada: ' + idCol };

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][idIdx]) === String(id)) {
      ws.deleteRow(i + 1);
      return { ok: true, msg: 'Fila eliminada' };
    }
  }
  return { ok: false, error: 'Registro no encontrado: ' + id };
}

// ============================================================
// ELIMINAR ENTREGA + CARPETA DRIVE
// ============================================================

function deleteEntrega(id, folderId) {
  if (!id) return { ok: false, error: 'ID de entrega requerido' };

  const ws      = getSheet(SHEET.ENTREGAS);
  const rows    = ws.getDataRange().getValues();
  const headers = rows[0];
  const idIdx   = headers.indexOf('ID_Entrega');
  if (idIdx < 0) return { ok: false, error: 'Falta columna ID_Entrega' };

  let encontrado = false;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][idIdx]) === String(id)) {
      ws.deleteRow(i + 1);
      encontrado = true;
      break;
    }
  }

  if (!encontrado) return { ok: false, error: 'Entrega no encontrada: ' + id };

  if (folderId) {
    try {
      DriveApp.getFolderById(folderId).setTrashed(true);
    } catch(e) {
      Logger.log('No se pudo eliminar carpeta ' + folderId + ': ' + e);
    }
  }

  return { ok: true, msg: 'Entrega eliminada' };
}

// ============================================================
// DRIVE — CARPETAS
// ============================================================

function crearCarpetaAsociacion(idAsociacion, nombreAsociacion) {
  if (!nombreAsociacion) return { ok: false, error: 'Nombre requerido' };
  const root     = DriveApp.getFolderById(DRIVE_FOLDER_ROOT);
  const existing = root.getFoldersByName(nombreAsociacion);
  if (existing.hasNext()) {
    const folder = existing.next();
    guardarCarpetaEnAsociacion(idAsociacion, folder.getId());
    return { ok: true, folderId: folder.getId(), msg: 'Carpeta ya existía' };
  }
  const folder = root.createFolder(nombreAsociacion);
  guardarCarpetaEnAsociacion(idAsociacion, folder.getId());
  return { ok: true, folderId: folder.getId(), msg: 'Carpeta creada' };
}

function guardarCarpetaEnAsociacion(idAsociacion, folderId) {
  const ws         = getSheet(SHEET.ASOCIACIONES);
  const rows       = ws.getDataRange().getValues();
  const headers    = rows[0];
  const idIdx      = headers.indexOf('ID_Asociacion');
  const carpetaIdx = headers.indexOf('ID_Carpeta_Drive');
  if (idIdx < 0 || carpetaIdx < 0) return;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][idIdx] === idAsociacion) {
      ws.getRange(i + 1, carpetaIdx + 1).setValue(folderId);
      return;
    }
  }
}

function obtenerOCrearSubcarpeta(carpetaPadreId, nombreSub) {
  const parent   = DriveApp.getFolderById(carpetaPadreId);
  const existing = parent.getFoldersByName(nombreSub);
  if (existing.hasNext()) return existing.next();
  return parent.createFolder(nombreSub);
}

function obtenerCarpetaMes(idAsociacion, fecha) {
  const asociaciones = sheetToObjects(SHEET.ASOCIACIONES);
  const aso = asociaciones.find(r => r['ID_Asociacion'] === idAsociacion);
  if (!aso || !aso['ID_Carpeta_Drive']) return null;
  const d = parseFechaLocal(fecha);
  if (!d) return null;
  const nombreMes = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2,'0') + ' ' + MESES[d.getMonth()];
  return obtenerOCrearSubcarpeta(aso['ID_Carpeta_Drive'], nombreMes).getId();
}

// ============================================================
// ENTREGAS
// ============================================================

function getEntregas(params) {
  const rows         = sheetToObjects(SHEET.ENTREGAS);
  const asociaciones = sheetToObjects(SHEET.ASOCIACIONES);
  const compradores  = sheetToObjects(SHEET.COMPRADORES);

  const asoMap = {};
  asociaciones.forEach(a => { asoMap[a['ID_Asociacion']] = a; });
  const comMap = {};
  compradores.forEach(c => { comMap[c['ID_Comprador']] = c; });

  let data = rows.map(r => ({
    ...r,
    _nombreAsociacion:    asoMap[r['ID_Asociacion']]?.['Nombre']                || '',
    _provinciaAsociacion: asoMap[r['ID_Asociacion']]?.['Provincia']             || r['Provincia'] || '',
    _ciudadAsociacion:    asoMap[r['ID_Asociacion']]?.['Ciudad']                || '',
    _nombreComprador:     comMap[r['ID_Comprador']]?.['Nombre']                 || '',
    _nivelComprador:      comMap[r['ID_Comprador']]?.['Nivel Intermediacion']   || '',
  }));

  if (params.anio)       data = data.filter(r => String(r['Año'])        === String(params.anio));
  if (params.mes)        data = data.filter(r => r['Mes']                === params.mes);
  if (params.provincia)  data = data.filter(r => r['_provinciaAsociacion'] === params.provincia);
  if (params.asociacion) data = data.filter(r => r['ID_Asociacion']      === params.asociacion);

  return { ok: true, data };
}

function saveEntrega(data) {
  if (!data['ID_Asociacion']) throw new Error('ID_Asociacion es obligatorio');

  const ws      = getSheet(SHEET.ENTREGAS);
  const rows    = ws.getDataRange().getValues();
  const headers = rows[0];
  const idIdx   = headers.indexOf('ID_Entrega');
  if (idIdx < 0) throw new Error('Falta columna ID_Entrega');

  // Calcular valores de materiales
  let valorTotal = 0;
  MATERIALES_TODOS.forEach(m => {
    const kilos  = parseFloat(data[m + ' Kilos']  || 0) || 0;
    const precio = parseFloat(data[m + ' Precio'] || 0) || 0;
    const venta  = +(kilos * precio).toFixed(2);
    data[m + ' Valor Venta'] = venta;
    valorTotal += venta;
  });
  data['Valor Total'] = +valorTotal.toFixed(2);

  // Buscar si es actualización
  let rowExistente    = -1;
  let existingFolder  = null;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][idIdx]) === String(data['ID_Entrega'])) {
      rowExistente   = i;
      const cIdx     = headers.indexOf('ID_Carpeta_Evidencia');
      if (cIdx >= 0) existingFolder = rows[i][cIdx];
      break;
    }
  }

  // Conservar carpeta existente en actualizaciones
  if (rowExistente >= 0 && existingFolder) {
    data['ID_Carpeta_Evidencia'] = existingFolder;
  } else if (!data['ID_Carpeta_Evidencia'] && data['ID_Asociacion'] && data['Mes'] && data['Año']) {
    try {
      const mesIdx = MESES.indexOf(data['Mes']);
      const fechaRef = new Date(parseInt(data['Año']), mesIdx, 1);
      const cId = obtenerCarpetaMes(data['ID_Asociacion'], fechaRef);
      if (cId) data['ID_Carpeta_Evidencia'] = cId;
    } catch(e) {
      Logger.log('No se pudo crear carpeta: ' + e);
    }
  }

  if (rowExistente >= 0) {
    const newRow = headers.map((h, k) => data[h] !== undefined ? data[h] : rows[rowExistente][k]);
    ws.getRange(rowExistente + 1, 1, 1, newRow.length).setValues([newRow]);
    return { ok: true, folderId: data['ID_Carpeta_Evidencia'], msg: 'Entrega actualizada' };
  }

  const id  = generarID('ENT');
  data['ID_Entrega'] = id;
  const row = headers.map(h => data[h] !== undefined ? data[h] : '');
  ws.appendRow(row);
  return { ok: true, id, folderId: data['ID_Carpeta_Evidencia'], msg: 'Entrega guardada' };
}

// ============================================================
// DASHBOARD
// ============================================================

function getDashboardData(params) {
  const entregas     = sheetToObjects(SHEET.ENTREGAS);
  const asociaciones = sheetToObjects(SHEET.ASOCIACIONES);
  const compradores  = sheetToObjects(SHEET.COMPRADORES);

  const asoMap = {};
  asociaciones.forEach(a => { asoMap[a['ID_Asociacion']] = a; });
  const comMap = {};
  compradores.forEach(c => { comMap[c['ID_Comprador']] = c; });

  let data = entregas.map(r => ({
    ...r,
    _provincia:        asoMap[r['ID_Asociacion']]?.['Provincia']           || r['Provincia'] || '',
    _ciudad:           asoMap[r['ID_Asociacion']]?.['Ciudad']              || '',
    _nombreAsociacion: asoMap[r['ID_Asociacion']]?.['Nombre']              || '',
    _nombreComprador:  comMap[r['ID_Comprador']]?.['Nombre']               || '',
    _nivelComprador:   comMap[r['ID_Comprador']]?.['Nivel Intermediacion'] || '',
  }));

  if (params.anio)       data = data.filter(r => String(r['Año'])   === String(params.anio));
  if (params.mes)        data = data.filter(r => r['Mes']           === params.mes);
  if (params.provincia)  data = data.filter(r => r['_provincia']    === params.provincia);
  if (params.ciudad)     data = data.filter(r => r['_ciudad']       === params.ciudad);
  if (params.asociacion) data = data.filter(r => r['ID_Asociacion'] === params.asociacion);

  const kpis = {
    totalTN:        sumaTotalMateriales(data),
    tnPriorizables: (sumar(data,'PET Kilos') + sumar(data,'Plástico Suave Kilos') + sumar(data,'Plástico Duro Kilos')) / 1000,
    ingresosPET:    sumar(data, 'PET Valor Venta'),
    tnPET:          sumar(data, 'PET Kilos') / 1000,
    tnSuave:        sumar(data, 'Plástico Suave Kilos') / 1000,
    tnDuro:         sumar(data, 'Plástico Duro Kilos') / 1000,
  };

  // Distribución por material
  const distribucion = {};
  MATERIALES_TODOS.forEach(m => {
    distribucion[m] = sumar(data, m + ' Kilos') / 1000;
  });

  // Por mes
  const porMes = {};
  MESES.forEach(m => { porMes[m] = { PET: 0, Suave: 0, Duro: 0, total: 0 }; });
  data.forEach(r => {
    const m = r['Mes'];
    if (porMes[m]) {
      porMes[m].PET   += toNum(r,'PET Kilos') / 1000;
      porMes[m].Suave += toNum(r,'Plástico Suave Kilos') / 1000;
      porMes[m].Duro  += toNum(r,'Plástico Duro Kilos') / 1000;
      porMes[m].total += toNum(r,'Valor Total');
    }
  });

  // Por provincia y mes
  const porProvMes = {};
  PROVINCIAS.forEach(p => {
    porProvMes[p] = {};
    MESES.forEach(m => { porProvMes[p][m] = 0; });
  });
  data.forEach(r => {
    const p = r['_provincia'], m = r['Mes'];
    if (porProvMes[p] && porProvMes[p][m] !== undefined)
      porProvMes[p][m] += toNum(r,'PET Kilos') / 1000;
  });

  // Ranking compradores
  const rankingMap = {};
  data.forEach(r => {
    const nombre = r['_nombreComprador'];
    if (!nombre) return;
    if (!rankingMap[nombre]) rankingMap[nombre] = {
      nombre, nivel: r['_nivelComprador'],
      tnPET: 0, precioPET: [], entregas: 0
    };
    rankingMap[nombre].tnPET    += toNum(r,'PET Kilos') / 1000;
    rankingMap[nombre].entregas += 1;
    if (toNum(r,'PET Precio') > 0) rankingMap[nombre].precioPET.push(toNum(r,'PET Precio'));
  });
  const ranking = Object.values(rankingMap)
    .map(c => ({ ...c, precioPETprom: c.precioPET.length > 0 ? c.precioPET.reduce((s,v)=>s+v,0)/c.precioPET.length : 0 }))
    .sort((a,b) => b.tnPET - a.tnPET)
    .slice(0,10)
    .map((c,i) => ({ ...c, ranking: i+1 }));

  // Colectivos (asociaciones con entregas)
  const colectivos = [...new Set(data.map(r => r['_nombreAsociacion']).filter(Boolean))];

  // Filtros disponibles
  const filtrosDisponibles = {
    anios: [...new Set(entregas.map(r => String(r['Año'])).filter(Boolean))].sort(),
    provincias: [...new Set(asociaciones.map(r => r['Provincia']).filter(Boolean))].sort(),
    asociaciones: asociaciones
      .filter(a => (a['Estado']||'').toString().toLowerCase() === 'activa')
      .map(a => ({ id: a['ID_Asociacion'], nombre: a['Nombre'] })),
  };

  return { ok: true, data: { kpis, distribucion, porMes, porProvMes, ranking, colectivos, filtrosDisponibles, meses: MESES, provincias: PROVINCIAS } };
}

// ============================================================
// CONFIGURACIÓN
// ============================================================

function getConfig() {
  try {
    const ws   = getSheet(SHEET.CONFIG);
    const rows = ws.getDataRange().getValues();
    const config = {};
    rows.forEach(r => { if (r[0]) config[r[0]] = r[1]; });
    return { ok: true, data: config };
  } catch(e) {
    return { ok: true, data: {} };
  }
}

// ============================================================
// TESTS
// ============================================================

function testGetUsuario() {
  Logger.log(JSON.stringify(getUsuario('comunicacion@redesconrostro.org')));
}
function testCatalogos() {
  Logger.log(JSON.stringify(getCatalogos('Admin')));
}
function testHojas() {
  Logger.log(SpreadsheetApp.openById(SHEET_ID).getSheets().map(h => h.getName()).join(' | '));
}
function testDeleteEntrega() {
  Logger.log(JSON.stringify(deleteEntrega('ENT_TEST', '')));
}
function testSheetID() {
  Logger.log('SHEET_ID actual: [' + SHEET_ID + ']');
  Logger.log('Longitud: ' + SHEET_ID.length);
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    Logger.log('OK: ' + ss.getName());
  } catch(e) {
    Logger.log('ERROR: ' + e);
  }
}
function testActivo() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log('ID activo: ' + ss.getId());
  Logger.log('Nombre: ' + ss.getName());
}
