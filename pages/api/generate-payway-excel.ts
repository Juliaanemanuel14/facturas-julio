import type { NextApiRequest, NextApiResponse } from 'next';
import { generatePaywayExcel } from '@/lib/paywayExcel';
import type { PaywayRow } from '@/lib/paywayProcessor';

export const config = {
  api: {
    bodyParser: { sizeLimit: '50mb' },
    responseLimit: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { rows } = req.body as { rows?: PaywayRow[] };

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No hay transferencias para exportar' });
    }

    const excelBuffer = await generatePaywayExcel(rows);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=payway_transferencias_consolidado.xlsx');
    res.send(excelBuffer);
  } catch (error) {
    console.error('Error generando Excel de Payway:', error);
    res.status(500).json({
      error: 'Error generando Excel: ' + (error instanceof Error ? error.message : 'desconocido'),
    });
  }
}
