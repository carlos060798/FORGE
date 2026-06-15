# Integración: vercel-deploy con sdd.implementar

Guía para integrar el skill **vercel-deploy** en el flujo de `/sdd.implementar`.

## Overview

El skill **vercel-deploy** se invoca automáticamente al final del flujo `/sdd.implementar` cuando `deploy.plataforma: vercel` está configurado.

```
/sdd.implementar
  ├─ Paso 1: Análisis & planning
  ├─ Paso 2: Desarrollo iterativo
  ├─ Paso 3: Testing
  ├─ Paso 4: Revisión de código
  └─ Paso 5: DEPLOY → [vercel-deploy skill] ← AQUÍ
                    ↓
                Gate humano: "¿Despliego en Vercel?" [sí/no/después]
                    ↓ sí
                [Ejecutar 6 pasos de deploy]
```

## Requisitos previos

### 1. Variable de entorno: VERCEL_TOKEN

El skill requiere `VERCEL_TOKEN` configurado. Dos opciones:

**Opción A: Exportar en el shell (sesión actual)**
```bash
export VERCEL_TOKEN="vercel_xxx_abc123..."
```

**Opción B: Persistente en `.env.local` (recomendado)**
```bash
echo 'VERCEL_TOKEN=vercel_xxx_abc123...' >> .env.local
```

Obtener el token:
1. Ve a https://vercel.com/account/tokens
2. Crea un nuevo token con scope **full**
3. Cópialo y guárdalo

### 2. (Opcional) VERCEL_PROJECT_ID

Si el proyecto ya existe en Vercel:
```bash
export VERCEL_PROJECT_ID="prj_xyz123..."
# O en .env.local:
echo 'VERCEL_PROJECT_ID=prj_xyz123...' >> .env.local
```

Obtener project ID:
1. Ve a https://vercel.com/dashboard
2. Abre tu proyecto
3. Ve a Settings > General
4. Copia el **Project ID**

## Configuración en sdd.implementar

En el archivo `/sdd.implementar.md` (o similar), añade:

### Sección de configuración
```yaml
---
deploy:
  plataforma: vercel        # ← Activa invocación automática del skill
  framework: auto           # ← Auto-detect (next, react, vue, astro, etc.)
  environment: production   # ← O 'staging'
---
```

### Gate humano antes de deploy
Justo antes de invocar el skill:

```markdown
## ¿Estamos listos para producción?

Checklist final:
- [ ] Tests pasando localmente
- [ ] Cambios committeados
- [ ] Sin secretos en código
- [ ] Health check en staging (opcional)

**¿Despliego en Vercel?**

[sí] → Ejecutar vercel-deploy
[no] → Saltar deploy
[después] → Recordarme luego
```

### Invocación del skill
```bash
# Automática (recomendada)
/sdd.implementar
  # ... pasos 1-4 ...
  # PASO 5: Deploy
  if [ deploy.plataforma == "vercel" ]; then
    vercel-deploy  # ← Invoca el skill
  fi

# O manual en cualquier momento:
/sdd.desplegar
/sdd.desplegar --environment staging
```

## Flujo esperado

### Ejecución exitosa
```
🚀 DESPLIEGUE A VERCEL

  ✅ Pre-checks completados
     ✓ VERCEL_TOKEN presente
     ✓ Rama limpia
     ✓ Sin secretos
     ✓ Tests verdes

  ✅ vercel.json: detectado framework nextjs

  ✅ Build local exitoso
  ✅ Deploy a Vercel enviado
     URL: https://mi-proyecto.vercel.app

  ✅ Health check: HTTP 200 OK
  
  Tu app está en vivo: https://mi-proyecto.vercel.app
  Tiempo total: 3m 42s

Próximos pasos:
  • Comparte URL: https://mi-proyecto.vercel.app
  • Ejecuta /sdd.snapshot para actualizar estado
  • Monitorea por 15 minutos
```

### Fallo y rollback automático
```
🚀 DESPLIEGUE A VERCEL

  ✅ Pre-checks completados
  ✅ Build local exitoso
  ✅ Deploy a Vercel enviado
  
  ⚠️  Health check: HTTP 502 (3 reintentos fallidos)
  
  🔄 Ejecutando rollback...
  ✅ Rollback completado — versión anterior está en vivo

❌ ACCIÓN REQUERIDA:
  • Revisa los logs en https://vercel.com/dashboard
  • Diagnostica el error (env vars, memoria, etc.)
  • Corrije y ejecuta /sdd.desplegar nuevamente
```

