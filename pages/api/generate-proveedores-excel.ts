import type { NextApiRequest, NextApiResponse } from 'next';
import { generateProveedoresExcel } from '@/lib/proveedoresExcelGenerator';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
    responseLimit: '50mb',
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { invoices } = req.body;

    if (!invoices || !Array.isArray(invoices)) {
      return res.status(400).json({ error: 'Invalid invoices data' });
    }

    console.log(`Generating Excel with ${invoices.length} invoices from batched processing...`);
    const excelBuffer = await generateProveedoresExcel(invoices);

    console.log('Excel generated successfully');

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=facturas_proveedores.xlsx');
    res.setHeader('Content-Length', excelBuffer.length);
    res.setHeader('Cache-Control', 'no-cache');

    res.send(excelBuffer);

  } catch (error) {
    console.error('Error generating Excel:', error);
    res.status(500).json({
      error: 'Error generating Excel: ' + (error instanceof Error ? error.message : 'Unknown error')
    });
  }
}
