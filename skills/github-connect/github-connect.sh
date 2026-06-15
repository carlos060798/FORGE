#!/bin/bash

################################################################################
# GitHub Connect Skill - Helper Script
# Automatiza la conexión de un proyecto a GitHub
################################################################################

set -euo pipefail

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables por defecto
GITHUB_TOKEN="${GITHUB_TOKEN:-}"
REPO_NAME="${1:-$(basename "$(pwd)")}"
REPO_DESCRIPTION="${2:-Proyecto SDD-ES}"
REPO_VISIBILITY="${3:-public}"
BRANCH_NAME="main"
AUTO_INIT_COMMIT=true

################################################################################
# Funciones Auxiliares
################################################################################

log_info() {
  echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
  echo -e "${RED}❌ $1${NC}"
}

log_section() {
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

################################################################################
# 1. Validación del Token GitHub
################################################################################

validate_github_token() {
  log_section "1. Validando Token de GitHub"

  if [ -z "$GITHUB_TOKEN" ]; then
    log_error "GITHUB_TOKEN no configurado"
    echo ""
    echo "Pasos para configurar:"
    echo "1. Ve a: https://github.com/settings/tokens?type=beta"
    echo "2. Click 'Generate new token (beta)'"
    echo "3. Nombre: 'SDD-ES CLI'"
    echo "4. Permisos: repo (todos), user:email"
    echo "5. Copia el token"
    echo "6. Exporta: export GITHUB_TOKEN=ghp_xxxxx"
    echo ""
    echo "Documentación: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token"
    return 1
  fi

  # Validar que gh está instalado
  if ! command -v gh &> /dev/null; then
    log_error "GitHub CLI (gh) no está instalado"
    echo "Descárgalo desde: https://cli.github.com/"
    return 1
  fi

  # Exportar token para gh
  export GH_TOKEN="$GITHUB_TOKEN"

  # Probar autenticación
  if ! gh auth status --show-token &> /dev/null; then
    log_error "Token de GitHub inválido o expirado"
    echo ""
    echo "Genera uno nuevo:"
    echo "https://github.com/settings/tokens?type=beta"
    echo ""
    echo "Permisos requeridos:"
    echo "  - repo (todos los scopes)"
    echo "  - user:email"
    return 1
  fi

  log_success "Token válido"
  return 0
}

################################################################################
# 2. Obtener Información del Usuario
################################################################################

get_github_info() {
  log_section "2. Obteniendo Información de GitHub"

  GITHUB_USER=$(gh api user --jq .login 2>/dev/null)
  if [ -z "$GITHUB_USER" ]; then
    log_error "No se pudo obtener usuario de GitHub"
    return 1
  fi

  log_success "Usuario: $GITHUB_USER"

  # Mostrar configuración
  echo ""
  log_info "Configuración del repositorio:"
  echo "   Nombre: $REPO_NAME"
  echo "   Descripción: $REPO_DESCRIPTION"
  echo "   Visibilidad: $REPO_VISIBILITY"
  echo "   Rama: $BRANCH_NAME"

  return 0
}

################################################################################
# 3. Verificar si Git está Inicializado
################################################################################

check_git_repo() {
  log_section "3. Verificando Repositorio Git"

  if [ ! -d ".git" ]; then
    log_error "Este directorio no es un repositorio Git"
    echo ""
    echo "Inicializa uno con:"
    echo "  git init"
    echo "  git config user.name 'Tu Nombre'"
    echo "  git config user.email 'tu@email.com'"
    return 1
  fi

  # Verificar configuración de usuario
  if ! git config user.name &> /dev/null || ! git config user.email &> /dev/null; then
    log_warning "Git no tiene user.name o user.email configurado"
    echo ""
    echo "Configura:"
    echo "  git config user.name 'Tu Nombre'"
    echo "  git config user.email 'tu@email.com'"
    return 1
  fi

  log_success "Git inicializado correctamente"
  return 0
}

################################################################################
# 4. Verificar Existencia del Repositorio
################################################################################

check_repo_exists() {
  log_section "4. Verificando Repositorio en GitHub"

  if gh repo view "$GITHUB_USER/$REPO_NAME" --json name &> /dev/null; then
    log_warning "El repositorio '$REPO_NAME' ya existe en GitHub"
    REPO_EXISTS=true
    REPO_URL="https://github.com/$GITHUB_USER/$REPO_NAME"
    echo "   URL: $REPO_URL"
  else
    REPO_EXISTS=false
    log_info "Repositorio no existe, se creará nuevo"
  fi

  return 0
}

################################################################################
# 5. Crear Repositorio
################################################################################

create_github_repo() {
  if [ "$REPO_EXISTS" = true ]; then
    log_info "Usando repositorio existente"
    return 0
  fi

  log_section "5. Creando Repositorio en GitHub"

  if ! gh repo create "$REPO_NAME" \
    --description "$REPO_DESCRIPTION" \
    --"$REPO_VISIBILITY" \
    --source=. \
    --remote=origin \
    --push 2>&1 | tee /tmp/gh-output.log; then

    log_error "Error al crear el repositorio"
    cat /tmp/gh-output.log
    return 1
  fi

  log_success "Repositorio creado en GitHub"
  return 0
}

################################################################################
# 6. Configurar Remote
################################################################################

setup_remote() {
  log_section "6. Configurando Remote"

  REMOTE_URL="https://github.com/$GITHUB_USER/$REPO_NAME.git"

  # Verificar si ya existe origin
  if git remote get-url origin &> /dev/null; then
    EXISTING_URL=$(git remote get-url origin)
    if [ "$EXISTING_URL" = "$REMOTE_URL" ]; then
      log_success "Remote ya configurado correctamente"
      return 0
    else
      log_warning "Remote existente con URL diferente: $EXISTING_URL"
      echo "Removiendo remote anterior..."
      git remote remove origin
    fi
  fi

  git remote add origin "$REMOTE_URL"
  log_success "Remote configurado: $REMOTE_URL"
  return 0
}

################################################################################
# 7. Hacer Commit Inicial
################################################################################

create_initial_commit() {
  if [ "$AUTO_INIT_COMMIT" != true ]; then
    log_info "Skipping commit inicial (AUTO_INIT_COMMIT=false)"
    return 0
  fi

  log_section "7. Creando Commit Inicial"

  # Verificar cambios pendientes
  if git diff-index --quiet HEAD 2>/dev/null; then
    log_info "No hay cambios para commitear"
    return 0
  fi

  git add -A
  git commit -m "feat: Inicialización del proyecto SDD-ES

- Proyecto conectado a GitHub
- Configuración inicial completada" || log_warning "Commit fallido o sin cambios"

  log_success "Commit inicial creado"
  return 0
}

################################################################################
# 8. Configurar Rama Principal
################################################################################

setup_main_branch() {
  log_section "8. Configurando Rama Principal"

  # Obtener rama actual
  CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "master")

  # Si no es main, renombrar
  if [ "$CURRENT_BRANCH" != "$BRANCH_NAME" ]; then
    log_info "Renombrando rama '$CURRENT_BRANCH' a '$BRANCH_NAME'"
    git branch -M "$BRANCH_NAME" || log_warning "No se pudo renombrar rama"
  fi

  log_success "Rama principal: $BRANCH_NAME"
  return 0
}

