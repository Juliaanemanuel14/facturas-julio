# 🤖 Bot ARCA - Consolidación de Comprobantes AFIP

## ✨ Nueva Funcionalidad Agregada

Tu aplicación web ahora tiene **3 opciones**:

1. **Desglose Facturas Arca** (Azul)
2. **Liquidaciones de Tarjetas** (Violeta)
3. **Bot ARCA** (Verde) - ¡NUEVO!

---

## 🎯 ¿Qué hace Bot ARCA?

Consolida automáticamente los archivos CSV descargados de AFIP (Mis Comprobantes) en un Excel organizado y estandarizado.

### Proceso Completo:

#### 1. **Descarga Local (con bot_arca.py)**
El script Python (`bot_arca.py`) hace esto **localmente en tu computadora**:
- Abre navegador (Playwright)
- Login automático en AFIP con CUIT y contraseña
- Descarga comprobantes emitidos y recibidos
- Genera archivos CSV por contribuyente

#### 2. **Consolidación Web (nueva funcionalidad)**
La aplicación web procesa los CSVs descargados:
- Subes los CSVs a la web
- Detecta automáticamente tipo (Emitido/Recibido)
- Extrae nombre del contribuyente
- Consolida todo en un Excel estandarizado

---

## 📁 Archivos Creados

### Backend
1. **`lib/arcaBotProcessor.ts`**
   - Procesa CSVs de AFIP
   - Detecta MCE (Mis Comprobantes Emitidos) vs MCR (Recibidos)
   - Extrae contribuyente del nombre de archivo
   - Estandariza columnas

2. **`lib/arcaBotExcel.ts`**
   - Genera Excel consolidado
   - Header verde (color ARCA/AFIP)
   - Columnas dinámicas según datos

3. **`pages/api/process-arca.ts`**
   - API endpoint `/api/process-arca`
   - Acepta múltiples CSVs
   - Devuelve Excel consolidado

### Frontend
4. **`app/page.tsx`** (MODIFICADO)
   - Tercera tarjeta "Bot ARCA" (verde)
   - Acepta archivos `.csv` en vez de `.pdf`
   - Texto dinámico según tipo seleccionado

---

## 🎨 Cómo Usar

### Método 1: Proceso Completo (Recomendado para uso regular)

1. **En tu computadora local:**
   ```bash
   # Ejecutar el bot Python
   python bot_arca.py
   ```
   - El bot descarga los CSVs automáticamente
   - Los guarda en la carpeta configurada

2. **En la aplicación web:**
   - Selecciona "Bot ARCA" (tarjeta verde)
   - Arrastra los CSVs descargados
   - Click en "Generar Excel"
   - Descarga el Excel consolidado

### Método 2: Solo Consolidación (Si ya tienes los CSVs)

1. Ve a la aplicación web
2. Selecciona "Bot ARCA"
3. Sube los CSVs que ya descargaste
4. Genera el Excel

---

## 📊 Formato de Datos

### Columnas Consolidadas:

| Campo | Descripción |
|-------|-------------|
| **MC** | MCE (Emitido) o MCR (Recibido) |
| **Contribuyente** | Nombre del contribuyente |
| **Fecha de Emisión** | Fecha del comprobante |
| **Tipo de Comprobante** | Factura, NC, ND, etc. |
| **Punto de Venta** | PV del comprobante |
| **Número Desde/Hasta** | Numeración |
| **CUIT Receptor/Emisor** | CUIT contraparte |
| **Nombre Receptor/Emisor** | Razón social contraparte |
| **Importe Total** | Monto total |
| **Moneda** | ARS, USD, etc. |
| **Importe Neto Gravado** | Base imponible |
| **IVA** | Total IVA |
| **CAE** | CAE del comprobante |
| ... | Y más campos según datos |

---

## ⚙️ Diferencias: Python vs Web

