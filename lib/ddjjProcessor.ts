import { AnalyzeResult } from '@azure/ai-form-recognizer';

export interface DDJJData {
  cuit: string;
  razonSocial: string;
  fechaPresentacion: string;
  hora: string;
  debitoFiscal: string;
  creditoFiscal: string;
  ajusteExentosARCA: string;
  responsableExento: string;
  reduccionArt12: string;
  saldoTecnicoResponsableAnterior: string;
  trasladoSaldos: string;
  disminucionVPU: string;
  saldoTecnicoResponsableActual: string;
  saldoTecnicoARCASubtotal: string;
  diferimiento518: string;
  bonosFiscales: string;
  saldoTecnicoARCACompleto: string;
  saldoTecnicoResponsableActual2: string;
  libreDisponibilidadAnterior: string;
  montoUtilizadoPeriodo: string;
  retencionesPercepcionesPagos: string;
  libreDisponibilidadTraslado: string;
  libreDisponibilidadContribuyente: string;
  saldoImpuestoARCA: string;
  archivoPDF: string;
}

export function processDDJJ(result: AnalyzeResult, fileName: string): DDJJData {
  const content = result.content || '';

  // Función auxiliar para buscar valores con regex
  function buscar(patron: RegExp, porDefecto: string = '0.00'): string {
    const match = content.match(patron);
    if (match && match[1]) {
      // Reemplazar coma por punto y limpiar espacios
      return match[1].replace(',', '.').trim();
    }
    return porDefecto;
  }

  // Extraer datos generales
  const cuit = buscar(/CUIT Nro:\s*(\d+)/i, '');
  const razonSocial = buscar(/Apellido y Nombre o Razón Social:\s*([^\n]+)/i, '');
  const fechaPresentacion = buscar(/Fecha de Presentación:\s*(\d{2}\/\d{2}\/\d{4})/i, '');
  const hora = buscar(/Hora:\s*(\d{2}:\d{2})/i, '');

  // Extraer datos impositivos
  const debitoFiscal = buscar(/Total del Débito Fiscal\s*\$\s*([\d.,]+)/i);
  const creditoFiscal = buscar(/Total del Crédito Fiscal\s*\$\s*([\d.,]+)/i);
  const ajusteExentosARCA = buscar(/Ajuste Anual del crédito fiscal por operaciones exentas.?\$\s([\d.,]+)/i);
  const responsableExento = buscar(/A favor del Responsable\s*\$\s*([\d.,]+)/i);
  const reduccionArt12 = buscar(/cumplidores-Art\.12\s*\$\s*([\d.,]+)/i);
  const saldoTecnicoResponsableAnterior = buscar(/Saldo Técnico a Favor del Responsable del Período anterior\s*\$\s*([\d.,]+)/i);
  const trasladoSaldos = buscar(/Saldo Técnico a favor por traslado de saldos\s*\$\s*([\d.,]+)/i);
  const disminucionVPU = buscar(/traslado de saldo a VPU\s*\$\s*([\d.,]+)/i);
  const saldoTecnicoResponsableActual = buscar(/Saldo Técnico a Favor del Responsable del Período\s*\$\s*([\d.,]+)/i);
  const saldoTecnicoARCASubtotal = buscar(/Subtotal Saldo Técnico a Favor de ARCA del Período\s*\$\s*([\d.,]+)/i);
  const diferimiento518 = buscar(/Diferimiento F\. 518\s*\$\s*([\d.,]+)/i);
  const bonosFiscales = buscar(/Bonos Fiscales.?\$\s([\d.,]+)/i);
  const saldoTecnicoARCACompleto = buscar(/Saldo técnico a favor de ARCA\s*\$\s*([\d.,]+)/i);
  const saldoTecnicoResponsableActual2 = buscar(/Saldo Técnico a Favor del Responsable del Período\s*\$\s*([\d.,]+)/i);
  const libreDisponibilidadAnterior = buscar(/disponibilidad del período anterior\s*\$\s*([\d.,]+)/i);
  const montoUtilizadoPeriodo = buscar(/Total del monto utilizado del período\s*\$\s*([\d.,]+)/i);
  const retencionesPercepcionesPagos = buscar(/Total de retenciones, percepciones y pagos a cuenta computables en el período neto de restituciones\s*\$\s*([\d.,]+)/i);
  const libreDisponibilidadTraslado = buscar(/Saldo de libre disponibilidad por traslado de saldos\s*\$\s*([\d.,]+)/i);
  const libreDisponibilidadContribuyente = buscar(/Saldo de Libre Disponibilidad a favor del contribuyente del período\s*\$\s*([\d.,]+)/i);
  const saldoImpuestoARCA = buscar(/Saldo del Impuesto a Favor de ARCA\s*\$\s*([\d.,]+)/i);

  return {
    cuit,
    razonSocial,
    fechaPresentacion,
    hora,
    debitoFiscal,
    creditoFiscal,
    ajusteExentosARCA,
    responsableExento,
    reduccionArt12,
    saldoTecnicoResponsableAnterior,
    trasladoSaldos,
    disminucionVPU,
    saldoTecnicoResponsableActual,
    saldoTecnicoARCASubtotal,
    diferimiento518,
    bonosFiscales,
    saldoTecnicoARCACompleto,
    saldoTecnicoResponsableActual2,
    libreDisponibilidadAnterior,
    montoUtilizadoPeriodo,
    retencionesPercepcionesPagos,
    libreDisponibilidadTraslado,
    libreDisponibilidadContribuyente,
    saldoImpuestoARCA,
    archivoPDF: fileName
  };
}
