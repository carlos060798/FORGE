#!/bin/bash
# Ejemplo: aplicar linter después de implementar
# Cópialo a .sdd/hooks/ y hazlo ejecutable

if [ -f package.json ]; then
  echo "🧹 Aplicando linter..."
  npm run lint --fix 2>/dev/null || pnpm lint --fix 2>/dev/null || yarn lint --fix 2>/dev/null
fi

if [ -f pyproject.toml ]; then
  echo "🧹 Aplicando formateador..."
  ruff format . 2>/dev/null || black . 2>/dev/null
fi

if [ -f Cargo.toml ]; then
  echo "🧹 Aplicando rustfmt..."
  cargo fmt 2>/dev/null
fi

echo "✅ Hook despues_implementar completado"

# ===== NUEVO: Actualizar mapas =====
if [ -d ".sdd/mapa" ]; then
  echo "🗺️  Actualizando mapas..."
  bash ./.claude/bin/mapear.sh validar > /dev/null 2>&1 || true
  
  # Obtener archivos modificados en esta sesión
  # (esto es aproximado, en producción usarías git diff)
  MAPA_ANTIGUO=$(stat -c %Y .sdd/mapa/estructura.md 2>/dev/null || echo 0)
  ARCHIVOS_NUEVOS=$(find . -newer <(date -r $MAPA_ANTIGUO) -type f 2>/dev/null | grep -v '.sdd' | wc -l)
  
  if [ "$ARCHIVOS_NUEVOS" -gt 0 ]; then
    echo "📝 Detectados $ARCHIVOS_NUEVOS archivos modificados"
    echo "⏰ Próxima actualización: /sdd.mapear actualizar"
  fi
fi
