#!/bin/bash
# ============================================================
# guardia-seguridad.sh — Hook de seguridad SDD-ES
# ============================================================
# Bloquea operaciones destructivas, protege .env y archivos
# sensibles, y requiere confirmación explícita antes de
# cualquier acción irreversible.
#
# USO: cópialo a .sdd/hooks/ y hazlo ejecutable:
#   cp guardia-seguridad.sh .sdd/hooks/
#   chmod +x .sdd/hooks/guardia-seguridad.sh
#
# Se invoca desde los hooks antes_implementar.sh o como
# wrapper de cualquier comando que el agente proponga ejecutar.
#
# Variables de entorno esperadas (opcionales):
#   SDD_COMANDO    — el comando que está a punto de ejecutarse
#   SDD_ARCHIVOS   — archivos que el agente quiere tocar
#   SDD_TAREA_ID   — ID de la tarea actual (para el log)
# ============================================================

set -euo pipefail

# ── Colores ─────────────────────────────────────────────────
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BOLD='\033[1m'
NC='\033[0m'

# ── Rutas ───────────────────────────────────────────────────
CONFIG=".sdd/sdd.config.yaml"
LOG=".sdd/guardia.log"

log() {
  local NIVEL="$1"
  local MSG="$2"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$NIVEL] ${SDD_TAREA_ID:-?} — $MSG" >> "$LOG" 2>/dev/null || true
}

bloquear() {
  local RAZON="$1"
  echo -e "${RED}${BOLD}🚫 BLOQUEADO${NC}: $RAZON"
  log "BLOQUEO" "$RAZON"
  exit 1
}

advertir() {
  local RAZON="$1"
  echo -e "${YELLOW}${BOLD}⚠️  ADVERTENCIA${NC}: $RAZON"
  log "ADVERTENCIA" "$RAZON"
}

confirmar() {
  local PREGUNTA="$1"
  local ACCION="$2"
  echo -e "${YELLOW}${BOLD}⚠️  REQUIERE CONFIRMACIÓN${NC}"
  echo -e "   Acción: ${BOLD}${ACCION}${NC}"
  echo -e "   $PREGUNTA"
  echo -e "   Escribe ${BOLD}SI${NC} (en mayúsculas) para continuar, cualquier otra cosa cancela:"
  read -r RESP
  if [ "$RESP" != "SI" ]; then
    bloquear "Acción cancelada por el usuario: $ACCION"
  fi
  log "CONFIRMADO" "$ACCION"
}

# ============================================================
# BLOQUE 1 — Protección de archivos sensibles
# ============================================================
# Lee patrones de protecciones.no_tocar_archivos en config
# Si el agente propone tocar alguno, bloquea.

proteger_archivos_sensibles() {
  # Patrones protegidos por defecto (sin config)
  local PATRONES_DEFAULT=(
    ".env"
    ".env.*"
    ".env.local"
    ".env.production"
    ".env.staging"
    "*.pem"
    "*.key"
    "*.p12"
    "*.pfx"
    "id_rsa"
    "id_ed25519"
    "*credentials*"
    "*secrets*"
    "*secret*"
    "*.secret"
    ".netrc"
    "*.kubeconfig"
    "kubeconfig"
    ".aws/credentials"
    ".ssh/*"
    "serviceAccountKey.json"
    "firebase-adminsdk*.json"
    "google-services.json"
    "GoogleService-Info.plist"
  )

  # Si no hay archivos propuestos, saltar
  [ -z "${SDD_ARCHIVOS:-}" ] && return 0

  for PATRON in "${PATRONES_DEFAULT[@]}"; do
    # shellcheck disable=SC2254
    case "$SDD_ARCHIVOS" in
      *$PATRON*)
        bloquear "Intento de acceso a archivo sensible: '$SDD_ARCHIVOS' coincide con patrón protegido '$PATRON'. Los archivos de credenciales NUNCA deben ser leídos ni escritos por agentes."
        ;;
    esac
  done

  # También verificar contra archivos reales en el repo
  # Detectar .env files que no estén en .gitignore y alertar
  local ENV_FILES
  ENV_FILES=$(find . -maxdepth 3 -name ".env*" ! -name ".env.example" ! -name ".env.template" \
    ! -path "*/.git/*" ! -path "*/.sdd/*" ! -path "*/node_modules/*" 2>/dev/null)

  if [ -n "$ENV_FILES" ]; then
    # Verificar si están en .gitignore
    for ENV_FILE in $ENV_FILES; do
      local NOMBRE
      NOMBRE=$(basename "$ENV_FILE")
      if ! grep -q "$NOMBRE" .gitignore 2>/dev/null && ! grep -q ".env" .gitignore 2>/dev/null; then
        advertir "Archivo '$ENV_FILE' existe pero NO está en .gitignore. Riesgo de exposición de credenciales."
      fi
    done
  fi
}

