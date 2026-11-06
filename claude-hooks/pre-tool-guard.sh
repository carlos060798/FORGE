#!/usr/bin/env bash
# pre-tool-guard.sh — Hook PreToolUse universal (Bash wrapper)
#
# Estrategia:
#   1. Si Node >= 20 está disponible → delega a pre-tool-guard.js (lógica completa)
#   2. Sin Node → bloquea (falla cerrado)
#
# Protocolo Claude Code:
#   exit 0  → permitir
#   exit 2  → bloquear (stderr se muestra al usuario)

set -euo pipefail

# ── Leer stdin completo ───────────────────────────────────────────────────────
INPUT="$(cat)"

# ── Detectar Node >= 20 ───────────────────────────────────────────────────────
HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_OK=0

if command -v node &>/dev/null; then
  NODE_MAJOR="$(node -e 'process.stdout.write(String(process.versions.node.split(".")[0]))'  2>/dev/null || echo 0)"
  if [ "$NODE_MAJOR" -ge 20 ] 2>/dev/null; then
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

# ── Sin Node, el guardián NO adivina: falla cerrado ──────────────────────────
# El análisis por argv vive en pre-tool-guard.js. Extraer campos de un JSON con grep se rompe con comillas
# escapadas y dejaba pasar lo que no entendía (informe SEGURIDAD-CIBER C-07), así que sin Node se bloquea.
echo "[pre-tool-guard] BLOQUEADO: no hay Node >= 20 (o falta pre-tool-guard.js junto a este script)." >&2
echo "  El guardián no puede evaluar la acción sin Node. Instala Node 20 o superior y vuelve a intentarlo." >&2
exit 2
