---
name: github-connect
description: Conecta el proyecto a GitHub automáticamente. Crea repo, configura remote, hace push inicial.
tools: ["Bash", "Read", "Edit", "Grep"]
version: 1.0.0
author: SDD-ES Orchestrator
---

# GitHub Connect Skill

## Propósito

Eliminar la fricción de crear repositorio GitHub manualmente. Para usuarios no-técnicos, este proceso es una barrera insuperable. Este skill automatiza completamente:

1. Validación del token de autenticación
2. Creación del repositorio en GitHub
3. Configuración del remote local
4. Primer commit y push
5. Registro de configuración en `.sdd/sdd.config.yaml`

## Entrada (Input)

El skill acepta los siguientes parámetros (todos opcionales):

```
GITHUB_TOKEN        : Token de autenticación (variable de entorno o parámetro)
repo_name           : Nombre del repositorio en GitHub (default: nombre de carpeta actual)
repo_description    : Descripción del repositorio (default: "Proyecto SDD-ES")
repo_visibility     : "public" o "private" (default: "public")
branch_name         : Rama principal (default: "main")
auto_init_commit    : true/false - hacer commit inicial (default: true)
```

## Flujo de Ejecución

### 1. Validación del Token GitHub

```bash
# Verificar que GITHUB_TOKEN está disponible
if [ -z "$GITHUB_TOKEN" ]; then
  echo "❌ GITHUB_TOKEN no configurado"
  echo "Genera un token en: https://github.com/settings/tokens?type=beta"
  echo "Instrucciones: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token"
  exit 1
fi

# Probar autenticación
gh auth status --show-token 2>/dev/null || {
  echo "❌ Token de GitHub inválido o expirado"
  echo "Genera uno nuevo: https://github.com/settings/tokens?type=beta"
  exit 1
}
```

### 2. Obtener Información del Usuario y del Proyecto

```bash
# Obtener usuario de GitHub
GITHUB_USER=$(gh api user --jq .login 2>/dev/null)
if [ -z "$GITHUB_USER" ]; then
  echo "❌ No se pudo obtener usuario de GitHub"
  exit 1
fi

# Nombre del repositorio (default a nombre de carpeta)
REPO_NAME="${repo_name:=$(basename "$(pwd)")}"
REPO_DESCRIPTION="${repo_description:=Proyecto SDD-ES}"
REPO_VISIBILITY="${repo_visibility:=public}"
BRANCH_NAME="${branch_name:=main}"

echo "📋 Configuración:"
echo "   Usuario: $GITHUB_USER"
echo "   Repo: $REPO_NAME"
echo "   Descripción: $REPO_DESCRIPTION"
echo "   Visibilidad: $REPO_VISIBILITY"
```

### 3. Verificar si el Repo Existe

```bash
# Comprobar existencia del repositorio
REPO_URL="https://github.com/$GITHUB_USER/$REPO_NAME"
if gh repo view "$GITHUB_USER/$REPO_NAME" --json name 2>/dev/null | grep -q "$REPO_NAME"; then
  echo "⚠️  El repositorio '$REPO_NAME' ya existe en GitHub"
  echo "   URL: $REPO_URL"
  echo "   Se usará el repositorio existente."
  REPO_EXISTS=true
else
  REPO_EXISTS=false
fi
```

### 4. Crear Repositorio (si no existe)

```bash
if [ "$REPO_EXISTS" = false ]; then
  echo "🔨 Creando repositorio en GitHub..."
  
  gh repo create "$REPO_NAME" \
    --description "$REPO_DESCRIPTION" \
    --"$REPO_VISIBILITY" \
    --source=. \
    --remote=origin \
    --push \
    2>&1 | grep -E "^✓|error|Error" || true
  
  if [ $? -ne 0 ]; then
    echo "❌ Error al crear el repositorio"
    exit 1
  fi
  echo "✅ Repositorio creado en GitHub"
fi
```

### 5. Configurar Remote Local

```bash
# Verificar si ya existe remote origin
if git remote get-url origin 2>/dev/null | grep -q "$REPO_NAME"; then
  echo "✓ Remote ya configurado"
else
  echo "🔗 Configurando remote..."
  REMOTE_URL="https://github.com/$GITHUB_USER/$REPO_NAME.git"
  
  # Remover remote anterior si existe
  git remote remove origin 2>/dev/null || true
  
  # Añadir nuevo remote
  git remote add origin "$REMOTE_URL"
  echo "✅ Remote configurado: $REMOTE_URL"
fi
```

### 6. Hacer Commit Inicial (si es necesario)

```bash
AUTO_INIT="${auto_init_commit:=true}"

if [ "$AUTO_INIT" = true ]; then
  # Verificar cambios pendientes
  if ! git diff-index --quiet HEAD 2>/dev/null; then
    echo "📝 Haciendo commit inicial..."
    git add -A
    git commit -m "feat: Inicialización del proyecto SDD-ES

- Proyecto conectado a GitHub
- Configuración inicial completada"
    echo "✅ Commit inicial creado"
  else
    echo "ℹ️  No hay cambios pendientes para commitear"
  fi
fi
```

### 7. Push Inicial a GitHub

