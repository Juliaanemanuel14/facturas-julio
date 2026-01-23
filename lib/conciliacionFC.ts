import ExcelJS from 'exceljs';
import auxSociedades from './aux_sociedades.json';
import filtroFC from './filtro_fc.json';

// Convertir fecha a número de serie de Excel
function fechaAExcelSerial(fecha: Date | string | null | undefined): string {
  if (!fecha) return '';
  const date = typeof fecha === 'string' ? new Date(fecha) : fecha;
  if (isNaN(date.getTime())) return '';

  const baseDate = new Date(1899, 11, 30); // Excel base date
  const delta = Math.floor((date.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24));
  return String(delta);
}

// Procesar archivo ARCA - basado en app.py procesar_arca()
export function procesarArca(rows: any[]): any[] {
  const results: any[] = [];

  // Log para debug: mostrar las columnas de la primera fila
  if (rows.length > 0) {
    const keys = Object.keys(rows[0]);
    console.log('ARCA columnas detectadas:', keys.length, 'columnas');
    console.log('Primeras columnas:', keys.slice(0, 5));
    console.log('Columna 21 (V):', keys[21]);

    // Buscar columna que contenga "Recibido" o "Emitido" en sus valores
    let colSociedad = keys[21]; // Por defecto columna V
    for (const key of keys) {
      const val = String(rows[0][key] || '');
      if (val.includes('Recibido') || val.includes('Emitido') || val.includes('.json')) {
        colSociedad = key;
        console.log('Columna de sociedad encontrada:', key, '=', val);
        break;
      }
    }
  }

  for (const row of rows) {
    const keys = Object.keys(row);

    // Buscar la columna que contiene "Recibido"/"Emitido" (puede ser columna V o tener otro nombre)
    let valorColV = '';
    let colVName = '';

    // Primero intentar con índice 21 (columna V)
    if (keys[21]) {
      valorColV = String(row[keys[21]] || '');
      colVName = keys[21];
    }

    // Si no encuentra, buscar columna que contenga "Recibido" o "Emitido"
    if (!valorColV.includes('Recibido') && !valorColV.includes('Emitido')) {
      for (const key of keys) {
        const val = String(row[key] || '');
        if (val.includes('Recibido') || val.includes('Emitido')) {
          valorColV = val;
          colVName = key;
          break;
        }
      }
    }

    const comprobante = valorColV.substring(0, 8).trim();

    // Solo procesar recibidos
    if (comprobante !== 'Recibido') continue;

    // Extraer sociedad
    const sociedad = valorColV
      .replace('.json', '')
      .replace('Emitidos', '')
      .replace('Recibidos', '')
      .trim();

    // Punto de Venta y Número con padding
    const pv = String(row['Punto de Venta'] || '').split('.')[0].padStart(5, '0');
    const numDesde = String(row['Número Desde'] || '').split('.')[0].padStart(8, '0');

    // Monto - buscar columna 'Imp. Total' o usar índice 16
    let monto = '0';
    if (row['Imp. Total'] !== undefined) {
      monto = String(row['Imp. Total']).replace(',', '.');
    } else if (keys[16]) {
      monto = String(row[keys[16]] || '0').replace(',', '.');
    }
    monto = String(Math.round(Number(monto) || 0));

    // Parsear fecha - buscar columna 'Fecha' o usar primera columna
    let fecha: Date | null = null;
    const fechaCol = row['Fecha'] || row[keys[0]];
    if (fechaCol) {
      const fechaStr = String(fechaCol).replace(/-/g, '/');
      fecha = new Date(fechaStr);
      if (isNaN(fecha.getTime())) fecha = null;
    }

    // Generar IDs
    const id1 = pv + numDesde + monto;
    const id2 = id1 + sociedad;
    const id3 = id2 + fechaAExcelSerial(fecha);

    // Convertir valores numéricos
    const processedRow: any = { ...row };
    processedRow['Punto de Venta'] = pv;
    processedRow['Número Desde'] = numDesde;
    processedRow['Monto'] = Number(monto);
    processedRow['Sociedad'] = sociedad;
    processedRow['Comprobante'] = comprobante;
    processedRow['ID1'] = id1;
    processedRow['ID2'] = id2;
    processedRow['ID3'] = id3;

    // Convertir columnas de dinero
    const columnasDinero = ['Imp. Neto Gravado', 'IVA', 'Imp. Total'];
    for (const col of columnasDinero) {
      if (processedRow[col] !== undefined) {
        let val = String(processedRow[col]).replace(',', '.');
        processedRow[col] = Math.round(Number(val) || 0);
      }
    }

    results.push(processedRow);
  }

  return results;
}

