---
name: vercel-deploy
description: Despliega automáticamente a Vercel. Pre-checks, build, health checks, rollback si falla.
tools: ["Bash"]
---

# Skill: Despliegue Automático en Vercel

## Propósito

Cerrar el ciclo idea→producción sin salir del flujo. Diferenciador vs Bolt/v0: verificación independiente PRE-deploy, no post-deploy.

Ejecución **sincrónica bloqueante**: el usuario ve al instante si funcionó o no.

---

## Entrada requerida

- **`VERCEL_TOKEN`** (variable de entorno) — token de autenticación
- **`VERCEL_PROJECT_ID`** (variable de entorno, opcional) — si el proyecto ya existe en Vercel
- **`deploy.framework`** (detectado automáticamente: nextjs, react, vue, astro, flask, fastapi, etc.)

---

## Flujo de 6 pasos

### PASO 1: Pre-checks (bloquea si alguno falla)

Validaciones preliminares que impiden proseguir con deploy si hay problemas:

```bash
#!/bin/bash
set -e  # Detener en cualquier error

echo "🔍 PASO 1: Pre-checks"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check 1: VERCEL_TOKEN presente
if [ -z "$VERCEL_TOKEN" ]; then
  echo "❌ Error: VERCEL_TOKEN no configurado"
  echo ""
  echo "Instrucciones para generar:"
  echo "  1. Ve a https://vercel.com/account/tokens"
  echo "  2. Crea un nuevo token con scope 'full'"
  echo "  3. Guárdalo:"
  echo "     export VERCEL_TOKEN='xxx_tu_token_aqui_xxx'"
  echo "     # O en .env:"
  echo "     echo 'VERCEL_TOKEN=xxx_tu_token_aqui_xxx' >> .env.local"
  exit 1
fi
echo "✅ VERCEL_TOKEN presente"

# Check 2: Rama limpia (sin cambios sin stagear)
if ! git diff-files --quiet; then
  echo "❌ Error: Cambios sin stagear detectados"
  echo ""
  echo "Acción requerida:"
  echo "  git add ."
  echo "  git commit -m 'descripción de cambios'"
  exit 1
fi
echo "✅ Rama limpia (sin cambios sin stagear)"

# Check 3: Sin secretos en código
echo "🔐 Escaneando por secretos en src/..."
SECRETOS=$(grep -r "VERCEL_TOKEN\|API_KEY\|SECRET" src/ 2>/dev/null || true)
if [ ! -z "$SECRETOS" ]; then
  echo "❌ Error: Secretos detectados en código:"
  echo "$SECRETOS"
  echo ""
  echo "Acción: Mueve secretos a .env.local o variables de entorno en Vercel"
  exit 1
fi
echo "✅ Sin secretos hardcodeados en src/"

# Check 4: Tests verdes
echo "🧪 Ejecutando tests..."
if ! npm test -- --passWithNoTests 2>/dev/null; then
  echo "❌ Error: Tests fallando"
  echo ""
  echo "Acción: Ejecuta `/sdd.implementar` nuevamente para arreglar issues"
  exit 1
fi
echo "✅ Tests pasando"

echo ""
```

---

### PASO 2: Auto-generar vercel.json si no existe

Detección automática del framework e inyección de configuración mínima válida:

