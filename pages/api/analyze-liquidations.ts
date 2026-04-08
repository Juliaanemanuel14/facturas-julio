import type { NextApiRequest, NextApiResponse } from 'next';
import formidable, { File } from 'formidable';
import fs from 'fs';
import unzipper from 'unzipper';
import { processCardLiquidation } from '@/lib/cardLiquidationProcessor';

export const config = {
  api: {
    bodyParser: false,
    responseLimit: '50mb',
  },
};

async function extractPdfsFromZip(zipPath: string): Promise<{ buffer: Buffer; filename: string }[]> {
  const pdfs: { buffer: Buffer; filename: string }[] = [];
  const directory = await unzipper.Open.file(zipPath);

  for (const file of directory.files) {
    if (file.path.toLowerCase().endsWith('.pdf') && file.type === 'File') {
      const buffer = await file.buffer();
      const filename = file.path.split('/').pop() || 'unknown.pdf';
      pdfs.push({ buffer, filename });
    }
  }

  return pdfs;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const form = formidable({
      multiples: true,
      maxFileSize: 200 * 1024 * 1024,
      keepExtensions: true,
    });

    const [, files] = await new Promise<[formidable.Fields, formidable.Files]>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    const uploadedFiles = Array.isArray(files.files) ? files.files : files.files ? [files.files] : [];
    const validFiles = uploadedFiles.filter((file): file is File => file !== null && file !== undefined);

    if (validFiles.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const results = [];

    for (const file of validFiles) {
      const originalName = (file.originalFilename || '').toLowerCase();

      if (originalName.endsWith('.zip')) {
        const pdfsFromZip = await extractPdfsFromZip(file.filepath);
        for (const pdf of pdfsFromZip) {
          const data = await processCardLiquidation(pdf.buffer, pdf.filename);
          results.push(data);
        }
      } else if (originalName.endsWith('.pdf')) {
        const buffer = fs.readFileSync(file.filepath);
        const data = await processCardLiquidation(buffer, file.originalFilename || 'unknown.pdf');
        results.push(data);
      }

      try {
        fs.unlinkSync(file.filepath);
      } catch (e) {
        console.warn('Could not delete temp file:', e);
      }
    }

    res.status(200).json({
      success: true,
      liquidations: results,
      totalFiles: results.length,
    });
  } catch (error) {
    console.error('Error analyzing liquidations:', error);
    res.status(500).json({
      success: false,
      error: 'Error analyzing liquidations: ' + (error instanceof Error ? error.message : 'Unknown error'),
    });
  }
}
