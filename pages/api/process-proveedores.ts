import type { NextApiRequest, NextApiResponse } from 'next';
import formidable, { File } from 'formidable';
import fs from 'fs';
import { processMultipleInvoices } from '@/lib/proveedoresProcessor';
import { generateProveedoresExcel } from '@/lib/proveedoresExcelGenerator';

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

    console.log(`Processing ${validFiles.length} files...`);

    // Preparar archivos para procesamiento paralelo
    const filesToProcess = validFiles.map(file => ({
      buffer: fs.readFileSync(file.filepath),
      fileName: file.originalFilename || 'unknown',
      mimeType: file.mimetype || 'application/octet-stream',
      filepath: file.filepath,
    }));

    // Procesar en paralelo con límite de concurrencia (3 archivos simultáneos)
    const results = await processMultipleInvoices(
      filesToProcess.map(f => ({ buffer: f.buffer, fileName: f.fileName, mimeType: f.mimeType })),
      3
    );

    // Limpiar archivos temporales
    for (const file of filesToProcess) {
      try {
        fs.unlinkSync(file.filepath);
      } catch (e) {
        console.warn('Could not delete temp file:', e);
      }
    }

    console.log(`Generating Excel with ${results.length} invoices...`);
    const excelBuffer = await generateProveedoresExcel(results);

    console.log('Excel generated successfully');

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=facturas_proveedores.xlsx');
    res.send(excelBuffer);

  } catch (error) {
    console.error('Error processing invoices:', error);
    res.status(500).json({
      error: 'Error processing invoices: ' + (error instanceof Error ? error.message : 'Unknown error')
    });
  }
}
