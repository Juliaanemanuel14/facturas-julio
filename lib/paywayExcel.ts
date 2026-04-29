import ExcelJS from 'exceljs';
import { PaywayRow } from './paywayProcessor';

export async function generatePaywayExcel(data: PaywayRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Todas las Transferencias');

  worksheet.columns = [
    { header: 'RAZON SOCIAL', key: 'RAZON SOCIAL', width: 18 },
    { header: 'LOCAL', key: 'LOCAL', width: 14 },
    { header: 'FECHA DE VENTA', key: 'FECHA DE VENTA', width: 16 },
    { header: 'TERMINAL', key: 'TERMINAL', width: 14 },
    { header: 'MONTO BRUTO', key: 'MONTO BRUTO', width: 16 },
    { header: 'MONTO NETO', key: 'MONTO NETO', width: 16 },
    { header: 'TOTAL RET.', key: 'TOTAL RET.', width: 14 },
    { header: 'RET IIBB', key: 'RET IIBB', width: 14 },
    { header: 'TOTAL COM.', key: 'TOTAL COM.', width: 14 },
    { header: 'COM. TOTAL', key: 'COM. TOTAL', width: 14 },
    { header: 'IVA COM.', key: 'IVA COM.', width: 14 },
    { header: 'PERCEP IVA', key: 'PERCEP IVA', width: 14 },
  ];

  const header = worksheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFEC4899' },
  };
  header.alignment = { vertical: 'middle', horizontal: 'center' };

  data.forEach(row => worksheet.addRow(row));

  ['MONTO BRUTO', 'MONTO NETO', 'TOTAL RET.', 'RET IIBB', 'TOTAL COM.', 'COM. TOTAL', 'IVA COM.', 'PERCEP IVA'].forEach(key => {
    worksheet.getColumn(key).numFmt = '#,##0.00';
  });

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      row.eachCell(cell => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    }
  });

  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 12 },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