```bash
echo "⚙️  PASO 2: Configurar vercel.json"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Detectar framework leyendo package.json
if [ -f package.json ]; then
  FRAMEWORK="unknown"
  
  if grep -q '"next"' package.json; then
    FRAMEWORK="nextjs"
    BUILD_CMD="npm run build"
    OUTPUT_DIR=".next"
  elif grep -q '"react"' package.json && ! grep -q '"next"' package.json; then
    FRAMEWORK="react"
    BUILD_CMD="npm run build"
    OUTPUT_DIR="build"
  elif grep -q '"vue"' package.json; then
    FRAMEWORK="vue"
    BUILD_CMD="npm run build"
    OUTPUT_DIR="dist"
  elif grep -q '"astro"' package.json; then
    FRAMEWORK="astro"
    BUILD_CMD="npm run build"
    OUTPUT_DIR="dist"
  elif grep -q '"fastapi\|flask"' package.json; then
    FRAMEWORK="python"
    BUILD_CMD="pip install -r requirements.txt"
    OUTPUT_DIR="."
  fi
  
  echo "📦 Framework detectado: $FRAMEWORK"
  
  # Si vercel.json no existe, crearlo
  if [ ! -f vercel.json ]; then
    echo "Generando vercel.json..."
    cat > vercel.json << EOF
{
  "buildCommand": "$BUILD_CMD",
  "outputDirectory": "$OUTPUT_DIR",
  "framework": "$FRAMEWORK"
}
EOF
    echo "✅ vercel.json creado automáticamente"
  else
    echo "✅ vercel.json ya existe"
  fi
else
  echo "⚠️  No se encontró package.json"
fi

echo ""
```

---

### PASO 3: Build y Deploy a Vercel (bloqueante)

Ejecución del build local y envío a Vercel:

```bash
echo "🚀 PASO 3: Deploy a Vercel"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Ejecutar build local
echo "🔨 Compilando localmente..."
if ! npm run build 2>&1; then
  echo "❌ Error: Build local falló"
  echo ""
  echo "Acción: Revisa los errores arriba y ejecuta `/sdd.implementar`"
  exit 1
fi
echo "✅ Build local exitoso"

# Deploy a Vercel
echo "📤 Enviando a Vercel..."
DEPLOY_OUTPUT=$(vercel deploy --prod --token="$VERCEL_TOKEN" 2>&1)
DEPLOY_URL=$(echo "$DEPLOY_OUTPUT" | grep -oP 'https://[^\s]+' | head -1)

if [ -z "$DEPLOY_URL" ]; then
  echo "❌ Error: No se pudo obtener URL de despliegue"
  echo "Salida de Vercel:"
  echo "$DEPLOY_OUTPUT"
  exit 1
fi

echo "✅ Deploy enviado a Vercel"
echo "   URL: $DEPLOY_URL"

echo ""
```

---

### PASO 4: Health Check (retry con backoff)

Validación de que la URL está respondiendo correctamente:

```bash
echo "🏥 PASO 4: Health Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

HEALTH_CHECK_PASSED=0
MAX_RETRIES=3
RETRY_DELAY=5

for i in $(seq 1 $MAX_RETRIES); do
  echo "Intento $i/$MAX_RETRIES: GET $DEPLOY_URL"
  
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$DEPLOY_URL" --max-time 10)
  
  if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Health check exitoso (HTTP $HTTP_CODE)"
    HEALTH_CHECK_PASSED=1
    break
  else
    echo "⚠️  HTTP $HTTP_CODE — esperando ${RETRY_DELAY}s antes de reintentar..."
    if [ $i -lt $MAX_RETRIES ]; then
      sleep $RETRY_DELAY
    fi
  fi
done

if [ $HEALTH_CHECK_PASSED -eq 0 ]; then
  echo "❌ Health check falló después de $MAX_RETRIES intentos"
  HEALTH_STATUS="FAILED"
else
  HEALTH_STATUS="OK"
fi

echo ""
```

---

### PASO 5: Rollback automático si health check falla

Reversión al despliegue anterior si la app no responde:

```bash
echo "⏮️  PASO 5: Rollback (si es necesario)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$HEALTH_STATUS" != "OK" ]; then
  echo "🔄 Ejecutando rollback..."
  
  if vercel rollback --token="$VERCEL_TOKEN" --yes 2>&1; then
    echo "✅ Rollback completado — versión anterior está en vivo"
    echo ""
    echo "⚠️  ACCIÓN REQUERIDA:"
    echo "  • Revisa los logs de Vercel para diagnosticar el error"
    echo "  • Corrije el problema y ejecuta /sdd.desplegar nuevamente"
  else
    echo "❌ Rollback falló — contacta al equipo de DevOps"
    exit 1
  fi
else
  echo "✅ Health check OK — sin rollback necesario"
fi

echo ""
```