### Fallo en pre-checks
```
🔍 PASO 1: Pre-checks

❌ Error: VERCEL_TOKEN no configurado

Instrucciones para generar:
  1. Ve a https://vercel.com/account/tokens
  2. Crea un nuevo token con scope 'full'
  3. Guárdalo:
     export VERCEL_TOKEN='vercel_xxx_...'
     # O en .env.local:
     echo 'VERCEL_TOKEN=vercel_xxx_...' >> .env.local
```

## Ejemplo: sdd.implementar.md con vercel-deploy

```markdown
# sdd.implementar

Implementar y desplegar una feature.

---

## Configuración

deploy:
  plataforma: vercel
  framework: nextjs
  environment: production

---

## Paso 1: Análisis

...

## Paso 2: Desarrollo

...

## Paso 3: Testing

...

## Paso 4: Code Review

...

## Paso 5: Deploy

El siguiente paso despliega tu code a Vercel **solo si todo está OK**.

### ¿Estamos listos?

- [ ] Tests pasando
- [ ] Cambios committeados
- [ ] Sin secretos en código

**¿Despliego en Vercel?**

```bash
# Sí → ejecutar skill
/sdd.desplegar

# No → saltar por ahora
# Nota: Puedes desplegar manualmente luego con /sdd.desplegar
```

---

## ✨ Checklist post-deploy

- [ ] Health check verde (HTTP 200)
- [ ] Compartir URL con testers
- [ ] Monitorear por 15 minutos
- [ ] Ejecutar `/sdd.snapshot` para actualizar estado
```

## Archivos generados post-deploy

Después de un deploy exitoso, el skill crea/actualiza:

### `.sdd/estado.json`
Metadatos del último despliegue:
```json
{
  "ultimo_despliegue": {
    "timestamp": "2026-06-13T14:30:00Z",
    "url": "https://mi-proyecto.vercel.app",
    "status": "OK",
    "health_check": "200 OK",
    "framework": "nextjs"
  }
}
```

### `vercel.json` (auto-generado si no existe)
Configuración de build y output:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs"
}
```

## Troubleshooting

### Error: "VERCEL_TOKEN no configurado"

**Solución:**
```bash
export VERCEL_TOKEN="vercel_xxx_abc123..."
# O:
echo 'VERCEL_TOKEN=vercel_xxx_abc123...' >> .env.local
source .env.local
```

### Error: "Tests fallando"

**Solución:**
1. Ejecuta tests localmente: `npm test`
2. Arregla los fallos
3. Commit: `git add . && git commit -m "Fix tests"`
4. Reintenta: `/sdd.desplegar`

### Error: "Health check fallando (HTTP 502)"

**Causas posibles:**
- Aplicación tarda en iniciar (cold start)
- Variable de entorno faltante en Vercel
- Servidor no está escuchando en puerto correcto

**Solución:**
1. Revisa logs en https://vercel.com/dashboard
2. Configura env vars en Vercel si es necesario
3. Reintenta el deploy

### Error: "Cambios sin stagear"

**Solución:**
```bash
git add .
git commit -m "Descripción de cambios"
/sdd.desplegar
```

## Variables de entorno en Vercel

Si tu aplicación necesita secrets o env vars:

1. Ve a Vercel Dashboard → Settings → Environment Variables
2. Añade cada variable: `KEY=value`
3. Las variables están disponibles en build time y runtime

Ejemplo:
```
DATABASE_URL=postgres://...
API_KEY=sk_xxx_...
NODE_ENV=production
```

## Monitoreo post-deploy

Después de desplegar, el skill propone:

1. **Compartir URL** con testers y stakeholders
2. **Monitorear por 15 minutos** usando `/sdd.canary`
3. **Actualizar estado del producto** con `/sdd.snapshot`
4. **En caso de issues**: `/sdd.revertir` para rollback manual

---

Para más detalles, ver [SKILL.md](./SKILL.md).