// Procesar archivo Oppen - basado en app.py procesar_oppen()
export function procesarOppen(rows: any[]): any[] {
  const sociedadesMap = new Map(
    auxSociedades.map((item: any) => [item.Etiqueta, item['Razon Social']])
  );

  // Filtrar filas de "Registros:" y posteriores
  let dataRows = rows;
  const registrosIndex = rows.findIndex((row: any) =>
    String(row['Nro'] || '').includes('Registros:')
  );
  if (registrosIndex > -1) {
    dataRows = rows.slice(0, registrosIndex);
  }

  return dataRows.map((row: any) => {
    // Separar Nro de Factura en PV y Num
    let pv = '';
    let num = '';
    if (row['Nro de Factura']) {
      const parts = String(row['Nro de Factura']).split('-');
      pv = parts[0] || '';
      num = parts[1] || '';
    }

    // Buscar sociedad por etiqueta
    const sociedad = sociedadesMap.get(row['Etiquetas']) || '';

    // Calcular monto
    const totalFactura = Number(row['Total Factura']) || 0;
    const monto = Math.round(totalFactura);

    // Parsear fecha
    let fechaVto: Date | null = null;
    if (row['Fecha Vto.']) {
      fechaVto = new Date(row['Fecha Vto.']);
      if (isNaN(fechaVto.getTime())) fechaVto = null;
    }

    // Generar IDs (exactamente como en app.py)
    const montoStr = String(monto);
    const pvStr = pv.replace(/nan/gi, '');
    const numStr = num.replace(/nan/gi, '');
    const sociedadStr = String(sociedad).replace(/nan/gi, '');
    const fechaSerial = fechaAExcelSerial(fechaVto);

    const id1 = pvStr + numStr + montoStr;
    const id2 = id1 + sociedadStr;
    const id3 = id2 + fechaSerial;

    return {
      ...row,
      PV: pv,
      Num: num,
      Sociedades: sociedad,
      Monto: monto,
      'Fecha Vto.': fechaVto,
      ID1: id1,
      ID2: id2,
      ID3: id3,
    };
  });
}

// Realizar conciliación - basado en app.py realizar_conciliacion()
export function realizarConciliacion(
  oppenData: any[],
  arcaData: any[]
): { oppenResult: any[]; arcaResult: any[] } {
  // Cargar filtro de proveedores
  const nombresFiltro = new Set(
    filtroFC.map((item: any) => String(item.descripcion || '').trim().toUpperCase())
  );

  // Crear sets de IDs para búsqueda rápida
  const arcaID1Set = new Set(arcaData.map(r => r.ID1));
  const arcaID2Set = new Set(arcaData.map(r => r.ID2));
  const arcaID3Set = new Set(arcaData.map(r => r.ID3));

  const oppenID1Set = new Set(oppenData.map(r => r.ID1));
  const oppenID2Set = new Set(oppenData.map(r => r.ID2));
  const oppenID3Set = new Set(oppenData.map(r => r.ID3));

  // Procesar Oppen - diagnóstico como en app.py diag_oppen()
  const oppenResult = oppenData.map(row => {
    let diagnostico: string;

    if (arcaID3Set.has(row.ID3 || '')) {
      diagnostico = 'OK - Matcheado';
    } else if (!arcaID1Set.has(row.ID1 || '')) {
      diagnostico = 'Error: FC No existe o Monto/Número mal';
    } else if (!arcaID2Set.has(row.ID2 || '')) {
      diagnostico = 'Error: Sociedad incorrecta';
    } else {
      diagnostico = 'Error: Fecha incorrecta';
    }

    // Verificar filtro de proveedor
    const proveedor = String(row.Proveedor || '').trim().toUpperCase();
    const estadoFiltro = nombresFiltro.has(proveedor) ? 'No corresponde' : 'Válido';

    return {
      ...row,
      Diagnostico: diagnostico,
      Estado_Filtro: estadoFiltro,
    };
  });

  // Procesar ARCA - diagnóstico como en app.py diag_arca()
  const arcaResult = arcaData.map(row => {
    let diagnostico: string;

    if (oppenID3Set.has(row.ID3 || '')) {
      diagnostico = 'OK - Matcheado';
    } else if (!oppenID1Set.has(row.ID1 || '')) {
      diagnostico = 'Error: Falta cargar o Monto/Número de factura mal';
    } else if (!oppenID2Set.has(row.ID2 || '')) {
      diagnostico = 'Error: Sociedad incorrecta';
    } else {
      diagnostico = 'Error: Fecha incorrecta';
    }

    return {
      ...row,
      Diagnostico: diagnostico,
    };
  });

  return { oppenResult, arcaResult };
}

