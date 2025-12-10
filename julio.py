# -*- coding: utf-8 -*-
"""
Extractor de facturas para JULIO / GRATTINADO
Lee PDFs de una carpeta y genera un Excel con una fila por comprobante.
"""

import re
from pathlib import Path
from typing import Dict, List

import fitz  # PyMuPDF
import pandas as pd


# ==========================
# Helpers
# ==========================

def _clean(s: str) -> str:
    return (s or "").strip()


def _num(s: str) -> str:
    """
    Normaliza números en formato AR:
    - quita $, espacios y separadores de miles
    - convierte coma decimal a punto
    Devuelve string tipo '1234567.89'
    """
    if s is None:
        return "0.00"
    s = str(s)
    # dejo sólo dígitos, coma, punto y signo
    s = re.sub(r"[^\d,.\-]", "", s)
    # saco puntos de miles
    s = s.replace(".", "")
    # coma decimal -> punto
    s = s.replace(",", ".")
    m = re.findall(r"-?\d+(?:\.\d+)?", s)
    return m[0] if m else "0.00"


def _search_first(pattern: str, text: str, default: str = "") -> str:
    """
    Busca el primer match con flags típicos y devuelve el grupo 1 limpio.
    """
    m = re.search(pattern, text,
                  flags=re.IGNORECASE | re.MULTILINE | re.DOTALL)
    return _clean(m.group(1)) if m else default


# ==========================
# PDF
# ==========================

