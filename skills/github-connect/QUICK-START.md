# GitHub Connect - Quick Start Guide

Comienza en menos de 5 minutos.

## 1. Requisitos Previos (30 segundos)

Verifica que tienes instalado:

```bash
git --version          # Debe ser 2.20+
gh --version           # Debe ser 1.0+
```

Si no tienes GitHub CLI:
- macOS: `brew install gh`
- Linux: `sudo apt install gh` (o tu gestor de paquetes)
- Windows: Descarga desde https://cli.github.com/

## 2. Configura tu Token (1 minuto)

1. Ve a: https://github.com/settings/tokens?type=beta
2. Click "Generate new token (beta)"
3. Nombre: `SDD-ES CLI`
4. Permisos: `repo` (todos) + `user:email`
5. Copia el token

Configura la variable de entorno:

```bash
# Linux/Mac
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxx

# Windows PowerShell
$env:GITHUB_TOKEN = "ghp_xxxxxxxxxxxxx"
```

## 3. Prepara tu Proyecto (1 minuto)

```bash
cd tu-proyecto

# Si no es git repo aún:
git init
git config user.name "Tu Nombre"
git config user.email "tu@email.com"
```

## 4. Ejecuta el Skill (2 minutos)

```bash
# Opción A: Comando rápido con defaults
/github-connect

# Opción B: Con parámetros personalizados
/github-connect \
  repo_name=mi-proyecto \
  repo_description="Mi proyecto increíble" \
  repo_visibility=private
```

## 5. Verifica (30 segundos)

```bash
# Ver remote
git remote -v

# Ver repositorio en GitHub
gh repo view

# Ver configuración guardada
cat .sdd/sdd.config.yaml
```

Done! Tu proyecto está en GitHub.

## Ejemplos Rápidos

### Repositorio Público

```bash
export GITHUB_TOKEN=ghp_xxxxx
cd mi-proyecto
/github-connect
```

### Repositorio Privado con Descripción

```bash
/github-connect \
  repo_name=app-privada \
  repo_description="Aplicación interna" \
  repo_visibility=private
```

### Rama Personalizada

```bash
/github-connect \
  repo_name=mi-proyecto \
  branch_name=develop
```

## Si algo va mal

### Error: Token no configurado

```bash
export GITHUB_TOKEN=ghp_xxxxx
# Luego ejecuta de nuevo
```

### Error: GitHub CLI no instalado

```bash
# macOS
brew install gh

# Linux (Debian/Ubuntu)
sudo apt install gh

# Windows
# Descarga desde https://cli.github.com/
```

### Error: Git no configurado

```bash
git config user.name "Tu Nombre"
git config user.email "tu@email.com"
```

### Error: Repositorio ya existe

El skill lo detecta y usa el existente. Si quieres uno diferente:

```bash
/github-connect repo_name=otro-nombre
```

## Ver más detalles

- Documentación completa: `README.md`
- Especificación técnica: `SKILL.md`
- Integración con SDD-ES: `INTEGRATION.md`
- Troubleshooting: Ver sección de errores en `README.md`

## Comandos Útiles Después

```bash
# Abrir repo en navegador
gh repo view -w

# Ver logs del repositorio
git log --oneline

# Configurar reglas de rama
gh repo edit --enable-branch-protection

# Añadir colaboradores
gh repo collaborators add usuario

# Ver estado del repositorio
gh repo view --json description,visibility,nameWithOwner
```

---

Eso es todo. Tu proyecto está listo para colaboración en GitHub.
