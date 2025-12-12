import re
import logging
import os
import time
import pandas as pd
from datetime import datetime
from pathlib import Path
from playwright.sync_api import sync_playwright

from dotenv import load_dotenv
load_dotenv()

CUIT = os.getenv("CUIT")
CLAVE = os.getenv("CLAVE")

if not CUIT or not CLAVE:
    raise ValueError("CUIT o CLAVE no definidos en .env")

CARPETA_DESCARGAS = r"c:\Users\gesti\GESTION COMPARTIDA Dropbox\Departamento Gestion\0001 - Control de Gestion (1)\Desarrollo\03- Bots\Bot Arca\Descargas"
ARCHIVO_SALIDA = "salida/comprobantes_consolidados.xlsx"

PERIODO = "Este Mes"
# opciones_validas = ["Mes Pasado", "Este Mes", "Este Año"]
# while PERIODO not in opciones_validas:
#     PERIODO = input("¿Qué período querés descargar? (Mes Pasado / Este Mes / Este Año): ").strip().title()

def esperar_y_hacer_click(page, selector, timeout=15000):
    print(f"Esperando selector: {selector}")
    page.wait_for_selector(selector, timeout=timeout)
    #print(f"Haciendo clic en: {selector}")
    page.click(selector)

def descargar_comprobantes(page, tipo, periodo):
    print(f"Esperando selector: text={tipo}")
    page.wait_for_selector(f"text={tipo}", timeout=30000)
    #print(f"Haciendo clic en: text={tipo}")
    page.click(f"text={tipo}")

    print("Esperando selector: text=Consulta")
    page.wait_for_selector("text=Consulta", timeout=15000)
    #print("Haciendo clic en: text=Consulta")
    page.click("text=Consulta")

    #print("Esperando campo de fecha: input#fechaEmision")
    page.wait_for_selector("input#fechaEmision", timeout=10000)

    print("Desplegando calendario...")
    page.click("input#fechaEmision")
    time.sleep(1)

    print(f"Seleccionando rango: {periodo}")
    page.click(f"li[data-range-key='{periodo}']")
    time.sleep(1)

    print("Esperando selector: text=Buscar")
    page.wait_for_selector("text=Buscar", timeout=10000)
    #print("Haciendo clic en: text=Buscar")
    page.click("text=Buscar")

    #print("Esperando selector: text=CSV")
    page.wait_for_selector("text=CSV", timeout=40000)

    print("Haciendo clic en: text=CSV")
    with page.expect_download(timeout=90000) as download_info:  # 90 segundos
        page.click("text=CSV")

    download = download_info.value
    download_path = os.path.join(CARPETA_DESCARGAS, download.suggested_filename)
    download.save_as(download_path)
    print(f"Descarga guardada en: {download_path}")

def login_arca(playwright):
    print("Iniciando sesión en AFIP...")
    browser = playwright.chromium.launch(headless=False, slow_mo=100)
    context = browser.new_context(
        accept_downloads=True,
    )
    page = context.new_page()
    page.goto("https://www.afip.gob.ar")

    with context.expect_page() as new_page_info:
        esperar_y_hacer_click(page, "text=Iniciar sesión")
    login_page = new_page_info.value

    esperar_y_hacer_click(login_page, 'input[name="F1:btnSiguiente"]')
    login_page.fill('input[name="F1:username"]', CUIT)
    esperar_y_hacer_click(login_page, 'input[name="F1:btnSiguiente"]')
    login_page.fill('input[name="F1:password"]', CLAVE)
    esperar_y_hacer_click(login_page, 'input[name="F1:btnIngresar"]')

    print("Accediendo a 'Mis Comprobantes'...")
    esperar_y_hacer_click(login_page, "text=Mis Comprobantes")

    return context.pages[-1], context, browser