def get_pdf_text(pdf_bytes: bytes) -> str:
    """
    Devuelve el texto de la página ORIGINAL.
    Si no la encuentra, devuelve la primera página.
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        if len(doc) == 0:
            return ""

        # Página 0 primero
        texto = doc[0].get_text("text")
        if "ORIGINAL" in texto:
            return texto

        # Buscar "ORIGINAL" en el resto
        for page in doc:
            t = page.get_text("text")
            if "ORIGINAL" in t:
                return t

        # Si no hay ORIGINAL, devolvemos la primera igual
        return texto

    finally:
        doc.close()


# ==========================
# Parseo de una factura
# ==========================

def parse_factura(pdf_bytes: bytes, filename: str) -> Dict[str, str]:
    """
    Extrae los datos principales de la factura en una sola línea.
    """
    texto = get_pdf_text(pdf_bytes)
    datos: Dict[str, str] = {}

    datos["Archivo_PDF"] = filename

    # --------- Tipo de comprobante ----------
    txt_upper = texto.upper()
    if "NOTA DE CRÉDITO" in txt_upper or "NOTA DE CREDITO" in txt_upper:
        datos["Tipo_Comprobante"] = "NOTA DE CREDITO"
    elif "FACTURA" in txt_upper:
        datos["Tipo_Comprobante"] = "FACTURA"
    else:
        datos["Tipo_Comprobante"] = "DESCONOCIDO"

    # --------- Fecha de Emisión ----------
    fecha = _search_first(r"Fecha\s+de\s+Emisión:\s*.*?(\d{2}/\d{2}/\d{4})",
                          texto)
    if not fecha:
        fecha = _search_first(r"\b(\d{2}/\d{2}/\d{4})\b", texto)
    datos["Fecha_Emision"] = fecha

    # --------- Razón Social Emisor --------
    razon_emisor = _search_first(
        r"\n\s*([A-ZÁÉÍÓÚÑ0-9 .&]+S\. ?A\.)\s*\n", texto
    )
    datos["Razon_Social_Emisor"] = razon_emisor

    # --------- CUIT Emisor --------
    cuit_emisor = _search_first(r"\b(\d{11})\b", texto)
    datos["CUIT_Emisor"] = cuit_emisor

    # --------- Punto de Venta y Nro Comprobante (formato real proveedor) --------
    # Ejemplo exacto del PDF:
    # "Punto de Venta:    00002    Comp. Nro:    00000407"
    m_pto = re.search(
        r"Punto\s*de\s*Venta:\s*([0-9]{1,5})\s+Comp\.\s*Nro:\s*([0-9]{1,8})",
        texto,
        flags=re.IGNORECASE
    )
    if m_pto:
        datos["Punto_de_Venta"] = _clean(m_pto.group(1))
        datos["Comp_Nro"] = _clean(m_pto.group(2))
    else:
        datos["Punto_de_Venta"] = ""
        datos["Comp_Nro"] = ""

    # --------- CUIT y Razón Social Cliente --------
    m_cli = None
    if cuit_emisor:
        # patrón: CUIT_EMISOR (salto) CUIT_CLIENTE RAZON_SOCIAL_CLIENTE
        m_cli = re.search(
            r"\b" + re.escape(cuit_emisor) +
            r"\b\s*\n\s*(\d{11})\s+([A-Z0-9ÁÉÍÓÚÑ .,&]+)",
            texto
        )

    if m_cli:
        datos["CUIT_Cliente"] = _clean(m_cli.group(1))
        datos["Razon_Social_Cliente"] = _clean(m_cli.group(2))
    else:
        # Fallback: segundo CUIT y texto siguiente
        cuits = re.findall(r"\b(\d{11})\b", texto)
        if len(cuits) >= 2:
            segundo = cuits[1]
            m2 = re.search(
                rf"\b{segundo}\b\s+([A-Z0-9ÁÉÍÓÚÑ .,&]+)", texto
            )
            datos["CUIT_Cliente"] = segundo
            datos["Razon_Social_Cliente"] = _clean(m2.group(1)) if m2 else ""
        else:
            datos["CUIT_Cliente"] = ""
            datos["Razon_Social_Cliente"] = ""

    # --------- Totales --------
    datos["Importe_Neto_Gravado"] = _num(_search_first(
        r"Importe\s+Neto\s+Gravado:\s*\$?\s*(?:\n\s*)?([\d\.,]+)", texto))

    datos["IVA_27"] = _num(_search_first(
        r"IVA\s+27%:\s*\$?\s*(?:\n\s*)?([\d\.,]+)", texto))

    datos["IVA_21"] = _num(_search_first(
        r"IVA\s+21%:\s*\$?\s*(?:\n\s*)?([\d\.,]+)", texto))

    datos["IVA_10_5"] = _num(_search_first(
        r"IVA\s+10\.5%:\s*\$?\s*(?:\n\s*)?([\d\.,]+)", texto))

    datos["IVA_5"] = _num(_search_first(
        r"IVA\s+5%:\s*\$?\s*(?:\n\s*)?([\d\.,]+)", texto))

    datos["IVA_2_5"] = _num(_search_first(
        r"IVA\s+2\.5%:\s*\$?\s*(?:\n\s*)?([\d\.,]+)", texto))

    datos["IVA_0"] = _num(_search_first(
        r"IVA\s+0%:\s*\$?\s*(?:\n\s*)?([\d\.,]+)", texto))

    datos["Importe_Otros_Tributos"] = _num(_search_first(
        r"Importe\s+Otros\s+Tributos:\s*\$?\s*(?:\n\s*)?([\d\.,]+)", texto))

    datos["Importe_Total"] = _num(_search_first(
        r"Importe\s+Total:\s*\$?\s*(?:\n\s*)?([\d\.,]+)", texto))

    # --------- CAE y Vencimiento --------
    datos["CAE"] = _search_first(
        r"CAE\s*N°:\s*\n?\s*([0-9]+)", texto
    )
    datos["CAE_Vencimiento"] = _search_first(
        r"Fecha\s+de\s+Vto\.\s+de\s+CAE:\s*\n?\s*(\d{2}/\d{2}/\d{4})",
        texto
    )

    return datos


# ==========================
# Procesar carpeta completa
# ==========================

def procesar_carpeta_pdf(carpeta_pdf: str, salida_excel: str) -> None:
    carpeta = Path(carpeta_pdf)
    if not carpeta.exists() or not carpeta.is_dir():
        raise FileNotFoundError(
            f"La carpeta '{carpeta_pdf}' no existe o no es un directorio."
        )

    filas: List[Dict[str, str]] = []

    for ruta_pdf in carpeta.glob("*.pdf"):
        try:
            with ruta_pdf.open("rb") as f:
                pdf_bytes = f.read()

            datos = parse_factura(pdf_bytes, ruta_pdf.name)
            filas.append(datos)
            print(f"✔ Procesado: {ruta_pdf.name}")
        except Exception as e:
            print(f"⚠ Error procesando '{ruta_pdf.name}': {e}")

    if not filas:
        print("No se encontraron PDFs válidos o no se pudo extraer información.")
        return

    df = pd.DataFrame(filas)
    Path(salida_excel).parent.mkdir(parents=True, exist_ok=True)
    df.to_excel(salida_excel, index=False)
    print(f"\n✅ Excel generado: {salida_excel}")


# ==========================
# Main (ejecución por consola)
# ==========================

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Procesar facturas/NC de JULIO desde una carpeta y generar Excel."
    )
    parser.add_argument(
        "--carpeta", "-c",
        required=True,
        help="Ruta a la carpeta que contiene los PDFs"
    )
    parser.add_argument(
        "--salida", "-o",
        default="salida_julio.xlsx",
        help="Ruta del archivo Excel de salida (por defecto: salida_julio.xlsx)"
    )

    args = parser.parse_args()
    procesar_carpeta_pdf(args.carpeta, args.salida)
