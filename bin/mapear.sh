#!/usr/bin/env bash
# Helper para /sdd.mapear — genera mapas de estructura, símbolos y dependencias

set -e
MAPA_DIR=".sdd/mapa"
mkdir -p "$MAPA_DIR"

echo "🗺️  Analizando proyecto..."

# Opción: validar sin actualizar
if [[ "$1" == "validar" ]]; then
  if [[ -f "$MAPA_DIR/estructura.md" ]]; then
    echo "✅ Mapas existen"
    find . -newer "$MAPA_DIR/estructura.md" -type f -not -path './.git/*' -not -path './.sdd/*' | wc -l | xargs echo "Archivos nuevos desde último mapeo:"
  else
    echo "❌ Mapas no existen. Ejecuta: /sdd.mapear"
  fi
  exit 0
fi

# Generar estructura.md
echo "📁 Estructura..."
cat > "$MAPA_DIR/estructura.md" << 'EOF'
# Mapa de Estructura

EOF

find . -type f -not -path './.git/*' -not -path './node_modules/*' -not -path './.sdd/*' \
  | sort | head -50 >> "$MAPA_DIR/estructura.md"

# Generar símbolos.md (básico)
echo "📝 Símbolos..."
cat > "$MAPA_DIR/simbolos.md" << 'EOF'
# Mapa de Símbolos Públicos

EOF

find . -type f -name "*.ts" -not -path './.sdd/*' -not -path './node_modules/*' | head -20 | while read f; do
  echo "## $f" >> "$MAPA_DIR/simbolos.md"
  grep -E '^export (function|class|const|type)' "$f" 2>/dev/null | sed 's/.*export /- /' >> "$MAPA_DIR/simbolos.md" || echo "  (sin exports)" >> "$MAPA_DIR/simbolos.md"
done

# Generar dependencias.md (básico)
echo "🔗 Dependencias..."
cat > "$MAPA_DIR/dependencias.md" << 'EOF'
# Mapa de Dependencias

EOF

find . -type f -name "*.ts" -not -path './.sdd/*' -not -path './node_modules/*' | head -20 | while read f; do
  echo "$f" >> "$MAPA_DIR/dependencias.md"
  grep -o "from ['\"][^'\"]*" "$f" 2>/dev/null | cut -d"'" -f2 | cut -d'"' -f2 | head -3 | sed 's/^/  ↳ depende: /' >> "$MAPA_DIR/dependencias.md" || true
done

echo "✅ Mapas generados"
echo "   - $MAPA_DIR/estructura.md"
echo "   - $MAPA_DIR/simbolos.md"
echo "   - $MAPA_DIR/dependencias.md"