################################################################################
# 9. Push Inicial
################################################################################

initial_push() {
  log_section "9. Haciendo Push Inicial"

  if ! git push -u origin "$BRANCH_NAME" 2>&1 | tee /tmp/push-output.log; then
    # Permitir fallo si no hay commits
    if grep -q "no changes added" /tmp/push-output.log; then
      log_warning "No hay commits para pushear"
    else
      log_error "Error en push"
      cat /tmp/push-output.log
      return 1
    fi
  fi

  log_success "Push completado"
  return 0
}

################################################################################
# 10. Guardar Configuración Local
################################################################################

save_config() {
  log_section "10. Guardando Configuración Local"

  mkdir -p .sdd

  cat > .sdd/sdd.config.yaml << EOF
# Configuración de GitHub - SDD-ES
# Auto-generado por: github-connect skill
git:
  remote_url: "https://github.com/$GITHUB_USER/$REPO_NAME.git"
  connected: true
  connected_at: "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  github_user: "$GITHUB_USER"
  repo_name: "$REPO_NAME"
  branch: "$BRANCH_NAME"
  visibility: "$REPO_VISIBILITY"
EOF

  log_success "Configuración guardada en .sdd/sdd.config.yaml"

  # Commitear configuración
  if [ "$AUTO_INIT_COMMIT" = true ]; then
    git add .sdd/sdd.config.yaml
    git commit -m "chore: Configuración de GitHub" 2>/dev/null || true
    git push origin "$BRANCH_NAME" 2>/dev/null || true
  fi

  return 0
}

################################################################################
# 11. Validación Post-Ejecución
################################################################################

validate_result() {
  log_section "11. Validación Final"

  # Verificar remote
  if git remote get-url origin &> /dev/null; then
    log_success "Remote configurado"
  else
    log_error "Remote no está configurado"
    return 1
  fi

  # Verificar upstream
  if git branch -vv | grep -q "$BRANCH_NAME.*origin/$BRANCH_NAME"; then
    log_success "Rama upstream configurada"
  else
    log_warning "Rama upstream no configurada"
  fi

  # Verificar configuración local
  if [ -f ".sdd/sdd.config.yaml" ]; then
    log_success "Configuración local guardada"
  else
    log_warning "Configuración local no guardada"
  fi

  return 0
}

################################################################################
# Mostrar Resumen Final
################################################################################

show_summary() {
  echo ""
  log_section "✨ CONEXIÓN A GITHUB COMPLETADA"
  echo ""
  echo "📊 Resumen:"
  echo "   Repositorio: $REPO_NAME"
  echo "   Usuario: $GITHUB_USER"
  echo "   Rama: $BRANCH_NAME"
  echo "   Visibilidad: $REPO_VISIBILITY"
  echo ""
  echo "🔗 URL: https://github.com/$GITHUB_USER/$REPO_NAME"
  echo ""
  echo "Próximos pasos:"
  echo "  1. Abre el repositorio: gh repo view -w $GITHUB_USER/$REPO_NAME"
  echo "  2. Haz cambios y usa: git push origin main"
  echo "  3. Invita colaboradores desde GitHub"
  echo ""
}

################################################################################
# Main Function
################################################################################

main() {
  log_section "GitHub Connect - SDD-ES Skill"
  echo "Proyecto: $(pwd)"
  echo ""

  # Ejecutar pasos
  validate_github_token || return 1
  get_github_info || return 1
  check_git_repo || return 1
  check_repo_exists || return 1
  create_github_repo || return 1
  setup_remote || return 1
  create_initial_commit || return 1
  setup_main_branch || return 1
  initial_push || return 1
  save_config || return 1
  validate_result || return 1

  show_summary
  return 0
}

# Ejecutar main
main "$@"
