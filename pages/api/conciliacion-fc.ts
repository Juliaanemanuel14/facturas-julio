import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import ExcelJS from 'exceljs';
import fs from 'fs';
import {
  procesarOppen,
  procesarArca,
  realizarConciliacion,
  generarExcelConciliacion,
} from '@/lib/conciliacionFC';

export const config = {
  api: {
    bodyParser: false,
    responseLimit: '50mb',
  },
};

interface ParsedFiles {
  oppenFile: formidable.File | null;
  arcaFile: formidable.File | null;
}

async function parseForm(req: NextApiRequest): Promise<{ files: formidable.File[] }> {
  return new Promise((resolve, reject) => {
    const form = formidable({
      maxFileSize: 50 * 1024 * 1024,
      maxFiles: 10,
    });

    form.parse(req, (err, fields, files) => {
      if (err) {
        reject(err);
        return;
      }

      const uploadedFiles = files.files;
      const fileArray = Array.isArray(uploadedFiles)
        ? uploadedFiles
        : uploadedFiles
        ? [uploadedFiles]
        : [];

      resolve({ files: fileArray });
    });
  });
}

async function readExcelFile(filePath: string, sheetName?: string): Promise<any[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  // Buscar la hoja correcta
  let worksheet = workbook.worksheets[0];

  if (sheetName) {
    const found = workbook.worksheets.find(
      ws => ws.name.toLowerCase().includes(sheetName.toLowerCase())
    );
    if (found) worksheet = found;
  }

  const rows: any[] = [];
  const headers: string[] = [];

  worksheet.eachRow((row, rowNumber) => {
    const rowValues = row.values as any[];
    // El primer elemento es undefined en exceljs
    const values = rowValues.slice(1);

    if (rowNumber === 1) {
      // Headers
      values.forEach((val, idx) => {
        headers[idx] = String(val || `Col${idx}`);
      });
    } else {
      const rowObj: any = {};
      values.forEach((val, idx) => {
        const header = headers[idx] || `Col${idx}`;
        rowObj[header] = val;
      });
      rows.push(rowObj);
    }
  });

  return rows;
}

async function readExcelFileWithSkipRows(
  filePath: string,
  sheetName: string,
  skipRows: number
): Promise<any[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  // Buscar la hoja correcta
  let worksheet = workbook.worksheets[0];
  const found = workbook.worksheets.find(
    ws => ws.name.toLowerCase().includes(sheetName.toLowerCase())
  );
  if (found) worksheet = found;

  const rows: any[] = [];
  const headers: string[] = [];
  let headerRowNum = skipRows + 1;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber < headerRowNum) return;

    const rowValues = row.values as any[];
    const values = rowValues.slice(1);

    if (rowNumber === headerRowNum) {
      // Headers
      values.forEach((val, idx) => {
        headers[idx] = String(val || `Col${idx}`);
      });
    } else {
      const rowObj: any = {};
      values.forEach((val, idx) => {
        const header = headers[idx] || `Col${idx}`;
        rowObj[header] = val;
      });
      rows.push(rowObj);
    }
  });

  return rows;
}

function identifyFileType(fileName: string): 'oppen' | 'arca' | 'unknown' {
  const lowerName = fileName.toLowerCase();

  if (lowerName.includes('arca')) {
    return 'arca';
  }

  if (
    lowerName.includes('oppen') ||
    lowerName.includes('listado') ||
    lowerName.includes('factura') ||
    lowerName.includes('compra')
  ) {
    return 'oppen';
  }

  return 'unknown';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { files } = await parseForm(req);

    if (files.length < 2) {
      return res.status(400).json({
        error: 'Se requieren 2 archivos Excel: uno de Oppen y uno de ARCA',
      });
    }

    console.log(`Procesando ${files.length} archivos para conciliación...`);

    // Identificar archivos
    let oppenFilePath: string | null = null;
    let arcaFilePath: string | null = null;

    for (const file of files) {
      const fileType = identifyFileType(file.originalFilename || '');

      if (fileType === 'oppen' && !oppenFilePath) {
        oppenFilePath = file.filepath;
      } else if (fileType === 'arca' && !arcaFilePath) {
        arcaFilePath = file.filepath;
      } else if (!oppenFilePath) {
        // Si no podemos identificar, el primero es Oppen
        oppenFilePath = file.filepath;
      } else if (!arcaFilePath) {
        // El segundo es ARCA
        arcaFilePath = file.filepath;
      }
    }

    if (!oppenFilePath || !arcaFilePath) {
      return res.status(400).json({
        error: 'No se pudieron identificar los archivos. Asegúrate de subir un archivo de Oppen y uno de ARCA.',
      });
    }

    console.log('Leyendo archivo Oppen...');
    // Leer Oppen (hoja FC COMPRAS, saltando 7 filas de header)
    const oppenRaw = await readExcelFileWithSkipRows(oppenFilePath, 'FC COMPRAS', 7);
    console.log(`Oppen: ${oppenRaw.length} filas leídas`);

    console.log('Leyendo archivo ARCA...');
    // Leer ARCA (primera hoja, sin saltar filas)
    const arcaRaw = await readExcelFile(arcaFilePath);
    console.log(`ARCA: ${arcaRaw.length} filas leídas`);

    // Procesar datos
    console.log('Procesando datos de Oppen...');
    const oppenData = procesarOppen(oppenRaw);
    console.log(`Oppen procesado: ${oppenData.length} filas`);

    console.log('Procesando datos de ARCA...');
    const arcaData = procesarArca(arcaRaw);
    console.log(`ARCA procesado: ${arcaData.length} filas (solo Recibidos)`);

    // Realizar conciliación
    console.log('Realizando conciliación...');
    const { oppenResult, arcaResult } = realizarConciliacion(oppenData, arcaData);

    // Generar Excel
    console.log('Generando Excel final...');
    const excelBuffer = await generarExcelConciliacion(oppenResult, arcaResult);

    // Limpiar archivos temporales
    for (const file of files) {
      try {
        fs.unlinkSync(file.filepath);
      } catch (e) {
        // Ignorar errores de limpieza
      }
    }

    // Estadísticas
    const matcheadosOppen = oppenResult.filter(r => r.Diagnostico === 'OK - Matcheado').length;
    const erroresOppen = oppenResult.filter(r => r.Diagnostico.includes('Error')).length;
    const faltantesArca = arcaResult.filter(r => r.Diagnostico !== 'OK - Matcheado').length;

    console.log(`Conciliación completada:`);
    console.log(`  - Oppen matcheados: ${matcheadosOppen}`);
    console.log(`  - Oppen con errores: ${erroresOppen}`);
    console.log(`  - Faltantes en ARCA: ${faltantesArca}`);

    // Enviar respuesta
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=Conciliacion_Final_Analizada.xlsx'
    );
    res.setHeader('Content-Length', excelBuffer.length);
    res.setHeader('Cache-Control', 'no-cache');

    res.send(excelBuffer);
  } catch (error) {
    console.error('Error en conciliación:', error);
    res.status(500).json({
      error: 'Error al procesar la conciliación: ' + (error instanceof Error ? error.message : 'Unknown error'),
    });
  }
}