def estandarizar_columnas(df):
    renombres = {
        "Tipo Doc. Emisor": "Tipo Doc. Emisor/ Receptor",
        "Tipo Doc. Receptor": "Tipo Doc. Emisor/ Receptor",
        "Nro. Doc. Emisor": "Nro. Doc. Emisor/ Receptor",
        "Nro. Doc. Receptor": "Nro. Doc. Emisor/ Receptor",
        "Denominación Emisor": "Denominación Emisor/ Receptor",
        "Denominación Receptor": "Denominación Emisor/ Receptor",
        "Tipo de cambio": "Tipo Cambio",
        "Imp. Neto Gravado": "Importe Neto Gravado",
        "Imp. Op. Exentas": "Importe Exento",
        "Imp. Total": "Importe Total",
        "Cotización": "Cotización",
    }

    # Renombrar si hay columnas coincidentes
    df = df.rename(columns=renombres)

    # Unificar campos Emisor/Receptor si vienen separados
    if "Tipo Doc. Emisor" in df.columns and "Tipo Doc. Receptor" in df.columns:
        df["Tipo Doc. Emisor/ Receptor"] = df["Tipo Doc. Emisor"].combine_first(df["Tipo Doc. Receptor"])
        df["Nro. Doc. Emisor/ Receptor"] = df["Nro. Doc. Emisor"].combine_first(df["Nro. Doc. Receptor"])
        df["Denominación Emisor/ Receptor"] = df["Denominación Emisor"].combine_first(df["Denominación Receptor"])

    # Asegurar columnas vacías si no existen
    columnas_faltantes = [
        "Percepciones", "Retenciones", "Conceptos no Categorizados",
        "Fecha de Recepción", "Fecha de Vencimiento", "CAE", "Vencimiento CAE"
    ]
    for col in columnas_faltantes:
        if col not in df.columns:
            df[col] = ""

    return df

