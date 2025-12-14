/**
 * Generador de Excel para facturas de proveedores procesadas
 */

import ExcelJS from 'exceljs';
import type { ProcessedInvoice, InvoiceItem } from './proveedoresProcessor';

/**
 * Genera un archivo Excel con los datos de las facturas procesadas
 */
export async function generateProveedoresExcel(invoices: ProcessedInvoice[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  // Hoja principal: Todos los items
  const itemsSheet = workbook.addWorksheet('Items');

  // Preparar datos de todos los items
  const allItems: any[] = [];
  const allColumns = new Set<string>(['Archivo', 'Proveedor']);

  // Recopilar todos los items y columnas únicas
  for (const invoice of invoices) {
    for (const item of invoice.items) {
      const row: any = {
        Archivo: invoice.fileName,
        Proveedor: invoice.provider.toUpperCase(),
        ...item,
      };

      // Agregar número de factura si existe
      if (invoice.invoiceNumber) {
        row.Nro_Factura = invoice.invoiceNumber;
        allColumns.add('Nro_Factura');
      }

      allItems.push(row);

      // Recopilar nombres de columnas
      Object.keys(item).forEach(key => allColumns.add(key));
    }
  }

  // Ordenar columnas: Archivo, Proveedor, Nro_Factura, luego el resto
  const orderedColumns = ['Archivo', 'Proveedor'];
  if (allColumns.has('Nro_Factura')) {
    orderedColumns.push('Nro_Factura');
  }

  const standardFields = ['Codigo', 'Descripcion', 'Cantidad', 'PrecioUnitario', 'Subtotal'];
  standardFields.forEach(field => {
    if (allColumns.has(field)) {
      orderedColumns.push(field);
    }
  });

  // Agregar el resto de columnas
  allColumns.forEach(col => {
    if (!orderedColumns.includes(col)) {
      orderedColumns.push(col);
    }
  });

  // Configurar columnas en la hoja
  itemsSheet.columns = orderedColumns.map(col => ({
    header: col,
    key: col,
    width: col === 'Descripcion' ? 40 : col === 'Archivo' ? 30 : 15,
  }));

  // Estilo del encabezado
  itemsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  itemsSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' },
  };
  itemsSheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

  // Agregar datos
  allItems.forEach(item => {
    itemsSheet.addRow(item);
  });

  // Aplicar formatos numéricos
  const numericColumns = ['Cantidad', 'PrecioUnitario', 'Subtotal', 'bulto', 'px_bulto', 'desc',
    'neto', 'imp_int', 'iva_21', 'total', 'neto_mas_imp_int', 'iibb_caba', 'iibb_reg_3337',
    'total_final', 'costo_x_bulto', 'Bultos', 'Ps', 'Q', 'Px_Lista', 'Desc_Uni', 'Total',
    'Desc_Global', 'Neto', 'Imp_Int', 'Neto_Imp', 'IVA', 'IIBB', 'Perc_IVA', 'Final',
    'Pack_Final', 'Unit'];

  itemsSheet.columns.forEach((column, index) => {
    if (column.key && numericColumns.includes(column.key)) {
      itemsSheet.getColumn(index + 1).numFmt = '#,##0.00';
    }
  });

  // Hoja de resumen por archivo
  const summarySheet = workbook.addWorksheet('Resumen');
  summarySheet.columns = [
    { header: 'Archivo', key: 'archivo', width: 35 },
    { header: 'Proveedor', key: 'proveedor', width: 15 },
    { header: 'Nro. Factura', key: 'nroFactura', width: 18 },
    { header: 'Items Detectados', key: 'itemsCount', width: 15 },
    { header: 'Total Factura', key: 'totalFactura', width: 15 },
    { header: 'Errores', key: 'errors', width: 40 },
  ];

  // Estilo del encabezado
  summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  summarySheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF70AD47' },
  };
  summarySheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

  // Agregar datos de resumen
  for (const invoice of invoices) {
    summarySheet.addRow({
      archivo: invoice.fileName,
      proveedor: invoice.provider.toUpperCase(),
      nroFactura: invoice.invoiceNumber || '-',
      itemsCount: invoice.items.length,
      totalFactura: invoice.invoiceTotal || null,
      errors: invoice.error || '-',
    });
  }

  // Formato numérico para totales
  summarySheet.getColumn('itemsCount').numFmt = '0';
  summarySheet.getColumn('totalFactura').numFmt = '#,##0';

  // Hoja de estadísticas
  const statsSheet = workbook.addWorksheet('Estadísticas');
  statsSheet.columns = [
    { header: 'Métrica', key: 'metric', width: 30 },
    { header: 'Valor', key: 'value', width: 20 },
  ];

  // Estilo del encabezado
  statsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  statsSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFC000' },
  };
  statsSheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

  // Calcular estadísticas
  const totalFiles = invoices.length;
  const totalItems = allItems.length;
  const filesWithErrors = invoices.filter(inv => inv.error).length;
  const providerCounts: Record<string, number> = {};

  invoices.forEach(invoice => {
    const provider = invoice.provider.toUpperCase();
    providerCounts[provider] = (providerCounts[provider] || 0) + 1;
  });

  // Agregar estadísticas
  statsSheet.addRow({ metric: 'Total de archivos procesados', value: totalFiles });
  statsSheet.addRow({ metric: 'Total de items extraídos', value: totalItems });
  statsSheet.addRow({ metric: 'Archivos con errores', value: filesWithErrors });
  statsSheet.addRow({ metric: 'Promedio items por archivo', value: Math.round(totalItems / totalFiles * 100) / 100 });
  statsSheet.addRow({ metric: '', value: '' }); // Espacio

  statsSheet.addRow({ metric: 'Distribución por proveedor', value: '' });
  Object.entries(providerCounts).forEach(([provider, count]) => {
    statsSheet.addRow({ metric: `  - ${provider}`, value: count });
  });

  // Generar buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
