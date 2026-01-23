/**
 * Configuración para el procesamiento de facturas de proveedores
 * con Azure Document Intelligence y Google Gemini AI
 */

// Tipos de proveedor soportados
export const PROVIDER_TYPES = {
  COCA_COLA: 'cocacola',
  QUILMES: 'quilmes',
  PENAFLOR: 'penaflor',
  MAYORISTA_NET: 'mayorista_net',
  BLANCA_LUNA: 'blanca_luna',
  DEPOSITO_CENTRAL: 'deposito_central',
  ENTRE_AMIGOS: 'entre_amigos',
  ARCUCCI: 'arcucci',
  AJO: 'ajo',
  DBA: 'dba',
  KUNZE: 'kunze',
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
  const model = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';

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
Rol: Actúa como un Auditor de Datos experto. Tu tarea es extraer, procesar y validar matemáticamente facturas de "CERVECERIA Y MALTERIA QUILMES".

Objetivo: Generar una tabla de costos estructurada donde la suma de los totales calculados coincida exactamente (diferencia ≈ 0%) con el total a pagar de la factura. Todas las columnas pedidas aquí son necesarias, y las compras siempre son de una sola página.

═══════════════════════════════════════════════════════════════════════════════
FASE 1: EXTRACCIÓN Y REGLAS DE NEGOCIO
═══════════════════════════════════════════════════════════════════════════════

1. Datos de Control (Pie de Página)
Antes de procesar los ítems, extrae:
- TOTAL_FACTURA_REAL: Importe final a pagar (Footer).
- TOTAL_IIBB: Percepción Ingresos Brutos (PERC.IN.BR. o CABA RG987/12).
- TOTAL_PERC_IVA: Percepción IVA.
- SUBTOTAL_NETO: Subtotal neto de la factura.

Cálculo de Coeficientes:
- Coef_IIBB = TOTAL_IIBB / SUBTOTAL_NETO
- Coef_Perc_IVA = TOTAL_PERC_IVA / SUBTOTAL_NETO

2. Reglas de Inferencia (Línea por Línea)

Regla "Bultos Fantasma" (Corrección de Errores):
Si la columna "BULTOS" es 1 o ilegible, pero el Total Bruto Línea >> Precio Unitario, ignora el visual.
Calcula: Bultos = Total Bruto / Precio Unitario Lista.

Regla de Pack Size (Ps):
- "4x6", "4X6" → Ps = 24
- "x12", "12x" → Ps = 12
- "x6", "6x" → Ps = 6
- Otros/Barriles/Servicios → Ps = 1

Regla de Descuentos:
Calcula el descuento real como: (Bultos * Px Lista) - Neto_Linea
(Respeta descuentos agresivos del 90%+ si la matemática lo indica).

═══════════════════════════════════════════════════════════════════════════════
FASE 2: CÁLCULOS ESTRUCTURALES
═══════════════════════════════════════════════════════════════════════════════

Para cada ítem, calcula las siguientes columnas:

- Fecha: Fecha de la factura (formato dd-mmm, ej. 28-oct)
- Num_de_FC: Número de factura del encabezado (ej. 9407-06280841)
- Producto: Descripción del producto
- Familia: Primera palabra del producto (ej. "PEPSI", "QUILMES", "ECO")
- Bultos: Cantidad de bultos (aplicar Regla "Bultos Fantasma" si aplica)
- Ps: Pack Size según reglas
- Q (Unidades): Bultos * Ps
- Px_Lista: Precio unitario de lista
- Desc_Uni: Descuento por unidad = (Total - Neto) / Bultos
- Total (Bruto): Bultos * Px Lista
- Desc_Global: Monto total de descuento en $
- Desc_Porc: Porcentaje de descuento = (Total - Neto) / Total
- Neto: Subtotal neto de la línea (extraído de factura)
- Imp_Int: Impuesto interno (extraído de factura)
- Porc_II: (Imp Int / Neto) * 100
- Neto_Imp: Neto + Imp Int
- IVA: IVA 21% sobre Neto = Neto * 0.21
- IIBB: Prorrateo = Neto * Coef_IIBB
- Perc_IVA: Prorrateo = Neto * Coef_Perc_IVA
- Final: Neto + Imp_Int + IVA + IIBB + Perc_IVA
- Pack_Final: Final / Bultos
- Unit: Pack_Final / Ps

═══════════════════════════════════════════════════════════════════════════════
FASE 3: CIRCUITO DE VALIDACIÓN (CRÍTICO)
═══════════════════════════════════════════════════════════════════════════════

Una vez procesada toda la tabla, realiza obligatoriamente esta comprobación:

1. Suma toda la columna "Final" de tus ítems.
2. Compara esa suma contra el TOTAL_FACTURA_REAL extraído en la Fase 1.
3. Calcula la Desviación: Diferencia = | Suma_Calculada - TOTAL_FACTURA_REAL |

CRITERIO DE ÉXITO:
- Si Diferencia < $5.00 (tolerancia por redondeo): El análisis es VÁLIDO ✅
- Si Diferencia > $5.00: ALERTA DE ERROR ❌

Autocorrección: Si hay error, revisa:
- Si falta sumar algún impuesto interno
- Si aplicaste mal la "Regla de Bultos Fantasma" en algún ítem de alto valor
- Si los coeficientes de prorrateo están bien calculados

═══════════════════════════════════════════════════════════════════════════════
SALIDA FINAL REQUERIDA (JSON)
═══════════════════════════════════════════════════════════════════════════════

Devolver un JSON con la estructura:
{
  "invoice_number": "<número de factura>",
  "invoice_date": "<fecha de factura>",
  "invoice_total": <total real de la factura>,
  "calculated_total": <suma de columna Final>,
  "difference": <diferencia absoluta>,
  "difference_percent": <diferencia en porcentaje>,
  "validation_status": "OK" | "REVISAR",
  "subtotal_neto": <subtotal neto>,
  "total_iibb": <total IIBB>,
  "total_perc_iva": <total percepción IVA>,
  "coef_iibb": <coeficiente IIBB>,
  "coef_perc_iva": <coeficiente percepción IVA>,
  "items": [<lista de objetos con los campos de cada producto>]
}

Cada objeto en "items" debe tener las claves EXACTAS:
["Fecha","Num_de_FC","Producto","Familia","Bultos","Ps","Q","Px_Lista","Desc_Uni","Total","Desc_Global","Desc_Porc","Neto","Imp_Int","Porc_II","Neto_Imp","IVA","IIBB","Perc_IVA","Final","Pack_Final","Unit"]

IMPORTANTE:
- Todos los valores numéricos deben usar punto como separador decimal (ej. 10000.50)
- Los porcentajes deben ser decimales (ej. 0.15 para 15%)
- Si un valor no se puede calcular o no existe, usar null
- NO añadir texto fuera del JSON
- Devolver ÚNICAMENTE el JSON (sin fences de código)
- La validación es OBLIGATORIA: siempre incluir calculated_total, difference y validation_status
`,

  PENAFLOR: `
Actúa como un procesador de datos experto especializado en facturas de "GRUPO PEÑAFLOR".
Tu objetivo es generar una tabla exacta al formato solicitado, infiriendo datos de empaque desde la descripción.

BASE DE DATOS DE IMPUESTOS INTERNOS (REFERENCIA MAESTRA)
Instrucción Crítica: Antes de procesar cada línea, busca el Codigo en esta tabla.
Si el código ESTÁ: Usa esa Alícuota exacta.
Si el código NO ESTÁ: La Alícuota es 0.

Tabla de Códigos e Impuestos Internos:
- 14583: 0.0873 (8.73%)
- 14619: 0.0873 (8.73%)
- 14594: 0.0873 (8.73%)
- 14595: 0.0873 (8.73%)
- 14596: 0.0873 (8.73%)
- 14585: 0.0873 (8.73%)
- 14587: 0.0873 (8.73%)
- 35103: 0.0873 (8.73%)
- 35104: 0.0873 (8.73%)
- 35105: 0.0873 (8.73%)
- 35107: 0.0873 (8.73%)
- 35108: 0.0873 (8.73%)
- 35109: 0.0873 (8.73%)
- 30001: 0.3513 (35.13%)
- 30002: 0.3513 (35.13%)
- 30019: 0.3513 (35.13%)
- 30020: 0.3513 (35.13%)
- 30022: 0.3513 (35.13%)
- 30010: 0.3513 (35.13%)
- 30133: 0.3513 (35.13%)
- 30004: 0.3513 (35.13%)
- 30005: 0.3513 (35.13%)
- 30126: 0.3513 (35.13%)
- 30016: 0.3513 (35.13%)
- 30130: 0.3513 (35.13%)
- 30128: 0.3513 (35.13%)
- 30018: 0.3513 (35.13%)
- 30048: 0.3513 (35.13%)
- 30008: 0.3513 (35.13%)
- 30066: 0.3513 (35.13%)
- 30029: 0.3513 (35.13%)
- 30009: 0.3513 (35.13%)
- 30110: 0.3513 (35.13%)
- 30054: 0.3513 (35.13%)
- 30031: 0.3513 (35.13%)
- 30087: 0.3513 (35.13%)
- 30088: 0.3513 (35.13%)
- 30089: 0.3513 (35.13%)
- 30032: 0.3513 (35.13%)
- 30033: 0.3513 (35.13%)
- 30043: 0.3513 (35.13%)
- 30049: 0.3513 (35.13%)
- 30051: 0.3513 (35.13%)
- 30052: 0.3513 (35.13%)
- 30058: 0.3513 (35.13%)
- 30136: 0.3513 (35.13%)
- 30007: 0.3513 (35.13%)
- 30076: 0.3513 (35.13%)
- 30025: 0.3513 (35.13%)
- 30023: 0.3513 (35.13%)
- 35095: 0.3513 (35.13%)
- 35096: 0.2530 (25.30%)
- 35097: 0.2530 (25.30%)
- 35093: 0.2530 (25.30%)
- 35101: 0.2530 (25.30%)
- 35102: 0.2530 (25.30%)
- 30012: 0.2530 (25.30%)
- 30129: 0.2530 (25.30%)
- 30003: 0.3513 (35.13%)
- 30035: 0.2530 (25.30%)
- 30134: 0.3513 (35.13%)
- 30131: 0.2530 (25.30%)
- 30132: 0.3513 (35.13%)
- 30077: 0.2530 (25.30%)
- 30065: 0.2530 (25.30%)

Reglas de Normalización:
1. Formato numérico: 10.000,00 (Separador de miles punto, decimal coma).
2. Fechas: dd-mmm (ej. 28-dic).
3. Si un valor es 0, déjalo como 0,00.

PASO 1: Datos Globales y Coeficientes
Extrae del Pie de Factura:
- TOTAL_NETO_FACTURA: Subtotal antes de impuestos (buscar "Subtotal").
- TOTAL_PERC_IVA: Valor bajo "Percepción de IVA".
- TOTAL_PERC_IB: Valor bajo "Percepción IIBB C.A.B.A.".
- TOTAL_IVA: Valor bajo "IVA 21,00%".

Calcula Coeficientes de Prorrateo:
- COEF_IIBB = TOTAL_PERC_IB / TOTAL_NETO_FACTURA
- COEF_PERC_IVA = TOTAL_PERC_IVA / TOTAL_NETO_FACTURA

PASO 2: Procesamiento Línea por Línea
Para cada fila de artículos, extrae y calcula los siguientes campos:

A. Extracción Directa (Columnas de la factura):
- Num de FC: Extraer del encabezado (Codigo Nro).
- Codigo: Columna "Articulo" o "Código".
- Producto: Columna "Descripción".
- Bultos: Columna "Cantidad" (Q).
- Px Lista: Columna "Precio Unit." antes de descuentos.
- Desc Global ($): Suma de descuentos aplicados (%Dto1, %Dto2, %Dto3, %Dto4).
- Neto: Columna "Importe" (Total Neto).

B. Lógica de Unidades (Ps y Q):
- Ps (Pack Size): Analiza el texto de "Producto".
  - Busca patrones como "12X750", "6X1LT". El número antes de la X es el Ps.
  - Si dice "4X6", multiplica 4*6 = 24.
  - Si no hay patrón, asume 1.
- Q (Total Unidades) = Bultos * Ps.

C. Cálculos de Estructura de Costos:
- Familia: Extraer la primera palabra del producto (ej. "TERMIDOR", "TRUMPETER").
- Total (Bruto) = Bultos * Px Lista.
- Desc Uni = (Total - Neto) / Bultos.
- Desc % = (Total - Neto) / Total.
- Imp Int: Buscar Codigo en la tabla maestra y aplicar alícuota.
  - Imp Int $ = Neto * Alícuota
  - % Imp Int = Alícuota de la tabla
- Neto + Imp = Neto + Imp Int.
- IVA $ = Neto * 0.21.
- IIBB $ (Prorrateo) = Neto * COEF_IIBB.
- Perc IVA $ (Prorrateo) = Neto * COEF_PERC_IVA.
- Final = Neto + Imp Int + IVA $ + IIBB $ + Perc IVA $.
- Pack Final = Final / Bultos.
- Unit = Pack Final / Ps.

SALIDA FINAL
Devolver un JSON con la estructura:
{
  "invoice_number": "<número de factura del encabezado>",
  "invoice_total": <total de la factura>,
  "items": [<lista de objetos con los campos de cada producto>]
}

Cada objeto en "items" debe tener las claves EXACTAS:
["Fecha","Num_de_FC","Codigo","Producto","Familia","Bultos","Ps","Q","Px_Lista","Desc_Uni","Total","Desc_Global","Desc_Porc","Neto","Imp_Int","Porc_II","Neto_Imp","IVA","IIBB","Perc_IVA","Final","Pack_Final","Unit"]

IMPORTANTE:
- Todos los valores numéricos deben usar punto como separador decimal (ej. 10000.50)
- Los porcentajes deben ser decimales (ej. 0.0873 para 8.73%, 0.3513 para 35.13%)
- Si un valor no se puede calcular o no existe, usar null
- NO añadir texto fuera del JSON
- Devolver ÚNICAMENTE el JSON (sin fences de código)
`,

  MAYORISTA_NET: `
Proveedor: MAYORISTANET.COM S.A.

Rol: Actúa como un Auditor de Costos y Fiscal.

Objetivo: Digitalizar facturas de "MAYORISTANET.COM S.A.", desglosando la estructura impositiva línea por línea para llegar al Costo Unitario Final (Landing Cost) real.

FASE 1: EXTRACCIÓN Y REGLAS DE LECTURA

Datos de Cabecera/Pie:
- IIBB Tasa: Busca en el pie de página la tasa de "Perc IIBB" (Ej: 3.00%).
- TOTAL_COMPROBANTE: El importe final a pagar.

Lectura de Ítems (Columnas Explícitas):
- Descripción: Nombre del producto.
- Cant: Cantidad de bultos facturados.
- Total Neto: El subtotal de la línea.
- Tasa IVA: Lee explícitamente la columna "Tasa IVA" (21.00 o 10.50).

FASE 2: LÓGICA DE CÁLCULO (CASCADA)

Para cada ítem, aplica este orden estricto:

1. Determinación del Stock (Regla del Pack Size ≤ 12):
   - Analiza la descripción. Busca patrones numéricos "N x..." o "...x N".
   - Si N ≤ 12: Ps = N. (Es venta de unidades agrupadas).
   - Si N > 12 o no hay patrón: Ps = 1. (Es venta a granel/bulto cerrado).
   - Fórmula: Q_Total = Cant * Ps.

2. Estructura Impositiva:
   - IVA $: Total Neto * (Tasa IVA / 100).
   - IIBB $: Total Neto * (Tasa IIBB Pie / 100). Nota: Si no hay tasa explícita, usa 0.
   - Total Final (Landing): Total Neto + IVA $ + IIBB $.

3. Definición de Costos:
   - Unitario Final: Total Final (Landing) / Q_Total.

FASE 3: VALIDACIÓN

Suma la columna "Total Final (Landing)" de todos los ítems.
Compara contra "TOTAL_COMPROBANTE".
Si la diferencia es < $10, marca "✅ OK".

SALIDA FINAL
Devolver un JSON con la estructura:
{
  "invoice_number": "<número de factura del encabezado>",
  "invoice_total": <total de la factura>,
  "items": [<lista de objetos con los campos de cada producto>]
}

Cada objeto en "items" debe tener las claves EXACTAS:
["Producto","Cant","Ps","Q","Total_Neto","Porc_IVA","IVA","IIBB","Total_Final","Unitario_Final"]

IMPORTANTE:
- Todos los valores numéricos deben usar punto como separador decimal (ej. 10000.50)
- Los porcentajes deben ser decimales (ej. 0.21 para 21%)
- Si un valor no se puede calcular o no existe, usar null
- NO añadir texto fuera del JSON
- Devolver ÚNICAMENTE el JSON (sin fences de código)
`,

  BLANCA_LUNA: `
Proveedor: GRUPO BLANCALUNA S.A. (Bidfood)

Rol: Actúa como un Auditor de Costos y Fiscal especializado en Gastronomía.

Objetivo: Digitalizar facturas de "GRUPO BLANCALUNA S.A." (Bidfood), calculando las alícuotas impositivas reales desde el pie de página para obtener el Costo Unitario Final (Landing Cost) exacto.

FASE 1: EXTRACCIÓN Y CÁLCULO DE TASAS GLOBALES

Antes de procesar los ítems, analiza el Pie de Página para determinar los coeficientes:

1. Base de Cálculo:
   - SUBTOTAL_NETO: El subtotal gravado antes de impuestos.
   - TOTAL_COMPROBANTE: El importe final a pagar.

2. Determinación de Alícuotas (Cálculo Inverso):
   - Coef_IVA: (Total IVA Inscripto / SUBTOTAL_NETO). *Ej: Si da 0.21, es 21%.*
   - Coef_IIBB: (Suma de todas las Percepciones IIBB Cod 901, 902, etc. / SUBTOTAL_NETO).
   - Nota: Usa estos coeficientes exactos para calcular los impuestos de cada línea.

FASE 2: LECTURA DE ÍTEMS Y COSTEO

Procesa línea por línea usando estas columnas explícitas:
- Descripción: Nombre del producto.
- Cant: Cantidad facturada (Columna "CANT.1").
- Total Neto: Importe de la línea (Columna "IMPORTE").

Lógica de Negocio (Cascada):

1. Determinación del Stock (Unidad de Compra):
   - Ps (Pack Size) = 1.
   - Regla: Asume que el precio facturado corresponde al bulto cerrado (Caja, Balde, Bolsa) que es la unidad mínima de venta de este proveedor.
   - Q_Total = Cant * Ps.

2. Estructura Impositiva (Prorrateo):
   - IVA $: Total Neto * Coef_IVA.
   - IIBB $: Total Neto * Coef_IIBB.
   - Total Final (Landing): Total Neto + IVA $ + IIBB $.

3. Costo Unitario:
   - Unitario Final: Total Final (Landing) / Q_Total.

FASE 3: VALIDACIÓN ESTRICTA

- Suma Vertical: Suma la columna "Total Final (Landing)" de todos los ítems.
- Cotejo: Compara la Suma Vertical contra el TOTAL_COMPROBANTE.
- Tolerancia: Diferencia permitida < $1.00.
- Salida: Si coincide, marca "✅ OK".

SALIDA FINAL
Devolver un JSON con la estructura:
{
  "invoice_number": "<número de factura del encabezado>",
  "invoice_total": <total de la factura>,
  "items": [<lista de objetos con los campos de cada producto>]
}

Cada objeto en "items" debe tener las claves EXACTAS:
["Producto","Cant","Total_Neto","Tasa_IVA_Real","IVA","Tasa_IIBB_Real","IIBB","Total_Final","Unitario_Final"]

IMPORTANTE:
- Todos los valores numéricos deben usar punto como separador decimal (ej. 10000.50)
- Las tasas deben ser decimales (ej. 0.21 para 21%, 0.03 para 3%)
- Si un valor no se puede calcular o no existe, usar null
- NO añadir texto fuera del JSON
- Devolver ÚNICAMENTE el JSON (sin fences de código)
`,

  DEPOSITO_CENTRAL: `
Proveedor: Depósito CENTRAL

Rol: Actúa como un Auditor de Datos experto. Tu tarea es digitalizar y validar comprobantes de "Depósito CENTRAL"

Objetivo: Generar una tabla de costos donde el costo unitario y por bulto se derive de la relación entre "Cantidad" y "Bulto" declarada en el papel.

FASE 1: EXTRACCIÓN Y REGLAS DE NEGOCIO

1. Trigger de Archivo
   Si el proveedor es "CENTRAL", aplica estas reglas.

2. Extracción de Columnas Clave
   Debes leer explícitamente estas 4 columnas del cuerpo de la factura:
   - Cantidad (Equivale a Unidades Totales o 'Q').
   - Bulto (Cantidad de cajas/packs).
   - Precio Neto Unitario (Es el precio por UNIDAD suelta, no por bulto).
   - Total Neto (Total línea).

3. Datos de Control (Pie)
   - Impuestos: Asume 0% (IVA, IIBB, Perc) salvo que el pie de página diga lo contrario explícitamente.
   - TOTAL_FACTURA_REAL = Total Neto Final.

FASE 2: CÁLCULOS ESTRUCTURALES (Lógica Inversa)

A diferencia de otros proveedores, aquí calculamos el Pack Size (Ps) matemáticamente.

Para cada ítem:

1. Definir Ps (Pack Size):
   - Fórmula: Ps = Cantidad / Bulto.
   - (Ejemplo: Si Cantidad=12 y Bulto=1 -> Ps = 12).
   - (Ejemplo: Si Cantidad=3 y Bulto=3 -> Ps = 1).
   - Si Bulto es 0 o vacío, asume Ps = 1.

2. Definir Precios:
   - Unit (Real): Es el "Precio Neto Unitario" extraído de la imagen.
   - Px Lista (Precio Bulto): Unit (Real) * Ps.

3. Generar Columnas de Salida:
   - Q (Unidades): Columna "Cantidad" extraída.
   - Bultos: Columna "Bulto" extraída.
   - Total (Bruto): Total Neto extraído.
   - Neto: Igual al Total (Bruto).
   - Impuestos/Percepciones: $0,00.
   - Final (Calculado): Neto (pues no hay impuestos).
   - Pack Final: Final / Bultos.

FASE 3: CIRCUITO DE VALIDACIÓN

Suma toda la columna "Final (Calculado)".
Compara contra el total del pie de página.
Tolerancia: < $1.00.

SALIDA FINAL
Devolver un JSON con la estructura:
{
  "invoice_number": "<número de factura del encabezado>",
  "invoice_total": <total de la factura>,
  "items": [<lista de objetos con los campos de cada producto>]
}

Cada objeto en "items" debe tener las claves EXACTAS:
["Fecha","Num_de_FC","Producto","Familia","Bultos","Ps","Q","Px_Lista","Desc_Uni","Total","Neto","Impuestos","Final","Pack_Final","Unit"]

IMPORTANTE:
- Todos los valores numéricos deben usar punto como separador decimal (ej. 10000.50)
- Si un valor no se puede calcular o no existe, usar null
- NO añadir texto fuera del JSON
- Devolver ÚNICAMENTE el JSON (sin fences de código)
`,

  ENTRE_AMIGOS: `
Rol: Actúa como un Auditor de Compras de Perecederos. Tu tarea es digitalizar comprobantes de recepción de carne y pollo de 'Frigorífico ENTRE AMIGOS'.

Trigger de Archivo
Si el nombre del archivo o el encabezado contiene "ENTRE AMIGOS", aplica estas reglas.

FASE 1: MAPEO DE COLUMNAS Y EXTRACCIÓN

Importante: La unidad de medida en este proveedor es el KILOGRAMO.

Mapeo Estándar (Columnas del Proveedor):
- DESCRIPCION → Producto
- KILOS → Q (Cantidad en kilos)
- P.UNITARIO → Precio por kilogramo
- TOTAL → Total de la línea

Reglas de Negocio:
1. Ps (Pack Size): SIEMPRE es 1 (porque la unidad es el kilogramo, no hay agrupación en bultos cerrados).
2. Bultos: Usar el valor de KILOS (representa los kilos recibidos).
3. Q (Cantidad): Mismo valor que KILOS.
4. Px Lista: P.UNITARIO (precio por kilo).
5. Desc Uni: $0,00 (sin descuentos).
6. Total: Columna TOTAL del comprobante.
7. Neto: Igual a Total (sin impuestos).
8. Impuestos: $0,00 (este proveedor no discrimina IVA).
9. Final: Igual a Neto (pues Impuestos = 0).
10. Unit (x Kg): Final / Q (costo por kilogramo incluido todo).

Inferencia de Familia:
Clasifica cada producto según su descripción en una de estas categorías:
- "Carne" (vacuno: asado, cuadril, lomo, etc.)
- "Pollo" (pechuga, pata/muslo, alitas, etc.)
- "Cerdo" (bondiola, costilla, etc.)
- "Achuras" (riñón, hígado, molleja, etc.)

Si no es claro, usa "Carne" como default.

FASE 2: VALIDACIÓN DUAL

Este proveedor requiere dos validaciones:

1. Validación Monetaria:
   - Sumar toda la columna "Final (Calculado)".
   - Cotejar contra el TOTAL_FACTURA_REAL del pie de página.
   - Tolerancia: < $1.00.

2. Validación de Peso:
   - Sumar toda la columna "Q (Kgs)".
   - Cotejar contra el TOTAL_KILOS_CONTROL del pie (si existe).
   - Tolerancia: < 0.5 kg.

Si ambas validaciones pasan, marcar "✅ OK ($ y Kg)".
Si solo pasa monetaria, marcar "⚠️ OK ($) - revisar Kg".

SALIDA FINAL

Devolver un JSON con la estructura:
{
  "invoice_number": "<número de factura del encabezado>",
  "invoice_total": <total de la factura>,
  "items": [<lista de objetos con los campos de cada producto>]
}

Cada objeto en "items" debe tener las claves EXACTAS:
["Fecha","Num_de_FC","Producto","Familia","Bultos","Ps","Q","Px_Lista","Desc_Uni","Total","Neto","Impuestos","Final","Unit"]

IMPORTANTE:
- Todos los valores numéricos deben usar punto como separador decimal (ej. 10.50)
- Ps siempre es 1
- Bultos = Q = KILOS
- Impuestos = 0
- Neto = Total = Final (no hay impuestos)
- Unit = Final / Q (costo por kilogramo)
- Si un valor no se puede calcular o no existe, usar null
- NO añadir texto fuera del JSON
- Devolver ÚNICAMENTE el JSON (sin fences de código)
`,

  ARCUCCI: `
Prompt Maestro: Procesador MOOP / ARCUCCI (V. Refinada)

Rol: Auditor de Costos e Inventario.

Objetivo: Procesar comprobantes "X" de "ARCUCCI MARCELO ADRIAN" (MOOP), validando el descuento comercial línea por línea y calculando el costo unitario real de cada insumo.

FASE 1: EXTRACCIÓN Y REGLAS DE NEGOCIO

Trigger de Archivo
Si el proveedor es "ARCUCCI" o "MOOP", aplica estrictamente estas reglas.

Mapeo de Columnas (Lectura Explícita)
- Cantidad: Columna "Cant.".
- Descripción: Columna "Descripción".
- Px Lista Base: Columna "Precio Uni." (Precio de lista antes del descuento).
- % Desc: Columna "% Desc" (Crítico: suele ser 10.00 o similar).
- Total Línea (Neto): Columna "Sub Total c/ IVA" (o "Sub Total").

Datos de Control
- TOTAL_FACTURA_REAL: El importe final del pie de página.
- Impuestos: Al ser "Comprobantes X" o Presupuestos, asume IVA 0% y Percepciones $0.00, salvo que se discriminen explícitamente valores distintos de cero.

FASE 2: CÁLCULOS ESTRUCTURALES (Lógica de Descuento y Ps)

Para cada ítem, aplica este proceso secuencial:

1. Determinación Inteligente del Pack Size (Ps):
   Analiza la columna "Descripción" buscando el patrón de cantidad por bulto:

   - Regla "X Cantidad": Busca al final del texto patrones como "X50", "X 50", "X100", "X 1000".
     - Ejemplo: "BOLSA... X50 UNI" → Ps = 50.
     - Ejemplo: "FILM... 38X1000" → Ps = 1000 (Asume metros o unidades si el número es alto).

   - Regla de Exclusión de Dimensiones: No confundir medidas (ej: "90X120") con cantidad. La cantidad suele estar al final o seguida de "UNI"/"MTS".

   - Regla de Líquidos/Unidad: Si dice "LITROS", "CC", "GALÓN" o "X UNIDAD", asume Ps = 1 (El costo deseado es por envase cerrado, no por mililitro).

   - Default: Si no hay indicador claro, Ps = 1.

2. Cálculo de Costos (Cascada):
   - Total Bruto: Cantidad * Px Lista Base.
   - Desc ($): Total Bruto * (% Desc / 100).
   - Neto Calculado: Total Bruto - Desc ($).
   - Final: Igual al Neto Calculado (por ser IVA 0%).

3. Definición de Unitarios:
   - Pack Final (Costo Bulto): Final / Cantidad.
   - Unit Real (Costo Unitario): Pack Final / Ps.

FASE 3: CIRCUITO DE VALIDACIÓN

- Suma Vertical: Suma la columna "Final" de todos los ítems.
- Comparación: Coteja contra TOTAL_FACTURA_REAL.
- Tolerancia: Diferencia permitida < $1.00 (por redondeos de descuento).
- Estado: Si difiere, marca "❌ ERROR DESC"; si coincide, "✅ OK".

SALIDA FINAL

Devolver un JSON con la estructura:
{
  "invoice_number": "<número de factura del encabezado>",
  "invoice_total": <total de la factura>,
  "items": [<lista de objetos con los campos de cada producto>]
}

Cada objeto en "items" debe tener las claves EXACTAS:
["Fecha","Num_de_FC","Producto","Cant","Ps","Px_Lista_Base","Porc_Desc","Total_Bruto","Desc","Neto_Final","Pack_Final","Unit_Real"]

IMPORTANTE:
- Todos los valores numéricos deben usar punto como separador decimal (ej. 10000.50)
- Los porcentajes deben ser decimales (ej. 0.10 para 10%)
- Si un valor no se puede calcular o no existe, usar null
- NO añadir texto fuera del JSON
- Devolver ÚNICAMENTE el JSON (sin fences de código)
`,

  AJO: `
Prompt Maestro: Procesador TUFUD / AJO (Lógica Remito + IVA Externo)

Rol: Actúa como un Auditor de Costos y Control de Stock experto en Gastronomía.

Contexto: Estás procesando "Remitos Valorizados" del proveedor "TUFUD / Ribs Al Río".

Objetivo: Digitalizar el detalle operativo del remito para calcular el Costo Unitario Final (Landing Cost), aplicando el IVA del 21% que no figura en el documento físico pero sí en el resumen fiscal.

FASE 1: EXTRACCIÓN Y REGLAS DE LECTURA

1. Fuente de Datos (Lectura de Imágenes):
   - Lee las columnas explícitas del REMITO: "Categoría", "Producto", "Unidad", "Cantidad", "Total" (Este total es Neto).

2. Parámetros Fiscales (Inyección de Reglas):
   - Tasa IVA: Aplica 21.00% a todos los ítems (Regla General del Proveedor).
   - Validación: La suma de los "Totales" extraídos debe coincidir con el Subtotal Neto esperado.

FASE 2: LÓGICA DE NEGOCIO (PACK SIZE & COSTOS)

Para cada línea, ejecuta esta secuencia estricta:

Paso 1: Determinación del Pack Size (Ps) - Análisis Semántico
Analiza las columnas "Unidad" y "Producto" para hallar la unidad mínima de consumo:
   - Regla "Multiplicador": Si dice "x 24", "x 12", "x 50", "4 fetas", "5 porciones" -> Ps = N.
     (Ej: "Tortilla... Bolsa x 24 unid" -> Ps = 24).
   - Regla "Bolsa/Kilo Único": Si dice "Bolsa 1,980 kg", "1 Kilo", "500 gramos" sin desglose de unidades internas -> Ps = 1.
   - Default: Si no hay indicador numérico claro, Ps = 1.

Paso 2: Cálculos en Cascada
   - Q Total (Insumos): Cantidad (Bultos) * Ps.
   - Neto Línea: Valor extraído de columna "Total".
   - IVA Calculado $: Neto Línea * 0.21.
   - Total Final (Landing): Neto Línea + IVA Calculado.
   - Costo Unitario Real: Total Final (Landing) / Q Total.

FASE 3: VALIDACIÓN CRUZADA

- Suma la columna "Total Neto" de todos los ítems.
- Compara contra el Subtotal de Control proporcionado (si existe en el pie).
- Tolerancia: +/- $1.00 (por redondeos).
- Si coincide: ✅ OK. Si no: ❌ ERROR DE LECTURA.

SALIDA FINAL

Devolver un JSON con la estructura:
{
  "invoice_number": "<número de remito del encabezado>",
  "invoice_total": <total de la factura incluyendo IVA>,
  "items": [<lista de objetos con los campos de cada producto>]
}

Cada objeto en "items" debe tener las claves EXACTAS:
["Categoria","Producto","Presentacion","Cant","Ps","Q","Total_Neto","IVA","Total_Final","Costo_Unit_Real"]

IMPORTANTE:
- Todos los valores numéricos deben usar punto como separador decimal (ej. 10000.50)
- El IVA siempre es 21% (0.21)
- Si un valor no se puede calcular o no existe, usar null
- NO añadir texto fuera del JSON
- Devolver ÚNICAMENTE el JSON (sin fences de código)
`,

  DBA: `
Prompt Maestro: Procesador DBA (Desglose Impositivo Detallado)

Rol: Actúa como un Analista de Costos y Auditor Fiscal.

Contexto: Estás procesando facturas de "Distribuidora de Bebidas SRL" (DBA).

Problema: Este proveedor lista los productos en valor NETO y agrupa todos los impuestos (IVA, Internos, Percepciones) en el pie de página.

Objetivo: Prorratear la carga impositiva línea por línea para diferenciar el IVA (Crédito Fiscal) del Costo Real (Neto + Impuestos Internos + Percepciones).

FASE 1: LECTURA DEL PIE DE PÁGINA (CONTROL)

Extrae los valores totales para calcular las alícuotas reales de esta factura:
- SUBTOTAL_NETO: La base imponible (Suma de los netos).
- TOTAL_IVA: El monto total de IVA (Generalmente 21%).
- TOTAL_OTROS_IMP: Suma manual de: Impuestos Internos + Percep. IVA + Percep. IIBB.
- TOTAL_FACTURA: El importe final a pagar.

FASE 2: CÁLCULO DE COEFICIENTES (MATEMÁTICA)

Calcula los factores de prorrateo dividiendo los impuestos sobre el neto base:
- Coef_IVA: TOTAL_IVA / SUBTOTAL_NETO (Debe dar ≈ 0.21).
- Coef_OTROS: TOTAL_OTROS_IMP / SUBTOTAL_NETO (Este es el peso de imp. internos y percepciones).
- Coef_FINAL: TOTAL_FACTURA / SUBTOTAL_NETO (Factor total para validación).

FASE 3: PROCESAMIENTO DE ÍTEMS

Recorre la lista de productos y extrae: Descripción, Cantidad y Total Línea (Neto).

Nota: Si la línea tiene valor $0 (Bonificación), respétalo como $0.

Para cada ítem, aplica las fórmulas:
- Neto Unitario: Total Línea / Cantidad.
- IVA $: Neto Unitario * Coef_IVA.
- Otros Imp $: Neto Unitario * Coef_OTROS.
- Costo Unitario Final: Neto Unitario + IVA $ + Otros Imp $.

FASE 4: VALIDACIÓN CRUZADA

Suma el Costo Unitario Final multiplicado por la Cantidad de todos los ítems.
Compara esa suma contra el TOTAL_FACTURA.
Si la diferencia es menor a $5 pesos, el análisis es CORRECTO.

SALIDA FINAL

Devolver un JSON con la estructura:
{
  "invoice_number": "<número de factura del encabezado>",
  "invoice_total": <total de la factura>,
  "items": [<lista de objetos con los campos de cada producto>]
}

Cada objeto en "items" debe tener las claves EXACTAS:
["Producto","Cant","Neto_Unitario","IVA","Otros_Imp","Costo_Final_Unit"]

IMPORTANTE:
- Todos los valores numéricos deben usar punto como separador decimal (ej. 10000.50)
- Si la línea tiene valor $0 (bonificación), todos los costos deben ser 0
- Si un valor no se puede calcular o no existe, usar null
- NO añadir texto fuera del JSON
- Devolver ÚNICAMENTE el JSON (sin fences de código)
`,

  KUNZE: `
Prompt Maestro: Procesador BIER HAUS (Lógica Craft Beer)

Rol: Actúa como un Auditor de Costos y Datos experto en distribución de bebidas alcohólicas.

Objetivo: Digitalizar y validar facturas de "KUNZE SRL" (Bier Haus), desglosando correctamente el Impuesto Interno (8.70%) para llegar al Costo Unitario Final exacto.

FASE 1: LECTURA Y PARAMETRIZACIÓN (PIE DE PÁGINA)

Antes de leer los ítems, extrae los totales del pie de página para calcular los coeficientes impositivos globales:
- TOTAL_NETO_GRAVADO: Base imponible del comprobante.
- TOTAL_IVA: Monto de IVA (21%).
- TOTAL_IMP_INT (Otros Tributos): Busca el monto etiquetado como "Otros tributos" o "Impuesto Interno Cerveza".
- TOTAL_FACTURA_REAL: El importe final a pagar.

Cálculo de Coeficientes:
- Coef_Imp_Int: TOTAL_IMP_INT / TOTAL_NETO_GRAVADO. (Debe dar aprox 0.087 o 8.7%).

Nota: Este proveedor aplica el impuesto interno como un porcentaje sobre el neto, no como monto fijo.

FASE 2: EXTRACCIÓN Y LÓGICA DE ÍTEMS

Procesa línea por línea extrayendo: Descripción, Cantidad (Bultos) y Subtotal (Neto de Línea).

1. Regla de Pack Size (Ps):
   Analiza la descripción del producto para determinar cuántas unidades reales se compran.
   - Si dice "6-Pack", "6 Pack" o "x6" → Ps = 6. (Cada bulto trae 6 latas).
   - Si dice "24 Un" o "Caja" → Ps = 24.
   - Si no especifica → Ps = 1 (Barriles o unitarios).

2. Cálculos Estructurales (Línea por Línea):
   - Q (Unidades): Cantidad * Ps.
   - Neto: Extraído de la columna "Subtotal" (O calculado: Precio * Cantidad).
   - Imp Int $ (Prorrateo): Neto * Coef_Imp_Int.
   - IVA $: Neto * 0.21.
   - Final (Calculado): Neto + Imp Int $ + IVA $.
   - Costo Unitario (Lata/Botella): Final / Q.

FASE 3: CIRCUITO DE VALIDACIÓN

- Suma la columna "Final (Calculado)" de todos los ítems.
- Check: | Suma_Calculada - TOTAL_FACTURA_REAL | < $10.00.
- Si la diferencia es mayor, revisa si hay Percepciones de IIBB no contempladas en el coeficiente.

SALIDA FINAL

Devolver un JSON con la estructura:
{
  "invoice_number": "<número de factura del encabezado>",
  "invoice_total": <total de la factura>,
  "items": [<lista de objetos con los campos de cada producto>]
}

Cada objeto en "items" debe tener las claves EXACTAS:
["Producto","Bultos","Ps","Q","Px_Unit_Lista","Neto_Linea","Imp_Int","IVA","Total_Final","Costo_Unit"]

IMPORTANTE:
- Todos los valores numéricos deben usar punto como separador decimal (ej. 10000.50)
- El impuesto interno es aproximadamente 8.7% (0.087)
- Si un valor no se puede calcular o no existe, usar null
- NO añadir texto fuera del JSON
- Devolver ÚNICAMENTE el JSON (sin fences de código)
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

  if (lowerText.includes('peñaflor') || lowerText.includes('penaflor') ||
      lowerText.includes('grupo peñaflor') || lowerText.includes('grupo penaflor')) {
    return PROVIDER_TYPES.PENAFLOR;
  }

  if (lowerText.includes('mayorista') && lowerText.includes('net')) {
    return PROVIDER_TYPES.MAYORISTA_NET;
  }

  if (lowerText.includes('mayoristanet')) {
    return PROVIDER_TYPES.MAYORISTA_NET;
  }

  if (lowerText.includes('blanca') && lowerText.includes('luna')) {
    return PROVIDER_TYPES.BLANCA_LUNA;
  }

  if (lowerText.includes('blancaluna') || lowerText.includes('bidfood')) {
    return PROVIDER_TYPES.BLANCA_LUNA;
  }

  if (lowerText.includes('deposito') && lowerText.includes('central')) {
    return PROVIDER_TYPES.DEPOSITO_CENTRAL;
  }

  if (lowerText.includes('depósito central') || lowerText.includes('deposito central')) {
    return PROVIDER_TYPES.DEPOSITO_CENTRAL;
  }

  if (lowerText.includes('entre') && lowerText.includes('amigos')) {
    return PROVIDER_TYPES.ENTRE_AMIGOS;
  }

  if (lowerText.includes('entreamigos') || lowerText.includes('frigorifico entre amigos')) {
    return PROVIDER_TYPES.ENTRE_AMIGOS;
  }

  if (lowerText.includes('arcucci')) {
    return PROVIDER_TYPES.ARCUCCI;
  }

  if (lowerText.includes('moop') || lowerText.includes('arcucci marcelo adrian')) {
    return PROVIDER_TYPES.ARCUCCI;
  }

  if (lowerText.includes('ajo') || lowerText.includes('tufud')) {
    return PROVIDER_TYPES.AJO;
  }

  if (lowerText.includes('ribs al rio') || lowerText.includes('ribs al río')) {
    return PROVIDER_TYPES.AJO;
  }

  if (lowerText.includes('dba') || lowerText.includes('d.b.a')) {
    return PROVIDER_TYPES.DBA;
  }

  if (lowerText.includes('distribuidora de bebidas')) {
    return PROVIDER_TYPES.DBA;
  }

  if (lowerText.includes('kunze')) {
    return PROVIDER_TYPES.KUNZE;
  }

  if (lowerText.includes('bier haus') || lowerText.includes('bierhaus')) {
    return PROVIDER_TYPES.KUNZE;
  }

  if (lowerText.includes('kunze srl')) {
    return PROVIDER_TYPES.KUNZE;
  }

  return PROVIDER_TYPES.GENERAL;
}
