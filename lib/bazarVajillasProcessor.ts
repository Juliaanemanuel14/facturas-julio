/**
 * Procesador de facturas de bazar y vajillas usando Google Gemini AI.
 * Toma PDFs/imágenes de facturas/remitos y devuelve los productos línea por línea
 * (descripción, código, cantidad, precio unitario, descuento, total) más metadatos
 * del comprobante (emisor, cliente, número, fecha, totales).
 */

export interface BazarItem {
  descripcion: string | null;
  codigo: string | null;
  cantidad: number | null;
  precio_unitario: number | null;
  descuento: number | null;       // porcentaje (ej: 20 para 20%) o null
  total: number | null;            // total de la línea (con IVA si está incluido)
}

export interface BazarInvoice {
  archivo: string;
  razon_social_emisor: string | null;
  razon_social_cliente: string | null;
  tipo: string | null;
  numero_factura: string | null;
  fecha: string | null;
  neto: number | null;
  iva: number | null;
  total: number | null;
  items: BazarItem[];
  error?: string;
}

const PROMPT = `Sos un asistente que lee facturas y remitos argentinos de bazar y vajillas (A/B/C, notas de credito/debito, remitos, tickets).
Devolve UNICAMENTE un JSON con esta estructura exacta:

{
  "razon_social_emisor": "razon social EXACTA del que EMITE el comprobante (proveedor/vendedor), o null",
  "razon_social_cliente": "razon social del CLIENTE (a quien se factura), o null",
  "tipo": "FACTURA_A | FACTURA_B | FACTURA_C | NOTA_CREDITO | NOTA_DEBITO | REMITO | TICKET | OTRO",
  "numero_factura": "numero completo (ej: 0006-00023137) o null",
  "fecha": "YYYY-MM-DD o null si no se ve",
  "neto": 70588.20,
  "iva": 7411.76,
  "total": 77999.96,
  "items": [
    {
      "descripcion": "COPA TRAGO 340ML DECO",
      "codigo": "CR OC4LS12DC12E",
      "cantidad": 72,
      "precio_unitario": 17797.89,
      "descuento": 20,
      "total": 1025158.46
    }
  ]
}

Reglas:
- Numeros como numeros JSON (sin $, sin separador de miles).
- Formato argentino "1.234,56" -> interpretarlo como 1234.56.
- "razon_social_emisor" es quien EMITE el comprobante (suele estar arriba/izquierda, junto al logo y CUIT del proveedor).
- "razon_social_cliente" es a QUIEN se le factura (suele decir "Senor/es:", "Razon social:", "Cliente:" en el bloque del medio). Copiar tal cual aparece, incluyendo nombres de fantasia entre parentesis si los hay.
- "fecha" en formato ISO YYYY-MM-DD. Si dice "02/04/26" interpretalo como 2026-04-02 (formato dd/mm/aa argentino, asumi siglo XXI).
- "neto" es el importe sin IVA (subtotal antes de impuestos). Si no aparece explicito pero hay total e IVA, calcularlo como total - iva.
- Si la factura tiene varias alicuotas de IVA (ej. 10.5% + 21%), SUMARLAS para devolver el IVA total.
- Si NO hay IVA discriminado (Factura B/C, ticket, remito), devolver iva = 0 y neto = total.

DETALLE DE PRODUCTOS (items):
- Devolver UN OBJETO por cada FILA de la tabla de productos. NO agregar ni omitir filas.
- "descripcion" tal cual aparece (sin recortar, sin reformatear).
- "codigo" si la tabla tiene una columna de código/SKU; si no, null.
- "cantidad" como numero (puede aparecer como "Cantidad", "Q", "Cant.", "Bultos").
- "precio_unitario" es el precio unitario tal cual figura (puede ser con o sin IVA segun la factura, no hagas conversion: copialo tal cual de la columna "Precio Unitario" / "Precio uni c/iva" / similar).
- "descuento" es el porcentaje de descuento si la fila tiene una columna "Desc." / "Bonif." / "Descuento" (ej: si dice "20%" devolver 20; si dice "0,19" devolver 19). Si no hay columna de descuento o la fila no tiene, null.
- "total" es el importe final de la fila (columna "Total", "Precio Final c/IVA", "Total con iva", "Subtotal").
- Si una celda esta vacia o no aplica, usar null. NO inventes valores.
- Incluir TODAS las filas de productos, aunque haya muchas.

Si un dato general no se ve claramente, usar null (no inventar).
Solo el JSON, sin texto antes ni despues.`;

// Modelo fijo para bazar/vajillas: NO usar GEMINI_MODEL global porque
// puede apuntar a otro modelo (ej. gemini-2.5-pro) que da 503 por demanda.
// Los modelos "preview" solo están disponibles en v1beta del API REST,
// y el SDK @google/generative-ai 0.1.3 instalado solo apunta a v1, así
// que llamamos directo por fetch a la URL de v1beta.
const BAZAR_MODEL = 'gemini-3-flash-preview';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

