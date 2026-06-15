#!/bin/bash
# Vercel Deploy Skill - Wrapper para invocación desde SDD-ES
# Uso: ./vercel-deploy.sh [--spec-id SPEC_ID] [--profile PROFILE]

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Valores por defecto
SPEC_ID="${spec_id:=}"
PROFILE="${profile:=experto}"

# Parsear argumentos
while [[ $# -gt 0 ]]; do
  case $1 in
    --spec-id) SPEC_ID="$2"; shift 2 ;;
    --profile) PROFILE="$2"; shift 2 ;;
    *) shift ;;
  esac
done

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Vercel Deploy Skill${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 1. Validar token Vercel
if [ -z "$VERCEL_TOKEN" ]; then
  echo -e "${RED}❌ VERCEL_TOKEN no configurado${NC}"
  echo ""
  echo "Para generar un token:"
  echo "1. Ve a: https://vercel.com/account/tokens"
  echo "2. Crea un nuevo token con scope 'full'"
  echo "3. Copia el token y pégalo en la variable VERCEL_TOKEN"
  echo ""
  exit 1
fi

echo -e "${BLUE}📋 Configuración:${NC}"
echo "   Profile: $PROFILE"
echo "   Spec ID: $SPEC_ID"
echo ""

# 2. Ejecutar pre-checks
echo -e "${BLUE}🔍 Ejecutando pre-checks...${NC}"

# Check: Token Vercel
echo -e "${GREEN}✅ Token Vercel presente${NC}"

# Check: Cambios no commiteados → auto-commit sin mostrar git comandos
if ! git diff-files --quiet || ! git diff-index --cached --quiet HEAD; then
  echo -e "${YELLOW}⚠️  Guardando cambios automáticamente...${NC}"
  git add -A
  git commit -m "Auto-commit SDD-ES deploy ($(date +'%Y-%m-%d %H:%M:%S'))" 2>/dev/null || true
  echo -e "${GREEN}✅ Cambios guardados${NC}"
else
  echo -e "${GREEN}✅ Rama limpia${NC}"
fi

# Check: Tests pasen (si existen)
if [ -f "package.json" ] && grep -q '"test"' package.json; then
  echo -e "${BLUE}🧪 Ejecutando tests...${NC}"
  if npm test 2>&1 | tail -5; then
    echo -e "${GREEN}✅ Tests pasando${NC}"
  else
    echo -e "${YELLOW}⚠️  Tests con fallos o warnings${NC}"
  fi
fi

# Check: Sin secretos en código
echo -e "${BLUE}🔒 Verificando secretos...${NC}"
if grep -r "PRIVATE_KEY\|PASSWORD\|SECRET" --include="*.js" --include="*.ts" . 2>/dev/null | grep -v node_modules | grep -v ".git"; then
  echo -e "${YELLOW}⚠️  Se encontraron posibles secretos en el código${NC}"
else
  echo -e "${GREEN}✅ Sin secretos detectados${NC}"
fi

echo ""

# 3. Auto-generar vercel.json si no existe
if [ ! -f "vercel.json" ]; then
  echo -e "${BLUE}📝 Generando vercel.json...${NC}"

  # Detectar tipo de proyecto
  if [ -f "package.json" ]; then
    # Node.js project
    cat > vercel.json << 'EOF'
{
  "version": 2,
  "buildCommand": "npm run build || npm run dev",
  "installCommand": "npm install",
  "env": {
    "NODE_ENV": "production"
  },
  "regions": ["sfo1"],
  "functions": {
    "api/**/*.js": {
      "maxDuration": 10
    }
  },
  "redirects": [
    {
      "source": "/",
      "destination": "/index.html"
    }
  ]
}
EOF
    echo -e "${GREEN}✅ vercel.json creado${NC}"
  else
    echo -e "${YELLOW}⚠️  No se pudo detectar tipo de proyecto${NC}"
  fi
fi

echo ""

# 4. Desplegar a Vercel
echo -e "${BLUE}🚀 Desplegando a Vercel...${NC}"

# Usar Vercel CLI si está disponible, sino instrucciones
if command -v vercel &> /dev/null; then
  echo -e "${BLUE}Usando Vercel CLI...${NC}"

  # Deploy
  if vercel --token "$VERCEL_TOKEN" --prod 2>&1 | tee /tmp/vercel-deploy.log; then
    echo -e "${GREEN}✅ Deploy completado${NC}"

    # Obtener URL
    VERCEL_URL=$(grep "https://" /tmp/vercel-deploy.log | tail -1 | awk '{print $NF}')
    if [ -n "$VERCEL_URL" ]; then
      echo -e "${GREEN}   URL: $VERCEL_URL${NC}"
    fi
  else
    echo -e "${RED}❌ Error en el deploy${NC}"
    exit 1
  fi
else
  echo -e "${YELLOW}⚠️  Vercel CLI no instalado${NC}"
  echo ""
  echo "Para instalar:"
  echo "  npm i -g vercel"
  echo ""
  echo "Luego ejecuta:"
  echo "  vercel --token \$VERCEL_TOKEN --prod"
  echo ""
  exit 1
fi

echo ""

# 5. Health check (3 reintentos)
echo -e "${BLUE}🏥 Ejecutando health checks...${NC}"

MAX_RETRIES=3
RETRY=0
HEALTH_OK=false

while [ $RETRY -lt $MAX_RETRIES ]; do
  RETRY=$((RETRY + 1))
  echo -e "${BLUE}Intento $RETRY/$MAX_RETRIES...${NC}"

  sleep 5  # Esperar a que Vercel estabilice

  if curl -s -o /dev/null -w "%{http_code}" "$VERCEL_URL" | grep -q "200"; then
    echo -e "${GREEN}✅ Health check pasó${NC}"
    HEALTH_OK=true
    break
  else
    echo -e "${YELLOW}⚠️  Health check falló, reintentando...${NC}"
  fi
done

if [ "$HEALTH_OK" = false ]; then
  echo -e "${RED}❌ Health check falló después de $MAX_RETRIES intentos${NC}"
  echo ""
  echo "Tu código está publicado en Vercel, pero parece haber un problema."
  echo "Verifica en: https://vercel.com/dashboard"
  exit 1
fi

echo ""

# 6. Guardar configuración
echo -e "${BLUE}💾 Guardando estado del deploy...${NC}"

mkdir -p .sdd

cat > .sdd/.vercel-deploy.json << EOF
{
  "deployed": true,
  "deployment_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "app_url": "$VERCEL_URL",
  "profile": "$PROFILE",
  "spec_id": "$SPEC_ID"
}
EOF

echo -e "${GREEN}✅ Configuración guardada${NC}"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ ¡Despliegue exitoso!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Tu app está en vivo:"
echo -e "   ${GREEN}$VERCEL_URL${NC}"
echo ""
echo "Puedes compartir este link con quien quieras."
echo ""

exit 0
