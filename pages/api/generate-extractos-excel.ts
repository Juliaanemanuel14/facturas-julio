import type { NextApiRequest, NextApiResponse } from 'next';
import { generateExtractosExcel } from '@/lib/extractosBancariosExcel';
import type { ExtractoRow } from '@/lib/extractosBancariosProcessor';

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
    const { rows } = req.body as { rows?: ExtractoRow[] };

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No hay movimientos para exportar' });
    }

    const excelBuffer = await generateExtractosExcel(rows);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=extractos_bancarios_consolidado.xlsx');
    res.send(excelBuffer);
  } catch (error) {
    console.error('Error generando Excel de extractos:', error);
    res.status(500).json({
      error: 'Error generando Excel: ' + (error instanceof Error ? error.message : 'desconocido'),
    });
  }
}
