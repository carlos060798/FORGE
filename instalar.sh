#!/usr/bin/env bash
# SDD-ES — Atajo de instalación para Unix (macOS / Linux / Git Bash).
#
# Delega en el CLI Node multiplataforma (cli/index.js), que es la fuente
# de verdad única de la lógica de instalación. Si no hay Node, avisa.
#
# Uso: bash instalar.sh [--global]
#   El camino canónico recomendado es:  npx sdd-es init [--global]

set -e

PLUGIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v node &> /dev/null; then
  echo "✗ Node.js no está instalado." >&2
  echo "  SDD-ES necesita Node >=18 para instalarse." >&2
  echo "  Instala Node desde https://nodejs.org y reintenta." >&2
  exit 1
fi

# Pasa todos los argumentos (p. ej. --global) al subcomando init del CLI
exec node "${PLUGIN_DIR}/cli/index.js" init "$@"
