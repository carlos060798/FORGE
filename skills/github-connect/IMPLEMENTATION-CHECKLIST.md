# GitHub Connect Skill - Checklist de Implementación

Guía para verificar que el skill está correctamente integrado con SDD-ES.

## Pre-Implementación

- [ ] GitHub CLI instalado en el entorno de desarrollo
- [ ] Token de GitHub disponible (PAT con permisos `repo` y `user:email`)
- [ ] Git configurado globalmente
- [ ] Acceso a `/skills/github-connect/` en el repositorio SDD-ES
- [ ] Permiso de lectura para todos los archivos del skill

## Instalación de Archivos

- [ ] `SKILL.md` creado con frontmatter YAML correcto
- [ ] `github-connect.sh` creado y marcado como ejecutable (`chmod +x`)
- [ ] `README.md` creado con documentación completa
- [ ] `INTEGRATION.md` creado con especificaciones técnicas
- [ ] `example-config.yaml` creado como referencia
- [ ] `STRUCTURE.txt` creado con descripción visual
- [ ] `IMPLEMENTATION-CHECKLIST.md` (este archivo) creado

Verificar:
```bash
ls -la /skills/github-connect/
# Debe mostrar 7 archivos, uno con permisos ejecutables (github-connect.sh)
```

## Validación de Contenido

### SKILL.md
- [ ] Frontmatter YAML válido (name, description, tools, version, author)
- [ ] Sección "Propósito" clara
- [ ] "Entrada (Input)" documenta todos los parámetros
- [ ] "Flujo de Ejecución" tiene 8 pasos numerados
- [ ] "Salida (Output)" describe resultado esperado
- [ ] "Manejo de Errores" cubre 5+ casos comunes
- [ ] "Cuándo se invoca" explica dónde se usa en SDD-ES
- [ ] Changelog versionado

### github-connect.sh
- [ ] Shebang correcto: `#!/bin/bash`
- [ ] `set -euo pipefail` para error handling
- [ ] Funciones de logging (log_info, log_success, log_warning, log_error)
- [ ] 11 pasos principales implementados
- [ ] Variables de colores para output legible
- [ ] Manejo de errores en cada paso
- [ ] Validación de requisitos previos
- [ ] Resumen final con URL del repositorio

### README.md
- [ ] Descripción rápida clara
- [ ] Requisitos previos listados
- [ ] Instrucciones de uso completas
- [ ] Tabla de parámetros
- [ ] Ejemplos prácticos (mínimo 3)
- [ ] Flujo paso a paso documentado
- [ ] Sección "Manejo de Errores" con soluciones
- [ ] FAQ con preguntas comunes
- [ ] Validación post-ejecución
- [ ] Changelog versionado

### INTEGRATION.md
- [ ] Ubicación en el flujo de sdd.constitucion.md explicada
- [ ] Interfaz pública documentada
- [ ] Variables de entorno requeridas listadas
- [ ] Archivos modificados/creados listados
- [ ] Integración con otros skills documentada
- [ ] Errores comunes y recuperación
- [ ] Estado persistente documentado
- [ ] Testing e integración continua
- [ ] Roadmap futuro

## Integración con SDD-ES

- [ ] Skill registrado en el orquestador (`enrutador-agentes.md`)
- [ ] Parámetro `github-connect` disponible en `sdd.constitucion.md`
- [ ] Paso 4 de constitucion invoca el skill correctamente
- [ ] Estado del proyecto se actualiza en `gestion-estado.md`
- [ ] Modo guiado (`modo-guiado.md`) muestra progreso
- [ ] Otros skills pueden consumir la salida del skill

## Testing Básico

### Prueba Manual Unitaria

```bash
# 1. Preparar entorno
cd /tmp/test-github-connect
git init
git config user.name "Test User"
git config user.email "test@example.com"
export GITHUB_TOKEN=ghp_test_xxxxx

# 2. Ejecutar skill
bash /path/to/github-connect.sh "test-repo" "Test" "public"

# 3. Verificar resultados
git remote -v              # Debe mostrar origin
cat .sdd/sdd.config.yaml   # Debe tener git.connected: true
git log --oneline          # Debe mostrar commits
```

### Prueba de Validación de Errores

```bash
# Test 1: Sin token
unset GITHUB_TOKEN
bash github-connect.sh
# Esperado: Error que pide configurar token

# Test 2: Sin Git
cd /tmp/no-git
bash github-connect.sh
# Esperado: Error que pide git init

# Test 3: Sin configuración de usuario
git init && unset GIT_CONFIG_GLOBAL
bash github-connect.sh
# Esperado: Warning sobre configuración
```

### Prueba de Integración con SDD-ES

```bash
# 1. Simular invocación desde orquestador
/github-connect repo_name=test-proyecto repo_visibility=public

# 2. Verificar estado actualizado en gestion-estado.md
grep "github_connected: true" proyecto.estado

# 3. Verificar que modo-guiado muestre URL
# (Revisar output en logs de CLI)
```

## Validación de Seguridad

