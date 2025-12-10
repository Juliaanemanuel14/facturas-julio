# 🚀 Comandos Útiles

## Desarrollo Local

### Iniciar el servidor de desarrollo
```bash
npm run dev
```
Abre: http://localhost:3000

### Compilar para producción (probar antes de deploy)
```bash
npm run build
```

### Ejecutar versión de producción
```bash
npm start
```

### Limpiar e instalar desde cero
```bash
rm -rf node_modules package-lock.json
npm install
```

---

## Git & GitHub

### Estado actual
```bash
git status
```

### Ver cambios
```bash
git diff
```

### Agregar todos los cambios
```bash
git add .
```

### Commit
```bash
git commit -m "Tu mensaje aquí"
```

### Push al repositorio
```bash
git push
```

### Ver historial
```bash
git log --oneline -10
```

---

## Vercel

### Deploy desde CLI
```bash
# Instalar CLI (solo una vez)
npm i -g vercel

# Login (solo una vez)
vercel login

# Deploy a preview
vercel

# Deploy a producción
vercel --prod

# Ver logs en tiempo real
vercel logs --follow

# Ver información del proyecto
vercel ls
```

### Ver estado del deploy
```bash
# Últimos deploys
vercel ls

# Logs del último deploy
vercel logs
```

---

## Debugging

### Ver errores en desarrollo
```bash
npm run dev
# Abre http://localhost:3000 y revisa la consola del navegador (F12)
```

### Ver errores de compilación
```bash
npm run build
# Lee los mensajes de error en la terminal
```

### Ver errores en producción (Vercel)
1. Ve a https://vercel.com/dashboard
2. Click en tu proyecto
3. Click en "Deployments"
4. Click en el deployment con error
5. Ve a "Functions" → Click en la función → "Logs"

---

## Testing Manual

### Probar localmente antes de deploy

1. **Build de producción:**
```bash
npm run build
npm start
```

2. **Abrir en navegador:**
```
http://localhost:3000
```

3. **Probar flujo completo:**
   - Arrastra un PDF
   - Click en "Generar Excel"
   - Verifica que descargue el Excel
   - Abre el Excel y verifica los datos

### Probar en Vercel (después del deploy)

1. Abre tu URL de Vercel (ej: `https://tu-app.vercel.app`)
2. Haz el mismo flujo de prueba
3. Si hay errores, revisa los logs en Vercel Dashboard

---

## Actualizaciones

### Actualizar la aplicación después de cambios

```bash
# 1. Hacer cambios en el código
# 2. Probar localmente
npm run dev

# 3. Si funciona, compilar
npm run build

# 4. Si compila sin errores, hacer commit
git add .
git commit -m "Descripción de los cambios"

# 5. Push (Vercel redesplegará automáticamente)
git push
```

---

## Solución de Problemas

### Error: "Port 3000 already in use"
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# O simplemente usa otro puerto
npm run dev -- -p 3001
```

### Error: "Cannot find module"
```bash
npm install
```

### Error de TypeScript
```bash
# Ver todos los errores
npx tsc --noEmit

# O compilar para ver errores
npm run build
```

### Limpiar caché de Next.js
```bash
rm -rf .next
npm run build
```

### Reinstalar todo desde cero
```bash
rm -rf node_modules package-lock.json .next
npm install
npm run build
```

---

## Monitoreo

### Ver uso en Vercel
1. Ve a https://vercel.com/dashboard
2. Click en tu proyecto
3. Ve a "Analytics" para ver:
   - Número de requests
   - Tiempo de respuesta
   - Errores
   - Uso de bandwidth

### Límites del plan gratuito
- **Bandwidth:** 100 GB/mes
- **Invocations:** 100,000/mes (100k llamadas a funciones)
- **Function Duration:** 10 segundos/ejecución
- **Function Size:** 50 MB

---

## Variables de Entorno (Si las necesitas en el futuro)

### Localmente (.env.local)
```bash
# Crear archivo
touch .env.local

# Agregar variables
echo "MI_VARIABLE=valor" >> .env.local
```

### En Vercel
```bash
# Desde CLI
vercel env add MI_VARIABLE

# O desde la web:
# Dashboard → Proyecto → Settings → Environment Variables
```

---

## Backup y Seguridad

### Hacer backup del código
```bash
# El código ya está en GitHub (backup automático)
git remote -v
```

### Descargar código del repo
```bash
git clone https://github.com/TU-USUARIO/TU-REPO.git
```

---

## Comandos Todo-en-Uno

### Setup inicial completo
```bash
npm install && npm run build && npm run dev
```

### Update y deploy completo
```bash
npm run build && git add . && git commit -m "Update" && git push
```

### Limpiar y reinstalar todo
```bash
rm -rf node_modules package-lock.json .next && npm install && npm run build
```

---

## Atajos Útiles

### Abrir VS Code en la carpeta actual
```bash
code .
```

### Abrir Vercel dashboard de tu proyecto
```bash
vercel open
```

### Ver la URL de producción
```bash
vercel ls
```

---

**💡 Consejo:** Guarda este archivo como referencia rápida!
