import fitz  # PyMuPDF
import re
import os
import csv
from datetime import datetime
import easyocr
from PIL import Image
import difflib

# Inicializar el lector de EasyOCR (idioma inglés)
reader = easyocr.Reader(['en'], gpu=False)

def extraer_campos_verticales(pdf_path):
    doc = fitz.open(pdf_path)
    texto_completo = ""

    for pagina in doc:
        texto_completo += pagina.get_text("text") + "\n"

    resultados = {}

    def extraer_valor_debajo(campo, texto, lineas_abajo=1):
        lineas = texto.split('\n')
        for i, linea in enumerate(lineas):
            if campo in linea:
                if i + lineas_abajo < len(lineas):
                    valor = lineas[i + lineas_abajo].strip()
                    if any(x in campo for x in ['Total', 'SALDO', 'IVA', 'Ret.', 'Percep.']):
                        valor = re.sub(r'[^\d.,]', '', valor).replace('.', '').replace(',', '.')
                        try:
                            return float(valor) if '.' in valor else int(valor)
                        except:
                            return valor
                    return valor
        return "No encontrado"

    campos_verticales = {
        "FECHA DE EMISION:": 22,
        "PAGADOR:": 22,
        "Nº DE CUIT:": 22,
        "TOTAL PRESENTADO $": 29,
        "TOTAL DESCUENTO": 29,
        "SALDO $": 29
    }

    for campo, lineas_abajo in campos_verticales.items():
        resultados[campo] = extraer_valor_debajo(campo, texto_completo, lineas_abajo)

    resultados["Razón Social"] = extraer_valor_debajo("Razón Social", texto_completo, 1)
    resultados["Establecimiento"] = extraer_valor_debajo("Establecimiento", texto_completo, 1)

    def extraer_valor_monetario(patron, texto):
        match = re.search(patron, texto)
        if match:
            valor = match.group(1).replace('.', '').replace(',', '.')
            try:
                return float(valor)
            except:
                return match.group(1).strip()
        return "No encontrado"

    resultados["IVA 21.00%"] = extraer_valor_monetario(r'IVA\s*21,?00\s*%?\s*\$\s*([\d.,]+)', texto_completo)
    resultados["Ret.IB CAP. FED."] = extraer_valor_monetario(r'Ret.IB CAP.FED.\s*[\d.,]+\s*%?\s*\$\s*([\d.,]+)', texto_completo)
    resultados["Percep. AFIP"] = extraer_valor_monetario(r'Percep./Retenc.AFIP\s*[-]?\s*DGI\s*\$\s*([\d.,]+)', texto_completo)

    # OCR con EasyOCR en zona del logo
    try:
        primera_pagina = doc[0]
        rect = fitz.Rect(10, 10, 250, 120)  # zona del logo
        pix = primera_pagina.get_pixmap(clip=rect, dpi=300)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)

        # Guardar temporalmente la imagen
        temp_path = "temp_logo.png"
        img.save(temp_path)

        # OCR con EasyOCR
        texto_detectado = reader.readtext(temp_path, detail=0)
        os.remove(temp_path)

        texto_unido = " ".join(texto_detectado).strip().upper()

        marcas = ["VISA", "CABAL", "AMERICAN EXPRESS", "MASTERCARD"]
        similitudes = difflib.get_close_matches(texto_unido, marcas, n=1, cutoff=0.5)

        resultados["Logo VISA"] = similitudes[0] if similitudes else "No reconocido"
        resultados["Texto OCR Bruto"] = texto_unido
    except Exception as e:
        print(f"⚠️ Error con EasyOCR en {pdf_path}: {e}")
        resultados["Logo VISA"] = "Error"
        resultados["Texto OCR Bruto"] = "Error"
    finally:
        doc.close()

    mapeo_nombres = {
        "FECHA DE EMISION:": "FECHA DE EMISION",
        "PAGADOR:": "PAGADOR",
        "Nº DE CUIT:": "Nº DE CUIT",
        "TOTAL DESCUENTO": "Total Descuento",
        "SALDO $": "Saldo",
        "TOTAL PRESENTADO $": "Total Presentado",
        "IVA 21.00%": "IVA",
        "Ret.IB CAP. FED.": "Retención IB",
        "Percep. AFIP": "Percepción AFIP"
    }

    return {mapeo_nombres.get(k, k): v for k, v in resultados.items()}

# Ruta a la carpeta de PDFs
carpeta_pdfs = r"C:\Users\gesti\OneDrive\Escritorio\Liquidaciones 062025"
archivo_csv = "resultados_extracionn.csv"

campos_csv = [
    "FECHA DE EMISION",
    "PAGADOR",
    "Nº DE CUIT",
    "Razón Social",
    "Establecimiento",
    "Total Presentado",
    "Total Descuento",
    "Saldo",
    "IVA",
    "Retención IB",
    "Percepción AFIP",
    "Logo VISA",
    "Texto OCR Bruto",
    "Archivo PDF"
]

with open(archivo_csv, mode='w', newline='', encoding='utf-8') as csv_file:
    writer = csv.DictWriter(csv_file, fieldnames=campos_csv)
    writer.writeheader()

    for archivo in os.listdir(carpeta_pdfs):
        if archivo.lower().endswith('.pdf'):
            try:
                pdf_path = os.path.join(carpeta_pdfs, archivo)
                print(f"Procesando: {archivo}")

                datos = extraer_campos_verticales(pdf_path)
                datos["Archivo PDF"] = archivo

                writer.writerow(datos)

            except Exception as e:
                print(f"❌ Error al procesar {archivo}: {str(e)}")
                fila_error = {campo: f"ERROR: {str(e)}" for campo in campos_csv}
                fila_error["Archivo PDF"] = archivo
                writer.writerow(fila_error)

print(f"\n✅ Proceso completado. Resultados guardados en: {archivo_csv}")
