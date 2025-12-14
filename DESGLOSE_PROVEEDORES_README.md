# Desglose de Facturas de Proveedores

## 🎯 Descripción

Sistema inteligente de extracción de datos de facturas de proveedores usando **Azure Document Intelligence** y **Google Gemini AI**. Diseñado para extraer información de facturas de manera automática con soporte para proveedores específicos.

## ✨ Características

- **Extracción Multi-Proveedor**:
  - **Coca-Cola FEMSA**: 18 campos incluyendo cálculos de impuestos y costeo
  - **Quilmes**: 21 campos con análisis completo de estructura de costos
  - **Extractor General**: Para facturas de cualquier otro proveedor usando Azure

- **Formatos Soportados**:
  - PDF (procesado con Azure Document Intelligence)
  - Imágenes: JPG, JPEG, PNG (procesadas directamente con Gemini Vision)

- **Procesamiento Inteligente**:
  - Detección automática del tipo de proveedor
  - Extracción con IA de campos específicos según el proveedor
  - Cálculos automáticos de impuestos (IVA, IIBB, Imp. Internos)
  - Normalización de productos (opcional)

- **Salida en Excel**:
  - Hoja "Items": Todos los productos extraídos
  - Hoja "Resumen": Estadísticas por archivo
  - Hoja "Estadísticas": Métricas globales del procesamiento

## 📋 Requisitos Previos

### 1. Cuenta de Azure
- Crear un recurso de **Document Intelligence** (Form Recognizer)
- Obtener:
  - `AZURE_ENDPOINT`: URL del endpoint
  - `AZURE_KEY`: Clave de acceso