```bash
echo "🚀 Haciendo push a GitHub..."

# Configurar rama local
git branch -M "$BRANCH_NAME" 2>/dev/null || true

# Push con -u para establecer rama upstream
git push -u origin "$BRANCH_NAME" 2>&1 | grep -E "^✓|error|Error" || true

if [ $? -eq 0 ]; then
  echo "✅ Push completado"
else
  echo "⚠️  Push completado con advertencias"
fi
```

### 8. Actualizar Configuración Local

```bash
echo "💾 Actualizando configuración local..."

# Crear directorio .sdd si no existe
mkdir -p .sdd

# Crear o actualizar sdd.config.yaml
cat > .sdd/sdd.config.yaml << EOF
# Configuración de GitHub - SDD-ES
git:
  remote_url: "https://github.com/$GITHUB_USER/$REPO_NAME.git"
  connected: true
  connected_at: "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  github_user: "$GITHUB_USER"
  repo_name: "$REPO_NAME"
  branch: "$BRANCH_NAME"
  visibility: "$REPO_VISIBILITY"
EOF

echo "✅ Configuración guardada en .sdd/sdd.config.yaml"

# Hacer commit de la configuración
if [ "$AUTO_INIT" = true ]; then
  git add .sdd/sdd.config.yaml
  git commit -m "chore: Añadir configuración de GitHub" 2>/dev/null || true
  git push origin "$BRANCH_NAME" 2>/dev/null || true
fi
```

## Salida (Output)

Al completarse exitosamente, el skill proporciona:

```
✅ Conexión completada exitosamente

📊 Resumen:
   Repositorio: github.com/<user>/<repo>
   Rama: main
   Visibilidad: public
   Remote: https://github.com/<user>/<repo>.git

🔗 URL: https://github.com/<user>/<repo>
✨ Tu proyecto está en GitHub y listo para colaborar
```

## Manejo de Errores

### Caso 1: Token No Configurado
```
❌ GITHUB_TOKEN no configurado
Genera un token en: https://github.com/settings/tokens?type=beta
Instrucciones: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token

Pasos:
1. Ve a https://github.com/settings/tokens?type=beta
2. Click en "Generate new token" > "Generate new token (beta)"
3. Dale nombre: "SDD-ES CLI"
4. Permisos: repo (todo), user:email
5. Copia el token
6. Configura: export GITHUB_TOKEN=ghp_xxxxx
```

### Caso 2: Token Inválido/Expirado
```
❌ Token de GitHub inválido o expirado
Genera uno nuevo: https://github.com/settings/tokens?type=beta

El token puede haber expirado o no tener los permisos necesarios.
Permisos requeridos: repo (all scopes), user:email
```

### Caso 3: Repositorio Existente
```
⚠️  El repositorio 'mi-proyecto' ya existe en GitHub
   URL: https://github.com/usuario/mi-proyecto
   Se usará el repositorio existente.

El skill detectó que el repo ya existe y configurará el remote
para que apunte al repositorio existente.
```

### Caso 4: Git No Inicializado
```
❌ Este directorio no es un repositorio Git
Inicializa uno primero: git init
```

### Caso 5: Sin Cambios para Commitear
```
ℹ️  No hay cambios pendientes para commitear
El repositorio está vacío o todos los cambios están ya commiteados.
```

## Integración con SDD-ES

### Invocar desde el Orquestador

El skill se invoca automáticamente en el **PASO 4** de `sdd.constitucion.md`:

```yaml
# En sdd.constitucion.md, después de configuración base
cuando_usuario_dice: "sí, guardar en GitHub"
entonces:
  invocar_skill: github-connect
  parametros:
    repo_name: ${proyecto.nombre}
    repo_description: "${proyecto.descripcion}"
    repo_visibility: public
```

### Invocación Manual

Los usuarios pueden invocar el skill manualmente:

```bash
/sdd.github-connect repo_name=mi-proyecto repo_visibility=private
```

O desde CLI:
```bash
sdd skill github-connect --repo-name mi-proyecto --visibility private
```

## Prerequisitos

- `git` instalado y `git config --global user.name` y `user.email` configurados
- `gh` (GitHub CLI) instalado: https://cli.github.com/
- Token de GitHub válido con permisos `repo` y `user:email`
- Directorio debe ser un repositorio Git (ejecutar `git init` si es necesario)

## Validación Post-Ejecución

Después de que el skill se ejecuta, verifica:

```bash
# 1. Remote está configurado
git remote -v
# Debe mostrar origin con la URL correcta

# 2. Branch upstream configurado
git branch -vv
# Debe mostrar main [origin/main] o similar

# 3. Configuración guardada
cat .sdd/sdd.config.yaml
# Debe contener git.connected: true

# 4. Repositorio accessible
gh repo view <usuario>/<repo>
# Debe mostrar detalles del repositorio
```

## Notas Técnicas

- El skill usa `gh cli` para operaciones de GitHub (más seguro que HTTPS)
- Los tokens se tratan siempre como secretos, nunca se loguean
- Si algo falla, el skill proporciona instrucciones claras de recuperación
- El skill es idempotente: puede ejecutarse múltiples veces sin causar problemas
- Los remotes existentes se respetan (no se sobrescriben sin confirmación)

## Changelog

### v1.0.0 (2026-06-13)
- Versión inicial
- Creación automática de repositorio
- Configuración de remote
- Commit y push inicial
- Integración con `.sdd/sdd.config.yaml`
