/**
 * Generador de Excel para facturas de bazar y vajillas procesadas.
 * - Hoja "Productos": una fila por producto detectado (con datos de la factura origen).
 * - Hoja "Resumen": una fila por factura (totales generales).
 * - Hoja "Estadísticas": métricas globales.
 */

import ExcelJS from 'exceljs';
import type { BazarInvoice } from './bazarVajillasProcessor';

const HEADER_FILL = {
  type: 'pattern' as const,
  pattern: 'solid' as const,
  fgColor: { argb: 'FF8B4513' },
};

const TOTALS_FILL = {
  type: 'pattern' as const,
  pattern: 'solid' as const,
  fgColor: { argb: 'FFF5DEB3' },
};

export async function generateBazarExcel(invoices: BazarInvoice[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  // ---------- Hoja 1: Productos (una fila por ítem) ----------
  const itemsSheet = workbook.addWorksheet('Productos');
  itemsSheet.columns = [
    { header: 'Archivo', key: 'archivo', width: 32 },
    { header: 'Tipo', key: 'tipo', width: 14 },
    { header: 'Fecha', key: 'fecha', width: 12 },
    { header: 'Nro. Factura', key: 'numero_factura', width: 16 },
    { header: 'Razón Social Emisor', key: 'razon_social_emisor', width: 30 },
    { header: 'Razón Social Cliente', key: 'razon_social_cliente', width: 30 },
    { header: 'Descripción', key: 'descripcion', width: 40 },
    { header: 'Código', key: 'codigo', width: 18 },
    { header: 'Cantidad', key: 'cantidad', width: 10 },
    { header: 'Precio Unitario', key: 'precio_unitario', width: 16 },
    { header: 'Descuento %', key: 'descuento', width: 12 },
    { header: 'Total', key: 'total', width: 16 },
  ];

  const itemsHeader = itemsSheet.getRow(1);
  itemsHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  itemsHeader.fill = HEADER_FILL;
  itemsHeader.alignment = { vertical: 'middle', horizontal: 'center' };

  let totalProductos = 0;
  let sumaTotalItems = 0;

  for (const inv of invoices) {
    if (!inv.items || inv.items.length === 0) {
      // Sin items detectados: agregar una fila informativa con los datos del comprobante
      itemsSheet.addRow({
        archivo: inv.archivo,
        tipo: inv.tipo ?? '-',
        fecha: inv.fecha ?? '-',
        numero_factura: inv.numero_factura ?? '-',
        razon_social_emisor: inv.razon_social_emisor ?? '-',
        razon_social_cliente: inv.razon_social_cliente ?? '-',
        descripcion: inv.error ? `ERROR: ${inv.error}` : '(sin productos detectados)',
        codigo: '',
        cantidad: null,
        precio_unitario: null,
        descuento: null,
        total: inv.total,
      });
      continue;
    }

    for (const item of inv.items) {
      itemsSheet.addRow({
        archivo: inv.archivo,
        tipo: inv.tipo ?? '-',
        fecha: inv.fecha ?? '-',
        numero_factura: inv.numero_factura ?? '-',
        razon_social_emisor: inv.razon_social_emisor ?? '-',
        razon_social_cliente: inv.razon_social_cliente ?? '-',
        descripcion: item.descripcion ?? '-',
        codigo: item.codigo ?? '',
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        descuento: item.descuento,
        total: item.total,
      });
      totalProductos += 1;
      sumaTotalItems += item.total ?? 0;
    }
  }

  // Formatos numéricos
  itemsSheet.getColumn('cantidad').numFmt = '#,##0.##';
  itemsSheet.getColumn('precio_unitario').numFmt = '#,##0.00';
  itemsSheet.getColumn('total').numFmt = '#,##0.00';
  itemsSheet.getColumn('descuento').numFmt = '0.##"%"';

  // Fila de total general (suma de la columna Total)
  if (totalProductos > 0) {
    const totalsRow = itemsSheet.addRow({
      archivo: `TOTAL (${totalProductos} productos)`,
      tipo: '',
      fecha: '',
      numero_factura: '',
      razon_social_emisor: '',
      razon_social_cliente: '',
      descripcion: '',
      codigo: '',
      cantidad: null,
      precio_unitario: null,
      descuento: null,
      total: sumaTotalItems,
    });
    totalsRow.font = { bold: true };
    totalsRow.fill = TOTALS_FILL;
  }

  // ---------- Hoja 2: Resumen por factura ----------
  const summarySheet = workbook.addWorksheet('Resumen por Factura');
  summarySheet.columns = [
    { header: 'Archivo', key: 'archivo', width: 35 },
    { header: 'Tipo', key: 'tipo', width: 16 },
    { header: 'Fecha', key: 'fecha', width: 12 },
    { header: 'Nro. Factura', key: 'numero_factura', width: 18 },
    { header: 'Razón Social Emisor', key: 'razon_social_emisor', width: 32 },
    { header: 'Razón Social Cliente', key: 'razon_social_cliente', width: 32 },
    { header: 'Productos', key: 'productos', width: 12 },
    { header: 'Neto', key: 'neto', width: 14 },
    { header: 'IVA', key: 'iva', width: 14 },
    { header: 'Total', key: 'total', width: 14 },
    { header: 'Error', key: 'error', width: 30 },
  ];

  const summaryHeader = summarySheet.getRow(1);
  summaryHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  summaryHeader.fill = HEADER_FILL;
  summaryHeader.alignment = { vertical: 'middle', horizontal: 'center' };

  for (const inv of invoices) {
    summarySheet.addRow({
      archivo: inv.archivo,
      tipo: inv.tipo ?? '-',
      fecha: inv.fecha ?? '-',
      numero_factura: inv.numero_factura ?? '-',
      razon_social_emisor: inv.razon_social_emisor ?? '-',
      razon_social_cliente: inv.razon_social_cliente ?? '-',
      productos: inv.items?.length ?? 0,
      neto: inv.neto,
      iva: inv.iva,
      total: inv.total,
      error: inv.error ?? '',
    });
  }

  ['neto', 'iva', 'total'].forEach(key => {
    summarySheet.getColumn(key).numFmt = '#,##0.00';
  });
  summarySheet.getColumn('productos').numFmt = '0';

  const totalsRow = summarySheet.addRow({
    archivo: 'TOTAL',
    tipo: '',
    fecha: '',
    numero_factura: '',
    razon_social_emisor: '',
    razon_social_cliente: '',
    productos: invoices.reduce((a, i) => a + (i.items?.length ?? 0), 0),
    neto: invoices.reduce((a, i) => a + (i.neto ?? 0), 0),
    iva: invoices.reduce((a, i) => a + (i.iva ?? 0), 0),
    total: invoices.reduce((a, i) => a + (i.total ?? 0), 0),
    error: '',
  });
  totalsRow.font = { bold: true };
  totalsRow.fill = TOTALS_FILL;

  // ---------- Hoja 3: Estadísticas ----------
  const stats = workbook.addWorksheet('Estadísticas');
  stats.columns = [
    { header: 'Métrica', key: 'metric', width: 36 },
    { header: 'Valor', key: 'value', width: 22 },
  ];
  const statsHeader = stats.getRow(1);
  statsHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  statsHeader.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF70AD47' },
  };

  const ok = invoices.filter(i => !i.error).length;
  const errores = invoices.length - ok;
  const sumaNeto = invoices.reduce((a, i) => a + (i.neto ?? 0), 0);
  const sumaIva = invoices.reduce((a, i) => a + (i.iva ?? 0), 0);
  const sumaTotal = invoices.reduce((a, i) => a + (i.total ?? 0), 0);

  stats.addRow({ metric: 'Facturas procesadas', value: invoices.length });
  stats.addRow({ metric: 'Exitosas', value: ok });
  stats.addRow({ metric: 'Con errores', value: errores });
  stats.addRow({ metric: 'Productos extraídos', value: totalProductos });
  stats.addRow({ metric: 'Suma Neto (facturas)', value: sumaNeto });
  stats.addRow({ metric: 'Suma IVA (facturas)', value: sumaIva });
  stats.addRow({ metric: 'Suma Total (facturas)', value: sumaTotal });

  stats.getColumn('value').numFmt = '#,##0.00';

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