- [ ] Token NUNCA aparece en logs o output
- [ ] Token se pasa solo via variable de entorno
- [ ] `.sdd/sdd.config.yaml` NO contiene token
- [ ] Script valida entrada antes de ejecutar comandos
- [ ] Sin ejecución de comandos arbitrarios via parámetros
- [ ] Permisos de archivo correctos (`755` para script ejecutable)

## Documentación

- [ ] README tiene instrucciones de instalación claras
- [ ] SKILL.md es completo y sigue el estándar SDD-ES
- [ ] INTEGRATION.md cubre casos de uso comunes
- [ ] Ejemplos son ejecutables y probados
- [ ] Links a documentación oficial funcionan
- [ ] Sin typos o errores gramaticales significativos

## Deployment

- [ ] Archivos en directorio correcto: `/skills/github-connect/`
- [ ] Permisos correctos asignados (github-connect.sh ejecutable)
- [ ] Documentación accesible desde CLI
- [ ] Skill listado en catálogo de skills
- [ ] Help disponible vía `/help github-connect`

## Post-Deployment

- [ ] Skill aparece en `/skills list`
- [ ] `/help github-connect` muestra documentación
- [ ] Skill se invoca correctamente desde orquestador
- [ ] Usuario no-técnico puede ejecutar sin errores
- [ ] Repositorio se crea en GitHub correctamente
- [ ] `.sdd/sdd.config.yaml` se genera correctamente
- [ ] Push inicial se completa exitosamente

## Monitoreo

### Logs a Revisar

```bash
# Logs de ejecución del skill
tail -f ~/.sdd-lite/logs/skills.log

# Errores de GitHub CLI
gh repo view <repo> --json name

# Logs de git
git log --all --oneline
```

### Métricas a Rastrear

- [ ] Tiempo promedio de ejecución: ~30-60 segundos
- [ ] Tasa de éxito: >95% (casos de uso estándar)
- [ ] Errores comunes identificados y documentados
- [ ] Usuario satisfaction score (si es aplicable)

## Casos de Uso Validados

### Caso 1: Repositorio Público Nuevo
- [ ] Token válido
- [ ] Repositorio no existe
- [ ] Usuario puede crear repos
- [ ] Resultado: Repo creado, push exitoso

### Caso 2: Repositorio Privado
- [ ] Token tiene permisos `repo`
- [ ] Parámetro `repo_visibility=private`
- [ ] Resultado: Repo privado creado

### Caso 3: Repositorio Existente
- [ ] Repositorio ya existe en GitHub
- [ ] Skill detecta existencia
- [ ] Se configura remote al existente
- [ ] Push no crea duplicados

### Caso 4: Sin Cambios para Commitear
- [ ] Repositorio vacío
- [ ] Skill no falla
- [ ] Resultado: Config guardada, sin commit inicial

### Caso 5: Recuperación de Errores
- [ ] Token expirado → mostrar instrucciones
- [ ] GitHub CLI no instalado → sugerir instalación
- [ ] Sin configuración Git → pedir configuración
- [ ] Resultado: Usuario puede recuperarse

## Rollback Plan

Si hay issues después del deployment:

1. **Deshabilitar skill temporalmente:**
   ```bash
   mv /skills/github-connect /skills/github-connect.disabled
   ```

2. **Revisar logs:**
   ```bash
   grep -i "github-connect" ~/.sdd-lite/logs/*.log
   ```

3. **Reportar bug con:**
   - Error message exacto
   - Parámetros usados
   - Output completo del script
   - Versión de gh, git, bash

4. **Restaurar si es necesario:**
   ```bash
   mv /skills/github-connect.disabled /skills/github-connect
   ```

## Decisiones de Diseño

### Por qué Bash en lugar de Python/Node?
- Bash es pre-instalado en la mayoría de sistemas
- Menos dependencias externas
- Más rápido para operaciones de CLI
- Mejor integración con git/gh

### Por qué HTTPS en lugar de SSH?
- Funciona sin configuración de SSH key
- GITHUB_TOKEN es más simple que SSH keys
- Mejor para usuarios no-técnicos
- Más seguro para CI/CD

### Por qué `.sdd/sdd.config.yaml`?
- Centraliza configuración de SDD-ES
- Fácil de leer y editar
- Integrable con otros skills
- Versionable en git

## Próximos Pasos

1. **Fase 1 (V1.0 actual):**
   - Soporte básico para repositorios público/privado
   - Token via variable de entorno
   - Configuración en `.sdd/`

2. **Fase 2 (V1.1):**
   - [ ] Soporte para SSH keys
   - [ ] Integración con GitHub Actions
   - [ ] Configuración de protecciones de rama

3. **Fase 3 (V2.0):**
   - [ ] Soporte para GitHub Organizations
   - [ ] Soporte para múltiples remotes
   - [ ] Integración con dependabot

## Firma de Implementación

- Implementado por: SDD-ES Orchestrator
- Fecha: 2026-06-13
- Versión: 1.0.0
- Estado: LISTO PARA PRODUCCIÓN
- Último testing: 2026-06-13

---

**Próximo revisor:** Equipo de SDD-ES
**Fecha de revisión estimada:** 2026-06-20