def consolidar_descargas():
    archivos = list(Path(CARPETA_DESCARGAS).glob("*.csv"))
    df_final = pd.DataFrame()

    columnas_orden = [
        "MC", "Contribuyente", "Fecha de Emisión", "Tipo de Comprobante",
        "Punto de Venta", "Número Desde", "Número Hasta", "CUIT Receptor/Emisor",
        "Nombre Receptor/Emisor", "Importe Total", "Moneda", "Cotización",
        "Importe Neto Gravado", "Importe Exento", "IVA", "Percepciones", "Retenciones", "Conceptos no Categorizados",
        "Fecha de Recepción", "Fecha de Vencimiento", "CAE", "Vencimiento CAE"
    ]

    for archivo in archivos:
        try:
            # Detectar si es emitido o recibido
            archivo_name = archivo.name.lower()
            if "emitido" in archivo_name:
                mc = "MCE"
            elif "recibido" in archivo_name:
                mc = "MCR"
            else:
                mc = "DESCONOCIDO"

            # Extraer el nombre de contribuyente sin CUIT
            nombre_base = archivo.stem
            nombre_contribuyente = re.sub(r"\d{2}-?\d{8}-?\d", "", nombre_base.split(f"_{mc.lower()}_")[0]).strip()

            # Leer CSV delimitado por punto y coma
            df = pd.read_csv(archivo, sep=";", encoding="utf-8", dtype=str, engine="python", on_bad_lines='warn')
            df.columns = df.columns.str.strip()
            df = df.dropna(how='all')  # Elimina filas completamente vacías

            # Omitir columnas específicas según tipo
            if "emitido" in archivo.name.lower():
                columnas_a_omitir = ["Tipo Doc. Emisor", "Nro. Doc. Emisor", "Denominación Emisor"]
            elif "recibido" in archivo.name.lower():
                columnas_a_omitir = ["Tipo Doc. Receptor", "Nro. Doc. Receptor", "Denominación Receptor"]
            else:
                columnas_a_omitir = []

            df = df.drop(columns=[col for col in columnas_a_omitir if col in df.columns], errors='ignore')

            # Truncar columnas si se pasan de largo
            if len(df.columns) > 30:
                df = df.iloc[:, :30]
                with open("salida/log_errores.txt", "a", encoding="utf-8") as log_file:
                    log_file.write(f"{archivo.name} tenía más de 30 columnas. Se recortó a 30.\n")

            df.insert(0, "Contribuyente", nombre_contribuyente)
            df.insert(0, "MC", mc)

            df_final = pd.concat([df_final, df], ignore_index=True)

        except Exception as e:
            print(f"❌ Error al leer {archivo.name}: {e}")


    if not df_final.empty:
        # Combinar columnas Emisor/Receptor (dejan como nombre final el de Receptor)
        if "Tipo Doc. Receptor" in df_final.columns or "Tipo Doc. Emisor" in df_final.columns:
            tipo_doc_receptor = df_final.get("Tipo Doc. Receptor", pd.Series([None] * len(df_final)))
            tipo_doc_emisor = df_final.get("Tipo Doc. Emisor", pd.Series([None] * len(df_final)))
            df_final["Tipo Doc. Receptor"] = tipo_doc_receptor.combine_first(tipo_doc_emisor)

        if "Nro. Doc. Receptor" in df_final.columns or "Nro. Doc. Emisor" in df_final.columns:
            nro_doc_receptor = df_final.get("Nro. Doc. Receptor", pd.Series([None] * len(df_final)))
            nro_doc_emisor = df_final.get("Nro. Doc. Emisor", pd.Series([None] * len(df_final)))
            df_final["Nro. Doc. Receptor"] = nro_doc_receptor.combine_first(nro_doc_emisor)

        if "Denominación Receptor" in df_final.columns or "Denominación Emisor" in df_final.columns:
            denom_receptor = df_final.get("Denominación Receptor", pd.Series([None] * len(df_final)))
            denom_emisor = df_final.get("Denominación Emisor", pd.Series([None] * len(df_final)))
            df_final["Denominación Receptor"] = denom_receptor.combine_first(denom_emisor)

        # Eliminar columnas del emisor
        df_final = df_final.drop(columns=[
            "Tipo Doc. Emisor", "Nro. Doc. Emisor", "Denominación Emisor"
        ], errors="ignore")

        # Reordenar columnas según estructura esperada, conservando columnas extra si las hay
        cols_existentes = [col for col in columnas_orden if col in df_final.columns]
        cols_extra = [col for col in df_final.columns if col not in cols_existentes]
        df_final = df_final[cols_existentes + cols_extra]

        # Eliminar columnas de IVA desglosado, manteniendo solo 'Total IVA'
        columnas_iva_detalle = [
            "Imp. Neto Gravado IVA 0%",
            "IVA 2,5%", "Imp. Neto Gravado IVA 2,5%",
            "IVA 5%", "Imp. Neto Gravado IVA 5%",
            "IVA 10,5%", "Imp. Neto Gravado IVA 10,5%",
            "IVA 21%", "Imp. Neto Gravado IVA 21%",
            "IVA 27%", "Imp. Neto Gravado IVA 27%"
        ]
        df_final = df_final.drop(columns=[col for col in columnas_iva_detalle if col in df_final.columns], errors="ignore")

        # Guardar archivo
        df_final.to_excel(ARCHIVO_SALIDA, index=False)
        print(f"Archivo consolidado generado: {ARCHIVO_SALIDA}")
    else:
        print("No se encontraron archivos válidos para consolidar.")

def consolidar_crudo():
    archivos = list(Path(CARPETA_DESCARGAS).glob("*.csv"))
    df_final = pd.DataFrame()

    for archivo in archivos:
        try:
            archivo_name = archivo.name.lower()
            if "emitido" in archivo_name:
                mc = "MCE"
            elif "recibido" in archivo_name:
                mc = "MCR"
            else:
                mc = "DESCONOCIDO"

            nombre_base = archivo.stem
            nombre_contribuyente = re.sub(r"\d{2}-?\d{8}-?\d", "", nombre_base.split(f"_{mc.lower()}_")[0]).strip()

            df = pd.read_csv(archivo, sep=";", encoding="utf-8", dtype=str, engine="python", on_bad_lines='warn')
            df.columns = df.columns.str.strip()
            df = df.dropna(how='all')

            df.insert(0, "Contribuyente", nombre_contribuyente)
            df.insert(0, "MC", mc)

            etiqueta = "Emitidos" if mc == "MCE" else "Recibidos" if mc == "MCR" else "Desconocido"
            df["Etiqueta Origen"] = f"{etiqueta} {nombre_contribuyente}"

            df_final = pd.concat([df_final, df], ignore_index=True)
        except Exception as e:
            print(f"❌ Error al leer {archivo.name}: {e}")

    if not df_final.empty:
        df_final.to_excel("salida/comprobantes_crudo.xlsx", index=False)
        print("Archivo crudo generado: salida/comprobantes_crudo.xlsx")
    else:
        print("No se encontraron archivos válidos para consolidar (modo crudo).")