| Característica | bot_arca.py (Python) | Aplicación Web |
|----------------|---------------------|----------------|
| **Función** | Descarga automática | Consolidación |
| **Login AFIP** | ✅ Automático | ❌ No necesario |
| **Navegador** | ✅ Playwright | ❌ No |
| **Input** | Credenciales AFIP | CSVs descargados |
| **Output** | CSVs + Excel local | Excel web |
| **Dónde corre** | Local (tu PC) | Vercel (nube) |

### ¿Por qué está separado?

**Seguridad y Limitaciones:**
- ❌ **No puedes** ejecutar navegadores en Vercel
- ❌ **No debes** subir credenciales AFIP a internet
- ❌ Vercel tiene límite de 10 segundos por función

**Solución:**
1. Bot Python corre **local** (descarga)
2. Aplicación web **procesa** los CSVs (consolidación)

---

## 🔒 Seguridad

### Script Python (bot_arca.py)
- **Credenciales**: Guardadas en `.env` local
- **No se suben a internet**
- Solo se ejecuta en tu computadora

### Aplicación Web
- **No requiere credenciales**
- Solo procesa CSVs (datos ya públicos)
- No almacena archivos

---

## 📝 Formato de Archivo CSV Esperado

Los CSVs deben tener este formato de nombre:

```
[CONTRIBUYENTE]_[MCE/MCR]_emitido_[FECHA].csv
[CONTRIBUYENTE]_[MCE/MCR]_recibido_[FECHA].csv
```

Ejemplos:
```
JULIO SA 30718542282_mce_emitido_20241209_140000.csv
JULIO SA 30718542282_mcr_recibido_20241209_140100.csv
GRATTINADO SRL_mce_emitido_20241209_140200.csv
```

La aplicación extrae automáticamente:
- **MC**: De "emitido" → MCE, "recibido" → MCR
- **Contribuyente**: Del nombre antes de `_mce_` o `_mcr_`

---

## 🎯 Casos de Uso

### Caso 1: Múltiples Contribuyentes
```
1. Corre bot_arca.py (descarga todos)
2. Subes todos los CSVs juntos
3. Excel con columna "Contribuyente" diferenciando cada uno
```

### Caso 2: Solo un Mes
```
1. Configura PERIODO en bot_arca.py
2. Descarga CSVs del mes
3. Consolida en Excel
```

### Caso 3: Solo Consolidación Manual
```
1. Descarga CSVs manualmente desde AFIP
2. Subes a la web
3. Genera Excel
```

---

## 🚀 Deploy a Vercel

Cuando hagas push, la funcionalidad estará disponible automáticamente:

```bash
git add .
git commit -m "Agregar Bot ARCA - consolidación de CSVs AFIP"
git push
```

**Nueva URL:** `https://tu-app.vercel.app`
- Selecciona "Bot ARCA"
- Sube CSVs
- Descarga Excel

---

## ⚠️ Notas Importantes

1. **Bot Python NO corre en Vercel**
   - Solo corre en tu PC
   - Usa Playwright (navegador)

2. **Aplicación Web solo consolida**
   - No descarga de AFIP
   - Procesa CSVs ya descargados

3. **Credenciales AFIP**
   - NO las subas a Git
   - Mantén `.env` solo local
   - Ya está en `.gitignore`

4. **Formato CSV**
   - Delimiter: punto y coma (`;`)
   - Encoding: UTF-8
   - Formato AFIP estándar

---

## 🔧 Solución de Problemas

### "No se detectaron columnas"
- Verifica que sean CSVs de AFIP
- Revisa que tengan delimitador `;`

### "Error al procesar archivo"
- Asegúrate que el nombre incluya "emitido" o "recibido"
- Formato correcto: `nombre_mce/mcr_tipo_fecha.csv`

### "Excel vacío"
- Verifica que los CSVs tengan datos
- Revisa que no sean solo headers

---

**¡Tu aplicación ahora tiene 3 funcionalidades completas!** 🎉
