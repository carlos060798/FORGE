#!/usr/bin/env bash
# Helper para /sdd.comprimir — comprime prosa con reglas caveman-like

ARCHIVO="$1"
MODO="${2:-full}"

if [[ -z "$ARCHIVO" ]]; then
  echo "❌ Uso: comprimir.sh archivo.md [lite|full|ultra]"
  exit 1
fi

if [[ ! -f "$ARCHIVO" ]]; then
  echo "❌ Archivo no existe: $ARCHIVO"
  exit 1
fi

# No comprimir código
case "$ARCHIVO" in
  *.py|*.js|*.ts|*.json|*.yaml|*.yml|*.toml|*.env|*.lock|*.sql|*.sh)
    echo "❌ No se comprime código: $ARCHIVO"
    exit 1
    ;;
esac

echo "🪨 Comprimiendo: $ARCHIVO..."

# Backup
cp "$ARCHIVO" "${ARCHIVO}.original"

# Aplicar reemplazos
cp "$ARCHIVO" "${ARCHIVO}.tmp"

# Artículos
sed -i 's/\bel\b//g' "${ARCHIVO}.tmp" 2>/dev/null || true
sed -i 's/\bla\b//g' "${ARCHIVO}.tmp" 2>/dev/null || true
sed -i 's/\bun\b//g' "${ARCHIVO}.tmp" 2>/dev/null || true

# Conectores
sed -i 's/sin embargo/pero/g' "${ARCHIVO}.tmp" 2>/dev/null || true
sed -i 's/para que/para/g' "${ARCHIVO}.tmp" 2>/dev/null || true
sed -i 's/es necesario que/debe/g' "${ARCHIVO}.tmp" 2>/dev/null || true

# Cortesía (full y ultra)
if [[ "$MODO" != "lite" ]]; then
  sed -i 's/\bpor favor\b//g' "${ARCHIVO}.tmp" 2>/dev/null || true
  sed -i 's/feliz de ayudar//g' "${ARCHIVO}.tmp" 2>/dev/null || true
fi

# Técnico (solo ultra)
if [[ "$MODO" == "ultra" ]]; then
  sed -i 's/base de datos/BD/g' "${ARCHIVO}.tmp" 2>/dev/null || true
  sed -i 's/autenticaci[óo]n/auth/g' "${ARCHIVO}.tmp" 2>/dev/null || true
  sed -i 's/funci[óo]n/fn/g' "${ARCHIVO}.tmp" 2>/dev/null || true
fi

# Limpiar espacios
sed -i 's/  */ /g' "${ARCHIVO}.tmp" 2>/dev/null || true
sed -i 's/ *$//' "${ARCHIVO}.tmp" 2>/dev/null || true

# Reemplazar
mv "${ARCHIVO}.tmp" "$ARCHIVO"

echo "✅ Comprimido"
echo "   Backup: ${ARCHIVO}.original"