async function callGeminiBazar(buffer: Buffer, mimeType: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY no configurada en variables de entorno');
  }

  const url = `${GEMINI_API_BASE}/models/${BAZAR_MODEL}:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: PROMPT },
          {
            inlineData: {
              mimeType,
              data: buffer.toString('base64'),
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini ${res.status} ${res.statusText}: ${errText.slice(0, 500)}`);
  }

  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts
    ?.map((p: any) => p?.text || '')
    .join('') || '';
  if (!text) {
    throw new Error('Respuesta vacía de Gemini');
  }
  return text;
}

function cleanJsonResponse(text: string): string {
  let t = text.trim();
  if (t.startsWith('```json')) t = t.substring(7);
  else if (t.startsWith('```')) t = t.substring(3);
  if (t.endsWith('```')) t = t.substring(0, t.length - 3);
  return t.trim();
}

function pickPrincipalIfList(parsed: any): any {
  if (Array.isArray(parsed)) {
    return parsed.reduce((best, cur) => {
      const bt = typeof best?.total === 'number' ? best.total : -Infinity;
      const ct = typeof cur?.total === 'number' ? cur.total : 0;
      return ct >= bt ? cur : best;
    }, parsed[0] || {});
  }
  return parsed;
}

function toNumberOrNull(v: any): number | null {
  if (typeof v === 'number' && isFinite(v)) return v;
  return null;
}

function normalizeItem(raw: any): BazarItem {
  return {
    descripcion: raw?.descripcion ?? null,
    codigo: raw?.codigo ?? null,
    cantidad: toNumberOrNull(raw?.cantidad),
    precio_unitario: toNumberOrNull(raw?.precio_unitario),
    descuento: toNumberOrNull(raw?.descuento),
    total: toNumberOrNull(raw?.total),
  };
}

export async function processBazarInvoice(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<BazarInvoice> {
  const baseRow: BazarInvoice = {
    archivo: fileName,
    razon_social_emisor: null,
    razon_social_cliente: null,
    tipo: null,
    numero_factura: null,
    fecha: null,
    neto: null,
    iva: null,
    total: null,
    items: [],
  };

  try {
    const supportedMimes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!supportedMimes.includes(mimeType)) {
      return { ...baseRow, error: `Tipo de archivo no soportado: ${mimeType}` };
    }

    // Reintentos con backoff para 503 / 429 (sobrecarga transitoria del modelo)
    let rawText = '';
    let lastErr: any;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        rawText = await callGeminiBazar(buffer, mimeType);
        break;
      } catch (err: any) {
        lastErr = err;
        const msg = (err?.message || '').toString();
        const isTransient = msg.includes('503') || msg.includes('429') ||
          msg.toLowerCase().includes('overloaded') ||
          msg.toLowerCase().includes('high demand') ||
          msg.toLowerCase().includes('unavailable');
        if (!isTransient || attempt === 3) throw err;
        await new Promise(r => setTimeout(r, attempt * 1500));
      }
    }
    if (!rawText) throw lastErr || new Error('Sin respuesta de Gemini');
    const responseText = cleanJsonResponse(rawText);
    const parsed = pickPrincipalIfList(JSON.parse(responseText));

    if (!parsed || typeof parsed !== 'object') {
      return { ...baseRow, error: 'Respuesta vacía o con formato inesperado' };
    }

    const itemsRaw = Array.isArray(parsed.items) ? parsed.items : [];
    const items = itemsRaw.map(normalizeItem);

    return {
      archivo: fileName,
      razon_social_emisor: parsed.razon_social_emisor ?? null,
      razon_social_cliente: parsed.razon_social_cliente ?? null,
      tipo: parsed.tipo ?? null,
      numero_factura: parsed.numero_factura ?? null,
      fecha: parsed.fecha ?? null,
      neto: toNumberOrNull(parsed.neto),
      iva: toNumberOrNull(parsed.iva),
      total: toNumberOrNull(parsed.total),
      items,
    };
  } catch (error) {
    return {
      ...baseRow,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

export async function processMultipleBazarInvoices(
  files: Array<{ buffer: Buffer; fileName: string; mimeType: string }>,
  concurrencyLimit: number = 3
): Promise<BazarInvoice[]> {
  const results: BazarInvoice[] = [];
  for (let i = 0; i < files.length; i += concurrencyLimit) {
    const batch = files.slice(i, i + concurrencyLimit);
    const batchResults = await Promise.all(
      batch.map(f => processBazarInvoice(f.buffer, f.fileName, f.mimeType))
    );
    results.push(...batchResults);
  }
  return results;
}
