/**
 * Procesador de facturas de proveedores usando Azure Document Intelligence y Google Gemini AI
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getAzureConfig, getGeminiConfig, detectProviderType, PROMPTS, PROVIDER_TYPES, type ProviderType } from './proveedoresConfig';

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

/**
 * Extrae texto de una imagen usando Azure Document Intelligence
 */
async function extractTextFromImageAzure(buffer: Buffer): Promise<string> {
  // Solo importar si estamos en Node.js
  const { DocumentAnalysisClient, AzureKeyCredential } = await import('@azure/ai-form-recognizer');

  const { endpoint, key } = getAzureConfig();
  const client = new DocumentAnalysisClient(endpoint, new AzureKeyCredential(key));

  const poller = await client.beginAnalyzeDocument('prebuilt-layout', buffer);
  const result = await poller.pollUntilDone();

  // Extraer texto completo del documento
  let fullText = result.content || '';

  // Si no hay content, extraer de las líneas de cada página
  if (!fullText && result.pages) {
    fullText = result.pages
      .map((page: any) =>
        page.lines.map((line: any) => line.content).join('\n')
      )
      .join('\n\n');
  }

  return fullText;
}

/**
 * Extrae items de factura usando Azure Document Intelligence (modelo invoice)
 */
async function extractItemsWithAzure(buffer: Buffer): Promise<InvoiceItem[]> {
  const { DocumentAnalysisClient, AzureKeyCredential } = await import('@azure/ai-form-recognizer');

  const { endpoint, key } = getAzureConfig();
  const client = new DocumentAnalysisClient(endpoint, new AzureKeyCredential(key));

  const poller = await client.beginAnalyzeDocument('prebuilt-invoice', buffer);
  const result = await poller.pollUntilDone();

  const items: InvoiceItem[] = [];

  if (result.documents) {
    for (const doc of result.documents) {
      const itemsField = doc.fields?.Items as any;

      if (itemsField && itemsField.values) {
        for (const it of itemsField.values) {
          const fields = it.properties || {};

          const getFieldValue = (name: string): any => {
            const field = fields[name];
            return field?.content || field?.value || null;
          };

          const qty = parseFloat(getFieldValue('Quantity')) || null;
          const unitPrice = parseFloat(getFieldValue('UnitPrice')) || null;
          const amount = parseFloat(getFieldValue('Amount')) || null;
          const subtotal = amount || (qty && unitPrice ? qty * unitPrice : null);

          items.push({
            Codigo: getFieldValue('ProductCode'),
            Descripcion: getFieldValue('Description'),
            Cantidad: qty,
            PrecioUnitario: unitPrice,
            Subtotal: subtotal,
          });
        }
      }
    }
  }

  return items;
}

/**
 * Procesa factura con Google Gemini AI
 */
async function processWithGemini(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  extractedText?: string
): Promise<{ provider: ProviderType; invoiceNumber?: string; invoiceTotal?: number; items: InvoiceItem[] }> {
  const { apiKey, model } = getGeminiConfig();
  const genAI = new GoogleGenerativeAI(apiKey);
  const geminiModel = genAI.getGenerativeModel({ model });

  // Detectar tipo de proveedor si tenemos texto
  const provider = extractedText ? detectProviderType(extractedText) : PROVIDER_TYPES.GENERAL;

  // Obtener prompt apropiado
  const prompt = provider === PROVIDER_TYPES.COCA_COLA ? PROMPTS.COCA_COLA :
                 provider === PROVIDER_TYPES.QUILMES ? PROMPTS.QUILMES :
                 PROMPTS.GENERAL;

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
 * Procesa un archivo de factura (PDF o imagen)
 */
export async function processProveedorInvoice(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<ProcessedInvoice> {
  try {
    let result: ProcessedInvoice;

    // Detectar si es imagen o PDF
    const isImage = mimeType.startsWith('image/');
    const isPDF = mimeType === 'application/pdf';

    if (isImage) {
      // Para imágenes, primero extraer texto con Azure para detectar proveedor
      try {
        const extractedText = await extractTextFromImageAzure(buffer);
        const provider = detectProviderType(extractedText);

        // Usar Gemini con la imagen y el proveedor detectado
        const geminiResult = await processWithGemini(buffer, fileName, mimeType, extractedText);

        result = {
          fileName,
          provider: provider, // Usar proveedor detectado de Azure
          invoiceNumber: geminiResult.invoiceNumber,
          invoiceTotal: geminiResult.invoiceTotal,
          items: geminiResult.items,
        };
      } catch (azureError) {
        console.warn('Azure OCR failed for image, using Gemini with generic prompt:', azureError);
        // Si falla Azure, usar Gemini directamente
        const geminiResult = await processWithGemini(buffer, fileName, mimeType);

        result = {
          fileName,
          provider: geminiResult.provider,
          invoiceNumber: geminiResult.invoiceNumber,
          invoiceTotal: geminiResult.invoiceTotal,
          items: geminiResult.items,
        };
      }
    } else if (isPDF) {
      // Para PDFs, primero intentar Azure Document Intelligence
      try {
        // Extraer texto del PDF con Azure
        const extractedText = await extractTextFromImageAzure(buffer);

        // Detectar proveedor
        const provider = detectProviderType(extractedText);

        // Si es proveedor específico, usar Gemini con el texto extraído
        if (provider !== PROVIDER_TYPES.GENERAL) {
          const geminiResult = await processWithGemini(buffer, fileName, mimeType, extractedText);

          result = {
            fileName,
            provider: geminiResult.provider,
            invoiceNumber: geminiResult.invoiceNumber,
            invoiceTotal: geminiResult.invoiceTotal,
            items: geminiResult.items,
          };
        } else {
          // Para facturas generales, usar modelo de invoice de Azure
          const azureItems = await extractItemsWithAzure(buffer);

          result = {
            fileName,
            provider: PROVIDER_TYPES.GENERAL,
            items: azureItems,
          };
        }
      } catch (azureError) {
        console.warn('Azure processing failed, falling back to Gemini:', azureError);

        // Si falla Azure, intentar con Gemini
        const extractedText = await extractTextFromImageAzure(buffer);
        const geminiResult = await processWithGemini(buffer, fileName, mimeType, extractedText);

        result = {
          fileName,
          provider: geminiResult.provider,
          invoiceNumber: geminiResult.invoiceNumber,
          invoiceTotal: geminiResult.invoiceTotal,
          items: geminiResult.items,
        };
      }
    } else {
      throw new Error(`Formato de archivo no soportado: ${mimeType}`);
    }

    return result;

  } catch (error) {
    console.error(`Error procesando ${fileName}:`, error);
    return {
      fileName,
      provider: PROVIDER_TYPES.GENERAL,
      items: [],
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}