def limpiar_descargas():
    os.makedirs(CARPETA_DESCARGAS, exist_ok=True)
    for archivo in Path(CARPETA_DESCARGAS).glob("*"):
        try:
            archivo.unlink()
        except Exception as e:
            print(f"No se pudo eliminar {archivo.name}: {e}")

def main():
    limpiar_descargas()
    with sync_playwright() as pw:
        page, context, browser = login_arca(pw)

        print("Accediendo a 'Mis Comprobantes'...")
        #print("Esperando selector: text=Mis Comprobantes")
        page.wait_for_selector("text=Mis Comprobantes", timeout=10000)

        with context.expect_page() as nueva_pestana_info:
            #print("Haciendo clic en: text=Mis Comprobantes")
            page.click("text=Mis Comprobantes")

        page = nueva_pestana_info.value
        page.wait_for_load_state()

        print("Esperando carga de contribuyentes...")
        page.wait_for_selector("h3.text-uppercase", timeout=20000)

        h3s = page.locator("h3.text-uppercase")
        count = h3s.count()
        print("Lista visible de contribuyentes detectados:")
        for i in range(count):
            print(f"[{i}] {h3s.nth(i).inner_text()}")

        hoy = datetime.today()
        desde_fecha = (hoy.replace(day=1) - pd.DateOffset(months=1)).strftime("%d/%m/%Y")
        hasta_fecha = (hoy.replace(day=1) - pd.DateOffset(days=1)).strftime("%d/%m/%Y")

        for i in range(count):
            try:
                raw_text = h3s.nth(i).inner_text()
                nombre = raw_text.replace("\n", " ").strip()
                nombre = re.sub(r'[<>:"/\\|?*]', '_', nombre)

                print(f"Procesando: {nombre}")
                h3s.nth(i).click()

                descargar_comprobantes(page, "Emitidos", PERIODO)
                page.go_back()
                time.sleep(1)

                descargar_comprobantes(page, "Recibidos", PERIODO)
                page.go_back()
                time.sleep(1)
                page.go_back()
                time.sleep(1)

                downloads = sorted(Path(CARPETA_DESCARGAS).glob("*.zip*"), key=os.path.getmtime, reverse=True)[:2]

                if len(downloads) < 2:
                    raise Exception("No se detectaron ambos archivos descargados")

                import zipfile

                for archivo in downloads:
                    with zipfile.ZipFile(archivo, 'r') as zip_ref:
                        zip_contents = zip_ref.namelist()
                        for entry in zip_contents:
                            if entry.endswith(".csv"):
                                extracted_path = zip_ref.extract(entry, CARPETA_DESCARGAS)

                                tipo = "emitido" if "emitido" in archivo.name.lower() else "recibido"
                                base_nombre = f"{nombre}_{tipo}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                                nuevo_nombre = f"{base_nombre}.csv"
                                final_path = Path(CARPETA_DESCARGAS) / nuevo_nombre

                                contador = 1
                                while final_path.exists():
                                    nuevo_nombre = f"{base_nombre}_{contador}.csv"
                                    final_path = Path(CARPETA_DESCARGAS) / nuevo_nombre
                                    contador += 1

                                os.rename(Path(CARPETA_DESCARGAS) / entry, final_path)

                    archivo.unlink()  # Borra el ZIP original si ya no lo necesitás


            except Exception as e:
                print(f"Error procesando {nombre}: {e}")
                logging.error(f"Error al procesar {nombre}: {e}", exc_info=True)
                try:
                    page.go_back()
                except:
                    pass
                continue

        consolidar_descargas()
        context.close()
        browser.close()

if __name__ == "__main__":
    main()

# consolidar_crudo()

# consolidar_descargas()
