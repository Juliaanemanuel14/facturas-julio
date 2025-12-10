# Guía Rápida de Despliegue en Vercel

## Pasos para Desplegar

### 1. Preparar el Proyecto

Asegúrate de tener todos los archivos listos:
- ✅ Código fuente completo
- ✅ package.json con todas las dependencias
- ✅ vercel.json configurado

### 2. Crear Repositorio Git

Si aún no tienes un repositorio:

```bash
git init
git add .
git commit -m "Initial commit: Herramientas de Gestión y Desarrollo"
```

### 3. Subir a GitHub (Recomendado)

1. Crea un repositorio nuevo en GitHub
2. Conecta tu repositorio local:

```bash
git remote add origin https://github.com/TU-USUARIO/TU-REPOSITORIO.git
git branch -M main
git push -u origin main
```

### 4. Desplegar en Vercel

#### Opción A: Desde el navegador (Más fácil)

1. Ve a [https://vercel.com/signup](https://vercel.com/signup)
2. Regístrate con tu cuenta de GitHub
3. Haz clic en "Add New Project"
4. Selecciona el repositorio que acabas de crear
5. Vercel detectará automáticamente Next.js
6. Haz clic en "Deploy"
7. Espera 1-2 minutos
8. ¡Tu aplicación estará lista! Recibirás una URL como: `https://tu-proyecto.vercel.app`

#### Opción B: Desde la terminal

```bash
# Instalar Vercel CLI
npm i -g vercel

# Login
vercel login

# Desplegar
vercel

# Para producción
vercel --prod
```

### 5. Configuración Post-Despliegue

Una vez desplegado, tu aplicación estará disponible en una URL como:
- `https://herramientas-gestion.vercel.app`

## Variables de Entorno (Opcional)

Si necesitas configurar variables de entorno:

1. Ve a tu proyecto en Vercel
2. Settings → Environment Variables
3. Agrega las variables necesarias
4. Redespliega si es necesario

## Dominio Personalizado (Opcional)

Para usar tu propio dominio:

1. Ve a Settings → Domains en Vercel
2. Agrega tu dominio
3. Configura los DNS según las instrucciones
4. Espera la propagación (puede tomar hasta 48 horas)

## Actualizaciones

Para actualizar tu aplicación:

```bash
# Hacer cambios en tu código
git add .
git commit -m "Descripción de los cambios"
git push

# Vercel desplegará automáticamente los cambios
```

## Límites del Plan Gratuito de Vercel

- ✅ 100 GB de ancho de banda por mes
- ✅ Despliegues ilimitados
- ✅ HTTPS automático
- ✅ CDN global
- ✅ Funciones serverless

## Solución de Problemas

### Error: "Module not found"
```bash
# Verifica que todas las dependencias estén en package.json
npm install
```

### Error: "Build failed"
```bash
# Verifica que el build funcione localmente
npm run build
```

### Error de límite de tamaño
- El plan gratuito tiene límite de 50MB por función serverless
- Los PDFs se procesan en memoria, no se almacenan

## Soporte

Si tienes problemas:
1. Revisa los logs en Vercel Dashboard
2. Consulta la documentación de Next.js
3. Verifica que todas las dependencias estén instaladas

---

¡Tu aplicación debería estar funcionando perfectamente en Vercel!