# ============================================================
# BLOQUE 2 — Comandos destructivos prohibidos
# ============================================================

COMANDOS_PROHIBIDOS=(
  # Eliminación masiva
  "rm -rf /"
  "rm -rf ~"
  "rm -rf \$HOME"
  "rm -rf ."
  "rm -rf .."
  "rmdir /s"           # Windows
  "rd /s"              # Windows
  "del /f /s /q"       # Windows

  # Base de datos destructiva
  "DROP DATABASE"
  "DROP SCHEMA"
  "TRUNCATE DATABASE"

  # Git irreversible en remoto
  "git push --force"
  "git push -f"
  "git push --force-with-lease"   # requiere confirmación también
  "git push origin :main"
  "git push origin :master"

  # Git destructivo local
  "git reset --hard"
  "git clean -fd"
  "git clean -fxd"
  "git reflog expire"
  "git gc --prune=now"

  # Credenciales y tokens en git
  "git config --global credential"
  "git config --global user.password"
)

COMANDOS_CONFIRMAR=(
  # Eliminación de archivos (no masiva)
  "rm -rf"
  "rm -r"
  "Remove-Item -Recurse"   # PowerShell

  # Base de datos
  "DROP TABLE"
  "DROP INDEX"
  "DELETE FROM"
  "TRUNCATE TABLE"

  # Git local reversible
  "git reset"
  "git stash drop"
  "git branch -D"
  "git tag -d"

  # Publicación / deploy
  "npm publish"
  "pnpm publish"
  "yarn publish"
  "pip publish"
  "cargo publish"
  "docker push"
  "terraform apply"
  "terraform destroy"
  "kubectl delete"
  "helm uninstall"

  # Otros
  "pip uninstall"
  "npm uninstall"
)

verificar_comandos() {
  local CMD="${SDD_COMANDO:-}"
  [ -z "$CMD" ] && return 0

  # Prohibidos absolutos
  for PROHIBIDO in "${COMANDOS_PROHIBIDOS[@]}"; do
    if echo "$CMD" | grep -qi "$PROHIBIDO"; then
      bloquear "Comando prohibido detectado: '$CMD' contiene '$PROHIBIDO'. Este comando puede causar daño irreversible y nunca debe ejecutarse automáticamente."
    fi
  done

  # Requieren confirmación explícita
  for PELIGROSO in "${COMANDOS_CONFIRMAR[@]}"; do
    if echo "$CMD" | grep -qi "$PELIGROSO"; then
      confirmar \
        "El agente quiere ejecutar un comando potencialmente destructivo." \
        "$CMD"
      break
    fi
  done
}

# ============================================================
# BLOQUE 3 — Protección de rama git
# ============================================================

RAMAS_PROTEGIDAS=("main" "master" "develop" "release" "production" "prod" "staging")

verificar_rama_git() {
  [ ! -d .git ] && return 0
  [ "${SDD_SKIP_RAMA_CHECK:-}" = "true" ] && return 0

  local RAMA
  RAMA=$(git branch --show-current 2>/dev/null || echo "")
  [ -z "$RAMA" ] && return 0

  for PROTEGIDA in "${RAMAS_PROTEGIDAS[@]}"; do
    if [ "$RAMA" = "$PROTEGIDA" ]; then
      advertir "Estás en la rama protegida '${RAMA}'. Las implementaciones deberían hacerse en ramas de feature."
      echo -e "   ¿Continuar implementando directamente en ${BOLD}${RAMA}${NC}? (s/N)"
      read -r RESP
      if [ "$RESP" != "s" ] && [ "$RESP" != "S" ]; then
        bloquear "Implementación cancelada — rama protegida '$RAMA'. Crea una rama de feature primero."
      fi
      log "ADVERTENCIA" "Usuario eligió implementar en rama protegida: $RAMA"
      break
    fi
  done
}

