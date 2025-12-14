import type { NextApiRequest, NextApiResponse } from 'next';
import formidable, { File } from 'formidable';
import fs from 'fs';
import { processProveedorInvoice } from '@/lib/proveedoresProcessor';
import { PROVIDER_TYPES } from '@/lib/proveedoresConfig';

export const config = {
  api: {
    bodyParser: false,
    responseLimit: '50mb',
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const form = formidable({
      multiples: true,
      maxFileSize: 50 * 1024 * 1024, // 50MB
      keepExtensions: true,
    });

    const [fields, files] = await new Promise<[formidable.Fields, formidable.Files]>((resolve, reject) => {
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

    console.log(`Analyzing ${validFiles.length} files...`);

    const results = [];

    for (const file of validFiles) {
      try {
        const buffer = fs.readFileSync(file.filepath);
        const fileName = file.originalFilename || 'unknown';
        const mimeType = file.mimetype || 'application/octet-stream';

        console.log(`Processing: ${fileName} (${mimeType})`);

        const data = await processProveedorInvoice(buffer, fileName, mimeType);
        results.push(data);

        console.log(`Processed: ${fileName} - ${data.items.length} items extracted`);

        // Limpiar archivo temporal
        try {
          fs.unlinkSync(file.filepath);
        } catch (e) {
          console.warn('Could not delete temp file:', e);
        }
      } catch (fileError) {
        console.error(`Error processing file ${file.originalFilename}:`, fileError);
        results.push({
          fileName: file.originalFilename || 'unknown',
          provider: PROVIDER_TYPES.GENERAL,
          items: [],
          error: fileError instanceof Error ? fileError.message : 'Unknown error',
        });
      }
    }

    console.log(`Analysis complete: ${results.length} invoices processed`);

    // Devolver JSON en lugar de Excel
    res.status(200).json({
      success: true,
      invoices: results,
      totalFiles: results.length,
      totalItems: results.reduce((acc, inv) => acc + inv.items.length, 0)
    });

  } catch (error) {
    console.error('Error analyzing invoices:', error);
    res.status(500).json({
      success: false,
      error: 'Error analyzing invoices: ' + (error instanceof Error ? error.message : 'Unknown error')
    });
  }
}
