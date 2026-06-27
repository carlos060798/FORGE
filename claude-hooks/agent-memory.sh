#!/usr/bin/env bash
# agent-memory.sh — Hook PostToolUse universal (Bash wrapper)
#
# Estrategia:
#   1. Si Node >= 18 disponible → delega a agent-memory.js (SQLite/Markdown, ADRs, consumo)
#   2. Sin Node → registro mínimo en Markdown puro
#
# Protocolo Claude Code:
#   exit 0  → siempre (hook de memoria nunca bloquea)

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
if [ -f "$HOOK_DIR/agent-memory.js" ]; then
  JS_HOOK="$HOOK_DIR/agent-memory.js"
fi

# ── Delegar a Node ────────────────────────────────────────────────────────────
if [ "$NODE_OK" -eq 1 ] && [ -n "$JS_HOOK" ]; then
  echo "$INPUT" | node --no-warnings "$JS_HOOK"
  exit 0
fi

# ── Fallback Bash puro: registro mínimo en Markdown ──────────────────────────
# Extraer campos básicos del JSON sin jq
FILE_PATH="$(echo "$INPUT" | grep -o '"path"\s*:\s*"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/' || true)"
TOOL_NAME="$(echo "$INPUT" | grep -o '"tool_name"\s*:\s*"[^"]*"' | sed 's/.*"\([^"]*\)"$/\1/' || true)"
AGENT="${CLAUDE_AGENT_NAME:-desconocido}"
FECHA="$(date +%Y-%m-%d)"
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Solo registrar si hay ruta de archivo
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Crear directorio de memoria si no existe
SDD_DIR="${CLAUDE_PROJECT_DIR:-.}/.sdd/memoria"
mkdir -p "$SDD_DIR" 2>/dev/null || true

# Registro mínimo en JSONL
INDICE="$SDD_DIR/indice.jsonl"
ENTRY="{\"ts\":\"$TS\",\"fecha\":\"$FECHA\",\"agente\":\"$AGENT\",\"archivo\":\"$FILE_PATH\",\"tool\":\"$TOOL_NAME\",\"resumen\":\"modificado via $TOOL_NAME\"}"
echo "$ENTRY" >> "$INDICE" 2>/dev/null || true

# Registro en Markdown por agente
MD_FILE="$SDD_DIR/agente-${AGENT}.md"
if [ ! -f "$MD_FILE" ]; then
  echo "# Memoria — $AGENT" > "$MD_FILE"
  echo "" >> "$MD_FILE"
fi
echo "## $FECHA — $FILE_PATH" >> "$MD_FILE"
echo "> modificado via $TOOL_NAME (registro Bash — instala Node >=18 para memoria completa)" >> "$MD_FILE"
echo "" >> "$MD_FILE"

exit 0
