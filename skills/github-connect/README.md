# GitHub Connect Skill - Documentación

Skill para conectar automáticamente un proyecto a GitHub. Elimina la fricción de crear repositorio manualmente.

## Descripción Rápida

Este skill automatiza completamente el proceso de:

1. ✅ Validar token de GitHub
2. ✅ Crear repositorio en GitHub
3. ✅ Configurar remote local
4. ✅ Hacer commit y push inicial
5. ✅ Guardar configuración en `.sdd/sdd.config.yaml`

## Requisitos Previos

### 1. Git Configurado

```bash
# Inicializa git si no está
git init

# Configura tu usuario
git config user.name "Tu Nombre"
git config user.email "tu@email.com"
```

### 2. GitHub CLI Instalado

Descargalo desde: https://cli.github.com/

Verifica que está instalado:
```bash
gh --version
```

### 3. Token de GitHub

Necesitas un token de acceso personal (PAT) con permisos `repo` y `user:email`.

#### Generar Token

1. Ve a: https://github.com/settings/tokens?type=beta
2. Click en "Generate new token (beta)"
3. Configura:
   - **Token name**: `SDD-ES CLI`
   - **Expiration**: 90 days (o más)
   - **Permissions**: 
     - `repo` (todos los scopes)
     - `user:email`
4. Click "Generate token"
5. Copia el token inmediatamente

#### Configurar Token

**Opción A: Variable de Entorno (Recomendado)**

```bash
# Linux/Mac
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxx

# Windows PowerShell
$env:GITHUB_TOKEN = "ghp_xxxxxxxxxxxxx"

# Windows CMD
set GITHUB_TOKEN=ghp_xxxxxxxxxxxxx
```

**Opción B: Usar gh cli directamente**

```bash
gh auth login
# Selecciona GitHub.com
# Selecciona HTTPS
# Pega el token cuando lo pida
```

## Uso

### Desde el CLI (SDD-ES)

```bash
/github-connect repo_name=mi-proyecto repo_visibility=public
```

Con parámetros:
```bash
/github-connect \
  repo_name=my-awesome-project \
  repo_description="Mi proyecto increíble" \
  repo_visibility=private
```

### Manualmente desde Bash

```bash
# Descarga el script
curl -O https://raw.githubusercontent.com/.../github-connect.sh
chmod +x github-connect.sh

# Ejecuta
./github-connect.sh "nombre-repo" "Descripción" "public"
```

O usa directamente en tu proyecto:

```bash
cd mi-proyecto
export GITHUB_TOKEN=ghp_xxxxx
bash /path/to/github-connect.sh
```

## Parámetros

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `repo_name` | string | Nombre de la carpeta | Nombre del repositorio en GitHub |
| `repo_description` | string | "Proyecto SDD-ES" | Descripción del repositorio |
| `repo_visibility` | string | "public" | `public` o `private` |
| `branch_name` | string | "main" | Nombre de la rama principal |
| `auto_init_commit` | boolean | true | Hacer commit inicial automático |

## Ejemplos

### Ejemplo 1: Repositorio Público Simple

```bash
export GITHUB_TOKEN=ghp_xxxxx
cd mi-proyecto
/github-connect
```

Usa defaults:
- Nombre: `mi-proyecto` (nombre de la carpeta)
- Descripción: `Proyecto SDD-ES`
- Visibilidad: `public`

### Ejemplo 2: Repositorio Privado con Descripción

```bash
/github-connect \
  repo_name=app-privada \
  repo_description="Aplicación interna de ventas" \
  repo_visibility=private
```

### Ejemplo 3: Rama Personalizada

```bash
/github-connect \
  repo_name=mi-proyecto \
  branch_name=develop
```

## Flujo Paso a Paso

```
┌─────────────────────────────────────────────────────┐
│         GitHub Connect Skill Workflow                │
└─────────────────────────────────────────────────────┘

1. Validar Token
   └─ ¿GITHUB_TOKEN existe?
      └─ ¿Token válido en GitHub?

2. Obtener Info de Usuario
   └─ gh api user (obtener username)

3. Verificar Git
   └─ ¿.git existe?
   └─ ¿user.name y user.email configurados?

4. Verificar Repo en GitHub
   └─ ¿Ya existe el repositorio?
      ├─ Sí: Usar existente
      └─ No: Crear nuevo

5. Crear Repo (si es necesario)
   └─ gh repo create <repo_name>

6. Configurar Remote
   └─ git remote add origin <url>

7. Commit Inicial
   └─ git add -A
   └─ git commit -m "feat: Inicialización..."

8. Configurar Rama Main
   └─ git branch -M main

9. Push Inicial
   └─ git push -u origin main

10. Guardar Configuración
    └─ Crear .sdd/sdd.config.yaml
    └─ git add & commit

11. Validación Final
    └─ Verificar remote
    └─ Verificar upstream
    └─ Verificar config local

✅ Completado
```

## Manejo de Errores

### Error: GITHUB_TOKEN no configurado

```
❌ GITHUB_TOKEN no configurado
```

