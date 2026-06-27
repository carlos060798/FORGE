#!/usr/bin/env bash
# post-write-conventions.sh — Hook PostToolUse universal (Bash wrapper)
#
# Estrategia:
#   1. Si Node >= 18 disponible → delega a post-write-conventions.js (8 fuentes, validación completa)
#   2. Sin Node → validaciones mínimas en Bash puro
#
# Protocolo Claude Code:
#   exit 0  → ok / solo warnings
#   exit 2  → error bloqueante (stderr al usuario)

set -uo pipefail

INPUT="$(cat)"

# ── Detectar Node >= 18 ───────────────────────────────────────────────────────
HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_OK=0

if command -v node &>/dev/null; then
  NODE_MAJOR="$(node -e 'process.stdout.write(String(process.versions.node.split(".")[0]))' 2>/dev/null || echo 0)"
  if [ "$NODE_MAJOR" -ge 18 ] 2>/dev/null; then
    NODE_OK=1
  fi
fi

JS_HOOK=""
if [ -f "$HOOK_DIR/post-write-conventions.js" ]; then
  JS_HOOK="$HOOK_DIR/post-write-conventions.js"
fi

# ── Delegar a Node ────────────────────────────────────────────────────────────
if [ "$NODE_OK" -eq 1 ] && [ -n "$JS_HOOK" ]; then
  echo "$INPUT" | node --no-warnings "$JS_HOOK"
  exit $?
fi

# ── Fallback Bash puro: validaciones mínimas ─────────────────────────────────
FILE_PATH="$(echo "$INPUT" | grep -o '"path"\s*:\s*"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/' || true)"
CONTENT="$(echo "$INPUT" | grep -o '"content"\s*:\s*"[^"]*"' | sed 's/.*"content"\s*:\s*"\(.*\)"/\1/' || true)"

if [ -z "$FILE_PATH" ] || [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

WARNINGS=()

# Detectar secrets hardcodeados básicos en el archivo recién escrito
if grep -qiE "(password|secret|api_key|token)\s*=\s*['\"][^'\"]{4,}" "$FILE_PATH" 2>/dev/null; then
  WARNINGS+=("posible secret hardcodeado en $FILE_PATH")
fi

# Detectar console.log/print de debug en archivos fuente (no en tests)
if [[ "$FILE_PATH" != *test* ]] && [[ "$FILE_PATH" != *spec* ]]; then
  if grep -qE "^\s*console\.log\(|^\s*print\(" "$FILE_PATH" 2>/dev/null; then
    WARNINGS+=("console.log/print de debug detectado en $FILE_PATH — considera eliminarlo")
  fi
fi

# Mostrar warnings (no bloquean)
if [ ${#WARNINGS[@]} -gt 0 ]; then
  echo "[post-write-conventions] Advertencias:" >&2
  for w in "${WARNINGS[@]}"; do
    echo "  ⚠️  $w" >&2
  done
  echo "  (instala Node >=18 para validación completa de convenciones)" >&2
fi

exit 0
