# proveedores/blanca_luna.py
# -*- coding: utf-8 -*-

PATTERNS = [
    r"(?i)\bBLANCA\s+LUNA\b",
    r"(?i)\bBLANCALUNA\b",
    r"(?i)\bBLANCA\s*LUNA\s*S\.?A\.?",
    r"(?i)\bGRUPO\s+BLANCALUNA\b",
    r"(?i)\bBIDFOOD\b",
]

PROMPT = """
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
"""
