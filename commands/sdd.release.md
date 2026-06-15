---
description: Genera una nueva versión semántica del proyecto. Detecta el tipo de cambio (major/minor/patch) desde las specs completadas, actualiza el número de versión en el archivo correspondiente y genera/actualiza CHANGELOG.md.
allowed-tools: Read, Write, Edit, Bash
handoffs:
  - etiqueta: "Ver estado del proyecto"
    comando: sdd.estado
    prompt: "Mostrar estado actual con la nueva versión."
---

# /sdd.release — Versionado Semántico + CHANGELOG

Eres el **Gestor de Releases**. Automatizas el ciclo de versión sin acoplarte a Git ni a ningún registro de paquetes. El usuario decide cuándo publicar — tú solo preparas los artefactos.

---

## PASO 1 — Leer contexto actual

```bash
# Versión actual del proyecto
cat package.json 2>/dev/null | grep '"version"' | head -1
cat pyproject.toml 2>/dev/null | grep '^version' | head -1
cat Cargo.toml 2>/dev/null | grep '^version' | head -1
cat VERSION 2>/dev/null
cat .sdd/sdd.config.yaml 2>/dev/null | grep 'version' | head -3

# Último release registrado en SDD
cat .sdd/releases/ultimo.json 2>/dev/null || echo "{ \"version\": \"0.0.0\", \"fecha\": null, \"specs_incluidas\": [] }"

# Specs completadas desde el último release
ULTIMO_RELEASE=$(cat .sdd/releases/ultimo.json 2>/dev/null | grep -o '"fecha": "[^"]*"' | cut -d'"' -f4)
ls -lt .sdd/especificaciones/ 2>/dev/null | grep -v "^total" | head -20

# Leer todas las specs completadas (estado: completada o verificada)
for dir in .sdd/especificaciones/*/; do
  estado=$(cat "${dir}.estado-tareas.json" 2>/dev/null | grep '"estado_general"' | grep -o '"[^"]*"$' | tr -d '"')
  if [ "$estado" = "completada" ] || [ "$estado" = "verificada" ]; then
    echo "---SPEC: $dir"
    grep -E '^id:|^titulo:|^tamano:|^estado:' "${dir}spec.md" 2>/dev/null
  fi
done
```

---

## PASO 2 — Clasificar el tipo de release

Lee cada spec completada desde el último release y clasifica:

### Reglas de clasificación

| Indicador en la spec | Tipo de versión |
|---|---|
| Menciona "breaking change", "rompe compatibilidad", "migración obligatoria" | **major** (X.0.0) |
| `tamano: grande` con nuevas APIs o flujos | **minor** (.Y.0) |
| Feature nueva (`tamano: pequeño` o `mediano`) | **minor** (.Y.0) |
| Bugfix, refactor, performance, docs (`tamano: micro` o menciona "fix") | **patch** (.Y.Z) |

**Regla**: el tipo más alto gana. Si hay una major + tres patches → release major.

Presenta la clasificación al usuario antes de continuar:

```
📦 CLASIFICACIÓN DE RELEASE

Specs incluidas:
  ✅ [id] — [título] → minor (feature nueva)
  ✅ [id] — [título] → patch (bugfix)
  ✅ [id] — [título] → minor (feature nueva)

Tipo de release detectado: MINOR
Versión actual:  1.2.3
Nueva versión:   1.3.0

¿Confirmas? (o indica el tipo manualmente: major / minor / patch)
```

---

## PASO 3 — Bump de versión

Una vez confirmado, actualiza el archivo de versión correspondiente:

```bash
# Detectar dónde está la versión
VERSION_FILE=""
VERSION_ACTUAL=""

if [ -f "package.json" ]; then
  VERSION_FILE="package.json"
  VERSION_ACTUAL=$(grep '"version"' package.json | grep -oP '"\d+\.\d+\.\d+"' | tr -d '"')
fi

if [ -f "pyproject.toml" ] && grep -q '^version' pyproject.toml; then
  VERSION_FILE="pyproject.toml"
  VERSION_ACTUAL=$(grep '^version' pyproject.toml | grep -oP '"\d+\.\d+\.\d+"' | tr -d '"')
fi

if [ -f "Cargo.toml" ] && grep -q '^version' Cargo.toml; then
  VERSION_FILE="Cargo.toml"
  VERSION_ACTUAL=$(grep '^version' Cargo.toml | head -1 | grep -oP '"\d+\.\d+\.\d+"' | tr -d '"')
fi

echo "Archivo de versión: $VERSION_FILE"
echo "Versión actual: $VERSION_ACTUAL"
```

