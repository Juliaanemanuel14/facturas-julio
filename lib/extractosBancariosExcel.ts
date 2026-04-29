import ExcelJS from 'exceljs';
import { ExtractoRow } from './extractosBancariosProcessor';

export async function generateExtractosExcel(data: ExtractoRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Extracto Consolidado');

  worksheet.columns = [
    { header: 'Razón Social', key: 'Razón Social', width: 22 },
    { header: 'Banco', key: 'Banco', width: 14 },
    { header: 'Fecha', key: 'Fecha', width: 14 },
    { header: 'Descripción', key: 'Descripción', width: 60 },
    { header: 'Débito', key: 'Débito', width: 16 },
    { header: 'Crédito', key: 'Crédito', width: 16 },
    { header: 'Leyenda / Referencia', key: 'Leyenda / Referencia', width: 35 },
    { header: 'Saldo', key: 'Saldo', width: 18 },
  ];

  // Header style
  const header = worksheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0EA5E9' },
  };
  header.alignment = { vertical: 'middle', horizontal: 'center' };

  data.forEach(row => {
    worksheet.addRow(row);
  });

  // Formato numérico para Débito, Crédito y Saldo
  const numericCols = ['Débito', 'Crédito', 'Saldo'];
  numericCols.forEach(key => {
    const col = worksheet.getColumn(key);
    col.numFmt = '#,##0.00';
  });

  // Bordes
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
    to: { row: 1, column: 8 },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