[Cómo crear Azure Document Intelligence](https://learn.microsoft.com/es-es/azure/ai-services/document-intelligence/create-document-intelligence-resource)

### 2. API Key de Google Gemini
- Obtener API Key desde [Google AI Studio](https://aistudio.google.com/app/apikey)
- Guardar como `GEMINI_API_KEY`

## 🚀 Instalación

### 1. Instalar dependencias

```bash
npm install
```

Esto instalará:
- `@azure/ai-form-recognizer`: Cliente de Azure Document Intelligence
- `@google/generative-ai`: Cliente de Google Gemini AI
- Otras dependencias del proyecto

### 2. Configurar variables de entorno

Crear archivo `.env.local` en la raíz del proyecto:

```env
# Azure Document Intelligence
AZURE_ENDPOINT=https://tu-recurso.cognitiveservices.azure.com/
AZURE_KEY=tu_clave_azure_aqui

# Google Gemini AI
GEMINI_API_KEY=tu_api_key_gemini_aqui
GEMINI_MODEL=gemini-2.5-pro
```

**IMPORTANTE**: Nunca commitear el archivo `.env.local` al repositorio.

### 3. Ejecutar en desarrollo

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`

## 📖 Uso

1. Abre la aplicación en tu navegador
2. Selecciona **"Desglose Facturas Proveedores"**
3. Arrastra o selecciona tus archivos de facturas (PDF o imágenes)
4. Haz clic en **"Generar Excel"**
5. Descarga el archivo Excel generado con todos los datos extraídos

## 🏗️ Arquitectura

### Flujo de Procesamiento

```
Archivo (PDF/Imagen)
    ↓
¿Es imagen?
    ↓ Sí → Gemini Vision → JSON estructurado
    ↓ No (PDF)
    ↓
Azure OCR → Texto extraído
    ↓
Detectar proveedor
    ↓
¿Proveedor específico? (Coca-Cola/Quilmes)
    ↓ Sí → Gemini con prompt personalizado → JSON estructurado
    ↓ No
    ↓
Azure Invoice Model → Items extraídos
    ↓
Generar Excel con 3 hojas
```

### Archivos Principales

```
lib/
├── proveedoresConfig.ts         # Configuración y prompts por proveedor
├── proveedoresProcessor.ts      # Lógica de procesamiento con Azure + Gemini
└── proveedoresExcelGenerator.ts # Generación de Excel con estadísticas

pages/api/
└── process-proveedores.ts       # API endpoint para procesar facturas

app/
└── page.tsx                     # Interfaz de usuario actualizada
```

## 📊 Campos Extraídos

### Coca-Cola FEMSA (18 campos)
- Código, Descripción, Cantidad, Precio Unitario, Subtotal
- Bultos, Precio por Bulto, Descuento, % Descuento
- Neto, Impuestos Internos, IVA 21%, Total
- Neto + Imp. Internos
- IIBB CABA, IIBB RG 3337
- Total Final, Costo por Bulto

### Quilmes (21 campos)
- Número de Factura, Producto, Familia
- Bultos, Pack Size (Ps), Cantidad Total (Q)
- Precio Lista, Descuento Unitario, Total Bruto
- Descuento Global ($), Descuento %
- Neto, Impuestos Internos, % Imp. Internos
- Neto + Imp. Internos, IVA
- IIBB, Perc. IVA
- Total Final, Pack Final, Costo Unitario

### Extractor General (5 campos base)
- Código, Descripción, Cantidad, Precio Unitario, Subtotal

## 🔧 Personalización

### Agregar un Nuevo Proveedor

1. Editar `lib/proveedoresConfig.ts`:

```typescript
// Agregar tipo de proveedor
export const PROVIDER_TYPES = {
  COCA_COLA: 'cocacola',
  QUILMES: 'quilmes',
  MI_PROVEEDOR: 'miproveedor', // NUEVO
  GENERAL: 'general',
} as const;

// Agregar prompt personalizado
export const PROMPTS = {
  // ... prompts existentes
  MI_PROVEEDOR: `
Proveedor: Mi Proveedor S.A.

Objetivo: Extraer información específica...
[Definir estructura JSON esperada]
[Definir reglas de extracción]
`,
};

// Actualizar función de detección
export function detectProviderType(text: string): ProviderType {
  const lowerText = text.toLowerCase();

  if (lowerText.includes('mi proveedor')) {
    return PROVIDER_TYPES.MI_PROVEEDOR;
  }

  // ... detecciones existentes
}
```

## 🐛 Solución de Problemas

### Error: "Azure credentials not configured"
- Verifica que las variables `AZURE_ENDPOINT` y `AZURE_KEY` estén en `.env.local`
- Asegúrate de reiniciar el servidor de desarrollo después de crear el archivo

### Error: "Gemini API key not configured"
- Verifica que `GEMINI_API_KEY` esté configurada
- Verifica que la API key sea válida desde Google AI Studio

### Facturas no se procesan correctamente
- Verifica que las imágenes sean legibles y de buena calidad
- Para PDFs, asegúrate de que no estén protegidos o encriptados
- Revisa los logs de la consola para ver errores específicos

### Campos faltantes en el Excel
- Algunos campos pueden estar vacíos si la IA no detecta información
- Revisa la estructura del prompt en `proveedoresConfig.ts`
- Considera ajustar el prompt para ser más específico

## 💡 Mejores Prácticas

1. **Calidad de Imágenes**: Usa imágenes claras, bien iluminadas y enfocadas
2. **Formato de Facturas**: Facturas con formato estándar se procesan mejor
3. **Procesamiento por Lotes**: Procesa múltiples facturas del mismo proveedor juntas
4. **Validación**: Siempre verifica los datos extraídos antes de usarlos en producción
5. **Costos**: Monitorea el uso de Azure y Gemini API para controlar costos

## 📈 Roadmap

- [ ] Normalización automática de nombres de productos
- [ ] Tabla auxiliar de normalización
- [ ] Detección de duplicados
- [ ] Validación cruzada de totales
- [ ] Soporte para más proveedores
- [ ] Interfaz para revisar y corregir extracciones
- [ ] Exportación a múltiples formatos (CSV, JSON)

## 🤝 Contribuir

Para agregar soporte a un nuevo proveedor o mejorar la extracción, edita:
1. `lib/proveedoresConfig.ts` - Agrega configuración del proveedor
2. Prueba con facturas reales del proveedor
3. Ajusta el prompt según los resultados

## 📄 Licencia

Este módulo es parte del proyecto "Herramientas de Gestión y Desarrollo".

---

**Última actualización**: Diciembre 2024
