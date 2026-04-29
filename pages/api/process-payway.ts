import type { NextApiRequest, NextApiResponse } from 'next';
import formidable, { File } from 'formidable';
import fs from 'fs';
import { processPaywayFiles, PaywayInputFile } from '@/lib/paywayProcessor';
import { generatePaywayExcel } from '@/lib/paywayExcel';

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const form = formidable({
      multiples: true,
      maxFileSize: 50 * 1024 * 1024,
      keepExtensions: true,
    });

    const [, files] = await new Promise<[formidable.Fields, formidable.Files]>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    const fileList = Array.isArray(files.files) ? files.files : files.files ? [files.files] : [];
    const validFiles = fileList.filter((f): f is File => f !== null && f !== undefined);

    if (validFiles.length === 0) {
      return res.status(400).json({ error: 'No se subieron archivos' });
    }

    const inputs: PaywayInputFile[] = [];
    for (const f of validFiles) {
      const buffer = fs.readFileSync(f.filepath);
      inputs.push({
        name: f.originalFilename || 'payway',
        buffer,
      });
      try {
        fs.unlinkSync(f.filepath);
      } catch (e) {
        console.warn('No se pudo borrar archivo temporal:', e);
      }
    }

    const rows = processPaywayFiles(inputs);

    if (rows.length === 0) {
      return res.status(400).json({ error: 'No se encontraron transferencias en los archivos' });
    }

    const excelBuffer = await generatePaywayExcel(rows);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=payway_transferencias_consolidado.xlsx');
    res.send(excelBuffer);
  } catch (error) {
    console.error('Error procesando transferencias Payway:', error);
    res.status(500).json({
      error: 'Error procesando Payway: ' + (error instanceof Error ? error.message : 'desconocido'),
    });
  }
}
