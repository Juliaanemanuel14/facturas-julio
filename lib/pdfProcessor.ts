import pdf from 'pdf-parse';

interface InvoiceData {
  Archivo_PDF: string;
  Tipo_Comprobante: string;
  Fecha_Emision: string;
  Razon_Social_Emisor: string;
  CUIT_Emisor: string;
  Punto_de_Venta: string;
  Comp_Nro: string;
  CUIT_Cliente: string;
  Razon_Social_Cliente: string;
  Importe_Neto_Gravado: string;
  IVA_27: string;
  IVA_21: string;
  IVA_10_5: string;
  IVA_5: string;
  IVA_2_5: string;
  IVA_0: string;
  Importe_Otros_Tributos: string;
  Importe_Total: string;
  CAE: string;
  CAE_Vencimiento: string;
}

function clean(s: string | null): string {
  return (s || '').trim();
}

function normalizeNumber(s: string | null): string {
  if (!s) return '0.00';

  let cleaned = String(s);
  cleaned = cleaned.replace(/[^\d,.\-]/g, '');
  cleaned = cleaned.replace(/\./g, '');
  cleaned = cleaned.replace(',', '.');

  const match = cleaned.match(/-?\d+(?:\.\d+)?/);
  return match ? match[0] : '0.00';
}

function searchFirst(pattern: RegExp, text: string, defaultValue: string = ''): string {
  const match = text.match(pattern);
  return match ? clean(match[1]) : defaultValue;
}

export async function processPDF(buffer: Buffer, filename: string): Promise<InvoiceData> {
  const data = await pdf(buffer);
  const text = data.text;

  const invoiceData: InvoiceData = {
    Archivo_PDF: filename,
    Tipo_Comprobante: 'DESCONOCIDO',
    Fecha_Emision: '',
    Razon_Social_Emisor: '',
    CUIT_Emisor: '',
    Punto_de_Venta: '',
    Comp_Nro: '',
    CUIT_Cliente: '',
    Razon_Social_Cliente: '',
    Importe_Neto_Gravado: '0.00',
    IVA_27: '0.00',
    IVA_21: '0.00',
    IVA_10_5: '0.00',
    IVA_5: '0.00',
    IVA_2_5: '0.00',
    IVA_0: '0.00',
    Importe_Otros_Tributos: '0.00',
    Importe_Total: '0.00',
    CAE: '',
    CAE_Vencimiento: '',
  };

  const txtUpper = text.toUpperCase();

  if (txtUpper.includes('NOTA DE CRÉDITO') || txtUpper.includes('NOTA DE CREDITO')) {
    invoiceData.Tipo_Comprobante = 'NOTA DE CREDITO';
  } else if (txtUpper.includes('FACTURA')) {
    invoiceData.Tipo_Comprobante = 'FACTURA';
  }

  invoiceData.Fecha_Emision = searchFirst(/Fecha\s+de\s+Emisión:\s*.*?(\d{2}\/\d{2}\/\d{4})/i, text) ||
                               searchFirst(/\b(\d{2}\/\d{2}\/\d{4})\b/, text);

  invoiceData.Razon_Social_Emisor = searchFirst(/\n\s*([A-ZÁÉÍÓÚÑ0-9 .&]+S\.\s?A\.)\s*\n/, text);

  invoiceData.CUIT_Emisor = searchFirst(/\b(\d{11})\b/, text);

  const ptoVentaMatch = text.match(/Punto\s*de\s*Venta:\s*([0-9]{1,5})\s+Comp\.\s*Nro:\s*([0-9]{1,8})/i);
  if (ptoVentaMatch) {
    invoiceData.Punto_de_Venta = clean(ptoVentaMatch[1]);
    invoiceData.Comp_Nro = clean(ptoVentaMatch[2]);
  }

  const cuitMatches = text.match(/\b(\d{11})\b/g);
  if (cuitMatches && cuitMatches.length >= 2) {
    const segundoCuit = cuitMatches[1];
    invoiceData.CUIT_Cliente = segundoCuit;

    const razonMatch = text.match(new RegExp(`\\b${segundoCuit}\\b\\s+([A-Z0-9ÁÉÍÓÚÑ .,&]+)`));
    if (razonMatch) {
      invoiceData.Razon_Social_Cliente = clean(razonMatch[1]);
    }
  }

  invoiceData.Importe_Neto_Gravado = normalizeNumber(
    searchFirst(/Importe\s+Neto\s+Gravado:\s*\$?\s*(?:\n\s*)?([\d\.,]+)/i, text)
  );

  invoiceData.IVA_27 = normalizeNumber(searchFirst(/IVA\s+27%:\s*\$?\s*(?:\n\s*)?([\d\.,]+)/i, text));
  invoiceData.IVA_21 = normalizeNumber(searchFirst(/IVA\s+21%:\s*\$?\s*(?:\n\s*)?([\d\.,]+)/i, text));
  invoiceData.IVA_10_5 = normalizeNumber(searchFirst(/IVA\s+10\.5%:\s*\$?\s*(?:\n\s*)?([\d\.,]+)/i, text));
  invoiceData.IVA_5 = normalizeNumber(searchFirst(/IVA\s+5%:\s*\$?\s*(?:\n\s*)?([\d\.,]+)/i, text));
  invoiceData.IVA_2_5 = normalizeNumber(searchFirst(/IVA\s+2\.5%:\s*\$?\s*(?:\n\s*)?([\d\.,]+)/i, text));
  invoiceData.IVA_0 = normalizeNumber(searchFirst(/IVA\s+0%:\s*\$?\s*(?:\n\s*)?([\d\.,]+)/i, text));

  invoiceData.Importe_Otros_Tributos = normalizeNumber(
    searchFirst(/Importe\s+Otros\s+Tributos:\s*\$?\s*(?:\n\s*)?([\d\.,]+)/i, text)
  );

  invoiceData.Importe_Total = normalizeNumber(
    searchFirst(/Importe\s+Total:\s*\$?\s*(?:\n\s*)?([\d\.,]+)/i, text)
  );

  invoiceData.CAE = searchFirst(/CAE\s*N°:\s*\n?\s*([0-9]+)/i, text);
  invoiceData.CAE_Vencimiento = searchFirst(/Fecha\s+de\s+Vto\.\s+de\s+CAE:\s*\n?\s*(\d{2}\/\d{2}\/\d{4})/i, text);

  return invoiceData;
}
