import type { NextApiRequest, NextApiResponse } from 'next';
import formidable, { File } from 'formidable';
import fs from 'fs';
import { processCardLiquidation } from '@/lib/cardLiquidationProcessor';
import { generateCardLiquidationExcel } from '@/lib/cardLiquidationExcel';

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

    const [fields, files] = await new Promise<[formidable.Fields, formidable.Files]>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    const pdfFiles = Array.isArray(files.files) ? files.files : files.files ? [files.files] : [];
    const validPdfFiles = pdfFiles.filter((file): file is File => file !== null && file !== undefined);

    if (validPdfFiles.length === 0) {
      return res.status(400).json({ error: 'No PDF files uploaded' });
    }

    const results = [];

    for (const file of validPdfFiles) {
      const buffer = fs.readFileSync(file.filepath);
      const data = await processCardLiquidation(buffer, file.originalFilename || 'unknown.pdf');
      results.push(data);

      try {
        fs.unlinkSync(file.filepath);
      } catch (e) {
        console.warn('Could not delete temp file:', e);
      }
    }

    const excelBuffer = await generateCardLiquidationExcel(results);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=liquidaciones_tarjetas.xlsx');
    res.send(excelBuffer);
  } catch (error) {
    console.error('Error processing liquidations:', error);
    res.status(500).json({ error: 'Error processing liquidations: ' + (error instanceof Error ? error.message : 'Unknown error') });
  }
}
