#!/usr/bin/env bash
# pre-tool-guard.sh — Hook PreToolUse universal (Bash wrapper)
#
# Estrategia:
#   1. Si Node >= 18 está disponible → delega a pre-tool-guard.js (lógica completa)
#   2. Sin Node → lógica mínima de seguridad en Bash puro
#
# Protocolo Claude Code:
#   exit 0  → permitir
#   exit 2  → bloquear (stderr se muestra al usuario)

set -euo pipefail

# ── Leer stdin completo ───────────────────────────────────────────────────────
INPUT="$(cat)"

# ── Detectar Node >= 18 ───────────────────────────────────────────────────────
HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_OK=0

if command -v node &>/dev/null; then
  NODE_MAJOR="$(node -e 'process.stdout.write(String(process.versions.node.split(".")[0]))'  2>/dev/null || echo 0)"
  if [ "$NODE_MAJOR" -ge 18 ] 2>/dev/null; then
    NODE_OK=1
  fi
fi

# ── Ruta al .js (en proyectos instalados con npx forge init, el hook está
#    copiado en .claude/hooks/ — intentamos ambas rutas) ─────────────────────
JS_HOOK=""
if [ -f "$HOOK_DIR/pre-tool-guard.js" ]; then
  JS_HOOK="$HOOK_DIR/pre-tool-guard.js"
fi

# ── Delegar a Node si está disponible ────────────────────────────────────────
if [ "$NODE_OK" -eq 1 ] && [ -n "$JS_HOOK" ]; then
  # Pasar el tipo de módulo correcto: si el proyecto NO tiene "type":"module",
  # Node intentaría cargar el .js como CJS. Lo forzamos a ESM con --input-type
  # pasándolo como pipe a node --experimental-vm-modules, o bien usando la
  # ruta directa con extensión .js (que en el paquete FORGE es ESM via package.json).
  #
  # Solución robusta: ejecutar desde el directorio del hook donde está el
  # package.json de FORGE (que declara "type":"module"), no desde el CWD del proyecto.
  echo "$INPUT" | node --no-warnings "$JS_HOOK"
  exit $?
fi

# ── Fallback Bash puro: guardia mínima de seguridad ──────────────────────────
# Extraer campo relevante del JSON (sin jq — solo grep/sed)
TOOL_NAME="$(echo "$INPUT" | grep -o '"tool_name"\s*:\s*"[^"]*"' | sed 's/.*"\([^"]*\)"$/\1/' || true)"
CONTENT="$(echo "$INPUT" | grep -o '"content"\s*:\s*"[^"]*"' | sed 's/.*"content"\s*:\s*"\(.*\)"/\1/' || true)"
COMMAND="$(echo "$INPUT" | grep -o '"command"\s*:\s*"[^"]*"' | sed 's/.*"command"\s*:\s*"\(.*\)"/\1/' || true)"

SUBJECT="$CONTENT $COMMAND"

# Patrones prohibidos — bloqueo duro
BLOCK_PATTERNS=(
  "rm -rf /"
  "rm -rf ~"
  "rm -rf \."
  "git push --force"
  "git push -f"
  "git reset --hard"
  "DROP DATABASE"
  "DROP SCHEMA"
  "chmod 777"
  "chmod -R 777"
  "Remove-Item.*-Recurse.*-Force.*[/\\\\]"
)

for pat in "${BLOCK_PATTERNS[@]}"; do
  if echo "$SUBJECT" | grep -qiE "$pat" 2>/dev/null; then
    echo "[pre-tool-guard] BLOQUEADO: operación destructiva detectada: $pat" >&2
    exit 2
  fi
done

# Secrets hardcodeados en contenido de Write/Edit
if [ "$TOOL_NAME" = "Write" ] || [ "$TOOL_NAME" = "Edit" ]; then
  SECRET_PATTERNS=(
    "password\s*=\s*['\"][^'\"]{4,}"
    "api[_-]?key\s*=\s*['\"][^'\"]{8,}"
    "sk-[a-zA-Z0-9]{20,}"
    "AKIA[0-9A-Z]{16}"
    "ghp_[a-zA-Z0-9]{36}"
  )
  for pat in "${SECRET_PATTERNS[@]}"; do
    if echo "$CONTENT" | grep -qiE "$pat" 2>/dev/null; then
      echo "[pre-tool-guard] BLOQUEADO: posible secret hardcodeado detectado." >&2
      exit 2
    fi
  done
fi

exit 0
