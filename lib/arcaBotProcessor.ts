interface ArcaData {
  MC: string;
  Contribuyente: string;
  [key: string]: any;
}

function cleanCsvData(text: string): string[][] {
  const lines = text.split('\n').filter(line => line.trim());
  return lines.map(line => {
    // Dividir por punto y coma, respetando comillas
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ';' && !inQuotes) {
        cells.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    cells.push(current.trim());

    return cells;
  });
}

function detectMCType(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.includes('emitido')) return 'MCE';
  if (lower.includes('recibido')) return 'MCR';
  return 'DESCONOCIDO';
}

function extractContribuyente(filename: string, mcType: string): string {
  const baseName = filename.replace(/\.(csv|CSV)$/, '');
  const withoutCuit = baseName.replace(/\d{2}-?\d{8}-?\d/g, '');
  const mcLower = mcType.toLowerCase();
  const parts = withoutCuit.split(`_${mcLower}_`);
  return parts[0].trim() || 'Sin nombre';
}

export function processArcaCSVs(files: { name: string; content: string }[]): any[] {
  const allData: any[] = [];

  // Columnas esperadas en orden
  const columnasOrden = [
    "MC", "Contribuyente", "Fecha de Emisión", "Tipo de Comprobante",
    "Punto de Venta", "Número Desde", "Número Hasta", "CUIT Receptor/Emisor",
    "Nombre Receptor/Emisor", "Importe Total", "Moneda", "Cotización",
    "Importe Neto Gravado", "Importe Exento", "IVA", "Percepciones", "Retenciones", "Conceptos no Categorizados",
    "Fecha de Recepción", "Fecha de Vencimiento", "CAE", "Vencimiento CAE"
  ];

  for (const file of files) {
    try {
      const mcType = detectMCType(file.name);
      const contribuyente = extractContribuyente(file.name, mcType);

      // Parsear CSV
      const rows = cleanCsvData(file.content);
      if (rows.length === 0) continue;

      // Primera fila son los headers
      let headers = rows[0].map(h => h.trim());

      // Renombrar columnas según lógica de consolidación
      const renombres: { [key: string]: string } = {
        "Tipo Doc. Emisor": "Tipo Doc. Receptor",
        "Nro. Doc. Emisor": "Nro. Doc. Receptor",
        "Denominación Emisor": "Denominación Receptor",
        "Tipo de cambio": "Tipo Cambio",
        "Imp. Neto Gravado": "Importe Neto Gravado",
        "Imp. Op. Exentas": "Importe Exento",
        "Imp. Total": "Importe Total",
      };

      headers = headers.map(h => renombres[h] || h);

      // Filtrar columnas de IVA desglosado
      const columnas_iva_detalle = [
        "Imp. Neto Gravado IVA 0%",
        "IVA 2,5%", "Imp. Neto Gravado IVA 2,5%",
        "IVA 5%", "Imp. Neto Gravado IVA 5%",
        "IVA 10,5%", "Imp. Neto Gravado IVA 10,5%",
        "IVA 21%", "Imp. Neto Gravado IVA 21%",
        "IVA 27%", "Imp. Neto Gravado IVA 27%"
      ];

      const headerIndexes: number[] = [];
      headers.forEach((h, idx) => {
        if (!columnas_iva_detalle.includes(h)) {
          headerIndexes.push(idx);
        }
      });

      const filteredHeaders = headerIndexes.map(i => headers[i]);

      // Procesar filas de datos
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.every(cell => !cell || cell.trim() === '')) continue; // Saltar filas vacías

        const filteredRow = headerIndexes.map(idx => row[idx] || '');

        const rowData: any = {
          MC: mcType,
          Contribuyente: contribuyente,
        };

        filteredHeaders.forEach((header, idx) => {
          rowData[header] = filteredRow[idx];
        });

        allData.push(rowData);
      }
    } catch (error) {
      console.error(`Error procesando ${file.name}:`, error);
    }
  }

  // Estandarizar columnas finales
  const standardizedData = allData.map(row => {
    const newRow: any = {};

    // Mapear a columnas estándar
    columnasOrden.forEach(col => {
      newRow[col] = row[col] || '';
    });

    // Copiar columnas extra que no están en el orden estándar
    Object.keys(row).forEach(key => {
      if (!columnasOrden.includes(key) && key !== 'MC' && key !== 'Contribuyente') {
        newRow[key] = row[key];
      }
    });

    return newRow;
  });

  return standardizedData;
}
