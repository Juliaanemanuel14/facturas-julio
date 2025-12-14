# 📋 Instrucciones Rápidas: Desglose de Facturas de Proveedores

## ⚡ Inicio Rápido (5 minutos)

### Paso 1: Instalar Dependencias
```bash
npm install
```

### Paso 2: Configurar Credenciales

Crea un archivo `.env.local` en la raíz del proyecto con:

```env
# Azure Document Intelligence
AZURE_ENDPOINT=https://tu-recurso.cognitiveservices.azure.com/
AZURE_KEY=tu_clave_azure_aqui

# Google Gemini AI
GEMINI_API_KEY=tu_api_key_gemini_aqui
GEMINI_MODEL=gemini-2.5-pro
```

### Paso 3: Ejecutar
```bash
npm run dev
```

### Paso 4: Usar
1. Abre http://localhost:3000
2. Clic en **"Desglose Facturas Proveedores"**
3. Arrastra facturas (PDF o imágenes)
4. Clic en **"Generar Excel"**
5. ¡Listo! Descarga tu Excel con los datos extraídos

---

## 🔑 Obtener Credenciales

### Azure Document Intelligence

1. Ve a [Azure Portal](https://portal.azure.com/)
2. Busca "Document Intelligence" o "Form Recognizer"
3. Crea un nuevo recurso (gratis por 30 días)
4. En "Keys and Endpoint", copia:
   - **Endpoint**: `AZURE_ENDPOINT`
   - **Key 1**: `AZURE_KEY`

**Costo**: ~$1.50 USD por 1000 páginas (nivel estándar)

### Google Gemini AI

1. Ve a [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Inicia sesión con tu cuenta Google
3. Clic en "Create API Key"
4. Copia la API Key generada: `GEMINI_API_KEY`

**Costo**: Gratis hasta 60 requests/min (Gemini 2.5 Pro)

---

## 🎯 Proveedores Soportados

| Proveedor | Campos | Detección Automática |
|-----------|--------|---------------------|
| **Coca-Cola FEMSA** | 18 | ✅ Sí |
| **Quilmes** | 21 | ✅ Sí |
| **General** | 5 base | ✅ Fallback |

### Ejemplos de Detección

- **Coca-Cola**: Detecta automáticamente si la factura contiene "COCA-COLA" o "FEMSA"
- **Quilmes**: Detecta automáticamente si contiene "QUILMES"
- **General**: Para todas las demás facturas

---

## 📊 Salida del Excel

El archivo Excel generado contiene 3 hojas:

### 1. Items
Todos los productos extraídos de todas las facturas con columnas:
- Archivo
- Proveedor
- Nro_Factura (si aplica)
- Código, Descripción, Cantidad, Precio Unitario, Subtotal
- Campos específicos según el proveedor

### 2. Resumen
Una fila por cada archivo procesado:
- Archivo
- Proveedor detectado
- Número de factura
- Items detectados
- Total de factura
- Errores (si hubo)

### 3. Estadísticas
Métricas globales:
- Total de archivos procesados
- Total de items extraídos
- Archivos con errores
- Promedio items por archivo
- Distribución por proveedor

---

## 🆘 Problemas Comunes

### "Azure credentials not configured"
**Solución**:
1. Verifica que creaste el archivo `.env.local`
2. Verifica que las credenciales de Azure son correctas
3. Reinicia el servidor (`Ctrl+C` y `npm run dev`)

### "Gemini API key not configured"
**Solución**:
1. Verifica que `GEMINI_API_KEY` está en `.env.local`
2. Verifica la API key en [Google AI Studio](https://aistudio.google.com/app/apikey)
3. Reinicia el servidor

### "No items extracted"
**Solución**:
1. Verifica que la imagen/PDF es legible
2. Usa mejor calidad de imagen
3. Asegúrate de que es una factura con tabla de productos

### Excel no descarga
**Solución**:
1. Revisa la consola del navegador (F12)
2. Verifica que el servidor esté corriendo
3. Intenta con menos archivos primero

---

## ⚙️ Configuración Avanzada

### Cambiar Modelo de Gemini

En `.env.local`:
```env
GEMINI_MODEL=gemini-2.5-flash  # Más rápido y económico
# o
GEMINI_MODEL=gemini-2.5-pro    # Mejor precisión (default)
```

### Deshabilitar Azure (solo Gemini)

Útil para pruebas o si no tienes credenciales de Azure:

En `lib/proveedoresProcessor.ts`, modifica la lógica para saltar Azure.

---

## 📞 Soporte

Si tienes problemas:

1. **Revisa los logs**: Abre la consola del navegador (F12)
2. **Verifica credenciales**: Asegúrate de que sean correctas
3. **Prueba con un archivo**: Comienza con una sola factura clara
4. **Lee la documentación completa**: Ver `DESGLOSE_PROVEEDORES_README.md`

---

## ✅ Checklist de Verificación

Antes de usar, verifica:

- [ ] `npm install` ejecutado sin errores
- [ ] Archivo `.env.local` creado
- [ ] `AZURE_ENDPOINT` configurado
- [ ] `AZURE_KEY` configurado
- [ ] `GEMINI_API_KEY` configurado
- [ ] Servidor iniciado con `npm run dev`
- [ ] Navegador abierto en http://localhost:3000
- [ ] Facturas de prueba listas (PDF o imágenes)

---

**¡Listo para procesar facturas! 🚀**
