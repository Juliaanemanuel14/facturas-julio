import pdf from 'pdf-parse';

interface CardLiquidationData {
  Archivo_PDF: string;
  FECHA_DE_EMISION: string;
  PAGADOR: string;
  Nro_DE_CUIT: string;
  Razon_Social: string;
  Establecimiento: string;
  Total_Presentado: string;
  Total_Descuento: string;
  Saldo: string;
  IVA: string;
  Retencion_IB: string;
  Percepcion_AFIP: string;
  Logo_Marca: string;
}

function clean(s: string | null): string {
  return (s || '').trim();
}

function normalizeNumber(s: string | null): string {
  if (!s) return '0.00';

  let cleaned = String(s);
  // Quitar todo excepto dígitos, coma, punto y signo
  cleaned = cleaned.replace(/[^\d,.\-]/g, '');
  // Quitar puntos de miles
  cleaned = cleaned.replace(/\./g, '');
  // Coma decimal -> punto
  cleaned = cleaned.replace(',', '.');

  const match = cleaned.match(/-?\d+(?:\.\d+)?/);
  return match ? match[0] : '0.00';
}

function extractValueBelow(field: string, text: string, linesBelow: number = 1): string {
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(field)) {
      const targetIndex = i + linesBelow;
      if (targetIndex < lines.length) {
        return clean(lines[targetIndex]);
      }
    }
  }

  return '';
}

function extractMonetaryValue(pattern: RegExp, text: string): string {
  const match = text.match(pattern);
  if (match && match[1]) {
    return normalizeNumber(match[1]);
  }
  return '0.00';
}

function detectCardBrand(text: string): string {
  const textUpper = text.toUpperCase();

  const brands = [
    { name: 'VISA', patterns: ['VISA'] },
    { name: 'MASTERCARD', patterns: ['MASTERCARD', 'MASTER CARD'] },
    { name: 'CABAL', patterns: ['CABAL'] },
    { name: 'AMERICAN EXPRESS', patterns: ['AMERICAN EXPRESS', 'AMEX'] }
  ];

  for (const brand of brands) {
    for (const pattern of brand.patterns) {
      if (textUpper.includes(pattern)) {
        return brand.name;
      }
    }
  }

  return 'No reconocido';
}

export async function processCardLiquidation(buffer: Buffer, filename: string): Promise<CardLiquidationData> {
  const data = await pdf(buffer);
  const text = data.text;

  const liquidationData: CardLiquidationData = {
    Archivo_PDF: filename,
    FECHA_DE_EMISION: '',
    PAGADOR: '',
    Nro_DE_CUIT: '',
    Razon_Social: '',
    Establecimiento: '',
    Total_Presentado: '0.00',
    Total_Descuento: '0.00',
    Saldo: '0.00',
    IVA: '0.00',
    Retencion_IB: '0.00',
    Percepcion_AFIP: '0.00',
    Logo_Marca: 'No reconocido',
  };

  // Extraer campos verticales (valor debajo del campo)
  liquidationData.FECHA_DE_EMISION = extractValueBelow('FECHA DE EMISION', text, 22) ||
                                      extractValueBelow('Fecha de Emisión', text, 1);

  liquidationData.PAGADOR = extractValueBelow('PAGADOR', text, 22) ||
                            extractValueBelow('Pagador', text, 1);

  liquidationData.Nro_DE_CUIT = extractValueBelow('Nº DE CUIT', text, 22) ||
                                 extractValueBelow('CUIT', text, 1);

  liquidationData.Razon_Social = extractValueBelow('Razón Social', text, 1);

  liquidationData.Establecimiento = extractValueBelow('Establecimiento', text, 1);

  // Valores monetarios con regex
  liquidationData.Total_Presentado = extractMonetaryValue(
    /TOTAL\s+PRESENTADO\s+\$?\s*([\d.,]+)/i,
    text
  );

  liquidationData.Total_Descuento = extractMonetaryValue(
    /TOTAL\s+DESCUENTO\s+\$?\s*([\d.,]+)/i,
    text
  );

  liquidationData.Saldo = extractMonetaryValue(
    /SALDO\s+\$?\s*([\d.,]+)/i,
    text
  );

  liquidationData.IVA = extractMonetaryValue(
    /IVA\s+21[.,]?00\s*%?\s*\$?\s*([\d.,]+)/i,
    text
  );

  liquidationData.Retencion_IB = extractMonetaryValue(
    /Ret\.?IB\s+CAP\.?\s*FED\.?\s*[\d.,]+\s*%?\s*\$?\s*([\d.,]+)/i,
    text
  );

  liquidationData.Percepcion_AFIP = extractMonetaryValue(
    /Percep\.?\/Retenc\.?\s*AFIP\s+[-]?\s*DGI\s*\$?\s*([\d.,]+)/i,
    text
  );

  // Detectar marca de tarjeta
  liquidationData.Logo_Marca = detectCardBrand(text);

  return liquidationData;
}
