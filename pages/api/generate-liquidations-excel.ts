import type { NextApiRequest, NextApiResponse } from 'next';
import { generateCardLiquidationExcel } from '@/lib/cardLiquidationExcel';

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
    const { liquidations } = req.body;

    if (!liquidations || !Array.isArray(liquidations)) {
      return res.status(400).json({ error: 'Invalid liquidations data' });
    }

    const excelBuffer = await generateCardLiquidationExcel(liquidations);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=liquidaciones_tarjetas.xlsx');
    res.setHeader('Content-Length', excelBuffer.length);
    res.setHeader('Cache-Control', 'no-cache');

    res.send(excelBuffer);
  } catch (error) {
    console.error('Error generating Excel:', error);
    res.status(500).json({
      error: 'Error generating Excel: ' + (error instanceof Error ? error.message : 'Unknown error'),
    });
  }
}
