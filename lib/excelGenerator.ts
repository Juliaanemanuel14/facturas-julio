import ExcelJS from 'exceljs';

export async function generateExcel(data: any[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Facturas');

  const columns = [
    { header: 'Archivo PDF', key: 'Archivo_PDF', width: 30 },
    { header: 'Tipo Comprobante', key: 'Tipo_Comprobante', width: 18 },
    { header: 'Fecha Emisión', key: 'Fecha_Emision', width: 15 },
    { header: 'Razón Social Emisor', key: 'Razon_Social_Emisor', width: 35 },
    { header: 'CUIT Emisor', key: 'CUIT_Emisor', width: 15 },
    { header: 'Punto de Venta', key: 'Punto_de_Venta', width: 15 },
    { header: 'Comp. Nro', key: 'Comp_Nro', width: 15 },
    { header: 'CUIT Cliente', key: 'CUIT_Cliente', width: 15 },
    { header: 'Razón Social Cliente', key: 'Razon_Social_Cliente', width: 35 },
    { header: 'Importe Neto Gravado', key: 'Importe_Neto_Gravado', width: 20 },
    { header: 'IVA 27%', key: 'IVA_27', width: 15 },
    { header: 'IVA 21%', key: 'IVA_21', width: 15 },
    { header: 'IVA 10.5%', key: 'IVA_10_5', width: 15 },
    { header: 'IVA 5%', key: 'IVA_5', width: 15 },
    { header: 'IVA 2.5%', key: 'IVA_2_5', width: 15 },
    { header: 'IVA 0%', key: 'IVA_0', width: 15 },
    { header: 'Importe Otros Tributos', key: 'Importe_Otros_Tributos', width: 20 },
    { header: 'Importe Total', key: 'Importe_Total', width: 15 },
    { header: 'CAE', key: 'CAE', width: 20 },
    { header: 'CAE Vencimiento', key: 'CAE_Vencimiento', width: 18 },
  ];

  worksheet.columns = columns;

  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF6366F1' },
  };
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  data.forEach((row) => {
    worksheet.addRow(row);
  });

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
