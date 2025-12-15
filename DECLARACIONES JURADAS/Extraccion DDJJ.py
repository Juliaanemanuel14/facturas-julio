import fitz  # PyMuPDF
import re
import os
import csv

def extraer_ddjj_iva(pdf_path):
    doc = fitz.open(pdf_path)
    texto = "\n".join([pagina.get_text("text") for pagina in doc])
    doc.close()

    # Guardar texto para depuración
    with open("debug_texto.txt", "w", encoding="utf-8") as debug_file:
        debug_file.write(texto)

    resultados = {}

    def buscar(patron, cast=None, por_defecto="0.00"):
        match = re.search(patron, texto, re.IGNORECASE)
        if match:
            try:
                valor = match.group(1).replace(',', '.')  # Solo reemplazamos coma por punto decimal
                return valor if cast is None else cast(valor)
            except:
                return por_defecto
        return por_defecto

    # Datos generales
    resultados["CUIT"] = buscar(r'CUIT Nro:\s*(\d+)', cast=str)
    resultados["Razón Social"] = buscar(r'Apellido y Nombre o Razón Social:\s*([^\n]+)', cast=str)
    resultados["Fecha de Presentación"] = buscar(r'Fecha de Presentación:\s*(\d{2}/\d{2}/\d{4})', cast=str)
    resultados["Hora"] = buscar(r'Hora:\s*(\d{2}:\d{2})', cast=str)

    # Datos impositivos
    campos = {
        "Débito Fiscal": r'Total del Débito Fiscal\s*\$\s*([\d.,]+)',
        "Crédito Fiscal": r'Total del Crédito Fiscal\s*\$\s*([\d.,]+)',
        "Ajuste Exentos ARCA": r'Ajuste Anual del crédito fiscal por operaciones exentas.?\$\s([\d.,]+)',
        "Responsable Exento": r'A favor del Responsable\s*\$\s*([\d.,]+)',
        "Reducción Art.12": r'cumplidores-Art\.12\s*\$\s*([\d.,]+)',
        "Saldo Técnico Responsable (anterior)": r'Saldo Técnico a Favor del Responsable del Período anterior\s*\$\s*([\d.,]+)',
        "Traslado de saldos": r'Saldo Técnico a favor por traslado de saldos\s*\$\s*([\d.,]+)',
        "Disminución por VPU": r'traslado de saldo a VPU\s*\$\s*([\d.,]+)',
        "Saldo Técnico Responsable (actual)": r'Saldo Técnico a Favor del Responsable del Período\s*\$\s*([\d.,]+)',
        "Saldo Técnico ARCA (Subtotal)": r'Subtotal Saldo Técnico a Favor de ARCA del Período\s*\$\s*([\d.,]+)',
        "Diferimiento 518": r'Diferimiento F\. 518\s*\$\s*([\d.,]+)',
        "Bonos Fiscales": r'Bonos Fiscales.?\$\s([\d.,]+)',
        "Saldo Técnico ARCA (completo)": r'Saldo técnico a favor de ARCA\s*\$\s*([\d.,]+)',
        "Saldo Técnico Responsable (actual 2)": r'Saldo Técnico a Favor del Responsable del Período\s*\$\s*([\d.,]+)',
        "Libre Disponibilidad (anterior)": r'disponibilidad del período anterior\s*\$\s*([\d.,]+)',
        "Monto utilizado del período": r'Total del monto utilizado del período\s*\$\s*([\d.,]+)',
        "Retenciones / Percepciones / Pagos a Cuenta": r'Total de retenciones, percepciones y pagos a cuenta computables en el período neto de restituciones\s*\$\s*([\d.,]+)',
        "Libre Disponibilidad por traslado": r'Saldo de libre disponibilidad por traslado de saldos\s*\$\s*([\d.,]+)',
        "Libre Disponibilidad Contribuyente": r'Saldo de Libre Disponibilidad a favor del contribuyente del período\s*\$\s*([\d.,]+)',
        "Saldo Impuesto a favor de ARCA": r'Saldo del Impuesto a Favor de ARCA\s*\$\s*([\d.,]+)',
    }

    for nombre, patron in campos.items():
        resultados[nombre] = buscar(patron, cast=None)

    return resultados

# Ruta de los archivos
carpeta_pdfs = r"C:\Users\gesti\OneDrive\Documentos\CODIGOS JULIAN\Comprobantes DDJJ"
archivo_csv = "ddjj_iva_extraido.csv"

# Columnas finales a exportar
campos_csv = [
    "CUIT", "Razón Social", "Fecha de Presentación", "Hora",
    "Débito Fiscal", "Crédito Fiscal", "Ajuste Exentos ARCA", "Responsable Exento",
    "Reducción Art.12", "Saldo Técnico Responsable (anterior)", "Traslado de saldos",
    "Disminución por VPU", "Saldo Técnico Responsable (actual)", "Saldo Técnico ARCA (Subtotal)",
    "Diferimiento 518", "Bonos Fiscales", "Saldo Técnico ARCA (completo)",
    "Saldo Técnico Responsable (actual 2)", "Libre Disponibilidad (anterior)",
    "Monto utilizado del período", "Retenciones / Percepciones / Pagos a Cuenta",
    "Libre Disponibilidad por traslado", "Libre Disponibilidad Contribuyente",
    "Saldo Impuesto a favor de ARCA", "Archivo PDF"
]

# Exportar CSV con BOM para que Excel muestre los acentos
with open(archivo_csv, mode='w', newline='', encoding='utf-8-sig') as f:
    writer = csv.DictWriter(f, fieldnames=campos_csv)
    writer.writeheader()

    for archivo in os.listdir(carpeta_pdfs):
        if archivo.lower().endswith(".pdf"):
            try:
                pdf_path = os.path.join(carpeta_pdfs, archivo)
                print(f"📄 Procesando: {archivo}")
                datos = extraer_ddjj_iva(pdf_path)
                datos["Archivo PDF"] = archivo
                writer.writerow(datos)
            except Exception as e:
                print(f"❌ Error al procesar {archivo}: {e}")
                fila_error = {campo: f"ERROR: {e}" for campo in campos_csv}
                fila_error["Archivo PDF"] = archivo
                writer.writerow(fila_error)

print(f"\n✅ Proceso completado. Resultados guardados en: {archivo_csv}")