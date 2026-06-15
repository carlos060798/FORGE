#!/bin/bash
# Ejemplo: crear branch Git automáticamente al crear una spec

SPEC_ID=$(grep -o '"especificacion_activa": "[^"]*"' .sdd/estado.json | cut -d'"' -f4)

if [ -d .git ] && [ -n "$SPEC_ID" ]; then
  RAMA="spec/${SPEC_ID}"
  
  # Solo crear si no existe
  if ! git show-ref --verify --quiet "refs/heads/${RAMA}"; then
    git checkout -b "$RAMA" 2>/dev/null && \
      echo "✅ Branch creada: $RAMA"
  fi
fi