# ============================================================
# BLOQUE 4 — Push automático bloqueado
# ============================================================
# SDD-ES nunca hace git push sin confirmación explícita.
# Si el agente intenta un push, se intercepta aquí.

verificar_push() {
  local CMD="${SDD_COMANDO:-}"
  [ -z "$CMD" ] && return 0

  if echo "$CMD" | grep -q "git push"; then
    # ¿Es un push sin --force?
    if ! echo "$CMD" | grep -qE "\-\-force|\-f\b"; then
      confirmar \
        "El agente quiere hacer git push. ¿Confirmás que el código está listo para subir al remoto?" \
        "$CMD"
    fi
    # Si tiene --force ya fue bloqueado en BLOQUE 2
  fi
}

# ============================================================
# BLOQUE 5 — Detección de secrets hardcodeados
# ============================================================
# Escaneo rápido de archivos que el agente generó/modificó.

escanear_secrets() {
  [ -z "${SDD_ARCHIVOS:-}" ] && return 0

  local PATRONES_SECRET=(
    "password\s*=\s*['\"][^'\"]{4,}"
    "secret\s*=\s*['\"][^'\"]{4,}"
    "api_key\s*=\s*['\"][^'\"]{4,}"
    "apikey\s*=\s*['\"][^'\"]{4,}"
    "token\s*=\s*['\"][^'\"]{10,}"
    "private_key\s*=\s*['\"][^'\"]{10,}"
    "BEGIN RSA PRIVATE KEY"
    "BEGIN EC PRIVATE KEY"
    "BEGIN OPENSSH PRIVATE KEY"
    "AWS_SECRET_ACCESS_KEY"
    "GITHUB_TOKEN\s*=\s*['\"][^'\"]"
    "sk-[a-zA-Z0-9]{20,}"   # OpenAI key pattern
    "xox[baprs]-[0-9]"      # Slack token pattern
  )

  for ARCHIVO in $SDD_ARCHIVOS; do
    [ ! -f "$ARCHIVO" ] && continue
    for PATRON in "${PATRONES_SECRET[@]}"; do
      if grep -qiP "$PATRON" "$ARCHIVO" 2>/dev/null; then
        bloquear "Secret hardcodeado detectado en '$ARCHIVO' (patrón: $PATRON). Usa variables de entorno o un secret manager — NUNCA valores reales en código."
      fi
    done
  done
}

# ============================================================
# BLOQUE 6 — Verificación de .gitignore para archivos nuevos
# ============================================================
# Si el agente crea un archivo que debería estar en .gitignore, advierte.

verificar_gitignore() {
  [ ! -d .git ] && return 0
  [ -z "${SDD_ARCHIVOS:-}" ] && return 0

  local DEBERIAN_IGNORARSE=(
    ".env"
    "*.key"
    "*.pem"
    "node_modules"
    "dist"
    "build"
    "__pycache__"
    "*.pyc"
    "*.log"
    ".DS_Store"
    "Thumbs.db"
  )

  for ARCHIVO in $SDD_ARCHIVOS; do
    local NOMBRE
    NOMBRE=$(basename "$ARCHIVO")
    for PATRON in "${DEBERIAN_IGNORARSE[@]}"; do
      # shellcheck disable=SC2254
      case "$NOMBRE" in
        $PATRON)
          if ! git check-ignore -q "$ARCHIVO" 2>/dev/null; then
            advertir "'$ARCHIVO' debería estar en .gitignore pero no lo está."
          fi
          ;;
      esac
    done
  done
}

# ============================================================
# EJECUCIÓN EN ORDEN
# ============================================================

echo -e "${GREEN}🛡️  Guardia de seguridad SDD-ES${NC}"

proteger_archivos_sensibles
verificar_comandos
verificar_rama_git
verificar_push
escanear_secrets
verificar_gitignore

echo -e "${GREEN}✅ Verificaciones de seguridad pasadas${NC}"
log "OK" "Todas las verificaciones pasaron — ${SDD_COMANDO:-sin comando}"

exit 0
