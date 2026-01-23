# proveedores/Peñaflor.py
# -*- coding: utf-8 -*-

PATTERNS = [
    r"(?i)\bPEÑAFLOR\b",
    r"(?i)\bGRUPO\s+PEÑAFLOR\b",
    r"(?i)\bPeñaflor\b",
    "PEÑAFLOR",
    "Peñaflor",
    "PEÑA",
    "Peña"
]

PROMPT = """
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
"""
