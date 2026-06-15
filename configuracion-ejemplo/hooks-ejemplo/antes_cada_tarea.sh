#!/bin/bash
# antes_cada_tarea.sh — se ejecuta antes de cada tarea individual en /sdd.implementar
# Cópialo a .sdd/hooks/ y hazlo ejecutable: chmod +x .sdd/hooks/antes_cada_tarea.sh
#
# Recibe como argumento: $1 = TAREA_ID (ej: "T003")
# El agente puede pasar variables de entorno opcionales:
#   SDD_ARCHIVOS  — archivos que la tarea va a modificar
#   SDD_COMANDO   — comando que la tarea va a ejecutar (si aplica)

TAREA_ID="${1:-?}"
export SDD_TAREA_ID="$TAREA_ID"

echo "🔒 Verificación de seguridad para ${TAREA_ID}..."

# Invocar el guardia para esta tarea específica
bash "$(dirname "$0")/guardia-seguridad.sh"

echo "✅ ${TAREA_ID} — verificaciones pasadas, iniciando ejecución"
