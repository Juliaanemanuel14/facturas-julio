import type { NextApiRequest, NextApiResponse } from 'next';
import { AzureKeyCredential, DocumentAnalysisClient } from '@azure/ai-form-recognizer';
import { processDDJJ } from '@/lib/ddjjProcessor';
import formidable from 'formidable';
import fs from 'fs';
import * as XLSX from 'xlsx';

export const config = {
  api: {
    bodyParser: false,
  },
};

const endpoint = process.env.AZURE_ENDPOINT!;
const key = process.env.AZURE_KEY!;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const form = formidable({
      multiples: true,
      keepExtensions: true,
    });

    const [fields, files] = await form.parse(req);

    const uploadedFiles = files.files;
    if (!uploadedFiles || uploadedFiles.length === 0) {
      return res.status(400).json({ error: 'No se subieron archivos' });
    }

    const client = new DocumentAnalysisClient(endpoint, new AzureKeyCredential(key));
    const results = [];

    for (const file of uploadedFiles) {
      try {
        const fileBuffer = fs.readFileSync(file.filepath);

        const poller = await client.beginAnalyzeDocument(
          'prebuilt-read',
          fileBuffer
        );

        const result = await poller.pollUntilDone();

        const ddjjData = processDDJJ(result, file.originalFilename || 'unknown.pdf');
        results.push(ddjjData);

        fs.unlinkSync(file.filepath);
      } catch (error) {
        console.error(`Error procesando ${file.originalFilename}:`, error);
        results.push({
          cuit: 'ERROR',
          razonSocial: 'ERROR',
          fechaPresentacion: 'ERROR',
          hora: 'ERROR',
          debitoFiscal: '0.00',
          creditoFiscal: '0.00',
          ajusteExentosARCA: '0.00',
          responsableExento: '0.00',
          reduccionArt12: '0.00',
          saldoTecnicoResponsableAnterior: '0.00',
          trasladoSaldos: '0.00',
          disminucionVPU: '0.00',
          saldoTecnicoResponsableActual: '0.00',
          saldoTecnicoARCASubtotal: '0.00',
          diferimiento518: '0.00',
          bonosFiscales: '0.00',
          saldoTecnicoARCACompleto: '0.00',
          saldoTecnicoResponsableActual2: '0.00',
          libreDisponibilidadAnterior: '0.00',
          montoUtilizadoPeriodo: '0.00',
          retencionesPercepcionesPagos: '0.00',
          libreDisponibilidadTraslado: '0.00',
          libreDisponibilidadContribuyente: '0.00',
          saldoImpuestoARCA: '0.00',
          archivoPDF: file.originalFilename || 'unknown.pdf'
        });
      }
    }

    // Crear Excel
    const worksheet = XLSX.utils.json_to_sheet(results.map(data => ({
      'CUIT': data.cuit,
      'Razón Social': data.razonSocial,
      'Fecha de Presentación': data.fechaPresentacion,
      'Hora': data.hora,
      'Débito Fiscal': data.debitoFiscal,
      'Crédito Fiscal': data.creditoFiscal,
      'Ajuste Exentos ARCA': data.ajusteExentosARCA,
      'Responsable Exento': data.responsableExento,
      'Reducción Art.12': data.reduccionArt12,
      'Saldo Técnico Responsable (anterior)': data.saldoTecnicoResponsableAnterior,
      'Traslado de saldos': data.trasladoSaldos,
      'Disminución por VPU': data.disminucionVPU,
      'Saldo Técnico Responsable (actual)': data.saldoTecnicoResponsableActual,
      'Saldo Técnico ARCA (Subtotal)': data.saldoTecnicoARCASubtotal,
      'Diferimiento 518': data.diferimiento518,
      'Bonos Fiscales': data.bonosFiscales,
      'Saldo Técnico ARCA (completo)': data.saldoTecnicoARCACompleto,
      'Saldo Técnico Responsable (actual 2)': data.saldoTecnicoResponsableActual2,
      'Libre Disponibilidad (anterior)': data.libreDisponibilidadAnterior,
      'Monto utilizado del período': data.montoUtilizadoPeriodo,
      'Retenciones / Percepciones / Pagos a Cuenta': data.retencionesPercepcionesPagos,
      'Libre Disponibilidad por traslado': data.libreDisponibilidadTraslado,
      'Libre Disponibilidad Contribuyente': data.libreDisponibilidadContribuyente,
      'Saldo Impuesto a favor de ARCA': data.saldoImpuestoARCA,
      'Archivo PDF': data.archivoPDF
    })));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'DDJJ IVA');

    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=ddjj_iva_${Date.now()}.xlsx`);
    res.send(excelBuffer);

  } catch (error) {
    console.error('Error processing DDJJ:', error);
    res.status(500).json({
      error: 'Error al procesar las declaraciones juradas',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