Calcula la nueva versión según el tipo detectado y actualiza el archivo con Edit.

**Formato por archivo:**
- `package.json`: `"version": "X.Y.Z"`
- `pyproject.toml`: `version = "X.Y.Z"`
- `Cargo.toml`: `version = "X.Y.Z"` (solo el primer bloque `[package]`)
- `VERSION`: solo el número `X.Y.Z`

Si no existe ninguno de estos archivos, crea `.sdd/releases/VERSION` con el número.

---

## PASO 4 — Generar entradas del CHANGELOG

Para cada spec completada, genera una entrada en el formato estándar Keep a Changelog:

### Mapeo de tipo de spec a sección

| Tipo de cambio detectado | Sección en CHANGELOG |
|---|---|
| Feature nueva (minor) | `### Added` |
| Bugfix (patch) | `### Fixed` |
| Refactor sin cambio funcional | `### Changed` |
| Deprecación | `### Deprecated` |
| Breaking change (major) | `### Removed` o `### Changed` con nota `⚠️ Breaking` |
| Performance, docs, seguridad | `### Changed` |

### Formato de entrada

```markdown
## [X.Y.Z] — YYYY-MM-DD

### Added
- [Título de la spec en lenguaje de usuario] (#[id-spec])

### Fixed
- [Título del bugfix] (#[id-spec])

### Changed
- [Título del cambio] (#[id-spec])
```

**Regla**: el texto de cada entrada viene del `titulo` de la spec — no se inventa. Si el título es muy técnico, simplificarlo para que lo entienda un usuario.

---

## PASO 5 — Actualizar CHANGELOG.md

```bash
# ¿Existe ya el CHANGELOG?
cat CHANGELOG.md 2>/dev/null | head -10
```

**Si no existe**: crea `CHANGELOG.md` con el encabezado estándar y la primera entrada.

**Si existe**: inserta la nueva versión DESPUÉS del encabezado y ANTES de la versión anterior:

```markdown
# Changelog

Todos los cambios notables se documentan aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/).
Versionado semántico: [SemVer](https://semver.org/lang/es/).

## [Unreleased]
<!-- Próximos cambios -->

## [X.Y.Z] — YYYY-MM-DD   ← NUEVA ENTRADA AQUÍ

### Added
- ...

## [X.Y.W] — YYYY-MM-DD   ← versión anterior (no tocar)
...
```

---

## PASO 6 — Registrar el release en SDD

Crea o actualiza `.sdd/releases/ultimo.json`:

```json
{
  "version": "X.Y.Z",
  "tipo": "minor",
  "fecha": "YYYY-MM-DD",
  "specs_incluidas": [
    { "id": "[id]", "titulo": "[título]", "tipo": "minor" }
  ],
  "archivo_version": "package.json"
}
```

Crea también el registro histórico en `.sdd/releases/historial/X.Y.Z.json` con el mismo contenido.

---

## PASO 7 — Mostrar resultado

```
✅ Release preparado

📦 Versión:    1.2.3 → 1.3.0 (minor)
📁 Actualizado: package.json
📝 Actualizado: CHANGELOG.md

Specs incluidas en este release:
  • [id] — [título] (minor)
  • [id] — [título] (patch)

SIGUIENTE PASO (lo que tú decides hacer):
   git add package.json CHANGELOG.md
   git commit -m "chore: release v1.3.0"
   git tag v1.3.0

SDD-ES no ejecuta esto automáticamente — el control de versiones es tuyo.
```

---

## Casos especiales

### `/sdd.release patch` / `/sdd.release minor` / `/sdd.release major`
Si el usuario especifica el tipo manualmente, salta la detección automática y usa el tipo indicado.

### `/sdd.release --preview`
Muestra qué entraría en el siguiente release sin modificar ningún archivo.

### Sin specs completadas desde el último release
```
⚠️ No se encontraron specs completadas desde el último release (v1.2.3).

Si quieres forzar un release de todos modos:
   /sdd.release patch --forzar
```

### Proyecto nuevo sin versión
Si no hay archivo de versión ni releases previos, pregunta:
```
No encontré versión en el proyecto.

¿Cuál es la versión inicial?
   1. 0.1.0  ← recomendado para proyectos en desarrollo
   2. 1.0.0  ← si ya es un release público estable
   3. Otra (escribe el número)
```
