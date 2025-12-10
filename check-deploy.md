# ✅ Checklist Pre-Deploy

Usa esta guía para verificar que todo está listo antes de deployar:

## 1. Archivos Necesarios

- [x] `package.json` - Con todas las dependencias
- [x] `next.config.js` - Configuración limpia
- [x] `vercel.json` - Configuración simplificada
- [x] `tsconfig.json` - Configuración TypeScript
- [x] `.gitignore` - Para no subir node_modules

## 2. Estructura de Carpetas

```
✅ app/
   ✅ page.tsx
   ✅ layout.tsx
   ✅ globals.css

✅ lib/
   ✅ pdfProcessor.ts
   ✅ excelGenerator.ts

✅ pages/api/
   ✅ process-pdfs.ts
```

## 3. Verificación Local

Ejecuta estos comandos para verificar:

```bash
# 1. Instalar dependencias (si no lo hiciste)
npm install

# 2. Verificar que compile sin errores
npm run build

# 3. Si el build es exitoso, estás listo!
```

### Salida Esperada del Build:

```
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Collecting page data
✓ Generating static pages
✓ Finalizing page optimization

Route (app)                              Size     First Load JS
┌ ○ /                                    XXX kB        XXX kB
└ ○ /api/process-pdfs                    XXX kB        XXX kB

○  (Static)  prerendered as static content
```

## 4. Git y GitHub

```bash
# Verificar cambios
git status

# Agregar todos los archivos
git add .

# Commit
git commit -m "Fix: Configuración actualizada para Vercel"

# Push (si ya tienes un repo remoto)
git push

# Si es la primera vez:
git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
git branch -M main
git push -u origin main
```

## 5. Deploy en Vercel

### Opción A: Desde la Web (Recomendado)

1. Ve a https://vercel.com
2. Click en "Add New Project"
3. Selecciona tu repositorio de GitHub
4. Vercel detectará automáticamente Next.js
5. Click en "Deploy"
6. Espera 2-3 minutos

### Opción B: Desde CLI

```bash
# Instalar CLI (solo una vez)
npm i -g vercel

# Login (solo una vez)
vercel login

# Deploy
vercel --prod
```

## 6. Verificar que Funciona

Una vez desplegado:

1. Abre la URL que te dio Vercel (ej: `https://tu-app.vercel.app`)
2. Arrastra un PDF de prueba
3. Click en "Generar Excel"
4. Verifica que se descargue el Excel

## Problemas Comunes y Soluciones

### ❌ Error: "Module not found"

```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

### ❌ Error: "Build failed"

Revisa el log de Vercel. Usualmente es:
- Falta una dependencia en package.json
- Error de TypeScript (verifica con `npm run build`)

### ❌ Error 500 al subir PDFs

- Verifica que los PDFs no sean muy grandes (máx 50MB c/u)
- Revisa los logs en Vercel Dashboard
- Asegúrate que sean PDFs válidos de facturas

### ❌ El Excel no se descarga

- Revisa la consola del navegador (F12)
- Verifica que la API responda correctamente
- Prueba con menos PDFs primero (1-2)

## Estado de los Cambios

✅ **vercel.json** - Simplificado y corregido
✅ **next.config.js** - Limpiado
✅ **process-pdfs.ts** - Actualizado con mejor manejo de errores
✅ **Todo listo para deploy**

---

## Comando Rápido (Todo en Uno)

Si todo está listo:

```bash
npm install && npm run build && git add . && git commit -m "Ready for Vercel" && git push
```

Luego ve a Vercel y conecta tu repo.

---

**¡Tu app está lista para desplegarse! 🚀**
