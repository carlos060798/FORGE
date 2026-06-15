# GitHub Connect - Guía de Integración

Documentación para integrar el skill `github-connect` con el orquestador SDD-ES y otros componentes.

## Integración con sdd.constitucion.md

En el archivo `sdd.constitucion.md`, el skill se invoca en el **PASO 4** del flujo constitucional:

### Ubicación en el Flujo

```yaml
PASO 1: Recopilación de Información del Proyecto
  └─ Nombre, descripción, stack

PASO 2: Creación de Estructura Base
  └─ Carpetas, archivos de configuración

PASO 3: Inicialización de Dependencias
  └─ npm install, pip install, etc.

PASO 4: Conexión a GitHub (← github-connect se invoca aquí)
  └─ "¿Guardar el proyecto en GitHub?"
  └─ Si usuario dice "sí" → invocar github-connect
  └─ Si usuario dice "no" → continuar sin GitHub

PASO 5: Configuración Final
  └─ Hooks pre-commit, configuración IDE, etc.

PASO 6: Resumen y Próximos Pasos
  └─ Mostrar URL del repositorio, instrucciones finales
```

### Invocación desde el Orquestador

El orquestador (`enrutador-agentes.md` u similar) debe invocar el skill así:

**En YAML:**
```yaml
cuando_usuario_responde: "sí, guardar en GitHub"
entonces:
  skill: github-connect
  parametros:
    repo_name: ${proyecto.nombre}
    repo_description: "${proyecto.descripcion}"
    repo_visibility: "public"
  contexto:
    proyecto_path: ${proyecto.ruta}
    usuario_email: ${usuario.email}
    stack: ${proyecto.stack}
```

**En Markdown (sdd.constitucion.md):**
```markdown
## Paso 4: Conexión a GitHub

¿Deseas guardar este proyecto en GitHub?

[Sí, guardar en GitHub]  [No, ahora no]

Si selecciona "Sí":
- Ejecuta: `/github-connect repo_name={proyecto.nombre}`
- El skill manejará:
  - Validar token de GitHub
  - Crear repositorio
  - Configurar remote
  - Push inicial
```

## Interfaz Pública del Skill

### Parámetros de Entrada

```bash
github-connect [OPTIONS]

OPTIONS:
  --repo-name TEXT              Nombre del repositorio (default: nombre de carpeta)
  --repo-description TEXT       Descripción (default: "Proyecto SDD-ES")
  --repo-visibility TEXT        "public" o "private" (default: "public")
  --branch-name TEXT            Nombre de rama (default: "main")
  --auto-init-commit BOOL       Hacer commit inicial (default: true)
  --github-token TEXT           Token de GitHub (busca en $GITHUB_TOKEN si no se proporciona)
  --help                        Mostrar ayuda
```

### Salida Esperada

**Éxito:**
```json
{
  "status": "success",
  "repository": {
    "name": "mi-proyecto",
    "owner": "usuario",
    "url": "https://github.com/usuario/mi-proyecto",
    "visibility": "public",
    "branch": "main"
  },
  "git": {
    "remote_url": "https://github.com/usuario/mi-proyecto.git",
    "upstream_configured": true,
    "initial_push_completed": true
  },
  "config_file": ".sdd/sdd.config.yaml"
}
```

**Error:**
```json
{
  "status": "error",
  "error_code": "INVALID_TOKEN",
  "message": "Token de GitHub inválido o expirado",
  "recovery_url": "https://github.com/settings/tokens?type=beta"
}
```

## Variables de Entorno Esperadas

El skill necesita:

```bash
GITHUB_TOKEN=ghp_xxxxxxxxxxxxx
```

Puede ser:
- Exportada globalmente: `export GITHUB_TOKEN=...`
- Pasada al skill: `github-connect --github-token ghp_xxx`
- Obtenida de `~/.config/gh/hosts.yml` (gh cli)

## Archivos Modificados/Creados

Después de la ejecución, el skill:

**Crea:**
- `.sdd/sdd.config.yaml` - Configuración de GitHub

**Modifica:**
- `.git/config` - Añade remote origin
- Commits iniciales en la rama main

**No toca:**
- Token de GitHub (nunca se persiste)
- Archivos de usuario existentes

## Integración con Otros Skills

### Con `deteccion-stack.md`

```yaml
# El stack detectado se puede pasar al github-connect
si: Stack detectado = Node.js
entonces:
  github-connect:
    repo_description: "Proyecto Node.js con ${framework}"
```

### Con `gestion-estado.md`

