#!/bin/bash
# Ejemplo: notificación a Slack/Teams cuando un plan se aprueba

SPEC_ID=$(grep -o '"especificacion_activa": "[^"]*"' .sdd/estado.json | cut -d'"' -f4)
TITULO=$(grep "^titulo:" ".sdd/especificaciones/${SPEC_ID}/spec.md" | cut -d'"' -f2)

if [ -n "$SLACK_WEBHOOK" ]; then
  curl -s -X POST "$SLACK_WEBHOOK" \
    -H 'Content-type: application/json' \
    --data "{\"text\":\"📋 Plan SDD aprobado: ${TITULO} (${SPEC_ID})\"}"
  echo "✅ Notificación enviada a Slack"
fi

if [ -n "$TEAMS_WEBHOOK" ]; then
  curl -s -X POST "$TEAMS_WEBHOOK" \
    -H 'Content-type: application/json' \
    --data "{\"text\":\"📋 Plan SDD aprobado: ${TITULO} (${SPEC_ID})\"}"
  echo "✅ Notificación enviada a Teams"
fi
