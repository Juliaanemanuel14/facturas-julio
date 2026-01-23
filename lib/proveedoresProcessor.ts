/**
 * Procesador de facturas de proveedores usando SOLO Google Gemini AI
 * Optimizado para velocidad máxima
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getGeminiConfig, detectProviderType, PROMPTS, PROVIDER_TYPES, type ProviderType } from './proveedoresConfig';

// Definir tipos
export interface InvoiceItem {
  Codigo?: string | null;
  Descripcion?: string | null;
  Cantidad?: number | null;
  PrecioUnitario?: number | null;
  Subtotal?: number | null;
  [key: string]: any; // Campos adicionales según el proveedor
}

export interface ProcessedInvoice {
  fileName: string;
  provider: ProviderType;
  invoiceNumber?: string | null;
  invoiceTotal?: number | null;
  items: InvoiceItem[];
  error?: string;
}

// Cache para Gemini model
let geminiModelInstance: any = null;

function getGeminiModel() {
  if (!geminiModelInstance) {
    const { apiKey, model } = getGeminiConfig();
    const genAI = new GoogleGenerativeAI(apiKey);
    geminiModelInstance = genAI.getGenerativeModel({ model });
  }
  return geminiModelInstance;
}

// Mapa de prompts para acceso O(1)
const PROMPT_MAP: Record<ProviderType, string> = {
  [PROVIDER_TYPES.COCA_COLA]: PROMPTS.COCA_COLA,
  [PROVIDER_TYPES.QUILMES]: PROMPTS.QUILMES,
  [PROVIDER_TYPES.PENAFLOR]: PROMPTS.PENAFLOR,
  [PROVIDER_TYPES.MAYORISTA_NET]: PROMPTS.MAYORISTA_NET,
  [PROVIDER_TYPES.BLANCA_LUNA]: PROMPTS.BLANCA_LUNA,
  [PROVIDER_TYPES.DEPOSITO_CENTRAL]: PROMPTS.DEPOSITO_CENTRAL,
  [PROVIDER_TYPES.ENTRE_AMIGOS]: PROMPTS.ENTRE_AMIGOS,
  [PROVIDER_TYPES.ARCUCCI]: PROMPTS.ARCUCCI,
  [PROVIDER_TYPES.AJO]: PROMPTS.AJO,
  [PROVIDER_TYPES.DBA]: PROMPTS.DBA,
  [PROVIDER_TYPES.KUNZE]: PROMPTS.KUNZE,
  [PROVIDER_TYPES.GENERAL]: PROMPTS.GENERAL,
};

/**
 * Procesa factura con Google Gemini AI
 */
async function processWithGemini(
  buffer: Buffer,
  _fileName: string,
  mimeType: string,
  extractedText?: string,
  preDetectedProvider?: ProviderType
): Promise<{ provider: ProviderType; invoiceNumber?: string; invoiceTotal?: number; items: InvoiceItem[] }> {
  const geminiModel = getGeminiModel();

  // Usar proveedor pre-detectado o detectar del texto
  const provider = preDetectedProvider || (extractedText ? detectProviderType(extractedText) : PROVIDER_TYPES.GENERAL);

  // Obtener prompt apropiado (O(1) lookup)
  const prompt = PROMPT_MAP[provider] || PROMPTS.GENERAL;

  let response;

  // Si es imagen, enviar directamente a Gemini
  if (mimeType.startsWith('image/')) {
    const imagePart = {
      inlineData: {
        data: buffer.toString('base64'),
        mimeType,
      },
    };

    response = await geminiModel.generateContent([prompt, imagePart]);
  } else if (extractedText) {
    // Si tenemos texto extraído (de PDF via Azure), usar texto
    const promptWithText = `${prompt}\n\nTEXTO EXTRAÍDO:\n${extractedText}`;
    response = await geminiModel.generateContent(promptWithText);
  } else {
    throw new Error('No se pudo procesar el archivo: ni imagen ni texto disponible');
  }

  // Parsear respuesta
  let responseText = response.response.text().trim();

  // Limpiar markdown
  if (responseText.startsWith('```json')) {
    responseText = responseText.substring(7);
  } else if (responseText.startsWith('```')) {
    responseText = responseText.substring(3);
  }
  if (responseText.endsWith('```')) {
    responseText = responseText.substring(0, responseText.length - 3);
  }
  responseText = responseText.trim();

  const result = JSON.parse(responseText);

  // Manejar ambos formatos de respuesta
  let items: InvoiceItem[] = [];
  let invoiceNumber: string | undefined;
  let invoiceTotal: number | undefined;

  if (result.items && Array.isArray(result.items)) {
    items = result.items;
    invoiceNumber = result.invoice_number;
    invoiceTotal = result.invoice_total;
  } else if (Array.isArray(result)) {
    items = result;
  }

  return {
    provider,
    invoiceNumber,
    invoiceTotal,
    items,
  };
}

