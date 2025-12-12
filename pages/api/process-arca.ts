import type { NextApiRequest, NextApiResponse } from 'next';
import formidable, { File } from 'formidable';
import fs from 'fs';
import { processArcaCSVs } from '@/lib/arcaBotProcessor';
import { generateArcaBotExcel } from '@/lib/arcaBotExcel';

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

    const csvFiles = Array.isArray(files.files) ? files.files : files.files ? [files.files] : [];
    const validCsvFiles = csvFiles.filter((file): file is File => file !== null && file !== undefined);

    if (validCsvFiles.length === 0) {
      return res.status(400).json({ error: 'No CSV files uploaded' });
    }

    // Leer todos los CSVs
    const csvData: { name: string; content: string }[] = [];

    for (const file of validCsvFiles) {
      const content = fs.readFileSync(file.filepath, 'utf-8');
      csvData.push({
        name: file.originalFilename || 'unknown.csv',
        content: content
      });

      try {
        fs.unlinkSync(file.filepath);
      } catch (e) {
        console.warn('Could not delete temp file:', e);
      }
    }

    // Procesar CSVs
    const consolidatedData = processArcaCSVs(csvData);

    if (consolidatedData.length === 0) {
      return res.status(400).json({ error: 'No valid data found in CSV files' });
    }

    // Generar Excel
    const excelBuffer = await generateArcaBotExcel(consolidatedData);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=comprobantes_arca_consolidados.xlsx');
    res.send(excelBuffer);
  } catch (error) {
    console.error('Error processing ARCA CSVs:', error);
    res.status(500).json({ error: 'Error processing ARCA CSVs: ' + (error instanceof Error ? error.message : 'Unknown error') });
  }
}