---

### PASO 6: Registrar resultado

Guardar metadatos del despliegue para auditoría y monitoring:

```bash
echo "📊 PASO 6: Registrar Resultado"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Crear directorio .sdd si no existe
mkdir -p .sdd

# Generar timestamp ISO 8601
TIMESTAMP=$(date -u +'%Y-%m-%dT%H:%M:%SZ')

# Escribir a estado.json
cat > .sdd/estado.json << EOF
{
  "ultimo_despliegue": {
    "timestamp": "$TIMESTAMP",
    "url": "$DEPLOY_URL",
    "status": "$([ "$HEALTH_STATUS" = "OK" ] && echo "OK" || echo "ROLLED_BACK")",
    "health_check": "$([ "$HEALTH_CHECK_PASSED" -eq 1 ] && echo "200 OK" || echo "FAILED")",
    "framework": "$FRAMEWORK"
  }
}
EOF

echo "✅ Estado registrado en .sdd/estado.json"
echo ""
```

---

## Output final para el usuario

Una vez completados todos los pasos exitosamente:

```
🚀 DESPLIEGUE A VERCEL — COMPLETADO

  ✅ Pre-checks completados
  ✅ Build exitoso
  ✅ Vercel deployment: https://mi-proyecto.vercel.app
  ✅ Health check: HTTP 200
  
  Tu app está en vivo: https://mi-proyecto.vercel.app
  Timestamp: 2026-06-13T14:30:00Z
  Tiempo total: 3m 42s

Próximos pasos:
  • Comparte la URL con testers y stakeholders
  • Monitorea por anomalías en los próximos 15 minutos
  • Ejecuta /sdd.snapshot para actualizar el estado del producto
  • En caso de issues, /sdd.revertir ejecutará rollback manual
```

---

## Manejo de errores

| Error | Causa probable | Acción |
|-------|-----------------|--------|
| `VERCEL_TOKEN` ausente | No configurado en env | Mostrar instrucciones de generación (ver PASO 1) |
| Tests fallando | Código tiene issues | Usuario debe ejecutar `/sdd.implementar` nuevamente |
| Health check 502/503 | Cold start, env var faltante, o timeout | Reintenta 3 veces; si persiste, rollback automático |
| Build local falla | Dependencias rotas o código inválido | Usuario debe revisar errores y corregir |
| Cambios sin stagear | Usuario modificó código manualmente | Error: "Ejecuta `git add . && git commit` primero" |
| Rollback falla | Problemas con Vercel API | Contactar equipo de DevOps; escalar al SRE |

---

## Cuándo se invoca

1. **Automáticamente** en el PASO final de `sdd.implementar.md` si `deploy.plataforma: vercel` está configurado
   - Con gate humano ANTES de ejecutar: "¿Despliego en Vercel?" [sí/no/después]

2. **Manualmente** ejecutando:
   ```bash
   /sdd.desplegar
   ```

3. **Con promoción de entorno**:
   ```bash
   /sdd.desplegar --environment staging
   # o
   /sdd.desplegar --environment production
   ```

---

## Notas de implementación

- **Atomicidad**: O todo se despliega y pasa health check, o se revierte. Sin estados intermedios.
- **Idempotencia**: Ejecutar dos veces seguidas produce el mismo resultado (si no hay cambios de código).
- **Observabilidad**: Cada run deja trazas en `.sdd/estado.json` para auditoría y debugging.
- **Seguridad**: VERCEL_TOKEN nunca se loguea; los secretos se detectan antes de deploy.
- **UX**: Output visual con emojis, colores, y pasos claramente numerados.