/**
 * Detecta proveedor desde el nombre del archivo
 */
function detectProviderFromFileName(fileName: string): ProviderType {
  const lower = fileName.toLowerCase();
  if (lower.includes('quilmes') || lower.includes('cerveceria')) return PROVIDER_TYPES.QUILMES;
  if (lower.includes('coca') || lower.includes('femsa')) return PROVIDER_TYPES.COCA_COLA;
  if (lower.includes('peñaflor') || lower.includes('penaflor')) return PROVIDER_TYPES.PENAFLOR;
  if (lower.includes('mayorista')) return PROVIDER_TYPES.MAYORISTA_NET;
  if (lower.includes('blanca') || lower.includes('bidfood')) return PROVIDER_TYPES.BLANCA_LUNA;
  if (lower.includes('central') || lower.includes('deposito')) return PROVIDER_TYPES.DEPOSITO_CENTRAL;
  if (lower.includes('amigos') || lower.includes('frigorifico')) return PROVIDER_TYPES.ENTRE_AMIGOS;
  if (lower.includes('arcucci') || lower.includes('moop')) return PROVIDER_TYPES.ARCUCCI;
  if (lower.includes('ajo') || lower.includes('tufud')) return PROVIDER_TYPES.AJO;
  if (lower.includes('dba')) return PROVIDER_TYPES.DBA;
  if (lower.includes('kunze') || lower.includes('bier')) return PROVIDER_TYPES.KUNZE;
  return PROVIDER_TYPES.GENERAL;
}

/**
 * Procesa un archivo de factura (PDF o imagen) usando SOLO GEMINI
 * Optimizado para velocidad máxima
 */
export async function processProveedorInvoice(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<ProcessedInvoice> {
  const startTime = Date.now();

  try {
    // Detectar proveedor desde nombre de archivo
    const detectedProvider = detectProviderFromFileName(fileName);

    // Procesar directamente con Gemini (hace OCR internamente para imágenes)
    const geminiResult = await processWithGemini(buffer, fileName, mimeType, undefined, detectedProvider);

    const result: ProcessedInvoice = {
      fileName,
      provider: geminiResult.provider,
      invoiceNumber: geminiResult.invoiceNumber,
      invoiceTotal: geminiResult.invoiceTotal,
      items: geminiResult.items,
    };

    console.log(`✓ ${fileName} procesado en ${Date.now() - startTime}ms (${result.items.length} items)`);
    return result;

  } catch (error) {
    console.error(`✗ Error procesando ${fileName}:`, error);
    return {
      fileName,
      provider: PROVIDER_TYPES.GENERAL,
      items: [],
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Procesa múltiples archivos en paralelo con límite de concurrencia
 * @param files Array de objetos con buffer, fileName y mimeType
 * @param concurrencyLimit Número máximo de archivos procesados simultáneamente (default: 3)
 */
export async function processMultipleInvoices(
  files: Array<{ buffer: Buffer; fileName: string; mimeType: string }>,
  concurrencyLimit: number = 3
): Promise<ProcessedInvoice[]> {
  const startTime = Date.now();
  console.log(`\n📦 Procesando ${files.length} archivos con concurrencia ${concurrencyLimit}...`);

  const results: ProcessedInvoice[] = [];

  // Procesar en lotes para respetar rate limits
  for (let i = 0; i < files.length; i += concurrencyLimit) {
    const batch = files.slice(i, i + concurrencyLimit);
    const batchNum = Math.floor(i / concurrencyLimit) + 1;
    const totalBatches = Math.ceil(files.length / concurrencyLimit);

    console.log(`\n🔄 Lote ${batchNum}/${totalBatches} (${batch.length} archivos)`);

    const batchResults = await Promise.all(
      batch.map(file => processProveedorInvoice(file.buffer, file.fileName, file.mimeType))
    );

    results.push(...batchResults);
  }

  const totalTime = Date.now() - startTime;
  const avgTime = Math.round(totalTime / files.length);
  console.log(`\n✅ Completado: ${files.length} archivos en ${totalTime}ms (promedio: ${avgTime}ms/archivo)`);

  return results;
}
