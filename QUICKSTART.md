# Inicio Rápido

## Para empezar AHORA MISMO (3 minutos)

### 1. Instalar dependencias
```bash
npm install
```

### 2. Iniciar servidor de desarrollo
```bash
npm run dev
```

### 3. Abrir en el navegador
```
http://localhost:3000
```

## ¿Qué verás?

Una interfaz moderna con:
- 🎨 Diseño degradado violeta/azul/rosa
- 📤 Zona de drag & drop para PDFs
- ✨ Animaciones suaves
- 📊 Generación automática de Excel

## Uso

1. **Arrastra** tus PDFs de facturas a la zona marcada
2. **Revisa** la lista de archivos
3. **Haz clic** en "Generar Excel"
4. **Descarga** automáticamente el Excel procesado

## Desplegar en Internet (Vercel)

### Forma más rápida:

1. Ve a [vercel.com](https://vercel.com)
2. Conecta tu cuenta de GitHub
3. Importa este proyecto
4. Click en "Deploy"
5. ¡Listo en 2 minutos!

Consulta [DEPLOY.md](DEPLOY.md) para más detalles.

## Estructura de archivos importantes

```
📁 app/
  ├── page.tsx          → Interfaz principal (UI)
  ├── layout.tsx        → Layout general
  └── globals.css       → Estilos Tailwind

📁 lib/
  ├── pdfProcessor.ts   → Extrae datos de PDFs
  └── excelGenerator.ts → Crea archivos Excel

📁 pages/api/
  └── process-pdfs.ts   → Endpoint que procesa PDFs
```

## Comandos útiles

```bash
# Desarrollo
npm run dev

# Compilar para producción
npm run build

# Ejecutar versión de producción
npm start

# Linter
npm run lint
```

## Personalización rápida

### Cambiar colores
Edita [tailwind.config.js](tailwind.config.js):
```js
theme: {
  extend: {
    colors: {
      primary: '#6366f1',    // Azul
      secondary: '#8b5cf6',  // Violeta
      accent: '#ec4899',     // Rosa
    },
  },
}
```

### Cambiar título
Edita [app/layout.tsx](app/layout.tsx):
```tsx
export const metadata: Metadata = {
  title: 'Tu Título Aquí',
  description: 'Tu descripción aquí',
}
```

## ¿Problemas?

### No se instalan las dependencias
```bash
# Borra node_modules y reinstala
rm -rf node_modules package-lock.json
npm install
```

### Puerto 3000 ocupado
```bash
# Usa otro puerto
npm run dev -- -p 3001
```

### Error al procesar PDFs
- Verifica que los PDFs sean facturas válidas de AFIP
- Asegúrate que no estén protegidos con contraseña

---

**¡Disfruta procesando tus facturas! 🚀**
