# proveedores/dba.py
# -*- coding: utf-8 -*-

PATTERNS = [
    r"(?i)\bDBA\b",
    r"(?i)\bD\.?B\.?A\.?\b",
    r"(?i)\bDISTRIBUIDORA\s+DE\s+BEBIDAS\b",
    r"(?i)\bDISTRIBUIDORA\s+DE\s+BEBIDAS\s+SRL\b",
]

PROMPT = """
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
"""
