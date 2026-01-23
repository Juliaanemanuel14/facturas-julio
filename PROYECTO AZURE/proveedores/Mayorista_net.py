# proveedores/mayorista_net.py
# -*- coding: utf-8 -*-

PATTERNS = [
    r"(?i)\bMAYORISTA\s+NET\b",
    r"(?i)\bMAYORISTANET\b",
    r"(?i)\bMAYORISTA\s+NET\s*S\.?A\.?\b",
    r"(?i)\bMAYORISTANET\.COM\b",
]

PROMPT = """
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
"""
