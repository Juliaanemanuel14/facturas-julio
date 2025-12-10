import type { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm, File } from 'formidable';
import fs from 'fs';
import { processPDF } from '@/lib/pdfProcessor';
import { generateExcel } from '@/lib/excelGenerator';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const form = new IncomingForm({
    multiples: true,
    maxFileSize: 50 * 1024 * 1024,
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Error parsing form:', err);
      return res.status(500).json({ error: 'Error processing files' });
    }

    try {
      const pdfFiles = Array.isArray(files.files) ? files.files : [files.files];
      const validPdfFiles = pdfFiles.filter((file): file is File => file !== undefined);

      if (validPdfFiles.length === 0) {
        return res.status(400).json({ error: 'No PDF files uploaded' });
      }

      const results = [];

      for (const file of validPdfFiles) {
        const buffer = fs.readFileSync(file.filepath);
        const data = await processPDF(buffer, file.originalFilename || 'unknown.pdf');
        results.push(data);
      }

      const excelBuffer = await generateExcel(results);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=facturas_procesadas.xlsx');
      res.send(excelBuffer);
    } catch (error) {
      console.error('Error processing PDFs:', error);
      res.status(500).json({ error: 'Error processing PDFs' });
    }
  });
}