**Solución:**
```bash
# Genera un token en: https://github.com/settings/tokens?type=beta
export GITHUB_TOKEN=ghp_xxxxx
```

### Error: Token inválido o expirado

```
❌ Token de GitHub inválido o expirado
```

**Solución:**
1. Ve a https://github.com/settings/tokens
2. Revoca el token antiguo
3. Genera uno nuevo
4. Configura: `export GITHUB_TOKEN=ghp_xxxxx`

### Error: GitHub CLI no está instalado

```
❌ GitHub CLI (gh) no está instalado
```

**Solución:**
```bash
# macOS
brew install gh

# Linux (Debian/Ubuntu)
sudo apt-key adv --keyserver keyserver.ubuntu.com --recv-key C99B11DEB97FBCE48B3E4314C6CB2D21C7BC7C3F
echo "deb https://cli.github.com/packages focal main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update
sudo apt install gh

# Windows
choco install gh
# o descargalo desde: https://cli.github.com/
```

### Error: El repositorio ya existe

```
⚠️  El repositorio 'mi-proyecto' ya existe en GitHub
   URL: https://github.com/usuario/mi-proyecto
   Se usará el repositorio existente.
```

**Esto no es un error**, el skill detectó que el repo ya existe y lo usará. Si quieres usar uno diferente:

```bash
/github-connect repo_name=otro-nombre
```

### Error: No hay cambios para commitear

```
ℹ️  No hay cambios pendientes para commitear
```

**Esto es normal** si el repositorio está vacío o todos los cambios están ya commiteados.

### Error: Este directorio no es un repositorio Git

```
❌ Este directorio no es un repositorio Git
```

**Solución:**
```bash
git init
git config user.name "Tu Nombre"
git config user.email "tu@email.com"
```

## Validación Post-Ejecución

Después de que el skill termina, verifica que todo está correcto:

```bash
# 1. Remote está configurado
git remote -v
# Debería mostrar algo como:
# origin  https://github.com/usuario/proyecto.git (fetch)
# origin  https://github.com/usuario/proyecto.git (push)

# 2. Rama upstream está configurada
git branch -vv
# Debería mostrar: main [origin/main] ...

# 3. Configuración está guardada
cat .sdd/sdd.config.yaml
# Debería mostrar: git.connected: true

# 4. Repositorio está accessible
gh repo view
# Debería mostrar detalles del repositorio
```

## FAQ

**P: ¿Qué pasa si el repositorio ya existe?**

R: El skill detecta si el repositorio existe y lo usa en lugar de crear uno nuevo. Se configura el remote para que apunte al repositorio existente.

**P: ¿Puedo cambiar la visibilidad de público a privado después?**

R: Sí, desde GitHub:
1. Ve a Settings > Change repository visibility
2. Selecciona "Private"
3. Confirma

O desde CLI:
```bash
gh repo edit --visibility private
```

**P: ¿Qué permisos necesita el token?**

R: Mínimamente:
- `repo` (todos los scopes) - para crear y pushear a repositorios
- `user:email` - para obtener información del usuario

**P: ¿Puedo usar SSH en lugar de HTTPS?**

R: El skill usa HTTPS por defecto. Para cambiar a SSH manualmente después:

```bash
git remote set-url origin git@github.com:usuario/repo.git
```

**P: ¿Qué pasa si el push falla?**

R: El skill intentará hacer push. Si falla, asegúrate de:
1. Tienes permisos de push en el repositorio
2. El token tiene permisos `repo`
3. Tu SSH key está configurada (si usas SSH)
4. La rama remota existe

**P: ¿El skill es seguro?**

R: Sí:
- El token nunca se loguea o imprime en pantalla
- Solo se almacena en memoria durante la ejecución
- La configuración guardada no incluye el token
- Usa comunicación HTTPS segura

## Integración con SDD-ES

El skill se invoca automáticamente desde `sdd.constitucion.md` cuando el usuario responde "sí" a guardar el proyecto en GitHub.

También puede ser invocado manualmente en cualquier momento:

```bash
/github-connect
```

## Notas Técnicas

- **Idempotente**: Puedes ejecutar el skill múltiples veces sin causar problemas
- **Destructivo**: Si no quieres que se cree un commit inicial, pasa `auto_init_commit=false`
- **Seguro**: El skill no sobrescribe remotes sin advertencia
- **Informativo**: Proporciona feedback claro en cada paso

## Soporte

Si encuentras problemas:

1. Verifica que tienes todos los requisitos instalados:
   ```bash
   git --version
   gh --version
   echo $GITHUB_TOKEN  # Debe mostrar algo
   ```

2. Asegúrate de que Git está configurado:
   ```bash
   git config user.name
   git config user.email
   ```

3. Valida el token:
   ```bash
   gh auth status
   ```

4. Leer logs detallados:
   ```bash
   /github-connect --verbose
   ```

## Changelog

### v1.0.0 (2026-06-13)
- Versión inicial
- Creación automática de repositorio
- Configuración de remote
- Commit y push inicial
- Integración con `.sdd/sdd.config.yaml`
- Validación completa de errores
- Soporte para repositorios públicos y privados
