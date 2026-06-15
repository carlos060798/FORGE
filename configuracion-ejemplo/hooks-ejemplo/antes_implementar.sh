#!/bin/bash
# antes_implementar.sh — se ejecuta antes de cada /sdd.implementar
# Cópialo a .sdd/hooks/ y hazlo ejecutable: chmod +x .sdd/hooks/antes_implementar.sh

set -euo pipefail

# ── 1. Guardia de seguridad ──────────────────────────────────
# Bloquea .env, comandos destructivos, push sin confirmación, secrets hardcodeados
bash "$(dirname "$0")/guardia-seguridad.sh"

# ── 2. Verificar rama git ────────────────────────────────────
# (Ya cubierto por guardia-seguridad.sh — esto es redundante si usas el guardia)

# ── 3. Verificar tests previos pasan ────────────────────────
# No implementes sobre una base rota
echo "🔍 Verificando que los tests actuales pasan antes de implementar..."

TESTS_OK=false

if [ -f package.json ]; then
  npx jest --passWithNoTests --silent 2>/dev/null && TESTS_OK=true \
  || pnpm test --silent 2>/dev/null && TESTS_OK=true \
  || TESTS_OK=false
fi

if [ -f pyproject.toml ] || [ -f pytest.ini ]; then
  python -m pytest -q --tb=no 2>/dev/null && TESTS_OK=true || TESTS_OK=false
fi

if [ -f Cargo.toml ]; then
  cargo test -q 2>/dev/null && TESTS_OK=true || TESTS_OK=false
fi

if [ "$TESTS_OK" = "false" ]; then
  echo "⚠️  Los tests actuales tienen fallos pre-existentes."
  echo "   Implementar sobre una base rota dificulta identificar regresiones."
  echo "   ¿Continuar de todos modos? (s/N)"
  read -r RESP
  if [ "$RESP" != "s" ] && [ "$RESP" != "S" ]; then
    echo "❌ Implementación cancelada — corrige los tests fallidos primero."
    exit 1
  fi
fi

echo "✅ Hook antes_implementar completado"
