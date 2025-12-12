import ExcelJS from 'exceljs';

export async function generateArcaBotExcel(data: any[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Comprobantes ARCA');

  // Detectar todas las columnas únicas
  const allColumns = new Set<string>();
  data.forEach(row => {
    Object.keys(row).forEach(key => allColumns.add(key));
  });

  const columns = Array.from(allColumns).map(key => ({
    header: key,
    key: key,
    width: key.length > 20 ? 30 : key.length < 10 ? 15 : 20
  }));

  worksheet.columns = columns;

  // Estilo del header - Color verde para ARCA
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF10B981' }, // Verde para ARCA/AFIP
  };
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  // Agregar datos
  data.forEach((row) => {
    worksheet.addRow(row);
  });

  // Bordes para todas las celdas
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