```yaml
# Después de github-connect, actualizar estado del proyecto
github-connect completado:
  proyecto.github_connected = true
  proyecto.repo_url = "https://github.com/..."
  proyecto.git_configured = true
```

### Con `modo-guiado.md`

```yaml
# En modo guiado, mostrar progreso
Paso 4/6: Conectando a GitHub...
  - Validando token... ✓
  - Creando repositorio... ✓
  - Configurando remote... ✓
  - Push inicial... ✓
  
Tu repositorio está en: https://github.com/usuario/proyecto
```

## Errores Comunes y Recuperación

### 1. GITHUB_TOKEN no configurado

**Error:**
```
❌ GITHUB_TOKEN no configurado
```

**Recuperación Automática:**
```yaml
mostrar_instrucciones: true
url_token: "https://github.com/settings/tokens?type=beta"
permitir_reintentar: true
```

### 2. GitHub CLI no instalado

**Detección:**
```bash
if ! command -v gh &> /dev/null; then
  echo "gh no está instalado"
  # Ofrecer instalación automática
fi
```

**Instalación Automática (opcional):**
```bash
# En Mac
brew install gh

# En Linux (Ubuntu)
sudo apt install gh

# En Windows (si Chocolatey está disponible)
choco install gh
```

### 3. Git no inicializado

**Detección:**
```bash
if [ ! -d ".git" ]; then
  git init
  git config user.name "${usuario.nombre}"
  git config user.email "${usuario.email}"
fi
```

### 4. Repositorio ya existe

**Comportamiento:**
- No crear repositorio nuevo
- Usar el repositorio existente
- Configurar remote para que apunte al existente
- Preguntar si desea hacer push a repositorio existente

## Estado Persistente

### Configuración Guardada

En `.sdd/sdd.config.yaml`:
```yaml
git:
  remote_url: "https://github.com/usuario/repo.git"
  connected: true
  connected_at: "2026-06-13T14:32:45Z"
  github_user: "usuario"
  repo_name: "repo"
  branch: "main"
  visibility: "public"
```

### Usar Configuración en Otros Skills

```bash
# Leer configuración
REPO_URL=$(grep 'remote_url' .sdd/sdd.config.yaml | cut -d'"' -f2)
GITHUB_USER=$(grep 'github_user' .sdd/sdd.config.yaml | cut -d'"' -f2)

# Verificar conexión
if grep -q 'connected: true' .sdd/sdd.config.yaml; then
  echo "GitHub está conectado"
fi
```

## Flujo de Reintentos

Si el skill falla, el orquestador puede reintentar:

```yaml
reintentos:
  max_intentos: 3
  espera_entre_intentos: 5000ms  # 5 segundos
  exponencial_backoff: true
  
  errores_reinentables:
    - NETWORK_ERROR
    - GITHUB_API_RATE_LIMIT
    - TEMPORARY_FAILURE
  
  errores_no_reinentables:
    - INVALID_TOKEN
    - REPO_ALREADY_EXISTS
    - PERMISSION_DENIED
```

## Testing e Integración Continua

### Probar el Skill Localmente

```bash
# Instalar requisitos
sudo apt install git gh

# Configurar token
export GITHUB_TOKEN=ghp_test_xxxxx

# Ejecutar en repo test
mkdir test-sdd-lite
cd test-sdd-lite
git init
git config user.name "Test User"
git config user.email "test@example.com"

# Correr skill
bash /path/to/github-connect.sh "test-repo" "Test description" "public"
```

### Validar Ejecución

```bash
# Verificar remote
git remote -v

# Verificar config
cat .sdd/sdd.config.yaml

# Verificar push
git log --oneline

# Verificar en GitHub
gh repo view
```

### CI/CD Integration

En `.github/workflows/sdd-ci.yml`:
```yaml
name: SDD Continuous Integration

on: [push, pull_request]

jobs:
  validate-github-config:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Validate GitHub config
        run: |
          if [ -f ".sdd/sdd.config.yaml" ]; then
            echo "✓ GitHub config file exists"
            cat .sdd/sdd.config.yaml
          fi
```

## Notas para Mantenimiento

- **Versión**: 1.0.0
- **Compatibilidad**: Git 2.20+, GitHub CLI 1.0+
- **Soporte**: usuario@sdd-es.com
- **Licencia**: MIT (o la del proyecto SDD-ES)

## Cambios Futuros (Roadmap)

- [ ] Soporte para SSH keys
- [ ] Integración con Actions (CI/CD)
- [ ] Soporte para GitHub Organizations
- [ ] Configuración de protecciones de rama
- [ ] Integración con Dependabot
- [ ] Soporte para múltiples remotes
