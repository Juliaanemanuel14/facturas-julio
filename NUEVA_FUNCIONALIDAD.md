# ✨ Nueva Funcionalidad: Dos Opciones de Procesamiento

## 🎉 Lo que se agregó

Tu aplicación web ahora tiene **dos opciones separadas**:

### 1. **Desglose Facturas Arca** (Original)
- Procesa facturas y notas de crédito AFIP
- Extrae: Tipo comprobante, fecha, razón social, CUIT, importes, IVA, CAE
- Genera: `facturas_procesadas.xlsx`

### 2. **Liquidaciones de Tarjetas** (NUEVO)
- Procesa liquidaciones de VISA, Mastercard, Cabal, American Express
- Extrae: Fecha emisión, pagador, establecimiento, totales, descuentos, IVA, retenciones
- Genera: `liquidaciones_tarjetas.xlsx`

---

## 📁 Archivos Nuevos Creados

### Backend (Procesamiento)
1. **`lib/cardLiquidationProcessor.ts`**
   - Procesador de PDFs de liquidaciones de tarjetas
   - Extrae 13 campos de datos
   - Detecta automáticamente la marca de tarjeta (VISA, Mastercard, etc.)

2. **`lib/cardLiquidationExcel.ts`**
   - Generador de Excel para liquidaciones
   - Formato con header violeta (para diferenciar de facturas)
   - Columnas organizadas y con ancho óptimo

3. **`pages/api/process-liquidations.ts`**
   - API endpoint para procesar liquidaciones
   - Maneja múltiples PDFs
   - Devuelve Excel listo para descargar

### Frontend (Interfaz)
4. **`app/page.tsx`** (MODIFICADO)
   - Nueva pantalla de selección con 2 opciones
   - Botón "Volver a opciones" para cambiar entre modos
   - Iconos y colores diferentes para cada opción
   - Procesamiento dinámico según el tipo seleccionado

---

## 🎨 Flujo de Usuario

### Paso 1: Página Principal
El usuario ve dos tarjetas grandes:
- **Azul** → Desglose Facturas Arca (icono de documento)
- **Violeta** → Liquidaciones de Tarjetas (icono de tarjeta)

### Paso 2: Selección
Al hacer click en una opción:
- Se muestra el título seleccionado
- Aparece botón "← Volver a opciones"
- Se mantiene la zona de drag & drop
- Se puede subir PDFs

### Paso 3: Procesamiento
- Sube los PDFs
- La app detecta qué tipo seleccionaste
- Procesa con el procesador correspondiente
- Descarga el Excel con el nombre correcto

---

## 🔍 Datos Extraídos por Liquidaciones

| Campo | Descripción |
|-------|-------------|
| **Archivo PDF** | Nombre del archivo |
| **Fecha de Emisión** | Fecha del documento |
| **Pagador** | Quien paga |
| **Nº de CUIT** | CUIT del pagador |
| **Razón Social** | Nombre de la empresa |
| **Establecimiento** | Establecimiento comercial |
| **Total Presentado** | Monto total presentado |
| **Total Descuento** | Descuentos aplicados |
| **Saldo** | Monto final a cobrar |
| **IVA** | IVA 21% |
| **Retención IB** | Retención de Ingresos Brutos |
| **Percepción AFIP** | Percepción AFIP/DGI |
| **Marca Tarjeta** | VISA, Mastercard, Cabal, Amex |

---

## 🎨 Diferencias Visuales

### Facturas Arca
- Color: **Azul** (#6366f1)
- Icono: Documento
- Excel header: Azul

### Liquidaciones
- Color: **Violeta** (#8b5cf6)
- Icono: Tarjeta de crédito
- Excel header: Violeta

---

## 📝 Prueba Local

Antes de hacer push, puedes probar localmente:

```bash
npm run dev
```

Luego abre http://localhost:3000 y verás:
1. Dos opciones en la página principal
2. Click en cualquiera
3. Sube PDFs de prueba
4. Descarga el Excel

---

## 🚀 Deploy a Vercel

Cuando estés listo:

```bash
git add .
git commit -m "Agregar funcionalidad de liquidaciones de tarjetas"
git push
```

Vercel desplegará automáticamente la nueva versión.

---

## 🔄 Comparación con Script Python

| Característica | Python (Liquitarjetasnuevo.py) | Web App |
|----------------|-------------------------------|---------|
| **OCR** | ✅ EasyOCR para detectar logo | ❌ Detecta por texto |
| **Detección Marca** | Por imagen | Por keywords en texto |
| **Interface** | CLI | Web moderna |
| **Salida** | CSV | Excel formateado |

**Nota:** La versión web NO usa OCR (EasyOCR) porque:
- Requiere librerías pesadas (~500MB)
- Vercel tiene límite de 50MB por función
- La detección por texto funciona bien en la mayoría de casos

Si necesitas OCR en el futuro, podemos:
1. Usar un servicio externo (Google Vision API, AWS Textract)
2. Mejorar los patrones de búsqueda de texto

---

## ✅ Checklist de Testing

Antes de usar en producción, prueba:

- [ ] Subir 1 PDF de factura → Descarga Excel facturas
- [ ] Subir múltiples PDFs de facturas → Funciona correctamente
- [ ] Cambiar a liquidaciones → Botón "Volver" funciona
- [ ] Subir 1 PDF de liquidación → Descarga Excel liquidaciones
- [ ] Subir múltiples PDFs de liquidaciones → Funciona
- [ ] Volver a inicio → Se resetea todo
- [ ] Probar en móvil → Responsive funciona

---

## 🎯 Siguiente Paso

**Hacer commit y push:**

```bash
git add .
git commit -m "Agregar procesamiento de liquidaciones de tarjetas

- Nuevo procesador para liquidaciones VISA/Mastercard/Cabal
- Nueva API endpoint /api/process-liquidations
- Interfaz con dos opciones: Facturas y Liquidaciones
- Detección automática de marca de tarjeta
- Excel con formato diferenciado"

git push
```

---

**¡Tu aplicación ahora tiene dos funcionalidades completas! 🎉**