// Generar Excel con formato - basado en app.py generar_excel()
export async function generarExcelConciliacion(
  oppenResult: any[],
  arcaResult: any[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  // ============ Hoja 1: Conciliación Oppen ============
  const wsOppen = workbook.addWorksheet('Conciliacion Oppen');

  if (oppenResult.length > 0) {
    const columnsOppen = Object.keys(oppenResult[0]).map(key => ({
      header: key,
      key: key,
      width: key.includes('ID') ? 45 : key === 'Proveedor' ? 35 : 16,
    }));
    wsOppen.columns = columnsOppen;

    oppenResult.forEach(row => {
      wsOppen.addRow(row);
    });

    // Formato condicional para errores (rojo)
    const diagColOppen = Object.keys(oppenResult[0]).indexOf('Diagnostico') + 1;
    const filtroColOppen = Object.keys(oppenResult[0]).indexOf('Estado_Filtro') + 1;

    for (let i = 2; i <= oppenResult.length + 1; i++) {
      const diagValue = String(wsOppen.getCell(i, diagColOppen).value || '');
      const filtroValue = filtroColOppen > 0 ? String(wsOppen.getCell(i, filtroColOppen).value || '') : '';

      // Formato gris para "No corresponde" tiene prioridad
      if (filtroValue === 'No corresponde') {
        wsOppen.getRow(i).eachCell(cell => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD3D3D3' },
          };
          cell.font = { color: { argb: 'FF707070' } };
        });
      } else if (diagValue.includes('Error')) {
        wsOppen.getRow(i).eachCell(cell => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFC7CE' },
          };
          cell.font = { color: { argb: 'FF9C0006' } };
        });
      }
    }
  }

  // ============ Hoja 2: Conciliación ARCA ============
  const wsArca = workbook.addWorksheet('Conciliacion ARCA');

  if (arcaResult.length > 0) {
    const columnsArca = Object.keys(arcaResult[0]).map(key => ({
      header: key,
      key: key,
      width: key.includes('ID') ? 45 : 16,
    }));
    wsArca.columns = columnsArca;

    arcaResult.forEach(row => {
      wsArca.addRow(row);
    });

    // Formato condicional para no matcheados (rojo)
    const diagColArca = Object.keys(arcaResult[0]).indexOf('Diagnostico') + 1;

    for (let i = 2; i <= arcaResult.length + 1; i++) {
      const diagValue = String(wsArca.getCell(i, diagColArca).value || '');

      if (diagValue !== 'OK - Matcheado') {
        wsArca.getRow(i).eachCell(cell => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFC7CE' },
          };
          cell.font = { color: { argb: 'FF9C0006' } };
        });
      }
    }
  }

  // ============ Hoja 3: Errores ARCA ============
  const wsErrores = workbook.addWorksheet('Errores ARCA');

  // Columnas a eliminar del resumen
  const columnasEliminar = [
    'Tipo', 'Cód. Autorización', 'Cód. Autorizacion', 'Tipo Doc. Receptor/Emisor',
    'Nro. Doc. Receptor/Emisor', 'Denominación Receptor/Emisor',
    'Tipo Cambio', 'Moneda', 'Imp. Neto No Gravado',
    'Imp. Op. Exentas', 'Otros Tributos', 'MC', 'CUIT Cliente',
    'MC AUX', '', '``', '`', 'Número Hasta', 'Monto', 'Comprobante', 'ID1', 'ID2', 'ID3'
  ];

  // Filtrar solo errores
  const erroresArca = arcaResult.filter(r => r.Diagnostico !== 'OK - Matcheado');

  if (erroresArca.length > 0) {
    // Crear objeto sin las columnas a eliminar
    const erroresLimpios = erroresArca.map(row => {
      const newRow: any = {};
      for (const key of Object.keys(row)) {
        // Eliminar columnas nombradas, vacías o Unnamed
        if (columnasEliminar.includes(key)) continue;
        if (key.trim() === '' || key.includes('Unnamed')) continue;
        if (key.replace(/`/g, '').trim() === '') continue;
        if (key.replace(/~/g, '').trim() === '') continue;
        newRow[key] = row[key];
      }
      return newRow;
    });

    if (erroresLimpios.length > 0 && Object.keys(erroresLimpios[0]).length > 0) {
      const columnasMiles = ['Número Desde', 'Imp. Neto Gravado', 'IVA', 'Imp. Total'];

      const columnsErrores = Object.keys(erroresLimpios[0]).map(key => ({
        header: key,
        key: key,
        width: columnasMiles.includes(key) ? 16 : 15,
      }));
      wsErrores.columns = columnsErrores;

      // Formato encabezados
      wsErrores.getRow(1).eachCell(cell => {
        cell.font = { name: 'Calibri', size: 10, bold: true };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFD9D9D9' },
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });

      // Agregar datos con formato
      erroresLimpios.forEach(row => {
        const addedRow = wsErrores.addRow(row);
        addedRow.eachCell(cell => {
          cell.font = { name: 'Calibri', size: 9 };
        });
      });

      // Formato de número con separador de miles
      const keys = Object.keys(erroresLimpios[0]);
      for (const colName of columnasMiles) {
        const colIdx = keys.indexOf(colName);
        if (colIdx >= 0) {
          wsErrores.getColumn(colIdx + 1).numFmt = '#,##0';
        }
      }
    }
  }

  // Ocultar cuadrícula en hoja de errores
  wsErrores.views = [{ showGridLines: false }];

  // Generar buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
