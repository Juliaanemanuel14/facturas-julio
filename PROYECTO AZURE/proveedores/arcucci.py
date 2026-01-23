# proveedores/arcucci.py
# -*- coding: utf-8 -*-

PATTERNS = [
    r"(?i)\bARCUCCI\b",
    r"(?i)\bMOOP\b",
    r"(?i)ARCUCCI\s*MARCELO\s*ADRIAN",
    r"(?i)ARCUCCI\s*S\.?A\.?",
]

PROMPT = """
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
"""
