#!/bin/bash
# Skill: vercel-deploy
# Despliegue automático en Vercel con 6 pasos

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funciones de utilidad
log_step() {
  echo -e "${BLUE}📍 $1${NC}"
}

log_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

log_error() {
  echo -e "${RED}❌ $1${NC}"
}

log_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

# ============================================================================
# PASO 1: Pre-checks
# ============================================================================

paso_1_prechecks() {
  log_step "PASO 1: Pre-checks"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # Check 1: VERCEL_TOKEN
  if [ -z "$VERCEL_TOKEN" ]; then
    log_error "VERCEL_TOKEN no configurado"
    echo ""
    echo "Instrucciones para generar:"
    echo "  1. Ve a https://vercel.com/account/tokens"
    echo "  2. Crea un nuevo token con scope 'full'"
    echo "  3. Guárdalo:"
    echo "     export VERCEL_TOKEN='vercel_xxx_...'"
    exit 1
  fi
  log_success "VERCEL_TOKEN presente"

  # Check 2: Rama limpia
  if ! git diff-files --quiet; then
    log_error "Cambios sin stagear detectados"
    echo ""
    echo "Acción requerida:"
    echo "  git add ."
    echo "  git commit -m 'Descripción de cambios'"
    exit 1
  fi
  log_success "Rama limpia (sin cambios sin stagear)"

  # Check 3: Sin secretos
  log_warning "Escaneando por secretos en src/..."
  SECRETOS=$(grep -r "VERCEL_TOKEN\|API_KEY\|SECRET\|password" src/ 2>/dev/null || true)
  if [ ! -z "$SECRETOS" ]; then
    log_error "Secretos detectados en código:"
    echo "$SECRETOS"
    exit 1
  fi
  log_success "Sin secretos hardcodeados"

  # Check 4: Tests verdes
  log_warning "Ejecutando tests..."
  if ! npm test -- --passWithNoTests 2>/dev/null; then
    log_error "Tests fallando"
    echo ""
    echo "Acción: Ejecuta /sdd.implementar para arreglar"
    exit 1
  fi
  log_success "Tests pasando"
  echo ""
}

# ============================================================================
# PASO 2: Auto-generar vercel.json
# ============================================================================

paso_2_vercel_config() {
  log_step "PASO 2: Configurar vercel.json"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  FRAMEWORK="unknown"
  BUILD_CMD=""
  OUTPUT_DIR=""

  if [ -f package.json ]; then
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

    if [ ! -f vercel.json ]; then
      cat > vercel.json << EOF
{
  "buildCommand": "$BUILD_CMD",
  "outputDirectory": "$OUTPUT_DIR",
  "framework": "$FRAMEWORK"
}
EOF
      log_success "vercel.json creado automáticamente"
    else
      log_success "vercel.json ya existe"
    fi
  else
    log_warning "No se encontró package.json"
  fi

  echo ""
}

# ============================================================================
# PASO 3: Build y Deploy
# ============================================================================

paso_3_deploy() {
  log_step "PASO 3: Build y Deploy a Vercel"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  log_warning "Compilando localmente..."
  if ! npm run build 2>&1; then
    log_error "Build local falló"
    exit 1
  fi
  log_success "Build local exitoso"

  log_warning "Enviando a Vercel..."
  DEPLOY_OUTPUT=$(vercel deploy --prod --token="$VERCEL_TOKEN" 2>&1)
  DEPLOY_URL=$(echo "$DEPLOY_OUTPUT" | grep -oP 'https://[^\s]+' | head -1)

  if [ -z "$DEPLOY_URL" ]; then
    log_error "No se pudo obtener URL de despliegue"
    echo "Salida de Vercel:"
    echo "$DEPLOY_OUTPUT"
    exit 1
  fi

  log_success "Deploy enviado a Vercel"
  echo "   URL: $DEPLOY_URL"
  echo ""
}

# ============================================================================
# PASO 4: Health Check
# ============================================================================

paso_4_health_check() {
  log_step "PASO 4: Health Check"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  HEALTH_CHECK_PASSED=0
  MAX_RETRIES=3
  RETRY_DELAY=5

  for i in $(seq 1 $MAX_RETRIES); do
    echo "Intento $i/$MAX_RETRIES: GET $DEPLOY_URL"

    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$DEPLOY_URL" --max-time 10)

    if [ "$HTTP_CODE" = "200" ]; then
      log_success "Health check exitoso (HTTP $HTTP_CODE)"
      HEALTH_CHECK_PASSED=1
      break
    else
      log_warning "HTTP $HTTP_CODE — esperando ${RETRY_DELAY}s..."
      if [ $i -lt $MAX_RETRIES ]; then
        sleep $RETRY_DELAY
      fi
    fi
  done

  if [ $HEALTH_CHECK_PASSED -eq 0 ]; then
    log_error "Health check falló después de $MAX_RETRIES intentos"
    HEALTH_STATUS="FAILED"
  else
    HEALTH_STATUS="OK"
  fi

  echo ""
}

# ============================================================================
# PASO 5: Rollback (si es necesario)
# ============================================================================

paso_5_rollback() {
  log_step "PASO 5: Rollback (si es necesario)"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  if [ "$HEALTH_STATUS" != "OK" ]; then
    log_warning "Ejecutando rollback..."

    if vercel rollback --token="$VERCEL_TOKEN" --yes 2>&1; then
      log_success "Rollback completado"
      echo ""
      log_error "Deployment was rolled back"
      echo "  • Revisa los logs de Vercel para diagnosticar"
      echo "  • Corrije el problema y ejecuta /sdd.desplegar nuevamente"
      exit 1
    else
      log_error "Rollback falló"
      exit 1
    fi
  else
    log_success "Health check OK — sin rollback necesario"
  fi

  echo ""
}

# ============================================================================
# PASO 6: Registrar resultado
# ============================================================================

paso_6_register() {
  log_step "PASO 6: Registrar Resultado"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  mkdir -p .sdd

  TIMESTAMP=$(date -u +'%Y-%m-%dT%H:%M:%SZ')

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

  log_success "Estado registrado en .sdd/estado.json"
  echo ""
}

# ============================================================================
# Main: Ejecutar todos los pasos
# ============================================================================

main() {
  echo ""
  echo "🚀 DESPLIEGUE A VERCEL"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""

  paso_1_prechecks
  paso_2_vercel_config
  paso_3_deploy
  paso_4_health_check
  paso_5_rollback
  paso_6_register

  # Output final
  echo "✅ DESPLIEGUE COMPLETADO"
  echo ""
  echo "Tu app está en vivo:"
  echo "  🌐 $DEPLOY_URL"
  echo ""
  echo "Próximos pasos:"
  echo "  • Comparte la URL con testers"
  echo "  • Monitorea por anomalías (15 minutos)"
  echo "  • Ejecuta /sdd.snapshot para actualizar estado del producto"
  echo ""
}

main "$@"
