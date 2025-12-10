# Herramientas de Gestión y Desarrollo

Una aplicación web moderna para procesar facturas en PDF y generar archivos Excel organizados automáticamente.

## Características

- **Interfaz moderna y atractiva** con diseño degradado y animaciones
- **Drag & Drop** para subir múltiples archivos PDF
- **Procesamiento automático** de facturas argentinas (AFIP)
- **Generación de Excel** con datos estructurados y formateados
- **100% seguro** - procesamiento en el servidor, sin almacenamiento de datos
- **Responsive** - funciona en desktop, tablet y móvil

## Datos Extraídos

La aplicación extrae automáticamente:

- Tipo de comprobante (Factura / Nota de Crédito)
- Fecha de emisión
- Razón social y CUIT del emisor
- Razón social y CUIT del cliente
- Punto de venta y número de comprobante
- Importes (neto gravado, IVA en todas sus alícuotas, otros tributos, total)
- CAE y fecha de vencimiento

## Instalación Local

### Requisitos Previos

- Node.js 18.x o superior
- npm o yarn

### Pasos

1. Clona o descarga este repositorio

2. Instala las dependencias:

```bash
npm install
# o
yarn install
```

3. Ejecuta el servidor de desarrollo:

```bash
npm run dev
# o
yarn dev
```

4. Abre [http://localhost:3000](http://localhost:3000) en tu navegador

## Despliegue en Vercel

### Opción 1: Desde la interfaz de Vercel

1. Ve a [vercel.com](https://vercel.com) y crea una cuenta (gratis)
2. Haz clic en "Add New Project"
3. Importa tu repositorio de GitHub/GitLab/Bitbucket
4. Vercel detectará automáticamente que es un proyecto Next.js
5. Haz clic en "Deploy"
6. ¡Listo! Tu aplicación estará en línea en menos de 1 minuto

### Opción 2: Desde la línea de comandos

1. Instala Vercel CLI:

```bash
npm i -g vercel
```

2. Inicia sesión en Vercel:

```bash
vercel login
```

3. Despliega tu aplicación:

```bash
vercel
```

4. Para producción:

```bash
vercel --prod
```

## Estructura del Proyecto

```
.
├── app/
│   ├── globals.css          # Estilos globales con Tailwind CSS
│   ├── layout.tsx            # Layout principal de la aplicación
│   └── page.tsx              # Página principal con UI
├── lib/
│   ├── excelGenerator.ts     # Lógica para generar archivos Excel
│   └── pdfProcessor.ts       # Lógica para procesar PDFs y extraer datos
├── pages/
│   └── api/
│       └── process-pdfs.ts   # API endpoint para procesar PDFs
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── vercel.json              # Configuración para Vercel
```

## Tecnologías Utilizadas

- **Next.js 14** - Framework React con SSR y API Routes
- **TypeScript** - Tipado estático
- **Tailwind CSS** - Estilos utility-first
- **pdf-parse** - Extracción de texto desde PDFs
- **ExcelJS** - Generación de archivos Excel con formato
- **Vercel** - Plataforma de despliegue

## Uso

1. Abre la aplicación en tu navegador
2. Arrastra tus archivos PDF de facturas o haz clic para seleccionarlos
3. Revisa la lista de archivos seleccionados
4. Haz clic en "Generar Excel"
5. El archivo Excel se descargará automáticamente

## Script Python Original

Si prefieres usar el script Python original para procesamiento por lotes:

```bash
python julio.py --carpeta ./Facturas --salida facturas_julio.xlsx
```

## Soporte

Si encuentras algún problema o tienes sugerencias, no dudes en crear un issue o contactar al equipo de desarrollo.

## Licencia

Este proyecto es de uso privado para gestión interna.

---

**Desarrollado con** por el equipo de Herramientas de Gestión y Desarrollo
