/**
 * Configuración para el procesamiento de facturas de proveedores
 * con Azure Document Intelligence y Google Gemini AI
 */

// Tipos de proveedor soportados
export const PROVIDER_TYPES = {
  COCA_COLA: 'cocacola',
  QUILMES: 'quilmes',
  GENERAL: 'general',
} as const;

export type ProviderType = typeof PROVIDER_TYPES[keyof typeof PROVIDER_TYPES];

// Configuración de Azure (obtener de variables de entorno)
export const getAzureConfig = () => {
  const endpoint = process.env.AZURE_ENDPOINT;
  const key = process.env.AZURE_KEY;

  if (!endpoint || !key) {
    throw new Error('Azure credentials not configured. Set AZURE_ENDPOINT and AZURE_KEY environment variables.');
  }

  return { endpoint, key };
};

// Configuración de Gemini (obtener de variables de entorno)
export const getGeminiConfig = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-pro';

  if (!apiKey) {
    throw new Error('Gemini API key not configured. Set GEMINI_API_KEY environment variable.');
  }

  return { apiKey, model };
};

// Prompts para extracción por proveedor
export const PROMPTS = {
  COCA_COLA: `
Proveedor: COCA-COLA FEMSA de Buenos Aires S.A.

Objetivo: Extraer y procesar la información de la factura/remito con cálculos de costeo precisos.
Devolver un JSON con la siguiente estructura:
{
  "invoice_number": "<número de factura en la esquina superior derecha, ej: 0619-00434490>",
  "invoice_total": <número entero del IMP.TOTAL o TOTAL de la factura>,
  "items": [<lista de objetos con los campos de cada producto>]
}

Cada objeto en "items" debe tener las claves EXACTAS:
["Codigo","Descripcion","Cantidad","PrecioUnitario","Subtotal","bulto","px_bulto","desc","neto","imp_int","iva_21","total","porc_desc","neto_mas_imp_int","iibb_caba","iibb_reg_3337","total_final","costo_x_bulto"]

REGLAS FUNDAMENTALES:
- Trabajar con anclas semánticas (texto clave), NO posiciones visuales
- Números en formato estándar: SIN símbolos $, SIN separadores de miles, SIN decimales (solo enteros)
- Si un valor no se encuentra: null
- Interpretación local argentina: "7.092.636,97" => 7092637 (redondeado a entero)
- No añadir texto fuera del JSON

ESTRUCTURA DE LA FACTURA COCA-COLA FEMSA:
Tabla de productos con columnas:
| CANTIDAD | CODIGO | PRODUCTO | P.UNITARIO | PRECIO NETO | DESCUENTO | SUBTOTAL | IVA 21% | I.INTERNOS | SUB+TOTAL |

ENCABEZADO DE FACTURA:
- invoice_number: Buscar en la esquina SUPERIOR DERECHA el texto "NUMERO:" seguido del número de factura.
  Formato típico: "NUMERO: 0619-00434490" → extraer "0619-00434490" (como string, con guiones)
  Si no se encuentra, buscar cualquier patrón similar a "XXXX-XXXXXXXX" en el encabezado.

PIE DE FACTURA (buscar fila "IB.DN"):
- IB_CAP_FED_TOTAL: Primer valor numérico en la zona de IB.DN (buscar texto "IB.CAP.FED")
- PERC_RG_3337_TOTAL: Tercer valor numérico en esa zona (buscar texto "PERC.RG.3337")
- invoice_total: IMPORTANTE - Buscar el texto exacto "IMP.TOTAL" seguido de "$" y extraer ese número.
  Es el ÚLTIMO valor numérico en el pie de la factura, después de todos los impuestos.
  Ejemplo: "IMP.TOTAL $ 860.602,32" → extraer 860602 (sin decimales)

PASO 1: CÁLCULOS GLOBALES (hacer primero, antes de procesar ítems)
1. SUMA_NETO_ITEMS = Sumar columna "SUBTOTAL" de todos los artículos
2. SUMA_NETO_MAS_IMP_INT_ITEMS = Sumar (SUBTOTAL + I.INTERNOS) de todos los artículos
3. porc_iibb_caba = IB_CAP_FED_TOTAL / SUMA_NETO_ITEMS
4. porc_iibb_reg_3337 = PERC_RG_3337_TOTAL / SUMA_NETO_MAS_IMP_INT_ITEMS

PASO 2: PROCESAMIENTO POR ÍTEM
Para CADA artículo en la tabla, extraer y calcular:

A. EXTRACCIÓN DIRECTA:
- Codigo: De columna CODIGO (ej: "112", "2061", "2063")
- Descripcion: De columna PRODUCTO (ej: "CC 354 X 6")
- producto: Igual que Descripcion
- bulto: De columna CANTIDAD (ej: 50, 10, 1, 100)
- Cantidad: Igual que bulto
- px_bulto: De columna P.UNITARIO (convertir a entero sin decimales, ej: 9029.97 → 9030)
- PrecioUnitario: Igual que px_bulto
- desc: De columna DESCUENTO (convertir a entero, ej: 180.599,40 → 180599)
- neto: De columna SUBTOTAL (primer subtotal, convertir a entero, ej: 270.899,10 → 270899)
- Subtotal: Igual que neto
- imp_int: De columna I.INTERNOS (convertir a entero, ej: 2.557,39 → 2557)
- iva_21: De columna IVA 21% (convertir a entero, ej: 56.888,81 → 56889)

B. CÁLCULOS POR ÍTEM:
- total = bulto * px_bulto (entero)
- porc_desc = desc / total (si total es 0, devolver null)
- neto_mas_imp_int = neto + imp_int

C. PRORRATEO DE IMPUESTOS:
- iibb_caba = neto * porc_iibb_caba (redondear a entero)
- iibb_reg_3337 = neto_mas_imp_int * porc_iibb_reg_3337 (redondear a entero)

D. TOTALIZACIÓN FINAL:
- total_final = neto_mas_imp_int + iva_21 + iibb_caba + iibb_reg_3337
- costo_x_bulto = total_final / bulto (redondear a entero)

CASOS ESPECIALES:
- Incluir "Servicios Administrativos" si tiene código y valores numéricos
- Ignorar totales del pie, encabezados, sellos manuscritos
- NO incluir líneas de resumen (TOT BULTOS/UNID., etc.)
- Mantener orden exacto de aparición

SALIDA:
JSON con "invoice_number", "invoice_total" y "items".

CRÍTICO - invoice_total:
- Buscar el texto "IMP.TOTAL" o "IMPORTE TOTAL" en el pie de la factura
- Es el valor que aparece después de sumar todos los impuestos
- Está marcado claramente como "IMP.TOTAL $" seguido del número
- Convertir a entero sin decimales
- Si no encuentras este valor, busca el último total después de "TRANSFERENCIA BANCO"

Ejemplo de estructura con datos de esta factura:
{
  "invoice_number": "0619-00434490",
  "invoice_total": 860602,
  "items": [
    {
      "Codigo": "112",
      "Descripcion": "CC 354 X 6",
      "Cantidad": 50,
      "PrecioUnitario": 9030,
      "Subtotal": 270899,
      "bulto": 50,
      "px_bulto": 9030,
      "desc": 180599,
      "neto": 270899,
      "imp_int": 2557,
      "iva_21": 56889,
      "total": 451500,
      "porc_desc": 0.4,
      "neto_mas_imp_int": 273456,
      "iibb_caba": 5679,
      "iibb_reg_3337": 4324,
      "total_final": 340348,
      "costo_x_bulto": 6807
    }
  ]
}
`,

  QUILMES: `
Proveedor: Cervecería y Maltería Quilmes S.A.

Objetivo: Extraer y procesar la información de la factura con cálculos precisos.
Devolver un JSON con la siguiente estructura:
{
  "invoice_number": "<número de factura>",
  "invoice_total": <número entero del total de la factura>,
  "items": [<lista de objetos con los campos de cada producto>]
}

Cada objeto en "items" debe tener las claves exactas correspondientes a los 21 campos de Quilmes:
["Num_de_FC","Producto","Familia","Bultos","Ps","Q","Px_Lista","Desc_Uni","Total","Desc_Global","Desc_Porc","Neto","Imp_Int","Porc_II","Neto_Imp","IVA","IIBB","Perc_IVA","Final","Pack_Final","Unit"]

REGLAS FUNDAMENTALES:
- Números en formato estándar: SIN símbolos $, SIN separadores de miles
- Decimales con punto (ej: 12345.67)
- Si un valor no se encuentra: null
- No añadir texto fuera del JSON

Extrae TODOS los productos de la tabla y calcula los campos requeridos.
`,

  GENERAL: `
Extrae la información de esta factura en formato JSON estructurado.

Objetivo: Extraer items/productos de la factura.
Devolver un JSON con:
{
  "items": [
    {
      "Codigo": "<código del producto>",
      "Descripcion": "<descripción del producto>",
      "Cantidad": <cantidad numérica>,
      "PrecioUnitario": <precio unitario numérico>,
      "Subtotal": <subtotal numérico>
    }
  ]
}

REGLAS:
- Números en formato estándar sin separadores
- Si un valor no se encuentra: null
- No añadir texto fuera del JSON
- Extraer TODOS los items de la factura
`,
};

// Detectar tipo de proveedor basado en el contenido
export function detectProviderType(text: string): ProviderType {
  const lowerText = text.toLowerCase();

  if (lowerText.includes('coca') && lowerText.includes('cola')) {
    return PROVIDER_TYPES.COCA_COLA;
  }

  if (lowerText.includes('quilmes')) {
    return PROVIDER_TYPES.QUILMES;
  }

  return PROVIDER_TYPES.GENERAL;
}
