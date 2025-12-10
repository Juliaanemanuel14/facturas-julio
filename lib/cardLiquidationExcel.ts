import ExcelJS from 'exceljs';

export async function generateCardLiquidationExcel(data: any[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Liquidaciones');

  const columns = [
    { header: 'Archivo PDF', key: 'Archivo_PDF', width: 35 },
    { header: 'Fecha de Emisión', key: 'FECHA_DE_EMISION', width: 18 },
    { header: 'Pagador', key: 'PAGADOR', width: 25 },
    { header: 'Nº de CUIT', key: 'Nro_DE_CUIT', width: 18 },
    { header: 'Razón Social', key: 'Razon_Social', width: 35 },
    { header: 'Establecimiento', key: 'Establecimiento', width: 30 },
    { header: 'Total Presentado', key: 'Total_Presentado', width: 18 },
    { header: 'Total Descuento', key: 'Total_Descuento', width: 18 },
    { header: 'Saldo', key: 'Saldo', width: 15 },
    { header: 'IVA', key: 'IVA', width: 15 },
    { header: 'Retención IB', key: 'Retencion_IB', width: 15 },
    { header: 'Percepción AFIP', key: 'Percepcion_AFIP', width: 18 },
    { header: 'Marca Tarjeta', key: 'Logo_Marca', width: 20 },
  ];

  worksheet.columns = columns;

  // Estilo del header
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF8B5CF6' }, // Color violeta para diferenciarlo
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
