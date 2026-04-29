import type { NextApiRequest, NextApiResponse } from 'next';
import formidable, { File } from 'formidable';
import fs from 'fs';
import { processExtractos, InputFile } from '@/lib/extractosBancariosProcessor';

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

    const inputs: InputFile[] = [];
    for (const f of validFiles) {
      const buffer = fs.readFileSync(f.filepath);
      inputs.push({
        name: f.originalFilename || 'extracto',
        buffer,
      });
      try {
        fs.unlinkSync(f.filepath);
      } catch (e) {
        console.warn('No se pudo borrar archivo temporal:', e);
      }
    }

    const rows = processExtractos(inputs);

    if (rows.length === 0) {
      return res.status(400).json({ error: 'No se encontraron movimientos válidos en los archivos' });
    }

    res.status(200).json({ rows });
  } catch (error) {
    console.error('Error procesando extractos bancarios:', error);
    res.status(500).json({
      error: 'Error procesando extractos: ' + (error instanceof Error ? error.message : 'desconocido'),
    });
  }
}
